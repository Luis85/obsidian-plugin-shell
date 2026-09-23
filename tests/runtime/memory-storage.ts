import { vi } from 'vitest';
import { failure, success, type Result } from '../../src/domain/outcome';
import type { DocumentStorage } from '../../src/application/ports';
export function memoryStorage() {
  const files = new Map<string, string>();
  const create = vi.fn(async (path: string, text: string): Promise<Result<void>> => {
    if (files.has(path)) return failure('conflict', 'error.conflict'); files.set(path, text); return success(undefined);
  });
  const storage: DocumentStorage = {
    create,
    async list(folder) { return success([...files.keys()].filter(path => path.startsWith(`${folder}/`))); },
    async read(path) { const value = files.get(path); return value === undefined ? failure('storage', 'error.open') : success(value); },
    async replace(path, expected, text) { if (files.get(path) !== expected) return failure('conflict', 'error.conflict'); files.set(path, text); return success(undefined); },
    async trash(path, expected) { if (files.get(path) !== expected) return failure('conflict', 'error.conflict'); files.delete(path); return success(undefined); },
  };
  return { storage, create, files };
}
