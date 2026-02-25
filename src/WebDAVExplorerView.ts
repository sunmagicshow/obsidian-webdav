import {WorkspaceLeaf, View, Notice, Menu, MarkdownView, setIcon, debounce} from 'obsidian';
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

    /**
     * 创建浏览器服务实例
     */
    private createExplorerService(): WebDAVExplorerService {
        return new WebDAVExplorerService(
            this.fileService,
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
        const actionsContainer = this.headerEl.createEl('div', {cls: 'webdav-actions'});

        this.buildActionButtons(actionsContainer);
        this.buildBreadcrumb();
    }

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
            const button = container.createEl('div', {cls: 'webdav-button'});
            const iconEl = button.createSpan({cls: 'webdav-icon'});
            setIcon(iconEl, icon);
            button.setAttribute('aria-label', label);
            button.onclick = onClick;
        });

        this.sortButton = container.lastElementChild as HTMLElement;
        this.sortIconEl = this.sortButton.querySelector('.webdav-icon');
        this.updateSortIcon();
    }

    private buildBreadcrumb(): void {
        const breadcrumbContainer = this.headerEl!.createEl('div', {cls: 'webdav-breadcrumb-container'});
        breadcrumbContainer.createEl('div', {cls: 'webdav-breadcrumb'});
        this.updateBreadcrumb();
    }

    // ==================== 文件列表渲染 ====================
    private handleFileListUpdate(files: FileStat[], hasParent: boolean): void {
        if (!this.contentEl) return;
        this.isLoading = false;
        this.contentEl.empty();
        const {fileList} = this.createFileListContainer();

        if (this.isLoading) {
            this.renderLoadingState(fileList);
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

    private renderLoadingState(fileList: HTMLElement): void {
        const loadingItem = fileList.createEl('div', {cls: 'webdav-loading-item'});
        const iconSpan = loadingItem.createSpan({cls: 'webdav-icon webdav-spin'});
        setIcon(iconSpan, 'loader');
        loadingItem.createSpan({cls: 'webdav-file-name', text: i18n.t.view.loading});
    }

    private renderEmptyDirectory(fileList: HTMLElement): void {
        const emptyItem = fileList.createEl('div', {cls: 'webdav-file-item-empty'});
        const iconSpan = emptyItem.createSpan({cls: 'webdav-icon'});
        setIcon(iconSpan, 'folder');
        emptyItem.createSpan({cls: 'webdav-file-name', text: i18n.t.view.emptyDir});
    }

    private renderFileItems(fileList: HTMLElement, files: FileStat[]): void {
        const sortedFiles = this.explorerService.sortFiles(files);
        sortedFiles.forEach(file => this.renderFileItem(fileList, file));
    }

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

    private createUpDirectoryItem(fileList: HTMLElement): void {
        const upItem = fileList.createEl('div', {cls: 'webdav-file-item-folder'});
        const iconSpan = upItem.createSpan({cls: 'webdav-icon'});
        setIcon(iconSpan, 'folder-up');
        upItem.createSpan({cls: 'webdav-file-name', text: '..'});
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

    private createFileListContainer(): { listContainer: HTMLElement, fileList: HTMLElement } {
        const listContainer = this.contentEl!.createEl('div', {cls: 'webdav-file-list-container'});
        const fileList = listContainer.createEl('div', {cls: 'webdav-file-list'});
        return {listContainer, fileList};
    }

    private setLoadingState(loading: boolean): void {
        this.isLoading = loading;

        if (loading && this.contentEl) {
            this.contentEl.empty();
            const {fileList} = this.createFileListContainer();
            this.renderLoadingState(fileList);
        }

        this.updateInteractiveElementsState(loading);
    }

    private updateInteractiveElementsState(loading: boolean): void {
        const items = this.contentEl?.querySelectorAll('.webdav-file-item') || [];
        items.forEach(item => {
            if (loading) {
                item.addClass('webdav-file-item-disabled');
            } else {
                item.removeClass('webdav-file-item-disabled');
            }
        });

        // 更新刷新按钮状态
        const refreshButton = this.containerEl.querySelector('.webdav-button .webdav-icon[data-icon="refresh-cw"]')?.closest('.webdav-button');
        if (refreshButton) {
            if (loading) {
                refreshButton.addClass('webdav-file-item-disabled');
            } else {
                refreshButton.removeClass('webdav-file-item-disabled');
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
        await this.plugin.saveData(this.plugin.settings);

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
        this.selectedItem?.removeClass('webdav-file-item-selected');
        this.selectedItem = item;
        item.addClass('webdav-file-item-selected');
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
                const separator = breadcrumbEl.createEl('span');
                const iconEl = separator.createSpan({cls: 'webdav-breadcrumb-separator'});
                setIcon(iconEl, 'chevron-right');
            }

            const item = breadcrumbEl.createEl('span', {cls: 'webdav-breadcrumb-item'});

            if (part.name === 'root') {
                item.addClass('webdav-breadcrumb-root');
                const rootLink = item.createEl('a');
                setIcon(rootLink, 'home');
                rootLink.title = i18n.t.view.rootDirectory;
                rootLink.onclick = async () => await this.explorerService.listDirectory(part.path);
            } else {
                const link = item.createEl('a', {text: part.name});
                if (part.isCurrent) {
                    link.addClass('webdav-breadcrumb-current');
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