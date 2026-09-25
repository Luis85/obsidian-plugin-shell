import { matches } from '../runtime/contract.ts';
import { validateCompositionDesignSystem } from '../composition-contract.mjs';
import { visibleDetails, type DetailDocument, type DetailElement, type DetailLiteral } from '../runtime/detail-runtime.ts';
import type { Schema } from '../runtime/contract.ts';
import { row, rows, text, requireValue, type Model, type Row } from './model.ts';
export interface ComponentMembers { props: Record<string, string>; events: Record<string, string>; slots: string[] }
const forbidden = new Set(['__proto__', 'prototype', 'constructor', 'designState', 'designScenario', 'designVariant', 'interaction', 'ref', 'key', 'is', 'class', 'style']);
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
  const revisions = rows(row(store).revisions ?? [], 200);
  const definitions = detailDefinitions(m);
  const makeDocument = (value: Row, revision?: Row): DetailDocument => {
    const doc = structuredClone(value) as unknown as DetailDocument;
    doc.designSystem = revision?.designSystem ?? row(m.document.design).designSystem;
    validateCompositionDesignSystem(doc.designSystem);
    if (revision) {
      const prefix = String(revision.id) + '-'; const ids = new Map(doc.nodes.map(n => [n.id, prefix + n.id]));
      doc.id = String(revision.id); doc.ownerId = String(revision.id);
      for (const n of doc.nodes) { n.id = ids.get(n.id)!; if (n.parentId) n.parentId = ids.get(n.parentId)!; }
      for (const e of doc.edges) { e.id = prefix + e.id; e.source = ids.get(e.source)!; e.target = ids.get(e.target)!; }
      for (const scenario of doc.scenarios || []) scenario.values = Object.fromEntries(Object.entries(scenario.values).map(([id, v]) => [ids.get(id)!, v]));
    }
    for (const n of doc.nodes) if (n.component) { const ref = n.component as unknown as Row; if (ref.revisionId) n.component.id = String(ref.revisionId); }
    return doc;
  };
  const documents = [...rows(row(store).documents, 200).map(doc => makeDocument(doc)), ...revisions.map(r => makeDocument(row(r.document), r))];
  for (const doc of documents) {
    const owner = doc.kind === 'page' ? m.screens.find(s => s.id === doc.ownerId) : definitions.find(c => c.id === doc.ownerId);
    requireValue(owner && (doc.kind !== 'page' || !['group', 'action'].includes(String(owner.kind))), 'Missing detail owner: ' + doc.ownerId);
    for(const scenario of doc.scenarios||[])for(const fixture of scenario.bindings){const op=m.sources.find(s=>s.id===fixture.sourceId)?.operations.find(o=>o.id===fixture.operationId);requireValue(op && matches(fixture.value,op.output),'Scenario fixture does not match a known output: '+scenario.id);}
    const keys = new Set<string>();
    for (const edge of doc.edges) {
      const key = edge.source + ':' + edge.event;
      requireValue(!keys.has(key), 'Ambiguous detail event; explicit branching is not declared: ' + edge.id); keys.add(key);
      const source = doc.nodes.find(n => n.id === edge.source)!;
      const allowed = source.component ? Object.keys(componentMembers(definitions.find(c => c.id === source.component!.id) ?? {}).events) :
        ['click', 'dblclick', 'focus', 'blur', 'keydown', 'keyup', ...(['input','textarea','number','checkbox','select'].includes(source.kind) ? ['input', 'change'] : source.kind === 'tabs' ? ['change'] : [])];
      requireValue(!forbidden.has(edge.event) && allowed.includes(edge.event), 'Unsupported detail event: ' + edge.id);
      requireValue(['default', 'empty', 'error'].some(state => visibleDetails(doc, state as 'default' | 'empty' | 'error').some(n => n.id === edge.source)), 'Interaction source has no enabled visible state: ' + edge.id);
      if (edge.effect?.type==='emit') { const declared=doc.kind==='component' && componentMembers(row(owner)).events[String(edge.effect.value)]; requireValue(declared && typeof edge.effect.payload===declared, 'Undeclared event or incompatible emitted payload: '+edge.id); }
      if (edge.targetSurfaceId) requireValue(m.screens.some(s => s.id === edge.targetSurfaceId && !['group', 'action'].includes(s.kind)), 'Missing detail navigation target: ' + edge.id);
    }
    for (const node of doc.nodes) {
      if (node.component) node.props = instanceProps(node, definitions);
      if (node.kind === 'slot' && doc.kind === 'component') requireValue(componentMembers(row(owner)).slots.includes(node.label), 'Undeclared component slot: ' + node.id);
      if (node.contentProp) requireValue(doc.kind==='component' && Object.hasOwn(componentMembers(row(owner)).props,node.contentProp), 'Undeclared content property: '+node.id);
      const parent = doc.nodes.find(n=>n.id===node.parentId);
      if (parent?.component) requireValue(componentMembers(definitions.find(c=>c.id===parent.component!.id)!).slots.includes(node.slotName || ''), 'Unmapped instance slot: '+node.id);
      if (!node.binding) continue;
      requireValue(['text','heading','input','textarea','number','checkbox','select','table','list','alert'].includes(node.kind), 'Binding requires a readable value element: ' + node.id);
      const op = m.sources.find(s => s.id === node.binding!.sourceId)?.operations.find(o => o.id === node.binding!.operationId);
      requireValue(op && ['read', 'both'].includes(op.direction), 'Missing readable detail binding: ' + node.id);
      requireValue(bindingPath(op.output, node.binding.field), 'Unresolved binding field: ' + node.id + '/' + node.binding.field);
    }
  }
  for (const doc of documents) for (const node of doc.nodes.filter(n=>n.component)) {
    const internal=documents.find(d=>d.kind==='component' && d.ownerId===node.component!.id);
    const children=doc.nodes.filter(n=>n.parentId===node.id);
    for(const declaration of internal?.nodes.filter(n=>n.kind==='slot')||[]) {
      const contents=children.filter(n=>n.slotName===declaration.label);
      requireValue(declaration.slotCapacity!=='one'||contents.length<=1,'Slot cardinality exceeded: '+node.id+'/'+declaration.label);
      requireValue(!declaration.slotKinds?.length || contents.every(n=>declaration.slotKinds!.includes(n.kind)),'Unsupported slot content kind: '+node.id);
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
  // Keep editor geometry in design/project.json, not the executable runtime IR.
  return documents.map(doc => ({ ...doc, nodes: doc.nodes.map(node => ({
    id: node.id, kind: node.kind, label: node.label, text: node.text, parentId: node.parentId, layout: node.layout,
    component: node.component ? { id: node.component.id, version: node.component.version, variantId: node.component.variantId } : null,
    ...(node.ui ? {ui:node.ui} : {}), ...(node.slotName ? {slotName:node.slotName} : {}), ...(node.contentProp ? {contentProp:node.contentProp} : {}), ...(node.options ? {options:node.options} : {}),
    props: node.props, binding: node.binding, a11y: node.a11y, visibleIn: node.visibleIn,
  })) }));
}

/** Revision identities get their own immutable generated contract and component. */
export function detailDefinitions(m: Model): Row[] {
  const store = row(m.document.design).detailDesigns;
  return [...m.components, ...rows(store ? row(store).revisions ?? [] : [], 200).map(r => ({ ...row(r.library), id:r.id }))];
}
