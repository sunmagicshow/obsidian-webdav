import {WorkspaceLeaf, View, Notice, Menu, MarkdownView, setIcon} from 'obsidian';
import {FileStat} from 'webdav';
import WebDAVPlugin from './main';
import {VIEW_TYPE_WEBDAV_EXPLORER} from './types';
import {WebDAVFileService} from './WebDAVFileService';
import {WebDAVExplorerService} from './WebDAVExplorerService';

/**
 * WebDAV 文件浏览器视图
 * 负责渲染 WebDAV 服务器的文件列表，处理用户交互和文件操作
 */
export class WebDAVExplorerView extends View {
    /** 插件实例引用 */
    plugin: WebDAVPlugin;

    /** 文件服务实例，处理文件下载等操作 */
    fileService: WebDAVFileService;

    /** 浏览器服务实例，处理 WebDAV 相关业务逻辑 */
    private explorerService: WebDAVExplorerService;

    // ==================== 视图状态 ====================

    /** 当前选中的文件项元素 */
    private selectedItem: HTMLElement | null = null;

    // ==================== DOM 元素引用 ====================

    /** 排序按钮元素 */
    private sortButton: HTMLElement | null = null;

    /** 排序图标元素 */
    private sortIconEl: HTMLElement | null = null;

    /** 头部容器元素 */
    private headerEl: HTMLElement | null = null;

    /** 内容区域容器元素 */
    private contentEl: HTMLElement | null = null;

    /**
     * 构造函数
     * @param leaf - 工作区叶子节点
     * @param plugin - WebDAV 插件实例
     */
    constructor(leaf: WorkspaceLeaf, plugin: WebDAVPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.fileService = new WebDAVFileService(this.app);

        // 初始化浏览器服务，注入回调函数
        this.explorerService = new WebDAVExplorerService(
            plugin,
            this.fileService,
            (files, hasParent) => this.handleFileListUpdate(files, hasParent),
            () => this.updateBreadcrumb(),
            (message, isError = true) => this.showNotice(message, isError)
        );

        // 使用防抖函数包装刷新方法，避免频繁调用
        this.refresh = this.fileService.debounce(this.executeRefresh.bind(this), 300);
    }

    /**
     * 获取国际化翻译工具
     * @returns 翻译函数
     */
    private get t() {
        return this.plugin.i18n();
    }

    // ==================== 核心生命周期方法 ====================

    /** 防抖处理的刷新方法 */
    public refresh: () => void = () => {
    };

    /**
     * 获取视图类型标识
     * @returns 视图类型字符串
     */
    getViewType(): string {
        return VIEW_TYPE_WEBDAV_EXPLORER;
    }

    /**
     * 获取视图显示文本
     * @returns 显示文本
     */
    getDisplayText(): string {
        return this.t.displayName;
    }

    /**
     * 获取视图图标
     * @returns 图标名称
     */
    getIcon(): string {
        return 'cloud';
    }

    /**
     * 视图打开时的初始化方法
     */
    async onOpen() {
        // 清空容器并添加 CSS 类
        this.containerEl.empty();
        this.containerEl.addClass('webdav-explorer-view');

        // 获取当前服务器配置并构建布局
        const currentServer = this.plugin.getCurrentServer();
        this.explorerService.setCurrentServer(currentServer);
        this.buildLayout();

        // 如果没有选择服务器，显示提示信息
        if (!currentServer) {
            this.showNotice(this.t.view.selectServer, true);
            return;
        }

        // 连接服务器并加载文件列表
        await this.connectAndList();
    }

    /**
     * 视图卸载时的清理方法
     */
    onunload() {
        this.selectedItem = null;
        this.containerEl?.empty();
    }

    /**
     * 服务器配置变更时的处理
     * 同步更新服务端配置，异步执行连接和列表刷新
     */
    public onServerChanged(): void {
        const newCurrentServer = this.plugin.getCurrentServer();
        this.explorerService.setCurrentServer(newCurrentServer);
        this.rebuildView();

        // 如果选择了新服务器，异步连接并刷新列表
        if (newCurrentServer) {
            this.connectAndList().catch(() => {
                // 错误已在 connectAndList 中处理，此处静默捕获
            });
        }
    }

    // ==================== 视图构建方法 ====================

    /**
     * 构建视图整体布局
     */
    private buildLayout(): void {
        this.headerEl = this.containerEl.createEl('div', {cls: 'webdav-header'});
        this.contentEl = this.containerEl.createEl('div', {cls: 'webdav-content'});
        this.buildHeaderContent();
    }

    /**
     * 重新构建视图（用于服务器切换等场景）
     */
    private rebuildView(): void {
        this.containerEl.empty();
        this.containerEl.addClass('webdav-explorer-view');
        this.buildLayout();
    }

    /**
     * 构建头部内容区域
     */
    private buildHeaderContent(): void {
        if (!this.headerEl) return;

        this.headerEl.empty();
        const titleRow = this.headerEl.createEl('div', {cls: 'webdav-title-row'});
        const actionsContainer = titleRow.createEl('div', {cls: 'webdav-actions-container'});

        // 构建操作按钮和面包屑导航
        this.buildActionButtons(actionsContainer);
        this.buildBreadcrumb();
    }

    /**
     * 构建操作按钮区域
     * @param container - 按钮容器元素
     */
    private buildActionButtons(container: HTMLElement): void {
        // 服务器选择按钮
        const serverButton = container.createEl('div', {cls: 'webdav-button'});
        const serverContent = serverButton.createEl('div', {cls: 'webdav-button-content'});
        const serverIconEl = serverContent.createSpan({cls: 'webdav-server-icon'});
        setIcon(serverIconEl, 'server');
        serverButton.setAttribute('aria-label', this.t.view.selectServer);
        serverButton.onclick = (evt) => this.showServerMenu(evt);

        // 刷新按钮
        const refreshButton = container.createEl('div', {cls: 'webdav-button'});
        const refreshContent = refreshButton.createEl('div', {cls: 'webdav-button-content'});
        const refreshIcon = refreshContent.createSpan({cls: 'webdav-refresh-icon'});
        setIcon(refreshIcon, 'refresh-cw');
        refreshButton.setAttribute('aria-label', this.t.view.refresh);
        refreshButton.onclick = () => this.refresh();

        // 排序按钮
        this.sortButton = container.createEl('div', {cls: 'webdav-button'});
        const sortContent = this.sortButton.createEl('div', {cls: 'webdav-button-content'});
        this.sortIconEl = sortContent.createSpan({cls: 'webdav-sort-icon'});
        this.updateSortIcon();
        this.sortButton.setAttribute('aria-label', this.t.view.sort);
        this.sortButton.onclick = (evt) => this.showSortMenu(evt);
    }

    /**
     * 构建面包屑导航
     */
    private buildBreadcrumb(): void {
        const breadcrumbContainer = this.headerEl!.createEl('div', {cls: 'webdav-breadcrumb-container'});
        breadcrumbContainer.createEl('div', {cls: 'webdav-breadcrumb'});
        this.updateBreadcrumb();
    }

    // ==================== 文件列表渲染 ====================

    /**
     * 处理文件列表更新回调
     * @param files - 文件列表数据
     * @param hasParent - 是否有上级目录
     */
    private handleFileListUpdate(files: FileStat[], hasParent: boolean): void {
        if (!this.contentEl) return;

        this.contentEl.empty();
        const listContainer = this.contentEl.createEl('div', {cls: 'file-list-container'});
        const fileList = listContainer.createEl('div', {cls: 'file-list'});

        // 添加上级目录导航项
        if (hasParent) {
            this.createUpDirectoryItem(fileList);
        }

        // 处理空目录情况
        if (files.length === 0 && !hasParent) {
            fileList.createEl('div', {
                cls: 'file-item empty',
                text: '📂 ' + this.t.view.emptyDir
            });
            return;
        }

        // 渲染排序后的文件列表
        const sortedFiles = this.explorerService.sortFiles(files);
        sortedFiles.forEach(file => this.renderFileItem(fileList, file));
    }

    /**
     * 渲染单个文件项
     * @param fileList - 文件列表容器
     * @param file - 文件信息
     */
    private renderFileItem(fileList: HTMLElement, file: FileStat): void {
        const item = fileList.createEl('div', {cls: 'file-item'});
        const iconSpan = item.createSpan({cls: 'file-icon'});
        item.createSpan({cls: 'file-name', text: file.basename});

        // 根据文件类型设置不同的交互逻辑
        if (file.type === 'directory') {
            this.setupDirectoryItem(item, iconSpan, file);
        } else {
            this.setupFileItem(item, iconSpan, file);
        }

        item.addClass('is-clickable');
    }

    /**
     * 设置目录项的交互逻辑
     * @param item - 目录项元素
     * @param iconSpan - 图标元素
     * @param file - 目录信息
     */
    private setupDirectoryItem(item: HTMLElement, iconSpan: HTMLElement, file: FileStat): void {
        iconSpan.textContent = '📁';
        item.addClass('folder');
        item.onclick = async () => {
            this.selectItem(item);
            await this.explorerService.listDirectory(file.filename);
        };
    }

    /**
     * 设置文件项的交互逻辑
     * @param item - 文件项元素
     * @param iconSpan - 图标元素
     * @param file - 文件信息
     */
    private setupFileItem(item: HTMLElement, iconSpan: HTMLElement, file: FileStat): void {
        iconSpan.textContent = this.fileService.getFileIcon(file.basename);
        item.addClass('file');

        // 设置点击、双击和右键菜单事件
        item.onclick = () => this.selectItem(item);
        item.ondblclick = () => this.explorerService.openFileWithWeb(file.filename);
        item.oncontextmenu = (evt) => this.showFileContextMenu(evt, file);

        // 设置拖拽支持
        item.setAttr('draggable', 'true');
        item.ondragstart = (event) => this.handleFileDragStart(event, file);
    }

    /**
     * 创建上级目录导航项
     * @param fileList - 文件列表容器
     */
    private createUpDirectoryItem(fileList: HTMLElement): void {
        const upItem = fileList.createEl('div', {cls: 'file-item folder', text: '📁 ..'});
        upItem.onclick = async () => {
            const parentPath = this.explorerService.getParentPath();
            await this.explorerService.listDirectory(parentPath);
        };
    }

    // ==================== 拖拽和菜单方法 ====================

    /**
     * 处理文件拖拽开始事件
     * @param event - 拖拽事件
     * @param file - 被拖拽的文件信息
     */
    private handleFileDragStart(event: DragEvent, file: FileStat): void {
        const target = event.currentTarget as HTMLElement;
        this.selectItem(target);

        // 处理文件名中的特殊字符
        const processedFilename = file.filename
            .replace(/\[/g, '【')
            .replace(/]/g, '】');

        // 获取文件完整 URL 并应用前缀
        const originalUrl = this.explorerService.getFileFullUrl(file.filename);
        const finalUrl = this.explorerService.applyUrlPrefix(originalUrl);

        // 设置拖拽数据
        event.dataTransfer?.setData('text/plain', processedFilename);
        event.dataTransfer?.setData('text/uri-list', finalUrl);

        this.setupDragEndCleanup();
    }

    /**
     * 设置拖拽结束后的清理逻辑
     */
    private setupDragEndCleanup(): void {
        document.addEventListener('dragend', () => {
            setTimeout(() => {
                // 在 Markdown 编辑器中插入换行
                const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (markdownView?.editor) {
                    const editor = markdownView.editor;
                    const cursor = editor.getCursor();
                    editor.replaceRange('\n', cursor);
                    editor.setCursor({line: cursor.line + 1, ch: 0});
                }
            }, 10);
        }, {once: true});
    }

    /**
     * 显示文件右键上下文菜单
     * @param event - 鼠标事件
     * @param file - 文件信息
     */
    private showFileContextMenu(event: MouseEvent, file: FileStat): void {
        event.preventDefault();
        const menu = new Menu();

        // 复制 URL 菜单项
        menu.addItem(item => {
            item.setTitle(this.t.contextMenu.copyUrl)
                .setIcon('link')
                .onClick(() => this.explorerService.copyFileUrl(file));
        });

        // 下载文件菜单项
        menu.addItem(item => {
            item.setTitle(this.t.contextMenu.download)
                .setIcon('download')
                .onClick(() => this.explorerService.downloadFile(file));
        });

        menu.showAtMouseEvent(event);
    }

    // ==================== 服务器和排序菜单 ====================

    /**
     * 显示服务器选择菜单
     * @param evt - 鼠标事件
     */
    private showServerMenu(evt: MouseEvent): void {
        const servers = this.plugin.getServers();
        if (servers.length === 0) {
            new Notice(this.t.settings.serverListEmpty);
            return;
        }

        const menu = new Menu();
        servers.forEach(server => {
            const isSelected = server.name === this.plugin.getCurrentServer()?.name;
            menu.addItem(item => {
                const space = '\u2009\u2009\u2009\u2009\u2009\u2009'; // 使用空格进行缩进
                const title = isSelected ? server.name : `${space}${server.name}`;

                item.setTitle(title)
                    .setIcon(isSelected ? 'check' : '')
                    .onClick(async () => await this.switchServer(server.name));
            });
        });

        menu.showAtMouseEvent(evt);
    }

    /**
     * 切换服务器
     * @param serverName - 服务器名称
     */
    private async switchServer(serverName: string): Promise<void> {
        const server = this.plugin.getServerByName(serverName);
        if (server) {
            // 更新插件设置
            this.plugin.settings.currentServerName = serverName;
            await this.plugin.saveSettings();

            // 更新服务并重新构建视图
            this.explorerService.setCurrentServer(server);
            this.rebuildView();

            // 连接新服务器并显示结果
            const success = await this.connectAndList();
            if (success) {
                this.showNotice(this.t.view.switchSuccess, false);
            }
        }
    }

    /**
     * 显示排序选项菜单
     * @param evt - 鼠标事件
     */
    private showSortMenu(evt: MouseEvent): void {
        const menu = new Menu();
        const space = '\u2009\u2009\u2009\u2009\u2009\u2009'; // 缩进空格
        const currentSort = this.explorerService.getSortState();

        // 排序选项配置
        const sortOptions: Array<{
            field: 'name' | 'type' | 'size' | 'date';
            order: 'asc' | 'desc';
            title: string;
        }> = [
            {field: 'name', order: 'asc', title: this.t.view.sortByNameAsc},
            {field: 'name', order: 'desc', title: this.t.view.sortByNameDesc},
            {field: 'type', order: 'asc', title: this.t.view.sortByTypeAsc},
            {field: 'type', order: 'desc', title: this.t.view.sortByTypeDesc},
            {field: 'size', order: 'asc', title: this.t.view.sortBySizeAsc},
            {field: 'size', order: 'desc', title: this.t.view.sortBySizeDesc},
            {field: 'date', order: 'asc', title: this.t.view.sortByDateAsc},
            {field: 'date', order: 'desc', title: this.t.view.sortByDateDesc}
        ];

        // 添加排序菜单项
        sortOptions.forEach(({field, order, title}) => {
            const isSelected = currentSort.field === field && currentSort.order === order;
            menu.addItem(item => {
                const displayTitle = isSelected ? title : `${space}${title}`;

                item.setTitle(displayTitle)
                    .setIcon(isSelected ? 'check' : '')
                    .onClick(() => {
                        this.explorerService.setSort(field, order);
                        this.updateSortIcon();
                        this.refreshFileList();
                    });
            });
        });

        menu.showAtMouseEvent(evt);
    }

    // ==================== 状态管理方法 ====================

    /**
     * 选中文件项
     * @param item - 要选中的文件项元素
     */
    private selectItem(item: HTMLElement): void {
        this.selectedItem?.removeClass('selected');
        this.selectedItem = item;
        item.addClass('selected');
    }

    /**
     * 更新排序图标显示
     */
    private updateSortIcon(): void {
        if (!this.sortIconEl) return;
        this.sortIconEl.empty();

        const currentSort = this.explorerService.getSortState();
        const iconName = currentSort.order === 'asc' ? 'arrow-up-narrow-wide' : 'arrow-down-wide-narrow';
        setIcon(this.sortIconEl, iconName);

        // 更新按钮的无障碍标签
        if (this.sortButton) {
            this.sortButton.setAttribute('aria-label',
                `${this.t.view.sort}: ${currentSort.field}, ${currentSort.order}`);
        }
    }


    /**
     * 更新面包屑导航显示
     */
    private updateBreadcrumb(): void {
        const breadcrumbContainer = this.containerEl.querySelector('.webdav-breadcrumb-container');
        if (!breadcrumbContainer) return;

        breadcrumbContainer.empty();
        const breadcrumbEl = breadcrumbContainer.createEl('div', {cls: 'webdav-breadcrumb'});

        const parts = this.explorerService.getBreadcrumbParts();

        // 渲染面包屑的每个部分
        parts.forEach((part, index) => {
            // 添加分隔符（除第一项外）
            if (index > 0) {
                const separator = breadcrumbEl.createEl('span', {cls: 'breadcrumb-separator'});
                setIcon(separator, 'chevron-right');
            }

            const item = breadcrumbEl.createEl('span', {cls: 'breadcrumb-item'});

            if (part.name === 'root') {
                // 根目录项
                item.addClass('breadcrumb-root');
                const rootLink = item.createEl('a', {cls: 'breadcrumb-root-link'});
                setIcon(rootLink, 'home');
                rootLink.title = this.t.view.rootDirectory;
                rootLink.onclick = async () => await this.explorerService.listDirectory(part.path);
            } else {
                // 普通路径项
                const link = item.createEl('a', {text: part.name});
                if (part.isCurrent) {
                    link.addClass('breadcrumb-current');
                } else {
                    link.onclick = async () => await this.explorerService.listDirectory(part.path);
                }
            }
        });
    }

    // ==================== 连接和刷新方法 ====================

    /**
     * 连接服务器并加载文件列表
     * @returns 连接是否成功
     */
    private async connectAndList(): Promise<boolean> {
        try {
            const success = await this.explorerService.initializeClient();
            if (!success) {
                this.showNotice(this.t.view.connectionFailed, true);
                return false;
            }

            await this.explorerService.listDirectory(this.explorerService.getCurrentPath());
            return true;
        } catch {
            this.showNotice(this.t.view.connectionFailed, true);
            return false;
        }
    }

    /**
     * 刷新文件列表显示
     */
    private refreshFileList(): void {
        const currentPath = this.explorerService.getCurrentPath();
        this.explorerService.listDirectory(currentPath).catch(() => {
            this.showNotice(this.t.view.refreshFailed, true);
        });
    }

    /**
     * 执行刷新操作（防抖包装的实际实现）
     */
    private async executeRefresh(): Promise<void> {
        try {
            const currentServer = this.plugin.getCurrentServer();
            // 在设置服务器之前保存当前路径
        const currentPath = this.explorerService.getCurrentPath();

        this.explorerService.setCurrentServer(currentServer);

        if (!currentServer) {
            this.showNotice(this.t.view.refreshFailed, true);
            return;
        }

        // 重新初始化客户端连接
        const success = await this.explorerService.initializeClient();
        if (!success) {
            this.showNotice(this.t.view.refreshFailed, true);
            return;
        }

        // 使用保存的路径刷新文件列表，而不是重新获取
        await this.explorerService.listDirectory(currentPath);
            this.showNotice(this.t.view.refreshSuccess, false);
        } catch {
            this.showNotice(this.t.view.refreshFailed, true);
        }
    }

    // ==================== UI 反馈方法 ====================

    /**
     * 显示通知消息
     * @param message - 消息内容
     * @param isError - 是否为错误消息
     */
    private showNotice(message: string, isError: boolean = true): void {
        const prefix = isError ? '❌' : '✅';
        new Notice(`${prefix} ${message}`, isError ? 3000 : 1000);
    }
}