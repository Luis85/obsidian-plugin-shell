import type { App } from 'vue';
import type { Pinia } from 'pinia';
import type { JourneyProjectStore } from "../../../scripts/companion/journey/project-store.ts";
import { workspaceKey } from '../presentation/journey/workspace/contracts.ts';
import { mount } from './journey-mount.ts';
import Flow from 'virtual:journey-flow';
import 'virtual:journey-flow.css';
import { useNavigation } from '../presentation/stores/navigation.ts';
import { screens } from '../domain/screens.ts';
import { seed } from '../domain/journey-seed.ts';
export interface JourneyRuntime { store: JourneyProjectStore; mode: 'native'|'preview'; path: string; serial: number; dispose(): void }
export function provideJourney(app:App,pinia:Pinia,runtime:JourneyRuntime): void {
  const navigation=useNavigation(pinia),id="workbench-companion"+'-journey-'+(++runtime.serial);
  app.provide(workspaceKey,{
    store:runtime.store,seed,mode:runtime.mode,ownerId:"workbench-companion",initialPath:runtime.path,
    rememberPath(path){runtime.path=path;},mount(root,host){return mount(root,{...host,idPrefix:id},Flow);},
    guard(check){navigation.leaveGuard=check;return()=>{if(navigation.leaveGuard===check)navigation.leaveGuard=null;};},
    navigate(kind){const slug=kind==='page'?'page-editor':kind==='components'?'components':'sources';
      const target=screens.find(screen=>screen.slug===slug);if(target)navigation.open(target.id);
    },
  });
}
