import { expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { validateDocumentTitle } from '../../src/domain/paths';
import { success } from '../../src/domain/outcome';
import { DocumentCreationService } from '../../src/application/document-service';
import { renderMarkdown } from '../../src/infrastructure/markdown';
import { entityFixture, unwrapEntity } from './entity-fixture';

function fixture() {
  const f = entityFixture(); let nextId = 0;
  const service = new DocumentCreationService<{ note: { title: string } }>({ note: {
    project: value => success({ title: value.title, properties: { title: value.title }, body: `# ${value.title}\n` }),
  } }, f.storage, f.events, renderMarkdown, () => `note-${++nextId}`, () => '2026-09-23T12:00:00.000Z', f.errors);
  return { ...f, service };
}

it('preserves exact Title Case, spaces and Unicode in preview, write and receipt; IDs stay in frontmatter', async () => {
  const f = fixture();
  for (const title of ['Title Case – Übersicht für Ärztinnen', '日本語 😀', '  Leading space', 'Cafe\u0301']) {
    const plan = unwrapEntity(f.service.prepare('note', { title }, 'Notes', `request-${f.files.size}`));
    expect(plan.path).toBe(`Notes/${title}.md`); expect(f.files.has(plan.path)).toBe(false);
    const receipt = unwrapEntity(await f.service.commit(plan, 'Notes'));
    expect(receipt.path).toBe(plan.path); expect(f.files.get(plan.path)).toBe(plan.markdown);
    const properties: unknown = parse(plan.markdown.split('---')[1] ?? '');
    expect(properties).toMatchObject({ id: plan.id, title }); expect(receipt.id).toBe(plan.id);
  }
  expect(f.create).toHaveBeenCalledTimes(4); f.service.dispose(); f.events.dispose();
});

it('conflicts on an existing exact title without suffixing, overwriting or publishing success', async () => {
  const f = fixture(); const created = vi.fn(); f.events.on('documents.created', created);
  const first = unwrapEntity(f.service.prepare('note', { title: 'Same Title' }, 'Notes', 'first'));
  unwrapEntity(await f.service.commit(first, 'Notes'));
  const repeated = unwrapEntity(f.service.prepare('note', { title: 'Same Title' }, 'Notes', 'second'));
  expect(repeated.id).not.toBe(first.id); expect(repeated.path).toBe(first.path);
  const result = await f.service.commit(repeated, 'Notes');
  expect(result).toMatchObject({ ok: false, error: { code: 'conflict', effect: 'none' } });
  expect(await f.service.commit(repeated, 'Notes')).toEqual(result);
  expect([...f.files]).toEqual([[first.path, first.markdown]]);
  expect(f.create.mock.calls.map(([path]) => path)).toEqual(['Notes/Same Title.md', 'Notes/Same Title.md']);
  expect(created).toHaveBeenCalledOnce(); f.service.dispose(); f.events.dispose();
});

it('rejects unsafe or nonportable titles before attempting a write and never repairs names silently', () => {
  const f = fixture();
  for (const title of ['', '   ', '.', '..', '.hidden', 'a/b', 'a\\b', 'a:b', 'a*', 'a?', 'a"', '<a>', 'a|b', 'a\n', 'a\u0000b', 'a\u007f', 'Title ', 'Title.', 'CON', 'nul.txt', 'COM¹', 'LPT9.log', 'AUX .txt', 'x'.repeat(253), '😀'.repeat(64), '\ud800']) {
    expect(f.service.prepare('note', { title }, 'Notes', 'request')).toMatchObject({ ok: false, error: { key: 'error.filename', field: 'title' } });
  }
  expect(validateDocumentTitle(null).ok).toBe(false);
  expect(validateDocumentTitle('x'.repeat(252)).ok).toBe(true);
  expect(validateDocumentTitle('😀'.repeat(63)).ok).toBe(true);
  expect(validateDocumentTitle('CON Notes')).toEqual({ ok: true, value: 'CON Notes' });
  expect(f.create).not.toHaveBeenCalled(); expect(f.files.size).toBe(0); f.service.dispose(); f.events.dispose();
});
