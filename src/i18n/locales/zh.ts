import { LangPack } from '../types';

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

export default zh;
