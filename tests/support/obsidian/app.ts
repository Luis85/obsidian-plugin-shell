/** App composition plus the host registries plugins write into (commands, views, settings, ribbon). */
import type { Command } from 'obsidian';
import { Scope } from './component';
import { hasDom, make } from './dom';
import { FileManager } from './file-manager';
import { MetadataCache } from './metadata';
import type { PluginSettingTab } from './settings';
import type { Modal } from './ui';
import { Vault } from './vault';
import { MarkdownView, Workspace, type ViewCreator } from './workspace';

/** Shape of the host's (private) `app.commands`, including its execution rules. */
export class CommandRegistry {
  readonly commands: Record<string, Command> = {};
  addCommand(command: Command): void { this.commands[command.id] = command; }
  removeCommand(id: string): void { Reflect.deleteProperty(this.commands, id); }
  findCommand(id: string): Command | undefined { return this.commands[id]; }
  listCommands(): Command[] { return Object.values(this.commands); }
  /** Returns the callback result through `result` so tests can await asynchronous callbacks. */
  execute(command: Command): { ran: boolean; result?: unknown } {
    if (command.checkCallback) return command.checkCallback(true) ? { ran: true, result: command.checkCallback(false) } : { ran: false };
    if (command.callback) return { ran: true, result: command.callback() };
    // Editor callbacks need an Editor double the kit does not provide; they never run here.
    return { ran: false };
  }
  executeCommandById(id: string): boolean { const command = this.findCommand(id); return command ? this.execute(command).ran : false; }
}
export class ViewRegistry {
  readonly viewByType = new Map<string, ViewCreator>();
  readonly typeByExtension = new Map<string, string>([['md', 'markdown']]);
  constructor() { this.viewByType.set('markdown', leaf => new MarkdownView(leaf)); }
  registerView(type: string, creator: ViewCreator): void {
    if (this.viewByType.has(type)) throw new Error(`Attempting to register an existing view type "${type}"`);
    this.viewByType.set(type, creator);
  }
  unregisterView(type: string): void { this.viewByType.delete(type); }
  getViewCreatorByType(type: string): ViewCreator | undefined { return this.viewByType.get(type); }
}
export interface RibbonItem { readonly icon: string; readonly title: string; readonly element: HTMLElement; readonly callback: (event: MouseEvent) => unknown }

export class App {
  readonly vault: Vault;
  readonly metadataCache: MetadataCache;
  readonly fileManager: FileManager;
  readonly workspace: Workspace;
  readonly commands = new CommandRegistry();
  readonly viewRegistry = new ViewRegistry();
  readonly setting = { pluginTabs: [] as PluginSettingTab[] };
  readonly ribbonItems: RibbonItem[] = [];
  readonly openModals: Modal[] = [];
  readonly scope = new Scope();
  readonly keymap = { pushScope() {}, popScope() {} };
  lastEvent = null;
  private readonly storage = new Map<string, string>();
  private ribbon?: HTMLElement;
  private statusBar?: HTMLElement;
  constructor(options: { vaultName?: string; configDir?: string } = {}) {
    this.vault = new Vault({ name: options.vaultName, configDir: options.configDir });
    this.metadataCache = new MetadataCache(this.vault);
    this.fileManager = new FileManager(this.vault, this.metadataCache);
    this.workspace = new Workspace(this);
  }
  get ribbonEl(): HTMLElement { return this.ribbon ??= this.attached('side-dock-ribbon'); }
  get statusBarEl(): HTMLElement { return this.statusBar ??= this.attached('status-bar'); }
  isDarkMode(): boolean { return false; }
  /** Per-app, JSON round-tripped like the host's vault-scoped localStorage. */
  loadLocalStorage(key: string): unknown { const value = this.storage.get(key); return value === undefined ? null : JSON.parse(value); }
  saveLocalStorage(key: string, data: unknown): void {
    if (data === null || data === undefined) this.storage.delete(key); else this.storage.set(key, JSON.stringify(data));
  }
  private attached(cls: string): HTMLElement { const element = make(null, 'div', cls); if (hasDom()) document.body.append(element); return element; }
}
