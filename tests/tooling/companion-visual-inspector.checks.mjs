// Page inspector, field conversion, interaction builder, review findings and Project health over the real shared
// contracts and the real ve-* sources in one realm (as build-companion.py inlines them). Host persistence, rendering and
// modal plumbing are the only stubs; every write runs through the real veCommit with validation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const visualModules = ['ir', 'mapping', 'catalog', 'composition', 'validate', 'layout', 'commands', 'session', 'migrate'].map(n => 'visual/visual-' + n + '.mjs');
const contracts = ['composition-contract.mjs', 'detail-contract.mjs', ...visualModules];
const shared = (await Promise.all(contracts.map(name => readFile('scripts/companion/' + name, 'utf8')))).join('\n').split('\n')
  .filter(line => !line.startsWith('import ')).join('\n').replaceAll('export const ', 'const ').replaceAll('export function ', 'function ');
const base = (await readFile('docs/concepts/companion/src/base.html', 'utf8')).split('\n');
const helpers = ['function esc(', 'function icon(', 'function button(', 'function badge(', 'function modalHeader(', 'function dialogBody('].map(prefix => {
  const lines = base.filter(line => line.startsWith(prefix));
  assert.equal(lines.length, 1, prefix + ' is one line of base.html');
  return lines[0];
}).join('\n');
const files = ['ui-fields.js', 'data-source-model.js', 've-state.js', 've-catalog-preview.js', 've-canvas.js', 've-outline.js', 've-insert.js', 've-layouts.js', 've-fields.js', 've-review.js', 've-interactions.js', 've-page-inspector.js', 've-contract.js', 've-child-inspector.js', 've-publish.js', 've-component-views.js', 've-page-views.js', 've-actions.js'];
const concept = (await Promise.all(files.map(name => readFile('docs/concepts/companion/src/' + name, 'utf8')))).join('\n');
const stubs = `const ICONS = {}; const state = { settings: { theme: 'light' }, view: 'page-editor', activeRun: false };
let storageWarning = '', persistenceSnapshot = null, modalType = '', modalOriginal = 'unsaved';
const STORAGE_KEY = 'concept', COMPANION_VERSION = 5, DESIGN_LIMITS = { history: 50 }, designUi = {}, tdUi = { busy: false };
const localStorage = { getItem: () => null };
class Element {}
const document = { addEventListener(type, fn, options) { (host.listeners[type] ??= []).push({ fn, once: !!options?.once }); }, getElementById: id => host.dom[id] ?? null };
// Dispatch a document event to the registered listeners (once-listeners are removed), as the browser would.
function fire(type, event = {}) { const list = host.listeners[type] ?? []; host.listeners[type] = list.filter(l => !l.once); for (const l of list) l.fn(event); }
function field(props) { return Object.assign(new Element(), props); }
function design() { return host.design; } function project() { return host.project; }
function structuredClone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); } // Realm-local, so copies keep this realm's prototypes.
function smToken() { return 'rev-' + host.design.revision; } function designCopy(v) { return structuredClone(v); }
function designSnapshot(d) { return { visualDesigns: d.visualDesigns }; } function validSavedDesign() { return true; }
function saveConceptState() { host.saves++; return true; } function render() { host.renders++; } function notify(text) { host.notices.push(text); }
function showModal(type) { modalType = type; host.dom.modal.open = true; } function closeModal() { modalType = ''; host.dom.modal.open = false; }
function redrawModal() { host.redraws++; } function realm(v) { return JSON.parse(JSON.stringify(v)); }
function ui() { return veUi; } function modal() { return { type: modalType, original: modalOriginal }; }`;
const lit = value => ({ kind: 'literal', value });
const output = { mode: 'fields', entity: null, many: true, fields: [{ name: 'name', type: 'string', required: true }, { name: 'email', type: 'string', required: false }], schema: null };
const sources = [{ id: 'ds-source-1', name: 'Customers API', operations: [{ id: 'ds-operation-2', name: 'List customers', direction: 'read', output }, { id: 'ds-operation-3', name: 'Create customer', direction: 'write', output: { mode: 'none', entity: null, many: false, fields: [], schema: null } }] }];
const surfaces = [{ id: 'surface-a', kind: 'page', label: 'Customers' }, { id: 'surface-b', kind: 'modal', label: 'Edit customer' }];
function load() {
  const host = { listeners: {}, design: null, saves: 0, renders: 0, redraws: 0, notices: [], dom: { modal: { open: false }, 've-error': { textContent: '' } } };
  host.project = { get design() { return host.design; }, set design(v) { host.design = v; } };
  const ctx = vm.createContext({ host, setTimeout });
  vm.runInContext(shared + '\n' + helpers + '\n' + stubs + '\n' + concept, ctx, { filename: 'concept-visual-inspector.js' });
  const n = (id, entryId, props = {}, extra = {}) => ctx.visualNuxt(id, entryId, props, extra);
  const field = n('vn-6', 'u-form-field', { label: lit('Email') }, { name: 'Email field' }); field.slots.default = [n('vn-7', 'u-input', {}, { name: 'Email' })];
  const button = n('vn-2', 'u-button', { label: lit('Save') }, { name: 'Save button', events: [{ id: 'vi-3', event: 'click', label: 'Save record', actions: [], notes: '', acceptance: 'Legacy note' }] });
  const loading = ctx.visualElement('vn-10', 'div', { name: 'Loading panel', visibleIn: ['loading'], children: [ctx.visualText('vn-11', 'Loading…', 'p')] });
  const section = ctx.visualElement('vn-1', 'section', { name: 'Main', layout: ctx.visualLayoutRules('stack'), children: [button, ctx.visualElement('vn-4', 'img', { name: 'Hero image' }), n('vn-5', 'u-input', { placeholder: lit('Find') }, { name: 'Search' }), field, n('vn-8', 'u-table', {}, { name: 'Customer table' }), loading] });
  const page = { id: 'vp-9', ownerId: 'surface-a', name: 'Customers', root: [section, ctx.visualText('vn-12', 'Footer', 'p', { name: 'Footer' })], scenarios: [], notes: '' };
  host.design = ctx.realm({ schema: 5, nodes: surfaces, library: [], dataSources: { sources }, revision: 1, history: [], future: [], visualDesigns: { ...ctx.emptyVisualDesigns(), nextId: 13, pages: [page] } });
  ctx.validateVisualDesigns(host.design.visualDesigns, ctx.veContext(host.design));
  Object.assign(ctx.ui(), { owner: 'surface-a', ref: { kind: 'page', id: 'vp-9' }, selected: 'vn-2' });
  return ctx;
}
const node = (ctx, id) => ctx.visualLocate(ctx.veStore().pages[0].root, id).node;
const plain = value => JSON.parse(JSON.stringify(value));
// A form element as the shared field listener hands it over.
const el = (field, key, value, extra = {}) => ({ dataset: { field, key, ...extra.dataset }, value, type: extra.type ?? 'text', tagName: extra.tagName ?? 'INPUT', checked: extra.checked });

test('[VISUAL-INSPECTOR] review findings: implementation TODOs, labels, tables, alt text and nodes hidden in every scenario', () => {
  const ctx = load();
  const findings = plain(ctx.veReviewFindings(ctx.veStore(), { kind: 'page', id: 'vp-9' }));
  assert.deepEqual(findings, [
    { severity: 'warning', text: 'Implementation required: Save button → Save record', nodeId: 'vn-2' },
    { severity: 'warning', text: 'Hero image needs alternative text.', nodeId: 'vn-4' },
    { severity: 'warning', text: 'Search needs a label or accessibility notes.', nodeId: 'vn-5' },
    { severity: 'warning', text: 'Customer table has no data binding. Bind its data to a source operation.', nodeId: 'vn-8' },
    { severity: 'warning', text: 'Customer table has no empty state. Add a sibling shown only in the empty state.', nodeId: 'vn-8' },
    { severity: 'info', text: 'Loading panel is hidden in every scenario.', nodeId: 'vn-10' },
  ], 'the form-field label covers Email; the loading child is implied by its hidden parent');
  const html = ctx.veReviewHtml(ctx.veReviewFindings(ctx.veStore(), { kind: 'page', id: 'vp-9' }));
  assert.equal(html.match(/<button type="button" class="ve-finding ve-finding-warning" data-action="ve-select" data-value="vn-\d+"><svg/g).length, 5, 'each finding is a select button with icon and text');
  assert.match(html, /<span class="ve-sr">Info: <\/span><span>Loading panel is hidden in every scenario.<\/span>/);
  const store = ctx.veStore();
  store.pages[0].scenarios = ctx.realm([{ id: 'loading', name: 'Loading', state: 'loading', width: 'wide', values: {}, bindings: [] }]);
  const page = store.pages[0], table = node(ctx, 'vn-8');
  table.props.data = ctx.realm({ kind: 'source', sourceId: 'ds-source-1', operationId: 'ds-operation-2', field: '' });
  page.root[0].children.push(ctx.visualNuxt('vn-13', 'u-alert', ctx.realm({ title: lit('No customers') }), ctx.realm({ visibleIn: ['empty'] })));
  node(ctx, 'vn-4').attrs.alt = ctx.visualLiteral('Team photo'); node(ctx, 'vn-5').a11y = 'Searches customers by name'; store.nextId = 14;
  const texts = plain(ctx.veReviewFindings(store, { kind: 'page', id: 'vp-9' }).map(f => f.text));
  assert.deepEqual(texts, ['Implementation required: Save button → Save record', 'UAlert is hidden in every scenario.'], 'fixed issues disappear; a loading scenario shows the panel');
});

test('[VISUAL-INSPECTOR] review errors come from the complete validation and link to the element they name', () => {
  const ctx = load();
  node(ctx, 'vn-2').events[0].actions = [{ kind: 'navigate', surfaceId: 'surface-x' }];
  const [error] = plain(ctx.veReviewFindings(ctx.veStore(), { kind: 'page', id: 'vp-9' }));
  assert.deepEqual(error, { severity: 'error', text: 'Page "Customers" / Save button → Save record: navigation target is missing.', nodeId: 'vn-2' });
  assert.equal(ctx.veReadiness(ctx.veStore().pages[0]).ready, false);
  node(ctx, 'vn-2').events[0].actions = [];
  ctx.host.design.nodes = [surfaces[1]];
  const [owner] = plain(ctx.veReviewFindings(ctx.veStore(), { kind: 'page', id: 'vp-9' }));
  assert.deepEqual(owner, { severity: 'error', text: 'Page "Customers": owner surface is missing or already designed.', nodeId: null });
  assert.match(ctx.veReviewHtml([owner]), /class="ve-finding ve-finding-error" data-action="ve-health"/, 'a project-level error opens Project health');
});

test('[VISUAL-INSPECTOR] value conversion: numbers, enums, booleans and JSON with an inline parse error', () => {
  const ctx = load();
  assert.equal(ctx.veConvert('number', '12.5'), 12.5);
  assert.equal(ctx.veConvert('number', ''), undefined, 'an empty optional number falls back to the default');
  assert.throws(() => ctx.veConvert('number', 'abc', { label: 'rows' }), /^Error: rows must be a number\.$/);
  assert.throws(() => ctx.veConvert('number', ' ', { label: 'count', required: true }), /count needs a number/);
  assert.equal(ctx.veConvert('enum', 'ghost', { options: ['solid', 'ghost'] }), 'ghost');
  assert.equal(ctx.veConvert('enum', '', { options: ['solid'] }), undefined);
  assert.throws(() => ctx.veConvert('enum', 'huge', { label: 'variant', options: ['solid', 'ghost'] }), /^Error: variant must be one of solid, ghost\.$/);
  assert.equal(ctx.veConvert('boolean', true), true); assert.equal(ctx.veConvert('boolean', false), false);
  assert.deepEqual(plain(ctx.veConvert('json', '[{"header":"Name"}]')), [{ header: 'Name' }]);
  assert.equal(ctx.veConvert('json', '  '), undefined);
  assert.throws(() => ctx.veConvert('json', '[1,', { label: 'columns' }), /^Error: columns: the JSON is invalid\. /);
  assert.throws(() => ctx.veConvert('json', '{"__proto__":{"x":1}}', { label: 'columns' }), /^Error: columns: Unsafe fixture key\.$/);
  assert.equal(ctx.veConvert('string', ''), undefined); assert.equal(ctx.veConvert('string', '', { required: true }), '');
});

test('[VISUAL-INSPECTOR] veFieldEdit writes typed props through veCommit, keeps drafts while typing and refuses bad input', () => {
  const ctx = load(), history = () => ctx.host.design.history.length;
  const label = el('ve-prop', 'label', 'Save changes');
  assert.equal(ctx.veFieldEdit(label), true, 'a text draft is handled');
  assert.deepEqual(plain(node(ctx, 'vn-2').props.label), lit('Save'), 'typing does not write');
  assert.equal(ctx.veFieldEdit(label, true), true);
  assert.deepEqual(plain(node(ctx, 'vn-2').props.label), lit('Save changes')); assert.equal(history(), 1);
  ctx.veFieldEdit(el('ve-prop', 'variant', 'outline', { tagName: 'SELECT' }));
  assert.deepEqual(plain(node(ctx, 'vn-2').props.variant), lit('outline'), 'selects write at once');
  ctx.veFieldEdit(el('ve-prop', 'disabled', '', { type: 'checkbox', checked: true }));
  assert.deepEqual(plain(node(ctx, 'vn-2').props.disabled), lit(true));
  ctx.veFieldEdit(el('ve-prop', 'variant', '', { tagName: 'SELECT' }));
  assert.equal(node(ctx, 'vn-2').props.variant, undefined, 'Default removes the prop');
  const before = JSON.stringify(ctx.veStore()), writes = history();
  ctx.veFieldEdit(el('ve-prop', 'variant', 'huge', { tagName: 'SELECT' }));
  assert.match(ctx.ui().error, /variant must be one of solid, outline/);
  assert.equal(ctx.host.dom['ve-error'].textContent, ctx.ui().error, 'the error lands in the inspector alert region');
  ctx.ui().selected = 'vn-8';
  ctx.host.dom['ve-prop-columns-error'] = { textContent: '' };
  ctx.veFieldEdit(el('ve-prop', 'columns', '[{"header":', { tagName: 'TEXTAREA', dataset: { error: 've-prop-columns-error' } }), true);
  assert.match(ctx.host.dom['ve-prop-columns-error'].textContent, /^columns: the JSON is invalid\./, 'JSON errors show inline');
  assert.equal(JSON.stringify(ctx.veStore()), before, 'refused edits change nothing'); assert.equal(history(), writes);
  ctx.veFieldEdit(el('ve-prop', 'columns', '[{"accessorKey":"name","header":"Name"}]', { tagName: 'TEXTAREA' }), true);
  assert.deepEqual(plain(node(ctx, 'vn-8').props.columns), lit([{ accessorKey: 'name', header: 'Name' }]));
  ctx.ui().selected = 'vn-1';
  ctx.veFieldEdit(el('ve-layout', 'gap', '24'), true); ctx.veFieldEdit(el('ve-layout', 'narrow.hidden', '', { type: 'checkbox', checked: true }));
  assert.equal(node(ctx, 'vn-1').layout.ui.gap, 24); assert.equal(node(ctx, 'vn-1').layout.ui.narrow.hidden, true);
  ctx.veFieldEdit(el('ve-layout', 'gap', '500'), true);
  assert.match(ctx.ui().error, /Gap\/padding must be between 0 and 160 px/, 'validation still gates every write');
  ctx.veFieldEdit(el('ve-visible', 'loading', '', { type: 'checkbox', checked: false }));
  assert.deepEqual(plain(node(ctx, 'vn-1').visibleIn), ['default', 'empty', 'error', 'disabled']);
  ctx.veFieldEdit(el('ve-name', 'name', '  '), true);
  assert.equal(node(ctx, 'vn-1').name, undefined, 'a blank name falls back to the kind label');
});

test('[VISUAL-INSPECTOR] data bindings: Source → operation → field and Form value, then back to Literal', () => {
  const ctx = load();
  ctx.ui().selected = 'vn-8';
  ctx.veFieldEdit(el('ve-bind-kind', 'data', 'source', { tagName: 'SELECT' }));
  assert.deepEqual(plain(node(ctx, 'vn-8').props.data), { kind: 'source', sourceId: 'ds-source-1', operationId: 'ds-operation-2', field: '' }, 'read operations only');
  ctx.ui().inspector = 'data';
  const html = ctx.vePageInspectorHtml(ctx.veStore().pages[0], node(ctx, 'vn-8'));
  assert.match(html, /data-field="ve-bind-field" data-key="data"[^>]*><option value="" selected>Whole result<\/option><option value="name">name<\/option><option value="email">email<\/option>/);
  assert.doesNotMatch(html, /Create customer/, 'write operations are not offered for display bindings');
  ctx.veFieldEdit(el('ve-bind-field', 'data', 'name', { tagName: 'SELECT' }));
  assert.equal(node(ctx, 'vn-8').props.data.field, 'name');
  ctx.ui().selected = 'vn-12';
  ctx.veFieldEdit(el('ve-bind-kind', '@value', 'state', { tagName: 'SELECT' }));
  assert.deepEqual(plain(node(ctx, 'vn-12').value), { kind: 'state', nodeId: 'vn-5' }, 'text shows the first form control');
  ctx.veFieldEdit(el('ve-bind-state', '@value', 'vn-7', { tagName: 'SELECT' }));
  assert.equal(node(ctx, 'vn-12').value.nodeId, 'vn-7');
  ctx.veFieldEdit(el('ve-bind-kind', '@value', 'literal', { tagName: 'SELECT' }));
  assert.deepEqual(plain(node(ctx, 'vn-12').value), lit(''));
  ctx.ui().selected = 'vn-8';
  ctx.veFieldEdit(el('ve-bind-kind', 'data', 'literal', { tagName: 'SELECT' }));
  assert.equal(node(ctx, 'vn-8').props.data, undefined, 'optional props fall back to the catalog default');
  ctx.host.design.dataSources = { sources: [] };
  ctx.veFieldEdit(el('ve-bind-kind', 'data', 'source', { tagName: 'SELECT' }));
  assert.match(ctx.ui().error, /Declare a data source with a read operation first/);
});

test('[VISUAL-INSPECTOR] inspector markup: tabs, catalog-schema form, advanced layout, visibility; Preview is read-only', () => {
  const ctx = load(), page = () => ctx.veStore().pages[0];
  const button = ctx.vePageInspectorHtml(page(), node(ctx, 'vn-2'));
  assert.equal(button.match(/role="tab" /g).length, 3);
  assert.match(button, /aria-selected="true" data-action="ve-inspector" data-value="essentials">Essentials/);
  assert.match(button, /<select id="ve-prop-color" data-field="ve-prop" data-key="color"><option value="" selected>Default \(primary\)<\/option><option value="primary">/, 'enums are selects');
  assert.match(button, /<input type="checkbox" id="ve-prop-loading" data-field="ve-prop" data-key="loading" >/, 'booleans are checkboxes');
  assert.match(button, /id="ve-prop-label" data-field="ve-prop" data-key="label" type="text" value="Save"/);
  assert.equal(button.match(/data-field="ve-visible"/g).length, 5);
  for (const marker of ['data-action="ve-move" data-value="earlier"', 'data-action="ve-duplicate"', 'data-action="ve-wrap"', 'data-field="ve-a11y"', 'data-action="ve-health"']) assert.ok(button.includes(marker), marker);
  assert.match(ctx.vePageInspectorHtml(page(), node(ctx, 'vn-8')), /<textarea id="ve-prop-columns" data-field="ve-prop" data-key="columns" rows="3" spellcheck="false" data-error="ve-prop-columns-error"/, 'arrays are JSON textareas');
  const section = ctx.vePageInspectorHtml(page(), node(ctx, 'vn-1'));
  assert.match(section, /<details class="ve-advanced"><summary data-action="ve-advanced">Advanced<\/summary>[^]*data-key="widthMode"[^]*data-key="overflow"[^]*data-key="narrow.layout"[^]*data-key="tokens.gap"/);
  assert.match(section, /data-field="ve-tag"/);
  ctx.ui().inspector = 'actions';
  const actions = ctx.vePageInspectorHtml(page(), node(ctx, 'vn-2'));
  assert.match(actions, /Implementation required[^]*data-action="ve-interaction-edit" data-value="vi-3"[^]*data-action="ve-interaction-remove" data-value="vi-3"[^]*data-action="ve-interaction-add"/);
  ctx.ui().mode = 'preview';
  const preview = ctx.vePageInspectorHtml(page(), node(ctx, 'vn-2'));
  assert.match(preview, /<fieldset class="ve-inspector-body" data-inspected="vn-2" disabled aria-describedby="ve-preview-note">/);
  assert.match(preview, /role="tablist"[^]*<fieldset/, 'tabs stay usable outside the disabled fieldset');
  const before = JSON.stringify(ctx.veStore());
  ctx.veFieldEdit(el('ve-prop', 'label', 'Changed'), true);
  ctx.handleVisualAction('ve-duplicate', '');
  ctx.handleVisualAction('ve-interaction-remove', 'vi-3');
  assert.equal(JSON.stringify(ctx.veStore()), before, 'inspector writes are inert in Preview');
  assert.match(ctx.ui().error, /Preview is read-only/);
});

test('[VISUAL-INSPECTOR] interaction builder: navigate with acceptance, ordered actions, TODOs and refusals', () => {
  const ctx = load(), int = (key, value) => ctx.veFieldEdit(el('ve-int', key, value));
  const act = (index, key, value, extra = {}) => ctx.veFieldEdit(el('ve-act', key, value, { tagName: 'SELECT', ...extra, dataset: { index: String(index) } }));
  ctx.handleVisualAction('ve-interaction-add', '');
  assert.equal(ctx.modal().type, 've-interaction');
  assert.equal(ctx.ui().interactionForm.record.event, 'click', 'catalog emits come first');
  assert.match(ctx.veInteractionForm(), /data-field="ve-int" data-key="event"[^]*<option value="submit">/, 'DOM events are offered too');
  ctx.handleVisualAction('ve-interaction-save', '');
  assert.match(ctx.ui().interactionForm.error, /Give the interaction a label/);
  int('label', 'Open customer'); int('given', 'a saved customer'); int('when', 'I press Save'); int('then', 'the edit dialog opens');
  ctx.handleVisualAction('ve-act-add', ''); ctx.handleVisualAction('ve-act-add', '');
  act(0, 'surfaceId', 'surface-b'); act(1, 'kind', 'focus'); act(1, 'nodeId', 'vn-5');
  ctx.handleVisualAction('ve-act-move', '1:up');
  assert.deepEqual(plain(ctx.ui().interactionForm.record.actions.map(a => a.kind)), ['focus', 'navigate']);
  assert.match(ctx.veInteractionForm(), /data-action="ve-act-move" data-value="0:up"[^>]*disabled/);
  ctx.modal().original = null;
  ctx.handleVisualAction('ve-interaction-save', '');
  const saved = plain(node(ctx, 'vn-2').events.at(-1));
  assert.deepEqual(saved, { id: 'vi-13', event: 'click', label: 'Open customer', actions: [{ kind: 'focus', nodeId: 'vn-5' }, { kind: 'navigate', surfaceId: 'surface-b' }], notes: '', acceptance: 'Given a saved customer\nWhen I press Save\nThen the edit dialog opens' });
  assert.equal(ctx.modal().type, '', 'Save closes the dialog'); assert.equal(ctx.modal().original, null);
  assert.equal(ctx.ui().inspector, 'actions');
  ctx.handleVisualAction('ve-interaction-edit', 'vi-3');
  assert.equal(ctx.ui().interactionForm.given, 'Legacy note', 'free text acceptance opens as Given');
  int('label', 'Save the record');
  ctx.handleVisualAction('ve-act-add', ''); act(0, 'kind', 'emit'); act(0, 'mapping', 'value'); act(0, 'mappingValue', '{"id":', { tagName: 'TEXTAREA' });
  ctx.handleVisualAction('ve-interaction-save', '');
  assert.match(ctx.ui().interactionForm.error, /^Action 1 \(Emit an event\) payload: the JSON is invalid\./);
  act(0, 'mappingValue', '{"id":1}', { tagName: 'TEXTAREA' });
  ctx.handleVisualAction('ve-interaction-save', '');
  const edited = plain(node(ctx, 'vn-2').events[0]);
  assert.equal(edited.acceptance, 'Legacy note', 'untouched acceptance keeps its original text');
  assert.deepEqual(edited.actions, [{ kind: 'emit', event: 'activate', payload: { kind: 'value', value: { id: 1 } } }]);
  const findings = ctx.veReviewFindings(ctx.veStore(), { kind: 'page', id: 'vp-9' }).map(f => f.text);
  assert.ok(!findings.some(t => t.startsWith('Implementation required')), 'the TODO disappears once actions exist');
  ctx.handleVisualAction('ve-interaction-remove', 'vi-13');
  assert.deepEqual(plain(node(ctx, 'vn-2').events.map(i => i.id)), ['vi-3']);
  ctx.ui().selected = 'vn-12';
  ctx.handleVisualAction('ve-interaction-add', '');
  assert.match(ctx.ui().error, /Text · p has no interactions/);
});

test('[VISUAL-INSPECTOR] Project health lists every check and opens the export preview for the JSON', () => {
  const ctx = load();
  const checks = plain(ctx.veHealthChecks());
  assert.deepEqual(checks.map(c => [c[0], c[1]]), [['Full validation', true], ['Project schema', true], ['Nuxt UI catalog', true], ['Page references', true], ['Layouts', true], ['Component contracts', true], ['Component graph', true], ['Scenarios', true]]);
  assert.match(checks[2][2], /nuxt-ui v1 pinned · @nuxt\/ui 4\.11\.2/);
  const html = ctx.veHealthHtml();
  assert.match(html, /8 of 8 checks pass/); assert.match(html, /data-action="project-export"[^>]*>.*Inspect project JSON/);
  ctx.host.design.nodes = [surfaces[1]];
  const broken = plain(ctx.veHealthChecks());
  assert.deepEqual(broken.filter(c => !c[1]).map(c => c[0]), ['Full validation', 'Page references']);
  assert.match(broken[3][2], /owner surface is missing/);
  ctx.handleVisualAction('ve-health', '');
  assert.equal(ctx.modal().type, 've-health');
});

test('[VISUAL-INSPECTOR] text edits commit at once from the captured field; a pointer press keeps its click before the redraw', async () => {
  const ctx = load(), tick = () => new Promise(resolve => setTimeout(resolve, 5)), label = () => node(ctx, 'vn-2').props.label.value;
  const input = ctx.field({ dataset: { field: 've-prop', key: 'label' }, value: 'Renamed', type: 'text', tagName: 'INPUT', closest: () => ({ dataset: { inspected: 'vn-2' } }) });
  const renders = ctx.host.renders;
  ctx.fire('pointerdown'); ctx.fire('change', { target: input });
  assert.equal(label(), 'Renamed', 'the edit is saved when the field blurs');
  await tick();
  assert.equal(ctx.host.renders, renders, 'no redraw while the pointer is down, so the pressed target still receives its click');
  ctx.ui().selected = 'vn-5'; // the click selects another element on the current DOM
  ctx.fire('pointerup'); await tick();
  assert.equal(ctx.host.renders, renders + 1, 'one redraw after the pointer sequence');
  assert.equal(ctx.ui().selected, 'vn-5', 'the commit does not take the selection back');
  input.value = 'Again'; ctx.fire('change', { target: input });
  assert.equal(label(), 'Again', 'a later edit still targets the element the field was rendered for');
  await tick(); assert.equal(ctx.host.renders, renders + 2, 'keyboard commits redraw after focus has moved');
  const before = JSON.stringify(ctx.veStore());
  ctx.fire('change', { target: ctx.field({ dataset: { field: 've-name', key: 'name' }, value: 'Two' + String.fromCharCode(10) + 'lines', type: 'text', tagName: 'INPUT', closest: input.closest }) });
  assert.match(ctx.ui().error, /name must be a single line/); assert.equal(JSON.stringify(ctx.veStore()), before, 'a refused edit keeps the model');
});

test('[VISUAL-INSPECTOR] validation findings link by the contract node id, never to a same-named sibling', () => {
  const ctx = load(), store = ctx.veStore(), ref = { kind: 'page', id: 'vp-9' };
  const copy = ctx.visualDuplicateNode(store, ref, 'vn-2');
  assert.equal(copy.name, 'Save button', 'duplicates share the name');
  copy.props.label = ctx.realm({ kind: 'prop', name: 'title' });
  const [error] = plain(ctx.veReviewFindings(store, ref));
  assert.deepEqual(error, { severity: 'error', text: 'Page "Customers" / Save button :label: binds undeclared prop "title".', nodeId: copy.id });
  const RealmError = vm.runInContext('Error', ctx), page = store.pages[0], message = text => new RealmError('VISUAL_INVALID: ' + text);
  assert.equal(ctx.veFindingNode(page, message('Page "Customers" / Save button: something.')), null, 'an ambiguous name without a node id links nowhere');
  assert.equal(ctx.veFindingNode(page, message('Page "Customers" / Hero image: something.')), 'vn-4', 'a unique name still links');
  assert.equal(ctx.veFindingNode(page, Object.assign(new RealmError('x'), { nodeId: 'vn-99' })), null, 'a node of another definition links nowhere');
});
