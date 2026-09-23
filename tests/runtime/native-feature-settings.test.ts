// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', async () => (await import('./host-fixture')).hostModule);
import { App, Plugin } from 'obsidian';
import { ShellSettingsTab } from '../../src/infrastructure/obsidian/settings-tab';
import { NoticeService } from '../../src/application/notice-service';
import { success } from '../../src/domain/outcome';
import { booleanSettingFixture } from './boolean-setting-fixture';
import { hostState } from './host-fixture';
import manifest from '../../manifest.json';
class FixturePlugin extends Plugin {}

async function fixture(raw: unknown = null) {
  hostState.reset(); const f = booleanSettingFixture(raw); await f.setting.initialize();
  const notices = new NoticeService({ kind: 'obsidian', openDocument: async () => success(undefined), showModal() {}, notice: () => () => undefined },
    key => key, f.diagnostics, { scheduler: { after: () => () => undefined } });
  const plugin = new FixturePlugin(new App(), manifest);
  const tab = new ShellSettingsTab(plugin, { preferences: f.preferences, notifications: notices, diagnostics: f.diagnostics, settings: [f.setting], text: key => key });
  return { ...f, tab, notices, disposeAll() { tab.dispose(); notices.dispose(); f.dispose(); } };
}
function control(tab: ShellSettingsTab) {
  const item = tab.getSettingDefinitions().find(item => 'control' in item && item.control?.key === 'authoring:fixture-setting');
  if (!item || !('control' in item) || !item.control || typeof item.control.disabled !== 'function') throw new Error('NATIVE_CONTROL_MISSING');
  return item.control;
}
it('renders an explicit native toggle and shares command changes without subscriptions surviving hide/reopen/unload', async () => {
  const f = await fixture();
  try {
    const item = control(f.tab); expect(item.type).toBe('toggle'); expect(item.defaultValue).toBe(false);
    expect(f.tab.getControlValue(item.key)).toBe(false); expect(f.storage.save).not.toHaveBeenCalled();
    await f.tab.setControlValue(item.key, true); await vi.waitFor(() => expect(f.setting.readonly).toBe(false));
    expect(f.tab.getControlValue(item.key)).toBe(true);
    f.tab.hide(); vi.mocked(f.tab.update).mockClear();
    await f.setting.toggle(); await vi.waitFor(() => expect(f.setting.readonly).toBe(false));
    expect(f.tab.update).not.toHaveBeenCalled();
    control(f.tab); expect(f.tab.getControlValue(item.key)).toBe(false);
    await f.setting.toggle(); await vi.waitFor(() => expect(f.setting.readonly).toBe(false));
    expect(f.tab.update).toHaveBeenCalled(); expect(f.tab.getControlValue(item.key)).toBe(true);
    f.tab.dispose(); vi.mocked(f.tab.update).mockClear(); const saves = f.storage.save.mock.calls.length;
    await f.tab.setControlValue(item.key, false); expect(f.storage.save).toHaveBeenCalledTimes(saves);
    await f.setting.toggle(); await vi.waitFor(() => expect(f.setting.readonly).toBe(false));
    expect(f.tab.update).not.toHaveBeenCalled();
  } finally { f.disposeAll(); }
});
it('disables pending/failed controls, retains committed display and suppresses late hidden-tab updates', async () => {
  const f = await fixture(); const item = control(f.tab); let finish!: () => void;
  const held = new Promise<void>(resolve => { finish = resolve; });
  f.storage.save.mockImplementationOnce(async () => { await held; throw new Error('uncertain'); });
  try {
    const work = f.tab.setControlValue(item.key, true); await vi.waitFor(() => expect(f.storage.save).toHaveBeenCalledOnce());
    expect(typeof item.disabled === 'function' && item.disabled()).toBe(true); expect(f.tab.getControlValue(item.key)).toBe(false);
    f.tab.hide(); vi.mocked(f.tab.update).mockClear(); finish(); await work;
    expect(f.tab.update).not.toHaveBeenCalled(); expect(f.notices.current).toEqual([]);
    control(f.tab); expect(f.tab.getControlValue(item.key)).toBe(false);
    expect(f.tab.getSettingDefinitions().some(row => 'desc' in row && String(row.desc).includes('error.settingsWrite'))).toBe(true);
    await f.tab.setControlValue(item.key, false); expect(f.storage.save).toHaveBeenCalledOnce();
    expect(f.notices.current[0]?.key).toBe('error.settingsWrite');
  } finally { f.disposeAll(); }
});
it('keeps unreadable feature data disabled without creating default records', async () => {
  const raw = { schemaVersion: 99 }; const f = await fixture(raw);
  try {
    const item = control(f.tab); expect(typeof item.disabled === 'function' && item.disabled()).toBe(true);
    expect(f.tab.getControlValue(item.key)).toBeUndefined();
    await f.tab.setControlValue(item.key, true); expect(f.storage.save).not.toHaveBeenCalled(); expect(f.raw()).toBe(raw);
  } finally { f.disposeAll(); }
});
it('rolls back partial subscription acquisition and leaked callbacks cannot revive hidden or closed tabs', async () => {
  const f = await fixture(); const second = booleanSettingFixture(); await second.setting.initialize();
  const release = vi.fn(() => { throw new Error('unlink failed'); }); let leaked: () => void | Promise<void> = () => undefined;
  const subscribe = f.setting.subscribe.bind(f.setting);
  vi.spyOn(f.setting, 'subscribe').mockImplementationOnce(listener => { leaked = listener; subscribe(listener); return release; });
  vi.spyOn(second.setting, 'subscribe').mockImplementationOnce(() => { throw new Error('original subscription'); });
  const tab = new ShellSettingsTab(new FixturePlugin(new App(), manifest), { preferences: f.preferences, notifications: f.notices,
    diagnostics: f.diagnostics, settings: [f.setting, second.setting], text: key => key });
  try {
    expect(() => tab.getSettingDefinitions()).toThrow('original subscription'); expect(release).toHaveBeenCalledOnce();
    await leaked(); expect(tab.update).not.toHaveBeenCalled();
    vi.spyOn(f.setting, 'subscribe').mockImplementationOnce(listener => { leaked = listener; subscribe(listener); return release; });
    tab.getSettingDefinitions(); tab.hide(); vi.mocked(tab.update).mockClear();
    await leaked(); expect(tab.update).not.toHaveBeenCalled();
    tab.getSettingDefinitions(); await leaked(); expect(tab.update).not.toHaveBeenCalled();
    await f.setting.toggle(); await vi.waitFor(() => expect(f.setting.readonly).toBe(false)); expect(tab.update).toHaveBeenCalled();
    tab.dispose(); vi.mocked(tab.update).mockClear(); await leaked(); expect(tab.update).not.toHaveBeenCalled();
    expect(f.diagnostics.report).toHaveBeenCalledWith('settings.cleanup', 'settings.hide');
  } finally { tab.dispose(); second.dispose(); f.disposeAll(); vi.restoreAllMocks(); }
});
