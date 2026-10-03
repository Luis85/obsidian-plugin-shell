/** Data conversions are separate from DOM/rendering. Failed parsing retains raw input. */
export type DetailData = null | string | number | boolean | DetailData[] | { [key: string]: DetailData };
export interface DetailControl {
  kind: 'text' | 'textarea' | 'number' | 'checkbox' | 'date' | 'datetime-local' | 'select' | 'json-file' | 'json-editor' | 'markdown-editor';
  required?: boolean; options?: { label: string; value: string }[]; maxBytes?: number;
}
export function copyDetailData(value: unknown, depth = 0, budget = { count: 0 }): DetailData {
  if (depth > 30 || ++budget.count > 100000) throw new Error('DETAIL_DATA_LIMIT');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    if (value.length > 100000) throw new Error('DETAIL_DATA_LIMIT');
    return Array.from({length:value.length},(_,i) => {
      const descriptor=Object.getOwnPropertyDescriptor(value,String(i));
      if (!descriptor || !('value' in descriptor)) throw new Error('DETAIL_DATA_ACCESSOR');
      return copyDetailData(descriptor.value,depth+1,budget);
    });
  }
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error('DETAIL_DATA_INVALID');
  const output: Record<string, DetailData> = {};
  for (const key of Object.keys(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('DETAIL_DATA_UNSAFE');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) throw new Error('DETAIL_DATA_ACCESSOR');
    output[key] = copyDetailData(descriptor.value, depth + 1, budget);
  }
  return output;
}
export function parseDetailControl(raw: string | boolean, control: DetailControl = { kind: 'text' }): DetailData {
  if (typeof raw === 'string' && new TextEncoder().encode(raw).length > (control.maxBytes ?? 1_000_000)) throw new Error('DETAIL_INPUT_LIMIT');
  if (control.required && (raw === '' || raw === false)) throw new Error('DETAIL_INPUT_REQUIRED');
  if (control.kind === 'checkbox') { if (typeof raw !== 'boolean') throw new Error('DETAIL_BOOLEAN_REQUIRED'); return raw; }
  if (typeof raw !== 'string') throw new Error('DETAIL_TEXT_REQUIRED');
  if (control.kind === 'number') {
    if (raw.trim() === '') { if(control.required) throw new Error('DETAIL_INPUT_REQUIRED'); return null; }
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw) || !Number.isFinite(Number(raw))) throw new Error('DETAIL_NUMBER_INVALID');
    return Number(raw);
  }
  if (['json-editor', 'json-file'].includes(control.kind)) {
    if (raw === '' && !control.required) return null;
    return copyDetailData(JSON.parse(raw));
  }
  if (control.kind === 'select' && raw !== '' && !control.options?.some(option => option.value === raw)) throw new Error('DETAIL_OPTION_INVALID');
  if (['date', 'datetime-local'].includes(control.kind) && raw !== '') {
    const date = raw.slice(0, 10);
    if (control.kind === 'date' && date !== raw) throw new Error('DETAIL_DATE_INVALID');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('DETAIL_DATE_INVALID');
    if (control.kind === 'datetime-local' && !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(raw)) throw new Error('DETAIL_DATETIME_INVALID');
  }
  return raw;
}
