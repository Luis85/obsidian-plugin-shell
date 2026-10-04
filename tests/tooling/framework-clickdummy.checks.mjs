import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeOperation } from '../../bin/adapters/framework/operations.ts';
import { parseCliArguments } from '../../bin/adapters/framework/catalog.ts';
import { commandHelp } from '../../bin/adapters/framework/help-text.ts';
import { descriptor } from '../../bin/adapters/framework/catalog.ts';
import { buildClickdummy } from '../../bin/adapters/framework/clickdummy.ts';

test('clickdummy dry run has zero writes and never needs or launches executable project config', async t=> {
  const root=await mkdtemp(join(tmpdir(),'clickdummy-plan-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const response=await executeOperation(parseCliArguments(['clickdummy','build','--dry-run','--json']),{root,frameworkRoot:root});
  assert.equal(response.status,'planned');assert.equal(response.data.execution,'not-run');assert.deepEqual(await readdir(root),[]);
});
test('clickdummy build refuses non-generated projects with an actionable diagnostic', async ()=> {
  const root=fileURLToPath(new URL('../../',import.meta.url));
  const response=await executeOperation(parseCliArguments(['clickdummy','build']),{root,frameworkRoot:root});
  assert.equal(response.status,'failed');assert.equal(response.diagnostics[0].code,'CLICKDUMMY_PROJECT_REQUIRED');
});
test('fixed entry/output and explicit replace are discoverable; caller-supplied source code paths are refused',()=> {
  const request=parseCliArguments(['clickdummy','build','--replace']);assert.equal(request.options.replace,true);
  assert.throws(()=>parseCliArguments(['clickdummy','build','--input','arbitrary.ts']));
  const help=commandHelp(descriptor('clickdummy build'));assert.equal(help.group,'develop');assert.match(help.optionHelp.replace.description,/successful build/);
});
test('clickdummy build always runs the shipped project worker, even beside a maintainer prototype skill', async ()=> {
  const calls=[];
  const dependencies={exists:async ()=>true,inspectDesign:async ()=>({model:{project:{name:'Probe'}}}),
    runNode:async (_context,worker,args)=>{calls.push([worker,args]);return {stdout:JSON.stringify({status:'built-not-browser-verified'}),truncated:false};}};
  const response=await buildClickdummy({command:'clickdummy build',args:[],options:{}},{root:'/project',frameworkRoot:'/project'},dependencies);
  assert.equal(response.status,'ok');assert.deepEqual(calls.map(([worker])=>worker),['scripts/clickdummy/lib/build-worker.mjs']);
});
const builder=fileURLToPath(new URL('../../scripts/compiler/build-clickdummy.mjs',import.meta.url));
const put=async (root,path,content)=>{await mkdir(join(root,path,'..'),{recursive:true});await writeFile(join(root,path),content);};
test('the generated build:clickdummy script uses only the shipped worker and never probes the prototype skill', async t=> {
  const root=await mkdtemp(join(tmpdir(),'clickdummy-script-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await put(root,'design/project.json',JSON.stringify({project:{name:'Probe'}}));
  await put(root,'.claude/skills/companion-prototype-design/scripts/build-prototype.mjs',"import { writeFileSync } from 'node:fs';\nexport async function buildPrototype(){writeFileSync('skill-used','x');return {status:'ok'};}\n");
  const run=()=>spawnSync(process.execPath,[builder],{cwd:root,encoding:'utf8',timeout:60000});
  const missing=run();assert.equal(missing.status,1);assert.equal(JSON.parse(missing.stdout).code,'CLICKDUMMY_BUILDER_MISSING');
  await put(root,'scripts/clickdummy/lib/build-worker.mjs',"import { writeFileSync } from 'node:fs';\nwriteFileSync('worker-argv.json',JSON.stringify(process.argv.slice(2)));\nprocess.stdout.write(JSON.stringify({status:'built-not-browser-verified'}));\n");
  const built=run();assert.equal(built.status,0,built.stderr);assert.equal(JSON.parse(built.stdout).status,'ok');
  const argv=JSON.parse(await readFile(join(root,'worker-argv.json'),'utf8'));
  assert.deepEqual(argv,['--entry',join(root,'harness/prototype/main.ts'),'--project',join(root,'design/project.json'),'--out',join(root,'clickdummy.html'),'--title','Probe']);
  assert.ok(!(await readdir(root)).includes('skill-used'));
});
