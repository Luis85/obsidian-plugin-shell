import { migrateAuthoringDocument, validateAuthoringDocument, type AuthoringDocument } from '../authoring-contract.ts';
import { emptyVisualDesigns } from '../visual/visual-ir.mjs';
import { assertJson, record } from '../sitemap/safety.ts';
import { conceptRequire, type Concept, type ConceptCollection, type ConceptChange } from './contract.ts';

interface CurrentProject { document: AuthoringDocument; sha256: string }
export interface ConceptDelta { collection: ConceptCollection; op: 'add' | 'replace' | 'remove'; id: string }
/** References expose IDs only; records remain in the single canonical authoring model. */
function collection(document: AuthoringDocument, key: ConceptCollection, create = false): Array<Record<string, unknown>> {
  const [group, name] = key.split('.');
  const design = document.design;
  if (create && name && !Object.hasOwn(design, group!)) {
    if (group === 'sitemap') design.sitemap = { schema: 1, routes: [], journeys: [] };
    if (group === 'features') design.features = { schema: 1, items: [] };
    if (group === 'visualDesigns') design.visualDesigns = emptyVisualDesigns();
  }
  const owner = name ? design[group!] : design;
  if (!record(owner) || !Object.hasOwn(owner, name ?? group!)) {
    conceptRequire(!create, 'CONCEPT_SUBSYSTEM_REQUIRED', 'Initialize the canonical subsystem in the companion before importing its records.');
    return [];
  }
  const items = owner[name ?? group!];
  conceptRequire(Array.isArray(items) && items.every(record), 'CONCEPT_COLLECTION', 'The canonical collection is not a record array.');
  return items;
}
function change(document: AuthoringDocument, item: ConceptChange): void {
  const items = collection(document, item.collection, true), index = items.findIndex(value => value.id === item.id);
  if (item.op === 'add') {
    conceptRequire(index === -1, 'CONCEPT_ID_COLLISION', `Existing ${item.collection} identity: ${item.id}. Remap the concept explicitly before retrying.`);
    items.push(structuredClone(item.value));
  } else {
    conceptRequire(index !== -1, 'CONCEPT_REFERENCE', `Missing ${item.collection} identity: ${item.id}.`);
    if (item.op === 'replace') items[index] = structuredClone(item.value);
    else items.splice(index, 1);
  }
}
/** Update allocation counters only, not canvas positions or authored route/reading order. */
function advanceCounter(owner: Record<string, unknown>, prefixes: RegExp): void {
  if (!Object.hasOwn(owner, 'nextId')) return;
  let next = Number(owner.nextId);
  const visit = (item: unknown): void => {
    if (Array.isArray(item)) { item.forEach(visit); return; }
    if (!record(item)) return;
    const match = typeof item.id === 'string' ? prefixes.exec(item.id) : null;
    if (match) {
      const number = Number(match[1]);
      conceptRequire(Number.isSafeInteger(number) && number >= 0 && number < Number.MAX_SAFE_INTEGER - 100001,
        'CONCEPT_COUNTER', 'A numeric artifact ID exceeds the allocation range.');
      next = Math.max(next, number + 1);
    }
    Object.values(item).forEach(visit);
  };
  visit(owner); owner.nextId = next;
}
function featureOwnership(document: AuthoringDocument, changes: ConceptChange[]): void {
  const features = changes.filter(item => item.collection === 'features.items' && item.op === 'add');
  conceptRequire(features.length > 0, 'CONCEPT_FEATURE_OWNER', 'A new-feature concept must add an explicit feature definition.');
  const owned = new Set(document.design.features?.items.filter(item => features.some(f => f.id === item.id)).flatMap(item => item.surfaces));
  const added = new Set(changes.filter(item => item.collection === 'nodes').map(item => item.id));
  conceptRequire([...added].every(id => owned.has(id)) && [...owned].every(id => added.has(id)),
    'CONCEPT_FEATURE_OWNER', 'New features must own exactly their newly added surfaces, not adopt existing ones.');
}

/** Pure candidate transformation; the CLI applies full compiler and ownership validation before persistence. */
export function applyConcept(concept: Concept, current?: CurrentProject) {
  assertJson(concept);
  if (concept.mode !== 'project') conceptRequire(current, 'CONCEPT_BASE_REQUIRED', 'Scoped concepts need an existing saved project.');
  if (concept.baseSha256 !== null) conceptRequire(current && current.sha256 === concept.baseSha256,
    'CONCEPT_BASE_STALE', 'The saved project differs from the concept base. Reconcile the concept against a new inspected base.');
  if (concept.mode === 'project') {
    const migrated = migrateAuthoringDocument(concept.project);
    return { document: structuredClone(migrated.document), migration: migrated.report, changes: [] as ConceptDelta[] };
  }
  conceptRequire(current?.document.project.id === concept.projectId, 'CONCEPT_IDENTITY', 'The concept belongs to another project.');
  const migrated = migrateAuthoringDocument(current.document), document = structuredClone(migrated.document);
  for (const reference of concept.references) conceptRequire(collection(document, reference.collection).some(item => item.id === reference.id),
    'CONCEPT_REFERENCE', `Missing reviewed external reference: ${reference.collection}/${reference.id}.`);
  concept.changes.forEach(item => change(document, item));
  advanceCounter(document.design, /^(?:node|edge|brick)-(\d+)$/);
  if (record(document.design.visualDesigns)) advanceCounter(document.design.visualDesigns, /^(?:vp|vc|vn|vi|vr|vl)-(\d+)$/);
  if (record(document.design.semantic)) advanceCounter(document.design.semantic, /^er-[a-z]+-(\d+)$/);
  if (record(document.design.dataSources)) advanceCounter(document.design.dataSources, /^ds-[a-z]+-(\d+)$/);
  validateAuthoringDocument(document);
  if (concept.mode === 'feature') featureOwnership(document, concept.changes);
  return { document, migration: migrated.report, changes: concept.changes.map(({ collection, op, id }) => ({ collection, op, id })) };
}
