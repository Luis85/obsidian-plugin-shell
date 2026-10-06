import { hasControls, requireSketch, SketchError, slug } from '#shared/contracts/sketch-errors.ts';
import { bodyReference, type FakeEntity, type FakeProperty } from './fake-data-entity.ts';
import type { FakeArgs } from './fake-data-generators.ts';
/**
 * The only randomness generation may use: an allowlisted call and a bounded integer. The adapter binds both to one
 * seeded Faker instance with a fixed reference date, so one seed always yields the same notes.
 */
export interface FakeSource { call(method: string, args: FakeArgs): unknown; int(min: number, max: number): number }
export type FrontValue = string | number | boolean | string[];
export interface FakeNote { path: string; frontmatter: Record<string, FrontValue>; body: string }
export interface FakeBase { path: string; data: Record<string, unknown> }
export interface FakeCollection { notes: FakeNote[]; base?: FakeBase }
export interface FakeRequest { count: number; out: string; base: boolean }
export const fakeLimits = Object.freeze({ count: 1000, seed: 2147483647, uniqueAttempts: 100 });
/** Single-line text for frontmatter; body-only values keep their paragraph breaks. */
function textValue(raw: unknown, multiline: boolean): string {
  const value = raw instanceof Date ? raw.toISOString() : typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean' ? String(raw) : '';
  const cleaned = [...value.replace(/\r\n?/g, '\n')].filter(character => !hasControls(character, true)).join('');
  return multiline ? cleaned.trim().slice(0, 4000) : cleaned.replace(/\s+/g, ' ').trim().slice(0, 500);
}
/** Obsidian tags: letters, digits, _, - and /, never purely numeric. */
function tagValue(raw: unknown): string {
  const tag = textValue(raw, false).toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_/-]/gu, '').replace(/-{2,}/g, '-').replace(/^[-/]+|[-/]+$/g, '').slice(0, 40);
  return !tag || /^\d+$/.test(tag) ? 'tag-' + (tag || 'empty') : tag;
}
function dateValue(raw: unknown, time: boolean): string {
  if (typeof raw === 'string') return raw;
  requireSketch(raw instanceof Date && Number.isFinite(raw.getTime()), 'FAKE_DATA_VALUE', 'A date generator returned no date.');
  return raw.toISOString().slice(0, time ? 19 : 10);
}
function scalar(property: FakeProperty, raw: unknown): FrontValue {
  switch (property.type) {
    case 'number':
      requireSketch(typeof raw === 'number' && Number.isFinite(raw), 'FAKE_DATA_VALUE', `${property.key} needs a numeric generator.`); return raw;
    case 'checkbox':
      requireSketch(typeof raw === 'boolean', 'FAKE_DATA_VALUE', `${property.key} needs a yes/no generator.`); return raw;
    case 'date': case 'datetime': return dateValue(raw, property.type === 'datetime');
    case 'link': return `[[${textValue(raw, false).replace(/[[\]|#^]/g, '').trim() || property.key}]]`;
    default: return textValue(raw, !property.frontmatter);
  }
}
function draw(property: FakeProperty, source: FakeSource, index: number): unknown {
  const generator = property.generator;
  if ('faker' in generator) return source.call(generator.faker, generator.args);
  if ('choices' in generator) return generator.choices[source.int(0, generator.choices.length - 1)];
  if ('sequence' in generator) return generator.sequence + String(index + 1).padStart(4, '0');
  return generator.value;
}
function listValue(property: FakeProperty, source: FakeSource, index: number): string[] {
  const shape = property.type === 'tags' ? tagValue : (raw: unknown) => textValue(raw, false);
  if ('value' in property.generator && Array.isArray(property.generator.value)) return [...new Set(property.generator.value.map(shape))];
  const wanted = source.int(property.items!.min, property.items!.max), items = new Set<string>();
  for (let attempt = 0; items.size < wanted && attempt < wanted * 4; attempt++) {
    const item = shape(draw(property, source, index));
    if (item) items.add(item);
  }
  return [...items];
}
function valueOf(property: FakeProperty, source: FakeSource, index: number): FrontValue {
  return property.type === 'list' || property.type === 'tags' ? listValue(property, source, index) : scalar(property, draw(property, source, index));
}
function uniqueValue(property: FakeProperty, source: FakeSource, index: number, seen: Set<string>): FrontValue {
  for (let attempt = 0; attempt < fakeLimits.uniqueAttempts; attempt++) {
    const value = valueOf(property, source, index), identity = String(value).toLowerCase();
    if (!seen.has(identity)) { seen.add(identity); return value; }
  }
  throw new SketchError('FAKE_DATA_UNIQUE', `${property.key} produced only ${seen.size} different values. Lower the count, widen the generator or drop unique.`);
}
const display = (value: FrontValue | undefined) => value === undefined ? '' : Array.isArray(value) ? value.join(', ') : String(value);
/** Literal {{key}} substitution of generated values; nothing in a template is evaluated. */
export function renderBody(template: string, record: Readonly<Record<string, FrontValue>>): string {
  const body = template.replace(bodyReference, (_match, key: string) => display(Object.hasOwn(record, key) ? record[key] : undefined));
  return body.endsWith('\n') ? body : body + '\n';
}
function record(entity: FakeEntity, source: FakeSource, index: number, seen: Map<string, Set<string>>): Record<string, FrontValue> {
  const values: Record<string, FrontValue> = Object.create(null);
  for (const property of entity.properties) {
    // One in five optional values is left out entirely, so filters and empty states have something to show.
    if (!property.required && source.int(1, 5) === 1) continue;
    values[property.key] = property.unique ? uniqueValue(property, source, index, seen.get(property.key)!) : valueOf(property, source, index);
  }
  return values;
}
/** An Obsidian Bases table over the notes beside it; see docs/development/FAKE-DATA.md for the format. */
export function fakeBase(entity: FakeEntity, out: string): FakeBase {
  const shown = entity.properties.filter(item => item.frontmatter && /^[A-Za-z][A-Za-z0-9_]*$/.test(item.key));
  const properties = Object.fromEntries(shown.filter(item => item.label).map(item => ['note.' + item.key, { displayName: item.label }]));
  return { path: `${out}/${entity.id}.base`, data: {
    filters: { and: ['file.folder == this.file.folder', 'file.ext == "md"'] },
    ...(Object.keys(properties).length ? { properties } : {}),
    views: [{ type: 'table', name: entity.title, order: ['file.name', ...shown.map(item => 'note.' + item.key)] }],
  } };
}
/** Pure, deterministic generation of `count` notes with unique, slugged file names inside `out`. */
export function generateCollection(entity: FakeEntity, request: FakeRequest, source: FakeSource): FakeCollection {
  requireSketch(Number.isSafeInteger(request.count) && request.count >= 1 && request.count <= fakeLimits.count, 'FAKE_DATA_COUNT', `Generate between 1 and ${fakeLimits.count} notes.`);
  const seen = new Map(entity.properties.filter(item => item.unique).map(item => [item.key, new Set<string>()]));
  const names: string[] = [], notes: FakeNote[] = [];
  for (let index = 0; index < request.count; index++) {
    const values = record(entity, source, index, seen);
    const name = slug(display(values[entity.titleProperty]), entity.id, names);
    names.push(name);
    const frontmatter: Record<string, FrontValue> = {};
    for (const property of entity.properties) if (property.frontmatter && Object.hasOwn(values, property.key)) frontmatter[property.key] = values[property.key]!;
    notes.push({ path: `${request.out}/${name}.md`, frontmatter, body: renderBody(entity.body, values) });
  }
  return { notes, ...(request.base ? { base: fakeBase(entity, request.out) } : {}) };
}
