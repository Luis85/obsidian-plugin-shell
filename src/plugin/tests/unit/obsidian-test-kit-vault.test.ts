import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('../support/obsidian'));
import { TFile, TFolder, normalizePath } from 'obsidian';
import { createTestApp, createTestVault, loadVaultFixtures } from '../support/obsidian';

function must<T>(value: T | null | undefined): T { if (value === null || value === undefined) throw new Error('KIT_FIXTURE_MISSING'); return value; }
function recorder(vault: ReturnType<typeof createTestVault>) {
  const events: string[] = [];
  for (const name of ['create', 'modify', 'delete']) vault.on(name, (file: { path: string }) => events.push(`${name}:${file.path}`));
  vault.on('rename', (file: { path: string }, old: string) => events.push(`rename:${old}->${file.path}`));
  return events;
}

it('seeds files silently and indexes folders, parents and stats like the host', async () => {
  const vault = createTestVault({ 'Notes/Daily/2026.md': '# Day\n', 'Root.md': 'root', 'image.png': 'bytes', '.obsidian/app.json': '{}' });
  const file = vault.getFileByPath('Notes/Daily/2026.md');
  expect(file).toBeInstanceOf(TFile);
  expect([file?.name, file?.basename, file?.extension, file?.parent?.path, file?.stat.size]).toEqual(['2026.md', '2026', 'md', 'Notes/Daily', 6]);
  expect(vault.getFolderByPath('Notes')).toBeInstanceOf(TFolder);
  expect(vault.getRoot().isRoot()).toBe(true); expect(vault.getAbstractFileByPath('/')).toBe(vault.getRoot());
  expect(vault.getMarkdownFiles().map(item => item.path).sort()).toEqual(['Notes/Daily/2026.md', 'Root.md']);
  expect(vault.getFiles()).toHaveLength(3); expect(vault.getAbstractFileByPath('.obsidian/app.json')).toBeNull();
  expect(vault.getAllLoadedFiles().map(item => item.path)).toContain('Notes/Daily');
  expect(await vault.adapter.read('.obsidian/app.json')).toBe('{}');
  expect(await vault.read(must(file))).toBe('# Day\n'); expect(await vault.cachedRead(must(file))).toBe('# Day\n');
});

it('creates, modifies, processes, appends and deletes with exact bytes and host events', async () => {
  const vault = createTestVault({ 'A.md': 'one' }); const events = recorder(vault);
  const created = await vault.create('Notes/B.md', 'two').catch((error: unknown) => error);
  expect(created).toBeInstanceOf(Error); expect(events).toEqual([]);
  const folder = await vault.createFolder('Notes/Deep'); expect(folder.path).toBe('Notes/Deep');
  const b = await vault.create('Notes/B.md', 'two');
  await expect(vault.create('Notes/B.md', 'again')).rejects.toThrow('File already exists.');
  await expect(vault.createFolder('Notes')).rejects.toThrow('Folder already exists.');
  await vault.modify(b, 'three'); await vault.append(b, '!');
  expect(await vault.process(b, data => data.toUpperCase())).toBe('THREE!');
  await expect(vault.process(b, () => { throw new Error('abort'); })).rejects.toThrow('abort');
  expect(await vault.read(b)).toBe('THREE!');
  await vault.delete(b); await expect(vault.read(b)).rejects.toThrow('ENOENT');
  expect(events).toEqual(['create:Notes', 'create:Notes/Deep', 'create:Notes/B.md', 'modify:Notes/B.md', 'modify:Notes/B.md', 'modify:Notes/B.md', 'delete:Notes/B.md']);
});

it('renames folders with their children, keeps identities and rejects occupied targets', async () => {
  const vault = createTestVault({ 'Old/Sub/Note.md': 'n', 'Old/Top.md': 't', 'Taken.md': 'x' }); const events = recorder(vault);
  const note = vault.getFileByPath('Old/Sub/Note.md'); const folder = vault.getFolderByPath('Old');
  if (!note || !folder) throw new Error('FIXTURE');
  await vault.rename(folder, 'New');
  expect(note.path).toBe('New/Sub/Note.md'); expect(vault.getFileByPath('New/Sub/Note.md')).toBe(note);
  expect(vault.getAbstractFileByPath('Old')).toBeNull(); expect(note.parent?.path).toBe('New/Sub');
  expect(events).toEqual(['rename:Old->New', 'rename:Old/Sub->New/Sub', 'rename:Old/Sub/Note.md->New/Sub/Note.md', 'rename:Old/Top.md->New/Top.md']);
  await expect(vault.rename(note, 'Taken.md')).rejects.toThrow('File already exists.');
  await expect(vault.rename(note, 'Missing/Note.md')).rejects.toThrow('parent folder does not exist');
  expect(await vault.read(note)).toBe('n');
});

it('records trash, keeps local trash hidden and shares one store with the adapter', async () => {
  const vault = createTestVault({ 'Keep.md': 'k', 'Local.md': 'l', 'System.md': 's' }); const events = recorder(vault);
  await vault.trash(must(vault.getFileByPath('Local.md')), false);
  await vault.trash(must(vault.getFileByPath('System.md')), true);
  expect(vault.trashed).toEqual([{ path: 'Local.md', system: false, data: 'l' }, { path: 'System.md', system: true, data: 's' }]);
  expect(await vault.adapter.read('.trash/Local.md')).toBe('l'); expect(await vault.adapter.exists('System.md')).toBe(false);
  await vault.adapter.write('Outside/Note.md', 'from adapter'); await vault.adapter.write('Keep.md', 'changed');
  await vault.adapter.mkdir('Empty'); await vault.adapter.remove('Outside/Note.md');
  expect(await vault.adapter.list('/')).toEqual({ files: ['Keep.md'], folders: ['.trash', 'Empty', 'Outside'] });
  expect(await vault.adapter.stat('Keep.md')).toMatchObject({ type: 'file', size: 7 });
  await expect(vault.adapter.rmdir('Outside', false)).resolves.toBeUndefined();
  expect(events).toEqual(['delete:Local.md', 'delete:System.md', 'create:Outside', 'create:Outside/Note.md', 'modify:Keep.md', 'create:Empty', 'delete:Outside/Note.md', 'delete:Outside']);
});

it('normalizes paths and loads Markdown fixture folders for createTestApp', () => {
  expect(['/a//b\\c/', '', 'x y', 'é'].map(normalizePath)).toEqual(['a/b/c', '/', 'x y', 'é']);
  const files = loadVaultFixtures(new URL('../fixtures/obsidian-vault', import.meta.url));
  expect(Object.keys(files).sort()).toEqual(['Inbox.md', 'Projects/Launch.md']);
  const kit = createTestApp({ files, activeFile: 'Inbox.md', pluginData: { sample: { enabled: true } } });
  expect(kit.workspace.getActiveFile()?.path).toBe('Inbox.md');
  expect(kit.read('.obsidian/plugins/sample/data.json')).toBe('{\n  "enabled": true\n}');
  expect(() => kit.file('Missing.md')).toThrow('OBSIDIAN_TEST_KIT_NO_FILE');
});
