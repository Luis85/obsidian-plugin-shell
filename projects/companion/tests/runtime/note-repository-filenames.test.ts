import { expect, it, vi } from 'vitest';
import { defineEntity, fields, defineDocument, defineNoteFeature, heading } from '../../src/features/api';
import { createNoteFeatures } from '../../src/application/note-feature';
import { DocumentCreationService } from '../../src/application/document-service';
import { success } from '../../src/domain/outcome';
import { markdownCodec } from '../../src/infrastructure/markdown';
import { TypedEventBus } from '../../src/infrastructure/events/typed-event-bus';
import type { ShellEvents } from '../../src/application/events';
import { browserDocumentStorage } from '../../harness/app/document-storage';
import { unwrapEntity as unwrap } from './entity-fixture';

const entity = defineEntity('verbatim', 1, { title: fields.text({ nonblank: true, min: 1, max: 252 }) });
const document = defineDocument(entity, {
  mappings: [{ field: 'title', property: 'title' }], title: value => value.title,
  body: value => `# ${heading(value.title)}\n\nAuthor body.\n`,
});
function fixture() {
  let files: Record<string, string> = {}; let sequence = 0;
  const save = vi.fn((next: Record<string, string>) => { files = next; });
  const storage = browserDocumentStorage(() => ({ ...files }), save, () => false);
  const errors = { report: vi.fn() }; const events = new TypedEventBus<ShellEvents>(errors);
  const newId = () => `verbatim-${++sequence}`; const now = () => '2026-09-23T12:00:00.000Z';
  const runtime = createNoteFeatures({ storage, codec: markdownCodec, events, errors, newId, now },
    register => ({ notes: register(defineNoteFeature({ document, defaultFolder: 'Notes' })) }));
  const direct = new DocumentCreationService({ verbatim: document }, storage, events, markdownCodec.render, newId, now, errors);
  return { repository: runtime.repositories.notes, direct, storage, save, files: () => files,
    dispose() { direct.dispose(); runtime.dispose(); events.dispose(); },
  };
}

it('supports verbatim leading spaces, NFD Unicode and long basenames through the complete author API', async () => {
  for (const title of ['  Leading space', 'Cafe\u0301 – Re\u0301sume\u0301', 'A'.repeat(200), 'B'.repeat(252)]) {
    const f = fixture(); const path = `Notes/${title}.md`;
    try {
      const prepared = unwrap(f.repository.prepare({ title }, 'create'));
      expect(prepared.path).toBe(path); expect(f.save).not.toHaveBeenCalled();
      const created = unwrap(await f.repository.commit(prepared));
      expect(created.path).toBe(path); expect(f.files()[path]).toBe(prepared.markdown);
      expect(unwrap(await f.repository.get(path)).values.title).toBe(title);
      expect(unwrap(await f.repository.list()).map(item => item.path)).toEqual([path]);
      const changed = unwrap(await f.repository.update(created, { title: 'Changed title' }));
      expect(changed.path).toBe(path); expect(changed.id).toBe(created.id);
      const updated = f.files()[path]; expect(updated).toContain('title: "Changed title"');
      expect(updated).toContain(`# ${heading(title)}\n\nAuthor body.`);
      expect((await f.repository.delete(changed)).ok).toBe(true);
      expect(f.files()[path]).toBeUndefined(); expect(f.files()[`.trash/${path}`]).toBe(updated);
      expect(unwrap(await f.repository.list())).toEqual([]); expect(f.save).toHaveBeenCalledTimes(3);
    } finally { f.dispose(); }
  }
});

it('lists and edits exact paths created by the document facade, including safe recursive folders', async () => {
  const f = fixture();
  try {
    const root = unwrap(f.direct.prepare('verbatim', { title: '  Leading space' }, 'Notes', 'root'));
    const nested = unwrap(f.direct.prepare('verbatim', { title: 'Cafe\u0301' }, 'Notes/Subfolder', 'nested'));
    unwrap(await f.direct.commit(root, 'Notes')); unwrap(await f.direct.commit(nested, 'Notes/Subfolder'));
    expect(unwrap(await f.repository.list()).map(item => item.path)).toEqual([root.path, nested.path]);
    const loaded = unwrap(await f.repository.get(root.path));
    const updated = unwrap(await f.repository.update(loaded, { title: 'Updated through repository' }));
    expect(updated.path).toBe(root.path); expect(updated.id).toBe(root.id);
    expect((await f.repository.delete(updated)).ok).toBe(true);
    expect(unwrap(await f.repository.list()).map(item => item.path)).toEqual([nested.path]);
  } finally { f.dispose(); }
});

it('keeps unsafe title and recursive-folder boundaries closed before persistence or reading external paths', async () => {
  const f = fixture();
  try {
    for (const title of ['A/B', 'A\\B', '.hidden', 'CON', 'Trailing ', 'Trailing.']) {
      expect(f.repository.prepare({ title }, 'prepare')).toMatchObject({ ok: false, error: { key: 'error.filename' } });
      expect(await f.repository.create({ title }, 'create')).toMatchObject({ ok: false, error: { key: 'error.filename' } });
    }
    const read = vi.spyOn(f.storage, 'read'); const list = vi.spyOn(f.storage, 'list');
    for (const path of ['Outside/file.md', 'Notes-extra/file.md', 'Notes/../file.md', 'Notes/.hidden/file.md', 'Notes//file.md',
      'Notes/Sub/CON.md', 'Notes/Sub/Trailing .md', 'Notes/Sub/file.txt', `Notes/${'a'.repeat(160)}/file.md`]) {
      list.mockResolvedValueOnce(success([path]));
      expect(await f.repository.list()).toMatchObject({ ok: false, error: { code: 'validation', key: 'error.folder' } });
    }
    expect(read).not.toHaveBeenCalled(); expect(f.save).not.toHaveBeenCalled(); expect(f.files()).toEqual({});
  } finally { f.dispose(); }
});
