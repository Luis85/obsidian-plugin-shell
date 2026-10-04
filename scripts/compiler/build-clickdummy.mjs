/** Explicit build adapter. It runs the generated project's shipped offline worker, never installs dependencies. */
import { readBounded } from '../../bin/adapters/framework/files.ts';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const args=process.argv.slice(2);
if(args.some(arg=>arg!=='--replace') || new Set(args).size!==args.length) throw new Error('CLICKDUMMY_USAGE: only --replace is supported');
const root=process.cwd();
const project=JSON.parse((await readBounded(resolve(root,'design/project.json'),4_000_000)).toString('utf8'));
const options={entry:'harness/prototype/main.ts',project:'design/project.json',out:resolve(root,'clickdummy.html'),title:project.project.name,replace:args.includes('--replace')};
// A generated project's one canonical builder is the shipped worker under scripts/clickdummy/; the maintainer skill is never probed.
const result=shippedWorker(options);
process.stdout.write(JSON.stringify(result)+'\n');
process.exitCode=result.status==='ok'?0:1;

/** Runs the shipped worker with the same arguments the skill passes and accepts only its completed build receipt. */
function shippedWorker({entry,project:input,out,title,replace}){
  const worker=resolve(root,'scripts/clickdummy/lib/build-worker.mjs');
  if(!existsSync(worker)) return {status:'failed',code:'CLICKDUMMY_BUILDER_MISSING',message:'scripts/clickdummy/lib/build-worker.mjs is not present; regenerate the project.'};
  const argv=[worker,'--entry',resolve(root,entry),'--project',resolve(root,input),'--out',out,'--title',title,...(replace?['--replace']:[])];
  const receipt=JSON.parse(execFileSync(process.execPath,argv,{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024,timeout:600000}));
  if(receipt.status!=='built-not-browser-verified') return {status:'failed',code:'CLICKDUMMY_RECEIPT',message:'The worker did not return a completed build receipt.',receipt};
  return {status:'ok',command:'prototype build',data:receipt};
}
