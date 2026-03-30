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
    TAbstractFile,
    TFolder,
    TFile
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

        // 直接显示拖入效果，不检查是否包含 obsidian:// URI
        // 因为拖拽文件夹时，dataTransfer.getData可能不会立即返回数据
        const fileList = evt.currentTarget as HTMLElement;
        fileList.addClass('webdav-drag-over');
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

        // 解析文件路径（Obsidian 拖拽时会传递 obsidian:// URI）
        const paths = filesData.split('\n').filter(p => p.trim());
        if (paths.length === 0) {
            return;
        }

        // 只允许拖拽单个文件或文件夹
        if (paths.length !== 1) {
            this.showNotice('只能选择单个文件或文件夹', true);
            return;
        }

        // 获取对应的 TAbstractFile 对象
        const items: TAbstractFile[] = [];
        try {
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

                // 尝试获取文件或文件夹对象
                let file: TAbstractFile | null = null;

                // 1. 首先尝试直接路径匹配（最准确）
                file = this.app.vault.getAbstractFileByPath(filePath);
                
                // 1.1 如果没找到，尝试添加.md扩展名后匹配（处理Obsidian中md文件的特殊性）
                if (!file && !filePath.includes('.')) {
                    file = this.app.vault.getAbstractFileByPath(filePath + '.md');
                }

                // 2. 如果没找到，尝试遍历所有文件和文件夹进行精确匹配
                if (!file) {
                    const allFiles = this.app.vault.getFiles();
                    const allFolders = this.app.vault.getAllFolders();

                    // 尝试精确匹配路径
                    file = allFiles.find(f => f.path === filePath) ||
                        allFolders.find(f => f.path === filePath) ||
                        // 尝试匹配带.md扩展名的文件路径
                        allFiles.find(f => f.path === filePath + '.md') ||
                        null;
                }

                // 3. 如果没找到，尝试匹配文件名（用于处理没有路径的情况）
                if (!file) {
                    const allFiles = this.app.vault.getFiles();
                    const allFolders = this.app.vault.getAllFolders();

                    // 优先匹配文件夹，再匹配文件
                    file = allFolders.find(f => f.name === filePath) ||
                        allFiles.find(f => f.name === filePath) ||
                        // 尝试匹配带.md扩展名的文件
                        allFiles.find(f => f.name === filePath + '.md') ||
                        null;
                }

                // 4. 如果还是没找到，尝试匹配路径的最后一部分（用于处理嵌套路径）
                if (!file && filePath.includes('/')) {
                    const basename = filePath.split('/').pop();
                    if (basename) {
                        const allFiles = this.app.vault.getFiles();
                        const allFolders = this.app.vault.getAllFolders();

                        // 优先匹配文件夹，再匹配文件
                        file = allFolders.find(f => f.name === basename) ||
                            allFiles.find(f => f.name === basename) ||
                            null;
                    }
                }

                // 添加找到的文件或文件夹
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
        } catch (error) {
            this.showNotice('Upload failed: ' + (error as Error).message, true);
        }
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

        // 尝试获取右键点击的文件
        const target = event.target as HTMLElement;
        const item = target.closest('.webdav-file-item') as HTMLElement;

        if (item) {
            const fileData = (item as HTMLElement & { fileData?: FileStat }).fileData;
            if (fileData) {
                // 检查右键点击的文件是否已经在选中列表中
                const isAlreadySelected = Array.from(this.selectedItems).some(selectedItem => {
                    const selectedFileData = (selectedItem as HTMLElement & { fileData?: FileStat }).fileData;
                    return selectedFileData?.filename === fileData.filename;
                });

                if (!isAlreadySelected) {
                    // 如果右键点击的文件未选中，清除之前的选择并只选中该文件
                    this.clearSelection();
                    this.addItemToSelection(item, fileData);
                    selectedFiles.length = 0;
                    selectedFiles.push(fileData);
                }
            }
        }

        // 如果没有获取到文件且选中列表为空，尝试从item获取
        if (selectedFiles.length === 0 && item) {
            const fileData = (item as HTMLElement & { fileData?: FileStat }).fileData;
            if (fileData) {
                this.addItemToSelection(item, fileData);
                selectedFiles.push(fileData);
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
        // 单选时也显示复制链接（支持文件和文件夹）
        menu.addItem(item => {
            item.setTitle(i18n.t.contextMenu.copyUrl)
                .setIcon('link')
                .onClick(async () => await this.explorerService.copyFileUrl(file));
        });

        menu.addItem(item => {
            item.setTitle(i18n.t.contextMenu.download)
                .setIcon('download')
                .onClick(() => void this.downloadWithConflictDialog(file));
        });

        menu.addSeparator();

        menu.addItem(item => {
            item.setTitle('重命名')
                .setIcon('edit')
                .onClick(() => void this.showRenameModal(file));
        });

        menu.addItem(item => {
            item.setTitle(i18n.t.contextMenu.delete)
                .setIcon('trash')
                .onClick(() => void this.confirmAndDeleteRemote(file));
        });
    }

    /**
     * 显示多文件上下文菜单（显示复制链接、下载和删除）
     */
    private showMultiItemContextMenu(menu: Menu, files: FileStat[]): void {
        // 多选时显示复制链接
        menu.addItem(item => {
            item.setTitle(`${i18n.t.contextMenu.copyUrl} (${files.length})`)
                .setIcon('link')
                .onClick(async () => await this.explorerService.copyMultipleFileUrls(files));
        });

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
     * 显示重命名对话框
     */
    private async showRenameModal(file: FileStat): Promise<void> {
        return new Promise((resolve) => {
            const modal = new Modal(this.app);
            modal.titleEl.setText('重命名');
            
            const form = modal.contentEl.createEl('form');
            form.addClass('webdav-rename-form');
            
            form.createEl('p', {
                text: `请输入新的名称：`
            });
            
            const input = form.createEl('input', {
                type: 'text',
                value: file.basename
            });
            input.addClass('webdav-rename-input');
            input.focus();
            input.select();
            
            const buttonContainer = modal.contentEl.createDiv({cls: 'webdav-modal-button-container'});
            new ButtonComponent(buttonContainer).setButtonText(i18n.t.settings.confirm).onClick(async () => {
                const newName = input.value.trim();
                if (newName && newName !== file.basename) {
                    modal.close();
                    await this.renameRemoteItem(file, newName);
                } else {
                    modal.close();
                }
                resolve();
            });
            new ButtonComponent(buttonContainer).setButtonText(i18n.t.settings.cancel).onClick(() => {
                modal.close();
                resolve();
            });
            
            // 按Enter键确认，按Escape键取消
            input.addEventListener('keydown', (evt) => {
                if (evt.key === 'Enter') {
                    const newName = input.value.trim();
                    if (newName && newName !== file.basename) {
                        modal.close();
                        void this.renameRemoteItem(file, newName);
                    } else {
                        modal.close();
                    }
                    resolve();
                } else if (evt.key === 'Escape') {
                    modal.close();
                    resolve();
                }
            });
            
            modal.open();
        });
    }

    /**
     * 重命名远程文件或文件夹
     */
    private async renameRemoteItem(file: FileStat, newName: string): Promise<void> {
        try {
            const success = await this.explorerService.renameRemoteItem(file, newName);
            if (success) {
                this.showNotice('重命名成功', false);
                // 刷新当前目录
                await this.explorerService.listDirectory(this.explorerService.getCurrentRemotePath());
            } else {
                this.showNotice('重命名失败', true);
            }
        } catch (error) {
            this.showNotice('重命名失败: ' + (error as Error).message, true);
        }
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
        try {
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

            // 优化：如果同时包含文件夹及其子文件，只上传文件夹
            const optimizedItems: TAbstractFile[] = [];
            const folderPaths = new Set<string>();

            // 首先收集所有文件夹路径
            for (const item of items) {
                if (item instanceof TFolder) {
                    folderPaths.add(item.path);
                }
            }

            // 然后添加文件和文件夹，确保文件不在任何选中的文件夹中
            for (const item of items) {
                if (item instanceof TFolder) {
                    optimizedItems.push(item);
                } else if (item instanceof TFile) {
                    // 检查文件是否在任何选中的文件夹中
                    const isInSelectedFolder = Array.from(folderPaths).some(folderPath =>
                        item.path.startsWith(folderPath + '/')
                    );
                    if (!isInSelectedFolder) {
                        optimizedItems.push(item);
                    }
                }
            }


            // 检查是否有任何文件存在冲突
            let hasConflict = false;
            const currentPath = this.explorerService.getCurrentRemotePath();

            for (const item of optimizedItems) {
                const remotePath = `${currentPath}/${item.name}`;
                const exists = await this.explorerService.checkRemotePathExists(remotePath);
                if (exists) {
                    hasConflict = true;
                    break;
                }
            }

            if (hasConflict) {
                // 找到第一个冲突的文件
                let firstConflictItem = optimizedItems[0];
                for (const item of optimizedItems) {
                    const remotePath = `${currentPath}/${item.name}`;
                    const exists = await this.explorerService.checkRemotePathExists(remotePath);
                    if (exists) {
                        firstConflictItem = item;
                        break;
                    }
                }

                const choice = await this.showUploadConflictModal(firstConflictItem.name);
                if (choice === 'cancel') return;
                await this.explorerService.uploadItems(optimizedItems, choice);
            } else {
                // 没有冲突，直接上传
                await this.explorerService.uploadItems(optimizedItems, 'overwrite');
            }
        } catch (error) {
            console.error('Error in handleUploadWithConflictCheck:', error);
            this.showNotice('Upload failed: ' + (error as Error).message, true);
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