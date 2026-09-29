import type { Vault, TFile } from 'obsidian';
import { projectFilePath, type ProjectFilePort, type ProjectWrite } from '../journey/project-store.ts';

/** The vault owns serialization and file association. Never split read/modify into separate writes. */
export function journeyVaultFiles(vault: Vault): ProjectFilePort {
  const unchanged: ProjectWrite = { status: 'failed', certainty: 'unchanged' };
  function current(path: string): TFile | null { return vault.getFileByPath(projectFilePath(path)); }
  return {
    async read(path) {
      const file = current(path);
      if (!file || file.stat.size > 4_000_000) throw new Error('PROJECT_READ: Open a valid project file of at most 4 MB.');
      const result = await vault.read(file);
      if (file.path !== path || current(path) !== file) throw new Error('PROJECT_CHANGED: The project file moved while opening.');
      return result;
    },
    async create(path, content) {
      projectFilePath(path);
      if (vault.getAbstractFileByPath(path)) return { status: 'conflict' };
      const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      if (parent && !vault.getFolderByPath(parent)) return unchanged;
      try { await vault.create(path, content); return { status: 'committed', content }; }
      catch { return { status: 'failed', certainty: 'unknown' }; }
    },
    async replace(path, expected, content) {
      const file = current(path);
      if (!file) return { status: 'conflict' };
      const conflict = new Error('PROJECT_CONFLICT');
      try {
        const written = await vault.process(file, before => {
          if (file.path !== path || current(path) !== file || before !== expected) throw conflict;
          return content;
        });
        return { status: 'committed', content: written };
      } catch (error) {
        return error === conflict ? { status: 'conflict' } : { status: 'failed', certainty: 'unknown' };
      }
    },
  };
}
