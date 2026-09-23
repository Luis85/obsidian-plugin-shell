import { describe, it, expect, vi } from 'vitest';
import { failure, success } from '../../src/domain/outcome';
import { markdownCodec } from '../../src/infrastructure/markdown';
import { repositoryFixture, unwrap } from './repository-helpers';
import { deferred } from './helpers';

describe('Canonical Markdown repositories', () => {
  it('[REPO-03-01] Task and Project use the same CRUD implementation and preserve falsy values', async () => {
    const f = repositoryFixture();
    const task = unwrap(await f.tasks.create({ title: 'Task', due: '2026-09-30' }, 'task'));
    const project = unwrap(await f.projects.create({ name: 'Project', budget: 0, archived: false }, 'project'));
    expect(task.values).toEqual({ title: 'Task', status: 'todo', due: '2026-09-30', tags: [] });
    expect(project.values).toEqual({ name: 'Project', budget: 0, archived: false });
    expect(unwrap(await f.tasks.list())).toHaveLength(1);
    expect(unwrap(await f.projects.list())).toHaveLength(1);
    const updated = unwrap(await f.projects.update(project, { name: 'Renamed', budget: 12, archived: true }));
    expect(updated.path).toBe(project.path); expect(updated.id).toBe(project.id);
    expect(unwrap(await f.projects.get(project.path)).values).toEqual({ name: 'Renamed', budget: 12, archived: true });
    expect((await f.projects.delete(updated)).ok).toBe(true); expect(f.trash.has(project.path)).toBe(true);
    expect(unwrap(await f.projects.list())).toEqual([]); expect(f.files.has(task.path)).toBe(true);
  });
  it('[REPO-03-02] preview is read-only, commit preserves bytes and replay emits one creation', async () => {
    const f = repositoryFixture(); const listener = vi.fn(); f.events.on('documents.created', listener);
    const plan = unwrap(f.tasks.prepare({ title: 'Task' }, 'request'));
    expect(f.storage.list).not.toHaveBeenCalled(); expect(f.storage.create).not.toHaveBeenCalled();
    const [first, second] = await Promise.all([f.tasks.commit(plan), f.tasks.commit(plan)]);
    expect(first).toEqual(second); expect(f.files.get(plan.path)).toBe(plan.markdown);
    expect(f.storage.create).toHaveBeenCalledTimes(1); expect(listener).toHaveBeenCalledTimes(1);
    expect(f.tasks.discard(plan)).toBe(false);
    const cancelled = unwrap(f.tasks.prepare({ title: 'Cancelled' }, 'cancel'));
    expect(f.tasks.discard(cancelled)).toBe(true); expect((await f.tasks.commit(cancelled)).ok).toBe(false);
  });
  it('[REPO-03-03] reads schema-one notes without rewriting and preserves user-owned content on update', async () => {
    const f = repositoryFixture();
    const old = '---\ntype: task\nid: legacy-001\nschema_version: 1\ncreated_at: "2026-09-22T00:00:00Z"\ntitle: Old\nstatus: todo\ntags: []\ncustom: [one, two]\n---\n\n# User heading\n\nKeep *my body*.\n';
    f.files.set('Tasks/old.md', old);
    const snapshot = unwrap(await f.tasks.get('Tasks/old.md'));
    expect(f.storage.replace).not.toHaveBeenCalled(); expect(f.files.get(snapshot.path)).toBe(old);
    const changed = unwrap(await f.tasks.update(snapshot, { title: 'New', status: 'done', tags: ['work'] }));
    const text = f.files.get(snapshot.path) ?? '';
    expect(unwrap(markdownCodec.read(text))?.body).toBe('\n# User heading\n\nKeep *my body*.\n');
    expect(unwrap(markdownCodec.read(text))?.properties).toMatchObject({ id: 'legacy-001', created_at: '2026-09-22T00:00:00Z', custom: ['one', 'two'] });
    expect(changed.path).toBe(snapshot.path); expect(changed.revision).not.toBe(snapshot.revision);
    expect(Object.isFrozen(changed)).toBe(true); expect(Object.isFrozen(changed.values.tags)).toBe(true);
  });
  it('[REPO-03-04] independent stale snapshots and manual edits cannot overwrite canonical bytes', async () => {
    const f = repositoryFixture(); const first = unwrap(await f.tasks.create({ title: 'Task' }, 'r'));
    const second = unwrap(await f.tasks.get(first.path));
    const changed = unwrap(await f.tasks.update(first, { title: 'First change' }));
    expect(await f.tasks.update(second, { title: 'Lost change' })).toMatchObject({ ok: false, error: { code: 'stale' } });
    f.files.set(changed.path, (f.files.get(changed.path) ?? '') + '\nManual edit\n');
    expect(await f.tasks.delete(changed)).toMatchObject({ ok: false, error: { code: 'stale' } });
    expect(f.storage.trash).not.toHaveBeenCalled(); expect(f.storage.replace).toHaveBeenCalledTimes(1);
  });
  it('[REPO-03-05] concurrent same-snapshot updates coalesce; mismatched retries fail', async () => {
    const f = repositoryFixture(); const snapshot = unwrap(await f.tasks.create({ title: 'Task' }, 'r'));
    const barrier = deferred(); const original = f.storage.replace.getMockImplementation();
    f.storage.replace.mockImplementation(async (...args) => { await barrier.promise; return original ? original(...args) : failure('storage', 'error.write'); });
    const a = f.tasks.update(snapshot, { title: 'Next' }); const b = f.tasks.update(snapshot, { title: 'Next' });
    expect(await f.tasks.update(snapshot, { title: 'Other' })).toMatchObject({ ok: false, error: { code: 'stale' } });
    barrier.resolve(); expect(await a).toEqual(await b); expect(f.storage.replace).toHaveBeenCalledTimes(1);
  });
  it('[REPO-03-06] uncertain update/delete are retained without retry or success events', async () => {
    const f = repositoryFixture(); const update = vi.fn(); const remove = vi.fn();
    f.events.on('documents.updated', update); f.events.on('documents.deleted', remove);
    const a = unwrap(await f.tasks.create({ title: 'A' }, 'a')); const b = unwrap(await f.tasks.create({ title: 'B' }, 'b'));
    f.storage.replace.mockRejectedValue(new Error('private')); f.storage.trash.mockResolvedValue(failure('uncertain', 'error.uncertain'));
    expect(await f.tasks.update(a, { title: 'Changed' })).toMatchObject({ ok: false, error: { effect: 'uncertain' } });
    await f.tasks.update(a, { title: 'Changed' }); expect(f.storage.replace).toHaveBeenCalledTimes(1);
    expect(await f.tasks.delete(b)).toMatchObject({ ok: false, error: { effect: 'uncertain' } });
    await f.tasks.delete(b); expect(f.storage.trash).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
    expect(f.errors.report).toHaveBeenCalledExactlyOnceWith('repository.write', 'repository.mutate');
  });
  it('[REPO-03-07] duplicate IDs, future schemas, malformed and missing persisted fields fail closed', async () => {
    const f = repositoryFixture(); const snapshot = unwrap(await f.tasks.create({ title: 'Task' }, 'r'));
    const original = f.files.get(snapshot.path) ?? '';
    f.files.set('Tasks/duplicate.md', original);
    expect(await f.tasks.list()).toMatchObject({ ok: false, error: { key: 'error.duplicateIdentity' } });
    expect((await f.tasks.delete(snapshot)).ok).toBe(false); f.files.delete('Tasks/duplicate.md');
    for (const unsafe of [original.replace('schema_version: 1', 'schema_version: 2'), original.replace('status: "todo"\n', ''), original.replace('title: "Task"', 'title: [broken')]) {
      f.files.set(snapshot.path, unsafe); expect((await f.tasks.list()).ok).toBe(false); expect(f.files.get(snapshot.path)).toBe(unsafe);
    }
    expect(f.storage.replace).not.toHaveBeenCalled(); expect(f.storage.trash).not.toHaveBeenCalled();
  });
  it('[REPO-03-08] rejects foreign, forged and out-of-scope snapshots, and stale configuration', async () => {
    const f = repositoryFixture(); const snapshot = unwrap(await f.tasks.create({ title: 'Task' }, 'r'));
    expect((await f.tasks.update({ ...snapshot }, { title: 'Forged' })).ok).toBe(false);
    const plan = unwrap(f.tasks.prepare({ title: 'New' }, 'new')); f.folder('NewFolder');
    expect((await f.tasks.commit(plan)).ok).toBe(false); expect((await f.tasks.delete(snapshot)).ok).toBe(false);
    expect(unwrap(await f.tasks.list())).toEqual([]); f.folder('../unsafe'); expect((await f.tasks.list()).ok).toBe(false);
    f.folder('Tasks'); f.storage.list.mockResolvedValue(success(['Elsewhere/note.md']));
    expect((await f.tasks.list()).ok).toBe(false);
  });
  it('[REPO-03-09] committed events are minimal and subscriber failures do not undo writes', async () => {
    const f = repositoryFixture(); const updated = vi.fn(); const deleted = vi.fn();
    f.events.on('documents.updated', updated); f.events.on('documents.deleted', deleted);
    f.events.on('documents.updated', () => { throw new Error('listener'); });
    const snapshot = unwrap(await f.tasks.create({ title: 'Secret title' }, 'r'));
    const changed = unwrap(await f.tasks.update(snapshot, { title: 'Private' }));
    expect(updated).toHaveBeenCalledExactlyOnceWith({ entity: 'task', id: snapshot.id, schemaVersion: 1, path: snapshot.path });
    expect((await f.tasks.delete(changed)).ok).toBe(true); expect(deleted).toHaveBeenCalledTimes(1);
    expect(f.errors.report).toHaveBeenCalledExactlyOnceWith('event.listener', 'event.dispatch');
  });
  it('[REPO-03-10] ordinary and other-entity notes are excluded; read failures remain failures', async () => {
    const f = repositoryFixture(); f.files.set('Tasks/ordinary.md', '# Ordinary');
    f.files.set('Tasks/unrelated.md', '---\ntype: other\n---\n');
    expect(unwrap(await f.tasks.list())).toEqual([]); expect((await f.tasks.get('Tasks/missing.md')).ok).toBe(false);
    f.storage.read.mockRejectedValue(new Error('private path'));
    expect(await f.tasks.list()).toMatchObject({ ok: false, error: { code: 'storage' } });
    expect(f.errors.report).toHaveBeenCalledExactlyOnceWith('repository.read', 'repository.list');
  });
  it('[REPO-03-11] disposal blocks new writes and bounded scanning reports oversized folders', async () => {
    const f = repositoryFixture(); const snapshot = unwrap(await f.tasks.create({ title: 'Task' }, 'r'));
    f.storage.list.mockResolvedValue(success(Array.from({ length: 1001 }, (_, i) => `Tasks/${i}.md`)));
    expect(await f.tasks.list()).toMatchObject({ ok: false, error: { key: 'error.repositoryLimit' } });
    f.tasks.dispose(); expect((await f.tasks.list()).ok).toBe(false); expect((await f.tasks.delete(snapshot)).ok).toBe(false);
    expect(f.tasks.prepare({ title: 'New' }, 'new').ok).toBe(false);
  });
});
