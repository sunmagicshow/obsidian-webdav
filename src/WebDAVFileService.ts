import {App, Notice} from 'obsidian';
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
     * 从 WebDAV 服务器下载文件到本地
     * @param file - WebDAV 文件信息
     * @param server - WebDAV 服务器配置
     * @param client - WebDAV 客户端实例
     */
    async downloadFile(file: FileStat, server: WebDAVServer, client: WebDAVClient): Promise<void> {
        const ext = file.basename.split('.').pop()?.toLowerCase() || '';

        // 1. 预先判断分流类型
        const isText = SUPPORTED_TEXT_EXTS.has(ext);
        const isBinary = SUPPORTED_BINARY_EXTS.has(ext);
        const isObsidianSupported = isText || isBinary;

        // 2. 只有 Obsidian 支持的格式才显示“下载中”提示
        let downloadingMessage: Notice | null = null;
        if (isObsidianSupported) {
            downloadingMessage = new Notice(`⬇️${i18n.t.contextMenu.downloading}`);
        }

        try {
            if (isObsidianSupported) {
                const arrayBuffer = await client.getFileContents(file.filename);
                const filePath = await this.prepareFilePath(file.basename, server);

                if (isText) {
                    const decoder = new TextDecoder('utf-8');
                    await this.app.vault.adapter.write(filePath, decoder.decode(arrayBuffer));
                } else {
                    await this.app.vault.adapter.writeBinary(filePath, arrayBuffer);
                }

                // downloadingMessage?.hide();
                new Notice(`✅ ${i18n.t.contextMenu.downloadSuccess}`);
            } else {
                new Notice(`ℹ️ ${i18n.t.contextMenu.notSupportFormat}`);
                const arrayBuffer = await client.getFileContents(file.filename);
                const blob = new Blob([arrayBuffer], {type: 'application/octet-stream'});
                this.fallbackDownload(blob, file.basename);
            }
        } catch (e) {
            downloadingMessage?.hide();
            throw e;
        }
    }

    private async prepareFilePath(basename: string, server: WebDAVServer): Promise<string> {
        const downloadDir = await this.getDownloadDirectory(server);
        const filePath = downloadDir === '' ? basename : `${downloadDir}/${basename}`;
        return await this.handleExistingFile(filePath);
    }

    /**
     * 根据文件扩展名获取对应的 Obsidian 图标
     * @param filename - 文件名
     * @returns 对应的 Obsidian 图标名称
     */
    getFileIcon(filename: string): string {
        const ext = filename.split('.').pop()?.toLowerCase() || '';

        return ICON_MAP[ext] || 'file'; // 默认返回文件图标
    }

    /**
     * 标准化文件路径，确保路径格式正确
     * @param path - 原始路径
     * @param rootPath - 根路径，默认为 '/'
     * @returns 标准化后的路径
     */
    normalizePath(path: string, rootPath: string = '/'): string {
        let normalizedPath = path;

        // 处理空路径、根路径等特殊情况
        if (path === '' || path === '/' || path === rootPath) {
            normalizedPath = rootPath;
        } else {
            // 确保路径以根路径开头
            if (!path.startsWith(rootPath)) {
                normalizedPath = rootPath === '/' ? `/${path.replace(/^\//, '')}` : `${rootPath}/${path.replace(/^\//, '')}`;
            }
            // 移除多余的斜杠
            normalizedPath = normalizedPath.replace(/\/+/g, '/');
        }

        // 移除末尾的斜杠（除非是根路径）
        if (normalizedPath !== '/' && normalizedPath.endsWith('/')) {
            normalizedPath = normalizedPath.slice(0, -1);
        }

        // 最终确认路径以根路径开头
        if (!normalizedPath.startsWith(rootPath)) {
            normalizedPath = rootPath;
        }

        return normalizedPath;
    }


    /**
     * 获取文件下载目录路径
     * @param server - WebDAV 服务器配置
     * @returns 下载目录路径
     */
    private async getDownloadDirectory(server: WebDAVServer): Promise<string> {
        // 如果设置了自定义下载路径
        if (server.downloadPath && server.downloadPath.trim() !== '') {
            let customPath = server.downloadPath.trim();

            // 标准化路径：移除开头和结尾的斜杠，除非是根目录
            customPath = this.normalizeDownloadPath(customPath);

            // 如果设置为根目录或空字符串，则使用根目录
            if (customPath === '/' || customPath === '') {
                return '';
            }

            // 检查目录是否存在，不存在则创建
            const dirExists = await this.app.vault.adapter.exists(customPath);
            if (!dirExists) {
                await this.app.vault.createFolder(customPath);
            }

            return customPath;
        }
        // 如果未设置 downloadPath，使用根目录
        return '';
    }

    /**
     * 标准化下载路径
     * 确保所有格式的路径都统一为相同的格式
     * @param path - 原始路径
     * @returns 标准化后的路径
     */
    private normalizeDownloadPath(path: string): string {
        if (!path || path.trim() === '') {
            return '';
        }

        let normalizedPath = path.trim();

        // 移除开头的斜杠（除非是根目录）
        if (normalizedPath.startsWith('/')) {
            normalizedPath = normalizedPath.substring(1);
        }

        // 移除结尾的斜杠
        if (normalizedPath.endsWith('/')) {
            normalizedPath = normalizedPath.substring(0, normalizedPath.length - 1);
        }

        // 如果处理后为空，说明是根目录
        if (normalizedPath === '') {
            return '';
        }

        return normalizedPath;
    }

    /**
     * 处理已存在文件的命名冲突
     * 如果文件已存在，会在文件名后添加时间戳
     * @param filePath - 原始文件路径
     */
    private async handleExistingFile(filePath: string): Promise<string> {
        const exists = await this.app.vault.adapter.exists(filePath);
        if (!exists) return filePath;

        const lastSlashIndex = filePath.lastIndexOf('/');
        const dir = lastSlashIndex !== -1 ? filePath.substring(0, lastSlashIndex + 1) : '';
        const filename = lastSlashIndex !== -1 ? filePath.substring(lastSlashIndex + 1) : filePath;

        const lastDotIndex = filename.lastIndexOf('.');
        const name = lastDotIndex === -1 ? filename : filename.substring(0, lastDotIndex);
        const ext = lastDotIndex === -1 ? '' : filename.substring(lastDotIndex);

        const timestamp = new Date().getTime();
        return `${dir}${name}_${timestamp}${ext}`;
    }

    /**
     * 备用下载方法
     * 当适配器不支持 writeBinary 时，使用浏览器原生下载
     * @param blob - 文件数据的 Blob 对象
     * @param filename - 文件名
     */
    private fallbackDownload(blob: Blob, filename: string): void {
        // 创建对象 URL
        const doc = activeDocument;

        const url = URL.createObjectURL(blob);
        const a = doc.createElement('a');
        a.href = url;
        a.download = filename;

        // 触发下载
        doc.body.appendChild(a);
        a.click();
        doc.body.removeChild(a);

        // 清理
        URL.revokeObjectURL(url);
    }
}