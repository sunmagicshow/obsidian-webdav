import {WorkspaceLeaf, View, Notice, Menu, MarkdownView, setIcon, debounce, ButtonComponent} from 'obsidian';
import {FileStat} from 'webdav';
import WebDAVPlugin from './main';
import {VIEW_TYPE_WEBDAV_EXPLORER} from './types';
import {WebDAVFileService} from './WebDAVFileService';
import {WebDAVExplorerService} from './WebDAVExplorerService';
import {i18n} from "./i18n";

/**
 * WebDAV 文件浏览器视图
 * 负责渲染 WebDAV 服务器的文件列表，处理用户交互和文件操作
 */
export class WebDAVExplorerView extends View {
    // ==================== 依赖注入 ====================
    plugin: WebDAVPlugin;
    fileService: WebDAVFileService;
    private explorerService: WebDAVExplorerService;

    // ==================== 视图状态 ====================
    private selectedItem: HTMLElement | null = null;
    private refreshButton: HTMLElement | null = null;

    // ==================== DOM 元素引用 ====================
    private sortButton: HTMLElement | null = null;
    private sortIconEl: HTMLElement | null = null;
    private headerEl: HTMLElement | null = null;
    private contentEl: HTMLElement | null = null;
    private breadcrumbContainer: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: WebDAVPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.fileService = new WebDAVFileService(this.app);
        this.explorerService = this.createExplorerService();
        this.refresh = debounce(() => this.executeRefresh(), 300);
    }

    // ==================== 核心生命周期方法 ====================
    public refresh: () => void = () => {
    };

    getViewType(): string {
        return VIEW_TYPE_WEBDAV_EXPLORER;
    }

    getDisplayText(): string {
        return i18n.t.displayName;
    }

    getIcon(): string {
        return 'cloud';
    }

    async onOpen() {
        this.containerEl.empty()
        this.containerEl.addClass('webdav-explorer-view');

        const currentServer = this.plugin.getCurrentServer();
        this.explorerService.setCurrentServer(currentServer);
        this.buildLayout();

        if (!currentServer) {
            this.showNotice(i18n.t.view.selectServer, true);
            return;
        }

        await this.connectAndList();
    }

    onunload() {
        this.selectedItem = null;
        this.containerEl?.empty();
    }

    public onServerChanged(): void {
        const newCurrentServer = this.plugin.getCurrentServer();
        this.explorerService.setCurrentServer(newCurrentServer);
        this.rebuildView();

        if (newCurrentServer) {
            void this.connectAndList();
        }
    }

    // ==================== 连接和刷新方法 ====================
    /**
     * 连接到服务器并列出文件
     */
    private async connectAndList(): Promise<boolean> {
        try {
            const success = await this.explorerService.initializeClient();
            if (!success) {
                this.showNotice(i18n.t.view.connectionFailed, true);
                return false;
            }

            await this.explorerService.listDirectory(this.explorerService.getCurrentPath());
            return true;
        } catch {
            this.showNotice(i18n.t.view.connectionFailed, true);
            return false;
        }
    }

    /**
     * 刷新文件列表
     */
    private refreshFileList(): void {
        const currentPath = this.explorerService.getCurrentPath();
        this.explorerService.listDirectory(currentPath).catch(() => {
            this.showNotice(i18n.t.view.refreshFailed, true);
        });
    }

    /**
     * 执行刷新操作
     */
    private async executeRefresh(): Promise<void> {
        try {
            const currentServer = this.plugin.getCurrentServer();
            const currentPath = this.explorerService.getCurrentPath();

            this.explorerService.setCurrentServer(currentServer);

            if (!currentServer) {
                this.showNotice(i18n.t.view.refreshFailed, true);
                return;
            }

            const success = await this.explorerService.initializeClient();
            if (!success) {
                this.showNotice(i18n.t.view.refreshFailed, true);
                return;
            }

            await this.explorerService.listDirectory(currentPath);
            this.showNotice(i18n.t.view.refreshSuccess, false);
        } catch {
            this.showNotice(i18n.t.view.refreshFailed, true);
        }
    }

    // ==================== 服务创建 ====================
    /**
     * 创建浏览器服务实例
     */
    private createExplorerService(): WebDAVExplorerService {
        return new WebDAVExplorerService(
            this.fileService,
            (files: FileStat[], hasParent: boolean) => this.handleFileListUpdate(files, hasParent),
            () => this.updateBreadcrumb(),
            (message: string, isError: boolean = true) => this.showNotice(message, isError),
            this.app.secretStorage
        );
    }

    // ==================== 视图构建方法 ====================
    /**
     * 构建视图布局
     */
    private buildLayout(): void {
        this.headerEl = this.containerEl.createEl('div', {cls: 'webdav-header'});
        this.contentEl = this.containerEl.createEl('div', {cls: 'webdav-content'});
        this.buildHeaderContent();
    }

    /**
     * 重建视图
     */
    private rebuildView(): void {
        this.containerEl.empty();
        this.containerEl.addClass('webdav-explorer-view');
        this.buildLayout();
    }

    /**
     * 构建头部内容
     */
    private buildHeaderContent(): void {
        if (!this.headerEl) return;

        this.headerEl.empty();
        const actionsContainer = this.headerEl.createEl('div', {cls: 'webdav-actions'});

        this.buildActionButtons(actionsContainer);

        // 导航栏容器（放置home按钮和面包屑）
        this.breadcrumbContainer = this.headerEl.createEl('div', {cls: 'webdav-actions'});
        this.buildNavigationBar();
    }

    /**
     * 构建操作按钮
     */
    private buildActionButtons(container: HTMLElement): void {
        const buttons = [
            {icon: 'server', label: i18n.t.view.selectServer, onClick: (evt: MouseEvent) => this.showServerMenu(evt)},
            {icon: 'refresh-cw', label: i18n.t.view.refresh, onClick: () => this.refresh()},
            {
                icon: 'arrow-up-narrow-wide',
                label: i18n.t.view.sort,
                onClick: (evt: MouseEvent) => this.showSortMenu(evt)
            }
        ];

        buttons.forEach(({icon, label, onClick}) => {
            const button = new ButtonComponent(container)
                .setIcon(icon)
                .setTooltip(label)
                .onClick(onClick)
                .buttonEl;

            button.addClass('clickable-icon');

            // 保存刷新按钮的引用
            if (icon === 'refresh-cw') {
                this.refreshButton = button;
            }
        });

        this.sortButton = container.lastElementChild as HTMLElement;
        this.sortIconEl = this.sortButton.querySelector('.svg-icon') as HTMLElement;
        this.updateSortIcon();
    }

    /**
     * 构建导航栏（首页按钮和面包屑）
     */
    private buildNavigationBar(): void {
        if (!this.breadcrumbContainer) return;

        this.breadcrumbContainer.empty();

        // 添加home按钮
        new ButtonComponent(this.breadcrumbContainer)
            .setIcon('home')
            .setTooltip(i18n.t.view.rootDirectory)
            .onClick(async () => await this.explorerService.listDirectory('/'))
            .buttonEl.addClass('clickable-icon');

        // 创建面包屑
        this.breadcrumbContainer.createEl('div', {cls: 'webdav-breadcrumb'});
        this.updateBreadcrumb();
    }

    /**
     * 更新面包屑导航
     */
    private updateBreadcrumb(): void {
        if (!this.breadcrumbContainer) return;

        const breadcrumbContainer = this.breadcrumbContainer;
        let breadcrumbEl = breadcrumbContainer.querySelector('.webdav-breadcrumb');

        if (!breadcrumbEl) {
            breadcrumbEl = breadcrumbContainer.createEl('div', {cls: 'webdav-breadcrumb'});
        } else {
            breadcrumbEl.empty();
        }

        // 获取面包屑部分，并过滤掉 root
        const parts = this.explorerService.getBreadcrumbParts()
            .filter(part => part.name !== 'root');

        // 每个目录前都添加分隔符（包括第一个）
        parts.forEach((part) => {
            // 先添加分隔符
            const iconEl = breadcrumbEl.createSpan({cls: 'webdav-breadcrumb-separator'});
            setIcon(iconEl, 'chevron-right');

            // 再添加目录项
            const item = breadcrumbEl.createEl('span', {cls: 'webdav-breadcrumb-item'});
            const link = item.createEl('a', {text: part.name});

            if (part.isCurrent) {
                link.addClass('webdav-breadcrumb-current');
            } else {
                link.onclick = async () => await this.explorerService.listDirectory(part.path);
            }
        });
    }

    // ==================== 文件列表渲染 ====================
    /**
     * 获取文件列表容器
     */
    private getFileListContainer(): HTMLElement {
        this.contentEl?.empty();
        return this.contentEl!.createEl('div', {cls: 'webdav-file-list'});
    }

    /**
     * 处理文件列表更新
     */
    private handleFileListUpdate(files: FileStat[], hasParent: boolean): void {
        const fileList = this.getFileListContainer();

        if (hasParent) this.createUpDirectoryItem(fileList);
        if (files.length === 0 && !hasParent) {
            this.renderEmptyDirectory(fileList);
            return;
        }
        this.renderFileItems(fileList, files);
        this.setLoadingState(false);
    }

    /**
     * 渲染加载状态
     */
    private renderLoadingState(fileList: HTMLElement): void {
        const loadingItem = fileList.createEl('div', {cls: 'webdav-loading-item'});
        const iconSpan = loadingItem.createSpan({cls: 'webdav-icon webdav-spin'});
        setIcon(iconSpan, 'loader');
        loadingItem.createSpan({cls: 'webdav-file-name', text: i18n.t.view.loading});
    }

    /**
     * 渲染空目录状态
     */
    private renderEmptyDirectory(fileList: HTMLElement): void {
        const emptyItem = fileList.createEl('div', {cls: 'webdav-file-item-empty'});
        const iconSpan = emptyItem.createSpan({cls: 'webdav-icon'});
        setIcon(iconSpan, 'folder');
        emptyItem.createSpan({cls: 'webdav-file-name', text: i18n.t.view.emptyDir});
    }

    /**
     * 渲染文件列表
     */
    private renderFileItems(fileList: HTMLElement, files: FileStat[]): void {
        const sortedFiles = this.explorerService.sortFiles(files);
        sortedFiles.forEach(file => this.renderFileItem(fileList, file));
    }

    /**
     * 渲染单个文件项
     */
    private renderFileItem(fileList: HTMLElement, file: FileStat): void {
        const item = fileList.createEl('div', {cls: 'webdav-file-item'});
        const iconSpan = item.createSpan({cls: 'webdav-icon'});
        item.createSpan({cls: 'webdav-file-name', text: file.basename});

        if (file.type === 'directory') {
            setIcon(iconSpan, 'folder');
            item.addClass('webdav-file-item-folder');
            item.onclick = async () => {
                this.selectItem(item);
                await this.navigateToDirectory(file.filename);
            };
        } else {
            const fileIcon = this.fileService.getFileIcon(file.basename);
            setIcon(iconSpan, fileIcon);
            item.onclick = () => this.selectItem(item);
            item.ondblclick = () => this.explorerService.openFileWithWeb(file.filename);
            item.oncontextmenu = (evt) => this.showFileContextMenu(evt, file);
            item.setAttr('draggable', 'true');
            item.ondragstart = (event) => this.handleFileDragStart(event, file);
        }
    }

    /**
     * 创建返回上级目录项
     */
    private createUpDirectoryItem(fileList: HTMLElement): void {
        const upItem = fileList.createEl('div', {cls: 'webdav-file-item webdav-file-item-folder'});
        const iconSpan = upItem.createSpan({cls: 'webdav-icon'});
        setIcon(iconSpan, 'folder-up');

        // 文件名容器，与文件夹样式一致
        const nameSpan = upItem.createSpan({cls: 'webdav-file-name'});
        nameSpan.setText('..');

        // 添加悬停效果和点击事件
        upItem.onclick = async () => {
            this.selectItem(upItem);
            const parentPath = this.explorerService.getParentPath();
            await this.navigateToDirectory(parentPath);
        };
    }

    /**
     * 导航到指定目录
     */
    private async navigateToDirectory(path: string): Promise<void> {
        this.setLoadingState(true);

        try {
            await this.explorerService.listDirectory(path);
        } catch {
            this.showNotice(i18n.t.view.connectionFailed, true);
            this.setLoadingState(false);
        }
    }

    /**
     * 设置加载状态
     */
    private setLoadingState(loading: boolean): void {
        if (loading) this.renderLoadingState(this.getFileListContainer());
        this.updateInteractiveElementsState(loading);
    }

    /**
     * 更新交互元素的状态
     */
    private updateInteractiveElementsState(loading: boolean): void {
        const items = this.contentEl?.querySelectorAll('.webdav-file-item') || [];
        items.forEach(item => {
            if (loading) {
                item.addClass('webdav-file-item-disabled');
            } else {
                item.removeClass('webdav-file-item-disabled');
            }
        });

        if (this.refreshButton) {
            if (loading) {
                this.refreshButton.addClass('webdav-file-item-disabled');
            } else {
                this.refreshButton.removeClass('webdav-file-item-disabled');
            }
        }
    }

    // ==================== 菜单和服务器切换 ====================
    /**
     * 显示服务器选择菜单
     */
    private showServerMenu(evt: MouseEvent): void {
        const servers = this.plugin.getServers();
        if (servers.length === 0) {
            new Notice(i18n.t.settings.serverListEmpty);
            return;
        }

        const menu = new Menu();
        servers.forEach(server => {
            const isSelected = server.name === this.plugin.getCurrentServer()?.name;
            menu.addItem(item => {
                const space = '\u2009\u2009\u2009\u2009\u2009\u2009';
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
     */
    private async switchServer(serverName: string): Promise<void> {
        const server = this.plugin.getServerByName(serverName);
        if (!server) return;

        this.plugin.settings.currentServerName = serverName;
        await this.plugin.saveData(this.plugin.settings);

        this.explorerService.setCurrentServer(server);
        this.rebuildView();

        const success = await this.connectAndList();
        if (success) {
            this.showNotice(i18n.t.view.switchSuccess, false);
        }
    }

    /**
     * 显示排序菜单
     */
    private showSortMenu(evt: MouseEvent): void {
        const menu = new Menu();
        const space = '\u2009\u2009\u2009\u2009\u2009\u2009';
        const currentSort = this.explorerService.getSortState();

        const sortOptions = this.getSortOptions();

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

    /**
     * 获取排序选项
     */
    private getSortOptions(): Array<{
        field: 'name' | 'type' | 'size' | 'date';
        order: 'asc' | 'desc';
        title: string;
    }> {
        return [
            {field: 'name', order: 'asc', title: i18n.t.view.sortByNameAsc},
            {field: 'name', order: 'desc', title: i18n.t.view.sortByNameDesc},
            {field: 'type', order: 'asc', title: i18n.t.view.sortByTypeAsc},
            {field: 'type', order: 'desc', title: i18n.t.view.sortByTypeDesc},
            {field: 'size', order: 'asc', title: i18n.t.view.sortBySizeAsc},
            {field: 'size', order: 'desc', title: i18n.t.view.sortBySizeDesc},
            {field: 'date', order: 'asc', title: i18n.t.view.sortByDateAsc},
            {field: 'date', order: 'desc', title: i18n.t.view.sortByDateDesc}
        ];
    }

    /**
     * 显示文件上下文菜单
     */
    private showFileContextMenu(event: MouseEvent, file: FileStat): void {
        event.preventDefault();
        const menu = new Menu();

        menu.addItem(item => {
            item.setTitle(i18n.t.contextMenu.copyUrl)
                .setIcon('link')
                .onClick(() => this.explorerService.copyFileUrl(file));
        });

        menu.addItem(item => {
            item.setTitle(i18n.t.contextMenu.download)
                .setIcon('download')
                .onClick(() => this.explorerService.downloadFile(file));
        });

        menu.showAtMouseEvent(event);
    }

    // ==================== 拖拽操作 ====================
    /**
     * 处理文件拖拽开始
     */
    private handleFileDragStart(event: DragEvent, file: FileStat): void {
        const target = event.currentTarget as HTMLElement;
        this.selectItem(target);

        const processedFilename = file.filename
            .replace(/\[/g, '【')
            .replace(/]/g, '】');

        const originalUrl = this.explorerService.getFileFullUrl(file.filename);
        const finalUrl = this.explorerService.applyUrlPrefix(originalUrl);

        event.dataTransfer?.setData('text/plain', processedFilename);
        event.dataTransfer?.setData('text/uri-list', finalUrl);

        this.setupDragEndCleanup();
    }

    /**
     * 设置拖拽结束清理
     */
    private setupDragEndCleanup(): void {
        this.registerDomEvent(document, 'dragend', () => {
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
    }

    // ==================== 状态管理方法 ====================
    /**
     * 选择文件项
     */
    private selectItem(item: HTMLElement): void {
        this.selectedItem?.removeClass('webdav-file-item-selected');
        this.selectedItem = item;
        item.addClass('webdav-file-item-selected');
    }

    /**
     * 更新排序图标
     */
    private updateSortIcon(): void {
        if (!this.sortIconEl) return;
        this.sortIconEl.empty();

        const currentSort = this.explorerService.getSortState();
        const iconName = currentSort.order === 'asc' ? 'arrow-up-narrow-wide' : 'arrow-down-wide-narrow';
        setIcon(this.sortIconEl, iconName);

        if (this.sortButton) {
            this.sortButton.setAttribute('aria-label',
                `${i18n.t.view.sort}: ${currentSort.field}, ${currentSort.order}`);
        }
    }

    // ==================== UI 反馈方法 ====================
    /**
     * 显示通知
     */
    private showNotice(message: string, isError: boolean = true): void {
        const prefix = isError ? '❌' : '✅';
        new Notice(`${prefix} ${message}`, isError ? 3000 : 1000);
    }
}