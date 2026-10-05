import { createFilePlan } from '../../scripts/shared/file-plan.ts';
import { requireSketch } from '../domain/errors.ts';
import { fakeEntityJson, fakeFolder, type FakeEntity } from '../domain/fake-data-entity.ts';
import { fakeGenerationJson, type FakeGeneration } from '../domain/fake-data-config.ts';
import { generateCollection, type FakeBase, type FakeNote } from '../domain/fake-data.ts';
import { outputBoundary } from './package-plan.ts';
import { prepared, type Prepared } from './storage.ts';
import { loadYaml, yamlRuntime } from './yaml-runtime.ts';
import { insideRoot, projectFakeData, type FakeCatalog } from './fake-data-catalog.ts';
/** One generation: a resolved entity plus the reproducible run parameters. */
export interface FakeRun { ref: string; entity: FakeEntity; count: number; seed: number; out: string; base: boolean; referenceDate: string }
const noteLimit = 65_536, totalLimit = 8_000_000;
/** The same YAML serializer and options as the plugin's note repository (src/infrastructure/markdown.ts). */
export function renderNote(note: FakeNote): string {
  return `---\n${yamlRuntime().stringify(note.frontmatter, { lineWidth: 0, defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' })}---\n\n${note.body}`;
}
export function renderBase(base: FakeBase): string {
  return yamlRuntime().stringify(base.data, { lineWidth: 0 });
}
/** Generate, render and plan every note (and the optional .base file) as one reviewed file plan. Existing notes are never changed. */
export async function fakeDataPlan(root: string, frameworkRoot: string, run: FakeRun): Promise<Prepared> {
  const out = fakeFolder(run.out, 'out');
  insideRoot(root, out);
  outputBoundary(root, frameworkRoot, out);
  const { fakerSource } = await import('./fake-data-faker.ts');
  await loadYaml();
  const collection = generateCollection(run.entity, { count: run.count, out, base: run.base }, fakerSource(run.seed, run.referenceDate));
  const entries = collection.notes.map(note => ({ path: note.path, content: renderNote(note) }));
  if (collection.base) entries.push({ path: collection.base.path, content: renderBase(collection.base) });
  let total = 0;
  for (const entry of entries) {
    const bytes = Buffer.byteLength(entry.content);
    total += bytes;
    requireSketch(bytes <= noteLimit, 'FAKE_DATA_SIZE', `${entry.path} would exceed ${noteLimit} bytes; shorten the body template or generators.`);
  }
  requireSketch(total <= totalLimit, 'FAKE_DATA_SIZE', `The collection would exceed ${totalLimit} bytes; generate fewer notes.`);
  const plan = await createFilePlan(root, entries);
  const conflicts = plan.changes.filter(change => change.status !== 'create' && change.status !== 'unchanged').map(change => change.path);
  requireSketch(!conflicts.length, 'FAKE_DATA_CONFLICT', `${conflicts.length} note(s) already exist with different content, first ${conflicts[0]}. Nothing was overwritten; choose another folder or seed.`);
  const identity = { kind: 'fake-data', entity: run.ref, count: run.count, seed: run.seed, out, base: run.base, referenceDate: run.referenceDate };
  return prepared(plan, { ...identity, title: run.entity.title, files: entries.length, sample: { path: entries[0]!.path, content: entries[0]!.content } }, identity);
}
/** Saving a definition shows an existing file as an update in the review; nothing is replaced without approval. */
async function definitionPlan(root: string, path: string, content: string, data: Record<string, unknown>): Promise<Prepared> {
  return prepared(await createFilePlan(root, [{ path, content }]), { ...data, path }, { kind: 'fake-data-definition', path });
}
export function saveEntityPlan(root: string, entity: FakeEntity, catalog: FakeCatalog): Promise<Prepared> {
  const builtin = catalog.entities.get(entity.id)?.source === 'builtin';
  requireSketch(!builtin || catalog.shared, 'FAKE_DATA_DUPLICATE', `${entity.id} is a built-in entity id; choose another id.`);
  return definitionPlan(root, `${projectFakeData}/entities/${entity.id}.json`, fakeEntityJson(entity), { entity: entity.id });
}
export function saveGenerationPlan(root: string, generation: FakeGeneration, catalog: FakeCatalog): Promise<Prepared> {
  const builtin = catalog.generations.get(generation.id)?.source === 'builtin';
  requireSketch(!builtin || catalog.shared, 'FAKE_DATA_DUPLICATE', `${generation.id} is a built-in generation config id; choose another id.`);
  return definitionPlan(root, `${projectFakeData}/generations/${generation.id}.json`, fakeGenerationJson(generation), { config: generation.id });
}
