import {getLanguage} from 'obsidian';

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
        url: string;
        username: string;
        password: string;
        remoteDir: string;
        urlPrefix: SettingItem;
        downloadPath: SettingItem;
        deleteServer: string;
        defaultServer: string;
        defaultServerDesc: string;
        noServersAvailable: string;
        serverName: string;
        deleteNotice: string;
        serverList: string;
        serverListEmpty: string;
        duplicateName: string;
        nameRequired: string;
        unloadError: string;
    };
    view: {
        connectionFailed: string;
        listFailed: string;
        refreshFailed: string;
        error: string;
        emptyDir: string;
        currentPath: string;
        refreshSuccess: string;
        opening: string;
        openFailed: string;
        rootDirectory: string;
        loading: string;
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
        selectServer: string;
        switchSuccess: string;
        switchFailed: string;
    };
    contextMenu: {
        copyUrl: string;
        download: string;
        downloading: string;
        urlCopied: string;
        copyFailed: string;
        downloadSuccess: string;
        downloadFailed: string;
        connectionError: string;
        fileTooLarge: string;
        writePermissionError: string;
    }
}

// 英文语言包
const en: LangPack = {
    displayName: 'WebDAV explorer',
    settings: {
        title: 'WebDAV settings',
        addServer: 'Add webdav server',
        url: 'WebDAV server URL', // 简化为字符串
        username: 'Username',
        password: 'Password',
        remoteDir: 'Remote directory', // 简化为字符串
        urlPrefix: {
            name: 'URL prefix',
            desc: 'URL prefix to replace,otherwise keep it empty'
        },
        downloadPath: {
            name: 'Download path',
            desc: 'Leave empty or set to "/", then use default root directory',
        },
        deleteServer: 'Delete server',
        defaultServer: 'Default server',
        defaultServerDesc: 'Select the default server to use when opening webdav explorer',
        noServersAvailable: 'No servers available',
        serverName: 'Server name',
        deleteNotice: 'Cannot delete the last server. At least one server is required.',
        serverList: 'WebDAV servers list',
        serverListEmpty: 'Please configure at least one webdav server in settings',
        duplicateName: 'Server name already exists, please use a different name',
        nameRequired: 'Server name cannot be empty',
        unloadError: 'Failed to unload webdav explorer',
    },
    view: {
        connectionFailed: 'Connection failed',
        listFailed: 'Failed to list directory',
        refreshFailed: 'Refresh failed',
        error: 'Error',
        emptyDir: 'Empty directory',
        currentPath: 'Current path',
        refreshSuccess: 'Refresh success',
        opening: 'Opening file...',
        openFailed: 'Failed to open file',
        rootDirectory: 'Home directory',
        loading: 'Loading...',
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
        selectServer: 'Choose a server',
        switchSuccess: 'Switch success',
        switchFailed: 'Switch failed',
    },
    contextMenu: {
        copyUrl: 'Copy URL link',
        download: 'Download to local',
        downloading: 'Downloading',
        urlCopied: 'URL copied to clipboard',
        copyFailed: 'Copy failed',
        downloadSuccess: 'Download success',
        downloadFailed: 'Download failed',
        connectionError: 'Connection error',
        fileTooLarge: 'File too large',
        writePermissionError: 'Write permission error',
    }
};

// 中文语言包
const zh: LangPack = {
    displayName: 'Webdav 资源管理器',
    settings: {
        title: 'WebDAV 设置',
        addServer: '添加 WebDAV 服务器',
        url: 'WebDAV 服务器地址', // 简化为字符串
        username: '用户名',
        password: '密码',
        remoteDir: '远程目录', // 简化为字符串
        urlPrefix: {
            name: 'URL前缀替换',
            desc: '替换拖拽生成的URL前缀,否则保持为空'
        },
        downloadPath: {
            name: '下载路径',
            desc: '留空或设置为 "/",则使用默认根目录',
        },
        deleteServer: '删除服务器',
        defaultServer: '默认服务器',
        defaultServerDesc: '选择打开 WebDAV 资源管理器时使用的默认服务器',
        noServersAvailable: '无可用服务器',
        serverName: '服务器名称',
        deleteNotice: '无法删除最后一个服务器。至少需要一个服务器。',
        serverList: 'WebDAV 服务器列表',
        serverListEmpty: '请在设置中配置至少一个 WebDAV 服务器',
        duplicateName: '服务器名称已存在，请使用其他名称',
        nameRequired: '服务器名称不能为空',
        unloadError: '卸载 WebDAV 资源管理器失败',
    },
    view: {
        connectionFailed: '连接失败',
        listFailed: '获取目录列表失败',
        refreshFailed: '刷新失败',
        error: '错误',
        emptyDir: '空文件夹',
        currentPath: '当前路径',
        refreshSuccess: '刷新成功',
        opening: '正在打开文件...',
        openFailed: '打开文件失败',
        rootDirectory: '根目录',
        loading: '加载中...',
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
        selectServer: '选择服务器',
        switchSuccess: '切换成功',
        switchFailed: '切换失败',
    },
    contextMenu: {
        copyUrl: '复制 URL 链接',
        download: '下载到本地',
        downloading: '下载中',
        urlCopied: 'URL 已复制到剪贴板',
        copyFailed: '复制失败',
        downloadSuccess: '下载成功',
        downloadFailed: '下载失败',
        connectionError: '连接错误',
        fileTooLarge: '文件过大',
        writePermissionError: '写入权限错误',
    }
};

// 所有语言包
const locales = {en, zh};

// 获取系统语言
export function getSystemLocale(): Locale {
    try {
        const obsidianLanguage = getLanguage();
        return obsidianLanguage.toLowerCase().startsWith('zh') ? 'zh' : 'en';
    } catch {
        // 如果 getLanguage 失败，使用浏览器语言作为后备
        const browserLanguage = navigator.language || 'en';
        return browserLanguage.startsWith('zh') ? 'zh' : 'en';
    }
}

// 获取当前语言包
export function i18n(): LangPack {
    const currentLocale = getSystemLocale();
    return locales[currentLocale];
}