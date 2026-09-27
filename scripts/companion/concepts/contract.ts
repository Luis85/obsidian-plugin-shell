import { validateAuthoringDocument, type AuthoringDocument } from '../authoring-contract.ts';
import { assertJson, record, utf8Length } from '../sitemap/safety.ts';

/** Fixed canonical collections, not caller-selected JSON pointers or file paths. */
export const conceptCollections = Object.freeze(['nodes', 'links', 'library', 'prds',
  'visualDesigns.pages', 'visualDesigns.components', 'visualDesigns.layouts', 'visualDesigns.revisions',
  'sitemap.routes', 'sitemap.journeys', 'features.items',
  'semantic.entities', 'semantic.relationships', 'dataSources.sources', 'dataSources.flows'] as const);
export type ConceptCollection = (typeof conceptCollections)[number];
export interface ConceptReference { collection: ConceptCollection; id: string }
export type ConceptChange = ConceptReference & (
  { op: 'add' | 'replace'; value: Record<string, unknown> } | { op: 'remove' }
);
interface ConceptBase { id: string | null; projectId: string; baseSha256: string | null }
export type Concept = ConceptBase & (
  { mode: 'project'; project: AuthoringDocument } |
  { mode: 'feature' | 'improvement'; baseSha256: string; references: ConceptReference[]; changes: ConceptChange[] }
);

export function conceptRequire(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new Error(code + ': ' + message);
}
function exact(value: unknown, required: readonly string[]): asserts value is Record<string, unknown> {
  conceptRequire(record(value) && Object.keys(value).length === required.length && required.every(key => Object.hasOwn(value, key)),
    'CONCEPT_SHAPE', 'Unexpected or missing concept fields.');
}
function identifier(value: unknown): asserts value is string {
  conceptRequire(typeof value === 'string' && value.length > 0 && value.length <= 120 &&
    !['__proto__', 'constructor', 'prototype'].includes(value) && !/[\x00-\x1f\x7f]/.test(value),
  'CONCEPT_IDENTITY', 'Use a bounded stable identity.');
}
function reference(value: Record<string, unknown>): asserts value is Record<string, unknown> & ConceptReference {
  identifier(value.id);
  conceptRequire(conceptCollections.some(key => key === value.collection), 'CONCEPT_COLLECTION', 'Use a supported canonical collection.');
}
function unique(values: ConceptReference[]): void {
  const identities = values.map(value => JSON.stringify([value.collection, value.id]));
  conceptRequire(new Set(identities).size === identities.length, 'CONCEPT_DUPLICATE', 'An artifact may occur only once in a collection.');
}
function assertManifest(value: Record<string, unknown>): asserts value is Record<string, unknown> & Concept {
  const project = value.mode === 'project';
  exact(value, ['kind', 'schemaVersion', 'id', 'mode', 'projectId', 'baseSha256',
    ...(project ? ['project'] : ['references', 'changes'])]);
  conceptRequire(value.kind === 'obsidian-companion-concept' && value.schemaVersion === 1,
    'CONCEPT_VERSION', 'Unsupported concept format/version.');
  conceptRequire(['project', 'feature', 'improvement'].includes(String(value.mode)), 'CONCEPT_MODE', 'Select project, feature or improvement.');
  identifier(value.id); identifier(value.projectId);
  conceptRequire(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value.id) && value.id.length <= 60,
    'CONCEPT_IDENTITY', 'Use a lowercase portable concept ID.');
  conceptRequire(project && value.baseSha256 === null || typeof value.baseSha256 === 'string' && /^[a-f0-9]{64}$/.test(value.baseSha256),
    'CONCEPT_BASE_REQUIRED', 'Scoped imports require the SHA-256 of the exact saved project bytes.');
  if (project) {
    const document = validateAuthoringDocument(value.project);
    conceptRequire(document.project.id === value.projectId, 'CONCEPT_IDENTITY', 'Concept target and project identity differ.');
    return;
  }
  conceptRequire(Array.isArray(value.references) && value.references.length <= 1200 &&
    Array.isArray(value.changes) && value.changes.length > 0 && value.changes.length <= 600,
  'CONCEPT_LIMIT', 'Use at most 1200 references and 1–600 explicit changes.');
  const refs: ConceptReference[] = [], changes: ConceptReference[] = [];
  for (const item of value.references) { exact(item, ['collection', 'id']); reference(item); refs.push(item); }
  for (const item of value.changes) {
    conceptRequire(record(item), 'CONCEPT_SHAPE', 'Expected an artifact change.');
    exact(item, ['collection', 'op', 'id', ...(item.op === 'remove' ? [] : ['value'])]); reference(item);
    conceptRequire(['add', 'replace', 'remove'].includes(String(item.op)), 'CONCEPT_OPERATION', 'Unknown change operation.');
    conceptRequire(value.mode !== 'feature' || item.op === 'add', 'CONCEPT_ADDITIVE_ONLY', 'A new feature only adds artifacts; use improvement to change existing artifacts.');
    conceptRequire(item.collection !== 'visualDesigns.revisions' || item.op === 'add',
      'CONCEPT_IMMUTABLE_REVISION', 'Published revisions cannot be replaced or removed by concept intake.');
    if (item.op !== 'remove') conceptRequire(record(item.value) && item.value.id === item.id,
      'CONCEPT_IDENTITY', 'The payload must be the complete canonical record with the same ID.');
    changes.push(item);
  }
  unique(refs); unique(changes);
}

/** Transport only. Nested canonical records are validated after constructing a complete candidate. */
export function parseConcept(text: string): Concept {
  conceptRequire(typeof text === 'string' && utf8Length(text) <= 4_000_000, 'CONCEPT_LIMIT', 'Concept JSON exceeds 4 MB.');
  let input: unknown;
  try { input = JSON.parse(text); } catch { throw new Error('CONCEPT_JSON: Expected UTF-8 JSON.'); }
  assertJson(input);
  conceptRequire(record(input), 'CONCEPT_SHAPE', 'Expected a full project or a concept manifest.');
  if (input.kind === 'obsidian-companion-project') {
    const project = validateAuthoringDocument(input);
    return { id: null, mode: 'project', projectId: project.project.id, baseSha256: null, project };
  }
  assertManifest(input);
  return input;
}

/** Data transport discovery; semantic rules and the canonical project validator remain required. */
export function conceptSchema() {
  const id = { type: 'string', minLength: 1, maxLength: 120 }, collection = { enum: [...conceptCollections] };
  const ref = { type: 'object', additionalProperties: false, required: ['collection', 'id'], properties: { collection, id } };
  const change = (mode: string) => ({ oneOf: (mode === 'feature' ? ['add'] : ['add', 'replace', 'remove']).map(op => ({
    type: 'object', additionalProperties: false, required: ['collection', 'id', 'op', ...(op === 'remove' ? [] : ['value'])],
    properties: { collection: op === 'add' ? collection : { enum: conceptCollections.filter(key => key !== 'visualDesigns.revisions') },
      id, op: { const: op }, ...(op === 'remove' ? {} : { value: { type: 'object', required: ['id'], properties: { id } } }) },
  })) });
  return { $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'Companion concept transport v1', oneOf: ['project', 'feature', 'improvement'].map(mode => ({
    type: 'object', additionalProperties: false,
    required: ['kind', 'schemaVersion', 'id', 'mode', 'projectId', 'baseSha256', ...(mode === 'project' ? ['project'] : ['references', 'changes'])],
    properties: { kind: { const: 'obsidian-companion-concept' }, schemaVersion: { const: 1 },
      id: { type: 'string', maxLength: 60, pattern: '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$' }, mode: { const: mode }, projectId: id,
      baseSha256: { type: mode === 'project' ? ['string', 'null'] : 'string', pattern: '^[a-f0-9]{64}$' },
      ...(mode === 'project' ? { project: { type: 'object', description: 'Complete canonical project; validated by the shared authoring contract.' } } : {
        references: { type: 'array', maxItems: 1200, items: ref }, changes: { type: 'array', minItems: 1, maxItems: 600, items: change(mode) },
      }),
    },
  })) };
}
