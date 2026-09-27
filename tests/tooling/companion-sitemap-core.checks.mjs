import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applySitemapCommand, planSurfaceRemoval } from '../../scripts/companion/sitemap/commands.ts';
import { validateSitemapModel, inspectSitemap } from '../../scripts/companion/sitemap/validate.ts';
import { sitemapContext, sitemapProjection, sitemapSemanticKey } from '../../scripts/companion/sitemap/projection.ts';
import { planSitemapChange, applySitemapChange, travelSitemapHistory } from '../../scripts/companion/sitemap/transaction.ts';

function fixture() {
  return {
    schema: 5, goal: 'A saved project', nextId: 99,
    nodes: [
      { id: 'view', kind: 'view', label: 'Workbench', parent: null, entry: true },
      { id: 'home', kind: 'page', label: 'Home', parent: 'view', nav: true, slug: 'home', notes: 'Keep' },
      { id: 'list', kind: 'page', label: 'List', parent: 'view', nav: true },
      { id: 'detail', kind: 'page', label: 'Detail', parent: 'list', nav: false },
      { id: 'dialog', kind: 'modal', label: 'Confirm', parent: null },
    ],
    links: [
      { id: 'list-open', from: 'home', to: 'list', kind: 'navigate', label: 'Browse' },
      { id: 'detail-open', from: 'list', to: 'detail', kind: 'navigate', label: 'Open detail' },
      { id: 'dialog-open', from: 'detail', to: 'dialog', kind: 'open', label: 'Confirm' },
    ],
    canvas: { schema: 1, positions: { home: { x: 10, y: 20 } }, collapsed: [] },
    library: [], prds: [],
    visualDesigns: { schema: 3, revisions: [{ id: 'rev-1', template: { text: 'Pinned' } }] },
  };
}
function routed() {
  const d = fixture();
  d.sitemap = { schema: 1, routes: [{ id: 'home-route', surface: 'home', path: '/home' }], journeys: [] };
  return d;
}
function journey() {
  return { id: 'browse', name: 'Browse records', steps: [
    { id: 'start', surface: 'home', via: null },
    { id: 'choose', surface: 'list', via: 'list-open' },
    { id: 'read', surface: 'detail', via: 'detail-open' },
  ] };
}
const command = (type, values = {}) => ({ type, ...values });
const rejects = (fn, code) => assert.throws(fn, error => error.code === code);

test('accepts canonical v5 surface identities without inventing routes or changing the document', () => {
  const d = fixture(), before = JSON.stringify(d);
  assert.equal(validateSitemapModel(d), d);
  assert.equal(JSON.stringify(d), before);
  assert.deepEqual(inspectSitemap(d), []);
  assert.equal(d.sitemap, undefined);
});

test('reparent preserves explicitly authored route, slug, IDs and all unrelated data', () => {
  const d = routed(), original = structuredClone(d);
  const next = applySitemapCommand(d, command('move', { surface: 'home', parent: 'list', before: 'detail' }));
  assert.equal(next.nodes.find(n => n.id === 'home').parent, 'list');
  assert.equal(next.nodes.find(n => n.id === 'home').slug, 'home');
  assert.deepEqual(next.sitemap, d.sitemap);
  assert.deepEqual(next.visualDesigns, d.visualDesigns);
  assert.deepEqual(d, original);
  assert.deepEqual(next.nodes.filter(n => n.parent === 'list').map(n => n.id), ['home', 'detail']);
});

test('arrangement changes positions only, not semantic fingerprints or routes', () => {
  const d = routed();
  const next = applySitemapCommand(d, command('arrange', { positions: { home: { x: 250, y: -100 } } }));
  assert.deepEqual(next.nodes, d.nodes);
  assert.deepEqual(next.links, d.links);
  assert.deepEqual(next.sitemap, d.sitemap);
  assert.equal(sitemapSemanticKey(next), sitemapSemanticKey(d));
  assert.deepEqual(next.canvas.positions.home, { x: 250, y: -100 });
});

test('renaming does not rewrite an existing route or code name', () => {
  const d = routed();
  const next = applySitemapCommand(d, command('rename', { surface: 'home', label: 'Landing' }));
  assert.equal(next.nodes.find(n => n.id === 'home').slug, 'home');
  assert.equal(next.sitemap.routes[0].path, '/home');
  assert.equal(next.nodes.find(n => n.id === 'home').label, 'Landing');
});

test('moves that introduce containment cycles are rejected without mutation', () => {
  const d = routed(), before = structuredClone(d);
  rejects(() => applySitemapCommand(d, command('move', { surface: 'list', parent: 'detail', before: null })), 'SITEMAP_CYCLE');
  assert.deepEqual(d, before);
});

test('pages cannot be detached from a native view or placed under modal/settings/action', () => {
  for (const parent of [null, 'dialog']) {
    rejects(() => applySitemapCommand(fixture(), command('move', { surface: 'home', parent, before: null })), 'SITEMAP_PARENT');
  }
});

test('moving a native view inside another surface is refused', () => {
  rejects(() => applySitemapCommand(fixture(), command('move', { surface: 'view', parent: 'home', before: null })), 'SITEMAP_PARENT');
});

test('before must name a sibling in the destination, never an unrelated node', () => {
  rejects(() => applySitemapCommand(fixture(), command('move', { surface: 'home', parent: 'list', before: 'dialog' })), 'SITEMAP_ORDER');
});

test('no-op rename and arrangement preserve object identity', () => {
  const d = fixture();
  assert.equal(applySitemapCommand(d, command('rename', { surface: 'home', label: 'Home' })), d);
  assert.equal(applySitemapCommand(d, command('arrange', { positions: { home: { x: 10, y: 20 } } })), d);
});

test('an explicit route is stored only on request and is stable across future moves', () => {
  const next = applySitemapCommand(fixture(), command('route', { route: { id: 'detail-route', surface: 'detail', path: '/record' } }));
  assert.equal(next.sitemap.routes[0].path, '/record');
  assert.equal(next.schema, 5, 'the core must not claim the global v6 rollout is complete');
});

test('route collisions, external URLs, malformed segments and modal routes are refused', () => {
  const d = routed();
  for (const path of ['/home', '//host', '/a/../b', '/a?b', '/a#b', '/a%2Fb', 'https://example.org']) {
    rejects(() => applySitemapCommand(d, command('route', { route: { id: 'other-route', surface: 'list', path } })), 'SITEMAP_ROUTE');
  }
  rejects(() => applySitemapCommand(d, command('route', { route: { id: 'modal-route', surface: 'dialog', path: '/modal' } })), 'SITEMAP_ROUTE');
});

test('Journey Lens references the same existing surfaces and transitions', () => {
  const d = applySitemapCommand(routed(), command('journey', { journey: journey() }));
  assert.deepEqual(inspectSitemap(d), []);
  const projection = sitemapProjection(d, { lens: 'journey', journey: 'browse' });
  assert.deepEqual(projection.nodes.map(n => n.id), ['view', 'home', 'list', 'detail', 'dialog']);
  assert.deepEqual(projection.edges.map(e => e.id), ['journey:browse:choose', 'journey:browse:read']);
  assert.equal(projection.edges[0].transition, 'list-open');
});

test('hierarchy projection never turns visual connections into navigation', () => {
  const p = sitemapProjection(fixture(), { lens: 'hierarchy' });
  assert.equal(p.edges.length, 3);
  assert.ok(p.edges.every(e => e.kind === 'hierarchy' && e.transition === null));
});

test('navigation cycles are valid while containment cycles are not', () => {
  const d = fixture();
  d.links.push({ id: 'back', from: 'detail', to: 'home', kind: 'navigate', label: 'Back' });
  assert.equal(validateSitemapModel(d), d);
});

test('journey discontinuities produce readiness findings, not invented edges', () => {
  const j = journey(); j.steps[2].via = null;
  const d = applySitemapCommand(fixture(), command('journey', { journey: j }));
  assert.equal(inspectSitemap(d)[0].code, 'JOURNEY_TRANSITION_REQUIRED');
  assert.equal(sitemapProjection(d, { lens: 'journey', journey: j.id }).edges.length, 1);
});

test('wrong-direction and data-flow links cannot become executable journey transitions', () => {
  for (const via of ['list-open', 'source']) {
    const d = fixture(); d.links.push({ id: 'source', from: 'list', to: 'detail', kind: 'data', label: 'Payload' });
    const j = journey(); j.steps[2].via = via;
    rejects(() => applySitemapCommand(d, command('journey', { journey: j })), 'SITEMAP_JOURNEY');
  }
});

test('unresolved draft references are retained and block executable readiness', () => {
  const j = journey(); j.steps[2] = { id: 'read', surface: 'missing', via: 'missing-link', unresolved: true, lastKnownLabel: 'Removed detail' };
  const d = applySitemapCommand(fixture(), command('journey', { journey: j }));
  assert.equal(inspectSitemap(d)[0].code, 'JOURNEY_UNRESOLVED');
  assert.equal(sitemapProjection(d, { lens: 'journey', journey: j.id }).edges.length, 1);
});

test('context panels derive parent, siblings, children and incoming/outgoing references without copies', () => {
  const ctx = sitemapContext(fixture(), 'list');
  assert.equal(ctx.parent, 'view');
  assert.deepEqual(ctx.siblings, ['home']);
  assert.deepEqual(ctx.children, ['detail']);
  assert.deepEqual(ctx.incoming, ['list-open']);
  assert.deepEqual(ctx.outgoing, ['detail-open']);
  assert.deepEqual(ctx.breadcrumb, ['view', 'list']);
});

test('search does not remove underlying nodes or alter the saved document', () => {
  const d = fixture(), before = JSON.stringify(d);
  const p = sitemapProjection(d, { lens: 'hierarchy', query: 'detail' });
  assert.equal(p.nodes.length, d.nodes.length);
  assert.deepEqual(p.nodes.filter(n => n.matched).map(n => n.id), ['detail']);
  assert.equal(JSON.stringify(d), before);
});

test('removal impact includes hierarchy, links, routes, journey references and external references', () => {
  const d = routed();
  d.sitemap.journeys.push(journey());
  d.prds = [{ id: 'prd', requirements: [{ id: 'req', nodes: ['detail'] }] }];
  const impact = planSurfaceRemoval(d, 'detail');
  assert.deepEqual(impact.links, ['detail-open', 'dialog-open']);
  assert.deepEqual(impact.journeySteps, ['browse/read']);
  assert.deepEqual(impact.externalReferences, ['/prds/0/requirements/0/nodes/0']);
  assert.equal(impact.canRemove, false);
});

test('removal requires exact reviewed impact and refuses parents and external references', () => {
  const d = routed();
  rejects(() => applySitemapCommand(d, command('remove', { surface: 'home', review: 'unreviewed' })), 'SITEMAP_STALE');
  const review = planSurfaceRemoval(d, 'list');
  rejects(() => applySitemapCommand(d, command('remove', { surface: 'list', review: review.review })), 'SITEMAP_REFERENCED');
});

test('approved leaf removal retains unresolved journey history without deleting unrelated data', () => {
  const d = routed(); d.sitemap.journeys.push(journey());
  const impact = planSurfaceRemoval(d, 'detail');
  const next = applySitemapCommand(d, command('remove', { surface: 'detail', review: impact.review }));
  assert.equal(next.nodes.some(n => n.id === 'detail'), false);
  assert.equal(next.links.length, 1);
  assert.equal(next.sitemap.journeys[0].steps[2].unresolved, true);
  assert.equal(next.sitemap.journeys[0].steps[2].lastKnownLabel, 'Detail');
  assert.deepEqual(next.visualDesigns, d.visualDesigns);
});

test('reviewed changes reject stale full-project content including external reference changes', () => {
  const d = routed(), plan = planSitemapChange(d, command('rename', { surface: 'home', label: 'Welcome' }));
  const newer = structuredClone(d); newer.goal = 'Changed elsewhere';
  rejects(() => applySitemapChange(newer, plan), 'SITEMAP_STALE');
  assert.equal(d.nodes[1].label, 'Home');
});

test('applying a reviewed plan recomputes commands and rejects tampered plans', () => {
  const d = routed(), plan = planSitemapChange(d, command('rename', { surface: 'home', label: 'Welcome' }));
  const modified = structuredClone(plan); modified.command.label = 'Injected';
  rejects(() => applySitemapChange(d, modified), 'SITEMAP_STALE');
  const result = applySitemapChange(d, plan);
  assert.equal(result.design.nodes[1].label, 'Welcome');
  assert.equal(result.history.past.length, 1);
});

test('undo and redo preserve routes, unrelated revision data and stable IDs', () => {
  const d = routed(), plan = planSitemapChange(d, command('move', { surface: 'home', parent: 'list', before: null }));
  const applied = applySitemapChange(d, plan);
  const undone = travelSitemapHistory(applied.design, applied.history, 'undo');
  assert.deepEqual(undone.design, d);
  const redone = travelSitemapHistory(undone.design, undone.history, 'redo');
  assert.deepEqual(redone.design, applied.design);
  assert.deepEqual(redone.design.visualDesigns, d.visualDesigns);
});

test('new edits clear redo; stale history cannot overwrite a concurrent edit', () => {
  const d = routed();
  const a = applySitemapChange(d, planSitemapChange(d, command('rename', { surface: 'home', label: 'First' })));
  const undone = travelSitemapHistory(a.design, a.history, 'undo');
  const b = applySitemapChange(undone.design, planSitemapChange(undone.design, command('rename', { surface: 'home', label: 'Second' })), undone.history);
  assert.equal(b.history.future.length, 0);
  const newer = structuredClone(a.design); newer.goal = 'External edit';
  rejects(() => travelSitemapHistory(newer, a.history, 'undo'), 'SITEMAP_STALE');
});

test('unknown command fields, invalid coordinates and prototype keys are rejected', () => {
  rejects(() => applySitemapCommand(fixture(), { type: 'rename', surface: 'home', label: 'Okay', run: 'code' }), 'SITEMAP_SHAPE');
  rejects(() => applySitemapCommand(fixture(), command('arrange', { positions: { home: { x: Infinity, y: 1 } } })), 'SITEMAP_JSON');
  rejects(() => validateSitemapModel(JSON.parse('{"nodes":[],"links":[],"__proto__":{}}')), 'SITEMAP_JSON');
});

test('duplicate identities, broken links and implicit unresolved references fail closed', () => {
  const d = fixture(); d.nodes.push(structuredClone(d.nodes[0]));
  rejects(() => validateSitemapModel(d), 'SITEMAP_DUPLICATE');
  const broken = fixture(); broken.links[0].to = 'missing';
  rejects(() => validateSitemapModel(broken), 'SITEMAP_REFERENCE');
  const j = journey(); j.steps[1].surface = 'missing';
  rejects(() => applySitemapCommand(fixture(), command('journey', { journey: j })), 'SITEMAP_JOURNEY');
});
