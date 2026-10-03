import { copyDetailData, type DetailData } from './detail-controls.ts';
export type DetailMapping = { kind: 'none' } | { kind: 'event' } | { kind: 'value'; value: DetailData } |
  { kind: 'draft'; nodeId: string } | { kind: 'prop'; name: string } |
  { kind: 'source'; sourceId: string; operationId: string; field: string } |
  { kind: 'object'; fields: Record<string, DetailMapping> };
export interface DetailMappingContext {
  values: Readonly<Record<string, DetailData>>; props: Readonly<Record<string, unknown>>; payload: unknown;
  read(source: string, operation: string): unknown;
}
/** Reads data paths, never expressions; inherited properties and accessors are not traversed. */
export function detailValue(value: unknown, field: string): unknown {
  if (field === '') return value;
  for (const key of field.split('.')) {
    if (['constructor', 'prototype', '__proto__'].includes(key) || !value || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) return undefined;
    value = descriptor.value;
  }
  return value;
}
/** No eval, expressions, inherited properties, implicit conversions or filesystem paths. */
export function mapDetailPayload(mapping: DetailMapping, context: DetailMappingContext, depth = 0, budget = {count:0}): DetailData | undefined {
  if (depth > 6 || ++budget.count > 120) throw new Error('DETAIL_MAPPING_LIMIT');
  if (mapping.kind === 'none') return undefined;
  if (mapping.kind === 'object') return Object.fromEntries(Object.entries(mapping.fields).map(([key, child]) => {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('DETAIL_MAPPING_UNSAFE');
    const value = mapDetailPayload(child, context, depth + 1, budget); if (value === undefined) throw new Error('DETAIL_MAPPING_MISSING'); return [key, value];
  }));
  let value: unknown;
  if (mapping.kind === 'event') value = context.payload;
  else if (mapping.kind === 'value') value = mapping.value;
  else if (mapping.kind === 'draft') value = Object.hasOwn(context.values, mapping.nodeId) ? context.values[mapping.nodeId] : undefined;
  else if (mapping.kind === 'prop') value = Object.hasOwn(context.props, mapping.name) ? context.props[mapping.name] : undefined;
  else value = detailValue(context.read(mapping.sourceId, mapping.operationId), mapping.field);
  if (value === undefined) throw new Error('DETAIL_MAPPING_MISSING');
  return copyDetailData(value);
}
