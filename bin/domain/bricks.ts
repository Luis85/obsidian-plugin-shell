import { newSitemapSurface } from '../../scripts/companion/sitemap/create.ts';
import type { SketchDocument } from './document.ts';
import { object, keys, list, text } from './data.ts';
import { requireSketch, slug } from './errors.ts';
function collection(document: SketchDocument, store: 'semantic' | 'dataSources', field: 'entities' | 'sources'): Record<string, unknown>[] {
  document.design[store] ??= store === 'semantic' ? { entities: [], relationships: [] } : { sources: [], flows: [] };
  const data = object(document.design[store]);
  data[field] ??= [];
  return list(data[field], field, field === 'entities' ? 60 : 24).map(object);
}
function identity(rows: Record<string, unknown>[], name: string, prefix: string) {
  return { id: slug(name, prefix, rows.map(item => String(item.id))), slug: slug(name, prefix, rows.map(item => String(item.slug))), name };
}
export function entityAdd(document: SketchDocument, title: unknown): string {
  const rows = collection(document, 'semantic', 'entities');
  requireSketch(rows.length < 60, 'BRICK_LIMIT', 'At most 60 entities.');
  const item = { ...identity(rows, text(title, 'title', 80), 'entity'), folder: '', properties: [] };
  object(document.design.semantic).entities = [...rows, item]; return item.id;
}
export function entityProperties(document: SketchDocument, id: string, input: unknown): void {
  const entity = collection(document, 'semantic', 'entities').find(item => item.id === id);
  requireSketch(entity, 'BRICK_REFERENCE', 'Entity does not exist.');
  const properties = list(input, 'properties', 40).map(value => {
    const item = object(value); keys(item, ['key', 'type', 'required']);
    const key = text(item.key, 'key', 60);
    requireSketch(/^[A-Za-z][A-Za-z0-9_-]*$/.test(key) && !['id', 'type', 'constructor', 'prototype', '__proto__'].includes(key), 'BRICK_PROPERTY', 'Invalid or reserved entity property.');
    requireSketch(['text', 'number', 'checkbox', 'date', 'datetime', 'tags', 'list'].includes(String(item.type)) && typeof item.required === 'boolean', 'BRICK_PROPERTY', 'Use a supported property type and a boolean required flag.');
    return { key, type: item.type, required: item.required };
  });
  requireSketch(new Set(properties.map(item => item.key)).size === properties.length, 'BRICK_PROPERTY', 'Duplicate entity properties.');
  entity.properties = properties;
}
export function sourceAdd(document: SketchDocument, title: unknown, kind: unknown): string {
  requireSketch(kind === 'vault' || kind === 'api' || kind === 'database', 'BRICK_SOURCE', 'Use vault, api or database. No connection is opened.');
  const rows = collection(document, 'dataSources', 'sources');
  requireSketch(rows.length < 24, 'BRICK_LIMIT', 'At most 24 data sources.');
  const item = { ...identity(rows, text(title, 'title', 80), 'source'), kind, operations: [] };
  object(document.design.dataSources).sources = [...rows, item]; return item.id;
}
export function brickRename(document: SketchDocument, kind: unknown, id: string, title: unknown): void {
  requireSketch(kind === 'entity' || kind === 'data-source', 'BRICK_KIND', 'Use entity or data-source.');
  const rows = kind === 'entity' ? collection(document, 'semantic', 'entities') : collection(document, 'dataSources', 'sources');
  const item = rows.find(item => item.id === id); requireSketch(item, 'BRICK_REFERENCE', 'Brick does not exist.');
  item.name = text(title, 'title', 80);
}
export function routeSet(document: SketchDocument, page: string, input: unknown): void {
  requireSketch(document.design.nodes.some(item => item.id === page && !['group', 'action'].includes(item.kind)), 'BRICK_REFERENCE', 'Route needs an existing page.');
  const path = text(input, 'route path', 200);
  requireSketch(/^\/(?:[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*)?$/.test(path), 'BRICK_ROUTE', 'Use / or a slash-separated route with portable segments.');
  const sitemap = document.design.sitemap ??= { schema: 1, routes: [], journeys: [] };
  const existing = sitemap.routes.find(item => item.surface === page);
  requireSketch(!sitemap.routes.some(item => item.path.toLowerCase() === path.toLowerCase() && item !== existing), 'BRICK_ROUTE', 'Route already used.');
  if (existing) existing.path = path;
  else sitemap.routes.push({ id: 'route-' + page, surface: page, path });
}
export function pageParent(document: SketchDocument, page: string, parent: string | null): void {
  const item = document.design.nodes.find(item => item.id === page);
  requireSketch(item && (parent === null || document.design.nodes.some(item => item.id === parent)), 'BRICK_REFERENCE', 'Sitemap page or parent does not exist.');
  item.parent = parent;
}
export function journeyAdd(document: SketchDocument, title: unknown, pages: string[]): string {
  requireSketch(pages.length >= 1 && pages.length <= 120 && pages.every(id => document.design.nodes.some(item => item.id === id && !['group', 'action'].includes(item.kind))), 'BRICK_JOURNEY', 'Journey needs 1–120 existing pages.');
  const sitemap = document.design.sitemap ??= { schema: 1, routes: [], journeys: [] };
  requireSketch(sitemap.journeys.length < 64, 'BRICK_LIMIT', 'At most 64 journeys.');
  const name = text(title, 'title'), id = slug(name, 'journey', sitemap.journeys.map(item => item.id));
  // A described journey does not invent executable navigation or completion evidence.
  const steps = pages.map((surface, index) => {
    const links = document.design.links.filter(link => link.from === pages[index - 1] && link.to === surface && link.kind === 'navigate');
    return { id: `${id}-step-${index + 1}`, surface, via: index && links.length === 1 ? links[0]!.id : null };
  });
  sitemap.journeys.push({ id, name, steps }); return id;
}
export function groupAdd(document: SketchDocument, value: unknown): string {
  const surface = newSitemapSurface(document.design, text(value, 'title'), 'group', null);
  document.design.nodes.push(surface); document.design.nextId = Number(surface.id.slice('node-'.length)) + 1;
  return surface.id;
}
export function navigationAdd(document: SketchDocument, from: string, to: string, value: unknown): string {
  requireSketch([from, to].every(id => document.design.nodes.some(item => item.id === id && item.kind !== 'group')), 'BRICK_REFERENCE', 'Navigation needs existing pages.');
  requireSketch(document.design.links.length < 120, 'BRICK_LIMIT', 'At most 120 navigation links.');
  const label = text(value, 'title'), id = slug('link-' + label, 'link', document.design.links.map(item => item.id));
  document.design.links.push({ id, from, to, kind: 'navigate', label }); return id;
}
