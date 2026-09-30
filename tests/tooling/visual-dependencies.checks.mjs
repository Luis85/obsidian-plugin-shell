import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { visualExternal, visualLiteral, visualNodes, visualIsPackage, visualIsExactVersion } from '../../scripts/companion/visual/visual-ir.mjs';
import { validateVisualDesigns } from '../../scripts/companion/visual/visual-validate.mjs';
import { visualSetDependencies, visualPublish, visualDuplicateNode } from '../../scripts/companion/visual/visual-commands.mjs';
import { visualSession, visualTransition, visualVisible } from '../../scripts/companion/visual/visual-session.mjs';
const seed = JSON.parse(await readFile('tests/fixtures/companion/visual-store.json', 'utf8'));
function withEditor() {
  const s = structuredClone(seed), c = s.components[0];
  c.dependencies = [{ package: '@tiptap/vue-3', version: '2.11.5', purpose: 'Rich text editing' }];
  const node = visualExternal(`vn-${s.nextId++}`, '@tiptap/vue-3', 'editor', { name: 'Editor', props: { content: { kind: 'prop', name: 'query' }, toolbar: visualLiteral(['bold', 'italic']) } });
  node.events = [{ id: `vi-${s.nextId++}`, event: 'update', label: 'Content changed', notes: '', acceptance: '', actions: [{ kind: 'emit', event: 'search', payload: { kind: 'event' } }] }];
  c.template[0].children.push(node);
  return { s, c, node };
}
test('predicates accept exact npm names and versions only', () => {
  for (const ok of ['@tiptap/vue-3', 'codemirror', 'monaco-editor', '@codemirror/lang-markdown']) assert.equal(visualIsPackage(ok), true, ok);
  for (const bad of ['Tiptap', 'github:x/y', 'https://x.y/z.tgz', '../local', '.hidden', 'a'.repeat(215), '@scope/', 'file:../x']) assert.equal(visualIsPackage(bad), false, bad);
  for (const ok of ['2.11.5', '1.0.0-beta.1']) assert.equal(visualIsExactVersion(ok), true, ok);
  for (const bad of ['^2.11.5', '~1.0.0', 'latest', '2.x', '>=1', '1.0', '']) assert.equal(visualIsExactVersion(bad), false, bad);
});
test('a wrapper component with a declared dependency and external node is valid', () => { const { s } = withEditor(); validateVisualDesigns(s); });
const rejects = [
  ['range version', ({ c }) => { c.dependencies[0].version = '^2.11.5'; }, /exact version/],
  ['git specifier', ({ c }) => { c.dependencies[0].package = 'github:ueberdosis/tiptap'; }, /npm package/],
  ['duplicate package', ({ c }) => { c.dependencies.push({ ...c.dependencies[0] }); }, /duplicate dependency/],
  ['too many dependencies', ({ c }) => { c.dependencies = Array.from({ length: 9 }, (_, i) => ({ package: 'pkg-' + i, version: '1.0.0', purpose: '' })); }, /at most 8 dependencies/],
  ['undeclared package', ({ node }) => { node.package = 'codemirror'; }, /codemirror is not a declared dependency/],
  ['bad adapter name', ({ node }) => { node.adapter = 'Editor Adapter'; }, /adapter name/],
  ['duplicate adapter', ({ c, node, s }) => { c.template[0].children.push({ ...structuredClone(node), id: `vn-${s.nextId++}`, events: [] }); }, /adapter "editor" is used twice/],
  ['external in page', ({ s, node }) => { s.pages[0].root.push({ ...structuredClone(node), id: `vn-${s.nextId++}`, events: [] }); }, /external libraries belong in component templates/],
  ['version conflict across components', ({ s, c }) => { const b = structuredClone(c); b.id = `vc-${s.nextId++}`; b.libraryId = 'library-b'; b.exportName = 'Other'; b.template = []; b.dependencies = [{ package: '@tiptap/vue-3', version: '2.10.0', purpose: '' }]; s.components.push(b); }, /@tiptap\/vue-3 is pinned to 2.11.5 in SearchField and 2.10.0 in Other/],
];
for (const [name, change, pattern] of rejects) test('rejects ' + name, () => { const ctx = withEditor(); change(ctx); assert.throws(() => validateVisualDesigns(ctx.s), pattern); });
test('removing a dependency still used by an adapter is refused; unused removal works', () => {
  const { s, c } = withEditor();
  assert.throws(() => visualSetDependencies(s, c.id, []), /Still used by adapter "editor"/);
  c.template[0].children.pop(); visualSetDependencies(s, c.id, []); assert.deepEqual(c.dependencies, []); validateVisualDesigns(s);
});
test('publish snapshots dependencies; duplicating an external node yields a duplicate adapter that validation rejects', () => {
  const { s, c, node } = withEditor();
  const r = visualPublish(s, c.id, '1.1.0'); assert.deepEqual(r.dependencies, c.dependencies);
  validateVisualDesigns(s);
  const copy = visualDuplicateNode(s, { kind: 'component', id: c.id }, node.id);
  assert.notEqual(copy.id, node.id);
  assert.throws(() => validateVisualDesigns(s), /adapter "editor" is used twice/);
});
test('external nodes participate in visibility and transitions', () => {
  const { c, node } = withEditor();
  assert.equal(visualVisible(c, visualSession(), node.id), true);
  const next = visualTransition(c, visualSession(), node.id, node.events[0].id);
  assert.deepEqual(next.emitted.map(e => e.name), ['search']);
  assert.equal(visualNodes(c.template).filter(n => n.kind === 'external').length, 1);
});
