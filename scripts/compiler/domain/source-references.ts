import type { CompilerDiagnostic } from './contracts.ts';
import { diagnostic } from './diagnostics.ts';

type Row = Record<string, unknown>;
function row(value: unknown): Row { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}; }
function rows(value: unknown): Row[] { return Array.isArray(value) && value.length <= 200 ? value.map(row) : []; }
/** Independently actionable source/entity references. Invalid shapes stay with the authoritative schema validator. */
export function sourceReferenceDiagnostics(document: unknown, file: string): CompilerDiagnostic[] {
  const design = row(row(document).design), data = row(design.dataSources), semantic = row(design.semantic);
  const sources = rows(data.sources), entities = rows(semantic.entities), nodes = rows(design.nodes);
  const entityIds = new Set(entities.map(entity => entity.id)), surfaceIds = new Set(nodes.map(node => node.id));
  const result: CompilerDiagnostic[] = [];
  const missing = (pointer: string, message: string, id: unknown) => result.push(diagnostic('COMPILER_REFERENCE_MISSING','resolve',message,
    {file,jsonPointer:pointer,...(typeof id === 'string' ? {entityId:id} : {})}));
  for (const [index, source] of sources.entries()) {
    for (const [operationIndex, operation] of rows(source.operations).entries()) {
      for (const direction of ['input','output']) {
        const shape = row(operation[direction]);
        if (shape.mode === 'entity' && typeof shape.entity === 'string' && !entityIds.has(shape.entity)) {
          missing(`/design/dataSources/sources/${index}/operations/${operationIndex}/${direction}/entity`, `Operation ${String(operation.id)} references missing entity ${shape.entity}.`, operation.id);
        }
      }
    }
  }
  for (const [index, flow] of rows(data.flows).entries()) {
    const source = sources.find(candidate => candidate.id === flow.source);
    if (typeof flow.source === 'string' && !source) missing(`/design/dataSources/flows/${index}/source`, `Flow ${String(flow.id)} references missing source ${flow.source}.`,flow.id);
    else if (source && typeof flow.operation === 'string' && !rows(source.operations).some(operation=>operation.id===flow.operation)) {
      missing(`/design/dataSources/flows/${index}/operation`, `Flow ${String(flow.id)} references missing operation ${flow.operation}.`,flow.id);
    }
    if (typeof flow.card === 'string' && !surfaceIds.has(flow.card)) missing(`/design/dataSources/flows/${index}/card`, `Flow ${String(flow.id)} references missing surface ${flow.card}.`,flow.id);
  }
  for (const [index, relationship] of rows(semantic.relationships).entries()) {
    for (const endpoint of ['source','target']) if (typeof relationship[endpoint] === 'string' && !entityIds.has(relationship[endpoint])) {
      missing(`/design/semantic/relationships/${index}/${endpoint}`, `Relationship ${String(relationship.id)} references missing entity ${String(relationship[endpoint])}.`,relationship.id);
    }
  }
  return result;
}
