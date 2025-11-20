import {App, PluginSettingTab, Setting, Notice, DropdownComponent} from 'obsidian';
import WebDAVPlugin from './main';
import {WebDAVServer} from './types';
import {i18n} from "./i18n";

/**
 * WebDAV 插件设置面板
 * 负责管理 WebDAV 服务器的配置，包括服务器列表的增删改查和默认服务器设置
 */
export class WebDAVSettingTab extends PluginSettingTab {
    private readonly plugin: WebDAVPlugin;
    private defaultServerDropdown: DropdownComponent | null = null;

    constructor(app: App, plugin: WebDAVPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    /**
     * 渲染设置面板主界面
     */
    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        this.renderDefaultServerSection();
        this.renderServersSection();
    }

    // ==================== 主要区域渲染方法 ====================

    /**
     * 渲染默认服务器设置区域
     */
    private renderDefaultServerSection(): void {
        const {servers} = this.plugin.settings;

        if (servers.length === 0) return;

        new Setting(this.containerEl)
            .setName(i18n.t.settings.defaultServer)
            .setDesc(i18n.t.settings.defaultServerDesc)
            .addDropdown(dropdown => {
                this.defaultServerDropdown = dropdown;
                dropdown.selectEl.addClass('webdav-dropdown');
                this.updateDefaultServerDropdown();
                dropdown.onChange(value => this.handleDefaultServerChange(value));
            });

        this.containerEl.createEl('hr');
    }

    /**
     * 渲染服务器列表区域
     */
    private renderServersSection(): void {
        const serversContainer = this.containerEl.createEl('div');
        const {servers} = this.plugin.settings;

        if (servers.length === 0) {
            this.renderNoServersMessage(serversContainer);
        } else {
            servers.forEach((server, index) => {
                this.renderServerCard(server, serversContainer);
                if (index < servers.length - 1) {
                    serversContainer.createEl('hr');
                }
            });
        }

        this.renderAddServerButton(serversContainer);
    }

    /**
     * 渲染无服务器时的提示信息
     */
    private renderNoServersMessage(container: HTMLElement): void {
        new Setting(container)
            .setName(i18n.t.settings.noServersAvailable);
    }

    // ==================== 服务器卡片渲染方法 ====================

    /**
     * 渲染单个服务器配置卡片
     */
    private renderServerCard(server: WebDAVServer, container: HTMLElement): void {
        // 服务器头部：名称和删除按钮
        this.renderServerHeader(server, container);

        // 服务器配置项
        this.renderServerConfigurations(server, container);
    }

    /**
     * 渲染服务器头部区域
     */
    private renderServerHeader(server: WebDAVServer, container: HTMLElement): void {
        const headerSetting = new Setting(container)
            .setName(i18n.t.settings.serverName)
            .addButton(button => {
                button
                    .setIcon('trash-2')
                    .setTooltip(i18n.t.settings.deleteServer)
                    .onClick(() => this.handleDeleteServer(server));
            });

        headerSetting.addText(text => {
            text
                .setPlaceholder(i18n.t.settings.serverName)
                .setValue(server.name)
                .onChange(value => this.handleServerNameChange(server, value));
        });
    }

    /**
     * 渲染服务器的详细配置项
     */
    private renderServerConfigurations(server: WebDAVServer, container: HTMLElement): void {
        const configs = this.getServerConfigDefinitions(server);

        configs.forEach(config => {
            const setting = new Setting(container).setName(config.name);

            if (config.desc) {
                setting.setDesc(config.desc);
            }

            setting.addText(text => {
                text
                    .setPlaceholder(config.placeholder)
                    .setValue(config.value)
                    .onChange(value => this.handleConfigChange(config.onChange, value));

                if (config.isPassword) {
                    text.inputEl.type = 'password';
                }
            });
        });
    }

    /**
     * 获取服务器配置定义
     */
    private getServerConfigDefinitions(server: WebDAVServer): Array<{
        name: string;
        desc?: string;
        placeholder: string;
        value: string;
        isPassword?: boolean;
        onChange: (value: string) => void;
    }> {
        return [
            {
                name: i18n.t.settings.url,
                placeholder: 'http://192.168.0.1:8080/dav',
                value: server.url,
                onChange: (value: string) => server.url = value.trim()
            },
            {
                name: i18n.t.settings.username,
                placeholder: i18n.t.settings.username,
                value: server.username,
                onChange: (value: string) => server.username = value.trim()
            },
            {
                name: i18n.t.settings.password,
                placeholder: i18n.t.settings.password,
                value: server.password,
                isPassword: true,
                onChange: (value: string) => server.password = value
            },
            {
                name: i18n.t.settings.remoteDir,
                placeholder: '/',
                value: server.remoteDir,
                onChange: (value: string) => server.remoteDir = value.trim()
            },
            {
                name: i18n.t.settings.urlPrefix.name,
                desc: i18n.t.settings.urlPrefix.desc,
                placeholder: 'http://192.168.0.1:8000/dav',
                value: server.urlPrefix,
                onChange: (value: string) => server.urlPrefix = value.trim()
            },
            {
                name: i18n.t.settings.downloadPath.name,
                desc: i18n.t.settings.downloadPath.desc,
                placeholder: '/',
                value: server.downloadPath || '',
                onChange: (value: string) => server.downloadPath = value.trim()
            }
        ];
    }

    /**
     * 渲染添加服务器按钮
     */
    private renderAddServerButton(container: HTMLElement): void {
        new Setting(container)
            .setName(i18n.t.settings.addServer)
            .addButton(button => {
                button
                    .setButtonText('+')
                    .setCta()
                    .onClick(() => this.handleAddServer());
            });
    }

    // ==================== 事件处理方法 ====================

    /**
     * 处理默认服务器变更
     */
    private async handleDefaultServerChange(serverName: string): Promise<void> {
        if (!serverName || this.plugin.settings.servers.length === 0) return;

        this.plugin.settings.servers.forEach(server => {
            server.isDefault = server.name === serverName;
        });
        this.plugin.settings.currentServerName = serverName;

        await this.saveSettingsAndRefresh();
    }

    /**
     * 处理服务器名称变更
     */
    private async handleServerNameChange(server: WebDAVServer, newName: string): Promise<void> {
        const trimmedName = newName.trim();

        if (!trimmedName) {
            new Notice(i18n.t.settings.nameRequired);
            return;
        }

        if (this.isServerNameDuplicate(trimmedName, server)) {
            new Notice(i18n.t.settings.duplicateName);
            return;
        }

        const wasCurrentServer = server.name === this.plugin.settings.currentServerName;
        server.name = trimmedName;

        if (wasCurrentServer) {
            this.plugin.settings.currentServerName = trimmedName;
        }

        await this.saveSettingsAndRefresh();
        this.updateDefaultServerDropdown();
    }

    /**
     * 处理删除服务器
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
    }

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
        }

        // 如果删除的是当前服务器，切换到默认服务器
        if (deletedServer.name === this.plugin.settings.currentServerName) {
            const defaultServer = servers.find(s => s.isDefault) || servers[0];
            this.plugin.settings.currentServerName = defaultServer.name;
        }
    }

    /**
     * 处理配置项变更
     */
    private async handleConfigChange(onChange: (value: string) => void, value: string): Promise<void> {
        onChange(value);
        await this.plugin.saveSettings();
    }

    /**
     * 处理添加服务器
     */
    private async handleAddServer(): Promise<void> {
        const newServer = this.createNewServer();
        this.plugin.settings.servers.push(newServer);

        // 如果是第一个服务器，设置为默认
        if (this.plugin.settings.servers.length === 1) {
            newServer.isDefault = true;
            this.plugin.settings.currentServerName = newServer.name;
        }

        await this.saveSettingsAndRefresh();
    }

    /**
     * 创建新的服务器配置
     */
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
            isDefault: this.plugin.settings.servers.length === 0
        };
    }

    /**
     * 生成唯一的服务器名称
     */
    private generateUniqueServerName(baseName: string): string {
        let serverNumber = 1;
        let newName = `${baseName} ${serverNumber}`;

        while (this.isServerNameDuplicate(newName)) {
            serverNumber++;
            newName = `${baseName} ${serverNumber}`;
        }

        return newName;
    }

    // ==================== 工具方法 ====================

    /**
     * 更新默认服务器下拉选择器
     */
    private updateDefaultServerDropdown(): void {
        if (!this.defaultServerDropdown) return;

        const currentValue = this.defaultServerDropdown.getValue();
        this.defaultServerDropdown.selectEl.empty();

        this.plugin.settings.servers.forEach(server => {
            this.defaultServerDropdown!.addOption(server.name, server.name);
        });

        const defaultServer = this.plugin.settings.servers.find(s => s.isDefault) || this.plugin.settings.servers[0];
        const newValue = currentValue && this.plugin.settings.servers.some(s => s.name === currentValue)
            ? currentValue
            : defaultServer?.name;

        if (newValue) {
            this.defaultServerDropdown.setValue(newValue);
        }
    }

    /**
     * 检查服务器名称是否重复
     */
    private isServerNameDuplicate(name: string, currentServer?: WebDAVServer): boolean {
        return this.plugin.settings.servers.some(server =>
            server.name === name && server !== currentServer
        );
    }

    /**
     * 保存设置并刷新界面
     */
    private async saveSettingsAndRefresh(): Promise<void> {
        await this.plugin.saveSettings();
        this.display();
    }
}