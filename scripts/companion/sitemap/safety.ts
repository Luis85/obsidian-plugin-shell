import { SITEMAP_LIMITS } from './model.ts';

class SitemapError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'SitemapError';
    this.code = code;
  }
}
export function requireSitemap(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new SitemapError(code, message);
}
export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
export function sitemapObject(value: unknown, keys: string[], required = keys): asserts value is Record<string, unknown> {
  requireSitemap(record(value) && Object.keys(value).every(key => keys.includes(key)) &&
    required.every(key => Object.hasOwn(value, key)), 'SITEMAP_SHAPE', 'Unexpected or missing record fields.');
}
export function sitemapText(value: unknown, limit = 120, nonempty = true): asserts value is string {
  requireSitemap(typeof value === 'string' && value.length <= limit && (!nonempty || value.trim().length > 0),
    'SITEMAP_SHAPE', 'Expected bounded text.');
}
export function id(value: unknown): asserts value is string {
  sitemapText(value);
  requireSitemap(!['__proto__', 'constructor', 'prototype'].includes(value) && !/[\u0000-\u001f\u007f]/u.test(value),
    'SITEMAP_SHAPE', 'Unsafe identity.');
}
export function list(value: unknown, limit: number): asserts value is unknown[] {
  requireSitemap(Array.isArray(value) && value.length <= limit, 'SITEMAP_LIMIT', 'Collection exceeds its bounded limit.');
}
export function distinct(values: string[], description: string): void {
  requireSitemap(new Set(values).size === values.length, 'SITEMAP_DUPLICATE', 'Duplicate identities in ' + description + '.');
}
export function ids(value: unknown, limit: number): asserts value is string[] {
  list(value, limit);
  value.forEach(id);
  requireSitemap(new Set(value).size === value.length, 'SITEMAP_DUPLICATE', 'Duplicate references.');
}

/** UTF-8 count without importing a browser/Node encoder into the shared contract. */
export function utf8Length(textValue: string): number {
  let count = 0;
  for (const character of textValue) {
    const cp = character.codePointAt(0) ?? 0;
    count += cp <= 0x7f ? 1 : cp <= 0x7ff ? 2 : cp <= 0xffff ? 3 : 4;
  }
  return count;
}

/** Rejects getters before reading them, class instances, cycles, unsafe keys and excessive allocation. */
export function assertJson(value: unknown, budget: 'document' | 'review' = 'document'): void {
  let count = 0;
  const ancestors = new Set<object>();
  const visit = (item: unknown, depth: number): void => {
    requireSitemap(depth <= SITEMAP_LIMITS.depth && ++count <= SITEMAP_LIMITS.values,
      'SITEMAP_LIMIT', 'JSON nesting or value limit exceeded.');
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
    if (typeof item === 'number') {
      requireSitemap(Number.isFinite(item), 'SITEMAP_JSON', 'Non-finite JSON number.');
      return;
    }
    requireSitemap(Array.isArray(item) || record(item), 'SITEMAP_JSON', 'Only plain JSON data is supported.');
    requireSitemap(!ancestors.has(item), 'SITEMAP_JSON', 'Cyclic JSON is not supported.');
    requireSitemap(Object.getOwnPropertySymbols(item).length === 0, 'SITEMAP_JSON', 'Symbol keys are not JSON.');
    ancestors.add(item);
    const entries = Object.getOwnPropertyDescriptors(item);
    if (Array.isArray(item)) {
      requireSitemap(Object.getPrototypeOf(item) === Array.prototype &&
        Object.keys(entries).length === item.length + 1 &&
        Object.keys(entries).every(key => key === 'length' || /^(0|[1-9][0-9]*)$/.test(key) && Number(key) < item.length),
      'SITEMAP_JSON', 'Sparse, decorated or subclassed arrays are not JSON.');
    }
    for (const [key, descriptor] of Object.entries(entries)) {
      if (Array.isArray(item) && key === 'length') continue;
      requireSitemap(!['__proto__', 'constructor', 'prototype'].includes(key) &&
        Object.hasOwn(descriptor, 'value') && descriptor.enumerable,
      'SITEMAP_JSON', 'Unsafe key, accessor or non-enumerable JSON member.');
      visit(descriptor.value, depth + 1);
    }
    ancestors.delete(item);
  };
  visit(value, 0);
  const maximum = budget === 'review' ? SITEMAP_LIMITS.reviewBytes : SITEMAP_LIMITS.bytes;
  requireSitemap(utf8Length(JSON.stringify(value)) <= maximum, 'SITEMAP_LIMIT', 'JSON exceeds its bounded document or private-review budget.');
}

/** Exact equality key. Kept private/local because it includes the complete authoring data. */
export function canonicalKey(value: unknown): string {
  assertJson(value);
  const render = (item: unknown): string => {
    if (Array.isArray(item)) return '[' + item.map(render).join(',') + ']';
    if (record(item)) return '{' + Object.keys(item).sort().map(key => JSON.stringify(key) + ':' + render(item[key])).join(',') + '}';
    return JSON.stringify(item);
  };
  return render(value);
}
