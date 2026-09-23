import { vi } from 'vitest';
import type { App, Command, PluginManifest, View, WorkspaceLeaf } from 'obsidian';
import { pluginIdentity } from '../../src/infrastructure/plugin-identity';
export const hostState = {
  commands: new Map<string, Command>(), views: new Map<string, (leaf: WorkspaceLeaf) => View>(),
  ribbons: [] as { icon: string; title: string; callback: (event: MouseEvent) => void; element: HTMLElement }[],
  ready: [] as (() => void)[], listeners: new Map<string, ((...values: unknown[]) => void)[]>(),
  menu: [] as { title: string; action?: () => unknown }[], notices: [] as string[],
  reset() {
    this.commands.clear(); this.views.clear(); this.ribbons = []; this.ready = []; this.listeners.clear(); this.menu = []; this.notices = [];
    vi.stubGlobal('createFragment', () => document.createDocumentFragment()); vi.stubGlobal('createEl', (tag: string) => document.createElement(tag));
  },
};
function element() {
  const el = document.createElement('div');
  return Object.assign(el, {
    empty() { el.replaceChildren(); }, addClass(name: string) { el.classList.add(name); }, removeClass(name: string) { el.classList.remove(name); },
    createDiv(options: { cls: string }) { const child = element(); child.className = options.cls; el.append(child); return child; },
    createEl(tag: string, options: { text: string }) { const child = document.createElement(tag); child.textContent = options.text; el.append(child); return child; },
  });
}
class Leaf {
  setViewState = vi.fn(async () => undefined); openFile = vi.fn(async () => undefined); detach = vi.fn();
}
class HostEvents {
  constructor(private readonly prefix = '') {}
  offref = vi.fn((ref: { name: string; callback: (...values: unknown[]) => void }) => { const name = this.prefix + ref.name; hostState.listeners.set(name, (hostState.listeners.get(name) ?? []).filter(listener => listener !== ref.callback)); });
  on(name: string, callback: (...values: unknown[]) => void) { const key = this.prefix + name; const listeners = hostState.listeners.get(key) ?? []; listeners.push(callback); hostState.listeners.set(key, listeners); return { name, callback }; }
}
class Workspace extends HostEvents {
  leaf = new Leaf(); getLeavesOfType = vi.fn((): Leaf[] => []); getLeaf = vi.fn(() => this.leaf);
  revealLeaf = vi.fn(async () => undefined); moveLeafToPopout = vi.fn();
  onLayoutReady(callback: () => void) { hostState.ready.push(callback); }
}
class HostApp {
  workspace = new Workspace();
  vault = Object.assign(new HostEvents('vault.'), { configDir: '.obsidian', getAbstractFileByPath: vi.fn(() => null), getRoot: () => new HostFolder(), getMarkdownFiles: () => [], getFiles: () => [], create: vi.fn(), createFolder: vi.fn() });
  metadataCache = new HostEvents('metadata.');
  loadLocalStorage = vi.fn(() => null); saveLocalStorage = vi.fn();
}
class HostPlugin {
  constructor(public app: App, public manifest: PluginManifest) {}
  loadData = vi.fn(async (): Promise<unknown> => null); saveData = vi.fn(async () => undefined);
  registerView(name: string, creator: (leaf: WorkspaceLeaf) => View) { hostState.views.set(name, creator); }
  addCommand(command: Command) {
    const localId = command.id;
    command.id = `${this.manifest.id}:${localId}`; command.name = `${this.manifest.name}: ${command.name}`;
    hostState.commands.set(localId, command); return command;
  }
  removeCommand = vi.fn((id: string) => { hostState.commands.delete(id); });
  addRibbonIcon = vi.fn((icon: string, title: string, callback: (event: MouseEvent) => void) => {
    const element = document.createElement('button'); document.body.append(element);
    hostState.ribbons.push({ icon, title, callback, element }); return element;
  });
  addSettingTab = vi.fn(); registerEvent = vi.fn();
}
class HostItemView {
  containerEl = element(); contentEl = element(); app: HostApp;
  constructor(public leaf: WorkspaceLeaf) {
    this.app = new HostApp();
    // Match ItemView: identity overrides are invoked before subclass fields initialize.
    this.containerEl.dataset.type = this.getViewType();
    this.containerEl.dataset.initialTitle = this.getDisplayText();
    const header = element(); header.className = 'view-header'; this.containerEl.append(header, this.contentEl); document.body.append(this.containerEl);
  }
  getViewType(): string { return pluginIdentity.viewType; }
  getDisplayText(): string { return pluginIdentity.name; }
  onPaneMenu() {}
}
class HostSettingsTab {
  constructor(public app: App, public plugin: HostPlugin) {}
  update = vi.fn();
  hide() {}
}
class HostMenu {
  hide = vi.fn(); addSeparator = vi.fn(); showAtPosition = vi.fn();
  addItem(callback: (item: MenuItem) => void) { const item = new MenuItem(); callback(item); hostState.menu.push(item); return this; }
}
class MenuItem {
  title = ''; action?: () => unknown;
  setTitle(value: string) { this.title = value; return this; } setIcon() { return this; } setChecked() { return this; }
  onClick(callback: () => unknown) { this.action = callback; return this; }
}
class HostNotice { constructor(text: string) { hostState.notices.push(text); } hide = vi.fn(); setMessage = vi.fn(); }
class HostFolder { readonly children: unknown[] = []; readonly path = ''; readonly name = ''; }
export const hostModule = { App: HostApp, Plugin: HostPlugin, ItemView: HostItemView, PluginSettingTab: HostSettingsTab,
  WorkspaceLeaf: Leaf, Menu: HostMenu, Notice: HostNotice, TFile: class {}, TFolder: HostFolder, Modal: class {} };
