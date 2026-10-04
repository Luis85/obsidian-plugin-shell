import { object, keys, text, list } from './data.ts';
import { requireSketch, SketchError, title as titleText } from './errors.ts';
import { definitionId, fieldId, getPath, matches, readCondition, readPath, type FormCondition, type FormValues } from './form-model.ts';
export type FieldKind = 'text' | 'title' | 'number' | 'select' | 'multi' | 'boolean' | 'confirm' | 'list' | 'record' | 'section';
export interface FormChoice { id: string; label: string }
export interface FormField {
  id: string; kind: FieldKind; label: string; help?: string; message?: string; bind?: string; when?: FormCondition; transient?: boolean; effect?: string;
  default?: unknown; required?: boolean; maxLength?: number; multiline?: boolean;
  integer?: boolean; min?: number; max?: number;
  choices?: FormChoice[]; choicesFrom?: string; yes?: string; no?: string;
  separator?: string; joiner?: string; suffix?: string; maxItems?: number;
  gate?: string; form?: string; fields?: FormField[]; prepare?: string; commit?: string;
}
export interface FormDefinition { schemaVersion: 1; id: string; version: number; title: string; description?: string; commit?: string; fields: FormField[] }
/** Every key and value was checked by the reader above; this keeps consumers on that single validated boundary. */
export function assertValidated<T>(value: Record<string, unknown>): asserts value is Record<string, unknown> & T {
  requireSketch(typeof value.id === 'string', 'DEFINITION_SHAPE', 'Incomplete definition.');
}
const common = ['id', 'kind', 'label', 'help', 'message', 'bind', 'when', 'transient', 'effect'];
const kindKeys: Record<FieldKind, string[]> = {
  text: ['default', 'required', 'maxLength', 'multiline'], title: ['default', 'maxLength'],
  number: ['default', 'required', 'integer', 'min', 'max'], select: ['default', 'choices', 'choicesFrom'],
  multi: ['default', 'choices', 'choicesFrom', 'required'], boolean: ['default', 'yes', 'no'], confirm: [],
  list: ['default', 'required', 'separator', 'joiner', 'suffix', 'multiline', 'maxItems', 'maxLength'],
  record: ['maxLength'], section: ['gate', 'form', 'fields', 'prepare', 'commit'],
};
const hookName = (value: unknown, name: string) => {
  const id = text(value, name, 80);
  requireSketch(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/.test(id), 'FORM_HOOK', `${name} must name a registered hook such as settings.read.`);
  return id;
};
function choices(value: unknown, name: string): FormChoice[] {
  const items = list(value, name, 60).map(raw => typeof raw === 'string' ? { id: raw, label: raw } : object(raw));
  const result = items.map(item => { keys(item, ['id', 'label']); text(item.label, name + '.label', 300); return { id: text(item.id, name + '.id', 80), label: String(item.label) }; });
  requireSketch(result.length > 0 && new Set(result.map(item => item.id)).size === result.length, 'FORM_CHOICES', `${name} needs unique choices.`);
  return result;
}
function optionalNumber(item: FormValues, key: string, name: string): void {
  requireSketch(item[key] === undefined || (typeof item[key] === 'number' && Number.isFinite(item[key])), 'FORM_FIELD', `${name}.${key} must be a finite number.`);
}
type ShapeCheck = (item: FormValues, name: string, known: Set<string>) => void;
function choiceShape(item: FormValues, name: string): void {
  requireSketch((item.choices === undefined) !== (item.choicesFrom === undefined), 'FORM_CHOICES', `${name} needs choices or choicesFrom.`);
  if (item.choices !== undefined) item.choices = choices(item.choices, name + '.choices'); else hookName(item.choicesFrom, name + '.choicesFrom');
}
function sectionShape(item: FormValues, name: string, known: Set<string>): void {
  requireSketch((item.form === undefined) !== (item.fields === undefined), 'FORM_SECTION', `${name} needs form or fields.`);
  if (item.form !== undefined) requireSketch(definitionId.test(text(item.form, name + '.form', 80)), 'FORM_SECTION', `${name}.form must be a form id.`);
  else item.fields = readFields(item.fields, name + '.fields', known);
  if (item.gate !== undefined) text(item.gate, name + '.gate', 300);
  for (const key of ['prepare', 'commit']) if (item[key] !== undefined) hookName(item[key], name + '.' + key);
  requireSketch(item.bind !== undefined || (item.prepare === undefined && item.commit === undefined), 'FORM_SECTION', `${name} needs bind for prepare/commit.`);
}
/** Kind-specific structure, checked before the options every kind shares. */
const kindShapes: Partial<Record<FieldKind, ShapeCheck>> = { select: choiceShape, multi: choiceShape, section: sectionShape };
function optionShape(item: FormValues, name: string): void {
  for (const key of ['min', 'max', 'maxLength', 'maxItems']) optionalNumber(item, key, name);
  for (const key of ['separator', 'joiner', 'suffix', 'yes', 'no']) if (item[key] !== undefined) text(item[key], `${name}.${key}`, 300);
  for (const key of ['required', 'multiline', 'integer', 'transient']) requireSketch(item[key] === undefined || typeof item[key] === 'boolean', 'FORM_FIELD', `${name}.${key} must be boolean.`);
}
function fieldShape(item: FormValues, kind: FieldKind, name: string, known: Set<string>): void {
  kindShapes[kind]?.(item, name, known);
  optionShape(item, name);
  requireSketch(kind !== 'record' || item.bind !== undefined, 'FORM_FIELD', `${name} needs bind for a record.`);
}
function optionalTexts(item: FormValues, name: string): void {
  if (item.help !== undefined) text(item.help, name + '.help', 2000);
  if (item.message !== undefined) text(item.message, name + '.message', 300);
  if (item.bind !== undefined) readPath(item.bind, name + '.bind');
  if (item.effect !== undefined) hookName(item.effect, name + '.effect');
}
function fieldCondition(item: FormValues, name: string, siblings: Set<string>): void {
  if (item.when === undefined) return;
  const byPath = object(item.when).path !== undefined;
  item.when = readCondition(item.when, name + '.when', byPath ? 'path' : 'field');
  requireSketch(byPath || siblings.has(String((item.when as FormCondition).field)), 'FORM_CONDITION', `${name}.when must reference an earlier field at the same level.`);
}
const answerless: readonly FieldKind[] = ['section', 'record', 'confirm'];
function readField(raw: unknown, name: string, known: Set<string>, siblings: Set<string>): FormField {
  const item = object(raw), kind = item.kind as FieldKind;
  requireSketch(Object.hasOwn(kindKeys, String(kind)), 'FORM_KIND', `${name}.kind is not a supported field kind.`);
  keys(item, [...common, ...kindKeys[kind]]);
  const id = text(item.id, name + '.id', 60);
  requireSketch(fieldId.test(id) && !known.has(id), 'FORM_FIELD', `${name}.id must be a unique identifier.`);
  text(item.label, name + '.label', 300);
  optionalTexts(item, name);
  fieldCondition(item, name, siblings);
  fieldShape(item, kind, name, known);
  known.add(id); siblings.add(id);
  assertValidated<FormField>(item);
  const field = item;
  if (field.default !== undefined && field.default !== '' && !answerless.includes(kind)) fieldAnswer(field, field.default, false);
  return field;
}
function readFields(value: unknown, name: string, known: Set<string>): FormField[] {
  const siblings = new Set<string>();
  return list(value, name, 80).map((raw, index) => readField(raw, `${name}[${index}]`, known, siblings));
}
/** Structural validation; hook and form references are checked against the catalog separately. */
export function readForm(value: unknown): FormDefinition {
  const form = object(value); keys(form, ['$schema', 'schemaVersion', 'id', 'version', 'title', 'description', 'commit', 'fields']);
  requireSketch(form.schemaVersion === 1 && Number.isSafeInteger(form.version) && Number(form.version) > 0, 'FORM_VERSION', 'Unsupported form version.');
  requireSketch(definitionId.test(text(form.id, 'form.id', 80)), 'FORM_ID', 'Form ids are lowercase kebab-case.');
  text(form.title, 'form.title', 200);
  if (form.description !== undefined) text(form.description, 'form.description', 2000);
  if (form.commit !== undefined) hookName(form.commit, 'form.commit');
  form.fields = readFields(form.fields, 'form.fields', new Set());
  requireSketch((form.fields as FormField[]).length > 0, 'FORM_FIELDS', 'A form needs at least one field.');
  delete form.$schema;
  assertValidated<FormDefinition>(form);
  return form;
}
function textAnswer(field: FormField, value: unknown, required: boolean): string {
  const limit = field.maxLength ?? (field.multiline ? 10000 : 2000);
  requireSketch(typeof value === 'string' && value.length <= limit, 'FORM_ANSWER', `${field.label}: enter text up to ${limit} characters.`);
  if (field.kind === 'title') return titleText(value, limit);
  if (required && field.required) return text(value, field.label, limit);
  return value.trim() ? text(value, field.label, limit) : '';
}
/** `required: false` lets a blank number stay unset; otherwise a number is always needed. */
function numberAnswer(field: FormField, value: unknown): number | undefined {
  if (value === undefined && field.required === false) return undefined;
  requireSketch(typeof value === 'number' && Number.isFinite(value), 'FORM_ANSWER', `${field.label}: enter a number.`);
  requireSketch(!field.integer || Number.isSafeInteger(value), 'FORM_ANSWER', `${field.label}: enter a whole number.`);
  requireSketch((field.min === undefined || value >= field.min) && (field.max === undefined || value <= field.max), 'FORM_ANSWER', `${field.label}: enter a number between ${field.min ?? '-∞'} and ${field.max ?? '∞'}.`);
  return value;
}
function listAnswer(field: FormField, value: unknown, required: boolean): string[] {
  const items = list(value, field.label, field.maxItems ?? 60).map(item => text(item, field.label, field.maxLength ?? 2000));
  requireSketch(!required || !field.required || items.length > 0, 'FORM_ANSWER', `${field.label} needs at least one item.`);
  return items;
}
/** One typed answer; a field's own `message` replaces the generic diagnostic. Dynamic choices are checked by their provider. */
export function fieldAnswer(field: FormField, value: unknown, required = true): unknown {
  try { return typedAnswer(field, value, required); }
  catch (error) { if (field.message && error instanceof SketchError) throw new SketchError(error.code, field.message); throw error; }
}
type AnswerCheck = (field: FormField, value: unknown, required: boolean) => unknown;
function booleanAnswer(field: FormField, value: unknown): boolean {
  requireSketch(typeof value === 'boolean', 'FORM_ANSWER', `${field.label} needs true or false.`);
  return value;
}
function selectAnswer(field: FormField, value: unknown): string {
  requireSketch(typeof value === 'string' && (!field.choices || field.choices.some(item => item.id === value)), 'FORM_ANSWER', `${field.label}: choose ${field.choices?.map(item => item.id).join(', ') ?? 'an offered option'}.`);
  return value;
}
function multiAnswer(field: FormField, value: unknown, required: boolean): string[] {
  const items = listAnswer(field, value, required);
  requireSketch(!field.choices || items.every(item => field.choices!.some(choice => choice.id === item)), 'FORM_ANSWER', `${field.label}: choose offered options.`);
  return [...new Set(items)];
}
function recordAnswer(field: FormField, value: unknown): FormValues {
  const record = object(value);
  for (const [key, item] of Object.entries(record)) text(item, `${field.label}${key}`, field.maxLength ?? 2000);
  return record;
}
const answerChecks: Record<FieldKind, AnswerCheck> = {
  text: textAnswer, title: textAnswer, number: numberAnswer, boolean: booleanAnswer, confirm: booleanAnswer,
  select: selectAnswer, multi: multiAnswer, list: listAnswer, record: recordAnswer, section: recordAnswer,
};
function typedAnswer(field: FormField, value: unknown, required: boolean): unknown {
  return answerChecks[field.kind](field, value, required);
}
export const bindingOf = (field: FormField) => field.bind ?? field.id;
/** Field ids resolve to transient answers first, then to the bound value. */
export function conditionValue(field: FormField | undefined, value: FormValues, answers: FormValues): unknown {
  if (!field) return undefined;
  return Object.hasOwn(answers, field.id) ? answers[field.id] : field.transient ? undefined : getPath(value, bindingOf(field));
}
/** A `path` condition reads the form value directly; a `field` condition reads an earlier sibling's answer. */
export function fieldVisible(field: FormField, fields: readonly FormField[], value: FormValues, answers: FormValues, initial: FormValues): boolean {
  if (!field.when) return true;
  if (field.when.path) return matches(field.when, getPath(value, field.when.path));
  const source = fields.find(item => item.id === field.when!.field);
  return matches(field.when, conditionValue(source, value, answers), source && !source.transient ? getPath(initial, bindingOf(source)) : undefined);
}
