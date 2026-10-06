import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sampleSummary, measureOperation } from '../../src/cli/adapters/framework/measurement.ts';
import { executeOperation } from '../../src/cli/adapters/framework/operations.ts';
import { parseCliArguments } from '../../src/cli/adapters/framework/catalog.ts';
import { starterDocumentText } from '../support/starter-documents.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const source=starterDocumentText('quick-capture');
const request=(...args)=>parseCliArguments(args);

test('measurements keep cold, warmup and all slow samples with nearest-rank statistics',async()=>{
  let calls=0,clock=0;
  const result=await measureOperation(()=>{calls++;clock+=calls===7?100:2;},3,undefined,()=>clock);
  assert.equal(calls,7);assert.equal(result.coldMs,2);assert.deepEqual(result.warmupMs,[2,2,2]);
  assert.deepEqual(result.samplesMs,[2,2,100]);assert.equal(result.p95Ms,100);assert.equal(result.medianMs,2);
  const input=[9,1,6,4];assert.equal(sampleSummary(input).medianMs,4);assert.deepEqual(input,[9,1,6,4]);
});
test('bad, missing and accessor samples fail instead of becoming healthy measurements',async()=>{
  for(const data of [[],[NaN],[Infinity],[-1],Array(3),Array(31).fill(1)])assert.throws(()=>sampleSummary(data),{code:'MEASUREMENT_INVALID'});
  let invoked=false;const data=[];Object.defineProperty(data,'0',{get(){invoked=true;return 1;}});
  assert.throws(()=>sampleSummary(data),{code:'MEASUREMENT_INVALID'});assert.equal(invoked,false);
  for(const count of [0,2,31,NaN,2.5])await assert.rejects(()=>measureOperation(()=>{},count),{code:'MEASUREMENT_COUNT'});
});
test('warmup failure, broken clocks and cancellation are never discarded or reported passed',async()=>{
  let calls=0;await assert.rejects(()=>measureOperation(()=>{if(++calls===3)throw Error('warmup failed');},3),/warmup failed/);assert.equal(calls,3);
  await assert.rejects(()=>measureOperation(()=>{},3,undefined,()=>NaN),{code:'MEASUREMENT_CLOCK'});
  let clock=20;await assert.rejects(()=>measureOperation(()=>{},3,undefined,()=>clock--),{code:'MEASUREMENT_CLOCK'});
  const controller=new AbortController();controller.abort();await assert.rejects(()=>measureOperation(()=>{},3,controller.signal),{code:'CANCELLED'});
  await assert.rejects(()=>measureOperation(()=>({then(){}}),3),{code:'MEASUREMENT_ASYNC'});
});
test('public measurement dry run is inert even with missing or executable project input',async t=>{
  const cwd=await realpath(await mkdtemp(join(tmpdir(),'measure-project-')));t.after(()=>rm(cwd,{recursive:true,force:true}));
  const response=await executeOperation(request('project','measure','--input','missing.json','--samples','3','--dry-run'),{root:cwd,frameworkRoot:root});
  assert.equal(response.status,'planned');assert.equal(response.data.execution,'not-run');assert.deepEqual(await readdir(cwd),[]);
});
test('public measurement uses actual bounded authoring operations and excludes authored data',async()=>{
  const response=await executeOperation(request('project','measure','--input','-','--samples','3'),{root,frameworkRoot:root,inputText:source});
  assert.equal(response.status,'ok',JSON.stringify(response.diagnostics));assert.equal(response.data.projectSchema,6);
  assert.equal(response.data.measured.length,4);assert.equal(response.data.inputBytes,Buffer.byteLength(source));
  for(const item of response.data.measured){assert.equal(item.samplesMs.length,3);assert.ok(item.samplesMs.every(Number.isFinite));}
  assert.equal(response.data.budgets,'not-established');assert.equal(response.data.qualification,'not-inferred');
  assert.deepEqual(response.data.written,[]);assert.equal(response.data.contentIncluded,false);
  assert.ok(!JSON.stringify(response).includes(JSON.parse(source).project.name));
});
test('public command rejects invalid arguments, malformed projects and absent stdin',async()=>{
  for(const args of [['--input','-','--samples','31'],['--input','-','--samples','0x10'],['--samples','3'],['--input','-']]){
    const result=await executeOperation(request('project','measure',...args),{root,frameworkRoot:root});assert.equal(result.status,'failed');
  }
  const invalid=await executeOperation(request('project','measure','--input','-'),{root,frameworkRoot:root,inputText:'{}'});
  assert.equal(invalid.status,'failed');assert.equal(invalid.data,null);
});

test('measurement yields between samples so an actual queued cancellation stops work',async()=>{
  const controller=new AbortController();let calls=0;
  const run=measureOperation(()=>{calls++;if(calls===2)setImmediate(()=>controller.abort());},30,controller.signal);
  await assert.rejects(run,{code:'CANCELLED'});assert.equal(calls,2);
});
