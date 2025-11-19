import {App, Notice} from 'obsidian';
import {FileStat} from 'webdav';
import {WebDAVServer} from './types';
import {WebDAVClient} from './WebDAVClient';

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
        // 显示下载中通知（0表示不会自动关闭）
        const downloadingMessage = new Notice(`⬇️ 正在下载 ${file.basename}`, 0);

        try {
            // 从 WebDAV 服务器获取文件内容
            const arrayBuffer = await client.getFileContents(file.filename);

            // 获取本地下载目录路径
            const downloadDir = await this.getDownloadDirectory(server);
            let filePath = `${downloadDir}/${file.basename}`;

            // 处理文件名冲突，如有必要会重命名文件
            filePath = await this.handleExistingFile(filePath, file.basename);
            const adapter = this.app.vault.adapter;

            // 根据文件类型选择适当的写入方式
            if (this.isTextFile(file.basename)) {
                // 文本文件使用 UTF-8 解码后写入
                const decoder = new TextDecoder('utf-8');
                await adapter.write(filePath, decoder.decode(arrayBuffer));
            } else {
                // 二进制文件使用 writeBinary 方法
                if (typeof adapter.writeBinary === 'function') {
                    await adapter.writeBinary(filePath, arrayBuffer);
                } else {
                    // 如果适配器不支持 writeBinary，使用备用下载方式
                    this.fallbackDownload(new Blob([arrayBuffer]), file.basename);
                    downloadingMessage.hide();
                    return;
                }
            }

            // 下载完成，隐藏通知
            downloadingMessage.hide();

        } catch {
            // 下载失败，隐藏通知并抛出错误
            downloadingMessage.hide();
            throw new Error('下载失败');
        }
    }

    /**
     * 根据文件扩展名获取对应的 Obsidian 图标
     * @param filename - 文件名
     * @returns 对应的 Obsidian 图标名称
     */
    getFileIcon(filename: string): string {
        const ext = filename.split('.').pop()?.toLowerCase() || '';

        // 文件扩展名到 Obsidian 图标的映射
        const iconMap: Record<string, string> = {
            // 文档类型
            'md': 'file-text',
            'txt': 'file-text',
            'pdf': 'file-text',
            'doc': 'file-text',
            'docx': 'file-text',
            'rtf': 'file-text',
            'odt': 'file-text',
            'pages': 'file-text',

            // 表格类型
            'xls': 'table',
            'xlsx': 'table',
            'csv': 'table',
            'ods': 'table',
            'numbers': 'table',

            // 演示文稿
            'ppt': 'presentation',
            'pptx': 'presentation',
            'key': 'presentation',
            'odp': 'presentation',

            // 图片类型
            'jpg': 'image',
            'jpeg': 'image',
            'png': 'image',
            'gif': 'image',
            'svg': 'image',
            'webp': 'image',
            'bmp': 'image',
            'tiff': 'image',
            'tif': 'image',
            'ico': 'image',
            'heic': 'image',
            'raw': 'image',
            'psd': 'image',
            'ai': 'image',
            'eps': 'image',

            // 视频类型
            'mp4': 'video',
            'mkv': 'video',
            'avi': 'video',
            'mov': 'video',
            'wmv': 'video',
            'flv': 'video',
            'webm': 'video',
            'm4v': 'video',
            '3gp': 'video',
            'mpeg': 'video',
            'mpg': 'video',

            // 音频类型
            'mp3': 'audio-file',
            'wav': 'audio-file',
            'flac': 'audio-file',
            'aac': 'audio-file',
            'ogg': 'audio-file',
            'm4a': 'audio-file',
            'wma': 'audio-file',
            'aiff': 'audio-file',
            'mid': 'audio-file',
            'midi': 'audio-file',

            // 压缩文件
            'zip': 'archive',
            'rar': 'archive',
            '7z': 'archive',
            'tar': 'archive',
            'gz': 'archive',
            'bz2': 'archive',
            'xz': 'archive',
            'iso': 'archive',
            'dmg': 'archive',

            // 代码文件
            'js': 'file-code',
            'ts': 'file-code',
            'jsx': 'file-code',
            'tsx': 'file-code',
            'html': 'file-code',
            'htm': 'file-code',
            'css': 'file-code',
            'scss': 'file-code',
            'sass': 'file-code',
            'less': 'file-code',
            'json': 'file-code',
            'xml': 'file-code',
            'yml': 'file-code',
            'yaml': 'file-code',
            'php': 'file-code',
            'py': 'file-code',
            'java': 'file-code',
            'c': 'file-code',
            'cpp': 'file-code',
            'h': 'file-code',
            'hpp': 'file-code',
            'cs': 'file-code',
            'go': 'file-code',
            'rs': 'file-code',
            'swift': 'file-code',
            'kt': 'file-code',
            'dart': 'file-code',
            'lua': 'file-code',
            'pl': 'file-code',
            'r': 'file-code',
            'sql': 'file-code',
            'sh': 'file-code',
            'bash': 'file-code',
            'zsh': 'file-code',
            'ps1': 'file-code',
            'bat': 'file-code',
            'cmd': 'file-code',

            // 字体文件
            'ttf': 'type',
            'otf': 'type',
            'woff': 'type',
            'woff2': 'type',
            'eot': 'type',

            // 电子书
            'epub': 'book',
            'mobi': 'book',
            'azw3': 'book',

            // 数据库
            'db': 'database',
            'sqlite': 'database',
            'mdb': 'database',

            // 配置文件
            'ini': 'settings',
            'cfg': 'settings',
            'conf': 'settings',
            'toml': 'settings',

            // 其他特殊类型
            'strm': 'link',
            'url': 'link',
            'webloc': 'link',
            'exe': 'binary',
            'msi': 'binary',
            'dll': 'binary',
            'app': 'binary',
            'apk': 'binary',
            'deb': 'package',
            'rpm': 'package',
            'pkg': 'package'
        };

        return iconMap[ext] || 'file'; // 默认返回文件图标
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
     * 防抖函数，用于限制函数调用频率
     * @param func - 需要防抖的函数
     * @param wait - 等待时间（毫秒）
     * @returns 防抖后的函数
     */
    debounce<T extends (...args: unknown[]) => unknown>(
        func: T,
        wait: number
    ): (...args: Parameters<T>) => void {
        let timeout: number;

        return (...args: Parameters<T>) => {
            clearTimeout(timeout);
            timeout = window.setTimeout(() => {
                func(...args);
            }, wait);
        };
    }

    /**
     * 获取文件下载目录路径
     * @param server - WebDAV 服务器配置
     * @returns 下载目录路径
     */
    private async getDownloadDirectory(server: WebDAVServer): Promise<string> {
        // 如果设置了自定义下载路径
        if (server.downloadPath && server.downloadPath.trim() !== '') {
            const customPath = server.downloadPath.trim();

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
     * 判断文件是否为文本文件
     * @param filename - 文件名
     * @returns 如果是文本文件返回 true，否则返回 false
     */
    private isTextFile(filename: string): boolean {
        const textExtensions = ['.md', '.txt', '.json', '.xml', '.html', '.css', '.js', '.ts'];
        return textExtensions.some(ext => filename.toLowerCase().endsWith(ext));
    }

    /**
     * 处理已存在文件的命名冲突
     * 如果文件已存在，会在文件名后添加时间戳
     * @param filePath - 原始文件路径
     * @param filename - 文件名
     * @returns 处理后的文件路径
     */
    private async handleExistingFile(filePath: string, filename: string): Promise<string> {
        const exists = await this.app.vault.adapter.exists(filePath);

        // 如果文件不存在，直接返回原路径
        if (!exists) {
            return filePath;
        }

        // 提取文件名和扩展名
        const name = filename.substring(0, filename.lastIndexOf('.'));
        const ext = filename.substring(filename.lastIndexOf('.'));
        const timestamp = new Date().getTime();

        // 生成新路径：在原文件名后添加时间戳
        const newPath = filePath.substring(0, filePath.lastIndexOf('/'));
        return `${newPath}/${name}_${timestamp}${ext}`;
    }

    /**
     * 备用下载方法
     * 当适配器不支持 writeBinary 时，使用浏览器原生下载
     * @param blob - 文件数据的 Blob 对象
     * @param filename - 文件名
     */
    private fallbackDownload(blob: Blob, filename: string): void {
        // 创建对象 URL
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;

        // 触发下载
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // 清理对象 URL
        URL.revokeObjectURL(url);
    }
}