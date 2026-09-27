/** Explicit build adapter. It reuses the devKit's pinned offline builder, never installs dependencies. */
import { readBounded } from '../framework/files.ts';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const args=process.argv.slice(2);
if(args.some(arg=>arg!=='--replace') || new Set(args).size!==args.length) throw new Error('CLICKDUMMY_USAGE: only --replace is supported');
const root=process.cwd();
const { buildPrototype }=await import(pathToFileURL(resolve(root,'.claude/skills/companion-prototype-design/scripts/build-prototype.mjs')).href);
const project=JSON.parse((await readBounded(resolve(root,'design/project.json'),4_000_000)).toString('utf8'));
const result=await buildPrototype({repo:root,entry:'harness/prototype/main.ts',project:'design/project.json',out:resolve(root,'clickdummy.html'),title:project.project.name,replace:args.includes('--replace')});
process.stdout.write(JSON.stringify(result)+'\n');
process.exitCode=result.status==='ok'?0:1;
