/** Explicit qualification of the installed, independently generated workspace. Not generation. */
import { readFile, appendFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
const target = (await readFile('reports/project-generator/target.txt','utf8')).trim();
const project = JSON.parse(await readFile(join(target,'design/project.json'),'utf8'));
const main = join(target,'harness/app/main.ts');
const styles = join(target,project.settings.codebaseFolder,'generated/styles/project.css');
const path = relative(join(target,'harness/app'),styles).replaceAll('\\','/');
// Only the disposable generated fixture is altered. Production still uses its existing entrypoint.
await appendFile(main,`\nimport ${JSON.stringify(path)};\n`);
const checks = [];
for (const [name,args] of [
  ['harness-build',['node_modules/vite/bin/vite.js','build','--config','vite.harness.config.mjs']],
  ['nuxt-styles',['node_modules/@playwright/test/cli.js','test','tests/e2e/design-system.spec.ts']],
]) {
  const run=spawnSync(process.execPath,args,{cwd:target,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024,env:{...process.env,GENERATED_STYLES:'1'}});
  await writeFile('reports/project-generator/'+name+'.log',(run.stdout??'')+(run.stderr??''));
  checks.push({name,status:run.status,error:run.error?.message});
  await writeFile('reports/project-generator/styles-checks.json',JSON.stringify(checks,null,2)+'\n');
  if(run.status!==0||run.error)throw new Error('STYLE_QUALIFICATION_FAILED: '+name+'\n'+run.stdout+run.stderr);
}
