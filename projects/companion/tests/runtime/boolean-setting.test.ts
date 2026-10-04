import { expect, it, vi } from 'vitest';
import { BooleanSetting } from '../../src/features/api';
import { defaults } from '../../src/domain/preferences';
import { booleanSettingFixture } from './boolean-setting-fixture';

it('initializes without writes and shares canonical command/control/preference persistence', async () => {
  const f = booleanSettingFixture();
  try {
    expect(f.setting.value).toBeUndefined(); expect(f.setting.readonly).toBe(true);
    const first = f.setting.initialize(); expect(f.setting.initialize()).toBe(first); await first;
    expect(f.setting.value).toBe(false); expect(f.setting.readonly).toBe(false); expect(f.setting.errorKey).toBeUndefined();
    expect(f.storage.save).not.toHaveBeenCalled();
    expect((await f.setting.set('true')).ok).toBe(false);
    await f.setting.set(false); expect(f.storage.save).not.toHaveBeenCalled();
    await Promise.all([f.setting.toggle(), f.preferences.update({ notifySuccess: false })]);
    await vi.waitFor(() => expect(f.setting.readonly).toBe(false));
    expect(f.setting.value).toBe(true); expect(f.preferences.current.notifySuccess).toBe(false);
    expect(f.raw()).toMatchObject({ preferences: { notifySuccess: false }, pluginEntities: { collections: { 'fixture-setting': { records: [{ values: { enabled: true } }] } } } });
    await f.setting.set(false); expect(f.setting.value).toBe(false);
    f.setting.dispose(); expect(f.setting.readonly).toBe(true);
    expect(await f.setting.toggle()).toMatchObject({ ok: false, error: { code: 'disposed' } });
  } finally { f.dispose(); }
});
it('retains the last committed display during pending or uncertain saves and never retries an uncertain write', async () => {
  const f = booleanSettingFixture(); await f.setting.initialize(); let finish!: () => void;
  const held = new Promise<void>(resolve => { finish = resolve; });
  f.storage.save.mockImplementationOnce(async value => { await held; f.persist(value); throw new Error('reply lost'); });
  try {
    const pending = f.setting.set(true); await vi.waitFor(() => expect(f.storage.save).toHaveBeenCalledOnce());
    expect(f.setting.value).toBe(false); expect(f.setting.readonly).toBe(true);
    finish(); expect(await pending).toMatchObject({ ok: false, error: { effect: 'uncertain' } });
    expect(f.setting.value).toBe(false); expect(f.setting.readonly).toBe(true); expect(f.setting.errorKey).toBe('error.settingsWrite');
    await f.setting.set(false); expect(f.storage.save).toHaveBeenCalledOnce();
  } finally { f.dispose(); }
});
it('preserves corrupt/future data and conflicting singleton records without materializing defaults', async () => {
  for (const raw of [{ schemaVersion: 99 }, { schemaVersion: 1, preferences: defaults,
    pluginEntities: { schemaVersion: 1, collections: { 'fixture-setting': { schemaVersion: 99, revision: 0, records: [] } } } }]) {
    const f = booleanSettingFixture(raw);
    try {
      expect((await f.setting.initialize()).ok).toBe(false); expect(f.setting.readonly).toBe(true);
      expect(f.setting.value).toBeUndefined(); expect(f.setting.errorKey).toBeDefined();
      await f.setting.set(true); expect(f.storage.save).not.toHaveBeenCalled(); expect(f.raw()).toBe(raw);
    } finally { f.dispose(); }
  }
  const f = booleanSettingFixture(); await f.setting.initialize();
  try {
    await f.repository.create({ enabled: false }); await f.repository.create({ enabled: true });
    await vi.waitFor(() => expect(f.setting.errorKey).toBe('error.pluginDataConflict'));
    await f.setting.toggle(); expect(f.storage.save).toHaveBeenCalledTimes(2); expect(f.setting.readonly).toBe(true);
  } finally { f.dispose(); }
});
it('tracks matching committed repository facts, skips unrelated facts and releases owned listeners', async () => {
  const f = booleanSettingFixture(); await f.setting.initialize(); const changed = vi.fn(); const stop = f.setting.subscribe(changed);
  try {
    const list = vi.spyOn(f.repository, 'list'); const before = list.mock.calls.length;
    f.events.publish({ type: 'plugin-data.created', payload: { entity: 'other', id: 'other', revision: 1, schemaVersion: 1 } });
    await Promise.resolve(); expect(list).toHaveBeenCalledTimes(before);
    const created = await f.repository.create({ enabled: true }); if (!created.ok) throw new Error('create failed');
    await vi.waitFor(() => expect(f.setting.value).toBe(true));
    const updated = await f.repository.update(created.value, { enabled: false }); if (!updated.ok) throw new Error('update failed');
    await vi.waitFor(() => expect(f.setting.value).toBe(false));
    await f.repository.delete(updated.value); await vi.waitFor(() => expect(f.setting.readonly).toBe(false));
    stop(); f.setting.dispose(); expect(f.events.size).toBe(0);
    const calls = changed.mock.calls.length; f.setting.subscribe(changed)(); await f.setting.set(true);
    expect(changed).toHaveBeenCalledTimes(calls);
  } finally { f.dispose(); }
});
it('does not revive disposed initialization or in-flight committed values', async () => {
  const queued = booleanSettingFixture(); const queuedRead = queued.setting.initialize(); queued.setting.dispose();
  expect((await queuedRead).ok).toBe(false); expect(queued.storage.load).not.toHaveBeenCalled(); queued.dispose();
  const reading = booleanSettingFixture(); let finishRead!: (value: unknown) => void;
  reading.storage.load.mockImplementationOnce(() => new Promise(resolve => { finishRead = resolve; }));
  const started = reading.setting.initialize(); await vi.waitFor(() => expect(reading.storage.load).toHaveBeenCalledOnce());
  reading.setting.dispose(); finishRead(null); expect((await started).ok).toBe(false); expect(reading.setting.value).toBeUndefined(); reading.dispose();
  const f = booleanSettingFixture(); await f.setting.initialize(); let finish!: () => void;
  const held = new Promise<void>(resolve => { finish = resolve; });
  f.storage.save.mockImplementationOnce(async value => { await held; f.persist(value); });
  const work = f.setting.set(true); await vi.waitFor(() => expect(f.storage.save).toHaveBeenCalledOnce());
  f.setting.dispose(); finish(); expect((await work).ok).toBe(true); expect(f.setting.value).toBe(false); f.dispose();
});
it('reflects a failed shared preference write without allowing a second persistence path', async () => {
  const f = booleanSettingFixture(); await f.setting.initialize();
  try {
    f.storage.save.mockRejectedValueOnce(new Error('shared writer uncertain'));
    await f.preferences.update({ notifySuccess: false });
    expect(f.setting.value).toBe(false); expect(f.setting.readonly).toBe(true); expect(f.setting.errorKey).toBe('error.settingsWrite');
    expect((await f.setting.set(true)).ok).toBe(false); expect(f.storage.save).toHaveBeenCalledOnce();
  } finally { f.dispose(); }
});
it('observes rejected repository work and synchronous/asynchronous subscribers independently', async () => {
  const f = booleanSettingFixture();
  const asyncStop = f.setting.subscribe(async () => { throw new Error('async subscriber'); });
  let later = () => {};
  const syncStop = f.setting.subscribe(() => { later(); throw new Error('subscriber'); });
  const skipped = vi.fn(); later = f.setting.subscribe(skipped);
  try {
    await f.setting.initialize(); await Promise.resolve();
    expect(skipped).not.toHaveBeenCalled();
    expect(f.diagnostics.report).toHaveBeenCalledWith('setting.listener', 'setting.notify');
    asyncStop(); syncStop();
    vi.spyOn(f.repository, 'list').mockRejectedValueOnce(new Error('Unexpected repository contract rejection'));
    expect(await f.setting.set(true)).toMatchObject({ ok: false, error: { code: 'unexpected' } });
    expect(f.diagnostics.report).toHaveBeenCalledWith('setting.operation', 'setting.change'); expect(f.setting.value).toBe(false);
  } finally { f.dispose(); }
});
it('validates descriptors and rolls back partial subscription acquisition', () => {
  const f = booleanSettingFixture();
  try {
    for (const patch of [{ id: '../bad' }, { id: 'a'.repeat(65) }, { entity: '' }, { titleKey: '' }, { descriptionKey: '' }]) {
      expect(() => new BooleanSetting({ ...f.definition, ...patch }, f.repository, f.capabilities)).toThrow('INVALID_BOOLEAN_SETTING');
    }
    // @ts-expect-error Unchecked runtime callers must not supply a nonboolean default.
    expect(() => new BooleanSetting({ ...f.definition, defaultValue: 'false' }, f.repository, f.capabilities)).toThrow('INVALID_BOOLEAN_SETTING');
    const release = vi.fn(); vi.spyOn(f.events, 'on').mockReturnValueOnce(release).mockImplementationOnce(() => { throw new Error('subscription failed'); });
    expect(() => new BooleanSetting(f.definition, f.repository, f.capabilities)).toThrow('subscription failed'); expect(release).toHaveBeenCalledOnce();
  } finally { f.dispose(); }
});
it('contains every unsubscribe failure, clears listeners and preserves the original acquisition failure', () => {
  const f = booleanSettingFixture();
  const first = vi.fn(() => { throw new Error('first unlink'); }); const second = vi.fn(); const third = vi.fn();
  vi.spyOn(f.events, 'on').mockReturnValueOnce(first).mockReturnValueOnce(second).mockReturnValueOnce(third);
  const setting = new BooleanSetting(f.definition, f.repository, f.capabilities);
  const changed = vi.fn(); setting.subscribe(changed);
  expect(() => setting.dispose()).not.toThrow(); setting.dispose();
  expect(first).toHaveBeenCalledOnce(); expect(second).toHaveBeenCalledOnce(); expect(third).toHaveBeenCalledOnce();
  expect(f.diagnostics.report).toHaveBeenCalledWith('setting.cleanup', 'setting.dispose');
  setting.subscribe(changed)(); expect(changed).not.toHaveBeenCalled();
  vi.mocked(f.events.on).mockReturnValueOnce(first).mockImplementationOnce(() => { throw new Error('original acquisition'); });
  expect(() => new BooleanSetting(f.definition, f.repository, f.capabilities)).toThrow('original acquisition');
  f.dispose(); vi.restoreAllMocks();
});
