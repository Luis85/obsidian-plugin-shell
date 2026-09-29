import { PROTOTYPE_MAX_BYTES } from './model.ts';
export class PrototypeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(`${code}: ${message}`); this.name = 'PrototypeError'; this.code = code; }
}
export function ensure(value: unknown, code: string, message: string): asserts value {
  if (!value) throw new PrototypeError(code, message);
}
/** The workspace has its own bounded transport; the 4 MB individual project limit is unchanged. */
export function prototypeJson(value: unknown): void {
  let count = 0, bytes = 0;
  const ancestors = new Set<object>();
  function visit(item: unknown, depth: number): void {
    ensure(depth <= 48 && ++count <= 1_200_000, 'PROTOTYPE_LIMIT', 'Workspace complexity limit exceeded.');
    if (item === null || typeof item === 'boolean') { bytes += 5; return; }
    if (typeof item === 'number') { ensure(Number.isFinite(item), 'PROTOTYPE_JSON', 'Finite numbers required.'); bytes += 24; return; }
    if (typeof item === 'string') { bytes += new TextEncoder().encode(item).length + 2; return; }
    ensure(typeof item === 'object' && item !== null, 'PROTOTYPE_JSON', 'Only inert JSON data is supported.');
    const array = Array.isArray(item), proto = Object.getPrototypeOf(item);
    ensure(proto === (array ? Array.prototype : Object.prototype) || (!array && proto === null), 'PROTOTYPE_JSON', 'Plain data required.');
    ensure(!ancestors.has(item) && !Object.getOwnPropertySymbols(item).length, 'PROTOTYPE_JSON', 'Cycles and symbols are not supported.');
    const fields = Object.getOwnPropertyDescriptors(item);
    ensure(!array || Object.keys(fields).length === item.length + 1, 'PROTOTYPE_JSON', 'Sparse or decorated arrays are not supported.');
    ancestors.add(item);
    for (const [key, field] of Object.entries(fields)) {
      if (array && key === 'length') continue;
      ensure(!['__proto__', 'constructor', 'prototype'].includes(key) && Object.hasOwn(field, 'value') && field.enumerable,
        'PROTOTYPE_JSON', 'Unsafe property or accessor.');
      ensure(!array || /^(0|[1-9][0-9]*)$/.test(key) && Number(key) < item.length, 'PROTOTYPE_JSON', 'Decorated array.');
      bytes += key.length * 3 + 4; visit(field.value, depth + 1);
      ensure(bytes <= PROTOTYPE_MAX_BYTES, 'PROTOTYPE_LIMIT', 'Workspace exceeds its 32 MB budget.');
    }
    ancestors.delete(item);
  }
  visit(value, 0);
  ensure(bytes <= PROTOTYPE_MAX_BYTES, 'PROTOTYPE_LIMIT', 'Workspace exceeds its 32 MB budget.');
}
export function object(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  ensure(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k)),
    'PROTOTYPE_SHAPE', 'Unexpected or missing fields.');
}
export function text(value: unknown, max = 120, empty = false): asserts value is string {
  ensure(typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0), 'PROTOTYPE_TEXT', 'Supply bounded text.');
}
export function slug(value: unknown): asserts value is string {
  text(value, 48);
  ensure(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9]|constructor|prototype)$/.test(value),
    'PROTOTYPE_PATH', 'Use a portable lowercase slug (letters, numbers and hyphens).');
}
export function revision(value: unknown): void { ensure(Number.isSafeInteger(value) && Number(value) >= 1, 'PROTOTYPE_REVISION', 'Invalid revision.'); }
export function collection(value: unknown, max: number): asserts value is unknown[] { ensure(Array.isArray(value) && value.length <= max, 'PROTOTYPE_LIMIT', 'Collection limit exceeded.'); }
export function unique(values: string[]): void { ensure(new Set(values).size === values.length, 'PROTOTYPE_DUPLICATE', 'Duplicate identity.'); }
/** Private exact preimage, not a portable approval. Never log this value. */
export function workspaceKey(value: unknown): string {
  prototypeJson(value);
  const render = (v: unknown): string => Array.isArray(v) ? '[' + v.map(render).join(',') + ']' : v && typeof v === 'object'
    ? '{' + Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => JSON.stringify(k) + ':' + render(x)).join(',') + '}' : JSON.stringify(v);
  return render(value);
}
