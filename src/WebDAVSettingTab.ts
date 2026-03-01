import {App, PluginSettingTab, Setting, Notice, Modal, ButtonComponent, SecretStorage} from 'obsidian';
import WebDAVPlugin from './main';
import {WebDAVServer} from './types';
import {i18n} from "./i18n";

declare module 'obsidian' {
    interface App {
        setting: {
            open(): void;
            close(): void;
        };
    }
}

interface FormFieldConfig {
    name: string;
    desc?: string;
    placeholder: string;
    type?: 'text' | 'dropdown';
    required?: boolean;
    getValue: (server: WebDAVServer) => string;
    setValue: (server: WebDAVServer, value: string) => void;
}

//添加/编辑服务器的模态框
class ServerEditModal extends Modal {

    private secretStorage: SecretStorage;

    constructor(
        app: App,
        private plugin: WebDAVPlugin,
        private server: WebDAVServer | null,
        private onSave: (server: WebDAVServer) => void
    ) {
        super(app);
        this.secretStorage = app.secretStorage;
    }

    onOpen(): void {
        const isEdit = this.server !== null;
        const serverData = this.server || this.createNewServer();
        this.contentEl.createEl('h2', {text: i18n.t.settings[isEdit ? 'editServer' : 'addServer']});
        this.renderForm(this.contentEl, serverData);
    }

    private renderForm(container: HTMLElement, server: WebDAVServer): void {
        const formFields: FormFieldConfig[] = [
            {
                name: i18n.t.settings.serverName,
                desc: i18n.t.settings.nameRequired,
                placeholder: i18n.t.settings.serverName,
                getValue: s => s.name,
                setValue: (s, v) => s.name = v.trim()
            },
            {
                name: i18n.t.settings.url,
                desc: i18n.t.settings.urlDesc,
                placeholder: 'http://192.168.0.1:8080/dav',
                getValue: s => s.url,
                setValue: (s, v) => s.url = v.trim()
            },
            {
                name: i18n.t.settings.username,
                placeholder: i18n.t.settings.username,
                getValue: s => s.username || '',
                setValue: (s, v) => s.username = v.trim()
            },
            {
                name: i18n.t.settings.secretId,
                desc: i18n.t.settings.secretIdDesc,
                placeholder: i18n.t.settings.secretId,
                type: 'dropdown',
                getValue: s => s.secretId || '',
                setValue: (s, v) => s.secretId = v
            },
            {
                name: i18n.t.settings.remoteDir,
                desc: i18n.t.settings.remoteDirDesc,
                placeholder: '/',
                getValue: s => s.remoteDir || '',
                setValue: (s, v) => s.remoteDir = v.trim()
            },
            {
                name: i18n.t.settings.urlPrefix.name,
                desc: i18n.t.settings.urlPrefix.desc,
                placeholder: 'http://192.168.0.1:8000/dav',
                getValue: s => s.urlPrefix || '',
                setValue: (s, v) => s.urlPrefix = v.trim()
            },
            {
                name: i18n.t.settings.downloadPath.name,
                desc: i18n.t.settings.downloadPath.desc,
                placeholder: '/',
                getValue: s => s.downloadPath || '',
                setValue: (s, v) => s.downloadPath = v.trim()
            }
        ];

        formFields.forEach(config => {
            const setting = new Setting(container).setName(config.name).setDesc(config.desc || '');

            if (config.type === 'dropdown') {
                this.renderDropdown(setting, config, server);
            } else {
                setting.addText(text => text
                    .setPlaceholder(config.placeholder)
                    .setValue(config.getValue(server))
                    .onChange(v => config.setValue(server, v))
                    .inputEl.addClass('webdav-text-field')
                );
            }
        });

        const btnContainer = container.createDiv({cls: 'webdav-modal-button-container'});

        new ButtonComponent(btnContainer).setButtonText(i18n.t.settings.save).setCta().onClick(() => this.handleSave(server));
        new ButtonComponent(btnContainer).setButtonText(i18n.t.settings.cancel).onClick(() => this.close());
    }

    private renderDropdown(setting: Setting, config: FormFieldConfig, server: WebDAVServer): void {
        const secretIds = this.secretStorage.listSecrets();

        setting.addButton(btn => btn
            .setIcon('key-round')
            .setTooltip(i18n.t.settings.openKeychain)
            .setCta()
            .onClick(() => this.openKeychain())
        ).addDropdown(dropdown => {
            dropdown.selectEl.addClass('webdav-keychain-dropdown');
            dropdown.addOption('', '-- ' + i18n.t.settings.selectSecretId + ' --');
            secretIds.forEach(id => dropdown.addOption(id, id));
            dropdown.setValue(config.getValue(server)).onChange(v => config.setValue(server, v));
        });
    }

    private openKeychain(): void {
        // 关闭当前模态框
        this.close();

        // 打开 Obsidian 设置面板
        this.app.setting.open();

        // 等待设置面板加载完成后，导航到正确的选项卡
        window.setTimeout(() => {
            try {
                const keychainTab = document.querySelector('.vertical-tab-nav-item[data-setting-id="keychain"]');
                if (keychainTab) {
                    (keychainTab as HTMLElement).click();
                    return;
                }
            } catch {
                new Notice(i18n.t.settings.keyChainFailed);
            }
        }, 100);
    }

    private handleSave(server: WebDAVServer): void {
        if (!this.validate(server)) {
            return;
        }
        this.onSave(server);
        this.close();

    }

    private validate(server: WebDAVServer): boolean {
        if (!server.name.trim()) {
            new Notice(i18n.t.settings.nameRequired);
            return false;
        }

        if (!server.url.trim()) {
            new Notice(i18n.t.settings.urlRequired);
            return false;
        }
        if (server.secretId === "") {
            new Notice(i18n.t.settings.selectSecretId);
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
            secretId: '',
            remoteDir: '',
            urlPrefix: '',
            downloadPath: '',
            isDefault: this.plugin.settings.servers.length === 0
        };
    }

    private generateUniqueServerName(baseName: string): string {
        let num = 1;
        let newName = `${baseName} ${num}`;

        while (this.plugin.settings.servers.some(s => s.name === newName)) {
            num++;
            newName = `${baseName} ${num}`;
        }

        return newName;
    }
}

// WebDAV 插件设置面板 使用模态框进行服务器编辑，主页面显示服务器列表概览
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
        this.renderServersLists();

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
            .addDropdown(dropdown =>
                dropdown
                    .addOptions(Object.fromEntries(servers.map(s => [s.name, s.name])))
                    .setValue(defaultServer.name)
                    .onChange(value => this.handleDefaultServerChange(value))
            )
            .addButton(button =>
                button
                    .setIcon('plus')
                    .setTooltip(i18n.t.settings.addServer)
                    .setCta()
                    .onClick(() => this.handleAddServer())
            );


        this.containerEl.createEl('hr');
    }

    // 渲染服务器列表区域
    private renderServersLists(): void {
        const serversContainer = this.containerEl.createDiv({cls: 'webdav-servers-container'});
        const {servers} = this.plugin.settings;

        if (servers.length === 0) {
            this.renderNoServersMessage(serversContainer);
            return;
        }

        servers.forEach((server) => {
            this.renderServersList(server, serversContainer);
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

    // ==================== 服务器列表渲染 ====================
    private renderServersList(server: WebDAVServer, container: HTMLElement): void {
        const setting = new Setting(container)
            .setName(server.name)
            .setDesc(server.url)

        // 添加自定义样式和徽章
        setting.nameEl.addClass('webdav-server-name');

        if (server.isDefault) {
            setting.nameEl.createEl('span', {
                text: i18n.t.settings.default,
                cls: 'webdav-default-badge'
            });
        }

        // 在服务器名称下面添加服务器地址
        const subtitleEl = setting.descEl;
        subtitleEl.setText(server.url);

        // 编辑按钮
        new ButtonComponent(setting.controlEl)
            .setIcon('settings')
            .setTooltip(i18n.t.settings.edit)
            .setCta()
            .onClick(() => this.handleEditServer(server));

        // 复制按钮
        new ButtonComponent(setting.controlEl)
            .setIcon('copy')
            .setTooltip(i18n.t.settings.copy)
            .setCta()
            .onClick(() => this.handleCopyServer(server));

        // 删除按钮
        new ButtonComponent(setting.controlEl)
            .setIcon('trash-2')
            .setTooltip(i18n.t.settings.delete)
            .setWarning()
            .onClick(() => {
                this.handleDeleteServer(server).catch(() => {
                    new Notice(i18n.t.settings.deleteFailed);
                });
            });
    }

    // ==================== 事件处理方法 ===================
    // 处理默认服务器变更
    private async handleDefaultServerChange(serverName: string): Promise<void> {
        if (!serverName) return;

        this.plugin.settings.servers.forEach(server => {
            server.isDefault = server.name === serverName;
        });

        await this.saveSettingsAndRefresh();
        new Notice(i18n.t.settings.defaultServerUpdated);
    }

    // 添加服务器

    private handleAddServer(): void {
        new ServerEditModal(this.app, this.plugin, null, (server) => {
            this.saveNewServer(server).catch(() => {
                new Notice(i18n.t.settings.saveFailed);
            });
        }).open();
    }

    // 编辑服务器
    private handleEditServer(server: WebDAVServer): void {
        new ServerEditModal(this.app, this.plugin, server, (updatedServer) => {
            this.updateServer(server, updatedServer).catch(() => {
                new Notice(i18n.t.settings.saveFailed);
            });
        }).open();
    }

    // 复制服务器
    private handleCopyServer(server: WebDAVServer): void {
        // 生成新的服务器名称
        const newName = this.generateCopyServerName(server.name);

        // 创建服务器副本,新服务器不作为默认服务器
        const copiedServer: WebDAVServer = {
            ...server,
            name: newName,
            isDefault: false
        };

        // 添加到设置中
        this.plugin.settings.servers.push(copiedServer);

        // 保存设置并刷新界面
        this.saveSettingsAndRefresh().catch(() => {
            new Notice(i18n.t.settings.saveFailed);
        });

        new Notice(i18n.t.settings.serverCopied.replace('{name}', newName));
    }

    // 生成复制服务器的唯一名称
    private generateCopyServerName(originalName: string): string {
        const baseName = `${originalName}` + i18n.t.settings.copySuffix;
        let newName = baseName;
        let counter = 1;

        // 检查名称是否已存在，如果存在则添加数字后缀
        while (this.plugin.settings.servers.some(s => s.name === newName)) {
            counter++;
            newName = `${baseName}${counter}`;
        }

        return newName;
    }

    // 删除服务器
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

    //显示删除确认对话框
    private showDeleteConfirmation(serverName: string): Promise<boolean> {
        return new Promise((resolve) => {
            const modal = new Modal(this.app);

            modal.titleEl.setText(i18n.t.settings.confirmDelete);
            modal.contentEl.createEl('p', {
                text: i18n.t.settings.confirmDeleteMessage.replace('{name}', serverName)
            });

            const buttonContainer = modal.contentEl.createDiv({cls: 'webdav-modal-button-container'});

            // 确认删除按钮
            new ButtonComponent(buttonContainer).setButtonText(i18n.t.settings.confirm).setWarning().onClick(() => {
                modal.close();
                resolve(true);
            });

            // 取消按钮
            new ButtonComponent(buttonContainer).setButtonText(i18n.t.settings.cancel).onClick(() => {
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