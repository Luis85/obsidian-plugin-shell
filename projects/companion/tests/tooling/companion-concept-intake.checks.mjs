import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { parseConcept, conceptSchema } from '../../scripts/companion/concepts/contract.ts';
import { applyConcept } from '../../scripts/companion/concepts/apply.ts';
import { starterDocument } from '../support/starter-documents.mjs';
const fixture = starterDocument('blank');
const baseHash = 'a'.repeat(64);
function feature() {
  const node = { ...structuredClone(fixture.design.nodes[0]), id: 'node-30', slug: 'capture', label: 'Capture', kind: 'page', parent: fixture.design.nodes[0].id, entry: false, command: false, ribbon: false };
  return { kind: 'obsidian-companion-concept', schemaVersion: 1, id: 'capture-concept', mode: 'feature', projectId: fixture.project.id, baseSha256: baseHash,
    references: [{ collection: 'nodes', id: node.parent }], changes: [
      { collection: 'nodes', op: 'add', id: node.id, value: node },
      { collection: 'features.items', op: 'add', id: 'capture', value: { id: 'capture', name: 'Capture', surfaces: [node.id], entryPoints: [node.id], components: [], requirements: [], dependsOn: [] } },
    ] };
}
const current = () => ({ document: structuredClone(fixture), sha256: baseHash });
const parsed = (value) => parseConcept(JSON.stringify(value));

test('full ordinary project JSON is accepted as a reviewed whole-project concept without rewriting source', () => {
  const before = structuredClone(fixture), concept = parsed(fixture);
  assert.equal(concept.mode, 'project');
  const result = applyConcept(concept);
  assert.equal(result.document.schemaVersion, 6);
  assert.deepEqual(result.document, fixture); assert.ok(!('migration' in result));
  assert.deepEqual(fixture, before);
});
test('a retired project version is refused as a concept, never migrated', () => {
  const retired = structuredClone(fixture); retired.schemaVersion = 5; retired.design.schema = 5;
  assert.throws(() => applyConcept(parsed(retired)), /only schema 6 is supported/);
});
test('a project manifest declares replacement explicitly and validates matching target identity', () => {
  const p = { kind: 'obsidian-companion-concept', schemaVersion: 1, id: 'complete', mode: 'project', projectId: fixture.project.id, baseSha256: null, project: fixture };
  assert.equal(applyConcept(parsed(p)).document.project.id, fixture.project.id);
  assert.throws(() => parsed({ ...p, projectId: 'different' }), /CONCEPT_IDENTITY/);
});
test('feature changes add canonical records, preserve unrelated designs and advance allocated counters', () => {
  const baseline = current(), before = structuredClone(baseline), result = applyConcept(parsed(feature()), baseline);
  assert.equal(result.document.design.nodes.length, fixture.design.nodes.length + 1);
  assert.equal(result.document.design.nextId, 31);
  assert.equal(result.document.design.features.items[0].surfaces[0], 'node-30');
  assert.deepEqual(result.document.design.visualDesigns, fixture.design.visualDesigns);
  assert.deepEqual(result.document.notes, fixture.notes);
  assert.deepEqual(baseline, before);
  assert.deepEqual(result.changes.map(c => [c.collection, c.op, c.id]), [['nodes', 'add', 'node-30'], ['features.items', 'add', 'capture']]);
});
test('scoped modes require an existing matching project and exact reviewed base bytes', () => {
  assert.throws(() => applyConcept(parsed(feature())), /CONCEPT_BASE_REQUIRED/);
  assert.throws(() => applyConcept(parsed(feature()), { ...current(), sha256: 'b'.repeat(64) }), /CONCEPT_BASE_STALE/);
  const wrong = current(); wrong.document.project.id = 'different';
  assert.throws(() => applyConcept(parsed(feature()), wrong), /CONCEPT_IDENTITY/);
});
test('feature imports never replace or delete existing records and must declare a new feature owner', () => {
  const value = feature(); value.changes[0].op = 'replace';
  assert.throws(() => parsed(value), /CONCEPT_ADDITIVE_ONLY/);
  value.changes[0].op = 'add'; value.changes.pop();
  assert.throws(() => applyConcept(parsed(value), current()), /CONCEPT_FEATURE_OWNER/);
});
test('colliding stable IDs are rejected rather than deduplicated or remapped by title', () => {
  const value = feature(); value.changes[0].id = value.changes[0].value.id = fixture.design.nodes[0].id;
  assert.throws(() => applyConcept(parsed(value), current()), /CONCEPT_ID_COLLISION/);
});
test('feature references must exist in the reviewed base; invalid dependencies do not create placeholder records', () => {
  const value = feature(); value.references[0].id = 'missing';
  assert.throws(() => applyConcept(parsed(value), current()), /CONCEPT_REFERENCE/);
  const cycle = feature(); cycle.changes[1].value.dependsOn = ['capture'];
  assert.throws(() => applyConcept(parsed(cycle), current()), error => error.code === 'SITEMAP_CYCLE');
});
test('improvements replace explicit records, not arbitrary property paths or opaque executable patches', () => {
  const node = { ...fixture.design.nodes[0], label: 'New label' };
  const value = { ...feature(), mode: 'improvement', references: [], changes: [{ collection: 'nodes', op: 'replace', id: node.id, value: node }] };
  const result = applyConcept(parsed(value), current());
  assert.equal(result.document.design.nodes[0].label, 'New label');
  assert.deepEqual(result.document.design.nodes[1], fixture.design.nodes[1]);
  assert.throws(() => parsed({ ...value, changes: [{ ...value.changes[0], collection: 'nodes/0/label' }] }), /CONCEPT_COLLECTION/);
});
test('explicit remove is reviewed as a deletion and dangling visual owners are rejected', () => {
  const value = { ...feature(), mode: 'improvement', references: [], changes: [{ collection: 'nodes', op: 'remove', id: fixture.design.nodes[1].id }] };
  const baseline = current();
  baseline.document.design.visualDesigns.pages.push({ id: 'vp-99', ownerId: fixture.design.nodes[1].id, name: 'Settings', root: [], scenarios: [], notes: '' });
  assert.throws(() => applyConcept(parsed(value), baseline), /VISUAL_INVALID/);
  assert.equal(applyConcept(parsed(value), current()).document.design.nodes.length, 1);
});
test('published revisions cannot be overwritten or removed by a concept', () => {
  for (const op of ['replace', 'remove']) {
    const change = { collection: 'visualDesigns.revisions', op, id: 'vr-1', ...(op === 'replace' ? { value: { id: 'vr-1' } } : {}) };
    assert.throws(() => parsed({ ...feature(), mode: 'improvement', changes: [change] }), /CONCEPT_IMMUTABLE_REVISION/);
  }
});
test('unknown manifest versions, executable fields, malformed base hashes and unsafe object keys fail closed', () => {
  for (const value of [{ ...feature(), schemaVersion: 99 }, { ...feature(), execute: true }, { ...feature(), baseSha256: 'not-a-hash' }, { ...feature(), changes: [{ collection: 'nodes', op: 'run', id: 'node-1' }] }]) assert.throws(() => parsed(value));
  assert.throws(() => parseConcept('{"kind":"obsidian-companion-concept","__proto__":{}}'));
  assert.throws(() => parseConcept(' '.repeat(4_000_001)), /CONCEPT_LIMIT/);
});
test('same record cannot appear twice and payload identity must equal its change identity', () => {
  const value = feature(); value.changes.push(structuredClone(value.changes[0]));
  assert.throws(() => parsed(value), /CONCEPT_DUPLICATE/);
  const other = feature(); other.changes[0].value.id = 'other';
  assert.throws(() => parsed(other), /CONCEPT_IDENTITY/);
});
test('schema discovery describes only the implemented data transport and denies executable extensions', () => {
  const schema = conceptSchema();
  assert.ok(schema.$schema);
  assert.equal(schema.oneOf.length, 3);
  assert.ok(schema.oneOf.every(row => row.additionalProperties === false));
  assert.deepEqual(schema.oneOf.map(row => row.properties.mode.const), ['project', 'feature', 'improvement']);
});

test('the checked-in project/feature/improvement example has exact base hashes and valid canonical candidates', async () => {
  const { createHash } = await import('node:crypto');
  const { serializeJson } = await import('../../scripts/contracts/serialization.ts');
  const hash = value => createHash('sha256').update(value).digest('hex');
  const base = new URL('../../docs/concepts/concept-intake-example/', import.meta.url);
  const projectText = await readFile(new URL('project.json', base), 'utf8');
  const project = applyConcept(parseConcept(projectText)).document;
  const added = applyConcept(parseConcept(await readFile(new URL('feature.json', base), 'utf8')), { document: project, sha256: hash(serializeJson(project)) });
  const improved = applyConcept(parseConcept(await readFile(new URL('improvement.json', base), 'utf8')), { document: added.document, sha256: hash(serializeJson(added.document)) });
  assert.equal(improved.document.design.nodes.find(node => node.id === 'node-80').label, 'Capture details');
  assert.equal(improved.document.design.visualDesigns.pages.find(page => page.id === 'vp-100').root[0].value.value, 'Capture your next idea');
});
