// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', async () => (await import('./host-fixture')).hostModule);
import { App, WorkspaceLeaf } from 'obsidian';
import ShellPlugin from '../../src/main';
import { initializePlugin } from '../../src/bootstrap/plugin-runtime';
import { ShowcaseView, SHOWCASE_VIEW } from '../../src/infrastructure/obsidian/showcase-view';
import { ShellSettingsTab } from '../../src/infrastructure/obsidian/settings-tab';
import { createServices } from '../../src/bootstrap/services';
import { nativeAdapters } from '../../src/infrastructure/obsidian/adapters';
import { hostState } from './host-fixture';
import { settle } from './component-fixture';
import manifest from '../../manifest.json';
beforeEach(() => { hostState.reset(); });
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
function plugin() { return new ShellPlugin(new App(), manifest); }
it('[HOST-03-01] runtime registers commands, opens/reuses leaves, reports navigation failures and ignores late readiness', async () => {
  const p = plugin(); const runtime = await initializePlugin(p);
  expect(hostState.views.has(SHOWCASE_VIEW)).toBe(true); expect([...hostState.commands.keys()]).toEqual(['open-showcase', 'toggle-view-header', 'debug-toggle', 'debug-report']);
  const open = hostState.commands.get('open-showcase')?.callback; expect(open).toBeDefined(); open?.(); await settle();
  expect(p.app.workspace.getLeaf).toHaveBeenCalledWith('tab');
  const leaf = p.app.workspace.getLeaf('tab'); expect(leaf.setViewState).toHaveBeenCalledExactlyOnceWith({ type: SHOWCASE_VIEW, active: true });
  vi.mocked(p.app.workspace.getLeavesOfType).mockReturnValue([leaf]); open?.(); await settle(); expect(leaf.setViewState).toHaveBeenCalledTimes(1);
  vi.mocked(p.app.workspace.revealLeaf).mockRejectedValueOnce(new Error('host navigation')); open?.(); await settle();
  expect(runtime.diagnosticSnapshot().map(item => item.code)).toContain('view.open');
  hostState.commands.get('toggle-view-header')?.callback?.(); await settle(); expect(p.saveData).toHaveBeenCalledOnce();
  runtime.dispose(); runtime.dispose(); const count = vi.mocked(p.app.workspace.revealLeaf).mock.calls.length;
  open?.(); hostState.commands.get('toggle-view-header')?.callback?.(); hostState.ready.forEach(callback => callback()); await settle();
  expect(p.app.workspace.revealLeaf).toHaveBeenCalledTimes(count); expect(p.registerEvent).not.toHaveBeenCalled(); expect(leaf.detach).not.toHaveBeenCalled();
});
it('[HOST-03-02] main lifecycle owns mounted views and removes per-view workspace listeners on unload', async () => {
  const p = plugin(); await p.onload(); hostState.ready.forEach(callback => callback()); expect(p.registerEvent).toHaveBeenCalledTimes(8);
  const create = hostState.views.get(SHOWCASE_VIEW); if (!create) throw new Error('VIEW_NOT_REGISTERED');
  const view = create(new WorkspaceLeaf()); if (!(view instanceof ShowcaseView)) throw new Error('WRONG_VIEW');
  await view.onOpen(); await settle(); expect(view.contentEl.querySelector('[data-testid="showcase"]')).not.toBeNull();
  for (const callback of hostState.listeners.get('file-open') ?? []) callback(null);
  p.onunload(); p.onunload(); expect(view.contentEl.querySelector('[data-testid="showcase"]')).toBeNull();
  expect(p.app.workspace.offref).toHaveBeenCalledTimes(6); expect(view.leaf.detach).not.toHaveBeenCalled(); await view.onClose();
});
it('[HOST-03-03] view actions own menus, preserve unrelated host state and recover from mount failure', async () => {
  const p = plugin(); const services = await createServices(nativeAdapters(p)); const owned = vi.fn(); const cleanup = vi.fn();
  let actions: ((event: MouseEvent) => void) | undefined;
  const view = new ShowcaseView(new WorkspaceLeaf(), (_root, callback) => { actions = callback; return cleanup; },
    { preferences: services.preferences, diagnostics: services.diagnostics, text: key => key, toggleHeader: vi.fn() }, owned);
  try {
    expect([view.getViewType(), view.getDisplayText(), view.getIcon()]).toEqual([SHOWCASE_VIEW, manifest.name, 'blocks']);
    await view.onOpen();
    const target = document.createElement('button'); target.addEventListener('click', event => actions?.(event)); target.click();
    expect(hostState.menu.map(item => item.title)).toEqual(['settings.hideHeader', 'view.split', 'view.popout', 'view.close']);
    for (const item of hostState.menu) await item.action?.();
    expect(view.app.workspace.moveLeafToPopout).toHaveBeenCalledWith(view.leaf); expect(view.leaf.detach).toHaveBeenCalledOnce();
    vi.mocked(view.app.workspace.getLeaf('split').setViewState).mockRejectedValueOnce(new Error('split failed'));
    await hostState.menu.find(item => item.title === 'view.split')?.action?.();
    expect(services.diagnostics.current.map(item => item.code)).toContain('view.split');
    actions?.(new MouseEvent('click'));
    await view.onClose(); expect(cleanup).toHaveBeenCalledOnce(); expect(view.contentEl.classList.contains(`${manifest.id}-host`)).toBe(false);
    const failed = new ShowcaseView(new WorkspaceLeaf(), () => { throw new Error('mount failed'); },
      { preferences: services.preferences, diagnostics: services.diagnostics, text: key => key, toggleHeader() {} }, owned);
    await expect(failed.onOpen()).rejects.toThrow('mount failed'); expect(failed.contentEl.children.length).toBe(0);
  } finally { view.disposeView(); services.dispose(); }
});
it('[HOST-03-04] native setting definitions use validated canonical preferences and report failed saves', async () => {
  const p = plugin(); const services = await createServices(nativeAdapters(p)); const tab = new ShellSettingsTab(p, { ...services, text: key => key });
  try {
    const definitions = tab.getSettingDefinitions(); expect(definitions).toHaveLength(4);
    for (const definition of definitions) {
      if (!('control' in definition) || !definition.control || Array.isArray(definition.control)) throw new Error('EXPECTED_SETTING_CONTROL');
      const control = definition.control;
      if (typeof control.disabled === 'function') expect(control.disabled()).toBe(false);
      if (control.type === 'text' && control.validate) { expect(await control.validate('Good/Folder')).toBeUndefined(); expect(await control.validate('../bad')).toBe('error.folder'); }
    }
    expect(['hideObsidianViewHeader', 'locale', 'taskFolder', 'notifySuccess', 'unknown'].map(key => tab.getControlValue(key))).toEqual([false, 'en', 'Tasks', true, undefined]);
    await tab.setControlValue('unknown', true); await tab.setControlValue('locale', 'xx'); expect(p.saveData).not.toHaveBeenCalled();
    await tab.setControlValue('hideObsidianViewHeader', true); await tab.setControlValue('locale', 'de'); await tab.setControlValue('taskFolder', 'Native/Tasks'); await tab.setControlValue('notifySuccess', false);
    expect(services.preferences.current).toMatchObject({ locale: 'de', taskFolder: 'Native/Tasks', notifySuccess: false, hideObsidianViewHeader: true });
    vi.mocked(p.saveData).mockRejectedValueOnce(new Error('settings disk failure')); await tab.setControlValue('locale', 'en');
    expect(services.preferences.current.locale).toBe('de'); expect(services.notifications.current[0]?.key).toBe('error.settingsWrite');
    expect(tab.update).toHaveBeenCalledTimes(5);
  } finally { services.dispose(); }
});
it('[HOST-03-05] failed registration disposes services and reports startup failure without leaving a live command', async () => {
  const p = plugin(); vi.spyOn(p, 'addSettingTab').mockImplementation(() => { throw new Error('register failed'); });
  await expect(initializePlugin(p)).rejects.toThrow('register failed'); expect(hostState.notices).toEqual([`${manifest.name} could not start. Check the installed version.`]);
  hostState.commands.get('open-showcase')?.callback?.(); await settle(); expect(p.app.workspace.getLeaf).not.toHaveBeenCalled();
});
it('[HOST-03-06] failing view disposal does not prevent runtime cleanup and failed header persistence remains observed', async () => {
  const p = plugin(); const runtime = await initializePlugin(p); const creator = hostState.views.get(SHOWCASE_VIEW);
  if (!creator) throw new Error('VIEW_NOT_REGISTERED'); const view = creator(new WorkspaceLeaf());
  if (!(view instanceof ShowcaseView)) throw new Error('WRONG_VIEW'); await view.onOpen();
  vi.mocked(p.saveData).mockRejectedValueOnce(new Error('write failed')); hostState.commands.get('toggle-view-header')?.callback?.(); await settle();
  expect(runtime.diagnosticSnapshot().map(item => item.code)).toContain('settings.write');
  const original = view.disposeView.bind(view); vi.spyOn(view, 'disposeView').mockImplementation(() => { original(); throw new Error('cleanup failed'); });
  expect(() => runtime.dispose()).not.toThrow(); expect(view.contentEl.children.length).toBe(0); expect(view.leaf.detach).not.toHaveBeenCalled();
});
