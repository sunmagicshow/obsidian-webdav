import {App, Notice, TAbstractFile, TFile, TFolder} from 'obsidian';
import {FileStat} from 'webdav';
import {WebDAVServer} from './types';
import {WebDAVClient} from './WebDAVClient';
import {i18n} from "./i18n";
import {SUPPORTED_TEXT_EXTS, SUPPORTED_BINARY_EXTS, ICON_MAP} from './constants';

/**
 * WebDAV 文件服务类
 * 负责处理 WebDAV 服务器的文件下载、路径标准化等操作
 */
export class WebDAVFileService {
    constructor(private app: App) {
    }

    /**
     * 计算下载目标根路径（相对仓库根的路径），并检测是否与已有文件或文件夹重名
     */
    async planDownload(file: FileStat, server: WebDAVServer): Promise<{ conflict: boolean; targetPath: string }> {
        const downloadDir = await this.getDownloadDirectory(server);
        const targetPath = downloadDir === '' ? file.basename : `${downloadDir}/${file.basename}`;
        const conflict = await this.app.vault.adapter.exists(targetPath);
        return {conflict, targetPath};
    }

    /**
     * 下载远程文件或文件夹到本地仓库
     */
    async downloadRemoteItem(
        file: FileStat,
        server: WebDAVServer,
        client: WebDAVClient,
        mode: 'new' | 'overwrite' | 'rename'
    ): Promise<void> {
        const downloadDir = await this.getDownloadDirectory(server);
        let rootPath = downloadDir === '' ? file.basename : `${downloadDir}/${file.basename}`;

        if (mode === 'overwrite') {
            await this.deleteVaultIfExists(rootPath);
        } else if (mode === 'rename') {
            rootPath = this.applyTimestampSuffix(rootPath);
        }

        if (file.type === 'directory') {
            let folderNotice: Notice | null = null;
            try {
                folderNotice = new Notice(`⬇️ ${i18n.t.contextMenu.downloadingFolder}`);
                await this.downloadDirectoryRecursive(file.filename, rootPath, client);
                new Notice(`✅ ${i18n.t.contextMenu.downloadSuccess}`);
            } finally {
                folderNotice?.hide();
            }
        } else {
            await this.downloadSingleFileContents(file, client, rootPath, false);
        }
    }

    private async downloadSingleFileContents(
        file: FileStat,
        client: WebDAVClient,
        vaultPath: string,
        quiet: boolean
    ): Promise<void> {
        const ext = file.basename.split('.').pop()?.toLowerCase() || '';
        const isText = SUPPORTED_TEXT_EXTS.has(ext);
        const isBinary = SUPPORTED_BINARY_EXTS.has(ext);
        const isObsidianSupported = isText || isBinary;

        let downloadingMessage: Notice | null = null;
        if (!quiet && isObsidianSupported) {
            downloadingMessage = new Notice(`⬇️${i18n.t.contextMenu.downloading}`);
        }

        try {
            if (isObsidianSupported) {
                const arrayBuffer = await client.getFileContents(file.filename);
                if (isText) {
                    const decoder = new TextDecoder('utf-8');
                    await this.app.vault.adapter.write(vaultPath, decoder.decode(arrayBuffer));
                } else {
                    await this.app.vault.adapter.writeBinary(vaultPath, arrayBuffer);
                }
                if (!quiet) {
                    new Notice(`✅ ${i18n.t.contextMenu.downloadSuccess}`);
                }
            } else {
                if (!quiet) {
                    new Notice(`ℹ️ ${i18n.t.contextMenu.notSupportFormat}`);
                }
                const arrayBuffer = await client.getFileContents(file.filename);
                const blob = new Blob([arrayBuffer], {type: 'application/octet-stream'});
                this.fallbackDownload(blob, file.basename);
            }
        } catch (e) {
            downloadingMessage?.hide();
            throw e;
        }
    }

    private async downloadDirectoryRecursive(
        remotePath: string,
        vaultFolderPath: string,
        client: WebDAVClient
    ): Promise<void> {
        if (!(await this.app.vault.adapter.exists(vaultFolderPath))) {
            await this.app.vault.createFolder(vaultFolderPath);
        }

        const items = await client.getDirectoryContents(remotePath);
        for (const item of items) {
            if (item.basename === '.' || item.basename === '..') continue;

            const childVaultPath = `${vaultFolderPath}/${item.basename}`;
            if (item.type === 'directory') {
                await this.downloadDirectoryRecursive(item.filename, childVaultPath, client);
            } else {
                await this.downloadSingleFileContents(item, client, childVaultPath, true);
            }
        }
    }

    private applyTimestampSuffix(filePath: string): string {
        const lastSlashIndex = filePath.lastIndexOf('/');
        const dir = lastSlashIndex !== -1 ? filePath.substring(0, lastSlashIndex + 1) : '';
        const filename = lastSlashIndex !== -1 ? filePath.substring(lastSlashIndex + 1) : filePath;

        const lastDotIndex = filename.lastIndexOf('.');
        const name = lastDotIndex === -1 ? filename : filename.substring(0, lastDotIndex);
        const ext = lastDotIndex === -1 ? '' : filename.substring(lastDotIndex);

        const timestamp = new Date().getTime();
        return `${dir}${name}_${timestamp}${ext}`;
    }

    private async deleteVaultIfExists(path: string): Promise<void> {
        const abstract = this.app.vault.getAbstractFileByPath(path);
        if (abstract) await this.deleteAbstractRecursive(abstract);
    }

    private async deleteAbstractRecursive(file: TAbstractFile): Promise<void> {
        if (file instanceof TFolder) {
            for (const child of [...file.children]) {
                await this.deleteAbstractRecursive(child);
            }
        }
        await this.app.fileManager.trashFile(file);
    }

    /**
     * 根据文件扩展名获取对应的 Obsidian 图标
     */
    getFileIcon(filename: string): string {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        return ICON_MAP[ext] || 'file';
    }

    normalizePath(path: string, rootPath: string = '/'): string {
        let normalizedPath = path;

        if (path === '' || path === '/' || path === rootPath) {
            normalizedPath = rootPath;
        } else {
            if (!path.startsWith(rootPath)) {
                normalizedPath = rootPath === '/' ? `/${path.replace(/^\//, '')}` : `${rootPath}/${path.replace(/^\//, '')}`;
            }
            normalizedPath = normalizedPath.replace(/\/+/g, '/');
        }

        if (normalizedPath !== '/' && normalizedPath.endsWith('/')) {
            normalizedPath = normalizedPath.slice(0, -1);
        }

        if (!normalizedPath.startsWith(rootPath)) {
            normalizedPath = rootPath;
        }

        return normalizedPath;
    }

    private async getDownloadDirectory(server: WebDAVServer): Promise<string> {
        if (server.downloadPath && server.downloadPath.trim() !== '') {
            let customPath = server.downloadPath.trim();
            customPath = this.normalizeDownloadPath(customPath);

            if (customPath === '/' || customPath === '') {
                return '';
            }

            const dirExists = await this.app.vault.adapter.exists(customPath);
            if (!dirExists) {
                await this.app.vault.createFolder(customPath);
            }

            return customPath;
        }
        return '';
    }

    private normalizeDownloadPath(path: string): string {
        if (!path || path.trim() === '') {
            return '';
        }

        let normalizedPath = path.trim();

        if (normalizedPath.startsWith('/')) {
            normalizedPath = normalizedPath.substring(1);
        }

        if (normalizedPath.endsWith('/')) {
            normalizedPath = normalizedPath.substring(0, normalizedPath.length - 1);
        }

        if (normalizedPath === '') {
            return '';
        }

        return normalizedPath;
    }

    private fallbackDownload(blob: Blob, filename: string): void {
        const doc = activeDocument;
        const url = URL.createObjectURL(blob);
        const a = doc.createElement('a');
        a.href = url;
        a.download = filename;
        doc.body.appendChild(a);
        a.click();
        doc.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ==================== 上传相关方法 ====================

    /**
     * 检查远程路径是否存在
     */
    async checkRemotePathExists(remotePath: string, client: WebDAVClient): Promise<boolean> {
        try {
            const parentPath = remotePath.substring(0, remotePath.lastIndexOf('/')) || '/';
            const items = await client.getDirectoryContents(parentPath);
            const fileName = remotePath.split('/').pop() || '';
            return items.some(item => item.basename === fileName);
        } catch {
            return false;
        }
    }

    /**
     * 上传单个文件到WebDAV
     */
    async uploadFile(
        file: TFile,
        remotePath: string,
        client: WebDAVClient,
        mode: 'overwrite' | 'rename'
    ): Promise<void> {
        let targetPath = remotePath;

        if (mode === 'rename') {
            targetPath = await this.getUniqueRemotePath(remotePath, client);
        }

        const content = await this.app.vault.readBinary(file);
        await client.uploadFile(targetPath, content);
    }

    /**
     * 上传文件夹到WebDAV
     */
    async uploadFolder(
        folder: TFolder,
        remoteParentPath: string,
        client: WebDAVClient,
        mode: 'overwrite' | 'rename'
    ): Promise<void> {
        let targetFolderPath = `${remoteParentPath}/${folder.name}`;

        if (mode === 'rename') {
            targetFolderPath = await this.getUniqueRemoteFolderPath(targetFolderPath, client);
        }

        // 创建远程文件夹
        try {
            await client.createDirectory(targetFolderPath);
        } catch {
            // 文件夹可能已存在，继续
        }

        // 递归上传文件夹内容
        for (const child of folder.children) {
            if (child instanceof TFile) {
                const remoteFilePath = `${targetFolderPath}/${child.name}`;
                await this.uploadFile(child, remoteFilePath, client, mode);
            } else if (child instanceof TFolder) {
                await this.uploadFolder(child, targetFolderPath, client, mode);
            }
        }
    }

    /**
     * 获取唯一的远程文件路径（添加时间戳后缀）
     */
    private async getUniqueRemotePath(remotePath: string, client: WebDAVClient): Promise<string> {
        if (!(await this.checkRemotePathExists(remotePath, client))) {
            return remotePath;
        }

        const lastSlashIndex = remotePath.lastIndexOf('/');
        const dir = lastSlashIndex !== -1 ? remotePath.substring(0, lastSlashIndex) : '';
        const filename = lastSlashIndex !== -1 ? remotePath.substring(lastSlashIndex + 1) : remotePath;

        const lastDotIndex = filename.lastIndexOf('.');
        const name = lastDotIndex === -1 ? filename : filename.substring(0, lastDotIndex);
        const ext = lastDotIndex === -1 ? '' : filename.substring(lastDotIndex);

        const timestamp = new Date().getTime();
        return `${dir}/${name}_${timestamp}${ext}`;
    }

    /**
     * 获取唯一的远程文件夹路径
     */
    private async getUniqueRemoteFolderPath(remotePath: string, client: WebDAVClient): Promise<string> {
        try {
            await client.getDirectoryContents(remotePath);
            // 如果能获取到内容，说明文件夹存在，需要重命名
            const timestamp = new Date().getTime();
            return `${remotePath}_${timestamp}`;
        } catch {
            // 文件夹不存在，可以直接使用
            return remotePath;
        }
    }
}
