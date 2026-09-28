import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { build } from 'vite';
import { sharedConfig } from '../bundling/vite-shared.mjs';
import { composeMvp } from './mvp-compose.mjs';

const root=process.cwd(),out=resolve(root,'reports/companion-mvp');
await mkdir(out,{recursive:true});
// Keep the retained v5 artifact qualified; the modern build is derived from the exact same maintained source.
const baseCheck=spawnSync(process.env.PYTHON??'python3',['-B','scripts/concepts/build-companion.py','--check'],{stdio:'inherit'});
if(baseCheck.status!==0)throw Error('MVP_ASSEMBLY: Legacy source fixture is not current.');
const config=sharedConfig();
await build({...config,configFile:false,build:{...config.build,outDir:join(out,'bundle'),emptyOutDir:true,
  lib:{entry:'docs/concepts/companion/editor/main.ts',name:'CompanionJourney',formats:['iife'],fileName:()=> 'journey.js',cssFileName:'journey'},
  rolldownOptions:{external:['vue','pinia'],output:{globals:{vue:'Vue',pinia:'Pinia'},codeSplitting:false}},
}});
const [base,bundle,css,bridge,graphStyle]=await Promise.all([
  readFile('docs/concepts/companion/index.html','utf8'),readFile(join(out,'bundle/journey.js'),'utf8'),
  readFile(join(out,'bundle/journey.css'),'utf8'),readFile('scripts/concepts/mvp-bridge.js','utf8'),readFile('docs/concepts/companion/vendor/vue-flow.scoped.css','utf8'),
]);
const html=composeMvp(base,bundle,css,bridge,graphStyle);
await writeFile(join(out,'index.html'),html);
const exportResult=spawnSync(process.env.PYTHON??'python3',['-B','scripts/concepts/export-companion-project.py','--html',join(out,'index.html'),'--output',join(out,'companion-project.json')],{stdio:'inherit'});
if(exportResult.status!==0)throw Error('MVP_EXPORT: Current self-project failed export.');
// Named review entries distinguish the current replacement from the retained v5 compatibility fixture.
const project=await readFile(join(out,'companion-project.json'));
await Promise.all([
  writeFile(join(out,'companion-journey-lens.html'),html),
  writeFile(join(out,'companion-project-v6.json'),project),
]);
const hash=v=>createHash('sha256').update(v).digest('hex');
await writeFile(join(out,'build.json'),JSON.stringify({schema:1,scope:'Companion browser authoring, not native acceptance',
  entry:'companion-journey-lens.html',projectEntry:'companion-project-v6.json',baseline:hash(base),html:hash(html),bundle:hash(bundle),stylesheet:hash(css),project:hash(project)},null,2)+'\n');
console.log('Built integrated companion and full v6 self-project in reports/companion-mvp');
