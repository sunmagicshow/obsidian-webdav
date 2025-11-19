import { App, PluginSettingTab } from 'obsidian';
import { FileStat } from 'webdav';

// === 常量定义 ===
export const VIEW_TYPE_WEBDAV_EXPLORER = 'webdav-explorer';

// === 核心接口 ===
// 定义WebDAV服务器的配置接口
export interface WebDAVServer {
    name: string;
    url: string;
    username: string;
    password: string;
    remoteDir: string;
    urlPrefix: string;
    isDefault?: boolean;
    downloadPath?: string;
}

// 定义WebDAV插件的设置接口
export interface WebDAVSettings {
    servers: WebDAVServer[];
    currentServerName: string;
}

// 定义WebDAV插件的默认设置
export const DEFAULT_SETTINGS: WebDAVSettings = {
    servers: [],
    currentServerName: '',
};

// 定义WebDAV客户端的接口
export interface IWebDAVClient {
    initialize(): Promise<boolean>;
    getDirectoryContents(path: string): Promise<FileStat[]>;
    getFileContents(filePath: string): Promise<ArrayBuffer>;
}

// 扩展App接口以支持插件设置功能
export interface AppWithSettings extends App {
    setting: {
        open: () => void;
        openTabById: (id: string) => void;
        activeTab: PluginSettingTab | null;
    };
}

