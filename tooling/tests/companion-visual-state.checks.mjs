// Real concept sources (design history, storymap undo, visual write path) over the shared contracts, assembled
// into one script realm the way build-companion.py inlines them. Host-only adapters (storage, rendering, notices)
// are recording stubs; validSavedDesign is reduced to its visual part (veShape over the design and every snapshot)
// because the full structural gate needs the whole page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { conceptShared, visualModules } from './support/concept-realm.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const shared = await conceptShared(['native-contract.mjs', 'design-system-roles.mjs', 'design-system-contract.mjs', 'composition-contract.mjs', ...visualModules, 'storymap-contract.mjs', 'prd-limits.mjs']);
const sources = ['design-model.js', 'storymap-model.js', 'storymap-actions.js', 've-state.js', 'project-transfer.js'];
const concept = (await Promise.all(sources.map(name => readFile('docs/concepts/companion/src/' + name, 'utf8')))).join('\n');
const stubs = `const DESIGN_LIMITS = { history: 20, importBytes: 4000000 };
function designCopy(v) { return JSON.parse(JSON.stringify(v)); }
const state = { activeRun: null }, tdUi = { busy: false }, storageWarning = '', STORAGE_KEY = 'k', persistenceSnapshot = null, modalType = '', innerWidth = 1200;
const localStorage = { getItem: () => null }, document = { addEventListener() {}, getElementById: id => (id === 'modal' ? { addEventListener() {} } : null) };
function project() { return host.p; } function ensureProductModel(d) { return d; }
function generationSnapshot(d) { const v = designSnapshot(d); delete v.canvas; delete v.storymaps; if (!veHasContent(v.visualDesigns)) delete v.visualDesigns; return v; }
function emptySemantic() { return { schema: 1, nextId: 1, entities: [] }; }
function emptyDataSources() { return { schema: 1, nextId: 1, sources: [], flows: [], positions: {} }; }
function persist() { host.saves++; host.persisted = JSON.stringify(host.p.design); }
function saveConceptState() { persist(); return true; } function save() { persist(); } function render() {} function notify(text) { host.notices.push(text); }`;
// Declared after the concept sources, so this reduced gate replaces design-model.js's full structural one.
const gate = 'function validSavedDesign(d) { return veShape(d) && [...d.history, ...d.future].every(s => veShape(s)); }';
async function load(extra = '') {
  const host = { p: null, saves: 0, notices: [] }, ctx = vm.createContext({ host, TextEncoder, structuredClone });
  vm.runInContext(shared + '\n' + stubs + '\n' + concept + '\n' + gate + '\n' + extra, ctx, { filename: 'concept-visual-state.js' });
  return { ctx, host };
}
const surface = id => ({ id, slug: id, label: id, kind: 'page', parent: null });
// Fixtures are created inside the concept realm, exactly as the page would hold them.
function baseDesign(ctx) {
  return ctx.designCopy({ schema: 6, revision: 1, blueprint: 'workspace', goal: '', platform: 'desktop', nodes: [surface('node-1')], links: [], nextId: 2,
    library: [], prds: [], emitted: {}, history: [], future: [], storymaps: ctx.emptyStorymaps() });
}
// Outline-style write through the shared history (records a snapshot, then changes the design).
function outlineWrite(ctx, change) { ctx.recordDesign(); change(ctx.design()); ctx.designChanged(); }
const travels = ctx => ({ outline: d => { if (!ctx.designTravel(d)) throw Error('refused'); }, storymap: d => ctx.smTravel(d), visual: d => ctx.veTravel(d) });
const addPage = (ctx, ownerId, name) => ctx.veCommit(store => { ctx.visualCreatePage(store, { ownerId, name }); });

// add surface S -> page for S -> sitemap removes S (orphaned page; the context-free shape gate allows it)
async function orphanScenario() {
  const env = await load(), { ctx, host } = env; host.p = { design: baseDesign(ctx) };
  outlineWrite(ctx, d => d.nodes.push(ctx.designCopy(surface('node-2'))));
  addPage(ctx, 'node-2', 'S page');
  outlineWrite(ctx, d => { d.nodes = d.nodes.filter(n => n.id !== 'node-2'); });
  return env;
}

for (const path of ['outline', 'storymap', 'visual']) {
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

// Blueprint import: the real importDesign behind reduced gates (the visual shape and reference checks), so the
// property allow-list is what decides.
const importGate = `function structuralDesign(d) { return veShape(d); } function designIssues(d) { return veIssues(d); }
function bricksOf(n) { return n?.bricks || []; } function emptyCanvas() { return { schema: 1 }; }`;
test('[VISUAL-IMPORT] blueprint import refuses unknown properties before any write; the blueprint carries schema 6', async () => {
  const { ctx, host } = await load(importGate); host.p = { design: baseDesign(ctx) }; addPage(ctx, 'node-1', 'Home');
  const portable = plain(ctx.portableDesign()), before = JSON.stringify(ctx.design()), saves = host.saves;
  assert.deepEqual([portable.kind, portable.executable, portable.schema], ['plugin-shell-blueprint', false, 6]);
  for (const key of ['bogus', '__proto__', 'history', 'revision']) {
    const text = JSON.stringify({ ...portable, [key]: 1 });
    assert.ok(text.includes(JSON.stringify(key)), key);
    assert.throws(() => ctx.importDesign(text), /^Error: Unknown blueprint properties are not accepted\.$/, key);
  }
  assert.equal(JSON.stringify(ctx.design()), before); assert.equal(host.saves, saves);
  // The same blueprint without the extra property imports and keeps the history.
  ctx.importDesign(JSON.stringify(portable));
  assert.equal(ctx.design().visualDesigns.pages.length, 1); assert.ok(ctx.design().history.length > 0); assert.equal(ctx.design().schema, 6);
  // A retired detail-design store is not a current design key: refused before any write, never upgraded.
  const retired = JSON.stringify({ ...portable, detailDesigns: { schema: 2, nextId: 1, documents: [], revisions: [] } }), after = JSON.stringify(ctx.design());
  assert.throws(() => ctx.importDesign(retired), /^Error: Unknown blueprint properties are not accepted\.$/);
  assert.equal(JSON.stringify(ctx.design()), after);
});

test('[VISUAL-ISSUES] design checks report a page whose surface is gone as a reference warning', async () => {
  const { ctx } = await orphanScenario(), issues = plain(ctx.veIssues(ctx.design()));
  assert.equal(issues.length, 1);
  assert.deepEqual([issues[0].level, issues[0].code, issues[0].node], ['warning', 'visual-reference', null]);
  assert.match(issues[0].message, /^Pages and components: .*owner surface is missing/);
  const { ctx: clean, host } = await load(); host.p = { design: baseDesign(clean) }; addPage(clean, 'node-1', 'Home');
  assert.deepEqual(plain(clean.veIssues(clean.design())), []);
});

// Project JSON is schema 6 only: the real export path round-trips the golden self-project unchanged through the bundled
// contract, and an earlier version is refused with the contract's reason, never migrated.
const golden = JSON.parse(await readFile('configs/starters/companion-plugin.json', 'utf8')).generator.document;
test('[PROJECT-VERSION] the concept exports schema 6 unchanged and refuses an earlier project version', async () => {
  const { ctx, host } = await load();
  host.p = ctx.designCopy({ ...golden.project, folders: golden.settings, notes: golden.notes, design: { ...golden.design, revision: 1, emitted: {}, history: [], future: [] } });
  const exported = JSON.parse(ctx.companionJson());
  assert.deepEqual(exported, golden);
  const earlier = { ...golden, schemaVersion: 5, design: { ...golden.design, schema: 5 } };
  assert.throws(() => ctx.parseCompanionDocument(JSON.stringify(earlier)), { name: 'SitemapError', code: 'COMPANION_VERSION', message: /^COMPANION_VERSION: Unsupported project schemaVersion 5; only schema 6 is supported/ });
});
