import { literal, type Schema } from './model.ts';
export function typeCode(s: Schema | null): string {
  if (!s) return 'undefined';
  if (s.enum) return s.enum.map(literal).join(' | ');
  if (Array.isArray(s.type)) return s.type.map(type => typeCode({type})).join(' | ');
  if (s.type === 'object') return '{ ' + Object.entries(s.properties ?? {}).map(([key,value]) => `${literal(key)}${s.required?.includes(key) ? '' : '?'}: ${typeCode(value)};`).join(' ') + ' }';
  if (s.type === 'array') return `Array<${typeCode(s.items!)}>`;
  return s.type === 'integer' ? 'number' : s.type;
}
export function sample(s: Schema | null): unknown {
  if (!s) return undefined;
  if (s.enum) return s.enum[0];
  if (Array.isArray(s.type)) return sample({...s,type:s.type[0]!});
  if (s.type === 'object') return Object.fromEntries(Object.entries(s.properties ?? {}).filter(([key]) => s.required?.includes(key)).map(([key,value]) => [key,sample(value)]));
  if (s.type === 'array') return [sample(s.items!)];
  if (s.type === 'boolean') return false;
  if (s.type === 'number' || s.type === 'integer') return 1;
  if (s.type === 'null') return null;
  return ({date:'2026-01-01','date-time':'2026-01-01T00:00:00.000Z',uuid:'00000000-0000-4000-8000-000000000001',email:'fixture@example.invalid',uri:'https://example.invalid/fixture'} as Record<string,string>)[s.format ?? ''] ?? 'fixture';
}
export const sampleCode = (s: Schema | null) => s ? literal(sample(s)) : 'undefined';
