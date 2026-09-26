import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { migrateDetailDesigns } from '../../scripts/companion/visual/visual-migrate.mjs';
import { validateVisualDesigns } from '../../scripts/companion/visual/visual-validate.mjs';
import { visualNodes } from '../../scripts/companion/visual/visual-ir.mjs';
import { validateDetailDesigns } from '../../scripts/companion/detail-contract.mjs';
import { compositionDefaultUI } from '../../scripts/companion/composition-contract.mjs';
import { validateCompanionDocument, migrateCompanionDocument, parseCompanionDocument, COMPANION_VERSION } from '../../scripts/companion/project-contract.mjs';
const load = async p => JSON.parse(await readFile(p, 'utf8'));
const inputs = [['detail-v3 fixture', await load('tests/fixtures/companion/detail-v3.json')], ['self-project v4', await load('tests/fixtures/companion/detail-v4.json')]];
for (const file of (await readdir('docs/concepts/companion/starters')).filter(f => f.endsWith('.json') && f !== 'catalog.json')) inputs.push(['starter ' + file, await load('docs/concepts/companion/starters/' + file)]);
const surfaces = d => new Set(d.nodes.map(n => n.id));
for (const [name, doc] of inputs) test('migrates ' + name + ' into a valid visual store', () => {
  const detail = doc.design.detailDesigns; if (!detail) return;
  const { visualDesigns, report } = migrateDetailDesigns(structuredClone(detail), doc.design);
  validateVisualDesigns(visualDesigns, { surfaces: surfaces(doc.design), library: new Set(doc.design.library.map(l => l.id)) });
  assert.equal(visualDesigns.pages.length, detail.documents.filter(d => d.kind === 'page').length);
  assert.equal(report.droppedPositions, detail.documents.reduce((n, d) => n + d.nodes.length, 0) + (detail.revisions ?? []).reduce((n, r) => n + r.document.nodes.length, 0));
  const legacy = detail.documents.reduce((n, d) => n + d.nodes.length, 0), migrated = [...visualDesigns.pages.map(p => p.root), ...visualDesigns.components.map(c => c.template)].flatMap(visualNodes).length;
  assert.ok(migrated >= legacy, 'no element lost (list items may add nodes)');
  const edges = detail.documents.reduce((n, d) => n + d.edges.length, 0), interactions = [...visualDesigns.pages.map(p => p.root), ...visualDesigns.components.map(c => c.template)].flatMap(visualNodes).reduce((n, x) => n + (x.events?.length ?? 0), 0);
  assert.equal(interactions, edges, 'every interaction carried');
  assert.deepEqual(migrateDetailDesigns(structuredClone(detail), doc.design), { visualDesigns, report }, 'deterministic');
});
test('self-project keeps revisions, pinned instances, scenarios and acceptance text', async () => {
  const doc = inputs[1][1], { visualDesigns: v } = migrateDetailDesigns(structuredClone(doc.design.detailDesigns), doc.design);
  assert.equal(v.revisions.length, doc.design.detailDesigns.revisions.length);
  assert.ok(v.components.length >= 54);
  const all = [...v.pages.map(p => p.root), ...v.components.map(c => c.template)].flatMap(visualNodes);
  assert.ok(all.some(n => n.kind === 'component' && n.ref.revisionId));
  const acceptance = doc.design.detailDesigns.documents.flatMap(d => d.edges.map(e => e.acceptance)).filter(Boolean);
  const kept = all.flatMap(n => n.events ?? []).map(i => i.acceptance);
  for (const text of acceptance) assert.ok(kept.includes(text));
  assert.equal(v.pages.flatMap(p => p.scenarios).length + v.components.flatMap(c => c.scenarios).length, doc.design.detailDesigns.documents.flatMap(d => d.scenarios ?? []).length);
});
test('pins the self-project loss report: only geometry is dropped', () => {
  const doc = inputs[1][1], { visualDesigns: v, report } = migrateDetailDesigns(structuredClone(doc.design.detailDesigns), doc.design);
  assert.deepEqual(report, { droppedPositions: 847, droppedSizes: 847, droppedOutlineRefs: 0, droppedSlotRules: 0, listBindings: 0, droppedFallbackBindings: 0, droppedInteractions: 0, truncatedNotes: 0, unparsedMembers: [], droppedProps: [], createdComponents: [] });
  const all = [...v.pages.map(p => p.root), ...v.components.map(c => c.template), ...v.revisions.map(r => r.template)].flatMap(visualNodes);
  const legacyText = [...doc.design.detailDesigns.documents, ...doc.design.detailDesigns.revisions.map(r => r.document)].flatMap(d => d.nodes).filter(n => ['text', 'heading'].includes(n.kind) && n.ui);
  assert.deepEqual([all.filter(n => n.kind === 'text' && n.layout).length, legacyText.length], [233, 233], 'text/heading ui carried as layout');
  assert.equal(all.filter(n => n.notes).length, 26, 'never-rendered tabs/list text kept as notes');
  assert.deepEqual([v.revisions.filter(r => r.notes).length, v.revisions.reduce((n, r) => n + r.scenarios.length, 0), v.revisions.filter(r => r.designSystem).length], [54, 161, 54]);
});
test('real inputs lose no interactions and no note text', () => {
  for (const [name, doc] of inputs) if (doc.design.detailDesigns) { const { report } = migrateDetailDesigns(structuredClone(doc.design.detailDesigns), doc.design); assert.deepEqual([report.droppedInteractions, report.truncatedNotes, report.droppedFallbackBindings], [0, 0, 0], name); }
});
let seq = 0; const all5 = ['default', 'loading', 'empty', 'error', 'disabled'];
const node = (kind, label, extra = {}) => ({ id: 'detail-node-' + ++seq, kind, label, text: '', parentId: null, layout: 'stack', position: { x: 0, y: 0 }, size: { width: 100, height: 100 }, component: null, props: {}, binding: null, a11y: '', visibleIn: all5, sourceBrickId: null, ...extra });
const edge = (source, target, extra = {}) => ({ id: 'detail-edge-' + ++seq, source: source.id, target: target.id, event: 'click', label: 'Edge ' + seq, notes: 'Note ' + seq, acceptance: 'Accept ' + seq, targetSurfaceId: null, ...extra });
const ldoc = (kind, ownerId, nodes, edges = [], extra = {}) => ({ id: 'detail-document-' + ++seq, kind, ownerId, ownerLabel: 'Owner ' + ownerId, notes: '', nodes, edges, ...extra });
const lib = (id, extra = {}) => ({ id, name: id, description: '', props: '', events: '', slots: '', variants: 'default', ...extra });
const pages = { nodes: [{ id: 'page-a' }, { id: 'page-b' }] };
function migrate(detail, design, legacy = true) {
  if (legacy) validateDetailDesigns(structuredClone(detail));
  const out = migrateDetailDesigns(structuredClone(detail), design);
  validateVisualDesigns(out.visualDesigns, { surfaces: new Set(design.nodes.map(n => n.id)), library: new Set(design.library.map(l => l.id)) });
  return out;
}
const byName = (nodes, name) => visualNodes(nodes).find(n => n.name === name);
test('maps every legacy action, contract line, slot rule and display source on a synthetic project', () => {
  const region = node('region', 'Card'), heading = node('heading', 'Title', { parentId: region.id, text: 'Card title', contentProp: 'title' }), slot = node('slot', 'body', { parentId: region.id, text: 'Body fallback', slotCapacity: 'one' }), pick = node('button', 'Pick', { parentId: region.id });
  const root = node('region', 'Page'), select = node('input', 'Mode', { parentId: root.id, control: { kind: 'select', options: [{ label: 'A', value: 'a' }] } }), list = node('list', 'Items', { parentId: root.id, binding: { sourceId: 'src', operationId: 'op', field: 'rows' } });
  const card = node('component', 'Card use', { parentId: root.id, component: { id: 'card', label: 'Info card', version: '1.0.0', variantId: 'wide' }, props: { title: 'Hi', bogus: 1 } }), inner = node('text', 'Body', { parentId: card.id, slotName: 'body', text: 'Slotted', visibleIn: ['error'] });
  const other = node('component', 'Other use', { parentId: root.id, component: { id: 'other', label: 'Other', version: '1.0.0', variantId: 'default' } }), go = node('button', 'Go', { parentId: root.id }), toggle = node('button', 'Toggle', { parentId: root.id }), save = node('button', 'Save', { parentId: root.id }), check = node('checkbox', 'Done', { parentId: root.id });
  const detail = { schema: 2, nextId: 1000, documents: [
    ldoc('component', 'card', [region, heading, slot, pick], [edge(pick, heading, { effect: { type: 'emit', value: 'pick', payload: 'x' } })], { notes: 'Card notes' }),
    ldoc('page', 'page-a', [root, select, list, card, inner, other, go, toggle, save, check], [edge(go, select, { targetSurfaceId: 'page-b' }), edge(toggle, check, { effect: { type: 'toggle', value: true } }), edge(save, select, { action: { kind: 'source', sourceId: 'src', operationId: 'op', input: { kind: 'object', fields: { mode: { kind: 'draft', nodeId: select.id } } } } })], { scenarios: [{ id: 'scenario-1', name: 'Rows', state: 'default', width: 'wide', values: { [list.id]: ['a'] }, bindings: [] }] }),
  ] };
  const design = { ...pages, library: [lib('card', { name: 'Info card', description: 'Card', props: 'title:string\nsize:Size\ncount:number', events: 'pick:string\nbad line', slots: 'body, Bad Slot', variants: 'default, wide' }), lib('other', { name: 'Other' })] };
  const { visualDesigns: v, report } = migrate(detail, design);
  assert.deepEqual(report.unparsedMembers, [{ owner: 'card', text: 'size:Size' }, { owner: 'card', text: 'bad line' }, { owner: 'card', text: 'Bad Slot' }]);
  assert.deepEqual([report.droppedSlotRules, report.listBindings, report.createdComponents, report.droppedProps], [1, 1, ['other'], [{ owner: 'page-a', prop: 'bogus' }]]);
  const [c] = v.components;
  assert.deepEqual(c.props, [{ name: 'title', type: 'string', required: false, default: 'Card title' }, { name: 'size', type: 'string', required: false, description: 'Migrated from: size:Size' }, { name: 'count', type: 'number', required: false }]);
  assert.deepEqual([c.emits, c.slots, c.variants.map(x => x.id), c.notes], [[{ name: 'pick', payloadType: 'string' }], [{ name: 'body', required: false }], ['default', 'wide'], 'Card notes']);
  assert.deepEqual(byName(c.template, 'Title').value, { kind: 'prop', name: 'title' });
  assert.deepEqual(byName(c.template, 'body').fallback.map(n => n.value.value), ['Body fallback']);
  assert.deepEqual(byName(c.template, 'Pick').events[0].actions, [{ kind: 'emit', event: 'pick', payload: { kind: 'value', value: 'x' } }]);
  const page = v.pages[0], at = name => byName(page.root, name), use = at('Card use');
  assert.deepEqual([use.ref, use.variantId, use.props, use.slots.body.map(n => [n.value.value, n.visibleIn])], [{ kind: 'project', componentId: c.id }, 'wide', { title: { kind: 'literal', value: 'Hi' } }, [['Slotted', ['error']]]]);
  assert.deepEqual([at('Mode').ref.entryId, at('Mode').props.items.value, at('Mode').control.kind, at('Done').ref.entryId], ['u-select', ['A'], 'select', 'u-checkbox']);
  assert.deepEqual(at('Items').children[0].children[0].value, { kind: 'source', sourceId: 'src', operationId: 'op', field: 'rows' });
  assert.deepEqual(at('Go').events[0].actions, [{ kind: 'navigate', surfaceId: 'page-b' }]);
  assert.deepEqual(at('Toggle').events[0].actions, [{ kind: 'toggle', nodeId: at('Done').id }]);
  assert.deepEqual(at('Save').events[0].actions, [{ kind: 'source', sourceId: 'src', operationId: 'op', input: { kind: 'object', fields: { mode: { kind: 'draft', nodeId: at('Mode').id } } } }]);
  assert.deepEqual(page.scenarios[0].values, { [at('Items').id]: ['a'] });
});
test('maps state, value and focus effects, emitted actions and unhandled edges exactly', () => {
  const root = node('region', 'Page'), name = node('input', 'Name', { parentId: root.id }), busy = node('button', 'Busy', { parentId: root.id }), fill = node('button', 'Fill', { parentId: root.id }), focus = node('button', 'Focus', { parentId: root.id }), send = node('button', 'Send', { parentId: root.id }), todo = node('button', 'Todo', { parentId: root.id });
  const edges = [edge(busy, root, { effect: { type: 'state', value: 'error' } }), edge(fill, name, { effect: { type: 'value', value: 'abc' } }), edge(focus, name, { effect: { type: 'focus', value: '' } }), edge(send, name, { action: { kind: 'emit', event: 'saved', payload: { kind: 'draft', nodeId: name.id } } }), edge(todo, name)];
  const { visualDesigns: v } = migrate({ schema: 2, nextId: 1000, documents: [ldoc('page', 'page-a', [root, name, busy, fill, focus, send, todo], edges)] }, { ...pages, library: [] });
  const at = label => byName(v.pages[0].root, label), nameId = at('Name').id;
  assert.deepEqual(at('Busy').events[0].actions, [{ kind: 'set-state', state: 'error' }]);
  assert.deepEqual(at('Fill').events[0].actions, [{ kind: 'set-value', nodeId: nameId, value: 'abc' }]);
  assert.deepEqual(at('Focus').events[0].actions, [{ kind: 'focus', nodeId: nameId }]);
  assert.deepEqual(at('Send').events[0].actions, [{ kind: 'emit', event: 'saved', payload: { kind: 'draft', nodeId: nameId } }]);
  const last = edges[4], todoEvent = at('Todo').events[0];
  assert.deepEqual(todoEvent, { id: todoEvent.id, event: 'click', label: last.label, notes: last.notes, acceptance: last.acceptance, actions: [] });
  assert.match(todoEvent.id, /^vi-\d+$/);
});
test('an edge carrying navigation and an effect keeps both actions, navigation first', () => {
  // Current legacy validation forbids this combination; the migration still never drops either half.
  const root = node('region', 'Page'), go = node('button', 'Go', { parentId: root.id });
  const detail = { schema: 2, nextId: 1000, documents: [ldoc('page', 'page-a', [root, go], [edge(go, root, { targetSurfaceId: 'page-b', effect: { type: 'state', value: 'loading' } })])] };
  const { visualDesigns: v } = migrate(detail, { ...pages, library: [] }, false);
  assert.deepEqual(byName(v.pages[0].root, 'Go').events[0].actions, [{ kind: 'navigate', surfaceId: 'page-b' }, { kind: 'set-state', state: 'loading' }]);
});
test('revisions keep notes, scenarios and design system; pinned instances use the published contract', () => {
  const live = [node('region', 'Card')], liveTitle = node('heading', 'Title', { parentId: live[0].id, text: 'Live title', contentProp: 'title', binding: { sourceId: 'src', operationId: 'op', field: 'name' } }); live.push(liveTitle);
  const pub = [node('region', 'Card')], pubTitle = node('heading', 'Title', { parentId: pub[0].id, text: 'Published title', contentProp: 'title' }); pub.push(pubTitle);
  const designSystem = { schema: 1, name: 'Tokens', colors: [] };
  const revision = { id: 'detail-revision-900', ownerId: 'card', version: '1.0.0', designSystem, library: { id: 'card', name: 'Card', version: '1.0.0', props: 'title:string\ncount:number\nsize:Size', events: '', slots: 'body', variantSpecs: [{ id: 'default', name: 'Default', props: {} }] }, document: ldoc('component', 'card', pub, [], { notes: 'Published notes', scenarios: [{ id: 'scenario-2', name: 'Published', state: 'empty', width: 'narrow', values: { [pubTitle.id]: 'x' }, bindings: [] }] }) };
  const root = node('region', 'Page'), use = node('component', 'Card use', { parentId: root.id, component: { id: 'card', label: 'Card', version: '1.0.0', variantId: 'default', revisionId: revision.id }, props: { title: 'Hi', count: 2 } });
  const detail = { schema: 2, nextId: 1000, documents: [ldoc('component', 'card', live, [], { notes: 'Live notes' }), ldoc('page', 'page-a', [root, use])], revisions: [revision] };
  const { visualDesigns: v, report } = migrate(detail, { ...pages, library: [lib('card', { props: 'title:string\nsize:Size', slots: 'body' })] });
  const [c] = v.components, [r] = v.revisions, pinned = byName(v.pages[0].root, 'Card use');
  assert.deepEqual([r.id, r.componentId, r.version, r.notes, r.designSystem, r.contract.props.map(p => [p.name, p.default])], ['vr-1', c.id, '1.0.0', 'Published notes', designSystem, [['title', 'Published title'], ['count', undefined], ['size', undefined]]]);
  const liveIds = new Set(visualNodes(c.template).map(n => n.id)), pubIds = visualNodes(r.template).map(n => n.id);
  assert.ok(pubIds.length === 2 && pubIds.every(id => /^vn-\d+$/.test(id) && !liveIds.has(id)), 'revision template has fresh IDs');
  assert.deepEqual(r.scenarios, [{ id: 'scenario-2', name: 'Published', state: 'empty', width: 'narrow', values: { [byName(r.template, 'Title').id]: 'x' }, bindings: [] }]);
  assert.deepEqual([pinned.ref, pinned.props], [{ kind: 'project', componentId: c.id, revisionId: 'vr-1' }, { title: { kind: 'literal', value: 'Hi' }, count: { kind: 'literal', value: 2 } }]);
  assert.deepEqual([report.unparsedMembers, report.droppedProps, report.droppedFallbackBindings, c.props[0].default], [[{ owner: 'card', text: 'size:Size' }], [], 1, 'Live title']);
});
test('display elements map to exact catalog props, layouts and notes', () => {
  const ui = { ...compositionDefaultUI(), padding: 0 }, root = node('region', 'Page');
  const kids = [node('heading', 'Head', { text: 'Heading', ui }), node('table', 'Rows', { text: 'No rows', options: ['a', 'b'], binding: { sourceId: 'src', operationId: 'op', field: 'rows' } }), node('tabs', 'Tabs', { text: 'Never shown', options: ['X', 'Y'] }), node('alert', 'Alert', { text: 'Body' }), node('image', 'Picture', { a11y: 'Alt text', text: 'Unrendered' }), node('divider', 'Rule', { text: 'Divider note' }), node('number', 'Count', { text: '0' }), node('textarea', 'Story', { text: 'Write here' })].map(n => ({ ...n, parentId: root.id }));
  const { visualDesigns: v } = migrate({ schema: 2, nextId: 1000, documents: [ldoc('page', 'page-a', [root, ...kids])] }, { ...pages, library: [] });
  const at = name => byName(v.pages[0].root, name), lit = value => ({ kind: 'literal', value });
  assert.deepEqual([at('Head').role, at('Head').value, at('Head').layout], ['h2', lit('Heading'), { mode: 'stack', ui }]);
  assert.deepEqual([at('Rows').ref.entryId, at('Rows').props, at('Rows').slots.empty.map(n => n.value)], ['u-table', { columns: lit([{ accessorKey: 'a', header: 'a' }, { accessorKey: 'b', header: 'b' }]), data: { kind: 'source', sourceId: 'src', operationId: 'op', field: 'rows' } }, [lit('No rows')]]);
  assert.deepEqual([at('Tabs').ref.entryId, at('Tabs').props, at('Tabs').notes], ['u-tabs', { items: lit(['X', 'Y']) }, 'Never shown']);
  assert.deepEqual([at('Alert').ref.entryId, at('Alert').props], ['u-alert', { title: lit('Alert'), description: lit('Body') }]);
  assert.deepEqual([at('Picture').tag, at('Picture').attrs, at('Picture').a11y, at('Picture').notes, at('Picture').children], ['img', { alt: lit('Picture') }, 'Alt text', 'Unrendered', []]);
  assert.deepEqual([at('Rule').ref.entryId, at('Rule').props, at('Rule').notes], ['u-separator', {}, 'Divider note']);
  assert.deepEqual([at('Count').ref.entryId, at('Count').props], ['u-input', { type: lit('number'), placeholder: lit('0') }]);
  assert.deepEqual([at('Story').ref.entryId, at('Story').props], ['u-textarea', { placeholder: lit('Write here') }]);
});
test('a library entry missing from design.library fails with a named visual error', () => {
  const root = node('region', 'Page'), use = node('component', 'Ghost use', { parentId: root.id, component: { id: 'ghost', label: 'Ghost', version: '1.0.0', variantId: 'default' } });
  assert.throws(() => migrateDetailDesigns({ schema: 2, nextId: 1000, documents: [ldoc('page', 'page-a', [root, use])] }, { ...pages, library: [] }), /^Error: VISUAL_INVALID: .*"ghost".*missing/);
});
test('v4 documents migrate to v5 and validate; v5 passes through unchanged', () => {
  const v4 = inputs[1][1]; const { document, report } = migrateCompanionDocument(structuredClone(v4));
  assert.equal(COMPANION_VERSION, 5); assert.equal(document.schemaVersion, 5); assert.equal(document.design.schema, 5);
  assert.equal('detailDesigns' in document.design, false); assert.ok(report.droppedPositions > 0);
  assert.equal(validateCompanionDocument(document), document);
  const again = migrateCompanionDocument(structuredClone(document)); assert.equal(again.report, null); assert.deepEqual(again.document, document);
});
test('hostile or inconsistent v5 imports are rejected (Review Focus 5)', () => {
  const { document } = migrateCompanionDocument(structuredClone(inputs[1][1]));
  const bad = [
    d => { d.design.detailDesigns = inputs[1][1].design.detailDesigns; },
    d => { d.design.visualDesigns.catalog.version = 2; },
    d => { d.design.visualDesigns.pages[0].root[0].kind = 'script'; },
    d => { d.schemaVersion = 6; },
    d => { d.design.schema = 4; },
  ];
  for (const change of bad) { const d = structuredClone(document); change(d); assert.throws(() => validateCompanionDocument(d)); }
  assert.throws(() => parseCompanionDocument('{"kind":"obsidian-companion-project","__proto__":{"x":1}}'));
  assert.throws(() => parseCompanionDocument('x'.repeat(5 * 1024 * 1024)), /limit/);
});
