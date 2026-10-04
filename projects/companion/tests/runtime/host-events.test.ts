// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', async () => (await import('./host-fixture')).hostModule);
import { App, Plugin, TFile, TFolder, WorkspaceLeaf } from 'obsidian';
import { bindHostEvents } from '../../src/infrastructure/obsidian/event-bridge';
import { createTimerScheduler } from '../../src/infrastructure/timers';
import { TypedEventBus } from '../../src/infrastructure/events/typed-event-bus';
import type { ShellEvents } from '../../src/application/events';
import type { TimerScheduler } from '../../src/application/ports';
import { hostState } from './host-fixture';
beforeEach(() => { hostState.reset(); vi.useFakeTimers(); });
afterEach(() => { expect(vi.getTimerCount()).toBe(0); vi.useRealTimers(); vi.restoreAllMocks(); });
function fixture(options = {}, timers: TimerScheduler = createTimerScheduler()) {
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(new App(), { id: 'host-test', name: 'Host test', version: '1.0.0', minAppVersion: '1.13.7', author: 'Test', description: 'Synthetic host' });
  const errors = { report: vi.fn() }; const events = new TypedEventBus<ShellEvents>(errors);
  const records: { type: string; payload: unknown }[] = [];
  function record<K extends keyof ShellEvents>(type: K) { events.on(type, payload => { records.push({ type, payload }); }); }
  record('host.vault.entry-created'); record('host.vault.entry-modified'); record('host.vault.entry-renamed'); record('host.vault.entry-deleted');
  record('host.workspace.file-opened'); record('host.workspace.active-view-changed'); record('host.workspace.layout-changed'); record('host.metadata.changed'); record('host.active-file-changed'); record('documents.created');
  const dispose = bindHostEvents(plugin, events, errors, timers, options);
  const emit = (name: string, ...args: unknown[]) => { for (const callback of [...hostState.listeners.get(name) ?? []]) callback(...args); };
  const ready = () => hostState.ready.forEach(callback => callback());
  return { plugin, errors, events, records, dispose, emit, ready };
}
const file = (path = 'Notes/a.md') => Object.assign(new TFile(), { path, stat: { mtime: 42, ctime: 1, size: 10 } });
it('[HOST-EVT-01] suppresses startup enumeration, snapshots every documented mapping and never emits application success', () => {
  const f = fixture();
  try {
    const note = file(); f.emit('vault.create', note); expect(f.records).toEqual([]); f.ready(); f.ready(); expect(f.plugin.registerEvent).toHaveBeenCalledTimes(8);
    f.emit('vault.create', note); note.path = 'Notes/changed.md';
    f.emit('vault.create', Object.assign(new TFolder(), { path: 'Notes/Subfolder' }));
    f.emit('vault.modify', note); f.emit('vault.rename', note, 'Notes/a.md'); f.emit('vault.delete', note);
    f.emit('file-open', note); f.emit('file-open', null); f.emit('metadata.changed', note, 'SECRET BODY', { secret: 'SECRET CACHE' });
    const leaf = Object.assign(new WorkspaceLeaf(), { view: { getViewType: () => 'markdown' } }); f.emit('active-leaf-change', leaf); f.emit('active-leaf-change', null);
    expect(f.records).toEqual([
      { type: 'host.vault.entry-created', payload: { path: 'Notes/a.md', kind: 'file' } },
      { type: 'host.vault.entry-created', payload: { path: 'Notes/Subfolder', kind: 'folder' } },
      { type: 'host.vault.entry-modified', payload: { path: 'Notes/changed.md', modifiedTime: 42 } },
      { type: 'host.vault.entry-renamed', payload: { path: 'Notes/changed.md', oldPath: 'Notes/a.md', kind: 'file' } },
      { type: 'host.vault.entry-deleted', payload: { path: 'Notes/changed.md', kind: 'file' } },
      { type: 'host.workspace.file-opened', payload: { path: 'Notes/changed.md' } }, { type: 'host.active-file-changed', payload: { available: true } },
      { type: 'host.workspace.file-opened', payload: { path: null } }, { type: 'host.active-file-changed', payload: { available: false } },
      { type: 'host.metadata.changed', payload: { path: 'Notes/changed.md' } },
      { type: 'host.workspace.active-view-changed', payload: { viewType: 'markdown' } }, { type: 'host.workspace.active-view-changed', payload: { viewType: null } },
    ]);
    expect(JSON.stringify(f.records)).not.toContain('SECRET'); expect(f.errors.report).not.toHaveBeenCalled();
  } finally { f.dispose(); f.events.dispose(); }
});
it('[HOST-EVT-02] coalesces only layout invalidations while preserving ordered rename/create/delete facts', () => {
  const f = fixture();
  try {
    f.ready(); for (let i = 0; i < 100; i++) f.emit('layout-change');
    f.emit('vault.create', file()); f.emit('vault.rename', file('Notes/b.md'), 'Notes/a.md'); f.emit('vault.delete', file('Notes/b.md'));
    expect(f.records).toHaveLength(3); expect(vi.getTimerCount()).toBe(1); vi.advanceTimersByTime(49); expect(f.records).toHaveLength(3);
    vi.advanceTimersByTime(1); expect(f.records.at(-1)).toEqual({ type: 'host.workspace.layout-changed', payload: { revision: 1 } });
    f.emit('layout-change'); vi.advanceTimersByTime(50); expect(f.records.at(-1)?.payload).toEqual({ revision: 2 });
    f.emit('layout-change'); f.dispose(); f.dispose(); expect(vi.getTimerCount()).toBe(0);
    const count = f.records.length; f.emit('vault.create', file()); expect(f.records).toHaveLength(count);
    expect(f.plugin.app.vault.offref).toHaveBeenCalledTimes(4); expect(f.plugin.app.workspace.offref).toHaveBeenCalledTimes(3); expect(f.plugin.app.metadataCache.offref).toHaveBeenCalledOnce();
  } finally { f.dispose(); f.events.dispose(); }
});
it('[HOST-EVT-03] validates unknown host payloads, hides configurable metadata paths and normalizes missing scalar mtime', () => {
  const f = fixture();
  try {
    f.plugin.app.vault.configDir = 'PrivateConfig'; f.ready();
    for (const path of ['PrivateConfig/data.json', 'privateconfig', 'privateconfig/note.md']) f.emit('vault.create', file(path));
    expect(f.records).toEqual([]); expect(f.errors.report).not.toHaveBeenCalled();
    for (const value of [{ path: 'Notes/fake.md' }, file('../secret'), file(''), file('/absolute'), file('Notes\\bad'), file('Notes/./bad'), file('Notes/\u0000bad'), file('C:/private/note.md')]) f.emit('vault.create', value);
    f.emit('vault.rename', file(), '../old'); f.emit('file-open', undefined);
    f.emit('active-leaf-change', { view: { getViewType: () => 'control\u0000value' } });
    expect(f.records).toEqual([]); expect(f.errors.report).toHaveBeenCalledTimes(11);
    expect(f.errors.report.mock.calls.every(args => args[0] === 'host.payload')).toBe(true);
    f.emit('vault.modify', Object.assign(new TFile(), { path: 'Notes/a.md', stat: { mtime: NaN } }));
    f.emit('vault.modify', Object.assign(new TFolder(), { path: 'Notes' }));
    expect(f.records).toEqual([{ type: 'host.vault.entry-modified', payload: { path: 'Notes/a.md', modifiedTime: null } }]);
  } finally { f.dispose(); f.events.dispose(); }
});
it('[HOST-EVT-06] accepts public view-type strings and observes delayed publisher failures', () => {
  const f = fixture();
  try {
    f.ready();
    for (const viewType of ['third-party:view.type', 'Ansicht.Übersicht', 'view with spaces']) f.emit('active-leaf-change', { view: { getViewType: () => viewType } });
    expect(f.records.map(record => record.payload)).toEqual([{ viewType: 'third-party:view.type' }, { viewType: 'Ansicht.Übersicht' }, { viewType: 'view with spaces' }]);
    expect(f.errors.report).not.toHaveBeenCalled();
    vi.spyOn(f.events, 'publish').mockImplementationOnce(() => { throw new Error('publisher'); });
    f.emit('layout-change'); expect(() => vi.advanceTimersByTime(50)).not.toThrow();
    expect(f.errors.report).toHaveBeenCalledExactlyOnceWith('host.event', 'host.bridge');
  } finally { f.dispose(); f.events.dispose(); }
});
it('[HOST-EVT-07] timer cancellation failure cannot prevent any host subscription cleanup', () => {
  let delayed = () => {}; const cancel = vi.fn(() => { throw new Error('cancel failed'); });
  const f = fixture({}, { after(_ms, callback) { delayed = callback; return cancel; } });
  try {
    f.ready(); f.emit('layout-change'); expect(() => f.dispose()).not.toThrow(); f.dispose(); delayed();
    expect(cancel).toHaveBeenCalledOnce(); expect(f.records).toEqual([]);
    expect(f.plugin.app.vault.offref).toHaveBeenCalledTimes(4); expect(f.plugin.app.workspace.offref).toHaveBeenCalledTimes(3); expect(f.plugin.app.metadataCache.offref).toHaveBeenCalledOnce();
    expect(f.errors.report).toHaveBeenCalledExactlyOnceWith('host.cleanup', 'host.bridge');
  } finally { f.dispose(); f.events.dispose(); }
});
it('[HOST-EVT-08] configurable Windows metadata paths are normalized before filtering', () => {
  const f = fixture();
  try {
    f.plugin.app.vault.configDir = 'Host\\Settings'; f.ready();
    f.emit('vault.create', file('Host/Settings/private.md')); f.emit('metadata.changed', file('host/settings/private.md'));
    f.emit('vault.create', Object.assign(new TFolder(), { path: 'Host/Settings' }));
    expect(f.records).toEqual([]); expect(f.errors.report).not.toHaveBeenCalled();
    f.emit('vault.create', file('Host/SettingsExtra/public.md')); expect(f.records).toHaveLength(1);
  } finally { f.dispose(); f.events.dispose(); }
});
it('[HOST-EVT-04] unload-before-ready, disabled noisy mappings and partial registration failures remove owned callbacks', () => {
  const early = fixture(); early.dispose(); early.ready(); expect(early.plugin.registerEvent).not.toHaveBeenCalled(); early.events.dispose();
  hostState.reset(); const quiet = fixture({ modifications: false, metadata: false, layoutDelay: 0 });
  try { quiet.ready(); expect(quiet.plugin.registerEvent).toHaveBeenCalledTimes(6); quiet.emit('vault.modify', file()); quiet.emit('metadata.changed', file()); expect(quiet.records).toEqual([]); quiet.emit('layout-change'); vi.runAllTimers(); expect(quiet.records).toHaveLength(1); }
  finally { quiet.dispose(); quiet.events.dispose(); }
  hostState.reset(); const failed = fixture(); vi.spyOn(failed.plugin.app.vault, 'on').mockImplementationOnce(() => { throw new Error('host registration'); });
  failed.ready(); expect(failed.errors.report).toHaveBeenCalledExactlyOnceWith('host.registration', 'host.bridge'); failed.dispose(); failed.events.dispose();
});
it('[HOST-EVT-05] thrown host getters and cleanup errors reach independent diagnostics without retaining host references', () => {
  const f = fixture();
  try {
    f.ready(); f.emit('active-leaf-change', { view: { getViewType() { throw new Error('getter secret'); } } });
    vi.mocked(f.plugin.app.vault.offref).mockImplementationOnce(() => { throw new Error('cleanup'); }); f.dispose();
    expect(f.errors.report.mock.calls).toEqual([['host.event', 'host.bridge'], ['host.cleanup', 'host.bridge']]);
    const stale = hostState.listeners.get('vault.create')?.[0]; stale?.(file()); expect(f.records).toEqual([]);
  } finally { f.dispose(); f.events.dispose(); }
});
