import { describe, expect, it, vi } from 'vitest';
import { TFile, TFolder, type TAbstractFile } from 'obsidian';
import { nativeDocumentStorage } from '../../src/infrastructure/obsidian/document-storage';
import { deferred } from './helpers';

vi.mock('obsidian', () => ({ TFile: class {}, TFolder: class {} }));

function fixture(configDir = '.obsidian') {
  const entries = new Map<string, TAbstractFile>(); const contents = new Map<string, string>();
  const put = (path: string, markdown = 'original') => {
    const file = Object.assign(new TFile(), { path }); entries.set(path, file); contents.set(path, markdown); return file;
  };
  const folder = (path: string) => { const file = Object.assign(new TFolder(), { path }); entries.set(path, file); return file; };
  const vault = {
    configDir,
    getAbstractFileByPath: vi.fn((path: string) => entries.get(path) ?? null),
    getMarkdownFiles: vi.fn(() => [...entries.values()].filter((file): file is TFile => file instanceof TFile && file.path.endsWith('.md'))),
    createFolder: vi.fn(async (path: string) => folder(path)),
    create: vi.fn(async (path: string, markdown: string) => put(path, markdown)),
    read: vi.fn(async (file: TFile) => contents.get(file.path) ?? ''),
    process: vi.fn(async (file: TFile, update: (current: string) => string) => { const value = update(contents.get(file.path) ?? ''); contents.set(file.path, value); return value; }),
    trash: vi.fn(async (file: TAbstractFile, _system: boolean) => { entries.delete(file.path); }),
  };
  return { vault, entries, contents, put, folder, storage: nativeDocumentStorage(vault) };
}
const error = (code: string) => ({ ok: false, error: expect.objectContaining({ code }) });

describe('Synthetic host storage contracts (not native-host qualification)', () => {
  it('creates exact bytes and nested folders once, preserving existing documents', async () => {
    const f = fixture(); const markdown = '---\ntitle: "Hello"\n---\n\n# Hello\n';
    expect(await f.storage.create('Projects/Tasks/one.md', markdown)).toEqual({ ok: true, value: undefined });
    expect(f.vault.createFolder.mock.calls).toEqual([['Projects'], ['Projects/Tasks']]);
    expect(f.vault.create).toHaveBeenCalledExactlyOnceWith('Projects/Tasks/one.md', markdown);
    expect(await f.storage.create('Projects/Tasks/one.md', 'overwrite')).toEqual(error('conflict'));
    expect(f.contents.get('Projects/Tasks/one.md')).toBe(markdown);
    expect(await f.storage.create('Projects/Tasks/two.md', 'second')).toEqual({ ok: true, value: undefined });
    expect(f.vault.createFolder).toHaveBeenCalledTimes(2);
  });

  it('validates every path and blocks actual custom configuration directories and descendants', async () => {
    const f = fixture('Host/Settings');
    for (const path of ['../one.md', '.obsidian/one.md', '/one.md', 'A//one.md', 'A\\one.md', 'A/CON.md', 'A/one.txt', 'host/settings/one.md', 'Host/Settings/nested/one.md', '']) {
      expect(await f.storage.create(path, 'new')).toEqual(error('validation'));
      expect(await f.storage.read(path)).toEqual(error('validation'));
      expect(await f.storage.replace(path, '', 'new')).toEqual(error('validation'));
      expect(await f.storage.trash(path, '')).toEqual(error('validation'));
    }
    for (const path of ['Host/Settings', 'host/settings/child', '../A', '.obsidian', '']) expect(await f.storage.list(path)).toEqual(error('validation'));
    expect(f.vault.create).not.toHaveBeenCalled(); expect(f.vault.process).not.toHaveBeenCalled(); expect(f.vault.trash).not.toHaveBeenCalled();
    expect(await f.storage.create('Host/Settings-adjacent/one.md', 'ok')).toEqual({ ok: true, value: undefined });
    expect(await f.storage.create(`${'a'.repeat(160)}/one.md`, 'ok')).toEqual({ ok: true, value: undefined });
  });

  it('lists only contained safe Markdown paths with deterministic ordering without writes', async () => {
    const f = fixture('Tasks/Config');
    for (const path of ['Tasks/z.md', 'Tasks/nested/a.md', 'Tasks-old/wrong.md', 'Tasks/.hidden/wrong.md', 'Tasks/Config/wrong.md', 'Tasks/a.md']) f.put(path);
    expect(await f.storage.list('Tasks')).toEqual({ ok: true, value: ['Tasks/a.md', 'Tasks/nested/a.md', 'Tasks/z.md'] });
    expect(await f.storage.read('Tasks/z.md')).toEqual({ ok: true, value: 'original' });
    expect(await f.storage.read('Tasks/missing.md')).toEqual(error('storage'));
    f.folder('Tasks/folder.md'); expect(await f.storage.read('Tasks/folder.md')).toEqual(error('storage'));
    expect(f.vault.create).not.toHaveBeenCalled(); expect(f.vault.process).not.toHaveBeenCalled();
    f.vault.getMarkdownFiles.mockImplementationOnce(() => { throw new Error('offline'); });
    expect(await f.storage.list('Tasks')).toEqual(error('storage'));
    f.vault.read.mockRejectedValueOnce(new Error('offline')); expect(await f.storage.read('Tasks/z.md')).toEqual(error('storage'));
  });

  it('handles folder conflicts, creation races and lookup faults without overwriting', async () => {
    const f = fixture(); f.put('Tasks');
    expect(await f.storage.create('Tasks/a.md', 'a')).toEqual(error('conflict'));
    f.entries.clear(); f.vault.createFolder.mockImplementationOnce(async path => { f.folder(path); throw new Error('another writer'); });
    expect((await f.storage.create('Tasks/a.md', 'a')).ok).toBe(true);
    f.vault.createFolder.mockRejectedValueOnce(new Error('denied'));
    expect(await f.storage.create('Other/a.md', 'a')).toEqual(error('storage'));
    f.vault.getAbstractFileByPath.mockImplementationOnce(() => { throw new Error('offline'); });
    expect(await f.storage.create('Next/a.md', 'a')).toEqual(error('storage'));
    f.vault.createFolder.mockImplementationOnce(async path => { f.put(`${path}/a.md`, 'external'); return f.folder(path); });
    expect(await f.storage.create('Race/a.md', 'a')).toEqual(error('conflict'));
    expect(f.contents.get('Race/a.md')).toBe('external');
  });

  it('reconciles an uncertain create only at its exact path and bytes, without retrying', async () => {
    const f = fixture(); f.folder('Tasks');
    f.vault.create.mockImplementationOnce(async (path, text) => { f.put(path, text); throw new Error('lost reply'); });
    expect((await f.storage.create('Tasks/a.md', 'exact')).ok).toBe(true);
    f.vault.create.mockRejectedValueOnce(new Error('lost reply'));
    expect(await f.storage.create('Tasks/b.md', 'exact')).toEqual(error('uncertain'));
    f.vault.create.mockImplementationOnce(async path => { f.put(path, 'different'); throw new Error('lost reply'); });
    expect(await f.storage.create('Tasks/c.md', 'exact')).toEqual(error('uncertain'));
    f.vault.create.mockImplementationOnce(async path => { f.put(path); throw new Error('lost reply'); });
    f.vault.read.mockRejectedValueOnce(new Error('offline'));
    expect(await f.storage.create('Tasks/d.md', 'exact')).toEqual(error('uncertain'));
    expect(f.vault.create).toHaveBeenCalledTimes(4);
  });

  it('compares revision inside Vault.process and preserves stale handwritten content', async () => {
    const f = fixture(); f.put('Tasks/a.md', 'external edits');
    expect(await f.storage.replace('Tasks/a.md', 'original', 'new')).toEqual(error('stale'));
    expect(f.contents.get('Tasks/a.md')).toBe('external edits');
    expect(await f.storage.replace('Tasks/a.md', 'external edits', 'new')).toEqual({ ok: true, value: undefined });
    expect(f.contents.get('Tasks/a.md')).toBe('new');
    expect(await f.storage.replace('Tasks/missing.md', '', 'new')).toEqual(error('storage'));
    f.vault.process.mockRejectedValueOnce(new Error('not started'));
    expect(await f.storage.replace('Tasks/a.md', 'new', 'next')).toEqual(error('storage'));
    f.vault.process.mockImplementationOnce(async (file, callback) => { f.contents.set(file.path, callback('new')); throw new Error('lost reply'); });
    expect(await f.storage.replace('Tasks/a.md', 'new', 'next')).toEqual(error('uncertain'));
    expect(f.contents.get('Tasks/a.md')).toBe('next');
    f.vault.getAbstractFileByPath.mockImplementationOnce(() => { throw new Error('offline'); });
    expect(await f.storage.replace('Tasks/a.md', 'next', 'last')).toEqual(error('storage'));
  });

  it('serializes runtime mutations and stale concurrent replacements cannot win', async () => {
    const f = fixture(); f.put('Tasks/a.md'); const pending = deferred();
    f.vault.process.mockImplementationOnce(async (file, callback) => { await pending.promise; const value = callback(f.contents.get(file.path) ?? ''); f.contents.set(file.path, value); return value; });
    const first = f.storage.replace('Tasks/a.md', 'original', 'first');
    const second = f.storage.replace('Tasks/a.md', 'original', 'second');
    await Promise.resolve(); expect(f.vault.process).toHaveBeenCalledTimes(1);
    pending.resolve(); expect((await first).ok).toBe(true); expect(await second).toEqual(error('stale'));
    expect(f.contents.get('Tasks/a.md')).toBe('first');
  });

  it('checks revision immediately before reversible local trash and reports uncertainty honestly', async () => {
    const f = fixture(); const file = f.put('Tasks/a.md');
    expect(await f.storage.trash('Tasks/a.md', 'stale')).toEqual(error('stale')); expect(f.vault.trash).not.toHaveBeenCalled();
    expect(await f.storage.trash('Tasks/a.md', 'original')).toEqual({ ok: true, value: undefined });
    expect(f.vault.trash).toHaveBeenCalledExactlyOnceWith(file, false);
    expect(await f.storage.trash('Tasks/missing.md', 'original')).toEqual(error('storage'));
    f.put('Tasks/a.md'); f.vault.read.mockRejectedValueOnce(new Error('offline'));
    expect(await f.storage.trash('Tasks/a.md', 'original')).toEqual(error('storage'));
    f.vault.trash.mockRejectedValueOnce(new Error('lost reply'));
    expect(await f.storage.trash('Tasks/a.md', 'original')).toEqual(error('uncertain'));
    expect(f.vault.trash).toHaveBeenCalledTimes(2);
  });
});
