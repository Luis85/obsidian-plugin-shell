// Component editor (contract, child composition, dependencies, publishing, customize) over the real shared contracts and
// the real ve-* sources in one realm, as build-companion.py inlines them. Host persistence, rendering, navigation and
// modal plumbing are the only stubs; every write runs through the real veCommit with full validation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { conceptShared, visualModules } from './support/concept-realm.mjs';

const shared = await conceptShared(['native-contract.mjs', 'composition-contract.mjs', ...visualModules]);
const base = (await readFile('src/companion/app/base.html', 'utf8')).split('\n');
const helpers = ['function esc(', 'function icon(', 'function button(', 'function badge(', 'function modalHeader(', 'function dialogBody('].map(prefix => {
  const lines = base.filter(line => line.startsWith(prefix));
  assert.equal(lines.length, 1, prefix + ' is one line of base.html');
  return lines[0];
}).join('\n');
const files = ['ui-fields.js', 'data-source-model.js', 've-state.js', 've-catalog-preview.js', 've-canvas.js', 've-outline.js', 've-insert.js', 've-layouts.js', 've-fields.js', 've-review.js', 've-interactions.js', 've-page-inspector.js', 've-contract.js', 've-child-inspector.js', 've-publish.js', 've-component-views.js', 've-page-views.js', 've-structure.js', 've-entry.js', 've-actions.js'];
const concept = (await Promise.all(files.map(name => readFile('src/companion/app/' + name, 'utf8')))).join('\n');
const stubs = `const ICONS = {}; const state = { settings: { theme: 'light' }, view: 'component-editor', activeRun: false };
let storageWarning = '', persistenceSnapshot = null, modalType = '', modalOriginal = 'unsaved';
const STORAGE_KEY = 'concept', DESIGN_LIMITS = { history: 50 }, designUi = {}, tdUi = { busy: false }, LIBRARY_LIMIT = 64;
const localStorage = { getItem: () => null };
class Element {}
const document = { addEventListener(type, fn) { (host.listeners[type] ??= []).push(fn); }, getElementById: id => host.dom[id] ?? null };
function design() { return host.design; } function project() { return host.project; }
function structuredClone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }
function smToken() { return 'rev-' + host.design.revision; } function designCopy(v) { return structuredClone(v); }
function designSnapshot(d) { return { visualDesigns: d.visualDesigns, library: d.library }; } function validSavedDesign() { return true; }
function saveConceptState() { host.saves++; return true; } function render() { host.renders++; } function notify(text) { host.notices.push(text); }
function setView(view) { state.view = view; render(); } function uiFocusRecord() { return null; } function focusUiControl() { return false; }
function showModal(type) { modalType = type; host.dom.modal.open = true; } function closeModal() { modalType = ''; host.dom.modal.open = false; }
function redrawModal() { host.redraws++; } function realm(v) { return JSON.parse(JSON.stringify(v)); }
function ui() { return veUi; } function modal() { return { type: modalType, original: modalOriginal }; } function view() { return state; }
function field(props) { return Object.assign(new Element(), props); } function fire(type, event) { for (const fn of host.listeners[type] ?? []) fn(event); }`;
const lit = value => ({ kind: 'literal', value });
const surfaces = [{ id: 'surface-a', kind: 'page', label: 'Customers' }];
const library = [{ id: 'search-field', name: 'SearchField', description: 'Search input' }, { id: 'toolbar', name: 'Toolbar', description: 'Customer toolbar' }, { id: 'plain-card', name: 'Plain card', description: 'Not designed yet' }];
function load() {
  const host = { listeners: {}, design: null, saves: 0, renders: 0, redraws: 0, notices: [], dom: { modal: { open: false }, 've-error': { textContent: '' }, content: { scrollTop: 0 } } };
  host.project = { get design() { return host.design; }, set design(v) { host.design = v; } };
  const ctx = vm.createContext({ host, setTimeout });
  vm.runInContext(shared + '\n' + helpers + '\n' + stubs + '\n' + concept, ctx, { filename: 'concept-visual-component-editor.js' });
  const search = { id: 'vc-1', libraryId: 'search-field', exportName: 'SearchField', description: 'Search input', props: [{ name: 'query', type: 'string', required: false }], slots: [{ name: 'actions', required: false }], emits: [{ name: 'search', payloadType: 'string' }], variants: [], scenarios: [],
    template: [ctx.visualNuxt('vn-2', 'u-input', { placeholder: lit('Search') }, { name: 'Search input' })] };
  const child = ctx.visualProject('vn-5', 'vc-1', { name: 'Search', props: { query: { kind: 'prop', name: 'filter' } } });
  const toolbar = { id: 'vc-3', libraryId: 'toolbar', exportName: 'Toolbar', description: 'Customer toolbar', props: [{ name: 'filter', type: 'string', required: false }], slots: [], emits: [{ name: 'filtered', payloadType: 'string' }], variants: [], scenarios: [],
    template: [ctx.visualElement('vn-4', 'div', { name: 'Bar', children: [child] })] };
  const page = { id: 'vp-6', ownerId: 'surface-a', name: 'Customers', root: [ctx.visualProject('vn-7', 'vc-3', { name: 'Toolbar', props: { filter: lit('open') }, events: [{ id: 'vi-8', event: 'filtered', label: 'Filter changed', actions: [], notes: '', acceptance: '' }] })], scenarios: [], notes: '' };
  host.design = ctx.realm({ schema: 6, nodes: surfaces, library, dataSources: { sources: [] }, revision: 1, history: [], future: [], visualDesigns: { ...ctx.emptyVisualDesigns(), nextId: 9, pages: [page], components: [search, toolbar] } });
  ctx.validateVisualDesigns(host.design.visualDesigns, ctx.veContext(host.design));
  Object.assign(ctx.ui(), { library: 'toolbar' });
  return ctx;
}
const plain = value => JSON.parse(JSON.stringify(value));
const el = (field, key, value, extra = {}) => ({ dataset: { field, key, ...extra.dataset }, value, type: extra.type ?? 'text', tagName: extra.tagName ?? 'INPUT', checked: extra.checked, closest: extra.closest });
const component = (ctx, id) => ctx.veStore().components.find(c => c.id === id);
const snapshot = ctx => JSON.stringify(ctx.host.design.visualDesigns);

test('[VISUAL-COMPONENT] the editor view: structure, insert child, canvas modes, contract inspector and review', () => {
  const ctx = load();
  const html = ctx.veComponentEditorView();
  for (const marker of ['data-action="ve-select-root"', 'data-action="ve-deps"', 'data-action="ve-publish"', 'data-field="ve-variant"', 'data-field="ve-state"', 'data-value="compare"', 'role="tree"', 'Public API', 'data-action="ve-contract-tab" data-value="dependencies"', '1 child component', 'No cycles', 'Generator ready'])
    assert.ok(html.includes(marker), marker);
  assert.equal(ctx.ui().ref.kind, 'component');
  ctx.ui().mode = 'compare';
  assert.equal(ctx.veComponentEditorView().match(/class="ve-compare-cell"/g).length, 5, 'Default variant in every state');
  ctx.handleVisualAction('ve-mode', 'design'); ctx.handleVisualAction('ve-variant-add');
  ctx.ui().mode = 'compare';
  assert.equal(ctx.veComponentEditorView().match(/class="ve-compare-cell"/g).length, 10, 'each variant × state');
  ctx.ui().mode = 'design';
  ctx.handleVisualAction('ve-select', 'vn-5');
  const child = ctx.veComponentEditorView();
  assert.match(child, /data-action="ve-open-definition" data-value="vc-1"/);
  assert.match(child, /<option value="prop" selected>Parent prop<\/option>/, 'the query prop is bound to a parent prop');
  assert.match(child, /data-inspected="vn-5"/);
});

test('[VISUAL-COMPONENT] Insert child: the component itself is excluded and cycle candidates are disabled with the reason', () => {
  const ctx = load();
  Object.assign(ctx.ui(), { library: 'search-field', left: 'insert', insertTab: 'project' });
  ctx.veSyncComponent();
  const html = ctx.veInsertHtml('component');
  assert.match(html, /aria-pressed="true">Project<\/button>.*Nuxt UI.*Basic/s);
  assert.ok(!html.includes('project:vc-1'), 'the component itself is not offered');
  assert.match(html, /<strong>Toolbar<\/strong><span id="ve-why-project_vc-3">Would create a cycle<\/span><\/div><div class="ve-insert-actions"><button type="button" class="btn small" data-action="ve-insert" data-value="project:vc-3" disabled aria-describedby="ve-why-project_vc-3">/);
  assert.match(html, /Plain card<\/strong><span[^>]*>Design it in the component editor first\./);
  const before = snapshot(ctx);
  ctx.handleVisualAction('ve-insert', 'project:vc-3');
  assert.match(ctx.ui().error, /^Component cycle: /, 'a forced insert is refused by validation');
  assert.equal(snapshot(ctx), before, 'nothing was written');
  ctx.ui().insertTab = 'basic';
  const basic = ctx.veInsertHtml('component');
  for (const tag of ['div', 'section', 'header', 'main', 'span', 'p', 'h2']) assert.ok(basic.includes('data-value="element:' + tag + '"'), tag);
  assert.match(basic, /data-value="slot"/);
  assert.match(basic, /<span id="ve-why-external_">Declare a dependency first<\/span>.*data-value="external:" disabled/s);
});

test('[VISUAL-COMPONENT] contract edits go through visualSetContract; breaking edits show the refusal and change nothing', () => {
  const ctx = load(), history = () => ctx.host.design.history.length;
  const rename = el('ve-contract-row', 'name', 'term', { dataset: { list: 'props', index: '0' } });
  let before = snapshot(ctx);
  assert.equal(ctx.veFieldEdit(rename), true, 'typing keeps a draft');
  assert.equal(snapshot(ctx), before);
  ctx.veFieldEdit(rename, true);
  assert.equal(ctx.ui().error, 'This contract change breaks Customers / Toolbar: prop filter.');
  assert.equal(ctx.host.dom['ve-error'].textContent, ctx.ui().error, 'the refusal lands in the inspector alert region');
  assert.equal(snapshot(ctx), before); assert.equal(history(), 0);
  ctx.handleVisualAction('ve-contract-add', 'props');
  assert.deepEqual(plain(component(ctx, 'vc-3').props[1]), { name: 'newProp', type: 'string', required: false });
  before = snapshot(ctx);
  ctx.veFieldEdit(el('ve-contract-row', 'required', '', { type: 'checkbox', checked: true, dataset: { list: 'props', index: '1' } }));
  assert.equal(ctx.ui().error, 'This contract change breaks Customers / Toolbar: required prop newProp.');
  assert.equal(snapshot(ctx), before);
  ctx.veFieldEdit(el('ve-contract-row', 'type', 'boolean', { tagName: 'SELECT', dataset: { list: 'props', index: '1' } }));
  ctx.veFieldEdit(el('ve-contract-row', 'default', 'true', { tagName: 'SELECT', dataset: { list: 'props', index: '1' } }));
  assert.deepEqual(plain(component(ctx, 'vc-3').props[1]), { name: 'newProp', type: 'boolean', required: false, default: true });
  ctx.handleVisualAction('ve-contract-remove', 'emits:0');
  assert.equal(ctx.ui().error, 'This contract change breaks Customers / Toolbar: event filtered.', 'emits still used by an instance are refused');
  ctx.handleVisualAction('ve-contract-add', 'slots'); ctx.handleVisualAction('ve-contract-add', 'emits');
  assert.deepEqual(plain(component(ctx, 'vc-3').slots), [{ name: 'newSlot', required: false }]);
  assert.deepEqual(plain(component(ctx, 'vc-3').emits.map(e => e.name)), ['filtered', 'newEvent']);
  ctx.veFieldEdit(el('ve-contract', 'exportName', 'bad name'), true);
  assert.match(ctx.ui().error, /export name must be a unique PascalCase Vue name/);
  assert.equal(history(), 5, 'one undo entry per accepted write');
  ctx.ui().mode = 'preview'; before = snapshot(ctx);
  ctx.handleVisualAction('ve-contract-add', 'props');
  assert.equal(ctx.ui().error, 'Preview is read-only. Switch to Design to change the component.');
  assert.equal(snapshot(ctx), before);
  assert.match(ctx.veContractHtml(component(ctx, 'vc-3')), /<fieldset class="ve-inspector-body" disabled/);
});

test('[VISUAL-COMPONENT] child composition: parent prop, emit mapping, local action and slot content', () => {
  const ctx = load();
  ctx.handleVisualAction('ve-select', 'vn-5');
  ctx.veFieldEdit(el('ve-child-kind', 'query', 'literal', { tagName: 'SELECT', closest: () => ({ dataset: { inspected: 'vn-5' } }) }));
  const node = () => ctx.visualLocate(component(ctx, 'vc-3').template, 'vn-5').node;
  assert.equal(node().props.query, undefined, 'optional props fall back to their default');
  ctx.veFieldEdit(el('ve-child-kind', 'query', 'prop', { tagName: 'SELECT' }));
  assert.deepEqual(plain(node().props.query), { kind: 'prop', name: 'filter' });
  ctx.veFieldEdit(el('ve-child-emit', 'search', 'filtered', { tagName: 'SELECT' }));
  assert.deepEqual(plain(node().events.map(i => ({ event: i.event, actions: i.actions }))), [{ event: 'search', actions: [{ kind: 'emit', event: 'filtered', payload: { kind: 'event' } }] }]);
  ctx.ui().childTab = 'events';
  assert.match(ctx.veComponentEditorView(), /Emit filtered on search/);
  ctx.handleVisualAction('ve-child-local', 'click');
  assert.equal(ctx.modal().type, 've-interaction'); assert.equal(ctx.ui().interactionForm.record.event, 'click');
  ctx.handleVisualAction('ve-map-slot', 'actions');
  assert.deepEqual(plain(ctx.ui().slotTarget), { nodeId: 'vn-5', slot: 'actions' });
  ctx.handleVisualAction('ve-insert', 'element:p');
  const [text] = node().slots.actions;
  assert.deepEqual(plain({ kind: text.kind, role: text.role }), { kind: 'text', role: 'p' });
  assert.equal(ctx.ui().slotTarget, null, 'the slot target is used once');
  ctx.ui().selected = null; ctx.handleVisualAction('ve-insert', 'slot');
  assert.deepEqual(plain(component(ctx, 'vc-3').slots), [{ name: 'default', required: false }], 'a public slot declares its slot in the same write');
});

test('[VISUAL-COMPONENT] dependencies: inline validator messages, external insert with adapter prompt, used package refused', () => {
  const ctx = load(), before = snapshot(ctx);
  ctx.veFieldEdit(el('ve-dep-form', 'package', '@tiptap/vue-3')); ctx.veFieldEdit(el('ve-dep-form', 'version', '^2.11.5'));
  ctx.handleVisualAction('ve-dependency-add');
  assert.equal(ctx.ui().depForm.error, 'Component "Toolbar": @tiptap/vue-3 needs an exact version such as 1.2.3, not "^2.11.5".');
  assert.equal(snapshot(ctx), before, 'a range is not written');
  ctx.ui().contractTab = 'dependencies';
  assert.match(ctx.veContractHtml(component(ctx, 'vc-3')), /id="ve-dep-error" class="error" role="alert" tabindex="-1">Component &quot;Toolbar&quot;: @tiptap\/vue-3 needs an exact version/);
  ctx.veFieldEdit(el('ve-dep-form', 'package', 'Not A Package')); ctx.veFieldEdit(el('ve-dep-form', 'version', '2.11.5'));
  ctx.handleVisualAction('ve-dependency-add');
  assert.match(ctx.ui().depForm.error, /"Not A Package" is not an npm package name/);
  ctx.veFieldEdit(el('ve-dep-form', 'package', '@tiptap/vue-3')); ctx.veFieldEdit(el('ve-dep-form', 'purpose', 'Rich text'));
  ctx.handleVisualAction('ve-dependency-add');
  assert.deepEqual(plain(component(ctx, 'vc-3').dependencies), [{ package: '@tiptap/vue-3', version: '2.11.5', purpose: 'Rich text' }]);
  assert.equal(ctx.ui().depForm, null);
  ctx.handleVisualAction('ve-select', 'vn-4');
  ctx.handleVisualAction('ve-insert', 'external:@tiptap/vue-3');
  assert.equal(ctx.modal().type, 've-external'); assert.equal(ctx.ui().externalForm.adapter, 'tiptap-vue-3');
  ctx.veFieldEdit(el('ve-external', 'adapter', 'Rich Text')); ctx.handleVisualAction('ve-external-confirm');
  assert.match(ctx.ui().externalForm.error, /adapter name must be lowercase kebab-case/, 'the dialog shows the validator message');
  ctx.veFieldEdit(el('ve-external', 'adapter', 'rich-text')); ctx.handleVisualAction('ve-external-confirm');
  const external = component(ctx, 'vc-3').template[0].children[1];
  assert.deepEqual(plain(external), { id: 'vn-9', kind: 'external', package: '@tiptap/vue-3', adapter: 'rich-text', props: {}, events: [] });
  assert.equal(ctx.ui().selected, 'vn-9'); assert.equal(ctx.modal().original, null);
  const info = plain(ctx.veReviewFindings(ctx.veStore(), { kind: 'component', id: 'vc-3' })).filter(f => f.severity === 'info');
  assert.deepEqual(info, [{ severity: 'info', text: 'Adapter rich-text must be implemented in code.', nodeId: 'vn-9' }]);
  ctx.veFieldEdit(el('ve-child-add-prop', 'add', 'content'), true);
  assert.deepEqual(plain(ctx.visualLocate(component(ctx, 'vc-3').template, 'vn-9').node.props), { content: { kind: 'literal', value: null } });
  const kept = snapshot(ctx);
  ctx.handleVisualAction('ve-dependency-remove', '@tiptap/vue-3');
  assert.equal(ctx.ui().error, 'Still used by adapter "rich-text". Remove those external elements first.');
  assert.equal(snapshot(ctx), kept);
});

test('[VISUAL-COMPONENT] publish: next patch prefilled, usages listed, confirmation required, nested children published first', () => {
  const ctx = load();
  ctx.handleVisualAction('ve-publish');
  assert.equal(ctx.ui().publishForm.version, '1.0.0');
  assert.match(ctx.vePublishDialog(), /Usages affected · 1.*Page Customers \/ Toolbar · live, follows the component/s);
  ctx.handleVisualAction('ve-publish-confirm');
  assert.equal(ctx.ui().publishForm.error, 'Confirm that you reviewed the usages before publishing.');
  ctx.veFieldEdit(el('ve-publish', 'confirm', '', { type: 'checkbox', checked: true }));
  ctx.handleVisualAction('ve-publish-confirm');
  assert.equal(ctx.ui().publishForm.error, 'Publish SearchField first.');
  assert.equal(ctx.veStore().revisions.length, 0);
  ctx.host.dom.modal.open = false;
  ctx.handleVisualAction('ve-open-definition', 'vc-1');
  assert.equal(ctx.ui().library, 'search-field'); assert.equal(ctx.ui().back.at(-1).library, 'toolbar');
  ctx.handleVisualAction('ve-publish');
  ctx.veFieldEdit(el('ve-publish', 'confirm', '', { type: 'checkbox', checked: true }));
  ctx.handleVisualAction('ve-publish-confirm');
  assert.deepEqual(plain(ctx.veStore().revisions.map(r => [r.componentId, r.version])), [['vc-1', '1.0.0']]);
  assert.equal(ctx.modal().type, ''); assert.equal(ctx.modal().original, null);
  ctx.handleVisualAction('ve-publish');
  assert.equal(ctx.ui().publishForm.version, '1.0.1', 'the next patch after the latest revision');
  ctx.host.dom.modal.open = false;
  ctx.handleVisualAction('ve-back');
  assert.equal(ctx.ui().library, 'toolbar');
  assert.match(ctx.veDepsDialog(), /Uses components · 1.*SearchField · live as Search.*Used by · 1.*Page Customers \/ Toolbar · live/s);
});

test('[VISUAL-COMPONENT] customize as component seeds the contract from the primitive and opens it; library entries open or start', () => {
  const ctx = load();
  Object.assign(ctx.view(), { view: 'page-editor' }); Object.assign(ctx.ui(), { library: null, owner: 'surface-a' });
  ctx.handleVisualAction('ve-customize', 'u-button');
  const lib = ctx.host.design.library.at(-1), created = ctx.veStore().components.at(-1), entry = ctx.visualCatalogEntry('u-button');
  assert.deepEqual(plain({ id: lib.id, name: lib.name, origin: lib.origin, status: lib.status }), { id: 'app-button', name: 'AppButton', origin: 'project', status: 'draft' });
  assert.deepEqual(plain({ libraryId: created.libraryId, exportName: created.exportName, implementation: created.implementation }), { libraryId: 'app-button', exportName: 'AppButton', implementation: { catalog: 'nuxt-ui', entryId: 'u-button' } });
  assert.deepEqual(plain(created.props.map(p => p.name)), plain(entry.props.filter(p => ['string', 'number', 'boolean'].includes(p.type)).map(p => p.name)));
  assert.deepEqual(plain(created.slots.map(s => s.name)), plain(entry.slots.map(s => s.name)));
  assert.ok(created.template[0].ref.entryId === 'u-button' && Object.values(created.template[0].props).every(v => v.kind === 'prop'), 'the primitive binds every prop');
  assert.equal(ctx.view().view, 'component-editor'); assert.equal(ctx.ui().library, 'app-button'); assert.equal(ctx.ui().back.at(-1).view, 'page-editor');
  assert.equal(ctx.host.design.history.length, 1, 'library entry and component are one undo step');
  assert.match(ctx.veComponentEditorView(), /Component editor · Customized UButton/);
  ctx.handleVisualAction('ve-customize', 'u-button');
  assert.equal(ctx.veStore().components.at(-1).exportName, 'AppButton2');
  ctx.handleVisualAction('ve-open-component', 'plain-card');
  assert.equal(ctx.ui().library, 'plain-card');
  const revision = ctx.host.design.revision;
  assert.match(ctx.veComponentEditorView(), /data-action="ve-start-component" data-value="plain-card"/);
  assert.equal(ctx.host.design.revision, revision, 'opening does not write');
  ctx.handleVisualAction('ve-start-component', 'plain-card');
  assert.deepEqual(plain(ctx.veStore().components.at(-1)), { id: ctx.veStore().components.at(-1).id, libraryId: 'plain-card', exportName: 'PlainCard', description: 'Not designed yet', props: [], slots: [], emits: [], variants: [], template: [], scenarios: [] });
  assert.equal(ctx.ui().insertTab, 'basic');
});

test('[VISUAL-COMPONENT] contract text fields commit once on change; the redraw waits until focus has moved', async () => {
  const ctx = load(), renders = ctx.host.renders;
  const input = ctx.field({ dataset: { field: 've-contract', key: 'description' }, value: 'Filters customers', type: 'textarea', tagName: 'TEXTAREA' });
  ctx.veFieldEdit(input);
  assert.equal(component(ctx, 'vc-3').description, 'Customer toolbar', 'typing keeps a draft');
  ctx.fire('change', { target: input });
  assert.equal(component(ctx, 'vc-3').description, 'Filters customers');
  assert.equal(ctx.host.design.history.length, 1);
  assert.equal(ctx.host.renders, renders, 'no redraw yet, so a Tab or click that ended the edit keeps its target');
  await new Promise(resolve => setTimeout(resolve));
  assert.equal(ctx.host.renders, renders + 1);
});
// A published revision of another component pins this one: it is a usage (listed as pinned and unchanged) that blocks
// deleting the design by name, while the library "Used in" list keeps naming only page and component designs.
test('[VISUAL-COMPONENT] published revisions that pin a component are listed usages and block deleting it', () => {
  const ctx = load();
  ctx.veCommit(store => { ctx.visualPublish(store, 'vc-1', '1.0.0'); ctx.visualPublish(store, 'vc-3', '1.0.0'); });
  const search = component(ctx, 'vc-1');
  assert.deepEqual(plain(ctx.veUsageRows(ctx.veStore(), search)).map(u => [u.where, u.pinned?.version ?? null]), [['Component Toolbar / Search', null], ['Revision Toolbar v1.0.0 / Search', '1.0.0']]);
  assert.deepEqual(plain(ctx.veLibraryUses('search-field')).map(u => u.label), ['Component Toolbar']);
  ctx.veCommit(store => { ctx.visualDefinition(store, { kind: 'component', id: 'vc-3' }).template = []; });
  const plan = ctx.veDeletePlan({ target: 'definition', kind: 'component', definitionId: 'vc-1', nodeId: null });
  assert.equal(plan.refusal, 'SearchField is used by Toolbar v1.0.0. Remove those instances first.');
});
// Start design derives the export name from the library name and skips reserved names (Vue built-ins, generated types,
// Nuxt UI components) exactly like the migration does, so a library entry called "Error" or "UButton" can be designed.
test('[VISUAL-COMPONENT] start design never picks a reserved export name', () => {
  const ctx = load();
  ctx.host.design.library.push(...ctx.realm([{ id: 'error-panel', name: 'Error', description: '' }, { id: 'u-button-wrap', name: 'U button', description: '' }]));
  ctx.veStartComponent('error-panel'); ctx.veStartComponent('u-button-wrap');
  assert.deepEqual(plain(ctx.veStore().components.slice(-2).map(c => c.exportName)), ['Error2', 'UButton2']);
});
