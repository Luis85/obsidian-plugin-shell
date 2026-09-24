import { expect, it, vi } from 'vitest';
import { createServices } from '../../src/bootstrap/services';
import { createItemActions } from '../../src/features/items/actions';
import { defaults } from '../../src/domain/preferences';
import { failure } from '../../src/domain/outcome';
import { deferred, host } from './helpers';
import { memoryStorage } from './memory-storage';
import { repositoryFixture, unwrap } from './repository-helpers';

const createdAt = '2026-09-23T12:00:00.000Z';
const preferences = { hideObsidianViewHeader: false, locale: 'en', taskFolder: 'Tasks', notifySuccess: true };
const originalItem = { id: 'retained-item', revision: 4, createdAt, values: { label: 'Original' } };
const extensions = { consumer: { exact: ['kept', null, false, 0] } };
function envelope(records = [originalItem], revision = 4, prefs = preferences) {
  return { schemaVersion: 1, preferences: prefs, ...extensions,
    pluginEntities: { schemaVersion: 1, collections: { item: { schemaVersion: 1, revision, records } } } };
}

/** Only the storage/host boundary is controlled; actions, validation and the writer are production. */
async function persistedRuntime(initial: string | null, inaccessible = false) {
  let bytes = initial; let sequence = 0;
  const observe = vi.fn(); const memory = memoryStorage();
  const settings = {
    load: vi.fn(async (): Promise<unknown> => {
      if (inaccessible) throw new Error('Private read failure');
      return bytes === null ? null : JSON.parse(bytes);
    }),
    save: vi.fn(async (value: unknown) => { bytes = JSON.stringify(value); }),
  };
  const services = await createServices({ settings, documents: memory.storage, host: host(),
    local: { get: () => null, set: () => undefined }, observeError: observe,
    scheduler: { after(milliseconds, callback) { const timer = setTimeout(callback, milliseconds); return () => clearTimeout(timer); } },
    newId: () => `new-item-${++sequence}`, now: () => createdAt });
  const actions = createItemActions(services.repositories.items, services.modals, 'persistence-test', () => true);
  const facts: { type: string; payload: unknown; bytes: string | null }[] = [];
  const stops = (['plugin-data.created', 'plugin-data.updated', 'plugin-data.deleted', 'preferences.changed'] as const)
    .map(type => services.events.on(type, payload => { facts.push({ type, payload, bytes }); }));
  return { services, actions, settings, observe, facts, memory, bytes: () => bytes,
    dispose() { for (const stop of stops) stop(); services.dispose(); } };
}

it('[PERSIST-05-01] failed note mutations retain exact bytes and identity until deliberate fresh-snapshot recovery', async () => {
  const path = 'Tasks/Handwritten.md';
  const original = '---\ntype: task\nid: retained-note\nschema_version: 1\ncreated_at: "2026-09-23T12:00:00.000Z"\ntitle: Original\nstatus: todo\ntags: []\ncustom: retained\n---\n\n# Handwritten heading\n\nKeep *all* body bytes.\n';
  const unrelated = ['Tasks/Unrelated.md', '# Unrelated\r\n\r\nPreserve me.\r\n'] as const;
  for (const operation of ['update', 'delete'] as const) {
    const f = repositoryFixture(); f.files.set(path, original); f.files.set(...unrelated);
    const snapshot = unwrap(await f.tasks.get(path)); const facts = vi.fn();
    const stops = (['documents.created', 'documents.updated', 'documents.deleted'] as const).map(type => f.events.on(type, facts));
    try {
      const failed = failure('storage', 'error.write');
      if (operation === 'update') f.storage.replace.mockResolvedValueOnce(failed);
      else f.storage.trash.mockResolvedValueOnce(failed);
      const mutate = () => operation === 'update' ? f.tasks.update(snapshot, { title: 'Reconciled' }) : f.tasks.delete(snapshot);
      expect(await mutate()).toEqual(failed); expect(await mutate()).toEqual(failed);
      expect([...f.files]).toEqual([[path, original], unrelated]); expect([...f.trash]).toEqual([]);
      expect(facts).not.toHaveBeenCalled(); expect(f.errors.report).not.toHaveBeenCalled();
      expect(f.storage.replace).toHaveBeenCalledTimes(operation === 'update' ? 1 : 0);
      expect(f.storage.trash).toHaveBeenCalledTimes(operation === 'delete' ? 1 : 0);
      const independent = repositoryFixture(); for (const entry of f.files) independent.files.set(...entry);
      try {
        expect(unwrap(await independent.tasks.get(path))).toEqual(snapshot);
        expect(independent.storage.create).not.toHaveBeenCalled(); expect(independent.storage.replace).not.toHaveBeenCalled();
        expect(independent.storage.trash).not.toHaveBeenCalled(); expect(independent.errors.report).not.toHaveBeenCalled();
      } finally { independent.tasks.dispose(); independent.projects.dispose(); independent.events.dispose(); }
      const reviewed = unwrap(await f.tasks.get(path));
      expect(reviewed).toMatchObject({ id: snapshot.id, path, values: snapshot.values });
      if (operation === 'update') {
        const recovered = unwrap(await f.tasks.update(reviewed, { title: 'Reconciled' }));
        const expected = original.replace('title: Original', 'title: Reconciled');
        expect([...f.files]).toEqual([[path, expected], unrelated]);
        expect(recovered).toMatchObject({ id: snapshot.id, path, values: { title: 'Reconciled' } });
        expect(recovered.revision).toBeGreaterThan(reviewed.revision);
        expect(f.storage.replace).toHaveBeenNthCalledWith(2, path, original, expected);
      } else {
        expect(await f.tasks.delete(reviewed)).toEqual({ ok: true, value: undefined });
        expect([...f.files]).toEqual([unrelated]); expect([...f.trash]).toEqual([[path, original]]);
        expect(f.storage.trash).toHaveBeenNthCalledWith(2, path, original);
      }
      expect(facts).toHaveBeenCalledExactlyOnceWith({ entity: 'task', id: snapshot.id, schemaVersion: 1, path });
      expect(f.storage.create).not.toHaveBeenCalled(); expect(f.errors.report).not.toHaveBeenCalled();
      const restored = repositoryFixture(); for (const entry of f.files) restored.files.set(...entry);
      try {
        expect(unwrap(await restored.tasks.list()).map(row => ({ id: row.id, path: row.path, values: row.values })))
          .toEqual(operation === 'update' ? [{ id: snapshot.id, path, values: { title: 'Reconciled', status: 'todo', tags: [] } }] : []);
        expect(restored.storage.create).not.toHaveBeenCalled(); expect(restored.storage.replace).not.toHaveBeenCalled();
        expect(restored.storage.trash).not.toHaveBeenCalled(); expect(restored.errors.report).not.toHaveBeenCalled();
      } finally { restored.tasks.dispose(); restored.projects.dispose(); restored.events.dispose(); }
    } finally { for (const stop of stops) stop(); f.tasks.dispose(); f.projects.dispose(); f.events.dispose(); }
  }
});

it('[PERSIST-05-02] uncertain shared saves block queued writes and reconstruct the actual acknowledged-or-unacknowledged bytes', async () => {
  for (const committed of [false, true]) {
    const initial = JSON.stringify(envelope(), null, 2); const f = await persistedRuntime(initial);
    const started = deferred(); const release = deferred();
    try {
      const original = unwrap(await f.services.repositories.items.get(originalItem.id));
      const save = f.settings.save.getMockImplementation(); if (!save) throw new Error('Missing persistence boundary');
      f.settings.save.mockImplementationOnce(async value => {
        started.resolve(); await release.promise;
        if (committed) await save(value);
        throw new Error('Private storage failure with unknown effect');
      });
      const changing = f.actions.rename(original, 'Changed'); await started.promise;
      const queuedPreference = f.services.preferences.update({ locale: 'de' }); const queuedItem = f.actions.create('Must not persist');
      expect(f.settings.save).toHaveBeenCalledOnce(); expect(f.bytes()).toBe(initial); expect(f.facts).toEqual([]);
      release.resolve();
      expect(await changing).toMatchObject({ ok: false, error: { code: 'uncertain', effect: 'uncertain' } });
      for (const result of await Promise.all([queuedPreference, queuedItem, f.actions.rename(original, 'Blind retry')])) {
        expect(result).toMatchObject({ ok: false, error: { code: 'storage', effect: 'none' } });
      }
      const changed = { ...originalItem, revision: 5, values: { label: 'Changed' } };
      const candidate = envelope([changed], 5);
      expect(f.settings.save).toHaveBeenCalledExactlyOnceWith(candidate);
      expect(f.bytes()).toBe(committed ? JSON.stringify(candidate) : initial);
      expect(f.services.preferences.current).toEqual(preferences); expect(f.services.preferences.readonly).toBe(true);
      expect(f.facts).toEqual([]); expect(f.services.notifications.current).toEqual([]); expect(f.memory.files.size).toBe(0);
      expect(f.observe.mock.calls).toEqual([[{ sequence: 1, code: 'settings.write', operation: 'settings.save' }]]);
      const reconstructed = await persistedRuntime(f.bytes());
      try {
        const actual = unwrap(await reconstructed.services.repositories.items.get(originalItem.id));
        expect(actual).toEqual({ ...(committed ? changed : originalItem), entity: 'item', schemaVersion: 1, backend: 'plugin-data' });
        expect(reconstructed.settings.save).not.toHaveBeenCalled(); expect(reconstructed.facts).toEqual([]);
        expect(reconstructed.observe).not.toHaveBeenCalled();
        const recovered = unwrap(await reconstructed.actions.rename(actual, 'Reviewed outcome'));
        expect(recovered).toMatchObject({ id: originalItem.id, createdAt, revision: committed ? 6 : 5 });
        expect(reconstructed.bytes()).toBe(JSON.stringify(envelope([{ ...originalItem, revision: recovered.revision, values: { label: 'Reviewed outcome' } }], recovered.revision)));
        expect(reconstructed.settings.save).toHaveBeenCalledOnce(); expect(reconstructed.facts).toHaveLength(1);
        expect(reconstructed.observe).not.toHaveBeenCalled();
      } finally { reconstructed.dispose(); }
    } finally { release.resolve(); f.dispose(); }
  }
});

it('[PERSIST-07-01] corrupt and future root bytes survive real actions and independent bootstrap with zero writes', async () => {
  for (const original of ['{ "schemaVersion": 1, broken', JSON.stringify({ schemaVersion: 200, preferences, opaque: ['future'] }, null, 2),
    JSON.stringify({ schemaVersion: 1, preferences: { locale: 'en' }, opaque: 'keep' }, null, 2)]) {
    const f = await persistedRuntime(original);
    try {
      expect(f.services.preferences.readonly).toBe(true);
      expect(await f.services.repositories.items.list()).toMatchObject({ ok: false, error: { code: 'storage' } });
      expect(await f.actions.create('Cannot replace original')).toMatchObject({ ok: false, error: { code: 'storage' } });
      expect(await f.services.preferences.update({ locale: 'de' })).toMatchObject({ ok: false, error: { code: 'storage' } });
      expect(f.bytes()).toBe(original); expect(f.settings.save).not.toHaveBeenCalled(); expect(f.facts).toEqual([]);
      expect(f.services.notifications.current).toEqual([]);
      expect(f.observe.mock.calls).toEqual([[{ sequence: 1, code: 'settings.read', operation: 'settings.load' }]]);
      const reconstructed = await persistedRuntime(f.bytes());
      try {
        expect(reconstructed.services.preferences.readonly).toBe(true); expect(reconstructed.bytes()).toBe(original);
        expect(await reconstructed.actions.create('Still protected')).toMatchObject({ ok: false, error: { code: 'storage' } });
        expect(reconstructed.settings.save).not.toHaveBeenCalled(); expect(reconstructed.facts).toEqual([]);
        expect(reconstructed.observe.mock.calls).toEqual([[{ sequence: 1, code: 'settings.read', operation: 'settings.load' }]]);
      } finally { reconstructed.dispose(); }
    } finally { f.dispose(); }
  }
});

it('[PERSIST-07-02] opaque registry and collection schemas block item mutation while permitted preferences retain their data', async () => {
  for (const pluginEntities of [
    { schemaVersion: 200, collections: { item: { opaque: ['future'] } } },
    { schemaVersion: 1, collections: { item: { schemaVersion: 200, revision: 4, records: [originalItem] } } },
    { schemaVersion: 1, collections: { item: { schemaVersion: 1, revision: 4, records: [{ ...originalItem, values: { label: '' } }] } } },
  ]) {
    const root = { schemaVersion: 1, preferences, ...extensions, pluginEntities };
    const original = JSON.stringify(root, null, 2); const f = await persistedRuntime(original);
    try {
      expect(await f.services.repositories.items.list()).toMatchObject({ ok: false, error: { key: 'error.pluginDataRead' } });
      expect(await f.actions.create('Cannot repair')).toMatchObject({ ok: false, error: { key: 'error.pluginDataRead' } });
      expect(f.bytes()).toBe(original); expect(f.settings.save).not.toHaveBeenCalled(); expect(f.facts).toEqual([]);
      expect(unwrap(await f.services.preferences.update({ locale: 'de' })).locale).toBe('de');
      const expected = JSON.stringify({ ...root, preferences: { ...preferences, locale: 'de' } });
      expect(f.bytes()).toBe(expected); expect(f.settings.save).toHaveBeenCalledOnce();
      expect(f.facts).toEqual([{ type: 'preferences.changed', payload: { revision: 1 }, bytes: expected }]);
      expect(f.observe).not.toHaveBeenCalled();
      const reconstructed = await persistedRuntime(f.bytes());
      try {
        expect(reconstructed.services.preferences.current.locale).toBe('de'); expect(reconstructed.bytes()).toBe(expected);
        expect(await reconstructed.actions.create('Still cannot repair')).toMatchObject({ ok: false, error: { key: 'error.pluginDataRead' } });
        expect(reconstructed.settings.save).not.toHaveBeenCalled(); expect(reconstructed.observe).not.toHaveBeenCalled();
      } finally { reconstructed.dispose(); }
    } finally { f.dispose(); }
  }
});

it('[PERSIST-46-01] concurrent real actions publish only persisted envelopes with stable revisions and isolated runtime events', async () => {
  const initial = JSON.stringify(envelope()); const f = await persistedRuntime(initial); const isolated = await persistedRuntime(initial);
  const started = deferred(); const release = deferred();
  try {
    const old = unwrap(await f.services.repositories.items.get(originalItem.id));
    const save = f.settings.save.getMockImplementation(); if (!save) throw new Error('Missing persistence boundary');
    f.settings.save.mockImplementationOnce(async value => { started.resolve(); await release.promise; await save(value); });
    const rename = f.actions.rename(old, 'Updated'); await started.promise;
    const preference = f.services.preferences.update({ locale: 'de' }); const create = f.actions.create('Second');
    expect(f.settings.save).toHaveBeenCalledOnce(); expect(f.bytes()).toBe(initial); expect(f.facts).toEqual([]);
    release.resolve(); const updated = unwrap(await rename); unwrap(await preference); const added = unwrap(await create);
    const updatedRow = { ...originalItem, revision: 5, values: { label: 'Updated' } };
    const addedRow = { id: 'new-item-1', revision: 6, createdAt, values: { label: 'Second' } };
    const german = { ...preferences, locale: 'de' };
    const envelopes = [envelope([updatedRow], 5), envelope([updatedRow], 5, german), envelope([updatedRow, addedRow], 6, german)];
    expect(f.settings.save.mock.calls).toEqual(envelopes.map(value => [value]));
    expect(f.facts).toEqual([
      { type: 'plugin-data.updated', payload: { entity: 'item', id: originalItem.id, schemaVersion: 1, revision: 5 }, bytes: JSON.stringify(envelopes[0]) },
      { type: 'preferences.changed', payload: { revision: 1 }, bytes: JSON.stringify(envelopes[1]) },
      { type: 'plugin-data.created', payload: { entity: 'item', id: addedRow.id, schemaVersion: 1, revision: 6 }, bytes: JSON.stringify(envelopes[2]) },
    ]);
    expect(updated).toMatchObject(updatedRow); expect(added).toMatchObject(addedRow);
    expect(await f.actions.rename(old, 'Stale edit')).toMatchObject({ ok: false, error: { code: 'stale' } });
    expect(f.settings.save).toHaveBeenCalledTimes(3); expect(f.facts).toHaveLength(3);
    expect(isolated.facts).toEqual([]); expect(isolated.bytes()).toBe(initial);
    expect(unwrap(await isolated.services.repositories.items.get(originalItem.id))).toMatchObject(originalItem);
    expect(isolated.services.preferences.current).toEqual(defaults); expect(isolated.settings.save).not.toHaveBeenCalled();
    expect(f.observe).not.toHaveBeenCalled(); expect(isolated.observe).not.toHaveBeenCalled();
    const reconstructed = await persistedRuntime(f.bytes());
    try {
      expect(unwrap(await reconstructed.services.repositories.items.list())).toEqual([updated, added]);
      expect(reconstructed.services.preferences.current).toEqual(german);
      expect(reconstructed.settings.save).not.toHaveBeenCalled(); expect(reconstructed.facts).toEqual([]);
      expect(reconstructed.observe).not.toHaveBeenCalled();
    } finally { reconstructed.dispose(); }
  } finally { release.resolve(); f.dispose(); isolated.dispose(); }
});

it('[PERSIST-07-03] absent storage waits for explicit mutation while inaccessible existing bytes remain protected until readable', async () => {
  const absent = await persistedRuntime(null);
  try {
    expect(absent.bytes()).toBeNull(); expect(absent.services.preferences.readonly).toBe(false);
    expect(unwrap(await absent.services.repositories.items.list())).toEqual([]);
    expect(absent.settings.save).not.toHaveBeenCalled(); expect(absent.facts).toEqual([]);
    const item = unwrap(await absent.actions.create('Deliberate first item'));
    const expected = { schemaVersion: 1, preferences, pluginEntities: { schemaVersion: 1, collections: {
      item: { schemaVersion: 1, revision: 1, records: [{ id: 'new-item-1', revision: 1, createdAt, values: { label: 'Deliberate first item' } }] },
    } } };
    expect(item).toMatchObject({ id: 'new-item-1', revision: 1, createdAt });
    expect(absent.bytes()).toBe(JSON.stringify(expected)); expect(absent.settings.save).toHaveBeenCalledExactlyOnceWith(expected);
    expect(absent.observe).not.toHaveBeenCalled();
  } finally { absent.dispose(); }
  const original = JSON.stringify(envelope(), null, 2); const inaccessible = await persistedRuntime(original, true);
  try {
    expect(inaccessible.services.preferences.readonly).toBe(true);
    expect(await inaccessible.actions.create('Do not overwrite')).toMatchObject({ ok: false, error: { code: 'storage' } });
    expect(await inaccessible.services.preferences.update({ locale: 'de' })).toMatchObject({ ok: false, error: { code: 'storage' } });
    expect(inaccessible.bytes()).toBe(original); expect(inaccessible.settings.save).not.toHaveBeenCalled(); expect(inaccessible.facts).toEqual([]);
    expect(inaccessible.observe.mock.calls).toEqual([[{ sequence: 1, code: 'settings.read', operation: 'settings.load' }]]);
    const readable = await persistedRuntime(inaccessible.bytes());
    try {
      expect(readable.services.preferences.readonly).toBe(false);
      expect(unwrap(await readable.services.repositories.items.get(originalItem.id))).toMatchObject(originalItem);
      expect(readable.bytes()).toBe(original); expect(readable.settings.save).not.toHaveBeenCalled();
      expect(readable.observe).not.toHaveBeenCalled();
    } finally { readable.dispose(); }
  } finally { inaccessible.dispose(); }
});
