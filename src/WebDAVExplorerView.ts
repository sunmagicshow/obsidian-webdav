import {WorkspaceLeaf, View, Notice, Menu, MarkdownView, setIcon, App, PluginSettingTab} from 'obsidian';
import WebDAVPlugin from './main';
import {WebDAVServer, VIEW_TYPE_WEBDAV_EXPLORER} from './types';
import {createClient, FileStat} from "webdav";

interface AppWithSettings extends App {
    setting: {
        open: () => void;
        openTabById: (id: string) => void;
        activeTab: PluginSettingTab | null;
    };
}

export class WebDAVExplorerView extends View {
    plugin: WebDAVPlugin;
    client: any = null;
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
    private isConnectionFailed: boolean = false;
    private refreshDebounceTimer: number | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: WebDAVPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.currentServer = plugin.getCurrentServer();
    }

    getViewType(): string {
        return VIEW_TYPE_WEBDAV_EXPLORER;
    }

    getDisplayText(): string {
        return this.plugin.i18n().displayName;
    }

    getIcon(): string {
        return 'cloud'; // 使用云图标
    }

    async onOpen() {
        this.containerEl.empty();
        this.containerEl.addClass('webdav-explorer-view');

        // 重置连接状态
        this.isConnectionFailed = false;

        // 更新当前服务器
        this.currentServer = this.plugin.getCurrentServer();

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
        const t = this.plugin.i18n();

        // 检查必要配置
        if (!url || !username || !password) {
            this.showNoServerConfigured();
            return;
        }

        try {
            // 重置连接状态
            this.isConnectionFailed = false;

            const success = await this.initializeClient();
            if (success) {
                // 连接成功，构建正常视图
                this.buildNormalView();
                await this.listDirectory(this.currentPath);
            } else {
                throw new Error('Failed to initialize WebDAV client');
            }
        } catch {

            new Notice(`❌ ${t.view.connectionFailed}`);
            // 设置连接失败状态
            this.isConnectionFailed = true;
            // 显示连接失败界面，但保留视图结构
            this.showConnectionFailed(t.view.connectionFailed);
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
        rootLink.title = this.plugin.i18n().view.rootDirectory;
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

// 列出目录内容（简化版本，删除重试机制）
    async listDirectory(path: string) {
        if (!this.currentServer) return;

        const t = this.plugin.i18n();

        // 检查客户端是否存在
        if (!this.client) {
            const success = await this.initializeClient();
            if (!success) {
                this.showError(t.view.connectionFailed);
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
            text: '⏳ ' + t.view.loading
        });

        try {
            // 获取目录内容（带超时控制）
            const files = await this.withTimeout<FileStat[]>(
                this.client.getDirectoryContents(this.currentPath),
                15000 // 15秒超时
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
                        text: '📂 ' + t.view.emptyDir
                    });
                }
                // 非根目录且为空时，只显示".."项，不显示空文件夹提示
            } else {
                // 有文件时渲染文件列表
                this.renderFileList(fileList, files);
            }

        } catch (err: any) {
            loadingEl.remove();

            // 简化错误处理：只显示错误信息，不进行重试
            const msg = err.message || String(err);
            console.error('WebDAV list directory error:', err);
            new Notice(`${t.view.listFailed}: ${msg.substring(0, 100)}...`);

            fileList.createEl('div', {
                cls: 'file-item error',
                text: `⛔ ${t.view.error}: ${msg}`
            });
        }
    }

    // 列出目录内容（带重试机制）

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
            'mp4': '🎬',  // 视频
            'mkv': '🎬',
            'avi': '🎬',
            'mov': '🎬',
            'mp3': '🎵',  // 音频
            'wav': '🎵',
            'zip': '📦',  // 压缩文件
            'rar': '📦',
            '7z': '📦',
            'strm': '🔗'  // strm文件
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

        const t = this.plugin.i18n();
        try {
            // 获取最终URL（已经编码过的）
            const finalUrl = this.getFileFullUrl(remotePath);

            // 创建带Basic认证的URL
            const {username, password} = this.currentServer;

            const authUrl = finalUrl.replace(/^https?:\/\//, `http://${username}:${password}@`);

            // 在新标签页中打开
            window.open(authUrl, '_blank');

            new Notice(`✅ ${t.view.opening}`, 1000);

        } catch (err: any) {
            console.error('File open error:', err);
            const errorMsg = err.message || String(err);
            new Notice(`❌ ${t.view.openFailed}: ${errorMsg}`);
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

    refresh() {
// 防抖处理，避免频繁刷新
        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
        }

        this.refreshDebounceTimer = window.setTimeout(async () => {
            if (!this.currentServer) {
                this.showNoServerConfigured();
                return;
            }

            const t = this.plugin.i18n();
            new Notice(t.view.refreshing, 1000);

            try {
                // 重置连接状态
                this.isConnectionFailed = false;

                // 重新初始化客户端
                const success = await this.initializeClient();
                if (!success) {
                    throw new Error('Failed to initialize WebDAV client');
                }

                // 如果当前显示的是连接失败界面，重建正常视图
                if (this.containerEl.querySelector('.webdav-connection-failed')) {
                    this.buildNormalView();
                }

                await this.listDirectory(this.currentPath);
            } catch (err: any) {
                const msg = err.message || String(err);
                new Notice(`❌ ${t.view.connectionFailed}: ${msg.substring(0, 100)}...`);

                this.isConnectionFailed = true;
                this.showConnectionFailed(msg);
            }
        }, 300);
    }

// 构建正常视图（头部和文件列表区域）
    private buildNormalView() {
        this.containerEl.empty();
        this.containerEl.addClass('webdav-explorer-view');
        this.isConnectionFailed = false;
        //获取i18n实例
        const t = this.plugin.i18n();

        // 创建头部区域
        const headerEl = this.containerEl.createEl('div', {cls: 'webdav-header'});

        // 标题行 - 所有按钮都靠左
        const titleRow = headerEl.createEl('div', {cls: 'webdav-title-row'});

        // 服务器选择器
        this.serverSelector = titleRow.createEl('div', {cls: 'webdav-button'});
        const serverContent = this.serverSelector.createEl('div', {cls: 'webdav-button-content'});
        this.serverIconEl = serverContent.createSpan({cls: 'webdav-server-icon'});
        serverContent.createSpan({
            cls: 'webdav-button-text',
            text: this.currentServer?.name || ''
        });

        // 更新服务器图标
        this.updateServerIcon();

        // 服务器选择器点击事件
        this.serverSelector.onclick = (evt) => {
            this.showServerMenu(evt);
        };

        // 刷新按钮和排序按钮组合容器
        const actionsContainer = titleRow.createEl('div', {cls: 'webdav-actions-container'});

        // 刷新按钮 - 带文字
        const refreshButton = actionsContainer.createEl('div', {cls: 'webdav-button'});
        const refreshContent = refreshButton.createEl('div', {cls: 'webdav-button-content'});
        const refreshIcon = refreshContent.createSpan({cls: 'webdav-refresh-icon'});
        setIcon(refreshIcon, 'refresh-cw');
        refreshButton.setAttribute('aria-label', t.view.refresh);
        refreshButton.onclick = async () => {
            await this.refresh();
        };

        // 排序按钮 - 带文字
        this.sortButton = actionsContainer.createEl('div', {cls: 'webdav-button'});
        const sortContent = this.sortButton.createEl('div', {cls: 'webdav-button-content'});
        this.sortIconEl = sortContent.createSpan({cls: 'webdav-sort-icon'});

        this.updateSortIcon();
        this.sortButton.setAttribute('aria-label', 'Sort files');
        this.sortButton.onclick = (evt) => {
            this.showSortMenu(evt);
        };

        // 面包屑导航容器
        headerEl.createEl('div', {cls: 'webdav-breadcrumb-container'});

        // 文件列表容器
        const listContainer = this.containerEl.createEl('div', {cls: 'file-list-container'});
        listContainer.createEl('div', {cls: 'file-list'});
    }

// 显示连接失败提示
    private showConnectionFailed(errorMessage: string) {
        // 清空容器但保留基本结构
        const contentEl = this.containerEl.querySelector('.file-list-container') ||
            this.containerEl.querySelector('.webdav-connection-failed');

        if (contentEl) {
            contentEl.remove();
        }

        const messageEl = this.containerEl.createEl('div', {cls: 'webdav-connection-failed'});
        const t = this.plugin.i18n();

        // 错误图标和标题
        // const errorTitle = messageEl.createEl('p', {
        //     text: `❌ ${t.view.connectionFailed}`,
        //     cls: 'webdav-error-title'
        // });
        //
        // // 错误详情
        // const errorDetails = messageEl.createEl('p', {
        //     text: errorMessage,
        //     cls: 'webdav-error-details'
        // });

        // 刷新按钮
        const refreshButton = messageEl.createEl('button', {
            text: t.view.refresh || 'Refresh',
            cls: 'mod-cta'
        });

        refreshButton.onclick = async () => {
            await this.connectAndList();
        };
    }

// 显示排序菜单
    private showSortMenu(evt: MouseEvent) {
        const menu = new Menu();
        const t = this.plugin.i18n();
        // 名称升序
        menu.addItem(item => {
            item
                .setTitle(t.view.sortByNameAsc)
                .setIcon(this.sortField === 'name' && this.sortOrder === 'asc' ? 'check' : '')
                .onClick(() => {
                    this.sortField = 'name';
                    this.sortOrder = 'asc';
                    this.updateSortIcon();
                    this.refreshFileList();
                });
        });

        // 名称降序
        menu.addItem(item => {
            item
                .setTitle(t.view.sortByNameDesc)
                .setIcon(this.sortField === 'name' && this.sortOrder === 'desc' ? 'check' : '')
                .onClick(() => {
                    this.sortField = 'name';
                    this.sortOrder = 'desc';
                    this.updateSortIcon();
                    this.refreshFileList();
                });
        });

        // 类型升序
        menu.addItem(item => {
            item
                .setTitle(t.view.sortByTypeAsc)
                .setIcon(this.sortField === 'type' && this.sortOrder === 'asc' ? 'check' : '')
                .onClick(() => {
                    this.sortField = 'type';
                    this.sortOrder = 'asc';
                    this.updateSortIcon();
                    this.refreshFileList();
                });
        });

        // 类型降序
        menu.addItem(item => {
            item
                .setTitle(t.view.sortByTypeDesc)
                .setIcon(this.sortField === 'type' && this.sortOrder === 'desc' ? 'check' : '')
                .onClick(() => {
                    this.sortField = 'type';
                    this.sortOrder = 'desc';
                    this.updateSortIcon();
                    this.refreshFileList();
                });
        });


        // 文件大小升序
        menu.addItem(item => {
            item
                .setTitle(t.view.sortBySizeAsc)
                .setIcon(this.sortField === 'size' && this.sortOrder === 'asc' ? 'check' : '')
                .onClick(() => {
                    this.sortField = 'size';
                    this.sortOrder = 'asc';
                    this.updateSortIcon();
                    this.refreshFileList();
                });
        });


        // 大小降序
        menu.addItem(item => {
            item
                .setTitle(t.view.sortBySizeDesc)
                .setIcon(this.sortField === 'size' && this.sortOrder === 'desc' ? 'check' : '')
                .onClick(() => {
                    this.sortField = 'size';
                    this.sortOrder = 'desc';
                    this.updateSortIcon();
                    this.refreshFileList();
                });
        });


        // 日期升序
        menu.addItem(item => {
            item
                .setTitle(t.view.sortByDateAsc)
                .setIcon(this.sortField === 'date' && this.sortOrder === 'asc' ? 'check' : '')
                .onClick(() => {
                    this.sortField = 'date';
                    this.sortOrder = 'asc';
                    this.updateSortIcon();
                    this.refreshFileList();
                });
        });


        // 日期降序
        menu.addItem(item => {
            item
                .setTitle(t.view.sortByDateDesc)
                .setIcon(this.sortField === 'date' && this.sortOrder === 'desc' ? 'check' : '')
                .onClick(() => {
                    this.sortField = 'date';
                    this.sortOrder = 'desc';
                    this.updateSortIcon();
                    this.refreshFileList();
                });
        });


        menu.showAtMouseEvent(evt);
    }

// 更新排序图标
    private updateSortIcon() {
        if (!this.sortIconEl) return;
        //获取i18n实例
        const t = this.plugin.i18n();
        this.sortIconEl.empty();

        let iconName = 'arrow-up-down';
        let tooltip = `${t.view.sort}: ${this.sortField}, ${this.sortOrder}`;

        iconName = this.sortOrder === 'asc' ? 'arrow-up-narrow-wide' : 'arrow-down-wide-narrow';


        setIcon(this.sortIconEl, iconName);
        if (this.sortButton) {
            this.sortButton.setAttribute('aria-label', tooltip);
        }
    }

    // 刷新文件列表（保持当前路径）
    private async refreshFileList() {
        if (this.currentPath) {
            await this.listDirectory(this.currentPath);
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
        const t = this.plugin.i18n();
        if (servers.length === 0) {
            new Notice(t.settings.serverListEmpty);
            return;
        }

        const menu = new Menu();

        // 添加服务器选项
        servers.forEach(server => {
            menu.addItem(item => {
                item
                    .setTitle(server.name)
                    .setIcon(server.id === this.currentServer?.id ? 'check' : 'server') // 当前服务器显示勾选
                    .onClick(async () => {
                        await this.switchServer(server.id);
                    });
            });
        });

        menu.showAtMouseEvent(evt);
    }

    // 切换服务器
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
            this.isConnectionFailed = false;

            // 重新连接 - 这会重建视图
            await this.connectAndList();
        }
    }

    // 更新服务器按钮文本
    private updateServerButtonText() {
        if (!this.serverSelector || !this.currentServer) return;

        // 查找按钮中的文本元素
        const buttonTextEl = this.serverSelector.querySelector('.webdav-button-text');
        if (buttonTextEl) {
            buttonTextEl.textContent = this.currentServer.name;
        }

        // 同时更新工具提示
        this.serverSelector.setAttribute('aria-label', `Current server: ${this.currentServer.name}`);
    }

    // 显示无服务器配置的提示
    private showNoServerConfigured() {
        this.containerEl.empty();
        const messageEl = this.containerEl.createEl('div', {cls: 'webdav-no-server'});
        const t = this.plugin.i18n();
        messageEl.createEl('p', {text: t.view.pleaseConfigure});

        // 配置服务器按钮
        const configureButton = messageEl.createEl('button', {
            text: t.settings.title,
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
            const authHeader = 'Basic ' + btoa(`${username}:${password}`);

            // 创建WebDAV客户端
            this.client = createClient(url, {
                username,
                password,
                headers: {
                    'Authorization': authHeader
                }
            });

            // 测试连接
            const testPath = this.getRootPath();
            await this.client.getDirectoryContents(testPath);
            return true;
        } catch (err) {
            console.error('Failed to initialize WebDAV client:', err);
            this.client = null;
            return false;
        }
    }

    // 超时控制包装器
// 超时控制包装器
    private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
        //获取i18n实例
        const t = this.plugin.i18n();
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(t.view.connectionFailed));
            }, timeoutMs);

            promise.then(
                (result) => {
                    clearTimeout(timeoutId);
                    resolve(result);
                },
                (error) => {
                    clearTimeout(timeoutId);
                    // 确保错误是 Error 对象，如果不是则包装
                    if (error instanceof Error) {
                        reject(error);
                    } else {
                        reject(new Error(String(error)));
                    }
                }
            );
        });
    }

    // 渲染文件列表
// 渲染文件列表 - 使用排序后的文件
    private renderFileList(fileList: HTMLElement, files: any[]) {
        // 排序文件列表
        const sortedFiles = this.sortFiles(files);

        for (const file of sortedFiles) {
            const item = fileList.createEl('div', {
                cls: 'file-item'
            });

            // 创建图标和名称的容器
            const iconSpan = item.createSpan({cls: 'file-icon'});
            item.createSpan({cls: 'file-name', text: this.getFileName(file)});

            // 设置图标
            if (file.type === 'directory') {
                iconSpan.textContent = '📁';
                item.addClass('folder');
            } else {
                const icon = this.getFileIcon(file.basename);
                iconSpan.textContent = icon;
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
    private sortFiles(files: any[]): any[] {
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
                const nameA = this.getFileName(a).toLowerCase();
                const nameB = this.getFileName(b).toLowerCase();
                compareResult = nameA.localeCompare(nameB);
            } else if (this.sortField === 'type') {
                // 按文件扩展名排序
                const extA = this.getFileExtension(a.basename).toLowerCase();
                const extB = this.getFileExtension(b.basename).toLowerCase();
                compareResult = extA.localeCompare(extB);

                // 如果扩展名相同，按名称排序
                if (compareResult === 0) {
                    const nameA = this.getFileName(a).toLowerCase();
                    const nameB = this.getFileName(b).toLowerCase();
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

// 获取文件扩展名


    // 获取文件名（处理不同属性名）
    private getFileName(file: any): string {
        if (file.originalName) {
            return file.originalName;
        } else if (file.displayName) {
            return file.displayName;
        } else if (file.filename) {
            const parts = file.filename.split('/');
            return parts[parts.length - 1];
        }
        return file.basename;
    }

    // 显示错误信息
// 显示错误信息
    private showError(message: string) {
        const container = this.containerEl;
        const listContainer = container.createEl('div', {cls: 'file-list-container'});
        const fileList = listContainer.createEl('div', {cls: 'file-list'});

        fileList.createEl('div', {
            cls: 'file-item error',
            text: `⛔ ${message}`
        });
    }
}

