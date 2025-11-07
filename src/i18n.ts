// src/i18n.ts

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

const en: LangPack = {
	displayName: 'WebDAV Explorer',
	settings: {
		title: 'WebDAV Settings',
		addServer: 'Add WebDAV Server',
		noServers: 'No WebDAV servers configured. Click the "+" button to add one.',
		url: {
			name: 'WebDAV Server URL',
			desc: 'The full URL of your WebDAV server'
		},
		username: 'Username',
		password: 'Password',
		remoteDir: {
			name: 'Remote Directory',
			desc: 'Remote directory path (e.g., /notes)'
		},
		deleteServer: 'Delete Server',
		defaultServer: 'Default Server',
		defaultServerDesc: 'Select the default server to use when opening WebDAV Explorer',
		noServersAvailable: 'No servers available',
		serverName: 'Server Name',
		deleteNotice: 'Cannot delete the last server. At least one server is required.',
		serverList: 'WebDAV Servers List',
		serverListEmpty: 'Please configure at least one WebDAV server in settings',
	},
	view: {
		pleaseConfigure: 'Please configure WebDAV settings in plugin preferences',
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
		sortByNameAsc: 'Name (A-Z)',
		sortByNameDesc: 'Name (Z-A)',
		sortByTypeAsc: 'Type (A-Z)',
		sortByTypeDesc: 'Type (Z-A)',
		sortBySizeAsc: 'Size (Small-Large)',
		sortBySizeDesc: 'Size (Large-Small)',
		sortByDateAsc: 'Date (Old-New)',
		sortByDateDesc: 'Date (New-Old)',
	}
};

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
const locales = {
	en,
	zh
};

// 存储键名
const LANGUAGE_STORAGE_KEY = 'webdav-plugin-language';

// 当前语言
let currentLocale: Locale = 'en';

// 验证语言是否支持
export function isValidLocale(locale: string): locale is Locale {
	return locale === 'zh' || locale === 'en';
}

// 初始化语言设置（需要在插件初始化时调用）
export function initI18n(app: App): void {
	currentLocale = getSystemLocale(app);
}

// 获取系统语言
export function getSystemLocale(app: App): Locale {
	try {
		// 首先尝试从插件存储中读取
		const storedLanguage = app.loadLocalStorage(LANGUAGE_STORAGE_KEY);
		if (storedLanguage && isValidLocale(storedLanguage)) {
			return storedLanguage;
		}

		// 如果没有存储的值，使用浏览器语言
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

// 保存语言设置到插件存储
export function saveLocaleSetting(app: App, locale: Locale): void {
	try {
		app.saveLocalStorage(LANGUAGE_STORAGE_KEY, locale);
	} catch (e) {
		console.error('Failed to save locale setting:', e);
	}
}

// 设置语言
export function setI18n(locale: Locale): void;
export function setI18n(locale: string): void;
export function setI18n(locale: Locale | string): void {
	if (isValidLocale(locale)) {
		currentLocale = locale;
	} else {
		console.warn(`Unsupported locale: ${locale}, falling back to default`);
		currentLocale = 'en';
	}
}

// 获取当前语言包
export function i18n(): LangPack {
	return locales[currentLocale];
}
//
// // 获取当前语言
// export function getCurrentLocale(): Locale {
// 	return currentLocale;
// }

// // 获取所有支持的语言
// export function getSupportedLocales(): Locale[] {
// 	return Object.keys(locales) as Locale[];
// }