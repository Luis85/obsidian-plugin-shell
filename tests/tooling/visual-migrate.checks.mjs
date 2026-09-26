import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { migrateDetailDesigns } from '../../scripts/companion/visual/visual-migrate.mjs';
import { validateVisualDesigns } from '../../scripts/companion/visual/visual-validate.mjs';
import { visualNodes } from '../../scripts/companion/visual/visual-ir.mjs';
import { validateDetailDesigns } from '../../scripts/companion/detail-contract.mjs';
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
test('maps every legacy action, contract line, slot rule and display source on a synthetic project', () => {
  let seq = 0; const all5 = ['default', 'loading', 'empty', 'error', 'disabled'];
  const node = (kind, label, extra = {}) => ({ id: 'detail-node-' + ++seq, kind, label, text: '', parentId: null, layout: 'stack', position: { x: 0, y: 0 }, size: { width: 100, height: 100 }, component: null, props: {}, binding: null, a11y: '', visibleIn: all5, sourceBrickId: null, ...extra });
  const edge = (source, target, extra = {}) => ({ id: 'detail-edge-' + ++seq, source: source.id, target: target.id, event: 'click', label: 'Edge ' + seq, notes: '', acceptance: 'Accept ' + seq, targetSurfaceId: null, ...extra });
  const region = node('region', 'Card'), heading = node('heading', 'Title', { parentId: region.id, text: 'Card title', contentProp: 'title' }), slot = node('slot', 'body', { parentId: region.id, text: 'Body fallback', slotCapacity: 'one' }), pick = node('button', 'Pick', { parentId: region.id });
  const root = node('region', 'Page'), select = node('input', 'Mode', { parentId: root.id, control: { kind: 'select', options: [{ label: 'A', value: 'a' }] } }), list = node('list', 'Items', { parentId: root.id, binding: { sourceId: 'src', operationId: 'op', field: 'rows' } });
  const card = node('component', 'Card use', { parentId: root.id, component: { id: 'card', label: 'Info card', version: '1.0.0', variantId: 'wide' }, props: { title: 'Hi', bogus: 1 } }), inner = node('text', 'Body', { parentId: card.id, slotName: 'body', text: 'Slotted', visibleIn: ['error'] });
  const other = node('component', 'Other use', { parentId: root.id, component: { id: 'other', label: 'Other', version: '1.0.0', variantId: 'default' } }), go = node('button', 'Go', { parentId: root.id }), toggle = node('button', 'Toggle', { parentId: root.id }), save = node('button', 'Save', { parentId: root.id }), check = node('checkbox', 'Done', { parentId: root.id });
  const detail = { schema: 2, nextId: 1000, documents: [
    { id: 'detail-document-' + ++seq, kind: 'component', ownerId: 'card', ownerLabel: 'Info card', notes: 'Card notes', nodes: [region, heading, slot, pick], edges: [edge(pick, heading, { effect: { type: 'emit', value: 'pick', payload: 'x' } })] },
    { id: 'detail-document-' + ++seq, kind: 'page', ownerId: 'page-a', ownerLabel: 'Page A', notes: '', nodes: [root, select, list, card, inner, other, go, toggle, save, check], edges: [edge(go, select, { targetSurfaceId: 'page-b' }), edge(toggle, check, { effect: { type: 'toggle', value: true } }), edge(save, select, { action: { kind: 'source', sourceId: 'src', operationId: 'op', input: { kind: 'object', fields: { mode: { kind: 'draft', nodeId: select.id } } } } })], scenarios: [{ id: 'scenario-1', name: 'Rows', state: 'default', width: 'wide', values: { [list.id]: ['a'] }, bindings: [] }] },
  ] };
  const design = { nodes: [{ id: 'page-a' }, { id: 'page-b' }], library: [{ id: 'card', name: 'Info card', description: 'Card', props: 'title:string\nsize:Size\ncount:number', events: 'pick:string\nbad line', slots: 'body, Bad Slot', variants: 'default, wide' }, { id: 'other', name: 'Other', props: '', events: '', slots: '', variants: 'default' }] };
  validateDetailDesigns(structuredClone(detail));
  const { visualDesigns: v, report } = migrateDetailDesigns(structuredClone(detail), design);
  validateVisualDesigns(v, { surfaces: new Set(['page-a', 'page-b']), library: new Set(['card', 'other']) });
  assert.deepEqual(report.unparsedMembers, [{ owner: 'card', text: 'size:Size' }, { owner: 'card', text: 'bad line' }, { owner: 'card', text: 'Bad Slot' }]);
  assert.deepEqual([report.droppedSlotRules, report.listBindings, report.createdComponents, report.droppedProps], [1, 1, ['other'], [{ owner: 'page-a', prop: 'bogus' }]]);
  const [c] = v.components, byName = (nodes, name) => visualNodes(nodes).find(n => n.name === name);
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
