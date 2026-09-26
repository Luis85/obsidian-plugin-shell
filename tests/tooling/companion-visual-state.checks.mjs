// Real concept sources (design history, storymap/detail undo, visual write path) over the shared contracts, assembled
// into one script realm the way build-companion.py inlines them. Host-only adapters (storage, rendering, notices)
// are recording stubs; validSavedDesign is reduced to its visual part (veShape over the design and every snapshot)
// because the full structural gate needs the whole page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { COMPANION_VERSION } from '../../scripts/companion/project-contract.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const visualModules = ['ir', 'mapping', 'catalog', 'composition', 'validate', 'layout', 'commands', 'session', 'migrate'].map(n => 'visual/visual-' + n + '.mjs');
const contracts = ['composition-contract.mjs', 'detail-contract.mjs', ...visualModules, 'storymap-contract.mjs'];
const shared = (await Promise.all(contracts.map(name => readFile('scripts/companion/' + name, 'utf8')))).join('\n').split('\n')
  .filter(line => !line.startsWith('import ')).join('\n').replaceAll('export const ', 'const ').replaceAll('export function ', 'function ');
const sources = ['design-model.js', 'storymap-model.js', 'storymap-actions.js', 'detail-actions.js', 've-state.js'];
const concept = (await Promise.all(sources.map(name => readFile('docs/concepts/companion/src/' + name, 'utf8')))).join('\n');
const stubs = `const COMPANION_VERSION = ${COMPANION_VERSION}; const DESIGN_LIMITS = { history: 20 };
function designCopy(v) { return JSON.parse(JSON.stringify(v)); } const dtCopy = designCopy;
const state = { activeRun: null }, tdUi = { busy: false }, storageWarning = '', STORAGE_KEY = 'k', persistenceSnapshot = null, modalType = '', innerWidth = 1200;
const localStorage = { getItem: () => null }, document = { addEventListener() {}, getElementById: () => null };
function project() { return host.p; } function ensureProductModel(d) { return d; } function cpRetainRevisions() {} function cpBoundHistory() {}
function generationSnapshot(d) { const v = designSnapshot(d); delete v.canvas; delete v.storymaps; return v; }
function emptySemantic() { return { schema: 1, nextId: 1, entities: [] }; }
function emptyDataSources() { return { schema: 1, nextId: 1, sources: [], flows: [], positions: {} }; }
function saveConceptState() { host.saves++; return true; } function save() { host.saves++; } function render() {} function notify(text) { host.notices.push(text); }`;
// Declared after the concept sources, so this reduced gate replaces design-model.js's full structural one.
const gate = 'function validSavedDesign(d) { return veShape(d) && [...d.history, ...d.future].every(s => veShape(s)); }';
async function load() {
  const host = { p: null, saves: 0, notices: [] }, ctx = vm.createContext({ host });
  vm.runInContext(shared + '\n' + stubs + '\n' + concept + '\n' + gate, ctx, { filename: 'concept-visual-state.js' });
  return { ctx, host };
}
const surface = id => ({ id, slug: id, label: id, kind: 'page', parent: null });
// Fixtures are created inside the concept realm, exactly as the page would hold them.
function baseDesign(ctx) {
  return ctx.designCopy({ schema: 4, revision: 1, blueprint: 'workspace', goal: '', platform: 'desktop', nodes: [surface('node-1')], links: [], nextId: 2,
    library: [], prds: [], emitted: {}, history: [], future: [], storymaps: ctx.emptyStorymaps() });
}
// Outline-style write through the shared history (records a snapshot, then changes the design).
function outlineWrite(ctx, change) { ctx.recordDesign(); change(ctx.design()); ctx.designChanged(); }
const travels = ctx => ({ outline: d => { if (!ctx.designTravel(d)) throw Error('refused'); }, storymap: d => ctx.smTravel(d), detail: d => ctx.dtTravel(d), visual: d => ctx.veTravel(d) });
const addPage = (ctx, ownerId, name) => ctx.veCommit(store => { ctx.visualCreatePage(store, { ownerId, name }); });

// add surface S -> page for S -> sitemap removes S (orphaned page; the context-free shape gate allows it)
async function orphanScenario() {
  const env = await load(), { ctx, host } = env; host.p = { design: baseDesign(ctx) };
  outlineWrite(ctx, d => d.nodes.push(ctx.designCopy(surface('node-2'))));
  addPage(ctx, 'node-2', 'S page');
  outlineWrite(ctx, d => { d.nodes = d.nodes.filter(n => n.id !== 'node-2'); });
  return env;
}

for (const path of ['outline', 'storymap', 'detail', 'visual']) {
  test(`[VISUAL-HISTORY] ${path} undo after a visual commit drops the page, keeps the counter monotonic and refuses an invalid restore`, async () => {
    const { ctx, host } = await orphanScenario(), travel = travels(ctx)[path];
    travel('undo'); // restores S with its page
    assert.equal(ctx.design().visualDesigns.pages.length, 1);
    const counter = ctx.design().visualDesigns.nextId;
    travel('undo'); // before the visual commit: S exists, no page, counter retained
    assert.equal(ctx.design().visualDesigns.pages.length, 0);
    assert.equal(ctx.design().visualDesigns.nextId, counter);
    assert.ok(ctx.design().nodes.some(n => n.id === 'node-2'));
    travel('undo'); // before S: an empty visual store that still carries the counter
    assert.equal(ctx.design().visualDesigns.nextId, counter);
    assert.ok(!ctx.design().nodes.some(n => n.id === 'node-2'));
    travel('redo'); travel('redo');
    assert.equal(ctx.design().visualDesigns.pages.length, 1);
    // Redoing into the orphaned-page state would persist a page whose owner surface is gone: refused, nothing written.
    const before = JSON.stringify(ctx.design()), saves = host.saves;
    assert.throws(() => travel('redo'), /cannot be restored safely: .*owner surface is missing.*Nothing was changed/);
    assert.equal(JSON.stringify(ctx.design()), before);
    assert.equal(host.saves, saves);
  });
}

test('[VISUAL-HISTORY] outline undo reports a refused restore instead of throwing', async () => {
  const { ctx, host } = await orphanScenario();
  assert.equal(ctx.designHistory('undo'), true); const before = JSON.stringify(ctx.design());
  assert.equal(ctx.designHistory('redo'), false);
  assert.equal(JSON.stringify(ctx.design()), before);
  assert.match(host.notices.at(-1), /cannot be restored safely/);
});

for (const path of ['outline', 'storymap', 'detail', 'visual']) {
  test(`[VISUAL-HISTORY] ${path} undo never yields detailDesigns next to visualDesigns`, async () => {
    const { ctx, host } = await load(), travel = travels(ctx)[path];
    const legacy = { ...plain(ctx.designSnapshot(baseDesign(ctx))), detailDesigns: plain(ctx.emptyDetailDesigns()) };
    // A legacy snapshot behind visual work is refused rather than discarding the visual designs.
    host.p = { design: baseDesign(ctx) }; addPage(ctx, 'node-1', 'Home');
    ctx.design().history = ctx.designCopy([legacy]);
    const before = JSON.stringify(ctx.design());
    assert.throws(() => travel('undo'), /cannot be restored safely: .*predates the upgrade/);
    assert.equal(JSON.stringify(ctx.design()), before);
    // Without visual content the legacy entry restores alone (it is migrated on the next load).
    const empty = baseDesign(ctx); empty.visualDesigns = ctx.designCopy({ ...plain(ctx.emptyVisualDesigns()), nextId: 9 });
    empty.schema = COMPANION_VERSION; empty.history = ctx.designCopy([legacy]); host.p = { design: empty };
    travel('undo');
    assert.ok(ctx.design().detailDesigns); assert.equal(ctx.design().visualDesigns, undefined);
    // Redo from the legacy state back to the visual entry drops the empty legacy placeholder and keeps the counter.
    travel('redo');
    assert.equal(ctx.design().detailDesigns, undefined); assert.equal(ctx.design().visualDesigns.nextId, 9);
    for (const s of [ctx.design(), ...ctx.design().history, ...ctx.design().future]) assert.ok(!(s.detailDesigns && s.visualDesigns));
  });
}

test('[VISUAL-HISTORY] veCommit refuses a design that still holds legacy detail designs', async () => {
  const { ctx, host } = await load(); const d = baseDesign(ctx); d.detailDesigns = ctx.emptyDetailDesigns(); host.p = { design: d };
  assert.throws(() => addPage(ctx, 'node-1', 'Home'), /legacy detail designs/);
  assert.equal(ctx.design().visualDesigns, undefined); assert.equal(host.saves, 0);
});

test('[VISUAL-MIGRATE] saved legacy designs migrate in place, clear history and set the upgrade notice', async () => {
  const { ctx } = await load(), d = baseDesign(ctx);
  d.detailDesigns = ctx.emptyDetailDesigns(); d.history = [ctx.designSnapshot(d)]; d.future = [ctx.designSnapshot(d)];
  ctx.veMigrateSaved(d);
  assert.equal(d.detailDesigns, undefined); assert.equal(d.schema, COMPANION_VERSION);
  assert.equal(d.history.length + d.future.length, 0);
  ctx.validateVisualDesigns(d.visualDesigns, ctx.veContext(d));
  assert.equal(vm.runInContext('veUi.notice', ctx), 'This project was upgraded to the new page and component editors. Earlier undo history was cleared.');
});
