import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { supportSnapshot, supportReport } from '../../bin/adapters/framework/support-report.ts';
import { executeOperation } from '../../bin/adapters/framework/operations.ts';
import { parseCliArguments } from '../../bin/adapters/framework/catalog.ts';
const root=fileURLToPath(new URL('../../',import.meta.url));
const observation=()=>({data:{generated:true,imported:true,dependencies:true,designStale:false,acceptanceObligations:31,
  root:'/private/secret',manifest:{id:'private-name'},configuration:{token:'private-token'},note:'private-note'},
  diagnostics:[{code:'ACCEPTANCE_PENDING',message:'private-note',path:'/private/secret'},{code:'private-code'}]});

test('support uses an allowlist and never emits arbitrary keys, hashes, causes, messages or identifiers',()=>{
  const report=supportSnapshot(observation());assert.equal(report.schemaVersion,1);
  assert.deepEqual(report.diagnosticCodes,['ACCEPTANCE_PENDING','OTHER']);assert.equal(report.observations.acceptanceObligations,31);
  assert.ok(!JSON.stringify(report).includes('private'));assert.equal(report.qualification,'not-inferred');
});
test('support does not evaluate getters in discarded fields or diagnostic codes',()=>{
  const input=observation();let calls=0;Object.defineProperty(input.data,'root',{get(){calls++;throw Error('secret');}});
  Object.defineProperty(input.diagnostics[0],'code',{get(){calls++;throw Error('secret');}});
  assert.deepEqual(supportSnapshot(input).diagnosticCodes,['OTHER']);assert.equal(calls,0);
  Object.defineProperty(input.data,'generated',{get(){calls++;return true;}});
  assert.throws(()=>supportSnapshot(input),{code:'SUPPORT_SHAPE'});assert.equal(calls,0);
});
test('support rejects missing counts, corrupt flags, sparse collections and unbounded data',()=>{
  for(const edit of [input=>{input.data.generated='true';},input=>{input.data.acceptanceObligations=-1;},
    input=>{input.data.designStale='false';},input=>{input.diagnostics=Array(2);},input=>{input.diagnostics=Array(101).fill({});}]){
    const input=observation();edit(input);assert.throws(()=>supportSnapshot(input),{code:'SUPPORT_SHAPE'});
  }
});
test('actual public report reads inert metadata without running project code or writing a bundle',async t=>{
  const cwd=await realpath(await mkdtemp(join(tmpdir(),'support-private-')));t.after(()=>rm(cwd,{recursive:true,force:true}));
  await writeFile(join(cwd,'package.json'),JSON.stringify({name:'private-project',scripts:{support:'throw private'}}));
  await writeFile(join(cwd,'manifest.json'),JSON.stringify({id:'private-id',author:'private-author'}));
  const before=await readdir(cwd);
  const response=await executeOperation(parseCliArguments(['support','report','--json']),{root:cwd,frameworkRoot:root});
  assert.equal(response.status,'ok',JSON.stringify(response.diagnostics));assert.equal(response.data.observations.generated,false);
  assert.ok(response.data.diagnosticCodes.includes('CONFIG_MISSING'));assert.ok(!JSON.stringify(response).includes('private'));
  assert.deepEqual(await readdir(cwd),before);assert.deepEqual(response.data.written,[]);
});
test('read failures and cancellation cannot expose private filesystem errors',async t=>{
  const cwd=await realpath(await mkdtemp(join(tmpdir(),'support-private-')));t.after(()=>rm(cwd,{recursive:true,force:true}));
  await writeFile(join(cwd,'shell.config.json'),'{private-malformed');
  const response=await supportReport({root:cwd,frameworkRoot:root});assert.equal(response.status,'blocked');assert.equal(response.data,null);
  assert.equal(response.diagnostics[0].code,'SUPPORT_UNAVAILABLE');assert.ok(!JSON.stringify(response).includes('private'));
  const controller=new AbortController();controller.abort();assert.equal((await supportReport({root:cwd,frameworkRoot:root,signal:controller.signal})).status,'cancelled');
});

// Exercise the actual launcher, including root discovery before the support handler.
test('CLI root-discovery errors and invalid support arguments never disclose private paths',()=>{
  for(const leading of [false,true])for(const args of [['--root','/private-client-canary-does-not-exist'],['--private-client-canary-option']]){
    const run=spawnSync(process.execPath,[join(root,'bin/app'),...(leading?['--json']:[]),'support','report',...args,...(leading?[]:['--json'])],{encoding:'utf8',env:{...process.env,NODE_NO_WARNINGS:'1'}});
    assert.equal(run.status,1);assert.equal(run.stderr,'');
    const response=JSON.parse(run.stdout);assert.equal(response.command,'support report');
    assert.equal(response.status,'blocked');assert.equal(response.diagnostics[0].code,'SUPPORT_UNAVAILABLE');
    assert.ok(!run.stdout.includes('private-client-canary'));
  }
});
