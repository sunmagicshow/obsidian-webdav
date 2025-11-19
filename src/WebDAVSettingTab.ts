import {App, PluginSettingTab, Setting, Notice, DropdownComponent} from 'obsidian';
import WebDAVPlugin from './main';
import {WebDAVServer} from './types';

/**
 * WebDAV 插件设置面板
 *
 * 负责管理 WebDAV 服务器的配置，包括：
 * - 服务器列表的增删改查
 * - 默认服务器设置
 * - 服务器连接参数配置
 */
export class WebDAVSettingTab extends PluginSettingTab {
    private readonly plugin: WebDAVPlugin;
    private defaultServerDropdown: DropdownComponent | null = null;

    /**
     * 构造函数
     * @param app Obsidian 应用实例
     * @param plugin WebDAV 插件实例
     */
    constructor(app: App, plugin: WebDAVPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    /**
     * 翻译工具 getter
     */
    private get t() {
        return this.plugin.t;
    }

    /**
     * 渲染设置面板主界面
     *
     * 该方法在设置面板打开时被调用，负责构建完整的设置界面
     */
    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        // 按顺序渲染各个设置区域
        this.renderDefaultServerSection();
        this.renderServersSection();
    }

    // ==================== 主要区域渲染方法 ====================

    /**
     * 渲染默认服务器设置区域
     *
     * 显示服务器下拉选择器，用于设置默认的 WebDAV 服务器
     * 只有在至少配置了一个服务器时才会显示此区域
     */
    private renderDefaultServerSection(): void {
        const {servers} = this.plugin.settings;

        // 没有服务器时不显示默认服务器设置
        if (servers.length === 0) return;

        // 创建默认服务器设置项
        new Setting(this.containerEl)
            .setName(this.t.settings.defaultServer)
            .setDesc(this.t.settings.defaultServerDesc)
            .addDropdown(dropdown => {
                this.defaultServerDropdown = dropdown;
                dropdown.selectEl.addClass('webdav-dropdown');
                this.updateDefaultServerDropdown();

                // 绑定服务器切换事件
                dropdown.onChange(value => this.handleDefaultServerChange(value));
            });

        // 添加视觉分隔线
        this.containerEl.createEl('hr');
    }

    /**
     * 渲染服务器列表区域
     *
     * 显示所有已配置的服务器卡片和添加服务器按钮
     */
    private renderServersSection(): void {
        const serversContainer = this.containerEl.createEl('div');
        const {servers} = this.plugin.settings;

        // 如果没有服务器，显示提示信息
        if (servers.length === 0) {
            this.renderNoServersMessage(serversContainer);
        } else {
            // 渲染每个服务器配置卡片
            servers.forEach((server, index) => {
                this.renderServerCard(server, index, serversContainer);

                // 在服务器卡片之间添加分隔线（最后一个不添加）
                if (index < servers.length - 1) {
                    serversContainer.createEl('hr');
                }
            });
        }

        // 渲染添加服务器按钮
        this.renderAddServerButton(serversContainer);
    }

    /**
     * 渲染无服务器时的提示信息
     */
    private renderNoServersMessage(container: HTMLElement): void {
        new Setting(container)
            .setName(this.t.settings.noServersAvailable)
    }

    // ==================== 服务器卡片渲染方法 ====================

    /**
     * 渲染单个服务器配置卡片
     *
     * @param server 服务器配置对象
     * @param index 服务器在列表中的索引
     * @param container 父容器元素
     */
    private renderServerCard(server: WebDAVServer, index: number, container: HTMLElement): void {
        // 服务器头部区域：名称编辑和删除按钮
        const headerSetting = new Setting(container)
            .setName(this.t.settings.serverName)
            .addButton(button => {
                button
                    .setIcon('trash-2')
                    .setTooltip(this.t.settings.deleteServer)
                    .onClick(() => this.handleDeleteServer(server, index));
            });

        // 服务器名称输入框
        headerSetting.addText(text => {
            text
                .setPlaceholder(this.t.settings.serverName)
                .setValue(server.name)
                .onChange(value => this.handleServerNameChange(server, value));
        });

        // 渲染服务器的详细配置项
        this.renderServerConfigurations(server, container);
    }

    /**
     * 渲染服务器的详细配置项
     *
     * 包括 URL、用户名、密码、远程目录等所有连接参数
     *
     * @param server 服务器配置对象
     * @param container 父容器元素
     */
    private renderServerConfigurations(server: WebDAVServer, container: HTMLElement): void {

        // 服务器配置项定义数组
        const configs = [
            {
                name: this.t.settings.url,
                placeholder: 'http://192.168.0.1:8080/dav',
                value: server.url,
                onChange: (value: string) => {
                    server.url = value.trim();
                }
            },
            {
                name: this.t.settings.username,
                placeholder: this.t.settings.username,
                value: server.username,
                onChange: (value: string) => {
                    server.username = value.trim();
                }
            },
            {
                name: this.t.settings.password,
                placeholder: this.t.settings.password,
                value: server.password,
                isPassword: true,  // 标记为密码字段
                onChange: (value: string) => {
                    server.password = value;
                }
            },
            {
                name: this.t.settings.remoteDir,
                placeholder: '/',
                value: server.remoteDir,
                onChange: (value: string) => {
                    server.remoteDir = value.trim();
                }
            },
            {
                name: this.t.settings.urlPrefix.name,
                desc: this.t.settings.urlPrefix.desc,
                placeholder: 'http://192.168.0.1:8000/dav',
                value: server.urlPrefix,
                onChange: (value: string) => {
                    server.urlPrefix = value.trim();
                }
            },
            {
                name: this.t.settings.downloadPath.name,
                desc: this.t.settings.downloadPath.desc,
                placeholder: '/',
                value: server.downloadPath || '',
                onChange: (value: string) => {
                    server.downloadPath = value.trim();
                }
            }
        ];

        // 遍历配置数组，为每个配置项创建设置控件
        configs.forEach(config => {
            const setting = new Setting(container)
                .setName(config.name);

            // 设置描述文本（如果有）
            if (config.desc) {
                setting.setDesc(config.desc);
            }

            setting.addText(text => {
                text
                    .setPlaceholder(config.placeholder)
                    .setValue(config.value)
                    .onChange(value => this.handleConfigChange(config.onChange, value));

                // 如果是密码字段，设置输入框类型
                if (config.isPassword) {
                    text.inputEl.type = 'password';
                }
            });
        });
    }

    /**
     * 渲染添加服务器按钮
     *
     * @param container 父容器元素
     */
    private renderAddServerButton(container: HTMLElement): void {

        new Setting(container)
            .setName(this.t.settings.addServer)
            .addButton(button => {
                button
                    .setButtonText('+')
                    .setCta()  // 设置为主要操作按钮样式
                    .onClick(() => this.handleAddServer());
            });
    }

    // ==================== 事件处理方法 ====================

    /**
     * 处理默认服务器变更事件
     *
     * @param serverName 新选择的服务器名称
     */
    private handleDefaultServerChange(serverName: string): void {
        // 验证输入有效性
        if (!serverName || this.plugin.settings.servers.length === 0) return;

        // 更新所有服务器的默认状态
        this.plugin.settings.servers.forEach(server => {
            server.isDefault = server.name === serverName;
        });
        this.plugin.settings.currentServerName = serverName;

        // 保存设置并刷新界面
        this.plugin.saveData(this.plugin.settings)
        this.display();
    }

    /**
     * 处理服务器名称变更事件
     *
     * @param server 服务器配置对象
     * @param newName 新的服务器名称
     */
    private handleServerNameChange(server: WebDAVServer, newName: string): void {
        const trimmedName = newName.trim();

        // 验证名称非空
        if (!trimmedName) {
            new Notice(this.t.settings.nameRequired);
            return;
        }

        // 验证名称唯一性
        if (this.isServerNameDuplicate(trimmedName, server)) {
            new Notice(this.t.settings.duplicateName);
            return;
        }

        // 更新服务器名称
        const wasCurrentServer = server.name === this.plugin.settings.currentServerName;
        server.name = trimmedName;

        // 如果修改的是当前服务器，同步更新当前服务器名称
        if (wasCurrentServer) {
            this.plugin.settings.currentServerName = trimmedName;
        }

        this.plugin.saveData(this.plugin.settings)
        this.updateDefaultServerDropdown();
    }

    /**
     * 处理删除服务器事件
     *
     * @param server 要删除的服务器配置对象
     * @param index 服务器在列表中的索引
     */
    private handleDeleteServer(server: WebDAVServer, index: number): void {
        // 从服务器列表中移除
        this.plugin.settings.servers.splice(index, 1);

        // 如果删除的是默认服务器且还有剩余服务器，将第一个服务器设为默认
        if (server.isDefault && this.plugin.settings.servers.length > 0) {
            this.plugin.settings.servers[0].isDefault = true;
        }

        // 如果删除的是当前服务器且还有剩余服务器，切换到默认服务器
        if (server.name === this.plugin.settings.currentServerName && this.plugin.settings.servers.length > 0) {
            const defaultServer = this.plugin.settings.servers.find(s => s.isDefault) || this.plugin.settings.servers[0];
            this.plugin.settings.currentServerName = defaultServer.name;
        } else if (this.plugin.settings.servers.length === 0) {
            // 如果没有服务器了，清空当前服务器名称
            this.plugin.settings.currentServerName = '';
        }

        this.plugin.notifyServerChanged();
        this.display();  // 完全重新渲染界面
    }

    /**
     * 处理配置项变更事件
     *
     * @param onChange 具体的变更处理函数
     * @param value 新的配置值
     */
    private handleConfigChange(onChange: (value: string) => void, value: string): void {
        // 执行具体的配置更新逻辑
        onChange(value);
        // 保存设置到持久化存储
        this.plugin.saveData(this.plugin.settings)
    }

    /**
     * 处理添加服务器事件
     *
     * 创建新的服务器配置并添加到列表
     */
    private handleAddServer(): void {
        const baseName = this.t.settings.serverName;

        // 生成唯一的服务器名称
        let serverNumber = 1;
        let newName = `${baseName} ${serverNumber}`;

        while (this.isServerNameDuplicate(newName)) {
            serverNumber++;
            newName = `${baseName} ${serverNumber}`;
        }

        // 创建新的服务器配置对象
        const newServer: WebDAVServer = {
            name: newName,
            url: '',
            username: '',
            password: '',
            remoteDir: '',
            urlPrefix: '',
            isDefault: this.plugin.settings.servers.length === 0  // 如果是第一个服务器，设为默认
        };

        // 添加到服务器列表
        this.plugin.settings.servers.push(newServer);

        // 如果是第一个服务器，设置为默认和当前服务器
        if (this.plugin.settings.servers.length === 1) {
            newServer.isDefault = true;
            this.plugin.settings.currentServerName = newServer.name;
        }

        this.plugin.saveData(this.plugin.settings)
        this.display();  // 重新渲染以显示新服务器
    }

    // ==================== 工具方法 ====================

    /**
     * 更新默认服务器下拉选择器
     *
     * 根据当前服务器列表刷新下拉框选项和选中状态
     */
    private updateDefaultServerDropdown(): void {
        if (!this.defaultServerDropdown) return;

        const currentValue = this.defaultServerDropdown.getValue();

        // 清空现有选项
        this.defaultServerDropdown.selectEl.empty();

        // 重新添加所有服务器选项
        this.plugin.settings.servers.forEach(server => {
            this.defaultServerDropdown!.addOption(server.name, server.name);
        });

        // 确定新的选中值
        const defaultServer = this.plugin.settings.servers.find(s => s.isDefault) || this.plugin.settings.servers[0];
        const newValue = currentValue && this.plugin.settings.servers.some(s => s.name === currentValue)
            ? currentValue  // 保持原选择（如果仍然有效）
            : defaultServer?.name;  // 否则使用默认服务器

        // 更新下拉框选中值
        if (newValue) {
            this.defaultServerDropdown.setValue(newValue);
        }
    }

    /**
     * 检查服务器名称是否重复
     *
     * @param name 要检查的服务器名称
     * @param currentServer 当前正在编辑的服务器（用于排除自身）
     * @returns 如果名称重复返回 true，否则返回 false
     */
    private isServerNameDuplicate(name: string, currentServer?: WebDAVServer): boolean {
        return this.plugin.settings.servers.some(server =>
            server.name === name && server !== currentServer
        );
    }
}