import { expect, it, vi } from 'vitest';
import { createActionScope, defineDocument, defineEntity, fields, type Result } from '../../src/features/api';
import { NoteRepository } from '../../src/application/note-repository';
import { markdownCodec } from '../../src/infrastructure/markdown';
import { entityFixture, unwrapEntity } from './entity-fixture';

const entity = defineEntity('experiment', 1, {
  caption: fields.text({ min: 1, max: 60 }), approved: fields.boolean(), score: fields.number({ min: 0 }),
});
const recipe = defineDocument(entity, {
  mappings: [{ field: 'caption', property: 'caption' }, { field: 'approved', property: 'approved' }, { field: 'score', property: 'score' }],
  title: value => value.caption, body: () => '# Immutable body\n',
});
const values = { caption: 'Seed', approved: false, score: 0 };
const changed = { caption: 'Changed', approved: true, score: 7 };
const originalBytes = '---\ntype: "experiment"\nid: "framework-seed"\nschema_version: 1\ncreated_at: "2026-09-24T12:00:00.000Z"\ncaption: "Seed"\napproved: false\nscore: 0\n---\n\n# Immutable body\n';
const changedBytes = originalBytes.replace('caption: "Seed"', 'caption: "Changed"').replace('approved: false', 'approved: true').replace('score: 0', 'score: 7');
const disposed = { ok: false, error: { code: 'disposed', key: 'error.disposed', effect: 'none' } };
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
async function fixture() {
  const f = entityFixture();
  const repository = new NoteRepository(recipe, f.storage, markdownCodec, f.events, () => 'Experiments',
    () => 'framework-seed', () => '2026-09-24T12:00:00.000Z', f.errors);
  const note = unwrapEntity(await repository.create(values, 'original'));
  expect(f.files.get(note.path)).toBe(originalBytes);
  const updated = vi.fn(); const deleted = vi.fn();
  f.events.on('documents.updated', updated); f.events.on('documents.deleted', deleted);
  const persist = f.storage.replace.bind(f.storage);
  const replace = vi.spyOn(f.storage, 'replace'); const trash = vi.spyOn(f.storage, 'trash');
  const list = vi.spyOn(f.storage, 'list');
  return { ...f, repository, note, updated, deleted, persist, replace, trash, list,
    dispose() { repository.dispose(); f.events.dispose(); } };
}

it('[FRAMEWORK-NOTE-01] independent feature permits prevent disposed owners replaying cached update and delete results', async () => {
  const f = await fixture(); const owner = createActionScope(); const sibling = createActionScope();
  try {
    const permit = owner.capture(); const saved = unwrapEntity(await f.repository.update(f.note, changed, permit));
    expect(f.files.get(f.note.path)).toBe(changedBytes); expect(saved.id).toBe(f.note.id); expect(saved.path).toBe(f.note.path);
    expect(saved.revision).toBeGreaterThan(f.note.revision); owner.dispose(); const reads = f.list.mock.calls.length;
    expect(await f.repository.update(f.note, changed, permit)).toEqual(disposed);
    expect(f.list).toHaveBeenCalledTimes(reads); expect(f.replace).toHaveBeenCalledExactlyOnceWith(f.note.path, originalBytes, changedBytes);
    const siblingPermit = sibling.capture(); expect(await f.repository.delete(saved, siblingPermit)).toEqual({ ok: true, value: undefined });
    sibling.dispose(); const deleteReads = f.list.mock.calls.length;
    expect(await f.repository.delete(saved, siblingPermit)).toEqual(disposed); expect(f.list).toHaveBeenCalledTimes(deleteReads);
    expect(f.trash).toHaveBeenCalledExactlyOnceWith(saved.path, changedBytes); expect([...f.files]).toEqual([]);
    expect(f.updated).toHaveBeenCalledOnce(); expect(f.deleted).toHaveBeenCalledOnce(); expect(f.errors.report).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});

it.each(['update', 'delete'] as const)('[FRAMEWORK-NOTE-02] independent feature %s rechecks the captured owner after awaited preflight', async operation => {
  const f = await fixture(); const owner = createActionScope(); const entered = gate(); const release = gate();
  const read = f.storage.read.bind(f.storage);
  vi.spyOn(f.storage, 'read').mockImplementationOnce(async path => { entered.release(); await release.promise; return read(path); });
  try {
    const permit = owner.capture();
    const pending = operation === 'update' ? f.repository.update(f.note, changed, permit) : f.repository.delete(f.note, permit);
    await entered.promise; owner.invalidate(); release.release(); expect(await pending).toEqual(disposed);
    expect(owner.active()).toBe(true); expect(f.replace).not.toHaveBeenCalled(); expect(f.trash).not.toHaveBeenCalled();
    expect(f.files.get(f.note.path)).toBe(originalBytes); expect(f.updated).not.toHaveBeenCalled(); expect(f.deleted).not.toHaveBeenCalled();
    const reviewed = unwrapEntity(await f.repository.get(f.note.path));
    const saved = unwrapEntity(await f.repository.update(reviewed, changed, owner.capture()));
    expect(saved.id).toBe(f.note.id); expect(f.files.get(f.note.path)).toBe(changedBytes); expect(f.errors.report).not.toHaveBeenCalled();
  } finally { release.release(); f.dispose(); }
});

it('[FRAMEWORK-NOTE-03] queued closed-owner work acquires no preflight while started persistence keeps its committed result', async () => {
  const f = await fixture(); const writingOwner = createActionScope(); const queuedOwner = createActionScope();
  const entered = gate(); const release = gate();
  const independent = unwrapEntity(await f.repository.get(f.note.path));
  f.replace.mockImplementationOnce(async (...args) => { entered.release(); await release.promise; return f.persist(...args); });
  try {
    const writing = f.repository.update(f.note, changed, writingOwner.capture()); await entered.promise;
    const queued = f.repository.update(independent, { ...values, caption: 'Queued' }, queuedOwner.capture());
    const reads = f.list.mock.calls.length; writingOwner.dispose(); queuedOwner.dispose(); release.release();
    const saved = unwrapEntity(await writing); expect(await queued).toEqual(disposed);
    expect(saved.values).toEqual(changed); expect(f.list).toHaveBeenCalledTimes(reads);
    expect(f.files.get(f.note.path)).toBe(changedBytes); expect(f.replace).toHaveBeenCalledExactlyOnceWith(f.note.path, originalBytes, changedBytes);
    expect(f.updated).toHaveBeenCalledExactlyOnceWith({ entity: 'experiment', id: f.note.id, schemaVersion: 1, path: f.note.path });
    expect(f.deleted).not.toHaveBeenCalled(); expect(f.errors.report).not.toHaveBeenCalled();
  } finally { release.release(); f.dispose(); }
});

it.each(['failed', 'uncertain'] as const)('[FRAMEWORK-NOTE-04] independent feature preserves %s outcomes after its owner closes during persistence', async outcome => {
  const f = await fixture(); const owner = createActionScope(); const entered = gate(); const release = gate();
  const failed: Result<void> = { ok: false, error: { code: 'storage', key: 'error.write', effect: 'none' } };
  f.replace.mockImplementationOnce(async (...args) => {
    entered.release(); await release.promise;
    if (outcome === 'failed') return failed;
    await f.persist(...args); throw new Error('Private lost acknowledgement');
  });
  try {
    const permit = owner.capture(); const writing = f.repository.update(f.note, changed, permit);
    await entered.promise; owner.dispose(); release.release();
    expect(await writing).toEqual(outcome === 'failed' ? failed : { ok: false, error: { code: 'uncertain', key: 'error.uncertain', effect: 'uncertain' } });
    expect(f.files.get(f.note.path)).toBe(outcome === 'failed' ? originalBytes : changedBytes);
    expect(await f.repository.update(f.note, changed, permit)).toEqual(disposed); expect(f.replace).toHaveBeenCalledOnce();
    expect(f.updated).not.toHaveBeenCalled(); expect(f.deleted).not.toHaveBeenCalled();
    expect(f.errors.report.mock.calls).toEqual(outcome === 'uncertain' ? [['repository.write', 'repository.mutate']] : []);
  } finally { release.release(); f.dispose(); }
});
