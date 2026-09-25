/** Runtime validator for the explicitly supported companion schema subset. */
export interface Schema { type: string | string[]; properties?: Record<string, Schema>; required?: string[]; additionalProperties?: boolean; items?: Schema; enum?: unknown[]; format?: string }
function safe(value: unknown, depth = 0, budget = {count:0}): boolean {
  if (depth > 40 || ++budget.count > 120000) return false;
  if (value === undefined) return depth === 0;
  if (value === null || ['string','boolean'].includes(typeof value)) return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  const array=Array.isArray(value);
  if (!array && ![Object.prototype,null].includes(Object.getPrototypeOf(value))) return false;
  const keys=Reflect.ownKeys(value);
  if(array && (value.length>120000 || keys.length!==value.length+1))return false;
  return keys.every(key=>{
    if(array && key==='length')return true;
    if(typeof key!=='string' || ['__proto__','prototype','constructor'].includes(key) || array && !/^(0|[1-9][0-9]*)$/.test(key))return false;
    const descriptor=Object.getOwnPropertyDescriptor(value,key)!;
    return 'value' in descriptor && safe(descriptor.value,depth+1,budget);
  });
}
function formatMatches(value: string, format?: string): boolean {
  if (!format) return true;
  if (format === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  if (format === 'date-time') return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) && formatMatches(value.slice(0,10),'date');
  if (format === 'uuid') return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  if (format === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (format === 'uri') { try { return Boolean(new URL(value).protocol); } catch { return false; } }
  return false;
}
function check(value: unknown, schema: Schema): boolean {
  if (schema.enum && !schema.enum.some(item => item === value)) return false;
  if (Array.isArray(schema.type)) return schema.type.some(type => check(value,{...schema,type}));
  if (schema.type === 'null') return value === null;
  if (schema.type === 'array') return Array.isArray(value) && Boolean(schema.items) && value.every(item => check(item,schema.items!));
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const data = value as Record<string,unknown>;
    return (schema.required ?? []).every(key => Object.hasOwn(data,key)) && Object.entries(data).every(([key,item]) => {
      const property = schema.properties?.[key]; return property ? check(item,property) : schema.additionalProperties !== false;
    });
  }
  if (schema.type === 'integer') return Number.isSafeInteger(value);
  if (schema.type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (schema.type === 'string') return typeof value === 'string' && formatMatches(value,schema.format);
  return schema.type === 'boolean' && typeof value === 'boolean';
}
export function matches(value: unknown, schema: Schema | null): boolean { return safe(value) && (schema === null ? value === undefined : check(value,schema)); }
export class NotImplementedError extends Error {
  constructor(source: string, operation: string) { super(`NOT_IMPLEMENTED: ${source}/${operation}`); this.name = 'NotImplementedError'; }
}
