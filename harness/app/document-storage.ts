import type { DocumentStorage } from '../../src/application/ports';
import { failure, success, type Result } from '../../src/domain/outcome';
import { validateFolder } from '../../src/domain/paths';

/** Synthetic browser persistence follows the same compare-before-write contract. */
export function browserDocumentStorage(files: () => Record<string, string>, save: (files: Record<string, string>) => void, fails: () => boolean): DocumentStorage {
  const allowed = (path: string, folder = false) => {
    const parts = path.split('/'); const filename = parts.pop() ?? '';
    return folder ? validateFolder(path).ok : filename.endsWith('.md') && validateFolder(filename).ok
      && (!parts.length || validateFolder(parts.join('/')).ok);
  };
  const invalid = () => failure('validation', 'error.folder', 'folder');
  function mutate(path: string, change: (current: Record<string, string>) => Result<void>): Promise<Result<void>> {
    if (!allowed(path)) return Promise.resolve(invalid());
    if (fails()) return Promise.resolve(failure('storage', 'error.write'));
    let attempted = false;
    try {
      const current = files(); const result = change(current);
      if (!result.ok) return Promise.resolve(result);
      attempted = true; save(current); return Promise.resolve(success(undefined));
    } catch { return Promise.resolve(failure(attempted ? 'uncertain' : 'storage', attempted ? 'error.uncertain' : 'error.read')); }
  }
  return {
    create: (path, markdown) => mutate(path, current => {
      if (Object.hasOwn(current, path)) return failure('conflict', 'error.conflict');
      current[path] = markdown; return success(undefined);
    }),
    async list(folder) {
      if (!allowed(folder, true)) return invalid();
      try { return success(Object.keys(files()).filter(path => path.startsWith(`${folder}/`) && allowed(path)).sort()); }
      catch { return failure('storage', 'error.read'); }
    },
    async read(path) {
      if (!allowed(path)) return invalid();
      try { const value = files()[path]; return typeof value === 'string' ? success(value) : failure('storage', 'error.read'); }
      catch { return failure('storage', 'error.read'); }
    },
    replace: (path, expected, markdown) => mutate(path, current => {
      if (!Object.hasOwn(current, path)) return failure('storage', 'error.read');
      if (current[path] !== expected) return failure('stale', 'error.stale');
      current[path] = markdown; return success(undefined);
    }),
    trash: (path, expected) => mutate(path, current => {
      if (!Object.hasOwn(current, path)) return failure('storage', 'error.read');
      if (current[path] !== expected) return failure('stale', 'error.stale');
      let destination = `.trash/${path}`; let suffix = 1;
      while (Object.hasOwn(current, destination)) destination = `.trash/${suffix++}/${path}`;
      const value = current[path];
      if (value === undefined) return failure('storage', 'error.read');
      current[destination] = value; delete current[path]; return success(undefined);
    }),
  };
}
