// Page editor shell helpers (ve-outline.js, ve-insert.js, ve-layouts.js, ve-page-views.js) over the real shared contracts,
// assembled into one realm the way build-companion.py inlines them. Page helpers (esc, icon, button, badge, dialog
// markup) are taken from base.html and ui-fields.js; design()/project() and theme state are the only host stubs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const visualModules = ['ir', 'mapping', 'catalog', 'composition', 'validate', 'layout', 'commands', 'session', 'migrate'].map(n => 'visual/visual-' + n + '.mjs');
const contracts = ['composition-contract.mjs', 'detail-contract.mjs', ...visualModules, 'project-contract.mjs'];
const shared = (await Promise.all(contracts.map(name => readFile('scripts/companion/' + name, 'utf8')))).join('\n').split('\n')
  .filter(line => !line.startsWith('import ')).join('\n').replaceAll('export const ', 'const ').replaceAll('export function ', 'function ');
const base = (await readFile('docs/concepts/companion/src/base.html', 'utf8')).split('\n');
const helpers = ['function esc(', 'function icon(', 'function button(', 'function badge(', 'function modalHeader(', 'function dialogBody('].map(prefix => {
  const lines = base.filter(line => line.startsWith(prefix));
  assert.equal(lines.length, 1, prefix + ' is one line of base.html');
  return lines[0];
}).join('\n');
const files = ['ui-fields.js', 've-state.js', 've-catalog-preview.js', 've-canvas.js', 've-outline.js', 've-insert.js', 've-layouts.js', 've-fields.js', 've-review.js', 've-interactions.js', 've-page-inspector.js', 've-page-views.js'];
const concept = (await Promise.all(files.map(name => readFile('docs/concepts/companion/src/' + name, 'utf8')))).join('\n');
const stubs = 'const ICONS = {}; const state = { settings: { theme: "light" }, view: "page-editor" }; function design() { return host.design; } function project() { return { design: host.design }; } function realm(v) { return JSON.parse(JSON.stringify(v)); }';

// Script-scope constants are not realm globals; expose them read-only for assertions.
const readers = 'function ui() { return veUi; } function catalogData() { return { recipes: visualRecipes, catalog: visualCatalog, layouts: visualBuiltinLayouts }; }';
const surfaces = [{ id: 'surface-a', kind: 'page', label: 'Customers <list>', slug: 'customers' }, { id: 'surface-b', kind: 'modal', label: 'Edit customer', slug: 'edit' }, { id: 'group-1', kind: 'group', label: 'Admin', slug: 'admin' }];
function load(store) {
  const host = { design: { nodes: surfaces, library: [{ id: 'lib-card', name: 'Stat card', description: 'KPI card' }, { id: 'lib-new', name: 'Not designed', description: '' }], dataSources: { sources: [] }, designSystem: undefined, visualDesigns: null, history: [], future: [] } };
  const ctx = vm.createContext({ host, structuredClone });
  vm.runInContext(shared + '\n' + helpers + '\n' + stubs + '\n' + concept + '\n' + readers, ctx, { filename: 'concept-visual-page-editor.js' });
  if (store) { const copy = ctx.realm(store); ctx.validateVisualDesigns(copy, ctx.veContext(host.design)); host.design.visualDesigns = copy; }
  return ctx;
}
const lit = value => ({ kind: 'literal', value });
// A page with a section (container) holding a heading, a card (default slot) with a button inside, and a text leaf.
function fixture() {
  const ctx = load();
  const card = ctx.visualNuxt('vn-4', 'u-card', {}, { name: 'Summary card' }); card.slots.default = [ctx.visualNuxt('vn-5', 'u-button', { label: lit('Open') }, { name: 'Open <button>' })];
  const section = ctx.visualElement('vn-1', 'section', { name: 'Main', children: [ctx.visualText('vn-2', 'Customers', 'h1', { name: 'Title' }), ctx.visualNuxt('vn-3', 'u-table', {}, { name: 'Customer table' }), card] });
  const component = { id: 'vc-7', libraryId: 'lib-card', exportName: 'StatCard', description: 'KPI', props: [{ name: 'label', type: 'string', required: true }, { name: 'count', type: 'number', required: true, default: 3 }], slots: [], emits: [], variants: [], template: [ctx.visualText('vn-8', 'Stat', 'p')], scenarios: [] };
  const page = { id: 'vp-6', ownerId: 'surface-a', name: 'Customers', root: [section, ctx.visualText('vn-9', 'Footer note', 'p', { name: 'Footer' })], scenarios: [], notes: '' };
  const layout = { id: 'vl-10', name: 'Saved <grid>', description: 'Mine', scope: 'region', category: 'custom', root: [ctx.visualText('vn-11', 'x', 'p')], slots: [] };
  const store = { ...ctx.emptyVisualDesigns(), nextId: 12, pages: [page], components: [component], layouts: [layout] };
  const loaded = load(store);
  loaded.ui().owner = 'surface-a';
  return { ctx: loaded, page: loaded.veStore().pages[0] };
}
const items = html => [...html.matchAll(/<li role="treeitem"[^>]*>/g)].map(m => m[0]);
const attr = (tag, name) => tag.match(new RegExp(name + '="([^"]*)"'))?.[1];

test('[VISUAL-PAGE-EDITOR] insert target: containers append inside, leaves insert after, nothing selected appends to the root', () => {
  const { ctx, page } = fixture();
  const target = (id, after) => JSON.parse(JSON.stringify(ctx.veInsertTarget(page, id, after)));
  assert.deepEqual(target(null), { parentId: null });
  assert.deepEqual(target('vn-missing'), { parentId: null }, 'a stale selection falls back to the root');
  assert.deepEqual(target('vn-1'), { parentId: 'vn-1' }, 'an element appends inside');
  assert.deepEqual(target('vn-4'), { parentId: 'vn-4', slot: 'default' }, 'a card appends into its default slot');
  assert.deepEqual(target('vn-2'), { parentId: 'vn-1', index: 1 }, 'a text leaf gets the new nodes right after it');
  assert.deepEqual(target('vn-3'), { parentId: 'vn-1', index: 2 }, 'a table has no default slot: insert after');
  assert.deepEqual(target('vn-5'), { parentId: 'vn-4', slot: 'default', index: 1 }, 'a leaf inside a component slot stays in that slot');
  assert.deepEqual(target('vn-9'), { parentId: null, index: 2 }, 'a root leaf inserts after itself at the root');
  assert.deepEqual(target('vn-1', true), { parentId: null, index: 1 }, 'Insert after forces the leaf rule');
});

test('[VISUAL-PAGE-EDITOR] insert values expand to valid IR with fresh IDs; unknown values are refused', () => {
  const { ctx } = fixture();
  const store = ctx.veStore(), ref = { kind: 'page', id: 'vp-6' }, start = store.nextId;
  for (const [value, target] of [['recipe:recipe-crud-list', 'vn-1'], ['nuxt:u-button', 'vn-2'], ['project:vc-7', null]]) {
    const page = ctx.visualDefinition(store, ref), nodes = ctx.veInsertNodes(store, value);
    ctx.visualInsert(store, ref, ctx.veInsertTarget(page, target), nodes);
  }
  ctx.validateVisualDesigns(store, ctx.veContext(ctx.design()));
  const json = JSON.stringify(store.pages[0]);
  assert.ok(!json.includes('recipe-'), 'no persisted node references a recipe');
  const ids = ctx.visualNodes(store.pages[0].root).map(n => n.id);
  assert.equal(new Set(ids).size, ids.length, 'IDs stay unique');
  assert.ok(ctx.visualNodes(store.pages[0].root).filter(n => Number(n.id.slice(3)) >= start).length > 5, 'new nodes use the store counter');
  const button = store.pages[0].root[0].children[1];
  assert.equal(button.ref.entryId, 'u-button'); assert.deepEqual(JSON.parse(JSON.stringify(button.props)), { label: lit('Button') });
  const instance = store.pages[0].root.at(-1);
  assert.deepEqual(JSON.parse(JSON.stringify(instance.props)), { label: lit(''), count: lit(3) }, 'required props get their default or a typed empty literal');
  for (const bad of ['recipe:nope', 'nuxt:u-nope', 'project:vc-99', 'other:x']) assert.throws(() => ctx.veInsertNodes(store, bad), /^Error: VISUAL_INVALID: /, bad);
});

test('[VISUAL-PAGE-EDITOR] outline is one ARIA tree with levels, one selected item, roving focus and bounded move buttons', () => {
  const { ctx, page } = fixture();
  ctx.ui().selected = 'vn-5';
  const html = ctx.veOutlineHtml(page), tags = items(html);
  assert.equal(html.match(/role="tree"/g).length, 1);
  assert.equal(tags.length, ctx.visualNodes(page.root).length, 'every node is a treeitem');
  assert.deepEqual(tags.map(t => [attr(t, 'data-value'), attr(t, 'aria-level')]), [['vn-1', '1'], ['vn-2', '2'], ['vn-3', '2'], ['vn-4', '2'], ['vn-5', '3'], ['vn-9', '1']]);
  assert.ok(tags.every(t => attr(t, 'data-action') === 've-select'));
  assert.deepEqual(tags.filter(t => attr(t, 'aria-selected') === 'true').map(t => attr(t, 'data-value')), ['vn-5']);
  assert.deepEqual(tags.filter(t => attr(t, 'tabindex') === '0').map(t => attr(t, 'data-value')), ['vn-5'], 'only the selected item is in the tab order');
  assert.ok(html.includes('Open &lt;button&gt;') && !html.includes('Open <button>'), 'names are escaped');
  assert.match(html, /data-value="earlier:vn-2"[^>]*disabled/, 'first child cannot move earlier');
  assert.match(html, /data-value="later:vn-4"[^>]*disabled/, 'last child cannot move later');
  assert.doesNotMatch(html, /data-value="later:vn-2"[^>]*disabled/);
  assert.match(html, /<span class="ve-tree-slot">in default<\/span>/, 'component slot content names its slot');
  ctx.ui().selected = null;
  assert.equal(items(ctx.veOutlineHtml(page)).filter(t => attr(t, 'tabindex') === '0').map(t => attr(t, 'data-value'))[0], 'vn-1', 'without selection the first item takes focus');
});

test('[VISUAL-PAGE-EDITOR] outline search keeps matches with their ancestors and never edits the design', () => {
  const { ctx, page } = fixture();
  const before = JSON.stringify(ctx.veStore());
  ctx.ui().query = 'open';
  assert.deepEqual(items(ctx.veOutlineHtml(page)).map(t => attr(t, 'data-value')), ['vn-1', 'vn-4', 'vn-5']);
  ctx.ui().query = 'UTable';
  assert.deepEqual(items(ctx.veOutlineHtml(page)).map(t => attr(t, 'data-value')), ['vn-1', 'vn-3'], 'kind labels are searchable');
  ctx.ui().query = 'zzz';
  assert.match(ctx.veOutlineHtml(page), /role="status">No matching elements/);
  assert.equal(JSON.stringify(ctx.veStore()), before);
});

test('[VISUAL-PAGE-EDITOR] insert pane lists patterns, catalog primitives and designed project components', () => {
  const { ctx } = fixture();
  const values = html => [...html.matchAll(/data-action="ve-insert" data-value="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(values(ctx.veInsertHtml('page')), [...ctx.catalogData().recipes.map(r => 'recipe:' + r.id)]);
  ctx.ui().insertTab = 'components';
  const components = ctx.veInsertHtml('page');
  assert.deepEqual(values(components), [...ctx.catalogData().catalog.map(e => 'nuxt:' + e.id)]);
  assert.equal(components.match(/data-action="ve-customize"/g).length, ctx.catalogData().catalog.length, 'every primitive offers Customize as component');
  ctx.ui().insertTab = 'project';
  const project = ctx.veInsertHtml('page');
  assert.deepEqual(values(project), ['project:vc-7']);
  assert.match(project, /is-unavailable[^]*Not designed[^]*Design it in the component editor first/);
  ctx.ui().insertTab = 'components'; ctx.ui().insertQuery = 'uform';
  assert.deepEqual(values(ctx.veInsertResults('page')), ['nuxt:u-form', 'nuxt:u-form-field']);
});

test('[VISUAL-PAGE-EDITOR] layouts pane applies built-in and saved layouts; selection layout needs a selection', () => {
  const { ctx } = fixture();
  ctx.veSyncPage();
  const html = ctx.veLayoutsHtml();
  const applied = [...html.matchAll(/data-action="ve-apply-layout" data-value="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(applied, [...ctx.catalogData().layouts.map(l => l.id), 'vl-10']);
  assert.ok(html.includes('Saved &lt;grid&gt;'));
  assert.match(html, /data-action="ve-save-layout" data-value="region"[^>]*disabled/);
  ctx.ui().selected = 'vn-4';
  assert.doesNotMatch(ctx.veLayoutsHtml(), /data-value="region"[^>]*disabled/);
  ctx.ui().layoutForm = ctx.veLayoutFormFor('region');
  assert.equal(ctx.ui().layoutForm.scope, 'region'); assert.equal(ctx.ui().layoutForm.name, 'Summary card layout');
  assert.match(ctx.veSaveLayoutDialog(), /data-field="ve-layout-name"[^>]*value="Summary card layout"/);
});

test('[VISUAL-PAGE-EDITOR] pages list and editor: surfaces only, opening an unstarted one offers Start design without writing', () => {
  const { ctx } = fixture();
  const list = ctx.vePagesView();
  assert.deepEqual([...list.matchAll(/data-action="ve-open-page" data-value="([^"]+)"/g)].map(m => m[1]), ['surface-a', 'surface-b'], 'groups are containers, not pages');
  assert.ok(list.includes('1 of 2 designed') && list.includes('Customers &lt;list&gt;'));
  assert.match(list, />Open<\/button>[^]*>Design page<\/button>/);
  const before = JSON.stringify(ctx.design());
  ctx.ui().owner = 'surface-b';
  const empty = ctx.vePageEditorView();
  assert.match(empty, /data-action="ve-start-page" data-value="surface-b"/);
  assert.equal(JSON.stringify(ctx.design()), before, 'opening does not write');
  ctx.ui().owner = 'surface-a'; ctx.ui().selected = 'vn-5';
  const editor = ctx.vePageEditorView();
  for (const marker of ['role="tree"', 'data-action="ve-insert-after"', 'data-action="ve-duplicate"', 'data-action="ve-wrap"', 'data-action="ve-bind"', 'data-action="ve-interaction"', 'data-action="ve-more"', 'data-field="ve-scenario"', 'data-action="ve-viewport" data-value="mobile"', 'data-action="ve-mode" data-value="review"', 'Generator ready'])
    assert.ok(editor.includes(marker), marker);
  assert.match(editor, /data-action="ve-undo" data-value="" aria-label="Undo design change" disabled>[^]*data-action="ve-redo"[^>]*disabled>/, 'history controls sit in the canvas toolbar, disabled without history');
  assert.match(editor, /class="ve-crumbs"[^]*Page[^]*Main[^]*Summary card[^]*<strong>Open &lt;button&gt;<\/strong>/, 'breadcrumb walks page › ancestors › selection');
  assert.equal(ctx.ui().ref.id, 'vp-6');
  ctx.host.design.nodes = surfaces.filter(n => n.id !== 'surface-a');
  const blocked = ctx.veReadiness(ctx.veStore().pages[0]);
  assert.equal(blocked.ready, false, 'readiness runs the full reference validation');
  assert.match(blocked.text, /^Page "Customers": owner surface is missing/);
});
