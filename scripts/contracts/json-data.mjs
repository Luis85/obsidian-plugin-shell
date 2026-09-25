/** Bounded plain JSON only. Never invokes accessors, toJSON or consumer code. */
export const MAX_JSON_BYTES = 1024 * 1024;
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
function fail() { throw new Error('JSON_DATA_INVALID'); }
function primitive(value) {
  if (value === null || typeof value === 'boolean') return 4;
  if (typeof value === 'number' && Number.isFinite(value)) return 24;
  if (typeof value === 'string') return Buffer.byteLength(value, 'utf8') + 2;
  return undefined;
}
export function assertJsonData(value) {
  let bytes = 0; let entries = 0;
  const ancestors = new Set();
  function visit(item, depth) {
    if (depth > 32 || ++entries > 20000) fail();
    const size = primitive(item);
    if (size !== undefined) { bytes += size; return; }
    if (typeof item !== 'object' || item === null || ancestors.has(item)) fail();
    const array = Array.isArray(item);
    const prototype = Object.getPrototypeOf(item);
    if (prototype !== (array ? Array.prototype : Object.prototype) && !(prototype === null && !array)) fail();
    const fields = Object.getOwnPropertyDescriptors(item);
    if (Reflect.ownKeys(fields).some(key => typeof key !== 'string')) fail();
    if (array && (item.length > 10000 || Object.keys(fields).length !== item.length + 1)) fail();
    ancestors.add(item);
    for (const [key, field] of Object.entries(fields)) {
      if (array && key === 'length') continue;
      if (!Object.hasOwn(field, 'value') || !field.enumerable || forbidden.has(key)) fail();
      if (array && !/^(0|[1-9][0-9]*)$/.test(key)) fail();
      bytes += Buffer.byteLength(key, 'utf8') + 4;
      visit(field.value, depth + 1);
      if (bytes > MAX_JSON_BYTES) fail();
    }
    ancestors.delete(item);
  }
  visit(value, 0);
  if (bytes > MAX_JSON_BYTES) fail();
  return true;
}
export function parseJsonData(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > MAX_JSON_BYTES) fail();
  const value = JSON.parse(text);
  assertJsonData(value);
  return value;
}
