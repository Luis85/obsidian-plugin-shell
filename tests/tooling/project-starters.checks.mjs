import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, readdir, mkdir, cp } from 'node:fs/promises';
import { fileSymlink } from './file-symlink.mjs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadStarterCatalog } from '../../scripts/companion/starter-files.mjs';
import { validateStarterCatalog, customizeStarter } from '../../scripts/companion/starter-contract.mjs';
import { projectModel, symbol } from '../../scripts/companion/compiler/model.ts';
import { planProject, applyProject } from '../../scripts/companion/compiler/plan.ts';
const root=fileURLToPath(new URL('../../',import.meta.url)),catalog=await loadStarterCatalog(root);
const choices={id:'my-new-plugin',name:'My New Plugin',author:'Test Author',description:'Independent project copy',version:'0.1.0',codebaseFolder:'src',testsFolder:'tests'};
async function temporary(work){const folder=await mkdtemp(join(tmpdir(),'project-starters-'));try{return await work(folder);}finally{await rm(folder,{recursive:true,force:true});}}
test('nine original data-only starters include a genuinely domain-free minimal shell',()=>{
 assert.equal(catalog.starters.length,9);assert.equal(validateStarterCatalog(catalog),catalog);
 const blank=catalog.starters.find(s=>s.id==='blank').document.design;
 assert.equal(blank.nodes.length,2);assert.equal(blank.nodes[0].kind,'view');assert.equal(blank.nodes[1].kind,'settings');
 assert.equal(blank.semantic.entities.length,0);assert.equal(blank.dataSources.sources.length,0);assert.equal(blank.prds.length,0);assert.equal(blank.library.length,0);assert.equal(blank.detailDesigns.documents.length,0);
});
for(const entry of catalog.starters){
 test(entry.id+': immutable independent copy, compatible compiler model and explicit native boundary',()=>{
  const before=JSON.stringify(catalog),document=customizeStarter(catalog,entry.id,choices),model=projectModel(document);
  assert.deepEqual(document.project,Object.fromEntries(['id','name','author','description','version'].map(k=>[k,choices[k]])));
  assert.equal(JSON.stringify(catalog),before);assert.notEqual(document,entry.document);assert.notEqual(document.design,entry.document.design);
  assert.deepEqual(document.design,entry.document.design);assert.equal(document.executable,false);assert.equal(document.schemaVersion,4);
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
  if(entry.id!=='blank')assert.ok(trace.requirements.length>=4);
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
 ['catalog version',c=>c.schemaVersion=99],['extra executable field',c=>c.starters[0].script='alert(1)'],['duplicate ID',c=>c.starters[1].id='blank'],['missing blank',c=>c.starters.shift()],['path traversal',c=>c.starters[0].file='../blank.json'],['future project version',c=>c.starters[0].document.schemaVersion=99],['execution authority',c=>c.starters[0].document.executable=true],['unknown top field',c=>c.install=true],['empty metadata',c=>c.starters[0].implementation=[]],['invalid identity hash',c=>c.starters[0].sha256='pretend'],
])test('catalog rejects '+label,()=>{const c=structuredClone(catalog);mutate(c);assert.throws(()=>validateStarterCatalog(c));});
test('case-sensitive identity changes do not replace domain words or authored content',()=>{
 const source=catalog.starters.find(s=>s.id==='quick-capture').document;const document=customizeStarter(catalog,'quick-capture',{...choices,name:'<b>Not HTML</b>'});
 assert.equal(document.project.name,'<b>Not HTML</b>');assert.deepEqual(document.design,source.design);assert.equal(document.design.nodes.find(n=>n.slug==='capture').label,'Capture an idea');
});
for(const [label,change] of [
 ['altered bytes',async f=>{const p=join(f,'blank.companion.json');await writeFile(p,(await readFile(p,'utf8'))+' ');}],
 ['CRLF checkout',async f=>{const p=join(f,'blank.companion.json');await writeFile(p,(await readFile(p,'utf8')).replaceAll('\n','\r\n'));}],
 ['orphan source',async f=>writeFile(join(f,'unlisted.json'),'{}')],
 ['symlink source',async (f,t)=>{const p=join(f,'blank.companion.json');await rm(p);return fileSymlink(t,join(root,'package.json'),p);}],
])test('file loader rejects '+label,t=>temporary(async folder=>{const f=join(folder,'docs/concepts/companion/starters');await mkdir(f,{recursive:true});await cp(join(root,'docs/concepts/companion/starters'),f,{recursive:true});if(await change(f,t)===false)return;await assert.rejects(loadStarterCatalog(folder),/STARTER_INVALID/);}));
test('starter sources are LF-only bytes and the repository pins LF checkout for every platform',async()=>{
 const folder=join(root,'docs/concepts/companion/starters');
 for(const name of await readdir(folder))assert.ok(!(await readFile(join(folder,name))).includes(13),name+' contains a carriage return');
 assert.match(await readFile(join(root,'.gitattributes'),'utf8'),/^\* text=auto eol=lf$/m);
});
