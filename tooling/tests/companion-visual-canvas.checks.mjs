// The concept canvas renderer (ve-catalog-preview.js + ve-canvas.js) over the real shared contracts, assembled into one
// script realm the way build-companion.py inlines them. esc() is the page's own helper; design() and theme state are the
// only host stubs. Fixtures are copied into the concept realm and pass validateVisualDesigns before they are rendered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { conceptShared, visualModules } from './support/concept-realm.mjs';

const shared = await conceptShared(['native-contract.mjs', 'composition-contract.mjs', ...visualModules]);
const base = await readFile('docs/concepts/companion/src/base.html', 'utf8');
const escStart = base.indexOf('function esc(v){'), escSource = base.slice(escStart, base.indexOf('[c]));}', escStart) + 7);
assert.match(escSource, /^function esc\(v\)\{.*\}$/, 'the page escape helper is extracted whole');
const concept = (await Promise.all(['ve-state.js', 've-catalog-preview.js', 've-canvas.js'].map(name => readFile('docs/concepts/companion/src/' + name, 'utf8')))).join('\n');
const stubs = 'const state = { settings: { theme: "light" } }; function design() { return host.design; } function realm(v) { return JSON.parse(JSON.stringify(v)); }';

function load() {
  const host = { design: { designSystem: undefined, visualDesigns: null } }, ctx = vm.createContext({ host, structuredClone });
  vm.runInContext(shared + '\n' + escSource + '\n' + stubs + '\n' + concept, ctx, { filename: 'concept-visual-canvas.js' });
  return ctx;
}
// The store is copied into the realm (the contracts check plain objects by prototype), validated, then made current.
function install(ctx, store) {
  const copy = ctx.realm(store);
  ctx.validateVisualDesigns(copy); ctx.host.design.visualDesigns = copy;
  return copy;
}
const lit = value => ({ kind: 'literal', value });
const source = field => ({ kind: 'source', sourceId: 'customers', operationId: 'list', field });
// One page: a grid region with hostile text, a button, a table bound to a source, an empty-only alert and a hidden group.
function pageFixture() {
  const ctx = load();
  const table = ctx.visualNuxt('vn-4', 'u-table', { data: source(''), columns: lit([{ accessorKey: 'name', header: 'Name' }, { accessorKey: 'owner.name', header: 'Owner' }]) }, { name: 'Customer table' });
  const alert = ctx.visualNuxt('vn-5', 'u-alert', { title: lit('No customers yet') }, { name: 'Empty message', visibleIn: ['empty'] });
  const note = ctx.visualText('vn-7', 'Only when empty', 'p', { name: 'Empty note' });
  const emptyGroup = ctx.visualElement('vn-6', 'div', { name: 'Empty group', visibleIn: ['empty'], children: [note] });
  const region = ctx.visualElement('vn-1', 'section', { name: 'Main <region>', layout: ctx.visualLayoutRules('grid'), children: [
    ctx.visualText('vn-2', '<script>alert("x")</script> & \'quotes\'', 'h1', { name: 'Title' }),
    ctx.visualNuxt('vn-3', 'u-button', { label: lit('Save "now"'), color: lit('success') }, { name: 'Save' }),
    table, alert, emptyGroup,
  ] });
  const page = { id: 'vp-8', ownerId: 'surface-1', name: 'Customers', root: [region], notes: '', scenarios: [
    { id: 'with-rows', name: 'With rows', state: 'default', width: 'wide', values: {}, bindings: [{ sourceId: 'customers', operationId: 'list', value: [{ name: 'Row <one>', owner: { name: 'Ada' } }, { name: 'Row two', owner: { name: 'Grace' } }] }] },
    { id: 'empty', name: 'Empty', state: 'empty', width: 'wide', values: {}, bindings: [] },
  ] };
  const store = install(ctx, { ...ctx.emptyVisualDesigns(), nextId: 9, pages: [page] });
  return { ctx, page: store.pages[0] };
}
function render(ctx, definition, scenarioId, options) {
  const scenario = definition.scenarios.find(s => s.id === scenarioId) ?? null;
  return ctx.veCanvasHtml(definition, ctx.visualSession(scenario), options);
}
const nodeIds = html => [...html.matchAll(/data-ve-node="([^"]+)"/g)].map(m => m[1]);

test('[VISUAL-CANVAS] text and props are escaped; no markup from IR values reaches the page', () => {
  const { ctx, page } = pageFixture();
  const html = render(ctx, page, null, { mode: 'design', selected: 'vn-1' });
  assert.ok(!html.includes('<script'), 'hostile text never becomes a script element');
  assert.ok(html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;quotes&#39;'), 'text node value is escaped');
  assert.ok(html.includes('Save &quot;now&quot;'), 'catalog prop is escaped');
  assert.ok(html.includes('<span class="ve-chip" aria-hidden="true">Main &lt;region&gt;</span>'), 'name is escaped in the selection chip');
  assert.ok(html.includes('ve-tone-success'), 'known color option becomes a tone class');
  assert.equal(html, render(ctx, page, null, { mode: 'design', selected: 'vn-1' }), 'same project and scenario give the same markup');
});

test('[VISUAL-CANVAS] design nodes are click targets with one current selection; preview has no selection semantics', () => {
  const { ctx, page } = pageFixture();
  const html = render(ctx, page, null, { mode: 'design', selected: 'vn-3' });
  const ids = ctx.visualNodes(page.root).map(n => n.id);
  assert.deepEqual(nodeIds(html).sort(), [...ids].sort(), 'design mode renders every node once');
  for (const id of ids) assert.match(html, new RegExp(`data-ve-node="${id}" data-action="ve-select" data-value="${id}" tabindex="-1"${id === 'vn-3' ? ' aria-current="true"' : '[ >]'}`), id);
  assert.equal(html.match(/aria-current="true"/g).length, 1);
  assert.match(html, /data-ve-node="vn-3"[^>]*aria-current="true"><span class="ve-chip" aria-hidden="true">Save<\/span>/, 'selection shows a label chip, not colour only');
  assert.ok(!/role="(tree|treeitem)"|aria-selected/.test(html), 'the canvas is not an ARIA tree; the Outline is');
  const preview = render(ctx, page, null, { mode: 'preview', selected: 'vn-3' });
  assert.ok(nodeIds(preview).length > 0);
  for (const semantic of ['data-action="ve-select"', 'aria-current', 'tabindex', 've-chip', 'role="tree']) assert.ok(!preview.includes(semantic), 'preview has no ' + semantic);
  assert.ok(!/data-ve-node="[^"]+"[^>]*aria-label/.test(preview), 'preview nodes expose their rendered content, not a replacement label');
});

test('[VISUAL-CANVAS] hidden nodes: dimmed with their state in design, omitted in preview, shown when the scenario matches', () => {
  const { ctx, page } = pageFixture();
  const designHtml = render(ctx, page, null, { mode: 'design' });
  assert.match(designHtml, /class="ve-node ve-ui ve-ui-alert ve-is-hidden" data-ve-node="vn-5"[^>]*><span class="ve-hidden-badge">hidden in default<\/span>/);
  assert.equal(designHtml.match(/>hidden in default</g).length, 2, 'only the nodes whose own rule hides them carry the badge');
  const preview = render(ctx, page, null, { mode: 'preview' });
  for (const id of ['vn-5', 'vn-6', 'vn-7']) assert.ok(!nodeIds(preview).includes(id), id + ' omitted in preview');
  assert.ok(!preview.includes('hidden in'), 'preview carries no hidden badges');
  const empty = render(ctx, page, 'empty', { mode: 'preview' });
  for (const id of ['vn-5', 'vn-6', 'vn-7']) assert.ok(nodeIds(empty).includes(id), id + ' visible in the empty scenario');
  assert.ok(empty.includes('No customers yet') && empty.includes('Only when empty'));
});

test('[VISUAL-CANVAS] table rows come only from scenario bindings', () => {
  const { ctx, page } = pageFixture();
  const rows = render(ctx, page, 'with-rows', { mode: 'preview' });
  assert.equal(rows.match(/class="ve-u-tr"/g).length, 2, 'one grid row per fixture record');
  assert.ok(rows.includes('<span class="ve-u-td">Row &lt;one&gt;</span><span class="ve-u-td">Ada</span>'), 'cells read nested accessor keys and are escaped');
  assert.ok(rows.includes('<span class="ve-u-th">Name</span><span class="ve-u-th">Owner</span>'));
  assert.ok(!rows.includes('No rows in this scenario'));
  for (const scenario of [null, 'empty']) {
    const html = render(ctx, page, scenario, { mode: 'design' });
    assert.ok(html.includes('<span class="ve-u-th">Name</span>') && html.includes('No rows in this scenario'), 'header plus an empty line without fixture data');
    assert.equal((html.match(/class="ve-u-tr"/g) || []).length, 0, 'no invented rows');
  }
  assert.ok(render(ctx, page, null, { mode: 'design' }).includes('{customers · list}'), 'design mode names the unresolved binding');
});

test('[VISUAL-CANVAS] layout rules become inline composition style; mobile uses the narrow override', () => {
  const { ctx, page } = pageFixture();
  const desktop = render(ctx, page, null, { viewport: 'desktop' }), mobile = render(ctx, page, null, { viewport: 'mobile' });
  assert.match(desktop, /data-ve-node="vn-1"[^>]*style="[^"]*display:grid;[^"]*grid-template-columns:repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(mobile, /data-ve-node="vn-1"[^>]*style="[^"]*display:flex;flex-direction:column;[^"]*grid-template-columns:repeat\(1, minmax\(0, 1fr\)\)/);
  assert.ok(desktop.includes('ve-frame ve-vp-desktop') && mobile.includes('ve-frame ve-vp-mobile'));
});

test('[VISUAL-CANVAS] catalog layout lands on the Nuxt component root; the wrapper keeps only sizing', () => {
  const ctx = load();
  const form = ctx.visualNuxt('vn-1', 'u-form', {}, { name: 'Grid form', layout: ctx.visualLayoutRules('grid', { ...ctx.compositionDefaultUI(), columns: 3 }) });
  form.slots.default = [ctx.visualNuxt('vn-2', 'u-input', {}, { name: 'First' }), ctx.visualNuxt('vn-3', 'u-input', {}, { name: 'Second' })];
  const heading = ctx.visualText('vn-4', 'Title', 'h2', { name: 'Heading', layout: ctx.visualLayoutRules('row') });
  const page = { id: 'vp-5', ownerId: 'surface-1', name: 'Form', root: [form, heading], notes: '', scenarios: [] };
  const [installed] = install(ctx, { ...ctx.emptyVisualDesigns(), nextId: 6, pages: [page] }).pages;
  const html = ctx.veCanvasHtml(installed, ctx.visualSession(), { mode: 'preview' });
  const wrapper = html.match(/<div class="ve-node ve-ui ve-ui-form" data-ve-node="vn-1" style="([^"]*)">/);
  assert.ok(wrapper, 'form wrapper renders');
  assert.equal(wrapper[1], 'box-sizing:border-box;width:100%;min-width:min(100%, 0px);max-width:min(100%, 1600px)', 'wrapper carries sizing only');
  assert.match(html, /<div class="ve-u-form" style="[^"]*display:grid;[^"]*grid-template-columns:repeat\(3, minmax\(0, 1fr\)\)[^"]*">/, 'form preview root is the grid');
  assert.match(html, /class="ve-node ve-text ve-t-h2" data-ve-node="vn-4" style="[^"]*display:flex;flex-direction:row;/, 'text nodes carry the region style themselves');
  const mobile = ctx.veCanvasHtml(installed, ctx.visualSession(), { mode: 'preview', viewport: 'mobile' });
  assert.match(mobile, /<div class="ve-u-form" style="[^"]*display:flex;flex-direction:column;[^"]*grid-template-columns:repeat\(1, minmax\(0, 1fr\)\)/, 'narrow override on mobile');
});

test('[VISUAL-CANVAS] external library nodes render a dashed placeholder and never load the package', () => {
  const ctx = load();
  const external = ctx.visualExternal('vn-2', '@tiptap/vue-3', 'rich-text', { name: 'Editor', props: { content: { kind: 'prop', name: 'body' }, editable: lit(true) } });
  const component = { id: 'vc-1', libraryId: 'lib-editor', exportName: 'RichEditor', description: '', props: [{ name: 'body', type: 'string', required: false, default: 'Hello <b>' }], slots: [], emits: [], variants: [],
    template: [external], scenarios: [], dependencies: [{ package: '@tiptap/vue-3', version: '2.11.5', purpose: 'Rich text editing' }] };
  const [installed] = install(ctx, { ...ctx.emptyVisualDesigns(), nextId: 3, components: [component] }).components;
  const html = ctx.veCanvasHtml(installed, ctx.visualSession(), { mode: 'design', selected: 'vn-2' });
  assert.ok(html.includes('External · @tiptap/vue-3@2.11.5 · adapter rich-text'));
  assert.ok(html.includes('<code>content</code>') && html.includes('<code>editable</code>'), 'prop names are listed');
  assert.ok(html.includes('Hello &lt;b&gt;'), 'prop-bound values use the contract default, escaped');
  assert.ok(!/<(script|iframe|img|link)\b|import\(|src=/.test(html), 'nothing loads the package');
});

test('[VISUAL-CANVAS] project component instances render their template inertly; slot content stays selectable', () => {
  const ctx = load();
  const card = { id: 'vc-1', libraryId: 'lib-card', exportName: 'InfoCard', description: '', props: [{ name: 'title', type: 'string', required: false }], slots: [{ name: 'default', required: false }], emits: [], variants: [{ id: 'loud', name: 'Loud', values: { title: 'Variant title' } }],
    template: [ctx.visualElement('vn-2', 'div', { children: [{ id: 'vn-3', kind: 'text', role: 'h2', value: { kind: 'prop', name: 'title' } }, ctx.visualSlot('vn-4', 'default')] })], scenarios: [] };
  const instance = ctx.visualProject('vn-6', 'vc-1', { name: 'Welcome card', props: { title: lit('Hello <team>') } });
  instance.slots.default = [ctx.visualText('vn-7', 'Slot body', 'p', { name: 'Body' })];
  const page = { id: 'vp-5', ownerId: 'surface-1', name: 'Home', root: [instance], notes: '', scenarios: [] };
  const store = install(ctx, { ...ctx.emptyVisualDesigns(), nextId: 8, components: [card], pages: [page] }), [installed] = store.pages;
  const html = ctx.veCanvasHtml(installed, ctx.visualSession(), { mode: 'design' });
  assert.deepEqual(nodeIds(html), ['vn-6', 'vn-7'], 'only this definition\'s nodes are selectable');
  assert.ok(html.includes('InfoCard') && html.includes('Hello &lt;team&gt;') && html.includes('Slot body'));
  const variant = ctx.realm({ ...installed.root[0], variantId: 'loud', props: {} });
  const store2 = install(ctx, { ...store, pages: [{ ...installed, root: [variant] }] });
  assert.ok(ctx.veCanvasHtml(store2.pages[0], ctx.visualSession(), { mode: 'preview' }).includes('Variant title'), 'variant values fill unset props');
});

test('[VISUAL-CANVAS] every pinned catalog entry has a static preview in design and preview mode', () => {
  const ctx = load(), entries = vm.runInContext('[...visualCatalog]', ctx);
  const root = entries.map((entry, i) => ctx.visualNuxt('vn-' + (i + 1), entry.id, {}, { name: entry.label }));
  const page = { id: 'vp-' + (entries.length + 1), ownerId: 'surface-1', name: 'Catalog', root, notes: '', scenarios: [] };
  const [installed] = install(ctx, { ...ctx.emptyVisualDesigns(), nextId: entries.length + 2, pages: [page] }).pages;
  assert.deepEqual([...new Set(entries.map(e => e.preview))].sort(), ['alert', 'avatar', 'badge', 'breadcrumb', 'button', 'card', 'checkbox', 'field', 'form', 'input', 'menu', 'overlay', 'progress', 'select', 'separator', 'skeleton', 'switch', 'table', 'tabs', 'textarea']);
  for (const mode of ['design', 'preview']) {
    const html = ctx.veCanvasHtml(installed, ctx.visualSession(), { mode });
    entries.forEach((entry, i) => assert.match(html, new RegExp(`class="ve-node ve-ui ve-ui-${entry.preview}" data-ve-node="vn-${i + 1}"`), mode + ' ' + entry.id));
    assert.ok(!/<(input|select|textarea|button|img|script|a)\b/.test(html), mode + ': previews are inert markup');
  }
});
