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
- **📤 右键上传文件** - 右键点击单个文件或文件夹，选择"上传到 WebDAV"即可上传到当前浏览的路径
- **📁 拖拽上传文件** - 拖拽单个文件或文件夹到WebDAV视图中，即可上传到当前浏览的路径
- **🔄 重名文件处理** - 上传时自动检测重名文件，提供覆盖、重命名或取消选项
- **✏️ 文件重命名** - 在WebDAV视图中右键点击文件或文件夹，选择"重命名"即可重命名它们

### ⚙️ 配置示例
![setting.png](asset/setting.png)

### 📋 使用要求


#### 🌐 CORS 配置
💡 **建议配置**：为了获得最佳的实时文件预览体验，建议您的 WebDAV 服务器支持 CORS（跨域资源共享）。如果服务器不支持 CORS，插件会自动使用替代方案（授权+blob模式）来处理文件预览。

**推荐的 CORS 响应头配置**：
- `Access-Control-Allow-Origin: *` 
- `Access-Control-Allow-Methods: GET, PROPFIND, OPTIONS, PUT, DELETE`
- `Access-Control-Allow-Headers: Authorization, Content-Type, *`
- `Access-Control-Expose-Headers: Content-Length, Content-Type`

### 🎮 使用演示
![demo.gif](asset/demo.gif)