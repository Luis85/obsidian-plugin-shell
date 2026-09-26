/** Plugin base class: every registration is recorded on the app and removed again on unload. */
import type { Command, PluginManifest } from 'obsidian';
import type { App } from './app';
import { Component } from './component';
import { make } from './dom';
import type { PluginSettingTab } from './settings';
import type { ViewCreator } from './workspace';

export class Plugin extends Component {
  constructor(readonly app: App, readonly manifest: PluginManifest) { super(); }
  /** `${configDir}/plugins/${id}/data.json` unless the manifest carries its own `dir`. */
  get dataPath(): string { return `${this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`}/data.json`; }
  /** Reads the same adapter bytes `saveData` wrote; `null` when absent. */
  async loadData(): Promise<unknown> {
    const adapter = this.app.vault.adapter;
    return await adapter.exists(this.dataPath) ? JSON.parse(await adapter.read(this.dataPath)) : null;
  }
  async saveData(data: unknown): Promise<void> { await this.app.vault.adapter.write(this.dataPath, JSON.stringify(data, null, 2)); }
  /** Prefixes id and name with the manifest like the host and mutates/returns the same object. */
  addCommand(command: Command): Command {
    command.id = `${this.manifest.id}:${command.id}`;
    command.name = `${this.manifest.name}: ${command.name}`;
    this.app.commands.addCommand(command);
    const id = command.id; this.register(() => this.app.commands.removeCommand(id));
    return command;
  }
  /** Takes the local (unprefixed) id, like the host. */
  removeCommand(commandId: string): void { this.app.commands.removeCommand(`${this.manifest.id}:${commandId}`); }
  addRibbonIcon(icon: string, title: string, callback: (event: MouseEvent) => unknown): HTMLElement {
    const element = make(this.app.ribbonEl, 'div', { cls: ['side-dock-ribbon-action', 'clickable-icon'], attr: { 'aria-label': title, 'data-icon': icon } });
    element.addEventListener('click', callback);
    const item = { icon, title, element, callback }; this.app.ribbonItems.push(item);
    this.register(() => { element.remove(); this.app.ribbonItems.splice(this.app.ribbonItems.indexOf(item), 1); });
    return element;
  }
  addStatusBarItem(): HTMLElement {
    const element = make(this.app.statusBarEl, 'div', 'status-bar-item');
    this.register(() => element.remove()); return element;
  }
  addSettingTab(tab: PluginSettingTab): void {
    this.app.setting.pluginTabs.push(tab);
    this.register(() => { tab.hide(); this.app.setting.pluginTabs.splice(this.app.setting.pluginTabs.indexOf(tab), 1); });
  }
  /** Throws for an already registered type; on unload open leaves keep a placeholder (never detached). */
  registerView(type: string, creator: ViewCreator): void {
    this.app.viewRegistry.registerView(type, creator);
    this.register(() => { this.app.viewRegistry.unregisterView(type); this.app.workspace.unloadViewsOfType(type); });
  }
  registerExtensions(extensions: string[], viewType: string): void {
    for (const extension of extensions) this.app.viewRegistry.typeByExtension.set(extension, viewType);
    this.register(() => { for (const extension of extensions) this.app.viewRegistry.typeByExtension.delete(extension); });
  }
  onUserEnable(): void {}
  onExternalSettingsChange(): void | Promise<void> {}
}
