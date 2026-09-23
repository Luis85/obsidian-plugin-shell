import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { PluginDataRepository } from '../../src/application/plugin-data-repository';
import { defaults } from '../../src/domain/preferences';
import { success } from '../../src/domain/outcome';
import { bookmark, pluginDataFixture, unwrap } from './plugin-data-helpers';
import { deferred } from './helpers';

const row = { id: 'existing', revision: 1, createdAt: '2026-09-23', values: { label: 'Existing' } };
const collection = { schemaVersion: 1, revision: 1, records: [row] };
function envelope(value: unknown) { return { schemaVersion: 1, preferences: defaults, pluginEntities: value }; }
function registry(value: unknown) { return envelope({ schemaVersion: 1, collections: { bookmark: value } }); }

describe('Plugin-data preservation and bounds', () => {
  it('preserves malformed and future root data without writes', async () => {
    const circular: Record<string, unknown> = {}; circular.circular = circular;
    const accessor = Object.defineProperty({}, 'value', { get: () => 'hidden getter', enumerable: true });
    const hidden = Object.defineProperty({}, 'toJSON', { value: () => ({ altered: true }) });
    const arrayJson = Object.defineProperty(['kept'], 'toJSON', { value: () => ['altered'] });
    const maskedHole = Object.assign(new Array(1), { extra: 'lost' });
    const arrayGetter = Object.defineProperty([1], '0', { get: () => 'getter', enumerable: true });
    const arrayHidden = Object.defineProperty([1], '0', { value: 'hidden', enumerable: false });
    class ArraySubclass extends Array<unknown> {}
    for (const raw of ['broken', [], { schemaVersion: 2, preferences: defaults }, { schemaVersion: 1, preferences: {} },
      { schemaVersion: 1, preferences: defaults, extension: undefined }, { schemaVersion: 1, preferences: defaults, extension: Infinity },
      { schemaVersion: 1, preferences: defaults, extension: new Date() }, { schemaVersion: 1, preferences: defaults, extension: circular },
      { schemaVersion: 1, preferences: defaults, extension: accessor }, { schemaVersion: 1, preferences: defaults, extension: hidden },
      { schemaVersion: 1, preferences: defaults, extension: new Array(2) },
      ...[arrayJson, maskedHole, arrayGetter, arrayHidden, new ArraySubclass(1), Object.assign([], { [Symbol('hidden')]: true })].map(extension => ({ schemaVersion: 1, preferences: defaults, extension })),
      { schemaVersion: 1, preferences: defaults, extension: 'x'.repeat(1_000_001) }]) {
      const f = pluginDataFixture(raw);
      expect((await f.repository.list()).ok).toBe(false); expect((await f.preferences.update({ locale: 'de' })).ok).toBe(false);
      expect(f.raw()).toBe(raw); expect(f.storage.save).not.toHaveBeenCalled();
      expect(f.errors.report).toHaveBeenCalledExactlyOnceWith('settings.read', 'settings.load');
    }
  });
  it('preserves unsupported registry/collection data and never reconstructs invalid entities', async () => {
    const malformed = [envelope('broken'), envelope({ schemaVersion: 2, collections: {} }), envelope({ schemaVersion: 1, collections: [] }), envelope({ schemaVersion: 1, collections: {}, future: true }),
      ...[null, 'broken', { ...collection, schemaVersion: 2 }, { ...collection, revision: -1 }, { ...collection, revision: 0.5 },
        { ...collection, future: true }, { ...collection, records: {} }, { ...collection, records: Array.from({ length: 1001 }, () => row) },
        { ...collection, records: [row, row] },
        ...[null, { ...row, future: true }, { ...row, id: '../bad' }, { ...row, revision: 0 }, { ...row, revision: 2 },
          { ...row, revision: 0.5 }, { ...row, createdAt: '' }, { ...row, createdAt: 4 }, { ...row, createdAt: 'x'.repeat(101) },
          { ...row, values: { label: 'Existing', unknown: true } }, { ...row, values: { label: '' } }].map(value => ({ ...collection, records: [value] }))].map(registry)];
    for (const raw of malformed) {
      const f = pluginDataFixture(raw);
      expect((await f.repository.list()).ok).toBe(false); expect((await f.repository.get('existing')).ok).toBe(false);
      expect((await f.repository.create({ label: 'Cannot overwrite' })).ok).toBe(false);
      expect(f.storage.save).not.toHaveBeenCalled(); expect(f.raw()).toBe(raw);
    }
  });
  it('preserves unknown collection versions verbatim during independent preference and entity writes', async () => {
    const foreign = { schemaVersion: 300, revision: 9, records: [{ opaque: ['future', null, false, 0] }] };
    const f = pluginDataFixture({ schemaVersion: 1, preferences: defaults, pluginEntities: { schemaVersion: 1, collections: { foreign } } });
    expect((await f.preferences.update({ locale: 'de' })).ok).toBe(true);
    expect((await f.repository.create({ label: 'Known' })).ok).toBe(true);
    expect(f.raw()).toMatchObject({ preferences: { locale: 'de' }, pluginEntities: { collections: { foreign } } });
  });
  it('preserves untouched records exactly while mutating another record in the same collection', async () => {
    const original = { ...row, values: { label: '  Keep original bytes  ', tags: ['duplicate', 'duplicate'] } };
    const f = pluginDataFixture(registry({ ...collection, records: [original] }));
    const before = unwrap(await f.repository.get(original.id));
    const created = unwrap(await f.repository.create({ label: 'Other' }));
    expect(f.raw()).toMatchObject({ pluginEntities: { collections: { bookmark: { records: [original, expect.anything()] } } } });
    const changed = unwrap(await f.repository.update(created, { label: 'Changed other' }));
    expect(f.raw()).toMatchObject({ pluginEntities: { collections: { bookmark: { records: [original, expect.anything()] } } } });
    expect((await f.repository.delete(changed)).ok).toBe(true);
    expect(f.raw()).toEqual(registry({ schemaVersion: 1, revision: 4, records: [original] }));
    expect(unwrap(await f.repository.get(original.id))).toEqual(before);
  });
  it('rejects ID collisions, invalid IDs/time, exhausted revisions and record capacity', async () => {
    const f = pluginDataFixture(registry(collection));
    for (const [id, now] of [['existing', '2026-09-23'], ['bad/id', '2026-09-23'], ['valid', ''], ['valid', 'x'.repeat(101)]]) {
      const repo = new PluginDataRepository(bookmark, f.data, f.events, () => id ?? '', () => now ?? '', f.errors);
      expect((await repo.create({ label: 'Rejected' })).ok).toBe(false);
    }
    expect(f.storage.save).not.toHaveBeenCalled();
    for (const records of [[], Array.from({ length: 1000 }, (_, i) => ({ ...row, id: `row-${i}` }))]) {
      const limited = pluginDataFixture(registry({ ...collection, revision: records.length ? 1 : Number.MAX_SAFE_INTEGER, records }));
      expect((await limited.repository.create({ label: 'Capacity' })).ok).toBe(false); expect(limited.storage.save).not.toHaveBeenCalled();
    }
  });
  it('preserves arbitrary entity values through CRUD, reload and independent preference transactions', async () => {
    await fc.assert(fc.asyncProperty(fc.record({ label: fc.string({ minLength: 1, maxLength: 80 }).filter(value => value.trim().length > 0), count: fc.integer({ min: 0, max: 1_000_000 }), pinned: fc.boolean(), tags: fc.uniqueArray(fc.string({ maxLength: 50 }), { maxLength: 8 }) }), async input => {
      const f = pluginDataFixture(); const values = { ...input, label: input.label.trim() };
      const created = unwrap(await f.repository.create(values));
      expect(unwrap(await f.repository.get(created.id)).values).toEqual(values);
      expect((await f.preferences.update({ notifySuccess: !values.pinned })).ok).toBe(true);
      const restarted = pluginDataFixture(f.raw()); expect(unwrap(await restarted.repository.get(created.id)).values).toEqual(values);
      const changed = unwrap(await f.repository.update(created, { ...values, count: values.count + 1 }));
      expect(unwrap(await f.repository.get(created.id)).values.count).toBe(values.count + 1);
      expect((await f.repository.delete(changed)).ok).toBe(true);
      expect(unwrap(await f.repository.list())).toEqual([]); expect(f.storage.save).toHaveBeenCalledTimes(4);
    }), { numRuns: 40, seed: 23092026 });
  });
  it('clones loaded storage and rejects invalid candidate envelopes before saving', async () => {
    const source = { schemaVersion: 1, preferences: defaults, extension: { value: 1 } };
    const f = pluginDataFixture(source); await f.data.load(); source.extension.value = 2;
    expect(f.data.current.extension).toEqual({ value: 1 }); expect(Object.isFrozen(f.data.current.extension)).toBe(true);
    const result = await f.data.transact(data => success({ data: { ...data, extension: 'x'.repeat(1_000_001) }, value: undefined }), () => true);
    expect(result).toMatchObject({ ok: false, error: { code: 'validation' } }); expect(f.storage.save).not.toHaveBeenCalled();
  });
  it('handles a failed load once, and disposal during a pending load leaves defaults untouched', async () => {
    const f = pluginDataFixture(); f.storage.load.mockRejectedValueOnce(new Error('Unreadable'));
    await f.data.load(); await f.data.load(); expect((await f.repository.list()).ok).toBe(false);
    expect(f.storage.load).toHaveBeenCalledOnce(); expect(f.storage.save).not.toHaveBeenCalled();
    const late = pluginDataFixture(); const gate = deferred<unknown>(); late.storage.load.mockReturnValueOnce(gate.promise);
    const reading = late.data.read(); late.data.dispose(); gate.resolve({ schemaVersion: 1, preferences: { ...defaults, locale: 'de' } });
    expect(await reading).toMatchObject({ ok: false, error: { code: 'disposed' } }); expect(late.data.current.preferences).toEqual(defaults);
    expect(late.data.readonly).toBe(true);
  });
  it('reports committed preference publication failures independently', async () => {
    const f = pluginDataFixture(); vi.spyOn(f.events, 'publish').mockImplementation(() => { throw new Error('Sink'); });
    expect((await f.preferences.update({ locale: 'de' })).ok).toBe(true);
    expect(f.preferences.current.locale).toBe('de'); expect(f.errors.report).toHaveBeenCalledExactlyOnceWith('settings.listener', 'settings.notify');
  });
  it('contains pre-persistence identifier failures and keeps the queue usable without retrying a save', async () => {
    const f = pluginDataFixture();
    const repository = new PluginDataRepository(bookmark, f.data, f.events, () => { throw new Error('Private ID generator detail'); }, f.now, f.errors);
    expect(await repository.create({ label: 'Rejected' })).toMatchObject({ ok: false, error: { code: 'unexpected', effect: 'none' } });
    expect(f.storage.save).not.toHaveBeenCalled(); expect(f.errors.report).toHaveBeenCalledExactlyOnceWith('plugin-data.prepare', 'plugin-data.change');
    expect((await f.repository.create({ label: 'Valid independent change' })).ok).toBe(true);
    expect(f.storage.save).toHaveBeenCalledOnce();
  });
});
