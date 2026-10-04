// Shared realm for the visual editor entry and surface checks: the real shared contracts and ve-* sources in one
// realm, as build-companion.py inlines them. Host persistence, navigation, focus and modal plumbing are the only stubs;
// every write runs through the real veCommit with validation.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { conceptShared, visualModules } from '../support/concept-realm.mjs';
const shared = await conceptShared(['native-contract.mjs', 'composition-contract.mjs', ...visualModules]);
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
export const lit = value => ({ kind: 'literal', value });
const surfaces = [{ id: 'surface-a', kind: 'page', label: 'Customers' }, { id: 'surface-b', kind: 'modal', label: 'Edit customer' }];
const library = [{ id: 'search-field', name: 'SearchField', description: 'Search input' }, { id: 'toolbar', name: 'Toolbar', description: 'Customer toolbar' }, { id: 'plain-card', name: 'Plain card', description: '' }];
// Page Customers: Main section [Title, Customer table, Summary card {default: [Open button → focus Search box]}, Search box
// input], Footer, Toolbar instance. SearchField binds its query prop in a text, an emit payload and an external adapter.
export function load() {
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
  host.design = ctx.realm({ schema: 6, nodes: surfaces, library, dataSources: { sources: [] }, revision: 1, history: [], future: [], visualDesigns: { ...ctx.emptyVisualDesigns(), nextId: 30, pages: [page], components: [search, toolbar] } });
  ctx.validateVisualDesigns(host.design.visualDesigns, ctx.veContext(host.design));
  Object.assign(ctx.ui(), { owner: 'surface-a' });
  return ctx;
}
export const plain = value => JSON.parse(JSON.stringify(value));
export const snapshot = ctx => JSON.stringify(ctx.host.design.visualDesigns);
export const page = ctx => ctx.veStore().pages[0];
export const children = ctx => plain(page(ctx).root[0].children.map(n => n.id));
export const el = (field, key, value, extra = {}) => ({ dataset: { field, key }, value, type: extra.type ?? 'text', tagName: extra.tagName ?? 'INPUT' });
export function press(ctx, key, { where = 'outline', from = ctx.ui().selected, typing = false, inEditor = true, ...mods } = {}) {
  const hit = { '.ve-page-editor': inEditor, input: typing, '#ve-outline': where === 'outline', '.ve-canvas-area': where === 'canvas' };
  const target = ctx.field({ dataset: {}, getAttribute: () => null, closest: sel => (hit[Object.keys(hit).find(k => sel.startsWith(k))] ? { dataset: { value: from, veNode: from } } : null) });
  const event = { key, target, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, repeat: false, isComposing: false, prevented: false, preventDefault() { this.prevented = true; }, stopPropagation() {}, ...mods };
  ctx.fire('keydown', event);
  return event;
}
