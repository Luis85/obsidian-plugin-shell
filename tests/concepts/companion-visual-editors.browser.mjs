// Page and component editors end to end: real controls, keyboard-only paths, Back navigation and controlled failure
// fixtures on the exact assembled concept. Node Playwright (owner decision 2026-09-26); report contract identical to the
// Python suites: reports/concepts/visual-editors/checks.json with named checks, errors, requests, fatal and the HTML hash.
// page.evaluate is used for canonical-model readback and for labelled controlled fixtures (storage failures, forced
// commands, seeded storage); every authoring step goes through the editor's own controls.
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { failedUpgradeRecovery, surfaceRemovalAndOrphans, revisionSurfaceAndBlueprint } from './companion-visual-recovery-phases.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const HTML = ROOT + 'docs/concepts/companion/index.html', OUT = ROOT + 'reports/concepts/visual-editors', FIXTURES = ROOT + 'tests/fixtures/companion/';
const SCOPE = 'Actual browser controls and canonical model readback', HOSTILE = '<i id="ve-hostile"></i>"\'&';
mkdirSync(OUT, { recursive: true });
const html = readFileSync(HTML, 'utf8');
// In-memory storage adapter, optionally pre-seeded, installed before the concept script reads it.
const storage = (saved = {}) => `<script>window.__saved=${JSON.stringify(saved).replace(/</g, '\\u003c')};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__saved[k]??null,setItem:(k,v)=>{__saved[k]=v},removeItem:k=>delete __saved[k]}});</script>`;
const checks = [], errors = [], requests = [], hostile = {};
let fatal = null, page, browser, app = null, review = null, composed = null, legacyDesign = null;

function check(name, value, detail = '', scope = SCOPE) {
  checks.push({ name, result: value ? 'passed' : 'failed', scope });
  console.log((value ? 'PASS ' : 'FAIL ') + name);
  if (!value) throw new Error('Check failed: ' + name + (detail === '' ? '' : ' :: ' + JSON.stringify(detail).slice(0, 800)));
}
const js = (code, arg) => page.evaluate(code, arg);
const act = (action, value, scope = '#content') => page.locator(`${scope} [data-action="${action}"]${value === undefined ? '' : `[data-value=${JSON.stringify(value)}]`}`).first().click();
const navigate = view => act('nav', view, '#sidebar');
// Every load is a fresh page (a new window realm), so a reload really re-runs startup against the seeded storage.
async function load(saved = {}) {
  await page?.close(); page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }); page.setDefaultTimeout(7000);
  page.on('pageerror', error => errors.push(String(error))); page.on('request', request => requests.push(request.url()));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setContent(storage(saved) + html); await page.locator('#content').waitFor();
}
const idOf = name => js(n => visualNodes(visualRoot(veCurrentDef())).find(x => x.name === n)?.id ?? null, name);
const nodeOf = id => js(i => JSON.parse(JSON.stringify(visualLocate(visualRoot(veCurrentDef()), i)?.node ?? null)), id);
const ids = () => js(() => visualNodes(visualRoot(veCurrentDef())).map(n => n.id));
const exists = id => js(i => !!visualLocate(visualRoot(veCurrentDef()), i), id);
const siblingIndex = () => js(() => visualLocate(visualRoot(veCurrentDef()), veUi.selected)?.index ?? -1);
const parentOf = id => js(i => visualLocate(veCurrentPage().root, i).parent?.id ?? 'root', id);
const outlineItem = id => page.locator(`#ve-outline [role="treeitem"][data-value="${id}"]`);
const selectNode = id => outlineItem(id).locator(':scope > .ve-tree-row .ve-tree-label').click();
async function pick(name) { const id = await idOf(name); await selectNode(id); return id; }
async function commit(locator, value) { await locator.fill(value); await locator.press('Tab'); await page.waitForTimeout(80); }
const focused = () => js(() => ({ role: document.activeElement?.getAttribute('role'), value: document.activeElement?.dataset.value, action: document.activeElement?.dataset.action }));
const modalText = () => page.locator('#modal').innerText();
const opened = () => page.locator('#modal[open]').waitFor();
const closed = () => page.locator('#modal').waitFor({ state: 'hidden' });
async function escape() { const text = await modalText(); await page.keyboard.press('Escape'); await closed(); return text; }
const palette = async action => { await page.keyboard.press('Control+k'); await page.locator(`#palette-results [data-action="${action}"]`).click(); };
async function importFile(files) {
  await palette('project-import'); await page.locator('#project-import-file').setInputFiles(files);
  await page.locator('#project-import-confirm, #project-transfer-error:not(:empty)').first().waitFor();
}
async function applyImport() { await page.locator('#project-import-confirm').check(); await act('project-import-apply', undefined, '#modal'); await closed(); }
const noHorizontalScroll = () => js(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const noInjection = () => js(() => !document.getElementById('ve-hostile'));
const snapshot = () => js(() => JSON.stringify(design()));
const store = () => js(() => JSON.stringify(veStore()));
const component = () => js(() => JSON.parse(JSON.stringify(veCurrentComponent())));
const errorText = () => page.locator('#ve-error').innerText();
const toast = () => page.locator('#toasts').innerText();
const harness = { FIXTURES, check, js, act, navigate, load, toast, snapshot, opened, closed, escape, modalText, page: () => page };

async function legacyImportAndPages() {
  await importFile(FIXTURES + 'detail-v3.json');
  const report = await page.locator('#project-import-migration').innerText(), mapped = await page.locator('#project-import-interactions li').count();
  await applyImport();
  const migrated = await js(() => ({ schema: design().visualDesigns?.schema, legacy: 'detailDesigns' in design(), pages: veStore().pages.map(p => p.ownerId), components: veStore().components.map(c => c.libraryId), valid: validSavedDesign(design()) }));
  check('legacy v3 import migrates with report', report.includes('canvas positions dropped') && mapped > 0 && migrated.schema === 3 && !migrated.legacy && migrated.valid && migrated.pages.join() === 'node-48,node-27' && migrated.components.includes('project-json-review'), { report, mapped, migrated });
  await navigate('pages');
  const cards = await page.locator('.ve-page-card').count(), before = await snapshot();
  await act('ve-open-page', 'node-5');
  check('pages list opens editor; open without start does not write', cards === 26 && cards === await js(() => veSurfaces().length) && await js(() => state.view) === 'page-editor' && await page.locator('[data-action="ve-start-page"]').count() === 1 && before === await snapshot() && (await page.locator('#sidebar .nav-item.active').innerText()).includes('Pages'), { cards });
  const revision = await js(() => design().revision), history = await js(() => design().history.length);
  await act('ve-start-page', 'node-5');
  const start = await js(() => ({ pages: veStore().pages.filter(p => p.ownerId === 'node-5').map(p => p.root.length), total: veStore().pages.length, revision: design().revision, history: design().history.length, left: veUi.left }));
  check('start design creates exactly one page', start.pages.join() === '0' && start.total === 3 && start.revision === revision + 1 && start.history === history + 1 && start.left === 'insert', start);
}

async function insertAndLayouts() {
  await act('ve-insert-tab', 'patterns'); await act('ve-insert', 'recipe:recipe-crud-list');
  const order = await ids(), outline = await page.locator('#ve-outline [role="treeitem"]').evaluateAll(els => els.map(e => e.dataset.value));
  const canvas = await page.locator('.ve-frame [data-ve-node]').evaluateAll(els => els.map(e => e.dataset.veNode)), persisted = await js(() => JSON.stringify(veCurrentPage()));
  check('insert recipe CRUD list appears in outline and canvas in reading order', order.length > 5 && JSON.stringify(outline) === JSON.stringify(order) && JSON.stringify(canvas) === JSON.stringify(order) && !persisted.includes('recipe-') && await js(() => veUi.selected) === order[0], { order, outline, canvas });
  const nextId = await js(() => veStore().nextId);
  for (let i = 0; i < 2; i++) { await act('ve-left', 'layouts'); await act('ve-apply-layout', 'builtin-dashboard'); }
  const all = await ids(), after = await js(() => ({ nextId: veStore().nextId, dashboards: visualNodes(veCurrentPage().root).filter(n => n.name === 'Dashboard').length }));
  check('apply built-in layout twice keeps unique ids', new Set(all).size === all.length && all.every(id => /^vn-\d+$/.test(id)) && after.dashboards === 2 && after.nextId > nextId && Math.max(...all.map(id => Number(id.slice(3)))) < after.nextId && all.length >= order.length + 2, { all, after });
}

async function inspectorBindingsAndInteractions() {
  await act('ve-left', 'outline');
  const create = await pick('Create action'), label = page.locator('[data-field="ve-prop"][data-key="label"]');
  await label.fill('Add customer');
  const draft = (await nodeOf(create)).props.label.value;
  await label.press('Tab'); await page.waitForTimeout(80);
  const canvasText = await page.locator(`.ve-frame [data-ve-node="${create}"]`).innerText(), title = await idOf('Title');
  await page.locator('[data-field="ve-prop"][data-key="label"]').fill('Add record'); await page.locator(`.ve-frame [data-ve-node="${title}"]`).first().click();
  const clicked = { label: (await nodeOf(create)).props.label.value, selected: await js(() => veUi.selected) };
  check('inspector edits a catalog prop and canvas updates', draft === 'New record' && canvasText.includes('Add customer') && clicked.label === 'Add record' && clicked.selected === title, { draft, canvasText, clicked });
  await pick('Create action');
  const color = page.locator('select[data-field="ve-prop"][data-key="color"]'), isSelect = await color.count() === 1;
  await color.selectOption('success');
  check('enum prop uses select', isSelect && (await nodeOf(create)).props.color?.value === 'success');
  const table = await pick('Records table');
  await act('ve-bind', undefined, '.ve-selection-bar');
  const tab = await page.locator('.ve-pane-inspector [role="tab"][aria-selected="true"]').innerText();
  await page.locator('[data-field="ve-bind-kind"][data-key="data"]').selectOption('source');
  const data = (await nodeOf(table)).props.data, declared = await js(d => design().dataSources.sources.some(s => s.id === d.sourceId && s.operations.some(o => o.id === d.operationId && o.direction === 'read')), data);
  check('bind table data to source operation', tab === 'Data' && data?.kind === 'source' && declared && !(await page.locator('.ve-review').innerText()).includes('Records table has no data binding'), { tab, data });
  await pick('Create action'); await act('ve-interaction', undefined, '.ve-selection-bar'); await act('ve-interaction-add', undefined, '.ve-pane-inspector');
  // The native modal dialog makes the page inert: Tab cycles through the dialog (and the browser chrome), never the page.
  const stops = [];
  for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); stops.push(await js(() => document.activeElement?.closest('#modal') ? 'modal' : document.activeElement === document.body ? 'chrome' : 'page')); }
  await escape();
  const restored = await focused();
  check('interaction dialog traps focus and returns it to its opener', !stops.includes('page') && stops.filter(s => s === 'modal').length >= 3 && restored.action === 've-interaction-add', { stops, restored });
  await act('ve-interaction-add', undefined, '.ve-pane-inspector'); await page.locator('#ve-int-label').fill('Open customer');
  await act('ve-act-add', undefined, '#modal'); await page.locator('#ve-act-0-surfaceId').selectOption('node-3');
  await page.locator('#ve-int-given').fill('a customer list'); await page.locator('#ve-int-when').fill('I press Add record'); await page.locator('#ve-int-then').fill('the project overview opens');
  await act('ve-interaction-save', undefined, '#modal'); await closed();
  const saved = (await nodeOf(create)).events.at(-1);
  check('add interaction navigate with acceptance', saved?.label === 'Open customer' && JSON.stringify(saved.actions) === JSON.stringify([{ kind: 'navigate', surfaceId: 'node-3' }]) && saved.acceptance === 'Given a customer list\nWhen I press Add record\nThen the project overview opens' && (await page.locator('.ve-interactions').innerText()).includes('Navigate to Project overview'), saved);
  await act('ve-interaction-add', undefined, '.ve-pane-inspector'); await page.locator('#ve-int-label').fill('Export later');
  await act('ve-interaction-save', undefined, '#modal'); await closed();
  // The copy keeps the same name, so the findings can only link to the right element by node id.
  await act('ve-duplicate', undefined, '.ve-selection-bar');
  const copy = await js(() => veUi.selected), findings = page.locator('.ve-review .ve-finding', { hasText: 'Implementation required: Create action → Export later' }), count = await findings.count();
  await pick('Records table'); await findings.nth(1).click();
  const second = await js(() => veUi.selected);
  await findings.nth(0).click();
  check('empty-action interaction shows implementation-required finding', count === 2 && copy !== create && second === copy && await js(() => veUi.selected) === create, { count, copy, second });
}

async function keyboardOnly() {
  await act('ve-left', 'outline');
  const stop = page.locator('#ve-outline [role="treeitem"][tabindex="0"]'), stops = await stop.count(), order = await ids();
  await stop.focus();
  await page.keyboard.press('End'); const end = await js(() => veUi.selected);
  await page.keyboard.press('Home'); const home = await js(() => veUi.selected);
  await page.keyboard.press('ArrowDown'); const down = { selected: await js(() => veUi.selected), focus: await focused() };
  for (let i = 0; i < 30 && await siblingIndex() < 1; i++) await page.keyboard.press('ArrowDown');
  const target = await js(() => veUi.selected), at = await siblingIndex();
  await page.keyboard.press('Alt+ArrowUp'); const moved = { index: await siblingIndex(), focus: (await focused()).value };
  await page.keyboard.press('Control+d'); const copy = await js(() => veUi.selected), copyFocus = (await focused()).value;
  // IME composition cannot be typed through Playwright's keyboard; a composing keydown on the focused item stands in.
  await js(() => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', isComposing: true, bubbles: true })));
  const composing = await js(() => document.getElementById('modal').open);
  await page.keyboard.press('Delete'); await opened();
  const confirm = { ...await focused(), danger: await js(() => document.activeElement.classList.contains('danger')) }, dialog = await escape();
  const cancelled = { kept: await exists(copy), focus: await focused() };
  await page.keyboard.press('Backspace'); await opened(); await page.keyboard.press('Enter'); await closed();
  const deleted = { gone: !await exists(copy), focus: await focused(), selected: await js(() => veUi.selected) };
  await page.keyboard.press('Control+z'); const undone = await exists(copy);
  await page.keyboard.press('Control+y'); const redone = !await exists(copy);
  await page.keyboard.press('Control+Shift+z'); const noFuture = !await exists(copy) && (await toast()).includes('Nothing to redo');
  await page.keyboard.press('Escape'); const cleared = await js(() => veUi.selected);
  check('keyboard only: select, move earlier, duplicate, delete with confirmation, undo, redo', stops === 1 && end === order.at(-1) && home === order[0] && down.selected === order[1] && down.focus.value === order[1] && down.focus.role === 'treeitem'
    && at > 0 && moved.index === at - 1 && moved.focus === target && copy !== target && copyFocus === copy && !composing && dialog.includes('Deletes ') && dialog.includes('Undo restores it.') && confirm.action === 've-delete-confirm' && confirm.danger
    && cancelled.kept && cancelled.focus.value === copy && deleted.gone && deleted.focus.role === 'treeitem' && deleted.focus.value === deleted.selected && undone && redone && noFuture && cleared === null,
  { stops, end, home, down, at, moved, copy, copyFocus, composing, confirm, cancelled, deleted, undone, redone, noFuture, cleared });
}

async function moveTo() {
  const moving = await pick('Title'), before = await parentOf(moving);
  await act('ve-reparent', undefined, '.ve-inspector-body'); await opened();
  const offered = await page.locator('#modal [data-action="ve-reparent-confirm"]').evaluateAll(els => els.map(e => e.dataset.value));
  const expected = await js(i => veReparentCandidates(veCurrentPage(), i).map(c => c.value), moving), choice = offered.find(v => v !== 'root' && v.split('|')[0] !== before) ?? offered[0];
  await page.locator(`#modal [data-action="ve-reparent-confirm"][data-value="${choice}"]`).focus(); await page.keyboard.press('Enter'); await closed();
  const parent = await parentOf(moving);
  check('move to picker reparents without drag', offered.length > 0 && JSON.stringify(offered) === JSON.stringify(expected) && !offered.some(v => v.split('|')[0] === moving) && parent === choice.split('|')[0] && parent !== before && (await focused()).action === 've-reparent', { offered, expected, choice, parent, before });
}

async function layoutsAcrossPages() {
  await act('ve-left', 'layouts'); await act('ve-save-layout', 'page', '.ve-pane-left');
  await page.locator('#ve-layout-name').fill('Customer workspace'); await page.locator('#modal [data-action="close"]').first().click();
  const asked = await page.locator('#discard-dialog[open]').count() === 1;
  await page.locator('#discard-keep').click();
  const pageBefore = await js(() => JSON.stringify(veCurrentPage()));
  await act('ve-save-layout-confirm', undefined, '#modal'); await closed();
  const layout = await js(() => JSON.parse(JSON.stringify(veStore().layouts.at(-1)))), unchanged = pageBefore === await js(() => JSON.stringify(veCurrentPage()));
  await page.locator('select[data-field="ve-page-switch"]').selectOption('node-48');
  const switched = await js(() => ({ view: state.view, owner: veUi.owner, name: veCurrentPage()?.name })), before = await ids();
  await act('ve-left', 'layouts'); await act('ve-apply-layout', layout.id);
  const after = await ids(), added = after.filter(id => !before.includes(id));
  await page.locator('.ve-toolbar [data-action="ve-undo"]').click(); const undone = JSON.stringify(await ids()) === JSON.stringify(before);
  await page.keyboard.press('Control+k');
  const icons = await page.locator('#palette-results').evaluate(el => ['ve-undo', 've-redo'].map(a => el.querySelector(`[data-action="${a}"] svg path`)?.getAttribute('d') ?? null));
  check('palette Undo and Redo carry distinct icons', !!icons[0] && !!icons[1] && icons[0] !== icons[1], icons);
  await page.locator('#palette-search').fill('Redo design change');
  await page.locator('#palette-results [data-action="ve-redo"]').click(); await closed();
  const redone = JSON.stringify(await ids()) === JSON.stringify(after), size = await js(l => visualNodes(l.root).length, layout);
  const sourceIds = await js(() => visualNodes(veStore().pages.find(p => p.ownerId === 'node-5').root).map(n => n.id));
  check('save page as layout then apply to another page', asked && undone && redone && layout?.name === 'Customer workspace' && layout.scope === 'page' && unchanged && switched.view === 'page-editor' && switched.owner === 'node-48'
    && added.length === size && size > 5 && new Set(after).size === after.length && !added.some(id => sourceIds.includes(id)) && pageBefore === await js(() => JSON.stringify(veStore().pages.find(p => p.ownerId === 'node-5'))), { asked, layout: layout?.name, switched, added: added.length, undone, redone });
}

async function guardedWrites() {
  await act('ve-left', 'outline');
  const target = (await ids())[0];
  await selectNode(target);
  let before = await snapshot();
  await js(() => localStorage.setItem(STORAGE_KEY, 'foreign-window'));
  await act('ve-duplicate', undefined, '.ve-selection-bar');
  const conflict = { error: await errorText(), same: before === await snapshot(), selected: await js(() => veUi.selected) };
  await js(() => { localStorage.setItem(STORAGE_KEY, persistenceSnapshot); storageWarning = ''; window.__realSet = localStorage.setItem; localStorage.setItem = () => { throw Error('quota'); }; });
  await act('ve-duplicate', undefined, '.ve-selection-bar');
  const quota = { error: await errorText(), same: before === await snapshot(), selected: await js(() => veUi.selected) };
  await js(() => { storageWarning = ''; }); await outlineItem(target).focus(); await page.keyboard.press('Control+z');
  const travel = { error: await errorText(), same: before === await snapshot() };
  await js(() => { localStorage.setItem = window.__realSet; storageWarning = ''; save(); });
  check('veCommit and veTravel roll back storage conflicts and failed saves; selection changes only after success', conflict.error.startsWith('Resolve the storage conflict first') && conflict.same && conflict.selected === target
    && quota.error.startsWith('The change could not be saved') && quota.same && quota.selected === target && travel.error.startsWith('History could not be saved') && travel.same, { conflict, quota, travel }, 'Controlled storage-conflict and quota fixtures, real editor controls');
  await act('ve-interaction', undefined, '.ve-selection-bar'); await act('ve-interaction-add', undefined, '.ve-pane-inspector'); await page.locator('#ve-int-label').fill('Stale draft');
  await js(() => { design().revision++; save(); }); before = await snapshot();
  await act('ve-interaction-save', undefined, '#modal');
  const stale = { error: await page.locator('#ve-int-error').innerText(), open: await js(() => document.getElementById('modal').open), same: before === await snapshot(), draft: await page.locator('#ve-int-label').inputValue() };
  await page.locator('#modal [data-action="close"]').first().click(); await page.locator('#discard-confirm').click(); await closed();
  await act('ve-mode', 'preview'); before = await snapshot();
  const previewUndo = await page.locator('.ve-toolbar [data-action="ve-undo"]').isDisabled();
  await outlineItem(target).focus(); await page.keyboard.press('Control+z');
  const preview = { disabled: previewUndo, error: await errorText(), same: before === await snapshot() };
  await page.keyboard.press('Control+k'); await opened();
  const offered = { history: await js(() => design().history.length), rows: await page.locator('#palette-results [data-action="ve-undo"], #palette-results [data-action="ve-redo"]').count(), preview: await page.locator('#palette-results [data-action="ve-mode"]').count() };
  await escape();
  check('Preview offers no Undo or Redo in the palette', offered.history > 0 && offered.rows === 0 && offered.preview === 1, offered);
  await act('ve-mode', 'design');
  await selectNode(await js(() => visualNodes(veCurrentPage().root).find(n => n.ref?.entryId === 'u-table').id));
  await act('ve-inspector', 'essentials', '.ve-pane-inspector'); before = await snapshot();
  await commit(page.locator('[data-field="ve-prop"][data-key="columns"]'), '[{"header":');
  const json = { inline: await page.locator('#ve-prop-columns-error').innerText(), same: before === await snapshot() };
  check('stale drafts, invalid values and Preview history travel are refused without a write', preview.disabled && preview.error.startsWith('Preview is read-only') && preview.same && stale.error.includes('The project changed during this edit') && stale.open && stale.same && stale.draft === 'Stale draft' && json.inline.includes('the JSON is invalid') && json.same, { stale, json, preview }, 'Controlled concurrent-change fixture, real Save control');
}

async function hostilePageNames() {
  const id = await pick('Create action');
  await act('ve-inspector', 'essentials', '.ve-pane-inspector'); await commit(page.locator('#ve-name-name'), HOSTILE);
  const outline = await outlineItem(id).locator(':scope > .ve-tree-row .ve-tree-label').innerText();
  await act('ve-delete', '', '.ve-inspector-body'); await opened(); const deleteDialog = await escape();
  await act('ve-reparent', undefined, '.ve-inspector-body'); await opened(); const reparentDialog = await escape();
  hostile.page = { name: (await nodeOf(id)).name === HOSTILE, outline: outline === HOSTILE, delete: deleteDialog.includes('Delete ' + HOSTILE + '?'), reparent: reparentDialog.includes('Move ' + HOSTILE + ' to…'), clean: await noInjection() };
}

// The retired detail editors' entry actions are gone: every entry point emits ve-* actions, and an injected legacy
// control is inert (no navigation, no write, no error).
async function retiredEntryActions() {
  const before = await snapshot(), origin = await js(() => ({ view: state.view, owner: veUi.owner, library: veUi.library }));
  const emitted = await page.locator('[data-action^="dt-"], [data-action^="cp-"]').count(), retired = async (action, value) => {
    await js(([a, v]) => document.getElementById('content').insertAdjacentHTML('beforeend', `<button type="button" id="retired-entry" data-action="${a}" data-value="${v}">Retired</button>`), [action, value]);
    await page.locator('#retired-entry').click(); await page.waitForTimeout(60);
    return js(() => { document.getElementById('retired-entry')?.remove(); return { view: state.view, owner: veUi.owner, library: veUi.library }; });
  };
  const afterPage = await retired('dt-page', 'node-3'), afterComponent = await retired('dt-component', 'project-json-review');
  check('retired dt-page and dt-component actions are inert and write nothing', emitted === 0 && JSON.stringify(afterPage) === JSON.stringify(origin) && JSON.stringify(afterComponent) === JSON.stringify(origin) && before === await snapshot(),
    { emitted, origin, afterPage, afterComponent }, 'Injected retired data-action control through the real click delegation');
}

async function customizeAndContract() {
  await navigate('pages'); await act('ve-open-page', 'node-5'); await act('ve-left', 'insert'); await act('ve-insert-tab', 'components');
  const history = await js(() => design().history.length);
  await act('ve-customize', 'u-button');
  const created = { view: await js(() => state.view), c: await component(), lib: await js(() => design().library.find(l => l.id === veUi.library)), history: await js(() => design().history.length), valid: await js(() => validSavedDesign(design())) };
  app = created.c;
  await act('ve-contract-add', 'props'); await commit(page.locator(`[data-field="ve-contract-row"][data-list="props"][data-index="${app.props.length}"][data-key="name"]`), 'tooltip');
  await act('ve-api-tab', 'slots'); await act('ve-contract-add', 'slots'); await act('ve-api-tab', 'emits'); await act('ve-contract-add', 'emits');
  await commit(page.locator('#ve-contract-description'), HOSTILE);
  const after = await component();
  hostile.contract = after.description === HOSTILE && await page.locator('#ve-contract-description').inputValue() === HOSTILE && await noInjection();
  check('component editor: customize UButton as component, add prop, add slot, add emit', created.view === 'component-editor' && created.c.implementation?.entryId === 'u-button' && created.c.template[0].ref.entryId === 'u-button' && created.lib?.origin === 'project' && created.history === history + 1 && created.valid
    && after.props.at(-1).name === 'tooltip' && after.slots.some(x => x.name === 'newSlot') && after.emits.some(x => x.name === 'newEvent') && await js(() => validSavedDesign(design())), { created: { ...created, c: created.c.exportName }, props: after.props.map(x => x.name) });
}

async function dependencies() {
  await act('ve-contract-tab', 'dependencies');
  await page.locator('#ve-dep-package').fill('@tiptap/vue-3'); await page.locator('#ve-dep-version').fill('^2.11.5');
  let before = await store();
  await act('ve-dependency-add');
  const range = { inline: await page.locator('#ve-dep-error').innerText(), same: before === await store() };
  await page.locator('#ve-dep-version').fill('2.11.5'); await page.locator('#ve-dep-purpose').fill('Rich text ' + HOSTILE); await act('ve-dependency-add');
  const declared = (await component()).dependencies;
  before = await store(); await commit(page.locator('[data-field="ve-dependency"][data-key="version"]').first(), 'latest');
  const row = { error: await errorText(), same: before === await store() };
  await act('ve-left', 'insert'); await act('ve-insert-tab', 'basic'); await act('ve-insert', 'external:@tiptap/vue-3');
  await opened(); await page.locator('#ve-external-adapter').fill('rich-text'); await act('ve-external-confirm', undefined, '#modal'); await closed();
  const external = (await component()).template.find(n => n.kind === 'external'), placeholder = await page.locator('.ve-external-title').first().innerText();
  await act('ve-select-root', undefined, '.ve-pane-left'); await act('ve-contract-tab', 'dependencies');
  before = await store(); await act('ve-dependency-remove', '@tiptap/vue-3');
  const removal = { error: await errorText(), same: before === await store() };
  await page.locator('.ve-left-foot [data-action="ve-deps"]').click(); await opened();
  hostile.dependency = (await escape()).includes('@tiptap/vue-3@2.11.5 · Rich text ' + HOSTILE) && await noInjection();
  check('component dependency: declare @tiptap/vue-3@2.11.5, insert external editor node, range version rejected inline, removing the used dependency refused', range.inline.includes('needs an exact version such as 1.2.3') && range.same
    && JSON.stringify(declared) === JSON.stringify([{ package: '@tiptap/vue-3', version: '2.11.5', purpose: 'Rich text ' + HOSTILE }]) && row.error.includes('exact version') && row.same
    && external?.package === '@tiptap/vue-3' && external.adapter === 'rich-text' && placeholder.includes('External · @tiptap/vue-3@2.11.5 · adapter rich-text') && (await page.locator('.ve-findings').innerText()).includes('Adapter rich-text must be implemented in code')
    && removal.error.includes('Still used by adapter "rich-text"') && removal.same, { range, declared, row, external, placeholder, removal });
}

async function childComposition() {
  review = await js(() => JSON.parse(JSON.stringify(veStore().components.find(c => c.libraryId === 'project-json-review'))));
  await act('ve-left', 'insert'); await act('ve-insert-tab', 'project'); await act('ve-insert', 'project:' + review.id);
  const child = await js(() => veUi.selected);
  await act('ve-child-tab', 'element'); await commit(page.locator('#ve-name-name'), 'Review panel'); await act('ve-child-tab', 'props');
  const key = await page.locator('select[data-field="ve-child-kind"]').first().getAttribute('data-key');
  await page.locator(`select[data-field="ve-child-kind"][data-key="${key}"]`).selectOption('prop');
  await act('ve-child-tab', 'events'); await page.locator('select[data-field="ve-child-emit"][data-key="click"]').selectOption('newEvent');
  const bound = await nodeOf(child);
  await act('ve-left', 'insert'); await act('ve-insert-tab', 'components'); await act('ve-insert', 'nuxt:u-input');
  const input = await js(() => veUi.selected), button = (await component()).template[0].id;
  await act('ve-left', 'outline'); await selectNode(button); await act('ve-child-tab', 'props');
  await page.locator('select[data-field="ve-child-kind"][data-key="label"]').selectOption('state');
  const label = (await nodeOf(button)).props.label, parentProps = (await component()).props.map(x => x.name);
  check('child composition: insert project component, map prop to parent prop, map event to emit', bound.ref?.componentId === review.id && bound.name === 'Review panel' && bound.props[key]?.kind === 'prop' && parentProps.includes(bound.props[key].name)
    && bound.events.some(i => i.event === 'click' && i.actions[0]?.kind === 'emit' && i.actions[0].event === 'newEvent') && JSON.stringify(label) === JSON.stringify({ kind: 'state', nodeId: input }) && await js(() => validSavedDesign(design())), { key, bound, label });
  await selectNode(child);
  composed = { child, key };
}

async function componentRefusals() {
  const { child, key } = composed;
  await act('ve-open-definition', review.id);
  const library = await js(() => veUi.library);
  await act('ve-left', 'insert'); await act('ve-insert-tab', 'project');
  const candidate = page.locator(`#ve-insert-results [data-action="ve-insert"][data-value="project:${app.id}"]`);
  const disabled = await candidate.isDisabled(), reason = await page.locator('#' + await candidate.getAttribute('aria-describedby')).innerText();
  let before = await store();
  await js(value => handleVisualAction('ve-insert', value), 'project:' + app.id);
  const forced = { error: await js(() => veUi.error), same: before === await store() };
  check('cycle is refused in insert child', library === 'project-json-review' && disabled && reason === 'Would create a cycle' && /cycle/i.test(forced.error) && forced.same, { disabled, reason, forced }, 'Real Insert child list plus a forced dispatcher command');
  await act('ve-left', 'outline'); await act('ve-contract-tab', 'contract'); await act('ve-api-tab', 'props');
  const index = review.props.findIndex(x => x.name === key);
  before = await store(); await act('ve-contract-remove', 'props:' + index);
  const broken = { error: await errorText(), same: before === await store() };
  check('contract edit that breaks an instance is refused with instance name', index >= 0 && broken.error.includes('This contract change breaks') && broken.error.includes('Review panel: prop ' + key) && broken.same, broken);
  await act('ve-delete', 'definition'); await opened();
  const confirm = await page.locator('#modal [data-action="ve-delete-confirm"]').isDisabled();
  before = await store(); await js(() => handleVisualAction('ve-delete-confirm'));
  const forced2 = { error: await page.locator('#ve-delete-error').innerText(), same: before === await store() }, dialog = await escape();
  check('delete used component refused with usages', dialog.includes('Cannot delete:') && dialog.includes('is used by Import project JSON, ' + app.exportName + '. Remove those instances first.') && confirm && forced2.error.includes('is used by Import project JSON, ' + app.exportName) && forced2.same, { dialog, forced2 });
  await act('ve-back');
  const back = await js(() => ({ view: state.view, library: veUi.library, selected: veUi.selected }));
  await act('ve-child-tab', 'element'); await commit(page.locator('#ve-name-name'), HOSTILE);
  check('open definition and back return to the composite with its child selected', back.view === 'component-editor' && back.library === app.libraryId && back.selected === child, back);
}

async function publish() {
  await act('ve-open-definition', review.id); await page.locator('.ve-left-foot [data-action="ve-publish"]').click(); await opened();
  const version = await page.locator('#ve-publish-version').inputValue(), usages = await page.locator('#modal section[aria-label="Usages affected"]').innerText(), before = await store();
  await act('ve-publish-confirm', undefined, '#modal');
  const unconfirmed = { error: await page.locator('#ve-publish-error').innerText(), same: before === await store() };
  await page.locator('#ve-publish-confirm').check(); await act('ve-publish-confirm', undefined, '#modal'); await closed();
  const revisions = () => js(id => JSON.stringify(veStore().revisions.filter(r => r.componentId === id)), review.id), revision = await revisions(), live = await component();
  await act('ve-select-root', undefined, '.ve-pane-left'); await commit(page.locator('#ve-contract-description'), 'Changed after publishing');
  const [pinned] = JSON.parse(revision);
  hostile.publish = usages.includes(app.exportName + ' / ' + HOSTILE + ' · live, follows the component') && await noInjection();
  check('publish revision pins version; usages listed before confirm', version === '1.0.0' && usages.includes('Usages affected · 2') && usages.includes('Page Import project JSON / ') && hostile.publish && unconfirmed.error.includes('Confirm that you reviewed the usages') && unconfirmed.same
    && pinned?.version === '1.0.0' && JSON.stringify(pinned.template) === JSON.stringify(live.template) && revision === await revisions() && (await component()).description === 'Changed after publishing', { version, usages, unconfirmed, pinned: pinned?.version });
}

async function backNavigation() {
  check('hostile strings render as text in inspector, contract, dependency, publish, delete and reparent dialogs', Object.values(hostile.page).every(Boolean) && hostile.contract && hostile.dependency && hostile.publish && await noInjection(), hostile);
  await navigate('storymaps'); await act('sm-open', 'map-1');
  if (!await page.locator('#content [data-action="ve-open-page"][data-value="node-5"]').count()) await page.locator('#content [data-sm-item="story-9"]').first().click();
  const origin = await js(() => ({ map: smUi.map, item: smUi.item }));
  await page.locator('#content [data-action="ve-open-page"][data-value="node-5"]').first().click();
  const editor = await js(() => ({ view: state.view, owner: veUi.owner }));
  await act('ve-back');
  const story = await js(() => ({ view: state.view, map: smUi.map, item: smUi.item })), storyFocus = await focused();
  check('back from storymap returns to originating story', editor.view === 'page-editor' && editor.owner === 'node-5' && story.view === 'storymaps' && story.map === origin.map && story.item === origin.item && origin.item === 'story-9' && storyFocus.action === 've-open-page' && storyFocus.value === 'node-5', { origin, editor, story, storyFocus });
  await navigate('components'); await act('product-component-select', 'project-json-review');
  const uses = await page.locator('#content .card', { hasText: 'Used in page and component designs' }).innerText();
  await act('ve-open-component', 'project-json-review');
  const view = await js(() => state.view);
  await act('ve-back');
  const library = { view: await js(() => state.view), component: await js(() => productUi.component), focus: await focused() };
  check('back from library returns to library', view === 'component-editor' && library.view === 'components' && library.component === 'project-json-review' && library.focus.action === 've-open-component' && uses.includes('Used in page and component designs (2)') && uses.includes('Page Import project JSON') && uses.includes('Component ' + app.exportName), { uses, library });
  await act('product-component-select', app.libraryId); await act('product-component-delete', app.libraryId);
  check('library deletion is blocked while a component design exists', (await toast()).startsWith('In use.') && await js(id => design().library.some(l => l.id === id) && veStore().components.some(c => c.libraryId === id), app.libraryId));
  await navigate('sitemap'); await page.waitForTimeout(400);
  await page.locator('.map-node[data-node="node-5"] .map-card-title').first().click(); await page.waitForTimeout(60);
  await page.locator('#content [data-action="ref-inspect"][data-value="node-5"]:visible').first().click(); await page.waitForTimeout(70);
  await page.locator('#content [data-action="canvas-inspector"][data-value="links"]:visible').first().click();
  await page.locator('#content [data-action="ve-open-page"][data-value="node-5"]:visible').first().click();
  const fromSitemap = await js(() => state.view);
  await act('ve-back');
  check('back from sitemap restores the selected surface and inspector tab', fromSitemap === 'page-editor' && await js(() => state.view === 'sitemap' && designUi.selected === 'node-5' && canvasUi.inspector === 'links'));
}

// Saved browser state from before this change (Review Focus 1): the v4 self-project with detail designs and legacy
// history snapshots, written into the storage adapter before the concept starts.
const legacyPages = () => legacyDesign.detailDesigns.documents.filter(d => d.kind === 'page').length;
async function legacySavedState() {
  const fixture = JSON.parse(readFileSync(FIXTURES + 'detail-v4.json', 'utf8')), key = await js(() => STORAGE_KEY);
  const saved = await js(v4 => {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY)), old = { ...s.project.design, ...v4.design };
    delete old.visualDesigns; old.history = [designSnapshot(old), designSnapshot(old)]; old.future = [designSnapshot(old)];
    s.project.design = old; s.view = 'pages'; return JSON.stringify(s);
  }, fixture);
  legacyDesign = JSON.parse(saved).project.design;
  await load({ [key]: saved });
  const notice = await toast(), restored = await js(() => ({ legacy: 'detailDesigns' in design(), schema: design().visualDesigns?.schema, history: design().history.length, future: design().future.length, stored: localStorage.getItem(STORAGE_KEY).includes('detailDesigns'), pages: veStore().pages.length, valid: validSavedDesign(design()) }));
  await act('ve-open-page', 'node-50');
  const disabled = await page.locator('.ve-toolbar [data-action="ve-undo"]').isDisabled() && await page.locator('.ve-toolbar [data-action="ve-redo"]').isDisabled();
  await page.locator('#ve-outline [role="treeitem"][tabindex="0"]').focus(); await page.keyboard.press('Control+z');
  const attempt = { toast: await toast(), legacy: await js(() => 'detailDesigns' in design() || design().history.some(h => h.detailDesigns)) };
  check('legacy saved state migrates and clears history', legacyDesign.detailDesigns.documents.length > 50 && notice.includes('upgraded to the new page and component editors. Earlier undo history was cleared.') && !restored.legacy && restored.schema === 3 && restored.history === 0 && restored.future === 0
    && !restored.stored && restored.pages === legacyPages() && restored.pages > 20 && restored.valid && disabled && attempt.toast.includes('Nothing to undo') && !attempt.legacy, { notice, restored, disabled, attempt }, 'Seeded pre-upgrade browser storage, real startup restore and editor controls');
}

async function scenariosAndNarrow() {
  const nodes = await js(() => ({ error: visualNodes(veCurrentPage().root).find(n => n.name === 'Import error')?.id, loading: visualNodes(veCurrentPage().root).find(n => n.name === 'Reading project')?.id, scenarios: veCurrentPage().scenarios.map(s => [s.id, s.name, s.state, s.width]) }));
  const [wide] = nodes.scenarios.filter(s => s[2] === 'default'), [narrow] = nodes.scenarios.filter(s => s[2] === 'error'), shown = id => page.locator(`.ve-frame [data-ve-node="${id}"]`).count();
  await act('ve-mode', 'preview'); await page.locator('[data-field="ve-scenario"]').selectOption(narrow[0]);
  const error = { shown: await shown(nodes.error), loading: await shown(nodes.loading), viewport: await js(() => veUi.viewport), pressed: await page.locator('[data-action="ve-viewport"][data-value="mobile"]').getAttribute('aria-pressed'), frame: await page.locator('.ve-frame.ve-vp-mobile[data-scenario-state="error"]').count() };
  await page.locator('[data-field="ve-scenario"]').selectOption(wide[0]);
  const fine = { shown: await shown(nodes.error), loading: await shown(nodes.loading) };
  check('scenario switch hides and shows state-bound nodes in preview', narrow[3] === 'narrow' && error.shown === 1 && error.loading === 0 && error.viewport === 'mobile' && error.pressed === 'true' && error.frame === 1 && fine.shown === 0 && fine.loading === 0, { nodes, error, fine });
  await act('ve-mode', 'design'); await act('ve-viewport', 'desktop'); await page.setViewportSize({ width: 390, height: 844 });
  const layout = { tabs: await page.locator('.ve-pane-tabs').isVisible(), canvas: await page.locator('.ve-pane-canvas.is-active').isVisible(), scroll: await noHorizontalScroll() };
  await act('ve-pane', 'left'); const outline = await page.locator('#ve-outline [role="tree"]').isVisible();
  await page.locator('#ve-outline [role="treeitem"] .ve-tree-label').first().click();
  await act('ve-pane', 'inspector'); const inspector = await page.locator('.ve-pane-inspector.is-active .ve-inspector-body').isVisible() && await noHorizontalScroll();
  await act('ve-pane', 'canvas'); await act('ve-health', undefined, '.ve-toolbar');
  const health = (await page.locator('#modal').boundingBox())?.width ?? 999; await escape();
  // The sidebar is a mobile menu at this width; the dispatcher opens the component editor the library button would open.
  await js(() => handleVisualAction('ve-open-component', 'project-json-review'));
  const componentEditor = await page.locator('.ve-component-editor').isVisible() && await noHorizontalScroll();
  check('narrow viewport (390px) editor usable without horizontal page scroll', layout.tabs && layout.canvas && layout.scroll && outline && inspector && health <= 390 && componentEditor, { layout, outline, inspector, health, componentEditor });
  await page.setViewportSize({ width: 1600, height: 1000 });
}

async function legacyOutlineAdoption() {
  const key = await js(() => LEGACY_STORAGE_KEY);
  await load({ [key]: JSON.stringify({ schema: 1, projects: [{ name: 'Legacy outline', id: 'legacy-outline', author: 'Concept test', description: 'Saved before the visual editors', version: '0.1.0', design: legacyDesign }] }) });
  await act('vault-legacy'); await opened(); await act('vault-legacy-adopt', undefined, '#modal'); await closed();
  const adopted = await js(() => ({ legacy: 'detailDesigns' in design(), schema: design().visualDesigns?.schema, pages: veStore().pages.length, history: design().history.length, valid: validSavedDesign(design()), original: localStorage.getItem(LEGACY_STORAGE_KEY).includes('detailDesigns') }));
  check('legacy outline adoption upgrades the copied design and keeps the original', !adopted.legacy && adopted.schema === 3 && adopted.pages === legacyPages() && adopted.history === 0 && adopted.valid && adopted.original, adopted, 'Seeded previous-workspace storage, real recovery dialog');
}

async function selfProjectHealthAndHostileImports() {
  await palette('project-example'); await page.locator('#project-import-confirm').waitFor();
  const name = await page.locator('#project-import-summary h3').innerText();
  await applyImport();
  const self = await js(() => ({ schema: design().schema, legacy: 'detailDesigns' in design(), pages: veStore().pages.length, components: veStore().components.length }));
  await navigate('pages'); await act('ve-open-page', await js(() => veStore().pages[0].ownerId)); await act('ve-health', undefined, '.ve-toolbar');
  const rows = await page.locator('#modal .ve-health-check').evaluateAll(els => els.map(e => [e.querySelector('strong').textContent, e.classList.contains('is-pass')]));
  const status = await page.locator('#modal [role="status"]').first().innerText(), slideover = await js(() => document.getElementById('modal').classList.contains('ve-slideover'));
  await escape();
  check('health slideover lists all passing checks for the self-project', self.schema === 5 && !self.legacy && self.pages > 20 && self.components > 0 && slideover && rows.length === 8 && rows.every(([, pass]) => pass) && status.startsWith('8 of 8 checks pass'), { name, self, rows, status });
  const before = { json: await js(() => companionJson()), stored: await js(() => localStorage.getItem(STORAGE_KEY)) }, doc = () => JSON.parse(before.json);
  const catalog = doc(), unknown = doc(), legacy = doc(), added = unknown.design.visualDesigns;
  catalog.design.visualDesigns.catalog.version = 2; legacy.design.detailDesigns = { schema: 2, nextId: 1, documents: [], revisions: [] };
  added.pages[0].root.push({ id: 'vn-' + added.nextId++, kind: 'component', ref: { kind: 'nuxt-ui', entryId: 'u-bogus' }, props: {}, slots: {}, events: [] });
  const proto = before.json.replace(/"visualDesigns":\s*\{/, '"visualDesigns":{"__proto__":{"polluted":true},'), outcomes = [];
  const variants = [['catalog version 2', JSON.stringify(catalog), /catalog/i], ['unknown catalog entry', JSON.stringify(unknown), /u-bogus/], ['v5 with detailDesigns', JSON.stringify(legacy), /detail/i], ['prototype key', proto, /Unsafe object key/]];
  for (const [label, text, pattern] of variants) {
    await importFile({ name: 'hostile.json', mimeType: 'application/json', buffer: Buffer.from(text) });
    const message = await page.locator('#project-transfer-error').innerText(), confirmable = await page.locator('#project-import-confirm').count();
    await page.locator('#modal [data-action="close"]').first().click();
    if (await page.locator('#discard-dialog[open]').count()) await page.locator('#discard-confirm').click();
    await closed();
    outcomes.push({ label, message: message.slice(0, 200), ok: pattern.test(message) && !confirmable && before.json === await js(() => companionJson()) && before.stored === await js(() => localStorage.getItem(STORAGE_KEY)) });
  }
  check('hostile v5 import rejected, project unchanged', proto.includes('__proto__') && outcomes.every(o => o.ok) && await js(() => ({}).polluted === undefined), outcomes);
}

const phases = [legacyImportAndPages, insertAndLayouts, inspectorBindingsAndInteractions, keyboardOnly, moveTo, layoutsAcrossPages, guardedWrites, hostilePageNames, retiredEntryActions,
  customizeAndContract, dependencies, childComposition, componentRefusals, publish, backNavigation, legacySavedState, scenariosAndNarrow, legacyOutlineAdoption,
  () => failedUpgradeRecovery(harness), selfProjectHealthAndHostileImports, () => surfaceRemovalAndOrphans(harness), () => revisionSurfaceAndBlueprint(harness)];
browser = await chromium.launch({ headless: true, ...(process.env.SHELL_CHROMIUM ? { executablePath: process.env.SHELL_CHROMIUM } : {}) });
try {
  await load();
  for (const phase of phases) await phase();
  check('no network requests, no console errors', !errors.length && !requests.length, { errors, requests });
} catch (error) {
  fatal = String(error?.stack || error); console.error(fatal);
  await page?.screenshot({ path: OUT + '/failure.png' }).catch(() => {});
}
await browser.close();
const report = { checks, errors, requests, fatal, html_sha256: createHash('sha256').update(readFileSync(HTML)).digest('hex'), scope: 'Browser concept only; real controls, keyboard paths and labelled controlled failure fixtures on the exact assembled artifact. Not native host or generated application acceptance.' };
writeFileSync(OUT + '/checks.json', JSON.stringify(report, null, 2) + '\n');
console.log(checks.filter(c => c.result === 'passed').length + '/' + checks.length + ' named checks passed');
process.exit(fatal || errors.length || requests.length || checks.some(c => c.result !== 'passed') ? 1 : 0);
