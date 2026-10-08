// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin } from 'obsidian';
import { createTestApp, hostInstance } from '@test/obsidian';
import { bindNativeIntegrations } from '../../infrastructure/obsidian/native-integrations';
import { safeVaultFilePath, type NativeFileOperations, type NativeMenuDefinition } from '../../domain/native-integrations';
import manifest from '../../../../manifest.json';
class FixturePlugin extends Plugin {}
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
async function fixture(menu: Omit<NativeMenuDefinition, 'id' | 'name' | 'extensions'>) {
  const kit = createTestApp({ files: { 'Boards/a.board': '{"title":"A"}', 'Exports/a.md': '# Existing' } });
  const plugin = new FixturePlugin(hostInstance(kit.app, App), manifest);
  await kit.loadPlugin(plugin);
  const stop = bindNativeIntegrations(plugin, [], [{ id: 'export', name: 'Export board', extensions: ['board'], ...menu }], vi.fn());
  const click = async () => {
    await kit.openFileMenu(kit.file('Boards/a.board')).item('Export board')!.click();
    await kit.flush();
  };
  return { kit, plugin, stop, click };
}
it('accepts only plain vault-relative paths', () => {
  expect(safeVaultFilePath('Exports/Board summary.md')).toBe('Exports/Board summary.md');
  for (const path of ['../a.md', '/a.md', 'a/../b.md', '.obsidian/app.json', 'a\\b.md', 'a//b.md', 'C:/a.md', ' a.md', 'a.md '])
    expect(safeVaultFilePath(path)).toBeNull();
});
it('reads the clicked file, creates a new file in a new folder, opens it and shows no modal for a null outcome', async () => {
  const { kit, plugin, click } = await fixture({
    icon: 'file-output',
    async run(file, files) {
      const source = JSON.parse(await files.read(file.path)) as { title: string };
      expect(await files.create('Summaries/A.md', '# ' + source.title + '\n')).toBe('created');
      expect(await files.create('Exports/a.md', 'never written')).toBe('exists');
      await files.open('Summaries/A.md');
      return null;
    },
  });
  expect(kit.openFileMenu(kit.file('Boards/a.board')).item('Export board')?.icon).toBe('file-output');
  await click();
  expect(kit.read('Summaries/A.md')).toBe('# A\n');
  expect(kit.read('Exports/a.md')).toBe('# Existing');
  expect(kit.read('Boards/a.board')).toBe('{"title":"A"}');
  expect(kit.workspace.getActiveFile()?.path).toBe('Summaries/A.md');
  expect(kit.modals).toHaveLength(0);
  await kit.unloadPlugin(plugin);
});
it('rejects unsafe paths and missing files without writing, and reports the failure generically', async () => {
  const create = vi.fn();
  const { kit, plugin, click } = await fixture({
    async run(_file, files) {
      await expect(files.create('../escape.md', 'x')).rejects.toThrow('NATIVE_FILE_PATH_INVALID');
      await expect(files.read('missing.md')).rejects.toThrow('NATIVE_FILE_MISSING');
      create();
      throw new Error('private details');
    },
  });
  const write = vi.spyOn(plugin.app.vault, 'create');
  await click();
  await vi.waitFor(() => expect(kit.notices).toHaveLength(1));
  expect(create).toHaveBeenCalledOnce();
  expect(write).not.toHaveBeenCalled();
  expect(kit.notices.map((notice) => notice.message).join(' ')).toContain('Native file action failed');
  expect(kit.notices.map((notice) => notice.message).join(' ')).not.toContain('private details');
  await kit.unloadPlugin(plugin);
});
it('refuses file operations after the integration is disposed', async () => {
  let held: NativeFileOperations | undefined;
  const { kit, plugin, stop, click } = await fixture({
    run(_file, files) {
      held = files;
      return null;
    },
  });
  await click();
  stop();
  await expect(held!.create('Late.md', 'x')).rejects.toThrow('NATIVE_DISPOSED');
  await expect(held!.read('Boards/a.board')).rejects.toThrow('NATIVE_DISPOSED');
  expect(kit.vault.getFileByPath('Late.md')).toBeNull();
  await kit.unloadPlugin(plugin);
});
