import { literal, type Model } from '../../../scripts/companion/compiler/model.ts';
import { relativeImport, type Add } from '../../../scripts/companion/compiler/file-code.ts';
/** Native and browser composition roots have disjoint storage adapters and one shared editor implementation. */
export function journeyBootstrapCode(m: Model, add: Add): void {
  const root=m.sourceRoot, base=`${root}/bootstrap`;
  add(`${root}/domain/journey-seed.ts`,`/** Complete inert seed. Reading the native view never writes it automatically. */\nexport const seed: string = ${literal(JSON.stringify(m.document))};\n`,'managed');
  const workspace=`${base}/journey-workspace.ts`;
  add(workspace,`import type { App } from 'vue';
import type { Pinia } from 'pinia';
import type { JourneyProjectStore } from ${literal(relativeImport(workspace,'scripts/companion/journey/project-store.ts'))};
import { workspaceKey } from '../presentation/journey/workspace/contracts.ts';
import { mount } from './journey-mount.ts';
import Flow from 'virtual:journey-flow';
import 'virtual:journey-flow.css';
import { useNavigation } from '../presentation/stores/navigation.ts';
import { screens } from '../domain/screens.ts';
import { seed } from '../domain/journey-seed.ts';
export interface JourneyRuntime { store: JourneyProjectStore; mode: 'native'|'preview'; path: string; serial: number; dispose(): void }
export function provideJourney(app:App,pinia:Pinia,runtime:JourneyRuntime): void {
  const navigation=useNavigation(pinia),id=${literal(String(m.project.id))}+'-journey-'+(++runtime.serial);
  app.provide(workspaceKey,{
    store:runtime.store,seed,mode:runtime.mode,ownerId:${literal(String(m.project.id))},initialPath:runtime.path,
    rememberPath(path){runtime.path=path;},mount(root,host){return mount(root,{...host,idPrefix:id},Flow);},
    guard(check){navigation.leaveGuard=check;return()=>{if(navigation.leaveGuard===check)navigation.leaveGuard=null;};},
    navigate(kind){const slug=kind==='page'?'page-editor':kind==='components'?'components':'sources';
      const target=screens.find(screen=>screen.slug===slug);if(target)navigation.open(target.id);
    },
  });
}
`);
  const native=`${base}/journey-native.ts`;
  add(native,`import type { Vault } from 'obsidian';
import { JourneyProjectStore } from ${literal(relativeImport(native,'scripts/companion/journey/project-store.ts'))};
import { journeyVaultFiles } from ${literal(relativeImport(native,'templates/companion/runtime/journey-vault.ts'))};
import type { JourneyRuntime } from './journey-workspace.ts';
export function createJourneyNative(vault:Vault,report:()=>void): JourneyRuntime {
  const store=new JourneyProjectStore(journeyVaultFiles(vault),report);
  const events=[vault.on('modify',file=>{void store.refresh(file.path);}),
    vault.on('delete',file=>{void store.refresh(file.path);}),
    vault.on('rename',(file,oldPath)=>{void store.refresh(oldPath);void store.refresh(file.path);})];
  return {store,mode:'native',path:'project.companion.json',serial:0,dispose(){for(const event of events)vault.offref(event);store.dispose();}};
}
`);
  const preview=`${base}/journey-preview.ts`;
  add(preview,`import { JourneyProjectStore } from ${literal(relativeImport(preview,'scripts/companion/journey/project-store.ts'))};
import type { JourneyRuntime } from './journey-workspace.ts';
import { seed } from '../domain/journey-seed.ts';
/** Deliberately memory-only. No native/host adapter is imported by the preview. */
export function createJourneyPreview(): JourneyRuntime {
  const files=new Map([['project.companion.json',seed]]);
  const store=new JourneyProjectStore({
    async read(path){const data=files.get(path);if(data===undefined)throw Error('PROJECT_MISSING');return data;},
    async create(path,content){if(files.has(path))return {status:'conflict'};files.set(path,content);return {status:'committed',content};},
    async replace(path,before,content){if(files.get(path)!==before)return {status:'conflict'};files.set(path,content);return {status:'committed',content};},
  });
  return {store,mode:'preview',path:'project.companion.json',serial:0,dispose(){store.dispose();files.clear();}};
}
`);
}
