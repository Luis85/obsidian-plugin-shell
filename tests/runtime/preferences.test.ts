import { describe, it, expect, vi } from 'vitest';
import { PreferenceService } from '../../src/application/preference-service';
import { defaults } from '../../src/domain/preferences';
import { fixture, deferred } from './helpers';
describe('Serialized settings', () => {
  it('[PREF-I01] loads absent data without writing', async () => {
    const f = fixture(); const storage = { load: vi.fn(async () => null), save: vi.fn() };
    const service = new PreferenceService(storage, f.bus, f.errors); await service.load();
    expect(service.current).toEqual(defaults); expect(service.readonly).toBe(false); expect(storage.save).not.toHaveBeenCalled();
  });
  it('[PREF-I02] preserves corrupt and future schemas in read-only mode', async () => {
    for (const raw of ['corrupt', { schemaVersion: 2, preferences: defaults }, { schemaVersion: 1, preferences: {} }]) {
      const f = fixture(); const storage = { load: vi.fn(async () => raw), save: vi.fn() }; const service = new PreferenceService(storage, f.bus, f.errors);
      await service.load(); expect(service.readonly).toBe(true); expect((await service.update({ locale: 'de' })).ok).toBe(false); expect(storage.save).not.toHaveBeenCalled();
    }
  });
  it('[PREF-I03] serializes concurrent patches against the latest successful value', async () => {
    const f = fixture(); const barrier = deferred(); const writes: unknown[] = [];
    const service = new PreferenceService({ load: async () => null, save: async value => { writes.push(value); if (writes.length === 1) await barrier.promise; } }, f.bus, f.errors);
    const first = service.update({ locale: 'de' }); const second = service.update({ taskFolder: 'Projects/Tasks' });
    await Promise.resolve(); expect(writes).toHaveLength(1); expect(service.current.locale).toBe('en'); barrier.resolve();
    expect((await first).ok).toBe(true); expect((await second).ok).toBe(true);
    expect(service.current).toEqual({ ...defaults, locale: 'de', taskFolder: 'Projects/Tasks' });
    expect(writes[1]).toMatchObject({ preferences: service.current });
  });
  it('[PREF-I04] failed save retains values and later valid save recovers', async () => {
    const f = fixture(); const save = vi.fn().mockRejectedValueOnce(new Error('write')).mockResolvedValue(undefined);
    const service = new PreferenceService({ load: async () => null, save }, f.bus, f.errors); const event = vi.fn(); f.bus.on('preferences.changed', event);
    expect((await service.update({ locale: 'de' })).ok).toBe(false); expect(service.current).toEqual(defaults); expect(event).not.toHaveBeenCalled();
    expect((await service.update({ taskFolder: 'Work' })).ok).toBe(true); expect(service.current.locale).toBe('en'); expect(event).toHaveBeenCalledTimes(1);
  });
  it('[PREF-I05] invalid patches and disposed service never save', async () => {
    const f = fixture(); const save = vi.fn(); const service = new PreferenceService({ load: async () => null, save }, f.bus, f.errors);
    expect((await service.update({ taskFolder: '../no' })).ok).toBe(false); service.dispose(); expect((await service.update({ locale: 'de' })).ok).toBe(false); expect(save).not.toHaveBeenCalled();
  });
});
