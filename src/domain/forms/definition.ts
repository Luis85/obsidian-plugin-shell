import { plainRecord } from '../entity';
import { failure, success, type Result } from '../outcome';
import { answerFor } from './answers';
import { hasControlCharacters, isFormPath, type DataFormChoice, type DataFormCondition, type DataFormDefinition, type DataFormField, type DataFormKind, type FormScalar } from './model';

/**
 * Runtime reader of the shared form format (`configs/schemas/form.schema.json`). It accepts the subset a
 * plugin view can render without CLI hooks and fails closed on everything else.
 */
class DefinitionError extends Error {
  constructor(readonly key: string, readonly at: string) { super(key); }
}
function need(ok: boolean, key: string, at: string): void { if (!ok) throw new DefinitionError(key, at); }
const common = ['id', 'kind', 'label', 'help', 'message', 'bind', 'when'];
const kindKeys: Readonly<Record<DataFormKind, readonly string[]>> = {
  text: ['default', 'required', 'maxLength', 'multiline'], title: ['default', 'maxLength'],
  number: ['default', 'integer', 'min', 'max'], select: ['default', 'choices'], multi: ['default', 'choices', 'required'],
  boolean: ['default', 'yes', 'no'], list: ['default', 'required', 'separator', 'joiner', 'suffix', 'multiline', 'maxItems', 'maxLength'],
  section: ['fields'],
};
/** Terminal-only constructs need CLI hooks, wizard state or a terminal answer flow. */
const cliOnly = new Set(['transient', 'effect', 'choicesFrom', 'gate', 'form', 'prepare', 'commit', 'changed', 'confirm', 'record']);
const terminalLabels = ['yes', 'no', 'separator', 'joiner', 'suffix'];
const fieldId = /^[a-z][a-zA-Z0-9]*$/;
const formId = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function record(value: unknown, at: string): Record<string, unknown> {
  if (!plainRecord(value)) throw new DefinitionError('form.object', at);
  return value;
}
function allowed(item: Record<string, unknown>, keys: readonly string[], at: string): void {
  for (const key of Object.keys(item)) {
    need(!cliOnly.has(key), 'form.cliOnly', `${at}.${key}`);
    need(keys.includes(key), 'form.unknownKey', `${at}.${key}`);
  }
}
function text(value: unknown, at: string, max: number, multiline = false): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || hasControlCharacters(value, multiline)) throw new DefinitionError('form.text', at);
  need(!value.includes('{{'), 'form.template', at);
  return value.trim();
}
const optionalText = (value: unknown, at: string, max: number, multiline = false) => value === undefined ? undefined : text(value, at, max, multiline);
function flag(item: Record<string, unknown>, key: string, at: string): boolean | undefined {
  const value = item[key];
  if (value !== undefined && typeof value !== 'boolean') throw new DefinitionError('form.boolean', `${at}.${key}`);
  return value;
}
function finite(item: Record<string, unknown>, key: string, at: string, count = false): number | undefined {
  const value = item[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || (count && (!Number.isSafeInteger(value) || value < 1))) throw new DefinitionError('form.number', `${at}.${key}`);
  return value;
}
function scalar(value: unknown, at: string): FormScalar | undefined {
  if (value === undefined || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return value;
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) return value.map(String);
  throw new DefinitionError('form.value', at);
}
function path(value: unknown, at: string): string {
  if (!isFormPath(value)) throw new DefinitionError('form.path', at);
  return value;
}
function choices(value: unknown, at: string): readonly DataFormChoice[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 60) throw new DefinitionError('form.choices', at);
  const items = value.map((raw: unknown, index) => {
    const where = `${at}[${index}]`;
    if (typeof raw === 'string') return Object.freeze({ id: text(raw, where, 80), label: text(raw, where, 300) });
    const item = record(raw, where); allowed(item, ['id', 'label'], where);
    return Object.freeze({ id: text(item.id, `${where}.id`, 80), label: text(item.label, `${where}.label`, 300) });
  });
  need(new Set(items.map(item => item.id)).size === items.length, 'form.choices', at);
  return Object.freeze(items);
}
/** A `field` condition must name an earlier sibling; it compares that sibling's bound value. */
function conditionTarget(item: Record<string, unknown>, at: string, siblings: ReadonlyMap<string, string>) {
  if (item.path !== undefined) { const target = path(item.path, `${at}.path`); return { path: target, target }; }
  const field = text(item.field, `${at}.field`, 60);
  const target = siblings.get(field);
  if (target === undefined) throw new DefinitionError('form.condition', `${at}.field`);
  return { field, target };
}
function condition(value: unknown, at: string, siblings: ReadonlyMap<string, string>): DataFormCondition {
  const item = record(value, at);
  allowed(item, [item.path !== undefined ? 'path' : 'field', 'equals', 'notEquals', 'present'], at);
  need(['equals', 'notEquals', 'present'].filter(key => item[key] !== undefined).length === 1, 'form.condition', at);
  return Object.freeze({ ...conditionTarget(item, at, siblings), equals: scalar(item.equals, `${at}.equals`),
    notEquals: scalar(item.notEquals, `${at}.notEquals`), present: flag(item, 'present', at) });
}
const isKind = (value: string): value is DataFormKind => Object.hasOwn(kindKeys, value);
function kindOf(value: unknown, at: string): DataFormKind {
  if (typeof value !== 'string') throw new DefinitionError('form.kind', at);
  need(!cliOnly.has(value), 'form.cliOnly', at);
  if (!isKind(value)) throw new DefinitionError('form.kind', at);
  return value;
}
function shape(item: Record<string, unknown>, kind: DataFormKind, at: string, ids: Set<string>, depth: number) {
  if (kind === 'section') return { fields: fields(item.fields, `${at}.fields`, ids, depth + 1) };
  for (const key of terminalLabels) optionalText(item[key], `${at}.${key}`, 300);
  const min = finite(item, 'min', at), max = finite(item, 'max', at);
  need(min === undefined || max === undefined || min <= max, 'form.number', `${at}.max`);
  return { default: scalar(item.default, `${at}.default`), required: flag(item, 'required', at), multiline: flag(item, 'multiline', at),
    integer: flag(item, 'integer', at), min, max, maxLength: finite(item, 'maxLength', at, true), maxItems: finite(item, 'maxItems', at, true),
    choices: kind === 'select' || kind === 'multi' ? choices(item.choices, `${at}.choices`) : undefined };
}
function field(raw: unknown, at: string, ids: Set<string>, siblings: Map<string, string>, depth: number): DataFormField {
  const item = record(raw, at);
  const kind = kindOf(item.kind, `${at}.kind`);
  allowed(item, [...common, ...kindKeys[kind]], at);
  const id = text(item.id, `${at}.id`, 60);
  need(fieldId.test(id) && isFormPath(id) && !ids.has(id), 'form.id', `${at}.id`);
  ids.add(id);
  const result: DataFormField = Object.freeze({ id, kind, label: text(item.label, `${at}.label`, 300),
    help: optionalText(item.help, `${at}.help`, 2000, true), message: optionalText(item.message, `${at}.message`, 300),
    bind: item.bind === undefined ? undefined : path(item.bind, `${at}.bind`),
    when: item.when === undefined ? undefined : condition(item.when, `${at}.when`, siblings), ...shape(item, kind, at, ids, depth) });
  const fallback = result.default;
  need(fallback === undefined || fallback === '' || answerFor(result, fallback, false).ok, 'form.default', `${at}.default`);
  siblings.set(id, result.bind ?? id);
  return result;
}
function fields(value: unknown, at: string, ids: Set<string>, depth: number): readonly DataFormField[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 80 || depth > 8) throw new DefinitionError('form.fields', at);
  const siblings = new Map<string, string>();
  return Object.freeze(value.map((raw: unknown, index) => field(raw, `${at}[${index}]`, ids, siblings, depth)));
}
function definition(value: unknown): DataFormDefinition {
  const form = record(value, 'form');
  allowed(form, ['$schema', 'schemaVersion', 'id', 'version', 'title', 'description', 'fields'], 'form');
  need(form.schemaVersion === 1, 'form.version', 'schemaVersion');
  const version = form.version;
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) throw new DefinitionError('form.version', 'version');
  const id = text(form.id, 'id', 80);
  need(formId.test(id), 'form.id', 'id');
  return Object.freeze({ id, version, title: text(form.title, 'title', 200), description: optionalText(form.description, 'description', 2000, true),
    fields: fields(form.fields, 'fields', new Set(), 0) });
}
/** Validates an unknown JSON value; the failure names the first rejected location in `field`. */
export function readDataForm(value: unknown): Result<DataFormDefinition> {
  try { return success(definition(value)); }
  catch (error) {
    if (error instanceof DefinitionError) return failure('validation', error.key, error.at);
    throw error;
  }
}
/** Feature-author entry point: a definition shipped with the plugin is a programming error when invalid. */
export function defineForm(value: unknown): DataFormDefinition {
  const result = readDataForm(value);
  if (!result.ok) throw new Error(`FORM_DEFINITION: ${result.error.key} at ${result.error.field ?? 'form'}`);
  return result.value;
}
