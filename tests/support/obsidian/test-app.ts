/** Author-facing entry point: one in-memory app per test with helpers to drive a real plugin. */
import type { Command } from 'obsidian';
import { App, type RibbonItem } from './app';
import { hasDom, installObsidianDom } from './dom';
import { flushObsidian, hostErrors } from './events';
import { TAbstractFile, TFile } from './files';
import { Plugin } from './plugin';
import type { PluginSettingTab } from './settings';
import { Menu, Platform, platformDefaults, uiLog, type Modal, type Notice } from './ui';

export interface TestAppOptions {
  /** An `App` the test built with `new App()` from the mocked module (typed as Obsidian's App). */
  readonly app?: object;
  /** Vault-relative path to Markdown/text content, loaded before the test starts (no events). */
  readonly files?: Readonly<Record<string, string>>;
  /** Path of a seeded file to make active (fires `file-open`). */
  readonly activeFile?: string;
  /** Plugin id to the value stored at `${configDir}/plugins/<id>/data.json`. */
  readonly pluginData?: Readonly<Record<string, unknown>>;
  /** Start with the layout ready; otherwise `loadPlugin` makes it ready after `onload`. */
  readonly layoutReady?: boolean;
  readonly platform?: Partial<typeof Platform>;
  readonly vaultName?: string;
  readonly configDir?: string;
}

let domInstalled = false;
/**
 * Narrow a kit object to the Obsidian type a production API expects, checked at runtime:
 * `const file = hostInstance(kit.file('a.md'), TFile)` with `TFile` imported from 'obsidian'.
 */
export function hostInstance<T>(value: unknown, type: abstract new (...args: never[]) => T): T {
  if (!(value instanceof type)) throw new Error(`OBSIDIAN_TEST_KIT_HOST_MISMATCH: expected ${type.name}`);
  return value;
}

export class TestApp {
  readonly vault; readonly metadataCache; readonly workspace; readonly fileManager;
  constructor(readonly app: App) {
    this.vault = app.vault; this.metadataCache = app.metadataCache; this.workspace = app.workspace; this.fileManager = app.fileManager;
  }
  /** Every Notice constructed since `createTestApp`, including hidden ones (see `visible`). */
  get notices(): readonly Notice[] { return uiLog.notices; }
  /** Menus shown since `createTestApp`, in order. */
  get menus(): readonly Menu[] { return uiLog.menus; }
  get modals(): readonly Modal[] { return this.app.openModals; }
  /** Errors the host would only log (throwing handlers, rejected tracked promises). */
  get errors(): readonly unknown[] { return hostErrors; }
  commands(): Command[] { return this.app.commands.listCommands(); }
  /**
   * Execute like the command palette: `checkCallback(true)` gates `checkCallback(false)`.
   * Accepts the full id (`plugin-id:local-id`) or an unambiguous local id. Awaits a returned
   * promise and `flushObsidian()`. Resolves `false` when the command is unavailable.
   */
  async runCommand(id: string): Promise<boolean> {
    const { ran, result } = this.app.commands.execute(this.command(id));
    await result; await flushObsidian();
    return ran;
  }
  ribbons(): readonly RibbonItem[] { return this.app.ribbonItems; }
  async clickRibbon(title: string): Promise<void> {
    const item = this.app.ribbonItems.find(entry => entry.title === title);
    if (!item) throw new Error(`OBSIDIAN_TEST_KIT_UNKNOWN_RIBBON: ${title}`);
    item.element.click(); await flushObsidian();
  }
  /** Runs `onload` (awaited, rethrowing failures), then finishes layout startup and flushes. */
  async loadPlugin(plugin: object): Promise<void> {
    if (!(plugin instanceof Plugin)) throw new Error('OBSIDIAN_TEST_KIT_PLUGIN_REQUIRED: extend Plugin from the mocked obsidian module');
    plugin.load(); await plugin.whenLoaded();
    this.workspace.setLayoutReady(); await flushObsidian();
  }
  async unloadPlugin(plugin: object): Promise<void> {
    if (!(plugin instanceof Plugin)) throw new Error('OBSIDIAN_TEST_KIT_PLUGIN_REQUIRED: extend Plugin from the mocked obsidian module');
    plugin.unload(); await flushObsidian();
  }
  /** Displays the plugin's setting tab in `document.body` (the only tab when `plugin` is omitted). */
  openSettings(plugin?: object): PluginSettingTab {
    const tabs = this.app.setting.pluginTabs.filter(tab => plugin === undefined || tab.plugin === plugin);
    const [tab] = tabs;
    if (!tab || tabs.length > 1) throw new Error(`OBSIDIAN_TEST_KIT_SETTING_TAB: found ${tabs.length}`);
    document.body.append(tab.containerEl); tab.display();
    return tab;
  }
  /** Fires `file-menu` like a right-click in the file explorer and returns the shown menu. */
  openFileMenu(file: TAbstractFile, source = 'file-explorer'): Menu {
    const menu = new Menu(); this.workspace.trigger('file-menu', menu, file, source);
    return menu.showAtPosition({ x: 0, y: 0 });
  }
  /** The live file at `path`, or a descriptive failure. */
  file(path: string): TFile {
    const file = this.vault.getFileByPath(path);
    if (!file) throw new Error(`OBSIDIAN_TEST_KIT_NO_FILE: ${path}`);
    return file;
  }
  /** Exact current bytes of a file (vault or hidden adapter path). */
  read(path: string): string { return this.vault.adapter.text(path); }
  flush(): Promise<void> { return flushObsidian(); }
  private command(id: string): Command {
    const exact = this.app.commands.findCommand(id);
    if (exact) return exact;
    const matches = this.commands().filter(command => command.id.endsWith(`:${id}`));
    if (matches.length === 1 && matches[0]) return matches[0];
    throw new Error(`OBSIDIAN_TEST_KIT_UNKNOWN_COMMAND: ${id} (registered: ${this.commands().map(command => command.id).join(', ') || 'none'})`);
  }
}

/** Fresh kit logs, desktop Platform, DOM helpers (when a DOM exists) and a seeded app. */
export function createTestApp(options: TestAppOptions = {}): TestApp {
  uiLog.notices.length = 0; uiLog.menus.length = 0; hostErrors.length = 0;
  Object.assign(Platform, platformDefaults, options.platform);
  if (hasDom() && !domInstalled) { installObsidianDom(); domInstalled = true; }
  if (options.app !== undefined && !(options.app instanceof App)) throw new Error('OBSIDIAN_TEST_KIT_APP_REQUIRED: create it with `new App()` from the mocked obsidian module');
  const app = options.app ?? new App({ vaultName: options.vaultName, configDir: options.configDir });
  app.vault.seed(options.files ?? {});
  for (const [id, data] of Object.entries(options.pluginData ?? {})) app.vault.adapter.put(`${app.vault.configDir}/plugins/${id}/data.json`, JSON.stringify(data, null, 2));
  const kit = new TestApp(app);
  if (options.activeFile) app.workspace.setActiveFile(kit.file(options.activeFile));
  if (options.layoutReady) app.workspace.setLayoutReady();
  return kit;
}
