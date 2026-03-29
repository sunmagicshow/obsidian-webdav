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
        secretId: string;
        secretIdDesc: string;
        selectSecretId: string;
        openKeychain: string;
        keyChainFailed: string;
        remoteDir: string;
        remoteDirDesc?: string;
        urlPrefix: SettingItem;
        downloadPath: SettingItem;

        // 表单验证和提示
        nameRequired: string;
        urlRequired: string;
        duplicateName: string;
        deleteNotice: string;
        serverListEmpty: string;
        unloadSuccess: string;

        // 操作按钮
        save: string;
        cancel: string;
        edit: string;
        copy: string;
        copySuffix: string;
        serverCopied: string;
        delete: string;
        confirmDeleteMessage: string;
        confirm: string;
        deleteFailed: string;

        // 状态提示
        serverAdded: string;
        serverUpdated: string;
        serverDeleted: string;
        defaultServerUpdated: string;
        saveFailed: string;

        // 标识文本
        default: string;
        current: string;
        confirmDelete: string;
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
        dragFromLeft: string;
        noValidFiles: string;
        deleteCompleted: string;
        deleteFailed: string;
        downloadCompleted: string;
        downloadFailed: string;
    };
    webdavClient: {
        webdavClientNotInitialized: string;
        failedToGetFileContents: string;
    };
    contextMenu: {
        copyUrl: string;
        download: string;
        downloading: string;
        urlCopied: string;
        copyFailed: string;
        notSupportFormat: string;
        downloadSuccess: string;
        downloadFailed: string;
        connectionError: string;
        delete: string;
        confirmDeleteRemote: string;
        confirmDeleteMultiple: string;
        deleteSuccess: string;
        deleteFailed: string;
        downloadingFolder: string;
        downloadConflictTitle: string;
        downloadConflictMessage: string;
        overwrite: string;
        renameDownload: string;
        uploadToWebDAV: string;
        uploading: string;
        uploadSuccess: string;
        uploadFailed: string;
        uploadConflictTitle: string;
        uploadConflictMessage: string;
        overwriteUpload: string;
        renameUpload: string;
        noWritePermission: string;
        failedCount: string;
    };
}

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
        urlDesc: '完整的 WebDAV 服务器地址',
        username: '用户名',
        secretId: '钥匙串ID',
        secretIdDesc: '从钥匙串设置中选择',
        selectSecretId: '选择密钥ID',
        openKeychain: '打开钥匙串设置',
        keyChainFailed: '钥匙串设置打开失败',
        remoteDir: '远程目录',
        remoteDirDesc: '服务器上的远程目录路径',
        urlPrefix: {
            name: 'Url前缀',
            desc: '替换拖拽链接的Url前缀'
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
        unloadSuccess: '成功卸载 WebDAV 资源管理器',

        // 操作按钮
        save: '保存',
        cancel: '取消',
        edit: '编辑',
        copy: '复制',
        copySuffix: '_副本',
        serverCopied: '已复制服务器: {name}',
        delete: '删除',
        confirmDeleteMessage: "确定要删除服务器 {name} 吗？此操作无法撤销。",
        confirm: "确认",

        // 状态提示
        serverAdded: '服务器添加成功',
        serverUpdated: '服务器更新成功',
        serverDeleted: '服务器删除成功',
        defaultServerUpdated: '默认服务器已更新',
        saveFailed: '保存服务器配置失败',
        deleteFailed: '删除服务器失败',

        // 标识文本
        default: '默认',
        current: '当前',

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
        dragFromLeft: '请从左侧文件列表拖拽 Obsidian 文件',
        noValidFiles: '未找到有效的文件',
        deleteCompleted: '删除完成: {success} 个成功{failed}',
        deleteFailed: '删除失败: {count} 个文件',
        downloadCompleted: '下载完成: {success} 个成功{failed}',
        downloadFailed: '下载失败: {count} 个文件',
    },
    webdavClient: {
        webdavClientNotInitialized: 'WebDAV 客户端未初始化',
        failedToGetFileContents: '获取文件内容失败',
    },
    contextMenu: {
        copyUrl: '复制链接',
        download: '下载',
        downloading: '正在下载',
        urlCopied: '链接已复制',
        copyFailed: '复制失败',
        notSupportFormat: '不支持的格式,使用系统下载',
        downloadSuccess: '下载成功',
        downloadFailed: '下载失败',
        connectionError: '连接错误',
        delete: '删除',
        confirmDeleteRemote: '确定要删除「{name}」吗？此操作无法撤销。',
        confirmDeleteMultiple: '确定要删除选中的 {count} 个项目吗？此操作无法撤销。',
        deleteSuccess: '已删除',
        deleteFailed: '删除失败',
        downloadingFolder: '正在下载文件夹…',
        failedCount: ', {count} 个失败',
        downloadConflictTitle: '下载位置冲突',
        downloadConflictMessage: '目标位置已存在「{name}」（文件或文件夹）。请选择处理方式。',
        overwrite: '覆盖',
        renameDownload: '重命名',
        uploadToWebDAV: '上传到 WebDAV',
        uploading: '正在上传',
        uploadSuccess: '上传成功',
        uploadFailed: '上传失败',
        uploadConflictTitle: '上传冲突',
        uploadConflictMessage: '目标位置已存在「{name}」。请选择处理方式。',
        overwriteUpload: '覆盖',
        renameUpload: '重命名',
        noWritePermission: 'WebDAV 服务器没有写入权限，请联系管理员',
    }
};

// 英文语言包
const en: LangPack = {
    displayName: 'WebDAV explorer',
    settings: {
        // 服务器管理
        addServer: 'Add WebDAV server',
        editServer: 'Edit WebDAV server',
        deleteServer: 'Delete server',
        serverName: 'Server name',
        defaultServer: 'Default server',
        defaultServerDesc: 'Default server when opening explorer',
        currentServer: 'Current server',
        setAsDefault: 'Set as default server',
        setAsDefaultDesc: 'Set this server as the default server',
        noServersAvailable: 'No servers available',
        clickAddToCreate: 'Click the "add server" button below to create your first server configuration',

        // 服务器配置
        url: 'Server url',
        urlDesc: 'Full WebDAV server url',
        username: 'Username',
        secretId: 'Keychain ID',
        secretIdDesc: 'Select from keychain',
        selectSecretId: 'Select keychain ID',
        openKeychain: 'Open Keychain Setting',
        keyChainFailed: 'Keychain Setting failed to open',
        remoteDir: 'Remote directory',
        remoteDirDesc: 'Remote directory path on the server',
        urlPrefix: {
            name: 'URL prefix',
            desc: 'Replace url prefix for drag-and-drop links'
        },
        downloadPath: {
            name: 'Download path',
            desc: 'Empty or "/" for root directory',
        },

        // 表单验证和提示
        nameRequired: 'Server name cannot be empty',
        urlRequired: 'Server URL cannot be empty',
        duplicateName: 'Server name already exists',
        deleteNotice: 'Cannot delete the last server',
        confirmDelete: 'Are you sure you want to delete this server?',
        serverListEmpty: 'Server list is empty',
        unloadSuccess: 'Successfully unloaded WebDAV explorer',

        // 操作按钮
        save: 'Save',
        cancel: 'Cancel',
        edit: 'Edit',
        copy: 'Copy',
        copySuffix: '_copy',
        serverCopied: 'Server copied: {name}',
        delete: 'Delete',
        confirmDeleteMessage: "Are you sure you want to delete server {name}? This action cannot be undone.",
        confirm: "Confirm",
        deleteFailed: 'Failed to delete server',

        // 状态提示
        serverAdded: 'Server added successfully',
        serverUpdated: 'Server updated successfully',
        serverDeleted: 'Server deleted successfully',
        defaultServerUpdated: 'Default server updated',
        saveFailed: 'Failed to save server configuration',

        // 标识文本
        default: 'Default',
        current: 'Current',
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
        dragFromLeft: 'Please drag Obsidian files from the left file list',
        noValidFiles: 'No valid files found',
        deleteCompleted: 'Delete completed: {success} success{failed}',
        deleteFailed: 'Delete failed: {count} files',
        downloadCompleted: 'Download completed: {success} success{failed}',
        downloadFailed: 'Download failed: {count} files',
    },
    webdavClient: {
        webdavClientNotInitialized: 'WebDAV client not initialized',
        failedToGetFileContents: 'Failed to get file contents',
    },
    contextMenu: {
        copyUrl: 'Copy url',
        download: 'Download',
        downloading: 'Downloading',
        urlCopied: 'Url copied',
        copyFailed: 'Copy failed',
        notSupportFormat: 'Not supported format,use system download',
        downloadSuccess: 'Download success',
        downloadFailed: 'Download failed',
        connectionError: 'Connection error',
        delete: 'Delete',
        confirmDeleteRemote: 'Delete "{name}"? This cannot be undone.',
        confirmDeleteMultiple: 'Delete {count} selected items? This cannot be undone.',
        deleteSuccess: 'Deleted',
        deleteFailed: 'Delete failed',
        downloadingFolder: 'Downloading folder…',
        failedCount: ', {count} failed',
        downloadConflictTitle: 'Download conflict',
        downloadConflictMessage: 'A file or folder named "{name}" already exists at the destination. Choose an action.',
        overwrite: 'Overwrite',
        renameDownload: 'Rename',
        uploadToWebDAV: 'Upload to WebDAV',
        uploading: 'Uploading',
        uploadSuccess: 'Upload success',
        uploadFailed: 'Upload failed',
        uploadConflictTitle: 'Upload conflict',
        uploadConflictMessage: '"{name}" already exists at the destination. Choose an action.',
        overwriteUpload: 'Overwrite',
        renameUpload: 'Rename',
        noWritePermission: 'WebDAV server has no write permission, please contact administrator',
    }
};


// 定义语言类型
type Locale = 'zh' | 'en';

// 语言包映射
const locales: Record<Locale, LangPack> = {zh, en};

// 获取系统语言
function getSystemLocale(): Locale {
    const language = getLanguage();
    return language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export class I18nService {
    // 当前语言包实例
    public t: LangPack;

    constructor() {
        // 初始化时根据系统语言设置
        this.t = locales[getSystemLocale()];
    }
}

// 创建单例实例
export const i18n = new I18nService();