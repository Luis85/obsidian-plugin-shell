import { object } from './data.ts';
import { hasControls, requireSketch, SketchError } from '#shared/contracts/sketch-errors.ts';
import { renderText } from './form-model.ts';
import { collectionStatus, type CollectionDefinition, type CollectionField } from './collection-definition.ts';
import { collectionAcceptsText, collectionReferenceOk } from './collection-reference.ts';
/** Frontmatter values the engine writes: text, dates and choices as strings, integers as numbers, lists as string arrays. */
export type CollectionValue = string | number | string[];
export type CollectionValues = Record<string, CollectionValue>;
export interface CollectionIssue { severity: 'error' | 'warning'; code: string; message: string; path?: string; id?: string }
/**
 * The only collection code a definition can name (`hook`): validation of its `model` section, derived fields and
 * an optional extra register section. Hooks are pure; they never read files.
 */
export interface CollectionHook {
  readModel(definition: CollectionDefinition): void;
  derive(values: Readonly<CollectionValues>, definition: CollectionDefinition): CollectionValues;
  report?(records: readonly CollectionRecord[], definition: CollectionDefinition): string;
}
/** One readable note: `values` holds every valid frontmatter field plus derived values computed when absent. */
export interface CollectionRecord { id: string; status: string; title: string; values: CollectionValues }
export type CollectionReading = { kind: 'ignored' } | { kind: 'future'; issues: CollectionIssue[] } | { kind: 'note'; record: CollectionRecord; issues: CollectionIssue[] };
/** A real calendar date written as YYYY-MM-DD. */
export function isCollectionDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
const issue = (severity: CollectionIssue['severity'], code: string, message: string): CollectionIssue => ({ severity, code, message });
const choices = (definition: CollectionDefinition, field: CollectionField) => field.vocabulary ? definition.vocabularies[field.vocabulary]! : undefined;
function textValue(field: CollectionField, raw: unknown): string {
  requireSketch(typeof raw === 'string' && raw.trim().length > 0 && raw.length <= field.maxLength && !hasControls(raw, field.multiline),
    'COLLECTION_VALUE', `${field.key} needs ${field.multiline ? '' : 'single-line '}text of 1–${field.maxLength} characters.`);
  const value = raw.trim();
  // The prefix is validated as upper-case letters, digits and a final '-', so it is literal inside the pattern.
  requireSketch(!field.idPrefix || new RegExp(`^${field.idPrefix}\\d{3,9}$`).test(value), 'COLLECTION_VALUE', `${field.key} must name ids like ${field.idPrefix}0001.`);
  requireSketch(!field.accepts || collectionReferenceOk(field.accepts, value), 'COLLECTION_VALUE', `${field.key} must name ${collectionAcceptsText(field.accepts ?? [])}.`);
  return value;
}
/** One stored or supplied value, validated against its field and vocabulary. */
export function collectionValue(definition: CollectionDefinition, field: CollectionField, raw: unknown): CollectionValue {
  const allowed = choices(definition, field);
  const member = (value: string) => !allowed || allowed.some(item => item.id === value);
  switch (field.kind) {
    case 'date': requireSketch(isCollectionDate(raw), 'COLLECTION_VALUE', `${field.key} must be a date written as YYYY-MM-DD.`); return raw;
    case 'integer':
      requireSketch(Number.isSafeInteger(raw) && member(String(raw)), 'COLLECTION_VALUE', `${field.key} must be ${allowed ? 'one of ' + allowed.map(item => item.id).join(', ') : 'a whole number'}.`);
      return Number(raw);
    case 'choice':
      requireSketch(typeof raw === 'string' && member(raw), 'COLLECTION_VALUE', `${field.key} must be one of ${allowed!.map(item => item.id).join(', ')}.`); return raw;
    case 'list': {
      requireSketch(Array.isArray(raw) && raw.length <= 60, 'COLLECTION_VALUE', `${field.key} must be a list of at most 60 items.`);
      const items = raw.map(item => textValue(field, item));
      requireSketch(items.every(member), 'COLLECTION_VALUE', `${field.key} items must be offered values.`);
      return [...new Set(items)];
    }
    default: return textValue(field, raw);
  }
}
const message = (error: unknown) => error instanceof Error ? error.message : 'Invalid value.';
const collectionIdPattern = (definition: CollectionDefinition) => new RegExp(`^${definition.idPrefix}\\d{${definition.idDigits},9}$`);
function systemIssues(definition: CollectionDefinition, properties: Record<string, unknown>, issues: CollectionIssue[]): { id: string; status: string } {
  const id = typeof properties.id === 'string' && collectionIdPattern(definition).test(properties.id) ? properties.id : '';
  if (!id) issues.push(issue('error', 'COLLECTION_ID', `id must look like ${definition.idPrefix}${'0'.repeat(definition.idDigits - 1)}1.`));
  const status = typeof properties.status === 'string' && collectionStatus(definition, properties.status) ? properties.status : '';
  if (!status) issues.push(issue('error', 'COLLECTION_STATUS', `status must be one of ${definition.statuses.map(item => item.id).join(', ')}.`));
  for (const key of ['created', 'updated']) if (!isCollectionDate(properties[key])) issues.push(issue('error', 'COLLECTION_VALUE', `${key} must be a date written as YYYY-MM-DD.`));
  return { id, status };
}
function derivedIssues(definition: CollectionDefinition, hook: CollectionHook | undefined, values: CollectionValues, issues: CollectionIssue[]): void {
  if (!hook) return;
  for (const [key, value] of Object.entries(hook.derive(values, definition))) {
    if (values[key] === undefined) values[key] = value;
    else if (JSON.stringify(values[key]) !== JSON.stringify(value)) issues.push(issue('error', 'COLLECTION_DERIVED', `${key} is ${JSON.stringify(values[key])} but the model derives ${JSON.stringify(value)}.`));
  }
}
/**
 * Read one note's frontmatter. Notes of another type are ignored; a newer schema_version is reported as future and
 * left alone. Every other problem is an issue, never an exception, so one bad note cannot hide the rest.
 */
export function readCollectionRecord(definition: CollectionDefinition, hook: CollectionHook | undefined, properties: Record<string, unknown>): CollectionReading {
  if (properties.type !== definition.type) return { kind: 'ignored' };
  const version = properties.schema_version;
  if (typeof version === 'number' && version > 1) return { kind: 'future', issues: [issue('error', 'COLLECTION_FUTURE', `schema_version ${version} is newer than this tool; the note is preserved and read-only.`)] };
  const issues: CollectionIssue[] = [];
  if (version !== undefined && version !== 1) issues.push(issue('error', 'COLLECTION_VERSION', 'schema_version must be 1.'));
  const { id, status } = systemIssues(definition, properties, issues);
  const values = fieldValues(definition, properties, collectionStatus(definition, status)?.open === true, issues);
  derivedIssues(definition, hook, values, issues);
  const title = values[definition.titleField];
  return { kind: 'note', record: { id, status, title: typeof title === 'string' ? title : '', values }, issues };
}
function missingIssue(definition: CollectionDefinition, field: CollectionField, open: boolean): CollectionIssue | undefined {
  if (field.required) return issue('error', 'COLLECTION_REQUIRED', `${field.key} is required.`);
  return field.requiredWhenOpen && open ? issue('warning', 'COLLECTION_OPEN_FIELD', `${field.key} is missing on an open ${definition.type.toLowerCase()}.`) : undefined;
}
function fieldValues(definition: CollectionDefinition, properties: Record<string, unknown>, open: boolean, issues: CollectionIssue[]): CollectionValues {
  const values: CollectionValues = Object.create(null);
  for (const key of ['created', 'updated']) if (isCollectionDate(properties[key])) values[key] = properties[key];
  for (const field of definition.fields.filter(item => item.frontmatter)) {
    const raw = properties[field.key];
    if (raw === undefined || raw === null) { const found = missingIssue(definition, field, open); if (found) issues.push(found); continue; }
    try { values[field.key] = collectionValue(definition, field, raw); }
    catch (error) { issues.push(issue('error', 'COLLECTION_VALUE', message(error))); }
  }
  return values;
}
interface Parsed { status?: string; values: Record<string, CollectionValue | null> }
/** A status people may choose; managed statuses (for example a release item included in a release candidate) are refused. */
function inputStatus(definition: CollectionDefinition, raw: unknown): string {
  const people = definition.statuses.filter(item => !item.managed);
  const status = typeof raw === 'string' ? collectionStatus(definition, raw) : undefined;
  requireSketch(status, 'COLLECTION_STATUS', `status must be one of ${people.map(item => item.id).join(', ')}.`);
  requireSketch(!status.managed, 'COLLECTION_MANAGED', `${status.id} is set by another tool's reviewed plan, not by ${definition.id} input; use one of ${people.map(item => item.id).join(', ')}.`);
  return status.id;
}
/** JSON or form input keyed by input names (`nextAction`); `''`, `[]` and (for updates) `null` mean no value. */
function readInput(definition: CollectionDefinition, input: unknown, mode: 'create' | 'update'): Parsed {
  const raw = object(input), result: Parsed = { values: Object.create(null) };
  const fields = definition.fields.filter(field => field.source === 'input' && (mode === 'create' || field.frontmatter));
  const unknown = Object.keys(raw).filter(key => key !== 'status' && !fields.some(field => field.input === key));
  requireSketch(!unknown.length, 'COLLECTION_INPUT', `Unknown input ${unknown.join(', ')}; use ${['status', ...fields.map(field => field.input)].join(', ')}.`);
  if (raw.status !== undefined) result.status = inputStatus(definition, raw.status);
  for (const field of fields) {
    const value = raw[field.input];
    if (value === undefined) continue;
    const empty = value === null || value === '' || (Array.isArray(value) && value.length === 0);
    requireSketch(!(value === null && mode === 'create'), 'COLLECTION_INPUT', `${field.input} cannot be null in a new note.`);
    result.values[field.key] = empty ? null : collectionValue(definition, field, value);
  }
  return result;
}
function completeness(definition: CollectionDefinition, values: CollectionValues, status: string): void {
  const open = collectionStatus(definition, status)!.open;
  const missing = definition.fields.filter(field => field.frontmatter && values[field.key] === undefined && (field.required || (open && field.requiredWhenOpen)));
  requireSketch(!missing.length, 'COLLECTION_REQUIRED', `Missing ${missing.map(field => field.input).join(', ')}${open ? ` (required while ${status})` : ''}.`);
}
function withDerived(definition: CollectionDefinition, hook: CollectionHook | undefined, values: CollectionValues): CollectionValues {
  for (const field of definition.fields) if (field.source === 'derived') delete values[field.key];
  return hook ? Object.assign(values, hook.derive(values, definition)) : values;
}
/** Engine-owned keys first, then the definition's fields in order, then schema_version. */
function ordered(definition: CollectionDefinition, id: string, status: string, created: string, updated: string, values: CollectionValues): CollectionValues {
  const result: CollectionValues = { type: definition.type, id, [definition.titleField]: values[definition.titleField]!, status, created, updated };
  for (const field of definition.fields) if (field.frontmatter && values[field.key] !== undefined) result[field.key] = values[field.key]!;
  result.schema_version = 1;
  return result;
}
/** A complete new note: validated input, defaults, status stamp, derived values and the rendered body template. */
export function collectionCreate(definition: CollectionDefinition, hook: CollectionHook | undefined, input: unknown, id: string, asOf: string): { frontmatter: CollectionValues; body: string } {
  const parsed = readInput(definition, input, 'create'), status = parsed.status ?? definition.initialStatus;
  const values: CollectionValues = Object.create(null), body: Record<string, CollectionValue> = Object.create(null);
  for (const field of definition.fields) {
    const value = parsed.values[field.key] ?? (field.default === 'today' ? asOf : undefined);
    if (value === undefined || value === null) continue;
    if (field.frontmatter) values[field.key] = value;
    body[field.input] = value;
  }
  const stamp = collectionStatus(definition, status)!.stamp;
  if (stamp) values[stamp] = asOf;
  withDerived(definition, hook, values);
  completeness(definition, values, status);
  return { frontmatter: ordered(definition, id, status, asOf, asOf, values), body: renderText(definition.body, body).replace(/\n*$/, '\n') };
}
export interface CollectionChange { values: CollectionValues; status: string; removed: string[] }
/** Leaving a status removes its stamp; entering one dates its stamp. */
function stampChange(definition: CollectionDefinition, from: string, to: string, values: CollectionValues, asOf: string): void {
  if (to === from) return;
  const current = collectionStatus(definition, from)!, next = collectionStatus(definition, to)!;
  if (current.stamp && current.stamp !== next.stamp) delete values[current.stamp];
  if (next.stamp) values[next.stamp] = asOf;
}
function statusChange(definition: CollectionDefinition, from: string, to: string, values: CollectionValues, asOf: string): void {
  const current = collectionStatus(definition, from)!;
  requireSketch(to === from || current.transitions.includes(to), 'COLLECTION_TRANSITION', `${from} → ${to} is not allowed; from ${from} use ${current.transitions.join(', ') || 'no other status'}.`);
  stampChange(definition, from, to, values, asOf);
}
/** Derived values, completeness, `updated` and the owned keys that disappeared, shared by people's and managed changes. */
function finishChange(definition: CollectionDefinition, hook: CollectionHook | undefined, record: CollectionRecord, values: CollectionValues, status: string, asOf: string): CollectionChange {
  withDerived(definition, hook, values);
  completeness(definition, values, status);
  const owned = definition.fields.filter(field => field.frontmatter).map(field => field.key);
  return { values: { ...values, status, updated: asOf }, status, removed: owned.filter(key => values[key] === undefined && record.values[key] !== undefined) };
}
/**
 * The complete next frontmatter of an existing, valid note: changed inputs, a checked status transition, stamps,
 * recomputed derived values and `updated`. Keys the definition does not own are never touched by the caller.
 */
export function collectionUpdate(definition: CollectionDefinition, hook: CollectionHook | undefined, record: CollectionRecord, input: unknown, asOf: string, review = false): CollectionChange {
  requireSketch(!review || definition.review, 'COLLECTION_REVIEW', `${definition.id} defines no review.`);
  const parsed = readInput(definition, input, 'update'), values: CollectionValues = { ...record.values };
  const changed = Object.entries(parsed.values).filter(([key, value]) => JSON.stringify(value ?? undefined) !== JSON.stringify(values[key]));
  requireSketch(changed.length || (parsed.status && parsed.status !== record.status) || review, 'COLLECTION_UNCHANGED', 'Nothing to change; supply at least one different value or status.');
  for (const [key, value] of changed) {
    if (value !== null) { values[key] = value; continue; }
    const field = definition.fields.find(item => item.key === key)!;
    requireSketch(!field.required, 'COLLECTION_REQUIRED', `${field.input} is required and cannot be removed.`);
    delete values[key];
  }
  const status = parsed.status ?? record.status;
  statusChange(definition, record.status, status, values, asOf);
  if (review) values[definition.review!.stamp] = asOf;
  return finishChange(definition, hook, record, values, status, asOf);
}
/** A managed change: `set` names managed fields (`null` removes one) and `status` may be any status, without people's transitions. */
export interface CollectionManagedChange { status?: string; set?: Readonly<Record<string, CollectionValue | null>> }
/**
 * The complete next frontmatter of a valid note changed by another module's reviewed plan, for example a release
 * candidate that includes a release item. Stamps, derived values and completeness apply as for any change.
 */
export function collectionManagedUpdate(definition: CollectionDefinition, hook: CollectionHook | undefined, record: CollectionRecord, change: CollectionManagedChange, asOf: string): CollectionChange {
  const values: CollectionValues = { ...record.values };
  for (const [key, value] of Object.entries(change.set ?? {})) {
    const field = definition.fields.find(item => item.key === key && item.source === 'managed');
    requireSketch(field, 'COLLECTION_MANAGED', `${key} is not a managed field of ${definition.id}.`);
    if (value === null) delete values[key]; else values[key] = collectionValue(definition, field, value);
  }
  const status = change.status ?? record.status;
  requireSketch(collectionStatus(definition, status), 'COLLECTION_STATUS', `status must be one of ${definition.statuses.map(item => item.id).join(', ')}.`);
  stampChange(definition, record.status, status, values, asOf);
  return finishChange(definition, hook, record, values, status, asOf);
}
/** The next id: one above the highest `<PREFIX><digits>` mentioned in any note, file name or register, never reused while those survive. */
export function nextCollectionId(definition: CollectionDefinition, texts: readonly string[]): string {
  const pattern = new RegExp(`${definition.idPrefix}(\\d{1,9})`, 'g');
  let highest = 0;
  for (const value of texts) for (const match of value.matchAll(pattern)) highest = Math.max(highest, Number(match[1]));
  const next = String(highest + 1);
  if (next.length > 9) throw new SketchError('COLLECTION_ID', 'No identifiers left for this collection.');
  return definition.idPrefix + next.padStart(definition.idDigits, '0');
}
/** Open notes whose overdue date (for example `due`) lies before the reference date. */
export function collectionOverdue(definition: CollectionDefinition, record: CollectionRecord, asOf: string): boolean {
  return collectionStatus(definition, record.status)?.open === true
    && definition.fields.some(field => field.overdue && typeof record.values[field.key] === 'string' && String(record.values[field.key]) < asOf);
}
