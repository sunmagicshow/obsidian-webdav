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

// 排序相关类型
export type SortField = 'name' | 'type' | 'size' | 'date';
export type SortOrder = 'asc' | 'desc';

// === 视图相关类型 ===
export interface FileOperationResult {
  success: boolean;
  message?: string;
  data?: any;
}
