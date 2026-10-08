import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { visualNodes, visualLocate, visualLiteral, visualNuxt } from '../companion/visual/visual-ir.mjs';
import { validateVisualDesigns } from '../companion/visual/visual-validate.mjs';
import { visualInstantiateLayout, visualSaveLayout } from '../companion/visual/visual-layout.mjs';
import * as cmd from '../companion/visual/visual-commands.mjs';
const seed = JSON.parse(await readFile('src/shared/testing/fixtures/companion/visual-store.json', 'utf8'));
const store = () => structuredClone(seed);
const pageRef = s => ({ kind: 'page', id: s.pages[0].id });
const byName = (nodes, name) => visualNodes(nodes).find(n => n.name === name);
const ids = s => [...s.pages.map(p => p.root), ...s.components.map(c => c.template), ...s.layouts.map(l => l.root)].flatMap(visualNodes).map(n => n.id);

test('applying a built-in layout twice yields fresh unique IDs and a valid page', () => {
  const s = store(), before = s.nextId;
  cmd.visualInsert(s, pageRef(s), { parentId: null }, visualInstantiateLayout(s, 'builtin-list-workspace'));
  cmd.visualInsert(s, pageRef(s), { parentId: null }, visualInstantiateLayout(s, 'builtin-list-workspace'));
  assert.equal(new Set(ids(s)).size, ids(s).length); assert.ok(s.nextId > before); validateVisualDesigns(s);
});
test('saved layout turns slots into regions on instantiation and keeps component references', () => {
  const s = store(); const content = byName(s.pages[0].root, 'Content');
  const layout = visualSaveLayout(s, { name: 'Customer ops', description: '', category: 'application', scope: 'page', nodeIds: [content.id], pageId: s.pages[0].id });
  const nodes = visualInstantiateLayout(s, layout.id);
  assert.ok(visualNodes(nodes).every(n => n.kind !== 'slot'));
  assert.equal(byName(nodes, 'Customer search').ref.componentId, s.components[0].id);
  assert.notEqual(byName(nodes, 'Customer search').id, byName(content.children, 'Customer search').id);
  validateVisualDesigns(s);
  const regionLayout = visualInstantiateLayout(s, s.layouts[0].id);
  assert.ok(visualNodes(regionLayout).some(n => n.kind === 'element' && n.name === 'body'), 'slot "body" became a named div');
});
test('duplicate remaps internal references to the copies (Review Focus 4)', () => {
  const s = store(); const search = byName(s.pages[0].root, 'Customer search');
  const copy = cmd.visualDuplicateNode(s, pageRef(s), search.id);
  const reset = visualNodes([copy]).find(n => n.name === 'Reset');
  assert.notEqual(reset.events[0].id, byName([search], 'Reset').events[0].id);
  assert.equal(reset.events[0].actions[1].nodeId, byName(s.pages[0].root, 'Empty').id, 'external reference kept');
  validateVisualDesigns(s);
});
// A subtree whose interactions, state bindings and draft mappings all point inside it.
function formRegion(s) {
  const at = () => 'vn-' + s.nextId++, input = visualNuxt(at(), 'u-input', {}, { name: 'Query' }), panel = { id: at(), kind: 'element', tag: 'div', attrs: {}, children: [], events: [], name: 'Panel' };
  const echo = { id: at(), kind: 'text', role: 'p', value: { kind: 'state', nodeId: input.id }, name: 'Echo' };
  const hint = { id: at(), kind: 'element', tag: 'input', attrs: { placeholder: { kind: 'state', nodeId: input.id } }, children: [], events: [], name: 'Hint' };
  const actions = [{ kind: 'toggle', nodeId: panel.id }, { kind: 'focus', nodeId: input.id }, { kind: 'set-value', nodeId: input.id, value: 'x' }, { kind: 'emit', event: 'go', payload: { kind: 'draft', nodeId: input.id } },
    { kind: 'source', sourceId: 'customers', operationId: 'list', input: { kind: 'object', fields: { q: { kind: 'draft', nodeId: input.id } } } }];
  const go = visualNuxt(at(), 'u-button', { label: visualLiteral('Go') }, { name: 'Go', events: [{ id: 'vi-' + s.nextId++, event: 'click', label: 'Go', notes: '', acceptance: '', actions }] });
  const region = { id: at(), kind: 'element', tag: 'section', attrs: {}, children: [input, panel, echo, hint, go], events: [], name: 'Form region' };
  s.pages[0].root.push(region); validateVisualDesigns(s); return region;
}
// Every node ID a subtree refers to (state values, action targets, draft mappings) with where it was found.
function internalRefs(nodes) {
  const out = [], drafts = m => m?.kind === 'draft' ? [m.nodeId] : m?.kind === 'object' ? Object.values(m.fields).flatMap(drafts) : [];
  for (const n of visualNodes(nodes)) {
    for (const v of [...Object.values(n.props ?? {}), ...Object.values(n.attrs ?? {}), ...(n.kind === 'text' ? [n.value] : [])]) if (v.kind === 'state') out.push(['state', v.nodeId]);
    for (const a of (n.events ?? []).flatMap(i => i.actions)) { if (a.nodeId) out.push([a.kind, a.nodeId]); for (const id of drafts(a.payload ?? a.input)) out.push([a.kind + ' draft', id]); }
  }
  return out;
}
test('duplicate remaps toggle, focus, set-value, state and draft references to the copies (Review Focus 4)', () => {
  const s = store(), region = formRegion(s), original = new Set(visualNodes([region]).map(n => n.id));
  const copy = cmd.visualDuplicateNode(s, pageRef(s), region.id), copied = new Set(visualNodes([copy]).map(n => n.id));
  const refs = internalRefs([copy]);
  assert.deepEqual(refs.map(([kind]) => kind).sort(), ['emit draft', 'focus', 'set-value', 'source draft', 'state', 'state', 'toggle']);
  for (const [kind, id] of refs) { assert.ok(copied.has(id), kind + ' → ' + id + ' points into the copy'); assert.ok(!original.has(id), kind + ' left on the original'); }
  assert.deepEqual(internalRefs([region]).map(([, id]) => original.has(id)), Array(7).fill(true), 'the original is untouched');
  assert.notEqual(visualNodes([copy]).find(n => n.name === 'Go').events[0].id, visualNodes([region]).find(n => n.name === 'Go').events[0].id);
  validateVisualDesigns(s);
});
test('applying a saved layout twice remaps each instance to its own copies', () => {
  const s = store(), region = formRegion(s);
  const layout = visualSaveLayout(s, { name: 'Form', description: '', category: 'form', scope: 'region', nodeIds: [region.id], pageId: s.pages[0].id });
  const first = visualInstantiateLayout(s, layout.id), second = visualInstantiateLayout(s, layout.id);
  for (const [label, nodes, other] of [['first', first, second], ['second', second, first]]) {
    const own = new Set(visualNodes(nodes).map(n => n.id)), foreign = new Set([...visualNodes(other), ...visualNodes(layout.root), ...visualNodes([region])].map(n => n.id));
    assert.equal(internalRefs(nodes).length, 7, label);
    for (const [kind, id] of internalRefs(nodes)) { assert.ok(own.has(id), label + ' ' + kind + ' → ' + id); assert.ok(!foreign.has(id), label + ' ' + kind + ' shares ' + id); }
  }
  cmd.visualInsert(s, pageRef(s), { parentId: null }, first); cmd.visualInsert(s, pageRef(s), { parentId: null }, second);
  assert.equal(new Set(ids(s)).size, ids(s).length); validateVisualDesigns(s);
});
test('a slot converted to a region keeps its notes and accessibility text', () => {
  const s = store(), slot = visualNodes(s.layouts[0].root).find(n => n.kind === 'slot');
  Object.assign(slot, { notes: 'Filled by the page.', a11y: 'Main body region', visibleIn: ['default'] }); validateVisualDesigns(s);
  const region = visualNodes(visualInstantiateLayout(s, s.layouts[0].id)).find(n => n.kind === 'element' && n.name === 'body');
  assert.deepEqual([region.notes, region.a11y, region.visibleIn], ['Filled by the page.', 'Main body region', ['default']]);
});
test('saving a region whose interactions target outside elements is refused', () => {
  const s = store(); const search = byName(s.pages[0].root, 'Customer search');
  assert.throws(() => visualSaveLayout(s, { name: 'x', description: '', category: 'custom', scope: 'region', nodeIds: [search.id], pageId: s.pages[0].id }), /Reset view.*outside the copied structure/);
});
test('removing a used component is refused with every usage (Review Focus 2)', () => {
  const s = store();
  assert.throws(() => cmd.visualRemoveDefinition(s, { kind: 'component', id: s.components[0].id }), /used by.*Customers/);
});
test('contract edits that break instances are refused before commit (Review Focus 3)', () => {
  const s = store(); const c = s.components[0];
  assert.throws(() => cmd.visualSetContract(s, c.id, { slots: [] }), /Customer search.*actions/);
  assert.throws(() => cmd.visualSetContract(s, c.id, { props: [] }), /Customer search.*query/);
  assert.throws(() => cmd.visualSetContract(s, c.id, { emits: [] }), /Customer search.*search|SearchField.*search/);
  cmd.visualSetContract(s, c.id, { description: 'Changed' }); assert.equal(c.description, 'Changed'); validateVisualDesigns(s);
});
test('removing a referenced element is refused; scenario values are pruned', () => {
  const s = store(); const empty = byName(s.pages[0].root, 'Empty');
  assert.throws(() => cmd.visualRemoveNode(s, pageRef(s), empty.id), /Reset view/);
  const title = byName(s.pages[0].root, 'Title'); s.pages[0].scenarios[0].values[title.id] = 'x';
  cmd.visualRemoveNode(s, pageRef(s), title.id);
  assert.equal(visualLocate(s.pages[0].root, title.id), null); assert.equal(title.id in s.pages[0].scenarios[0].values, false); validateVisualDesigns(s);
});
test('move, reparent, wrap and insert keep a valid tree and refuse cycles', () => {
  const s = store(); const content = byName(s.pages[0].root, 'Content'), title = byName(content.children, 'Title');
  cmd.visualMoveNode(s, pageRef(s), title.id, 'later'); assert.equal(content.children[1].id, title.id);
  assert.throws(() => cmd.visualMoveNode(s, pageRef(s), content.children.at(-1).id, 'later'), /already last/);
  const wrapper = cmd.visualWrapNode(s, pageRef(s), title.id);
  assert.throws(() => cmd.visualReparent(s, pageRef(s), wrapper.id, { parentId: title.id }), /inside itself|cannot contain/);
  cmd.visualReparent(s, pageRef(s), title.id, { parentId: null, index: 0 }); assert.equal(s.pages[0].root[0].id, title.id);
  const [added] = cmd.visualInsert(s, pageRef(s), { parentId: byName(s.pages[0].root, 'Customer search').id, slot: 'actions' }, [visualNuxt(`vn-${s.nextId++}`, 'u-badge', { label: visualLiteral('New') })]);
  assert.ok(added); validateVisualDesigns(s);
  assert.throws(() => cmd.visualInsert(s, pageRef(s), { parentId: byName(s.pages[0].root, 'Customer search').id, slot: 'nope' }, []), /slot nope/);
});
test('publish pins dependencies, snapshots the contract and rejects non-increasing versions', () => {
  const s = store(); const c = s.components[0];
  const r = cmd.visualPublish(s, c.id, '1.1.0'); assert.deepEqual(r.contract.props, c.props); validateVisualDesigns(s);
  assert.throws(() => cmd.visualPublish(s, c.id, '1.0.5'), /greater than 1.1.0/);
});
test('create component from a catalog primitive seeds a typed contract and a bound template', () => {
  const s = store(); const c = cmd.visualCreateComponent(s, { libraryId: 'library-new', exportName: 'AppButton', description: '', implementation: { catalog: 'nuxt-ui', entryId: 'u-button' } });
  assert.deepEqual(c.props.map(p => [p.name, p.type]), [['label', 'string'], ['color', 'string'], ['variant', 'string'], ['icon', 'string'], ['loading', 'boolean'], ['disabled', 'boolean']]);
  assert.deepEqual(c.slots.map(x => x.name), ['leading', 'default', 'trailing']);
  assert.equal(c.template[0].props.label.kind, 'prop'); validateVisualDesigns(s);
});
