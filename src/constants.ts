/**
 * Obsidian 官方支持并能正常显示的格式
 */
export const SUPPORTED_TEXT_EXTS = new Set(['md', 'canvas', 'base']);

export const SUPPORTED_BINARY_EXTS = new Set([
    'avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp',
    'flac', 'm4a', 'mp3', 'ogg', 'wav', 'webm', '3gp',
    'mkv', 'mov', 'mp4', 'ogv', 'pdf'
]);

/**
 * 文件扩展名到 Obsidian 图标的映射
 */
export const ICON_MAP: Record<string, string> = {
    // 文档类型
    'md': 'file-text',
    'txt': 'file-text',
    'pdf': 'file-text',
    'doc': 'file-text',
    'docx': 'file-text',
    'rtf': 'file-text',
    'odt': 'file-text',
    'pages': 'file-text',

    // 表格类型
    'xls': 'table',
    'xlsx': 'table',
    'csv': 'table',
    'ods': 'table',
    'numbers': 'table',

    // 演示文稿
    'ppt': 'presentation',
    'pptx': 'presentation',
    'key': 'presentation',
    'odp': 'presentation',

    // 图片类型
    'jpg': 'image',
    'jpeg': 'image',
    'png': 'image',
    'gif': 'image',
    'svg': 'image',
    'webp': 'image',
    'bmp': 'image',
    'tiff': 'image',
    'tif': 'image',
    'ico': 'image',
    'heic': 'image',
    'raw': 'image',
    'psd': 'image',
    'ai': 'image',
    'eps': 'image',

    // 视频类型
    'mp4': 'video',
    'mkv': 'video',
    'avi': 'video',
    'mov': 'video',
    'wmv': 'video',
    'flv': 'video',
    'webm': 'video',
    'm4v': 'video',
    '3gp': 'video',
    'mpeg': 'video',
    'mpg': 'video',

    // 音频类型
    'mp3': 'audio-file',
    'wav': 'audio-file',
    'flac': 'audio-file',
    'aac': 'audio-file',
    'ogg': 'audio-file',
    'm4a': 'audio-file',
    'wma': 'audio-file',
    'aiff': 'audio-file',
    'mid': 'audio-file',
    'midi': 'audio-file',

    // 压缩文件
    'zip': 'archive',
    'rar': 'archive',
    '7z': 'archive',
    'tar': 'archive',
    'gz': 'archive',
    'bz2': 'archive',
    'xz': 'archive',
    'iso': 'archive',
    'dmg': 'archive',

    // 代码文件
    'js': 'file-code',
    'ts': 'file-code',
    'jsx': 'file-code',
    'tsx': 'file-code',
    'html': 'file-code',
    'htm': 'file-code',
    'css': 'file-code',
    'scss': 'file-code',
    'sass': 'file-code',
    'less': 'file-code',
    'json': 'file-code',
    'xml': 'file-code',
    'yml': 'file-code',
    'yaml': 'file-code',
    'php': 'file-code',
    'py': 'file-code',
    'java': 'file-code',
    'c': 'file-code',
    'cpp': 'file-code',
    'h': 'file-code',
    'hpp': 'file-code',
    'cs': 'file-code',
    'go': 'file-code',
    'rs': 'file-code',
    'swift': 'file-code',
    'kt': 'file-code',
    'dart': 'file-code',
    'lua': 'file-code',
    'pl': 'file-code',
    'r': 'file-code',
    'sql': 'file-code',
    'sh': 'file-code',
    'bash': 'file-code',
    'zsh': 'file-code',
    'ps1': 'file-code',
    'bat': 'file-code',
    'cmd': 'file-code',

    // 字体文件
    'ttf': 'type',
    'otf': 'type',
    'woff': 'type',
    'woff2': 'type',
    'eot': 'type',

    // 电子书
    'epub': 'book',
    'mobi': 'book',
    'azw3': 'book',

    // 数据库
    'db': 'database',
    'sqlite': 'database',
    'mdb': 'database',

    // 配置文件
    'ini': 'settings',
    'cfg': 'settings',
    'conf': 'settings',
    'toml': 'settings',

    // 其他特殊类型
    'strm': 'link',
    'url': 'link',
    'webloc': 'link',
    'exe': 'binary',
    'msi': 'binary',
    'dll': 'binary',
    'app': 'binary',
    'apk': 'binary',
    'deb': 'package',
    'rpm': 'package',
    'pkg': 'package'
};