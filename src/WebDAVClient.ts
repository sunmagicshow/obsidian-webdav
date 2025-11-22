import {createClient, FileStat} from 'webdav';
import {IWebDAVClient, WebDAVServer} from './types';

/**
 * WebDAV 客户端实现类
 * 负责与 WebDAV 服务器建立连接并执行文件操作
 */
export class WebDAVClient implements IWebDAVClient {
    /** WebDAV 客户端实例 */
    private client: ReturnType<typeof createClient> | null = null;

    /**
     * 构造函数
     * @param server - WebDAV 服务器配置信息
     */
    constructor(private server: WebDAVServer) {
    }

    /**
     * 初始化 WebDAV 客户端连接
     * 验证服务器配置并建立连接
     * @returns 连接成功返回 true，失败返回 false
     */
    async initialize(): Promise<boolean> {
        const {url, username, password} = this.server;

        // 验证必要的配置参数
        if (!url || !username || !password) {
            return false;
        }

        try {
            // 构建 Basic Authentication 头部
            const authHeader = 'Basic ' + btoa(`${username}:${password}`);

            // 创建 WebDAV 客户端实例
            this.client = createClient(url, {
                username,
                password,
                headers: {
                    'Authorization': authHeader
                }
            });

            // 测试连接：尝试获取根目录内容
            await this.client.getDirectoryContents('/');
            return true;
        } catch {
            // 连接失败，重置客户端实例
            this.client = null;
            return false;
        }
    }

    /**
     * 获取指定目录的内容列表
     * @param path - 目录路径
     * @returns 文件状态信息数组
     * @throws 当客户端未初始化时抛出错误
     */
    async getDirectoryContents(path: string): Promise<FileStat[]> {
        if (!this.client) {
            throw new Error('WebDAV client not initialized');
        }

        // 获取目录内容，处理不同的返回格式
        const result = await this.client.getDirectoryContents(path);

        // 根据返回类型处理结果（数组或对象包装的数组）
        if (Array.isArray(result)) {
            return result;
        } else {
            return result.data;
        }
    }

    /**
     * 获取指定文件的二进制内容
     * @param filePath - 文件路径
     * @returns 文件的 ArrayBuffer 数据
     * @throws 当客户端未初始化或获取文件内容失败时抛出错误
     */
    async getFileContents(filePath: string): Promise<ArrayBuffer> {
        if (!this.client) {
            throw new Error('WebDAV client not initialized');
        }

        try {
            // 以二进制格式获取文件内容
            return await this.client.getFileContents(filePath, {format: 'binary', details: false}) as ArrayBuffer;
        } catch {
            throw new Error('Failed to get file contents');
        }
    }
}