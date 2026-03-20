import {Notice, Plugin, debounce, Debouncer} from 'obsidian';
import {WebDAVSettingTab} from './WebDAVSettingTab';
import {WebDAVExplorerView} from './WebDAVExplorerView';
import {i18n} from './i18n';
import {WebDAVSettings, DEFAULT_SETTINGS, WebDAVServer, VIEW_TYPE_WEBDAV_EXPLORER} from './types';
import {WebDAVAuthManager} from './WebDAVAuthManager';

/**
 * WebDAV 插件主类
 * 负责插件生命周期管理、服务器配置和视图控制
 */
export default class WebDAVPlugin extends Plugin {
    settings: WebDAVSettings = DEFAULT_SETTINGS;
    private authManager!: WebDAVAuthManager;

    /**
     * 使用官方导出的 Debouncer 接口定义类型
     * T (参数列表) 为 []，V (返回值) 为 void
     */
    private debouncedRefresh!: Debouncer<[], void>;


    /**
     * 插件加载时的初始化操作
     * - 加载设置
     * - 注册视图
     * - 添加设置面板
     * - 添加 ribbon 图标
     */
    async onload() {
        // --- 1. 加载并合并设置 ---
        const savedSettings = await this.loadData() as Partial<WebDAVSettings>;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, savedSettings);

        // --- 2. 数据迁移逻辑：补全缺失的 ID ---
        await this.migrateSettings();

        // --- 3. 初始化认证管理器 ---
        this.authManager = new WebDAVAuthManager(this.app, this.manifest.id);
        this.debouncedRefresh = debounce(() => {
            void this.refreshAuth();
        }, 500, true);

        void this.refreshAuth();

        // 3.注册事件：直接传入防抖函数
        this.registerEvent(
            this.app.workspace.on("layout-change", () => this.debouncedRefresh())
        );
        this.registerEvent(
            this.app.workspace.on("window-open", () => this.debouncedRefresh())
        );

        // 注册 WebDAV 文件浏览器视图
        this.registerView(
            VIEW_TYPE_WEBDAV_EXPLORER,
            (leaf) => new WebDAVExplorerView(leaf, this),
        );

        // 添加设置面板
        this.addSettingTab(new WebDAVSettingTab(this.app, this));

        // 添加 ribbon 图标，点击打开 WebDAV 浏览器
        this.addRibbonIcon('cloud', i18n.t.displayName, () => void this.activateView());
    }


    /**
     * 数据迁移：为旧版本服务器配置补全 ID
     */
    private async migrateSettings() {
        let hasChanges = false;
        const {servers} = this.settings;

        if (!servers || servers.length === 0) return;

        servers.forEach((server) => {
            // 如果服务器没有 id，则根据当前时间戳生成一个
            if (!server.id) {
                server.id = `server_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                hasChanges = true;

                // 如果这个被补全 ID 的服务器恰好是当前正在使用的服务器
                // 同步更新 currentServerId 以确保 ID 匹配逻辑生效
                if (server.name === this.settings.currentServerName && !this.settings.currentServerId) {
                    this.settings.currentServerId = server.id;
                }
            }
        });
        // 只有在数据真正发生变化时才保存，避免多余的 IO 操作
        if (hasChanges) {
            await this.saveData(this.settings);
        }
    }


    /**
     * 核心异步握手逻辑
     */
    private async refreshAuth() {
        const servers = this.settings.servers;
        if (!servers?.length) return;

        try {
            await Promise.allSettled(servers.map(s => this.authManager.silentHandshake(s)));
        } catch {
            // 静默处理
        }
    }

    // ==================== 服务器管理方法 ====================

    /**
     * 插件卸载时的清理操作
     * - 关闭所有 WebDAV 视图
     */
    onunload() {
        if (this.authManager) {
            this.authManager.cleanup();
        }
        this.debouncedRefresh.cancel();
        new Notice(i18n.t.settings.unloadSuccess);
    }


    /**
     * 通知所有视图服务器配置已变更
     * 触发视图重新加载服务器数据
     */
    public notifyServerChanged(): void {
        // UI 刷新：立即执行
        this.app.workspace.getLeavesOfType(VIEW_TYPE_WEBDAV_EXPLORER).forEach(leaf => {
            if (leaf.view instanceof WebDAVExplorerView) {
                leaf.view.onServerChanged();
            }
        });

        // 网络握手：进入防抖队列
        this.debouncedRefresh();
    }


    /**
     * 获取当前活动的服务器配置
     * @returns 当前服务器或默认服务器，如果没有则返回 null
     */
    getCurrentServer(): WebDAVServer | null {
        const {servers, currentServerId, currentServerName} = this.settings;

        // 优先通过 ID 查找
        if (currentServerId) {
            return servers.find(s => s.id === currentServerId) || null;
        }
        // 兼容老版本通过 Name 查找
        return servers.find(s => s.name === currentServerName) || servers[0] || null;
    }

    /**
     * 获取默认服务器配置
     * @returns 标记为默认的服务器或第一个服务器，如果没有则返回 null
     */
    getDefaultServer(): WebDAVServer | null {
        const {servers} = this.settings;

        // 默认服务器查找逻辑
        return servers.find(s => s.isDefault) || servers[0] || null;
    }

    /**
     * 获取所有服务器配置列表
     * @returns 服务器配置数组
     */
    getServers(): WebDAVServer[] {
        return this.settings.servers;
    }
    // ==================== 设置管理方法 ====================

    /**
     * 激活并显示 WebDAV 浏览器视图
     * - 使用默认服务器
     * - 复用已存在的视图或创建新视图
     * - 在右侧面板显示
     */
    async activateView() {
        const {workspace} = this.app;

        // 检查是否存在默认服务器配置
        const defaultServer = this.getDefaultServer();
        if (!defaultServer) {
            new Notice(i18n.t.settings.serverListEmpty);
            return;
        }

        // 设置当前服务器为默认服务器并保存设置
        this.settings.currentServerName = defaultServer.name;
        await this.saveData(this.settings);

        // 查找已存在的 WebDAV 视图
        let existingLeaf = workspace.getLeavesOfType(VIEW_TYPE_WEBDAV_EXPLORER)[0];

        if (existingLeaf) {
            // 显示已存在的视图并强制刷新
            await workspace.revealLeaf(existingLeaf);
            if (existingLeaf.view instanceof WebDAVExplorerView) {
                existingLeaf.view.onunload();
                await existingLeaf.view.onOpen();
            }
            return;
        }

        // 创建新的视图
        const targetLeaf = workspace.getRightLeaf(false) || workspace.createLeafBySplit(workspace.getLeaf(), 'vertical');
        await targetLeaf.setViewState({type: VIEW_TYPE_WEBDAV_EXPLORER, active: true});
        await workspace.revealLeaf(targetLeaf);
    }
}