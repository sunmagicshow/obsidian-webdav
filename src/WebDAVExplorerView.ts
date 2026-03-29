import {
    WorkspaceLeaf,
    View,
    Notice,
    Menu,
    Modal,
    MarkdownView,
    setIcon,
    debounce,
    ButtonComponent,
    TAbstractFile
} from 'obsidian';
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
    private readonly explorerService: WebDAVExplorerService;

    // ==================== 视图状态 ====================
    private selectedItems: Set<HTMLElement> = new Set();
    private selectedFiles: Map<HTMLElement, FileStat> = new Map();
    private refreshButton: HTMLElement | null = null;

    // ==================== 事件处理器 ====================
    private dragOverHandler: ((evt: DragEvent) => void) | null = null;
    private dragLeaveHandler: ((evt: DragEvent) => void) | null = null;
    private dropHandler: ((evt: DragEvent) => void) | null = null;

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
        this.selectedItems.clear();
        this.selectedFiles.clear();

        // 清理事件处理器
        if (this.contentEl) {
            if (this.dragOverHandler) {
                this.contentEl.removeEventListener('dragover', this.dragOverHandler);
            }
            if (this.dragLeaveHandler) {
                this.contentEl.removeEventListener('dragleave', this.dragLeaveHandler);
            }
            if (this.dropHandler) {
                this.contentEl.removeEventListener('drop', this.dropHandler);
            }
        }

        this.dragOverHandler = null;
        this.dragLeaveHandler = null;
        this.dropHandler = null;

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
        this.setupDragAndDropOnContent();
        this.buildHeaderContent();
    }

    /**
     * 在 contentEl 上设置拖放事件
     */
    private setupDragAndDropOnContent(): void {
        if (!this.contentEl) return;

        // 移除旧的事件监听器（如果存在）
        if (this.dragOverHandler) {
            this.contentEl.removeEventListener('dragover', this.dragOverHandler);
        }
        if (this.dragLeaveHandler) {
            this.contentEl.removeEventListener('dragleave', this.dragLeaveHandler);
        }
        if (this.dropHandler) {
            this.contentEl.removeEventListener('drop', this.dropHandler);
        }

        // 创建新的事件处理器并存储到类属性
        this.dragOverHandler = (evt: DragEvent) => this.handleDragOver(evt);
        this.dragLeaveHandler = (evt: DragEvent) => this.handleDragLeave(evt);
        this.dropHandler = (evt: DragEvent) => {
            void this.handleDrop(evt).catch(() => {
                // 忽略处理错误
            });
        };

        // 添加新的事件监听器
        this.contentEl.addEventListener('dragover', this.dragOverHandler);
        this.contentEl.addEventListener('dragleave', this.dragLeaveHandler);
        this.contentEl.addEventListener('drop', this.dropHandler);
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
        // 重新设置拖放事件，因为 empty() 会清除所有子元素和事件
        this.setupDragAndDropOnContent();
        return this.contentEl!.createEl('div', {cls: 'webdav-file-list'});
    }

    /**
     * 处理拖拽悬停
     */
    private handleDragOver(evt: DragEvent): void {
        evt.preventDefault();
        evt.stopPropagation();

        // 检查是否是从本视图内部拖动的文件
        // 本视图内部拖动的文件不会包含 obsidian:// URI
        const filesData = evt.dataTransfer?.getData('text/plain');
        const hasObsidianUri = filesData ? filesData.split('\n').some(p => p.trim().startsWith('obsidian://')) : false;

        // 只有从外部拖拽进来的文件才显示拖入效果
        if (hasObsidianUri) {
            const fileList = evt.currentTarget as HTMLElement;
            fileList.addClass('webdav-drag-over');
        }
    }

    /**
     * 处理拖拽离开
     */
    private handleDragLeave(evt: DragEvent): void {
        evt.preventDefault();
        evt.stopPropagation();
        const fileList = evt.currentTarget as HTMLElement;
        fileList.removeClass('webdav-drag-over');
    }

    /**
     * 处理文件拖放上传
     */
    private async handleDrop(evt: DragEvent): Promise<void> {
        evt.preventDefault();
        evt.stopPropagation();

        const targetEl = evt.currentTarget as HTMLElement;
        targetEl.removeClass('webdav-drag-over');

        // 尝试从 dataTransfer 获取文件路径
        let filesData = evt.dataTransfer?.getData('text/plain');

        // 如果没有获取到，尝试从 files 获取
        if (!filesData && evt.dataTransfer?.files && evt.dataTransfer.files.length > 0) {
            // 处理系统文件拖拽
            this.showNotice(i18n.t.view.dragFromLeft, true);
            return;
        }

        if (!filesData) {
            return;
        }

        // 检查是否是从本视图内部拖动的文件
        // 本视图内部拖动的文件不会包含 obsidian:// URI
        const hasObsidianUri = filesData.split('\n').some(p => p.trim().startsWith('obsidian://'));

        // 如果没有 obsidian:// URI，说明是在视图内部拖动的文件，不处理
        if (!hasObsidianUri) {
            return;
        }

        // 解析文件路径（Obsidian 拖拽时会传递 obsidian:// URI）
        const paths = filesData.split('\n').filter(p => p.trim());
        if (paths.length === 0) {
            return;
        }

        // 获取对应的 TAbstractFile 对象
        const items: TAbstractFile[] = [];
        for (const path of paths) {
            const trimmedPath = path.trim();

            // 解析 obsidian:// URI
            let filePath = trimmedPath;
            if (trimmedPath.startsWith('obsidian://')) {
                try {
                    const url = new URL(trimmedPath);
                    const fileParam = url.searchParams.get('file');
                    if (fileParam) {
                        filePath = decodeURIComponent(fileParam);
                    }
                } catch {
                    // 忽略解析错误
                }
            }

            // 先尝试直接路径匹配
            let file: TAbstractFile | null = this.app.vault.getAbstractFileByPath(filePath);
            
            // 如果没找到，尝试搜索文件名（考虑扩展名）
            if (!file) {
                const files = this.app.vault.getFiles();
                // 尝试直接匹配文件名，再尝试匹配不带扩展名的文件名
                file = files.find(f => f.name === filePath) || 
                       files.find(f => f.name.replace(/\.[^/.]+$/, '') === filePath) || 
                       null;
            }

            if (file) {
                items.push(file);
            }
        }

        if (items.length === 0) {
            this.showNotice(i18n.t.view.noValidFiles, true);
            return;
        }

        // 去重，避免重复处理
        const uniqueItems = Array.from(new Set(items));

        // 处理上传
        await this.handleUploadWithConflictCheck(uniqueItems);
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

        // 存储文件数据到元素
        (item as HTMLElement & { fileData?: FileStat }).fileData = file;

        if (file.type === 'directory') {
            setIcon(iconSpan, 'folder');
            item.addClass('webdav-file-item-folder');
            item.onclick = (evt) => this.handleItemClick(evt, item, file);
            item.ondblclick = async () => await this.navigateToDirectory(file.filename);
            item.oncontextmenu = (evt) => this.showMultiSelectContextMenu(evt);
        } else {
            const fileIcon = this.fileService.getFileIcon(file.basename);
            setIcon(iconSpan, fileIcon);
            item.onclick = (evt) => this.handleItemClick(evt, item, file);
            item.ondblclick = () => this.explorerService.openFileWithWeb(file.filename);
            item.oncontextmenu = (evt) => this.showMultiSelectContextMenu(evt);
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
            const isSelected = server.id === this.plugin.getCurrentServer()?.id;
            menu.addItem(item => {
                const space = '\u2009\u2009\u2009\u2009\u2009\u2009';
                const title = isSelected ? server.name : `${space}${server.name}`;

                item.setTitle(title)
                    .setIcon(isSelected ? 'check' : '')
                    .onClick(async () => await this.switchServer(server.id));
            });
        });

        menu.showAtMouseEvent(evt);
    }

    /**
     * 切换服务器
     */
    private async switchServer(serverId: string): Promise<void> {
        const server = this.plugin.settings.servers.find(s => s.id === serverId);
        if (!server) return;

        this.plugin.settings.currentServerName = server.name;
        this.plugin.settings.currentServerId = server.id;
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
     * 显示多选上下文菜单
     */
    private showMultiSelectContextMenu(event: MouseEvent): void {
        event.preventDefault();
        const menu = new Menu();
        const selectedFiles = this.getSelectedFiles();

        if (selectedFiles.length === 0) {
            // 尝试获取右键点击的文件
            const target = event.target as HTMLElement;
            const item = target.closest('.webdav-file-item') as HTMLElement;
            if (item) {
                const fileData = (item as HTMLElement & { fileData?: FileStat }).fileData;
                if (fileData) {
                    this.addItemToSelection(item, fileData);
                    selectedFiles.push(fileData);
                }
            }
        }

        if (selectedFiles.length === 1) {
            // 单选时显示完整菜单
            this.showSingleItemContextMenu(menu, selectedFiles[0]);
        } else if (selectedFiles.length > 1) {
            // 多选时只显示下载和删除
            this.showMultiItemContextMenu(menu, selectedFiles);
        }

        menu.showAtMouseEvent(event);
    }

    /**
     * 显示单文件上下文菜单
     */
    private showSingleItemContextMenu(menu: Menu, file: FileStat): void {
        const isDirectory = file.type === 'directory';

        if (!isDirectory) {
            menu.addItem(item => {
                item.setTitle(i18n.t.contextMenu.copyUrl)
                    .setIcon('link')
                    .onClick(() => this.explorerService.copyFileUrl(file));
            });
        }

        menu.addItem(item => {
            item.setTitle(i18n.t.contextMenu.download)
                .setIcon('download')
                .onClick(() => void this.downloadWithConflictDialog(file));
        });

        menu.addSeparator();

        menu.addItem(item => {
            item.setTitle(i18n.t.contextMenu.delete)
                .setIcon('trash')
                .onClick(() => void this.confirmAndDeleteRemote(file));
        });
    }

    /**
     * 显示多文件上下文菜单（只显示下载和删除）
     */
    private showMultiItemContextMenu(menu: Menu, files: FileStat[]): void {
        menu.addItem(item => {
            item.setTitle(`${i18n.t.contextMenu.download} (${files.length})`)
                .setIcon('download')
                .onClick(() => void this.downloadMultipleFiles(files));
        });

        menu.addSeparator();

        menu.addItem(item => {
            item.setTitle(`${i18n.t.contextMenu.delete} (${files.length})`)
                .setIcon('trash')
                .onClick(() => void this.confirmAndDeleteRemote(files));
        });
    }

    private async downloadWithConflictDialog(file: FileStat): Promise<void> {
        const server = this.plugin.getCurrentServer();
        if (!server) {
            this.showNotice(i18n.t.view.selectServer, true);
            return;
        }
        const plan = await this.fileService.planDownload(file, server);
        if (plan.conflict) {
            const choice = await this.showDownloadConflictModal(file.basename);
            if (choice === 'cancel') return;
            await this.explorerService.downloadRemoteItem(file, choice);
        } else {
            await this.explorerService.downloadRemoteItem(file, 'new');
        }
    }

    private async showDownloadConflictModal(itemName: string): Promise<'overwrite' | 'rename' | 'cancel'> {
        return new Promise((resolve) => {
            const modal = new Modal(this.app);
            modal.titleEl.setText(i18n.t.contextMenu.downloadConflictTitle);
            modal.contentEl.createEl('p', {
                text: i18n.t.contextMenu.downloadConflictMessage.replace('{name}', itemName)
            });
            const buttonContainer = modal.contentEl.createDiv({cls: 'webdav-modal-button-container'});
            new ButtonComponent(buttonContainer).setButtonText(i18n.t.contextMenu.overwrite).setWarning().onClick(() => {
                modal.close();
                resolve('overwrite');
            });
            new ButtonComponent(buttonContainer).setButtonText(i18n.t.contextMenu.renameDownload).onClick(() => {
                modal.close();
                resolve('rename');
            });
            new ButtonComponent(buttonContainer).setButtonText(i18n.t.settings.cancel).onClick(() => {
                modal.close();
                resolve('cancel');
            });
            modal.open();
        });
    }

    /**
     * 显示上传冲突对话框
     */
    async showUploadConflictModal(itemName: string): Promise<'overwrite' | 'rename' | 'cancel'> {
        return new Promise((resolve) => {
            const modal = new Modal(this.app);
            modal.titleEl.setText(i18n.t.contextMenu.uploadConflictTitle);
            modal.contentEl.createEl('p', {
                text: i18n.t.contextMenu.uploadConflictMessage.replace('{name}', itemName)
            });
            const buttonContainer = modal.contentEl.createDiv({cls: 'webdav-modal-button-container'});
            new ButtonComponent(buttonContainer).setButtonText(i18n.t.contextMenu.overwriteUpload).setWarning().onClick(() => {
                modal.close();
                resolve('overwrite');
            });
            new ButtonComponent(buttonContainer).setButtonText(i18n.t.contextMenu.renameUpload).onClick(() => {
                modal.close();
                resolve('rename');
            });
            new ButtonComponent(buttonContainer).setButtonText(i18n.t.settings.cancel).onClick(() => {
                modal.close();
                resolve('cancel');
            });
            modal.open();
        });
    }

    /**
     * 检查是否有选中的文件需要上传并处理冲突
     */
    async handleUploadWithConflictCheck(items: TAbstractFile[]): Promise<void> {
        const server = this.plugin.getCurrentServer();
        if (!server) {
            this.showNotice(i18n.t.view.selectServer, true);
            return;
        }

        // 确保客户端已初始化
        if (!this.explorerService['client']) {
            const success = await this.explorerService.initializeClient();
            if (!success) {
                this.showNotice(i18n.t.view.connectionFailed, true);
                return;
            }
        }

        // 检查是否有任何文件存在冲突
        let hasConflict = false;
        const currentPath = this.explorerService.getCurrentRemotePath();

        for (const item of items) {
            const remotePath = `${currentPath}/${item.name}`;
            const exists = await this.explorerService.checkRemotePathExists(remotePath);
            if (exists) {
                hasConflict = true;
                break;
            }
        }

        if (hasConflict) {
            // 找到第一个冲突的文件
            let firstConflictItem = items[0];
            for (const item of items) {
                const remotePath = `${currentPath}/${item.name}`;
                const exists = await this.explorerService.checkRemotePathExists(remotePath);
                if (exists) {
                    firstConflictItem = item;
                    break;
                }
            }

            const choice = await this.showUploadConflictModal(firstConflictItem.name);
            if (choice === 'cancel') return;
            await this.explorerService.uploadItems(items, choice);
        } else {
            // 没有冲突，直接上传
            await this.explorerService.uploadItems(items, 'overwrite');
        }
    }

    /**
     * 确认并删除远程文件（支持单文件和多文件）
     */
    private async confirmAndDeleteRemote(files: FileStat | FileStat[]): Promise<void> {
        const fileArray = Array.isArray(files) ? files : [files];
        const isSingle = fileArray.length === 1;

        const confirmed = await new Promise<boolean>((resolve) => {
            const modal = new Modal(this.app);
            modal.titleEl.setText(i18n.t.contextMenu.delete);
            modal.contentEl.createEl('p', {
                text: isSingle
                    ? i18n.t.contextMenu.confirmDeleteRemote.replace('{name}', fileArray[0].basename)
                    : i18n.t.contextMenu.confirmDeleteMultiple.replace('{count}', fileArray.length.toString())
            });
            const buttonContainer = modal.contentEl.createDiv({cls: 'webdav-modal-button-container'});
            new ButtonComponent(buttonContainer).setButtonText(i18n.t.settings.confirm).setWarning().onClick(() => {
                modal.close();
                resolve(true);
            });
            new ButtonComponent(buttonContainer).setButtonText(i18n.t.settings.cancel).onClick(() => {
                modal.close();
                resolve(false);
            });
            modal.open();
        });
        if (!confirmed) return;

        let successCount = 0;
        let failCount = 0;

        for (const file of fileArray) {
            const success = await this.explorerService.deleteRemoteItem(file);
            if (success) {
                successCount++;
            } else {
                failCount++;
            }
        }

        if (successCount > 0) {
            this.showNotice(i18n.t.view.deleteCompleted
                .replace('{success}', successCount.toString())
                .replace('{failed}', failCount > 0 ? i18n.t.contextMenu.failedCount.replace('{count}', failCount.toString()) : ''), false);
            // 清除选择状态，避免与左侧文件目录树的选择状态冲突
            this.clearSelection();
        } else if (failCount > 0) {
            this.showNotice(i18n.t.view.deleteFailed.replace('{count}', failCount.toString()), true);
        }
    }

    /**
     * 下载多个文件
     */
    private async downloadMultipleFiles(files: FileStat[]): Promise<void> {
        const server = this.plugin.getCurrentServer();
        if (!server) {
            this.showNotice(i18n.t.view.selectServer, true);
            return;
        }

        let successCount = 0;
        let failCount = 0;

        for (const file of files) {
            try {
                const plan = await this.fileService.planDownload(file, server);
                if (plan.conflict) {
                    // 多文件下载时，默认使用重命名策略避免冲突
                    await this.explorerService.downloadRemoteItem(file, 'rename');
                } else {
                    await this.explorerService.downloadRemoteItem(file, 'new');
                }
                successCount++;
            } catch {
                failCount++;
            }
        }

        if (successCount > 0) {
            this.showNotice(i18n.t.view.downloadCompleted
                .replace('{success}', successCount.toString())
                .replace('{failed}', failCount > 0 ? i18n.t.contextMenu.failedCount.replace('{count}', failCount.toString()) : ''), false);
        } else if (failCount > 0) {
            this.showNotice(i18n.t.view.downloadFailed.replace('{count}', failCount.toString()), true);
        }
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

    // ==================== 多选管理方法 ====================
    /**
     * 处理文件项点击（支持多选）
     */
    private handleItemClick(evt: MouseEvent, item: HTMLElement, file: FileStat): void {
        if (evt.ctrlKey || evt.metaKey) {
            // Ctrl/Cmd + 点击：切换选中状态
            this.toggleItemSelection(item, file);
        } else if (evt.shiftKey && this.selectedItems.size > 0) {
            // Shift + 点击：范围选择
            this.rangeSelectItems(item);
        } else {
            // 普通点击：单选
            this.clearSelection();
            this.addItemToSelection(item, file);
        }
    }

    /**
     * 切换项的选中状态
     */
    private toggleItemSelection(item: HTMLElement, file: FileStat): void {
        if (this.selectedItems.has(item)) {
            this.selectedItems.delete(item);
            this.selectedFiles.delete(item);
            item.removeClass('webdav-file-item-selected');
        } else {
            this.selectedItems.add(item);
            this.selectedFiles.set(item, file);
            item.addClass('webdav-file-item-selected');
        }
    }

    /**
     * 添加项到选中集合
     */
    private addItemToSelection(item: HTMLElement, file: FileStat): void {
        this.selectedItems.add(item);
        this.selectedFiles.set(item, file);
        item.addClass('webdav-file-item-selected');
    }

    /**
     * 清除所有选中
     */
    private clearSelection(): void {
        this.selectedItems.forEach(item => {
            item.removeClass('webdav-file-item-selected');
        });
        this.selectedItems.clear();
        this.selectedFiles.clear();
    }

    /**
     * 范围选择（Shift+点击）
     */
    private rangeSelectItems(targetItem: HTMLElement): void {
        const fileList = this.contentEl?.querySelector('.webdav-file-list');
        if (!fileList) return;

        const allItems = Array.from(fileList.querySelectorAll('.webdav-file-item'));
        const lastSelectedItem = Array.from(this.selectedItems).pop();
        if (!lastSelectedItem) return;

        const lastIndex = allItems.indexOf(lastSelectedItem);
        const targetIndex = allItems.indexOf(targetItem);

        if (lastIndex === -1 || targetIndex === -1) return;

        const start = Math.min(lastIndex, targetIndex);
        const end = Math.max(lastIndex, targetIndex);

        for (let i = start; i <= end; i++) {
            const item = allItems[i];
            if (item instanceof HTMLElement) {
                const fileData = (item as HTMLElement & { fileData?: FileStat }).fileData;
                if (fileData && !this.selectedItems.has(item)) {
                    this.addItemToSelection(item, fileData);
                }
            }
        }
    }

    /**
     * 获取当前选中的文件列表
     */
    private getSelectedFiles(): FileStat[] {
        return Array.from(this.selectedFiles.values());
    }

    // ==================== 状态管理方法 ====================
    /**
     * 选择文件项（兼容旧代码）
     */
    private selectItem(item: HTMLElement): void {
        this.clearSelection();
        const fileData = (item as HTMLElement & { fileData?: FileStat }).fileData;
        if (fileData) {
            this.addItemToSelection(item, fileData);
        }
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