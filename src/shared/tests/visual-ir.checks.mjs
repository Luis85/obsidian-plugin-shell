import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyVisualDesigns, visualAllocate, visualElement, visualText, visualSlot, visualNuxt, visualProject, visualWalk, visualLocate, visualNodes, visualRoot, visualDefinition, visualChildLists, visualIsRef, visualIsKey, visualIsScalar, VISUAL_CATALOG, VISUAL_LIMITS } from '../companion/visual/visual-ir.mjs';
import { validateVisualMapping, validateVisualControl, visualMappingRefs } from '../companion/visual/visual-mapping.mjs';

test('empty store is schema 3 with pinned catalog and counter 1', () => {
  const s = emptyVisualDesigns();
  assert.deepEqual(s, { schema: 3, nextId: 1, catalog: { id: 'nuxt-ui', version: 1 }, pages: [], components: [], layouts: [], revisions: [] });
  assert.notEqual(s.catalog, VISUAL_CATALOG);
  assert.equal(VISUAL_LIMITS.nodes, 120);
});
test('allocation is deterministic and monotonic', () => {
  const s = emptyVisualDesigns();
  assert.deepEqual([visualAllocate(s, 'vn'), visualAllocate(s, 'vp'), visualAllocate(s, 'vn')], ['vn-1', 'vp-2', 'vn-3']);
  assert.equal(s.nextId, 4);
  s.nextId = 0; assert.throws(() => visualAllocate(s, 'vn'), /VISUAL_INVALID/);
});
test('walk visits every list in document order with depth and parent', () => {
  const tree = [visualElement('vn-1', 'div', { children: [visualText('vn-2', 'Hi'), visualNuxt('vn-3', 'u-card', {}, { slots: { default: [visualText('vn-4', 'In card')] } })] }), visualSlot('vn-5', 'actions', { fallback: [visualProject('vn-6', 'vc-9')] })];
  const seen = []; visualWalk(tree, (n, at) => seen.push([n.id, at.depth, at.parent?.id ?? null]));
  assert.deepEqual(seen, [['vn-1', 1, null], ['vn-2', 2, 'vn-1'], ['vn-3', 2, 'vn-1'], ['vn-4', 3, 'vn-3'], ['vn-5', 1, null], ['vn-6', 2, 'vn-5']]);
  assert.equal(visualLocate(tree, 'vn-4').parent.id, 'vn-3');
  assert.equal(visualLocate(tree, 'missing'), null);
  assert.deepEqual(visualNodes(tree).map(n => n.id), ['vn-1', 'vn-2', 'vn-3', 'vn-4', 'vn-5', 'vn-6']);
});
test('walk tolerates malformed child lists instead of crashing', () => {
  assert.deepEqual(visualChildLists({ kind: 'element', children: 'x' }), []);
  assert.deepEqual(visualChildLists({ kind: 'component', slots: null }), []);
});
test('definitions resolve by kind; root reads template or root', () => {
  const s = emptyVisualDesigns(); s.pages.push({ id: 'vp-1', root: [] }); s.components.push({ id: 'vc-2', template: [visualText('vn-3', 'x')] });
  assert.equal(visualDefinition(s, { kind: 'page', id: 'vp-1' }).id, 'vp-1');
  assert.equal(visualRoot(visualDefinition(s, { kind: 'component', id: 'vc-2' }))[0].id, 'vn-3');
  assert.equal(visualDefinition(s, { kind: 'layout', id: 'vp-1' }), null);
});
test('predicates reject prototype keys, multiline and non-finite values', () => {
  for (const bad of ['__proto__', 'constructor', '', 'a b', 'x'.repeat(121)]) assert.equal(visualIsRef(bad), false, bad);
  assert.equal(visualIsKey('modelValue'), true); assert.equal(visualIsKey('Model'), false);
  assert.equal(visualIsScalar(Infinity), false); assert.equal(visualIsScalar(null), true); assert.equal(visualIsScalar({}), false);
});
test('mappings validate recursively and expose draft/prop references', () => {
  const m = { kind: 'object', fields: { title: { kind: 'draft', nodeId: 'vn-4' }, owner: { kind: 'prop', name: 'owner' }, fixed: { kind: 'value', value: [1, 2] } } };
  assert.equal(validateVisualMapping(m), m);
  assert.deepEqual(visualMappingRefs(m), { drafts: ['vn-4'], props: ['owner'] });
  for (const bad of [{ kind: 'script' }, { kind: 'object', fields: JSON.parse('{"__proto__":{"kind":"none"}}') }, { kind: 'value', value: { constructor: 1 } }, { kind: 'none', extra: 1 }])
    assert.throws(() => validateVisualMapping(bad), /VISUAL_INVALID/);
});
test('controls validate kind, options and byte limits', () => {
  validateVisualControl({ kind: 'select', options: [{ label: 'A', value: 'a' }] });
  assert.throws(() => validateVisualControl({ kind: 'select' }), /VISUAL_INVALID/);
  assert.throws(() => validateVisualControl({ kind: 'checkbox', maxBytes: 10 }), /VISUAL_INVALID/);
  assert.throws(() => validateVisualControl({ kind: 'eval' }), /VISUAL_INVALID/);
});
