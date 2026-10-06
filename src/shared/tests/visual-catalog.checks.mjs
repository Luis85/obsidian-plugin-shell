import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { emptyVisualDesigns, visualNodes, visualWalk } from '../companion/visual/visual-ir.mjs';
import { visualCatalog, visualRecipes, visualBuiltinLayouts, visualCatalogEntry, visualExpand, VISUAL_NUXT_UI_VERSION, VISUAL_CONTROL_ENTRIES } from '../companion/visual/visual-catalog.mjs';

test('catalog pins the Nuxt UI version installed by generated projects', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(pkg.dependencies['@nuxt/ui'] ?? pkg.devDependencies['@nuxt/ui'], VISUAL_NUXT_UI_VERSION);
});
test('catalog entries are unique, U-prefixed and self-consistent', () => {
  const ids = visualCatalog.map(e => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const e of visualCatalog) {
    assert.match(e.component, /^U[A-Z][A-Za-z]+$/); assert.equal(e.kind, 'primitive');
    for (const p of e.props) if (p.default !== undefined && ['string', 'number', 'boolean'].includes(p.type)) assert.equal(typeof p.default, p.type, e.id + '.' + p.name);
    for (const p of e.props) if (p.options) assert.ok(p.default === undefined || p.options.includes(p.default));
  }
  for (const id of ['u-button', 'u-input', 'u-table', 'u-card', 'u-modal', 'u-command-palette', 'u-separator']) assert.ok(visualCatalogEntry(id), id);
  for (const id of VISUAL_CONTROL_ENTRIES) assert.ok(visualCatalogEntry(id), id);
  assert.equal(visualCatalogEntry('u-evil'), null);
});
test('every recipe and built-in layout expands deterministically with fresh IDs and no slots', () => {
  for (const item of [...visualRecipes, ...visualBuiltinLayouts]) {
    const a = emptyVisualDesigns(), b = emptyVisualDesigns();
    const first = visualExpand(a, item.id), again = visualExpand(b, item.id);
    assert.deepEqual(first, again, item.id + ' is deterministic');
    const nodes = visualNodes(first); assert.ok(nodes.length > 0);
    assert.equal(new Set(nodes.map(n => n.id)).size, nodes.length);
    assert.ok(nodes.every(n => /^vn-\d+$/.test(n.id) && n.kind !== 'slot'), item.id + ' has no slot nodes');
    assert.equal(a.nextId, nodes.length + 1);
    visualWalk(first, n => { if (n.kind === 'component') assert.ok(visualCatalogEntry(n.ref.entryId), n.ref.entryId); });
  }
  const s = emptyVisualDesigns(); const one = visualExpand(s, 'recipe-crud-list'), two = visualExpand(s, 'recipe-crud-list');
  assert.equal(new Set([...visualNodes(one), ...visualNodes(two)].map(n => n.id)).size, visualNodes(one).length * 2);
  assert.throws(() => visualExpand(s, 'recipe-missing'), /VISUAL_INVALID/);
});
test('the generated runtime control list mirrors the contract control entries exactly (drift guard)', async () => {
  const { VISUAL_RUNTIME_CONTROLS, VISUAL_RUNTIME_INTERACTIVE } = await import('../../../templates/companion/runtime/visual-runtime.ts');
  assert.deepEqual([...VISUAL_RUNTIME_CONTROLS], [...VISUAL_CONTROL_ENTRIES]);
  assert.deepEqual([...VISUAL_RUNTIME_INTERACTIVE], [...VISUAL_CONTROL_ENTRIES, 'u-button']);
});
