import { hasControlCharacters, type DataFormField, type DataFormValue } from './model';

export type DataFormIssueCode = 'required' | 'text' | 'title' | 'number' | 'integer' | 'range' | 'min' | 'max' | 'choice' | 'items' | 'invalid';
type Params = Readonly<Record<string, number>>;
type Answer<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly code: DataFormIssueCode; readonly params?: Params };
const accept = <T>(value: T): Answer<T> => ({ ok: true, value });
const reject = (code: DataFormIssueCode, params?: Params): Answer<never> => ({ ok: false, code, ...(params ? { params } : {}) });

/** Titles are single-line and always required; other text trims and may stay blank unless required. */
function textAnswer(field: DataFormField, value: unknown, enforce: boolean): Answer<string> {
  const title = field.kind === 'title';
  const limit = field.maxLength ?? (field.multiline ? 10000 : 2000);
  if (typeof value !== 'string' || value.length > limit || hasControlCharacters(value, !title)) return reject(title ? 'title' : 'text', { limit });
  const trimmed = value.trim();
  if (!trimmed && enforce && (title || field.required === true)) return reject('required');
  return accept(trimmed);
}
function numberAnswer(field: DataFormField, value: unknown): Answer<number> {
  if (typeof value !== 'number' || !Number.isFinite(value)) return reject('number');
  if (field.integer === true && !Number.isSafeInteger(value)) return reject('integer');
  const { min, max } = field;
  const low = min !== undefined && value < min;
  if (!low && (max === undefined || value <= max)) return accept(value);
  const params = { ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) };
  return reject(min !== undefined && max !== undefined ? 'range' : low ? 'min' : 'max', params);
}
function listAnswer(field: DataFormField, value: unknown, enforce: boolean): Answer<readonly string[]> {
  const limit = field.maxItems ?? 60;
  const length = field.maxLength ?? 2000;
  if (!Array.isArray(value)) return reject('invalid');
  if (value.length > limit) return reject('items', { limit });
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim() || item.length > length || hasControlCharacters(item, false)) return reject('text', { limit: length });
    items.push(item.trim());
  }
  return enforce && field.required === true && !items.length ? reject('required') : accept(items);
}
const offered = (field: DataFormField, value: string) => field.choices?.some(choice => choice.id === value) === true;
function multiAnswer(field: DataFormField, value: unknown, enforce: boolean): Answer<readonly string[]> {
  const items = listAnswer(field, value, enforce);
  if (!items.ok) return items;
  return items.value.every(item => offered(field, item)) ? accept([...new Set(items.value)]) : reject('choice');
}
/** One typed answer for a leaf field. `enforce` is false only while checking a definition default. */
export function answerFor(field: DataFormField, value: unknown, enforce: boolean): Answer<DataFormValue> {
  switch (field.kind) {
    case 'number': return numberAnswer(field, value);
    case 'boolean': return typeof value === 'boolean' ? accept(value) : reject('invalid');
    case 'select': return typeof value === 'string' && offered(field, value) ? accept(value) : reject('choice');
    case 'multi': return multiAnswer(field, value, enforce);
    case 'list': return listAnswer(field, value, enforce);
    default: return textAnswer(field, value, enforce);
  }
}
