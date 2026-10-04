// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { mountShowcase } from '../../src/bootstrap/mount-ui';
import type { useTaskRepository } from '../../src/presentation/composables/use-task-repository';
import { failure } from '../../src/domain/outcome';
import { click, componentFixture, field, input, settle } from './component-fixture';
import { deferred } from './helpers';
import { unwrap } from './repository-helpers';

type Editor = ReturnType<typeof useTaskRepository>;
const retained = vi.hoisted((): Editor[] => []);
vi.mock('../../src/presentation/composables/use-task-repository', async importOriginal => {
  const original = await importOriginal<typeof import('../../src/presentation/composables/use-task-repository')>();
  return { ...original, useTaskRepository() {
    const editor = original.useTaskRepository(); retained.push(editor); return editor;
  } };
});
afterEach(() => { retained.length = 0; vi.restoreAllMocks(); document.body.replaceChildren(); });

const path = 'Tasks/Original.md';
const originalBytes = '---\ntype: task\nid: retained-identity\nschema_version: 1\ncreated_at: "2026-09-22T00:00:00Z"\ntitle: Original\nstatus: todo\ntags: []\ncustom: [one, two]\n---\n\n# Private handwritten body\n';
const changedBytes = originalBytes.replace('title: Original', 'title: Changed').replace('custom: [one, two]', 'custom: [ one, two ]');
function frozenState(editor: Editor) {
  return JSON.stringify({ notes: editor.notes.value, selected: editor.selected.value, error: editor.error.value,
    busy: editor.busy.value, loaded: editor.loaded.value, confirming: editor.confirming.value,
    message: editor.message.value, draft: editor.draft });
}
async function fixture() {
  const f = await componentFixture(); f.files.set(path, originalBytes);
  await click(f.root, 'Documents');
  const editor = retained.at(-1); if (!editor) throw new Error('Actual Task editor was not captured');
  await click(f.root, 'Reload notes'); await click(f.root, 'Edit');
  await input(field(f.root, 'edit-title'), 'Changed'); editor.confirming.value = true;
  const sibling = document.createElement('div'); document.body.append(sibling);
  const closeSibling = mountShowcase(sibling, f.services); await settle(); await click(sibling, 'Documents');
  const siblingEditor = retained.at(-1); if (!siblingEditor || siblingEditor === editor) throw new Error('Missing live sibling');
  await click(sibling, 'Reload notes'); await input(field(sibling, 'title'), 'Independent private draft');
  const updated = vi.fn(); const deleted = vi.fn();
  f.services.events.on('documents.updated', updated); f.services.events.on('documents.deleted', deleted);
  const list = vi.spyOn(f.services.repositories.task, 'list');
  const update = vi.spyOn(f.services.repositories.task, 'update');
  const remove = vi.spyOn(f.services.repositories.task, 'delete');
  const persistReplace = f.storage.replace.bind(f.storage); const persistTrash = f.storage.trash.bind(f.storage);
  const replace = vi.spyOn(f.storage, 'replace'); const trash = vi.spyOn(f.storage, 'trash');
  return { ...f, editor, sibling, siblingEditor, list, update, remove, replace, trash, persistReplace, persistTrash, updated, deleted,
    dispose() { closeSibling(); sibling.remove(); f.dispose(); } };
}

it.each(['edit', 'reload', 'save', 'remove'] as const)(
  '[RETAINED-C01] disposed actual Task %s handle cannot change frozen state or acquire a repository operation', async action => {
    const f = await fixture();
    try {
      const selected = f.editor.selected.value; if (!selected) throw new Error('Missing original snapshot');
      f.editor.error.value = { code: 'storage', key: 'error.write', effect: 'none' };
      f.editor.message.value = 'repo.saved'; f.close(); await settle();
      const frozen = frozenState(f.editor); const revision = selected.revision;
      if (action === 'edit') f.editor.edit(selected);
      else await f.editor[action]();
      expect(frozenState(f.editor)).toBe(frozen); expect(f.editor.selected.value).toBe(selected);
      expect(f.editor.selected.value?.revision).toBe(revision);
      expect(f.list).not.toHaveBeenCalled(); expect(f.update).not.toHaveBeenCalled(); expect(f.remove).not.toHaveBeenCalled();
      expect(f.replace).not.toHaveBeenCalled(); expect(f.trash).not.toHaveBeenCalled(); expect([...f.files]).toEqual([[path, originalBytes]]);
      expect(f.updated).not.toHaveBeenCalled(); expect(f.deleted).not.toHaveBeenCalled(); expect(f.observe).not.toHaveBeenCalled();
      expect(field(f.sibling, 'title').value).toBe('Independent private draft');
      await f.siblingEditor.reload(); expect(f.siblingEditor.notes.value[0]?.id).toBe('retained-identity');
    } finally { f.dispose(); }
  },
);

it.each(['save', 'remove'] as const)(
  '[RETAINED-C62-PREFLIGHT] closing the actual Task owner during %s preflight cancels before persistence', async action => {
    const f = await fixture(); const entered = deferred(); const release = deferred();
    const read = f.storage.read.bind(f.storage);
    vi.spyOn(f.storage, 'read').mockImplementationOnce(async readPath => { entered.resolve(); await release.promise; return read(readPath); });
    try {
      const pending = f.editor[action](); await entered.promise;
      expect(f.replace).not.toHaveBeenCalled(); expect(f.trash).not.toHaveBeenCalled();
      f.close(); await settle(); const frozen = frozenState(f.editor); release.resolve(); await pending;
      expect(frozenState(f.editor)).toBe(frozen); expect(f.root.children).toHaveLength(0);
      expect(f.replace).not.toHaveBeenCalled(); expect(f.trash).not.toHaveBeenCalled();
      const call = action === 'save' ? f.update.mock.results[0] : f.remove.mock.results[0];
      expect(await call?.value).toEqual(failure('disposed', 'error.disposed'));
      expect([...f.files]).toEqual([[path, originalBytes]]); expect(f.updated).not.toHaveBeenCalled(); expect(f.deleted).not.toHaveBeenCalled();
      expect(f.observe).not.toHaveBeenCalled(); expect(field(f.sibling, 'title').value).toBe('Independent private draft');
      await f.siblingEditor.reload(); const row = f.siblingEditor.notes.value[0]; if (!row) throw new Error('Missing sibling row');
      f.siblingEditor.edit(row); f.siblingEditor.draft.title = 'Sibling'; await f.siblingEditor.save();
      expect(f.files.get(path)).toBe(changedBytes.replace('title: Changed', 'title: Sibling'));
      expect(f.siblingEditor.selected.value?.id).toBe('retained-identity');
    } finally { release.resolve(); f.dispose(); }
  },
);

it.each(['committed', 'failed', 'uncertain'] as const)(
  '[RETAINED-C62-WRITE] closing a Task owner after update starts preserves its %s result, exact bytes and sibling draft', async outcome => {
    const f = await fixture(); const entered = deferred(); const release = deferred();
    f.replace.mockImplementationOnce(async (...args) => {
      entered.resolve(); await release.promise;
      if (outcome === 'failed') return failure('storage', 'error.write');
      const written = await f.persistReplace(...args);
      if (outcome === 'uncertain') throw new Error('Private acknowledgement failure');
      return written;
    });
    try {
      const snapshot = f.editor.selected.value; if (!snapshot) throw new Error('Missing selected snapshot');
      const pending = f.editor.save(); await entered.promise;
      expect([...f.files]).toEqual([[path, originalBytes]]); expect(f.updated).not.toHaveBeenCalled();
      f.close(); await settle(); const frozen = frozenState(f.editor); release.resolve(); await pending;
      expect(frozenState(f.editor)).toBe(frozen); expect(f.editor.selected.value).toBe(snapshot);
      expect(f.root.children).toHaveLength(0); expect(f.replace).toHaveBeenCalledExactlyOnceWith(path, originalBytes, changedBytes);
      expect([...f.files]).toEqual([[path, outcome === 'failed' ? originalBytes : changedBytes]]);
      const result = await f.update.mock.results[0]?.value;
      if (outcome === 'committed') {
        if (!result?.ok) throw new Error('Confirmed write did not return its snapshot');
        expect(result).toMatchObject({ ok: true, value: { id: snapshot.id, path, values: { title: 'Changed' } } });
        expect(result.value.revision).toBeGreaterThan(snapshot.revision);
        expect(f.updated).toHaveBeenCalledExactlyOnceWith({ entity: 'task', id: snapshot.id, schemaVersion: 1, path });
      } else {
        expect(result).toEqual(failure(outcome === 'failed' ? 'storage' : 'uncertain', outcome === 'failed' ? 'error.write' : 'error.uncertain'));
        expect(f.updated).not.toHaveBeenCalled();
      }
      expect(f.observe.mock.calls.map(([entry]) => ({ code: entry.code, operation: entry.operation }))).toEqual(
        outcome === 'uncertain' ? [{ code: 'repository.write', operation: 'repository.mutate' }] : [],
      );
      await f.editor.save(); await f.editor.remove(); await f.editor.reload();
      expect(f.update).toHaveBeenCalledOnce(); expect(f.remove).not.toHaveBeenCalled(); expect(f.replace).toHaveBeenCalledOnce();
      expect(frozenState(f.editor)).toBe(frozen); expect(f.deleted).not.toHaveBeenCalled();
      expect(f.siblingEditor.notes.value[0]?.values.title).toBe('Original'); // Note projection requires explicit reload.
      await f.siblingEditor.reload();
      expect(f.siblingEditor.notes.value[0]?.values.title).toBe(outcome === 'failed' ? 'Original' : 'Changed');
      expect(field(f.sibling, 'title').value).toBe('Independent private draft');
      expect(f.services.notifications.current).toEqual([]); expect(f.services.debugging.exportJSON()).not.toContain('Private');
    } finally { release.resolve(); f.dispose(); }
  },
);

it.each(['committed', 'failed', 'uncertain'] as const)('[RETAINED-C62-DELETE] closing a Task owner after trash starts preserves its %s result without late UI updates', async outcome => {
  const f = await fixture(); const entered = deferred(); const release = deferred();
  f.trash.mockImplementationOnce(async (...args) => {
    entered.resolve(); await release.promise;
    if (outcome === 'failed') return failure('storage', 'error.write');
    const written = await f.persistTrash(...args);
    if (outcome === 'uncertain') throw new Error('Private trash acknowledgement failure');
    return written;
  });
  try {
    const pending = f.editor.remove(); await entered.promise; f.close(); await settle();
    const frozen = frozenState(f.editor); release.resolve(); await pending;
    expect(frozenState(f.editor)).toBe(frozen); expect(f.trash).toHaveBeenCalledExactlyOnceWith(path, originalBytes);
    expect([...f.files]).toEqual(outcome === 'failed' ? [[path, originalBytes]] : []);
    expect(await f.remove.mock.results[0]?.value).toEqual(outcome === 'committed' ? { ok: true, value: undefined }
      : failure(outcome === 'failed' ? 'storage' : 'uncertain', outcome === 'failed' ? 'error.write' : 'error.uncertain'));
    if (outcome === 'committed') expect(f.deleted).toHaveBeenCalledExactlyOnceWith({ entity: 'task', id: 'retained-identity', schemaVersion: 1, path });
    else expect(f.deleted).not.toHaveBeenCalled();
    expect(f.siblingEditor.notes.value).toHaveLength(1); await f.siblingEditor.reload();
    expect(f.siblingEditor.notes.value.map(note => note.id)).toEqual(outcome === 'failed' ? ['retained-identity'] : []);
    expect(field(f.sibling, 'title').value).toBe('Independent private draft');
    expect(f.observe.mock.calls.map(([entry]) => ({ code: entry.code, operation: entry.operation }))).toEqual(
      outcome === 'uncertain' ? [{ code: 'repository.write', operation: 'repository.mutate' }] : [],
    );
  } finally { release.resolve(); f.dispose(); }
});

it('[RETAINED-C66] disposed uncertain Task recovery cannot acquire another read or write', async () => {
  const f = await fixture();
  try {
    f.replace.mockResolvedValueOnce(failure('uncertain', 'error.uncertain')); await f.editor.save();
    expect(f.editor.error.value?.effect).toBe('uncertain'); const selected = f.editor.selected.value;
    await f.editor.save(); await f.editor.remove(); expect(f.update).toHaveBeenCalledOnce(); expect(f.remove).not.toHaveBeenCalled();
    expect(f.editor.selected.value).toBe(selected); expect([...f.files]).toEqual([[path, originalBytes]]);
    f.close(); await settle(); const frozen = frozenState(f.editor); const reads = f.list.mock.calls.length;
    await f.editor.reload(); expect(f.list).toHaveBeenCalledTimes(reads); expect(frozenState(f.editor)).toBe(frozen);
    const durable = unwrap(await f.services.repositories.task.get(path));
    expect(durable.id).toBe('retained-identity'); expect(durable.values.title).toBe('Original');
    expect(f.replace).toHaveBeenCalledOnce(); expect(f.updated).not.toHaveBeenCalled(); expect(f.observe).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});

it('[RETAINED-C66-REVIEW] a live Task editor explicitly reloads uncertain saved bytes before a deliberate new edit', async () => {
  const f = await fixture();
  f.replace.mockImplementationOnce(async (...args) => { await f.persistReplace(...args); return failure('uncertain', 'error.uncertain'); });
  try {
    const original = f.editor.selected.value; if (!original) throw new Error('Missing original snapshot');
    await f.editor.save(); expect(f.editor.error.value?.effect).toBe('uncertain');
    expect(f.files.get(path)).toBe(changedBytes); expect(f.updated).not.toHaveBeenCalled();
    expect(f.editor.selected.value).toBe(original); expect(f.editor.notes.value[0]?.values.title).toBe('Original');
    await f.editor.save(); expect(f.replace).toHaveBeenCalledOnce();
    await f.editor.reload(); expect(f.editor.error.value).toBeUndefined(); expect(f.editor.selected.value).toBeUndefined();
    const reviewed = f.editor.notes.value[0]; if (!reviewed) throw new Error('Missing reviewed row');
    expect(reviewed.id).toBe(original.id); expect(reviewed.path).toBe(original.path);
    expect(reviewed.revision).toBeGreaterThan(original.revision); expect(reviewed.values.title).toBe('Changed');
    f.editor.edit(reviewed); f.editor.draft.title = 'Deliberately reviewed'; await f.editor.save();
    expect(f.replace).toHaveBeenNthCalledWith(2, path, changedBytes, changedBytes.replace('title: Changed', 'title: Deliberately reviewed'));
    expect(f.editor.message.value).toBe('repo.saved'); expect(f.updated).toHaveBeenCalledOnce();
    expect(f.observe).not.toHaveBeenCalled(); expect(field(f.sibling, 'title').value).toBe('Independent private draft');
  } finally { f.dispose(); }
});

it('[RETAINED-C62-CONTEXT] changing the folder away and back invalidates a paused Task preflight without reviving old UI', async () => {
  const f = await fixture(); const entered = deferred(); const release = deferred();
  const read = f.storage.read.bind(f.storage);
  vi.spyOn(f.storage, 'read').mockImplementationOnce(async readPath => { entered.resolve(); await release.promise; return read(readPath); });
  try {
    const pending = f.editor.save(); await entered.promise;
    expect((await f.services.preferences.update({ taskFolder: 'Other' })).ok).toBe(true);
    expect((await f.services.preferences.update({ taskFolder: 'Tasks' })).ok).toBe(true);
    release.resolve(); await pending;
    expect(await f.update.mock.results[0]?.value).toEqual(failure('disposed', 'error.disposed'));
    expect(f.editor.notes.value).toEqual([]); expect(f.editor.selected.value).toBeUndefined(); expect(f.editor.loaded.value).toBe(false);
    expect(f.editor.busy.value).toBe(false); expect(f.editor.error.value).toBeUndefined(); expect(f.editor.message.value).toBe('');
    expect(f.replace).not.toHaveBeenCalled(); expect(f.trash).not.toHaveBeenCalled(); expect([...f.files]).toEqual([[path, originalBytes]]);
    expect(f.updated).not.toHaveBeenCalled(); expect(f.observe).not.toHaveBeenCalled();
    await f.siblingEditor.reload(); expect(f.siblingEditor.notes.value[0]?.values.title).toBe('Original');
    expect(field(f.sibling, 'title').value).toBe('Independent private draft');
  } finally { release.resolve(); f.dispose(); }
});
