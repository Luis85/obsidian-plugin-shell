// One-way migration of detail designs (schema 1/2) to visual designs (schema 3). Only geometry is dropped, and it is counted.
import { emptyVisualDesigns, visualAllocate, visualElement, visualText, visualSlot, visualNuxt, visualProject, visualLiteral, visualLayoutRules } from './visual-ir.mjs';
import { compositionDefaultUI } from '../composition-contract.mjs';
const vmigAll = ['default', 'loading', 'empty', 'error', 'disabled'];
const vmigForbidden = ['designState', 'designScenario', 'interaction', 'ref', 'key', 'is', 'class', 'style'];
function vmigPascal(name, used) { let base = String(name).replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).map(w => w[0].toUpperCase() + w.slice(1)).join('') || 'Component'; if (!/^[A-Z]/.test(base)) base = 'C' + base; base = base.slice(0, 56); let out = base, i = 2; while (used.has(out)) out = base + i++; used.add(out); return out; }
function vmigContract(lib, report) {
  const props = [], emits = [];
  for (const [text, events] of [[lib.props, false], [lib.events, true]]) for (const line of String(text ?? '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)) {
    const m = /^([a-z][A-Za-z0-9]*):(.+)$/.exec(line);
    if (!m || vmigForbidden.includes(m[1])) { report.unparsedMembers.push({ owner: lib.id, text: line }); continue; }
    const type = m[2].trim();
    if (events) emits.push({ name: m[1], payloadType: ['void', 'string', 'number', 'boolean'].includes(type) ? type : 'unknown', ...(['void', 'string', 'number', 'boolean'].includes(type) ? {} : { description: 'Migrated from: ' + line }) });
    else if (['string', 'number', 'boolean'].includes(type)) props.push({ name: m[1], type, required: false });
    else { props.push({ name: m[1], type: 'string', required: false, description: 'Migrated from: ' + line }); report.unparsedMembers.push({ owner: lib.id, text: line }); }
  }
  const slots = String(lib.slots ?? '').split(/[\n,]/).map(s => s.trim()).filter(Boolean).filter(s => /^[a-z][A-Za-z0-9-]*$/.test(s) || (report.unparsedMembers.push({ owner: lib.id, text: s }), false)).map(name => ({ name, required: false }));
  const variants = Array.isArray(lib.variantSpecs) ? lib.variantSpecs.map(v => ({ id: v.id, name: v.name || v.id, values: Object.fromEntries(Object.entries(v.props ?? {}).filter(([k, val]) => props.some(p => p.name === k && typeof val === p.type))) })) : String(lib.variants ?? '').split(',').map(s => s.trim()).filter(Boolean).map(name => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, values: {} }));
  return { props: vmigUnique(props), slots: vmigUnique(slots), emits: vmigUnique(emits), variants: vmigUnique(variants, 'id') };
}
function vmigUnique(list, key = 'name') { const seen = new Set(); return list.filter(x => !seen.has(x[key]) && seen.add(x[key])); }
function vmigCanon(value) { return value !== null && typeof value === 'object' ? '{' + Object.keys(value).sort().map(k => k + ':' + vmigCanon(value[k])).join(',') + '}' : JSON.stringify(value); }
function vmigMapping(mapping, map) {
  if (mapping?.kind === 'draft') return { kind: 'draft', nodeId: map.get(mapping.nodeId) ?? mapping.nodeId };
  if (mapping?.kind === 'object') return { kind: 'object', fields: Object.fromEntries(Object.entries(mapping.fields).map(([k, v]) => [k, vmigMapping(v, map)])) };
  return structuredClone(mapping);
}
function vmigActions(edge, map) {
  const at = id => map.get(id) ?? id, e = edge.effect, a = edge.action;
  if (edge.targetSurfaceId) return [{ kind: 'navigate', surfaceId: edge.targetSurfaceId }];
  if (e?.type === 'state') return [{ kind: 'set-state', state: e.value }];
  if (e?.type === 'toggle') return [{ kind: 'toggle', nodeId: at(edge.target) }];
  if (e?.type === 'value') return [{ kind: 'set-value', nodeId: at(edge.target), value: e.value }];
  if (e?.type === 'focus') return [{ kind: 'focus', nodeId: at(edge.target) }];
  if (e?.type === 'emit') return [{ kind: 'emit', event: e.value, payload: e.payload !== undefined ? { kind: 'value', value: e.payload } : { kind: 'none' } }];
  if (a?.kind === 'source') return [{ kind: 'source', sourceId: a.sourceId, operationId: a.operationId, input: vmigMapping(a.input, map) }];
  if (a?.kind === 'emit') return [{ kind: 'emit', event: a.event, payload: vmigMapping(a.payload, map) }];
  return [];
}
// The value a legacy element displays: component prop (contentProp) before data binding before authored text.
// Authored text was the fallback for an unset contentProp, so it becomes that prop's default.
function vmigShown(n, ctx, fallback) {
  const prop = n.contentProp ? ctx.contract?.props.find(p => p.name === n.contentProp) : undefined;
  if (prop) {
    if (n.text && prop.default === undefined && prop.type === 'string') prop.default = n.text; else if (n.text && prop.default !== n.text) ctx.report.droppedTexts++;
    return { kind: 'prop', name: n.contentProp };
  }
  if (n.contentProp) ctx.report.droppedProps.push({ owner: ctx.owner, prop: n.contentProp });
  if (n.binding) return { kind: 'source', sourceId: n.binding.sourceId, operationId: n.binding.operationId, field: n.binding.field };
  return fallback === undefined ? undefined : visualLiteral(fallback);
}
function vmigLose(ctx, text) { if (text) ctx.report.droppedTexts++; }
function vmigLiterals(values) { return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined).map(([k, v]) => [k, v?.kind ? v : visualLiteral(v)])); }
function vmigControl(n, ctx, extra) {
  const kind = n.kind === 'input' ? n.control?.kind : n.kind, model = vmigShown(n, ctx), placeholder = n.text || undefined;
  if (['textarea', 'json-file', 'json-editor', 'markdown-editor'].includes(kind)) return visualNuxt(ctx.id, 'u-textarea', vmigLiterals({ modelValue: model, placeholder }), extra);
  if (kind === 'checkbox') { vmigLose(ctx, n.text); return visualNuxt(ctx.id, 'u-checkbox', vmigLiterals({ modelValue: model, label: n.label }), extra); }
  if (kind === 'select') return visualNuxt(ctx.id, 'u-select', vmigLiterals({ modelValue: model, items: n.options ?? n.control?.options?.map(o => o.label) ?? [], placeholder }), extra);
  return visualNuxt(ctx.id, 'u-input', vmigLiterals({ modelValue: model, type: ['text', 'date', 'datetime-local', 'number'].includes(kind) ? kind : undefined, placeholder }), extra);
}
function vmigInstance(n, ctx, extra) {
  const ref = n.component, contract = ctx.contracts.get(ref.revisionId ? 'rev:' + ref.revisionId : ref.id), props = {}, slots = {};
  for (const [key, value] of Object.entries(n.props)) if (contract.props.some(p => p.name === key && p.type === typeof value)) props[key] = visualLiteral(value); else ctx.report.droppedProps.push({ owner: ctx.owner, prop: key });
  for (const [name, ids] of Object.entries(n.slots ?? {})) slots[name] = ids.map(id => vmigNode(ctx.byId.get(id), ctx));
  for (const child of ctx.kids.get(n.id) ?? []) (slots[child.slotName] ??= []).push(vmigNode(child, ctx));
  const variant = ref.variantId !== 'default' && contract.variants.some(v => v.id === ref.variantId);
  if (ref.variantId !== 'default' && !variant) ctx.report.droppedProps.push({ owner: ctx.owner, prop: 'variantId' });
  const node = visualProject(ctx.id, ctx.componentFor(ref.id), { ...extra, props, slots, ...(variant ? { variantId: ref.variantId } : {}) });
  if (ref.revisionId) node.ref.revisionId = ctx.revision(ref.revisionId);
  return node;
}
function vmigTextNode(n, ctx, role, common) {
  if (n.ui && vmigCanon(n.ui) !== vmigCanon(compositionDefaultUI())) ctx.report.droppedTextStyles++;
  return { ...visualText(ctx.id, '', role, common), value: vmigShown(n, ctx, n.text || n.label) };
}
function vmigList(n, ctx, extra) {
  const bound = vmigShown(n, ctx), item = value => visualElement(visualAllocate(ctx.store, 'vn'), 'li', { children: [{ ...visualText(visualAllocate(ctx.store, 'vn'), '', 'span'), value }] });
  if (bound) { ctx.report.listBindings++; vmigLose(ctx, n.text); return visualElement(ctx.id, 'ul', { ...extra, children: [item(bound)] }); }
  if (n.options?.length) vmigLose(ctx, n.text);
  return visualElement(ctx.id, 'ul', { ...extra, children: (n.options?.length ? n.options : [n.text || n.label]).map(o => item(visualLiteral(o))) });
}
function vmigNode(n, parent) {
  const ctx = { ...parent, id: parent.map.get(n.id) }, { report } = ctx;
  report.droppedPositions++; report.droppedSizes++; if (n.sourceBrickId !== null) report.droppedOutlineRefs++;
  const common = { name: n.label, ...(vmigAll.every(s => n.visibleIn.includes(s)) ? {} : { visibleIn: [...n.visibleIn] }), ...(n.a11y ? { a11y: n.a11y } : {}) };
  const edges = ctx.edges.filter(e => e.source === n.id), events = () => edges.map(e => ({ id: visualAllocate(ctx.store, 'vi'), event: e.event, label: e.label, notes: e.notes, acceptance: e.acceptance, actions: vmigActions(e, ctx.map) }));
  const children = () => (ctx.kids.get(n.id) ?? []).map(c => vmigNode(c, ctx));
  const extra = { ...common, ...(n.ui ? { layout: visualLayoutRules(n.layout, structuredClone(n.ui)) } : {}) }, withEvents = () => ({ ...extra, events: events() });
  if (['text', 'heading', 'slot'].includes(n.kind)) report.droppedInteractions += edges.length;
  switch (n.kind) {
    case 'region': vmigLose(ctx, n.text); return visualElement(ctx.id, 'div', { ...withEvents(), layout: visualLayoutRules(n.layout, structuredClone(n.ui ?? compositionDefaultUI())), children: children() });
    case 'text': return vmigTextNode(n, ctx, 'p', common);
    case 'heading': return vmigTextNode(n, ctx, 'h2', common);
    case 'button': return visualNuxt(ctx.id, 'u-button', { label: vmigShown(n, ctx, n.text || n.label) }, withEvents());
    case 'input': case 'number': case 'textarea': case 'select': case 'checkbox': {
      const node = vmigControl(n, ctx, withEvents());
      if (n.control !== undefined) node.control = structuredClone(n.control);
      return node;
    }
    case 'tabs': vmigLose(ctx, n.text); return visualNuxt(ctx.id, 'u-tabs', vmigLiterals({ items: n.options ?? [], modelValue: vmigShown(n, ctx) }), withEvents());
    case 'table': return visualNuxt(ctx.id, 'u-table', vmigLiterals({ columns: (n.options ?? []).map(o => ({ accessorKey: o, header: o })), data: vmigShown(n, ctx) }), { ...withEvents(), slots: n.text ? { empty: [visualText(visualAllocate(ctx.store, 'vn'), n.text, 'p')] } : {} });
    case 'alert': return visualNuxt(ctx.id, 'u-alert', vmigLiterals({ title: n.label, description: vmigShown(n, ctx, n.text || undefined) }), withEvents());
    case 'divider': vmigLose(ctx, n.text); return visualNuxt(ctx.id, 'u-separator', {}, withEvents());
    case 'image': if (n.a11y) vmigLose(ctx, n.text); return visualElement(ctx.id, 'img', { ...withEvents(), ...(n.a11y || n.text ? { a11y: n.a11y || n.text } : {}), attrs: { alt: visualLiteral(n.label) } });
    case 'list': return vmigList(n, ctx, withEvents());
    case 'slot': {
      if (n.slotCapacity !== undefined || n.slotKinds !== undefined) report.droppedSlotRules++;
      const fallback = children();
      return visualSlot(ctx.id, n.label, { ...extra, fallback: fallback.length ? fallback : n.text ? [visualText(visualAllocate(ctx.store, 'vn'), n.text, 'p')] : [] });
    }
    default: vmigLose(ctx, n.text); return vmigInstance(n, ctx, withEvents());
  }
}
function vmigTree(doc, ctx) {
  const map = new Map(doc.nodes.map(n => [n.id, visualAllocate(ctx.store, 'vn')])), assigned = new Set(doc.nodes.flatMap(n => Object.values(n.slots ?? {}).flat())), kids = new Map();
  for (const n of doc.nodes) if (n.parentId !== null) kids.set(n.parentId, [...(kids.get(n.parentId) ?? []), n]);
  const local = { ...ctx, map, kids, byId: new Map(doc.nodes.map(n => [n.id, n])), edges: doc.edges, owner: doc.ownerId };
  return { map, root: doc.nodes.filter(n => n.parentId === null && !assigned.has(n.id)).map(n => vmigNode(n, local)) };
}
function vmigScenarios(doc, map) { return (doc.scenarios ?? []).map(s => ({ ...structuredClone(s), values: Object.fromEntries(Object.entries(s.values).filter(([k]) => map.has(k)).map(([k, v]) => [map.get(k), structuredClone(v)])) })); }
export function migrateDetailDesigns(detail, design) {
  const store = emptyVisualDesigns(), used = new Set(), revisions = detail.revisions ?? [], docs = detail.documents;
  const report = { droppedPositions: 0, droppedSizes: 0, droppedOutlineRefs: 0, droppedSlotRules: 0, listBindings: 0, droppedTexts: 0, droppedTextStyles: 0, droppedInteractions: 0, droppedRevisionNotes: 0, droppedRevisionScenarios: 0, unparsedMembers: [], droppedProps: [], createdComponents: [] };
  const revisionMap = new Map(revisions.map(r => [r.id, visualAllocate(store, 'vr')])), componentIds = new Map(), contracts = new Map();
  const needed = new Set([...docs.filter(d => d.kind === 'component').map(d => d.ownerId), ...[...docs, ...revisions.map(r => r.document)].flatMap(d => d.nodes.filter(n => n.component).map(n => n.component.id)), ...revisions.map(r => r.ownerId)]);
  for (const lib of design.library ?? []) if (needed.has(lib.id)) {
    const contract = vmigContract(lib, report), id = visualAllocate(store, 'vc');
    store.components.push({ id, libraryId: lib.id, exportName: vmigPascal(lib.name, used), description: String(lib.description ?? '').slice(0, 2000), ...structuredClone(contract), template: [], scenarios: [] });
    componentIds.set(lib.id, id); contracts.set(lib.id, contract);
    if (!docs.some(d => d.kind === 'component' && d.ownerId === lib.id)) report.createdComponents.push(lib.id);
  }
  for (const r of revisions) contracts.set('rev:' + r.id, vmigContract(r.library, report));
  const ctx = { store, report, contracts, componentFor: id => componentIds.get(id), revision: id => revisionMap.get(id) };
  for (const doc of docs) {
    if (doc.kind === 'page') {
      const id = visualAllocate(store, 'vp'), { map, root } = vmigTree(doc, { ...ctx, contract: null });
      store.pages.push({ id, ownerId: doc.ownerId, name: doc.ownerLabel, root, scenarios: vmigScenarios(doc, map), notes: doc.notes });
    } else {
      const component = store.components.find(c => c.libraryId === doc.ownerId), { map, root } = vmigTree(doc, { ...ctx, contract: component });
      Object.assign(component, { template: root, scenarios: vmigScenarios(doc, map), ...(doc.notes ? { notes: doc.notes } : {}) });
    }
  }
  for (const r of revisions) {
    const contract = structuredClone(contracts.get('rev:' + r.id)), { root } = vmigTree(r.document, { ...ctx, contract });
    if (r.document.notes) report.droppedRevisionNotes++;
    report.droppedRevisionScenarios += r.document.scenarios?.length ?? 0;
    store.revisions.push({ id: revisionMap.get(r.id), componentId: componentIds.get(r.ownerId), version: r.version, contract, template: root, ...(r.designSystem != null ? { designSystem: structuredClone(r.designSystem) } : {}) });
  }
  return { visualDesigns: store, report };
}
