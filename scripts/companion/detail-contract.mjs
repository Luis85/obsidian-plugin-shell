// Shared data-only page/component design contract. No renderer or host dependency.
export const DETAIL_NODE_KINDS = Object.freeze(['region', 'text', 'input', 'button', 'component', 'slot']);
export const DETAIL_STATES = Object.freeze(['default', 'loading', 'empty', 'error', 'disabled']);
export function emptyDetailDesigns() { return { schema: 1, nextId: 1, documents: [] }; }
function detailRequire(ok, message) { if (!ok) throw Error('DETAIL_INVALID: ' + message); }
function detailObject(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function detailText(value, max, required = false) { return typeof value === 'string' && value.length <= max && (!required || !!value.trim()); }
function detailReference(value) { return detailText(value, 120, true) && /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value); }
function detailLiteralProps(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length <= 16 &&
    Object.entries(value).every(([key, item]) => /^[a-z][A-Za-z0-9]*$/.test(key) && !['constructor', 'prototype'].includes(key) &&
      (typeof item === 'boolean' || typeof item === 'number' && Number.isFinite(item) || detailText(item, 2000)));
}
function detailNode(node, identity) {
  detailRequire(detailObject(node, ['id', 'kind', 'label', 'text', 'parentId', 'layout', 'position', 'size', 'component', 'props', 'binding', 'a11y', 'visibleIn', 'sourceBrickId']), 'Unsupported element fields.');
  identity(node.id, 'node');
  detailRequire(DETAIL_NODE_KINDS.includes(node.kind) && detailText(node.label, 120, true) && !/[\r\n]/.test(node.label), 'Choose an element kind and single-line label.');
  detailRequire(detailText(node.text, 8000) && detailText(node.a11y, 2000), 'Element content exceeds its limit.');
  detailRequire(node.parentId === null || detailReference(node.parentId), 'Invalid parent reference.');
  detailRequire(['stack', 'row', 'grid'].includes(node.layout), 'Unsupported layout.');
  detailRequire(detailObject(node.position, ['x', 'y']) && Object.values(node.position).every(n => Number.isFinite(n) && Math.abs(n) <= 50000), 'Invalid canvas position.');
  detailRequire(detailObject(node.size, ['width', 'height']) && Object.values(node.size).every(n => Number.isFinite(n) && n >= 80 && n <= 4000), 'Use sizes between 80 and 4000.');
  detailRequire(Array.isArray(node.visibleIn) && node.visibleIn.length > 0 && node.visibleIn.length <= DETAIL_STATES.length && new Set(node.visibleIn).size === node.visibleIn.length && node.visibleIn.every(s => DETAIL_STATES.includes(s)), 'Choose at least one supported preview state.');
  detailRequire(node.sourceBrickId === null || detailReference(node.sourceBrickId), 'Invalid outline reference.');
  detailRequire(detailLiteralProps(node.props), 'Only bounded literal string, number and boolean props are allowed.');
  if (node.component !== null) {
    const c = node.component;
    detailRequire(node.kind === 'component' && detailObject(c, ['id', 'label', 'version', 'variantId']) && detailReference(c.id) && detailText(c.label, 160, true) && detailText(c.version, 40, true) && /^\d+\.\d+\.\d+$/.test(c.version) && detailReference(c.variantId), 'Invalid reusable component reference.');
  }
  detailRequire(node.kind !== 'component' || node.component !== null, 'Choose a reusable component.');
  detailRequire(node.kind === 'component' || Object.keys(node.props).length === 0, 'Props belong to reusable component instances.');
  if (node.binding !== null) detailRequire(detailObject(node.binding, ['sourceId', 'operationId', 'field']) && detailReference(node.binding.sourceId) && detailReference(node.binding.operationId) && detailText(node.binding.field, 120), 'Invalid data binding.');
}
function detailEdges(doc, identity) {
  const seen = new Set();
  for (const e of doc.edges) {
    detailRequire(detailObject(e, ['id', 'source', 'target', 'event', 'label', 'notes', 'acceptance', 'targetSurfaceId']), 'Unsupported interaction fields.');
    identity(e.id, 'edge');
    detailRequire(doc.nodes.some(n => n.id === e.source) && doc.nodes.some(n => n.id === e.target) && e.source !== e.target, 'Interactions need two existing, different elements.');
    detailRequire(detailText(e.event, 60, true) && /^[a-zA-Z][a-zA-Z0-9:_-]*$/.test(e.event) && detailText(e.label, 120, true) && !/[\r\n]/.test(e.label), 'Use an event name and single-line interaction label.');
    detailRequire(detailText(e.notes, 4000) && detailText(e.acceptance, 8000) && (e.targetSurfaceId === null || detailReference(e.targetSurfaceId)), 'Invalid interaction notes or navigation target.');
    const key = JSON.stringify([e.source, e.target, e.event]); detailRequire(!seen.has(key), 'This event already connects these elements.'); seen.add(key);
  }
}
function detailHierarchy(doc) {
  const byId = new Map(doc.nodes.map(n => [n.id, n]));
  for (const node of doc.nodes) {
    const seen = new Set([node.id]); let cursor = node;
    while (cursor.parentId !== null) {
      detailRequire(!seen.has(cursor.parentId) && seen.size < 8, 'Containment must be acyclic and at most eight levels deep.');
      cursor = byId.get(cursor.parentId); detailRequire(cursor?.kind === 'region', 'Only an existing region may contain elements.'); seen.add(cursor.id);
    }
  }
}
function detailComposition(documents) {
  const components = new Map(documents.filter(d => d.kind === 'component').map(d => [d.ownerId, d]));
  const visited = new Set(), active = new Set();
  function visit(id) {
    detailRequire(!active.has(id), 'Reusable component composition must not be recursive.');
    if (visited.has(id)) return; active.add(id);
    for (const n of components.get(id)?.nodes || []) if (n.component) visit(n.component.id);
    active.delete(id); visited.add(id);
  }
  for (const id of components.keys()) visit(id);
}
export function validateDetailDesigns(store) {
  detailRequire(detailObject(store, ['schema', 'nextId', 'documents']) && store.schema === 1, 'Unsupported detail-design collection.');
  detailRequire(Number.isSafeInteger(store.nextId) && store.nextId > 0 && store.nextId < Number.MAX_SAFE_INTEGER - 100000, 'Invalid detail identity counter.');
  detailRequire(Array.isArray(store.documents) && store.documents.length <= 200, 'Use at most 200 detail designs.');
  const ids = new Set(), owners = new Set(); let highest = 0, count = 0;
  const identity = (id, kind) => {
    const match = typeof id === 'string' && id.match(new RegExp('^detail-' + kind + '-([1-9][0-9]*)$'));
    detailRequire(match && Number.isSafeInteger(Number(match[1])) && !ids.has(id), 'Detail IDs must be unique, stable and generated.');
    ids.add(id); highest = Math.max(highest, Number(match[1]));
  };
  for (const doc of store.documents) {
    detailRequire(detailObject(doc, ['id', 'kind', 'ownerId', 'ownerLabel', 'notes', 'nodes', 'edges']), 'Unsupported detail-document fields.');
    identity(doc.id, 'document');
    detailRequire(['page', 'component'].includes(doc.kind) && detailReference(doc.ownerId) && detailText(doc.ownerLabel, 160, true) && detailText(doc.notes, 8000), 'Invalid detail owner or notes.');
    const key = doc.kind + ':' + doc.ownerId; detailRequire(!owners.has(key), 'An owner may have only one detail design.'); owners.add(key);
    detailRequire(Array.isArray(doc.nodes) && doc.nodes.length <= 120 && Array.isArray(doc.edges) && doc.edges.length <= 240, 'A detail design supports 120 elements and 240 interactions.');
    count += doc.nodes.length + doc.edges.length; detailRequire(count <= 4000, 'Project detail-design limit exceeded.');
    for (const node of doc.nodes) detailNode(node, identity);
    detailHierarchy(doc); detailEdges(doc, identity);
  }
  detailRequire(store.nextId > highest, 'The detail counter could reuse an existing ID.');
  detailComposition(store.documents); return store;
}
