import * as maintenance from '../../scripts/companion/sitemap/maintenance.ts';
/** Execute the actual composable with the pinned Vue/Pinia runtime. No browser host or stubbed store actions. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { SitemapSession } from '../../scripts/companion/sitemap/session.ts';
import * as commands from '../../scripts/companion/sitemap/commands.ts';
import * as projection from '../../scripts/companion/sitemap/projection.ts';
import * as layout from '../../scripts/companion/sitemap/layout.ts';
import * as arrangement from '../../scripts/companion/sitemap/arrangement.ts';
import * as create from '../../scripts/companion/sitemap/create.ts';
import * as journeyDraft from '../../scripts/companion/sitemap/journey-draft.ts';
import * as validate from '../../scripts/companion/sitemap/validate.ts';
import * as safety from '../../scripts/companion/sitemap/safety.ts';
import { canonicalKey, assertJson } from '../../scripts/companion/sitemap/safety.ts';
import { validateAuthoringDocument } from '../../scripts/companion/authoring-contract.ts';
import { selfProject } from '../support/starter-documents.mjs';
const root = new URL('../../', import.meta.url);
// These are the same maintained runtime files used by the concept, not arbitrary imported project scripts.
const Vue = vm.runInThisContext(readFileSync(new URL('docs/concepts/companion/vendor/vue.runtime.global.prod.js', root), 'utf8') + ';Vue;');
const Pinia = vm.runInThisContext(readFileSync(new URL('docs/concepts/companion/vendor/pinia.iife.prod.js', root), 'utf8') + ';Pinia;');
const dependencies = { vue: Vue, pinia: Pinia, 'session.ts': { SitemapSession }, 'maintenance.ts': maintenance, 'safety.ts': safety, 'commands.ts': commands,
  'journey-draft.ts': journeyDraft, 'layout.ts': layout, 'arrangement.ts': arrangement, 'projection.ts': projection, 'create.ts': create, 'validate.ts': validate };
const source = readFileSync(new URL('docs/concepts/companion/editor/composables/use-editor.ts', root), 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
vm.runInThisContext('(function(require,exports){' + javascript + '\n})')(name => {
  const dependency = dependencies[name] ?? dependencies[name.split('/').at(-1)];
  assert.ok(dependency, 'Unexpected composable dependency: ' + name); return dependency;
}, exports);
async function fixture(t) {
  let document = selfProject();
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

test('arrangement review is zero-write until confirmation and undo restores exact geometry',async t=>{
  const {store,writes,document}=await fixture(t),before=structuredClone(document().design);
  store.open('arrange');assert.equal(writes(),0);store.cancel();assert.deepEqual(document().design,before);
  store.open('arrange');await store.applyForm();assert.equal(writes(),1);
  assert.deepEqual(document().design.nodes,before.nodes);assert.deepEqual(document().design.sitemap,before.sitemap);
  assert.deepEqual(document().design.canvas.positions,arrangement.arrangeSitemap(before,'all'));
  await store.undo();assert.deepEqual(document().design.canvas,before.canvas);
  await store.redo();assert.equal(writes(),3);
});
test('position form is an exact non-drag command and rejects invalid or empty input without saving',async t=>{
  const {store,writes,document}=await fixture(t);const id=store.selectedId,before=structuredClone(document().design.nodes);
  store.open('position');store.form.x='';await store.applyForm();assert.equal(writes(),0);assert.match(store.error,/both/);
  store.form.x='Infinity';await store.applyForm();assert.equal(writes(),0);
  store.form.x='-120.5';store.form.y='0';await store.applyForm();assert.equal(writes(),1);
  assert.deepEqual(document().design.canvas.positions[id],{x:-120.5,y:0});assert.deepEqual(document().design.nodes,before);
});
test('focused canvas restores the prior panels without writes and cannot conceal a dirty edit',async t=>{
  const {store,writes}=await fixture(t);store.treeOpen=true;store.inspectorOpen=true;
  store.toggleFocus();assert.equal(store.focused,true);assert.equal(store.treeOpen,false);assert.equal(store.inspectorOpen,false);
  store.select(store.snapshot.nodes[1].id);assert.equal(store.inspectorOpen,false);
  store.toggleFocus();assert.equal(store.treeOpen,true);assert.equal(store.inspectorOpen,true);assert.equal(writes(),0);
  store.dirty=true;store.toggleFocus();assert.equal(store.focused,false);assert.equal(store.saveStatus,'Name not saved');
});

test('opening a hidden panel leaves focus mode and reveals the requested panel in one action',async t=>{
  const {store,writes}=await fixture(t);store.treeOpen=false;store.inspectorOpen=false;store.toggleFocus();
  store.showPanel('outline');assert.equal(store.focused,false);assert.equal(store.treeOpen,true);
  store.toggleFocus();store.showPanel('details');assert.equal(store.focused,false);assert.equal(store.inspectorOpen,true);
  assert.equal(writes(),0);
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
  assert.ok(document().design.links.some(e => e.from === from.id && e.to === to.id && e.kind === 'navigate'));
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

test('focused context survives a remount and restores the previous panels without saving', async t => {
  const { store, host, writes } = await fixture(t);
  store.treeOpen = true; store.inspectorOpen = false; store.toggleFocus();
  const context = store.viewState(), pinia = Pinia.createPinia();
  const restored = exports.editorStore({ ...host, selected: store.selectedId, viewState: context })(pinia);
  t.after(() => { restored.dispose(); Pinia.disposePinia(pinia); });
  await restored.load(); assert.equal(restored.focused, true); assert.equal(restored.treeOpen, false);
  restored.toggleFocus(); assert.equal(restored.treeOpen, true); assert.equal(restored.inspectorOpen, false);
  assert.equal(context.focused, true); assert.equal(writes(), 0);
});
test('non-drag position form starts from the same compact display coordinates as the canvas', async t => {
  const { store, writes } = await fixture(t);
  const positions = layout.sitemapDisplayLayout(store.projection.nodes);
  store.open('position');
  assert.equal(Number(store.form.x), positions[store.selectedId].x);
  assert.equal(Number(store.form.y), positions[store.selectedId].y);
  assert.equal(writes(), 0);
});


test('journey authoring selects an explicit branch, edits one saved journey and supports exact undo', async t => {
  const {store,document,writes}=await fixture(t);
  const edge=store.snapshot.links.find(e=>e.kind==='navigate');
  await store.commit({type:'link',transition:{...edge,id:'edge-99000',label:'Alternative action'}});
  const original=structuredClone(document().design);
  store.open('journey');store.form.journeyName='Choose an action';
  store.editJourney({type:'append',surface:edge.from});store.editJourney({type:'append',surface:edge.to});
  assert.equal(store.journeyDraft.journey.steps[1].via,null);
  assert.ok(store.transitionOptions(1).some(e=>e.id==='edge-99000'));
  store.editJourney({type:'transition',step:'step-2',via:'edge-99000'});
  assert.equal(writes(),1,'draft edits do not write');await store.applyForm();
  const id=store.journeyId, saved=structuredClone(document().design.sitemap.journeys.find(j=>j.id===id));
  assert.equal(saved.steps[1].via,'edge-99000');assert.equal(store.panel,'');
  assert.equal(store.journeyDraft,null);assert.equal(store.lens,'journey');
  store.open('journey-edit');assert.deepEqual(store.journeyDraft.journey,saved);
  store.form.journeyName='Renamed journey';await store.applyForm();
  const updated=document().design.sitemap.journeys.find(j=>j.id===id);
  assert.equal(updated.name,'Renamed journey');assert.deepEqual(updated.steps,saved.steps);
  assert.equal(document().design.sitemap.journeys.length,(original.sitemap?.journeys.length??0)+1,'one journey added beside the self-project journeys');
  assert.deepEqual(document().design.nodes,original.nodes);assert.deepEqual(document().design.links,original.links);
  assert.deepEqual(document().design.visualDesigns,original.visualDesigns);
  await store.undo();assert.deepEqual(document().design.sitemap.journeys.find(j=>j.id===id),saved);
  await store.redo();assert.equal(document().design.sitemap.journeys.find(j=>j.id===id).name,'Renamed journey');
});
test('journey cancellation and save failure preserve the original project and editable draft', async t => {
  const {store,host,document,writes}=await fixture(t),original=structuredClone(document());
  const edge=store.snapshot.links.find(e=>e.kind==='navigate');
  store.open('journey');store.form.journeyName='Pending journey';
  for(const surface of [edge.from,edge.to])store.editJourney({type:'append',surface});
  host.save=async()=>({status:'failed',certainty:'unchanged'});await store.applyForm();
  assert.equal(store.panel,'journey');assert.equal(store.form.journeyName,'Pending journey');
  assert.equal(store.journeyDraft.journey.steps.length,2);assert.equal(writes(),0);assert.deepEqual(document(),original);
  store.cancel();assert.equal(store.journeyDraft,null);assert.equal(store.panel,'');assert.deepEqual(document(),original);
});
test('reload refuses dirty names and open journey drafts instead of discarding them', async t => {
  const {store,host,writes}=await fixture(t);let reads=0;const read=host.read;
  host.read=async()=>{reads++;return read();};
  store.draftName='Unsubmitted name';store.dirty=true;await store.load();
  assert.equal(store.draftName,'Unsubmitted name');assert.equal(store.dirty,true);assert.equal(reads,0);
  store.cancel();store.open('journey');store.form.journeyName='Unsubmitted journey';await store.load();
  assert.equal(store.form.journeyName,'Unsubmitted journey');assert.equal(store.panel,'journey');assert.equal(reads,0);
  store.cancel();await store.load();assert.equal(reads,1);assert.equal(writes(),0);
});
test('a stale journey save retains its draft and cannot overwrite or reload away concurrent work', async t => {
  const {store,host,document,writes}=await fixture(t),before=structuredClone(document());
  const edge=store.snapshot.links.find(e=>e.kind==='navigate');
  store.open('journey');store.form.journeyName='Stale draft';
  for(const surface of [edge.from,edge.to])store.editJourney({type:'append',surface});
  host.save=async()=>({status:'conflict'});await store.applyForm();
  assert.equal(store.available,false);assert.equal(store.panel,'journey');assert.match(store.error,/Another view/);
  const draft=structuredClone(store.journeyDraft);await store.load();assert.deepEqual(store.journeyDraft,draft);
  assert.equal(writes(),0);assert.deepEqual(document(),before);
});
test('pending journey save blocks draft mutations, duplicate submissions, cancellation and reload', async t => {
  const {store,host,writes}=await fixture(t);const save=host.save,read=host.read;let release,calls=0,reads=0;
  host.read=async()=>{reads++;return read();};
  host.save=async request=>{calls++;await new Promise(resolve=>{release=resolve;});return save(request);};
  const edge=store.snapshot.links.find(e=>e.kind==='navigate');
  store.open('journey');store.form.journeyName='One write';
  for(const surface of [edge.from,edge.to])store.editJourney({type:'append',surface});
  const pending=store.applyForm();assert.equal(store.busy,true);
  store.editJourney({type:'remove',step:'step-2'});store.cancel();await store.load();await store.applyForm();
  assert.equal(store.journeyDraft.journey.steps.length,2);assert.equal(store.panel,'journey');assert.equal(calls,1);assert.equal(reads,0);
  release();await pending;assert.equal(writes(),1);assert.equal(store.panel,'');
});

test('native editor recovery restores an exact unsaved name without writing or accepting a different design', async t => {
  const f=await fixture(t),store=f.store;
  store.draftName='Recovered pending name';store.dirty=true;
  const captured=store.recovery();store.resetDraft();
  assert.equal(await store.restoreDraft(captured),true);assert.equal(store.draftName,'Recovered pending name');
  assert.equal(store.dirty,true);assert.equal(f.writes(),0);
  const wrong=structuredClone(captured);wrong.design.nodes[0].label='Other revision';
  assert.equal(await store.restoreDraft(wrong),false);assert.equal(f.writes(),0);
  await store.saveName();assert.equal(f.writes(),1);
});
test('record maintenance uses the same saved session and exact undo/redo', async t => {
  const f=await fixture(t),store=f.store;
  store.open('create');store.form.name='Maintenance page';store.form.parent=f.document().design.nodes.find(n=>n.kind==='view').id;
  await store.applyForm();const id=store.selectedId;assert.equal(store.selected.label,'Maintenance page');
  store.open('route');store.form.name='/maintenance';await store.applyForm();
  const routeId=store.route.id,before=structuredClone(f.document());
  store.reviewRecord('route',routeId);assert.equal(store.recordRemoval.canRemove,true);await store.applyForm();
  assert.equal(f.document().design.sitemap.routes.some(r=>r.id===routeId),false);
  await store.undo();assert.deepEqual(f.document(),before);await store.redo();assert.equal(store.route,undefined);
  store.open('move');assert.equal(store.form.parent,store.selected.parent);assert.notEqual(store.form.parent,id);
  store.cancel();
});
test('restoring invalid removal recovery cannot partially replace the active draft', async t => {
  const f=await fixture(t),store=f.store;
  store.draftName='Keep me';store.dirty=true;const before=store.recovery(),invalid=structuredClone(before);
  invalid.draft.selectedId='missing';invalid.draft.panel='remove';
  assert.equal(await store.restoreDraft(invalid),false);assert.deepEqual(store.recovery(),before);assert.equal(f.writes(),0);
});
