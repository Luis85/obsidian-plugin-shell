import { realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { object } from '../domain/data.ts';
import { requireSketch } from '#shared/contracts/sketch-errors.ts';
import { readFakeEntity, type FakeEntity } from '../domain/fake-data-entity.ts';
import { inferFakeEntity, readFakeGeneration, type FakeGeneration } from '../domain/fake-data-config.ts';
import { readData, readSnapshot } from './storage.ts';
import { readFolder } from './wizard-catalog.ts';
/** Shipped presets and examples; the compiled kit rebases this URL like the wizard definitions. */
export const builtinFakeData = fileURLToPath(new URL('../../../configs/fake-data/', import.meta.url));
/** Project-local definitions and saved generation configs, relative to the project root. */
export const projectFakeData = 'configs/fake-data';
export type FakeSourceKind = 'builtin' | 'project';
export interface FakeEntry<T> { definition: T; source: FakeSourceKind }
/** `shared` is true inside the framework checkout, where project definitions are the built-in folder itself. */
export interface FakeCatalog { shared: boolean; entities: Map<string, FakeEntry<FakeEntity>>; generations: Map<string, FakeEntry<FakeGeneration>> }
async function real(path: string): Promise<string | undefined> {
  try { return await realpath(path); } catch { return undefined; }
}
/** Inside the framework checkout the project folder is the built-in folder; it is then read once, as built-in. */
async function sharesBuiltin(root: string): Promise<boolean> {
  const [builtin, project] = await Promise.all([real(builtinFakeData), real(join(root, projectFakeData))]);
  return builtin !== undefined && builtin === project;
}
async function merged<T extends { id: string }>(root: string, folder: string, read: (value: unknown) => T, shared: boolean): Promise<Map<string, FakeEntry<T>>> {
  const result = new Map<string, FakeEntry<T>>();
  for (const [id, definition] of await readFolder(join(builtinFakeData, folder), read)) result.set(id, { definition, source: 'builtin' });
  if (shared) return result;
  for (const [id, definition] of await readFolder(join(root, projectFakeData, folder), read)) {
    requireSketch(!result.has(id), 'FAKE_DATA_DUPLICATE', `${projectFakeData}/${folder}/${id}.json reuses the built-in id ${id}; give it another id.`);
    result.set(id, { definition, source: 'project' });
  }
  return result;
}
/** Built-in and project definitions; any invalid, misnamed or colliding file fails closed. */
export async function loadFakeCatalog(root: string): Promise<FakeCatalog> {
  const shared = await sharesBuiltin(root);
  return { shared, entities: await merged(root, 'entities', readFakeEntity, shared), generations: await merged(root, 'generations', readFakeGeneration, shared) };
}
/** A project-relative path that stays inside the root. */
export function insideRoot(root: string, path: string): string {
  const target = relative(resolve(root), resolve(root, path));
  requireSketch(target && !target.startsWith('..') && !isAbsolute(target), 'FAKE_DATA_PATH', `${path} must stay inside the project root.`);
  return resolve(root, path);
}
function semanticRows(document: unknown): Record<string, unknown>[] {
  const design = object(object(document).design), semantic = design.semantic;
  if (semantic === undefined || semantic === null) return [];
  const entities = object(semantic).entities;
  return Array.isArray(entities) ? entities.map(item => object(item)) : [];
}
/** Entities of the saved project (design/project.json by default); a project without a saved document has none. */
async function semanticEntities(root: string, project = 'design/project.json'): Promise<Array<{ ref: string; title: string; row: Record<string, unknown> }>> {
  const snapshot = await readSnapshot(root, project);
  if (!snapshot.document) return [];
  return semanticRows(snapshot.document).map(row => ({ ref: 'semantic:' + String(row.id), title: String(row.name ?? row.id), row }));
}
/** Resolve a catalog id, `semantic:<id-or-slug>` or `file:<relative.json>` to one validated definition. */
export async function resolveFakeEntity(root: string, ref: string, catalog: FakeCatalog, project?: string): Promise<FakeEntity> {
  if (ref.startsWith('semantic:')) {
    const wanted = ref.slice('semantic:'.length);
    const found = (await semanticEntities(root, project)).find(item => item.row.id === wanted || item.row.slug === wanted);
    requireSketch(found, 'FAKE_DATA_ENTITY_UNKNOWN', `The saved project has no entity ${wanted}; list them with fake-data entities --json.`);
    return inferFakeEntity(found.row);
  }
  if (ref.startsWith('file:')) return readFakeEntity(await readData(insideRoot(root, ref.slice('file:'.length))));
  const entry = catalog.entities.get(ref);
  requireSketch(entry, 'FAKE_DATA_ENTITY_UNKNOWN', `Unknown fake-data entity ${ref}; list them with fake-data entities --json.`);
  return entry.definition;
}
export interface FakeEntitySummary { ref: string; id: string; title: string; source: string; description?: string; folder?: string; properties?: string[] }
/** Catalog entities first, then the saved project's semantic entities (referenced as semantic:<id>). */
export async function fakeEntityList(root: string, catalog: FakeCatalog, project?: string): Promise<FakeEntitySummary[]> {
  const local = [...catalog.entities.values()].map(({ definition, source }) => ({ ref: definition.id, id: definition.id, title: definition.title,
    description: definition.description ?? '', source, folder: definition.folder, properties: definition.properties.map(item => `${item.key}:${item.type}`) }));
  const semantic = (await semanticEntities(root, project)).map(item => ({ ref: item.ref, id: String(item.row.id), title: item.title, source: 'semantic' }));
  return [...local, ...semantic];
}
