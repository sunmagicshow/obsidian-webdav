import {App, PluginSettingTab, Setting, Notice, Modal, ButtonComponent} from 'obsidian';
import WebDAVPlugin from './main';
import {WebDAVServer} from './types';
import {i18n} from "./i18n";

interface FormFieldConfig {
    name: string;
    desc?: string;
    placeholder: string;
    type?: 'text' | 'password';
    required?: boolean;
    getValue: (server: WebDAVServer) => string;
    setValue: (server: WebDAVServer, value: string) => void;
}

//添加/编辑服务器的模态框
class ServerEditModal extends Modal {
    private readonly plugin: WebDAVPlugin;
    private readonly server: WebDAVServer | null;
    private readonly onSave: (server: WebDAVServer) => void;

    constructor(app: App, plugin: WebDAVPlugin, server: WebDAVServer | null, onSave: (server: WebDAVServer) => void) {
        super(app);
        this.plugin = plugin;
        this.server = server;
        this.onSave = onSave;
    }

    onOpen(): void {
        this.render();
    }

    private render(): void {
        const {contentEl} = this;

        contentEl.createEl('h2', {
            text: this.server !== null ? i18n.t.settings.editServer : i18n.t.settings.addServer
        });

        const serverData: WebDAVServer = this.server || this.createNewServer();

        this.renderServerForm(contentEl, serverData);
        this.renderActionButtons(contentEl, serverData);
    }

    private getFormFieldConfigs(): FormFieldConfig[] {
        return [
            {
                name: i18n.t.settings.serverName,
                desc: i18n.t.settings.nameRequired,
                placeholder: i18n.t.settings.serverName,
                required: true,
                getValue: (server) => server.name,
                setValue: (server, value) => server.name = value.trim()
            },
            {
                name: i18n.t.settings.url,
                desc: i18n.t.settings.urlDesc,
                placeholder: 'http://192.168.0.1:8080/dav',
                required: true,
                getValue: (server) => server.url,
                setValue: (server, value) => server.url = value.trim()
            },
            {
                name: i18n.t.settings.username,
                placeholder: i18n.t.settings.username,
                getValue: (server) => server.username || '',
                setValue: (server, value) => server.username = value.trim()
            },
            {
                name: i18n.t.settings.password,
                placeholder: i18n.t.settings.password,
                type: 'password',
                getValue: (server) => server.password || '',
                setValue: (server, value) => server.password = value
            },
            {
                name: i18n.t.settings.remoteDir,
                desc: i18n.t.settings.remoteDirDesc,
                placeholder: '/',
                getValue: (server) => server.remoteDir || '',
                setValue: (server, value) => server.remoteDir = value.trim()
            },
            {
                name: i18n.t.settings.urlPrefix.name,
                desc: i18n.t.settings.urlPrefix.desc,
                placeholder: 'http://192.168.0.1:8000/dav',
                getValue: (server) => server.urlPrefix || '',
                setValue: (server, value) => server.urlPrefix = value.trim()
            },
            {
                name: i18n.t.settings.downloadPath.name,
                desc: i18n.t.settings.downloadPath.desc,
                placeholder: '/',
                getValue: (server) => server.downloadPath || '',
                setValue: (server, value) => server.downloadPath = value.trim()
            }
        ];
    }

    private renderServerForm(container: HTMLElement, server: WebDAVServer): void {
        const formContainer = container.createDiv();

        this.getFormFieldConfigs().forEach(config => {
            new Setting(formContainer)
                .setName(config.name)
                .setDesc(config.desc || '')
                .addText(text => {
                    text
                        .setPlaceholder(config.placeholder)
                        .setValue(config.getValue(server))
                        .onChange(value => config.setValue(server, value));

                    if (config.type === 'password') {
                        text.inputEl.type = 'password';
                    }
                });
        });
    }

    private renderActionButtons(container: HTMLElement, server: WebDAVServer): void {
        const buttonContainer = container.createDiv({cls: 'webdav-modal-button-container'});

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

    private handleSave(server: WebDAVServer): void {
        if (!this.validateServer(server)) {
            return;
        }
        this.onSave(server);
        this.close();

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
            s.name === server.name && (this.server === null || s !== this.server)
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
    icon = 'cloud';
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
        const serversContainer = this.containerEl.createDiv({cls: 'webdav-servers-container'});
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
        const messageEl = container.createDiv({cls: 'webdav-no-servers'});
        messageEl.createEl('p', {text: i18n.t.settings.noServersAvailable});
        messageEl.createEl('p', {text: i18n.t.settings.clickAddToCreate,});

        // 添加服务器按钮
        new ButtonComponent(messageEl)
            .setButtonText(i18n.t.settings.addServer)
            .setCta()
            .onClick(() => this.handleAddServer());
    }

    // ==================== 服务器卡片渲染方法 ====================

    // 渲染单个服务器概览卡片
    private renderServerCard(server: WebDAVServer, container: HTMLElement): void {
        const cardEl = container.createDiv({cls: 'webdav-server-card'});

        // 服务器头部信息和操作按钮在同一行
        this.renderServerHeader(server, cardEl);

        // 服务器详细信息
        this.renderServerDetails(server, cardEl);
    }

    // 渲染服务器头部信息
    private renderServerHeader(server: WebDAVServer, container: HTMLElement): void {
        const headerEl = container.createDiv({cls: 'webdav-server-header'});

        // 使用 Setting 组件创建标题
        const nameSetting = new Setting(headerEl)
            .setName(server.name)
            .setHeading();

        // 移除控件容器,只需要标题
        nameSetting.controlEl.remove();

        // 添加自定义样式和徽章
        nameSetting.nameEl.addClass('webdav-server-name');

        if (server.isDefault) {
            nameSetting.nameEl.createEl('span', {
                text: i18n.t.settings.default,
                cls: 'webdav-default-badge'
            });
        }

        // 操作按钮放在右侧
        const actionsEl = headerEl.createDiv({cls: 'webdav-server-actions'});

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
            .onClick(() => {
                this.handleDeleteServer(server).catch(() => {
                    new Notice(i18n.t.settings.deleteFailed);
                });
            });
    }

    // 渲染服务器详细信息
    private renderServerDetails(server: WebDAVServer, container: HTMLElement): void {
        const detailsContainer = container.createDiv({
            cls: 'webdav-details-container'
        });

        const fields = [
            {label: i18n.t.settings.url, value: server.url},
            {label: i18n.t.settings.username, value: server.username || '-'},
            {label: i18n.t.settings.urlPrefix.name, value: server.urlPrefix || '-'},
            {label: i18n.t.settings.remoteDir, value: server.remoteDir || '-'}
        ];

        fields.forEach((field,) => {
            const item = detailsContainer.createDiv({cls: 'webdav-detail-item'});
            item.createEl('div', {
                text: field.label,
            });
            item.createEl('div', {
                text: field.value,
            });
        });
    }

    // ==================== 事件处理方法 ====================

    // 处理默认服务器变更
    private async handleDefaultServerChange(serverName: string): Promise<void> {
        if (!serverName) return;

        this.plugin.settings.servers.forEach(server => {
            server.isDefault = server.name === serverName;
        });

        await this.saveSettingsAndRefresh();
        new Notice(i18n.t.settings.defaultServerUpdated);
    }

    // 处理添加服务器

    private handleAddServer(): void {
        new ServerEditModal(this.app, this.plugin, null, (server) => {
            this.saveNewServer(server).catch(() => {
                new Notice(i18n.t.settings.saveFailed);
            });
        }).open();
    }

    // 处理编辑服务器
    private handleEditServer(server: WebDAVServer): void {
        new ServerEditModal(this.app, this.plugin, server, (updatedServer) => {
            this.updateServer(server, updatedServer).catch(() => {
                new Notice(i18n.t.settings.saveFailed);
            });
        }).open();
    }

    // 处理删除服务器 - 直接删除，无需确认
    private async handleDeleteServer(server: WebDAVServer): Promise<void> {
        const {servers} = this.plugin.settings;
        const serverIndex = servers.findIndex(s => s === server);

        if (serverIndex === -1) return;

        // 创建轻量确认对话框
        const confirmed = await this.showDeleteConfirmation(server.name);
        if (!confirmed) return;

        // 从服务器列表中移除
        servers.splice(serverIndex, 1);

        // 处理默认服务器逻辑
        this.handleDefaultServerAfterDeletion(server);

        await this.saveSettingsAndRefresh();
        this.plugin.notifyServerChanged();
        new Notice(i18n.t.settings.serverDeleted);
    }

    private showDeleteConfirmation(serverName: string): Promise<boolean> {
        return new Promise((resolve) => {
            const modal = new Modal(this.app);

            modal.titleEl.setText(i18n.t.settings.confirmDelete);
            modal.contentEl.createEl('p', {
                text: i18n.t.settings.confirmDeleteMessage.replace('{name}', serverName)
            });

            const buttonContainer = modal.contentEl.createDiv({cls: 'webdav-modal-button-container'});

            // 确认删除按钮
            new ButtonComponent(buttonContainer)
                .setButtonText(i18n.t.settings.confirm)
                .setWarning()
                .onClick(() => {
                    modal.close();
                    resolve(true);
                });

            // 取消按钮
            new ButtonComponent(buttonContainer)
                .setButtonText(i18n.t.settings.cancel)
                .onClick(() => {
                    modal.close();
                    resolve(false);
                });

            modal.open();
        });
    }

    // 保存新服务器
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

    // 更新服务器
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
    // 处理删除服务器后的默认服务器逻辑
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

    // 保存设置并刷新界面
    private async saveSettingsAndRefresh(): Promise<void> {
        await this.plugin.saveData(this.plugin.settings);
        this.display();
    }
}