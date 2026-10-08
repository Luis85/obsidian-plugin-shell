import { loadDefinitions } from '../../src/cli/adapters/starters/repository.ts';
/** Explicit qualified-toolchain integration: generated plugin and offline browser output. */
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { planProject, applyProject } from '../../src/cli/compiler/adapters/project-plan.ts';
import { compileProject, loadTemplateSnapshot } from '../../src/cli/compiler/index.ts';
const root=fileURLToPath(new URL('../../',import.meta.url));
const npm=process.env.QUALIFIED_NPM;
// --no-browser (CI without the e2e opt-in) keeps generation, install, verification and builds and skips both browser runs.
const flags=process.argv.slice(2);
if(flags.some(flag=>flag!=='--no-browser'))throw new Error('QUALIFICATION_ARGUMENT: only --no-browser is supported.');
const browser=!flags.includes('--no-browser');
if(!npm)throw new Error('QUALIFIED_NPM_REQUIRED: supply the qualified npm CLI, no implicit global install.');
const output=join(root,'reports/compiler-qualification');await mkdir(output,{recursive:true});
const vault=await realpath(await mkdtemp(join(tmpdir(),'compiler-qualification-')));
const report={schemaVersion:1,status:'failed',scope:'Generated plugin and offline click-dummy; not native or business acceptance',browser:browser?'run':'not-run: --no-browser',steps:[],artifacts:[]};
async function command(label,args,cwd){
  const result=spawnSync(process.execPath,args,{cwd,encoding:'utf8',timeout:600000,maxBuffer:30_000_000});
  const text=(result.stdout??'')+(result.stderr??'');await writeFile(join(output,label+'.log'),text);process.stdout.write(text);
  report.steps.push({label,exit:result.status});if(result.status!==0)throw new Error(label+' failed: '+(result.error?.message??result.status));
}
try{
  if(browser)await command('preview-host-browser',[join(root,'tooling/compiler/verify-preview-host.mjs')],root);
  const source=JSON.stringify((await loadDefinitions(root)).find(entry=>entry.definition.id==='quick-capture').definition.generator.document);
  const template=await loadTemplateSnapshot(root),start=performance.now();
  const compilation=await compileProject({source,template,outputKind:'clickdummy'});
  const elapsed=performance.now()-start;
  if(compilation.status!=='ok'||elapsed>15000)throw new Error('COMPILER_PERFORMANCE_BUDGET: quick-capture warm-snapshot compilation must complete within 15 s.');
  report.steps.push({label:'compile-budget',durationMs:elapsed,limitMs:15000,exit:0});
  const input=join(vault,'project.json');await writeFile(input,source);
  const plan=await planProject({input,vault,target:'project',templateRoot:root,outputKind:'clickdummy'});await applyProject(plan,plan.hash);
  const target=join(vault,'project');
  await command('install',[resolve(npm),'ci','--no-fund'],target);
  await command('plugin-verification',[resolve(npm),'run','verify:project'],target);
  await command('browser-typecheck',[resolve(npm),'run','typecheck:clickdummy'],target);
  await command('browser-build',[resolve(npm),'run','build:clickdummy'],target);
  if(browser)await command('browser-behavior',[join(root,'tooling/compiler/verify-browser.mjs'),join(target,'clickdummy.html'),join(target,'design/project.json'),output],root);
  for(const path of ['dist/main.js','dist/styles.css','dist/manifest.json','clickdummy.html']){
    const bytes=await readFile(join(target,path));report.artifacts.push({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
    if(path==='clickdummy.html')await writeFile(join(output,'clickdummy.html'),bytes);
  }
  report.status='passed';
}finally{await writeFile(join(output,'summary.json'),JSON.stringify(report,null,2)+'\n');await rm(vault,{recursive:true,force:true});}
