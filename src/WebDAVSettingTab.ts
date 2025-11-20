import {App, PluginSettingTab, Setting, Notice, Modal, ButtonComponent} from 'obsidian';
import WebDAVPlugin from './main';
import {WebDAVServer} from './types';
import {i18n} from "./i18n";

//添加/编辑服务器的模态框
class ServerEditModal extends Modal {
    private readonly plugin: WebDAVPlugin;
    private readonly server: WebDAVServer | null;
    private readonly onSave: (server: WebDAVServer) => void;
    private readonly isEditing: boolean;

    constructor(app: App, plugin: WebDAVPlugin, server: WebDAVServer | null, onSave: (server: WebDAVServer) => void) {
        super(app);
        this.plugin = plugin;
        this.server = server;
        this.onSave = onSave;
        this.isEditing = !!server;
    }

    onOpen(): void {
        this.render();
    }

    private render(): void {
        const {contentEl} = this;
        contentEl.empty();
        contentEl.empty();
        contentEl.empty();
        contentEl.empty();
        contentEl.empty();
        contentEl.empty();
        contentEl.empty();


        contentEl.createEl('h2', {
            text: this.isEditing ? i18n.t.settings.editServer : i18n.t.settings.addServer
        });

        const serverData: WebDAVServer = this.server || this.createNewServer();

        this.renderServerForm(contentEl, serverData);
        this.renderActionButtons(contentEl, serverData);
    }

    private renderServerForm(container: HTMLElement, server: WebDAVServer): void {
        const formContainer = container.createEl('div', {cls: 'webdav-server-form'});

        // 服务器名称
        new Setting(formContainer)
            .setName(i18n.t.settings.serverName)
            .setDesc(i18n.t.settings.nameRequired)
            .addText(text => {
                text
                    .setPlaceholder(i18n.t.settings.serverName)
                    .setValue(server.name)
                    .onChange(value => server.name = value.trim());
            });

        // 服务器URL
        new Setting(formContainer)
            .setName(i18n.t.settings.url)
            .setDesc(i18n.t.settings.urlDesc || 'WebDAV服务器地址')
            .addText(text => {
                text
                    .setPlaceholder('http://192.168.0.1:8080/dav')
                    .setValue(server.url)
                    .onChange(value => server.url = value.trim());
            });

        // 用户名
        new Setting(formContainer)
            .setName(i18n.t.settings.username)
            .addText(text => {
                text
                    .setPlaceholder(i18n.t.settings.username)
                    .setValue(server.username)
                    .onChange(value => server.username = value.trim());
            });

        // 密码
        new Setting(formContainer)
            .setName(i18n.t.settings.password)
            .addText(text => {
                text
                    .setPlaceholder(i18n.t.settings.password)
                    .setValue(server.password)
                    .inputEl.type = 'password';
                text.onChange(value => server.password = value);
            });

        // 远程目录
        new Setting(formContainer)
            .setName(i18n.t.settings.remoteDir)
            .setDesc(i18n.t.settings.remoteDirDesc || '服务器上的远程目录路径')
            .addText(text => {
                text
                    .setPlaceholder('/')
                    .setValue(server.remoteDir)
                    .onChange(value => server.remoteDir = value.trim());
            });

        // URL前缀（可选）
        new Setting(formContainer)
            .setName(i18n.t.settings.urlPrefix.name)
            .setDesc(i18n.t.settings.urlPrefix.desc)
            .addText(text => {
                text
                    .setPlaceholder('http://192.168.0.1:8000/dav')
                    .setValue(server.urlPrefix)
                    .onChange(value => server.urlPrefix = value.trim());
            });

        // 下载路径（可选）
        new Setting(formContainer)
            .setName(i18n.t.settings.downloadPath.name)
            .setDesc(i18n.t.settings.downloadPath.desc)
            .addText(text => {
                text
                    .setPlaceholder('/')
                    .setValue(server.downloadPath || '')
                    .onChange(value => server.downloadPath = value.trim());
            });


    }

    private renderActionButtons(container: HTMLElement, server: WebDAVServer): void {
        const buttonContainer = container.createEl('div', {cls: 'modal-button-container'});

        // 保存按钮
        new ButtonComponent(buttonContainer)
            .setButtonText(i18n.t.settings.save)
            .setCta()
            .onClick(() => this.handleSave(server));

        // 取消按钮
        new ButtonComponent(buttonContainer)
            .setButtonText(i18n.t.settings.cancel)
            .onClick(() => this.close());
    }

    private async handleSave(server: WebDAVServer): Promise<void> {
        if (!this.validateServer(server)) {
            return;
        }

        try {
            this.onSave(server);
            this.close();
        } catch (error) {
            new Notice(i18n.t.settings.saveFailed);
        }
    }

    private validateServer(server: WebDAVServer): boolean {
        if (!server.name.trim()) {
            new Notice(i18n.t.settings.nameRequired);
            return false;
        }

        if (!server.url.trim()) {
            new Notice(i18n.t.settings.urlRequired);
            return false;
        }

        // 检查名称重复（编辑时排除自身）
        const isDuplicate = this.plugin.settings.servers.some(s =>
            s.name === server.name && (!this.isEditing || s !== this.server)
        );

        if (isDuplicate) {
            new Notice(i18n.t.settings.duplicateName);
            return false;
        }

        return true;
    }

    private createNewServer(): WebDAVServer {
        const baseName = i18n.t.settings.serverName;
        const newName = this.generateUniqueServerName(baseName);

        return {
            name: newName,
            url: '',
            username: '',
            password: '',
            remoteDir: '',
            urlPrefix: '',
            downloadPath: '',
            isDefault: this.plugin.settings.servers.length === 0
        };
    }

    private generateUniqueServerName(baseName: string): string {
        let serverNumber = 1;
        let newName = `${baseName} ${serverNumber}`;

        while (this.plugin.settings.servers.some(s => s.name === newName)) {
            serverNumber++;
            newName = `${baseName} ${serverNumber}`;
        }

        return newName;
    }
}

// 重构后的 WebDAV 插件设置面板 使用模态框进行服务器编辑，主页面显示服务器列表概览
export class WebDAVSettingTab extends PluginSettingTab {
    private readonly plugin: WebDAVPlugin;

    constructor(app: App, plugin: WebDAVPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    // 渲染设置面板主界面
    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        this.renderDefaultServerSection();
        this.renderServersListSection();
    }

    // ==================== 主要区域渲染方法 ====================

    // 渲染默认服务器设置区域
    private renderDefaultServerSection(): void {
        const {servers} = this.plugin.settings;

        if (servers.length === 0) return;

        const defaultServer = servers.find(s => s.isDefault) || servers[0];

        new Setting(this.containerEl)
            .setName(i18n.t.settings.defaultServer)
            .setDesc(i18n.t.settings.defaultServerDesc)
            .addDropdown(dropdown => {
                dropdown.selectEl.addClass('webdav-dropdown');

                servers.forEach(server => {
                    dropdown.addOption(server.name, server.name);
                });

                dropdown.setValue(defaultServer.name);
                dropdown.onChange(value => this.handleDefaultServerChange(value));
            })
            .addButton(button => {
                button
                    .setIcon('plus')
                    .setTooltip(i18n.t.settings.addServer)
                    .setCta() // 添加主题色
                    .onClick(() => this.handleAddServer());
            });

        this.containerEl.createEl('hr');
    }

    // 渲染服务器列表区域
    private renderServersListSection(): void {
        const serversContainer = this.containerEl.createEl('div', {cls: 'webdav-servers-container'});
        const {servers} = this.plugin.settings;

        if (servers.length === 0) {
            this.renderNoServersMessage(serversContainer);
            return;
        }

        servers.forEach((server, index) => {
            this.renderServerCard(server, serversContainer);
            if (index < servers.length - 1) {
                serversContainer.createEl('hr', {cls: 'webdav-server-divider'});
            }
        });
    }

    // 渲染无服务器时的提示信息
    private renderNoServersMessage(container: HTMLElement): void {
        const messageEl = container.createEl('div', {cls: 'webdav-no-servers'});
        messageEl.createEl('p', {text: i18n.t.settings.noServersAvailable});
        messageEl.createEl('p', {
            text: i18n.t.settings.clickAddToCreate,
            cls: 'webdav-hint'
        });

        // 添加服务器按钮
        new ButtonComponent(messageEl)
            .setButtonText(i18n.t.settings.addServer)
            .setCta()
            .onClick(() => this.handleAddServer());
    }

    // ==================== 服务器卡片渲染方法 ====================

    // 渲染单个服务器概览卡片
    private renderServerCard(server: WebDAVServer, container: HTMLElement): void {
        const cardEl = container.createEl('div', {cls: 'webdav-server-card'});

        // 服务器头部信息和操作按钮在同一行
        this.renderServerHeader(server, cardEl);

        // 服务器详细信息
        this.renderServerDetails(server, cardEl);
    }

    // 渲染服务器头部信息
    private renderServerHeader(server: WebDAVServer, container: HTMLElement): void {
        const headerEl = container.createEl('div', {cls: 'webdav-server-header'});

        const leftSection = headerEl.createEl('div', {cls: 'webdav-header-left'});
        const nameEl = leftSection.createEl('div', {cls: 'webdav-server-name'});
        nameEl.createEl('h3', {text: server.name});

        if (server.isDefault) {
            nameEl.createEl('span', {
                text: i18n.t.settings.default,
                cls: 'webdav-default-badge'
            });
        }

        // 操作按钮放在右侧
        const actionsEl = headerEl.createEl('div', {cls: 'webdav-server-actions'});

        // 编辑按钮
        new ButtonComponent(actionsEl)
            .setIcon('pencil')
            .setTooltip(i18n.t.settings.edit)
            .setCta() // 添加主题色
            .onClick(() => this.handleEditServer(server));

        // 删除按钮
        new ButtonComponent(actionsEl)
            .setIcon('trash-2')
            .setTooltip(i18n.t.settings.delete)
            .setWarning()
            .onClick(() => this.handleDeleteServer(server));
    }

    // 渲染服务器详细信息
    private renderServerDetails(server: WebDAVServer, container: HTMLElement): void {
        const detailsEl = container.createEl('div', {cls: 'webdav-server-details'});

        // 创建详情项容器
        const detailsContainer = detailsEl.createEl('div', {cls: 'webdav-details-container'});

        // 服务器URL
        this.renderDetailItem(detailsContainer, i18n.t.settings.url, server.url);

        // 用户名
        this.renderDetailItem(detailsContainer, i18n.t.settings.username, server.username || '-');

        // URL前缀
        this.renderDetailItem(detailsContainer, i18n.t.settings.urlPrefix.name, server.urlPrefix || '-');

        // 远程目录
        this.renderDetailItem(detailsContainer, i18n.t.settings.remoteDir, server.remoteDir || '-');
    }

    // 渲染详情项
    private renderDetailItem(container: HTMLElement, label: string, value: string): void {
        const itemEl = container.createEl('div', {cls: 'webdav-detail-item'});

        const labelEl = itemEl.createEl('div', {cls: 'webdav-detail-label'});
        labelEl.setText(label);

        const valueEl = itemEl.createEl('div', {cls: 'webdav-detail-value'});
        valueEl.setText(value);
    }

    // ==================== 事件处理方法 ====================

    /**
     * 处理默认服务器变更
     */
    private async handleDefaultServerChange(serverName: string): Promise<void> {
        if (!serverName) return;

        this.plugin.settings.servers.forEach(server => {
            server.isDefault = server.name === serverName;
        });

        await this.saveSettingsAndRefresh();
        new Notice(i18n.t.settings.defaultServerUpdated);
    }

    /**
     * 处理添加服务器
     */
    private handleAddServer(): void {
        new ServerEditModal(this.app, this.plugin, null, async (server) => {
            await this.saveNewServer(server);
        }).open();
    }

    /**
     * 处理编辑服务器
     */
    private handleEditServer(server: WebDAVServer): void {
        new ServerEditModal(this.app, this.plugin, server, async (updatedServer) => {
            await this.updateServer(server, updatedServer);
        }).open();
    }

    /**
     * 处理删除服务器 - 直接删除，无需确认
     */
    private async handleDeleteServer(server: WebDAVServer): Promise<void> {
        const {servers} = this.plugin.settings;
        const serverIndex = servers.findIndex(s => s === server);

        if (serverIndex === -1) return;

        // 从服务器列表中移除
        servers.splice(serverIndex, 1);

        // 处理默认服务器逻辑
        this.handleDefaultServerAfterDeletion(server);

        await this.saveSettingsAndRefresh();
        this.plugin.notifyServerChanged();
        new Notice(i18n.t.settings.serverDeleted);
    }

    /**
     * 保存新服务器
     */
    private async saveNewServer(server: WebDAVServer): Promise<void> {
        this.plugin.settings.servers.push(server);

        // 如果是第一个服务器或设置为默认，更新当前服务器
        if (server.isDefault || this.plugin.settings.servers.length === 1) {
            this.plugin.settings.currentServerName = server.name;
        }

        await this.saveSettingsAndRefresh();
        this.plugin.notifyServerChanged();
        new Notice(i18n.t.settings.serverAdded);
    }

    /**
     * 更新服务器
     */
    private async updateServer(oldServer: WebDAVServer, updatedServer: WebDAVServer): Promise<void> {
        const serverIndex = this.plugin.settings.servers.findIndex(s => s === oldServer);

        if (serverIndex === -1) return;

        this.plugin.settings.servers[serverIndex] = updatedServer;

        // 如果更新的是当前服务器或默认服务器，更新相关设置
        if (oldServer.name === this.plugin.settings.currentServerName) {
            this.plugin.settings.currentServerName = updatedServer.name;
        }

        await this.saveSettingsAndRefresh();
        this.plugin.notifyServerChanged();
        new Notice(i18n.t.settings.serverUpdated);
    }

    // ==================== 工具方法 ====================

    /**
     * 处理删除服务器后的默认服务器逻辑
     */
    private handleDefaultServerAfterDeletion(deletedServer: WebDAVServer): void {
        const {servers} = this.plugin.settings;

        if (servers.length === 0) {
            this.plugin.settings.currentServerName = '';
            return;
        }

        // 如果删除的是默认服务器，设置新的默认服务器
        if (deletedServer.isDefault) {
            servers[0].isDefault = true;
            this.plugin.settings.currentServerName = servers[0].name;
        }

        // 如果删除的是当前服务器，切换到默认服务器
        if (deletedServer.name === this.plugin.settings.currentServerName) {
            const defaultServer = servers.find(s => s.isDefault) || servers[0];
            this.plugin.settings.currentServerName = defaultServer.name;
        }
    }

    /**
     * 保存设置并刷新界面
     */
    private async saveSettingsAndRefresh(): Promise<void> {
        await this.plugin.saveSettings();
        this.display();
    }
}