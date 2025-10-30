export class FileUtils {
  static getFileIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const iconMap: { [key: string]: string } = {
      'md': '📝',
      'txt': '📄',
      'pdf': '📕',
      'doc': '📘',
      'docx': '📘',
      'xls': '📗',
      'xlsx': '📗',
      'ppt': '📙',
      'pptx': '📙',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'png': '🖼️',
      'gif': '🖼️',
      'mp4': '🎬',
      'mkv': '🎬',
      'avi': '🎬',
      'mov': '🎬',
      'mp3': '🎵',
      'wav': '🎵',
      'zip': '📦',
      'rar': '📦',
      '7z': '📦',
      'strm': '🔗'
    };

    return !ext || !iconMap[ext] ? '📄' : iconMap[ext];
  }

  static getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop() || '' : '';
  }

  static getFileName(file: any): string {
    if (file.originalName) return file.originalName;
    if (file.displayName) return file.displayName;
    if (file.filename) {
      const parts = file.filename.split('/');
      return parts[parts.length - 1];
    }
    return file.basename;
  }

  static normalizePath(path: string, rootPath: string): string {
    let normalizedPath = path;

    if (path === '' || path === '/' || path === rootPath) {
      normalizedPath = rootPath;
    } else {
      if (!path.startsWith(rootPath)) {
        normalizedPath = rootPath === '/' ? `/${path.replace(/^\//, '')}` : `${rootPath}/${path.replace(/^\//, '')}`;
      }
      normalizedPath = normalizedPath.replace(/\/+/g, '/');
    }

    if (normalizedPath !== '/' && normalizedPath.endsWith('/')) {
      normalizedPath = normalizedPath.slice(0, -1);
    }

    if (!normalizedPath.startsWith(rootPath)) {
      console.warn(`Security: Attempted to access ${normalizedPath}, outside of root: ${rootPath}`);
      normalizedPath = rootPath;
    }

    return normalizedPath;
  }

  static parseLastModDate(lastmod: string): number {
    if (!lastmod) return 0;
    try {
      const date = new Date(lastmod);
      const timestamp = date.getTime();
      return isNaN(timestamp) ? 0 : timestamp;
    } catch (error) {
      return 0;
    }
  }
}
