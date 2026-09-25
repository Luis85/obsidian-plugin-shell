import { requireValue, type Model } from './model.ts';
import { matches } from '../runtime/contract.ts';
import type { DetailMapping } from '../runtime/detail-actions.ts';
import type { DetailDocument } from '../runtime/detail-runtime.ts';
import type { ComponentMembers } from './detail-model.ts';
/** Validate references before the UI can route a request; runtime guards validate actual values. */
export function validateMappings(m: Model, doc: DetailDocument, contract: ComponentMembers): void {
  function mapping(value: DetailMapping): void {
    if (value.kind === 'draft') requireValue(doc.nodes.some(n => n.id === value.nodeId && ['input','number','checkbox','textarea','select','tabs'].includes(n.kind)), 'Missing mapped input: ' + value.nodeId);
    if (value.kind === 'prop') requireValue(doc.kind === 'component' && Object.hasOwn(contract.props, value.name), 'Missing mapped prop: ' + value.name);
    if (value.kind === 'source') {
      let schema = m.sources.find(s => s.id === value.sourceId)?.operations.find(o => o.id === value.operationId && o.direction !== 'write')?.output;
      for (const key of value.field === '' ? [] : value.field.split('.')) {
        requireValue(!['__proto__', 'prototype', 'constructor'].includes(key), 'Unsafe mapped field.');
        schema = schema?.type === 'array' && /^(0|[1-9][0-9]*)$/.test(key) ? schema.items : schema?.properties?.[key];
      }
      requireValue(schema, 'Missing mapped result field.');
    }
    if (value.kind === 'object') for (const child of Object.values(value.fields)) mapping(child);
  }
  for (const edge of doc.edges) {
    if (!edge.action) continue;
    const action = edge.action; mapping(action.kind === 'source' ? action.input : action.payload);
    if (action.kind === 'source') {
      const op = m.sources.find(s => s.id === action.sourceId)?.operations.find(o => o.id === action.operationId);
      requireValue(op, 'Missing mapped source operation: ' + edge.id);
      requireValue((op.input === null) === (action.input.kind === 'none'), 'Source payload presence mismatch.');
      if (action.input.kind === 'value') requireValue(matches(action.input.value, op.input), 'Literal payload violates operation input.');
      if (action.input.kind === 'object') {
        const fields = action.input.fields;
        requireValue(op.input?.type === 'object' && (op.input.required ?? []).every(key => Object.hasOwn(fields, key)), 'Mapped payload omits required fields.');
        requireValue(op.input.additionalProperties !== false || Object.keys(fields).every(k => Object.hasOwn(op.input!.properties ?? {}, k)), 'Mapped payload has undeclared fields.');
      }
    } else {
      requireValue(doc.kind === 'component' && Object.hasOwn(contract.events, action.event), 'Undeclared component emission.');
      if (action.payload.kind === 'value') requireValue(typeof action.payload.value === contract.events[action.event], 'Emission payload type mismatch.');
      requireValue((contract.events[action.event] === 'undefined') === (action.payload.kind === 'none'), 'Emission payload presence mismatch.');
    }
  }
}
