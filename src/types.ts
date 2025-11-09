import { App, PluginSettingTab } from 'obsidian';

// === 常量定义 ===
export const VIEW_TYPE_WEBDAV_EXPLORER = 'webdav-explorer';

// === 设置接口 ===
export interface WebDAVServer {
  id: string;
  name: string;
  url: string;
  username: string;
  password: string;
  remoteDir: string;
  isDefault?: boolean;
}

export interface WebDAVSettings {
  servers: WebDAVServer[];
  currentServerId?: string;
}

// 默认设置
export const DEFAULT_SETTINGS: WebDAVSettings = {
  servers: [],
};


// App 设置扩展接口
export interface AppWithSettings extends App {
    setting: {
        open: () => void;
        openTabById: (id: string) => void;
        activeTab: PluginSettingTab | null;
    };
}