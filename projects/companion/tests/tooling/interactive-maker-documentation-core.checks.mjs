const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import {
  insist, docsObject, array, text, jsonData, stable, equal, keyOf, validateEntity, normalizePayload, fieldNames, DOC_TYPES,
} from '../../bin/documentation/domain/contracts.ts';
import { mergeEntity } from '../../bin/documentation/domain/merge.ts';
import { reconcile } from '../../bin/documentation/application/reconcile.ts';

// Drives the inward-only documentation core (bin/documentation/{domain,application}) to the maker core floors.
const page = (overrides = {}) => ({ type: 'page', id: 'node-1', project: 'demo', title: 'Overview', fields: { surface_kind: 'view' }, data: { surface: { goal: 'a' } }, ...overrides });
const index = (entries = {}) => ({ schemaVersion: 1, project: 'demo', entries });
const bound = entity => ({ [keyOf(entity)]: { path: 'docs/page.md', baseline: entity, generatedHash: null } });

test('shape guards accept plain JSON data and reject everything else with stable codes', () => {
  assert.doesNotThrow(() => insist(true, 'X', 'never'));
  assert.throws(() => insist(0, 'DOCS_EXAMPLE', 'falsy'), { code: 'DOCS_EXAMPLE', name: 'DocsError', message: 'DOCS_EXAMPLE: falsy' });
  const bare = Object.create(null); assert.equal(docsObject(bare), bare);
  for (const value of [null, [], 'text', new Date()]) assert.throws(() => docsObject(value), { code: 'DOCS_SHAPE' });
  assert.deepEqual(array([1]), [1]); assert.throws(() => array({}), { code: 'DOCS_SHAPE' });
  assert.equal(text('ok'), 'ok');
  for (const value of ['', 'x'.repeat(241), 'a\u0007b', 'tab\u007f', 3]) assert.throws(() => text(value, 'label'), { code: 'DOCS_FIELD', message: /label needs/ });
  assert.doesNotThrow(() => jsonData({ list: [1, 'a', true, null, { nested: [] }] }));
  assert.throws(() => jsonData({ value: Infinity }), { code: 'DOCS_NUMBER' });
  assert.throws(() => jsonData(JSON.parse('{"__proto__":1}')), { code: 'DOCS_KEY' });
  assert.throws(() => jsonData({ constructor: 1 }), { code: 'DOCS_KEY' });
  let deep = 1; for (let level = 0; level < 42; level++) deep = [deep];
  assert.throws(() => jsonData(deep), { code: 'DOCS_LIMIT' });
  assert.throws(() => jsonData(() => 1), { code: 'DOCS_SHAPE' });
});

test('stable serialization orders keys, keeps undefined visible and drives semantic equality', () => {
  assert.equal(stable({ b: 1, a: [undefined, 'x'] }), '{"a":[undefined,"x"],"b":1}');
  assert.equal(stable(undefined), 'undefined'); assert.equal(stable(null), 'null');
  assert.ok(equal({ a: 1, b: 2 }, { b: 2, a: 1 })); assert.ok(!equal([1, 2], [2, 1]));
  assert.equal(keyOf({ type: 'page', id: 'a b/c' }), 'page:a%20b%2Fc');
  assert.equal(DOC_TYPES.length, Object.keys(fieldNames).length);
});

test('entity validation checks types, identity text, managed fields and interaction positions', () => {
  assert.doesNotThrow(() => validateEntity(page()));
  assert.throws(() => validateEntity(page({ type: 'unknown' })), { code: 'DOCS_TYPE' });
  assert.throws(() => validateEntity(page({ id: '' })), { code: 'DOCS_FIELD' });
  assert.throws(() => validateEntity(page({ fields: { owner_id: 'x' } })), { code: 'DOCS_FIELD', message: /Unknown managed field/ });
  assert.throws(() => validateEntity(page({ fields: { surface_kind: 4 } })), { code: 'DOCS_FIELD' });
  const interaction = { type: 'interaction', id: 'vi-1', project: 'demo', title: 'Open',
    fields: { owner_type: 'page', owner_id: 'node-1', source_node_id: 'vn-1', event: 'click', position: 0 }, data: {} };
  assert.doesNotThrow(() => validateEntity(interaction));
  assert.throws(() => validateEntity({ ...interaction, fields: { ...interaction.fields, position: -1 } }), { code: 'DOCS_FIELD', message: /position/ });
  assert.throws(() => validateEntity({ ...interaction, fields: { ...interaction.fields, event: undefined } }), { code: 'DOCS_SHAPE' });
  const withoutEvent = Object.fromEntries(Object.entries(interaction.fields).filter(([name]) => name !== 'event'));
  assert.throws(() => validateEntity({ ...interaction, fields: withoutEvent }), { code: 'DOCS_FIELD', message: /event/ });
});

test('payload normalization accepts concise forms and keeps identity in frontmatter', () => {
  const component = { type: 'component', id: 'vc-1', project: 'demo', title: 'List', fields: {}, data: { props: [] } };
  assert.deepEqual(normalizePayload(component).data, { visual: { props: [] } });
  assert.deepEqual(normalizePayload({ ...component, data: { library: {}, visual: {} } }).data, { library: {}, visual: {} });
  const project = { type: 'project', id: 'demo', project: 'demo', title: 'Demo', fields: {}, data: { author: 'A', version: '1', identity: { license: 'MIT' } } };
  assert.deepEqual(normalizePayload(project).data, { identity: { license: 'MIT', author: 'A', version: '1' } });
  assert.deepEqual(normalizePayload({ ...project, data: { notes: [] } }).data, { notes: [] });
  assert.equal(normalizePayload({ type: 'route', id: 'r', project: 'demo', title: 'Old', fields: { path: '/home' }, data: {} }).title, '/home');
  assert.deepEqual(normalizePayload({ type: 'layout', id: 'vl', project: 'demo', title: 'L', fields: {}, data: { anything: 1 } }).data, { anything: 1 });
  assert.throws(() => normalizePayload(page({ data: { extra: 1 } })), { code: 'DOCS_PAYLOAD', message: /Unknown structured field on page/ });
  assert.throws(() => normalizePayload(page({ data: { visual: { id: 'x' } } })), { code: 'DOCS_PAYLOAD', message: /Visual identity/ });
  assert.throws(() => normalizePayload(page({ data: { surface: { label: 'x' } } })), { code: 'DOCS_PAYLOAD', message: /Surface identity/ });
  assert.throws(() => normalizePayload({ ...component, data: { library: { name: 'x' } } }), { code: 'DOCS_PAYLOAD', message: /Library identity/ });
  assert.throws(() => normalizePayload({ ...component, data: { visual: { exportName: 'x' } } }), { code: 'DOCS_PAYLOAD', message: /Component identity/ });
});

test('merging keeps one-sided edits, merges records by key and reports or resolves true conflicts', () => {
  const base = page(), markdown = page({ title: 'Markdown', data: { surface: { goal: 'a', note: 'm' } } });
  assert.deepEqual(mergeEntity(base, markdown, undefined).value, markdown);
  const project = page({ fields: { surface_kind: 'modal' }, data: { surface: { goal: 'a', 'a/b~c': 1 } } });
  const merged = mergeEntity(base, markdown, project);
  assert.equal(merged.value.title, 'Markdown'); assert.equal(merged.value.fields.surface_kind, 'modal');
  assert.deepEqual(merged.value.data.surface, { 'a/b~c': 1, goal: 'a', note: 'm' }); assert.deepEqual(merged.conflicts, []);
  assert.equal(mergeEntity(base, base, project).value.fields.surface_kind, 'modal');
  const clash = mergeEntity(base, page({ title: 'Left' }), page({ title: 'Right' }));
  assert.equal(clash.value.title, 'Right'); assert.deepEqual(clash.conflicts.map(item => item.field), ['/title']);
  assert.match(clash.conflicts[0].reason, /Both representations/);
  const unbased = mergeEntity(undefined, page({ title: 'Left' }), page({ title: 'Right' }));
  assert.match(unbased.conflicts[0].reason, /without a synchronization baseline/);
  const pointer = mergeEntity(base, page({ data: { surface: { goal: 'a', 'x/y~': 'm' } } }), page({ data: { surface: { goal: 'a', 'x/y~': 'p' } } }));
  assert.deepEqual(pointer.conflicts.map(item => item.field), ['/data/surface/x~1y~0']);
  const key = keyOf(base) + '#/title';
  for (const [choice, expected] of [['markdown', 'Left'], ['project', 'Right']]) {
    const resolved = mergeEntity(base, page({ title: 'Left' }), page({ title: 'Right' }), { [key]: choice });
    assert.equal(resolved.value.title, expected); assert.deepEqual(resolved.used, [key]); assert.deepEqual(resolved.conflicts, []);
  }
});

test('reconciliation reports every state, keeps import additive and refuses unsafe export', () => {
  const base = page(), changedProject = page({ fields: { surface_kind: 'modal' } }), changedMarkdown = page({ title: 'Markdown' });
  const states = (project, documents, entries = {}, direction = 'import') => reconcile(project, documents, index(entries), direction).states.map(item => item.state);
  assert.deepEqual(states([], [base]), ['new']);
  assert.deepEqual(states([base], [base], bound(base)), ['synchronized']);
  assert.deepEqual(states([changedProject], [base], bound(base)), ['project-changed']);
  assert.deepEqual(states([base], [changedMarkdown], bound(base)), ['markdown-changed']);
  assert.deepEqual(states([changedProject], [changedMarkdown], bound(base)), ['both-changed']);
  assert.deepEqual(states([page({ title: 'P' })], [page({ title: 'M' })], bound(base)), ['conflict']);
  const removed = reconcile([], [base], index(bound(base)), 'import');
  assert.deepEqual(removed.states, [{ entity: keyOf(base), state: 'project-missing' }]); assert.match(removed.conflicts[0].reason, /removed/);
  const imported = reconcile([base], [changedMarkdown], index(bound(base)), 'import');
  assert.equal(imported.entities[0].title, 'Markdown'); assert.deepEqual(imported.selected, [keyOf(base)]);
  const ahead = reconcile([base], [changedMarkdown], index(bound(base)), 'export');
  assert.equal(ahead.entities[0].title, 'Overview'); assert.match(ahead.conflicts[0].reason, /Markdown is ahead/);
  assert.match(reconcile([], [base], index(), 'export').conflicts[0].reason, /Unimported document/);
  assert.deepEqual(reconcile([base], [base], index(bound(base)), 'export').conflicts, []);
  assert.throws(() => reconcile([], [base, base], index(), 'import'), { code: 'DOCS_DUPLICATE' });
  assert.throws(() => reconcile([], [page({ project: 'foreign' })], index(), 'import'), { code: 'DOCS_PROJECT' });
  assert.throws(() => reconcile([base], [base], index(), 'import', { 'page:stale#/title': 'markdown' }), { code: 'DOCS_RESOLUTION_UNUSED' });
  const resolved = reconcile([page({ title: 'P' })], [page({ title: 'M' })], index(bound(base)), 'import', { [keyOf(base) + '#/title']: 'markdown' });
  assert.equal(resolved.entities[0].title, 'M'); assert.deepEqual(resolved.conflicts, []);
});
