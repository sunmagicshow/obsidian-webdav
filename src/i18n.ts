import {getLanguage} from 'obsidian';


interface SettingItem {
    name: string;
    desc: string;
}

export interface LangPack {
    displayName: string;
    settings: {
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
        serverName: string;
        deleteNotice: string;
        serverListEmpty: string;
        duplicateName: string;
        nameRequired: string;
        unloadError: string;
        noServersAvailable: string;
    };
    view: {
        connectionFailed: string;
        listFailed: string;
        refreshFailed: string;
        refreshSuccess: string;
        emptyDir: string;
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
    };
    contextMenu: {
        copyUrl: string;
        download: string;
        urlCopied: string;
        copyFailed: string;
        downloadSuccess: string;
        downloadFailed: string;
        connectionError: string;
    };
}

// 英文语言包 - 移除重复和冗余的翻译
const en: LangPack = {
    displayName: 'WebDAV Explorer',
    settings: {
        addServer: 'Add WebDAV server',
        url: 'Server URL',
        username: 'Username',
        password: 'Password',
        remoteDir: 'Remote directory',
        urlPrefix: {
            name: 'URL prefix',
            desc: 'Replace URL prefix for drag-and-drop links'
        },
        downloadPath: {
            name: 'Download path',
            desc: 'Empty or "/" for root directory',
        },
        deleteServer: 'Delete server',
        defaultServer: 'Default server',
        defaultServerDesc: 'Default server when opening explorer',
        serverName: 'Server name',
        deleteNotice: 'Cannot delete the last server',
        serverListEmpty: 'Server list is empty',
        duplicateName: 'Server name already exists',
        nameRequired: 'Server name cannot be empty',
        unloadError: 'Failed to unload WebDAV explorer',
        noServersAvailable   : 'No servers available',
    },
    view: {
        connectionFailed: 'Connection failed',
        listFailed: 'Failed to list directory',
        refreshFailed: 'Refresh failed',
        refreshSuccess: 'Refresh success',
        emptyDir: 'Empty directory',
        opening: 'Opening file...',
        openFailed: 'Failed to open file',
        rootDirectory: 'Home',
        loading: 'Loading...',
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
        selectServer: 'Select server',
        switchSuccess: 'Switch success',
    },
    contextMenu: {
        copyUrl: 'Copy URL',
        download: 'Download',
        urlCopied: 'URL copied',
        copyFailed: 'Copy failed',
        downloadSuccess: 'Download success',
        downloadFailed: 'Download failed',
        connectionError: 'Connection error',
    }
};

// 中文语言包 - 同样精简
const zh: LangPack = {
    displayName: 'WebDAV 资源管理器',
    settings: {
        addServer: '添加 WebDAV 服务器',
        url: '服务器地址',
        username: '用户名',
        password: '密码',
        remoteDir: '远程目录',
        urlPrefix: {
            name: 'URL前缀',
            desc: '替换拖拽链接的URL前缀'
        },
        downloadPath: {
            name: '下载路径',
            desc: '留空或"/"使用根目录',
        },
        deleteServer: '删除服务器',
        defaultServer: '默认服务器',
        defaultServerDesc: '打开资源管理器时的默认服务器',
        serverName: '服务器名称',
        deleteNotice: '无法删除最后一个服务器',
        serverListEmpty: '服务器列表为空',
        duplicateName: '服务器名称已存在',
        nameRequired: '服务器名称不能为空',
        unloadError: '卸载 WebDAV 资源管理器失败',
        noServersAvailable: '没有可用的服务器',
    },
    view: {
        connectionFailed: '连接失败',
        listFailed: '获取目录失败',
        refreshFailed: '刷新失败',
        refreshSuccess: '刷新成功',
        emptyDir: '空目录',
        opening: '正在打开文件...',
        openFailed: '打开文件失败',
        rootDirectory: '首页',
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
    },
    contextMenu: {
        copyUrl: '复制链接',
        download: '下载',
        urlCopied: '链接已复制',
        copyFailed: '复制失败',
        downloadSuccess: '下载成功',
        downloadFailed: '下载失败',
        connectionError: '连接错误',
    }
};

// 定义语言类型
type Locale = 'zh' | 'en';

// 语言包映射
const locales: Record<Locale, LangPack> = {en, zh};

// 获取系统语言
function getSystemLocale(): Locale {
    const language = getLanguage() || navigator.language || 'en';
    return language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

// 获取当前语言包
export function i18n(): LangPack {
    return locales[getSystemLocale()];
}