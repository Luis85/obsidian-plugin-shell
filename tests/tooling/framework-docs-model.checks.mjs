import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { projectFixture } from '../fixtures/application-docs/fixture.mjs';
import { projectEntities, applyEntities } from '../../scripts/application-docs/adapters/model.ts';
import { migrateAuthoringDocument } from '../../scripts/companion/authoring-contract.ts';
import { newDocument } from '../../bin/domain/document.ts';
import { mergeEntity } from '../../scripts/application-docs/domain/merge.ts';
import { keyOf, normalizePayload } from '../../scripts/application-docs/domain/contracts.ts';
import { reconcile } from '../../scripts/application-docs/application/reconcile.ts';
const selected = () => projectEntities(projectFixture().project).find(entity => entity.type === 'page');
const changed = (entity, patch) => ({ ...structuredClone(entity), ...patch });
test('real pages, component, owner-bound event, route, transition and journey round-trip', () => {
  const { project, overview, instance, interaction } = projectFixture(), entities = projectEntities(project);
  const event = entities.find(entity => entity.type === 'interaction');
  assert.equal(event.id, interaction); assert.equal(event.fields.owner_id, overview); assert.equal(event.fields.source_node_id, instance);
  assert.deepEqual(applyEntities(project, entities), project);
  assert.deepEqual(applyEntities(newDocument('Documentation Demo'), entities), project, 'full docs reconstruct the original from a blank project with matching identity');
  assert.deepEqual(applyEntities(project, [...entities].reverse()), project, 'document discovery order is immaterial');
});
for (const path of ['detail-v3.json', 'detail-v4.json']) test('complete retained ' + path + ' survives the projection', async () => {
  const original = JSON.parse(await readFile(new URL('../fixtures/companion/' + path, import.meta.url), 'utf8'));
  const project = migrateAuthoringDocument(original).document;
  assert.deepEqual(applyEntities(project, projectEntities(project)), project);
});
test('page title updates both related objects without changing identity', () => {
  const { project, overview } = projectFixture(), entities = projectEntities(project);
  entities.find(entity => entity.id === overview).title = 'Renamed overview';
  const next = applyEntities(project, entities);
  assert.equal(next.design.nodes.find(node => node.id === overview).label, 'Renamed overview');
  assert.equal(next.design.visualDesigns.pages.find(page => page.ownerId === overview).name, 'Renamed overview');
  assert.equal(project.design.nodes.find(node => node.id === overview).label, 'Overview');
});
test('missing interaction source fails without mutating the original project', () => {
  const { project } = projectFixture(), before = structuredClone(project), entities = projectEntities(project);
  entities.find(entity => entity.type === 'interaction').fields.source_node_id = 'vn-missing';
  assert.throws(() => applyEntities(project, entities), /DOCS_INTERACTION_SOURCE/); assert.deepEqual(project, before);
});
test('project context cannot silently shadow separately documented collections', () => {
  const { project } = projectFixture(), entities = projectEntities(project);
  entities.find(entity => entity.type === 'project').data.design.nodes.push(project.design.nodes[0]);
  assert.throws(() => applyEntities(project, entities), /DOCS_CONTEXT_DUPLICATE/);
});
test('editable inline events are rejected rather than duplicated', () => {
  const { project } = projectFixture(), entities = projectEntities(project);
  const page = entities.find(entity => entity.type === 'page' && entity.title === 'Overview');
  page.data.visual.root[0].events.push({ id: 'vi-extra', event: 'click', label: 'Not authoritative', actions: [], notes: '', acceptance: '' });
  assert.throws(() => applyEntities(project, entities), /DOCS_INLINE_EVENT/);
});
test('partial import leaves unrelated elements in the same canonical model', () => {
  const { project } = projectFixture(), entities = projectEntities(project), page = selected();
  const index = { schemaVersion: 1, project: page.project, entries: { [keyOf(page)]: { path: 'docs/page.md', baseline: page, generatedHash: null } } };
  const result = reconcile(entities, [changed(page, { title: 'Updated' })], index, 'import');
  assert.equal(result.conflicts.length, 0); assert.equal(result.entities.length, entities.length);
  assert.equal(applyEntities(project, result.entities).design.nodes.length, 2);
});
test('no-op, Markdown-only, project-only and equal parallel edits reconcile correctly', () => {
  const base = selected(), edit = changed(base, { title: 'New title' });
  for (const [markdown, project, expected] of [[base, base, base], [edit, base, edit], [base, edit, edit], [edit, edit, edit]]) {
    const result = mergeEntity(base, markdown, project); assert.deepEqual(result.value, expected); assert.equal(result.conflicts.length, 0);
  }
});
test('independent fields merge while conflicting scalar changes require exact resolution', () => {
  const base = selected(), markdown = changed(base, { title: 'Markdown' }), project = structuredClone(base);
  project.data.visual.notes = 'Edited in the project';
  const independent = mergeEntity(base, markdown, project); assert.equal(independent.conflicts.length, 0);
  assert.equal(independent.value.title, 'Markdown'); assert.equal(independent.value.data.visual.notes, 'Edited in the project');
  project.title = 'Project'; const conflict = mergeEntity(base, markdown, project);
  assert.equal(conflict.conflicts.length, 1); assert.equal(conflict.conflicts[0].field, '/title');
  const resolution = { [keyOf(base) + '#/title']: 'markdown' };
  assert.equal(mergeEntity(base, markdown, project, resolution).value.title, 'Markdown');
});
test('ordered arrays are conflict units; missing fields preserve existing values', () => {
  const base = selected(), markdown = structuredClone(base), project = structuredClone(base);
  markdown.data.visual.root = []; project.data.visual.root.reverse();
  project.data.visual.root.push({ marker: 'different' });
  assert.ok(mergeEntity(base, markdown, project).conflicts.some(item => item.field === '/data/visual/root'));
  assert.deepEqual(mergeEntity(base, { ...base, data: {} }, base).value, base);
});
test('first binding never silently overwrites differences', () => {
  const base = selected(); assert.equal(mergeEntity(undefined, changed(base, { title: 'Different' }), base).conflicts.length, 1);
});
test('unknown or stale resolution keys fail and project deletions are not undone', () => {
  const base = selected(), key = keyOf(base), index = { schemaVersion: 1, project: base.project, entries: { [key]: { path: 'docs/page.md', baseline: base, generatedHash: null } } };
  assert.throws(() => reconcile([base], [base], index, 'import', { 'wrong#/title': 'markdown' }), /DOCS_RESOLUTION_UNUSED/);
  assert.equal(reconcile([], [base], index, 'import').conflicts[0].reason.includes('removed'), true);
});
test('export refuses to overwrite Markdown-ahead values', () => {
  const base = selected(), index = { schemaVersion: 1, project: base.project, entries: { [keyOf(base)]: { path: 'docs/page.md', baseline: base, generatedHash: null } } };
  const result = reconcile([base], [changed(base, { title: 'Unsaved docs change' })], index, 'export');
  assert.equal(result.entities[0].title, base.title); assert.equal(result.conflicts.length, 1);
});
test('concise component payloads normalize but duplicate identity fields fail', () => {
  const base = { type: 'component', id: 'vc-1', project: 'demo', title: 'Card', fields: { library_id: 'card', export_name: 'Card' }, data: { props: [] } };
  assert.deepEqual(normalizePayload(base).data, { visual: { props: [] } });
  assert.throws(() => normalizePayload({ ...base, data: { visual: { id: 'other' } } }), /DOCS_PAYLOAD/);
});

test('seeded permutations and varied authored values preserve the complete graph',()=>{
  let seed=20260929;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let trial=0;trial<40;trial++){
    const {project}=projectFixture();project.notes.push('Round trip '+trial+' – 日本語');project.design.nodes[0].goal='Goal '+Math.floor(random()*100000);
    const entities=projectEntities(project);for(let i=entities.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[entities[i],entities[j]]=[entities[j],entities[i]];}
    assert.deepEqual(applyEntities(project,entities),project);
  }
});
test('retained published component revisions cannot be overwritten',async()=>{
  const project=migrateAuthoringDocument(JSON.parse(await readFile(new URL('../fixtures/companion/detail-v4.json',import.meta.url),'utf8'))).document;
  const entities=projectEntities(project), revision=entities.find(entity=>entity.type==='component-revision');assert.ok(revision);revision.data.notes='Attempted revision rewrite';
  assert.throws(()=>applyEntities(project,entities),/DOCS_REVISION_IMMUTABLE/);
});
