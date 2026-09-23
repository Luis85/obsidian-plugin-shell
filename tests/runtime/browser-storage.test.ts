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
