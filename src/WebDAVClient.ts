import { createClient } from 'webdav';
import { WebDAVServer } from './types';

export class WebDAVClient {
  private client: any = null;

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

  async getDirectoryContents(path: string): Promise<any[]> {
    if (!this.client) {
      throw new Error('WebDAV client not initialized');
    }
    return await this.client.getDirectoryContents(path);
  }

  getClient() {
    return this.client;
  }

  destroy() {
    this.client = null;
  }
}
