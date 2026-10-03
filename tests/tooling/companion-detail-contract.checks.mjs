// The retained legacy (companion v3/v4) detail and composition contracts. The detail editors are gone; these validators
// still gate legacy imports before their migration to visual designs, and ve-canvas.js resolves composition layout tokens.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { emptyDetailDesigns, validateDetailDesigns, DETAIL_STATES } from '../../scripts/companion/detail-contract.mjs';
import { validateCompanionDocument } from '../../scripts/companion/project-contract.mjs';
import { compositionDefaultUI, compositionSession, compositionTransition, compositionVisible, compositionStyle, compositionTheme, compositionTestSource } from '../../scripts/companion/composition-contract.mjs';
const seed = JSON.parse(await readFile('tests/fixtures/companion/detail-v3.json', 'utf8'));
const copy = value => JSON.parse(JSON.stringify(value));
const fixture = () => copy(seed.design.detailDesigns);
// Legacy record builders with the exact shape the retired editor created, so the structural limits stay provable.
const next = (s, kind) => 'detail-' + kind + '-' + s.nextId++;
function newDocument(s, kind, owner) { const doc = { id: next(s, 'document'), kind, ownerId: owner.id, ownerLabel: owner.label || owner.name, notes: '', nodes: [], edges: [] }; s.documents.push(doc); return doc; }
const newNode = (s, kind, parentId = null, component = null) => ({ id: next(s, 'node'), kind, label: component?.name || (kind === 'region' ? 'Content region' : 'Text'), text: '', parentId,
  layout: 'stack', position: { x: 24, y: 72 }, size: kind === 'region' ? { width: 720, height: 440 } : { width: 240, height: 132 },
  component: component ? { id: component.id, label: component.name, version: component.version, variantId: 'default' } : null, props: {}, binding: null, a11y: '', visibleIn: [...DETAIL_STATES], sourceBrickId: null });
test('v3 self-project includes page and component designs with bounded stable identities', () => {
  assert.equal(seed.schemaVersion, 3); assert.equal(seed.design.schema, 3);
  const store = validateDetailDesigns(fixture());
  assert.deepEqual(store.documents.map(d => d.kind), ['component', 'page', 'page']);
  assert.ok(store.documents.some(d => d.nodes.some(n => n.binding)));
  assert.ok(store.documents.some(d => d.nodes.some(n => n.component)));
  assert.equal(validateCompanionDocument(seed), seed);
  assert.deepEqual(validateDetailDesigns(emptyDetailDesigns()).documents, []);
});
for (const [name, change] of [
  ['future schema', s => s.schema = 999], ['reused counter', s => s.nextId = 1], ['unsafe counter', s => s.nextId = Number.MAX_SAFE_INTEGER],
  ['unknown store field', s => s.executed = true], ['duplicate owner', s => { const d = copy(s.documents[0]); d.id = 'detail-document-' + s.nextId++; s.documents.push(d); }],
  ['duplicate node ID', s => s.documents[0].nodes[1].id = s.documents[0].nodes[0].id],
  ['unknown kind', s => s.documents[0].nodes[1].kind = 'javascript'], ['empty label', s => s.documents[0].nodes[1].label = '  '],
  ['multiline label', s => s.documents[0].nodes[1].label = 'bad\nlabel'], ['oversized text', s => s.documents[0].nodes[1].text = 'x'.repeat(8001)],
  ['infinite position', s => s.documents[0].nodes[1].position.x = Infinity], ['foreign renderer field', s => s.documents[0].nodes[1].selected = true],
  ['too small dimensions', s => s.documents[0].nodes[1].size.width = 0], ['unknown layout', s => s.documents[0].nodes[0].layout = 'script'],
  ['absent parent', s => s.documents[0].nodes[1].parentId = 'missing'], ['non-region parent', s => s.documents[0].nodes[3].parentId = s.documents[0].nodes[1].id],
  ['cyclic parent', s => s.documents[0].nodes[0].parentId = s.documents[0].nodes[0].id], ['empty states', s => s.documents[0].nodes[1].visibleIn = []],
  ['unknown state', s => s.documents[0].nodes[1].visibleIn = ['accepted']], ['duplicate state', s => s.documents[0].nodes[1].visibleIn = ['default', 'default']],
  ['executable prop', s => s.documents[1].nodes.find(n => n.component).props = { run: {} }],
  ['unsafe prop key', s => s.documents[1].nodes.find(n => n.component).props = JSON.parse('{"constructor":"bad"}')],
  ['unbounded version', s => s.documents[1].nodes.find(n => n.component).component.version = '1'.repeat(50) + '.0.0'],
  ['props on primitive', s => s.documents[0].nodes[1].props = { title: 'bad' }], ['no component reference', s => s.documents[1].nodes.find(n => n.component).component = null],
  ['unknown binding field', s => s.documents[2].nodes.find(n => n.binding).binding.expression = 'run()'],
  ['dangling interaction', s => s.documents[0].edges[0].target = 'missing'], ['self interaction', s => s.documents[0].edges[0].target = s.documents[0].edges[0].source],
  ['duplicate interaction', s => { const e = copy(s.documents[0].edges[0]); e.id = 'detail-edge-' + s.nextId++; s.documents[0].edges.push(e); }],
  ['unsafe trigger', s => s.documents[0].edges[0].event = 'click();alert(1)'], ['too many designs', s => s.documents = Array(201).fill(s.documents[0])],
]) test('rejects ' + name, () => { const s = fixture(); validateDetailDesigns(s); change(s); assert.throws(() => validateDetailDesigns(s), /DETAIL_INVALID/); });
test('direct and transitive component composition cycles are rejected', () => {
  const s = emptyDetailDesigns(), a = newDocument(s, 'component', { id: 'a', name: 'A' }), b = newDocument(s, 'component', { id: 'b', name: 'B' });
  const ref = id => ({ id, name: id.toUpperCase(), version: '1.0.0' });
  a.nodes.push(newNode(s, 'component', null, ref('b'))); validateDetailDesigns(s);
  b.nodes.push(newNode(s, 'component', null, ref('a'))); assert.throws(() => validateDetailDesigns(s), /recursive/);
  b.nodes = []; a.nodes[0].component.id = 'a'; assert.throws(() => validateDetailDesigns(s), /recursive/);
});
test('eight containment levels are supported and a ninth is rejected', () => {
  const s = emptyDetailDesigns(), d = newDocument(s, 'page', { id: 'p', label: 'Page' }); let parent = null;
  for (let i = 0; i < 8; i++) { const n = newNode(s, 'region', parent); d.nodes.push(n); parent = n.id; }
  validateDetailDesigns(s); d.nodes.push(newNode(s, 'text', parent)); assert.throws(() => validateDetailDesigns(s), /eight levels/);
});
test('external missing references remain portable while internal broken references fail', () => {
  const s = fixture(); s.documents[1].ownerId = 'missing-page'; s.documents[1].nodes.find(n => n.component).component.id = 'missing-component';
  s.documents[2].nodes.find(n => n.binding).binding.sourceId = 'missing-source'; s.documents[2].edges[0].targetSurfaceId = 'missing-page';
  const doc = copy(seed); doc.design.detailDesigns = s; assert.equal(validateCompanionDocument(doc), doc);
});
test('legacy v1 and v2 imports remain valid; old envelopes cannot conceal detail designs', () => {
  for (const version of [1, 2]) {
    const d = copy(seed); d.schemaVersion = version; d.design.schema = version; delete d.design.detailDesigns; if (version === 1) delete d.design.storymaps;
    validateCompanionDocument(d); d.design.detailDesigns = fixture(); assert.throws(() => validateCompanionDocument(d), /version 3/);
  }
  const mismatch = copy(seed); mismatch.design.schema = 2; assert.throws(() => validateCompanionDocument(mismatch), /versions must match/);
});
test('real CLI returns exact v3 bytes; malformed detail data produces no output and no writes', async () => {
  const vault = await mkdtemp(join(tmpdir(), 'detail-contract-'));
  try {
    const input = join(vault, 'project.json'), text = JSON.stringify(seed, null, 2) + '\r\n'; await writeFile(input, text);
    const run = () => spawnSync(process.execPath, ['scripts/companion-tools/generate.mjs', '--input', input, '--vault', vault, '--target', 'new-plugin'], { encoding: 'utf8' });
    let result = run(); assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, text); assert.deepEqual(await readdir(vault), ['project.json']);
    const invalid = copy(seed); invalid.design.detailDesigns.documents[0].nodes[0].parentId = 'missing'; await writeFile(input, JSON.stringify(invalid)); result = run();
    assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert.match(result.stderr, /DETAIL_INVALID/); assert.deepEqual(await readdir(vault), ['project.json']);
  } finally { await rm(vault, { recursive: true, force: true }); }
});

// The last v4 self-project, retained as the legacy composition input after the checked-in project moved to v5 visual designs.
const v4=JSON.parse(await readFile('tests/fixtures/companion/detail-v4.json','utf8'));
const clone=()=>structuredClone(v4), store=()=>clone().design.detailDesigns;
const page=s=>s.documents.find(d=>d.kind==='page' && d.nodes.some(n=>n.component && d.nodes.some(c=>c.parentId===n.id)));
test('v4 self-project covers every eligible page and library definition with valid frozen dependencies',()=>{
 assert.equal(validateCompanionDocument(v4),v4);const s=validateDetailDesigns(store());
 assert.equal(s.documents.length,81);assert.equal(s.revisions.length,54);
 assert.deepEqual(s.documents.filter(d=>d.kind==='page').map(d=>d.ownerId).sort(),v4.design.nodes.filter(n=>['page','modal','settings'].includes(n.kind)).map(n=>n.id).sort());
 assert.deepEqual(s.documents.filter(d=>d.kind==='component').map(d=>d.ownerId).sort(),v4.design.library.map(c=>c.id).sort());
 assert.ok(s.documents.every(d=>d.scenarios?.length>=2));assert.ok(s.documents.flatMap(d=>d.nodes).filter(n=>n.component).every(n=>n.component.revisionId));
});
for(const [name,alter] of [
 ['CSS injection',s=>s.documents[0].nodes[0].ui.tokens.color='red;url(x)'],
 ['invalid padding',s=>s.documents[0].nodes[0].ui.padding=-1],
 ['invalid width',s=>s.documents[0].nodes[0].ui.width=Infinity],
 ['unknown responsive rule',s=>s.documents[0].nodes[0].ui.narrow.media='@import'],
 ['missing snapshot',s=>s.documents.find(d=>d.nodes.some(n=>n.component)).nodes.find(n=>n.component).component.revisionId='detail-revision-999999'],
 ['changed snapshot owner',s=>s.revisions[0].ownerId='different'],
 ['unpinned published dependency',s=>{const doc=s.revisions[0].document,n=structuredClone(page(s).nodes.find(n=>n.component));n.id='detail-node-'+s.nextId++;n.parentId=doc.nodes[0].id;delete n.component.revisionId;doc.nodes.push(n);}],
 ['wrong snapshot slot',s=>{const doc=page(s),n=doc.nodes.find(n=>n.component);doc.nodes.find(c=>c.parentId===n.id).slotName='notDeclared';}],
 ['fixture dangling ID',s=>s.documents[0].scenarios[0].values.notAnElement='bad'],
 ['fixture unsafe key',s=>s.documents[0].scenarios[0].bindings=[{sourceId:'src',operationId:'op',value:JSON.parse('{"__proto__":{}}')}]],
 ['ambiguous effect',s=>{const d=s.documents.find(d=>d.edges.some(e=>e.effect));d.edges.find(e=>e.effect).targetSurfaceId='page';}],
 ['unknown effect',s=>s.documents.find(d=>d.edges.some(e=>e.effect)).edges.find(e=>e.effect).effect.type='eval'],
 ['snapshot unsafe token',s=>s.revisions[0].designSystem.colors[0].light='url(javascript:x)']
]) test('composition import rejects '+name,()=>{const s=store();alter(s);assert.throws(()=>validateDetailDesigns(s));});
test('v3 cannot smuggle composition declarations or snapshots',()=>{const d=clone();d.schemaVersion=3;d.design.schema=3;assert.throws(()=>validateCompanionDocument(d));});
test('typed layout resolves tokens and narrow semantics without mutating authored geometry',()=>{
 const n=structuredClone(v4.design.detailDesigns.documents[0].nodes[0]);n.ui=compositionDefaultUI();n.layout='grid';n.ui.columns=3;n.ui.tokens.gap='md';const before=JSON.stringify(n),ds=v4.design.designSystem;
 assert.equal(compositionStyle(n,ds).gridTemplateColumns,'repeat(3, minmax(0, 1fr))');assert.equal(compositionStyle(n,ds,true).flexDirection,'column');assert.equal(compositionStyle(n,ds,true).gridTemplateColumns,'repeat(1, minmax(0, 1fr))');
 const token=ds.spacing.find(t=>t.id==='md');assert.equal(compositionStyle(n,ds).gap,token.value+token.unit);assert.equal(JSON.stringify(n),before);
 for(const color of ds.colors) {assert.equal(compositionTheme(ds,false)['--composition-color-'+color.id],color.light);assert.equal(compositionTheme(ds,true)['--composition-color-'+color.id],color.dark);}
});
test('all declared UI effects and navigation transition without modifying design or input fixture',()=>{
 for(const d of store().documents) for(const e of d.edges.filter(e=>e.effect||e.targetSurfaceId)){
  const state=['default','empty','error'].find(state=>compositionVisible(d,{state},d.nodes.find(n=>n.id===e.source)));assert.ok(state);
  const session=compositionSession();session.state=state;const before=JSON.stringify([d,session]);const next=compositionTransition(d,session,e.id);
  if(e.targetSurfaceId)assert.equal(next.navigation,e.targetSurfaceId);
  if(e.effect?.type==='focus')assert.equal(next.focused,e.target);
  if(e.effect?.type==='state')assert.equal(next.state,e.effect.value);
  assert.equal(JSON.stringify([d,session]),before);
 }
});
test('generated standalone UI-effect suite executes assertions and fails under a negative control',async()=>{
 const d=store().documents.find(d=>d.edges.some(e=>e.effect?.type==='focus'));const dir=await mkdtemp(join(tmpdir(),'composition-tests-'));
 try{const path=join(dir,'effects.checks.mjs'),source=compositionTestSource(d);await writeFile(path,source);const good=spawnSync(process.execPath,['--test',path],{encoding:'utf8',env:Object.fromEntries(Object.entries(process.env).filter(([key])=>key!=='NODE_TEST_CONTEXT'))});assert.equal(good.status,0,good.stdout+good.stderr);
 await writeFile(path,source.replace('next.focused = edge.target','next.focused = "wrong"'));const bad=spawnSync(process.execPath,['--test',path],{encoding:'utf8',env:Object.fromEntries(Object.entries(process.env).filter(([key])=>key!=='NODE_TEST_CONTEXT'))});assert.notEqual(bad.status,0);assert.match(bad.stdout,/fail [1-9]/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('hidden ancestors, narrow exclusion and disabled states prevent UI dispatch',()=>{
 const d=store().documents.find(d=>d.edges.some(e=>e.effect));const e=d.edges.find(e=>e.effect),source=d.nodes.find(n=>n.id===e.source);const session=compositionSession();session.state='disabled';assert.throws(()=>compositionTransition(d,session,e.id));session.state='default';session.hidden[source.parentId]=true;assert.equal(compositionVisible(d,session,source),false);assert.throws(()=>compositionTransition(d,session,e.id));
});
test('slot kind and cardinality declarations reject invalid pinned instance content',()=>{
 const s=store(),doc=page(s),n=doc.nodes.find(n=>n.component),child=doc.nodes.find(c=>c.parentId===n.id),r=s.revisions.find(r=>r.id===n.component.revisionId),slot=r.document.nodes.find(n=>n.kind==='slot'&&n.label===child.slotName);slot.slotKinds=['region'];assert.throws(()=>validateDetailDesigns(s),/kind/);slot.slotKinds=[];slot.slotCapacity='one';const another=structuredClone(child);another.id='detail-node-'+s.nextId++;doc.nodes.push(another);assert.throws(()=>validateDetailDesigns(s),/one root/);
});
