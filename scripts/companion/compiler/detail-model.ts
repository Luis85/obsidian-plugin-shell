import type { DetailDocument, DetailElement, DetailLiteral } from '../runtime/detail-runtime.ts';
import type { Schema } from '../runtime/contract.ts';
import { row, rows, text, requireValue, type Model, type Row } from './model.ts';
export interface ComponentMembers { props: Record<string, string>; events: Record<string, string>; slots: string[] }
const forbidden = new Set(['__proto__', 'prototype', 'constructor', 'designState', 'designVariant', 'interaction', 'ref', 'key', 'is', 'class', 'style']);
function members(value: unknown, events = false): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const line of text(value ?? '', 10000).split(/\r?\n/).map(s => s.trim()).filter(Boolean)) {
    const match = /^([a-z][A-Za-z0-9]*):(string|number|boolean|void)$/.exec(line);
    requireValue(match && !forbidden.has(match[1]!) && (events || match[2] !== 'void'), 'Unsupported component member: ' + line);
    requireValue(!Object.hasOwn(parsed, match[1]!), 'Duplicate component member: ' + match[1]);
    parsed[match[1]!] = match[2] === 'void' ? 'undefined' : match[2]!;
  }
  return parsed;
}
export function componentMembers(component: Row): ComponentMembers {
  const slots = text(component.slots ?? '', 1000).split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  requireValue(slots.every(s => /^[a-z][A-Za-z0-9-]*$/.test(s) && !forbidden.has(s)) && new Set(slots).size === slots.length, 'Unsupported component slots: ' + component.id);
  return { props: members(component.props), events: members(component.events, true), slots };
}
function instanceProps(node: DetailElement, library: Row[]): Record<string, DetailLiteral> {
  const reference = node.component!; const definition = library.find(c => c.id === reference.id);
  requireValue(definition, 'Missing detail component: ' + reference.id);
  requireValue(definition.version === reference.version, 'Review stale component version: ' + node.id);
  const contract = componentMembers(definition); let defaults: Row = {};
  if (definition.variantSpecs !== undefined) {
    const variant = rows(definition.variantSpecs, 12).find(v => v.id === reference.variantId);
    requireValue(variant, 'Missing detail variant: ' + node.id); defaults = row(variant.props);
  } else {
    const variants = ['default', ...text(definition.variants ?? '').split(',').map(s => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'))];
    requireValue(variants.includes(reference.variantId), 'Missing detail variant: ' + node.id);
  }
  for (const values of [defaults, node.props]) for (const [key, value] of Object.entries(values)) {
    requireValue(Object.hasOwn(contract.props, key) && contract.props[key] === typeof value && (typeof value !== 'number' || Number.isFinite(value)), 'Invalid detail prop: ' + node.id + '/' + key);
  }
  return { ...defaults, ...node.props } as Record<string, DetailLiteral>;
}
function bindingPath(schema: Schema | null, field: string): boolean {
  if (field === '') return schema !== null;
  for (const key of field.split('.')) {
    if (!/^(?:[A-Za-z][A-Za-z0-9_-]*|0|[1-9][0-9]*)$/.test(key) || forbidden.has(key) || !schema) return false;
    schema = schema.type === 'array' && /^\d+$/.test(key) ? schema.items ?? null : schema.type === 'object' ? schema.properties?.[key] ?? null : null;
  }
  return schema !== null;
}
/** Structural validation is performed by the shared export contract; generation
 * additionally refuses unresolved external references instead of dropping intent. */
export function detailDocuments(m: Model): DetailDocument[] {
  const store = row(m.document.design).detailDesigns;
  if (!store) return [];
  const documents = structuredClone(rows(row(store).documents, 200)) as unknown as DetailDocument[];
  for (const doc of documents) {
    const owner = doc.kind === 'page' ? m.screens.find(s => s.id === doc.ownerId) : m.components.find(c => c.id === doc.ownerId);
    requireValue(owner && (doc.kind !== 'page' || !['group', 'action'].includes(String(owner.kind))), 'Missing detail owner: ' + doc.ownerId);
    const keys = new Set<string>();
    for (const edge of doc.edges) {
      const key = edge.source + ':' + edge.event;
      requireValue(!keys.has(key), 'Ambiguous detail event; explicit branching is not declared: ' + edge.id); keys.add(key);
      requireValue(!forbidden.has(edge.event), 'Unsafe detail event: ' + edge.id);
      if (edge.targetSurfaceId) requireValue(m.screens.some(s => s.id === edge.targetSurfaceId && !['group', 'action'].includes(s.kind)), 'Missing detail navigation target: ' + edge.id);
    }
    for (const node of doc.nodes) {
      if (node.component) node.props = instanceProps(node, m.components);
      if (node.kind === 'slot' && doc.kind === 'component') requireValue(componentMembers(row(owner)).slots.includes(node.label), 'Undeclared component slot: ' + node.id);
      if (!node.binding) continue;
      const op = m.sources.find(s => s.id === node.binding!.sourceId)?.operations.find(o => o.id === node.binding!.operationId);
      requireValue(op && ['read', 'both'].includes(op.direction), 'Missing readable detail binding: ' + node.id);
      requireValue(bindingPath(op.output, node.binding.field), 'Unresolved binding field: ' + node.id + '/' + node.binding.field);
    }
  }
  // Bound expansion independently of the number of authored definitions.
  const componentDocs = new Map(documents.filter(d => d.kind === 'component').map(d => [d.ownerId, d]));
  function count(doc: DetailDocument, depth: number): number {
    requireValue(depth <= 12, 'Detail composition exceeds twelve levels.'); let total = doc.nodes.length;
    for (const node of doc.nodes) if (node.component) {
      const child = componentDocs.get(node.component.id); if (child) total += count(child, depth + 1);
      requireValue(total <= 4000, 'Expanded detail composition exceeds 4000 elements.');
    }
    return total;
  }
  for (const doc of documents) count(doc, 0);
  return documents;
}
