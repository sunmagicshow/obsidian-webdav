import { LangPack } from '../types';

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

export default en;
