import { createClient, FileStat, ResponseDataDetailed } from 'webdav';
import { WebDAVServer } from './types';

export class WebDAVClient {
  private client: ReturnType<typeof createClient> | null = null;

  constructor(private server: WebDAVServer) {}

  async initialize(): Promise<boolean> {
    const { url, username, password } = this.server;

    if (!url || !username || !password) {
      return false;
    }

    try {
      const authHeader = 'Basic ' + btoa(`${username}:${password}`);

      this.client = createClient(url, {
        username,
        password,
        headers: {
          'Authorization': authHeader
        }
      });

      // 测试连接
      await this.client.getDirectoryContents('/');
      return true;
    } catch (err) {
      console.error('Failed to initialize WebDAV client:', err);
      this.client = null;
      return false;
    }
  }

  async getDirectoryContents(path: string): Promise<FileStat[]> {
    if (!this.client) {
      throw new Error('WebDAV client not initialized');
    }

    const result = await this.client.getDirectoryContents(path);

    // 处理两种可能的返回类型
    if (Array.isArray(result)) {
      return result;
    } else {
      // 如果是 ResponseDataDetailed 类型，返回 data 属性
      return (result as ResponseDataDetailed<FileStat[]>).data;
    }
  }

  getClient(): ReturnType<typeof createClient> | null {
    return this.client;
  }

  destroy(): void {
    this.client = null;
  }
}