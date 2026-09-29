import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { build } from 'vite';
import { sharedConfig } from '../bundling/vite-shared.mjs';
import { composeMvp } from './mvp-compose.mjs';
import { composeStarterWorkspace } from './starter-workspace.mjs';
import { parseDefinition } from '../starters/repository.ts';

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
const prototypeBridge=await readFile('scripts/concepts/prototype-bridge.js','utf8');
const starterBridge = await readFile('scripts/concepts/starter-bridge.js', 'utf8');
const html=composeStarterWorkspace(composeMvp(base,bundle,css,bridge+'\n'+prototypeBridge,graphStyle), starterBridge);
await writeFile(join(out,'index.html'),html);
// The maintained self-project is now a starter. Compatibility exports are derived, never edited masters.
const starterSource = 'configs/starters/companion-plugin.json';
const starterBytes = await readFile(starterSource);
const golden = parseDefinition(starterBytes);
if (golden.generator.kind !== 'companion') throw Error('MVP_STARTER: Golden template must contain an authoring model.');
const project = JSON.stringify(golden.generator.document, null, 2) + '\n';
await writeFile(join(out, 'companion-project.json'), project);
await Promise.all([
  writeFile(join(out,'companion-journey-lens.html'),html),
  writeFile(join(out,'companion-project-v6.json'),project),
]);
const hash=v=>createHash('sha256').update(v).digest('hex');
await writeFile(join(out,'build.json'),JSON.stringify({schema:1,scope:'Companion browser authoring, not native acceptance',
  entry:'companion-journey-lens.html', startup:'empty-or-restored', starterSource, starterSha256:hash(starterBytes), projectRole:'derived-compatibility-only', projectEntry:'companion-project-v6.json',baseline:hash(base),html:hash(html),bundle:hash(bundle),stylesheet:hash(css),project:hash(project)},null,2)+'\n');
console.log('Built empty-start Companion and derived golden-starter compatibility export in reports/companion-mvp');
