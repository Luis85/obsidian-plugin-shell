import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createFilePlan, applyFilePlan } from '../../scripts/shared/file-plan.mjs';
async function fixture(run) { const root=await mkdtemp(join(tmpdir(),'binary-plan-'));try{await run(root);}finally{await rm(root,{recursive:true,force:true});} }
test('explicit binary content hashes and writes decoded bytes, including rollback',()=>fixture(async root=>{
  const bytes=Buffer.from([0,255,1,128,13,10]); const entry={path:'fixture.gz',content:bytes.toString('base64'),encoding:'base64'};
  const plan=await createFilePlan(root,[entry]); assert.equal(plan.changes[0].afterHash,createHash('sha256').update(bytes).digest('hex'));
  await applyFilePlan(plan); assert.deepEqual(await readFile(join(root,entry.path)),bytes);
  assert.equal((await createFilePlan(root,[entry])).changes[0].status,'unchanged');
  const update=await createFilePlan(root,[{...entry,content:Buffer.from('new').toString('base64')},{path:'second.txt',content:'later'}]);
  await assert.rejects(applyFilePlan(update,{beforeWrite(_entry,index){if(index===1)throw new Error('stop');}}),/stop/);
  assert.deepEqual(await readFile(join(root,entry.path)),bytes);
}));
test('noncanonical, ambiguous, or forged binary encodings never enter the writer',()=>fixture(async root=>{
  for(const entry of [{content:'AA!!',encoding:'base64'},{content:'AA',encoding:'base64'},{content:null,encoding:'base64'},{content:'AA==',encoding:'hex'}]) await assert.rejects(createFilePlan(root,[{path:'x',...entry}]),/INVALID/);
  const plan=await createFilePlan(root,[{path:'x',content:'AA==',encoding:'base64'}]);
  await assert.rejects(applyFilePlan({...plan,changes:[{...plan.changes[0],encoding:undefined}]}),/INVALID_HASH/);
}));
