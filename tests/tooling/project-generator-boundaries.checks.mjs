import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { boundaryProject } from '../fixtures/generator-boundaries.mjs';
import { parseDetailControl, copyDetailData } from '../../scripts/companion/runtime/detail-controls.ts';
import { mapDetailPayload } from '../../scripts/companion/runtime/detail-actions.ts';
import { detailValue, visibleDetails } from '../../scripts/companion/runtime/detail-runtime.ts';
import { projectModel } from '../../scripts/companion/compiler/model.ts';
import { projectFiles } from '../../scripts/companion/compiler/project-files.ts';
import { detailDocuments } from '../../scripts/companion/compiler/detail-model.ts';
import { noteEntity } from '../../scripts/companion/compiler/persistence-code.ts';
import { validateDetailDesigns } from '../../scripts/companion/detail-contract.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const original=JSON.parse(await readFile(new URL('../../docs/concepts/companion/companion-project.json',import.meta.url),'utf8'));
const fixture=()=>boundaryProject(original);
for(const [kind,raw,value] of [['number','0',0],['number','-2.5',-2.5],['number','',null],['checkbox',false,false],['checkbox',true,true],['json-editor','{"active":false,"count":0}',{active:false,count:0}],['json-file','[1,2]',[1,2]],['date','2024-02-29','2024-02-29'],['markdown-editor','# Test\n<script>inert</script>','# Test\n<script>inert</script>']]) test('typed control '+kind+' preserves '+JSON.stringify(raw),()=>assert.deepEqual(parseDetailControl(raw,{kind}),value));
for(const [kind,raw] of [['number','NaN'],['number','1e999'],['checkbox','false'],['date','2025-02-29'],['date','2026-01-01suffix'],['datetime-local','2026-01-01T25:00'],['json-editor','{bad}'],['json-file','{"__proto__":{}}']]) test('typed control rejects '+kind+' '+raw,()=>assert.throws(()=>parseDetailControl(raw,{kind})));
test('required, declared options and UTF8 byte limits fail closed',()=>{
 assert.throws(()=>parseDetailControl('',{kind:'text',required:true}));
 assert.throws(()=>parseDetailControl('foreign',{kind:'select',options:[{label:'First',value:'first'}]}));
 assert.throws(()=>parseDetailControl('éé',{kind:'text',maxBytes:3}));
});
test('payload cloning and projections never execute getters or accept sparse/cyclic data',()=>{
 let calls=0; const object={get dangerous(){calls++;return 1;}};
 assert.throws(()=>copyDetailData(object)); assert.equal(detailValue(object,'dangerous'),undefined);
 const array=[]; Object.defineProperty(array,0,{enumerable:true,get(){calls++;return 2;}});
 assert.throws(()=>copyDetailData(array)); assert.throws(()=>copyDetailData(new Array(2)));
 const cyclic={};cyclic.self=cyclic;assert.throws(()=>copyDetailData(cyclic),/LIMIT/);assert.equal(calls,0);
});
test('payload maps typed draft, source, prop and event values without coercion',()=>{
 const context={values:{a:0,b:false},props:{title:''},payload:{id:'x'},read:()=>[{id:'a'}]};
 const mapped=mapDetailPayload({kind:'object',fields:{amount:{kind:'draft',nodeId:'a'},active:{kind:'draft',nodeId:'b'},title:{kind:'prop',name:'title'},id:{kind:'source',sourceId:'s',operationId:'o',field:'0.id'},event:{kind:'event'}}},context);
 assert.deepEqual(mapped,{amount:0,active:false,title:'',id:'a',event:{id:'x'}});
 assert.notEqual(mapped.event,context.payload); assert.throws(()=>mapDetailPayload({kind:'draft',nodeId:'absent'},context),/MISSING/);
 assert.throws(()=>mapDetailPayload({kind:'event'},{...context,payload:new Date()}),/INVALID/);
});
test('legacy schema remains identical; executable metadata explicitly requires schema 2',()=>{
 const legacy=structuredClone(original.design.detailDesigns);assert.equal(validateDetailDesigns(legacy),legacy);
 legacy.documents[1].nodes[1].control={kind:'number'};assert.throws(()=>validateDetailDesigns(legacy),/schema 2/);
 assert.equal(validateDetailDesigns(fixture().design.detailDesigns).schema,2);
});
test('slot assignments render once and follow host visibility, rejecting cycles/duplicate owners',()=>{
 const project=fixture(),doc=detailDocuments(projectModel(project)).at(-1);
 doc.nodes.find(n=>n.id==='detail-node-111').visibleIn=['default'];
 assert.ok(!visibleDetails(doc,'error').some(n=>n.id==='detail-node-113'));
 for(const variant of ['cycle','duplicate','nonroot']) {
  const p=fixture(),d=p.design.detailDesigns.documents.at(-1),n=d.nodes.find(n=>n.id==='detail-node-111');
  if(variant==='cycle')n.slots.content=['detail-node-101'];
  if(variant==='duplicate')n.slots.extra=['detail-node-112'];
  if(variant==='nonroot')n.slots.content=['detail-node-113'];
  assert.throws(()=>detailDocuments(projectModel(p)),/Slot|slot/);
 }
});
test('mapped references, literal contracts and native output contracts fail before writes',()=>{
 for(const variant of ['missing-draft','missing-source','wrong-output','wrong-direction','wrong-folder','unknown-implementation']) {
  const p=fixture(),d=p.design.detailDesigns.documents.at(-1),s=p.design.dataSources.sources.at(-1);
  if(variant==='missing-draft')d.edges[0].action.input.fields.values.fields.amount.nodeId='absent';
  if(variant==='missing-source')d.edges[0].action.sourceId='absent';
  if(variant==='wrong-output')s.operations[1].output.schema={type:'string'};
  if(variant==='wrong-direction')s.operations[1].direction='read';
  if(variant==='wrong-folder')s.operations[1].resource='Elsewhere';
  if(variant==='unknown-implementation')s.operations[1].implementation.script='do-not-execute';
  assert.throws(()=>{const m=projectModel(p);detailDocuments(m);noteEntity(m,s.id,s.operations[1].id);},/[Mm]issing|Native|Unsupported/);
 }
});
test('native adapters, typed controls, slot content and mapped handlers are generated with custom roots',async()=>{
 const p=fixture();p.settings={codebaseFolder:'product/code',testsFolder:'product/specs'};
 const files=new Map((await projectFiles(root,projectModel(p))).map(e=>[e.path,e.content]));
 const code=files.get('product/code/generated/presentation/components/details/detail-document-100.vue');
 for(const part of ['type="checkbox"','type="number"','type="file"','<textarea','<select','<template #content>'])assert.ok(code.includes(part),part);
 assert.equal((code.match(/data-design-node="detail-node-112"/g)||[]).length,1);
 assert.match(files.get('src/bootstrap/features.ts'),/GBoundaryRecord: register\(GBoundaryRecord\)/);
 assert.match(files.get('product/code/generated/infrastructure/sources/boundary-records.ts'),/noteOperations/);
 assert.ok(!files.get('product/code/generated/infrastructure/sources/boundary-records.ts').includes('NotImplementedError'));
 assert.ok(!files.has('product/code/generated/application/interactions/detail-edge-114.ts'));
 assert.ok(files.has('product/specs/project/persistence/boundary-record.test.ts'));
 assert.deepEqual(original.design.detailDesigns.schema,1);
});
