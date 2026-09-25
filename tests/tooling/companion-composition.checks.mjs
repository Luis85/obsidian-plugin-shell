import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { validateDetailDesigns, emptyDetailDesigns } from '../../scripts/companion/detail-contract.mjs';
import { validateCompanionDocument } from '../../scripts/companion/project-contract.mjs';
import { compositionDefaultUI, compositionSession, compositionTransition, compositionVisible, compositionStyle, compositionTheme, compositionTestSource, validateCompositionUI } from '../../scripts/companion/composition-contract.mjs';
const seed=JSON.parse(await readFile('docs/concepts/companion/companion-project.json','utf8'));
const clone=()=>structuredClone(seed), store=()=>clone().design.detailDesigns;
const context=vm.createContext({emptyDetailDesigns,compositionDefaultUI,compositionStyle,structuredClone});
vm.runInContext(await readFile('docs/concepts/companion/src/detail-model.js','utf8'),context);
vm.runInContext(await readFile('docs/concepts/companion/src/composition-model.js','utf8'),context);
const page=s=>s.documents.find(d=>d.kind==='page' && d.nodes.some(n=>n.component && d.nodes.some(c=>c.parentId===n.id)));
test('v4 self-project covers every eligible page and library definition with valid frozen dependencies',()=>{
 assert.equal(validateCompanionDocument(seed),seed);const s=validateDetailDesigns(store());
 assert.equal(s.documents.length,81);assert.equal(s.revisions.length,54);
 assert.deepEqual(s.documents.filter(d=>d.kind==='page').map(d=>d.ownerId).sort(),seed.design.nodes.filter(n=>['page','modal','settings'].includes(n.kind)).map(n=>n.id).sort());
 assert.deepEqual(s.documents.filter(d=>d.kind==='component').map(d=>d.ownerId).sort(),seed.design.library.map(c=>c.id).sort());
 assert.ok(s.documents.every(d=>d.scenarios?.length>=2));assert.ok(s.documents.flatMap(d=>d.nodes).filter(n=>n.component).every(n=>n.component.revisionId));
});
test('all 80 seeded canvases have contained children and no sibling overlap',()=>{
 for(const doc of store().documents) for(const node of doc.nodes){
  const parent=doc.nodes.find(n=>n.id===node.parentId);
  if(parent){assert.ok(node.position.x>=0 && node.position.y>=0);assert.ok(node.position.x+node.size.width<=parent.size.width,doc.ownerId+'/'+node.label);assert.ok(node.position.y+node.size.height<=parent.size.height,doc.ownerId+'/'+node.label);}
  for(const other of doc.nodes.filter(n=>n.id!==node.id&&n.parentId===node.parentId)) assert.ok(node.position.x+node.size.width<=other.position.x||other.position.x+other.size.width<=node.position.x||node.position.y+node.size.height<=other.position.y||other.position.y+other.size.height<=node.position.y,doc.ownerId+' overlap');
 }
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
 const n=structuredClone(seed.design.detailDesigns.documents[0].nodes[0]);n.ui=compositionDefaultUI();n.layout='grid';n.ui.columns=3;n.ui.tokens.gap='md';const before=JSON.stringify(n),ds=seed.design.designSystem;
 assert.equal(compositionStyle(n,ds).gridTemplateColumns,'repeat(3, minmax(0, 1fr))');assert.equal(compositionStyle(n,ds,true).flexDirection,'column');assert.equal(compositionStyle(n,ds,true).gridTemplateColumns,'repeat(1, minmax(0, 1fr))');
 const token=ds.spacing.find(t=>t.id==='md');assert.equal(compositionStyle(n,ds).gap,token.value+token.unit);assert.equal(JSON.stringify(n),before);
 for(const color of ds.colors) {assert.equal(compositionTheme(ds,false)['--composition-color-'+color.id],color.light);assert.equal(compositionTheme(ds,true)['--composition-color-'+color.id],color.dark);}
});
test('revision retention rejects mutation while preserving immutable IDs over undo',()=>{
 const original=store(),next=structuredClone(original);next.revisions=[];context.cpRetainRevisions(next,original);assert.deepEqual(JSON.parse(JSON.stringify(next.revisions)),original.revisions);
 next.revisions[0].document.notes+=' changed';assert.throws(()=>context.cpRetainRevisions(next,original),/cannot be edited/);
});
test('arrange is deterministic and does not change reading order or content',()=>{
 const d=store().documents.find(d=>d.kind==='page');const ids=d.nodes.map(n=>n.id),texts=d.nodes.map(n=>n.text);context.cpArrange(d);const once=JSON.stringify(d);context.cpArrange(d);assert.equal(JSON.stringify(d),once);assert.deepEqual(d.nodes.map(n=>n.id),ids);assert.deepEqual(d.nodes.map(n=>n.text),texts);
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
