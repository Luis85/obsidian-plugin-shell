import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { reviewedExamplesRemoved } from './example-sources-fixture.mjs';
import { assembleKit, installedCompiler } from '../../scripts/framework/kit.ts';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('packed compiled CLI and source CLI return equivalent analysis and errors without installed dependencies',async t=>{
  if (await reviewedExamplesRemoved(root)) { t.skip('Examples removed; kit packing requires the reviewed framework source preimages.'); return; }
  const destination=await mkdtemp(join(tmpdir(),'compiler-parity-'));
  try{
    const files=await assembleKit({root,frameworkRoot:root},await installedCompiler());
    for(const file of files){const path=join(destination,file.path);await mkdir(dirname(path),{recursive:true});await writeFile(path,file.bytes);}
    const valid=await readFile(join(root,'docs/concepts/companion/starters/blank.companion.json'),'utf8');
    for(const source of [valid,'{']){
      const invoke=directory=>spawnSync(process.execPath,[join(directory,'shell.mjs'),'compiler','check','--input','-','--json'],{cwd:directory,input:source,encoding:'utf8',timeout:30000});
      const a=invoke(root),b=invoke(destination);assert.equal(b.status,a.status,b.stderr);assert.deepEqual(JSON.parse(b.stdout),JSON.parse(a.stdout));
    }
    assert.ok(files.some(file=>file.path==='.framework/compiled/scripts/compiler/index.js'));
    assert.ok(files.some(file=>file.path==='.framework/template/scripts/compiler/check-architecture.mjs'));
  }finally{await rm(destination,{recursive:true,force:true});}
});
