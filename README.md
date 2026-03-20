# WebDAV Explorer for Obsidian

<p>
    <a href="https://github.com/sunmagicshow/obsidian-webdav/blob/master/README.md">English</a> | <a href="https://github.com/sunmagicshow/obsidian-webdav/blob/master/README_zh.md">中文</a> 
</p>

### 📖 Overview
A WebDAV plugin for Obsidian that enables seamless file management through WebDAV protocol. Drag and drop files to generate links, double-click to open files directly in Obsidian!

### ✨ Features

- **📂 WebDAV File Browser** - Access WebDAV servers and browse files and folders
- **🎯 Drag & Drop Link Generation** - Simply drag files into Obsidian to automatically generate markdown links
- **🎬 Media Preview** - Preview videos and images directly within Obsidian (Videos require [Media Extended](obsidian://show-plugin?id=media-extended) plugin)
- **🖱️ Double-click to Open** - Double-click any file to open it in Obsidian's built-in browser
- **⬇️ File Download** - Directly download Obsidian-supported formats to your vault; unsupported formats use the system downloader

### ⚙️ Settings Example
![setting.png](asset/setting.png)

### 📋 Requirements

#### 🔌 Media Extended Plugin
For video playback functionality, please install the [Media Extended plugin](https://github.com/aidenlx/media-extended). This enables smooth video preview within Obsidian.

#### 🌐 CORS Configuration
⚠️ **Important**: Your WebDAV server must support CORS (Cross-Origin Resource Sharing) for real-time file preview. Without proper CORS configuration, you may encounter preview errors. Ensure your server includes the following headers:
- `Access-Control-Allow-Origin: *` 
- `Access-Control-Allow-Methods: GET, PROPFIND, OPTIONS`
- `Access-Control-Allow-Headers: *`

### 🎮 Usage Demo
![demo.gif](asset/demo.gif)