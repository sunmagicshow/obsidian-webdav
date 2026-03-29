import {FileStat} from 'webdav';
import {WebDAVServer} from './types';
import {WebDAVClient} from './WebDAVClient';
import {WebDAVFileService} from './WebDAVFileService';
import {i18n} from "./i18n";
import {SecretStorage, TAbstractFile, TFile, TFolder, Notice} from 'obsidian';

// 配置常量
const CONFIG = {
    maxRetries: 3,
    retryDelay: 1000,
    requestTimeout: 3000
} as const;

export class WebDAVExplorerService {
    private client: WebDAVClient | null = null;

    // 状态
    private currentPath: string = '/';
    private rootPath: string = '/';
    private currentServer: WebDAVServer | null = null;
    private sortField: 'name' | 'type' | 'size' | 'date' = 'name';
    private sortOrder: 'asc' | 'desc' = 'asc';

    constructor(
        private fileService: WebDAVFileService,
        private onFileListUpdate: (files: FileStat[], hasParent: boolean) => void,
        private onPathUpdate: (path: string) => void,
        private onNotice: (message: string, isError?: boolean) => void,
        private secretStorage: SecretStorage,
    ) {
    }


    // ==================== 服务器和连接管理 ====================

    public setCurrentServer(server: WebDAVServer | null): void {
        this.currentServer = server;
        this.client = null;
        this.currentPath = '/';
        this.rootPath = '/';
    }

    public async initializeClient(): Promise<boolean> {
        if (!this.currentServer) return false;

        const {url, username, secretId} = this.currentServer;
        if (!url || !username || !secretId) return false;
        try {
            // 创建客户端实例时传入 secretStorage
            this.client = new WebDAVClient(this.currentServer, this.secretStorage);
            return await this.client.initialize();
        } catch {
            this.client = null;
            return false;
        }
    }

    // ==================== 文件操作核心方法 ====================

    public async listDirectory(path: string, retryCount: number = 0): Promise<void> {
        if (!this.currentServer) {
            this.onNotice(i18n.t.view.selectServer, true);
            return;
        }

        if (!this.client && !(await this.initializeClient())) {
            this.onNotice(i18n.t.view.connectionFailed, true);
            return;
        }

        // 更新路径状态
        this.updatePathState(path);
        this.onPathUpdate(this.currentPath);

        try {
            const files = await this.withTimeout(
                this.client!.getDirectoryContents(this.currentPath),
                CONFIG.requestTimeout
            );

            const hasParent = this.currentPath !== this.rootPath;
            this.onFileListUpdate(files, hasParent);

        } catch {
            await this.handleListDirectoryError(path, retryCount);  // 提取错误处理
        }
    }

    public async downloadRemoteItem(file: FileStat, mode: 'new' | 'overwrite' | 'rename'): Promise<void> {
        if (!this.client || !this.currentServer) {
            this.onNotice(i18n.t.contextMenu.connectionError, true);
            return;
        }
        try {
            await this.fileService.downloadRemoteItem(file, this.currentServer, this.client, mode);
        } catch {
            this.onNotice(i18n.t.contextMenu.downloadFailed, true);
        }
    }

    public async copyFileUrl(file: FileStat): Promise<void> {
        try {
            if (!this.currentServer) return;
            const fileUrl = this.getFileFullUrl(file.filename);
            await navigator.clipboard.writeText(fileUrl);
            this.onNotice(i18n.t.contextMenu.urlCopied, false);
        } catch {
            this.onNotice(i18n.t.contextMenu.copyFailed, true);
        }
    }

    public async deleteRemoteItem(file: FileStat): Promise<boolean> {
        if (!this.client || !this.currentServer) {
            this.onNotice(i18n.t.contextMenu.connectionError, true);
            return false;
        }
        try {
            await this.client.deleteFile(file.filename);
            await this.listDirectory(this.currentPath);
            return true;
        } catch {
            this.onNotice(i18n.t.contextMenu.deleteFailed, true);
            return false;
        }
    }

    public openFileWithWeb(remotePath: string): void {
        if (!this.currentServer) return;

        try {
            const finalUrl = this.getFileFullUrl(remotePath);
            window.open(finalUrl, '_blank');
            this.onNotice(i18n.t.view.opening, false);
        } catch {
            this.onNotice(i18n.t.view.openFailed, true);
        }
    }

    public getCurrentPath(): string {
        return this.currentPath;
    }

    public getParentPath(): string {
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

        return parentPath;
    }

    // ==================== 路径和导航方法 ====================

    public getBreadcrumbParts(): { name: string; path: string; isCurrent: boolean }[] {
        const parts = [];
        const rootPath = this.rootPath;
        let currentFullPath = this.currentPath;

        // 标准化路径
        if (!currentFullPath.startsWith(rootPath)) {
            currentFullPath = rootPath + (rootPath.endsWith('/') ? '' : '/') + this.currentPath.replace(/^\//, '');
        }
        currentFullPath = currentFullPath.replace(/\/+/g, '/');
        const relativePath = currentFullPath === rootPath ? '' : currentFullPath.substring(rootPath.length);

        // 添加根目录
        parts.push({name: 'root', path: rootPath, isCurrent: relativePath === ''});

        // 添加路径部分
        if (relativePath) {
            const pathParts = relativePath.split('/').filter(p => p);
            let currentPath = rootPath;

            pathParts.forEach((part, index) => {
                currentPath = currentPath === '/' ? `/${part}` : `${currentPath}/${part}`;
                parts.push({
                    name: part,
                    path: currentPath,
                    isCurrent: index === pathParts.length - 1
                });
            });
        }

        return parts;
    }

    public setSort(field: 'name' | 'type' | 'size' | 'date', order: 'asc' | 'desc'): void {
        this.sortField = field;
        this.sortOrder = order;
    }

    public getSortState(): { field: 'name' | 'type' | 'size' | 'date'; order: 'asc' | 'desc' } {
        return {field: this.sortField, order: this.sortOrder};
    }

    // ==================== 排序方法 ====================

    public sortFiles(files: FileStat[]): FileStat[] {
        return files.sort((a, b) => {
            // 目录优先
            if (a.type === 'directory' && b.type !== 'directory') {
                return this.sortOrder === 'asc' ? -1 : 1;
            } else if (a.type !== 'directory' && b.type === 'directory') {
                return this.sortOrder === 'asc' ? 1 : -1;
            }

            let compareResult = 0;

            switch (this.sortField) {
                case 'name':
                    compareResult = a.basename.toLowerCase().localeCompare(b.basename.toLowerCase());
                    break;
                case 'type':
                    compareResult = this.compareByType(a, b);
                    break;
                case 'size':
                    compareResult = (Number(a.size) || 0) - (Number(b.size) || 0);
                    break;
                case 'date':
                    compareResult = this.parseLastModDate(b.lastmod) - this.parseLastModDate(a.lastmod);
                    break;
            }

            return this.sortOrder === 'desc' ? -compareResult : compareResult;
        });
    }

    public getFileFullUrl(remotePath: string): string {
        if (!this.currentServer) return '';
        const baseUrl = this.currentServer.url.replace(/\/$/, '');

        let normalizedPath = remotePath;
        if (!normalizedPath.startsWith('/')) {
            normalizedPath = '/' + normalizedPath;
        }

        const pathToEncode = normalizedPath.substring(1);
        let encodedPath = '/' + encodeURIComponent(pathToEncode)
            .replace(/%2F/g, '/')
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29');

        return `${baseUrl}${encodedPath}`;
    }

    public applyUrlPrefix(originalUrl: string): string {
        if (!this.currentServer?.urlPrefix?.trim()) return originalUrl;

        const serverUrl = this.currentServer.url.replace(/\/$/, '');
        const urlPrefix = this.currentServer.urlPrefix.trim();
        return originalUrl.replace(serverUrl, urlPrefix);
    }

    // ==================== 工具方法 ====================

    public getRootPath(): string {
        if (!this.currentServer) return '/';
        const raw = this.currentServer.remoteDir.trim();
        return raw === '' || raw === '/' ? '/' : '/' + raw.replace(/^\/+/, '').replace(/\/+$/, '');
    }

    private async handleListDirectoryError(path: string, retryCount: number): Promise<void> {
        if (retryCount < CONFIG.maxRetries) {  // 使用常量
            await this.delay(CONFIG.retryDelay);  // 使用常量
            await this.listDirectory(path, retryCount + 1);
        } else {
            this.onNotice(i18n.t.view.connectionFailed, true);
            this.onFileListUpdate([], false);
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => window.setTimeout(resolve, ms));
    }

    // ==================== 私有方法 ====================

    private updatePathState(path: string): void {
        const rootPath = this.getRootPath();
        let normalizedPath = this.fileService.normalizePath(path, rootPath);

        this.rootPath = rootPath;
        this.currentPath = normalizedPath;
    }

    private compareByType(a: FileStat, b: FileStat): number {
        const extA = this.getFileExtension(a.basename).toLowerCase();
        const extB = this.getFileExtension(b.basename).toLowerCase();
        const compareResult = extA.localeCompare(extB);

        return compareResult === 0
            ? a.basename.toLowerCase().localeCompare(b.basename.toLowerCase())
            : compareResult;
    }

    private getFileExtension(filename: string): string {
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop() ! : '';
    }

    private parseLastModDate(lastmod: string): number {
        if (!lastmod) return 0;
        try {
            return new Date(lastmod).getTime() || 0;
        } catch {
            return 0;
        }
    }

    private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
        return new Promise((resolve, reject) => {
            const timeoutId = window.setTimeout(() => {
                reject(new Error(i18n.t.view.connectionFailed));
            }, timeoutMs);

            promise.then(
                (result) => {
                    window.clearTimeout(timeoutId);
                    resolve(result);
                },
                (err) => {
                    window.clearTimeout(timeoutId);
                    reject(err instanceof Error ? err : new Error(String(err)));
                }
            );
        });
    }

    // ==================== 上传相关方法 ====================

    /**
     * 检查WebDAV写入权限
     */
    async checkWritePermission(): Promise<boolean> {
        if (!this.client) {
            return false;
        }
        return await this.client.checkWritePermission(this.currentPath);
    }

    /**
     * 上传本地文件/文件夹到当前WebDAV目录
     */
    async uploadItems(
        items: TAbstractFile[],
        mode: 'overwrite' | 'rename'
    ): Promise<void> {
        if (!this.client || !this.currentServer) {
            this.onNotice(i18n.t.contextMenu.connectionError, true);
            return;
        }

        // 检查写入权限
        const hasPermission = await this.checkWritePermission();
        if (!hasPermission) {
            new Notice(`❌ ${i18n.t.contextMenu.noWritePermission}`, 5000);
            return;
        }

        const currentPath = this.currentPath;
        let successCount = 0;
        let failCount = 0;

        for (const item of items) {
            try {
                if (item instanceof TFile) {
                    const uploadingNotice = new Notice(`⬆️ ${i18n.t.contextMenu.uploading}: ${item.name}`, 0);
                    try {
                        const remotePath = `${currentPath}/${item.name}`;
                        await this.fileService.uploadFile(item, remotePath, this.client, mode);
                        successCount++;
                    } finally {
                        uploadingNotice.hide();
                    }
                } else if (item instanceof TFolder) {
                    const uploadingNotice = new Notice(`⬆️ ${i18n.t.contextMenu.uploading}: ${item.name}/...`, 0);
                    try {
                        await this.fileService.uploadFolder(item, currentPath, this.client, mode);
                        successCount++;
                    } finally {
                        uploadingNotice.hide();
                    }
                }
            } catch {
                this.onNotice(`${i18n.t.contextMenu.uploadFailed}: ${item.name}`, true);
                failCount++;
            }
        }

        // 显示上传完成通知
        if (successCount > 0) {
            this.onNotice(`${i18n.t.contextMenu.uploadSuccess}: ${successCount} 个成功${failCount > 0 ? `, ${failCount} 个失败` : ''}`, false);
        }

        // 刷新当前目录
        await this.listDirectory(currentPath);
    }

    /**
     * 检查远程路径是否存在
     */
    async checkRemotePathExists(remotePath: string): Promise<boolean> {
        if (!this.client) {
            return false;
        }
        return await this.fileService.checkRemotePathExists(remotePath, this.client);
    }

    /**
     * 获取当前路径
     */
    getCurrentRemotePath(): string {
        return this.currentPath;
    }
}