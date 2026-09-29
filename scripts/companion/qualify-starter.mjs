/** Actual isolated install/build/typecheck/test evidence for one built-in starter. */
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { loadStarterCatalog } from './starter-files.mjs';
import { customizeStarter } from './starter-contract.mjs';
import { planProject, applyProject } from './compiler/plan.ts';
const root=fileURLToPath(new URL('../../',import.meta.url)),id=process.argv[2];
const catalog=await loadStarterCatalog(root),entry=catalog.starters.find(s=>s.id===id);
if(!entry)throw Error('Supply a built-in starter ID.');
const out=join(root,'reports/project-starters',id);await mkdir(out,{recursive:true});
// Canonical path: Windows 8.3 temp aliases break test-module resolution in the generated workspace.
const vault=await realpath(await mkdtemp(join(tmpdir(),'qualified-starter-'))),input=join(vault,'project.json');
const document=customizeStarter(catalog,id,{}),report={id,sourceSha256:entry.sha256,scope:'Independent generated dependency installation, build, typecheck and scaffold tests; not native Obsidian or completed business acceptance.',steps:[],status:'failed'};
function run(label,args,cwd){
 const npm=process.env.QUALIFIED_NPM;
 if(!npm)throw Error('QUALIFIED_NPM must identify the explicitly installed qualified npm CLI.');
 const result=spawnSync(process.execPath,[resolve(npm),...args],{cwd,encoding:'utf8',timeout:600000,maxBuffer:20_000_000});
 const text=(result.stdout||'')+(result.stderr||'');process.stdout.write(text);
 report.steps.push({label,exit:result.status,log:label+'.log'});
 return writeFile(join(out,label+'.log'),text).then(()=>{if(result.status!==0)throw Error(label+' failed: '+(result.error?.message||result.status));});
}
try{
 await writeFile(input,JSON.stringify(document,null,2)+'\n');
 const plan=await planProject({input,vault,target:'plugin',templateRoot:root});
 if(plan.conflicts.length)throw Error('Unexpected generation conflict.');await applyProject(plan,plan.hash);
 await writeFile(join(out,'project.json'),JSON.stringify(document,null,2)+'\n');
 const target=join(vault,'plugin');
 await run('npm-ci',['ci','--no-fund'],target);
 await run('verify-project',['run','verify:project'],target);
 report.outputs=[];
 for(const name of ['main.js','styles.css','manifest.json']){const raw=await readFile(join(target,'dist',name));report.outputs.push({name,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')});}
 report.status='passed';
}finally{
 await writeFile(join(out,'summary.json'),JSON.stringify(report,null,2)+'\n');
 await rm(vault,{recursive:true,force:true});
}
