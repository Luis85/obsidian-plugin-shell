import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, mkdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { projectModel, schema, literal } from '../../scripts/companion/compiler/model.ts';
import { sample, typeCode } from '../../scripts/companion/compiler/schema-code.ts';
import { matches } from '../../scripts/companion/runtime/contract.ts';
import { planProject, applyProject } from '../../scripts/companion/compiler/plan.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = JSON.parse(await readFile(join(root,'docs/concepts/companion/companion-project.json'),'utf8'));
const clone = () => structuredClone(fixture);
async function sandbox(work) {
  const vault = await mkdtemp(join(tmpdir(),'companion-generator-')); const input = join(vault,'project.json');
  await writeFile(input,JSON.stringify(fixture));
  try { return await work({vault,input,target:'plugin'}); } finally { await rm(vault,{recursive:true,force:true}); }
}
function cli(options,extra = [], entry = join(root,'shell.mjs')) {
  return spawnSync(process.execPath,[entry,'generate','--input',options.input,'--vault',options.vault,'--target',options.target,...extra],{encoding:'utf8',timeout:45000,maxBuffer:10_000_000});
}
test('self-project preserves all declared artifacts and exposes honest readiness',()=>{
  const m = projectModel(fixture);
  assert.deepEqual([m.screens.length,m.components.length,m.entities.length,m.sources.length,m.requirements.length],[22,54,9,1,25]);
  assert.equal(m.sources[0].operations.length,3); assert.equal(m.flows.length,3);
  assert.equal(m.document,fixture); assert.ok(m.warnings.some(w=>w.includes('require implementation')));
});
for (const [label,change,expected] of [
  ['unsupported version',d=>d.schemaVersion=99,/version/i],
  ['duplicate screen slug',d=>d.design.nodes[1].slug=d.design.nodes[0].slug,/Duplicate/],
  ['dangling parent',d=>d.design.nodes[1].parent='missing',/Dangling/],
  ['cyclic parent',d=>d.design.nodes[0].parent=d.design.nodes[0].id,/Cyclic/],
  ['missing component',d=>d.design.nodes[0].components.push({id:'missing'}),/component/],
  ['dangling edge',d=>d.design.links[0].to='missing',/Dangling/],
  ['unsafe slug',d=>d.design.nodes[0].slug='../escape',/slug/],
  ['symbol collision',d=>{d.design.nodes[0].slug='screen-1';d.design.nodes[1].slug='screen1';},/Duplicate/],
  ['unspecified shape',d=>d.design.dataSources.sources[0].operations[0].input.mode='unspecified',/unspecified/],
  ['missing entity',d=>d.design.dataSources.sources[0].operations[0].output.entity='missing',/entity/],
  ['missing operation',d=>d.design.dataSources.flows[0].operation='missing',/flow/],
  ['missing requirement screen',d=>d.design.prds[0].requirements[0].nodes.push('missing'),/requirement/],
  ['unsafe source root',d=>d.settings.codebaseFolder='scripts',/tooling/],
  ['relationship collision',d=>d.design.semantic.relationships[0].key='id',/collision/],
]) test('rejects '+label,()=>{ const d=clone(); change(d); assert.throws(()=>projectModel(d),expected); });
test('schema subset creates type-safe fixtures without weakening constraints',()=>{
  const cases = [
    {type:'object',properties:{title:{type:'string'},rank:{type:'integer'},enabled:{type:'boolean'}},required:['title','rank'],additionalProperties:false},
    {type:'array',items:{type:'string',enum:['a','b']}},
    {type:['number','null']},
    ...['date','date-time','email','uuid','uri'].map(format=>({type:'string',format})),
  ];
  for (const value of cases) { const parsed=schema(value); assert.equal(matches(sample(parsed),parsed),true); assert.ok(typeCode(parsed)); }
  assert.equal(typeCode(null),'undefined'); assert.equal(matches(undefined,null),true); assert.equal(matches(null,null),false);
  const exact = schema(cases[0]); assert.equal(matches({title:'a',rank:1,extra:true},exact),false); assert.equal(matches({title:'a',rank:1.2},exact),false);
  assert.equal(matches('2026-02-30',schema({type:'string',format:'date'})),false);
  assert.equal(matches(JSON.parse('{"constructor":{}}'),{type:'object'}),false);
  assert.equal(matches(Number.NaN,{type:'number'}),false);
  const cycle={}; cycle.self=cycle; assert.equal(matches(cycle,{type:'object'}),false);
});
for (const value of [
  {type:'string',pattern:'unsafe-unimplemented'}, {type:'array'},
  {type:'object',required:['missing']}, {type:['array','null']},
  {type:'number',enum:['not-a-number']}, {type:'string',format:'regex'},
]) test('rejects unsupported or incoherent schema '+JSON.stringify(value),()=>assert.throws(()=>schema(value),/GENERATOR_INVALID/));
test('SFC literals cannot terminate the script element or interpolate authored code',()=>{
  const input='</script><script>alert(1)</script>\u2028${process.exit()}'; const encoded=literal(input);
  assert.ok(!encoded.includes('</script>')); assert.equal(JSON.parse(encoded),input);
});
test('fresh plan is read-only; apply and replay produce a complete independent project',()=>sandbox(async options=>{
  const first=await planProject(options); assert.equal(first.conflicts.length,0);
  assert.deepEqual(await readdir(options.vault),['project.json']);
  assert.equal(first.hash,(await planProject(options)).hash);
  await assert.rejects(applyProject(first,'wrong-hash'),/stale/);
  const applied=await applyProject(first,first.hash); assert.ok(applied.written.length>1000);
  const target=join(options.vault,options.target);
  assert.match(await readFile(join(target,'src/main.ts'),'utf8'),/initializeProject/);
  assert.match(await readFile(join(target,'src/generated/presentation/stores/authoring-vault.ts'),'utf8'),/defineStore/);
  assert.match(await readFile(join(target,'src/generated/infrastructure/sources/authoring-vault.ts'),'utf8'),/NotImplementedError/);
  assert.deepEqual(await readFile(join(target,'harness/styles/vendor/obsidian.css.gz')),await readFile(join(root,'harness/styles/vendor/obsidian.css.gz')));
  const trace=JSON.parse(await readFile(join(target,'design/traceability.json'),'utf8')); assert.equal(trace.requirements.length,25);
  assert.ok(trace.requirements.every(r=>r.verification==='todo'));
  for (const r of trace.requirements) assert.match(await readFile(join(target,r.test),'utf8'),/it.todo/);
  const pkg=JSON.parse(await readFile(join(target,'package.json'),'utf8')); assert.equal(pkg.name,'plugin-companion'); assert.equal(pkg.scripts.verify,JSON.parse(await readFile(join(root,'package.json'),'utf8')).scripts.verify);
  assert.equal(JSON.parse(await readFile(join(target,'package-lock.json'),'utf8')).packages[''].name,pkg.name);
  const replay=await planProject(options); assert.deepEqual(replay.conflicts,[]); assert.ok(replay.plan.changes.every(c=>c.status==='unchanged'));
  assert.deepEqual((await applyProject(replay,replay.hash)).written,[]);
  const ownCli=spawnSync(process.execPath,[join(target,'shell.mjs'),'generate','--help'],{encoding:'utf8',timeout:10000}); assert.equal(ownCli.status,0,ownCli.stderr); assert.match(ownCli.stdout,/Usage:/);
}));
test('regeneration preserves consumer business logic and refuses conflicting rewrites',()=>sandbox(async options=>{
  const first=await planProject(options); await applyProject(first,first.hash);
  const path='src/generated/infrastructure/sources/authoring-vault.ts'; const absolute=join(options.vault,options.target,path);
  await writeFile(absolute,(await readFile(absolute,'utf8'))+'\n// consumer implementation\n');
  const preserve=await planProject(options); assert.deepEqual(preserve.conflicts,[]); assert.ok(preserve.preserved.includes(path));
  await applyProject(preserve,preserve.hash); assert.match(await readFile(absolute,'utf8'),/consumer implementation/);
  const next=clone(); const source=next.design.dataSources.sources[0]; source.operations.push({...structuredClone(source.operations[0]),id:'new-operation',slug:'new-operation',name:'New operation'});
  await writeFile(options.input,JSON.stringify(next)); const conflict=await planProject(options); assert.ok(conflict.conflicts.some(c=>c.startsWith(path+':')));
  await assert.rejects(applyProject(conflict,conflict.hash),/conflicts/); assert.match(await readFile(absolute,'utf8'),/consumer implementation/);
}));
test('existing unowned, manually changed managed, and removed owned files never silently overwrite',()=>sandbox(async options=>{
  const first=await planProject(options); await applyProject(first,first.hash);
  const path=join(options.vault,options.target,'design/traceability.json'); await writeFile(path,'{}');
  assert.ok((await planProject(options)).conflicts.some(c=>c.startsWith('design/traceability.json')));
  await rm(join(options.vault,options.target,'src/main.ts')); assert.ok((await planProject(options)).conflicts.some(c=>c.includes('was removed')));
  await rm(join(options.vault,options.target,'.companion/generation.json'));
  assert.ok((await planProject(options)).conflicts.some(c=>c.includes('unowned')));
}));
test('CLI rebuilds the reviewed hash and refuses stale design input or target bytes',()=>sandbox(async options=>{
  const plan=cli(options); assert.equal(plan.status,0,plan.stderr); const hash=JSON.parse(plan.stdout).planHash;
  const next=clone(); next.notes.push('A changed declaration'); await writeFile(options.input,JSON.stringify(next));
  const stale=cli(options,['--apply',hash]); assert.equal(stale.status,1); assert.match(stale.stderr,/stale/);
  assert.deepEqual(await readdir(options.vault),['project.json']);
  const fresh=await planProject(options); await mkdir(join(options.vault,options.target)); await writeFile(join(options.vault,options.target,'manifest.json'),'consumer');
  await assert.rejects(applyProject(fresh,fresh.hash),/STALE/); assert.equal(await readFile(join(options.vault,options.target,'manifest.json'),'utf8'),'consumer');
}));
test('custom folders and additive declarations retain configuration and traceability',()=>sandbox(async options=>{
  const next=clone(); next.settings={codebaseFolder:'product/code',testsFolder:'verification/specs'};
  const base=next.design.nodes[0]; next.design.nodes.push({...structuredClone(base),id:'new-screen',slug:'new-screen',parent:base.id,components:[],bricks:[],nav:true,label:'New screen'});
  await writeFile(options.input,JSON.stringify(next)); const plan=await planProject(options);
  assert.ok(plan.plan.changes.some(c=>c.path==='plugin/product/code/generated/presentation/components/screens/new-screen.vue'));
  assert.ok(plan.plan.changes.some(c=>c.path==='plugin/verification/specs/project/workbench.test.ts'));
  const main=plan.plan.changes.find(c=>c.path==='plugin/src/main.ts').content; assert.match(main,/\.\.\/product\/code\/generated\/bootstrap\/install.ts/);
}));
test('unsafe vault targets and target symlinks are rejected without writes',()=>sandbox(async options=>{
  for (const target of ['../escape','.obsidian/plugins/unsafe','absolute\\path','CON','/absolute']) await assert.rejects(planProject({...options,target}));
  await mkdir(join(options.vault,'real')); await symlink(join(options.vault,'real'),join(options.vault,'link'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(planProject({...options,target:'link'}),/link/i); assert.deepEqual(await readdir(join(options.vault,'real')),[]);
}));
test('public CLI has no implicit apply and rejects repeated/unknown flags',()=>sandbox(async options=>{
  for (const extra of [['--target','again'],['--force','yes'],['--apply']]) { const result=cli(options,extra); assert.equal(result.status,1); }
  assert.deepEqual(await readdir(options.vault),['project.json']);
}));
