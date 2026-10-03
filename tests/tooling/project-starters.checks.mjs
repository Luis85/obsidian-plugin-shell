import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, readdir, mkdir, cp } from 'node:fs/promises';
import { fileSymlink } from './file-symlink.mjs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadStarterCatalog } from '../../bin/adapters/starters/catalog.ts';
import { validateStarterCatalog, customizeStarter } from '../../scripts/companion/starter-contract.mjs';
import { projectModel, symbol } from '../../bin/compiler/emitters/model.ts';
import { planProject, applyProject } from '../../bin/compiler/adapters/project-plan.ts';
import { COMPANION_VERSION } from '../../scripts/companion/project-contract.mjs';
import { validateVisualDesigns } from '../../scripts/companion/visual/visual-validate.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),allCatalog=await loadStarterCatalog(root);
// These retained migration assertions stay scoped to the original eleven v5 fixtures.
const catalog={schemaVersion:1,starters:allCatalog.starters.filter(entry=>entry.document.schemaVersion===5)};
// Page counts equal the page documents each starter held before the visual-design migration.
const pageCounts={blank:0,'agent-ready':0,'command-utility':3,'note-inspector':3,'quick-capture':4,'tasks-projects':4,'knowledge-collection':4,'daily-journal':4,'vault-dashboard':4,'import-integration':4,'custom-file-view':3,'context-menu':3};
const choices={id:'my-new-plugin',name:'My New Plugin',author:'Test Author',description:'Independent project copy',version:'0.1.0',codebaseFolder:'src',testsFolder:'tests'};
async function temporary(work){const folder=await mkdtemp(join(tmpdir(),'project-starters-'));try{return await work(folder);}finally{await rm(folder,{recursive:true,force:true});}}
test('twelve data-only starters retain a genuinely domain-free blank shell',()=>{
 assert.equal(catalog.starters.length,12);assert.equal(validateStarterCatalog(catalog),catalog);
 const blank=catalog.starters.find(s=>s.id==='blank').document.design;
 assert.equal(blank.nodes.length,2);assert.equal(blank.nodes[0].kind,'view');assert.equal(blank.nodes[1].kind,'settings');
 assert.equal(blank.semantic.entities.length,0);assert.equal(blank.dataSources.sources.length,0);assert.equal(blank.prds.length,0);assert.equal(blank.library.length,0);
 assert.equal('detailDesigns' in blank,false);assert.deepEqual([blank.visualDesigns.pages.length,blank.visualDesigns.components.length,blank.visualDesigns.layouts.length,blank.visualDesigns.revisions.length],[0,0,0,0]);
});
test('agent-ready is an explicit inert tooling preset over the same blank product surface',()=>{
 const entry=catalog.starters.find(s=>s.id==='agent-ready'),d=entry.document;
 assert.equal(d.design.blueprint,'blank');assert.equal(d.design.semantic.entities.length,0);assert.equal(d.design.prds.length,0);
 assert.deepEqual(d.tooling.airship,{enabled:true,agent:'claude',targetPort:5173,port:5174});
 assert.deepEqual(d.tooling.hindsight,{enabled:true,agents:['claude-code','codex'],git:'message',sessions:false});
 assert.match(d.notes.at(-1),/does not install Hindsight/);
});
for(const entry of catalog.starters){
 test(entry.id+': built-in visual designs are current v'+COMPANION_VERSION+' pages over its own surfaces',()=>{
  const d=entry.document.design,v=d.visualDesigns;
  assert.equal(entry.document.schemaVersion,COMPANION_VERSION);assert.equal(d.schema,COMPANION_VERSION);assert.equal('detailDesigns' in d,false);
  assert.equal(v.pages.length,pageCounts[entry.id]);assert.deepEqual([v.components.length,v.revisions.length],[0,0]);
  const surfaces=new Set(d.nodes.map(n=>n.id));assert.ok(v.pages.every(p=>surfaces.has(p.ownerId)));
  validateVisualDesigns(v,{surfaces,library:new Set(d.library.map(l=>l.id)),sources:new Map(d.dataSources.sources.map(s=>[s.id,new Set(s.operations.map(o=>o.id))]))});
 });
 test(entry.id+': immutable independent copy, compatible compiler model and explicit native boundary',()=>{
  const before=JSON.stringify(catalog),document=customizeStarter(catalog,entry.id,choices),model=projectModel(document);
  assert.deepEqual(document.project,Object.fromEntries(['id','name','author','description','version'].map(k=>[k,choices[k]])));
  assert.equal(JSON.stringify(catalog),before);assert.notEqual(document,entry.document);assert.notEqual(document.design,entry.document.design);
  assert.deepEqual(document.design,entry.document.design);assert.equal(document.executable,false);assert.equal(document.schemaVersion,COMPANION_VERSION);
  assert.ok(document.notes.at(-1).includes(entry.sha256));assert.ok(document.notes.at(-1).includes('independent editable copy'));
  assert.equal(model.screens.length,document.design.nodes.length);assert.ok(model.warnings.length>0);
  assert.ok(model.requirements.every(r=>r.status!=='tested' && r.status!=='done'));
  const other=customizeStarter(catalog,entry.id,{...choices,id:'another-plugin'});document.design.nodes[0].label='Edited';assert.notEqual(other.design.nodes[0].label,'Edited');
 });
 test(entry.id+': real plan/apply yields an independent workspace, safe replay and owned input',()=>temporary(async vault=>{
  const document=customizeStarter(catalog,entry.id,choices),input=join(vault,'project.json');await writeFile(input,JSON.stringify(document));await writeFile(join(vault,'keep.md'),'keep');
  const options={input,vault,target:'plugin',templateRoot:root},plan=await planProject(options);assert.equal(plan.conflicts.length,0);assert.deepEqual((await readdir(vault)).sort(),['keep.md','project.json']);
  await assert.rejects(applyProject(plan,'not-a-reviewed-hash'),/stale/);await applyProject(plan,plan.hash);
  const target=join(vault,'plugin'),pkg=JSON.parse(await readFile(join(target,'package.json'),'utf8'));
  assert.equal(pkg.name,'my-new-plugin');assert.ok(pkg.scripts['verify:project']);assert.match(await readFile(join(target,'src/main.ts'),'utf8'),/initializeProject/);
  assert.deepEqual(JSON.parse(await readFile(join(target,'design/project.json'),'utf8')),document);
  const trace=JSON.parse(await readFile(join(target,'design/traceability.json'),'utf8'));assert.ok(trace.requirements.every(r=>r.verification==='todo'));
  if(!['blank','agent-ready'].includes(entry.id))assert.ok(trace.requirements.length>=4);
  if(entry.document.design.dataSources.sources.length){
   assert.match(await readFile(join(target,'src/generated/presentation/stores/starter-records.ts'),'utf8'),/defineStore/);
   const source=document.design.dataSources.sources[0],module=await import(pathToFileURL(join(target,'src/generated/infrastructure/sources/starter-records.ts')).href);
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
  const replay=await planProject(options);assert.equal(replay.conflicts.length,0);assert.ok(replay.plan.changes.every(c=>c.status==='unchanged'));assert.equal(await readFile(join(vault,'keep.md'),'utf8'),'keep');
 }));
}
test('import starter is explicitly fixture-first, unauthenticated and never automatic',()=>{
 const d=catalog.starters.find(s=>s.id==='import-integration').document.design,s=d.dataSources.sources[0];
 assert.equal(s.locator,'https://example.invalid');assert.equal(s.auth,'none');assert.equal(s.credentialRef,'');assert.ok(d.dataSources.flows.every(f=>f.trigger==='manual'));assert.ok(s.operations.every(o=>o.direction==='read'));
});
for(const [label,fields,pattern] of [
 ['unknown starter',null,/Unknown starter/],['invalid plugin ID',{id:'../other'},/ID|id/],['empty name',{name:''},/name/i],['newline identity',{name:'one\ntwo'},/name/i],['invalid version',{version:'latest'},/version/i],
 ['absolute source',{codebaseFolder:'/tmp/src'},/relative/],['traversal source',{codebaseFolder:'../src'},/relative/],['host folder',{testsFolder:'.obsidian'},/reserved|protected/i],['overlapping paths',{codebaseFolder:'app',testsFolder:'APP/tests'},/overlap/i],['tooling collision',{codebaseFolder:'scripts'},/tooling/i],['unknown choice',{runScript:'evil'},/Unknown configuration/],
])test('refuses '+label+' without altering the catalog',()=>{const before=JSON.stringify(catalog);assert.throws(()=>customizeStarter(catalog,fields===null?'missing':'quick-capture',{...choices,...fields}),pattern);assert.equal(JSON.stringify(catalog),before);});
for(const [label,mutate] of [
 ['catalog version',c=>c.schemaVersion=99],['extra executable field',c=>c.starters[0].script='alert(1)'],['duplicate ID',c=>c.starters[1].id=c.starters[0].id],['invalid name',c=>c.starters[0].name=''],['path traversal',c=>c.starters[0].file='../blank.json'],['future project version',c=>c.starters[0].document.schemaVersion=99],['execution authority',c=>c.starters[0].document.executable=true],['unknown top field',c=>c.install=true],['empty metadata',c=>c.starters[0].implementation=[]],['invalid identity hash',c=>c.starters[0].sha256='pretend'],
])test('catalog rejects '+label,()=>{const c=structuredClone(catalog);mutate(c);assert.throws(()=>validateStarterCatalog(c));});
test('catalog rejects a valid legacy v4 built-in: starters ship current visual designs',()=>{
 const c=structuredClone(catalog),d=c.starters[0].document;d.schemaVersion=4;d.design.schema=4;delete d.design.visualDesigns;d.design.detailDesigns={schema:2,nextId:1,documents:[],revisions:[]};
 assert.throws(()=>validateStarterCatalog(c),/Starters require project v5 or v6/);
});
test('case-sensitive identity changes do not replace domain words or authored content',()=>{
 const source=catalog.starters.find(s=>s.id==='quick-capture').document;const document=customizeStarter(catalog,'quick-capture',{...choices,name:'<b>Not HTML</b>'});
 assert.equal(document.project.name,'<b>Not HTML</b>');assert.deepEqual(document.design,source.design);assert.equal(document.design.nodes.find(n=>n.slug==='capture').label,'Capture an idea');
});
for(const [label,change] of [
 ['malformed data',async f=>writeFile(join(f,'blank.json'),'{bad')],
 ['invalid unlisted source',async f=>writeFile(join(f,'unlisted.json'),'{}')],
 ['symlink source',async (f,t)=>{const p=join(f,'blank.json');await rm(p);return fileSymlink(t,join(root,'package.json'),p);}]
])test('file loader rejects '+label,t=>temporary(async folder=>{const f=join(folder,'configs/starters');await mkdir(f,{recursive:true});await cp(join(root,'configs/starters'),f,{recursive:true});if(await change(f,t)===false)return;await assert.rejects(loadStarterCatalog(folder));}));
test('an edited valid definition has a new hash without needing a catalog rewrite',()=>temporary(async folder=>{
 const f=join(folder,'configs/starters');await mkdir(f,{recursive:true});await cp(join(root,'configs/starters'),f,{recursive:true});
 const before=await loadStarterCatalog(folder),p=join(f,'blank.json');await writeFile(p,(await readFile(p,'utf8'))+' ');
 const after=await loadStarterCatalog(folder),blank=c=>c.starters.find(s=>s.id==='blank');assert.notEqual(blank(after).sha256,blank(before).sha256);
}));
test('an installation may omit blank and have no bundled fallback',()=>{
 const c=structuredClone(catalog);c.starters=c.starters.filter(s=>s.id!=='blank');assert.equal(validateStarterCatalog(c),c);
});
test('starter sources are LF-only bytes and the repository pins LF checkout for every platform',async()=>{
 const folder=join(root,'configs/starters');
 for(const name of await readdir(folder))assert.ok(!(await readFile(join(folder,name))).includes(13),name+' contains a carriage return');
 assert.match(await readFile(join(root,'.gitattributes'),'utf8'),/^\* text=auto eol=lf$/m);
});
