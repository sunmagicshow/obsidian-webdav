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

// 语言包映射
export type LangPacks = Record<Locale, LangPack>;
