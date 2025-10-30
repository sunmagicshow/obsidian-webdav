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

// 文件项接口
export interface WebDAVFile {
  filename: string;
  basename: string;
  lastmod: string;
  size: number;
  type: 'file' | 'directory';
}

// 排序相关类型
export type SortField = 'name' | 'type' | 'size' | 'date';
export type SortOrder = 'asc' | 'desc';
