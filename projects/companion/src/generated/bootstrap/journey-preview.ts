import { JourneyProjectStore } from "../../../scripts/companion/journey/project-store.ts";
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
