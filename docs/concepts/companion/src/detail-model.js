// Renderer-independent authoring operations. Array order, not coordinates, is reading order.
function dtCopy(value) { return JSON.parse(JSON.stringify(value)); }
function dtStore(d = design()) { return d.detailDesigns || emptyDetailDesigns(); }
function dtShape(value) { try { if (value !== undefined) validateDetailDesigns(value); return true; } catch { return false; } }
function dtFind(store, kind, ownerId) { return store.documents.find(d => d.kind === kind && d.ownerId === ownerId) || null; }
function dtNext(store, kind) { return 'detail-' + kind + '-' + store.nextId++; }
function dtPageEligible(node) { return !!node && ['page', 'modal', 'settings'].includes(node.kind); }
function dtOwner(doc, d = design()) { return doc.kind === 'component' ? d.library.find(c => c.id === doc.ownerId) : d.nodes.find(n => n.id === doc.ownerId); }
function dtOwnerLabel(doc, d = design()) { const owner = dtOwner(doc, d); return owner?.label || owner?.name || doc.ownerLabel; }
function dtNewDocument(store, kind, owner) {
  if (dtFind(store, kind, owner.id)) throw Error('This owner already has a detail design.');
  const doc = { id: dtNext(store, 'document'), kind, ownerId: owner.id, ownerLabel: owner.label || owner.name, notes: '', nodes: [], edges: [] };
  store.documents.push(doc); return doc;
}
function dtNewNode(store, kind, parentId = null, component = null) {
  return { id: dtNext(store, 'node'), kind, label: component?.name || ({ region: 'Content region', text: 'Text', input: 'Input field', button: 'Primary action', slot: 'default' }[kind] || 'Component'),
    text: kind === 'button' ? 'Continue' : '', parentId, layout: 'stack', position: { x: 24, y: 72 },
    size: kind === 'region' ? { width: 720, height: 440 } : { width: 240, height: 132 },
    component: component ? { id: component.id, label: component.name, version: component.version, variantId: 'default' } : null,
    props: {}, binding: null, a11y: '', visibleIn: [...DETAIL_STATES], sourceBrickId: null };
}
function dtDescendants(doc, id) {
  const ids = new Set([id]); let size = 0;
  while (size !== ids.size) { size = ids.size; for (const node of doc.nodes) if (ids.has(node.parentId)) ids.add(node.id); }
  return ids;
}
function dtRemoveNode(doc, id) {
  if (!doc.nodes.some(n => n.id === id)) throw Error('The element no longer exists.');
  const ids = dtDescendants(doc, id); doc.nodes = doc.nodes.filter(n => !ids.has(n.id));
  doc.edges = doc.edges.filter(e => !ids.has(e.source) && !ids.has(e.target));
}
function dtDuplicateNode(store, doc, id) {
  const source = doc.nodes.find(n => n.id === id); if (!source) throw Error('The element no longer exists.');
  const ids = dtDescendants(doc, id), replacements = new Map(), nodes = doc.nodes.filter(n => ids.has(n.id)).map(dtCopy);
  for (const n of nodes) { const old = n.id; n.id = dtNext(store, 'node'); replacements.set(old, n.id); }
  for (const n of nodes) { n.parentId = replacements.get(n.parentId) || n.parentId; n.sourceBrickId = null; }
  const root = nodes.find(n => n.id === replacements.get(id)); root.label = (root.label + ' copy').slice(0, 120); root.position.x += 32; root.position.y += 32;
  const edges = doc.edges.filter(e => ids.has(e.source) && ids.has(e.target)).map(e => ({ ...dtCopy(e), id: dtNext(store, 'edge'), source: replacements.get(e.source), target: replacements.get(e.target) }));
  doc.nodes.push(...nodes); doc.edges.push(...edges); return root.id;
}
function dtMoveInOrder(doc, id, direction) {
  const node = doc.nodes.find(n => n.id === id); if (!node) throw Error('The element no longer exists.');
  const siblings = doc.nodes.filter(n => n.parentId === node.parentId), index = siblings.findIndex(n => n.id === id), other = siblings[index + direction];
  if (!other) return; const a = doc.nodes.indexOf(node), b = doc.nodes.indexOf(other); [doc.nodes[a], doc.nodes[b]] = [doc.nodes[b], doc.nodes[a]];
}
function dtSortedNodes(doc) {
  const out = []; const walk = parent => { for (const node of doc.nodes.filter(n => n.parentId === parent)) { out.push(node); walk(node.id); } }; walk(null); return out;
}
function dtSemantic(store) {
  return { schema: store.schema, documents: store.documents.map(doc => ({ ...doc, nodes: doc.nodes.map(({ position, size, ...node }) => node) })) };
}
function dtIssues(d) {
  const store = dtStore(d), issues = []; const warn = (doc, message) => issues.push({ level: 'warning', code: 'detail-reference', message: dtOwnerLabel(doc, d) + ': ' + message, node: doc.kind === 'page' ? doc.ownerId : null });
  if (!dtShape(store)) return [{ level: 'error', code: 'detail-schema', message: 'Page or component detail data is malformed.', node: null }];
  for (const doc of store.documents) {
    const owner = dtOwner(doc, d); if (!owner) warn(doc, 'owner is missing; design retained for recovery.');
    else if (doc.kind === 'page' && !dtPageEligible(owner)) warn(doc, 'owner is no longer a page, modal or settings surface.');
    for (const node of doc.nodes) {
      const ref = node.component, c = ref && d.library.find(c => c.id === ref.id);
      if (ref && !c) warn(doc, node.label + ': component target missing.');
      if (c && c.version !== ref.version) warn(doc, node.label + ': pinned version ' + ref.version + ' differs from library ' + c.version + '; review before updating.');
      if (c && !componentVariants(c).some(v => v.id === ref.variantId)) warn(doc, node.label + ': variant target missing.');
      if (c && Object.entries(node.props).some(([name, value]) => !parseMembers(c.props, 'props').some(m => m.name === name && m.type === typeof value))) warn(doc, node.label + ': instance props no longer match the component contract.');
      if (node.binding) {
        const source = d.dataSources?.sources.find(s => s.id === node.binding.sourceId);
        if (!source?.operations.some(o => o.id === node.binding.operationId)) warn(doc, node.label + ': data-source operation missing.');
      }
      if (node.kind === 'slot' && owner && doc.kind === 'component' && !(owner.slots || '').split(',').map(s => s.trim()).includes(node.label)) warn(doc, node.label + ': slot is not declared in the component contract.');
      if (node.kind === 'input' && !node.a11y.trim()) warn(doc, node.label + ': document accessible naming and error feedback.');
    }
    for (const edge of doc.edges) if (edge.targetSurfaceId && !d.nodes.some(n => n.id === edge.targetSurfaceId)) warn(doc, edge.label + ': navigation target missing.');
  }
  return issues;
}
function dtComponentUses(id, d = design()) {
  return dtStore(d).documents.flatMap(doc => doc.nodes.filter(n => n.component?.id === id).map(node => ({ doc, node })));
}
function dtValidateInstance(node, d = design()) {
  if (!node.component) return;
  const c = d.library.find(c => c.id === node.component.id); if (!c) throw Error('Choose an existing component or retain this missing reference unchanged.');
  if (c.version !== node.component.version) throw Error('This instance uses an older contract. Review its library version before applying instance changes.');
  if (!componentVariants(c).some(v => v.id === node.component.variantId)) throw Error('Choose an existing component variant.');
  const members = parseMembers(c.props, 'props');
  for (const [name, value] of Object.entries(node.props)) { const member = members.find(m => m.name === name); if (!member || typeof value !== member.type) throw Error('Prop ' + name + ' must match the declared component type.'); }
}

function dtNavigationView() { return state.view === 'page-editor' ? 'pages' : state.view === 'component-editor' ? 'components' : state.view; }
