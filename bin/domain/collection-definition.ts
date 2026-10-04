import { object, keys, text, list } from './data.ts';
import { requireSketch } from './errors.ts';
import { definitionId, fieldId } from './form-model.ts';
import { collectionPathKeys, type CollectionPathKey } from './user-settings.ts';
/**
 * A typed-note collection described as data (configs/collections/<id>.json): one Markdown note per item with
 * `type: <type>` frontmatter, a stable `<PREFIX><digits>` id, a status workflow, typed fields, a body template and a
 * generated register. Code adds only what data cannot express, through one named CollectionHook.
 */
export type CollectionFieldKind = 'text' | 'date' | 'integer' | 'choice' | 'list';
/** input: answered by people; derived: computed by the hook; stamp: dated by the engine (status stamp or review). */
export type CollectionFieldSource = 'input' | 'derived' | 'stamp';
export interface CollectionChoice { id: string; label: string }
export interface CollectionField {
  key: string; input: string; label: string; kind: CollectionFieldKind; source: CollectionFieldSource; required: boolean;
  requiredWhenOpen: boolean; frontmatter: boolean; multiline: boolean; overdue: boolean; maxLength: number; vocabulary?: string; default?: 'today';
  /** Text or list items must be ids of this form, for example `RISK-` for references to risk notes (`RISK-0001`). */
  idPrefix?: string;
}
export interface CollectionStatus { id: string; label: string; open: boolean; transitions: string[]; stamp?: string }
export interface CollectionSort { key: string; order: 'asc' | 'desc' }
export interface CollectionMatch { key: string; in: string[] }
export interface CollectionDefinition {
  schemaVersion: 1; id: string; title: string; description?: string; type: string; pathKey: CollectionPathKey;
  idPrefix: string; idDigits: number; titleField: string; hook?: string;
  forms: { edit: string; review?: string }; wizards: { new: string; edit: string; review?: string };
  statuses: CollectionStatus[]; initialStatus: string; vocabularies: Record<string, CollectionChoice[]>; fields: CollectionField[]; body: string;
  list: { columns: string[] }; report: { file: string; title: string; columns: string[]; sort: CollectionSort[]; base?: string };
  review?: { stamp: string; match: CollectionMatch[]; overdue: boolean }; model?: Record<string, unknown>;
}
/** Engine-owned frontmatter; a definition cannot redefine these keys. */
const collectionSystemKeys: readonly string[] = ['type', 'id', 'status', 'created', 'updated', 'schema_version'];
const keyPattern = /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/, choiceId = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/, fileName = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,79}$/;
const kinds: readonly CollectionFieldKind[] = ['text', 'date', 'integer', 'choice', 'list'];
const sources: readonly CollectionFieldSource[] = ['input', 'derived', 'stamp'];
/** `next-action` → `nextAction`: the JSON input, form binding and body template name of a frontmatter key. */
export const collectionInputName = (key: string) => key.replace(/[-_]([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase());
const flag = (value: unknown, name: string, fallback = false): boolean => {
  requireSketch(value === undefined || typeof value === 'boolean', 'COLLECTION_DEFINITION', `${name} must be true or false.`);
  return value ?? fallback;
};
function identifier(value: unknown, name: string, pattern: RegExp): string {
  const id = text(value, name, 80);
  requireSketch(pattern.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id), 'COLLECTION_DEFINITION', `${name} is not a valid identifier.`);
  return id;
}
function unique(values: readonly string[], name: string): void {
  requireSketch(new Set(values.map(value => value.toLowerCase())).size === values.length, 'COLLECTION_DEFINITION', `${name} must be unique.`);
}
function vocabularies(value: unknown): Record<string, CollectionChoice[]> {
  const result: Record<string, CollectionChoice[]> = Object.create(null);
  for (const [name, items] of Object.entries(object(value))) {
    identifier(name, 'vocabulary name', keyPattern);
    result[name] = list(items, `vocabularies.${name}`, 60).map((raw, index) => {
      const item = object(raw); keys(item, ['id', 'label']);
      return { id: identifier(item.id, `vocabularies.${name}[${index}].id`, choiceId), label: text(item.label, `vocabularies.${name}[${index}].label`, 80) };
    });
    requireSketch(result[name]!.length > 0, 'COLLECTION_DEFINITION', `vocabularies.${name} needs at least one entry.`);
    unique(result[name]!.map(item => item.id), `vocabularies.${name} ids`);
  }
  return result;
}
function fieldIdentity(field: CollectionField, name: string): void {
  requireSketch(!collectionSystemKeys.includes(field.key), 'COLLECTION_DEFINITION', `${name}: ${field.key} is an engine-owned property.`);
  requireSketch(fieldId.test(field.input), 'COLLECTION_DEFINITION', `${name}: ${field.key} has no portable input name.`);
}
function fieldShape(field: CollectionField, name: string, vocab: Record<string, CollectionChoice[]>): void {
  fieldIdentity(field, name);
  fieldVocabulary(field, name, vocab);
  requireSketch((field.default === undefined && !field.overdue) || field.kind === 'date', 'COLLECTION_DEFINITION', `${name}: default today and overdue apply to dates only.`);
  requireSketch(field.frontmatter || (field.kind === 'text' && field.source === 'input'), 'COLLECTION_DEFINITION', `${name}: body-only values are input text.`);
  requireSketch(field.source !== 'stamp' || (field.kind === 'date' && !field.required), 'COLLECTION_DEFINITION', `${name}: a stamp is an optional date.`);
  requireSketch(!field.idPrefix || (['text', 'list'].includes(field.kind) && !field.vocabulary && field.frontmatter), 'COLLECTION_DEFINITION', `${name}: idPrefix applies to frontmatter text and list fields without a vocabulary.`);
}
function fieldVocabulary(field: CollectionField, name: string, vocab: Record<string, CollectionChoice[]>): void {
  requireSketch(field.kind !== 'choice' || field.vocabulary !== undefined, 'COLLECTION_DEFINITION', `${name}: a choice needs a vocabulary.`);
  requireSketch(field.vocabulary === undefined || (Object.hasOwn(vocab, field.vocabulary) && ['choice', 'integer', 'list'].includes(field.kind)), 'COLLECTION_DEFINITION', `${name}: unknown or unsupported vocabulary.`);
  requireSketch(field.kind !== 'integer' || !field.vocabulary || vocab[field.vocabulary]!.every(item => /^-?\d{1,9}$/.test(item.id)), 'COLLECTION_DEFINITION', `${name}: an integer vocabulary needs whole-number ids.`);
}
/** Collection id prefixes: upper-case letters and digits ending in `-`, for example `RISK-`. */
const idPrefixPattern = /^[A-Z][A-Z0-9]{0,9}-$/;
function idPrefixOf(value: unknown, name: string): string {
  requireSketch(typeof value === 'string' && idPrefixPattern.test(value), 'COLLECTION_DEFINITION', `${name} is upper-case letters and digits ending in -, for example RISK-.`);
  return value;
}
/** The optional vocabulary, default and id-reference parts of a field, present only when declared. */
function optionalFieldParts(item: Record<string, unknown>, name: string): Pick<CollectionField, 'vocabulary' | 'default' | 'idPrefix'> {
  return { ...(item.vocabulary === undefined ? {} : { vocabulary: identifier(item.vocabulary, name + '.vocabulary', keyPattern) }),
    ...(item.default === undefined ? {} : { default: 'today' as const }), ...(item.idPrefix === undefined ? {} : { idPrefix: idPrefixOf(item.idPrefix, name + '.idPrefix') }) };
}
function readField(raw: unknown, index: number, vocab: Record<string, CollectionChoice[]>): CollectionField {
  const item = object(raw), name = `fields[${index}]`;
  keys(item, ['key', 'label', 'kind', 'source', 'required', 'requiredWhenOpen', 'frontmatter', 'multiline', 'overdue', 'maxLength', 'vocabulary', 'default', 'idPrefix']);
  const key = identifier(item.key, name + '.key', keyPattern);
  requireSketch(kinds.includes(item.kind as CollectionFieldKind), 'COLLECTION_DEFINITION', `${name}.kind must be ${kinds.join(', ')}.`);
  requireSketch(item.source === undefined || sources.includes(item.source as CollectionFieldSource), 'COLLECTION_DEFINITION', `${name}.source must be ${sources.join(', ')}.`);
  requireSketch(item.default === undefined || item.default === 'today', 'COLLECTION_DEFINITION', `${name}.default can only be today.`);
  requireSketch(item.maxLength === undefined || (Number.isSafeInteger(item.maxLength) && Number(item.maxLength) >= 1 && Number(item.maxLength) <= 8000), 'COLLECTION_DEFINITION', `${name}.maxLength must be 1–8000.`);
  const field: CollectionField = { key, input: collectionInputName(key), label: text(item.label, name + '.label', 80), kind: item.kind as CollectionFieldKind,
    source: (item.source ?? 'input') as CollectionFieldSource, required: flag(item.required, name + '.required'), requiredWhenOpen: flag(item.requiredWhenOpen, name + '.requiredWhenOpen'),
    frontmatter: flag(item.frontmatter, name + '.frontmatter', true), multiline: flag(item.multiline, name + '.multiline'), overdue: flag(item.overdue, name + '.overdue'),
    maxLength: Number(item.maxLength ?? 500), ...optionalFieldParts(item, name) };
  fieldShape(field, name, vocab);
  return field;
}
function readStatuses(value: unknown, fields: readonly CollectionField[]): CollectionStatus[] {
  const statuses = list(value, 'statuses', 30).map((raw, index) => {
    const item = object(raw), name = `statuses[${index}]`; keys(item, ['id', 'label', 'open', 'transitions', 'stamp']);
    requireSketch(typeof item.open === 'boolean', 'COLLECTION_DEFINITION', `${name}.open must be true or false.`);
    const stamp = item.stamp === undefined ? undefined : identifier(item.stamp, name + '.stamp', keyPattern);
    requireSketch(stamp === undefined || fields.some(field => field.key === stamp && field.source === 'stamp'), 'COLLECTION_DEFINITION', `${name}.stamp must name a stamp field.`);
    return { id: identifier(item.id, name + '.id', choiceId), label: text(item.label, name + '.label', 80), open: item.open,
      transitions: list(item.transitions, name + '.transitions', 30).map(entry => identifier(entry, name + '.transitions', choiceId)), ...(stamp ? { stamp } : {}) };
  });
  requireSketch(statuses.length > 0, 'COLLECTION_DEFINITION', 'A collection needs at least one status.');
  unique(statuses.map(status => status.id), 'status ids');
  for (const status of statuses) {
    unique(status.transitions, `${status.id} transitions`);
    requireSketch(status.transitions.every(target => target !== status.id && statuses.some(other => other.id === target)), 'COLLECTION_DEFINITION', `${status.id} transitions must name other statuses.`);
  }
  return statuses;
}
function readSort(value: unknown, known: (key: string) => boolean): CollectionSort[] {
  return list(value ?? [], 'report.sort', 6).map(raw => {
    const item = object(raw); keys(item, ['key', 'order']);
    requireSketch(known(String(item.key)) && (item.order === 'asc' || item.order === 'desc'), 'COLLECTION_DEFINITION', 'report.sort needs known keys and asc or desc.');
    return { key: String(item.key), order: item.order };
  });
}
function columns(value: unknown, name: string, known: (key: string) => boolean): string[] {
  const result = list(value, name, 16).map(item => text(item, name, 40));
  requireSketch(result.length > 0 && result.every(known), 'COLLECTION_DEFINITION', `${name} must name system or frontmatter fields.`);
  return result;
}
function readReview(value: unknown, fields: readonly CollectionField[], vocab: Record<string, CollectionChoice[]>): CollectionDefinition['review'] {
  if (value === undefined) return undefined;
  const item = object(value); keys(item, ['stamp', 'match', 'overdue']);
  const stamp = text(item.stamp, 'review.stamp', 40);
  requireSketch(fields.some(field => field.key === stamp && field.source === 'stamp'), 'COLLECTION_DEFINITION', 'review.stamp must name a stamp field.');
  const match = list(item.match ?? [], 'review.match', 8).map(raw => {
    const rule = object(raw); keys(rule, ['key', 'in']);
    const field = fields.find(entry => entry.key === rule.key && entry.kind === 'choice');
    const values = list(rule.in, 'review.match.in', 30).map(entry => text(entry, 'review.match.in', 40));
    requireSketch(field && values.every(entry => vocab[field.vocabulary!]!.some(choice => choice.id === entry)), 'COLLECTION_DEFINITION', 'review.match needs a choice field and its values.');
    return { key: field.key, in: values };
  });
  return { stamp, match, overdue: flag(item.overdue, 'review.overdue') };
}
function ids(value: unknown, name: string, required: readonly string[], optional: readonly string[]): Record<string, string> {
  const item = object(value); keys(item, [...required, ...optional]);
  for (const key of required) requireSketch(item[key] !== undefined, 'COLLECTION_DEFINITION', `${name}.${key} is required.`);
  return Object.fromEntries(Object.entries(item).map(([key, entry]) => [key, identifier(entry, `${name}.${key}`, definitionId)]));
}
function bodyTemplate(value: unknown, fields: readonly CollectionField[]): string {
  const body = text(value, 'body', 8000);
  for (const [, name] of body.matchAll(/\{\{([^}|]*)(?:\|[^}]*)?\}\}/g))
    requireSketch(fields.some(field => field.input === name && field.source === 'input'), 'COLLECTION_DEFINITION', `body references unknown input ${name}.`);
  return body;
}
function reportOf(value: unknown, known: (key: string) => boolean): CollectionDefinition['report'] {
  const item = object(value); keys(item, ['file', 'title', 'columns', 'sort', 'base']);
  const file = text(item.file, 'report.file', 80), base = item.base === undefined ? undefined : text(item.base, 'report.base', 80);
  requireSketch(fileName.test(file) && file.endsWith('.md') && (base === undefined || (fileName.test(base) && base.endsWith('.base'))), 'COLLECTION_DEFINITION', 'report.file is a .md and report.base a .base file name.');
  return { file, title: text(item.title, 'report.title', 120), columns: columns(item.columns, 'report.columns', known), sort: readSort(item.sort, known), ...(base ? { base } : {}) };
}
type Header = Pick<CollectionDefinition, 'schemaVersion' | 'id' | 'title' | 'description' | 'type' | 'pathKey' | 'idPrefix' | 'idDigits' | 'hook'>;
/** Identity, folder key, id format and hook name. */
function header(raw: Record<string, unknown>, fields: readonly CollectionField[]): Header {
  requireSketch(raw.schemaVersion === 1, 'COLLECTION_VERSION', 'Expected collection schemaVersion 1.');
  requireSketch(collectionPathKeys.includes(raw.pathKey as CollectionPathKey), 'COLLECTION_DEFINITION', `pathKey must be one of ${collectionPathKeys.join(', ')} (bin/domain/user-settings.ts).`);
  requireSketch(typeof raw.idPrefix === 'string' && idPrefixPattern.test(raw.idPrefix), 'COLLECTION_DEFINITION', 'idPrefix is upper-case letters and digits ending in -, for example RISK-.');
  requireSketch(Number.isSafeInteger(raw.idDigits) && Number(raw.idDigits) >= 3 && Number(raw.idDigits) <= 8, 'COLLECTION_DEFINITION', 'idDigits must be 3–8.');
  requireSketch(raw.hook !== undefined || fields.every(field => field.source !== 'derived'), 'COLLECTION_DEFINITION', 'Derived fields need a hook.');
  const hook = raw.hook === undefined ? undefined : identifier(raw.hook, 'hook', /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/);
  const description = raw.description === undefined ? undefined : text(raw.description, 'description', 2000);
  return { schemaVersion: 1, id: identifier(raw.id, 'id', definitionId), title: text(raw.title, 'title', 120), ...(description ? { description } : {}),
    type: identifier(raw.type, 'type', /^[A-Za-z][A-Za-z0-9 -]{0,39}$/), pathKey: raw.pathKey as CollectionPathKey, idPrefix: raw.idPrefix, idDigits: Number(raw.idDigits), ...(hook ? { hook } : {}) };
}
/** Structural, fail-closed validation of a collection definition; the named hook validates `model` separately. */
export function readCollectionDefinition(value: unknown): CollectionDefinition {
  const raw = object(value);
  keys(raw, ['$schema', 'schemaVersion', 'id', 'title', 'description', 'type', 'pathKey', 'idPrefix', 'idDigits', 'titleField', 'hook', 'forms', 'wizards',
    'statuses', 'initialStatus', 'vocabularies', 'fields', 'body', 'list', 'report', 'review', 'model']);
  const vocab = vocabularies(raw.vocabularies ?? {});
  const fields = list(raw.fields, 'fields', 40).map((item, index) => readField(item, index, vocab));
  unique(fields.map(field => field.key), 'field keys'); unique(fields.map(field => field.input), 'field input names');
  const head = header(raw, fields), statuses = readStatuses(raw.statuses, fields);
  const known = (key: string) => collectionSystemKeys.includes(key) || fields.some(field => field.key === key && field.frontmatter);
  const titleField = text(raw.titleField, 'titleField', 40), initialStatus = text(raw.initialStatus, 'initialStatus', 40);
  requireSketch(fields.some(field => field.key === titleField && field.kind === 'text' && field.required && field.source === 'input' && field.frontmatter), 'COLLECTION_DEFINITION', 'titleField must name a required input text field.');
  requireSketch(statuses.some(status => status.id === initialStatus), 'COLLECTION_DEFINITION', 'initialStatus must name a status.');
  const listing = object(raw.list); keys(listing, ['columns']);
  const review = readReview(raw.review, fields, vocab);
  return { ...head, titleField,
    forms: ids(raw.forms, 'forms', ['edit'], ['review']) as CollectionDefinition['forms'], wizards: ids(raw.wizards, 'wizards', ['new', 'edit'], ['review']) as CollectionDefinition['wizards'],
    statuses, initialStatus, vocabularies: vocab, fields, body: bodyTemplate(raw.body, fields), list: { columns: columns(listing.columns, 'list.columns', known) },
    report: reportOf(raw.report, known), ...(review ? { review } : {}), ...(raw.model === undefined ? {} : { model: object(raw.model) }) };
}
/** The frontmatter field with this key, if the definition declares one. */
export const collectionField = (definition: CollectionDefinition, key: string) => definition.fields.find(field => field.key === key);
export const collectionStatus = (definition: CollectionDefinition, id: string) => definition.statuses.find(status => status.id === id);
