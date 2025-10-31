import {Notice, Plugin} from 'obsidian';
import { WebDAVSettingTab } from './WebDAVSettingTab';
import { WebDAVExplorerView } from './WebDAVExplorerView';
import {setI18n, i18n, LangPack, Locale} from './i18n';
import { WebDAVSettings, DEFAULT_SETTINGS, WebDAVServer, VIEW_TYPE_WEBDAV_EXPLORER } from './types';

export default class WebDAVPlugin extends Plugin {
	settings: WebDAVSettings = DEFAULT_SETTINGS;

	// 获取国际化文本
	i18n(): LangPack {
		return i18n();
	}

	async onload() {
		await this.loadSettings();

		// 初始化语言设置
		const locale = this.getLocale();
		setI18n(locale);

		this.addStyle(); // 添加CSS样式

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
			setTimeout(() => this.activateView(), 300);
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


	addStyle() {
		if (document.getElementById('webdav-explorer-style')) {
			return;
		}

		const style = document.createElement('style');
		style.id = 'webdav-explorer-style';
		style.textContent = `
			.webdav-connection-failed {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				height: 100%;
				gap: 16px;
				padding: 20px;
				text-align: center;
			}
			
			.webdav-connection-failed p {
				margin: 0;
				color: var(--text-muted);
				font-size: 1.1em;
			}
			
			.webdav-error-details {
				font-size: 0.9em !important;
				color: var(--text-error) !important;
				word-break: break-word;
				max-width: 100%;
			}
			
			.webdav-explorer-view {
				height: 100%;
				display: flex;
				flex-direction: column;
			}
			
			.webdav-header {
				display: flex;
				flex-direction: column;
				gap: 8px;
				padding: 10px 0;
				border-bottom: 1px solid var(--background-modifier-border);
				margin-bottom: 10px;
				flex-shrink: 0;
			}
			
			.webdav-title-row {
				display: flex;
				align-items: center;
				gap: 8px;
				padding: 0 8px;
			}
			
			.webdav-button {
				display: flex;
				align-items: center;
				padding: 6px 8px;
				border-radius: 4px;
				cursor: pointer;
				transition: all 0.15s ease;
				color: var(--text-muted);
				border: 1px solid var(--background-modifier-border);
				background-color: var(--background-primary);
				user-select: none;
			}
			
			.webdav-button:hover {
				background-color: var(--background-modifier-hover);
				color: var(--text-normal);
				border-color: var(--background-modifier-border-hover);
			}
			
			.webdav-button-content {
				display: flex;
				align-items: center;
				gap: 4px;
			}

			.webdav-server-icon,
			.webdav-refresh-icon,
			.webdav-sort-icon {
				display: flex;
				align-items: center;
				width: 16px;
				height: 16px;
			}
			
			.webdav-button-text {
				font-size: 0.8em;
				color: var(--text-muted);
				white-space: nowrap;
				font-weight: 500;
			}
			
			.webdav-button:hover .webdav-button-text {
				color: var(--text-normal);
			}

			.webdav-button-content {
				display: flex;
				align-items: center;
				gap: 4px;
			}
			
			.webdav-server-icon,
			.webdav-refresh-icon,
			.webdav-sort-icon {
				display: flex;
				align-items: center;
				width: 16px;
				height: 16px;
			}
			
			.webdav-button-text {
				font-size: 0.8em;
				color: var(--text-muted);
				white-space: nowrap;
				font-weight: 500;
			}
			
			.webdav-server-button:hover .webdav-button-text,
			.webdav-refresh-button:hover .webdav-button-text,
			.webdav-sort-button:hover .webdav-button-text {
				color: var(--text-normal);
			}
			
			.webdav-actions-container {
				display: flex;
				align-items: center;
				gap: 8px;
			}
			
			.webdav-display-name {
				font-size: 0.9em;
				font-weight: 600;
				color: var(--text-normal);
				white-space: nowrap;
				margin-left: 8px;
			}
			

			.webdav-breadcrumb-container {
				padding: 0 8px;
			}
			
			.webdav-breadcrumb {
				display: flex;
				align-items: center;
				flex-wrap: wrap;
				gap: 4px;
				font-size: 0.9em;
				color: var(--text-muted);
			}
			
			.breadcrumb-item {
				display: flex;
				align-items: center;
			}
			
			
			.breadcrumb-item a {
				display: flex;
				align-items: center;
				text-decoration: none;
				color: var(--text-muted);
				padding: 2px 6px;
				border-radius: 3px;
				transition: all 0.15s ease;
				cursor: pointer;
				max-width: 120px;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			
			.breadcrumb-item a:hover {
				background-color: var(--background-modifier-hover);
				color: var(--text-normal);
			}
			
			.breadcrumb-current {
				color: var(--text-normal) !important;
				font-weight: 500;
				cursor: default !important;
				background: none !important;
			}
			
			.breadcrumb-separator {
				display: flex;
				align-items: center;
				color: var(--text-faint);
				user-select: none;
			}
			
			.breadcrumb-separator svg {
				width: 14px;
				height: 14px;
				opacity: 0.5;
			}

			.file-list-container {
				flex: 1;
				display: flex;
				flex-direction: column;
				overflow: hidden;
			}
			
			.file-list {
				flex: 1;
				overflow-y: auto;
				overflow-x: hidden;
			}
			
			.file-item {
				padding: 8px 12px;
				margin: 2px 0;
				cursor: pointer;
				transition: all 0.15s ease;
				user-select: none;
				border-radius: 6px;
				border: 1px solid transparent;
				display: flex;
				align-items: center;
				gap: 8px;
				min-height: 28px;
				box-sizing: border-box;
			}
		
			.file-item.folder .file-name {
				color: var(--text-normal);
				font-weight: 500;
			}
		
			.file-item.file .file-name {
				color: var(--text-muted);
			}
			
			.file-item.selected .file-name {
				color: var(--text-on-accent) !important;
			}
			
			.file-icon {
				width: 16px;
				height: 16px;
				flex-shrink: 0;
				display: flex;
				align-items: center;
				justify-content: center;
			}
			
			.file-name {
				flex: 1;
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			
			.file-item.selected {
				background-color: var(--interactive-accent);
				color: var(--text-on-accent);
				border-radius: 4px;
			}
			
			.file-item:hover:not(.selected) {
				background-color: var(--background-modifier-hover);
				border-radius: 4px;
			}
			
			.file-item.empty {
				color: var(--text-muted);
				font-style: italic;
				cursor: default;
			}
			
			.file-item.error {
				color: var(--text-error);
				cursor: default;
			}
			
			.file-item.loading {
				color: var(--text-muted);
				font-style: italic;
				cursor: default;
			}
			
			.file-list::-webkit-scrollbar {
				width: 8px;
			}
			
			.file-list::-webkit-scrollbar-track {
				background: var(--background-primary);
			}
			
			.file-list::-webkit-scrollbar-thumb {
				background: var(--background-modifier-border);
				border-radius: 4px;
			}
			
			.file-list::-webkit-scrollbar-thumb:hover {
				background: var(--background-modifier-border-hover);
			}
			
			.webdav-no-servers {
				text-align: center;
				color: var(--text-muted);
				font-style: italic;
				padding: 20px;
			}
			
			.webdav-no-server {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				height: 100%;
				gap: 16px;
				padding: 20px;
				text-align: center;
			}
			
			.webdav-no-server p {
				margin: 0;
				color: var(--text-muted);
				font-size: 1.1em;
			}
			
			.webdav-no-servers {
				text-align: center;
				color: var(--text-muted);
				font-style: italic;
				padding: 20px;
				border: 1px dashed var(--background-modifier-border);
				border-radius: 8px;
				margin: 10px 0;
			}
			
			.clickable-icon {
				cursor: pointer;
				transition: all 0.15s ease;
			}
			
			.clickable-icon:hover {
				transform: scale(1.02);
			}
			
			.clickable-icon:active {
				transform: scale(0.98);
			}
		`;
		document.head.appendChild(style);
	}

	// 注册拖拽功能（空实现）
	registerDragAndDrop() {
		// 空实现
	}

	// 插件卸载清理
	async onunload() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WEBDAV_EXPLORER);

		// 卸载所有视图
		for (const leaf of leaves) {
			if (leaf.view && typeof leaf.view.onunload === 'function') {
				try {
					await leaf.view.onunload();
				} catch (e) {
					console.error('Error unloading view:', e);
				}
			}
			leaf.detach();
		}

		// 移除样式
		const style = document.getElementById('webdav-explorer-style');
		if (style) {
			style.remove();
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

	// 获取语言设置
	private getLocale(): Locale {
		try {
			const language = localStorage.getItem('language');
			return language?.startsWith('zh') ? 'zh' : 'en'; // 中文或英文
		} catch (e) {
			return 'en';
		}
	}
}

