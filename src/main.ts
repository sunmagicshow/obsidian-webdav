import {Notice, Plugin} from 'obsidian';
import {WebDAVSettingTab} from './WebDAVSettingTab';
import {WebDAVExplorerView} from './WebDAVExplorerView';
import {i18n, type LangPack} from './i18n';
import {WebDAVSettings, DEFAULT_SETTINGS, WebDAVServer, VIEW_TYPE_WEBDAV_EXPLORER} from './types';

export default class WebDAVPlugin extends Plugin {
    settings: WebDAVSettings = DEFAULT_SETTINGS;

    async onload() {
        await this.loadSettings();

        // 注册视图
        this.registerView(
            VIEW_TYPE_WEBDAV_EXPLORER,
            (leaf) => new WebDAVExplorerView(leaf, this),
        );

        // 添加设置面板
        this.addSettingTab(new WebDAVSettingTab(this.app, this));

        // 添加ribbon图标
        this.addRibbonIcon('cloud', this.i18n().displayName, () => {
            void this.activateView();
        });

        // 如果有默认服务器，自动打开视图
        if (this.getDefaultServer()) {
            setTimeout(() => {
                void this.activateView();
            }, 300);
        }
    }

    onunload() {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WEBDAV_EXPLORER);
        const t = this.i18n();
        // 卸载所有视图
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

        // 重置设置
        this.settings = DEFAULT_SETTINGS;
    }

    // ==================== 服务器管理 ====================

    getCurrentServer(): WebDAVServer | null {
        const {servers, currentServerName} = this.settings;

        // 优先使用当前选中的服务器
        if (currentServerName) {
            const server = servers.find(s => s.name === currentServerName);
            if (server) return server;
        }

        return this.getDefaultServer();
    }

    getDefaultServer(): WebDAVServer | null {
        const {servers} = this.settings;

        // 首先查找标记为默认的服务器
        const defaultServer = servers.find(s => s.isDefault);
        if (defaultServer) return defaultServer;

        // 如果没有默认服务器，返回第一个
        return servers.length > 0 ? servers[0] : null;
    }

    getServers(): WebDAVServer[] {
        return this.settings.servers;
    }

    getServerByName(name: string): WebDAVServer | null {
        return this.settings.servers.find(s => s.name === name) || null;
    }

    // ==================== 视图管理 ====================

    async activateView() {
        const {workspace} = this.app;
        const t = this.i18n();

        // 总是使用默认服务器
        const defaultServer = this.getDefaultServer();
        if (!defaultServer) {
            new Notice(t.settings.serverListEmpty);
            return;
        }

        // 设置当前服务器为默认服务器
        this.settings.currentServerName = defaultServer.name;
        await this.saveSettings();

        // 查找已存在的视图
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_WEBDAV_EXPLORER)[0];

        if (leaf) {
            await workspace.revealLeaf(leaf);
            // 强制刷新视图，使用默认服务器
            if (leaf.view instanceof WebDAVExplorerView) {
                leaf.view.onunload();
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
            await workspace.revealLeaf(rightLeaf);
        } else {
            const newLeaf = workspace.createLeafBySplit(workspace.getLeaf(), 'vertical');
            await newLeaf.setViewState({
                type: VIEW_TYPE_WEBDAV_EXPLORER,
                active: true,
            });
            await workspace.revealLeaf(newLeaf);
        }
    }

    // ==================== 设置管理 ====================

    // 进一步简化的 loadSettings
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // ==================== 工具方法 ====================

    i18n(): LangPack {
        return i18n();
    }
}