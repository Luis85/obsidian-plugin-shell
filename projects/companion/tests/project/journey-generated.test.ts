import { it, expect } from 'vitest';
import { JourneyProjectStore } from "../../scripts/companion/journey/project-store.ts";
import { SitemapSession } from "../../scripts/companion/sitemap/session.ts";
import { seed } from "../../src/generated/domain/journey-seed.ts";
it('saves the complete generated project and reopens an independent editor session',async()=>{
  let bytes=seed;
  const store=new JourneyProjectStore({read:async()=>bytes,create:async()=>({status:'conflict'}),replace:async(_path,before,next)=>{
    if(bytes!==before)return {status:'conflict'};bytes=next;return {status:'committed',content:bytes};
  }});
  const first=store.connect('project.companion.json'),session=new SitemapSession(first);
  await session.load();const snapshot=session.snapshot()!,node=snapshot.design.nodes.find(n=>n.kind!=='group')!;
  const plan=session.plan({type:'rename',surface:node.id,label:'Native journey test'});const outcome=await session.apply(plan);
  expect(outcome.status).toBe('committed');const second=store.connect('project.companion.json');await second.read();
  expect(JSON.parse(second.export()).design.nodes.find((n:{id:string})=>n.id===node.id).label).toBe('Native journey test');
  const original=JSON.parse(seed),saved=JSON.parse(bytes);expect(saved.project).toEqual(original.project);
  expect(saved.design.visualDesigns).toEqual(original.design.visualDesigns);expect(JSON.parse(second.export())).toEqual(saved);
  session.dispose();first.dispose();second.dispose();store.dispose();
});
