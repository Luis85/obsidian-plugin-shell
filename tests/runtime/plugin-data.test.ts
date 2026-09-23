import { describe, expect, it, vi } from 'vitest';
import { createNoteFeatures } from '../../src/application/note-feature';
import { PluginDataRepository } from '../../src/application/plugin-data-repository';
import { defineDocument, defineEntity, defineNoteFeature, definePluginDataFeature, fields } from '../../src/features/api';
import { markdownCodec } from '../../src/infrastructure/markdown';
import { repositoryFixture } from './repository-helpers';
import { bookmark, bookmarkFeature, pluginDataFixture, unwrap } from './plugin-data-helpers';
import { deferred } from './helpers';
import { defaults } from '../../src/domain/preferences';

describe('Explicit plugin-data entities', () => {
  it('persists typed CRUD, exact values and identity across runtime reload without Markdown', async () => {
    const f = pluginDataFixture(); const notices: unknown[] = [];
    for (const type of ['plugin-data.created', 'plugin-data.updated', 'plugin-data.deleted'] as const) f.events.on(type, event => { notices.push(event); });
    expect(unwrap(await f.repository.list())).toEqual([]); expect(f.storage.save).not.toHaveBeenCalled();
    const created = unwrap(await f.repository.create({ label: '  Reference ', tags: ['one'], due: '2026-09-24' }));
    expect(created).toMatchObject({ backend: 'plugin-data', entity: 'bookmark', revision: 1, values: { label: 'Reference', pinned: false, count: 0, tags: ['one'], due: '2026-09-24' } });
    expect(Object.isFrozen(created)).toBe(true); expect(Object.isFrozen(created.values.tags)).toBe(true);
    const changed = unwrap(await f.repository.update(created, { label: 'Updated', pinned: true, count: 3 }));
    expect(changed).toMatchObject({ id: created.id, createdAt: created.createdAt, revision: 2, values: { label: 'Updated', pinned: true, count: 3, tags: [] } });
    const restarted = pluginDataFixture(f.raw());
    expect(unwrap(await restarted.repository.get(created.id))).toEqual(changed);
    expect((await restarted.repository.get('missing')).ok).toBe(false);
    expect((await f.repository.delete(changed)).ok).toBe(true);
    expect(unwrap(await f.repository.list())).toEqual([]);
    expect(f.storage.save).toHaveBeenCalledTimes(3);
    expect(notices).toEqual([1, 2, 3].map(revision => ({ entity: 'bookmark', id: created.id, schemaVersion: 1, revision })));
  });
  it('serializes preference and entity changes on one envelope while preserving unknown extensions', async () => {
    const f = pluginDataFixture({ schemaVersion: 1, preferences: defaults, consumer: { untouched: ['custom'] } });
    const gate = deferred(); const started = deferred();
    f.storage.save.mockImplementationOnce(async () => { started.resolve(); await gate.promise; });
    const first = f.preferences.update({ locale: 'de' });
    const second = f.repository.create({ label: 'Concurrent' });
    const third = f.preferences.update({ taskFolder: 'Retained' });
    await started.promise; expect(f.storage.save).toHaveBeenCalledOnce(); gate.resolve();
    expect((await first).ok).toBe(true); expect((await second).ok).toBe(true); expect((await third).ok).toBe(true);
    expect(f.raw()).toMatchObject({ preferences: { locale: 'de', taskFolder: 'Retained' }, consumer: { untouched: ['custom'] }, pluginEntities: { collections: { bookmark: { records: [{ values: { label: 'Concurrent' } }] } } } });
    expect(f.storage.load).toHaveBeenCalledOnce(); expect(f.storage.save).toHaveBeenCalledTimes(3);
  });
  it('rejects stale, foreign and forged snapshots without writes or committed events', async () => {
    const f = pluginDataFixture();
    const first = unwrap(await f.repository.create({ label: 'First' }));
    const stale = unwrap(await f.repository.get(first.id));
    const next = unwrap(await f.repository.update(first, { label: 'Next' }));
    const event = vi.fn(); f.events.on('plugin-data.updated', event); f.events.on('plugin-data.deleted', event);
    for (const snapshot of [first, stale, { ...next }]) {
      expect(await f.repository.update(snapshot, { label: 'Rejected' })).toMatchObject({ ok: false, error: { code: 'stale' } });
      expect((await f.repository.delete(snapshot)).ok).toBe(false);
    }
    const other = new PluginDataRepository(bookmark, f.data, f.events, f.newId, f.now, f.errors);
    expect((await other.update(next, { label: 'Foreign' })).ok).toBe(false);
    expect(f.storage.save).toHaveBeenCalledTimes(2); expect(event).not.toHaveBeenCalled();
    expect((await f.repository.delete(next)).ok).toBe(true);
    expect((await f.repository.delete(next)).ok).toBe(false);
  });
  it('validates input before writing and snapshots mutable input before queued work', async () => {
    const f = pluginDataFixture();
    expect((await f.repository.create({ label: '' })).ok).toBe(false);
    const input = { label: 'Captured', tags: ['kept'] };
    const work = f.repository.create(input); input.label = 'Mutated'; input.tags.push('not kept');
    const created = unwrap(await work);
    expect(created.values).toMatchObject({ label: 'Captured', tags: ['kept'] });
    expect((await f.repository.update(created, { label: '' })).ok).toBe(false);
    expect(f.storage.save).toHaveBeenCalledOnce();
  });
  it('keeps revisions monotonic after deletion and rejects an older snapshot of a recreated ID', async () => {
    const f = pluginDataFixture();
    const repository = new PluginDataRepository(bookmark, f.data, f.events, () => 'reused-id', f.now, f.errors);
    const original = unwrap(await repository.create({ label: 'Original' }));
    expect((await repository.delete(original)).ok).toBe(true);
    const recreated = unwrap(await repository.create({ label: 'Recreated' }));
    expect(recreated.revision).toBe(3);
    expect(await repository.update(original, { label: 'Old snapshot' })).toMatchObject({ ok: false, error: { code: 'stale' } });
    expect((await repository.delete(original)).ok).toBe(false);
    expect(unwrap(await repository.get(original.id)).values.label).toBe('Recreated');
    expect(f.storage.save).toHaveBeenCalledTimes(3);
  });
  it('coordinates multiple entity repositories and forbids two canonical backends in one registry', async () => {
    const f = pluginDataFixture(); const notes = repositoryFixture();
    const shared = { pluginData: f.data, storage: notes.storage, codec: markdownCodec, events: f.events, errors: f.errors, newId: f.newId, now: f.now };
    const metricFeature = definePluginDataFeature({ backend: 'plugin-data', entity: defineEntity('constructor', 1, { amount: fields.number(), active: fields.boolean() }) });
    const features = createNoteFeatures(shared, register => ({ bookmarks: register(bookmarkFeature), metrics: register(metricFeature) }));
    expect(unwrap(await features.repositories.bookmarks.create({ label: 'Registered' })).values.label).toBe('Registered');
    expect(unwrap(await features.repositories.metrics.create({ amount: 0, active: false })).values).toEqual({ amount: 0, active: false });
    expect(unwrap(await features.repositories.bookmarks.list())).toHaveLength(1);
    expect(notes.storage.create).not.toHaveBeenCalled();
    features.dispose(); expect((await features.repositories.bookmarks.list()).ok).toBe(false);
    const note = defineNoteFeature({ defaultFolder: 'Bookmarks', document: defineDocument(bookmark, { mappings: [{ field: 'label', property: 'label' }], title: value => value.label, body: () => '' }) });
    expect(() => createNoteFeatures(shared, register => ({ data: register(bookmarkFeature), note: register(note) }))).toThrow('Duplicate document registration');
    expect(() => createNoteFeatures({ ...shared, pluginData: undefined }, register => ({ data: register(bookmarkFeature) }))).toThrow('Plugin-data storage is not configured');
    expect(() => Reflect.apply(definePluginDataFeature, undefined, [{ backend: 'unknown', entity: bookmark }])).toThrow('Invalid plugin-data backend');
  });
  it('contains synchronous and async subscribers without relabeling committed writes', async () => {
    const f = pluginDataFixture();
    f.events.on('plugin-data.created', () => { throw new Error('private'); });
    f.events.on('plugin-data.created', async () => { throw new Error('private async'); });
    expect((await f.repository.create({ label: 'Committed' })).ok).toBe(true);
    await Promise.resolve(); expect(f.errors.report).toHaveBeenCalledTimes(2);
    const events = { ...f.events, on: f.events.on.bind(f.events), publish: () => { throw new Error('sink'); } };
    const repo = new PluginDataRepository(bookmark, f.data, events, f.newId, f.now, f.errors);
    expect((await repo.create({ label: 'Also committed' })).ok).toBe(true);
    expect(f.errors.report).toHaveBeenCalledWith('plugin-data.listener', 'plugin-data.notify');
  });
  it('fails closed after an uncertain save, preserving actual stored outcome and preventing queued retries', async () => {
    const f = pluginDataFixture(); const event = vi.fn(); f.events.on('plugin-data.created', event);
    const persist = f.storage.save.getMockImplementation(); if (!persist) throw new Error('Missing storage implementation');
    f.storage.save.mockImplementationOnce(async value => { await persist(value); throw new Error('Already on disk, acknowledgment failed'); });
    const result = await f.repository.create({ label: 'Uncertain' });
    expect(result).toMatchObject({ ok: false, error: { code: 'uncertain', effect: 'uncertain' } });
    expect((await f.preferences.update({ locale: 'de' })).ok).toBe(false);
    expect((await f.repository.create({ label: 'No retry' })).ok).toBe(false);
    expect((await f.repository.list()).ok).toBe(false); expect(f.preferences.readonly).toBe(true);
    expect(f.storage.save).toHaveBeenCalledOnce(); expect(event).not.toHaveBeenCalled();
    expect(f.errors.report).toHaveBeenCalledExactlyOnceWith('settings.write', 'settings.save');
    const restarted = pluginDataFixture(f.raw()); expect(unwrap(await restarted.repository.list())).toMatchObject([{ values: { label: 'Uncertain' } }]);
  });
  it('rechecks disposal after pending load and suppresses events for a save committed after disposal', async () => {
    const f = pluginDataFixture(); const load = deferred<unknown>(); f.storage.load.mockReturnValueOnce(load.promise);
    const work = f.repository.create({ label: 'Pending load' }); f.repository.dispose(); load.resolve(null);
    expect(await work).toMatchObject({ ok: false, error: { code: 'disposed' } }); expect(f.storage.save).not.toHaveBeenCalled();
    const late = pluginDataFixture(); const gate = deferred(); const started = deferred();
    late.storage.save.mockImplementationOnce(async () => { started.resolve(); await gate.promise; });
    const event = vi.fn(); late.events.on('plugin-data.created', event);
    const saving = late.repository.create({ label: 'Saving' }); const queued = late.repository.create({ label: 'Queued' });
    await started.promise; late.repository.dispose(); gate.resolve();
    expect((await saving).ok).toBe(true); expect((await queued).ok).toBe(false); expect(event).not.toHaveBeenCalled();
    expect(late.storage.save).toHaveBeenCalledOnce(); late.data.dispose();
    expect(await late.data.read()).toMatchObject({ ok: false, error: { code: 'disposed' } });
  });
});
