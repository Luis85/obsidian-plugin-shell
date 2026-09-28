import type { Artifact, SourceLocation } from '../domain/contracts.ts';
import type { Model } from '../../companion/compiler/model.ts';
import { visualDefinitions, visualPagePath, visualComponentPath } from '../../companion/compiler/visual-model.ts';

type OriginRange = {line:number;source:SourceLocation};
/** Explicit file and generated-line origins. Unmapped files stay unmapped; no guessed source spans. */
export function artifactOrigins(model:Model, artifacts:readonly Artifact[], file:string) {
  const definitions=visualDefinitions(model), mapped=new Map<string,SourceLocation>();
  definitions.pages.forEach((page,i)=>mapped.set(visualPagePath(model,page),{file,jsonPointer:`/design/visualDesigns/pages/${i}`,entityId:page.id,document:'normalized'}));
  definitions.components.forEach((component,i)=>mapped.set(visualComponentPath(model,component),{file,jsonPointer:`/design/visualDesigns/components/${i}`,entityId:component.id,document:'normalized'}));
  const nodes=new Map<string,SourceLocation[]>();
  function walk(value:unknown,pointer:string,owner:SourceLocation):void {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach((v,i)=>walk(v,`${pointer}/${i}`,owner));return; }
    const row=value as Record<string,unknown>;
    if (typeof row.id==='string') {
      const key=owner.entityId+'\0'+row.id;
      nodes.set(key,[{...owner,jsonPointer:pointer,entityId:row.id}]);
    }
    for(const [key,child] of Object.entries(row)) walk(child,pointer+'/'+key.replaceAll('~','~0').replaceAll('/','~1'),owner);
  }
  definitions.pages.forEach((page,i)=>walk(page,`/design/visualDesigns/pages/${i}`,mapped.get(visualPagePath(model,page))!));
  definitions.components.forEach(component=>{const owner=mapped.get(visualComponentPath(model,component))!;walk(component,owner.jsonPointer,owner);});
  return artifacts.filter(a=>a.ownership!=='framework').map(artifact=>{
    const origin=mapped.get(artifact.path), lines:OriginRange[]=[];
    if(origin) artifact.content.split('\n').forEach((line,i)=>{
      const id=/data-design-node="([^"]+)"/.exec(line)?.[1];
      const source=id && nodes.get(origin.entityId+'\0'+id)?.[0];
      if(source) lines.push({line:i+1,source});
    });
    return {path:artifact.path,producer:artifact.producer ?? 'legacy',origins:origin?[origin]:(artifact.origins ?? []).map(origin=>({...origin,file})),lines};
  });
}
