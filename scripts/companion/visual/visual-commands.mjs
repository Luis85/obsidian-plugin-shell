// Pure authoring commands. Each mutates the given (copied) store; the caller validates and persists once.
import { visualAssert, visualAllocate, visualWalk, visualNodes, visualLocate, visualDefinition, visualRoot, visualElement, visualLiteral, visualNuxt, VISUAL_DOM_EVENTS } from './visual-ir.mjs';
import { visualCatalogEntry } from './visual-catalog.mjs';
import { visualUsages } from './visual-composition.mjs';
import { visualClone } from './visual-layout.mjs';
import { visualMappingRefs } from './visual-mapping.mjs';
function vcmdDef(store, ref) { const d = visualDefinition(store, ref); visualAssert(d, 'The ' + ref.kind + ' no longer exists.'); return d; }
function vcmdHit(def, nodeId) { const hit = visualLocate(visualRoot(def), nodeId); visualAssert(hit, 'The element no longer exists.'); return hit; }
function vcmdSlots(store, node) {
  if (node.ref.kind === 'nuxt-ui') return visualCatalogEntry(node.ref.entryId)?.slots.map(s => s.name) ?? [];
  const c = node.ref.revisionId ? store.revisions.find(r => r.id === node.ref.revisionId)?.contract : store.components.find(x => x.id === node.ref.componentId);
  return c?.slots.map(s => s.name) ?? [];
}
function vcmdTargetList(store, def, target) {
  if (target.parentId === null) return visualRoot(def);
  const parent = vcmdHit(def, target.parentId).node;
  if (parent.kind === 'element') { visualAssert(!['input', 'img'].includes(parent.tag), 'A ' + parent.tag + ' cannot contain elements.'); return parent.children; }
  if (parent.kind === 'slot') return parent.fallback;
  if (parent.kind === 'component') { visualAssert(target.slot && vcmdSlots(store, parent).includes(target.slot), 'The component has no slot ' + target.slot + '.'); parent.slots[target.slot] ??= []; return parent.slots[target.slot]; }
  visualAssert(false, 'Text cannot contain elements.');
}
function vcmdReferences(def, ids) {
  const found = [];
  visualWalk(visualRoot(def), n => {
    if (ids.has(n.id)) return;
    const values = [...Object.values(n.props ?? {}), ...Object.values(n.attrs ?? {}), ...(n.kind === 'text' ? [n.value] : [])];
    if (values.some(v => v.kind === 'state' && ids.has(v.nodeId))) found.push(n.name ?? n.id);
    for (const i of n.events ?? []) if (i.actions.some(a => (a.nodeId && ids.has(a.nodeId)) || visualMappingRefs(a.payload ?? a.input).drafts.some(id => ids.has(id)))) found.push(i.label);
  });
  return found;
}
export function visualCreatePage(store, { ownerId, name }) { const page = { id: visualAllocate(store, 'vp'), ownerId, name, root: [], scenarios: [], notes: '' }; store.pages.push(page); return page; }
export function visualCreateComponent(store, { libraryId, exportName, description = '', implementation }) {
  const c = { id: visualAllocate(store, 'vc'), libraryId, exportName, description, props: [], slots: [], emits: [], variants: [], template: [], scenarios: [] };
  if (implementation) {
    const entry = visualCatalogEntry(implementation.entryId); visualAssert(entry, 'Unknown catalog primitive.');
    c.implementation = { catalog: 'nuxt-ui', entryId: entry.id };
    c.props = entry.props.filter(p => ['string', 'number', 'boolean'].includes(p.type)).map(p => ({ name: p.name, type: p.type, required: false, ...(p.default !== undefined ? { default: p.default } : {}) }));
    c.slots = entry.slots.map(s => ({ name: s.name, required: false }));
    c.emits = entry.emits.filter(e => /^[a-z][A-Za-z0-9]*$/.test(e.name)).map(e => ({ name: e.name, payloadType: 'unknown' }));
    const node = visualNuxt(visualAllocate(store, 'vn'), entry.id, Object.fromEntries(c.props.map(p => [p.name, { kind: 'prop', name: p.name }])), { name: entry.label });
    node.events = c.emits.map(e => ({ id: visualAllocate(store, 'vi'), event: e.name, label: 'Forward ' + e.name, notes: '', acceptance: '', actions: [{ kind: 'emit', event: e.name, payload: { kind: 'event' } }] }));
    c.template = [node];
  }
  store.components.push(c); return c;
}
export function visualRemoveDefinition(store, ref) {
  const def = vcmdDef(store, ref);
  if (ref.kind === 'component') { const uses = visualUsages(store, def.id).filter(u => u.definitionId !== def.id); visualAssert(!uses.length, def.exportName + ' is used by ' + uses.map(u => u.definitionName).join(', ') + '. Remove those instances first.'); store.revisions = store.revisions.filter(r => r.componentId !== def.id); }
  const key = ref.kind === 'page' ? 'pages' : ref.kind === 'component' ? 'components' : 'layouts'; store[key] = store[key].filter(d => d.id !== def.id);
}
export function visualInsert(store, ref, target, nodes) { const list = vcmdTargetList(store, vcmdDef(store, ref), target); list.splice(target.index ?? list.length, 0, ...nodes); return nodes; }
export function visualRemoveNode(store, ref, nodeId) {
  const def = vcmdDef(store, ref), hit = vcmdHit(def, nodeId), removed = new Set(visualNodes([hit.node]).map(n => n.id));
  const refs = vcmdReferences(def, removed); visualAssert(!refs.length, 'Still referenced by ' + refs.join(', ') + '. Change those first.');
  hit.list.splice(hit.index, 1);
  for (const s of def.scenarios ?? []) for (const id of Object.keys(s.values)) if (removed.has(id)) delete s.values[id];
}
export function visualMoveNode(store, ref, nodeId, direction) {
  const { list, index } = vcmdHit(vcmdDef(store, ref), nodeId), to = direction === 'earlier' ? index - 1 : index + 1;
  visualAssert(to >= 0 && to < list.length, 'The element is already ' + (direction === 'earlier' ? 'first' : 'last') + '.');
  [list[index], list[to]] = [list[to], list[index]];
}
export function visualReparent(store, ref, nodeId, target) {
  const def = vcmdDef(store, ref), hit = vcmdHit(def, nodeId);
  visualAssert(target.parentId === null || !visualLocate([hit.node], target.parentId), 'An element cannot be moved inside itself.');
  const list = vcmdTargetList(store, def, target); hit.list.splice(hit.index, 1); list.splice(target.index ?? list.length, 0, hit.node);
}
export function visualDuplicateNode(store, ref, nodeId) { const { node, list, index } = vcmdHit(vcmdDef(store, ref), nodeId); const [copy] = visualClone(store, [node]); list.splice(index + 1, 0, copy); return copy; }
export function visualWrapNode(store, ref, nodeId, tag = 'div') { const { node, list, index } = vcmdHit(vcmdDef(store, ref), nodeId); const wrap = visualElement(visualAllocate(store, 'vn'), tag, { name: 'Group', children: [node] }); list.splice(index, 1, wrap); return wrap; }
const vcmdPatchKeys = ['name', 'visibleIn', 'a11y', 'layout', 'tag', 'role', 'value', 'attrs', 'props', 'variantId', 'control', 'slots'];
export function visualUpdateNode(store, ref, nodeId, patch) {
  const { node } = vcmdHit(vcmdDef(store, ref), nodeId);
  for (const [key, value] of Object.entries(patch)) { visualAssert(vcmdPatchKeys.includes(key), 'Field ' + key + ' cannot be edited here.'); if (value === undefined) delete node[key]; else node[key] = structuredClone(value); }
  return node;
}
export function visualSetContract(store, componentId, change) {
  const c = vcmdDef(store, { kind: 'component', id: componentId }); const next = { ...c, ...structuredClone(change) };
  const broken = [];
  for (const u of visualUsages(store, componentId)) {
    const def = vcmdDef(store, { kind: u.kind, id: u.definitionId }), n = vcmdHit(def, u.nodeId).node; if (n.ref.revisionId) continue;
    for (const k of Object.keys(n.props)) if (!next.props.some(p => p.name === k)) broken.push(u.definitionName + ' / ' + (n.name ?? n.id) + ': prop ' + k);
    for (const p of next.props.filter(p => p.required)) if (!Object.hasOwn(n.props, p.name)) broken.push(u.definitionName + ' / ' + (n.name ?? n.id) + ': required prop ' + p.name);
    for (const k of Object.keys(n.slots)) if (!next.slots.some(s => s.name === k)) broken.push(u.definitionName + ' / ' + (n.name ?? n.id) + ': slot ' + k);
    for (const i of n.events) if (!next.emits.some(e => e.name === i.event) && !VISUAL_DOM_EVENTS.includes(i.event)) broken.push(u.definitionName + ' / ' + (n.name ?? n.id) + ': event ' + i.event);
  }
  visualWalk(c.template, n => { for (const i of n.events ?? []) for (const a of i.actions) if (a.kind === 'emit' && !next.emits.some(e => e.name === a.event)) broken.push(c.exportName + ' template: emit ' + a.event); });
  visualAssert(!broken.length, 'This contract change breaks ' + broken.join('; ') + '.');
  Object.assign(c, structuredClone(change));
}
export function visualAddInteraction(store, ref, nodeId, { event, label, actions = [], notes = '', acceptance = '' }) { const { node } = vcmdHit(vcmdDef(store, ref), nodeId); visualAssert(Array.isArray(node.events), 'Text elements have no interactions.'); const i = { id: visualAllocate(store, 'vi'), event, label, actions: structuredClone(actions), notes, acceptance }; node.events.push(i); return i; }
export function visualUpdateInteraction(store, ref, nodeId, interactionId, patch) { const i = vcmdHit(vcmdDef(store, ref), nodeId).node.events?.find(x => x.id === interactionId); visualAssert(i, 'The interaction no longer exists.'); for (const [k, v] of Object.entries(patch)) { visualAssert(['event', 'label', 'actions', 'notes', 'acceptance'].includes(k), 'Field ' + k + ' cannot be edited.'); i[k] = structuredClone(v); } return i; }
export function visualRemoveInteraction(store, ref, nodeId, interactionId) { const node = vcmdHit(vcmdDef(store, ref), nodeId).node; node.events = node.events.filter(i => i.id !== interactionId); }
export function visualSetScenarios(store, ref, scenarios) { vcmdDef(store, ref).scenarios = structuredClone(scenarios); }
const vcmdSemver = v => v.split('.').map(Number);
const vcmdGreater = (a, b) => { const [x, y] = [vcmdSemver(a), vcmdSemver(b)]; for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
export function visualPublish(store, componentId, version) {
  const c = vcmdDef(store, { kind: 'component', id: componentId });
  const latest = store.revisions.filter(r => r.componentId === componentId).map(r => r.version).sort((a, b) => (vcmdGreater(a, b) ? 1 : -1)).at(-1);
  visualAssert(/^\d+\.\d+\.\d+$/.test(version) && (!latest || vcmdGreater(version, latest)), 'Version must be x.y.z and greater than ' + (latest ?? '0.0.0') + '.');
  const template = structuredClone(c.template);
  visualWalk(template, n => { if (n.kind === 'component' && n.ref.kind === 'project' && !n.ref.revisionId) { const dep = store.revisions.filter(r => r.componentId === n.ref.componentId).at(-1); visualAssert(dep, 'Publish ' + (store.components.find(x => x.id === n.ref.componentId)?.exportName ?? n.ref.componentId) + ' first.'); n.ref.revisionId = dep.id; } });
  const revision = { id: visualAllocate(store, 'vr'), componentId, version, contract: structuredClone({ props: c.props, slots: c.slots, emits: c.emits, variants: c.variants }), template };
  store.revisions.push(revision); return revision;
}
