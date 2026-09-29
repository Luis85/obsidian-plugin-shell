import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp,mkdir,readFile,writeFile,symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { planMaker } from '../../scripts/makers/plan.mjs';
import { parseArguments } from '../../scripts/makers/arguments.mjs';
import { applyFilePlan } from '../../scripts/shared/file-plan.mjs';
import { makerFixture,makerSourceRoot } from './maker-fixture.mjs';
import { fileSymlink } from './file-symlink.mjs';
async function foundation(root){await cp(join(makerSourceRoot,'src/bootstrap/native-integrations.ts'),join(root,'src/bootstrap/native-integrations.ts'));}
async function plan(root,args){return planMaker(root,parseArguments(args));}
const fileArgs=['file-type','drawing','--extension','mydrawing','--format','json'];
const actionArgs=['context-menu','summarize','--extensions','md,txt'];
test('both native makers are discoverable, need no feature and produce reviewed idempotent plans',()=>makerFixture(async root=>{
 await foundation(root);
 for(const args of [fileArgs,actionArgs]){
  const first=await plan(root,args);assert.equal(first.owner,undefined);assert.ok(first.plan.changes.some(c=>c.path==='src/bootstrap/native-integrations.ts'));
  assert.ok(first.checks.some(check=>check.args.includes('--noEmit')));await applyFilePlan(first.plan);
  const again=await plan(root,args);assert.ok(again.plan.changes.every(c=>c.status==='unchanged'));
 }
 const registry=await readFile(join(root,'src/bootstrap/native-integrations.ts'),'utf8');assert.match(registry,/nativeDrawing/);assert.match(registry,/nativeSummarize/);
 assert.match(await readFile(join(root,'src/application/file-actions/summarize.ts'),'utf8'),/run: inspectNativeFile/);
}));
test('plain-text maker starts with empty content, while JSON maker starts with valid initial bytes',()=>makerFixture(async root=>{
 await foundation(root);const p=await plan(root,['file-type','text-file','--extension','owntext','--format','text']);
 assert.match(p.plan.changes.find(c=>c.path==='src/domain/file-types/text-file.ts').content,/defaultContent: ''/);
}));
for(const args of [ ['file-type','missing'],['file-type','reserved','--extension','md'],['file-type','unsafe','--extension','../bad'],['file-type','wrong','--extension','other','--format','binary'],['context-menu','missing'],['context-menu','wildcard','--extensions','*'] ])test('native maker rejects '+args.join(' '),()=>makerFixture(async root=>{await foundation(root);await assert.rejects(plan(root,args),/NATIVE_INVALID/);}));
test('duplicate extensions and cross-kind identity/symbol collisions are refused before any write',()=>makerFixture(async root=>{
 await foundation(root);await applyFilePlan((await plan(root,fileArgs)).plan);
 await assert.rejects(plan(root,['file-type','other','--extension','mydrawing']),/NATIVE_EXTENSION_CONFLICT/);
 await assert.rejects(plan(root,['context-menu','drawing','--extensions','md']),/NATIVE_ID_CONFLICT/);
 await applyFilePlan((await plan(root,['file-type','a1','--extension','aone'])).plan);
 await assert.rejects(plan(root,['context-menu','a-1','--extensions','md']),/NATIVE_ID_CONFLICT/);
}));
test('existing generated file associations in a custom source folder are also checked',()=>makerFixture(async root=>{
 await foundation(root);await mkdir(join(root,'design'),{recursive:true});await mkdir(join(root,'app/code/generated/domain/file-types'),{recursive:true});
 await writeFile(join(root,'design/project.json'),JSON.stringify({settings:{codebaseFolder:'app/code'},design:{}}));
 await writeFile(join(root,'app/code/generated/domain/file-types/owned.ts'),"export const nativeOwned = {id:'owned',extension:'mydrawing'};\n");
 await assert.rejects(plan(root,fileArgs),/NATIVE_EXTENSION_CONFLICT/);
}));
test('edited descriptors and unsupported registry expressions are preserved, not guessed or overwritten',()=>makerFixture(async root=>{
 await foundation(root);await applyFilePlan((await plan(root,fileArgs)).plan);const file=join(root,'src/domain/file-types/drawing.ts');const original=await readFile(file,'utf8');const edited=original+'// keep my validator\n';await writeFile(file,edited);
 await assert.rejects(plan(root,fileArgs),/MAKER_CONFLICT/);assert.equal(await readFile(file,'utf8'),edited);
 await writeFile(file,"export const nativeDrawing = buildRuntimeType();\n");await assert.rejects(plan(root,['file-type','another','--extension','another']),/NATIVE_REGISTRY_REVIEW_REQUIRED/);
}));
test('guarded registry dependencies cannot change between planning and finalization',()=>makerFixture(async root=>{
 await foundation(root);await applyFilePlan((await plan(root,fileArgs)).plan);const source=join(root,'src/domain/file-types/drawing.ts');
 await assert.rejects(planMaker(root,parseArguments(actionArgs),{async beforeFinalize(){await writeFile(source,(await readFile(source,'utf8'))+'// concurrent edit\n');}}),/MAKER_STALE_INPUT/);
}));
test('native scans reject symlinked descriptors without reading their target',t=>makerFixture(async root=>{
 await foundation(root);await mkdir(join(root,'src/domain/file-types'),{recursive:true});
 if(await fileSymlink(t,join(makerSourceRoot,'package.json'),join(root,'src/domain/file-types/linked.ts'))===false)return;
 await assert.rejects(plan(root,fileArgs),/link|symlink/i);
}));
