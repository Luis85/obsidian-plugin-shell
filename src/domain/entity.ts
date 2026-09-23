import { failure, success, type Result } from './outcome';

interface Field<T, Required extends boolean = boolean> {
  readonly required: Required;
  readonly kind: 'text' | 'number' | 'boolean' | 'date' | 'list';
  readonly optional?: boolean;
  readonly errorKey?: string;
  read(input: unknown): Result<T>;
}
type Schema = Readonly<Record<string, Field<unknown>>>;
type Value<F> = F extends Field<infer T> ? T : never;
export type EntityValues<S extends Schema> =
  { readonly [K in keyof S as undefined extends Value<S[K]> ? never : K]: Value<S[K]> } &
  { readonly [K in keyof S as undefined extends Value<S[K]> ? K : never]?: Exclude<Value<S[K]>, undefined> };
export type EntityInput<S extends Schema> =
  { readonly [K in keyof S as S[K]['required'] extends true ? K : never]: Value<S[K]> } &
  { readonly [K in keyof S as S[K]['required'] extends false ? K : never]?: Value<S[K]> };
export interface EntityDefinition<I, V> {
  readonly key: string;
  readonly schemaVersion: number;
  readonly fields: Schema;
  parse(input: I): Result<V>;
  decode(input: unknown): Result<V>;
}
export function plainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
const invalid = () => failure('validation', 'error.entity');
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0);
}
function text(options: { min?: number; max?: number; trim?: boolean } = {}): Field<string, true> {
  options = Object.freeze({ ...options });
  return { required: true, kind: 'text', read(input) {
    if (typeof input !== 'string') return invalid();
    const value = options.trim ? input.trim() : input;
    return value.length >= (options.min ?? 0) && value.length <= (options.max ?? 1000) ? success(value) : invalid();
  } };
}
function number(options: { min?: number; max?: number } = {}): Field<number, true> {
  options = Object.freeze({ ...options });
  return { required: true, kind: 'number', read: value => typeof value === 'number' && Number.isFinite(value) && value >= (options.min ?? -Number.MAX_VALUE) && value <= (options.max ?? Number.MAX_VALUE) ? success(value) : invalid() };
}
function boolean(): Field<boolean, true> {
  return { required: true, kind: 'boolean', read: value => typeof value === 'boolean' ? success(value) : invalid() };
}
function date(): Field<string, true> {
  return { required: true, kind: 'date', read: value => typeof value === 'string' && isCalendarDate(value) ? success(value) : invalid() };
}
function enumeration<const T extends string>(values: readonly T[]): Field<T, true> {
  values = Object.freeze([...values]);
  return { required: true, kind: 'text', read(value) {
    const found = values.find(candidate => candidate === value);
    return found === undefined ? invalid() : success(found);
  } };
}
function textList(options: { max?: number; itemMax?: number; pattern?: RegExp } = {}): Field<readonly string[], true> {
  options = Object.freeze({ ...options, ...(options.pattern ? { pattern: new RegExp(options.pattern.source, options.pattern.flags) } : {}) });
  return { required: true, kind: 'list', read(input) {
    if (!Array.isArray(input) || input.length > (options.max ?? 100)) return invalid();
    const values: string[] = [];
    for (const item of input) {
      if (typeof item !== 'string' || item.length > (options.itemMax ?? 1000) || (options.pattern && !new RegExp(options.pattern.source, options.pattern.flags.replace(/[gy]/g, '')).test(item))) return invalid();
      if (!values.includes(item)) values.push(item);
    }
    return success(Object.freeze(values));
  } };
}
function optional<T>(field: Field<T>): Field<T | undefined, false> {
  return { ...field, required: false, optional: true, read: value => value === undefined ? success(undefined) : field.read(value) };
}
function defaulted<T>(field: Field<T>, value: T): Field<T, false> {
  const checked = field.read(value);
  if (!checked.ok) throw new Error('Invalid entity default');
  return { ...field, required: false, read: input => field.read(input === undefined ? checked.value : input) };
}
function error<T, R extends boolean>(field: Field<T, R>, errorKey: string): Field<T, R> { return { ...field, errorKey }; }
export const fields = { text, number, boolean, date, enum: enumeration, textList, optional, defaulted, error };

/** This type guard rechecks the complete mapped output; it never asserts unvalidated input. */
function materialized<S extends Schema>(schema: S, value: Record<string, unknown>): value is EntityValues<S> {
  return Object.entries(schema).every(([key, field]) => field.read(value[key]).ok);
}
export function defineEntity<const S extends Schema>(key: string, schemaVersion: number, schema: S): EntityDefinition<EntityInput<S>, EntityValues<S>> {
  const keys = Object.keys(schema);
  if (!/^[a-z][a-z0-9-]{0,49}$/.test(key) || !Number.isSafeInteger(schemaVersion) || schemaVersion < 1 || !keys.length || keys.some(name => !/^[a-z][a-zA-Z0-9_]*$/.test(name) || ['type', 'id', 'schema_version', 'created_at', 'constructor', 'prototype'].includes(name))) throw new Error('Invalid entity definition');
  for (const field of Object.values(schema)) Object.freeze(field);
  const captured = Object.freeze({ ...schema });
  function decode(input: unknown): Result<EntityValues<S>> {
    if (!plainRecord(input) || Object.keys(input).some(name => !Object.hasOwn(captured, name))) return invalid();
    const value: Record<string, unknown> = {};
    for (const [name, field] of Object.entries(captured)) {
      const parsed = field.read(input[name]);
      if (!parsed.ok) return failure('validation', field.errorKey ?? 'error.entity', name);
      if (parsed.value !== undefined) value[name] = parsed.value;
    }
    Object.freeze(value);
    return materialized<S>(captured, value) ? success(value) : invalid();
  }
  return Object.freeze({ key, schemaVersion, fields: captured, parse: decode, decode });
}
