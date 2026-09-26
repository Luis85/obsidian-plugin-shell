// Controlled Vue Flow island shared by page and component editors.
function dtNodeComponent() {
  const { h, defineComponent } = Vue, { Handle, Position } = VueFlowCore;
  return defineComponent({ props: ['id', 'data', 'selected'], setup(props) { return () => {
    const n = props.data.record, region = n.kind === 'region';
    return h('div', { class: ['dt-flow-node', 'kind-' + n.kind, props.selected ? 'is-selected' : ''], style: { width: n.size.width + 'px', height: n.size.height + 'px' } }, [
      h(Handle, { type: 'target', position: Position.Left, id: 'in', class: 'dt-handle', 'aria-label': 'Interaction target for ' + n.label }),
      h('div', { class: 'dt-flow-title' }, [h('span', { class: 'dt-kind' }, n.kind), h('strong', n.label)]),
      h('div', { class: 'dt-flow-summary' }, region ? n.layout + ' · ' + props.data.childCount + ' children' : n.component ? n.component.label + ' · v' + n.component.version + ' · ' + n.component.variantId : n.text || (n.kind === 'input' ? 'Describe label, validation and binding' : 'Double-click to edit')),
      n.binding ? h('span', { class: 'dt-flow-binding' }, 'Data bound') : null,
      h(Handle, { type: 'source', position: Position.Right, id: 'out', class: 'dt-handle', 'aria-label': 'Interaction source for ' + n.label })
    ]);
  }; } });
}
function dtProjection(doc) {
  return dtSortedNodes(doc).map(n => ({ id: n.id, type: 'detail', position: dtCopy(n.position),
    ...(n.parentId ? { parentNode: n.parentId } : {}),
    data: { record: dtCopy(n), childCount: doc.nodes.filter(c => c.parentId === n.id).length },
    style: { width: n.size.width + 'px', height: n.size.height + 'px' }, dimensions: dtCopy(n.size),
    selected: n.id === dtUi.selected || (cpUi.selection||[]).includes(n.id), draggable: !state.activeRun && !tdUi.busy, selectable: true, connectable: !state.activeRun && !tdUi.busy, focusable: false,
    dragHandle: '.dt-flow-title' }));
}
function dtEdgeProjection(doc) {
  return doc.edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: 'out', targetHandle: 'in', label: e.event.length > 16 ? e.event.slice(0, 15) + '…' : e.event, zIndex: 1001, labelStyle: { fill: 'var(--text)', stroke: 'none', fontSize: '12px', fontWeight: 500 }, labelBgStyle: { fill: 'var(--panel)', stroke: 'var(--line)' }, labelBgPadding: [8, 5], labelBgBorderRadius: 4, interactionWidth: 24, type: 'smoothstep', selectable: true, updatable: false, focusable: false }));
}
function dtSelect(id, edge = null) {
  const doc = dtDocument(); if (!doc) return;
  dtUi.selected = doc.nodes.some(n => n.id === id) ? id : null; dtUi.edge = edge;
  if (dtUi.api) dtUi.api.applyNodeChanges(dtUi.api.getNodes.value.map(n => ({ id: n.id, type: 'select', selected: n.id === dtUi.selected })));
  const panel = document.getElementById('dt-inspector'); if (panel) panel.innerHTML = dtInspector(doc);
  document.querySelectorAll('.dt-tree-row > button[data-action="dt-select"]').forEach(button => { const selected = button.dataset.value === dtUi.selected; button.parentElement.classList.toggle('is-selected', selected); if(selected)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current'); });
  const announcement = document.getElementById('dt-announcement'); if (announcement && id) announcement.textContent = 'Selected ' + (doc.nodes.find(n => n.id === id)?.label || 'element') + '. Edit to change containment, content or geometry.';
}
function dtCancelGesture() {
  const drag = dtUi.drag; if (!drag) return;
  dtUi.drag = null; dtUi.cancelled = true;
  if (dtUi.api) dtUi.api.applyNodeChanges(dtDocument().nodes.map(n => ({ id: n.id, type: 'position', position: dtCopy(n.position), dragging: false })));
  const output = document.getElementById('dt-announcement'); if (output) output.textContent = 'Canvas move cancelled. Saved data is unchanged.';
}
function dtMount() {
  const root = document.getElementById('dt-flow'), doc = dtDocument(); if (!root || !doc || dtUi.app) return;
  const { h, defineComponent, createApp, markRaw, nextTick } = Vue, { VueFlow, useVueFlow } = VueFlowCore;
  const serial = ++dtUi.serial, owner = designOwner(), id = doc.id, current = () => serial === dtUi.serial && owner === designOwner() && dtDocument()?.id === id;
  dtUi.root = root; dtUi.cancelled = false;
  const nodes = dtProjection(doc), edges = dtEdgeProjection(doc), Node = dtNodeComponent();
  const Root = defineComponent({ setup() {
    const api = useVueFlow('companion-detail-' + serial); dtUi.api = api;
    api.onNodesChange(changes => { if (current()) api.applyNodeChanges(changes.filter(c => ['dimensions', 'select'].includes(c.type) || c.type === 'position' && !!dtUi.drag && !dtUi.cancelled)); });
    api.onEdgesChange(changes => { if (current()) api.applyEdgeChanges(changes.filter(c => c.type === 'select')); });
    api.onNodeClick(({ node, event }) => { if (current()) { if(event.ctrlKey||event.metaKey)cpToggleSelection(node.id);else dtSelect(node.id); } });
    api.onEdgeClick(({ edge }) => { if (current()) dtSelect(null, edge.id); });
    api.onPaneClick(() => { if (current() && !dtUi.drag) dtSelect(null); });
    api.onNodeDoubleClick(({ node }) => { if (current()) { try { dtBegin('node', node.id); } catch (error) { dtFail(error); } } });
    api.onConnect(connection => { if (current()) { try { dtBegin('edge', null, null, connection); } catch (error) { dtFail(error); } } });
    api.onNodeDragStart(({ node }) => {
      if (!current()) return;
      try { dtCanWrite(); dtUi.cancelled = false; dtUi.drag = { id: node.id, token: smToken() }; dtSelect(node.id); }
      catch (error) { dtUi.cancelled = true; dtFail(error); render(); }
    });
    api.onNodeDragStop(({ node }) => {
      if (!current()) return; const drag = dtUi.drag; dtUi.drag = null; if (!drag || dtUi.cancelled) return;
      try {
        dtCommit(store => { const record = store.documents.find(d => d.id === id)?.nodes.find(n => n.id === drag.id); if (!record) throw Error('The dragged element no longer exists.'); record.position = { x: Math.round(node.position.x), y: Math.round(node.position.y) }; }, drag.token);
        render(); const output = document.getElementById('dt-announcement'); if (output) output.textContent = 'Canvas position saved. Reading order and implementation intent are unchanged.';
      } catch (error) { render(); dtFail(error); }
    });
    api.onViewportChange(v => { if (!current()) return; dtUi.viewports[id] = { x: v.x, y: v.y, zoom: v.zoom }; const output = document.getElementById('dt-zoom'); if (output) output.textContent = Math.round(v.zoom * 100) + '%'; });
    api.onInit(() => nextTick(() => { if (current()) { api.updateNodeInternals(); if (dtUi.viewports[id]) api.setViewport(dtUi.viewports[id], { duration: 0 }); else api.fitView({ padding: .15, minZoom: .2, maxZoom: 1, duration: 0 }); } }));
    return () => h(VueFlow, { id: 'companion-detail-' + serial, nodes, edges, nodeTypes: { detail: markRaw(Node) }, applyDefault: false,
      minZoom: .2, maxZoom: 1.5, defaultViewport: dtUi.viewports[id] || { x: 20, y: 20, zoom: 1 }, zoomOnDoubleClick: false, zoomOnScroll: true,
      panOnDrag: true, nodeDragThreshold: 5, deleteKeyCode: null, selectionKeyCode: null, multiSelectionKeyCode: null, noDragClassName: 'nodrag', noPanClassName: 'nopan', noWheelClassName: 'nowheel' });
  } });
  dtUi.app = createApp(Root); dtUi.app.mount(root);
  dtUi.cancel = () => dtCancelGesture();
  dtUi.key = e => { if (e.key === 'Escape' && dtUi.drag) { e.preventDefault(); e.stopPropagation(); dtCancelGesture(); } };
  dtUi.pointerStart = () => { if (!dtUi.drag) dtUi.cancelled = false; };
  root.addEventListener('pointerdown', dtUi.pointerStart, true); root.addEventListener('pointercancel', dtUi.cancel, true);
  document.addEventListener('keydown', dtUi.key, true); window.addEventListener('blur', dtUi.cancel);
}
function dtDestroy() {
  ++dtUi.serial; dtUi.drag = null;
  dtUi.root?.removeEventListener('pointerdown', dtUi.pointerStart, true); dtUi.root?.removeEventListener('pointercancel', dtUi.cancel, true);
  if (dtUi.key) document.removeEventListener('keydown', dtUi.key, true); if (dtUi.cancel) window.removeEventListener('blur', dtUi.cancel);
  dtUi.app?.unmount(); dtUi.api?.$destroy(); dtUi.app = null; dtUi.api = null; dtUi.root = null;
}
