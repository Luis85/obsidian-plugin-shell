/** Runtime validator for the explicitly supported companion schema subset. */
export interface Schema { type: string | string[]; properties?: Record<string, Schema>; required?: string[]; additionalProperties?: boolean; items?: Schema; enum?: unknown[]; format?: string }
const UNSAFE_KEYS = ['__proto__','prototype','constructor'];
/** Plain arrays/objects only, with bounded size and data properties (no accessors, symbols or holes). */
function safeContainer(value: object, depth: number, budget: {count:number}): boolean {
  const array=Array.isArray(value);
  if (!array && ![Object.prototype,null].includes(Object.getPrototypeOf(value))) return false;
  const keys=Reflect.ownKeys(value);
  if(array && (value.length>120000 || keys.length!==value.length+1))return false;
  return keys.every(key=>{
    if(array && key==='length')return true;
    if(typeof key!=='string' || UNSAFE_KEYS.includes(key) || array && !/^(0|[1-9][0-9]*)$/.test(key))return false;
    const descriptor=Object.getOwnPropertyDescriptor(value,key)!;
    return 'value' in descriptor && safe(descriptor.value,depth+1,budget);
  });
}
function safe(value: unknown, depth = 0, budget = {count:0}): boolean {
  if (depth > 40 || ++budget.count > 120000) return false;
  if (value === undefined) return depth === 0;
  if (value === null || ['string','boolean'].includes(typeof value)) return true;
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'object' && safeContainer(value, depth, budget);
}
const calendarDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const absoluteUri = (value: string): boolean => { try { return Boolean(new URL(value).protocol); } catch { return false; } };
const FORMATS: Readonly<Record<string, (value: string) => boolean>> = {
  date: calendarDate,
  'date-time': value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) && calendarDate(value.slice(0,10)),
  uuid: value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
  email: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  uri: absoluteUri,
};
function formatMatches(value: string, format?: string): boolean {
  if (!format) return true;
  return Object.hasOwn(FORMATS, format) && FORMATS[format]!(value);
}
function checkObject(value: unknown, schema: Schema): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string,unknown>, properties = schema.properties ?? {};
  return (schema.required ?? []).every(key => Object.hasOwn(data,key)) && Object.entries(data).every(([key,item]) =>
    Object.hasOwn(properties,key) ? check(item,properties[key]!) : schema.additionalProperties !== false);
}
const SCALAR_CHECKS: Readonly<Record<string, (value: unknown, schema: Schema) => boolean>> = {
  null: value => value === null,
  array: (value, schema) => Array.isArray(value) && Boolean(schema.items) && value.every(item => check(item,schema.items!)),
  object: checkObject,
  integer: value => Number.isSafeInteger(value),
  number: value => typeof value === 'number' && Number.isFinite(value),
  string: (value, schema) => typeof value === 'string' && formatMatches(value,schema.format),
  boolean: value => typeof value === 'boolean',
};
function check(value: unknown, schema: Schema): boolean {
  if (schema.enum && !schema.enum.some(item => item === value)) return false;
  if (Array.isArray(schema.type)) return schema.type.some(type => check(value,{...schema,type}));
  return Object.hasOwn(SCALAR_CHECKS, schema.type) && SCALAR_CHECKS[schema.type]!(value, schema);
}
export function matches(value: unknown, schema: Schema | null): boolean { return safe(value) && (schema === null ? value === undefined : check(value,schema)); }
export class NotImplementedError extends Error {
  constructor(source: string, operation: string) { super(`NOT_IMPLEMENTED: ${source}/${operation}`); this.name = 'NotImplementedError'; }
}
