// Shared data-only page/component design contract. No renderer or host dependency.
export const DETAIL_NODE_KINDS = Object.freeze(['region', 'text', 'input', 'button', 'component', 'slot']);
export const DETAIL_STATES = Object.freeze(['default', 'loading', 'empty', 'error', 'disabled']);
export function emptyDetailDesigns() { return { schema: 1, nextId: 1, documents: [] }; }
function detailRequire(ok, message) { if (!ok) throw Error('DETAIL_INVALID: ' + message); }
function detailObject(value, keys, optional = []) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).every(key => [...keys, ...optional].includes(key)) && keys.every(key => Object.hasOwn(value, key));
}
function detailText(value, max, required = false) { return typeof value === 'string' && value.length <= max && (!required || !!value.trim()); }
function detailReference(value) { return detailText(value, 120, true) && /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value); }
function detailLiteralProps(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length <= 16 &&
    Object.entries(value).every(([key, item]) => /^[a-z][A-Za-z0-9]*$/.test(key) && !['constructor', 'prototype'].includes(key) &&
      (typeof item === 'boolean' || typeof item === 'number' && Number.isFinite(item) || detailText(item, 2000)));
}
function detailNode(node, identity) {
  detailRequire(detailObject(node, ['id', 'kind', 'label', 'text', 'parentId', 'layout', 'position', 'size', 'component', 'props', 'binding', 'a11y', 'visibleIn', 'sourceBrickId'], ['control', 'slots']), 'Unsupported element fields.');
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
  if (node.control !== undefined) { detailRequire(node.kind === 'input', 'Only inputs have control semantics.'); validateDetailControl(node.control); }
  if (node.slots !== undefined) detailRequire(node.kind === 'component' && node.slots && typeof node.slots === 'object' && !Array.isArray(node.slots) && Object.keys(node.slots).length <= 8 && Object.entries(node.slots).every(([name, ids]) => /^[a-z][A-Za-z0-9-]*$/.test(name) && !['constructor', 'prototype'].includes(name) && Array.isArray(ids) && ids.length <= 12 && ids.every(detailReference) && new Set(ids).size === ids.length), 'Invalid instance slot assignment.');
  if (node.binding !== null) detailRequire(detailObject(node.binding, ['sourceId', 'operationId', 'field']) && detailReference(node.binding.sourceId) && detailReference(node.binding.operationId) && detailText(node.binding.field, 120), 'Invalid data binding.');
}
function detailEdges(doc, identity) {
  const seen = new Set();
  for (const e of doc.edges) {
    detailRequire(detailObject(e, ['id', 'source', 'target', 'event', 'label', 'notes', 'acceptance', 'targetSurfaceId'], ['action']), 'Unsupported interaction fields.');
    identity(e.id, 'edge');
    detailRequire(doc.nodes.some(n => n.id === e.source) && doc.nodes.some(n => n.id === e.target) && e.source !== e.target, 'Interactions need two existing, different elements.');
    detailRequire(detailText(e.event, 60, true) && /^[a-zA-Z][a-zA-Z0-9:_-]*$/.test(e.event) && detailText(e.label, 120, true) && !/[\r\n]/.test(e.label), 'Use an event name and single-line interaction label.');
    detailRequire(detailText(e.notes, 4000) && detailText(e.acceptance, 8000) && (e.targetSurfaceId === null || detailReference(e.targetSurfaceId)), 'Invalid interaction notes or navigation target.');
    if (e.action !== undefined) { detailRequire(e.targetSurfaceId === null, 'Choose navigation or a mapped action, not both.'); validateDetailAction(e.action);
      const check = mapping => { if (mapping.kind === 'draft') detailRequire(doc.nodes.some(n => n.id === mapping.nodeId && n.kind === 'input'), 'Mapped draft input is missing.'); if (mapping.kind === 'object') Object.values(mapping.fields).forEach(check); };
      check(e.action.kind === 'source' ? e.action.input : e.action.payload);
    }
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
  detailRequire(detailObject(store, ['schema', 'nextId', 'documents']) && [1, 2].includes(store.schema), 'Unsupported detail-design collection.');
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
    detailRequire(store.schema === 2 || !doc.nodes.some(n => n.control !== undefined || n.slots !== undefined) && !doc.edges.some(e => e.action !== undefined), 'Executable details require detail schema 2.');
    for (const node of doc.nodes) detailNode(node, identity);
    detailSlotAssignments(doc);
    detailHierarchy(doc); detailEdges(doc, identity);
  }
  detailRequire(store.nextId > highest, 'The detail counter could reuse an existing ID.');
  detailComposition(store.documents); return store;
}

// Schema 2 adds explicit semantics; schema 1 documents retain text-only behavior.
function validateDetailControl(control) {
  detailRequire(detailObject(control, ['kind'], ['required', 'options', 'maxBytes']), 'Invalid control fields.');
  detailRequire(['text', 'textarea', 'number', 'checkbox', 'date', 'datetime-local', 'select', 'json-file', 'json-editor', 'markdown-editor'].includes(control.kind), 'Unsupported control type.');
  if (control.required !== undefined) detailRequire(typeof control.required === 'boolean', 'Invalid required control.');
  if (control.options !== undefined) detailRequire(control.kind === 'select' && Array.isArray(control.options) && control.options.length > 0 && control.options.length <= 60 && control.options.every(o => detailObject(o, ['label', 'value']) && detailText(o.label, 120, true) && detailText(o.value, 120)) && new Set(control.options.map(o => o.value)).size === control.options.length, 'Invalid select options.');
  detailRequire(control.kind !== 'select' || control.options !== undefined, 'Select options are required.');
  if (control.maxBytes !== undefined) detailRequire(['json-file', 'json-editor', 'markdown-editor', 'textarea', 'text'].includes(control.kind) && Number.isSafeInteger(control.maxBytes) && control.maxBytes > 0 && control.maxBytes <= 4_000_000, 'Invalid control byte limit.');
}
function detailJson(value, depth = 0) {
  if (depth > 12) return false;
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  return value && typeof value === 'object' && Object.entries(value).every(([key, v]) => !['constructor', 'prototype', '__proto__'].includes(key) && detailJson(v, depth + 1));
}
function validateDetailMapping(mapping, depth = 0, budget = { count: 0 }) {
  detailRequire(depth <= 6 && ++budget.count <= 120, 'Payload mapping is too large.');
  detailRequire(mapping && typeof mapping === 'object', 'Missing payload mapping.');
  if (mapping.kind === 'none' || mapping.kind === 'event') detailRequire(detailObject(mapping, ['kind']), 'Invalid simple mapping.');
  else if (mapping.kind === 'value') detailRequire(detailObject(mapping, ['kind', 'value']) && detailJson(mapping.value) && JSON.stringify(mapping.value).length <= 12000, 'Invalid literal payload.');
  else if (mapping.kind === 'draft') detailRequire(detailObject(mapping, ['kind', 'nodeId']) && detailReference(mapping.nodeId), 'Invalid draft mapping.');
  else if (mapping.kind === 'prop') detailRequire(detailObject(mapping, ['kind', 'name']) && /^[a-z][A-Za-z0-9]*$/.test(mapping.name) && !['constructor', 'prototype'].includes(mapping.name), 'Invalid prop mapping.');
  else if (mapping.kind === 'source') detailRequire(detailObject(mapping, ['kind', 'sourceId', 'operationId', 'field']) && detailReference(mapping.sourceId) && detailReference(mapping.operationId) && detailText(mapping.field, 120), 'Invalid source mapping.');
  else if (mapping.kind === 'object') {
    detailRequire(mapping.fields && !Array.isArray(mapping.fields) && typeof mapping.fields === 'object' && detailObject(mapping, ['kind', 'fields']) && Object.keys(mapping.fields).length <= 40, 'Invalid object mapping.');
    for (const [key, value] of Object.entries(mapping.fields)) { detailRequire(/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) && !['constructor', 'prototype'].includes(key), 'Unsafe payload property.'); validateDetailMapping(value, depth + 1, budget); }
  } else detailRequire(false, 'Unsupported payload mapping.');
  return mapping;
}
function validateDetailAction(action) {
  if (action?.kind === 'source') {
    detailRequire(detailObject(action, ['kind', 'sourceId', 'operationId', 'input']) && detailReference(action.sourceId) && detailReference(action.operationId), 'Invalid source action.');
    validateDetailMapping(action.input);
  } else {
    detailRequire(action?.kind === 'emit' && detailObject(action, ['kind', 'event', 'payload']) && /^[a-z][A-Za-z0-9]*$/.test(action.event), 'Invalid component emission.');
    validateDetailMapping(action.payload);
  }
}
function detailSlotAssignments(doc) {
  const owners = new Map();
  for (const node of doc.nodes) for (const ids of Object.values(node.slots || {})) for (const id of ids) {
    const root = doc.nodes.find(n => n.id === id);
    detailRequire(root && root.parentId === null && root.id !== node.id && !owners.has(id), 'Slot content must be an unassigned root element.'); owners.set(id, node.id);
  }
  for (const node of doc.nodes) {
    const seen = new Set(); let cursor = node;
    while (cursor) {
      detailRequire(!seen.has(cursor.id), 'Slot containment must not be recursive.'); seen.add(cursor.id);
      cursor = doc.nodes.find(n => n.id === (cursor.parentId || owners.get(cursor.id)));
    }
  }
}
