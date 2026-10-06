// Payload mappings and typed control semantics for visual designs. Data only.
import { visualAssert, visualIsRef, visualIsText, visualIsKey, visualIsPlain } from './visual-ir.mjs';
export const VISUAL_CONTROL_KINDS = Object.freeze(['text', 'textarea', 'number', 'checkbox', 'date', 'datetime-local', 'select', 'json-file', 'json-editor', 'markdown-editor']);
const vmpReserved = ['constructor', 'prototype', '__proto__'];
function vmpObject(value, keys, optional = []) { return visualIsPlain(value) && Object.keys(value).every(k => keys.includes(k) || optional.includes(k)) && keys.every(k => Object.hasOwn(value, k)); }
function vmpJson(value, depth = 0) {
  if (depth > 12) return false;
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  return !!value && typeof value === 'object' && Object.entries(value).every(([key, item]) => !vmpReserved.includes(key) && vmpJson(item, depth + 1));
}
export function validateVisualMapping(mapping, depth = 0, budget = { count: 0 }) {
  visualAssert(depth <= 6 && ++budget.count <= 120, 'Payload mapping is too large.');
  visualAssert(mapping && typeof mapping === 'object', 'Missing payload mapping.');
  if (mapping.kind === 'none' || mapping.kind === 'event') visualAssert(vmpObject(mapping, ['kind']), 'Invalid simple mapping.');
  else if (mapping.kind === 'value') visualAssert(vmpObject(mapping, ['kind', 'value']) && vmpJson(mapping.value) && JSON.stringify(mapping.value).length <= 12000, 'Invalid literal payload.');
  else if (mapping.kind === 'draft') visualAssert(vmpObject(mapping, ['kind', 'nodeId']) && visualIsRef(mapping.nodeId), 'Invalid draft mapping.');
  else if (mapping.kind === 'prop') visualAssert(vmpObject(mapping, ['kind', 'name']) && visualIsKey(mapping.name), 'Invalid prop mapping.');
  else if (mapping.kind === 'source') visualAssert(vmpObject(mapping, ['kind', 'sourceId', 'operationId', 'field']) && visualIsRef(mapping.sourceId) && visualIsRef(mapping.operationId) && visualIsText(mapping.field, 120), 'Invalid source mapping.');
  else if (mapping.kind === 'object') {
    visualAssert(vmpObject(mapping, ['kind', 'fields']) && visualIsPlain(mapping.fields) && Object.keys(mapping.fields).length <= 40, 'Invalid object mapping.');
    for (const [key, value] of Object.entries(mapping.fields)) { visualAssert(/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) && !vmpReserved.includes(key), 'Unsafe payload property.'); validateVisualMapping(value, depth + 1, budget); }
  } else visualAssert(false, 'Unsupported payload mapping.');
  return mapping;
}
export function visualMappingRefs(mapping, out = { drafts: [], props: [] }) {
  if (mapping?.kind === 'draft') out.drafts.push(mapping.nodeId);
  else if (mapping?.kind === 'prop') out.props.push(mapping.name);
  else if (mapping?.kind === 'object') for (const value of Object.values(mapping.fields)) visualMappingRefs(value, out);
  return out;
}
export function validateVisualControl(control) {
  visualAssert(vmpObject(control, ['kind'], ['required', 'options', 'maxBytes']) && VISUAL_CONTROL_KINDS.includes(control.kind), 'Unsupported control type.');
  if (control.required !== undefined) visualAssert(typeof control.required === 'boolean', 'Invalid required control.');
  if (control.options !== undefined) visualAssert(control.kind === 'select' && Array.isArray(control.options) && control.options.length > 0 && control.options.length <= 60 && control.options.every(o => vmpObject(o, ['label', 'value']) && visualIsText(o.label, 120, true) && visualIsText(o.value, 120)) && new Set(control.options.map(o => o.value)).size === control.options.length, 'Invalid select options.');
  visualAssert(control.kind !== 'select' || control.options !== undefined, 'Select options are required.');
  if (control.maxBytes !== undefined) visualAssert(['json-file', 'json-editor', 'markdown-editor', 'textarea', 'text'].includes(control.kind) && Number.isSafeInteger(control.maxBytes) && control.maxBytes > 0 && control.maxBytes <= 4_000_000, 'Invalid control byte limit.');
  return control;
}
