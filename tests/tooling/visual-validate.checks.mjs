import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateVisualDesigns } from '../../scripts/companion/visual/visual-validate.mjs';
import { visualWouldCycle, visualUsages, visualDependencies } from '../../scripts/companion/visual/visual-composition.mjs';
import { visualProject, emptyVisualDesigns } from '../../scripts/companion/visual/visual-ir.mjs';
import { visualRemoveDefinition, visualSetContract } from '../../scripts/companion/visual/visual-commands.mjs';
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
  ['oversized node notes', s => { findByName(page(s).root, 'Title').notes = 'x'.repeat(4001); }, /element notes too long/],
  ['oversized revision notes', s => { s.revisions[0].notes = 'x'.repeat(8001); }, /revision notes too long/],
  ['revision scenario for a missing node', s => { s.revisions[0].scenarios = [{ id: 'scenario-1', name: 'Gone', state: 'default', width: 'wide', values: { 'vn-999': 'x' }, bindings: [] }]; }, /Revision "vr-24".*local elements/],
  ['prototype pollution key', s => { findByName(page(s).root, 'Content').attrs = JSON.parse('{"__proto__":{"kind":"literal","value":1}}'); }, /attribute|invalid|allowed/],
  ['depth over 12', s => { let n = findByName(page(s).root, 'Content'); for (let i = 0; i < 12; i++) { const child = { id: 'vn-' + (900 + i), kind: 'element', tag: 'div', attrs: {}, children: [], events: [] }; n.children.push(child); n = child; } s.nextId = 1000; }, /nesting exceeds 12/],
];
for (const [name, change, pattern] of rejects) test('rejects ' + name, () => { const s = copy(); change(s); assert.throws(() => validateVisualDesigns(s, context), pattern); });

test('text layout, node notes and revision notes/scenarios are accepted', () => {
  const s = copy(), title = findByName(page(s).root, 'Title'), content = findByName(page(s).root, 'Content');
  title.layout = structuredClone(content.layout); title.notes = 'Never rendered.'; s.revisions[0].notes = 'Published notes';
  s.revisions[0].scenarios = [{ id: 'scenario-1', name: 'Published', state: 'empty', width: 'narrow', values: { [s.revisions[0].template[0].id]: 'x' }, bindings: [] }];
  validateVisualDesigns(s, context);
});
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

test('node-level errors carry the offending node id; store-level errors do not', () => {
  const s = copy(), title = findByName(page(s).root, 'Title');
  title.value = { kind: 'prop', name: 'query' };
  const error = (() => { try { validateVisualDesigns(s); } catch (e) { return e; } })();
  assert.match(error.message, /^VISUAL_INVALID: [^]*undeclared prop/);
  assert.equal(error.message.match(/VISUAL_INVALID/g).length, 1, 'one prefix');
  assert.ok(Object.hasOwn(error, 'nodeId')); assert.equal(error.nodeId, title.id);
  const content = findByName(page(copy()).root, 'Content'), t = copy(); findByName(page(t).root, 'Content').attrs.onclick = { kind: 'literal', value: 'x' };
  assert.equal((() => { try { validateVisualDesigns(t); } catch (e) { return e.nodeId; } })(), content.id, 'attribute errors name their element');
  const u = copy(); u.nextId = 2;
  assert.equal((() => { try { validateVisualDesigns(u); } catch (e) { return Object.hasOwn(e, 'nodeId'); } })(), false);
});

// Attribute contract: a per-tag allow-list (the inspector's) plus title, role and aria-* everywhere; literal img
// sources are relative paths or data:image/ URLs only.
const lit = value => ({ kind: 'literal', value });
const withImg = (s, attrs) => { findByName(page(s).root, 'Content').children.push({ id: 'vn-900', kind: 'element', tag: 'img', attrs, children: [], events: [] }); s.nextId = 901; };
const attrRejects = [
  ['formaction on a button', s => { findByName(page(s).root, 'Content').tag = 'button'; findByName(page(s).root, 'Content').attrs.formaction = lit('https://evil.example/'); }, /attribute formaction is not allowed on <button>/],
  ['href with a javascript: URL', s => { findByName(page(s).root, 'Content').attrs.href = lit('javascript:alert(1)'); }, /attribute href is not allowed on <main>/],
  ['srcdoc', s => { findByName(page(s).root, 'Content').attrs.srcdoc = lit('<script></script>'); }, /attribute srcdoc is not allowed/],
  ['action', s => { findByName(page(s).root, 'Content').attrs.action = lit('/submit'); }, /attribute action is not allowed/],
  ['alt outside img', s => { findByName(page(s).root, 'Content').attrs.alt = lit('x'); }, /attribute alt is not allowed on <main>/],
  ['img src over https', s => withImg(s, { src: lit('https://tracker.example/pixel.png'), alt: lit('x') }), /img src must be a relative path or a data:image\/ URL/],
  ['img src javascript:', s => withImg(s, { src: lit('javascript:alert(1)') }), /img src must be a relative path or a data:image\/ URL/],
  ['img src javascript: behind whitespace', s => withImg(s, { src: lit(' \tjava\nscript:alert(1)') }), /img src must be a relative path/],
  ['img src protocol-relative', s => withImg(s, { src: lit('//tracker.example/x.png') }), /img src must be a relative path/],
  ['img src data:text/html', s => withImg(s, { src: lit('data:text/html,<script></script>') }), /img src must be a relative path/],
];
for (const [name, change, pattern] of attrRejects) test('rejects attribute ' + name, () => { const s = copy(); change(s); assert.throws(() => validateVisualDesigns(s, context), pattern); });
test('allowed attributes: per-tag list, title, role, aria-* and safe literal img sources', () => {
  const s = copy(), content = findByName(page(s).root, 'Content');
  Object.assign(content.attrs, { title: lit('Customers'), role: lit('region'), 'aria-label': lit('Customer list'), 'aria-describedby': lit('help') });
  withImg(s, { src: lit('images/customer.png'), alt: lit('Customer') });
  content.children.push({ id: 'vn-901', kind: 'element', tag: 'input', attrs: { placeholder: lit('Search'), type: lit('search'), name: lit('q') }, children: [], events: [] },
    { id: 'vn-902', kind: 'element', tag: 'label', attrs: { for: lit('q') }, children: [], events: [] }, { id: 'vn-903', kind: 'element', tag: 'button', attrs: { type: lit('submit') }, children: [], events: [] },
    { id: 'vn-904', kind: 'element', tag: 'img', attrs: { src: lit('data:image/png;base64,iVBORw0KGgo='), alt: lit('') }, children: [], events: [] });
  s.nextId = 905; validateVisualDesigns(s, context);
});

// Export names that would collide with Vue built-ins, generated script declarations or Nuxt UI imports.
for (const name of ['Transition', 'TransitionGroup', 'Component', 'Error', 'KeepAlive', 'Suspense', 'Teleport', 'Slot', 'Template', 'UButton', 'UTable', 'VisualState', 'VisualRequest', 'ComponentProps'])
  test('rejects reserved export name ' + name, () => { const s = copy(); comp(s).exportName = name; assert.throws(() => validateVisualDesigns(s, context), new RegExp('Component "' + name + '": export name ' + name + ' is reserved')); });

// Composition depth is the longest chain of component levels, independent of the order definitions are listed in.
function chain(levels, order) {
  const s = emptyVisualDesigns(), cs = Array.from({ length: levels }, (_, i) => ({ id: 'vc-' + (i + 1), libraryId: 'lib-' + (i + 1), exportName: 'Level' + (i + 1), description: '', props: [], slots: [], emits: [], variants: [], template: i + 1 < levels ? [visualProject('vn-' + (i + 1), 'vc-' + (i + 2))] : [], scenarios: [] }));
  s.components = order(cs); s.nextId = levels + 1; return s;
}
const orders = { natural: cs => cs, reversed: cs => [...cs].reverse(), 'started mid-chain': cs => [...cs.slice(cs.length >> 1), ...cs.slice(0, cs.length >> 1)], 'leaf first': cs => [cs.at(-1), ...cs.slice(0, -1)] };
for (const [label, order] of Object.entries(orders)) test('composition depth: 20 levels rejected, 16 accepted (' + label + ')', () => {
  assert.throws(() => validateVisualDesigns(chain(20, order)), /Component composition is deeper than 16 levels: Level\d+/);
  assert.throws(() => validateVisualDesigns(chain(17, order)), /deeper than 16 levels/);
  validateVisualDesigns(chain(16, order));
});

// Revision templates pin other components: those pins are usages, so deleting the pinned component is refused by name.
test('usages include pins in published revisions; deleting a component pinned only there is refused by name', () => {
  const s = copy(), a = { ...structuredClone(comp(s)), id: 'vc-900', libraryId: 'library-a', exportName: 'Alpha', template: [], scenarios: [] };
  const b = { ...structuredClone(comp(s)), id: 'vc-901', libraryId: 'library-b', exportName: 'Beta', props: [], slots: [], emits: [], variants: [], template: [], scenarios: [] };
  const pinA = { id: 'vr-902', componentId: a.id, version: '1.0.0', contract: { props: a.props, slots: a.slots, emits: a.emits, variants: a.variants }, template: [] };
  const pinB = { id: 'vr-903', componentId: b.id, version: '1.0.0', contract: { props: [], slots: [], emits: [], variants: [] }, template: [{ ...visualProject('vn-904', a.id), ref: { kind: 'project', componentId: a.id, revisionId: pinA.id } }] };
  s.components.push(a, b); s.revisions.push(pinA, pinB); s.nextId = 905; validateVisualDesigns(s);
  assert.deepEqual(visualUsages(s, a.id).map(u => [u.kind, u.definitionId, u.definitionName, u.nodeId]), [['revision', pinB.id, 'Beta v1.0.0', 'vn-904']]);
  assert.throws(() => visualRemoveDefinition(s, { kind: 'component', id: a.id }), /^Error: VISUAL_INVALID: Alpha is used by Beta v1\.0\.0\. Remove those instances first\.$/);
  visualSetContract(s, a.id, { description: 'Pinned instances are unaffected' }); validateVisualDesigns(s);
});
