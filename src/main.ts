import {Notice, Plugin, MarkdownPostProcessor, requestUrl} from 'obsidian';
import {WebDAVSettingTab} from './WebDAVSettingTab';
import {WebDAVExplorerView} from './WebDAVExplorerView';
import {i18n} from './i18n';
import {WebDAVSettings, DEFAULT_SETTINGS, WebDAVServer, VIEW_TYPE_WEBDAV_EXPLORER} from './types';

export default class WebDAVPlugin extends Plugin {
    // 插件配置
    settings: WebDAVSettings = DEFAULT_SETTINGS;

    // 缓存：图片URL → blobUrl，避免重复下载
    private readonly blobCache = new Map<string, string>();
    // 存储每个服务器的CORS检测结果：服务器ID → 是否支持CORS
    private serverCorsMap = new Map<string, boolean>();

    async onload(): Promise<void> {
        // 1. 加载插件配置
        const savedSettings = await this.loadData() as Partial<WebDAVSettings>;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, savedSettings);

        // 2. 配置迁移
        await this.migrateSettings();

        // 3. 注册插件视图
        this.registerView(
            VIEW_TYPE_WEBDAV_EXPLORER,
            (leaf) => new WebDAVExplorerView(leaf, this),
        );

        // 4. 注册设置页 + 左侧图标
        this.addSettingTab(new WebDAVSettingTab(this.app, this));
        this.addRibbonIcon('cloud', i18n.t.displayName, () => void this.activateView());

        // 5. 启动时检测所有服务器的CORS状态
        await this.detectAllServerCORS();

        // 6. 注册markdown处理器：渲染图片时自动处理
        const processor: MarkdownPostProcessor = (el) => {
            el.querySelectorAll('img').forEach((img) => {
                void this.handleSmartImage(img);
            });
        };
        this.registerMarkdownPostProcessor(processor);

        // 7. 监听DOM新增图片的自动处理
        this.registerDOMMonitorForImages();
    }

    /**
     * 检测所有服务器是否支持CORS
     * 支持CORS：直接浏览器加载
     * 不支持CORS：走插件授权+blob模式
     */
    private async detectAllServerCORS(): Promise<void> {
        const servers = this.settings.servers ?? [];
        if (servers.length === 0) return;

        // 遍历所有服务器，逐个检测
        for (const server of servers) {
            try {
                const url = server.url;
                if (!url || !server.id) continue;

                // 发送跨域预检请求（标准CORS检测方式）
                await requestUrl({
                    url: url,
                    method: 'OPTIONS',
                    headers: {
                        'Access-Control-Request-Method': 'GET',
                        Origin: 'app://obsidian.md'
                    },
                });

                // 根据返回码自动判断是否支持CORS
                this.serverCorsMap.set(server.id, true);
            } catch {
                this.serverCorsMap.set(server.id, false)
            }
        }
    }


    /**
     * 1. 支持CORS → 不处理，直接加载
     * 2. 不支持CORS → 用账号密码获取图片，转blob显示
     */
    private async handleSmartImage(img: HTMLImageElement): Promise<void> {
        const src = img.src;

        // 过滤无效图片、已处理过的图片、blob/data图片
        if (!src || img.dataset.webdav) return;
        if (src.startsWith('blob:') || src.startsWith('data:')) return;

        // 获取当前选中的WebDAV服务器
        const server = this.getCurrentServer();
        if (!server || !server.id) return;

        // 关键：判断图片是否属于当前服务器,只处理当前服务器的图片，不干扰其他图片
        try {
            const imgHost = new URL(src).host;
            const serverHost = new URL(server.url).host;
            if (imgHost !== serverHost) return;
        } catch {
            return;
        }

        // 获取当前服务器的CORS状态
        const isCorsSupported = this.serverCorsMap.get(server.id) ?? false;

        // 标记已处理过的图片
        img.dataset.webdavProcessed = 'true';

        // 支持CORS → 直接返回，不做任何处理
        if (isCorsSupported) return;

        // 不支持CORS → 走授权+blob模式
        if (!server.username || !server.secretId) return;
        const password = this.app.secretStorage.getSecret(server.secretId) ?? '';
        if (!password) return;

        // 构造Basic Auth授权头
        const auth = `Basic ${btoa(`${server.username}:${password}`)}`;

        // 缓存命中：直接使用已生成的blob
        if (this.blobCache.has(src)) {
            img.src = this.blobCache.get(src)!;
            return;
        }

        // 缓存未命中：用授权方式下载图片
        try {
            const res = await requestUrl({
                url: src,
                headers: {Authorization: auth},
            });

            // 转成blobUrl并赋值给img
            const contentType = res.headers['content-type'] ?? 'image/png';
            const blob = new Blob([res.arrayBuffer], {type: contentType});
            const blobUrl = URL.createObjectURL(blob);

            // 存入缓存
            this.blobCache.set(src, blobUrl);
            img.src = blobUrl;
        } catch {
            // 加载失败不做处理
        }
    }

    /**
     * DOM监视器：动态插入的图片（如滚动加载）也能自动处理
     */
    private registerDOMMonitorForImages(): void {
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                m.addedNodes.forEach((node) => {
                    if (node instanceof HTMLImageElement) {
                        void this.handleSmartImage(node);
                    }
                    if (node instanceof HTMLElement) {
                        node.querySelectorAll('img').forEach((img) => {
                            void this.handleSmartImage(img);
                        });
                    }
                });
            }
        });

        observer.observe(document.body, {childList: true, subtree: true});
        this.register(() => observer.disconnect());
    }

    /**
     * 服务器配置改变时：清空缓存并重新检测CORS
     */
    public notifyServerChanged(): void {
        // 刷新文件视图
        this.app.workspace.getLeavesOfType(VIEW_TYPE_WEBDAV_EXPLORER).forEach(leaf => {
            if (leaf.view instanceof WebDAVExplorerView) {
                leaf.view.onServerChanged();
            }
        });

        // 清空所有状态
        this.serverCorsMap.clear();
        this.blobCache.forEach(url => URL.revokeObjectURL(url));
        this.blobCache.clear();

        // 重新检测CORS
        void this.detectAllServerCORS();
    }

    /**
     * 插件卸载：释放blob内存
     */
    onunload(): void {
        this.blobCache.forEach(url => URL.revokeObjectURL(url));
        this.blobCache.clear();
        new Notice(i18n.t.settings.unloadSuccess);
    }

    /**
     * 配置迁移：给没有ID的服务器自动生成ID
     */
    private async migrateSettings(): Promise<void> {
        let hasChanges = false;
        const {servers} = this.settings;

        if (!servers || servers.length === 0) return;

        servers.forEach(server => {
            if (!server.id) {
                server.id = `server_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                hasChanges = true;

                if (server.name === this.settings.currentServerName && !this.settings.currentServerId) {
                    this.settings.currentServerId = server.id;
                }
            }
        });

        if (hasChanges) {
            await this.saveData(this.settings);
        }
    }

    // ======================
    // 工具方法：获取当前服务器
    // ======================
    getCurrentServer(): WebDAVServer | null {
        const {servers, currentServerId, currentServerName} = this.settings;
        if (currentServerId) {
            return servers.find(s => s.id === currentServerId) ?? null;
        }
        return servers.find(s => s.name === currentServerName) ?? servers[0] ?? null;
    }

    getDefaultServer(): WebDAVServer | null {
        const {servers} = this.settings;
        return servers.find(s => s.isDefault) ?? servers[0] ?? null;
    }

    getServers(): WebDAVServer[] {
        return this.settings.servers;
    }

    // 打开插件视图
    async activateView(): Promise<void> {
        const {workspace} = this.app;
        const defaultServer = this.getDefaultServer();

        if (!defaultServer) {
            new Notice(i18n.t.settings.serverListEmpty);
            return;
        }

        this.settings.currentServerName = defaultServer.name;
        await this.saveData(this.settings);

        let existingLeaf = workspace.getLeavesOfType(VIEW_TYPE_WEBDAV_EXPLORER)[0];
        if (existingLeaf) {
            await workspace.revealLeaf(existingLeaf);
            return;
        }

        const targetLeaf = workspace.getRightLeaf(false) ?? workspace.createLeafBySplit(workspace.getLeaf(), 'vertical');
        await targetLeaf.setViewState({type: VIEW_TYPE_WEBDAV_EXPLORER, active: true});
        await workspace.revealLeaf(targetLeaf);
    }
}