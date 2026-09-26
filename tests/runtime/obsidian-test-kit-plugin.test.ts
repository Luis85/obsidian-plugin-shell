// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, ItemView, Modal, Notice, Platform, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf, debounce } from 'obsidian';
import { createTestApp, hostInstance } from '@test/obsidian';

afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });
const manifest = { id: 'sample', name: 'Sample', version: '1.0.0', minAppVersion: '1.13.0', author: 'Kit', description: 'Kit sample' };

class CounterView extends ItemView {
  opened = 0; closed = 0;
  getViewType(): string { return 'sample-counter'; }
  getDisplayText(): string { return 'Counter'; }
  protected override async onOpen(): Promise<void> { this.opened++; this.contentEl.createEl('p', { text: 'Counter body', cls: 'counter' }); }
  protected override async onClose(): Promise<void> { this.closed++; }
}
class SampleTab extends PluginSettingTab {
  constructor(app: App, private readonly owner: SamplePlugin) { super(app, owner); }
  display(): void {
    this.containerEl.empty();
    new Setting(this.containerEl).setName('Greeting').setDesc('Shown in notices')
      .addText(text => text.setValue(this.owner.greeting).onChange(async value => { this.owner.greeting = value; await this.owner.saveData({ greeting: value }); }))
      .addDropdown(dropdown => dropdown.addOptions({ a: 'A', b: 'B' }).setValue('a'))
      .addButton(button => button.setButtonText('Reset').onClick(() => { this.owner.greeting = 'hello'; }));
  }
}
class SamplePlugin extends Plugin {
  greeting = 'hello'; available = true; ticks = 0; views: CounterView[] = [];
  async onload(): Promise<void> {
    const stored: unknown = await this.loadData();
    if (typeof stored === 'object' && stored && 'greeting' in stored && typeof stored.greeting === 'string') this.greeting = stored.greeting;
    this.registerView('sample-counter', leaf => { const view = new CounterView(leaf); this.views.push(view); return view; });
    this.addCommand({ id: 'greet', name: 'Greet', callback: () => { new Notice(this.greeting); } });
    this.addCommand({ id: 'guarded', name: 'Guarded', checkCallback: checking => { if (!this.available) return false; if (!checking) new Notice('ran'); return true; } });
    this.addCommand({ id: 'open', name: 'Open', callback: async () => { await this.app.workspace.getLeaf('tab').setViewState({ type: 'sample-counter', active: true }); } });
    this.addRibbonIcon('dice', 'Greet', () => { new Notice('ribbon'); });
    this.addSettingTab(new SampleTab(this.app, this));
    this.registerEvent(this.app.vault.on('create', () => { this.ticks++; }));
    this.registerDomEvent(document, 'click', () => { this.ticks++; });
    this.registerInterval(window.setInterval(() => { this.ticks++; }, 1000));
    this.app.workspace.onLayoutReady(() => { this.ticks += 100; });
    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => { menu.addItem(item => item.setTitle(`Inspect ${file.name}`).onClick(() => { new Notice(file.path); })); }));
  }
}

it('runs a real plugin lifecycle: registrations work while loaded and are all removed on unload', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const app = new App(); const kit = createTestApp({ app, files: { 'Note.md': '# Note' }, pluginData: { sample: { greeting: 'hi' } } });
  const plugin = new SamplePlugin(app, manifest);
  await kit.loadPlugin(plugin);
  expect(plugin.ticks).toBe(100); expect(kit.commands().map(command => [command.id, command.name])).toEqual([['sample:greet', 'Sample: Greet'], ['sample:guarded', 'Sample: Guarded'], ['sample:open', 'Sample: Open']]);
  expect(await kit.runCommand('greet')).toBe(true); expect(kit.notices.map(notice => notice.message)).toEqual(['hi']);
  plugin.available = false; expect(await kit.runCommand('sample:guarded')).toBe(false);
  plugin.available = true; expect(await kit.runCommand('guarded')).toBe(true); expect(kit.notices.at(-1)?.message).toBe('ran');
  await expect(kit.runCommand('missing')).rejects.toThrow('OBSIDIAN_TEST_KIT_UNKNOWN_COMMAND');
  await kit.clickRibbon('Greet'); expect(kit.notices.at(-1)?.message).toBe('ribbon');
  await kit.runCommand('open');
  const [leaf] = kit.workspace.getLeavesOfType('sample-counter'); const view = plugin.views[0];
  expect(leaf?.view).toBe(view); expect(kit.workspace.activeLeaf).toBe(leaf);
  expect(view?.containerEl.dataset.type).toBe('sample-counter'); expect(view?.contentEl.querySelector('.counter')?.textContent).toBe('Counter body');
  expect(app.workspace.getActiveViewOfType(CounterView)).toBe(view);
  const before = plugin.ticks;
  await kit.vault.create('New.md', ''); document.body.click(); vi.advanceTimersByTime(1000);
  expect(plugin.ticks).toBe(before + 3);
  const menu = kit.openFileMenu(kit.file('Note.md')); await menu.item('Inspect Note.md')?.click();
  expect(kit.notices.at(-1)?.message).toBe('Note.md'); expect(kit.menus).toEqual([menu]);
  await kit.unloadPlugin(plugin);
  expect([kit.commands(), kit.ribbons(), kit.app.setting.pluginTabs]).toEqual([[], [], []]);
  expect(document.querySelector('.side-dock-ribbon-action')).toBeNull(); expect(kit.vault.listenerCount('create')).toBe(0);
  await kit.vault.create('After.md', ''); document.body.click(); vi.advanceTimersByTime(5000);
  expect(plugin.ticks).toBe(before + 3);
  expect(kit.workspace.getLeavesOfType('sample-counter')).toEqual([leaf]); expect([view?.opened, view?.closed]).toEqual([1, 1]);
  expect(kit.errors).toEqual([]);
});

it('renders classic settings with real DOM controls wired to plugin data', async () => {
  const app = new App(); const kit = createTestApp({ app }); const plugin = new SamplePlugin(app, manifest);
  await kit.loadPlugin(plugin);
  const tab = kit.openSettings(plugin);
  expect(tab.containerEl.querySelector('.setting-item-name')?.textContent).toBe('Greeting');
  const input = tab.containerEl.querySelector('input'); const select = tab.containerEl.querySelector('select');
  if (!input || !select) throw new Error('CONTROLS_NOT_RENDERED');
  expect([input.value, select.value, select.options.length]).toEqual(['hello', 'a', 2]);
  input.value = 'hey'; input.dispatchEvent(new Event('input')); await kit.flush();
  expect(JSON.parse(kit.read('.obsidian/plugins/sample/data.json'))).toEqual({ greeting: 'hey' });
  tab.containerEl.querySelector('button')?.click(); expect(plugin.greeting).toBe('hello');
  const reloaded = new SamplePlugin(app, manifest); await kit.unloadPlugin(plugin); await kit.loadPlugin(reloaded);
  expect(reloaded.greeting).toBe('hey');
});

it('renders declarative setting definitions, validates before saving and refreshes in place', async () => {
  const values: Record<string, unknown> = { enabled: false, folder: 'Notes', mode: 'b' }; const saved: [string, unknown][] = [];
  class Declarative extends PluginSettingTab {
    getSettingDefinitions() {
      return [
        { name: 'Enabled', control: { type: 'toggle' as const, key: 'enabled' } },
        { type: 'group' as const, heading: 'Storage', items: [
          { name: 'Folder', control: { type: 'text' as const, key: 'folder', validate: (value: string) => value.includes('..') ? 'No traversal' : undefined } },
          { name: 'Mode', control: { type: 'dropdown' as const, key: 'mode', options: { a: 'A', b: 'B' }, disabled: () => values.enabled !== true } },
        ] },
      ];
    }
    getControlValue(key: string): unknown { return values[key]; }
    async setControlValue(key: string, value: unknown): Promise<void> { saved.push([key, value]); values[key] = value; this.update(); }
  }
  const app = new App(); const kit = createTestApp({ app }); const plugin = new SamplePlugin(app, manifest);
  const tab = new Declarative(app, plugin); document.body.append(tab.containerEl); tab.display();
  const toggle = tab.containerEl.querySelector<HTMLElement>('.checkbox-container'); const input = tab.containerEl.querySelector('input[type="text"]');
  const select = tab.containerEl.querySelector('select');
  if (!toggle || !(input instanceof HTMLInputElement) || !select) throw new Error('DEFINITIONS_NOT_RENDERED');
  expect(tab.containerEl.querySelector('.setting-item-heading')?.textContent).toBe('Storage'); expect(select.disabled).toBe(true);
  input.value = '../x'; input.dispatchEvent(new Event('input')); await kit.flush();
  expect(saved).toEqual([]); expect(tab.containerEl.querySelector('[role="alert"]')?.textContent).toBe('No traversal');
  toggle.click(); await kit.flush();
  expect(saved).toEqual([['enabled', true]]); expect(select.disabled).toBe(false); expect(select.value).toBe('b');
  values.enabled = false; tab.update(); expect(toggle.classList.contains('is-enabled')).toBe(false); expect(saved).toHaveLength(1);
  tab.hide(); expect(tab.containerEl.children).toHaveLength(0);
});

it('provides DOM helpers, modals, notices, platform flags, debounce and runtime-checked host narrowing', () => {
  vi.useFakeTimers();
  const app = new App(); const kit = createTestApp({ app, files: { 'A.md': '' }, platform: { isMobile: true, isDesktop: false } });
  expect([Platform.isMobile, Platform.isDesktop]).toEqual([true, false]);
  const root = document.body.createDiv({ cls: ['one', 'two'], attr: { 'data-x': 1 } });
  root.createSpan({ text: 'hello' }); root.addClass('three'); root.toggleClass('one', false); root.setAttr('data-x', null);
  expect([root.className, root.getText(), root.hasAttribute('data-x')]).toEqual(['two three', 'hello', false]);
  root.empty(); expect(root.childNodes).toHaveLength(0); expect(createFragment().childNodes).toHaveLength(0);
  const modal = new Modal(app).setTitle('Title').setContent('Body'); const closed = vi.fn(); modal.setCloseCallback(closed);
  modal.open(); expect(document.querySelector('.modal-title')?.textContent).toBe('Title'); expect(kit.modals).toEqual([modal]);
  modal.close(); expect(closed).toHaveBeenCalledOnce(); expect(document.querySelector('.modal')).toBeNull();
  const notice = new Notice('Saved', 1000); vi.advanceTimersByTime(1000);
  expect(kit.notices.map(item => [item.message, item.visible])).toEqual([['Saved', false]]);
  const call = vi.fn(); const run = debounce(call, 200, true); run(1); run(2); vi.advanceTimersByTime(200);
  expect(call.mock.calls).toEqual([[2]]); expect(notice.noticeEl.isConnected).toBe(false);
  expect(hostInstance(kit.file('A.md'), TFile).path).toBe('A.md');
  expect(() => hostInstance(kit.app, TFile)).toThrow('OBSIDIAN_TEST_KIT_HOST_MISMATCH');
  const leaf: WorkspaceLeaf = hostInstance(kit.workspace.getLeaf(), WorkspaceLeaf);
  expect(leaf.getViewState().type).toBe('empty');
});
