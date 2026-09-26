import { requireValue, type Entity, type Operation } from './model.ts';
import type { Schema } from '../runtime/contract.ts';
function noteValueSchema(entity: Entity): Schema {
  return {type:'object',properties:Object.fromEntries(Object.entries(entity.schema.properties ?? {}).filter(([key]) => !['id','type'].includes(key))),required:entity.schema.required?.filter(key => !['id','type'].includes(key)) ?? [],additionalProperties:false};
}
/** Exact wire contract avoids persisting data before discovering a declared-output mismatch. */
export function noteWireSchemas(entity: Entity, operation: string): {input: Schema | null; output: Schema | null} {
  const object = (properties: Record<string, Schema>): Schema => ({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
  const snapshot = object({record:entity.schema,revision:{type:'integer'}});
  if (operation === 'list') return {input:null,output:{type:'array',items:snapshot}};
  if (operation === 'create') return {input:object({values:noteValueSchema(entity),requestId:{type:'string'}}),output:snapshot};
  if (operation === 'update') return {input:object({id:{type:'string'},revision:{type:'integer'},values:noteValueSchema(entity)}),output:snapshot};
  requireValue(operation === 'delete','Unknown native note operation.');
  return {input:object({id:{type:'string'},revision:{type:'integer'}}),output:null};
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).sort().join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>JSON.stringify(key)+':'+canonical(v)).join(',') + '}';
  return JSON.stringify(value);
}
export function validateNoteWire(entity: Entity, operation: Operation, kind: string): void {
  const expected = noteWireSchemas(entity,kind);
  requireValue(operation.direction === (kind === 'list' ? 'read' : 'write') || operation.direction === 'both','Native note operation direction mismatch.');
  requireValue(canonical(operation.input) === canonical(expected.input) && canonical(operation.output) === canonical(expected.output),'Native note operation requires its exact values/snapshot wire contract.');
}
