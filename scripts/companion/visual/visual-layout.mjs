// Structural copies with fresh IDs. Component definitions stay references.
import { visualAssert, visualAllocate, visualWalk, visualNodes, visualLocate, visualElement } from './visual-ir.mjs';
import { visualExpand, visualBuiltinLayouts } from './visual-catalog.mjs';
function vlayRemapMapping(m, remap) { if (m?.kind === 'draft') return { ...m, nodeId: remap(m.nodeId) }; if (m?.kind === 'object') return { ...m, fields: Object.fromEntries(Object.entries(m.fields).map(([k, v]) => [k, vlayRemapMapping(v, remap)])) }; return m; }
export function visualClone(store, nodes, { external = 'keep', slotsToRegions = false } = {}) {
  const map = new Map(); visualWalk(nodes, n => map.set(n.id, visualAllocate(store, 'vn')));
  const remap = (id, label) => { if (map.has(id)) return map.get(id); visualAssert(external === 'keep', 'Interaction ' + JSON.stringify(label) + ' targets an element outside the copied structure.'); return id; };
  const copy = n => {
    const out = structuredClone(n); out.id = map.get(n.id);
    if (out.kind === 'element') out.children = n.children.map(copy);
    if (out.kind === 'slot') out.fallback = n.fallback.map(copy);
    if (out.kind === 'component') out.slots = Object.fromEntries(Object.entries(n.slots).map(([k, v]) => [k, v.map(copy)]));
    if (out.kind === 'text' && out.value.kind === 'state') out.value = { ...out.value, nodeId: remap(out.value.nodeId, n.name ?? n.id) };
    for (const key of ['props', 'attrs']) if (out[key]) for (const [k, v] of Object.entries(out[key])) if (v.kind === 'state') out[key][k] = { ...v, nodeId: remap(v.nodeId, n.name ?? n.id) };
    if (out.events) out.events = out.events.map(i => ({ ...i, id: visualAllocate(store, 'vi'), actions: i.actions.map(a => ['toggle', 'focus', 'set-value'].includes(a.kind) ? { ...a, nodeId: remap(a.nodeId, i.label) } : a.kind === 'emit' ? { ...a, payload: vlayRemapMapping(a.payload, id => remap(id, i.label)) } : a.kind === 'source' ? { ...a, input: vlayRemapMapping(a.input, id => remap(id, i.label)) } : a) }));
    if (slotsToRegions && out.kind === 'slot') return visualElement(out.id, 'div', { name: out.name, children: out.fallback, ...(out.layout ? { layout: out.layout } : {}), ...(out.visibleIn ? { visibleIn: out.visibleIn } : {}) });
    return out;
  };
  return nodes.map(copy);
}
export function visualInstantiateLayout(store, id) {
  if (visualBuiltinLayouts.some(l => l.id === id)) return visualExpand(store, id);
  const layout = store.layouts.find(l => l.id === id); visualAssert(layout, 'Unknown layout ' + JSON.stringify(id) + '.');
  for (const n of visualNodes(layout.root)) if (n.kind === 'component' && n.ref.kind === 'project') visualAssert(store.components.some(c => c.id === n.ref.componentId), 'Layout ' + JSON.stringify(layout.name) + ' uses a component that no longer exists.');
  return visualClone(store, layout.root, { external: 'reject', slotsToRegions: true });
}
export function visualSaveLayout(store, { name, description, category, scope, nodeIds, pageId }) {
  const page = store.pages.find(p => p.id === pageId); visualAssert(page, 'Choose a page to save from.');
  const nodes = nodeIds.map(id => { const hit = visualLocate(page.root, id); visualAssert(hit, 'Selected element no longer exists.'); return hit.node; });
  const layout = { id: visualAllocate(store, 'vl'), name, description, scope, category, slots: [], root: visualClone(store, nodes, { external: 'reject' }), sourcePageId: pageId };
  store.layouts.push(layout); return layout;
}
