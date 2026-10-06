import { describe, expect, it } from 'vitest';
import { browserDocumentStorage } from '../../harness/app/document-storage';

function fixture() {
  let contents: Record<string, string> = {}; let writes = 0;
  const flags = { read: false, write: false, injected: false };
  const storage = browserDocumentStorage(() => {
    if (flags.read) throw new Error('read'); return { ...contents };
  }, files => { if (flags.write) throw new Error('write'); contents = files; writes++; }, () => flags.injected);
  return { storage, flags, files: () => contents, writes: () => writes };
}
const error = (code: string) => ({ ok: false, error: expect.objectContaining({ code }) });
describe('Browser synthetic document storage parity', () => {
  it('conflicts on composed/decomposed aliases without rewriting valid Unicode paths', async () => {
    const f = fixture(); const composed = 'Notes/Café.md'; const decomposed = 'Notes/Re\u0301sume\u0301.md';
    expect((await f.storage.create(composed, 'composed')).ok).toBe(true);
    expect(await f.storage.create('Notes/Cafe\u0301.md', 'overwrite')).toEqual(error('conflict'));
    expect(f.writes()).toBe(1); expect(f.files()[composed]).toBe('composed');
    expect((await f.storage.create(decomposed, 'decomposed')).ok).toBe(true);
    expect(f.files()[decomposed]).toBe('decomposed'); expect(f.files()[decomposed.normalize('NFC')]).toBeUndefined();
    expect(await f.storage.create('Notes/Résumé.md', 'overwrite')).toEqual(error('conflict'));
    expect((await f.storage.create('Données/Original.md', 'folder')).ok).toBe(true);
    expect(await f.storage.create('Donne\u0301es/Other.md', 'alias')).toEqual(error('conflict'));
    expect(f.writes()).toBe(3);
  });
  it('matches verbatim Unicode filenames and case-only collision safety without overwrites', async () => {
    const f = fixture(); const path = 'Notes/Title Case – Übersicht.md';
    expect((await f.storage.create(path, 'original')).ok).toBe(true);
    for (const conflict of [path, 'Notes/title case – übersicht.md', 'notes/Other Title.md']) expect(await f.storage.create(conflict, 'overwrite')).toEqual(error('conflict'));
    expect(f.writes()).toBe(1); expect(f.files()).toEqual({ [path]: 'original' });
    expect((await f.storage.create('Notes/  Leading space.md', 'leading')).ok).toBe(true);
    expect((await f.storage.create(`Notes/${'ä'.repeat(100)}.md`, 'long')).ok).toBe(true);
    for (const invalid of ['Notes/Title .md', 'Notes/Title..md', 'Notes/COM¹.md', `Notes/${'😀'.repeat(64)}.md`]) expect(await f.storage.create(invalid, 'bad')).toEqual(error('validation'));
    expect(f.writes()).toBe(3);
  });
  it('creates, lists, reads and updates exact bytes with revision conflicts and missing paths', async () => {
    const f = fixture();
    expect((await f.storage.create('Tasks/a.md', 'first')).ok).toBe(true);
    expect(await f.storage.create('Tasks/a.md', 'overwritten')).toEqual(error('conflict'));
    await f.storage.create('Tasks/sub/z.md', 'second'); await f.storage.create('Tasks-extra/a.md', 'outside');
    expect(await f.storage.list('Tasks')).toEqual({ ok: true, value: ['Tasks/a.md', 'Tasks/sub/z.md'] });
    expect(await f.storage.read('Tasks/a.md')).toEqual({ ok: true, value: 'first' });
    expect(await f.storage.read('Tasks/missing.md')).toEqual(error('storage'));
    expect(await f.storage.replace('Tasks/missing.md', '', 'new')).toEqual(error('storage'));
    expect(await f.storage.replace('Tasks/a.md', 'stale', 'new')).toEqual(error('stale'));
    expect(f.writes()).toBe(3);
    expect((await f.storage.replace('Tasks/a.md', 'first', 'new')).ok).toBe(true);
    expect(f.files()['Tasks/a.md']).toBe('new'); expect(f.writes()).toBe(4);
  });
  it('preserves every deleted version in synthetic trash and never lists it as live', async () => {
    const f = fixture(); await f.storage.create('Tasks/a.md', 'first');
    expect(await f.storage.trash('Tasks/a.md', 'stale')).toEqual(error('stale'));
    expect((await f.storage.trash('Tasks/a.md', 'first')).ok).toBe(true);
    expect(await f.storage.trash('Tasks/a.md', 'first')).toEqual(error('storage'));
    await f.storage.create('Tasks/a.md', 'second'); await f.storage.trash('Tasks/a.md', 'second');
    expect(f.files()).toEqual({ '.trash/Tasks/a.md': 'first', '.trash/1/Tasks/a.md': 'second' });
    expect(await f.storage.list('Tasks')).toEqual({ ok: true, value: [] });
    expect(await f.storage.read('.trash/Tasks/a.md')).toEqual(error('validation'));
  });
  it('rejects unsafe paths on every operation before writes', async () => {
    const f = fixture();
    for (const path of ['../a.md', '.obsidian/a.md', 'a.txt', 'Tasks//a.md']) {
      expect(await f.storage.create(path, '')).toEqual(error('validation'));
      expect(await f.storage.read(path)).toEqual(error('validation'));
      expect(await f.storage.replace(path, '', '')).toEqual(error('validation'));
      expect(await f.storage.trash(path, '')).toEqual(error('validation'));
    }
    expect(await f.storage.list('../Tasks')).toEqual(error('validation')); expect(f.writes()).toBe(0);
  });
  it('reports injected failures, unreadable storage and uncertain saves without retrying', async () => {
    const f = fixture(); f.flags.injected = true;
    expect(await f.storage.create('Tasks/a.md', '')).toEqual(error('storage'));
    f.flags.injected = false; f.flags.read = true;
    expect(await f.storage.list('Tasks')).toEqual(error('storage'));
    expect(await f.storage.read('Tasks/a.md')).toEqual(error('storage'));
    expect(await f.storage.create('Tasks/a.md', '')).toEqual(error('storage'));
    f.flags.read = false; f.flags.write = true;
    expect(await f.storage.create('Tasks/a.md', '')).toEqual(error('uncertain'));
    expect(f.files()).toEqual({}); expect(f.writes()).toBe(0);
  });
});
