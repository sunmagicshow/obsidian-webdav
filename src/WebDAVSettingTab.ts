import {App, PluginSettingTab, Setting, Notice, Modal, ButtonComponent} from 'obsidian';
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

// --- 添加/编辑服务器的模态框 ---
class ServerEditModal extends Modal {

    constructor(
        app: App,
        private plugin: WebDAVPlugin,
        private server: WebDAVServer,
        private onSave: (server: WebDAVServer) => void
    ) {
        super(app);
    }

    onOpen(): void {
        // 通过 ID 判断是否已存在于设置列表中，决定标题显示
        const isEdit = this.plugin.settings.servers.some(s => s.id === this.server.id);
        this.contentEl.createEl('h2', {text: i18n.t.settings[isEdit ? 'editServer' : 'addServer']});
        this.renderForm(this.contentEl, this.server);
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

        new ButtonComponent(btnContainer)
            .setButtonText(i18n.t.settings.save)
            .setCta()
            .onClick(() => this.handleSave(server));

        new ButtonComponent(btnContainer)
            .setButtonText(i18n.t.settings.cancel)
            .onClick(() => this.close());
    }

    private renderDropdown(setting: Setting, config: FormFieldConfig, server: WebDAVServer): void {
        const secretIds = this.app.secretStorage.listSecrets();

        setting.addButton(btn => {
            btn
                .setIcon('key-round')
                .setTooltip(i18n.t.settings.openKeychain)
                .onClick(() => this.openKeychain());

            btn.buttonEl.addClass('clickable-icon');
        }).addDropdown(dropdown => {
            dropdown.selectEl.addClass('webdav-keychain-dropdown');

            const options: Record<string, string> = {
                '': '-- ' + i18n.t.settings.selectSecretId + ' --'
            };
            secretIds.forEach(id => {
                options[id] = id;
            });
            dropdown.addOptions(options)
                .setValue(config.getValue(server))
                .onChange(v => config.setValue(server, v));

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
                const keychainTab = activeDocument.querySelector('.vertical-tab-nav-item[data-setting-id="keychain"]');
                if (keychainTab) (keychainTab as HTMLElement).click();
            } catch {
                new Notice(i18n.t.settings.keyChainFailed);
            }
        }, 100);
    }

    private handleSave(server: WebDAVServer): void {
        if (!this.validate(server)) return;
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

        // 使用 ID 排除自身，解决副本重名误判
        const isDuplicate = this.plugin.settings.servers.some(s =>
            s.name === server.name && s.id !== server.id
        );

        if (isDuplicate) {
            new Notice(i18n.t.settings.duplicateName);
            return false;
        }

        return true;
    }
}

// --- WebDAV 插件设置面板 ---
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
                    .onClick(() => this.handleAddServer())
                    .buttonEl.addClass('clickable-icon')
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
            .setDesc(server.url);

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

        new ButtonComponent(setting.controlEl)
            .setIcon('settings')
            .setTooltip(i18n.t.settings.edit)
            .onClick(() => this.handleEditServer(server))
            .buttonEl.addClass('clickable-icon');

        // 复制按钮
        new ButtonComponent(setting.controlEl)
            .setIcon('copy')
            .setTooltip(i18n.t.settings.copy)
            .onClick(() => this.handleCopyServer(server))
            .buttonEl.addClass('clickable-icon');

        // 删除按钮
        new ButtonComponent(setting.controlEl)
            .setIcon('trash-2')
            .setTooltip(i18n.t.settings.delete)
            .onClick(() => {
                this.handleDeleteServer(server).catch(() => {
                    new Notice(i18n.t.settings.deleteFailed);
                });
            })
            .buttonEl.addClass('clickable-icon');
    }

    // ==================== 事件处理方法 ===================
    // 处理默认服务器变更
    private async handleDefaultServerChange(serverName: string): Promise<void> {
        const target = this.plugin.settings.servers.find(s => s.name === serverName);
        if (!target) return;

        this.plugin.settings.servers.forEach(server => {
            server.isDefault = server.id === target.id;
        });

        // 同时记录 ID 和 Name
        this.plugin.settings.currentServerId = target.id;
        this.plugin.settings.currentServerName = target.name;

        await this.saveSettingsAndRefresh();
        new Notice(i18n.t.settings.defaultServerUpdated);
    }

    // 添加服务器
    private handleAddServer(): void {
        const newServer: WebDAVServer = {
            id: `id-${Date.now()}`,
            name: this.generateUniqueServerName(i18n.t.settings.serverName),
            url: '',
            username: '',
            secretId: '',
            remoteDir: '',
            urlPrefix: '',
            downloadPath: '',
            isDefault: this.plugin.settings.servers.length === 0
        };

        new ServerEditModal(this.app, this.plugin, newServer, (server) => {
            this.saveNewServer(server).catch(() => new Notice(i18n.t.settings.saveFailed));
        }).open();
    }

    // 编辑服务器
    private handleEditServer(server: WebDAVServer): void {
        const serverCopy: WebDAVServer = {...server};
        new ServerEditModal(this.app, this.plugin, serverCopy, (updatedServer) => {
            this.updateServer(server, updatedServer).catch(() => new Notice(i18n.t.settings.saveFailed));
        }).open();
    }

    // 复制服务器
    private handleCopyServer(server: WebDAVServer): void {
        // 生成新的服务器名称
        const newName = this.generateCopyServerName(server.name);

        // 创建服务器副本,新服务器不作为默认服务器
        const copiedServer: WebDAVServer = {
            ...server,
            id: `id-${Date.now()}`, // 必须生成新 ID
            name: newName,
            isDefault: false
        };

        this.plugin.settings.servers.push(copiedServer);
        this.saveSettingsAndRefresh().catch(() => new Notice(i18n.t.settings.saveFailed));
    }

// 删除服务器
    private async handleDeleteServer(server: WebDAVServer): Promise<void> {
        const confirmed = await this.showDeleteConfirmation(server.name);
        if (!confirmed) return;

        const {servers} = this.plugin.settings;
        const index = servers.findIndex(s => s.id === server.id);
        if (index !== -1) {
            servers.splice(index, 1);
            this.handleDefaultServerAfterDeletion(server);
            await this.saveSettingsAndRefresh();
            this.plugin.notifyServerChanged();
        }
    }

    // --- 内部逻辑与工具方法 ---

    private async saveNewServer(server: WebDAVServer): Promise<void> {
        this.plugin.settings.servers.push(server);
        // 如果是第一个服务器或显式设为默认，更新当前 ID
        if (server.isDefault) {
            this.plugin.settings.currentServerId = server.id;
            this.plugin.settings.currentServerName = server.name;
        }
        await this.saveSettingsAndRefresh();
        this.plugin.notifyServerChanged();
    }

    private async updateServer(oldServer: WebDAVServer, updatedServer: WebDAVServer): Promise<void> {
        const index = this.plugin.settings.servers.findIndex(s => s.id === oldServer.id);
        if (index !== -1) {
            this.plugin.settings.servers[index] = updatedServer;

            // 使用 ID 匹配判断是否是当前正在查看的服务器
            if (oldServer.id === this.plugin.settings.currentServerId) {
                this.plugin.settings.currentServerId = updatedServer.id;
                this.plugin.settings.currentServerName = updatedServer.name;
            }

            await this.saveSettingsAndRefresh();
            this.plugin.notifyServerChanged();
        }
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

    private generateCopyServerName(originalName: string): string {
        const suffix = i18n.t.settings.copySuffix || " (Copy)";
        const baseName = `${originalName}${suffix}`;
        let newName = baseName;
        let counter = 1;
        while (this.plugin.settings.servers.some(s => s.name === newName)) {
            counter++;
            newName = `${baseName} ${counter}`;
        }
        return newName;
    }

    private async showDeleteConfirmation(serverName: string): Promise<boolean> {
        return new Promise((resolve) => {
            const modal = new Modal(this.app);
            modal.titleEl.setText(i18n.t.settings.confirmDelete);
            modal.contentEl.createEl('p', {text: i18n.t.settings.confirmDeleteMessage.replace('{name}', serverName)});
            const buttonContainer = modal.contentEl.createDiv({cls: 'webdav-modal-button-container'});
            new ButtonComponent(buttonContainer).setButtonText(i18n.t.settings.confirm).setWarning().onClick(() => {
                modal.close();
                resolve(true);
            });
            new ButtonComponent(buttonContainer).setButtonText(i18n.t.settings.cancel).onClick(() => {
                modal.close();
                resolve(false);
            });
            modal.open();
        });
    }

    private handleDefaultServerAfterDeletion(deletedServer: WebDAVServer): void {
        const {servers} = this.plugin.settings;

        // 1. 如果删光了，清空所有引用
        if (servers.length === 0) {
            this.plugin.settings.currentServerId = '';
            this.plugin.settings.currentServerName = '';
            return;
        }

        // 2. 检查当前是否还存在默认服务器
        const hasDefault = servers.some(s => s.isDefault);

        // 3. 如果删掉的是默认服务器，或者当前没有默认服务器了
        if (deletedServer.isDefault || !hasDefault) {
            // 强制将列表中的第一个设为默认
            servers[0].isDefault = true;
        }

        // 4. 更新当前活跃服务器的引用（ID 和 Name）
        // 如果删掉的正是在视图中打开的那台，则切换到新的默认服务器
        if (deletedServer.id === this.plugin.settings.currentServerId) {
            const nextActive = servers.find(s => s.isDefault) || servers[0];
            this.plugin.settings.currentServerId = nextActive.id;
            this.plugin.settings.currentServerName = nextActive.name;
        }
    }

    private async saveSettingsAndRefresh(): Promise<void> {
        await this.plugin.saveData(this.plugin.settings);
        this.display();
    }
}