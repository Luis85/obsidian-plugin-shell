/** Execute the actual composable with the pinned Vue/Pinia runtime. No browser host or stubbed store actions. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { SitemapSession } from '../../scripts/companion/sitemap/session.ts';
import * as commands from '../../scripts/companion/sitemap/commands.ts';
import * as projection from '../../scripts/companion/sitemap/projection.ts';
import * as create from '../../scripts/companion/sitemap/create.ts';
import * as validate from '../../scripts/companion/sitemap/validate.ts';
import { canonicalKey, assertJson } from '../../scripts/companion/sitemap/safety.ts';
import { validateAuthoringDocument, migrateAuthoringDocument } from '../../scripts/companion/authoring-contract.ts';
const root = new URL('../../', import.meta.url);
// These are the same maintained runtime files used by the concept, not arbitrary imported project scripts.
const Vue = vm.runInThisContext(readFileSync(new URL('docs/concepts/companion/vendor/vue.runtime.global.prod.js', root), 'utf8') + ';Vue;');
const Pinia = vm.runInThisContext(readFileSync(new URL('docs/concepts/companion/vendor/pinia.iife.prod.js', root), 'utf8') + ';Pinia;');
const dependencies = { vue: Vue, pinia: Pinia, 'session.ts': { SitemapSession }, 'commands.ts': commands,
  'projection.ts': projection, 'create.ts': create, 'validate.ts': validate };
const source = readFileSync(new URL('docs/concepts/companion/editor/composables/use-editor.ts', root), 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
vm.runInThisContext('(function(require,exports){' + javascript + '\n})')(name => {
  const dependency = dependencies[name] ?? dependencies[name.split('/').at(-1)];
  assert.ok(dependency, 'Unexpected composable dependency: ' + name); return dependency;
}, exports);
async function fixture(t) {
  let document = migrateAuthoringDocument(JSON.parse(readFileSync(new URL('docs/concepts/companion/companion-project.json', root), 'utf8'))).document;
  let revision = 1, writes = 0, selected = '';
  const pinia = Pinia.createPinia();
  const host = {
    read: async () => ({ revision: String(revision), writable: true, design: structuredClone(document.design) }),
    validate: design => { validateAuthoringDocument({ ...document, design }); },
    async save(request) {
      assert.equal(request.expectedRevision, String(revision));
      assert.equal(request.beforeKey, canonicalKey(document.design));
      document = { ...document, design: structuredClone(request.design) }; revision++; writes++;
      return { status: 'committed', snapshot: await host.read() };
    },
    select: id => { selected = id; }, openPage() {}, openComponents() {}, openSources() {}, importProject() {}, exportProject() {},
  };
  const store = exports.editorStore(host)(pinia); t.after(() => { store.dispose(); Pinia.disposePinia(pinia); });
  await store.load();
  return { store, host, document: () => document, writes: () => writes, selected: () => selected };
}
test('hydrated Vue/Pinia state stays unmodified inert JSON and all derived projections execute', async t => {
  const { store } = await fixture(t);
  assert.doesNotThrow(() => assertJson(store.snapshot));
  assert.equal(Vue.isProxy(store.snapshot), false);
  assert.equal(Object.hasOwn(store.snapshot, '__v_skip'), false);
  assert.equal(store.projection.nodes.length, 28);
  assert.deepEqual(store.findings, []);
  assert.ok(store.context.breadcrumb.length);
});
test('real store rename, route, undo and redo commit through the canonical host', async t => {
  const { store, document, writes } = await fixture(t);
  const node = store.snapshot.nodes.find(n => n.kind === 'page'); store.select(node.id);
  store.draftName = 'Edited from the real store'; store.dirty = true;
  await store.saveName(); assert.equal(store.dirty, false); assert.equal(store.canUndo, true);
  assert.equal(document().design.nodes.find(n => n.id === node.id).label, 'Edited from the real store');
  await store.undo(); assert.equal(store.selected.label, node.label);
  await store.redo(); assert.equal(store.selected.label, 'Edited from the real store');
  store.open('route'); store.form.name = '/review/:recordId'; await store.applyForm();
  assert.equal(store.panel, ''); assert.equal(store.route.path, '/review/:recordId'); assert.equal(writes(), 4);
  assert.doesNotThrow(() => validateAuthoringDocument(document()));
});
test('dirty drafts prevent navigation; cancelled forms preserve the entire saved model', async t => {
  const { store, writes, document } = await fixture(t); const original = structuredClone(document());
  store.draftName = 'Unsubmitted'; store.dirty = true;
  assert.equal(store.canLeave(), false); store.select('not-selected');
  assert.notEqual(store.selectedId, 'not-selected');
  store.cancel(); assert.equal(store.canLeave(), true);
  store.open('create'); store.form.name = 'Abandoned'; store.cancel();
  assert.equal(writes(), 0); assert.deepEqual(document(), original);
});
test('failed durable save keeps dirty input and saved project visible for correction', async t => {
  const { store, host, document } = await fixture(t); const original = structuredClone(document());
  host.save = async () => ({ status: 'failed', certainty: 'unchanged' });
  store.draftName = 'Still a draft'; store.dirty = true; await store.saveName();
  assert.equal(store.dirty, true); assert.equal(store.draftName, 'Still a draft'); assert.equal(store.canUndo, false);
  assert.deepEqual(document(), original); assert.match(store.error, /refused/);
});

test('remount restores UI context without writing or duplicating project data', async t => {
  const { store, host, document, writes } = await fixture(t);
  store.select(store.snapshot.nodes.find(n => n.kind === 'page').id);
  store.lens = 'navigation'; store.query = 'page'; store.treeOpen = true;
  store.inspectorOpen = false; store.tab = 'related';
  const saved = structuredClone(document()), context = store.viewState(), pinia = Pinia.createPinia();
  const restored = exports.editorStore({ ...host, selected: store.selectedId, viewState: context })(pinia);
  t.after(() => { restored.dispose(); Pinia.disposePinia(pinia); });
  await restored.load();
  assert.deepEqual(restored.viewState(), context); assert.equal(restored.selectedId, store.selectedId);
  assert.equal(writes(), 0); assert.deepEqual(document(), saved);
});
test('navigation connector reviews a link and never silently reparents the target', async t => {
  const { store, document, writes } = await fixture(t), before = structuredClone(document());
  const pages = store.snapshot.nodes.filter(n => n.kind === 'page');
  const from = pages[0], to = pages.find(n => n.id !== from.id && !store.snapshot.links.some(e => e.from === from.id && e.to === n.id));
  assert.ok(to); store.lens = 'navigation'; store.proposeConnection(from.id, to.id);
  assert.equal(store.panel, 'link'); assert.equal(store.selectedId, from.id); assert.equal(store.form.target, to.id);
  assert.equal(writes(), 0); await store.applyForm();
  assert.equal(store.panel, ''); assert.equal(writes(), 1);
  assert.deepEqual(document().design.nodes, before.design.nodes);
  assert.deepEqual(document().design.sitemap, before.design.sitemap);
  assert.equal(document().design.links.length, before.design.links.length + 1);
});
test('hierarchy connector requires confirmation; journey connections cannot reparent', async t => {
  const { store, writes, document } = await fixture(t), before = structuredClone(document());
  const pages = store.snapshot.nodes.filter(n => n.kind === 'page');
  store.proposeConnection(pages[0].id, pages[1].id);
  assert.equal(store.panel, 'move'); assert.equal(store.selectedId, pages[1].id);
  assert.equal(store.form.parent, pages[0].id); store.cancel();
  store.lens = 'journey'; store.proposeConnection(pages[0].id, pages[1].id);
  assert.equal(store.panel, ''); assert.match(store.error, /journey steps/);
  assert.equal(writes(), 0); assert.deepEqual(document(), before);
});
