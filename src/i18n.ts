import { App } from 'obsidian';

// 定义语言类型
export type Locale = 'zh' | 'en';

// 定义设置项的类型
export interface SettingItem {
	name: string;
	desc: string;
}

// 定义每种语言的翻译包结构
export interface LangPack {
	displayName: string;
	settings: {
		title: string;
		addServer: string;
		noServers: string;
		url: SettingItem;
		username: string;
		password: string;
		remoteDir: SettingItem;
		deleteServer: string;
		defaultServer: string;
		defaultServerDesc: string;
		noServersAvailable: string;
		serverName: string;
		deleteNotice: string;
		serverList: string;
		serverListEmpty: string;
	};
	view: {
		pleaseConfigure: string;
		connectionFailed: string;
		listFailed: string;
		refreshFailed: string;
		error: string;
		emptyDir: string;
		currentPath: string;
		refreshing: string;
		opening: string;
		openFailed: string;
		rootDirectory: string;
		loading: string;
		retry: string;
		retryPrompt: string;
		refresh: string;
		sort: string;
		sortByNameAsc: string;
		sortByNameDesc: string;
		sortByTypeAsc: string;
		sortByTypeDesc: string;
		sortBySizeAsc: string;
		sortBySizeDesc: string;
		sortByDateAsc: string;
		sortByDateDesc: string;
	};
}

// 英文语言包
const en: LangPack = {
	displayName: 'WebDAV explorer',
	settings: {
		title: 'WebDAV settings',
		addServer: 'Add webdav server',
		noServers: 'No webdav servers configured. Click the "+" button to add one.',
		url: {
			name: 'WebDAV server URL',
			desc: 'The full URL of your webdav server'
		},
		username: 'Username',
		password: 'Password',
		remoteDir: {
			name: 'Remote directory',
			desc: 'Remote directory path (e.g., /notes)'
		},
		deleteServer: 'Delete server',
		defaultServer: 'Default server',
		defaultServerDesc: 'Select the default server to use when opening webdav explorer',
		noServersAvailable: 'No servers available',
		serverName: 'Server name',
		deleteNotice: 'Cannot delete the last server. At least one server is required.',
		serverList: 'WebDAV servers list',
		serverListEmpty: 'Please configure at least one webdav server in settings',
	},
	view: {
		pleaseConfigure: 'Please configure webdav settings in plugin preferences',
		connectionFailed: 'Connection failed',
		listFailed: 'Failed to list directory',
		refreshFailed: 'Refresh failed',
		error: 'Error',
		emptyDir: 'Empty directory',
		currentPath: 'Current path',
		refreshing: 'Refreshing...',
		opening: 'Opening file...',
		openFailed: 'Failed to open file',
		rootDirectory: 'Home directory',
		loading: 'Loading...',
		retry: 'Retry',
		retryPrompt: 'Loading failed, click to retry',
		refresh: 'Refresh',
		sort: 'Sort',
		sortByNameAsc: 'Name (a-z)',
		sortByNameDesc: 'Name (z-a)',
		sortByTypeAsc: 'Type (a-z)',
		sortByTypeDesc: 'Type (z-a)',
		sortBySizeAsc: 'Size (small-large)',
		sortBySizeDesc: 'Size (large-small)',
		sortByDateAsc: 'Date (old-new)',
		sortByDateDesc: 'Date (new-old)',
	}
};

// 中文语言包
const zh: LangPack = {
	displayName: 'Webdav 资源管理器',
	settings: {
		title: 'WebDAV 设置',
		addServer: '添加 WebDAV 服务器',
		noServers: '未配置 WebDAV 服务器。点击"+"按钮添加一个。',
		url: {
			name: 'WebDAV 服务器地址',
			desc: 'WebDAV 服务器的完整 URL'
		},
		username: '用户名',
		password: '密码',
		remoteDir: {
			name: '远程目录',
			desc: '远程目录路径（例如：/notes）'
		},
		deleteServer: '删除服务器',
		defaultServer: '默认服务器',
		defaultServerDesc: '选择打开 WebDAV 资源管理器时使用的默认服务器',
		noServersAvailable: '无可用服务器',
		serverName: '服务器名称',
		deleteNotice: '无法删除最后一个服务器。至少需要一个服务器。',
		serverList: 'WebDAV 服务器列表',
		serverListEmpty: '请在设置中配置至少一个 WebDAV 服务器',
	},
	view: {
		pleaseConfigure: '请在插件设置中配置 WebDAV 连接信息',
		connectionFailed: '连接失败',
		listFailed: '获取目录列表失败',
		refreshFailed: '刷新失败',
		error: '错误',
		emptyDir: '空文件夹',
		currentPath: '当前路径',
		refreshing: '刷新中...',
		opening: '正在打开文件...',
		openFailed: '打开文件失败',
		rootDirectory: '根目录',
		loading: '加载中...',
		retry: '重试',
		retryPrompt: '加载失败，点击重试',
		refresh: '刷新',
		sort: '排序',
		sortByNameAsc: '名称（A-Z）',
		sortByNameDesc: '名称（Z-A）',
		sortByTypeAsc: '类型（A-Z）',
		sortByTypeDesc: '类型（Z-A）',
		sortBySizeAsc: '大小（小-大）',
		sortBySizeDesc: '大小（大-小）',
		sortByDateAsc: '日期（旧-新）',
		sortByDateDesc: '日期（新-旧）',
	}
};

// 所有语言包
const locales = { en, zh };

// 当前语言
let currentLocale: Locale = 'en';


// 初始化语言设置
export function initI18n(app: App): void {
	currentLocale = getSystemLocale(app);
}

// 获取系统语言
export function getSystemLocale(app: App): Locale {
	try {
		// 通过界面文本检测语言
		const languageIndicators = {
			'zh': ['文件', '编辑', '查看', '设置', '帮助'],
			'en': ['File', 'Edit', 'View', 'Settings', 'Help']
		};

		const bodyText = document.body.innerText;
		for (const [lang, indicators] of Object.entries(languageIndicators)) {
			for (const indicator of indicators) {
				if (bodyText.includes(indicator)) {
					return lang as Locale;
				}
			}
		}

		// 如果无法检测到 Obsidian 语言，使用浏览器语言作为后备
		const browserLanguage = navigator.language || navigator.languages[0];
		if (browserLanguage?.startsWith('zh')) {
			return 'zh';
		}

		return 'en';
	} catch (e) {
		console.error('Failed to load locale setting:', e);
		return 'en';
	}
}

// 获取当前语言包
export function i18n(): LangPack {
	return locales[currentLocale];
}

