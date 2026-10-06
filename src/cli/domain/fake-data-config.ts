import { object, keys, text, list } from './data.ts';
import { requireSketch } from './errors.ts';
import { definitionId } from './form-model.ts';
import { fakeFolder, fakeId, readFakeEntity, type FakeEntity } from './fake-data-entity.ts';
import { validIsoDate } from './fake-data-generators.ts';
import { fakeLimits } from './fake-data.ts';
/** One reusable, seeded generation run. Re-running it reproduces byte-identical notes. */
export interface FakeGeneration {
  schemaVersion: 1; id: string; title: string; description?: string; entity: string; count: number; out: string; seed: number; base: boolean; referenceDate: string;
}
/** Faker's relative dates (past, soon, birthdate) are measured from this fixed day unless a run names another. */
export const defaultReferenceDate = '2026-01-01';
/**
 * An entity reference: a catalog id (built-in or project definition), `semantic:<id-or-slug>` for an entity of the
 * saved project (design/project.json), or `file:<relative.json>` for a definition file inside the project.
 */
export function readEntityRef(value: unknown, name = 'entity'): string {
  const ref = text(value, name, 220);
  if (ref.startsWith('semantic:')) requireSketch(/^semantic:[A-Za-z0-9_-]{1,80}$/.test(ref), 'FAKE_DATA_ENTITY', `${name} semantic:<id> needs a project entity id or slug.`);
  else if (ref.startsWith('file:')) requireSketch(ref.endsWith('.json') && fakeFolder(ref.slice(5), name), 'FAKE_DATA_ENTITY', `${name} file:<path> must name a relative .json definition.`);
  else requireSketch(definitionId.test(ref) && ref.length <= 60, 'FAKE_DATA_ENTITY', `${name} must be an entity id, semantic:<id> or file:<relative.json>.`);
  return ref;
}
export function fakeCount(value: unknown, name = 'count'): number {
  requireSketch(Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= fakeLimits.count, 'FAKE_DATA_COUNT', `${name} must be a whole number from 1 to ${fakeLimits.count}.`);
  return Number(value);
}
export function fakeSeed(value: unknown, name = 'seed'): number {
  requireSketch(Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= fakeLimits.seed, 'FAKE_DATA_SEED', `${name} must be a whole number from 0 to ${fakeLimits.seed}.`);
  return Number(value);
}
export function fakeReferenceDate(value: unknown): string {
  requireSketch(value === undefined || validIsoDate(value), 'FAKE_DATA_DATE', 'referenceDate must be a YYYY-MM-DD date.');
  return typeof value === 'string' ? value : defaultReferenceDate;
}
export function readFakeGeneration(value: unknown): FakeGeneration {
  const raw = object(value); keys(raw, ['$schema', 'schemaVersion', 'id', 'title', 'description', 'entity', 'count', 'out', 'seed', 'base', 'referenceDate']);
  requireSketch(raw.schemaVersion === 1, 'FAKE_DATA_VERSION', 'Unsupported generation config schemaVersion; expected 1.');
  const id = text(raw.id, 'id', 60);
  requireSketch(definitionId.test(id), 'FAKE_DATA_ID', 'id must be lowercase kebab-case.');
  requireSketch(raw.base === undefined || typeof raw.base === 'boolean', 'FAKE_DATA_BASE', 'base must be true or false.');
  const generation: FakeGeneration = { schemaVersion: 1, id, title: text(raw.title, 'title', 80), entity: readEntityRef(raw.entity), count: fakeCount(raw.count),
    out: fakeFolder(raw.out, 'out'), seed: fakeSeed(raw.seed), base: raw.base === true, referenceDate: fakeReferenceDate(raw.referenceDate) };
  if (raw.description !== undefined) generation.description = text(raw.description, 'description', 400);
  return generation;
}
export function fakeGenerationJson(generation: FakeGeneration): string {
  return JSON.stringify({ $schema: '../../schemas/fake-data-generation.schema.json', ...generation }, null, 2) + '\n';
}
const heuristics: ReadonlyArray<readonly [RegExp, string, Record<string, number>?]> = [
  [/e-?mail/i, 'internet.exampleEmail'], [/title|subject|summary/i, 'lorem.sentence', { min: 2, max: 5 }], [/name|owner|author|assignee/i, 'person.fullName'],
  [/city|place|location/i, 'location.city'], [/company|organi[sz]ation|client/i, 'company.name'], [/description|notes?|bio/i, 'lorem.sentence'],
];
function inferredGenerator(key: string, type: string): Record<string, unknown> {
  if (type === 'number') return { faker: 'number.int', args: { min: 0, max: 100 } };
  if (type === 'checkbox') return { faker: 'datatype.boolean' };
  if (type === 'date') return { faker: 'date.past', args: { years: 1 } };
  if (type === 'datetime') return { faker: 'date.recent', args: { days: 30 } };
  if (type === 'tags' || type === 'list') return { faker: 'lorem.word' };
  const match = heuristics.find(([pattern]) => pattern.test(key));
  return match ? { faker: match[1], ...(match[2] ? { args: match[2] } : {}) } : { faker: 'lorem.words' };
}
/** A generator-ready definition for an entity of the saved project, inferred from its typed properties and key names. */
export function inferFakeEntity(raw: unknown): FakeEntity {
  const entity = object(raw), name = text(entity.name, 'entity.name', 80);
  const rows = list(entity.properties ?? [], 'entity.properties', 40).map(item => object(item));
  const properties = rows.map(row => ({ key: row.key, type: row.type, required: row.required === true, generator: inferredGenerator(String(row.key), String(row.type)) }));
  let title = properties.find(item => item.type === 'text' && item.required) ?? properties.find(item => item.type === 'text');
  if (!title) {
    title = { key: properties.some(item => item.key === 'title') ? 'note_title' : 'title', type: 'text', required: true, generator: { faker: 'lorem.sentence', args: { min: 2, max: 5 } } };
    properties.unshift(title);
  }
  title.required = true;
  let folder: string;
  try { folder = fakeFolder(entity.folder, 'entity.folder'); } catch { folder = name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'Fake Data'; }
  const slugged = typeof entity.slug === 'string' && definitionId.test(entity.slug) ? entity.slug : fakeId(name);
  return readFakeEntity({ schemaVersion: 1, id: slugged, title: name, folder, titleProperty: title.key, properties,
    body: `# {{${String(title.key)}}}\n\nSample ${name} note generated from the project's semantic entity.\n` });
}
