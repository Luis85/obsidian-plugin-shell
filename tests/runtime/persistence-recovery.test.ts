import { expect, it, vi } from 'vitest';
import { PluginDataStore } from '../../src/application/plugin-data-store';
import { PreferenceService } from '../../src/application/preference-service';
import { PluginDataRepository } from '../../src/application/plugin-data-repository';
import { bookmark } from './plugin-data-helpers';
import { defaults } from '../../src/domain/preferences';
import { failure } from '../../src/domain/outcome';
import { deferred } from './helpers';

const savedGermanPreferences = { hideObsidianViewHeader: false, locale: 'de', taskFolder: 'Tasks', notifySuccess: true };

function runtime(original: string | null, inaccessible = false) {
  let bytes = original;
  const storage = {
    read: vi.fn(async (): Promise<string | null> => {
      if (inaccessible) throw new Error('Private I/O details');
      return bytes;
    }),
    load: vi.fn(async (): Promise<unknown> => {
      if (inaccessible) throw new Error('Private I/O details');
      return bytes === null ? null : JSON.parse(bytes);
    }),
    save: vi.fn(async (data: unknown) => { bytes = JSON.stringify(data); }),
  };
  const errors = { report: vi.fn() }; const events = { publish: vi.fn() };
  const data = new PluginDataStore(storage, errors); const preferences = new PreferenceService(data, events, errors);
  return { data, preferences, errors, events, storage, bytes: () => bytes,
    dispose() { preferences.dispose(); data.dispose(); } };
}

it('[RECOVERY-07-01] absent corrupt inaccessible and future storage expose distinct protected states without initialization writes', async () => {
  const cases = [
    { bytes: null, status: 'absent', inaccessible: false, guidance: undefined },
    { bytes: '{ invalid JSON', status: 'corrupt', inaccessible: false, guidance: 'settings.recoveryCorrupt' },
    { bytes: 'null', status: 'corrupt', inaccessible: false, guidance: 'settings.recoveryCorrupt' },
    { bytes: JSON.stringify({ schemaVersion: 1, preferences: {} }), status: 'corrupt', inaccessible: false, guidance: 'settings.recoveryCorrupt' },
    { bytes: JSON.stringify({ schemaVersion: 200, preferences: defaults, opaque: ['future'] }, null, 2), status: 'future', inaccessible: false, guidance: 'settings.recoveryFuture' },
    { bytes: JSON.stringify({ schemaVersion: 1, preferences: defaults }, null, 2), status: 'inaccessible', inaccessible: true, guidance: 'settings.recoveryInaccessible' },
  ];
  for (const sample of cases) {
    const f = runtime(sample.bytes, sample.inaccessible);
    try {
      expect(f.preferences.persistenceStatus).toBe('unloaded'); await f.preferences.load();
      expect(f.preferences.persistenceStatus).toBe(sample.status); expect(f.preferences.readonly).toBe(sample.status !== 'absent');
      expect(f.preferences.readErrorKey).toBe(sample.status === 'absent' ? undefined : 'error.settingsRead');
      expect(f.preferences.recoveryKey).toBe(sample.guidance);
      expect(f.storage.save).not.toHaveBeenCalled(); expect(f.bytes()).toBe(sample.bytes); expect(f.events.publish).not.toHaveBeenCalled();
      if (sample.status !== 'absent') {
        const blocked = await f.preferences.update({ locale: 'de' });
        expect(blocked).toEqual(failure('storage', 'error.settingsRead'));
        if (!blocked.ok) { expect(Object.isFrozen(blocked.error)).toBe(true); expect(Reflect.set(blocked.error, 'key', 'error.unexpected')).toBe(false); }
        expect(f.storage.save).not.toHaveBeenCalled(); expect(f.bytes()).toBe(sample.bytes);
        expect(f.errors.report.mock.calls).toEqual([['settings.read', 'settings.load']]);
      } else expect(f.errors.report).not.toHaveBeenCalled();
    } finally { f.dispose(); }
  }
});

it('[RECOVERY-07-03] present JSON null is protected as corrupt through the presence-aware read port rather than treated as missing', async () => {
  const f = runtime('null');
  try {
    await f.preferences.load();
    expect(f.preferences.persistenceStatus).toBe('corrupt'); expect(f.preferences.readonly).toBe(true);
    expect(f.storage.read).toHaveBeenCalledOnce(); expect(f.storage.load).not.toHaveBeenCalled();
    expect(await f.preferences.update({ locale: 'de' })).toEqual(failure('storage', 'error.settingsRead'));
    expect(f.bytes()).toBe('null'); expect(f.storage.save).not.toHaveBeenCalled(); expect(f.events.publish).not.toHaveBeenCalled();
    expect(f.errors.report.mock.calls).toEqual([['settings.read', 'settings.load']]);
  } finally { f.dispose(); }
});

it('[RECOVERY-05-01] uncertain saves retain their effect and recovery guidance on every blocked operation until saved-byte reconstruction', async () => {
  const original = JSON.stringify({ schemaVersion: 1, preferences: defaults, opaque: { records: ['unchanged', null, false] } }, null, 2);
  for (const committed of [false, true]) {
    const f = runtime(original); const started = deferred(); const release = deferred();
    const persist = f.storage.save.getMockImplementation(); if (!persist) throw new Error('Missing save boundary');
    f.storage.save.mockImplementationOnce(async value => {
      started.resolve(); await release.promise; if (committed) await persist(value); throw new Error('Private acknowledgment failure');
    });
    try {
      await f.preferences.load(); const first = f.preferences.update({ locale: 'de' }); await started.promise;
      const queued = f.preferences.update({ taskFolder: 'Must not start' }); release.resolve();
      const uncertain = failure('uncertain', 'error.settingsWrite');
      expect(await first).toEqual(uncertain); expect(await queued).toEqual(uncertain);
      const originalFailure = await first;
      if (!originalFailure.ok) { expect(Object.isFrozen(originalFailure.error)).toBe(true); expect(Reflect.set(originalFailure.error, 'effect', 'none')).toBe(false); }
      expect(await f.data.read()).toEqual(uncertain); expect(await f.preferences.update({ notifySuccess: false })).toEqual(uncertain);
      expect(f.preferences.persistenceStatus).toBe('uncertain'); expect(f.preferences.readErrorKey).toBe('error.settingsWrite');
      expect(f.preferences.recoveryKey).toBe('settings.recoveryUncertain');
      expect(f.preferences.current).toEqual(defaults); expect(f.events.publish).not.toHaveBeenCalled();
      expect(f.storage.save).toHaveBeenCalledOnce(); expect(f.errors.report.mock.calls).toEqual([['settings.write', 'settings.save']]);
      const actual = committed ? JSON.stringify({ schemaVersion: 1, preferences: savedGermanPreferences, opaque: { records: ['unchanged', null, false] } }) : original;
      expect(f.bytes()).toBe(actual);
      const recovered = runtime(f.bytes());
      try {
        await recovered.preferences.load(); expect(recovered.preferences.persistenceStatus).toBe('ready');
        expect(recovered.preferences.current.locale).toBe(committed ? 'de' : 'en'); expect(recovered.preferences.readErrorKey).toBeUndefined();
        expect(recovered.preferences.recoveryKey).toBeUndefined();
        expect(recovered.storage.save).not.toHaveBeenCalled(); expect(recovered.events.publish).not.toHaveBeenCalled(); expect(recovered.bytes()).toBe(actual);
        expect(recovered.errors.report).not.toHaveBeenCalled();
      } finally { recovered.dispose(); }
    } finally { release.resolve(); f.dispose(); }
  }
});

it('[RECOVERY-07-02] protected opaque collections remain unchanged through permitted preference writes and actual saved-byte reconstruction', async () => {
  const opaque = { schemaVersion: 200, collections: { bookmark: { records: [{ future: ['é', null, false, 0] }] } } };
  const original = JSON.stringify({ schemaVersion: 1, preferences: defaults, pluginEntities: opaque, consumer: { preserve: '  original  ' } }, null, 2);
  const f = runtime(original);
  const repository = new PluginDataRepository(bookmark, f.data, f.events, () => 'unused-id', () => '2026-09-24', f.errors);
  try {
    await f.preferences.load(); expect(f.preferences.persistenceStatus).toBe('ready'); expect(f.preferences.readonly).toBe(false);
    expect(await repository.create({ label: 'No schema repair' })).toEqual(failure('storage', 'error.pluginDataRead'));
    expect(f.storage.save).not.toHaveBeenCalled(); expect(f.bytes()).toBe(original);
    expect((await f.preferences.update({ locale: 'de' })).ok).toBe(true);
    const expected = JSON.stringify({ schemaVersion: 1, preferences: savedGermanPreferences, pluginEntities: opaque, consumer: { preserve: '  original  ' } });
    expect(f.bytes()).toBe(expected); expect(f.storage.save).toHaveBeenCalledOnce();
    expect(f.events.publish.mock.calls).toEqual([[{ type: 'preferences.changed', payload: { revision: 1 } }]]);
    expect(f.errors.report).not.toHaveBeenCalled();
    const reconstructed = runtime(f.bytes());
    const protectedRepository = new PluginDataRepository(bookmark, reconstructed.data, reconstructed.events, () => 'unused-id', () => '2026-09-24', reconstructed.errors);
    try {
      await reconstructed.preferences.load(); expect(reconstructed.preferences.current.locale).toBe('de');
      expect(await protectedRepository.list()).toEqual(failure('storage', 'error.pluginDataRead'));
      expect(reconstructed.bytes()).toBe(expected); expect(reconstructed.storage.save).not.toHaveBeenCalled();
      expect(reconstructed.events.publish).not.toHaveBeenCalled(); expect(reconstructed.errors.report).not.toHaveBeenCalled();
    } finally { protectedRepository.dispose(); reconstructed.dispose(); }
  } finally { repository.dispose(); f.dispose(); }
});
