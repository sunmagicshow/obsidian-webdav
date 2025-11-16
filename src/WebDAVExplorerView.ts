import {WorkspaceLeaf, View, Notice, Menu, MarkdownView, setIcon} from 'obsidian';
import WebDAVPlugin from './main';
import {WebDAVServer, VIEW_TYPE_WEBDAV_EXPLORER, AppWithSettings} from './types';
import {FileStat} from 'webdav';
import {WebDAVClient} from './WebDAVClient';

export class WebDAVExplorerView extends View {
    plugin: WebDAVPlugin;
    client: WebDAVClient | null = null;
    currentPath: string = '/';
    selectedItem: HTMLElement | null = null;
    rootPath: string = '/';
    currentServer: WebDAVServer | null = null;

    // DOM元素引用
    private serverSelector: HTMLElement | null = null;
    private serverNameEl: HTMLElement | null = null;
    private serverIconEl: HTMLElement | null = null;

    // 排序相关属性
    private sortField: 'name' | 'type' | 'size' | 'date' = 'name';
    private sortOrder: 'asc' | 'desc' = 'asc';
    private sortButton: HTMLElement | null = null;
    private sortIconEl: HTMLElement | null = null;
    private refreshDebounceTimer: number | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: WebDAVPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.currentServer = plugin.getCurrentServer();
    }

    private get t() {
        return this.plugin.i18n();
    }

    getViewType(): string {
        return VIEW_TYPE_WEBDAV_EXPLORER;
    }

    getDisplayText(): string {
        return this.t.displayName;
    }

    getIcon(): string {
        return 'cloud'; // 使用云图标
    }

    async onOpen() {
        this.containerEl.empty();
        this.containerEl.addClass('webdav-explorer-view');

        // 更新当前服务器
        this.currentServer = this.plugin.getCurrentServer();
        this.buildNormalView();
        if (!this.currentServer) {
            this.showNoServerConfigured();
            return;
        }

        // 连接服务器并列出文件
        await this.connectAndList();
    }

    // 连接服务器并列出目录
    async connectAndList() {
        if (!this.currentServer) {
            this.showNoServerConfigured();
            return;
        }

        const {url, username, password} = this.currentServer;

        // 检查必要配置
        if (!url || !username || !password) {
            this.showNoServerConfigured();
            return;
        }

        try {
            if (this.containerEl.querySelector('.webdav-connection-failed')) {
                this.buildNormalView();
            }
            const success = await this.initializeClient();
            if (!success) {
                throw new Error('Failed to initialize client');
            }
            await this.listDirectory(this.currentPath);
            return true;
        } catch {
            this.showConnectionFailed();
            this.showErrorNotice(this.t.view.connectionFailed);
            return false;
        }
    }

    // 获取根路径（基于服务器配置）
    getRootPath(): string {
        if (!this.currentServer) return '/';

        const raw = this.currentServer.remoteDir.trim();
        // 处理路径格式：去除多余斜杠，确保正确格式
        return raw === '' || raw === '/' ? '/' : '/' + raw.replace(/^\/+/, '').replace(/\/+$/, '');
    }

    // 创建面包屑导航
    createBreadcrumb(path: string) {
        const breadcrumbContainer = this.containerEl.querySelector('.webdav-breadcrumb-container');
        if (!breadcrumbContainer) return;

        breadcrumbContainer.empty();
        const breadcrumbEl = breadcrumbContainer.createEl('div', {cls: 'webdav-breadcrumb'});

        const rootPath = this.rootPath;

        // 确保当前路径以根路径开头
        let currentFullPath = path;
        if (!currentFullPath.startsWith(rootPath)) {
            currentFullPath = rootPath + (rootPath.endsWith('/') ? '' : '/') + path.replace(/^\//, '');
        }

        // 清理路径中的多余斜杠
        currentFullPath = currentFullPath.replace(/\/+/g, '/');

        const relativePath = currentFullPath === rootPath ? '' : currentFullPath.substring(rootPath.length);

        // 根目录链接 - 使用home图标
        const rootItem = breadcrumbEl.createEl('span', {cls: 'breadcrumb-item breadcrumb-root'});
        const rootLink = rootItem.createEl('a', {cls: 'breadcrumb-root-link'});

        setIcon(rootLink, 'home'); // 使用Lucide的home图标
        rootLink.title = this.t.view.rootDirectory;
        rootLink.onclick = async () => {
            await this.listDirectory(rootPath);
        };

        // 如果不是根目录，添加路径部分
        if (relativePath) {
            // 添加分隔符
            const separator = breadcrumbEl.createEl('span', {cls: 'breadcrumb-separator'});
            setIcon(separator, 'chevron-right'); // 使用右箭头图标

            const parts = relativePath.split('/').filter(p => p);
            let currentPath = rootPath;

            for (let i = 0; i < parts.length; i++) {
                // 分隔符（除了第一个）
                if (i > 0) {
                    const sep = breadcrumbEl.createEl('span', {cls: 'breadcrumb-separator'});
                    setIcon(sep, 'chevron-right');
                }

                const part = parts[i];
                // 正确构建路径
                currentPath = currentPath === '/' ? `/${part}` : `${currentPath}/${part}`;

                const item = breadcrumbEl.createEl('span', {cls: 'breadcrumb-item'});
                const link = item.createEl('a', {text: part});

                // 如果是最后一部分，不加链接
                if (i === parts.length - 1) {
                    link.addClass('breadcrumb-current');
                } else {
                    // 为路径部分添加点击事件
                    const targetPath = currentPath;
                    link.onclick = async () => {
                        await this.listDirectory(targetPath);
                    };
                }
            }
        }
    }

    // 列出目录内容
    async listDirectory(path: string) {
        if (!this.currentServer) return;

        // 检查客户端是否存在
        if (!this.client) {
            const success = await this.initializeClient();
            if (!success) {
                this.showError(this.t.view.connectionFailed);
                return;
            }
        }

        const rootPath = this.getRootPath();

        // 路径规范化处理（保持不变）
        let normalizedPath = path;

        // 处理根路径
        if (path === '' || path === '/' || path === rootPath) {
            normalizedPath = rootPath;
        } else {
            // 确保路径以根路径开头
            if (!path.startsWith(rootPath)) {
                normalizedPath = rootPath === '/' ? `/${path.replace(/^\//, '')}` : `${rootPath}/${path.replace(/^\//, '')}`;
            }
            // 清理路径中的多余斜杠
            normalizedPath = normalizedPath.replace(/\/+/g, '/');
        }

        // 确保路径不以斜杠结尾（除了根路径）
        if (normalizedPath !== '/' && normalizedPath.endsWith('/')) {
            normalizedPath = normalizedPath.slice(0, -1);
        }

        // 安全检查：确保不访问根路径之外的目录
        if (!normalizedPath.startsWith(rootPath)) {
            console.warn(`Attempted to access ${normalizedPath}, which is outside of root: ${rootPath}`);
            normalizedPath = rootPath;
        }

        this.rootPath = rootPath;
        this.currentPath = normalizedPath;
        const container = this.containerEl;

        // 更新面包屑导航
        this.createBreadcrumb(normalizedPath);

        // 移除旧的文件列表
        const oldList = container.querySelector('.file-list-container');
        if (oldList) oldList.remove();

        this.selectedItem = null;

        const listContainer = container.createEl('div', {cls: 'file-list-container'});
        const fileList = listContainer.createEl('div', {cls: 'file-list'});

        // 显示加载状态
        const loadingEl = fileList.createEl('div', {
            cls: 'file-item loading',
            text: '⏳ ' + this.t.view.loading
        });

        try {
            if (!this.client) {
                throw new Error('WebDAV client is not initialized');
            }
            // 获取目录内容（带超时控制）
            const files = await this.withTimeout<FileStat[]>(
                this.client.getDirectoryContents(this.currentPath),
                5000 // 5秒超时
            );

            loadingEl.remove();

            // 添加上一级目录导航 ("..")
            if (this.currentPath !== this.rootPath) {
                const upItem = fileList.createEl('div', {
                    cls: 'file-item folder',
                    text: '📁 ..'
                });
                upItem.onclick = async () => {
                    // 计算父目录路径
                    let parentPath = this.currentPath;

                    // 移除末尾的斜杠
                    if (parentPath.endsWith('/') && parentPath !== '/') {
                        parentPath = parentPath.slice(0, -1);
                    }

                    // 找到最后一个斜杠的位置
                    const lastSlashIndex = parentPath.lastIndexOf('/');
                    if (lastSlashIndex > 0) {
                        parentPath = parentPath.substring(0, lastSlashIndex);
                    } else {
                        parentPath = '/';
                    }

                    // 如果父路径为空，设为根路径
                    if (parentPath === '') {
                        parentPath = '/';
                    }

                    // 确保父路径不低于根路径
                    if (!parentPath.startsWith(this.rootPath)) {
                        parentPath = this.rootPath;
                    }

                    await this.listDirectory(parentPath);
                };
            }
            // 空目录处理 - 只有当没有文件且不是根目录时才显示空文件夹提示
            if (files.length === 0) {
                // 如果当前目录不是根目录且已经显示了".."项，则不显示空文件夹提示
                if (this.currentPath === this.rootPath) {
                    // 根目录为空时显示空文件夹提示
                    fileList.createEl('div', {
                        cls: 'file-item empty',
                        text: '📂 ' + this.t.view.emptyDir
                    });
                }
                // 非根目录且为空时，只显示".."项，不显示空文件夹提示
            } else {
                // 有文件时渲染文件列表
                this.renderFileList(fileList, files);
            }

        } catch {
            loadingEl.remove();
            this.showErrorNotice(this.t.view.listFailed);

            fileList.createEl('div', {
                cls: 'file-item error',
                text: `⛔ ${this.t.view.error}`
            });
        }
    }

    // 选中文件项
    selectItem(item: HTMLElement) {
        if (this.selectedItem) {
            this.selectedItem.removeClass('selected');
        }

        this.selectedItem = item;
        item.addClass('selected');
    }

    // 根据文件扩展名获取图标
    getFileIcon(filename: string): string {
        const ext = filename.split('.').pop()?.toLowerCase();
        const iconMap: { [key: string]: string } = {
            'md': '📝',   // Markdown
            'txt': '📄',  // 文本文件
            'pdf': '📕',  // PDF
            'doc': '📘',  // Word文档
            'docx': '📘',
            'xls': '📗',  // Excel
            'xlsx': '📗',
            'ppt': '📙',  // PowerPoint
            'pptx': '📙',
            'jpg': '🖼️',  // 图片
            'jpeg': '🖼️',
            'png': '🖼️',
            'gif': '🖼️',
            'mp4': '🎬',
            'mkv': '🎬',
            'avi': '🎬',
            'mov': '🎬',
            'mp3': '🎵',
            'wav': '🎵',
            'zip': '📦',
            'rar': '📦',
            '7z': '📦',
            'strm': '🔗'
        };

        if (!ext || !iconMap[ext]) {
            return '📄'; // 默认文件图标
        }

        return iconMap[ext];
    }

    getFileFullUrl(remotePath: string): string {
        if (!this.currentServer) return '';

        const baseUrl = this.currentServer.url.replace(/\/$/, '');
        const separator = remotePath.startsWith('/') ? '' : '/';

        // 分割路径部分进行编码（保留已存在的斜杠）
        const encodedPath = remotePath.split('/')
            .map(segment => encodeURIComponent(segment))
            .join('/');

        return `${baseUrl}${separator}${encodedPath}`;
    }

    // 使用系统应用打开文件
    openFileWithWeb(remotePath: string) {
        if (!this.currentServer) return;

        try {
            // 获取最终URL（已经编码过的）
            const finalUrl = this.getFileFullUrl(remotePath);

            // 创建带Basic认证的URL
            const {username, password} = this.currentServer;
            const authUrl = finalUrl.replace(/^https?:\/\//, `http://${username}:${password}@`);
            // 在新标签页中打开
            window.open(authUrl, '_blank');

            this.showErrorNotice(this.t.view.opening, false);

        } catch {
            this.showErrorNotice(this.t.view.openFailed);
        }
    }

    // 视图卸载清理
    onunload() {
        this.client = null;
        this.selectedItem = null;
        this.currentServer = null;

        if (this.containerEl) {
            this.containerEl.empty();
        }
    }


    refresh(): void {
        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
        }

        this.refreshDebounceTimer = window.setTimeout(() => {
            void this.executeRefresh();
        }, 300);
    }

    private async executeRefresh(): Promise<void> {
        try {
            if (!this.currentServer) {
                this.showNoServerConfigured();
                return;
            }
            const success = await this.initializeClient();
            if (!success) {
                throw new Error('Failed to initialize WebDAV client');
            }

            if (this.containerEl.querySelector('.webdav-connection-failed')) {
                this.buildNormalView();
            }

            await this.listDirectory(this.currentPath);
            this.showErrorNotice(this.t.view.refreshSuccess, false);
        } catch {
            this.showErrorNotice(this.t.view.connectionFailed);
            this.showConnectionFailed();
        }
    }

    // 构建正常视图（头部和文件列表区域）
    private buildNormalView() {
        this.containerEl.empty();
        this.containerEl.addClass('webdav-explorer-view');

        // 创建头部区域和标题行 - 所有按钮都靠左
        const headerEl = this.containerEl.createEl('div', {cls: 'webdav-header'});
        const titleRow = headerEl.createEl('div', {cls: 'webdav-title-row'});

        // 刷新按钮和排序按钮组合容器
        const actionsContainer = titleRow.createEl('div', {cls: 'webdav-actions-container'});

        // 服务器选择器
        this.serverSelector = actionsContainer.createEl('div', {cls: 'webdav-button'});
        const serverContent = this.serverSelector.createEl('div', {cls: 'webdav-button-content'});
        this.serverIconEl = serverContent.createSpan({cls: 'webdav-server-icon'});

        // 更新服务器图标
        this.updateServerIcon();

        // 服务器选择器点击事件
        this.serverSelector.onclick = (evt) => {
            this.showServerMenu(evt);
        };
        //设置服务器选择器的悬停提示
        this.serverSelector.setAttribute('aria-label', this.t.view.selectServer);
        // 刷新按钮
        const refreshButton = actionsContainer.createEl('div', {cls: 'webdav-button'});
        const refreshContent = refreshButton.createEl('div', {cls: 'webdav-button-content'});
        const refreshIcon = refreshContent.createSpan({cls: 'webdav-refresh-icon'});
        setIcon(refreshIcon, 'refresh-cw');

        refreshButton.setAttribute('aria-label', this.t.view.refresh);
        refreshButton.onclick = () => {
            this.refresh();
        };

        // 排序按钮
        this.sortButton = actionsContainer.createEl('div', {cls: 'webdav-button'});
        const sortContent = this.sortButton.createEl('div', {cls: 'webdav-button-content'});
        this.sortIconEl = sortContent.createSpan({cls: 'webdav-sort-icon'});

        this.updateSortIcon();
        this.sortButton.setAttribute('aria-label', this.t.view.sort);

        this.sortButton.onclick = (evt) => {
            this.showSortMenu(evt);
        };

        // 面包屑导航容器
        headerEl.createEl('div', {cls: 'webdav-breadcrumb-container'});

        // 文件列表容器
        const listContainer = this.containerEl.createEl('div', {cls: 'file-list-container'});
        listContainer.createEl('div', {cls: 'file-list'});
    }


    // 显示连接失败提示 - 修复版本
    private showConnectionFailed() {
        // 确保头部区域存在，如果不存在就重建
        if (!this.containerEl.querySelector('.webdav-header')) {
            this.buildNormalView();
        }

        // 只清空文件列表区域和旧的错误提示
        const oldList = this.containerEl.querySelector('.file-list-container');
        const oldError = this.containerEl.querySelector('.webdav-connection-failed');

        if (oldList) oldList.remove();
        if (oldError) oldError.remove();

        // 创建连接失败消息容器
        const messageEl = this.containerEl.createEl('div', {cls: 'webdav-connection-failed'});

        // 添加错误图标和消息
        const errorIcon = messageEl.createEl('div');
        setIcon(errorIcon, 'cloud-off');

        messageEl.createEl('p', {text: this.t.view.connectionFailed,});
        // 确保面包屑导航显示当前路径
        if (this.currentPath) {
            this.createBreadcrumb(this.currentPath);
        }
    }


    private showErrorNotice(message: string, isError: boolean = true) {
        const prefix = isError ? '❌' : '✅';
        new Notice(`${prefix} ${message}`, 1000);
    }

    // 显示排序菜单
    private showSortMenu(evt: MouseEvent) {
        const menu = new Menu();
        const space = '\u2009\u2009\u2009\u2009\u2009\u2009';

        // 定义类型别名
        type SortField = 'name' | 'type' | 'size' | 'date';
        type SortOrder = 'asc' | 'desc';

        interface SortOption {
            field: SortField;
            order: SortOrder;
            title: string;
        }

        const sortOptions: SortOption[] = [
            {field: 'name', order: 'asc', title: this.t.view.sortByNameAsc},
            {field: 'name', order: 'desc', title: this.t.view.sortByNameDesc},
            {field: 'type', order: 'asc', title: this.t.view.sortByTypeAsc},
            {field: 'type', order: 'desc', title: this.t.view.sortByTypeDesc},
            {field: 'size', order: 'asc', title: this.t.view.sortBySizeAsc},
            {field: 'size', order: 'desc', title: this.t.view.sortBySizeDesc},
            {field: 'date', order: 'asc', title: this.t.view.sortByDateAsc},
            {field: 'date', order: 'desc', title: this.t.view.sortByDateDesc}
        ];

        sortOptions.forEach(({field, order, title}) => {
            menu.addItem(item => {
                const isSelected = this.sortField === field && this.sortOrder === order;
                const displayTitle = isSelected ? title : `${space}${title}`;

                item
                    .setTitle(displayTitle)
                    .setIcon(isSelected ? 'check' : '')
                    .onClick(() => {
                        this.sortField = field;
                        this.sortOrder = order;
                        this.updateSortIcon();
                        this.refreshFileList();
                    });
            });
        });

        menu.showAtMouseEvent(evt);
    }

    // 更新排序图标
    private updateSortIcon() {
        if (!this.sortIconEl) return;
        this.sortIconEl.empty();

        let tooltip = `${this.t.view.sort}: ${this.sortField}, ${this.sortOrder}`;
        let iconName = this.sortOrder === 'asc' ? 'arrow-up-narrow-wide' : 'arrow-down-wide-narrow';

        setIcon(this.sortIconEl, iconName);
        if (this.sortButton) {
            this.sortButton.setAttribute('aria-label', tooltip);
        }
    }

    // 刷新文件列表
    private refreshFileList(): void {
        if (this.currentPath) {
            this.listDirectory(this.currentPath).catch(() => {
                this.showErrorNotice(this.t.view.refreshFailed, false);
            });
        }
    }

    // 更新服务器图标显示
    private updateServerIcon() {
        if (!this.serverIconEl || !this.currentServer) return;

        this.serverIconEl.empty();
        setIcon(this.serverIconEl, 'server');

        // 更新服务器名称显示
        if (this.serverNameEl) {
            this.serverNameEl.textContent = this.currentServer.name;
        }
    }

    // 显示服务器选择菜单
    private showServerMenu(evt: MouseEvent) {
        const servers = this.plugin.getServers();
        if (servers.length === 0) {
            new Notice(this.t.settings.serverListEmpty);
            return;
        }

        const menu = new Menu();

        // 添加服务器选项
        servers.forEach(server => {
            menu.addItem(item => {
                // 只对当前选中的服务器显示勾选图标，其他服务器不显示图标
                const icon = server.id === this.currentServer?.id ? 'check' : '';
                const space = '\u2009\u2009\u2009\u2009\u2009\u2009';
                const title = server.id === this.currentServer?.id ? server.name : `${space}${server.name}`;
                item
                    .setTitle(title)
                    .setIcon(icon)
                    .onClick(async () => {
                        await this.switchServer(server.id);
                    });
            });
        });

        menu.showAtMouseEvent(evt);
    }

    // 切换服务器
    private async switchServer(serverId: string) {
        this.currentServer = this.plugin.getServerById(serverId);
        if (this.currentServer) {
            this.plugin.settings.currentServerId = serverId;
            await this.plugin.saveSettings();

            // 重置状态
            this.client = null;
            this.currentPath = '/';
            this.rootPath = '/';
            this.selectedItem = null;

            // 重建正常视图结构，确保DOM正确重置
            this.buildNormalView();

            const success = await this.connectAndList();

            // 只有在成功连接时才显示通知
            if (success) {
                new Notice(`✅ ${this.t.view.switchSuccess || '切换服务器成功'}`);
            }
        }
    }


    // 显示无服务器配置的提示
    private showNoServerConfigured() {
        this.containerEl.empty();
        const messageEl = this.containerEl.createEl('div', {cls: 'webdav-no-server'});
        messageEl.createEl('p', {text: this.t.view.pleaseConfigure});

        // 配置服务器按钮
        const configureButton = messageEl.createEl('button', {
            text: this.t.settings.title,
            cls: 'mod-cta'
        });

        configureButton.onclick = () => {
            (this.app as AppWithSettings).setting.open();
            (this.app as AppWithSettings).setting.openTabById('webdav-explorer');
        };
    }

    // 初始化WebDAV客户端
    private async initializeClient(): Promise<boolean> {
        if (!this.currentServer) return false;

        const {url, username, password} = this.currentServer;

        if (!url || !username || !password) {
            return false;
        }

        try {
            // 创建WebDAV客户端
            this.client = new WebDAVClient(this.currentServer);
            const success = await this.client.initialize();

            if (success) {
                // 测试连接
                const testPath = this.getRootPath();
                await this.client.getDirectoryContents(testPath);
                return true;
            }
            return false;
        } catch {
            this.client = null;
            return false;
        }
    }

    // 超时控制包装器
    private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(this.t.view.connectionFailed));
            }, timeoutMs);

            promise.then(
                (result) => {
                    clearTimeout(timeoutId);
                    resolve(result);
                },
                (err) => {
                    clearTimeout(timeoutId);
                    if (err instanceof Error) {
                        reject(err);
                    } else {
                        reject(new Error(String(err)));
                    }
                }
            );
        });
    }

    // 渲染文件列表 - 使用排序后的文件
    private renderFileList(fileList: HTMLElement, files: FileStat[]) {
        // 排序文件列表
        const sortedFiles = this.sortFiles(files);

        for (const file of sortedFiles) {
            const item = fileList.createEl('div', {
                cls: 'file-item'
            });

            // 创建图标和名称的容器
            const iconSpan = item.createSpan({cls: 'file-icon'});
            item.createSpan({cls: 'file-name', text: file.basename});

            // 设置图标
            if (file.type === 'directory') {
                iconSpan.textContent = '📁';
                item.addClass('folder');
            } else {
                iconSpan.textContent = this.getFileIcon(file.basename);
                item.addClass('file');
                item.addClass('folder');
            }

            item.addClass('is-clickable');
            item.setAttr('draggable', 'true');

            // 文件夹点击事件
            if (file.type === 'directory') {
                item.onclick = async () => {
                    this.selectItem(item);
                    await this.listDirectory(file.filename);
                };
            } else {
                // 文件点击事件
                item.onclick = () => {
                    this.selectItem(item);
                };

                // 文件双击事件 - 打开文件
                item.ondblclick = () => {
                    this.selectItem(item);
                    this.openFileWithWeb(file.filename);
                };

                // 文件拖拽事件
                item.ondragstart = (event) => {
                    this.selectItem(item);
                    const finalUrl = this.getFileFullUrl(file.filename);

                    event.dataTransfer?.setData('text/plain', file.filename);
                    event.dataTransfer?.setData('text/uri-list', finalUrl);

                    document.addEventListener('dragend', () => {
                        setTimeout(() => {
                            const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
                            if (markdownView?.editor) {
                                const editor = markdownView.editor;
                                const cursor = editor.getCursor();
                                editor.replaceRange('\n', cursor);
                                editor.setCursor({line: cursor.line + 1, ch: 0});
                            }
                        }, 10);
                    }, {once: true});
                };
            }
        }
    }

    // 文件排序方法
    private sortFiles(files: FileStat[]): FileStat[] {
        return files.sort((a, b) => {
            // 首先按类型排序：文件夹在前，文件在后
            if (a.type === 'directory' && b.type !== 'directory') {
                return this.sortOrder === 'asc' ? -1 : 1;
            } else if (a.type !== 'directory' && b.type === 'directory') {
                return this.sortOrder === 'asc' ? 1 : -1;
            }

            // 同类型时按选择的字段排序
            let compareResult = 0;

            if (this.sortField === 'name') {
                // 按名称排序
                const nameA = a.basename.toLowerCase();
                const nameB = b.basename.toLowerCase();
                compareResult = nameA.localeCompare(nameB);
            } else if (this.sortField === 'type') {
                // 按文件扩展名排序
                const extA = this.getFileExtension(a.basename).toLowerCase();
                const extB = this.getFileExtension(b.basename).toLowerCase();
                compareResult = extA.localeCompare(extB);

                // 如果扩展名相同，按名称排序
                if (compareResult === 0) {
                    const nameA = a.basename.toLowerCase();
                    const nameB = b.basename.toLowerCase();
                    compareResult = nameA.localeCompare(nameB);
                }
            } else if (this.sortField === 'size') {
                // 按大小排序
                const sizeA = Number(a.size) || 0;
                const sizeB = Number(b.size) || 0;
                compareResult = sizeA - sizeB;
            } else if (this.sortField === 'date') {
                // 按日期排序 - 修正日期解析
                const dateA = this.parseLastModDate(a.lastmod);
                const dateB = this.parseLastModDate(b.lastmod);

                compareResult = dateB - dateA; // 新的在前
            }

            // 应用排序顺序
            return this.sortOrder === 'desc' ? -compareResult : compareResult;
        });
    }

    private parseLastModDate(lastmod: string): number {
        if (!lastmod) return 0;

        try {
            // 直接使用 Date 解析 RFC 2822 / GMT 格式的日期字符串
            const date = new Date(lastmod);
            const timestamp = date.getTime();

            // 检查解析是否成功
            if (isNaN(timestamp)) {
                return 0;
            }

            return timestamp;
        } catch {
            return 0;
        }
    }

    // 获取文件扩展名
    private getFileExtension(filename: string): string {
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop() || '' : '';
    }

    // 显示错误信息
    private showError(message: string) {
        const container = this.containerEl;
        const listContainer = container.createEl('div', {cls: 'file-list-container'});
        const fileList = listContainer.createEl('div', {cls: 'file-list'});

        fileList.createEl('div', {text: `⛔ ${message}`});
    }
}