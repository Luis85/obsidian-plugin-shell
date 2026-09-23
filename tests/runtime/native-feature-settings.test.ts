// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', async () => (await import('./host-fixture')).hostModule);
import { App, Plugin, Setting, SettingGroup, type SettingDefinitionItem } from 'obsidian';
import { ShellSettingsTab } from '../../src/infrastructure/obsidian/settings-tab';
import { NoticeService } from '../../src/application/notice-service';
import { success } from '../../src/domain/outcome';
import { booleanSettingFixture } from './boolean-setting-fixture';
import { hostState } from './host-fixture';
import manifest from '../../manifest.json';
class FixturePlugin extends Plugin {}

async function fixture(raw: unknown = null) {
  hostState.reset(); const f = booleanSettingFixture(raw); await f.setting.initialize();
  // A missing projection guard must fail deterministically, not spin forever in
  // resolved-promise microtasks before Vitest's timeout can run.
  f.storage.save.mockImplementation(async value => {
    if (f.storage.save.mock.calls.length > 8) throw new Error('Unexpected native-toggle feedback loop');
    f.persist(value);
  });
  const notices = new NoticeService({ kind: 'obsidian', openDocument: async () => success(undefined), showModal() {}, notice: () => () => undefined },
    key => key, f.diagnostics, { scheduler: { after: () => () => undefined } });
  const plugin = new FixturePlugin(new App(), manifest);
  const tab = new ShellSettingsTab(plugin, { preferences: f.preferences, notifications: notices, diagnostics: f.diagnostics, settings: [f.setting], text: key => key });
  const definitions = tab.getSettingDefinitions();
  return { ...f, tab, notices, definitions, disposeAll() { tab.dispose(); notices.dispose(); f.dispose(); document.body.replaceChildren(); } };
}
function render(definitions: SettingDefinitionItem[], owner = document) {
  const definition = definitions.find(item => 'render' in item && typeof item.render === 'function');
  if (!definition || !('render' in definition) || !definition.render) throw new Error('NATIVE_RENDER_DEFINITION_MISSING');
  const container = owner.createElement('div'); owner.body.append(container);
  const row = new Setting(container); const group = new SettingGroup(container);
  const cleanup = definition.render(row, group);
  const toggle = container.querySelector<HTMLElement>('[role="switch"]');
  if (!toggle) throw new Error('NATIVE_TOGGLE_MISSING');
  return { container, row, toggle, close() { cleanup?.(); container.remove(); } };
}
it('renders a nondefault committed value without invoking the setter or creating a record', async () => {
  const f = await fixture(); await f.setting.set(true); await vi.waitFor(() => expect(f.setting.readonly).toBe(false));
  f.storage.save.mockClear(); const setter = vi.spyOn(f.setting, 'set');
  const row = render(f.definitions);
  try {
    expect(row.toggle.getAttribute('aria-checked')).toBe('true');
    expect(setter).not.toHaveBeenCalled(); expect(f.storage.save).not.toHaveBeenCalled();
  } finally { row.close(); f.disposeAll(); vi.restoreAllMocks(); }
});
it('keeps the focused native toggle canonical and reacquires rows from cached definitions after hide/reopen', async () => {
  const f = await fixture(); const subscribe = vi.spyOn(f.setting, 'subscribe');
  const setter = vi.spyOn(f.setting, 'set');
  expect(subscribe).not.toHaveBeenCalled(); // Indexing metadata must not acquire visible ownership.
  const first = render(f.definitions);
  try {
    expect(first.toggle.getAttribute('aria-checked')).toBe('false'); expect(f.storage.save).not.toHaveBeenCalled();
    first.toggle.focus(); first.toggle.click();
    await vi.waitFor(() => expect(f.setting.readonly).toBe(false));
    await vi.waitFor(() => expect(first.toggle.getAttribute('aria-checked')).toBe('true'));
    expect(document.activeElement).toBe(first.toggle);
    await f.setting.toggle(); await vi.waitFor(() => expect(f.setting.readonly).toBe(false));
    expect(first.toggle.getAttribute('aria-checked')).toBe('false'); expect(document.activeElement).toBe(first.toggle);
    expect(f.storage.save).toHaveBeenCalledTimes(2); // Programmatic setValue callbacks must never enqueue another write.
    expect(setter).toHaveBeenCalledTimes(1);
    expect(f.tab.update).not.toHaveBeenCalled(); // No rebuilding or blur to evade the host's focused-row rule.
    f.tab.hide(); first.close(); await f.setting.toggle(); await vi.waitFor(() => expect(f.setting.readonly).toBe(false));
    const reopened = render(f.definitions); // The actual host reuses cached definitions without getSettingDefinitions().
    expect(reopened.toggle.getAttribute('aria-checked')).toBe('true');
    await f.setting.toggle(); await vi.waitFor(() => expect(f.setting.readonly).toBe(false));
    expect(reopened.toggle.getAttribute('aria-checked')).toBe('false');
    f.tab.dispose(); const saves = f.storage.save.mock.calls.length;
    reopened.toggle.click(); await f.tab.setControlValue('authoring:fixture-setting', true); expect(f.storage.save).toHaveBeenCalledTimes(saves);
    reopened.close(); expect(f.tab.update).not.toHaveBeenCalled();
  } finally { first.close(); f.disposeAll(); }
});
it('shows last committed values while pending/uncertain and suppresses late hidden-row work', async () => {
  const f = await fixture(); const row = render(f.definitions); let finish!: () => void;
  const held = new Promise<void>(resolve => { finish = resolve; });
  f.storage.save.mockImplementationOnce(async () => { await held; throw new Error('uncertain'); });
  try {
    const work = f.tab.setControlValue('authoring:fixture-setting', true); await vi.waitFor(() => expect(f.storage.save).toHaveBeenCalledOnce());
    expect(row.toggle.getAttribute('aria-disabled')).toBe('true'); expect(row.toggle.getAttribute('aria-checked')).toBe('false');
    f.tab.hide(); finish(); await work; expect(f.notices.current).toEqual([]);
    const reopened = render(f.definitions);
    expect(reopened.toggle.getAttribute('aria-checked')).toBe('false'); expect(reopened.toggle.getAttribute('aria-disabled')).toBe('true');
    expect(reopened.container.querySelector('[role="alert"]')?.textContent).toBe('error.settingsWrite');
    await f.tab.setControlValue('authoring:fixture-setting', false); expect(f.storage.save).toHaveBeenCalledOnce();
    expect(f.notices.current[0]?.key).toBe('error.settingsWrite'); reopened.close();
  } finally { row.close(); f.disposeAll(); }
});
it('keeps unreadable data disabled and releases a settings-window row even without host cleanup', async () => {
  const raw = { schemaVersion: 99 }; const f = await fixture(raw); const frame = document.createElement('iframe'); document.body.append(frame);
  const owner = frame.contentDocument; if (!owner?.defaultView) throw new Error('FRAME_WINDOW_MISSING');
  const release = vi.fn(); vi.spyOn(f.setting, 'subscribe').mockReturnValueOnce(release);
  const row = render(f.definitions, owner);
  try {
    expect(row.toggle.getAttribute('aria-disabled')).toBe('true'); expect(f.tab.getControlValue('authoring:fixture-setting')).toBeUndefined();
    await f.tab.setControlValue('authoring:fixture-setting', true); expect(f.storage.save).not.toHaveBeenCalled(); expect(f.raw()).toBe(raw);
    owner.defaultView.dispatchEvent(new Event('unload')); expect(release).toHaveBeenCalledOnce();
    row.close(); f.tab.hide(); f.tab.dispose(); expect(release).toHaveBeenCalledOnce();
  } finally { row.close(); f.disposeAll(); }
});
it('contains failed row acquisition/unlinking and guards callbacks retained by a broken unsubscribe', async () => {
  const f = await fixture(); let leaked: () => void | Promise<void> = () => undefined;
  const release = vi.fn(() => { throw new Error('unlink'); });
  vi.spyOn(f.setting, 'subscribe').mockImplementationOnce(listener => { leaked = listener; return release; });
  const first = render(f.definitions);
  try {
    f.tab.hide(); const before = first.toggle.outerHTML; await leaked(); expect(first.toggle.outerHTML).toBe(before);
    const reopened = render(f.definitions); await leaked(); expect(first.toggle.outerHTML).toBe(before);
    expect(f.diagnostics.report).toHaveBeenCalledWith('settings.cleanup', 'settings.hide');
    vi.spyOn(f.setting, 'subscribe').mockImplementationOnce(() => { throw new Error('original subscription'); });
    expect(() => render(f.definitions)).toThrow('original subscription');
    expect(release).toHaveBeenCalledOnce(); f.tab.dispose(); await leaked(); expect(first.toggle.outerHTML).toBe(before);
    reopened.close();
  } finally { first.close(); f.disposeAll(); vi.restoreAllMocks(); }
});
it('attempts every model unlink even if a closed owner window rejects removing its unload listener', async () => {
  const f = await fixture(); const frame = document.createElement('iframe'); document.body.append(frame);
  const owner = frame.contentDocument; if (!owner?.defaultView) throw new Error('FRAME_WINDOW_MISSING');
  const firstOff = vi.fn(); const secondOff = vi.fn(); const callbacks: (() => void | Promise<void>)[] = [];
  vi.spyOn(f.setting, 'subscribe').mockImplementationOnce(callback => { callbacks.push(callback); return firstOff; })
    .mockImplementationOnce(callback => { callbacks.push(callback); return secondOff; });
  const first = render(f.definitions, owner); const second = render(f.definitions, owner);
  const unlink = vi.spyOn(owner.defaultView, 'removeEventListener').mockImplementation(() => { throw new Error('closed window'); });
  try {
    const before = first.toggle.outerHTML;
    expect(() => f.tab.hide()).not.toThrow(); expect(firstOff).toHaveBeenCalledOnce(); expect(secondOff).toHaveBeenCalledOnce();
    for (const callback of callbacks) await callback();
    expect(first.toggle.outerHTML).toBe(before); expect(f.diagnostics.report).toHaveBeenCalledWith('settings.cleanup', 'settings.hide');
    f.tab.dispose(); first.close(); second.close(); expect(firstOff).toHaveBeenCalledOnce(); expect(secondOff).toHaveBeenCalledOnce();
  } finally { unlink.mockRestore(); first.close(); second.close(); f.disposeAll(); vi.restoreAllMocks(); }
});
