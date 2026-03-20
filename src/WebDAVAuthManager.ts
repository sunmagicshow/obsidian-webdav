import {App, Plugin} from 'obsidian';
import {WebDAVServer} from './types';

/**
 * 显式定义 Electron 相关接口，消除 ESLint 警告
 */
interface CertificateVerifyRequest {
    hostname: string;
}

interface ElectronSession {
    setCertificateVerifyProc(
        proc: ((request: CertificateVerifyRequest, callback: (result: number) => void) => void) | null
    ): void;
}

// 定义 Electron 对象的最小化结构
interface ElectronModule {
    remote?: {
        session: {
            defaultSession: ElectronSession;
        };
    };
    session: {
        defaultSession: ElectronSession;
    };
}

export class WebDAVAuthManager {
    private app: App;
    private session: ElectronSession;
    private pluginId: string;

    constructor(app: App, pluginId: string) {
        this.app = app;
        this.pluginId = pluginId;

        // --- 修复 36-40 行：使用精准接口定义代替 any ---
        const electron = (window as unknown as { require(m: 'electron'): ElectronModule }).require('electron');

        // 使用可选链和明确的类型收窄
        this.session = electron.remote
            ? electron.remote.session.defaultSession
            : electron.session.defaultSession;


        this.setupCertificateErrorHandler();
    }

    /**
     * 处理自签名证书
     */
    private setupCertificateErrorHandler(): void {
        this.session.setCertificateVerifyProc((request, callback) => {
            const {hostname} = request;

            // 将整个 plugins 字典视为未知，然后断言其 getPlugin 方法
            const plugins = (this.app as unknown as { plugins: { getPlugin(id: string): Plugin | null } }).plugins;
            const plugin = plugins.getPlugin(this.pluginId);

            // 检查插件是否存在并包含 settings 属性
            if (!plugin || !('settings' in plugin)) {
                callback(-3);
                return;
            }

            // 安全获取服务器列表
            const servers = (plugin.settings as { servers: WebDAVServer[] }).servers;

            const isWebDAVHost = servers.some(s => {
                if (!s.url) return false;
                try {
                    return new URL(s.url).hostname === hostname;
                } catch {
                    return false;
                }
            });

            if (isWebDAVHost) {
                callback(0);
            } else {
                callback(-3);
            }
        });
    }

    /**
     * 执行静默握手：强行激活渲染进程的凭据缓存
     */
    public async silentHandshake(server: WebDAVServer): Promise<void> {
        const password = this.app.secretStorage.getSecret(server.secretId);
        if (!password || !server.url) return;

        try {
            const urlObj = new URL(server.url);
            urlObj.username = server.username;
            urlObj.password = password;

            // eslint-disable-next-line no-restricted-globals
            await fetch(urlObj.toString(), {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-store'
            });
        } catch {
            // 握手不论成功还是 404，凭据都会被记录
        }
    }

    public cleanup(): void {
        this.session.setCertificateVerifyProc(null);
    }
}