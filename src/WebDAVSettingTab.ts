import {App, PluginSettingTab, Setting, Notice, DropdownComponent} from 'obsidian';
import WebDAVPlugin from './main';
import {WebDAVServer} from './types';

export class WebDAVSettingTab extends PluginSettingTab {
    plugin: WebDAVPlugin;
    private defaultServerDropdown: DropdownComponent | null = null;

    constructor(app: App, plugin: WebDAVPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        const t = this.plugin.i18n();

        containerEl.empty();
        containerEl.addClass('webdav-setting-tab');

        // 默认服务器设置
        if (this.plugin.settings.servers.length > 0) {
            const defaultServerSetting = new Setting(containerEl)
                .setName(t.settings.defaultServer)
                .setDesc(t.settings.defaultServerDesc);

            defaultServerSetting.addDropdown((dropdown: DropdownComponent) => {
                this.defaultServerDropdown = dropdown;
                dropdown.selectEl.addClass('webdav-dropdown');
                this.updateDefaultServerDropdown();

                dropdown.onChange(async (value: string) => {
                    if (value && this.plugin.settings.servers.length > 0) {
                        this.plugin.settings.servers.forEach(s => {
                            s.isDefault = s.name === value;
                        });
                        this.plugin.settings.currentServerName = value;
                        await this.plugin.saveSettings();
                        this.display();
                    }
                });
            });

            containerEl.createEl('hr');
        }

        // 服务器列表容器
        const serversContainer = containerEl.createEl('div');


        // 显示所有服务器配置
        this.plugin.settings.servers.forEach((server, index) => {
            this.renderServerSettings(server, index, serversContainer);

            // 分隔线
            if (index < this.plugin.settings.servers.length - 1) {
                serversContainer.createEl('hr');
            }
        });

        // 添加服务器按钮
        this.renderAddServerButton(serversContainer);
    }

    private renderServerSettings(server: WebDAVServer, index: number, container: HTMLElement): void {
        const t = this.plugin.i18n();

        // 服务器标题和删除按钮
        const serverSetting = new Setting(container)
            .setName(t.settings.serverName)
            .addButton(button => {
                button
                    .setIcon('trash-2')
                    .setTooltip(t.settings.deleteServer)
                    .onClick(async () => {
                        if (this.plugin.settings.servers.length === 1) {
                            new Notice(t.settings.deleteNotice);
                            return;
                        }

                        const isDeletingDefault = server.isDefault;
                        const isCurrentServer = server.name === this.plugin.settings.currentServerName;

                        this.plugin.settings.servers.splice(index, 1);

                        if (isDeletingDefault && this.plugin.settings.servers.length > 0) {
                            const newDefault = this.plugin.settings.servers[0];
                            newDefault.isDefault = true;
                        }

                        // 如果删除的是当前服务器，切换到默认服务器
                        if (isCurrentServer && this.plugin.settings.servers.length > 0) {
                            const defaultServer = this.plugin.settings.servers.find(s => s.isDefault) || this.plugin.settings.servers[0];
                            this.plugin.settings.currentServerName = defaultServer.name;
                        }

                        await this.plugin.saveSettings();
                        this.display();
                    });
            });

        // 服务器名称输入框
        serverSetting.addText(text => {
            text
                .setPlaceholder(t.settings.serverName)
                .setValue(server.name)
                .onChange(async (value: string) => {
                    const newName = value.trim();

                    if (newName === '') {
                        new Notice(t.settings.nameRequired);
                        text.setValue(server.name);
                        return;
                    }

                    // 检查名称是否重复
                    if (this.isServerNameDuplicate(newName, server)) {
                        new Notice(t.settings.duplicateName);
                        text.setValue(server.name);
                        return;
                    }

                    const oldName = server.name;
                    const wasCurrentServer = oldName === this.plugin.settings.currentServerName;
                    server.name = newName;

                    // 如果这是当前服务器，更新当前服务器名称
                    if (wasCurrentServer) {
                        this.plugin.settings.currentServerName = newName;
                    }

                    await this.plugin.saveSettings();
                    this.updateDefaultServerDropdown();
                });
        });

        // 基础设置
        this.renderSettings(server, container);
    }

    private renderSettings(server: WebDAVServer, container: HTMLElement): void {
        const t = this.plugin.i18n();

        // URL配置
        new Setting(container)
            .setName(t.settings.url)
            .addText(text => {
                text
                    .setPlaceholder('http://192.168.0.1:8080/dav')
                    .setValue(server.url)
                    .onChange(async (value: string) => {
                        server.url = value.trim();
                        await this.plugin.saveSettings();
                    });
            });

        // 用户名配置
        new Setting(container)
            .setName(t.settings.username)
            .addText(text => {
                text
                    .setPlaceholder(t.settings.username)
                    .setValue(server.username)
                    .onChange(async (value: string) => {
                        server.username = value.trim();
                        await this.plugin.saveSettings();
                    });
            });

        // 密码配置
        new Setting(container)
            .setName(t.settings.password)
            .addText(text => {
                text
                    .setPlaceholder(t.settings.password)
                    .setValue(server.password)
                text.inputEl.type = 'password';
                text.onChange(async (value: string) => {
                    server.password = value;
                    await this.plugin.saveSettings();
                });
            });

        // 远程目录配置
        new Setting(container)
            .setName(t.settings.remoteDir)
            .addText(text => {
                text
                    .setPlaceholder('/')
                    .setValue(server.remoteDir)
                    .onChange(async (value: string) => {
                        server.remoteDir = value.trim();
                        await this.plugin.saveSettings();
                    });
            });

        // URL前缀配置
        new Setting(container)
            .setName(t.settings.urlPrefix.name)
            .setDesc(t.settings.urlPrefix.desc)
            .addText(text => {
                text
                    .setPlaceholder('http://192.168.0.1:8000/dav')
                    .setValue(server.urlPrefix)
                    .onChange(async (value: string) => {
                        server.urlPrefix = value.trim();
                        await this.plugin.saveSettings();
                    });
            });

        // 下载路径配置
        new Setting(container)
            .setName(t.settings.downloadPath.name)
            .setDesc(t.settings.downloadPath.desc)
            .addText(text => {
                text
                    .setPlaceholder("/")
                    .setValue(server.downloadPath || '')
                    .onChange(async (value: string) => {
                        server.downloadPath = value.trim();
                        await this.plugin.saveSettings();
                    });
            });
    }

    private renderAddServerButton(container: HTMLElement): void {
        const t = this.plugin.i18n();

        new Setting(container)
            .setName(t.settings.addServer)
            .addButton(button => {
                button
                    .setButtonText('+')
                    .setCta()
                    .onClick(async () => {
                        const baseName = t.settings.serverName;
                        let serverNumber = 1;
                        let newName = `${baseName} ${serverNumber}`;

                        // 生成不重复的名称
                        while (this.isServerNameDuplicate(newName)) {
                            serverNumber++;
                            newName = `${baseName} ${serverNumber}`;
                        }

                        const newServer: WebDAVServer = {
                            name: newName,
                            url: '',
                            username: '',
                            password: '',
                            remoteDir: '',
                            urlPrefix: '',
                            isDefault: this.plugin.settings.servers.length === 0
                        };

                        this.plugin.settings.servers.push(newServer);

                        if (this.plugin.settings.servers.length === 1) {
                            newServer.isDefault = true;
                            this.plugin.settings.currentServerName = newServer.name;
                        }

                        await this.plugin.saveSettings();
                        this.display();
                    });
            });
    }


    private updateDefaultServerDropdown(): void {
        if (!this.defaultServerDropdown) return;

        const currentValue = this.defaultServerDropdown.getValue();
        this.defaultServerDropdown.selectEl.empty();

        this.plugin.settings.servers.forEach(server => {
            this.defaultServerDropdown!.addOption(server.name, server.name);
        });

        if (currentValue && this.plugin.settings.servers.some(s => s.name === currentValue)) {
            this.defaultServerDropdown.setValue(currentValue);
        } else if (this.plugin.settings.servers.length > 0) {
            const defaultServer = this.plugin.settings.servers.find(s => s.isDefault) || this.plugin.settings.servers[0];
            this.defaultServerDropdown.setValue(defaultServer.name);
        }
    }

    private isServerNameDuplicate(name: string, currentServer?: WebDAVServer): boolean {
        return this.plugin.settings.servers.some(server =>
            server.name === name && server !== currentServer
        );
    }
}