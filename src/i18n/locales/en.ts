import { LangPack } from '../types';

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

export default en;