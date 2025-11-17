import {WorkspaceLeaf, View, Notice, Menu, MarkdownView, setIcon} from 'obsidian';
import {FileStat} from 'webdav';
import WebDAVPlugin from './main';
import {WebDAVServer, VIEW_TYPE_WEBDAV_EXPLORER, AppWithSettings} from './types';
import {WebDAVClient} from './WebDAVClient';
import {WebDAVFileService} from './WebDAVFileService';

export class WebDAVExplorerView extends View {
    plugin: WebDAVPlugin;
    client: WebDAVClient | null = null;
    fileService: WebDAVFileService;

    // 状态属性
    private currentPath: string = '/';
    private rootPath: string = '/';
    private currentServer: WebDAVServer | null = null;
    private selectedItem: HTMLElement | null = null;
    private sortField: 'name' | 'type' | 'size' | 'date' = 'name';
    private sortOrder: 'asc' | 'desc' = 'asc';

    // DOM 元素引用
    private serverSelector: HTMLElement | null = null;
    private sortButton: HTMLElement | null = null;
    private sortIconEl: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: WebDAVPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.fileService = new WebDAVFileService(this.app); // 修复：使用 this.app

        // 防抖刷新 - 修复：正确声明 refresh 方法
        this.refresh = this.fileService.debounce(this.executeRefresh.bind(this), 300);
    }

    private get t() {
        return this.plugin.i18n();
    }

    // 修复：声明 refresh 方法
    refresh: () => void = () => {
    };

    getViewType(): string {
        return VIEW_TYPE_WEBDAV_EXPLORER;
    }

    getDisplayText(): string {
        return this.plugin.i18n().displayName;
    }

    getIcon(): string {
        return 'cloud';
    }

    async onOpen() {
        this.containerEl.empty();
        this.containerEl.addClass('webdav-explorer-view'); // 修复：分开调用
        this.currentServer = this.plugin.getCurrentServer();

        if (!this.currentServer) {
            this.showNoServerConfigured();
            return;
        }

        this.buildHeader();
        await this.connectAndList();
    }

    // ==================== 主要方法 ====================

    async onunload() {
        this.client = null;
        this.selectedItem = null;
        this.currentServer = null;

        if (this.containerEl) {
            this.containerEl.empty();
        }
    }

    private buildHeader(): void {
        const headerEl = this.containerEl.createEl('div', {cls: 'webdav-header'});
        const titleRow = headerEl.createEl('div', {cls: 'webdav-title-row'});
        const actionsContainer = titleRow.createEl('div', {cls: 'webdav-actions-container'});

        // 服务器选择器
        this.serverSelector = actionsContainer.createEl('div', {cls: 'webdav-button'});
        const serverContent = this.serverSelector.createEl('div', {cls: 'webdav-button-content'});
        const serverIconEl = serverContent.createSpan({cls: 'webdav-server-icon'});
        setIcon(serverIconEl, 'server');
        this.serverSelector.setAttribute('aria-label', this.t.view.selectServer);
        this.serverSelector.onclick = (evt) => this.showServerMenu(evt);

        // 刷新按钮
        const refreshButton = actionsContainer.createEl('div', {cls: 'webdav-button'});
        const refreshContent = refreshButton.createEl('div', {cls: 'webdav-button-content'});
        const refreshIcon = refreshContent.createSpan({cls: 'webdav-refresh-icon'});
        setIcon(refreshIcon, 'refresh-cw');
        refreshButton.setAttribute('aria-label', this.t.view.refresh);
        refreshButton.onclick = () => this.refresh();

        // 排序按钮
        this.sortButton = actionsContainer.createEl('div', {cls: 'webdav-button'});
        const sortContent = this.sortButton.createEl('div', {cls: 'webdav-button-content'});
        this.sortIconEl = sortContent.createSpan({cls: 'webdav-sort-icon'});
        this.updateSortIcon();
        this.sortButton.setAttribute('aria-label', this.t.view.sort);
        this.sortButton.onclick = (evt) => this.showSortMenu(evt);

        // 面包屑容器
        headerEl.createEl('div', {cls: 'webdav-breadcrumb-container'});

        // 文件列表容器
        this.containerEl.createEl('div', {cls: 'file-list-container'});
    }

    private async connectAndList(): Promise<boolean> {
        if (!this.currentServer) {
            this.showNoServerConfigured();
            return false;
        }

        const {url, username, password} = this.currentServer;

        if (!url || !username || !password) {
            this.showNoServerConfigured();
            return false;
        }

        try {
            if (this.containerEl.querySelector('.webdav-connection-failed')) {
                this.buildHeader();
            }

            const success = await this.initializeClient();
            if (!success) {
                // 初始化失败，显示连接失败界面
                this.showConnectionFailed();
                this.showNotice(this.t.view.connectionFailed, true);
                return false;
            }

            await this.listDirectory(this.currentPath);
            return true;
        } catch {
            this.showConnectionFailed();
            this.showNotice(this.t.view.connectionFailed, true);
            return false;
        }
    }

    // ==================== 文件操作 ====================

    private async listDirectory(path: string, retryCount: number = 0): Promise<void> {
        if (!this.currentServer) return;

        const maxRetries = 3;
        const retryDelay = 1000;

        if (!this.client) {
            const success = await this.initializeClient();
            if (!success) {
                this.showError(this.t.view.connectionFailed);
                return;
            }
        }

        const rootPath = this.getRootPath();
        let normalizedPath = this.fileService.normalizePath(path, rootPath);
        this.rootPath = rootPath;
        this.currentPath = normalizedPath;

        this.createBreadcrumb(normalizedPath);

        const container = this.containerEl;
        const oldList = container.querySelector('.file-list-container');
        if (oldList) oldList.remove();

        this.selectedItem = null;

        const listContainer = container.createEl('div', {cls: 'file-list-container'});
        const fileList = listContainer.createEl('div', {cls: 'file-list'});

        // 只在第一次尝试时显示加载中，重试时不重复显示
        let loadingEl: HTMLElement | null = null;
        if (retryCount === 0) {
            loadingEl = fileList.createEl('div', {cls: 'file-item loading'});
            const loadingIcon = loadingEl.createSpan({cls: 'loading-icon'});
            setIcon(loadingIcon, 'loader-2');
            loadingEl.createSpan({text: this.t.view.loading});
        }
        try {
            if (!this.client) {
                this.showError(this.t.view.connectionFailed);
                return;
            }

            const files = await this.withTimeout(
                this.client.getDirectoryContents(this.currentPath),
                3000
            );

            if (loadingEl) {
                loadingEl.remove();
            }

            if (this.currentPath !== this.rootPath) {
                this.createUpDirectoryItem(fileList);
            }

            if (files.length === 0 && this.currentPath === this.rootPath) {
                fileList.createEl('div', {
                    cls: 'file-item empty',
                    text: '📂 ' + this.t.view.emptyDir
                });
            } else {
                this.renderFileList(fileList, files);
            }

        } catch {
            if (loadingEl) {
                loadingEl.remove();
            }

            if (retryCount < maxRetries) {
                // 重试时不显示新的加载提示，保持当前状态
                setTimeout(() => {
                    void this.listDirectory(path, retryCount + 1);
                }, retryDelay);
            } else {
                this.showNotice(this.t.view.listFailed, true);
                fileList.createEl('div', {
                    cls: 'file-item error',
                    text: `⛔ ${this.t.view.error}`
                });
            }
        }
    }

    private renderFileList(fileList: HTMLElement, files: FileStat[]): void {
        const sortedFiles = this.sortFiles(files);

        for (const file of sortedFiles) {
            const item = fileList.createEl('div', {cls: 'file-item'});
            const iconSpan = item.createSpan({cls: 'file-icon'});
            item.createSpan({cls: 'file-name', text: file.basename});

            if (file.type === 'directory') {
                iconSpan.textContent = '📁';
                item.addClass('folder');
                item.onclick = async () => {
                    this.selectItem(item);
                    await this.listDirectory(file.filename);
                };
            } else {
                iconSpan.textContent = this.fileService.getFileIcon(file.basename);
                item.addClass('file');
                item.onclick = () => this.selectItem(item);
                item.ondblclick = () => this.openFileWithWeb(file.filename);
                item.oncontextmenu = (evt) => this.showFileContextMenu(evt, file);

                item.setAttr('draggable', 'true');
                item.ondragstart = (event) => this.handleFileDragStart(event, file);
            }

            item.addClass('is-clickable');
        }
    }

    private openFileWithWeb(remotePath: string): void {
        if (!this.currentServer) return;

        try {
            const finalUrl = this.getFileFullUrl(remotePath);
            const {username, password} = this.currentServer;
            const authUrl = finalUrl.replace(/^https?:\/\//, `http://${username}:${password}@`);

            window.open(authUrl, '_blank');
            this.showNotice(this.t.view.opening, false);
        } catch {
            this.showNotice(this.t.view.openFailed, true);
        }
    }

    private async downloadFile(file: FileStat): Promise<void> {
        if (!this.client || !this.currentServer) {
            this.showNotice(this.t.contextMenu.connectionError, true);
            return;
        }

        try {
            await this.fileService.downloadFile(file, this.currentServer, this.client);
            this.showNotice(`${this.t.contextMenu.downloadSuccess}: ${file.basename}`, false);
        } catch {
            this.showNotice(this.t.contextMenu.downloadFailed, true);
        }
    }

    // ==================== 辅助方法 ====================

    private async copyFileUrl(file: FileStat): Promise<void> {
        try {
            if (!this.currentServer) return;
            const fileUrl = this.getFileFullUrl(file.filename);
            await navigator.clipboard.writeText(fileUrl);
            this.showNotice(this.t.contextMenu.urlCopied, false);
        } catch {
            this.showNotice(this.t.contextMenu.copyFailed, true);
        }
    }

    private getRootPath(): string {
        if (!this.currentServer) return '/';
        const raw = this.currentServer.remoteDir.trim();
        return raw === '' || raw === '/' ? '/' : '/' + raw.replace(/^\/+/, '').replace(/\/+$/, '');
    }

    private getFileFullUrl(remotePath: string): string {
        if (!this.currentServer) return '';
        const baseUrl = this.currentServer.url.replace(/\/$/, '');

        // 确保路径以斜杠开头
        let normalizedPath = remotePath;
        if (!normalizedPath.startsWith('/')) {
            normalizedPath = '/' + normalizedPath;
        }

        // 使用 encodeURIComponent 但额外编码括号
        const pathToEncode = normalizedPath.substring(1);
        let encodedPath = '/' + encodeURIComponent(pathToEncode)
            .replace(/%2F/g, '/')  // 恢复斜杠
            .replace(/\(/g, '%28') // 编码左括号
            .replace(/\)/g, '%29'); // 编码右括号

        return `${baseUrl}${encodedPath}`;
    }

    private createBreadcrumb(path: string): void {
        const breadcrumbContainer = this.containerEl.querySelector('.webdav-breadcrumb-container');
        if (!breadcrumbContainer) return;

        breadcrumbContainer.empty();
        const breadcrumbEl = breadcrumbContainer.createEl('div', {cls: 'webdav-breadcrumb'});

        const rootPath = this.rootPath;
        let currentFullPath = path;

        if (!currentFullPath.startsWith(rootPath)) {
            currentFullPath = rootPath + (rootPath.endsWith('/') ? '' : '/') + path.replace(/^\//, '');
        }

        currentFullPath = currentFullPath.replace(/\/+/g, '/');
        const relativePath = currentFullPath === rootPath ? '' : currentFullPath.substring(rootPath.length);

        // 根目录
        const rootItem = breadcrumbEl.createEl('span', {cls: 'breadcrumb-item breadcrumb-root'});
        const rootLink = rootItem.createEl('a', {cls: 'breadcrumb-root-link'});
        setIcon(rootLink, 'home');
        rootLink.title = this.t.view.rootDirectory;
        rootLink.onclick = async () => await this.listDirectory(rootPath);

        // 路径部分
        if (relativePath) {
            const separator = breadcrumbEl.createEl('span', {cls: 'breadcrumb-separator'});
            setIcon(separator, 'chevron-right');

            const parts = relativePath.split('/').filter(p => p);
            let currentPath = rootPath;

            for (let i = 0; i < parts.length; i++) {
                if (i > 0) {
                    const sep = breadcrumbEl.createEl('span', {cls: 'breadcrumb-separator'});
                    setIcon(sep, 'chevron-right');
                }

                const part = parts[i];
                currentPath = currentPath === '/' ? `/${part}` : `${currentPath}/${part}`;

                const item = breadcrumbEl.createEl('span', {cls: 'breadcrumb-item'});
                const link = item.createEl('a', {text: part});

                if (i === parts.length - 1) {
                    link.addClass('breadcrumb-current');
                } else {
                    const targetPath = currentPath;
                    link.onclick = async () => await this.listDirectory(targetPath);
                }
            }
        }
    }

    private createUpDirectoryItem(fileList: HTMLElement): void {
        const upItem = fileList.createEl('div', {
            cls: 'file-item folder',
            text: '📁 ..'
        });

        upItem.onclick = async () => {
            let parentPath = this.currentPath;
            if (parentPath.endsWith('/') && parentPath !== '/') {
                parentPath = parentPath.slice(0, -1);
            }

            const lastSlashIndex = parentPath.lastIndexOf('/');
            if (lastSlashIndex > 0) {
                parentPath = parentPath.substring(0, lastSlashIndex);
            } else {
                parentPath = '/';
            }

            if (parentPath === '') parentPath = '/';
            if (!parentPath.startsWith(this.rootPath)) parentPath = this.rootPath;

            await this.listDirectory(parentPath);
        };
    }

    private handleFileDragStart(event: DragEvent, file: FileStat): void {
        const target = event.currentTarget as HTMLElement;
        this.selectItem(target);

        const originalUrl = this.getFileFullUrl(file.filename);
        let finalUrl = originalUrl;

        if (this.currentServer?.urlPrefix && this.currentServer.urlPrefix.trim() !== '') {
            const serverUrl = this.currentServer.url.replace(/\/$/, '');
            const urlPrefix = this.currentServer.urlPrefix.trim();
            finalUrl = originalUrl.replace(serverUrl, urlPrefix);
        }

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
    }

    // ==================== 菜单相关 ====================

    private showFileContextMenu(event: MouseEvent, file: FileStat): void {
        event.preventDefault();
        const menu = new Menu();

        menu.addItem(item => {
            item.setTitle(this.t.contextMenu.copyUrl)
                .setIcon('link')
                .onClick(() => this.copyFileUrl(file));
        });

        menu.addItem(item => {
            item.setTitle(this.t.contextMenu.download)
                .setIcon('download')
                .onClick(() => this.downloadFile(file));
        });

        menu.showAtMouseEvent(event);
    }

    private showServerMenu(evt: MouseEvent): void {
        const servers = this.plugin.getServers();
        if (servers.length === 0) {
            new Notice(this.t.settings.serverListEmpty);
            return;
        }

        const menu = new Menu();
        servers.forEach(server => {
            menu.addItem(item => {
                const isSelected = server.id === this.currentServer?.id;
                const icon = isSelected ? 'check' : '';
                const space = '\u2009\u2009\u2009\u2009\u2009\u2009';
                const title = isSelected ? server.name : `${space}${server.name}`;

                item.setTitle(title)
                    .setIcon(icon)
                    .onClick(async () => await this.switchServer(server.id));
            });
        });

        menu.showAtMouseEvent(evt);
    }

    private showSortMenu(evt: MouseEvent): void {
        const menu = new Menu();
        const space = '\u2009\u2009\u2009\u2009\u2009\u2009';

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

        sortOptions.forEach(({field, order, title}) => {
            menu.addItem(item => {
                const isSelected = this.sortField === field && this.sortOrder === order;
                const displayTitle = isSelected ? title : `${space}${title}`;

                item.setTitle(displayTitle)
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

    // ==================== 状态管理 ====================

    private async switchServer(serverId: string): Promise<void> {
        this.currentServer = this.plugin.getServerById(serverId);
        if (this.currentServer) {
            this.plugin.settings.currentServerId = serverId;
            await this.plugin.saveSettings();

            this.client = null;
            this.currentPath = '/';
            this.rootPath = '/';
            this.selectedItem = null;

            // 完全清除容器内容并重新构建
            this.containerEl.empty();
            this.containerEl.addClass('webdav-explorer-view');
            this.buildHeader();

            const success = await this.connectAndList();

            if (success) {
                this.showNotice(this.t.view.switchSuccess, false);
            }
        }
    }

    private selectItem(item: HTMLElement): void {
        if (this.selectedItem) {
            this.selectedItem.removeClass('selected');
        }
        this.selectedItem = item;
        item.addClass('selected');
    }

    private updateSortIcon(): void {
        if (!this.sortIconEl) return;
        this.sortIconEl.empty();

        const iconName = this.sortOrder === 'asc' ? 'arrow-up-narrow-wide' : 'arrow-down-wide-narrow';
        setIcon(this.sortIconEl, iconName);

        if (this.sortButton) {
            this.sortButton.setAttribute('aria-label', `${this.t.view.sort}: ${this.sortField}, ${this.sortOrder}`);
        }
    }

    private refreshFileList(): void {
        if (this.currentPath) {
            this.listDirectory(this.currentPath).catch(() => {
                this.showNotice(this.t.view.refreshFailed, true);
            });
        }
    }

    private async executeRefresh(): Promise<void> {
        try {
            if (!this.currentServer) {
                this.showNoServerConfigured();
                return;
            }

            const success = await this.initializeClient();
            if (!success) {
                this.showConnectionFailed();
                this.showNotice(this.t.view.connectionFailed, true);
                return;
            }

            if (this.containerEl.querySelector('.webdav-connection-failed')) {
                this.buildHeader();
            }

            await this.listDirectory(this.currentPath);
            this.showNotice(this.t.view.refreshSuccess, false);
        } catch {
            this.showNotice(this.t.view.connectionFailed, true);
            this.showConnectionFailed();
        }
    }

    // ==================== 工具方法 ====================

    private async initializeClient(): Promise<boolean> {
        if (!this.currentServer) return false;

        const {url, username, password} = this.currentServer;
        if (!url || !username || !password) return false;

        try {
            this.client = new WebDAVClient(this.currentServer);
            const success = await this.client.initialize();

            if (success) {
                const testPath = this.getRootPath();
                await this.client.getDirectoryContents(testPath);
                return true;
            }
            return false;
        } catch (error) {
            this.client = null;
            return false;
        }
    }

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
                    reject(err instanceof Error ? err : new Error(String(err)));
                }
            );
        });
    }

    private sortFiles(files: FileStat[]): FileStat[] {
        return files.sort((a, b) => {
            if (a.type === 'directory' && b.type !== 'directory') {
                return this.sortOrder === 'asc' ? -1 : 1;
            } else if (a.type !== 'directory' && b.type === 'directory') {
                return this.sortOrder === 'asc' ? 1 : -1;
            }

            let compareResult = 0;

            if (this.sortField === 'name') {
                const nameA = a.basename.toLowerCase();
                const nameB = b.basename.toLowerCase();
                compareResult = nameA.localeCompare(nameB);
            } else if (this.sortField === 'type') {
                const extA = this.getFileExtension(a.basename).toLowerCase();
                const extB = this.getFileExtension(b.basename).toLowerCase();
                compareResult = extA.localeCompare(extB);

                if (compareResult === 0) {
                    const nameA = a.basename.toLowerCase();
                    const nameB = b.basename.toLowerCase();
                    compareResult = nameA.localeCompare(nameB);
                }
            } else if (this.sortField === 'size') {
                const sizeA = Number(a.size) || 0;
                const sizeB = Number(b.size) || 0;
                compareResult = sizeA - sizeB;
            } else if (this.sortField === 'date') {
                const dateA = this.parseLastModDate(a.lastmod);
                const dateB = this.parseLastModDate(b.lastmod);
                compareResult = dateB - dateA;
            }

            return this.sortOrder === 'desc' ? -compareResult : compareResult;
        });
    }

    private getFileExtension(filename: string): string {
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop() || '' : '';
    }

    private parseLastModDate(lastmod: string): number {
        if (!lastmod) return 0;
        try {
            const date = new Date(lastmod);
            const timestamp = date.getTime();
            return isNaN(timestamp) ? 0 : timestamp;
        } catch {
            return 0;
        }
    }

    // ==================== UI 反馈 ====================

    private showNotice(message: string, isError: boolean = true): void {
        const prefix = isError ? '❌' : '✅';
        new Notice(`${prefix} ${message}`, isError ? 3000 : 1000);
    }

    private showConnectionFailed(): void {
        if (!this.containerEl.querySelector('.webdav-header')) {
            this.buildHeader();
        }

        const oldList = this.containerEl.querySelector('.file-list-container');
        const oldError = this.containerEl.querySelector('.webdav-connection-failed');
        if (oldList) oldList.remove();
        if (oldError) oldError.remove();

        const messageEl = this.containerEl.createEl('div', {cls: 'webdav-connection-failed'});
        const errorIcon = messageEl.createEl('div');
        setIcon(errorIcon, 'cloud-off');
        messageEl.createEl('p', {text: this.t.view.connectionFailed});

        if (this.currentPath) {
            this.createBreadcrumb(this.currentPath);
        }
    }

    private showNoServerConfigured(): void {
        this.containerEl.empty();
        const messageEl = this.containerEl.createEl('div', {cls: 'webdav-no-server'});
        messageEl.createEl('p', {text: this.t.view.pleaseConfigure});

        const configureButton = messageEl.createEl('button', {
            text: this.t.settings.title,
            cls: 'mod-cta'
        });

        configureButton.onclick = () => {
            (this.app as AppWithSettings).setting.open();
            (this.app as AppWithSettings).setting.openTabById('webdav-explorer');
        };
    }

    private showError(message: string): void {
        const container = this.containerEl;
        const listContainer = container.createEl('div', {cls: 'file-list-container'});
        const fileList = listContainer.createEl('div', {cls: 'file-list'});
        fileList.createEl('div', {text: `⛔ ${message}`});
    }
}