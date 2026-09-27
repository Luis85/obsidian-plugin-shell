// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin } from 'obsidian';
import { createTestApp, hostInstance, type TestApp } from '@test/obsidian';
import { bindNativeIntegrations } from '../../src/infrastructure/obsidian/native-integrations';
import { CustomFileView } from '../../src/infrastructure/obsidian/custom-file-view';
import type { NativeFileDefinition, NativeMenuDefinition } from '../../src/domain/native-integrations';
import manifest from '../../manifest.json';
const file: NativeFileDefinition = {
  id: 'folio',
  name: 'Folio',
  extension: 'folio',
  format: 'json',
  initialContent: '{"title":"Untitled"}\n',
};
class FixturePlugin extends Plugin {}
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
async function fixture(menus: NativeMenuDefinition[] = [], files: NativeFileDefinition[] = [file]) {
  const kit = createTestApp({
    files: { 'Plans/a.folio': ' {"title":"A"}\r\n', 'b.folio': '{malformed', 'note.md': '# Note' },
  });
  const plugin = new FixturePlugin(hostInstance(kit.app, App), manifest);
  await kit.loadPlugin(plugin);
  const report = vi.fn();
  const stop = bindNativeIntegrations(plugin, files, menus, report);
  return { kit, plugin, report, stop };
}
async function open(kit: TestApp, path: string): Promise<CustomFileView> {
  const leaf = kit.workspace.getLeaf('tab');
  await leaf.openFile(kit.file(path));
  if (!(leaf.view instanceof CustomFileView)) throw Error('EXPECTED_CUSTOM_FILE_VIEW');
  return leaf.view;
}
function edit(view: CustomFileView, text: string): void {
  const input = view.contentEl.querySelector('textarea');
  if (!input) throw Error('MISSING_EDITOR');
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
async function create(kit: TestApp, name: string): Promise<void> {
  const modal = kit.modals[0];
  if (!modal) throw Error('MISSING_CREATE_DIALOG');
  const input = modal.contentEl.querySelector('input');
  if (!input) throw Error('MISSING_NAME_INPUT');
  input.value = name;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  modal.contentEl.querySelector('button')?.click();
  await kit.flush();
}
it('opens associated files in distinct TextFileViews, preserves bytes and saves edits to the correct file', async () => {
  const { kit, plugin, stop } = await fixture();
  const first = await open(kit, 'Plans/a.folio'),
    second = await open(kit, 'b.folio');
  expect(first.getViewType()).toBe(manifest.id + '-file-folio');
  expect(first.getIcon()).toBe('file-code');
  expect(first.getDisplayText()).toBe('a');
  expect(first.getViewData()).toBe(' {"title":"A"}\r\n');
  expect(second.getViewData()).toBe('{malformed');
  expect(second.contentEl.textContent).toContain('Invalid JSON');
  edit(first, ' {"title":"Changed 🛠"}\n');
  await kit.flush();
  expect(kit.read('Plans/a.folio')).toBe(' {"title":"Changed 🛠"}\n');
  expect(kit.read('b.folio')).toBe('{malformed');
  await kit.vault.rename(kit.file('Plans/a.folio'), 'Plans/renamed.folio');
  expect(first.getDisplayText()).toBe('renamed');
  expect(first.getState()).toMatchObject({ file: 'Plans/renamed.folio' });
  edit(first, '{"title":"After rename"}');
  await kit.flush();
  expect(kit.read('Plans/renamed.folio')).toBe('{"title":"After rename"}');
  stop();
  stop();
  expect(first.contentEl.querySelector('textarea')?.disabled).toBe(true);
  edit(first, 'ignored');
  await kit.flush();
  expect(first.getViewData()).toBe('{"title":"After rename"}');
  expect(kit.commands()).toHaveLength(0);
  expect(kit.openFileMenu(kit.file('b.folio')).items).toHaveLength(0);
  await kit.unloadPlugin(plugin);
});
it('keeps a failed save recoverable and permits an explicit retry without replacing bytes', async () => {
  const { kit, plugin, report } = await fixture();
  const view = await open(kit, 'b.folio');
  view.setViewData('{still malformed', false);
  const modify = vi.spyOn(plugin.app.vault, 'modify').mockRejectedValueOnce(Error('private details'));
  await expect(view.save()).rejects.toThrow('NATIVE_FILE_SAVE_FAILED');
  expect(view.getViewData()).toBe('{still malformed');
  expect(kit.read('b.folio')).toBe('{malformed');
  expect(view.contentEl.textContent).toContain('Save failed');
  expect(report).toHaveBeenCalledWith('native.file.save');
  expect(kit.notices.map((n) => n.message).join(' ')).not.toContain('private details');
  await view.save();
  expect(modify).toHaveBeenCalledTimes(2);
  expect(kit.read('b.folio')).toBe('{still malformed');
  await kit.unloadPlugin(plugin);
});
it('creates only after confirmation, avoids overwrite and uses folder context', async () => {
  const { kit, plugin } = await fixture();
  await kit.runCommand('native-create-folio');
  expect(kit.vault.getFileByPath('Untitled.folio')).toBeNull();
  await create(kit, '../escape');
  expect(kit.modals[0]?.contentEl.textContent).toContain('without folders');
  kit.modals[0]?.close();
  const folder = kit.vault.getFolderByPath('Plans');
  if (!folder) throw Error('MISSING_FOLDER');
  await kit.openFileMenu(folder).item('Create Folio')!.click();
  await create(kit, 'a');
  expect(kit.read('Plans/a.folio')).toBe(' {"title":"A"}\r\n');
  expect(kit.modals[0]?.contentEl.textContent).toContain('File was not created');
  await create(kit, 'New plan.folio');
  expect(kit.read('Plans/New plan.folio')).toBe(file.initialContent);
  expect(kit.modals).toHaveLength(0);
  await kit.unloadPlugin(plugin);
});
it('reports create success separately from open failure and never repeats a committed write', async () => {
  const { kit, plugin } = await fixture();
  const leaf = plugin.app.workspace.getLeaf('tab');
  vi.spyOn(plugin.app.workspace, 'getLeaf').mockReturnValue(leaf);
  vi.spyOn(leaf, 'openFile').mockRejectedValue(Error('cannot open'));
  const write = vi.spyOn(plugin.app.vault, 'create');
  await kit.runCommand('native-create-folio');
  await create(kit, 'Created');
  expect(kit.read('Created.folio')).toBe(file.initialContent);
  expect(kit.modals[0]?.contentEl.textContent).toContain('File created, but');
  await create(kit, 'Created');
  expect(write).toHaveBeenCalledTimes(1);
  await kit.unloadPlugin(plugin);
});
it('filters native menu actions, passes only a file snapshot and safely displays literal output', async () => {
  const run = vi.fn(() => ({ title: 'Inspect', message: '<script>never execute</script>' }));
  const { kit, plugin } = await fixture([{ id: 'inspect', name: 'Inspect file', extensions: ['md'], run }], []);
  expect(kit.openFileMenu(kit.file('b.folio')).items).toHaveLength(0);
  await kit.openFileMenu(kit.file('note.md')).item('Inspect file')!.click();
  await kit.flush();
  expect(run).toHaveBeenCalledExactlyOnceWith({ path: 'note.md', name: 'note.md', extension: 'md' });
  expect(kit.modals[0]?.contentEl.textContent).toBe('<script>never execute</script>');
  expect(kit.modals[0]?.contentEl.querySelector('script')).toBeNull();
  expect(kit.read('note.md')).toBe('# Note');
  await kit.unloadPlugin(plugin);
  expect(kit.modals).toHaveLength(0);
});
it('suppresses late async menu results and contains rejected handlers without sensitive logs', async () => {
  let resolve!: (value: { title: string; message: string }) => void;
  const pending = new Promise<{ title: string; message: string }>((done) => {
    resolve = done;
  });
  const { kit, stop, plugin } = await fixture(
    [{ id: 'inspect', name: 'Inspect', extensions: ['md'], run: () => pending }],
    [],
  );
  await kit.openFileMenu(kit.file('note.md')).item('Inspect')!.click();
  stop();
  resolve({ title: 'Late', message: 'ignore' });
  await kit.flush();
  expect(kit.modals).toHaveLength(0);
  await kit.unloadPlugin(plugin);
});
it('rejects core extensions before host changes and does not remove another plugin association', async () => {
  const { kit, plugin } = await fixture();
  expect(() => bindNativeIntegrations(plugin, [{ ...file, extension: 'md' }], [], vi.fn())).toThrow(
    'NATIVE_EXTENSION_RESERVED_OR_INVALID',
  );
  class OtherPlugin extends Plugin {}
  const other = new OtherPlugin(hostInstance(kit.app, App), { ...manifest, id: 'other' });
  await kit.loadPlugin(other);
  expect(() => bindNativeIntegrations(other, [{ ...file, id: 'other' }], [], vi.fn())).toThrow(
    'EXTENSION_ALREADY_REGISTERED',
  );
  await kit.unloadPlugin(other);
  expect((await open(kit, 'b.folio')).getViewType()).toBe(manifest.id + '-file-folio');
  await kit.unloadPlugin(plugin);
});
