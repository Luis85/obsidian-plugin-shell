import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { App, Plugin, TFile } from 'obsidian';
import { nativeAdapters } from '../../src/infrastructure/obsidian/adapters';

const observed = vi.hoisted(() => ({
  modals: [] as { title: string; text: string; open: Mock<() => void>; close: Mock<() => void> }[],
  notices: [] as { text: string; duration: number; hide: Mock<() => void> }[],
}));
vi.mock('obsidian', () => ({
  TFile: class {}, TFolder: class {},
  App: class {
    vault = { configDir: '.obsidian', getAbstractFileByPath: vi.fn(() => null) };
    workspace = { getLeaf: vi.fn(() => ({ openFile: vi.fn(async () => undefined) })) };
    loadLocalStorage = vi.fn(() => 'local-value'); saveLocalStorage = vi.fn();
  },
  Plugin: class {
    constructor(public app: App, public manifest: Plugin['manifest']) {}
    loadData = vi.fn(async () => ({ settings: true })); saveData = vi.fn(async () => undefined);
  },
  Modal: class {
    title = ''; text = ''; onClose = () => {};
    contentEl = { createEl: vi.fn((_tag: string, options: { text: string }) => { this.text = options.text; }) };
    open = vi.fn(); close = vi.fn(() => this.onClose());
    constructor() { observed.modals.push(this); }
    setTitle(title: string) { this.title = title; }
  },
  Notice: class {
    hide = vi.fn();
    constructor(public text: string, public duration: number) { observed.notices.push(this); }
  },
}));
beforeEach(() => { observed.modals = []; observed.notices = []; });
function fixture() {
  class FixturePlugin extends Plugin {}
  const plugin = new FixturePlugin(new App(), { id: 'test-shell', name: 'Test', version: '0.3.0', minAppVersion: '1.13.7', author: 'Test', description: 'Synthetic host contract' });
  return { plugin, adapters: nativeAdapters(plugin) };
}
describe('Synthetic native host actions', () => {
  it('delegates settings and namespaces local values per plugin while supplying fresh IDs/time', async () => {
    const { plugin, adapters } = fixture();
    expect(await adapters.settings.load()).toEqual({ settings: true });
    await adapters.settings.save({ saved: true }); expect(plugin.saveData).toHaveBeenCalledWith({ saved: true });
    expect(adapters.local.get('panel')).toBe('local-value'); expect(plugin.app.loadLocalStorage).toHaveBeenCalledWith('test-shell:panel');
    adapters.local.set('panel', 'documents'); expect(plugin.app.saveLocalStorage).toHaveBeenCalledWith('test-shell:panel', 'documents');
    expect(adapters.newId()).not.toBe(adapters.newId()); expect(Number.isNaN(Date.parse(adapters.now()))).toBe(false);
  });
  it('opens only an existing host file and reports navigation failure without document creation', async () => {
    const { plugin, adapters } = fixture();
    expect((await adapters.host.openDocument('Tasks/missing.md')).ok).toBe(false);
    const file = Object.assign(new TFile(), { path: 'Tasks/a.md' });
    vi.mocked(plugin.app.vault.getAbstractFileByPath).mockReturnValue(file);
    const leaf = plugin.app.workspace.getLeaf('tab'); vi.mocked(plugin.app.workspace.getLeaf).mockReturnValue(leaf);
    expect((await adapters.host.openDocument(file.path)).ok).toBe(true);
    expect(leaf.openFile).toHaveBeenCalledExactlyOnceWith(file);
    vi.mocked(leaf.openFile).mockRejectedValueOnce(new Error('open failed'));
    expect(await adapters.host.openDocument(file.path)).toMatchObject({ ok: false, error: { code: 'storage', key: 'error.open' } });
    vi.mocked(plugin.app.vault.getAbstractFileByPath).mockImplementationOnce(() => { throw new Error('lookup failed'); });
    expect(await adapters.host.openDocument(file.path)).toMatchObject({ ok: false, error: { code: 'storage', key: 'error.open' } });
  });
  it('owns modal cleanup and supplies dismissible notices with default/explicit duration', () => {
    const { adapters } = fixture();
    adapters.host.showModal('First', 'Text one'); adapters.host.showModal('Second', 'Text two');
    expect(observed.modals.map(modal => [modal.title, modal.text, modal.open.mock.calls.length])).toEqual([['First', 'Text one', 1], ['Second', 'Text two', 1]]);
    observed.modals[0]?.close(); adapters.host.dispose?.(); adapters.host.dispose?.();
    expect(observed.modals.map(modal => modal.close.mock.calls.length)).toEqual([1, 1]);
    const hide = adapters.host.notice('Saved'); const hideOther = adapters.host.notice('Custom', 1000); hide(); hideOther();
    expect(observed.notices.map(notice => [notice.text, notice.duration, notice.hide.mock.calls.length])).toEqual([['Saved', 4000, 1], ['Custom', 1000, 1]]);
  });
});
