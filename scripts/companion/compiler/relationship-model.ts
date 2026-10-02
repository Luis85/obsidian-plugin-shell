import { row, rows, text, requireValue, type Model } from './model.ts';
import type { RelationshipRule } from '../runtime/relationships.ts';
export function relationshipDefinitions(m:Model):RelationshipRule[]{
  const rules=rows(row(row(m.document.design).semantic ?? {}).relationships ?? [],120).map(value=>{
    const source=m.entities.find(e=>e.id===value.source),target=m.entities.find(e=>e.id===value.target);
    requireValue(source&&target,'Dangling relationship entity.');
    return {id:text(value.id),source:source.slug,target:target.slug,key:text(value.key),sourceCard:text(value.sourceCard),targetCard:text(value.targetCard),onDelete:text(value.onDelete)};
  });
  requireValue(new Set(rules.map(r=>r.id)).size===rules.length,'Duplicate relationship id.');
  return rules;
}
/** Writable connected components need all related repositories, including read-only targets. */
export function relationshipScope(m:Model, includeRead = false){
  const definitions=relationshipDefinitions(m);
  const selected=new Set(m.sources.flatMap(s=>s.operations.flatMap(op=>{
    const implementation=op.contract.implementation;
    if(!implementation){
      const output=op.contract.output as {mode?:string;entity?:string;many?:boolean};
      return includeRead && s.kind==='vault' && op.direction==='read' && op.input===null && output.mode==='entity' && output.many
        ? m.entities.filter(e=>e.id===output.entity && e.folder!=='' && e.folder===op.contract.resource).map(e=>e.slug):[];
    }
    const spec=row(implementation);
    return spec.kind==='note' && (includeRead || spec.operation!=='list') ? m.entities.filter(e=>e.id===spec.entity).map(e=>e.slug):[];
  })));
  for(let changed=true;changed;){changed=false;for(const rule of definitions)if(selected.has(rule.source)||selected.has(rule.target))for(const key of [rule.source,rule.target])if(!selected.has(key)){selected.add(key);changed=true;}}
  const rules=definitions.filter(r=>selected.has(r.source)||selected.has(r.target));
  for(const rule of rules)requireValue(rule.onDelete==='restrict'&&[rule.sourceCard,rule.targetCard].every(c=>['0..1','1','1..1','0..*','1..*'].includes(c)), 'Native relationship writes require supported cardinalities and restrict deletion. Cascade/unlink require a separately implemented transaction.');
  return {rules,entities:rules.length?m.entities.filter(e=>selected.has(e.slug)):[]};
}
