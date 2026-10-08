import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, readdir, mkdir, cp } from 'node:fs/promises';
import { fileSymlink } from './support/file-symlink.mjs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { companionStarters, loadDefinitions } from '../adapters/starters/repository.ts';
import { customizeStarter } from '#shared/companion/starters/customize.ts';
import { starterProjection } from '#shared/companion/starters/browser.ts';
import { validateStarterCatalog } from '#shared/companion/starter-contract.mjs';
import { projectModel, symbol } from '../compiler/emitters/model.ts';
import { planProject, applyProject } from '../compiler/adapters/project-plan.ts';
import { AUTHORING_VERSION as COMPANION_VERSION } from '#shared/companion/authoring-contract.ts';
import { validateVisualDesigns } from '#shared/companion/visual/visual-validate.mjs';
import { exampleStarterIds } from '#shared/testing/starter-documents.mjs';
import { retiredProject } from '#shared/testing/retired-projects.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),examples=new Set(exampleStarterIds());
// The twelve focused example starters: eleven converted once from their v5 models, plus the agent-ready tooling preset, all project v6.
const starters=companionStarters(await loadDefinitions(root)).filter(entry=>examples.has(entry.definition.id));
const starter=id=>starters.find(entry=>entry.definition.id===id);
// The current authoring workspace projects the same definitions into its session catalog.
const catalog={schemaVersion:1,starters:starters.map(entry=>starterProjection(entry.definition,entry.sha256))};
// Page counts equal the page designs each starter carries.
const pageCounts={blank:0,'agent-ready':0,'command-utility':3,'note-inspector':3,'quick-capture':4,'tasks-projects':4,'knowledge-collection':4,'daily-journal':4,'vault-dashboard':4,'import-integration':4,'custom-file-view':3,'context-menu':3};
const choices={id:'my-new-plugin',name:'My New Plugin',author:'Test Author',description:'Independent project copy',version:'0.1.0',codebaseFolder:'src',testsFolder:'tests'};
async function temporary(work){const folder=await mkdtemp(join(tmpdir(),'project-starters-'));try{return await work(folder);}finally{await rm(folder,{recursive:true,force:true});}}
test('twelve example starters include a genuinely domain-free minimal shell',()=>{
 assert.equal(starters.length,12);assert.equal(validateStarterCatalog(catalog),catalog);
 const blank=starter('blank').document.design;
 assert.equal(blank.nodes.length,2);assert.equal(blank.nodes[0].kind,'view');assert.equal(blank.nodes[1].kind,'settings');
 assert.equal(blank.semantic.entities.length,0);assert.equal(blank.dataSources.sources.length,0);assert.equal(blank.prds.length,0);assert.equal(blank.library.length,0);
 assert.equal('detailDesigns' in blank,false);assert.deepEqual([blank.visualDesigns.pages.length,blank.visualDesigns.components.length,blank.visualDesigns.layouts.length,blank.visualDesigns.revisions.length],[0,0,0,0]);
});
test('agent-ready is an explicit inert tooling preset over the same blank product surface',()=>{
 const d=starter('agent-ready').document;
 assert.equal(d.design.blueprint,'blank');assert.equal(d.design.semantic.entities.length,0);assert.equal(d.design.prds.length,0);
 assert.deepEqual(d.tooling.airship,{enabled:true,agent:'claude',targetPort:5173,port:5174});
 assert.deepEqual(d.tooling.hindsight,{enabled:true,agents:['claude-code','codex'],git:'message',sessions:false});
 assert.match(d.notes.at(-1),/does not install Hindsight/);
});
for(const loaded of starters){
 const entry={id:loaded.definition.id,sha256:loaded.sha256,document:loaded.document};
 test(entry.id+': visual designs are current v'+COMPANION_VERSION+' pages over its own surfaces',()=>{
  const d=entry.document.design,v=d.visualDesigns;
  assert.equal(entry.document.schemaVersion,COMPANION_VERSION);assert.equal(d.schema,COMPANION_VERSION);assert.equal('detailDesigns' in d,false);
  assert.equal(v.pages.length,pageCounts[entry.id]);assert.deepEqual([v.components.length,v.revisions.length],[0,0]);
  const surfaces=new Set(d.nodes.map(n=>n.id));assert.ok(v.pages.every(p=>surfaces.has(p.ownerId)));
  validateVisualDesigns(v,{surfaces,library:new Set(d.library.map(l=>l.id)),sources:new Map(d.dataSources.sources.map(s=>[s.id,new Set(s.operations.map(o=>o.id))]))});
 });
 test(entry.id+': immutable independent copy, compatible compiler model and explicit native boundary',()=>{
  const before=JSON.stringify(loaded.document),document=customizeStarter(loaded,choices),model=projectModel(document);
  assert.deepEqual(document.project,Object.fromEntries(['id','name','author','description','version'].map(k=>[k,choices[k]])));
  assert.equal(JSON.stringify(loaded.document),before);assert.notEqual(document,entry.document);assert.notEqual(document.design,entry.document.design);
  assert.deepEqual(document.design,entry.document.design);assert.equal(document.executable,false);assert.equal(document.schemaVersion,COMPANION_VERSION);
  assert.ok(document.notes.at(-1).includes(entry.sha256));assert.ok(document.notes.at(-1).includes('independent editable copy'));
  assert.equal(model.screens.length,document.design.nodes.length);assert.ok(model.warnings.length>0);
  assert.ok(model.requirements.every(r=>r.status!=='tested' && r.status!=='done'));
  const other=customizeStarter(loaded,{...choices,id:'another-plugin'});document.design.nodes[0].label='Edited';assert.notEqual(other.design.nodes[0].label,'Edited');
 });
 test(entry.id+': real plan/apply yields an independent workspace, safe replay and owned input',()=>temporary(async vault=>{
  const document=customizeStarter(loaded,choices),input=join(vault,'project.json');await writeFile(input,JSON.stringify(document));await writeFile(join(vault,'keep.md'),'keep');
  const options={input,vault,target:'plugin',templateRoot:root},plan=await planProject(options);assert.equal(plan.conflicts.length,0);assert.deepEqual((await readdir(vault)).sort(),['keep.md','project.json']);
  await assert.rejects(applyProject(plan,'not-a-reviewed-hash'),/stale/);await applyProject(plan,plan.hash);
  const target=join(vault,'plugin'),pkg=JSON.parse(await readFile(join(target,'package.json'),'utf8'));
  assert.equal(pkg.name,'my-new-plugin');assert.ok(pkg.scripts['verify:project']);assert.match(await readFile(join(target,'src/plugin/main.ts'),'utf8'),/initializeProject/);
  assert.deepEqual(JSON.parse(await readFile(join(target,'design/project.json'),'utf8')),document);
  const trace=JSON.parse(await readFile(join(target,'design/traceability.json'),'utf8'));assert.ok(trace.requirements.every(r=>r.verification==='todo'));
  if(!['blank','agent-ready'].includes(entry.id))assert.ok(trace.requirements.length>=4);
  if(entry.document.design.dataSources.sources.length){
   assert.match(await readFile(join(target,'src/plugin/generated/presentation/stores/starter-records.ts'),'utf8'),/defineStore/);
   const source=document.design.dataSources.sources[0],module=await import(pathToFileURL(join(target,'src/plugin/generated/infrastructure/sources/starter-records.ts')).href);
   const create=module.createGStarterRecordsAdapter;
   if(source.kind==='vault'){
    const entity=document.design.semantic.entities.find(e=>e.id===source.operations[0].output.entity);let reads=0;
    const port=create({repositories:{[symbol(entity.slug)]:{list:async()=>{reads++;return {ok:true,value:[{id:'fixture',values:{title:'Fixture'}}]};}}}});
    assert.deepEqual(await port['list-records'](undefined),[{id:'fixture',type:entity.slug,title:'Fixture'}]);assert.equal(reads,1);
    await assert.rejects(port['list-records'](undefined,AbortSignal.abort()),/OPERATION_ABORTED/);assert.equal(reads,1);
   }else{
    const port=create({repositories:{}});
    await assert.rejects(port['list-records'](undefined),/HTTP_ORIGIN_NOT_APPROVED/);
   }
  }
  const replay=await planProject(options);assert.equal(replay.conflicts.length,0);assert.ok(replay.plan.changes.every(c=>c.status==='unchanged'),JSON.stringify(replay.plan.changes.filter(c=>c.status!=='unchanged').map(({path,status})=>({path,status}))));assert.equal(await readFile(join(vault,'keep.md'),'utf8'),'keep');
 }));
}
test('import starter is explicitly fixture-first, unauthenticated and never automatic',()=>{
 const d=starter('import-integration').document.design,s=d.dataSources.sources[0];
 assert.equal(s.locator,'https://example.invalid');assert.equal(s.auth,'none');assert.equal(s.credentialRef,'');assert.ok(d.dataSources.flows.every(f=>f.trigger==='manual'));assert.ok(s.operations.every(o=>o.direction==='read'));
});
for(const [label,fields,pattern] of [
 ['invalid plugin ID',{id:'../other'},/ID|id/],['empty name',{name:''},/name/i],['newline identity',{name:'one\ntwo'},/name/i],['invalid version',{version:'latest'},/version/i],
 ['absolute source',{codebaseFolder:'/tmp/src'},/relative/],['traversal source',{codebaseFolder:'../src'},/relative/],['host folder',{testsFolder:'.obsidian'},/reserved|protected/i],['overlapping paths',{codebaseFolder:'app',testsFolder:'APP/specs'},/overlap/i],['tooling collision',{codebaseFolder:'scripts'},/tooling/i],['unknown choice',{runScript:'evil'},/Unknown configuration/],
])test('refuses '+label+' without altering the starter',()=>{const before=JSON.stringify(starter('quick-capture').document);assert.throws(()=>customizeStarter(starter('quick-capture'),{...choices,...fields}),pattern);assert.equal(JSON.stringify(starter('quick-capture').document),before);});
test('a source project keeps its tests in its own tests folder without changing the starter',()=>{
 const original=JSON.stringify(starter('quick-capture').document);
 const document=customizeStarter(starter('quick-capture'),{...choices,codebaseFolder:'src/plugin',testsFolder:'src/plugin/tests'});
 assert.deepEqual(document.settings,{codebaseFolder:'src/plugin',testsFolder:'src/plugin/tests'});
 assert.equal(JSON.stringify(starter('quick-capture').document),original);
});
for(const [label,mutate] of [
 ['catalog version',c=>c.schemaVersion=99],['extra executable field',c=>c.starters[0].script='alert(1)'],['duplicate ID',c=>c.starters[1].id=c.starters[0].id],['invalid name',c=>c.starters[0].name=''],['path traversal',c=>c.starters[0].file='../blank.json'],['future project version',c=>c.starters[0].document.schemaVersion=99],['execution authority',c=>c.starters[0].document.executable=true],['unknown top field',c=>c.install=true],['empty metadata',c=>c.starters[0].implementation=[]],['invalid identity hash',c=>c.starters[0].sha256='pretend'],
])test('catalog rejects '+label,()=>{const c=structuredClone(catalog);mutate(c);assert.throws(()=>validateStarterCatalog(c));});
test('catalog rejects a retired v4 document: starters carry only project schema 6',()=>{
 const c=structuredClone(catalog);c.starters[0].document=retiredProject(4);
 assert.throws(()=>validateStarterCatalog(c),/Starters require project schema 6/);
});
test('case-sensitive identity changes do not replace domain words or authored content',()=>{
 const source=starter('quick-capture').document;const document=customizeStarter(starter('quick-capture'),{...choices,name:'<b>Not HTML</b>'});
 assert.equal(document.project.name,'<b>Not HTML</b>');assert.deepEqual(document.design,source.design);assert.equal(document.design.nodes.find(n=>n.slug==='capture').label,'Capture an idea');
});
for(const [label,change] of [
 ['malformed data',async f=>writeFile(join(f,'blank.json'),'{bad')],
 ['invalid unlisted source',async f=>writeFile(join(f,'unlisted.json'),'{}')],
 ['symlink source',async (f,t)=>{const p=join(f,'blank.json');await rm(p);return fileSymlink(t,join(root,'package.json'),p);}]
])test('file loader rejects '+label,t=>temporary(async folder=>{const f=join(folder,'configs/starters');await mkdir(f,{recursive:true});await cp(join(root,'configs/starters'),f,{recursive:true});if(await change(f,t)===false)return;await assert.rejects(loadDefinitions(folder));}));
test('an edited valid definition has a new hash without needing a catalog rewrite',()=>temporary(async folder=>{
 const f=join(folder,'configs/starters');await mkdir(f,{recursive:true});await cp(join(root,'configs/starters'),f,{recursive:true});
 const blank=async()=>companionStarters(await loadDefinitions(folder)).find(entry=>entry.definition.id==='blank');
 const before=await blank(),p=join(f,'blank.json');await writeFile(p,(await readFile(p,'utf8'))+' ');
 const after=await blank();assert.notEqual(after.sha256,before.sha256);
}));
test('a v6 starter with tooling keeps the 4 MB transfer limit for the whole document',()=>{
 const c=structuredClone(catalog),d=c.starters.find(s=>s.id==='agent-ready').document;
 assert.equal(d.schemaVersion,6);assert.ok(d.tooling,'agent-ready carries development tooling');
 const tooling=d.tooling;delete d.tooling;
 const size=()=>new TextEncoder().encode(JSON.stringify(d)).length,fill=4_000_000-Buffer.byteLength(JSON.stringify(tooling));
 while(size()+100_010<fill)d.notes.push('x'.repeat(100_000));
 d.notes.push('x'.repeat(fill-size()-3));
 assert.ok(size()<=4_000_000);assert.equal(validateStarterCatalog(c),c,'the document without tooling is within the limit');
 d.tooling=tooling;
 // The v6 contract bounds the complete JSON document, tooling included, at the same 4 MB.
 assert.ok(size()>4_000_000);assert.throws(()=>validateStarterCatalog(c),{code:'SITEMAP_LIMIT'});
});
test('an installation may omit blank and have no bundled fallback',()=>{
 const c=structuredClone(catalog);c.starters=c.starters.filter(s=>s.id!=='blank');assert.equal(validateStarterCatalog(c),c);
});
test('starter sources are LF-only bytes and the repository pins LF checkout for every platform',async()=>{
 const folder=join(root,'configs/starters');
 for(const name of await readdir(folder))assert.ok(!(await readFile(join(folder,name))).includes(13),name+' contains a carriage return');
 assert.match(await readFile(join(root,'.gitattributes'),'utf8'),/^\* text=auto eol=lf$/m);
});
