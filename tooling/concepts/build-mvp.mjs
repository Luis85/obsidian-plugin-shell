import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { build } from 'vite';
import { sharedConfig } from '../bundling/vite-shared.mjs';
import { composeMvp } from './mvp-compose.mjs';

const root=process.cwd(),out=resolve(root,'reports/companion-mvp');
await mkdir(out,{recursive:true});
// The checked-in schema 6 concept must be current; this build only mounts the editor islands into it.
const baseCheck=spawnSync(process.env.PYTHON??'python3',['-B','tooling/concepts/build-companion.py','--check'],{stdio:'inherit'});
if(baseCheck.status!==0)throw Error('MVP_ASSEMBLY: The checked-in concept is not current; rebuild it first.');
const config=sharedConfig();
await build({...config,configFile:false,build:{...config.build,outDir:join(out,'bundle'),emptyOutDir:true,
  lib:{entry:'src/companion/editor/main.ts',name:'CompanionJourney',formats:['iife'],fileName:()=> 'journey.js',cssFileName:'journey'},
  rolldownOptions:{external:['vue','pinia'],output:{globals:{vue:'Vue',pinia:'Pinia'},codeSplitting:false}},
}});
const [base,bundle,css,bridge,graphStyle,prototypeBridge]=await Promise.all([
  readFile('docs/concepts/companion/index.html','utf8'),readFile(join(out,'bundle/journey.js'),'utf8'),
  readFile(join(out,'bundle/journey.css'),'utf8'),readFile('tooling/concepts/mvp-bridge.js','utf8'),readFile('docs/concepts/companion/vendor/vue-flow.scoped.css','utf8'),readFile('tooling/concepts/prototype-bridge.js','utf8'),
]);
const html=composeMvp(base,bundle,css,bridge+'\n'+prototypeBridge,graphStyle);
await writeFile(join(out,'index.html'),html);
// Current output is an empty authoring workspace; project exports are explicit user/qualification operations.
await writeFile(join(out,'companion-journey-lens.html'),html);
for(const name of ['companion-project.json','companion-project-v6.json'])await rm(join(out,name),{force:true});
const hash=v=>createHash('sha256').update(v).digest('hex');
await writeFile(join(out,'build.json'),JSON.stringify({schema:1,scope:'Companion browser authoring, not native acceptance',
  entry:'companion-journey-lens.html',startup:'empty-or-restored',starterDefinitions:'external-json-only',baseline:hash(base),html:hash(html),bundle:hash(bundle),stylesheet:hash(css)},null,2)+'\n');
console.log('Built empty Companion workspace; load configs/starters/companion-plugin.json separately');
