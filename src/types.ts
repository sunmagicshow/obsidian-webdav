import { FileStat } from 'webdav';

// === 常量定义 ===
export const VIEW_TYPE_WEBDAV_EXPLORER = 'webdav-explorer';

// === 核心接口 ===
// 定义WebDAV服务器的配置接口
export interface WebDAVServer {
    id: string;
    name: string;
    url: string;
    username: string;
    secretId: string;
    remoteDir: string;
    urlPrefix: string;
    isDefault?: boolean;
    downloadPath?: string;
}

// 定义WebDAV插件的设置接口
export interface WebDAVSettings {
    servers: WebDAVServer[];
    currentServerName?: string;
    currentServerId: string;
}

// 定义WebDAV插件的默认设置
export const DEFAULT_SETTINGS: WebDAVSettings = {
    servers: [],
    currentServerId: '',
};

// 定义WebDAV客户端的接口
export interface IWebDAVClient {
    initialize(): Promise<boolean>;
    getDirectoryContents(path: string): Promise<FileStat[]>;
    getFileContents(filePath: string): Promise<ArrayBuffer>;
    deleteFile(remotePath: string): Promise<void>;
    uploadFile(remotePath: string, content: ArrayBuffer): Promise<void>;
    checkWritePermission(path?: string): Promise<boolean>;
    createDirectory(remotePath: string): Promise<void>;
    renameFile(oldPath: string, newPath: string): Promise<void>;
}
