import { TFile, TFolder, type Plugin } from 'obsidian';
import { safeVaultFilePath, type NativeFileOperations } from '../../domain/native-integrations';

function checkedPath(path: string): string {
  const safe = safeVaultFilePath(path);
  if (!safe) throw new Error('NATIVE_FILE_PATH_INVALID');
  return safe;
}
async function ensureParent(plugin: Plugin, path: string): Promise<void> {
  const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  if (!parent) return;
  const existing = plugin.app.vault.getAbstractFileByPath(parent);
  if (existing instanceof TFolder) return;
  if (existing) throw new Error('NATIVE_FILE_PARENT_NOT_FOLDER');
  await plugin.app.vault.createFolder(parent);
}
/**
 * The vault operations a context-menu action receives. Every call refuses work after
 * plugin disposal, validates the path, and never overwrites or deletes an existing file.
 */
export function nativeFileOperations(plugin: Plugin, active: () => boolean): NativeFileOperations {
  const live = () => {
    if (!active()) throw new Error('NATIVE_DISPOSED');
  };
  const file = (path: string): TFile => {
    const entry = plugin.app.vault.getAbstractFileByPath(checkedPath(path));
    if (!(entry instanceof TFile)) throw new Error('NATIVE_FILE_MISSING');
    return entry;
  };
  return {
    async read(path) {
      live();
      return plugin.app.vault.read(file(path));
    },
    async create(path, content) {
      live();
      const target = checkedPath(path);
      if (typeof content !== 'string' || content.length > 1_000_000) throw new Error('NATIVE_FILE_CONTENT_INVALID');
      if (plugin.app.vault.getAbstractFileByPath(target)) return 'exists';
      await ensureParent(plugin, target);
      live();
      await plugin.app.vault.create(target, content);
      return 'created';
    },
    async open(path) {
      live();
      await plugin.app.workspace.getLeaf('tab').openFile(file(path));
    },
  };
}
