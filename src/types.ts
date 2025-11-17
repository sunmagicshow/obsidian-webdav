import { App, PluginSettingTab } from 'obsidian';
import { FileStat } from 'webdav';

// === 常量定义 ===
export const VIEW_TYPE_WEBDAV_EXPLORER = 'webdav-explorer';

// === 核心接口 ===
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

export interface WebDAVSettings {
    servers: WebDAVServer[];
    currentServerName: string;
}

export interface IWebDAVClient {
    initialize(): Promise<boolean>;
    getDirectoryContents(path: string): Promise<FileStat[]>;
    getFileContents(filePath: string): Promise<ArrayBuffer>;
}

// App 设置扩展接口
export interface AppWithSettings extends App {
    setting: {
        open: () => void;
        openTabById: (id: string) => void;
        activeTab: PluginSettingTab | null;
    };
}

// 默认设置
export const DEFAULT_SETTINGS: WebDAVSettings = {
    servers: [],
    currentServerName: '',
};