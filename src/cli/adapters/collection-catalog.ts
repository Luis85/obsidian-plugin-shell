import { realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireSketch, SketchError } from '../domain/errors.ts';
import { readCollectionDefinition, type CollectionDefinition } from '../domain/collection-definition.ts';
import { collectionHooks } from '../domain/collection-hooks.ts';
import type { CollectionHook } from '../domain/collection-record.ts';
import { exists } from './framework/files.ts';
import { readData } from './storage.ts';
/** Shipped collection definitions; the compiled kit rebases this URL like the wizard definitions. */
const builtinCollections = fileURLToPath(new URL('../../../configs/collections/', import.meta.url));
/** A project customizes a collection by saving its complete definition under the same relative path and id. */
const projectCollections = 'configs/collections';
export interface LoadedCollection { definition: CollectionDefinition; hook?: CollectionHook; source: 'builtin' | 'project'; file: string }
async function real(path: string): Promise<string | undefined> {
  try { return await realpath(path); } catch { return undefined; }
}
/** The project file when it exists outside the framework's own folder, otherwise the built-in definition. */
async function definitionFile(root: string, id: string): Promise<{ path: string; source: LoadedCollection['source'] }> {
  const project = join(root, projectCollections, id + '.json'), builtin = join(builtinCollections, id + '.json');
  const [left, right] = await Promise.all([real(project), real(builtin)]);
  if (left !== undefined && left !== right) return { path: project, source: 'project' };
  requireSketch(await exists(builtin), 'COLLECTION_UNKNOWN', `Unknown collection ${id}.`);
  return { path: builtin, source: 'builtin' };
}
/**
 * One validated definition with its named hook. A project definition replaces the built-in one completely and is
 * validated the same way; any invalid file fails closed with its name before a note is read or written.
 */
export async function loadCollection(root: string, id: string): Promise<LoadedCollection> {
  const { path, source } = await definitionFile(root, id), file = source === 'project' ? `${projectCollections}/${id}.json` : `configs/collections/${id}.json`;
  try {
    const definition = readCollectionDefinition(await readData(path));
    requireSketch(definition.id === id, 'COLLECTION_DEFINITION', `must be named ${definition.id}.json.`);
    const hook = definition.hook === undefined ? undefined : collectionHooks[definition.hook];
    requireSketch(definition.hook === undefined || hook, 'COLLECTION_HOOK', `names unknown hook ${definition.hook}; see src/cli/domain/collection-hooks.ts.`);
    hook?.readModel(definition);
    return { definition, source, file, ...(hook ? { hook } : {}) };
  } catch (error) {
    throw new SketchError(error instanceof SketchError ? error.code : 'COLLECTION_DEFINITION', `${file}: ${error instanceof Error ? error.message : 'invalid definition'}`);
  }
}
