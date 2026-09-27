// Visual editor entry, Back, palette, keyboard, delete and "Move to…" (ve-entry.js, ve-structure.js, ve-actions.js) over
// the real shared contracts and ve-* sources in one realm, as build-companion.py inlines them. Host persistence,
// navigation, focus and modal plumbing are the only stubs; every write runs through the real veCommit with validation.
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
const files = ['ui-fields.js', 'data-source-model.js', 've-state.js', 've-catalog-preview.js', 've-canvas.js', 've-outline.js', 've-insert.js', 've-layouts.js', 've-fields.js', 've-review.js', 've-interactions.js', 've-page-inspector.js', 've-contract.js', 've-child-inspector.js', 've-publish.js', 've-component-views.js', 've-page-views.js', 've-structure.js', 've-entry.js', 've-actions.js'];
const concept = (await Promise.all(files.map(name => readFile('docs/concepts/companion/src/' + name, 'utf8')))).join('\n');
const stubs = `const ICONS = {}; const state = { settings: { theme: 'light' }, view: 'page-editor', activeRun: false };
let storageWarning = '', persistenceSnapshot = null, modalType = '', modalOriginal = null;
const STORAGE_KEY = 'concept', DESIGN_LIMITS = { history: 50 }, tdUi = { busy: false }, LIBRARY_LIMIT = 64;
const localStorage = { getItem: () => null }, CSS = { escape: s => s };
const smUi = { map: null, item: null }, designUi = { selected: null }, canvasUi = { inspector: 'intent' }, productUi = { component: null };
class Element {}
const document = { addEventListener(type, fn) { (host.listeners[type] ??= []).push(fn); }, getElementById: id => host.dom[id] ?? null,
  querySelector(sel) { if (sel === 'dialog[open]') return host.dom.modal.open ? host.dom.modal : null; return { focus() { host.focused = sel; } }; },
  get activeElement() { return host.active; } };
function design() { return host.design; } function project() { return host.project; }
function structuredClone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }
function smToken() { return 'rev-' + host.design.revision; } function designCopy(v) { return structuredClone(v); }
function designSnapshot(d) { return structuredClone({ visualDesigns: d.visualDesigns, library: d.library }); } function validSavedDesign() { return true; }
function designTravel(direction) {
  const d = host.design, from = direction === 'undo' ? d.history : d.future;
  if (!from.length) return false;
  const snapshot = from.pop(); (direction === 'undo' ? d.future : d.history).push(designSnapshot(d));
  Object.assign(d, snapshot); d.revision++; render(); return true;
}
function saveConceptState() { host.saves++; return true; } function render() { host.renders++; } function notify(text) { host.notices.push(text); }
function setView(view) { state.view = view; host.active = host.dom.content; render(); }
function showModal(type) { modalType = type; host.dom.modal.open = true; } function closeModal() { modalType = ''; host.dom.modal.open = false; }
function redrawModal() { host.redraws++; } function realm(v) { return JSON.parse(JSON.stringify(v)); }
function smStore() { return { maps: host.maps }; } function smFind(store, id) { return store.maps.find(m => m.id === id) || null; } function smFocusItem() { host.focusedItem = smUi.item; }
function uiFocusRecord(element) { return element?.id ? { id: element.id } : null; } function focusUiControl(token) { host.returned = token?.id ?? null; return !!token?.id && token.id !== 'content'; }
function ui() { return veUi; } function modal() { return { type: modalType }; } function view() { return state; } function origin() { return { smUi, designUi, canvasUi, productUi }; }
function field(props) { return Object.assign(new Element(), props); } function fire(type, event) { for (const fn of host.listeners[type] ?? []) fn(event); }`;
const lit = value => ({ kind: 'literal', value });
const surfaces = [{ id: 'surface-a', kind: 'page', label: 'Customers' }, { id: 'surface-b', kind: 'modal', label: 'Edit customer' }];
const library = [{ id: 'search-field', name: 'SearchField', description: 'Search input' }, { id: 'toolbar', name: 'Toolbar', description: 'Customer toolbar' }, { id: 'plain-card', name: 'Plain card', description: '' }];
// Page Customers: Main section [Title, Customer table, Summary card {default: [Open button → focus Search box]}, Search box
// input], Footer, Toolbar instance. SearchField binds its query prop in a text, an emit payload and an external adapter.
function load() {
  const host = { listeners: {}, design: null, saves: 0, renders: 0, redraws: 0, notices: [], maps: [{ id: 'map-1' }], active: null, focused: null, returned: null, dom: { modal: { open: false }, 've-error': { textContent: '' }, content: { id: 'content', scrollTop: 0 } } };
  host.project = { get design() { return host.design; }, set design(v) { host.design = v; } };
  const ctx = vm.createContext({ host, setTimeout });
  vm.runInContext(shared + '\n' + helpers + '\n' + stubs + '\n' + concept, ctx, { filename: 'concept-visual-entry.js' });
  const button = ctx.visualNuxt('vn-24', 'u-button', { label: lit('Open') }, { name: 'Open', events: [{ id: 'vi-28', event: 'click', label: 'Focus search', actions: [{ kind: 'focus', nodeId: 'vn-25' }], notes: '', acceptance: '' }] });
  const card = ctx.visualNuxt('vn-23', 'u-card', {}, { name: 'Summary card' }); card.slots.default = [button];
  const section = ctx.visualElement('vn-20', 'section', { name: 'Main', children: [ctx.visualText('vn-21', 'Customers', 'h1', { name: 'Title' }), ctx.visualNuxt('vn-22', 'u-table', {}, { name: 'Customer table' }), card, ctx.visualElement('vn-25', 'input', { name: 'Search box' })] });
  const page = { id: 'vp-6', ownerId: 'surface-a', name: 'Customers', root: [section, ctx.visualText('vn-26', 'Footer note', 'p', { name: 'Footer' }), ctx.visualProject('vn-27', 'vc-3', { name: 'Toolbar' })], scenarios: [], notes: '' };
  const text = { ...ctx.visualText('vn-2', '', 'p', { name: 'Query text' }), value: { kind: 'prop', name: 'query' } };
  const go = ctx.visualElement('vn-11', 'button', { name: 'Go', events: [{ id: 'vi-13', event: 'click', label: 'Search', actions: [{ kind: 'emit', event: 'search', payload: { kind: 'prop', name: 'query' } }], notes: '', acceptance: '' }] });
  const external = ctx.visualExternal('vn-12', 'tiptap', 'rich-text', { name: 'Editor', props: { content: { kind: 'prop', name: 'query' }, options: lit({ kind: 'prop', name: 'query' }) } });
  const search = { id: 'vc-1', libraryId: 'search-field', exportName: 'SearchField', description: 'Search input', props: [{ name: 'query', type: 'string', required: false }], slots: [{ name: 'actions', required: false }], emits: [{ name: 'search', payloadType: 'string' }], variants: [], scenarios: [],
    dependencies: [{ package: 'tiptap', version: '2.11.5', purpose: 'Rich text' }], template: [text, go, external] };
  const toolbar = { id: 'vc-3', libraryId: 'toolbar', exportName: 'Toolbar', description: 'Customer toolbar', props: [], slots: [], emits: [], variants: [], scenarios: [], template: [ctx.visualElement('vn-4', 'div', { name: 'Bar', children: [ctx.visualProject('vn-5', 'vc-1', { name: 'Search' })] })] };
  host.design = ctx.realm({ schema: 5, nodes: surfaces, library, dataSources: { sources: [] }, revision: 1, history: [], future: [], visualDesigns: { ...ctx.emptyVisualDesigns(), nextId: 30, pages: [page], components: [search, toolbar] } });
  ctx.validateVisualDesigns(host.design.visualDesigns, ctx.veContext(host.design));
  Object.assign(ctx.ui(), { owner: 'surface-a' });
  return ctx;
}
const plain = value => JSON.parse(JSON.stringify(value));
const snapshot = ctx => JSON.stringify(ctx.host.design.visualDesigns);
const page = ctx => ctx.veStore().pages[0];
const children = ctx => plain(page(ctx).root[0].children.map(n => n.id));
const el = (field, key, value, extra = {}) => ({ dataset: { field, key }, value, type: extra.type ?? 'text', tagName: extra.tagName ?? 'INPUT' });
function press(ctx, key, { where = 'outline', from = ctx.ui().selected, typing = false, inEditor = true, ...mods } = {}) {
  const hit = { '.ve-page-editor': inEditor, input: typing, '#ve-outline': where === 'outline', '.ve-canvas-area': where === 'canvas' };
  const target = ctx.field({ dataset: {}, getAttribute: () => null, closest: sel => (hit[Object.keys(hit).find(k => sel.startsWith(k))] ? { dataset: { value: from, veNode: from } } : null) });
  const event = { key, target, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, repeat: false, isComposing: false, prevented: false, preventDefault() { this.prevented = true; }, stopPropagation() {}, ...mods };
  ctx.fire('keydown', event);
  return event;
}

test('[VISUAL-ENTRY] outline order: next, previous, parent, first child, Home/End and the search filter', () => {
  const ctx = load(), def = page(ctx), step = (id, key, query) => ctx.veOutlineStep(def, id, key, query);
  assert.equal(step('vn-21', 'ArrowDown'), 'vn-22');
  assert.equal(step('vn-23', 'ArrowDown'), 'vn-24', 'depth-first: a slot child follows its component');
  assert.equal(step('vn-26', 'ArrowUp'), 'vn-25');
  assert.equal(step('vn-20', 'ArrowUp'), 'vn-20', 'the first item stays');
  assert.equal(step('vn-27', 'ArrowDown'), 'vn-27', 'the last item stays');
  assert.equal(step('vn-24', 'ArrowLeft'), 'vn-23', 'parent');
  assert.equal(step('vn-20', 'ArrowLeft'), 'vn-20', 'a root item has no parent');
  assert.equal(step('vn-23', 'ArrowRight'), 'vn-24', 'first child');
  assert.equal(step('vn-22', 'ArrowRight'), 'vn-22', 'a leaf has no child');
  assert.equal(step('vn-24', 'Home'), 'vn-20'); assert.equal(step('vn-20', 'End'), 'vn-27');
  assert.equal(step(null, 'ArrowDown'), 'vn-20', 'nothing selected starts at the first item');
  assert.equal(step('vn-20', 'ArrowDown', 'open'), 'vn-23', 'search keeps matches and their ancestors only');
  assert.equal(step('vn-26', 'ArrowUp', 'footer'), 'vn-26');
});

test('[VISUAL-ENTRY] keyboard: arrows select and move focus, Alt+Arrow moves, Delete confirms, Ctrl+D, undo/redo, Escape', () => {
  const ctx = load();
  press(ctx, 'ArrowDown', { from: 'vn-21' });
  assert.equal(ctx.ui().selected, 'vn-22', 'with nothing selected, arrows start from the focused item');
  const down = press(ctx, 'ArrowDown');
  assert.ok(down.prevented); assert.equal(ctx.ui().selected, 'vn-23');
  assert.equal(ctx.host.focused, '#ve-outline [role="treeitem"][data-value="vn-23"]', 'focus follows the selection (roving tabindex)');
  press(ctx, 'ArrowRight', { where: 'canvas' });
  assert.equal(ctx.ui().selected, 'vn-24'); assert.equal(ctx.host.focused, '.ve-canvas-area [data-ve-node="vn-24"][data-action]');
  press(ctx, 'ArrowLeft'); assert.equal(ctx.ui().selected, 'vn-23');
  press(ctx, 'ArrowUp', { altKey: true });
  assert.deepEqual(children(ctx), ['vn-21', 'vn-23', 'vn-22', 'vn-25'], 'Alt+ArrowUp moves earlier');
  assert.equal(ctx.ui().selected, 'vn-23');
  press(ctx, 'd', { ctrlKey: true });
  const copy = ctx.ui().selected;
  assert.deepEqual(children(ctx), ['vn-21', 'vn-23', copy, 'vn-22', 'vn-25'], 'Ctrl+D duplicates right after');
  const before = snapshot(ctx);
  press(ctx, 'Delete');
  assert.equal(ctx.modal().type, 've-delete', 'Delete opens the confirmation'); assert.equal(snapshot(ctx), before, 'nothing is deleted yet');
  assert.equal(press(ctx, 'ArrowDown').prevented, false, 'keys are ignored while a dialog is open');
  ctx.handleVisualAction('ve-delete-confirm');
  assert.equal(ctx.modal().type, ''); assert.deepEqual(children(ctx), ['vn-21', 'vn-23', 'vn-22', 'vn-25']);
  assert.equal(ctx.ui().selected, 'vn-23', 'the previous sibling is selected');
  press(ctx, 'z', { ctrlKey: true });
  assert.deepEqual(children(ctx), ['vn-21', 'vn-23', copy, 'vn-22', 'vn-25'], 'Ctrl+Z undoes the delete');
  press(ctx, 'Z', { metaKey: true, shiftKey: true });
  assert.deepEqual(children(ctx), ['vn-21', 'vn-23', 'vn-22', 'vn-25'], 'Shift+Cmd+Z redoes it');
  press(ctx, 'z', { ctrlKey: true }); press(ctx, 'z', { ctrlKey: true }); press(ctx, 'z', { ctrlKey: true });
  assert.deepEqual(children(ctx), ['vn-21', 'vn-22', 'vn-23', 'vn-25'], 'back to the original order');
  press(ctx, 'z', { ctrlKey: true });
  assert.match(ctx.host.notices.at(-1), /^Nothing to undo/);
  press(ctx, 'Escape');
  assert.equal(ctx.ui().selected, null, 'Escape clears the selection');
  assert.equal(press(ctx, 'Escape').prevented, false, 'Escape without a selection is left to the page');
  ctx.handleVisualAction('ve-select', 'vn-21');
  for (const options of [{ typing: true }, { inEditor: false }]) {
    assert.equal(press(ctx, 'Delete', options).prevented, false); assert.equal(ctx.modal().type, '');
  }
  assert.equal(press(ctx, 'ArrowDown', { where: null }).prevented, false, 'arrows act only on the outline and canvas');
  press(ctx, 'ArrowDown', { altKey: true, repeat: true });
  assert.deepEqual(children(ctx), ['vn-21', 'vn-22', 'vn-23', 'vn-25'], 'a held Alt+Arrow does not repeat writes');
  ctx.ui().mode = 'preview'; press(ctx, 'd', { ctrlKey: true });
  assert.match(ctx.ui().error, /^Preview is read-only/);
});

test('[VISUAL-ENTRY] delete shows its consequences, refuses referenced elements and used components, and deletes page designs', () => {
  const ctx = load();
  ctx.handleVisualAction('ve-select', 'vn-23'); ctx.handleVisualAction('ve-delete');
  let html = ctx.veDeleteDialog();
  for (const text of ['Delete Summary card?', 'Deletes Summary card and 1 nested element.', '1 interaction on them is removed.', 'No scenario values change.', 'Undo restores it.']) assert.ok(html.includes(text), text);
  ctx.closeModal(); ctx.handleVisualAction('ve-select', 'vn-25'); ctx.handleVisualAction('ve-delete');
  html = ctx.veDeleteDialog();
  assert.match(html, /Cannot delete: Still referenced by Focus search\. Change those first\./);
  assert.match(html, /data-action="ve-delete-confirm"[^>]*disabled/, 'a refused delete cannot be confirmed');
  const before = snapshot(ctx);
  ctx.handleVisualAction('ve-delete-confirm');
  assert.equal(ctx.ui().deleteForm.error, 'Still referenced by Focus search. Change those first.', 'the refusal lands in the dialog alert');
  assert.equal(snapshot(ctx), before); ctx.closeModal();
  ctx.handleVisualAction('ve-delete', 'definition');
  assert.ok(ctx.veDeleteDialog().includes('Deletes the page design Customers with 8 elements and 0 scenarios.'));
  ctx.handleVisualAction('ve-delete-confirm');
  assert.equal(ctx.veStore().pages.length, 0); assert.equal(ctx.ui().selected, null);
  assert.match(ctx.vePageEditorView(), /data-action="ve-start-page"/, 'the surface is back to Start design');
  assert.match(ctx.host.notices.at(-1), /^Customers deleted\. Undo is available\./);
  Object.assign(ctx.view(), { view: 'component-editor' }); Object.assign(ctx.ui(), { library: 'search-field' });
  ctx.handleVisualAction('ve-delete', 'definition');
  assert.match(ctx.veDeleteDialog(), /Cannot delete: SearchField is used by Toolbar\. Remove those instances first\./);
  ctx.closeModal(); ctx.ui().mode = 'preview'; ctx.handleVisualAction('ve-delete', 'definition');
  assert.equal(ctx.modal().type, ''); assert.match(ctx.ui().error, /^Preview is read-only/);
});

test('[VISUAL-ENTRY] Move to… lists only valid containers, never the element itself or its descendants', () => {
  const ctx = load(), values = id => plain(ctx.veReparentCandidates(page(ctx), id).map(c => c.value));
  assert.deepEqual(values('vn-21'), ['root', 'vn-23|default'], 'not text, table, button, input, a slotless instance or its current parent');
  assert.deepEqual(values('vn-24'), ['root', 'vn-20'], 'the card it is in is excluded');
  assert.deepEqual(values('vn-20'), [], 'a root section cannot move into itself or its card');
  ctx.handleVisualAction('ve-select', 'vn-21'); ctx.handleVisualAction('ve-reparent');
  assert.equal(ctx.modal().type, 've-reparent');
  assert.match(ctx.veReparentDialog(), /data-action="ve-reparent-confirm" data-value="vn-23\|default" aria-label="Move into Summary card › default, UCard"/);
  const before = snapshot(ctx);
  ctx.handleVisualAction('ve-reparent-confirm', 'vn-22');
  assert.equal(ctx.ui().reparentForm.error, 'That container is no longer available. Choose another one.'); assert.equal(snapshot(ctx), before);
  ctx.handleVisualAction('ve-reparent-confirm', 'vn-23|default');
  assert.deepEqual(plain(page(ctx).root[0].children[1].slots.default.map(n => n.id)), ['vn-24', 'vn-21']);
  assert.equal(ctx.ui().selected, 'vn-21'); assert.equal(ctx.modal().type, '');
  ctx.handleVisualAction('ve-reparent-confirm', 'root');
  assert.match(ctx.ui().error, /^Open Move to… again\./, 'a stale confirm is refused');
});

test('[VISUAL-ENTRY] Back restores the storymap item, sitemap selection, library component and the page after Open definition', () => {
  const ctx = load(), { smUi, designUi, canvasUi, productUi } = ctx.origin();
  Object.assign(ctx.view(), { view: 'storymaps' }); Object.assign(smUi, { map: 'map-1', item: 'item-2' }); ctx.host.active = { id: 'design-page' };
  ctx.handleVisualAction('ve-open-page', 'surface-a');
  assert.equal(ctx.view().view, 'page-editor'); assert.equal(ctx.ui().owner, 'surface-a');
  Object.assign(smUi, { map: null, item: null });
  ctx.handleVisualAction('ve-back');
  assert.equal(ctx.view().view, 'storymaps'); assert.deepEqual({ ...smUi }, { map: 'map-1', item: 'item-2' });
  assert.equal(ctx.host.returned, 'design-page', 'focus returns to the Design page control');
  Object.assign(ctx.view(), { view: 'sitemap' }); Object.assign(designUi, { selected: 'surface-b' }); canvasUi.inspector = 'links';
  ctx.handleVisualAction('ve-open-page', 'surface-b');
  Object.assign(designUi, { selected: null }); canvasUi.inspector = 'intent';
  ctx.handleVisualAction('ve-back');
  assert.equal(ctx.view().view, 'sitemap'); assert.equal(designUi.selected, 'surface-b'); assert.equal(canvasUi.inspector, 'links');
  Object.assign(ctx.view(), { view: 'components' }); productUi.component = 'toolbar';
  ctx.handleVisualAction('ve-open-component', 'toolbar');
  assert.equal(ctx.view().view, 'component-editor'); productUi.component = 'plain-card';
  ctx.handleVisualAction('ve-back');
  assert.equal(ctx.view().view, 'components'); assert.equal(productUi.component, 'toolbar');
  Object.assign(ctx.view(), { view: 'page-editor' }); Object.assign(ctx.ui(), { owner: 'surface-a', back: [] });
  ctx.handleVisualAction('ve-select', 'vn-27'); ctx.handleVisualAction('ve-open-definition', 'vc-3');
  assert.equal(ctx.view().view, 'component-editor'); assert.equal(ctx.ui().library, 'toolbar'); assert.equal(ctx.ui().selected, null);
  ctx.handleVisualAction('ve-back');
  assert.equal(ctx.view().view, 'page-editor'); assert.equal(ctx.ui().owner, 'surface-a'); assert.equal(ctx.ui().selected, 'vn-27');
  Object.assign(ctx.view(), { view: 'storymaps' }); Object.assign(smUi, { map: 'map-1', item: 'item-2' }); ctx.host.active = null;
  ctx.handleVisualAction('ve-open-page', 'surface-a'); ctx.host.maps = []; Object.assign(smUi, { map: null, item: null });
  ctx.handleVisualAction('ve-back');
  assert.equal(ctx.view().view, 'storymaps'); assert.equal(smUi.map, null, 'a removed storymap is not restored');
  ctx.handleVisualAction('ve-back');
  assert.equal(ctx.view().view, 'pages', 'an empty Back stack returns to the Pages list');
});

test('[VISUAL-ENTRY] palette commands exist only while an editor shows a design, and a palette command closes the palette', () => {
  const ctx = load(), titles = () => plain(ctx.vePaletteRows().map(r => r[2]));
  Object.assign(ctx.view(), { view: 'pages' });
  assert.deepEqual(titles(), []);
  Object.assign(ctx.view(), { view: 'page-editor' });
  assert.deepEqual(titles(), ['Insert data table', 'Insert form', 'Insert modal', 'Save page as layout', 'Apply layout…', 'Preview page']);
  ctx.handleVisualAction('ve-select', 'vn-22');
  assert.deepEqual(titles().slice(-3), ['Duplicate selected', 'Bind data…', 'Add interaction…']);
  ctx.ui().owner = 'surface-b';
  assert.deepEqual(titles(), [], 'a surface without a design has no editor commands');
  Object.assign(ctx.view(), { view: 'component-editor' }); Object.assign(ctx.ui(), { library: 'toolbar', selected: null });
  assert.deepEqual(titles(), ['Insert data table', 'Insert form', 'Insert modal', 'Preview component']);
  Object.assign(ctx.view(), { view: 'page-editor' }); Object.assign(ctx.ui(), { owner: 'surface-a', selected: null });
  ctx.showModal('palette');
  ctx.handleVisualAction('ve-insert', 'nuxt:u-table');
  assert.equal(ctx.modal().type, '', 'the palette closed first');
  assert.equal(page(ctx).root.at(-1).ref.entryId, 'u-table');
  ctx.showModal('palette'); ctx.handleVisualAction('ve-left', 'layouts');
  assert.equal(ctx.ui().left, 'layouts'); assert.equal(ctx.ui().pane, 'left', 'Apply layout… shows the Layouts pane');
});

test('[VISUAL-ENTRY] carry-forward: Preview guards publish and customize; row attributes are escaped', () => {
  const ctx = load();
  Object.assign(ctx.view(), { view: 'component-editor' }); Object.assign(ctx.ui(), { library: 'search-field', mode: 'preview' });
  ctx.ui().publishForm = { componentId: 'vc-1', version: '1.0.0', confirm: true, error: '', token: ctx.smToken() };
  const before = snapshot(ctx);
  ctx.handleVisualAction('ve-publish-confirm');
  assert.match(ctx.ui().error, /^Preview is read-only/); assert.equal(snapshot(ctx), before);
  ctx.handleVisualAction('ve-customize', 'u-button');
  assert.match(ctx.ui().error, /^Preview is read-only/); assert.equal(ctx.design().library.length, 3);
  assert.match(ctx.veRowAttrs('ve-variant-row', 'variants', 0, 'value:a"b<'), /data-key="value:a&quot;b&lt;"/);
});

test('[VISUAL-ENTRY] carry-forward: renaming a prop rewrites its own-template bindings and payloads, not literals', () => {
  const ctx = load();
  Object.assign(ctx.view(), { view: 'component-editor' }); Object.assign(ctx.ui(), { library: 'search-field' });
  ctx.veFieldEdit({ ...el('ve-contract-row', 'name', 'term'), dataset: { field: 've-contract-row', key: 'name', list: 'props', index: '0' } }, true);
  assert.equal(ctx.ui().error, '');
  const c = ctx.veStore().components[0], [text, go, external] = c.template;
  assert.deepEqual(plain(c.props[0]).name, 'term');
  assert.deepEqual(plain(text.value), { kind: 'prop', name: 'term' });
  assert.deepEqual(plain(go.events[0].actions[0].payload), { kind: 'prop', name: 'term' });
  assert.deepEqual(plain(external.props), { content: { kind: 'prop', name: 'term' }, options: lit({ kind: 'prop', name: 'query' }) }, 'literal JSON is data, not a binding');
  ctx.validateVisualDesigns(ctx.veStore(), ctx.veContext(ctx.design()));
});

test('[VISUAL-ENTRY] carry-forward: external elements map free adapter event names in the Events tab', () => {
  const ctx = load();
  Object.assign(ctx.view(), { view: 'component-editor' }); Object.assign(ctx.ui(), { library: 'search-field', childTab: 'events' });
  ctx.handleVisualAction('ve-select', 'vn-12');
  const component = () => ctx.veStore().components[0];
  assert.match(ctx.veChildInspectorHtml(component(), component().template[2]), /data-field="ve-child-event"/);
  ctx.veFieldEdit(el('ve-child-event', 'add', '1bad'), true);
  assert.match(ctx.ui().error, /^Adapter event names start with a letter/);
  const before = snapshot(ctx);
  ctx.veFieldEdit(el('ve-child-event', 'add', 'update:content'), true);
  assert.equal(snapshot(ctx), before, 'naming an event does not write');
  assert.match(ctx.veChildInspectorHtml(component(), component().template[2]), /@update:content/);
  ctx.veFieldEdit(el('ve-child-event', 'add', 'update:content'), true);
  assert.equal(ctx.ui().error, 'update:content is already listed for adapter rich-text.');
  ctx.veFieldEdit(el('ve-child-emit', 'update:content', 'search', { tagName: 'SELECT' }));
  assert.deepEqual(plain(component().template[2].events.map(i => [i.event, i.actions[0].kind, i.actions[0].event])), [['update:content', 'emit', 'search']]);
  ctx.validateVisualDesigns(ctx.veStore(), ctx.veContext(ctx.design()));
  ctx.handleVisualAction('ve-select', 'vn-11');
  ctx.veFieldEdit(el('ve-child-event', 'add', 'custom'), true);
  assert.equal(ctx.ui().error, 'Only external library elements declare adapter events.');
});

test('[VISUAL-ENTRY] carry-forward: Backspace, physical-key fallback, contenteditable, Undo/Redo controls and Preview refusal', () => {
  const ctx = load();
  ctx.handleVisualAction('ve-select', 'vn-21');
  press(ctx, 'Backspace');
  assert.equal(ctx.modal().type, 've-delete', 'Backspace opens the delete confirmation like Delete');
  assert.match(ctx.veDeleteDialog(), /class="btn danger" data-action="ve-delete-confirm"[^>]*autofocus/, 'the destructive confirm is styled as danger');
  ctx.closeModal(); ctx.handleVisualAction('ve-select', 'vn-21');
  press(ctx, 'в', { ctrlKey: true, code: 'KeyD' });
  const copy = ctx.ui().selected;
  assert.notEqual(copy, 'vn-21', 'Ctrl+D on a non-Latin layout duplicates through event.code');
  press(ctx, 'я', { ctrlKey: true, code: 'KeyZ' });
  assert.deepEqual(children(ctx), ['vn-21', 'vn-22', 'vn-23', 'vn-25'], 'Ctrl+Z through event.code undoes');
  assert.match(ctx.veHistoryButtons(), /data-action="ve-redo" data-value="" aria-label="Redo design change">/, 'Redo is enabled after an undo');
  press(ctx, 'н', { ctrlKey: true, code: 'KeyY' });
  assert.ok(children(ctx).includes(copy), 'Ctrl+Y through event.code redoes');
  const editable = ctx.field({ dataset: {}, isContentEditable: true, getAttribute: () => null, closest: sel => (sel === '.ve-page-editor' ? {} : null) });
  const typed = { key: 'Backspace', target: editable, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, repeat: false, isComposing: false, prevented: false, preventDefault() { this.prevented = true; }, stopPropagation() {} };
  ctx.fire('keydown', typed);
  assert.equal(typed.prevented, false, 'a contenteditable target keeps its own keys'); assert.equal(ctx.modal().type, '');
  assert.equal(press(ctx, 'z', { ctrlKey: true, isComposing: true }).prevented, false, 'IME composition is left alone');
  ctx.ui().mode = 'preview';
  const before = snapshot(ctx);
  press(ctx, 'z', { ctrlKey: true });
  assert.match(ctx.ui().error, /^Preview is read-only/); assert.equal(snapshot(ctx), before, 'undo is refused in Preview');
  assert.equal((ctx.veHistoryButtons().match(/ disabled/g) || []).length, 2, 'both history controls are disabled in Preview');
  const history = () => plain(ctx.vePaletteRows().filter(r => ['ve-undo', 've-redo'].includes(r[0])).map(r => [r[0], r[4]]));
  assert.ok(ctx.host.design.history.length > 0); assert.deepEqual(history(), [], 'Preview offers no Undo or Redo in the palette');
  ctx.ui().mode = 'design'; assert.deepEqual(history(), [['ve-undo', 'undo']], 'Design offers Undo with its own icon');
  ctx.handleVisualAction('ve-undo'); assert.deepEqual(history(), [['ve-redo', 'redo']], 'and Redo with a distinct icon');
  ctx.host.design.history = []; ctx.host.design.future = [];
  assert.equal((ctx.veHistoryButtons().match(/ disabled/g) || []).length, 2, 'an empty history disables both controls');
  assert.ok(!plain(ctx.vePaletteRows().map(r => r[0])).includes('ve-undo'), 'the palette offers Undo only with history');
});

test('[VISUAL-ENTRY] carry-forward: Move to… dry-runs each container and hides those past the nesting limit', () => {
  const ctx = load();
  // Levels 1..12 nest as vn-31..vn-42; the level-12 div sits at the depth limit.
  let deepest = ctx.visualElement('vn-42', 'div', { name: 'Level 12' });
  for (let level = 11; level >= 1; level--) deepest = ctx.visualElement('vn-' + (30 + level), 'div', { name: 'Level ' + level, children: [deepest] });
  page(ctx).root.push(deepest); ctx.host.design.visualDesigns.nextId = 50;
  ctx.validateVisualDesigns(ctx.veStore(), ctx.veContext(ctx.design()));
  const values = id => plain(ctx.veReparentCandidates(page(ctx), id).map(c => c.value));
  assert.ok(values('vn-26').includes('vn-41') && !values('vn-26').includes('vn-42'), 'a leaf fits at level 11, not inside the level-12 div');
  assert.ok(values('vn-20').includes('vn-39') && !values('vn-20').includes('vn-40'), 'a three-level section fits at level 9, not at level 10');
  ctx.handleVisualAction('ve-select', 'vn-26'); ctx.handleVisualAction('ve-reparent');
  assert.ok(!ctx.veReparentDialog().includes('data-value="vn-42"'), 'the picker never offers a container the move would overflow');
});

// A sitemap surface that owns a page design or is a navigation target cannot be removed; the uses are named.
test('[VISUAL-SURFACES] surface uses name owned page designs and navigate actions in every definition kind', () => {
  const ctx = load(), bar = ctx.host.design.visualDesigns.components[1].template[0];
  bar.events = ctx.realm([{ id: 'vi-29', event: 'click', label: 'Open editor', actions: [{ kind: 'navigate', surfaceId: 'surface-b' }], notes: '', acceptance: '' }]);
  ctx.validateVisualDesigns(ctx.host.design.visualDesigns, ctx.veContext(ctx.host.design));
  assert.deepEqual(plain(ctx.veSurfaceUses(['surface-a'])), ['page design Customers']);
  assert.deepEqual(plain(ctx.veSurfaceUses(['surface-b'])), ['interaction Open editor in component Toolbar']);
  assert.deepEqual(plain(ctx.veSurfaceUses(['surface-a', 'surface-b'])), ['page design Customers', 'interaction Open editor in component Toolbar']);
  assert.deepEqual(plain(ctx.veSurfaceUses(['elsewhere'])), []);
  assert.equal(ctx.veSurfaceBlock(['surface-b']), 'In use by page and component designs: interaction Open editor in component Toolbar. Delete those page designs and change those navigate actions first. No surface was removed.');
});
// Imported (or otherwise orphaned) designs that name a missing surface stay reachable: each opens, and one reviewed
// write removes them together with navigation to missing surfaces, after which every edit validates again.
test('[VISUAL-SURFACES] orphaned page designs are listed, openable and removable with dangling navigation in one write', () => {
  const ctx = load(), d = ctx.host.design, bar = d.visualDesigns.components[1].template[0];
  bar.events = ctx.realm([{ id: 'vi-29', event: 'click', label: 'Open <gone>', actions: [{ kind: 'navigate', surfaceId: 'surface-gone' }, { kind: 'set-state', state: 'loading' }], notes: '', acceptance: '' }]);
  d.nodes = d.nodes.filter(n => n.id !== 'surface-a'); ctx.view().view = 'pages';
  const html = ctx.vePagesView();
  assert.ok(html.includes('Designs with a missing surface') && html.includes('data-action="ve-open-page" data-value="surface-a"') && html.includes('data-action="ve-orphans"'), html);
  assert.ok(!html.includes('<gone>'), 'labels are escaped');
  ctx.handleVisualAction('ve-open-page', 'surface-a');
  assert.deepEqual([ctx.view().view, ctx.veCurrentPage()?.id], ['page-editor', 'vp-6']);
  const before = snapshot(ctx);
  ctx.ui().selected = 'vn-26'; ctx.handleVisualAction('ve-duplicate');
  assert.match(ctx.ui().error, /owner surface is missing/); assert.equal(snapshot(ctx), before);
  ctx.handleVisualAction('ve-orphans');
  const dialog = ctx.veOrphansDialog();
  assert.equal(ctx.modal().type, 've-orphans');
  assert.ok(dialog.includes('Delete the page design Customers') && dialog.includes('Remove navigation to a missing surface from Component Toolbar / Open &lt;gone&gt;'), dialog);
  const history = d.history.length;
  ctx.handleVisualAction('ve-orphans-confirm');
  const store = ctx.veStore();
  assert.deepEqual([store.pages.length, plain(store.components[1].template[0].events[0].actions), ctx.host.design.history.length, ctx.modal().type], [0, [{ kind: 'set-state', state: 'loading' }], history + 1, '']);
  ctx.validateVisualDesigns(store, ctx.veContext(ctx.host.design));
  assert.match(ctx.host.notices.at(-1), /^Removed 1 page design and 1 navigation to missing surfaces\. Undo is available\.$/);
  assert.ok(!ctx.vePagesView().includes('Designs with a missing surface'));
});
