import { newSitemapSurface } from '../../scripts/companion/sitemap/create.ts';
import type { SketchDocument } from './document.ts';
import { object, keys, list, text } from './data.ts';
import { requireSketch, slug } from './errors.ts';
import { companionRelativeFolder } from '../../scripts/companion/authoring-contract.ts';
function collection(document: SketchDocument, store: 'semantic' | 'dataSources', field: 'entities' | 'sources'): Record<string, unknown>[] {
  document.design[store] ??= store === 'semantic' ? { schema: 1, nextId: 1, entities: [], relationships: [], sections: [],
    canvas: { positions: {}, viewport: { x: 40, y: 40, zoom: 1 }, snap: true } } : { schema: 1, nextId: 1, sources: [], flows: [], positions: {} };
  const data = object(document.design[store]);
  data[field] ??= [];
  return list(data[field], field, field === 'entities' ? 60 : 24).map(object);
}
function identity(rows: Record<string, unknown>[], name: string, prefix: string) {
  return { id: slug(name, prefix, rows.map(item => String(item.id))), slug: slug(name, prefix, rows.map(item => String(item.slug))), name };
}
/** Canonical IDs share one monotonic counter per catalog, like the browser Companion. */
function catalogId(catalog: Record<string, unknown>, kind: string): string {
  const n = Number(catalog.nextId);
  requireSketch(Number.isSafeInteger(n) && n > 0 && n < Number.MAX_SAFE_INTEGER - 100000, 'BRICK_ID', 'Catalog identity capacity exhausted.');
  catalog.nextId = n + 1;
  return kind + '-' + n;
}
export function entityAdd(document: SketchDocument, title: unknown): string {
  const rows = collection(document, 'semantic', 'entities');
  requireSketch(rows.length < 60, 'BRICK_LIMIT', 'At most 60 entities.');
  const m = object(document.design.semantic), info = identity(rows, text(title, 'title', 80), 'entity');
  const item = m.schema === 1 ? { ...info, id: catalogId(m, 'er-entity'), folder: '', description: '', section: null, properties: [] } : { ...info, folder: '', properties: [] };
  m.entities = [...rows, item]; return item.id;
}
export function entityProperties(document: SketchDocument, id: string, input: unknown): void {
  const entity = collection(document, 'semantic', 'entities').find(item => item.id === id);
  requireSketch(entity, 'BRICK_REFERENCE', 'Entity does not exist.');
  const m = object(document.design.semantic), canonical = m.schema === 1;
  const previous = list(entity.properties ?? [], 'properties', 40).map(object);
  const properties = list(input, 'properties', 40).map(value => {
    const item = object(value); keys(item, ['key', 'type', 'required']);
    const key = text(item.key, 'key', 60);
    requireSketch((canonical ? /^[a-z][a-z0-9_]{0,59}$/.test(key) : /^[A-Za-z][A-Za-z0-9_-]*$/.test(key)) && !['id', 'type', 'constructor', 'prototype', '__proto__'].includes(key), 'BRICK_PROPERTY', 'Invalid or reserved entity property.');
    requireSketch(['text', 'number', 'checkbox', 'date', 'datetime', 'tags', 'list'].includes(String(item.type)) && typeof item.required === 'boolean', 'BRICK_PROPERTY', 'Use a supported property type and a boolean required flag.');
    const old = previous.find(row => row.key === key);
    return canonical ? { id: typeof old?.id === 'string' && /^er-property-[1-9][0-9]*$/.test(old.id) ? old.id : catalogId(m, 'er-property'),
      key, type: item.type, required: item.required } : { key, type: item.type, required: item.required };
  });
  requireSketch(new Set(properties.map(item => item.key)).size === properties.length, 'BRICK_PROPERTY', 'Duplicate entity properties.');
  entity.properties = properties;
}
/** Construct a fresh field schema for every property; callers never share mutable schema objects. */
function collectionFieldSchema(kind: string): Record<string, unknown> | null {
  switch (kind) {
    case 'text': return { type: 'string' };
    case 'number': return { type: 'number' };
    case 'checkbox': return { type: 'boolean' };
    case 'date': return { type: 'string', format: 'date' };
    case 'datetime': return { type: 'string', format: 'date-time' };
    case 'tags': return { type: 'array', items: { type: 'string' } };
    case 'list': return { type: 'array', items: { type: ['string', 'number'] } };
    default: return null;
  }
}
function addCollectionFields(entity: Record<string, unknown>, properties: Record<string, unknown>, required: string[]): void {
  for (const value of list(entity.properties ?? [], 'properties', 40)) {
    const property = object(value), key = text(property.key, 'property key', 60);
    const shape = collectionFieldSchema(String(property.type));
    requireSketch(!Object.hasOwn(properties, key) && shape !== null, 'BRICK_COLLECTION_ENTITY', 'Collection entity has an unsupported or duplicate property.');
    properties[key] = shape;
    if (property.required === true) required.push(key);
  }
}
function addCollectionRelationships(document: SketchDocument, entity: Record<string, unknown>,
  properties: Record<string, unknown>, required: string[]): void {
  const semantic = object(document.design.semantic);
  for (const value of list(semantic.relationships ?? [], 'relationships', 120)) {
    const relationship = object(value);
    if (relationship.source !== entity.id) continue;
    const key = text(relationship.key, 'relationship key', 60), card = String(relationship.targetCard);
    requireSketch(!Object.hasOwn(properties, key) && ['0..1', '1', '1..1', '0..*', '1..+'].includes(card),
      'BRICK_COLLECTION_ENTITY', 'Collection entity has an unsupported relationship.');
    properties[key] = card.endsWith('*') ? { type: 'array', items: { type: 'string' } } : { type: 'string' };
    if (card.startsWith('1')) required.push(key);
  }
}
function collectionRecordSchema(document: SketchDocument, entity: Record<string, unknown>): Record<string, unknown> {
  const properties: Record<string, unknown> = { id: { type: 'string' }, type: { type: 'string', enum: [String(entity.slug)] } };
  const required = ['id', 'type'];
  addCollectionFields(entity, properties, required);
  addCollectionRelationships(document, entity, properties, required);
  return { type: 'object', properties, required, additionalProperties: true };
}
function collectionOperations(sourceId: string, entityId: string, folder: string, record: Record<string, unknown>,
  allocate = (kind: string) => sourceId + '-' + kind) {
  const recordSchema = object(record), recordProperties = object(recordSchema.properties);
  const values = { type: 'object', properties: Object.fromEntries(Object.entries(recordProperties).filter(([key]) => !['id', 'type'].includes(key))),
    required: list(recordSchema.required, 'required').filter(key => !['id', 'type'].includes(String(key))), additionalProperties: false };
  const objectSchema = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
  const snapshot = objectSchema({ record, revision: { type: 'integer' } });
  const shape = (schema: Record<string, unknown> | null) => schema === null
    ? { mode: 'none', entity: null, many: false, fields: [], schema: null }
    : { mode: 'schema', entity: null, many: false, fields: [], schema };
  return [
    ['list', 'List records', 'read', null, { type: 'array', items: snapshot }],
    ['create', 'Create record', 'write', objectSchema({ values, requestId: { type: 'string' } }), snapshot],
    ['update', 'Update record', 'write', objectSchema({ id: { type: 'string' }, revision: { type: 'integer' }, values }), snapshot],
    ['delete', 'Delete record', 'write', objectSchema({ id: { type: 'string' }, revision: { type: 'integer' } }), null],
  ].map(([operation, name, direction, input, output]) => ({
    id: allocate(String(operation)), slug: operation, name, direction, method: 'adapter', resource: folder,
    description: 'Managed Collection CRUD over Markdown notes in the active vault.',
    input: shape(input as Record<string, unknown> | null), output: shape(output as Record<string, unknown> | null),
    implementation: { kind: 'note', entity: entityId, operation },
  }));
}
export function collectionAdd(document: SketchDocument, title: unknown, inputPath: unknown, entityId: string): string {
  const entities = collection(document, 'semantic', 'entities'), entity = entities.find(item => item.id === entityId);
  requireSketch(entity, 'BRICK_REFERENCE', 'Collection needs an existing entity.');
  const folder = text(inputPath, 'collection path', 120);
  requireSketch(companionRelativeFolder(folder) && folder.split('/').every(part => /^[A-Za-z][A-Za-z0-9 _-]*$/.test(part)),
    'BRICK_COLLECTION_PATH', 'Use a safe, visible entity folder in the active vault.');
  requireSketch(entity.folder === '' || entity.folder === folder, 'BRICK_COLLECTION_PATH', 'The selected entity already has a different note folder.');
  entity.folder = folder;
  const rows = collection(document, 'dataSources', 'sources');
  requireSketch(rows.length < 24, 'BRICK_LIMIT', 'At most 24 data sources.');
  const m = object(document.design.dataSources), info = identity(rows, text(title, 'title', 80), 'source');
  const canonical = m.schema === 1;
  const item = { ...info, ...(canonical ? { id: catalogId(m, 'ds-source') } : {}), kind: 'collection', status: 'active', description: '',
    locator: 'vault://active', auth: 'none', credentialRef: '', collectionPath: folder, entity: entityId, operations: [] as unknown[] };
  item.operations = collectionOperations(item.id, entityId, folder, collectionRecordSchema(document, entity),
    canonical ? () => catalogId(m, 'ds-operation') : kind => item.id + '-' + kind);
  m.sources = [...rows, item];
  return item.id;
}

/** Resolve one shared source operation; no second collection-binding format. */
export function sourceOperation(document: SketchDocument, sourceId: string, operationRef: string) {
  const source = collection(document, 'dataSources', 'sources').find(row => row.id === sourceId);
  requireSketch(source, 'BRICK_SOURCE', 'Select an existing source.');
  const operation = list(source.operations ?? [], 'operations', 12).map(object).find(row => row.id === operationRef || row.slug === operationRef);
  requireSketch(operation, 'BRICK_SOURCE_OPERATION', 'Select an existing operation on that source.');
  requireSketch(source.status !== 'deprecated', 'BRICK_SOURCE_DEPRECATED', 'Deprecated sources cannot gain new bindings.');
  return { source, operation };
}
export function sourceAdd(document: SketchDocument, title: unknown, kind: unknown): string {
  requireSketch(kind === 'vault' || kind === 'api' || kind === 'database', 'BRICK_SOURCE', 'Use vault, api or database. No connection is opened.');
  const rows = collection(document, 'dataSources', 'sources');
  requireSketch(rows.length < 24, 'BRICK_LIMIT', 'At most 24 data sources.');
  const m = object(document.design.dataSources), info = identity(rows, text(title, 'title', 80), 'source');
  const item = m.schema === 1 ? { ...info, id: catalogId(m, 'ds-source'), kind, status: 'draft', description: '',
    locator: kind === 'vault' ? 'vault://active' : '', auth: 'none', credentialRef: '', operations: [] } : { ...info, kind, operations: [] };
  m.sources = [...rows, item]; return item.id;
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
