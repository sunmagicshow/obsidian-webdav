import {Notice, Plugin} from 'obsidian';
import {WebDAVSettingTab} from './WebDAVSettingTab';
import {WebDAVExplorerView} from './WebDAVExplorerView';
import {initI18n, setI18n, i18n, LangPack, Locale, saveLocaleSetting, isValidLocale} from './i18n';
import {WebDAVSettings, DEFAULT_SETTINGS, WebDAVServer, VIEW_TYPE_WEBDAV_EXPLORER} from './types';

export default class WebDAVPlugin extends Plugin {
    settings: WebDAVSettings = DEFAULT_SETTINGS;

    // 获取国际化文本
    i18n(): LangPack {
        return i18n();
    }

    async onload() {
        await this.loadSettings();

        // 初始化语言设置 - 使用新的初始化方法
        initI18n(this.app);

        // 注册视图
        this.registerView(
            VIEW_TYPE_WEBDAV_EXPLORER,
            (leaf) => new WebDAVExplorerView(leaf, this),
        );

        // 添加设置面板
        this.addSettingTab(new WebDAVSettingTab(this.app, this));

        // 添加ribbon图标
        this.addRibbonIcon('cloud', 'WebDAV Explorer', () => {
            this.activateView();
        });

        this.registerDragAndDrop();

        // 如果有默认服务器，自动打开视图
        if (this.getDefaultServer()) {
            setTimeout(() => {
                (async () => {
                    await this.activateView();
                })();
            }, 300);
        }
    }

    // 获取当前服务器
    getCurrentServer(): WebDAVServer | null {
        const {servers, currentServerId} = this.settings;

        // 优先使用当前选中的服务器
        if (currentServerId) {
            const server = servers.find(s => s.id === currentServerId);
            if (server) return server;
        }

        return this.getDefaultServer();
    }

    // 获取默认服务器
    getDefaultServer(): WebDAVServer | null {
        const {servers} = this.settings;

        // 首先查找标记为默认的服务器
        const defaultServer = servers.find(s => s.isDefault);
        if (defaultServer) return defaultServer;

        // 如果没有默认服务器，返回第一个
        return servers.length > 0 ? servers[0] : null;
    }

    // 获取所有服务器
    getServers(): WebDAVServer[] {
        return this.settings.servers;
    }

    // 根据ID获取服务器
    getServerById(id: string): WebDAVServer | null {
        return this.settings.servers.find(s => s.id === id) || null;
    }

    // 激活视图
    async activateView() {
        const {workspace} = this.app;
        const t = this.i18n();

        // 总是使用默认服务器，忽略当前选中的服务器
        const defaultServer = this.getDefaultServer();
        if (!defaultServer) {
            new Notice(t.settings.serverListEmpty);
            return;
        }

        // 设置当前服务器为默认服务器
        this.settings.currentServerId = defaultServer.id;
        await this.saveSettings();

        // 查找已存在的视图
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_WEBDAV_EXPLORER)[0];

        if (leaf) {
            workspace.revealLeaf(leaf);
            // 强制刷新视图，使用默认服务器
            if (leaf.view instanceof WebDAVExplorerView) {
                // 完全重新初始化视图
                await leaf.view.onunload();
                await leaf.view.onOpen();
            }
            return;
        }

        // 创建新视图
        const rightLeaf = workspace.getRightLeaf(false);
        if (rightLeaf) {
            await rightLeaf.setViewState({
                type: VIEW_TYPE_WEBDAV_EXPLORER,
                active: true,
            });
            workspace.revealLeaf(rightLeaf);
        } else {
            const newLeaf = workspace.createLeafBySplit(workspace.getLeaf(), 'vertical');
            await newLeaf.setViewState({
                type: VIEW_TYPE_WEBDAV_EXPLORER,
                active: true,
            });
            workspace.revealLeaf(newLeaf);
        }
    }

    // 可选：添加一个方法来激活特定服务器的视图（用于其他场景）
    async activateViewWithServer(serverId?: string) {
        const {workspace} = this.app;
        const t = this.i18n();

        // 设置当前服务器
        if (serverId) {
            this.settings.currentServerId = serverId;
            await this.saveSettings();
        }

        // 检查是否有可用的服务器
        const currentServer = this.getCurrentServer();
        if (!currentServer) {
            new Notice(t.settings.serverListEmpty);
            return;
        }

        // 查找已存在的视图
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_WEBDAV_EXPLORER)[0];

        if (leaf) {
            workspace.revealLeaf(leaf);
            // 强制刷新视图，包括重新初始化
            if (leaf.view instanceof WebDAVExplorerView) {
                // 完全重新初始化视图
                await leaf.view.onunload();
                await leaf.view.onOpen();
            }
            return;
        }

        // 创建新视图
        const rightLeaf = workspace.getRightLeaf(false);
        if (rightLeaf) {
            await rightLeaf.setViewState({
                type: VIEW_TYPE_WEBDAV_EXPLORER,
                active: true,
            });
            workspace.revealLeaf(rightLeaf);
        } else {
            const newLeaf = workspace.createLeafBySplit(workspace.getLeaf(), 'vertical');
            await newLeaf.setViewState({
                type: VIEW_TYPE_WEBDAV_EXPLORER,
                active: true,
            });
            workspace.revealLeaf(newLeaf);
        }
    }

    // 注册拖拽功能（空实现）
    registerDragAndDrop() {
        // 空实现
    }

    // 插件卸载清理
    onunload() {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WEBDAV_EXPLORER);

        // 卸载所有视图
        for (const leaf of leaves) {
            if (leaf.view && typeof leaf.view.onunload === 'function') {
                try {
                    leaf.view.onunload();
                } catch (e) {
                    console.error('Error unloading view:', e);
                }
            }
            leaf.detach();
        }

        // 重置设置
        this.settings = DEFAULT_SETTINGS;
    }

    // 加载设置
    async loadSettings() {
        const data = await this.loadData();
        this.settings = {...DEFAULT_SETTINGS, ...data}; // 合并默认设置
    }

    // 保存设置
    async saveSettings() {
        await this.saveData(this.settings);
    }

    // 保存语言设置到插件存储（供设置面板调用）
    public setLocale(locale: Locale): void {
        if (isValidLocale(locale)) {
            setI18n(locale);
            saveLocaleSetting(this.app, locale);
            saveLocaleSetting(this.app, locale);
            // 可以在这里添加界面刷新的逻辑
        }
    }
}