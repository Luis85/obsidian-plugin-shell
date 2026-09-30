import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, readdir, writeFile, rm, realpath, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { executeOperation } from '../../scripts/framework/operations.ts';
import { parseCliArguments } from '../../scripts/framework/catalog.ts';
import { planOperation, applyOperation } from '../../scripts/framework/planning.ts';
import { starterDocument } from '../support/starter-documents.mjs';
const frameworkRoot = fileURLToPath(new URL('../../', import.meta.url));
const template = starterDocument('blank');
const hash = value => createHash('sha256').update(value).digest('hex');
const run = (context, args) => executeOperation(parseCliArguments(args), context);
async function workspace(t, setup = true) {
  const root = await realpath(await mkdtemp(join(tmpdir(),'concept-intake-'))); t.after(()=>rm(root,{recursive:true,force:true}));
  const context = { root, frameworkRoot };
  await mkdir(join(root,'docs/concepts/capture'),{recursive:true});
  const project = structuredClone(template); project.project.author='Test Author';
  await writeFile(join(root,'docs/concepts/capture/project.json'), JSON.stringify(project));
  if (setup) {
    const created = await run(context,['setup','--input','docs/concepts/capture/project.json','--yes']);
    assert.equal(created.status,'applied',JSON.stringify(created));
  }
  return context;
}
async function feature(context, name='capture') {
  const raw=await readFile(join(context.root,'design/project.json')), current=JSON.parse(raw);
  const page={...current.design.nodes[0],id:'node-90',kind:'page',slug:name,label:'Capture',parent:current.design.nodes[0].id,entry:false,command:false,ribbon:false};
  const value={kind:'obsidian-companion-concept',schemaVersion:1,id:name,mode:'feature',projectId:current.project.id,baseSha256:hash(raw),
    references:[{collection:'nodes',id:page.parent}],changes:[
      {collection:'nodes',op:'add',id:page.id,value:page},
      {collection:'features.items',op:'add',id:name,value:{id:name,name:'Capture',surfaces:[page.id],entryPoints:[page.id],components:[],requirements:[],dependsOn:[]}},
    ]};
  await writeFile(join(context.root,'docs/concepts/capture/concept.json'), JSON.stringify(value));return value;
}
const input=['--input','docs/concepts/capture/concept.json'];
async function inventory(root) {
  const result={};
  async function visit(path='') { for(const entry of await readdir(join(root,path),{withFileTypes:true})) {
    const name=path?path+'/'+entry.name:entry.name;
    if(entry.isDirectory()) await visit(name); else result[name]=hash(await readFile(join(root,name)));
  } }
  await visit();return result;
}

test('concept schema and help discover actual typed operations without running project code',async t=>{
  const ctx=await workspace(t,false);const before=await inventory(ctx.root);
  const schema=await run(ctx,['concept','schema','--json']);assert.equal(schema.status,'ok');assert.equal(schema.data.oneOf.length,3);
  const help=await run(ctx,['help','concept','import','--json']);assert.equal(help.status,'ok');assert.equal(help.data.commands[0].effect,'plan');
  assert.deepEqual(await inventory(ctx.root),before);
});
test('inspection without input returns the exact current base digest; file preview writes nothing',async t=>{
  const ctx=await workspace(t), concept=await feature(ctx),before=await inventory(ctx.root);
  const base=await run(ctx,['concept','inspect']);assert.equal(base.status,'ok');assert.equal(base.data.baseSha256,concept.baseSha256);
  const preview=await run(ctx,['concept','inspect',...input]);assert.equal(preview.status,'ok',JSON.stringify(preview));
  assert.equal(preview.data.mode,'feature');assert.equal(preview.data.changes.length,2);assert.equal(preview.data.execution,'not-run');
  assert.deepEqual(await inventory(ctx.root),before);
});
test('apply imports through existing ownership/configuration plans and replay has zero writes',async t=>{
  const ctx=await workspace(t);await feature(ctx);const before=await inventory(ctx.root);
  const plan=await run(ctx,['concept','import',...input]);assert.equal(plan.status,'planned',JSON.stringify(plan));
  assert.deepEqual(await inventory(ctx.root),before);
  const applied=await run(ctx,['concept','import',...input,'--apply',plan.data.planHash]);assert.equal(applied.status,'applied',JSON.stringify(applied));
  const saved=JSON.parse(await readFile(join(ctx.root,'design/project.json'),'utf8'));
  assert.equal(saved.schemaVersion,6);assert.equal(saved.design.features.items[0].id,'capture');
  const replay=await run(ctx,['concept','import',...input,'--yes']);assert.equal(replay.status,'unchanged',JSON.stringify(replay));
  assert.deepEqual(replay.data.applied.written,[]);assert.equal(replay.data.summary.replay,true);
  assert.equal((await inventory(ctx.root))['docs/concepts/capture/concept.json'],before['docs/concepts/capture/concept.json']);
});
test('source metadata edits invalidate saved plans even when the generated candidate is identical',async t=>{
  const ctx=await workspace(t);await feature(ctx);
  const plan=await run(ctx,['concept','import',...input,'--plan-out','concept.plan.json']);assert.equal(plan.status,'planned');
  await writeFile(join(ctx.root,input[1]),await readFile(join(ctx.root,input[1]),'utf8')+'\n');
  const before=await inventory(ctx.root),applied=await run(ctx,['plan','apply','concept.plan.json','--yes']);
  assert.equal(applied.status,'failed');assert.equal(applied.diagnostics[0].code,'PLAN_STALE');assert.deepEqual(await inventory(ctx.root),before);
});
test('an API-held plan is freshly rebuilt and refuses an intervening canonical project change',async t=>{
  const ctx=await workspace(t);await feature(ctx);const planned=await planOperation(parseCliArguments(['concept','import',...input]),ctx);
  const value=JSON.parse(await readFile(join(ctx.root,'docs/concepts/capture/project.json'),'utf8'));value.design.goal='New goal';
  await writeFile(join(ctx.root,'next.json'),JSON.stringify(value));assert.equal((await run(ctx,['project','import','--input','next.json','--yes'])).status,'applied');
  const before=await inventory(ctx.root);await assert.rejects(applyOperation(planned,ctx,planned.planHash),/CONCEPT_BASE_STALE/);
  assert.deepEqual(await inventory(ctx.root),before);
});
test('project mode configures an empty project but reports full replacement on an existing one',async t=>{
  const ctx=await workspace(t,false);
  const result=await run(ctx,['concept','import','--input','docs/concepts/capture/project.json','--yes']);assert.equal(result.status,'applied',JSON.stringify(result));
  assert.equal(result.data.summary.mode,'project');assert.equal(result.data.summary.replacement,false);
  const value=JSON.parse(await readFile(join(ctx.root,'docs/concepts/capture/project.json'),'utf8'));value.design.goal='Replacement';
  await writeFile(join(ctx.root,'docs/concepts/capture/project.json'),JSON.stringify(value));
  const planned=await run(ctx,['concept','import','--input','docs/concepts/capture/project.json']);assert.equal(planned.status,'planned');
  assert.equal(planned.data.summary.replacement,true);
});
test('improvement updates one named artifact and repeated old concepts cannot overwrite later edits',async t=>{
  const ctx=await workspace(t);const value=await feature(ctx);
  assert.equal((await run(ctx,['concept','import',...input,'--yes'])).status,'applied');
  const raw=await readFile(join(ctx.root,'design/project.json')),project=JSON.parse(raw),page=project.design.nodes.find(n=>n.id==='node-90');
  const improvement={...value,id:'capture-improvement',mode:'improvement',baseSha256:hash(raw),references:[],changes:[{collection:'nodes',op:'replace',id:page.id,value:{...page,label:'Capture details'}}]};
  await writeFile(join(ctx.root,'docs/concepts/capture/improve.json'),JSON.stringify(improvement));
  const result=await run(ctx,['concept','import','--input','docs/concepts/capture/improve.json','--yes']);assert.equal(result.status,'applied',JSON.stringify(result));
  const repeated=await run(ctx,['concept','import',...input,'--yes']);assert.equal(repeated.status,'failed');assert.equal(repeated.diagnostics[0].code,'CONCEPT_REPLAY_CHANGED');
  assert.equal(JSON.parse(await readFile(join(ctx.root,'design/project.json'),'utf8')).design.nodes.find(n=>n.id===page.id).label,'Capture details');
});
test('raw HTML remains reference-only; importing cannot execute it or touch existing files',async t=>{
  const ctx=await workspace(t);await writeFile(join(ctx.root,'docs/concepts/capture/preview.html'),'<script>throw Error("never");</script><h1>Example</h1>');
  const before=await inventory(ctx.root), inspected=await run(ctx,['concept','inspect','--input','docs/concepts/capture/preview.html']);
  assert.equal(inspected.data.disposition,'reference-only');
  const result=await run(ctx,['concept','import','--input','docs/concepts/capture/preview.html','--yes']);assert.equal(result.status,'failed');assert.equal(result.diagnostics[0].code,'CONCEPT_REFERENCE_ONLY');
  assert.deepEqual(await inventory(ctx.root),before);
});
test('foreign and manually edited project files are preserved even with fresh base hash and --yes',async t=>{
  const ctx=await workspace(t);const file=join(ctx.root,'design/project.json');await writeFile(file,(await readFile(file,'utf8'))+'\n');await feature(ctx);
  const before=await inventory(ctx.root),result=await run(ctx,['concept','import',...input,'--yes']);assert.equal(result.status,'failed');assert.equal(result.diagnostics[0].code,'IMPORT_OWNERSHIP');assert.deepEqual(await inventory(ctx.root),before);
});
test('concept paths and links cannot escape docs/concepts or target the configured test vault',async t=>{
  const ctx=await workspace(t);await writeFile(join(ctx.root,'outside.json'),JSON.stringify(template));
  assert.equal((await run(ctx,['concept','inspect','--input','outside.json'])).diagnostics[0].code,'CONCEPT_PATH');
  assert.equal((await run(ctx,['concept','import','--input','docs/concepts/../../outside.json','--yes'])).diagnostics[0].code,'CONCEPT_PATH');
  if (process.platform!=='win32') {
    await symlink(join(ctx.root,'outside.json'),join(ctx.root,'docs/concepts/capture/link.json'));
    assert.equal((await run(ctx,['concept','inspect','--input','docs/concepts/capture/link.json'])).diagnostics[0].code,'INPUT_LINK');
  }
});
test('concept application in a generated project keeps generation receipts aligned without touching source extensions',async t=>{
  const ctx=await workspace(t), raw=await readFile(join(ctx.root,'design/project.json')), project=JSON.parse(raw);
  await mkdir(join(ctx.root,'.companion'));await writeFile(join(ctx.root,'manifest.json'),JSON.stringify(project.project));
  await writeFile(join(ctx.root,'.companion/generation.json'),JSON.stringify({version:1,projectId:project.project.id,files:[{path:'design/project.json',hash:hash(raw),ownership:'managed'}]}));
  await writeFile(join(ctx.root,'custom.ts'),'// User implementation\n');await feature(ctx);
  const result=await run(ctx,['concept','import',...input,'--yes']);assert.equal(result.status,'applied',JSON.stringify(result));
  const receipt=JSON.parse(await readFile(join(ctx.root,'.companion/generation.json'),'utf8'));
  assert.equal(receipt.files[0].hash,hash(await readFile(join(ctx.root,'design/project.json'))));
  assert.equal(await readFile(join(ctx.root,'custom.ts'),'utf8'),'// User implementation\n');
});
