import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildCompanionFixtureManifest } from '../../scripts/companion/test-data-manifest.mjs';
import { createFixtureEngine } from '../../docs/concepts/companion/test-kit/engine.mjs';
import { createFixtureAdapter } from '../../docs/concepts/companion/test-kit/adapters.mjs';
import { projectFiles } from '../../scripts/companion/compiler/project-files.ts';
import { projectModel } from '../../scripts/companion/compiler/model.ts';
import { planProject, applyProject } from '../../scripts/companion/compiler/plan.ts';
import { providerProject } from '../fixtures/generator-provider-project.mjs';
import { boundaryProject } from '../fixtures/generator-boundaries.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const original=JSON.parse(await readFile(join(root,'docs/concepts/companion/companion-project.json'),'utf8'));
function cli(cwd, command, ...args) {
  const run=spawnSync(process.execPath,['scripts/test-data/'+(command==='verify'?'verify.mjs':'cli.mjs'),...(command==='verify'?[]:[command,...args])],{cwd,encoding:'utf8',timeout:20000,maxBuffer:5_000_000});
  assert.equal(run.status,0,run.stderr+'\n'+run.stdout);return JSON.parse(run.stdout);
}
async function sandbox(work) {
  const vault=await mkdtemp(join(tmpdir(),'generator-fixtures-'));
  try { return await work(vault); } finally { await rm(vault,{recursive:true,force:true}); }
}
function frontmatter(content) { return Object.fromEntries(content.split('\n').slice(1).slice(0,content.split('\n').slice(1).indexOf('---')).map(line=>{const cut=line.indexOf(': ');return [JSON.parse(line.slice(0,cut)),JSON.parse(line.slice(cut+2))];})); }

test('shared translator preserves deterministic recipes without endpoints, authentication or input mutation',()=>{
  const input=providerProject(original);const before=JSON.stringify(input);
  const manifest=buildCompanionFixtureManifest(input.design), engine=createFixtureEngine();
  assert.deepEqual(engine.generate(manifest),engine.generate(manifest));assert.equal(JSON.stringify(input),before);
  assert.equal(manifest.operations.length,9);assert.ok(!JSON.stringify(manifest).includes('https://example.invalid'));
  assert.ok(!Object.hasOwn(manifest.operations[0],'auth'));assert.ok(!Object.hasOwn(manifest.operations[0],'locator'));
  const adapter=createFixtureAdapter(manifest);adapter.dispose();assert.throws(()=>adapter.reset(),/disposed/);
});
test('optional browser fields do not break preview after portable blueprint import',()=>{
  const design=structuredClone(original.design);design.detailDesigns=undefined;design.designSystem=undefined;
  assert.deepEqual(buildCompanionFixtureManifest(design),buildCompanionFixtureManifest(original.design));
});
test('generated notes carry canonical metadata but operation DTOs retain their declared shape',()=>{
  const m=buildCompanionFixtureManifest(original.design), output=createFixtureEngine().generate(m);
  for(const file of output.files.filter(f=>f.path.endsWith('.md'))) {
    const props=frontmatter(file.content);assert.equal(props.schema_version,1);assert.equal(props.created_at,m.referenceDate);assert.match(props.id,/^[a-f0-9-]+$/);assert.equal(typeof props.title,'string');
  }
  assert.ok(output.files.some(f=>f.path.endsWith('.md')));
  assert.equal(output.operations[0].outputValue[0].schema_version,undefined);
});
test('native wire recipes seed the mapped entity instead of trying to persist a snapshot DTO',()=>{
  const p=boundaryProject(original), source=p.design.dataSources.sources.at(-1), op=source.operations[0];
  p.design.dataSources.testing.recipes.push({source:source.id,operation:op.id,enabled:true,behavior:'list',dataset:'native-records',keyField:'id',scenario:'populated',latencyMs:0,errorStatus:503,rules:[]});
  const m=buildCompanionFixtureManifest(p.design), output=createFixtureEngine().generate(m);
  const adapter=createFixtureAdapter(m);adapter.dispose();
  assert.equal(m.operations.at(-1).noteEntity,source.operations[0].implementation.entity);
  const notes=output.files.filter(f=>f.path.startsWith(op.resource+'/'));assert.equal(notes.length,m.count);
  for(const note of notes){const fields=frontmatter(note.content);assert.equal(fields.type,'boundary-record');assert.equal(fields.schema_version,1);assert.equal(fields.record,undefined);}
});
for(const [label,mutate] of [
 ['unknown settings',p=>p.design.dataSources.testing.execute='shell-command'],
 ['missing operation',p=>p.design.dataSources.testing.recipes[0].operation='missing'],
 ['duplicate recipe',p=>p.design.dataSources.testing.recipes.push(p.design.dataSources.testing.recipes[0])],
 ['disabled unsupported contract',p=>{p.design.dataSources.testing.recipes[0].enabled=false;p.design.dataSources.testing.recipes[0].behavior='eval';}],
 ['nonconstant date',p=>p.design.dataSources.testing.referenceDate='today'],
 ['native metadata collision',p=>p.design.semantic.entities[0].properties.push({key:'schema_version',type:'number',required:false})],
]) test('invalid fixture contract fails before file generation: '+label,async()=>{
 const p=structuredClone(original);mutate(p);await assert.rejects(projectFiles(root,projectModel(p)),/FIXTURE_CONTRACT|Canonical/);
});
test('fixture translator rejects getters, symbols, sparse arrays and executable values without invoking them',()=>{
  let calls=0;const object=structuredClone(original.design);Object.defineProperty(object,'attack',{enumerable:true,get(){calls++;return'bad';}});
  assert.throws(()=>buildCompanionFixtureManifest(object),/Unsafe/);assert.equal(calls,0);
  for (const value of [Symbol('data'),()=>{}]) { const p=structuredClone(original.design);p.bad=value;assert.throws(()=>buildCompanionFixtureManifest(p)); }
  const hidden=structuredClone(original.design);hidden[Symbol('data')]=true;assert.throws(()=>buildCompanionFixtureManifest(hidden));
  const sparse=structuredClone(original.design);sparse.dataSources.testing.recipes=new Array(1);assert.throws(()=>buildCompanionFixtureManifest(sparse));
});
test('large unrelated authoring state does not consume the recipe budget, while oversized recipe inputs still fail',()=>{
  const large=structuredClone(original.design);let calls=0;
  large.detailDesigns={...large.detailDesigns,history:Array.from({length:130000},(_,i)=>({i}))};
  Object.defineProperty(large.detailDesigns,'unread',{enumerable:true,get(){calls++;return 'never read';}});
  assert.deepEqual(buildCompanionFixtureManifest(large),buildCompanionFixtureManifest(original.design));assert.equal(calls,0);
  const oversized=structuredClone(original.design);oversized.semantic.entities[0].padding=[0,1,2].map(()=>Array.from({length:50000},(_,i)=>i));
  assert.throws(()=>buildCompanionFixtureManifest(oversized),/Input limit exceeded/);
});
test('generator emits a typed provider seam, canonical-read tests and dependency-free recipe tools with custom roots',async()=>{
  const p=providerProject(original);p.settings={codebaseFolder:'product/code',testsFolder:'product/specs'};
  const files=new Map((await projectFiles(root,projectModel(p))).map(f=>[f.path,f.content]));
  const pkg=JSON.parse(files.get('package.json'));assert.equal(pkg.scripts['testdata:plan'],'node scripts/test-data/cli.mjs plan');
  assert.match(pkg.scripts['verify:project'],/testdata:check/);
  assert.match(files.get('product/code/generated/bootstrap/sources.ts'),/validateSourceOverrides/);
  assert.match(files.get('product/specs/project/fixtures/fixture-api.ts'),/adapter.execute\(.*input, \{signal\}\)/);
  assert.match(files.get('product/specs/project/fixtures/canonical-requirement.test.ts'),/markdownCodec/);
  assert.ok(![...files].filter(([name])=>name.startsWith('src/')||name.startsWith('product/code/')).some(([,text])=>/from ['"].*test-data\//.test(text)));
});
test('real generated CLI reviews, applies, replays and resets only owned seed files',()=>sandbox(async vault=>{
  const input=join(vault,'project.json');await writeFile(input,JSON.stringify(original));
  const plan=await planProject({input,vault,target:'plugin'});await applyProject(plan,plan.hash);const target=join(vault,'plugin');
  assert.equal(cli(target,'verify').status,'fixture-contracts-verified');
  assert.ok(!(await readdir(target)).includes('.test-vault'));
  const preview=cli(target,'plan');assert.equal(preview.blockers.length,0);assert.ok(preview.changes.length>0);
  assert.ok(!(await readdir(target)).includes('.test-vault'));
  const applied=cli(target,'apply','--approve',preview.approval);assert.ok(applied);
  const same=cli(target,'plan');assert.ok(same.changes.every(change=>change.status==='unchanged'));
  const foreign=join(target,'.test-vault','Unrelated.md');await writeFile(foreign,'Keep this');
  const reset=cli(target,'reset-plan');cli(target,'reset','--approve',reset.approval);assert.equal(await readFile(foreign,'utf8'),'Keep this');
  const replay=await planProject({input,vault,target:'plugin'});assert.deepEqual(replay.conflicts,[]);assert.ok(replay.plan.changes.every(change=>change.status==='unchanged'));
}));
test('fresh generated typed fixture ports execute real services: stateful save/delete, cancellation, disabled operations, disposal',()=>sandbox(async vault=>{
  const input=join(vault,'project.json');await writeFile(input,JSON.stringify(providerProject(original)));
  const plan=await planProject({input,vault,target:'plugin'});await applyProject(plan,plan.hash);const target=join(vault,'plugin');
  for(const kind of ['api','database']) {
    const factory=await import(pathToFileURL(join(target,'tests/project/fixtures/fixture-'+kind+'.ts')).href);
    const serviceModule=await import(pathToFileURL(join(target,'src/generated/application/fixture-'+kind+'/service.ts')).href);
    const name=kind==='api'?'GFixtureApi':'GFixtureDatabase';const fixture=factory['create'+name+'FixturePort']();
    const service=serviceModule['create'+name+'Service'](fixture.port);
    const list=await service['list-records']();assert.equal(list.length,5);
    assert.equal(await service['save-record']({...list[0],title:'Changed'}),undefined);
    assert.equal((await service['list-records']())[0].title,'Changed');
    await service['delete-record']({id:list[0].id});assert.equal((await service['list-records']()).length,4);
    await assert.rejects(service['not-configured'](),/fallback is forbidden/);
    const abort=new AbortController();abort.abort();await assert.rejects(service['list-records'](undefined,abort.signal),/ABORTED/);
    fixture.dispose();await assert.rejects(service['list-records'](),/disposed/);
  }
}));
