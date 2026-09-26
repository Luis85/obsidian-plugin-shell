import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateVisualDesigns } from '../../scripts/companion/visual/visual-validate.mjs';
import { visualWouldCycle, visualUsages, visualDependencies } from '../../scripts/companion/visual/visual-composition.mjs';
import { visualLocate, visualProject } from '../../scripts/companion/visual/visual-ir.mjs';
const seed = JSON.parse(await readFile('tests/fixtures/companion/visual-v5.json', 'utf8'));
const copy = () => structuredClone(seed);
const context = { surfaces: new Set(['node-customers', 'node-settings']), library: new Set(['library-search']), sources: new Map([['customers', new Set(['list'])]]) };
const page = s => s.pages[0], comp = s => s.components[0];
function findByName(list, name) { for (const n of list) { if (n.name === name) return n; const kids = n.kind === 'element' ? n.children : n.kind === 'slot' ? n.fallback : n.kind === 'component' ? Object.values(n.slots).flat() : []; const hit = findByName(kids, name); if (hit) return hit; } return null; }

test('fixture is valid with and without cross-project context', () => {
  const s = copy(); assert.equal(validateVisualDesigns(s), s);
  validateVisualDesigns(copy(), context);
});
const rejects = [
  ['future schema', s => { s.schema = 4; }, /Unsupported visual-design/],
  ['catalog v2', s => { s.catalog.version = 2; }, /pins nuxt-ui v1/],
  ['reused counter', s => { s.nextId = 2; }, /counter could reuse/],
  ['unknown store key', s => { s.executed = true; }, /Unsupported visual-design/],
  ['duplicate element id', s => { findByName(page(s).root, 'Title').id = findByName(page(s).root, 'Content').id; }, /Duplicate|duplicate/],
  ['malformed id', s => { findByName(page(s).root, 'Title').id = 'node-1'; }, /malformed ID/],
  ['unknown kind', s => { findByName(page(s).root, 'Title').kind = 'script'; }, /unsupported element kind/],
  ['unknown tag', s => { findByName(page(s).root, 'Content').tag = 'iframe'; }, /unsupported tag/],
  ['event attribute', s => { findByName(page(s).root, 'Content').attrs.onclick = { kind: 'literal', value: 'x' }; }, /attribute onclick/],
  ['expression value', s => { findByName(page(s).root, 'Title').value = { kind: 'expression', code: 'alert(1)' }; }, /unsupported value kind/],
  ['prop binding in page', s => { findByName(page(s).root, 'Title').value = { kind: 'prop', name: 'query' }; }, /undeclared prop/],
  ['unknown catalog entry', s => { findByName(page(s).root, 'Empty').ref.entryId = 'u-evil'; }, /unknown Nuxt UI catalog entry/],
  ['undeclared catalog prop', s => { findByName(page(s).root, 'Empty').props.onClick = { kind: 'literal', value: 'x' }; }, /prop onClick is not declared/],
  ['mistyped catalog prop', s => { findByName(page(s).root, 'Settings link').props.label = { kind: 'literal', value: 5 }; }, /must be a string/],
  ['missing project component', s => { findByName(page(s).root, 'Customer search').ref.componentId = 'vc-999'; }, /missing component/],
  ['undeclared instance slot', s => { const n = findByName(page(s).root, 'Customer search'); n.slots.footer = n.slots.actions; delete n.slots.actions; }, /slot footer is not declared/],
  ['undeclared component event', s => { findByName(page(s).root, 'Customer search').events[0].event = 'explode'; }, /not declared/],
  ['slot node in page', s => { page(s).root.push({ id: 'vn-900', kind: 'slot', name: 'x', fallback: [] }); s.nextId = 901; }, /slot "x" is not declared/],
  ['template emits undeclared', s => { findByName(comp(s).template, 'Submit').events[0].actions[0].event = 'boom'; }, /undeclared event/],
  ['template undeclared slot', s => { comp(s).slots = []; s.revisions = []; findByName(page(s).root, 'Customer search').slots = {}; }, /slot "actions" is not declared/],
  ['toggle missing node', s => { findByName(page(s).root, 'Reset').events[0].actions[1].nodeId = 'vn-999'; }, /missing element/],
  ['set-value on non-control', s => { findByName(page(s).root, 'Reset').events[0].actions[1] = { kind: 'set-value', nodeId: findByName(page(s).root, 'Title').id, value: 'x' }; }, /form controls/],
  ['unknown state', s => { findByName(page(s).root, 'Reset').events[0].actions[0].state = 'accepted'; }, /unknown state/],
  ['navigation to missing surface', s => { findByName(page(s).root, 'Settings link').events[0].actions[0].surfaceId = 'node-gone'; }, /navigation target/],
  ['unknown source operation', s => { findByName(page(s).root, 'Customer table').props.data.operationId = 'drop'; }, /unknown source operation/],
  ['too many actions', s => { findByName(page(s).root, 'Reset').events[0].actions = Array(9).fill({ kind: 'set-state', state: 'default' }); }, /eight actions/],
  ['empty visibility', s => { findByName(page(s).root, 'Empty').visibleIn = []; }, /preview state/],
  ['raw css layout', s => { findByName(page(s).root, 'Content').layout.ui.tokens.color = 'red; background:url(x)'; }, /token/],
  ['two pages one owner', s => { const p = structuredClone(page(s)); p.id = 'vp-900'; p.root = []; p.scenarios = []; s.pages.push(p); s.nextId = 901; }, /already designed/],
  ['owner not in sitemap', s => { page(s).ownerId = 'node-ghost'; }, /owner surface/],
  ['duplicate export name', s => { const c = structuredClone(comp(s)); c.id = 'vc-900'; c.libraryId = 'library-other'; c.template = []; s.components.push(c); s.nextId = 901; }, /unique PascalCase/],
  ['forbidden prop name', s => { comp(s).props.push({ name: 'style', type: 'string', required: false }); }, /invalid prop/],
  ['mistyped default', s => { comp(s).props[0].default = 1; }, /default of prop query/],
  ['variant sets undeclared prop', s => { comp(s).variants[0].values.size = 'lg'; }, /undeclared or mistyped prop size/],
  ['revision duplicate version', s => { const r = structuredClone(s.revisions[0]); r.id = 'vr-900'; s.revisions.push(r); s.nextId = 901; }, /unique x.y.z version/],
  ['layout undeclared slot', s => { s.layouts[0].slots = []; }, /slot "body" is not declared/],
  ['prototype pollution key', s => { findByName(page(s).root, 'Content').attrs = JSON.parse('{"__proto__":{"kind":"literal","value":1}}'); }, /attribute|invalid|allowed/],
  ['depth over 12', s => { let n = findByName(page(s).root, 'Content'); for (let i = 0; i < 12; i++) { const child = { id: 'vn-' + (900 + i), kind: 'element', tag: 'div', attrs: {}, children: [], events: [] }; n.children.push(child); n = child; } s.nextId = 1000; }, /nesting exceeds 12/],
];
for (const [name, change, pattern] of rejects) test('rejects ' + name, () => { const s = copy(); change(s); assert.throws(() => validateVisualDesigns(s, context), pattern); });

test('cycle detection covers direct, transitive and pinned-revision recursion', () => {
  const s = copy(); const c = comp(s);
  assert.equal(visualWouldCycle(s, c.id, c.id), true);
  const b = { ...structuredClone(c), id: 'vc-900', libraryId: 'library-b', exportName: 'Beta', template: [visualProject('vn-901', c.id, { props: {} })] }; s.components.push(b); s.nextId = 902;
  assert.equal(visualWouldCycle(s, c.id, b.id), true, 'c → b → c');
  c.template[0].children.push(visualProject('vn-903', b.id)); s.nextId = 904;
  assert.throws(() => validateVisualDesigns(s), /Component cycle: SearchField → Beta → SearchField/);
});
test('dependencies and usages are indexed by stable IDs', () => {
  const s = copy();
  assert.deepEqual(visualDependencies(page(s).root), [comp(s).id]);
  assert.deepEqual(visualUsages(s, comp(s).id).map(u => [u.kind, u.definitionId]), [['page', page(s).id]]);
});
test('a bad mapping inside a page interaction names the page and the element', () => {
  const s = copy();
  findByName(page(s).root, 'Customer search').events[0].actions[0].input = { kind: 'bogus' };
  assert.throws(() => validateVisualDesigns(s, context), err => {
    assert.match(err.message, /^VISUAL_INVALID: /);
    assert.match(err.message, /Customers/);
    assert.match(err.message, /Customer search/);
    return true;
  });
});
