import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applySitemapCommand, planSurfaceRemoval } from '../companion/sitemap/commands.ts';
import { validateSitemapModel, inspectSitemap } from '../companion/sitemap/validate.ts';
import { canonicalKey, assertJson, utf8Length } from '../companion/sitemap/safety.ts';
import { planSitemapChange, applySitemapChange, travelSitemapHistory } from '../companion/sitemap/transaction.ts';
import { SITEMAP_LIMITS } from '../companion/sitemap/model.ts';

function fixture() {
  return {
    schema: 5,
    nodes: [
      { id: 'root', kind: 'view', parent: null, label: 'Workbench' },
      { id: 'one', kind: 'page', parent: 'root', label: 'One' },
      { id: 'two', kind: 'page', parent: 'root', label: 'Two' },
    ],
    links: [{ id: 'go', from: 'one', to: 'two', kind: 'navigate', label: 'Go' }],
    library: [{ id: 'shared', name: 'Shared component' }],
    prds: [{ id: 'prd', requirements: [{ id: 'req', title: 'Must work' }] }],
    canvas: { positions: {} },
  };
}
const route = (id, surface, path) => ({ type: 'route', route: { id, surface, path } });
const feature = (id = 'feature') => ({ id, name: id, surfaces: ['one'], entryPoints: ['one'],
  components: ['shared'], requirements: ['req'], dependsOn: [] });
const rejects = (fn, code) => assert.throws(fn, error => error.code === code);

function withFeatures(items) { return { ...fixture(), features: { schema: 1, items } }; }

test('parameterized routes are retained literally and moving a surface never renames parameters', () => {
  const d = applySitemapCommand(fixture(), route('route', 'two', '/projects/:projectId/tasks'));
  const next = applySitemapCommand(d, { type: 'move', surface: 'two', parent: 'one', before: null });
  assert.equal(next.sitemap.routes[0].path, '/projects/:projectId/tasks');
});

test('equivalent parameterized patterns collide independently of parameter naming', () => {
  const d = applySitemapCommand(fixture(), route('route', 'one', '/projects/:projectId'));
  rejects(() => applySitemapCommand(d, route('other', 'two', '/projects/:id')), 'SITEMAP_ROUTE');
  assert.equal(applySitemapCommand(d, route('other', 'two', '/projects/new')).sitemap.routes.length, 2);
});

test('duplicate parameter names, mixed parameter segments, encoded paths and external protocols are refused', () => {
  for (const path of ['/projects/:id/:id', '/part-:id', '/:123', '/project/%2e%2e', 'https://example.com', '//example.com', '/a/', '/a.b', '/a?x=1', '/a#x'])
    assert.throws(() => applySitemapCommand(fixture(), route('route', 'one', path)));
});

test('route identity cannot be rebound, and unchanged upserts are actual no-ops', () => {
  const change = route('route', 'one', '/one'), d = applySitemapCommand(fixture(), change);
  assert.equal(applySitemapCommand(d, change), d);
  rejects(() => applySitemapCommand(d, route('route', 'two', '/other')), 'SITEMAP_ROUTE');
});

test('feature groups reference canonical surfaces, shared components and requirements without copying them', () => {
  const d = fixture(), next = applySitemapCommand(d, { type: 'feature', feature: feature() });
  assert.deepEqual(next.features, { schema: 1, items: [feature()] });
  assert.deepEqual(next.library, d.library); assert.deepEqual(next.prds, d.prds);
  assert.equal(applySitemapCommand(next, { type: 'feature', feature: feature() }), next);
});

test('duplicate feature surface ownership is refused while shared components remain valid', () => {
  rejects(() => validateSitemapModel(withFeatures([feature('a'), feature('b')])), 'SITEMAP_FEATURE');
  const b = { ...feature('b'), surfaces: ['two'], entryPoints: ['two'] };
  assert.equal(validateSitemapModel(withFeatures([feature('a'), b])).features.items.length, 2);
});

test('feature entries and references cannot point outside declared ownership or available catalogs', () => {
  for (const change of [{ entryPoints: ['two'] }, { components: ['missing'] }, { requirements: ['missing'] }, { surfaces: ['missing'] }])
    rejects(() => validateSitemapModel(withFeatures([{ ...feature(), ...change }])), 'SITEMAP_FEATURE');
});

test('feature dependency missing targets and cycles are rejected before mutation', () => {
  rejects(() => validateSitemapModel(withFeatures([{ ...feature(), dependsOn: ['missing'] }])), 'SITEMAP_FEATURE');
  const a = { ...feature('a'), dependsOn: ['b'] }, b = { ...feature('b'), surfaces: ['two'], entryPoints: ['two'], dependsOn: ['a'] };
  rejects(() => validateSitemapModel(withFeatures([a, b])), 'SITEMAP_CYCLE');
  b.dependsOn = [];
  assert.equal(validateSitemapModel(withFeatures([a, b])).features.items.length, 2);
});

test('subsystem versions and unsupported fields fail closed rather than silently round-tripping', () => {
  const d = fixture(); d.sitemap = { schema: 2, routes: [], journeys: [] };
  rejects(() => validateSitemapModel(d), 'SITEMAP_VERSION');
  d.sitemap.schema = 1; d.sitemap.runtime = 'execute';
  rejects(() => validateSitemapModel(d), 'SITEMAP_SHAPE');
  delete d.sitemap; d.features = { schema: 9, items: [] };
  rejects(() => validateSitemapModel(d), 'SITEMAP_VERSION');
});

test('deletion detects external references to doomed transitions and routes, not only the removed surface', () => {
  const d = applySitemapCommand(fixture(), route('route', 'two', '/two'));
  d.visualDesigns = { operations: [{ transition: 'go', route: 'route' }] };
  const impact = planSurfaceRemoval(d, 'two');
  assert.deepEqual(impact.externalReferences, ['/visualDesigns/operations/0/transition', '/visualDesigns/operations/0/route']);
  assert.equal(impact.canRemove, false);
});

test('deletion detects retained canvas anchors and unknown sibling/transition payload references', () => {
  const d = fixture(); d.canvas.anchors = { linked: { surface: 'two' } };
  d.nodes[1].binding = { target: 'two' };
  d.links.push({ id: 'stay', from: 'one', to: 'root', label: 'Back', kind: 'navigate', payload: { retry: 'go' } });
  const impact = planSurfaceRemoval(d, 'two');
  assert.equal(impact.canRemove, false);
  assert.deepEqual(impact.externalReferences, ['/nodes/1/binding/target', '/canvas/anchors/linked/surface', '/links/1/payload/retry']);
});

test('a conditional transition is retained as intent but never reported as executable journey acceptance', () => {
  const d = fixture(); d.links[0].kind = 'conditional'; d.links[0].condition = 'User has access';
  d.sitemap = { schema: 1, routes: [], journeys: [{ id: 'j', name: 'Flow', steps: [
    { id: 'start', surface: 'one', via: null }, { id: 'next', surface: 'two', via: 'go' },
  ] }] };
  assert.deepEqual(inspectSitemap(d).map(i => i.code), ['JOURNEY_CONDITION_UNIMPLEMENTED']);
});

test('canonical keys ignore object property order but retain array order and actual edits', () => {
  assert.equal(canonicalKey({ b: 2, a: [1, 2] }), canonicalKey({ a: [1, 2], b: 2 }));
  assert.notEqual(canonicalKey({ a: [1, 2] }), canonicalKey({ a: [2, 1] }));
  assert.equal(utf8Length('Aé🚦'), 7);
});

test('unsafe JSON keys, classes, symbols and accessor properties are rejected before getters execute', () => {
  let invoked = false;
  const getter = {}; Object.defineProperty(getter, 'value', { enumerable: true, get() { invoked = true; return 'never'; } });
  for (const value of [getter, new Date(), { value: undefined }, { value: Infinity }, { value: () => {} }, { [Symbol('key')]: 1 }, JSON.parse('{"prototype":{}}')])
    assert.throws(() => assertJson(value));
  assert.equal(invoked, false);
});

test('cyclic, sparse, decorated arrays and hidden object fields fail bounded validation', () => {
  const cycle = {}; cycle.self = cycle;
  const sparse = [1, , 3], decorated = [1]; decorated.extra = 2;
  const hidden = {}; Object.defineProperty(hidden, 'secret', { value: 1 });
  for (const value of [cycle, sparse, decorated, hidden]) assert.throws(() => assertJson(value));
});

test('surface, nesting and finite coordinate limits remain bounded at the current shared contract', () => {
  const d = fixture();
  for (let i = d.nodes.length; i <= SITEMAP_LIMITS.nodes; i++) d.nodes.push({ id: 'page-' + i, kind: 'page', parent: 'root', label: 'Page' });
  assert.throws(() => validateSitemapModel(d));
  let deep = {}; for (let i = 0; i <= SITEMAP_LIMITS.depth; i++) deep = { next: deep };
  assert.throws(() => assertJson(deep));
  assert.doesNotThrow(() => applySitemapCommand(fixture(), { type: 'arrange', positions: { one: { x: 50000, y: -50000 } } }));
  rejects(() => applySitemapCommand(fixture(), { type: 'arrange', positions: { one: { x: 50001, y: 0 } } }), 'SITEMAP_POSITION');
});

test('history bounds explicitly report evictions without modifying current published data', () => {
  let d = fixture(), history = { past: [], future: [] }, evicted = 0;
  d.visualDesigns = { revisions: [{ id: 'retained', template: ['unchanged'] }] };
  for (let i = 0; i < 30; i++) {
    const change = planSitemapChange(d, { type: 'rename', surface: 'one', label: 'Name ' + i });
    const next = applySitemapChange(d, change, history); d = next.design; history = next.history; evicted += next.evicted;
  }
  assert.equal(history.past.length, 20); assert.equal(evicted, 10);
  assert.deepEqual(d.visualDesigns.revisions, [{ id: 'retained', template: ['unchanged'] }]);
  for (let i = 0; i < 20; i++) { const result = travelSitemapHistory(d, history, 'undo'); d = result.design; history = result.history; }
  assert.equal(d.nodes[1].label, 'Name 9');
  assert.deepEqual(d.visualDesigns.revisions, [{ id: 'retained', template: ['unchanged'] }]);
});

test('summary reports declared structure only and never calls it accepted product behavior', async () => {
  const { inspectSitemapSummary } = await import('../companion/sitemap/summary.ts');
  const d = fixture(), before = structuredClone(d);
  const summary = inspectSitemapSummary(d);
  assert.equal(summary.surfaces, 3); assert.equal(summary.hierarchyEdges, 2);
  assert.deepEqual(summary.declared, { sitemap: false, features: false });
  assert.equal(summary.acceptance, 'structure-only-not-product-acceptance');
  assert.deepEqual(d, before);
});

test('a missing array index cannot be hidden by adding an unrelated property', () => {
  const value = [1, , 3]; value.extra = 4;
  assert.throws(() => assertJson(value));
});

test('array subclass serialization hooks are rejected without execution', () => {
  let called = false;
  class CustomArray extends Array { toJSON() { called = true; return []; } }
  assert.throws(() => assertJson(new CustomArray(1, 2)));
  assert.equal(called, false);
});
