import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile, readFile, mkdir, readdir, realpath, symlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCliArguments } from '../../bin/adapters/framework/catalog.ts';
import { executeOperation } from '../../bin/adapters/framework/operations.ts';
import { planOperation, applyOperation } from '../../bin/adapters/framework/planning.ts';
import { loadPrototypeWorkspace } from '../../bin/adapters/framework/prototype-workspace.ts';
import { api, document, main, alternate } from '../support/prototype-fixture.mjs';
const frameworkRoot=fileURLToPath(new URL('../../',import.meta.url));
async function fixture(t) {
  const root=await realpath(await mkdtemp(join(tmpdir(),'workbench-prototypes-')));t.after(()=>rm(root,{recursive:true,force:true}));
  await writeFile(join(root,'source.json'),JSON.stringify(document()));return {root,frameworkRoot};
}
const run=(context,args)=>executeOperation(parseCliArguments(['prototypes',...args]),context);
const pick=['exploration','--version','v1','--variant','main'];
async function apply(context,args) {const result=await run(context,[...args,'--yes']);assert.ok(['applied','unchanged'].includes(result.status),JSON.stringify(result));return result;}
async function created(t) {const ctx=await fixture(t);await apply(ctx,['create','exploration','--input','source.json']);return ctx;}
async function activated(t) {const ctx=await created(t);await apply(ctx,['status',...pick,'--status','approved']);await apply(ctx,['activate',...pick]);return ctx;}
const snapshot=ctx=>loadPrototypeWorkspace(ctx).then(r=>r.workspace);
test('create previews without writes, then applies exact prototype folders and reloads',async t=>{
  const ctx=await fixture(t), before=await readdir(ctx.root), preview=await run(ctx,['create','exploration','--input','source.json']);
  assert.equal(preview.status,'planned',JSON.stringify(preview));assert.deepEqual(await readdir(ctx.root),before);
  assert.deepEqual(preview.data.changes.map(c=>c.path).sort(),['docs/concepts/exploration/prototype.json',api.snapshotPath(main),'docs/concepts/prototypes.json'].sort());
  await apply(ctx,['create','exploration','--input','source.json','--apply',preview.data.planHash]);
  assert.deepEqual(api.selected(await snapshot(ctx),main).variant.document,document());
  assert.equal((await run(ctx,['list'])).data.prototypes[0].versions[0].variants[0].status,'draft');
});
test('changed capture input invalidates an API-held reviewed plan',async t=>{
  const ctx=await fixture(t), planned=await planOperation(parseCliArguments(['prototypes','create','exploration','--input','source.json']),ctx);
  await writeFile(join(ctx.root,'source.json'),JSON.stringify(document('Sitemap B')));
  await assert.rejects(applyOperation(planned,ctx,planned.planHash),/PLAN_STALE|Inputs changed/);
  assert.deepEqual(await readdir(ctx.root),['source.json']);
});
test('does not overwrite unowned snapshots or follow symlink prototype directories',async t=>{
  const ctx=await fixture(t), path=join(ctx.root,api.snapshotPath(main));await mkdir(dirname(path),{recursive:true});await writeFile(path,'foreign');
  const refused=await run(ctx,['create','exploration','--input','source.json','--yes']);assert.equal(refused.status,'failed');assert.equal(await readFile(path,'utf8'),'foreign');
  const second=await fixture(t), outside=await fixture(t);await mkdir(join(second.root,'docs'),{recursive:true});
  try{await symlink(outside.root,join(second.root,'docs/concepts'),process.platform==='win32'?'junction':'dir');}catch(error){if(['EPERM','EACCES'].includes(error.code))return t.skip('Symlink creation not permitted');throw error;}
  const blocked=await run(second,['create','exploration','--input','source.json','--yes']);assert.equal(blocked.status,'failed');assert.deepEqual(await readdir(outside.root),['source.json']);
});
test('browser-compatible workspace JSON round-trips through shell export/import and retains A/B fixture data',async t=>{
  const ctx=await created(t);await apply(ctx,['fork',...pick,'--as','sitemap-b','--name','Sitemap B']);
  await writeFile(join(ctx.root,'b.json'),JSON.stringify(document('Sitemap B')));
  await apply(ctx,['save','exploration','--version','v1','--variant','sitemap-b','--input','b.json']);
  await apply(ctx,['export','--out','transfer.json']);
  const copy=await fixture(t);await writeFile(join(copy.root,'transfer.json'),await readFile(join(ctx.root,'transfer.json')));
  await apply(copy,['import','--input','transfer.json']);assert.deepEqual(await snapshot(copy),await snapshot(ctx));
  assert.equal(api.selected(await snapshot(copy),alternate).variant.document.design.sitemap.routes[0].path,'/dashboard');
  assert.deepEqual(api.selected(await snapshot(copy),main).variant.document.design.dataSources,document().design.dataSources);
});
test('a workspace without an active variant blocks both managed and default generation',async t=>{
  const ctx=await created(t), result=await run(ctx,['generate','--target','generated']);assert.equal(result.status,'failed');assert.match(result.diagnostics[0].message,/active variant|activate/i);
  const standard=await executeOperation(parseCliArguments(['generate','--target','generated']),ctx);assert.equal(standard.status,'failed');
  assert.ok(!(await readdir(ctx.root)).includes('generated'));
});
test('managed generation compiles the pinned A snapshot, not unsaved B, and records exact provenance',async t=>{
  const ctx=await activated(t);await writeFile(join(ctx.root,'source.json'),JSON.stringify(document('Sitemap B')));
  const preview=await run(ctx,['generate','--target','generated']);assert.equal(preview.status,'planned',JSON.stringify(preview));
  assert.deepEqual(preview.data.summary.prototypeSelection.prototypeId,'exploration');
  const result=await apply(ctx,['generate','--target','generated','--apply',preview.data.planHash]);
  const generated=JSON.parse(await readFile(join(ctx.root,'generated/design/project.json'),'utf8'));
  assert.equal(generated.design.goal,'Sitemap A');assert.deepEqual(generated.design.sitemap.routes,document().design.sitemap.routes);
  const receipt=JSON.parse(await readFile(join(ctx.root,'generated/.companion/prototype-selection.json'),'utf8'));
  assert.equal(receipt.variantId,'main');assert.equal(receipt.snapshotPath,api.snapshotPath(main));assert.match(receipt.snapshotHash,/^[a-f0-9]{64}$/);
  assert.equal(result.data.summary.prototypeSelection.snapshotHash,receipt.snapshotHash);
  assert.equal((await run(ctx,['generate','--target','generated','--yes'])).status,'unchanged');
});
test('switching activation invalidates a generation review; fresh generation uses B',async t=>{
  const ctx=await activated(t);await apply(ctx,['fork',...pick,'--as','sitemap-b']);await writeFile(join(ctx.root,'b.json'),JSON.stringify(document('Sitemap B')));
  const b=['exploration','--version','v1','--variant','sitemap-b'];await apply(ctx,['save',...b,'--input','b.json']);await apply(ctx,['status',...b,'--status','approved']);
  const request=parseCliArguments(['prototypes','generate','--target','generated']),planned=await planOperation(request,ctx);
  await apply(ctx,['activate',...b]);await assert.rejects(applyOperation(planned,ctx,planned.planHash),/stale|Inputs changed/i);
  await apply(ctx,['generate','--target','generated']);const output=JSON.parse(await readFile(join(ctx.root,'generated/design/project.json'),'utf8'));
  assert.equal(output.design.goal,'Sitemap B');assert.equal(output.design.sitemap.routes[0].path,'/dashboard');
});
test('tampered snapshots and future registries never fall back to the working source',async t=>{
  const ctx=await activated(t);await writeFile(join(ctx.root,api.snapshotPath(main)),JSON.stringify(document('Sitemap B')));
  const response=await run(ctx,['generate','--target','generated']);assert.equal(response.status,'failed');assert.match(response.diagnostics[0].message,/bytes differ/);
  const ctx2=await created(t),path=join(ctx2.root,'docs/concepts/prototypes.json'),registry=JSON.parse(await readFile(path,'utf8'));registry.schemaVersion=999;await writeFile(path,JSON.stringify(registry));
  assert.equal((await run(ctx2,['list'])).status,'failed');assert.equal((await run(ctx2,['generate','--target','generated'])).status,'failed');
});
test('real shell entry routes plural prototypes separately from the prototype maker',async t=>{
  const ctx=await created(t),output=spawnSync(process.execPath,[join(frameworkRoot,'bin/app'),'prototypes','list','--root',ctx.root,'--json'],{encoding:'utf8',timeout:30000});
  assert.equal(output.status,0,output.stderr);assert.equal(JSON.parse(output.stdout).data.prototypes[0].id,'exploration');
});
test('workspace import does not overwrite a sealed or active saved document',async t=>{
  const ctx=await activated(t);let w=await snapshot(ctx);w.revision++;w.prototypes[0].versions[0].variants[0].document.design.goal='Altered';w.prototypes[0].versions[0].variants[0].revision++;
  await writeFile(join(ctx.root,'bad.json'),JSON.stringify(w));const response=await run(ctx,['import','--input','bad.json','--yes']);assert.equal(response.status,'failed');
  assert.equal(api.active(await snapshot(ctx)).variant.document.design.goal,'Sitemap A');
});

test('compare is a read-only real CLI operation and metadata edits retain the saved active source',async t=>{
  const ctx=await activated(t);await apply(ctx,['fork',...pick,'--as','sitemap-b']);
  await writeFile(join(ctx.root,'b.json'),JSON.stringify(document('Sitemap B')));
  const b=['exploration','--version','v1','--variant','sitemap-b'];await apply(ctx,['save',...b,'--input','b.json']);
  const before=await snapshot(ctx), compared=await run(ctx,['compare',...pick,'--with-variant','sitemap-b']);
  assert.equal(compared.status,'ok',JSON.stringify(compared));assert.equal(compared.data.comparison.equal,false);
  assert.ok(compared.data.comparison.changes.some(c=>c.path==='/design/sitemap/routes/0/path'));
  assert.deepEqual(await snapshot(ctx),before);
  await apply(ctx,['prototype-details','exploration','--name','Alternative solutions','--description','A/B']);
  await apply(ctx,['version-details','exploration','--version','v1','--label','Baseline']);
  assert.deepEqual(api.active(await snapshot(ctx)).variant.document,api.active(before).variant.document);
});
test('restore shell plan retains a sealed checkpoint and invalidates a reviewed generation plan',async t=>{
  const ctx=await activated(t);await apply(ctx,['fork',...pick,'--as','sitemap-b']);await writeFile(join(ctx.root,'b.json'),JSON.stringify(document('Sitemap B')));
  const b=['exploration','--version','v1','--variant','sitemap-b'];await apply(ctx,['save',...b,'--input','b.json']);
  const prior=await snapshot(ctx), generation=await planOperation(parseCliArguments(['prototypes','generate','--target','out']),ctx);
  const args=['restore-snapshot',...b,'--from-version','v1','--from-variant','main','--recovery-version','recovery-one'];
  const preview=await run(ctx,args);assert.equal(preview.status,'planned');assert.deepEqual(await snapshot(ctx),prior);
  await apply(ctx,args);const after=await snapshot(ctx), backup={...alternate,versionId:'recovery-one'};
  assert.equal(api.selected(after,backup).version.sealed,true);
  assert.deepEqual(api.selected(after,backup).variant.document,document('Sitemap B'));
  assert.deepEqual(api.selected(after,alternate).variant.document,document());assert.deepEqual(after.active,main);
  await assert.rejects(applyOperation(generation,ctx,generation.planHash),/PLAN_STALE|Inputs changed/);
  const rejected=await run(ctx,[...args,'--yes']);assert.equal(rejected.status,'failed');assert.deepEqual(await snapshot(ctx),after);
});
test('in-place managed generation names adoption when canonical design is absent',async t=>{
  const ctx=await activated(t),result=await run(ctx,['generate']);
  assert.equal(result.status,'failed');assert.match(result.diagnostics[0].message,/adopt/);
});
test('managed-generation adapter rejects a lookalike provenance receipt before any writes',async t=>{
  const {managedGenerationPlan}=await import('../../bin/adapters/framework/prototype-generation.ts');
  const {createFilePlan}=await import('../../scripts/shared/file-plan.mjs');
  const ctx=await activated(t),target=join(ctx.root,'generated'),receipt=join(target,'.companion/prototype-selection.json');
  await mkdir(dirname(receipt),{recursive:true});
  const foreign=JSON.stringify({schemaVersion:1,projectId:'design-lab',foreign:true});await writeFile(receipt,foreign);
  // Compiler port supplies no files: the real adapter must still validate its separately owned receipt.
  const compile=async()=>({summary:{target},plan:await createFilePlan(ctx.root,[])});
  await assert.rejects(managedGenerationPlan(parseCliArguments(['generate','--target','generated']),ctx,compile),/PROTOTYPE_SHAPE/);
  assert.equal(await readFile(receipt,'utf8'),foreign);
});
