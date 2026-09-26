// Component dependency graph over stable IDs. Pure.
import { VISUAL_LIMITS, visualAssert, visualWalk } from './visual-ir.mjs';
export function visualDependencies(nodes) { const found = new Set(); visualWalk(nodes, n => { if (n?.kind === 'component' && n.ref?.kind === 'project') found.add(n.ref.componentId); }); return [...found]; }
function vcmpEdges(nodes) { const out = []; visualWalk(nodes, n => { if (n?.kind === 'component' && n.ref?.kind === 'project') out.push(n.ref.revisionId ? 'rev:' + n.ref.revisionId : 'live:' + n.ref.componentId); }); return out; }
function vcmpGraphs(store) { const graphs = new Map(store.components.map(c => ['live:' + c.id, c.template])); for (const r of store.revisions) graphs.set('rev:' + r.id, r.template); return graphs; }
function vcmpLabel(store, key) { const [kind, id] = key.split(':'); const componentId = kind === 'rev' ? store.revisions.find(r => r.id === id)?.componentId : id; return store.components.find(c => c.id === componentId)?.exportName ?? id; }
export function visualWouldCycle(store, parentId, childId) {
  if (parentId === childId) return true;
  const graphs = vcmpGraphs(store), seen = new Set();
  const reaches = key => { const id = key.startsWith('rev:') ? store.revisions.find(r => 'rev:' + r.id === key)?.componentId : key.slice(5); if (id === parentId) return true; if (seen.has(key)) return false; seen.add(key); return vcmpEdges(graphs.get(key) ?? []).some(reaches); };
  return reaches('live:' + childId);
}
export function visualCompositionGraph(store) {
  const graphs = vcmpGraphs(store), done = new Set(), active = [];
  const visit = key => {
    visualAssert(!active.includes(key), 'Component cycle: ' + [...active.slice(active.indexOf(key)), key].map(k => vcmpLabel(store, k)).join(' → ') + '.');
    visualAssert(active.length < VISUAL_LIMITS.composition, 'Component composition is deeper than ' + VISUAL_LIMITS.composition + ' levels.');
    if (done.has(key)) return; active.push(key); for (const next of vcmpEdges(graphs.get(key) ?? [])) visit(next); active.pop(); done.add(key);
  };
  for (const key of graphs.keys()) visit(key);
}
export function visualUsages(store, componentId) {
  const out = [];
  for (const [kind, list, root] of [['page', store.pages, 'root'], ['component', store.components, 'template'], ['layout', store.layouts, 'root']])
    for (const d of list) visualWalk(d[root], n => { if (n.kind === 'component' && n.ref.kind === 'project' && n.ref.componentId === componentId) out.push({ kind, definitionId: d.id, definitionName: d.name ?? d.exportName, nodeId: n.id }); });
  return out;
}
