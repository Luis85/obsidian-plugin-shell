import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile,rm,symlink,realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import { planProject,applyProject } from '../../scripts/companion/compiler/plan.ts';
const root=fileURLToPath(new URL('../../',import.meta.url));
function run(cwd,args) {
 const result=spawnSync(process.execPath,args,{cwd,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024,env:Object.fromEntries(Object.entries(process.env).filter(([key])=>key!=='NODE_TEST_CONTEXT'))});
 assert.equal(result.error,undefined,result.error?.message);assert.equal(result.status,0,result.stdout+result.stderr);return stripVTControlCharacters(result.stdout);
}
for(const id of ['custom-file-editor','file-context-menu'])test(id+': generate, extend, typecheck, execute host tests, build and preserve edited descriptors',async()=>{
 const temp=await realpath(await mkdtemp(join(tmpdir(),'native-workspace-')));
 try {
  const document=JSON.parse(await readFile(join(root,'docs/concepts/companion/starters',id+'.companion.json'),'utf8'));
  if(id==='file-context-menu'){document.settings.codebaseFolder='app/code';document.settings.testsFolder='quality/specs';}
  const input=join(temp,'project.json');await writeFile(input,JSON.stringify(document));
  const options={input,vault:temp,target:'plugin',templateRoot:root};const plan=await planProject(options);assert.deepEqual(plan.conflicts,[]);await applyProject(plan,plan.hash);
  const cwd=join(temp,'plugin');await symlink(join(root,'node_modules'),join(cwd,'node_modules'),process.platform==='win32'?'junction':'dir');
  const recipe=id==='custom-file-editor'?['context-menu','inspect-drawing','--extensions','shellnote']:['file-type','drawing','--extension','ownshape','--format','json'];
  const made=JSON.parse(run(cwd,['shell.mjs','make',...recipe,'--yes','--json']));assert.equal(made.status,'applied');
  run(cwd,['node_modules/vue-tsc/bin/vue-tsc.js','--noEmit','--project','tsconfig.project.json']);
  const tests=run(cwd,['node_modules/vitest/vitest.mjs','run','--config','vitest.project.config.mjs']);assert.match(tests,/Tests\s+\d+ passed/);assert.match(tests,/4 todo/);
  run(cwd,['scripts/bundling/build.mjs']);assert.ok((await readFile(join(cwd,'dist/main.js'))).length>1000);
  assert.match(await readFile(join(cwd,'dist/styles.css'),'utf8'),/native-file-editor/);
  const module=`${document.settings.codebaseFolder}/generated/${id==='custom-file-editor'?'domain/file-types/document':'application/file-actions/file-summary'}.ts`;
  const edited=(await readFile(join(cwd,module),'utf8'))+'\n// Retain domain-specific author logic.\n';await writeFile(join(cwd,module),edited);
  const replay=await planProject(options);assert.deepEqual(replay.conflicts,[]);assert.ok(replay.preserved.includes(module));assert.ok(replay.preserved.includes('src/bootstrap/native-integrations.ts'));
  await applyProject(replay,replay.hash);assert.equal(await readFile(join(cwd,module),'utf8'),edited);
 } finally {await rm(temp,{recursive:true,force:true});}
});
