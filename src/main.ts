import {Notice, Plugin} from 'obsidian';
import {WebDAVSettingTab} from './WebDAVSettingTab';
import {WebDAVExplorerView} from './WebDAVExplorerView';
import {i18n, type LangPack} from './i18n';
import {WebDAVSettings, DEFAULT_SETTINGS, WebDAVServer, VIEW_TYPE_WEBDAV_EXPLORER} from './types';

/**
 * WebDAV 插件主类
 * 负责插件生命周期管理、服务器配置和视图控制
 */
export default class WebDAVPlugin extends Plugin {
    settings: WebDAVSettings = DEFAULT_SETTINGS;

    /**
     * 插件加载时的初始化操作
     * - 加载设置
     * - 注册视图
     * - 添加设置面板
     * - 添加 ribbon 图标
     * - 自动打开默认服务器视图
     */
    async onload() {
        await this.loadSettings();

        // 注册 WebDAV 文件浏览器视图
        this.registerView(
            VIEW_TYPE_WEBDAV_EXPLORER,
            (leaf) => new WebDAVExplorerView(leaf, this),
        );

        // 添加设置面板
        this.addSettingTab(new WebDAVSettingTab(this.app, this));

        // 添加 ribbon 图标，点击打开 WebDAV 浏览器
        this.addRibbonIcon('cloud', this.i18n().displayName, () => {
            void this.activateView();
        });

        // 如果配置了默认服务器，延迟 300ms 后自动打开视图
        if (this.getDefaultServer()) {
            setTimeout(() => {
                void this.activateView();
            }, 300);
        }
    }

    /**
     * 插件卸载时的清理操作
     * - 关闭所有 WebDAV 视图
     * - 执行视图的卸载逻辑
     * - 重置插件设置
     */
    onunload() {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WEBDAV_EXPLORER);
        const t = this.i18n();

        // 卸载所有 WebDAV 视图
        for (const leaf of leaves) {
            if (leaf.view && typeof leaf.view.onunload === 'function') {
                try {
                    leaf.view.onunload();
                } catch {
                    new Notice(t.settings.unloadError);
                }
            }
            leaf.detach();
        }

        // 重置设置为默认值
        this.settings = DEFAULT_SETTINGS;
    }

    // ==================== 服务器管理方法 ====================

    /**
     * 获取当前活动的服务器配置
     * @returns 当前服务器或默认服务器，如果没有则返回 null
     */
    getCurrentServer(): WebDAVServer | null {
        const {servers, currentServerName} = this.settings;

        // 优先使用当前选中的服务器
        if (currentServerName) {
            const server = servers.find(s => s.name === currentServerName);
            if (server) return server;
        }

        return this.getDefaultServer();
    }

    /**
     * 获取默认服务器配置
     * @returns 标记为默认的服务器或第一个服务器，如果没有则返回 null
     */
    getDefaultServer(): WebDAVServer | null {
        const {servers} = this.settings;

        // 首先查找标记为默认的服务器
        const defaultServer = servers.find(s => s.isDefault);
        if (defaultServer) return defaultServer;

        // 如果没有默认服务器，返回第一个服务器
        return servers.length > 0 ? servers[0] : null;
    }

    /**
     * 获取所有服务器配置列表
     * @returns 服务器配置数组
     */
    getServers(): WebDAVServer[] {
        return this.settings.servers;
    }

    /**
     * 根据服务器名称查找服务器配置
     * @param name - 服务器名称
     * @returns 匹配的服务器配置或 null
     */
    getServerByName(name: string): WebDAVServer | null {
        return this.settings.servers.find(s => s.name === name) || null;
    }

    // ==================== 视图管理方法 ====================

    /**
     * 激活并显示 WebDAV 浏览器视图
     * - 使用默认服务器
     * - 复用已存在的视图或创建新视图
     * - 在右侧面板显示
     */
    async activateView() {
        const {workspace} = this.app;
        const t = this.i18n();

        // 检查是否存在默认服务器配置
        const defaultServer = this.getDefaultServer();
        if (!defaultServer) {
            new Notice(t.settings.serverListEmpty);
            return;
        }

        // 设置当前服务器为默认服务器并保存设置
        this.settings.currentServerName = defaultServer.name;
        await this.saveSettings();

        // 查找已存在的 WebDAV 视图
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_WEBDAV_EXPLORER)[0];

        if (leaf) {
            // 显示已存在的视图并强制刷新
            await workspace.revealLeaf(leaf);
            if (leaf.view instanceof WebDAVExplorerView) {
                leaf.view.onunload();
                await leaf.view.onOpen();
            }
            return;
        }

        // 创建新的视图
        const rightLeaf = workspace.getRightLeaf(false);
        if (rightLeaf) {
            // 在右侧面板创建视图
            await rightLeaf.setViewState({
                type: VIEW_TYPE_WEBDAV_EXPLORER,
                active: true,
            });
            await workspace.revealLeaf(rightLeaf);
        } else {
            // 分割当前标签页创建新视图
            const newLeaf = workspace.createLeafBySplit(workspace.getLeaf(), 'vertical');
            await newLeaf.setViewState({
                type: VIEW_TYPE_WEBDAV_EXPLORER,
                active: true,
            });
            await workspace.revealLeaf(newLeaf);
        }
    }

    // ==================== 设置管理方法 ====================

    /**
     * 加载插件设置
     * 合并默认设置和持久化存储的设置
     */
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    /**
     * 保存插件设置到持久化存储
     */
    async saveSettings() {
        await this.saveData(this.settings);
    }

    // ==================== 工具方法 ====================

    /**
     * 获取国际化文本
     * @returns 当前语言包
     */
    i18n(): LangPack {
        return i18n();
    }

    /**
     * 通知所有视图服务器配置已变更
     * 触发视图重新加载服务器数据
     */
    public notifyServerChanged(): void {
        // 获取所有 WebDAV 视图
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WEBDAV_EXPLORER);

        leaves.forEach(leaf => {
            if (leaf.view instanceof WebDAVExplorerView) {
                // 强制视图重新加载服务器数据
                leaf.view.onServerChanged();
            }
        });
    }
}