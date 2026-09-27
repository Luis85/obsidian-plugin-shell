import type { Artifact, TemplateSnapshot } from '../domain/contracts.ts';
import { CompilerError, diagnostic } from '../domain/diagnostics.ts';
import { literal, json, type Model } from '../../companion/compiler/model.ts';
import { sample } from '../../companion/compiler/schema-code.ts';
import { relativeImport } from '../../companion/compiler/file-code.ts';

/** Browser target reuses the emitted Vue/navigation/runtime and the shipped offline build worker. */
export function clickdummyFiles(model:Model, template:TemplateSnapshot, files:Artifact[]):Artifact[] {
  const worker='.claude/skills/companion-prototype-design/scripts/lib/build-worker.mjs';
  if(!template.skillFiles.some(file=>file.path===worker)) throw new CompilerError(diagnostic('COMPILER_TEMPLATE_INVALID','lower','Click-dummy output requires the bundled prototype builder.'));
  const root=model.sourceRoot, entry='harness/prototype/main.ts';
  const imports=(path:string)=>literal(relativeImport(entry,path));
  const fixtures=model.sources.flatMap(source=>source.operations.map(operation=>({sourceId:source.id,operationId:operation.id,
    direction:operation.direction,requiresInput:operation.input!==null,data:operation.output === null ? null : sample(operation.output)})));
  const add=(path:string,content:string):Artifact=>({path,content,ownership:'managed',producer:'clickdummy'});
  const pkgFile=files.find(file=>file.path==='package.json')!;
  const pkg=JSON.parse(pkgFile.content);
  pkg.scripts['build:clickdummy']='node scripts/compiler/build-clickdummy.mjs';
  pkg.scripts['typecheck:clickdummy']='vue-tsc --noEmit --project tsconfig.clickdummy.json';
  return [...files.filter(file=>file.path!=='package.json'),{...pkgFile,content:json(pkg)},
    add('tsconfig.clickdummy.json',json({extends:'./tsconfig.project.json',include:['harness/prototype/**/*.ts',root+'/**/*.ts',root+'/**/*.vue']})),
    add(entry,`import { createApp, createVNode, h, nextTick, ref } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import ui from '@nuxt/ui/vue-plugin';
import UApp from '@nuxt/ui/components/App.vue';
import UBadge from '@nuxt/ui/components/Badge.vue';
import Workbench from ${imports(root+'/presentation/components/ProjectWorkbench.vue')};
import { panels } from ${imports(root+'/bootstrap/panels.ts')};
import { projectKey } from ${imports(root+'/presentation/context/project.ts')};
import { visualKey, type VisualContext } from ${imports(root+'/presentation/composables/use-visual.ts')};
import { useNavigation } from ${imports(root+'/presentation/stores/navigation.ts')};
import { screens } from ${imports(root+'/domain/screens.ts')};
import '../../src/styles/app.css';
import ${imports(root+'/styles/project.css')};
import './frame.css';

const pinia=createPinia(), navigation=useNavigation(pinia);
const modal=ref<string|null>(null), dialog=ref<HTMLDialogElement|null>(null);
function openModal(id:string):void {
  if(!screens.some(screen=>screen.id===id && screen.kind==='modal')) throw new Error('SCREEN_NOT_MODAL');
  modal.value=id; void nextTick(()=>dialog.value?.showModal());
}
const context:VisualContext={
  ports:${literal(fixtures)}.map(fixture=>({...fixture,pending:false,error:null,
    async run(){if(fixture.direction!=='read') throw new Error('IMPLEMENTATION_REQUIRED: preview never writes business data');return structuredClone(fixture.data);}})),
  navigate(id){const screen=screens.find(screen=>screen.id===id);if(screen?.kind==='modal')openModal(id);else navigation.open(id);},
  async handle(){throw new Error('IMPLEMENTATION_REQUIRED: business acceptance remains open');},
};
const app=createApp({render:()=>h(UApp,{},()=>[
  h('header',{class:'clickdummy-banner'},[h(UBadge,{},()=> 'Click-dummy'),h('span','Fixture preview. No vault, network or persistence.')]),
  createVNode(Workbench),
  modal.value ? h('dialog',{ref:dialog,onClose:()=>{modal.value=null;}},[
    h('button',{type:'button',onClick:()=>dialog.value?.close()},'Close'),h(panels[modal.value]!)]):null,
])});
app.use(pinia);app.use(ui);
app.provide(projectKey,{panels,flows:[],isolated:false,openModal});app.provide(visualKey,context);
let failed=false;
app.config.errorHandler=error=>{failed=true;delete document.documentElement.dataset.prototypeReady;console.error(error);};
const container=document.getElementById('prototype-app');
if(!container)throw new Error('PROTOTYPE_MOUNT_MISSING');
app.mount(container);void nextTick(()=>{if(!failed)document.documentElement.dataset.prototypeReady='true';});
window.addEventListener('pagehide',()=>{app.unmount();disposePinia(pinia);delete document.documentElement.dataset.prototypeReady;},{once:true});
`),
    add('harness/prototype/frame.css',`body{margin:0;font-family:system-ui,sans-serif;background:#f8fafc;color:#172033}
.prototype-root{min-height:100vh;--background-primary:#fff;--background-secondary:#f1f5f9;--text-normal:#172033;--text-muted:#526176;--interactive-accent:#4f46e5}
.clickdummy-banner{display:flex;gap:12px;align-items:center;padding:12px 20px;border-bottom:1px solid #dce2ea}
dialog{max-width:min(90vw,960px);max-height:90vh;border:1px solid #cbd5e1;border-radius:8px;padding:20px}dialog::backdrop{background:#0006}
`),
    add('CLICKDUMMY.md',`# Click-dummy output

This workspace reuses the generated Vue components and navigation. Source reads use synthetic schema fixtures; business writes and missing handlers fail explicitly. No Obsidian host or vault is opened.

Review dependency readiness in design/compiler-readiness.json. Install explicitly, run npm run typecheck:clickdummy and npm run build:clickdummy. The existing qualified Vite/static-UI/CSS/license pipeline emits clickdummy.html with libraries embedded and a network-blocking CSP. Existing output is preserved; use node scripts/compiler/build-clickdummy.mjs --replace to replace it deliberately.

Bundling is not browser acceptance. Run the compiler browser qualification before sharing. Third-party external adapters remain implementation points; they are not silently simulated.
`),
  ].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
