import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp, realpath, cp, rm } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { boundaryProject } from './fixtures/generator-boundaries.mjs';
import { parseDetailControl, copyDetailData } from '../../../templates/companion/runtime/detail-controls.ts';
import { mapDetailPayload, detailValue } from '../../../templates/companion/runtime/detail-actions.ts';
import { projectModel } from '../compiler/emitters/model.ts';
import { projectFiles } from './support/project-render.mjs';
import { visualSpecs } from '../compiler/emitters/visual-model.ts';
import { visualSources } from '../compiler/emitters/visual-ports.ts';
import { noteEntity } from '../compiler/emitters/persistence-code.ts';
import { selfProject } from '#shared/testing/starter-documents.mjs';
import { visualSession, visualVisible } from '#shared/companion/visual/visual-session.mjs';
import { visualLocate } from '#shared/companion/visual/visual-ir.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
// The boundary fixture extends the current (project v6) self-project starter.
const original=selfProject();
const fixture=()=>boundaryProject(original);
const boundaryPage=p=>p.design.visualDesigns.pages.find(page=>page.ownerId==='node-900');
const compile=p=>{const m=projectModel(p);visualSources(m,visualSpecs(m));return m;};
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
test('slot assignments render once and follow host visibility, rejecting cycles, duplicate owners and undeclared slots',()=>{
 const project=fixture(),page=boundaryPage(project),host=visualLocate(page.root,'vn-6006').node,content=host.slots.content[0].children[0].id;
 assert.ok(['default','error'].every(state=>visualVisible(page,{...visualSession(),state},content)));
 host.visibleIn=['default'];
 assert.equal(visualVisible(page,{...visualSession(),state:'error'},content),false);
 for(const variant of ['cycle','duplicate','undeclared']) {
  const p=fixture(),d=boundaryPage(p),n=visualLocate(d.root,'vn-6006').node,store=p.design.visualDesigns,review=store.components.find(c=>c.id==='vc-107');
  if(variant==='cycle')review.template.push({id:'vn-'+store.nextId++,kind:'component',ref:{kind:'project',componentId:'vc-107'},props:{},slots:{},events:[]});
  if(variant==='duplicate')n.slots.content.push(structuredClone(n.slots.content[0]));
  if(variant==='undeclared')n.slots.extra=[];
  assert.throws(()=>compile(p),/cycle|circular|duplicate element ID|slot extra is not declared/i,variant);
 }
});
test('mapped references, literal contracts and native output contracts fail before writes',()=>{
 for(const variant of ['missing-draft','missing-source','wrong-output','wrong-direction','wrong-folder','unknown-implementation']) {
  const p=fixture(),save=visualLocate(boundaryPage(p).root,'vn-6004').node.events[0].actions[0],s=p.design.dataSources.sources.at(-1);
  if(variant==='missing-draft')save.input.fields.values.fields.amount.nodeId='absent';
  if(variant==='missing-source')save.sourceId='absent';
  if(variant==='wrong-output')s.operations[1].output.schema={type:'string'};
  if(variant==='wrong-direction')s.operations[1].direction='read';
  if(variant==='wrong-folder')s.operations[1].resource='Elsewhere';
  if(variant==='unknown-implementation')s.operations[1].implementation.script='do-not-execute';
  assert.throws(()=>{const m=compile(p);noteEntity(m,s.id,s.operations[1].id);},/[Mm]issing|Native|Unsupported|unknown source/);
 }
});
test('native adapters, typed controls, slot content and mapped handlers are generated with custom roots',async()=>{
 const p=fixture();p.settings={codebaseFolder:'product/code',testsFolder:'product/specs'};
 const id=boundaryPage(p).id,files=new Map((await projectFiles(root,projectModel(p))).map(e=>[e.path,e.content]));
 const code=files.get(`product/code/generated/presentation/components/details/${id}.vue`),spec=files.get(`product/code/generated/domain/visual/${id}.ts`);
 for(const part of ['<UCheckbox data-design-node="vn-5996"','<UInput data-design-node="vn-5995"','<USelect data-design-node="vn-5997"','<UTextarea data-design-node="vn-6001"','<template #content>'])assert.ok(code.includes(part),part);
 for(const kind of ['number','checkbox','select','date','datetime-local','json-editor','json-file','markdown-editor','textarea'])assert.ok(spec.includes(`"control":{"kind":"${kind}"`),kind);
 assert.equal((code.match(/data-design-node="vn-6007"/g)||[]).length,1);
 assert.match([...files].filter(([path]) => /^product\/specs\/project\/visual\/definitions(?:-\d+)?\.test\.ts$/.test(path)).map(([, text]) => text).join("\n"),/toHaveBeenCalledWith\(\{"requestId":"boundary-request-1","values":\{"title":"Boundary note","amount":0,"enabled":true,"category":"first","due":"2026-01-01","body":"fixture"\}\}\)/);
 assert.match(files.get('src/bootstrap/features.ts'),/GBoundaryRecord: register\(GBoundaryRecord\)/);
 assert.match(files.get('product/code/generated/infrastructure/sources/boundary-records.ts'),/noteOperations/);
 assert.ok(!files.get('product/code/generated/infrastructure/sources/boundary-records.ts').includes('NotImplementedError'));
 assert.ok(![...files.keys()].some(path=>path.startsWith('product/code/generated/application/interactions/')&&files.get(path).includes('"nodeId":"vn-6004"')));
 assert.ok(files.has('product/specs/project/persistence/boundary-record.test.ts'));
});
// Exact src/bootstrap/features.ts that examples:remove writes; fixed so the check holds in every consumer state.
const removedRegistry="import { createNoteFeatures } from '../application/note-feature';\n\n\n\nimport type { PreferenceService } from '../application/preference-service';\n\n/** Add one explicit registration per feature. Ports are provided once by runtime bootstrap. */\nexport function createFeatures(services: Parameters<typeof createNoteFeatures>[0], preferences: PreferenceService) {\n  void preferences;\n  return createNoteFeatures(services, () => ({\n    \n    \n    \n  }));\n}\n";
test('native repositories extend example-removed and maker-extended registries and refuse other layouts',async()=>{
 const {readRegistry,extendRegistry}=await import('../adapters/makers/registry.ts');
 const consumer=extendRegistry(await readRegistry(root,removedRegistry),{key:'bookmark',local:'bookmarkFeature',from:'../features/bookmarks/bookmark.definition'});
 const template=await realpath(await mkdtemp(join(tmpdir(),'generator-registry-')));
 const skipped=new Set(['.git','node_modules','dist','dist-harness','reports','.fallow','.qualification']);
 const generate=async source=>{await writeFile(join(template,'src/bootstrap/features.ts'),source);return new Map((await projectFiles(template,projectModel(fixture()))).map(e=>[e.path,e.content])).get('src/bootstrap/features.ts');};
 try{
  await cp(root,template,{recursive:true,filter:path=>{const parts=relative(root,path).split(sep);return !skipped.has(parts[0])&&!parts.includes('__pycache__');}});
  for(const source of [removedRegistry,consumer]){
   const registry=await generate(source);
   assert.match(registry,/createNoteFeatures\(services, \(?register\)? => \(\{\n[^]*\n {4}GBoundaryRecord: register\(GBoundaryRecord\),\n[^]*\),\n {2}\}\)\);/);
   assert.ok(!registry.includes('taskFeature'));
  }
  assert.ok((await generate(consumer)).includes('    bookmark: register(bookmarkFeature),\n'));
  for(const source of [consumer.replace('register(bookmarkFeature)','build(bookmarkFeature)'),removedRegistry.replace('() => ({\n','() => ({\n    custom: register(customFeature),\n'),consumer.replace('bookmark:','GBoundaryRecord:')])
   await assert.rejects(generate(source),/customized feature registry|collide/);
 }finally{await rm(template,{recursive:true,force:true});}
});
