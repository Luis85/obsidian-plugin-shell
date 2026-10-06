import { row, rows, text, requireValue, type Model, type Operation, type Source } from './model.ts';
import type { RelationshipRule } from '../../../templates/companion/runtime/relationships.ts';
import { RELATIONSHIP_CARDINALITIES } from '../../../scripts/companion/authoring-contract.ts';
export function relationshipDefinitions(m:Model):RelationshipRule[]{
  const rules=rows(row(row(m.document.design).semantic ?? {}).relationships ?? [],120).map(value=>{
    const source=m.entities.find(e=>e.id===value.source),target=m.entities.find(e=>e.id===value.target);
    requireValue(source&&target,'Dangling relationship entity.');
    return {id:text(value.id),source:source.slug,target:target.slug,key:text(value.key),sourceCard:text(value.sourceCard),targetCard:text(value.targetCard),onDelete:text(value.onDelete)};
  });
  requireValue(new Set(rules.map(r=>r.id)).size===rules.length,'Duplicate relationship id.');
  return rules;
}
/** Implicit read-only vault lists of an entity whose folder is the operation resource. */
function listedEntities(m:Model, s:Source, op:Operation):string[]{
  const output=op.contract.output as {mode?:string;entity?:string;many?:boolean};
  return s.kind==='vault' && op.direction==='read' && op.input===null && output.mode==='entity' && output.many
    ? m.entities.filter(e=>e.id===output.entity && e.folder!=='' && e.folder===op.contract.resource).map(e=>e.slug):[];
}
/** Entities an operation touches: declared note mappings (lists only when reads count) and, for reads, implicit lists. */
function operationEntities(m:Model, s:Source, op:Operation, includeRead:boolean):string[]{
  const implementation=op.contract.implementation;
  if(!implementation) return includeRead ? listedEntities(m,s,op) : [];
  const spec=row(implementation);
  return spec.kind==='note' && (includeRead || spec.operation!=='list') ? m.entities.filter(e=>e.id===spec.entity).map(e=>e.slug):[];
}
/** Adds both ends of a rule that touches the selection; reports whether anything was added. */
function connectRule(selected:Set<string>, rule:RelationshipRule):boolean{
  if(!selected.has(rule.source)&&!selected.has(rule.target))return false;
  let changed=false;
  for(const key of [rule.source,rule.target])if(!selected.has(key)){selected.add(key);changed=true;}
  return changed;
}
/** Writable connected components need all related repositories, including read-only targets. */
export function relationshipScope(m:Model, includeRead = false){
  const definitions=relationshipDefinitions(m);
  const selected=new Set(m.sources.flatMap(s=>s.operations.flatMap(op=>operationEntities(m,s,op,includeRead))));
  for(let changed=true;changed;){changed=false;for(const rule of definitions)if(connectRule(selected,rule))changed=true;}
  const rules=definitions.filter(r=>selected.has(r.source)||selected.has(r.target));
  for(const rule of rules)requireValue(rule.onDelete==='restrict'&&[rule.sourceCard,rule.targetCard].every(c=>RELATIONSHIP_CARDINALITIES.includes(c)), 'Native relationship writes require supported cardinalities and restrict deletion. Cascade/unlink require a separately implemented transaction.');
  return {rules,entities:rules.length?m.entities.filter(e=>selected.has(e.slug)):[]};
}
