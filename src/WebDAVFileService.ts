import { App, Notice } from 'obsidian';
import { FileStat } from 'webdav';
import { WebDAVServer } from './types';
import { WebDAVClient } from './WebDAVClient';

export class WebDAVFileService {
    constructor(private app: App) {}

    async downloadFile(file: FileStat, server: WebDAVServer, client: WebDAVClient): Promise<void> {
        const downloadingMessage = new Notice(`⬇️ 正在下载 ${file.basename}`, 0);

        try {
            const arrayBuffer = await client.getFileContents(file.filename);
            const downloadDir = await this.getDownloadDirectory(server);
            let filePath = `${downloadDir}/${file.basename}`;

            filePath = await this.handleExistingFile(filePath, file.basename);
            const adapter = this.app.vault.adapter;

            if (this.isTextFile(file.basename)) {
                const decoder = new TextDecoder('utf-8');
                await adapter.write(filePath, decoder.decode(arrayBuffer));
            } else {
                if (typeof adapter.writeBinary === 'function') {
                    await adapter.writeBinary(filePath, arrayBuffer);
                } else {
                    this.fallbackDownload(new Blob([arrayBuffer]), file.basename);
                    downloadingMessage.hide();
                    return;
                }
            }

            downloadingMessage.hide();

        } catch {
            downloadingMessage.hide();
            throw new Error('下载失败');
        }
    }

    private async getDownloadDirectory(server: WebDAVServer): Promise<string> {
        // 如果设置了自定义下载路径
        if (server.downloadPath && server.downloadPath.trim() !== '') {
            const customPath = server.downloadPath.trim();

            // 如果设置为 /，则使用根目录
            if (customPath === '/') {
                return '';
            }

            // 否则使用自定义路径，并确保目录存在
            const dirExists = await this.app.vault.adapter.exists(customPath);
            if (!dirExists) {
                await this.app.vault.createFolder(customPath);
            }

            return customPath;
        }

        // 如果未设置下载路径，使用默认的 WebDAV Downloads 文件夹
        const defaultDir = 'WebDAV Downloads';
        const dirExists = await this.app.vault.adapter.exists(defaultDir);

        if (!dirExists) {
            await this.app.vault.createFolder(defaultDir);
        }

        return defaultDir;
    }

    private isTextFile(filename: string): boolean {
        const textExtensions = ['.md', '.txt', '.json', '.xml', '.html', '.css', '.js', '.ts'];
        return textExtensions.some(ext => filename.toLowerCase().endsWith(ext));
    }

    private async handleExistingFile(filePath: string, filename: string): Promise<string> {
        const exists = await this.app.vault.adapter.exists(filePath);

        if (!exists) {
            return filePath;
        }

        const name = filename.substring(0, filename.lastIndexOf('.'));
        const ext = filename.substring(filename.lastIndexOf('.'));
        const timestamp = new Date().getTime();

        const newPath = filePath.substring(0, filePath.lastIndexOf('/'));
        return `${newPath}/${name}_${timestamp}${ext}`;
    }

    private fallbackDownload(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    getFileIcon(filename: string): string {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const iconMap: Record<string, string> = {
            'md': '📝', 'txt': '📄', 'pdf': '📕', 'doc': '📘', 'docx': '📘',
            'xls': '📗', 'xlsx': '📗', 'ppt': '📙', 'pptx': '📙',
            'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️',
            'mp4': '🎬', 'mkv': '🎬', 'avi': '🎬', 'mov': '🎬',
            'mp3': '🎵', 'wav': '🎵', 'zip': '📦', 'rar': '📦', '7z': '📦', 'strm': '🔗'
        };

        return iconMap[ext] || '📄';
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

    debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
        let timeout: number;
        return ((...args: any[]) => {
            clearTimeout(timeout);
            timeout = window.setTimeout(() => func.apply(this, args), wait);
        }) as T;
    }
}