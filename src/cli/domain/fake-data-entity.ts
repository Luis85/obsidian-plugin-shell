import { object, keys, text, list } from './data.ts';
import { hasControls, requireSketch, slug } from './errors.ts';
import { definitionId } from './form-model.ts';
import { fakerCall, fakePropertyTypes, validIsoDate, type FakeArgs, type FakePropertyType } from './fake-data-generators.ts';
export type FakeScalar = string | number | boolean;
/** Exactly one source per property: an allowlisted Faker call, a fixed choice list, a numbered sequence or a constant. */
export type FakeGenerator =
  | { faker: string; args: FakeArgs } | { choices: FakeScalar[] } | { sequence: string } | { value: FakeScalar | string[] };
export interface FakeProperty {
  key: string; label?: string; type: FakePropertyType; generator: FakeGenerator;
  required: boolean; unique: boolean; frontmatter: boolean; items?: { min: number; max: number };
}
export interface FakeEntity {
  schemaVersion: 1; id: string; title: string; description?: string; folder: string; titleProperty: string; properties: FakeProperty[]; body: string;
}
const reservedKeys = new Set(['constructor', 'prototype', '__proto__', 'tostring', 'valueof', 'hasownproperty']);
const propertyKey = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;
const listTypes = new Set<FakePropertyType>(['list', 'tags']);
export const bodyReference = /\{\{([^{}]*)\}\}/g;
const forbiddenSegment = /[\\:*?"<>|#^[\]]/;
const device = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
/**
 * A project-relative folder of portable segments: no traversal, device names or control characters. Hidden segments are
 * refused because Obsidian does not index them and they hold host configuration and version control.
 */
export function fakeFolder(value: unknown, name: string): string {
  const folder = text(value, name, 160);
  const parts = folder.split('/');
  requireSketch(folder === value && parts.length <= 8 && parts.every(part => part && !part.startsWith('.') && !forbiddenSegment.test(part)
    && !/[ .]$/.test(part) && !device.test(part) && part.toLowerCase() !== 'node_modules'),
  'FAKE_DATA_FOLDER', `${name} must be a relative folder such as "Fake Data/Contacts" without hidden or reserved names or the characters \\ : * ? " < > | # ^ [ ].`);
  return folder;
}
function scalarFor(type: FakePropertyType, value: unknown, name: string): FakeScalar {
  if (type === 'number') { requireSketch(typeof value === 'number' && Number.isFinite(value), 'FAKE_DATA_VALUE', `${name} must be a number.`); return value; }
  if (type === 'checkbox') { requireSketch(typeof value === 'boolean', 'FAKE_DATA_VALUE', `${name} must be true or false.`); return value; }
  const item = text(value, name, 200);
  requireSketch(type !== 'date' || validIsoDate(item), 'FAKE_DATA_VALUE', `${name} must be a YYYY-MM-DD date.`);
  requireSketch(type !== 'datetime' || /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/.test(item), 'FAKE_DATA_VALUE', `${name} must be a YYYY-MM-DDTHH:mm:ss date and time.`);
  return item;
}
function readGenerator(raw: unknown, type: FakePropertyType, name: string): FakeGenerator {
  const item = object(raw), kinds = ['faker', 'choices', 'sequence', 'value'].filter(key => item[key] !== undefined);
  requireSketch(kinds.length === 1, 'FAKE_DATA_GENERATOR', `${name} needs exactly one of faker, choices, sequence or value.`);
  keys(item, kinds[0] === 'faker' ? ['faker', 'args'] : kinds);
  if (item.faker !== undefined) return fakerCall(item.faker, item.args, type, name);
  const itemType = listTypes.has(type) ? 'text' : type;
  if (item.choices !== undefined) {
    const choices = list(item.choices, name + '.choices', 100).map((value, index) => scalarFor(itemType, value, `${name}.choices[${index}]`));
    requireSketch(choices.length > 0 && new Set(choices.map(String)).size === choices.length, 'FAKE_DATA_GENERATOR', `${name}.choices needs unique values.`);
    return { choices };
  }
  if (item.sequence !== undefined) {
    requireSketch(['text', 'link'].includes(type) && typeof item.sequence === 'string' && /^[A-Za-z0-9 _-]{0,40}$/.test(item.sequence), 'FAKE_DATA_GENERATOR', `${name}.sequence is a text or link prefix of letters, digits, spaces, _ or -.`);
    return { sequence: item.sequence };
  }
  if (listTypes.has(type)) return { value: list(item.value, name + '.value', 20).map((value, index) => text(value, `${name}.value[${index}]`, 200)) };
  return { value: scalarFor(type, item.value, name + '.value') };
}
function readItems(raw: unknown, type: FakePropertyType, name: string): { min: number; max: number } | undefined {
  if (raw === undefined) return listTypes.has(type) ? { min: 1, max: 3 } : undefined;
  requireSketch(listTypes.has(type), 'FAKE_DATA_PROPERTY', `${name}.items is only available for list and tags.`);
  const item = object(raw); keys(item, ['min', 'max']);
  requireSketch(Number.isSafeInteger(item.min) && Number.isSafeInteger(item.max) && Number(item.min) >= 0 && Number(item.min) <= Number(item.max) && Number(item.max) <= 20,
    'FAKE_DATA_PROPERTY', `${name}.items needs whole numbers 0 ≤ min ≤ max ≤ 20.`);
  return { min: Number(item.min), max: Number(item.max) };
}
function optionalBoolean(value: unknown, fallback: boolean, name: string): boolean {
  requireSketch(value === undefined || typeof value === 'boolean', 'FAKE_DATA_PROPERTY', `${name} must be true or false.`);
  return typeof value === 'boolean' ? value : fallback;
}
export function readFakeProperty(raw: unknown, name: string): FakeProperty {
  const item = object(raw); keys(item, ['key', 'label', 'type', 'generator', 'required', 'unique', 'frontmatter', 'items']);
  const key = text(item.key, name + '.key', 40);
  requireSketch(propertyKey.test(key) && !reservedKeys.has(key.toLowerCase()), 'FAKE_DATA_KEY', `${name}.key must start with a letter and use letters, digits, _ or - (not a reserved name).`);
  requireSketch(fakePropertyTypes.includes(item.type as FakePropertyType), 'FAKE_DATA_PROPERTY', `${name}.type must be one of ${fakePropertyTypes.join(', ')}.`);
  const type = item.type as FakePropertyType, generator = readGenerator(item.generator, type, `${name}.generator`);
  const unique = optionalBoolean(item.unique, false, name + '.unique');
  requireSketch(!unique || (!['checkbox', 'list', 'tags'].includes(type) && !('value' in generator)), 'FAKE_DATA_PROPERTY', `${name}.unique needs a varying generator and a single-value type.`);
  const property: FakeProperty = { key, type, generator, required: optionalBoolean(item.required, true, name + '.required'), unique,
    frontmatter: optionalBoolean(item.frontmatter, true, name + '.frontmatter') };
  if (item.label !== undefined) property.label = text(item.label, name + '.label', 80);
  const items = readItems(item.items, type, name);
  if (items) property.items = items;
  return property;
}
function readBody(value: unknown, keysInUse: ReadonlySet<string>, fallback: string): string {
  if (value === undefined) return fallback;
  requireSketch(typeof value === 'string' && value.length <= 4000 && !hasControls(value, true), 'FAKE_DATA_BODY', 'body must be Markdown text up to 4000 characters without control characters.');
  for (const match of value.matchAll(bodyReference)) requireSketch(keysInUse.has(match[1]!), 'FAKE_DATA_BODY', `body references {{${match[1]}}}, which is not a declared property.`);
  return value;
}
/** Structural validation of one entity definition; fails closed on any unknown key, method, argument or reference. */
export function readFakeEntity(value: unknown): FakeEntity {
  const raw = object(value); keys(raw, ['$schema', 'schemaVersion', 'id', 'title', 'description', 'folder', 'titleProperty', 'properties', 'body']);
  requireSketch(raw.schemaVersion === 1, 'FAKE_DATA_VERSION', 'Unsupported fake-data entity schemaVersion; expected 1.');
  const id = text(raw.id, 'id', 60);
  requireSketch(definitionId.test(id), 'FAKE_DATA_ID', 'id must be lowercase kebab-case.');
  const properties = list(raw.properties, 'properties', 40).map((item, index) => readFakeProperty(item, `properties[${index}]`));
  const names = new Set(properties.map(item => item.key));
  requireSketch(properties.length > 0 && new Set(properties.map(item => item.key.toLowerCase())).size === properties.length, 'FAKE_DATA_KEY', 'properties needs at least one property and unique keys (case-insensitive).');
  const titleProperty = text(raw.titleProperty, 'titleProperty', 40), named = properties.find(item => item.key === titleProperty);
  requireSketch(named && named.type === 'text' && named.required, 'FAKE_DATA_TITLE', 'titleProperty must name a required text property; its value names each note.');
  const entity: FakeEntity = { schemaVersion: 1, id, title: text(raw.title, 'title', 80), folder: fakeFolder(raw.folder, 'folder'), titleProperty, properties,
    body: readBody(raw.body, names, `# {{${titleProperty}}}\n`) };
  if (raw.description !== undefined) entity.description = text(raw.description, 'description', 400);
  return entity;
}
/** The canonical JSON form of a definition, ready for a reviewed save. */
export function fakeEntityJson(entity: FakeEntity, schema = '../../schemas/fake-data-entity.schema.json'): string {
  return JSON.stringify({ $schema: schema, ...entity }, null, 2) + '\n';
}
/** A kebab-case id derived from a human title, avoiding ids already in use. */
export const fakeId = (title: string, used: readonly string[] = []) => slug(title, 'entity', used);
