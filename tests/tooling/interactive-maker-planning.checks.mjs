import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { planOperation, applyOperation, saveOperationPlan, loadPlan } from '../../bin/adapters/framework/planning.ts';
import * as legacy from '../../scripts/framework/planning.ts';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
/** Registers cleanup under either runner: node:test exposes t.after, vitest onTestFinished. */
const after = (t, cleanup) => t.after ? t.after(cleanup) : t.onTestFinished(cleanup);

const frameworkRoot=resolve(import.meta.dirname,'../..');
async function fixture(t){
  const root=await realpath(await mkdtemp(join(tmpdir(),'framework-planning-')));
  after(t, ()=>rm(root,{recursive:true,force:true}));
  return {root,frameworkRoot};
}
const setup={command:'setup',args:[],options:{id:'planning-test',name:'Planning Test',author:'Test',blank:true}};

test('relocated planning preserves compatibility and hash-bound setup application', async t=>{
  assert.equal(legacy.planOperation,planOperation);
  assert.equal(legacy.applyOperation,applyOperation);
  assert.equal(legacy.saveOperationPlan,saveOperationPlan);
  assert.equal(legacy.loadPlan,loadPlan);
  const context=await fixture(t);
  const planned=await planOperation(setup,context);
  assert.match(planned.planHash,/^[a-f0-9]{64}$/);
  assert.equal(planned.review.planHash,planned.planHash);
  const applied=await applyOperation(planned,context,planned.planHash);
  assert.ok(applied.written.includes('shell.config.json'));
  await assert.rejects(applyOperation(planned,context,'0'.repeat(64)), { code: 'PLAN_STALE' });
});

test('relocated planning saves, reloads and protects replayable plans', async t=>{
  const context=await fixture(t);
  const planned=await planOperation(setup,context);
  const path=await saveOperationPlan(context,planned,'plans/setup.plan.json');
  assert.equal(path,join(context.root,'plans/setup.plan.json'));
  const loaded=await loadPlan(context,'plans/setup.plan.json');
  assert.equal(loaded.planHash,planned.planHash);
  await assert.rejects(saveOperationPlan(context,planned,'.framework/plan.json'), { code: 'PLAN_OUTPUT_PROTECTED' });
  await assert.rejects(saveOperationPlan(context,{...planned,request:{...planned.request,options:{...planned.request.options,input:'-'}}},'stdin.plan.json'), { code: 'STDIN_PLAN_NOT_REPLAYABLE' });
});

test('relocated planning routes vault, handout and styles through reviewed plan boundaries', async t=>{
  const context=await fixture(t);
  const setupPlan=await planOperation(setup,context); await applyOperation(setupPlan,context,setupPlan.planHash);
  const vault=await planOperation({command:'vault prepare',args:[],options:{}},context);
  assert.ok(vault.plan.changes.some(change=>change.path.endsWith('/.framework-vault.json')));
  await mkdir(join(context.root,'docs/prds'),{recursive:true}); await writeFile(join(context.root,'docs/prds/one.md'),'# One');
  // Setup already wrote the handout, so generate preserves it; after removal it plans a fresh create.
  const preserved=await planOperation({command:'handout generate',args:[],options:{}},context);
  assert.deepEqual(preserved.plan.changes,[]); assert.equal(preserved.summary.action,'preserved');
  await rm(join(context.root,'PROJECT-SETUP-HANDOUT.md'));
  const handout=await planOperation({command:'handout generate',args:[],options:{}},context);
  assert.ok(handout.plan.changes.some(change=>change.path==='PROJECT-SETUP-HANDOUT.md'&&change.status==='create'));
  const project=await readFile(join(context.root,'design/project.json'),'utf8');
  const styles=await planOperation({command:'styles export',args:[],options:{input:'-',format:'json',out:'exports/styles.json'}},{...context,inputText:project});
  assert.equal(styles.plan.changes[0].path,'exports/styles.json');
});

test('relocated planning rejects cancelled and unsupported operations before writes', async t=>{
  const context=await fixture(t),controller=new AbortController(); controller.abort();
  await assert.rejects(planOperation(setup,{...context,signal:controller.signal}), { code: 'CANCELLED' });
  await assert.rejects(planOperation({command:'status',args:[],options:{}},context),/Operation has no file plan/);
});
