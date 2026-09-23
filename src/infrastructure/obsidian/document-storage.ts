import { TFile, TFolder, type Vault } from 'obsidian';
import type { DocumentStorage } from '../../application/ports';
import { failure, success, type Result } from '../../domain/outcome';
import { validateFolder } from '../../domain/paths';

type DocumentVault = Pick<Vault, 'configDir' | 'getAbstractFileByPath' | 'getMarkdownFiles' | 'createFolder' | 'create' | 'read' | 'process' | 'trash'>;

/** Host paths are checked again here, including the actual configurable metadata directory. */
export function nativeDocumentStorage(vault: DocumentVault): DocumentStorage {
  let pending: Promise<unknown> = Promise.resolve();
  const queue = (operation: () => Promise<Result<void>>): Promise<Result<void>> => {
    const result = pending.then(operation);
    pending = result.catch(() => undefined);
    return result;
  };
  const allowed = (path: string, folder = false): boolean => {
    const config = vault.configDir.replaceAll('\\', '/').replace(/\/$/, '').toLowerCase();
    const normalized = path.toLowerCase();
    const segments = path.split('/');
    const filename = segments.pop() ?? '';
    const validPath = folder ? validateFolder(path).ok
      : validateFolder(filename).ok && (!segments.length || validateFolder(segments.join('/')).ok) && filename.endsWith('.md');
    return validPath
      && normalized !== config && !normalized.startsWith(`${config}/`);
  };
  const invalid = () => failure('validation', 'error.folder', 'folder');
  async function create(path: string, markdown: string): Promise<Result<void>> {
    if (!allowed(path)) return invalid();
    try {
      if (vault.getAbstractFileByPath(path)) return failure('conflict', 'error.conflict');
      const segments = path.split('/').slice(0, -1);
      for (let i = 1; i <= segments.length; i++) {
        const folder = segments.slice(0, i).join('/');
        const existing = vault.getAbstractFileByPath(folder);
        if (existing && !(existing instanceof TFolder)) return failure('conflict', 'error.conflict');
        if (!existing) {
          try { await vault.createFolder(folder); }
          catch { if (!(vault.getAbstractFileByPath(folder) instanceof TFolder)) return failure('storage', 'error.write'); }
        }
      }
      if (vault.getAbstractFileByPath(path)) return failure('conflict', 'error.conflict');
    } catch { return failure('storage', 'error.write'); }
    try { await vault.create(path, markdown); return success(undefined); }
    catch {
      // Never retry: reconcile only this exact intended effect.
      try {
        const file = vault.getAbstractFileByPath(path);
        if (file instanceof TFile && await vault.read(file) === markdown) return success(undefined);
      } catch { /* The original effect remains uncertain. */ }
      return failure('uncertain', 'error.uncertain');
    }
  }
  return {
    create: (path, markdown) => queue(() => create(path, markdown)),
    async list(folder) {
      if (!allowed(folder, true)) return invalid();
      try { return success(vault.getMarkdownFiles().filter(file => file.path.startsWith(`${folder}/`) && allowed(file.path)).map(file => file.path).sort()); }
      catch { return failure('storage', 'error.read'); }
    },
    async read(path) {
      if (!allowed(path)) return invalid();
      try {
        const file = vault.getAbstractFileByPath(path);
        return file instanceof TFile ? success(await vault.read(file)) : failure('storage', 'error.read');
      } catch { return failure('storage', 'error.read'); }
    },
    replace: (path, expectedMarkdown, markdown) => queue(async () => {
      if (!allowed(path)) return invalid();
      let attempted = false;
      try {
        const file = vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) return failure('storage', 'error.read');
        const stale = new Error('STALE_DOCUMENT');
        try {
          await vault.process(file, current => {
            if (current !== expectedMarkdown) throw stale;
            attempted = true;
            return markdown;
          });
          return success(undefined);
        } catch (error) {
          if (error === stale) return failure('stale', 'error.stale');
          return failure(attempted ? 'uncertain' : 'storage', attempted ? 'error.uncertain' : 'error.write');
        }
      } catch { return failure('storage', 'error.write'); }
    }),
    trash: (path, expectedMarkdown) => queue(async () => {
      if (!allowed(path)) return invalid();
      let attempted = false;
      try {
        const file = vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) return failure('storage', 'error.read');
        if (await vault.read(file) !== expectedMarkdown) return failure('stale', 'error.stale');
        // Obsidian has no cross-process compare-and-trash transaction. The queue
        // serializes this runtime; external writers can race this final host call.
        attempted = true;
        await vault.trash(file, false);
        return success(undefined);
      } catch { return failure(attempted ? 'uncertain' : 'storage', attempted ? 'error.uncertain' : 'error.write'); }
    }),
  };
}
