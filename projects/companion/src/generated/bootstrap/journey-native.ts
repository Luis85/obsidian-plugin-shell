import type { Vault } from 'obsidian';
import { JourneyProjectStore } from "../../../scripts/companion/journey/project-store.ts";
import { journeyVaultFiles } from "../../../templates/companion/runtime/journey-vault.ts";
import type { JourneyRuntime } from './journey-workspace.ts';
export function createJourneyNative(vault:Vault,report:()=>void): JourneyRuntime {
  const store=new JourneyProjectStore(journeyVaultFiles(vault),report);
  const events=[vault.on('modify',file=>{void store.refresh(file.path);}),
    vault.on('delete',file=>{void store.refresh(file.path);}),
    vault.on('rename',(file,oldPath)=>{void store.refresh(oldPath);void store.refresh(file.path);})];
  return {store,mode:'native',path:'project.companion.json',serial:0,dispose(){for(const event of events)vault.offref(event);store.dispose();}};
}
