const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { projectFixture } from './fixtures/application-docs/fixture.mjs';
import { projectEntities, applyEntities, coverage } from '../documentation/adapters/model.ts';
import { restoreProject } from '../documentation/adapters/restore.ts';
import { companionStarterIds, selfProject, starterDocument } from '#shared/testing/starter-documents.mjs';
import { retiredProject } from '#shared/testing/retired-projects.mjs';
import { newDocument } from '../domain/document.ts';

// Drives the lossless project projection and restore (src/cli/documentation/adapters/{model,restore}.ts) under the maker floors.
const companion = async () => selfProject();
const of = (entities, type) => entities.filter(entity => entity.type === type);
function rich() {
  const fixture = projectFixture();
  fixture.project.design.features = { schema: 1, items: [{ id: 'feature-1', name: 'Review', surfaces: [fixture.overview], entryPoints: [fixture.overview], components: [], requirements: [], dependsOn: [] }] };
  return fixture;
}
const restoreFails = (project, entities, code) => assert.throws(() => restoreProject(project, entities), { code });

test('every current schema 6 project round-trips through the projection, also from a blank project', async () => {
  for (const project of [rich().project, await companion(), ...companionStarterIds().map(starterDocument)]) {
    const entities = projectEntities(project);
    assert.deepEqual(applyEntities(project, entities), project);
    assert.deepEqual(applyEntities(project, [...entities].reverse()), project);
  }
  const { project } = projectFixture();
  assert.deepEqual(applyEntities(newDocument('Documentation Demo'), projectEntities(project)), project);
  const counts = coverage(projectEntities(rich().project)).types;
  assert.deepEqual([counts.page, counts.route, counts.journey, counts.feature, counts.transition], [2, 2, 1, 1, 1]);
  assert.ok(coverage(projectEntities(await companion())).types.prd > 0);
  assert.equal(coverage([]).types.page, 0); assert.equal(coverage([{ type: 'custom' }]).types.custom, 1);
});

test('labels, empty labels and differing page names are carried explicitly', async () => {
  const { project } = rich();
  project.design.visualDesigns.pages[0].name = 'Visual name differs';
  const entities = projectEntities(project);
  const link = of(entities, 'transition')[0];
  assert.equal(link.data.emptyLabel, undefined); assert.equal(link.title, project.design.links[0].label);
  assert.equal(of(entities, 'page').find(item => item.id === project.design.visualDesigns.pages[0].ownerId).data.visual.name, 'Visual name differs');
  assert.deepEqual(applyEntities(project, entities), project);
  const self = await companion(), prd = self.design.prds[0], label = Object.hasOwn(prd, 'name') ? 'name' : 'title';
  assert.equal(of(projectEntities(self), 'prd').find(item => item.id === prd.id).fields.label_field, label);
  delete prd[label];
  const unlabeled = projectEntities(self);
  assert.equal(of(unlabeled, 'prd').find(item => item.id === prd.id).fields.label_field, 'none');
  assert.deepEqual(applyEntities(self, unlabeled), self);
});

test('restore needs exactly one matching project context without duplicated collections', () => {
  const { project } = projectFixture(), entities = projectEntities(project), context = of(entities, 'project')[0];
  restoreFails(project, entities.filter(entity => entity.type !== 'project'), 'DOCS_PROJECT');
  restoreFails(project, [...entities, context], 'DOCS_PROJECT');
  restoreFails(project, entities.map(entity => entity === context ? { ...context, id: 'other' } : entity), 'DOCS_PROJECT');
  const duplicate = structuredClone(context); duplicate.data.design.sitemap.routes = [{ id: 'r' }];
  restoreFails(project, entities.map(entity => entity === context ? duplicate : entity), 'DOCS_CONTEXT_DUPLICATE');
  const minimal = { ...context, data: {} };
  const rebuilt = restoreProject(project, entities.map(entity => entity === context ? minimal : entity));
  assert.equal(rebuilt.project.name, project.project.name); assert.deepEqual(rebuilt.settings, project.settings);
});

test('restore builds new pages, components and families from defaults when the context is new', () => {
  const blank = newDocument('Documentation Demo');
  const context = of(projectEntities(blank), 'project')[0];
  delete context.data.design.visualDesigns; delete context.data.design.sitemap; delete context.data.design.features; delete context.data.order;
  const page = { type: 'page', id: 'node-9', project: context.id, title: 'Fresh page', fields: { visual_id: 'vp-9' }, data: {} };
  const component = { type: 'component', id: 'vc-4', project: context.id, title: 'Card', fields: { library_id: 'card', export_name: 'Card' }, data: {} };
  const sibling = { ...component, id: 'vc-5', fields: { library_id: 'card', export_name: 'CardTwo' } };
  const route = { type: 'route', id: 'route-1', project: context.id, title: '/fresh', fields: { surface_id: 'node-9', path: '/fresh' }, data: {} };
  const feature = { type: 'feature', id: 'feature-1', project: context.id, title: 'Search', fields: {}, data: { surfaces: [], entryPoints: [], components: [], requirements: [], dependsOn: [] } };
  const next = restoreProject(blank, [context, page, component, route, feature]);
  assert.equal(next.design.nodes[0].label, 'Fresh page'); assert.equal(next.design.nodes[0].kind, 'view');
  assert.deepEqual(next.design.visualDesigns.pages.map(item => [item.id, item.ownerId, item.name]), [['vp-9', 'node-9', 'Fresh page']]);
  assert.deepEqual(next.design.library.map(item => item.id), ['card']); assert.equal(next.design.visualDesigns.components[0].exportName, 'Card');
  assert.equal(next.design.visualDesigns.nextId, 10); assert.equal(next.design.sitemap.routes[0].path, '/fresh');
  assert.equal(next.design.features.items[0].name, 'Search');
  restoreFails(blank, [context, component, { ...sibling, title: 'Different card' }], 'DOCS_LIBRARY_CONFLICT');
});

test('interactions attach to their owner node and refuse unknown owners or sources', () => {
  const { project } = projectFixture(), entities = projectEntities(project), interaction = of(entities, 'interaction')[0];
  const swap = patch => entities.map(entity => entity === interaction ? { ...interaction, ...patch, fields: { ...interaction.fields, ...patch.fields } } : entity);
  restoreFails(project, swap({ fields: { owner_type: 'layout' } }), 'DOCS_INTERACTION_OWNER');
  restoreFails(project, swap({ fields: { owner_id: 'node-missing' } }), 'DOCS_INTERACTION_OWNER');
  restoreFails(project, swap({ fields: { source_node_id: 'vn-missing' } }), 'DOCS_INTERACTION_SOURCE');
  const moved = restoreProject(project, swap({ fields: { position: 0 } }));
  assert.ok(JSON.stringify(moved.design.visualDesigns.pages).includes(interaction.id));
});

test('retired schema 3-5 projects are refused by the projection, never migrated', () => {
  for (const version of [3, 4, 5]) assert.throws(() => projectEntities(retiredProject(version)), /only schema 6 is supported/);
});

test('published revisions are immutable and identity counters never move backwards', async () => {
  const project = await companion(), entities = projectEntities(project);
  const revision = of(entities, 'component-revision')[0]; revision.data.notes = 'Rewritten';
  assert.throws(() => applyEntities(project, entities), { code: 'DOCS_REVISION_IMMUTABLE' });
  const fixture = projectFixture().project; fixture.design.nextId = 1;
  assert.ok(applyEntities(fixture, projectEntities(fixture)).design.nextId > 1);
});
