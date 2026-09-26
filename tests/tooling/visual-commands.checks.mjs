import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { visualNodes, visualLocate, visualLiteral, visualNuxt } from '../../scripts/companion/visual/visual-ir.mjs';
import { validateVisualDesigns } from '../../scripts/companion/visual/visual-validate.mjs';
import { visualClone, visualInstantiateLayout, visualSaveLayout } from '../../scripts/companion/visual/visual-layout.mjs';
import * as cmd from '../../scripts/companion/visual/visual-commands.mjs';
const seed = JSON.parse(await readFile('tests/fixtures/companion/visual-v5.json', 'utf8'));
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
