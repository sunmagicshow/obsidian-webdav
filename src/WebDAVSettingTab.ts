import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import  WebDAVPlugin from './main';
import { WebDAVServer } from './types';

export class WebDAVSettingTab extends PluginSettingTab {
  plugin: WebDAVPlugin;
  private defaultServerDropdown: any = null;

  constructor(app: App, plugin: WebDAVPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    const { i18n } = this.plugin;
    const t = i18n();

    containerEl.empty();
    containerEl.createEl('h2', { text: t.settings.title });

    // 默认服务器设置
    const defaultServerSetting = new Setting(containerEl)
      .setName(t.settings.defaultServer)
      .setDesc(t.settings.defaultServerDesc);

    defaultServerSetting.addDropdown(dropdown => {
      this.defaultServerDropdown = dropdown;
      dropdown.selectEl.style.minWidth = '150px';
      this.updateDefaultServerDropdown();

      dropdown.onChange(async (value: string) => {
        if (value && this.plugin.settings.servers.length > 0) {
          this.plugin.settings.servers.forEach(s => {
            s.isDefault = s.id === value;
          });
          this.plugin.settings.currentServerId = value;
          await this.plugin.saveSettings();
          this.display();
        }
      });
    });

    containerEl.createEl('hr');

    // 服务器列表标题和添加按钮
    const serversHeader = containerEl.createEl('div', { cls: 'webdav-servers-header' });
    serversHeader.createEl('h3', { text: t.settings.serverList });

    // 添加服务器按钮
    const addServerSetting = new Setting(serversHeader)
      .setName(t.settings.addServer)
      .addButton(button => {
        button
          .setButtonText('+')
          .setCta()
          .onClick(async () => {
            const newServer: WebDAVServer = {
              id: this.generateId(),
              name: `WebDAV Server ${this.plugin.settings.servers.length + 1}`,
              url: '',
              username: '',
              password: '',
              remoteDir: '',
              isDefault: this.plugin.settings.servers.length === 0
            };
            this.plugin.settings.servers.push(newServer);

            if (this.plugin.settings.servers.length === 1) {
              newServer.isDefault = true;
              this.plugin.settings.currentServerId = newServer.id;
            }

            await this.plugin.saveSettings();
            this.display();
          });
      });

    // 服务器列表容器
    const serversContainer = containerEl.createEl('div', { cls: 'webdav-servers-container' });

    // 如果没有服务器，显示提示
    if (this.plugin.settings.servers.length === 0) {
      serversContainer.createEl('p', {
        text: t.settings.noServers,
        cls: 'webdav-no-servers'
      });
      return;
    }

    // 显示所有服务器配置
    this.plugin.settings.servers.forEach((server, index) => {
      // 创建服务器标题和删除按钮
      const serverSetting = new Setting(serversContainer)
        .setName(server.name)
        .setDesc(this.getServerDescription(server))
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
              this.plugin.settings.servers.splice(index, 1);

              if (isDeletingDefault) {
                const newDefault = this.plugin.settings.servers[0];
                newDefault.isDefault = true;
                this.plugin.settings.currentServerId = newDefault.id;
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
            server.name = value.trim();
            await this.plugin.saveSettings();
            serverSetting.setName(server.name);
            serverSetting.setDesc(this.getServerDescription(server));
            this.updateDefaultServerDropdown();
          });
      });

      // URL配置
      new Setting(serversContainer)
        .setName(t.settings.url.name)
        .setDesc(t.settings.url.desc)
        .addText(text => {
          text
            .setPlaceholder('http://192.168.0.1:8888/dav')
            .setValue(server.url)
            .onChange(async (value: string) => {
              server.url = value.trim();
              await this.plugin.saveSettings();
              serverSetting.setDesc(this.getServerDescription(server));
            });
        });

      // 用户名配置
      new Setting(serversContainer)
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
      new Setting(serversContainer)
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
      new Setting(serversContainer)
        .setName(t.settings.remoteDir.name)
        .setDesc(t.settings.remoteDir.desc)
        .addText(text => {
          text
            .setPlaceholder('/')
            .setValue(server.remoteDir)
            .onChange(async (value: string) => {
              server.remoteDir = value.trim();
              await this.plugin.saveSettings();
              serverSetting.setDesc(this.getServerDescription(server));
            });
        });

      // 分隔线
      if (index < this.plugin.settings.servers.length - 1) {
        serversContainer.createEl('hr');
      }
    });
  }

  private updateDefaultServerDropdown() {
    if (!this.defaultServerDropdown) return;
    const currentValue = this.defaultServerDropdown.getValue();
    this.defaultServerDropdown.selectEl.empty();

    this.plugin.settings.servers.forEach(server => {
      this.defaultServerDropdown.addOption(server.id, server.name);
    });

    if (currentValue && this.plugin.settings.servers.some(s => s.id === currentValue)) {
      this.defaultServerDropdown.setValue(currentValue);
    } else if (this.plugin.settings.servers.length > 0) {
      const defaultServer = this.plugin.settings.servers.find(s => s.isDefault) || this.plugin.settings.servers[0];
      this.defaultServerDropdown.setValue(defaultServer.id);
    }
  }

  private getServerDescription(server: WebDAVServer): string {
    const parts = [];
    parts.push(`ID: ${server.id}`);
    if (server.remoteDir && server.remoteDir !== '/') {
      parts.push(`Dir: ${server.remoteDir}`);
    }
    if (server.isDefault) {
      parts.push('(Default)');
    }
    return parts.length > 0 ? parts.join(' | ') : 'No remote directory configured';
  }

  private generateId(): string {
    return 'server_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
  }
}
