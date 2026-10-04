/** Data conversions are separate from DOM/rendering. Failed parsing retains raw input. */
export type DetailData = null | string | number | boolean | DetailData[] | { [key: string]: DetailData };
export interface DetailControl {
  kind: 'text' | 'textarea' | 'number' | 'checkbox' | 'date' | 'datetime-local' | 'select' | 'json-file' | 'json-editor' | 'markdown-editor';
  required?: boolean; options?: { label: string; value: string }[]; maxBytes?: number;
}
/** A data property's value; accessors are refused instead of being invoked. */
function ownValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !('value' in descriptor)) throw new Error('DETAIL_DATA_ACCESSOR');
  return descriptor.value;
}
function copyArray(value: unknown[], depth: number, budget: { count: number }): DetailData[] {
  if (value.length > 100000) throw new Error('DETAIL_DATA_LIMIT');
  return Array.from({length:value.length},(_,i) => copyDetailData(ownValue(value,String(i)),depth+1,budget));
}
function copyRecord(value: object, depth: number, budget: { count: number }): Record<string, DetailData> {
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error('DETAIL_DATA_INVALID');
  const output: Record<string, DetailData> = {};
  for (const key of Object.keys(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('DETAIL_DATA_UNSAFE');
    output[key] = copyDetailData(ownValue(value, key), depth + 1, budget);
  }
  return output;
}
const scalarData = (value: unknown): value is null | string | boolean | number =>
  value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
export function copyDetailData(value: unknown, depth = 0, budget = { count: 0 }): DetailData {
  if (depth > 30 || ++budget.count > 100000) throw new Error('DETAIL_DATA_LIMIT');
  if (scalarData(value)) return value;
  if (Array.isArray(value)) return copyArray(value, depth, budget);
  if (!value || typeof value !== 'object') throw new Error('DETAIL_DATA_INVALID');
  return copyRecord(value, depth, budget);
}
function parseNumber(raw: string, control: DetailControl): number | null {
  if (raw.trim() === '') { if(control.required) throw new Error('DETAIL_INPUT_REQUIRED'); return null; }
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw) || !Number.isFinite(Number(raw))) throw new Error('DETAIL_NUMBER_INVALID');
  return Number(raw);
}
function calendarDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}
function checkDate(raw: string, kind: 'date' | 'datetime-local'): void {
  const date = raw.slice(0, 10);
  if (kind === 'date' && date !== raw) throw new Error('DETAIL_DATE_INVALID');
  if (!calendarDate(date)) throw new Error('DETAIL_DATE_INVALID');
  if (kind === 'datetime-local' && !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(raw)) throw new Error('DETAIL_DATETIME_INVALID');
}
function parseJson(raw: string, control: DetailControl): DetailData {
  return raw === '' && !control.required ? null : copyDetailData(JSON.parse(raw));
}
/** An empty value means "not chosen" for select, date and date-time. */
function checkChoice(raw: string, control: DetailControl): void {
  if (raw === '') return;
  if (control.kind === 'select' && !control.options?.some(option => option.value === raw)) throw new Error('DETAIL_OPTION_INVALID');
  if (control.kind === 'date' || control.kind === 'datetime-local') checkDate(raw, control.kind);
}
function parseText(raw: string, control: DetailControl): DetailData {
  if (control.kind === 'number') return parseNumber(raw, control);
  if (control.kind === 'json-editor' || control.kind === 'json-file') return parseJson(raw, control);
  checkChoice(raw, control);
  return raw;
}
export function parseDetailControl(raw: string | boolean, control: DetailControl = { kind: 'text' }): DetailData {
  if (typeof raw === 'string' && new TextEncoder().encode(raw).length > (control.maxBytes ?? 1_000_000)) throw new Error('DETAIL_INPUT_LIMIT');
  if (control.required && (raw === '' || raw === false)) throw new Error('DETAIL_INPUT_REQUIRED');
  if (control.kind === 'checkbox') { if (typeof raw !== 'boolean') throw new Error('DETAIL_BOOLEAN_REQUIRED'); return raw; }
  if (typeof raw !== 'string') throw new Error('DETAIL_TEXT_REQUIRED');
  return parseText(raw, control);
}
