/** The Markdown transport is a projection, never a second executable project format. */
export type ObjectData = Record<string, unknown>;
export const DOC_TYPES = ['project', 'page', 'component', 'interaction', 'journey', 'route', 'transition', 'layout', 'component-revision', 'library-component', 'feature', 'prd'] as const;
export type DocType = typeof DOC_TYPES[number];
export interface Entity {
  type: DocType; id: string; project: string; title: string;
  fields: ObjectData; data: ObjectData;
}
export interface Binding { path: string; baseline: Entity; generatedHash: string | null }
export interface DocsIndex { schemaVersion: 1; project: string; entries: Record<string, Binding>; navigation?: Record<string, string> }
export interface Conflict { entity: string; field: string; reason: string }
export type Resolutions = Record<string, 'markdown' | 'project'>;
class DocsError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(`${code}: ${message}`); this.name = 'DocsError'; this.code = code; }
}
export function insist(ok: unknown, code: string, message: string): asserts ok {
  if (!ok) throw new DocsError(code, message);
}
export function docsObject(value: unknown): ObjectData {
  insist(value !== null && typeof value === 'object' && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'DOCS_SHAPE', 'Expected a plain object.');
  return value as ObjectData;
}
export function array(value: unknown): unknown[] {
  insist(Array.isArray(value), 'DOCS_SHAPE', 'Expected an array.'); return value;
}
export function text(value: unknown, name = 'value'): string {
  // Intentional identity boundary: reject ASCII control characters in managed text.
  // oxlint-disable-next-line no-control-regex
  insist(typeof value === 'string' && value.length > 0 && value.length <= 240 && !/[\u0000-\u001f\u007f]/u.test(value),
    'DOCS_FIELD', `${name} needs nonempty, bounded text.`); return value;
}
export function jsonData(value: unknown, depth = 0, budget = { count: 0 }): void {
  insist(depth <= 40 && ++budget.count <= 180000, 'DOCS_LIMIT', 'Data exceeds its depth/value budget.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') { insist(Number.isFinite(value), 'DOCS_NUMBER', 'Use finite JSON numbers.'); return; }
  const entries = Array.isArray(value) ? Object.entries(value) : Object.entries(docsObject(value));
  for (const [key, child] of entries) {
    insist(!['__proto__', 'prototype', 'constructor'].includes(key), 'DOCS_KEY', 'Unsafe object key.');
    jsonData(child, depth + 1, budget);
  }
}
export function stable(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(docsObject(value)).sort().map(key => JSON.stringify(key) + ':' + stable(docsObject(value)[key])).join(',') + '}';
  return JSON.stringify(value);
}
export const equal = (left: unknown, right: unknown): boolean => stable(left) === stable(right);
export function keyOf(entity: Entity): string {
  return [entity.type, entity.id].map(encodeURIComponent).join(':');
}
export const fieldNames: Record<DocType, readonly string[]> = {
  project: [], page: ['surface_kind', 'visual_id'], component: ['library_id', 'export_name'],
  interaction: ['owner_type', 'owner_id', 'source_node_id', 'event', 'position'],
  journey: [], route: ['surface_id', 'path'], transition: ['from', 'to', 'kind'],
  layout: [], 'component-revision': [], 'library-component': [], feature: [], prd: ['label_field'],
};
export function validateEntity(entity: Entity): void {
  insist(DOC_TYPES.includes(entity.type), 'DOCS_TYPE', 'Unknown document type.');
  text(entity.id, 'id'); text(entity.project, 'project'); text(entity.title, 'title');
  jsonData(entity); docsObject(entity.fields); docsObject(entity.data);
  insist(Object.keys(entity.fields).every(name => fieldNames[entity.type].includes(name)), 'DOCS_FIELD', 'Unknown managed field.');
  for (const [name, value] of Object.entries(entity.fields)) {
    if (name === 'position') insist(Number.isSafeInteger(value) && Number(value) >= 0, 'DOCS_FIELD', 'position must be a nonnegative integer.');
    else text(value, name);
  }
  if (entity.type === 'interaction') for (const name of ['owner_type', 'owner_id', 'source_node_id', 'event']) text(entity.fields[name], name);
}
/** Accepted concise hand-authoring forms normalize before semantic reconciliation. */
const payloadKeys: Partial<Record<DocType, readonly string[]>> = {
  project: ['identity', 'settings', 'notes', 'design', 'order', 'tooling'],
  page: ['surface', 'visual'], component: ['library', 'visual'],
  interaction: ['actions', 'notes', 'acceptance', 'emptyLabel'], journey: ['steps'], route: [],
};
// Identity lives in frontmatter; structured payloads must not repeat it.
const identityRules: Partial<Record<DocType, ReadonlyArray<readonly [string, readonly string[], string]>>> = {
  page: [['visual', ['id', 'ownerId'], 'Visual identity belongs in frontmatter.'], ['surface', ['id', 'label', 'kind'], 'Surface identity belongs in frontmatter.']],
  component: [['library', ['id', 'name'], 'Library identity belongs in frontmatter.'], ['visual', ['id', 'libraryId', 'exportName'], 'Component identity belongs in frontmatter.']],
};
function liftProjectIdentity(data: ObjectData): void {
  const identity = data.identity === undefined ? {} : docsObject(data.identity);
  for (const key of ['author', 'version', 'description']) if (Object.hasOwn(data, key)) { identity[key] = data[key]; delete data[key]; }
  if (Object.keys(identity).length) data.identity = identity;
}
function rejectIdentity(value: unknown, keys: readonly string[], message: string): void {
  if (value) insist(!keys.some(key => Object.hasOwn(docsObject(value), key)), 'DOCS_PAYLOAD', message);
}
export function normalizePayload(entity: Entity): Entity {
  const value = structuredClone(entity), data = value.data;
  if (value.type === 'component' && !Object.hasOwn(data, 'visual') && !Object.hasOwn(data, 'library')) value.data = { visual: data };
  if (value.type === 'project') liftProjectIdentity(data);
  if (value.type === 'route') value.title = text(value.fields.path, 'path');
  const keys = payloadKeys[value.type];
  insist(!keys || Object.keys(value.data).every(key => keys.includes(key)), 'DOCS_PAYLOAD', 'Unknown structured field on ' + value.type + '.');
  for (const [field, identity, message] of identityRules[value.type] ?? []) rejectIdentity(value.data[field], identity, message);
  return value;
}
