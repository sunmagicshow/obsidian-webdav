# WebDAV Explorer for Obsidian

<p>
    <a href="https://github.com/sunmagicshow/obsidian-webdav/blob/master/README.md">English</a> | <a href="https://github.com/sunmagicshow/obsidian-webdav/blob/master/README_zh.md">中文</a> 
</p>

### 📖 插件简介
一个 Obsidian WebDAV 插件，通过 WebDAV 协议实现无缝的文件管理。支持拖拽生成链接，双击直接在 Obsidian 中打开文件！

### ✨ 功能特性

- **📂 WebDAV 文件浏览器** - 访问 WebDAV 服务器,并浏览文件和文件夹
- **🎯 拖拽生成链接** - 直接将文件拖入 Obsidian，自动生成 Markdown 链接
- **🎬 媒体预览** - 直接在 Obsidian 中预览视频和图片（视频预览需要安装 [Media Extended](obsidian://show-plugin?id=media-extended) 插件）
- **🖱️ 双击打开文件** - 双击任意文件在 Obsidian 内置浏览器中打开
- **🖱️ 下载文件** - Obsidian支持的格式直接下载到库中,不支持的格式使用系统下载器

### ⚙️ 配置示例
![setting.png](asset/setting.png)

### 📋 使用要求

#### 🔌 Media Extended 插件
如需视频播放功能，请安装 [Media Extended 插件](https://github.com/aidenlx/media-extended)。该插件能够提供流畅的视频预览体验。

#### 🌐 CORS 配置
⚠️ **重要提示**：要实现实时文件预览功能，您的 WebDAV 服务器必须支持 CORS（跨域资源共享）。如果没有正确的 CORS 配置，可能会遇到预览错误。请确保服务器包含以下响应头：
- `Access-Control-Allow-Origin: *` 
- `Access-Control-Allow-Methods: GET, PROPFIND, OPTIONS`
- `Access-Control-Allow-Headers: *`

### 🎮 使用演示
![demo.gif](asset/demo.gif)