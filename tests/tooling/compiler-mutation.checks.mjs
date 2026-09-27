import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=fileURLToPath(new URL('../../scripts/compiler/domain/',import.meta.url));
const files=['contracts.ts','diagnostics.ts','artifacts.ts','references.ts','source-references.ts'];
const cases=[
  {name:'duplicate artifact guard',file:'artifacts.ts',before:'if (previous)',after:'if (false)',
    assertion:`import { validateArtifacts } from './artifacts.ts'; assert.throws(()=>validateArtifacts([{path:'a',content:'x',ownership:'managed'},{path:'A',content:'x',ownership:'managed'}]));`},
  {name:'explicit replacement guard',file:'artifacts.ts',before:'if (old && (replaceProducer === undefined || old.producer !== replaceProducer))',after:'if (false)',
    assertion:`import { artifactCollector } from './artifacts.ts'; const file={path:'a',content:'x',ownership:'managed',producer:'p'};assert.throws(()=>artifactCollector([file]).add({...file,content:'changed'}));`},
  {name:'parent reference guard',file:'references.ts',before:"typeof node.parent === 'string' && !ids.has(node.parent)",after:'false',
    assertion:`import { referenceDiagnostics } from './references.ts'; assert.equal(referenceDiagnostics({design:{nodes:[{id:'a',parent:'missing'}],library:[],links:[]}},'p.json')[0]?.code,'COMPILER_REFERENCE_MISSING');`},
  {name:'source entity reference guard',file:'source-references.ts',before:"shape.mode === 'entity' && typeof shape.entity === 'string' && !entityIds.has(shape.entity)",after:'false',
    assertion:`import { sourceReferenceDiagnostics } from './source-references.ts'; assert.equal(sourceReferenceDiagnostics({design:{dataSources:{sources:[{id:'s',operations:[{id:'o',input:{mode:'entity',entity:'missing'}}]}]}}},'p.json')[0]?.code,'COMPILER_REFERENCE_MISSING');`},
];
for(const mutation of cases)test('mutation killed: '+mutation.name,async()=>{
  const folder=await mkdtemp(join(tmpdir(),'compiler-mutant-'));
  try{
    for(const file of files)await writeFile(join(folder,file),await readFile(join(root,file)));
    await writeFile(join(folder,'package.json'),' {"type":"module"}');
    await writeFile(join(folder,'probe.mjs'),"import assert from 'node:assert/strict';\nconsole.log('PROBE_EXECUTED');\n"+mutation.assertion);
    const run=()=>spawnSync(process.execPath,['--experimental-strip-types',join(folder,'probe.mjs')],{encoding:'utf8',timeout:10000});
    const baseline=run();assert.equal(baseline.status,0,baseline.stderr);
    const original=await readFile(join(folder,mutation.file),'utf8');assert.ok(original.includes(mutation.before));
    await writeFile(join(folder,mutation.file),original.replace(mutation.before,mutation.after));
    const mutant=run();assert.equal(mutant.status,1);assert.match(mutant.stdout,/PROBE_EXECUTED/);assert.match(mutant.stderr,/AssertionError/,'syntax/import failures are not killed mutants');
  }finally{await rm(folder,{recursive:true,force:true});}
});
