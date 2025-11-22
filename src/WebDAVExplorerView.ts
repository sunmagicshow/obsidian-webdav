import {WorkspaceLeaf, View, Notice, Menu, MarkdownView, setIcon} from 'obsidian';
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
    private isLoading: boolean = false;

    // ==================== DOM 元素引用 ====================
    private sortButton: HTMLElement | null = null;
    private sortIconEl: HTMLElement | null = null;
    private headerEl: HTMLElement | null = null;
    private contentEl: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: WebDAVPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.fileService = new WebDAVFileService(this.app);
        this.explorerService = this.createExplorerService();
        this.refresh = this.fileService.debounce(this.executeRefresh.bind(this), 300);
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
            this.connectAndList().catch(() => {
                // 错误已在 connectAndList 中处理
            });
        }
    }

    /**
     * 创建浏览器服务实例
     */
    private createExplorerService(): WebDAVExplorerService {
        return new WebDAVExplorerService(
            this.fileService,  // 第一个参数应该是 fileService，不是 plugin
            (files: FileStat[], hasParent: boolean) => this.handleFileListUpdate(files, hasParent),
            () => this.updateBreadcrumb(),
            (message: string, isError: boolean = true) => this.showNotice(message, isError)
        );
    }

    // ==================== 视图构建方法 ====================
    private buildLayout(): void {
        this.headerEl = this.containerEl.createEl('div', {cls: 'webdav-header'});
        this.contentEl = this.containerEl.createEl('div', {cls: 'webdav-content'});
        this.buildHeaderContent();
    }

    private rebuildView(): void {
        this.containerEl.empty();
        this.containerEl.addClass('webdav-explorer-view');
        this.buildLayout();
    }

    private buildHeaderContent(): void {
        if (!this.headerEl) return;

        this.headerEl.empty();
        const titleRow = this.headerEl.createEl('div', {cls: 'webdav-title-row'});
        const actionsContainer = titleRow.createEl('div', {cls: 'webdav-actions-container'});

        this.buildActionButtons(actionsContainer);
        this.buildBreadcrumb();
    }

    private buildActionButtons(container: HTMLElement): void {
        const buttons = [
            {
                cls: 'webdav-button',
                icon: 'server',
                label: i18n.t.view.selectServer,
                onClick: (evt: MouseEvent) => this.showServerMenu(evt),
                iconCls: 'webdav-server-icon'
            },
            {
                cls: 'webdav-button',
                icon: 'refresh-cw',
                label: i18n.t.view.refresh,
                onClick: () => this.refresh(),
                iconCls: 'webdav-refresh-icon'
            },
            {
                cls: 'webdav-button',
                icon: 'arrow-up-narrow-wide', // 临时图标，会在 updateSortIcon 中更新
                label: i18n.t.view.sort,
                onClick: (evt: MouseEvent) => this.showSortMenu(evt),
                iconCls: 'webdav-sort-icon'
            }
        ];

        buttons.forEach(buttonConfig => {
            this.createActionButton(container, buttonConfig);
        });

        // 保存排序按钮引用并更新图标
        this.sortButton = container.lastElementChild as HTMLElement;
        this.sortIconEl = this.sortButton.querySelector('.webdav-sort-icon');
        this.updateSortIcon();
    }

    private createActionButton(container: HTMLElement, config: {
        cls: string;
        icon: string;
        label: string;
        onClick: (evt: MouseEvent) => void;
        iconCls: string;
    }): void {
        const button = container.createEl('div', {cls: config.cls});
        const content = button.createEl('div', {cls: 'webdav-button-content'});
        const iconEl = content.createSpan({cls: config.iconCls});
        setIcon(iconEl, config.icon);
        button.setAttribute('aria-label', config.label);
        button.onclick = config.onClick;
    }

    private buildBreadcrumb(): void {
        const breadcrumbContainer = this.headerEl!.createEl('div', {cls: 'webdav-breadcrumb-container'});
        breadcrumbContainer.createEl('div', {cls: 'webdav-breadcrumb'});
        this.updateBreadcrumb();
    }

    // ==================== 文件列表渲染 ====================
    private handleFileListUpdate(files: FileStat[], hasParent: boolean): void {
        if (!this.contentEl) return;

        this.setLoadingState(false);
        this.contentEl.empty();

        const listContainer = this.contentEl.createEl('div', {cls: 'file-list-container'});
        const fileList = listContainer.createEl('div', {cls: 'file-list'});

        if (this.isLoading) {
            this.showLoadingState(fileList);
            return;
        }

        if (hasParent) {
            this.createUpDirectoryItem(fileList);
        }

        if (files.length === 0 && !hasParent) {
            this.renderEmptyDirectory(fileList);
            return;
        }

        this.renderFileItems(fileList, files);
    }

    private showLoadingState(fileList: HTMLElement): void {
        const loadingItem = fileList.createEl('div', {cls: 'file-item loading'});
        const iconSpan = loadingItem.createSpan({cls: 'file-icon'});
        setIcon(iconSpan, 'loader');
        loadingItem.createSpan({cls: 'file-name', text: i18n.t.view.loading || '加载中...'});
    }

    private renderEmptyDirectory(fileList: HTMLElement): void {
        const emptyItem = fileList.createEl('div', {cls: 'file-item empty'});
        const iconSpan = emptyItem.createSpan({cls: 'file-icon'});
        setIcon(iconSpan, 'folder');
        emptyItem.createSpan({cls: 'file-name', text: i18n.t.view.emptyDir});
    }

    private renderFileItems(fileList: HTMLElement, files: FileStat[]): void {
        const sortedFiles = this.explorerService.sortFiles(files);
        sortedFiles.forEach(file => this.renderFileItem(fileList, file));
    }

    private renderFileItem(fileList: HTMLElement, file: FileStat): void {
        const item = fileList.createEl('div', {cls: 'file-item is-clickable'});
        const iconSpan = item.createSpan({cls: 'file-icon'});
        item.createSpan({cls: 'file-name', text: file.basename});

        if (file.type === 'directory') {
            this.setupDirectoryItem(item, iconSpan, file);
        } else {
            this.setupFileItem(item, iconSpan, file);
        }
    }

    private setupDirectoryItem(item: HTMLElement, iconSpan: HTMLElement, file: FileStat): void {
        setIcon(iconSpan, 'folder');
        item.addClass('folder');
        item.onclick = async () => {
            this.selectItem(item);
            await this.navigateToDirectory(file.filename);
        };
    }

    private setupFileItem(item: HTMLElement, iconSpan: HTMLElement, file: FileStat): void {
        const fileIcon = this.fileService.getFileIcon(file.basename);
        setIcon(iconSpan, fileIcon);
        item.addClass('file');

        item.onclick = () => this.selectItem(item);
        item.ondblclick = () => this.explorerService.openFileWithWeb(file.filename);
        item.oncontextmenu = (evt) => this.showFileContextMenu(evt, file);

        item.setAttr('draggable', 'true');
        item.ondragstart = (event) => this.handleFileDragStart(event, file);
    }

    private createUpDirectoryItem(fileList: HTMLElement): void {
        const upItem = fileList.createEl('div', {cls: 'file-item folder'});
        const iconSpan = upItem.createSpan({cls: 'file-icon'});
        setIcon(iconSpan, 'folder-up');
        upItem.createSpan({cls: 'file-name', text: '..'});
        upItem.onclick = async () => {
            const parentPath = this.explorerService.getParentPath();
            await this.navigateToDirectory(parentPath);
        };
    }

    private async navigateToDirectory(path: string): Promise<void> {
        this.setLoadingState(true);

        try {
            await this.explorerService.listDirectory(path);
        } catch {
            this.showNotice(i18n.t.view.connectionFailed, true);
            this.setLoadingState(false);
        }
    }

    private setLoadingState(loading: boolean): void {
        this.isLoading = loading;

        if (loading && this.contentEl) {
            this.contentEl.empty();
            const listContainer = this.contentEl.createEl('div', {cls: 'file-list-container'});
            const fileList = listContainer.createEl('div', {cls: 'file-list'});
            this.showLoadingState(fileList);
        }

        this.updateInteractiveElementsState(loading);
    }

    private updateInteractiveElementsState(loading: boolean): void {
        // 更新文件夹项状态
        const folderItems = this.contentEl?.querySelectorAll('.file-item.folder') || [];
        folderItems.forEach(item => {
            if (loading) {
                item.addClass('loading-disabled');
                item.setAttribute('disabled', 'true');
            } else {
                item.removeClass('loading-disabled');
                item.removeAttribute('disabled');
            }
        });

        // 更新刷新按钮状态
        const refreshButton = this.containerEl.querySelector('.webdav-refresh-icon')?.parentElement?.parentElement;
        if (refreshButton) {
            if (loading) {
                refreshButton.addClass('loading-disabled');
                refreshButton.setAttribute('disabled', 'true');
            } else {
                refreshButton.removeClass('loading-disabled');
                refreshButton.removeAttribute('disabled');
            }
        }
    }

    // ==================== 拖拽和菜单方法 ====================
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

    private setupDragEndCleanup(): void {
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
    }

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

    // ==================== 服务器和排序菜单 ====================
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

    private async switchServer(serverName: string): Promise<void> {
        const server = this.plugin.getServerByName(serverName);
        if (!server) return;

        this.plugin.settings.currentServerName = serverName;
        await this.plugin.saveSettings();

        this.explorerService.setCurrentServer(server);
        this.rebuildView();

        const success = await this.connectAndList();
        if (success) {
            this.showNotice(i18n.t.view.switchSuccess, false);
        }
    }

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

    // ==================== 状态管理方法 ====================
    private selectItem(item: HTMLElement): void {
        this.selectedItem?.removeClass('selected');
        this.selectedItem = item;
        item.addClass('selected');
    }

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

    private updateBreadcrumb(): void {
        const breadcrumbContainer = this.containerEl.querySelector('.webdav-breadcrumb-container');
        if (!breadcrumbContainer) return;

        breadcrumbContainer.empty();
        const breadcrumbEl = breadcrumbContainer.createEl('div', {cls: 'webdav-breadcrumb'});

        const parts = this.explorerService.getBreadcrumbParts();

        parts.forEach((part, index) => {
            if (index > 0) {
                const separator = breadcrumbEl.createEl('span', {cls: 'breadcrumb-separator'});
                setIcon(separator, 'chevron-right');
            }

            const item = breadcrumbEl.createEl('span', {cls: 'breadcrumb-item'});

            if (part.name === 'root') {
                item.addClass('breadcrumb-root');
                const rootLink = item.createEl('a', {cls: 'breadcrumb-root-link'});
                setIcon(rootLink, 'home');
                rootLink.title = i18n.t.view.rootDirectory;
                rootLink.onclick = async () => await this.explorerService.listDirectory(part.path);
            } else {
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

    private refreshFileList(): void {
        const currentPath = this.explorerService.getCurrentPath();
        this.explorerService.listDirectory(currentPath).catch(() => {
            this.showNotice(i18n.t.view.refreshFailed, true);
        });
    }

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

    // ==================== UI 反馈方法 ====================
    private showNotice(message: string, isError: boolean = true): void {
        const prefix = isError ? '❌' : '✅';
        new Notice(`${prefix} ${message}`, isError ? 3000 : 1000);
    }
}