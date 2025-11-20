import {getLanguage} from 'obsidian';

interface SettingItem {
    name: string;
    desc: string;
}

export interface LangPack {
    displayName: string;
    settings: {
        // 服务器管理
        addServer: string;
        editServer: string;
        deleteServer: string;
        serverName: string;
        defaultServer: string;
        defaultServerDesc: string;
        currentServer: string;
        setAsDefault: string;
        setAsDefaultDesc: string;
        noServersAvailable: string;
        clickAddToCreate: string;

        // 服务器配置
        url: string;
        urlDesc?: string;
        username: string;
        password: string;
        remoteDir: string;
        remoteDirDesc?: string;
        urlPrefix: SettingItem;
        downloadPath: SettingItem;

        // 表单验证和提示
        nameRequired: string;
        urlRequired: string;
        duplicateName: string;
        deleteNotice: string;
        confirmDelete: string;
        serverListEmpty: string;
        unloadError: string;

        // 操作按钮
        save: string;
        cancel: string;
        edit: string;
        delete: string;

        // 状态提示
        serverAdded: string;
        serverUpdated: string;
        serverDeleted: string;
        defaultServerUpdated: string;
        saveFailed: string;

        // 标识文本
        default: string;
        current: string;
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

// 英文语言包
const en: LangPack = {
    displayName: 'WebDAV Explorer',
    settings: {
        // 服务器管理
        addServer: 'Add WebDAV Server',
        editServer: 'Edit WebDAV Server',
        deleteServer: 'Delete Server',
        serverName: 'Server Name',
        defaultServer: 'Default Server',
        defaultServerDesc: 'Default server when opening explorer',
        currentServer: 'Current Server',
        setAsDefault: 'Set as Default Server',
        setAsDefaultDesc: 'Set this server as the default server',
        noServersAvailable: 'No servers available',
        clickAddToCreate: 'Click the "Add Server" button below to create your first server configuration',

        // 服务器配置
        url: 'Server URL',
        urlDesc: 'Full WebDAV server URL (e.g., http://example.com/dav)',
        username: 'Username',
        password: 'Password',
        remoteDir: 'Remote Directory',
        remoteDirDesc: 'Remote directory path on the server',
        urlPrefix: {
            name: 'URL Prefix',
            desc: 'Replace URL prefix for drag-and-drop links'
        },
        downloadPath: {
            name: 'Download Path',
            desc: 'Empty or "/" for root directory',
        },

        // 表单验证和提示
        nameRequired: 'Server name cannot be empty',
        urlRequired: 'Server URL cannot be empty',
        duplicateName: 'Server name already exists',
        deleteNotice: 'Cannot delete the last server',
        confirmDelete: 'Are you sure you want to delete this server?',
        serverListEmpty: 'Server list is empty',
        unloadError: 'Failed to unload WebDAV explorer',

        // 操作按钮
        save: 'Save',
        cancel: 'Cancel',
        edit: 'Edit',
        delete: 'Delete',

        // 状态提示
        serverAdded: 'Server added successfully',
        serverUpdated: 'Server updated successfully',
        serverDeleted: 'Server deleted successfully',
        defaultServerUpdated: 'Default server updated',
        saveFailed: 'Failed to save server configuration',

        // 标识文本
        default: 'Default',
        current: 'Current'
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

// 中文语言包
const zh: LangPack = {
    displayName: 'WebDAV 资源管理器',
    settings: {
        // 服务器管理
        addServer: '添加 WebDAV 服务器',
        editServer: '编辑 WebDAV 服务器',
        deleteServer: '删除服务器',
        serverName: '服务器名称',
        defaultServer: '默认服务器',
        defaultServerDesc: '打开资源管理器时的默认服务器',
        currentServer: '当前服务器',
        setAsDefault: '设为默认服务器',
        setAsDefaultDesc: '将此服务器设置为默认服务器',
        noServersAvailable: '没有可用的服务器',
        clickAddToCreate: '点击下方的"添加服务器"按钮创建第一个服务器配置',

        // 服务器配置
        url: '服务器地址',
        urlDesc: '完整的 WebDAV 服务器地址（例如：http://example.com/dav）',
        username: '用户名',
        password: '密码',
        remoteDir: '远程目录',
        remoteDirDesc: '服务器上的远程目录路径',
        urlPrefix: {
            name: 'URL前缀',
            desc: '替换拖拽链接的URL前缀'
        },
        downloadPath: {
            name: '下载路径',
            desc: '留空或"/"使用根目录',
        },

        // 表单验证和提示
        nameRequired: '服务器名称不能为空',
        urlRequired: '服务器地址不能为空',
        duplicateName: '服务器名称已存在',
        deleteNotice: '无法删除最后一个服务器',
        confirmDelete: '确定要删除此服务器吗？',
        serverListEmpty: '服务器列表为空',
        unloadError: '卸载 WebDAV 资源管理器失败',

        // 操作按钮
        save: '保存',
        cancel: '取消',
        edit: '编辑',
        delete: '删除',

        // 状态提示
        serverAdded: '服务器添加成功',
        serverUpdated: '服务器更新成功',
        serverDeleted: '服务器删除成功',
        defaultServerUpdated: '默认服务器已更新',
        saveFailed: '保存服务器配置失败',

        // 标识文本
        default: '默认',
        current: '当前'
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
const locales: Record<Locale, LangPack> = {zh, en};

// 获取系统语言
function getSystemLocale(): Locale {
    const language = getLanguage() || navigator.language || 'en';
    return language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export class I18nService {
    // 当前语言包实例
    public t: LangPack;

    constructor() {
        // 初始化时根据系统语言设置
        this.t = locales[getSystemLocale()];
    }

    /**
     * 切换语言
     */
    public setLocale(locale: Locale): void {
        this.t = locales[locale] || locales.en;
    }

    /**
     * 获取当前语言
     */
    public getCurrentLocale(): Locale {
        return this.t === zh ? 'zh' : 'en';
    }

    /**
     * 获取所有支持的语言
     */
    public getSupportedLocales(): Array<{code: Locale; name: string}> {
        return [
            {code: 'en', name: 'English'},
            {code: 'zh', name: '中文'}
        ];
    }
}

// 创建单例实例
export const i18n = new I18nService();