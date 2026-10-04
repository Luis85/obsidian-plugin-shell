// Independent, controlled Vue Flow island. Persistent records never contain renderer state.
function smNodeComponent() {
  const { h, defineComponent } = Vue;
  return defineComponent({ props: ['data', 'selected'], setup(p) { return () => {
    const n = p.data, r = n.record, inactive = n.readOnly;
    const action = (text, name, value, extra = {}) => h('button', { type: 'button', class: 'nodrag nopan sm-node-action', 'data-action': name, 'data-value': value, ...extra }, text);
    if (n.kind === 'lane') return h('div', { class: ['sm-lane', { 'sm-unplanned': !r.id }], style: { width: n.width + 'px', height: n.height + 'px' } },
      h('div', { class: 'sm-lane-label' }, [r.id ? action(r.title, 'sm-select', r.id, { title: r.title }) : h('strong', 'Unplanned'), h('small', r.outcome || 'Describe this release’s outcome'), r.id ? action('Edit release', 'sm-edit', r.id, { disabled: inactive }) : null]));
    if (n.kind === 'add') return action('+ Add story', 'sm-add', 'story:' + r.stepId + ':' + (r.releaseId || ''), { class: 'nodrag nopan sm-add-story', disabled: inactive, style: { width: n.width + 'px' } });
    return h('article', { class: ['sm-card', 'sm-card-' + n.kind, { selected: p.selected, 'sm-has-missing': n.missing > 0 }], 'data-sm-item': r.id, style: { width: n.width + 'px', height: n.height + 'px' } }, [
      h('div', { class: 'sm-card-main' }, [action(r.title, 'sm-select', r.id, { class: 'nodrag nopan sm-card-title', title: r.title, 'aria-label': n.kind + ': ' + r.title }),
        h('small', { class: 'sm-card-caption' }, n.missing ? n.missing + ' missing target' + (n.missing === 1 ? '' : 's') : n.kind === 'story' ? (r.surfaces.length ? r.surfaces.length + ' sitemap link' + (r.surfaces.length === 1 ? '' : 's') : r.ui === 'none' ? 'No UI required' : 'Not linked yet') : n.kind)]),
      h('div', { class: 'sm-card-actions nodrag nopan' }, [action('Edit', 'sm-edit', r.id, { disabled: inactive, 'aria-label': 'Edit ' + r.title }), n.kind === 'activity' ? action('+ Step', 'sm-add', 'step:' + r.id, { disabled: inactive, 'aria-label': 'Add step to ' + r.title }) : action('Move', 'sm-move', r.id, { disabled: inactive, 'aria-label': 'Move ' + r.title })])
    ]);
  }; } });
}
function smProjection(map) {
  const readOnly = smReadOnly(map), index = smReferenceIndex(design());
  return smLayout(map).nodes.map(n => ({ id: n.id, type: 'storymap', position: { x: n.x, y: n.y },
    data: { ...n, readOnly, missing: smMissingReferences(n.record, index).length }, dimensions: { width: n.width, height: n.height }, selected: n.id === smUi.item,
    draggable: !readOnly && ['activity', 'step', 'story'].includes(n.kind), selectable: !['lane', 'add'].includes(n.kind),
    connectable: false, focusable: false, zIndex: n.kind === 'lane' ? -1 : 1 }));
}
function smAnnounce(message) { const el = document.getElementById('sm-announcement'); if (el) el.textContent = message; }
function smSelect(id, reveal = true) {
  const map = smCurrentMap(); smUi.item = smItem(map, id) ? id : null;
  if (smUi.api) smUi.api.applyNodeChanges(smUi.api.getNodes.value.map(n => ({ id: n.id, type: 'select', selected: n.id === smUi.item })));
  const panel = document.getElementById('sm-inspector'); if (panel) panel.innerHTML = smInspector(map);
  document.querySelectorAll('[data-action="sm-locate"]').forEach(button => { button.disabled = !smUi.item; });
  if (id && reveal) smToggleDetails(true);
}
function smToggleDetails(open = !smUi.details) {
  const focusInside = document.getElementById('sm-inspector')?.contains(document.activeElement);
  smUi.details = open; document.querySelector('.sm-editor')?.setAttribute('data-details', open ? 'open' : 'closed');
  document.querySelectorAll('.sm-toolbar [data-action="sm-details"]').forEach(button => button.setAttribute('aria-pressed', String(open)));
  if (!open && focusInside) document.querySelector('.sm-toolbar [data-action="sm-details"]')?.focus();
}
function smFit() {
  const map = smCurrentMap(); if (!map?.activities.length || !smUi.api) return;
  smUi.api.fitView({ padding: .08, minZoom: .25, maxZoom: 1, duration: 0 });
}
function smLocate() {
  if (smUi.item && smUi.api?.findNode(smUi.item)) smUi.api.fitView({ nodes: [smUi.item], padding: .3, minZoom: .65, maxZoom: 1, duration: 0 });
}
function smDropPreview(map, id, position, layout) {
  const target = smDropTarget(map, id, position, layout), item = smItem(map, id); let message = 'Drop outside the map cancels this move.';
  if (target && item?.kind === 'story') message = 'Move to ' + map.steps.find(s => s.id === target.stepId)?.title + ' / ' + (map.releases.find(r => r.id === target.releaseId)?.title || 'Unplanned');
  else if (target && item?.kind === 'step') message = 'Move step to ' + map.activities.find(a => a.id === target.activityId)?.title;
  else if (target) message = target.beforeId ? 'Insert before ' + smItem(map, target.beforeId)?.record.title : 'Move to the end';
  const output = document.getElementById('sm-drop-status'); if (output) { output.textContent = message; output.classList.add('visible'); }
  let marker = document.getElementById('sm-insertion');
  if (!marker && smUi.root) { marker = document.createElement('div'); marker.id = 'sm-insertion'; marker.setAttribute('aria-hidden', 'true'); smUi.root.appendChild(marker); }
  if (!marker) return; marker.hidden = !target;
  if (target) {
    let x = layout.activities.find(a => a.id === target.beforeId)?.x || layout.width, y = 10, height = 154, width = 3;
    if (item.kind === 'step') x = layout.columns.find(c => c.id === target.beforeId)?.x || (layout.activities.find(a => a.id === target.activityId)?.x || 0) + (layout.activities.find(a => a.id === target.activityId)?.width || 0);
    if (item.kind === 'story') { x = layout.columns.find(c => c.id === target.stepId).x; const lane = layout.lanes.find(l => l.id === target.releaseId); const before = layout.nodes.find(n => n.id === target.beforeId); y = before?.y || lane.y + 16 + map.stories.filter(s => s.id !== id && s.stepId === target.stepId && s.releaseId === target.releaseId).length * SM_GEOMETRY.pitch; height = 3; width = SM_GEOMETRY.cardWidth; }
    const v = smUi.api.viewport.value; Object.assign(marker.style, { left: v.x + x * v.zoom + 'px', top: v.y + y * v.zoom + 'px', width: width * v.zoom + 'px', height: height * v.zoom + 'px' });
  }
}
function smClearPreview() { document.getElementById('sm-insertion')?.remove(); const output = document.getElementById('sm-drop-status'); if (output) { output.textContent = ''; output.classList.remove('visible'); } }
function smCancelGesture() {
  if (!smUi.drag) return; smUi.drag = null; smUi.cancelled = true; smClearPreview();
  const map = smCurrentMap(); if (map && smUi.api) smUi.api.applyNodeChanges(smLayout(map).nodes.map(n => ({ id: n.id, type: 'position', position: { x: n.x, y: n.y }, dragging: false })));
  smAnnounce('Move cancelled. Saved data is unchanged.');
}
function smDragGroup(map, node) {
  const drag = smUi.drag, origin = drag.layout.nodes.find(n => n.id === node.id); if (!origin || !['activity', 'step'].includes(origin.kind)) return;
  const steps = origin.kind === 'step' ? [node.id] : map.steps.filter(s => s.activityId === node.id).map(s => s.id);
  const records = drag.layout.nodes.filter(n => n.id !== node.id && (steps.includes(n.id) || n.kind === 'story' && steps.includes(n.record.stepId)));
  smUi.api.applyNodeChanges(records.map(n => ({ id: n.id, type: 'position', position: { x: n.x + node.position.x - origin.x, y: n.y + node.position.y - origin.y } })));
}
function smMount() {
  const root = document.getElementById('sm-flow'), map = smCurrentMap(); if (!root || !map || smUi.app) return;
  const { h, defineComponent, createApp, markRaw, nextTick } = Vue, { VueFlow, useVueFlow } = VueFlowCore;
  const serial = ++smUi.serial, owner = designOwner(), mapId = map.id, current = () => serial === smUi.serial && owner === designOwner() && smUi.map === mapId;
  smUi.root = root; smUi.rootMap = mapId; smUi.cancelled = false;
  const nodes = smProjection(map), Node = smNodeComponent();
  const Root = defineComponent({ setup() {
    const api = useVueFlow('companion-storymap-' + serial); smUi.api = api;
    api.onNodesChange(changes => { if (current()) api.applyNodeChanges(changes.filter(c => ['dimensions', 'select'].includes(c.type) || c.type === 'position' && !smUi.cancelled && !state.activeRun)); });
    api.onNodeClick(({ node }) => { if (current() && smItem(smCurrentMap(), node.id)) smSelect(node.id); });
    api.onPaneClick(() => { if (current() && !smUi.drag) smSelect(null); });
    api.onNodeDoubleClick(({ node, event }) => { if (current() && !event.target.closest('button') && smItem(smCurrentMap(), node.id)) smBegin(smItem(smCurrentMap(), node.id).kind, node.id); });
    api.onNodeDragStart(({ node }) => {
      if (!current()) return;
      try { smCanWrite(); smUi.cancelled = false; smUi.drag = { id: node.id, token: smToken(), layout: smLayout(smCurrentMap()) }; smSelect(node.id, false); }
      catch (error) { smUi.cancelled = true; smFail(error); render(); }
    });
    api.onNodeDrag(({ node }) => { if (current() && smUi.drag) { smDragGroup(smCurrentMap(), node); smDropPreview(smCurrentMap(), node.id, node.position, smUi.drag.layout); } });
    api.onNodeDragStop(({ node }) => {
      if (!current()) return; const drag = smUi.drag; smUi.drag = null; smClearPreview(); if (!drag || smUi.cancelled) return;
      const target = smDropTarget(smCurrentMap(), node.id, node.position, drag.layout);
      try { if (target) smCommit(store => smMove(smFind(store, mapId), node.id, target), drag.token); render(); smAnnounce(target ? 'Position saved. Step, release and order updated together. Undo is available.' : 'Move cancelled outside the map.'); }
      catch (error) { render(); smFail(error); }
    });
    api.onViewportChange(v => { if (!current()) return; smUi.viewports[mapId] = { x: v.x, y: v.y, zoom: v.zoom }; const output = document.getElementById('sm-zoom'); if (output) output.textContent = Math.round(v.zoom * 100) + '%'; });
    api.onInit(() => nextTick(() => { if (current()) { const remembered = smUi.viewports[mapId]; api.setViewport(remembered || { x: 16, y: 8, zoom: 1 }, { duration: 0 }); api.updateNodeInternals(); } }));
    return () => h(VueFlow, { id: 'companion-storymap-' + serial, nodes, edges: [], nodeTypes: { storymap: markRaw(Node) }, applyDefault: false,
      defaultViewport: smUi.viewports[mapId] || { x: 16, y: 8, zoom: 1 }, minZoom: .25, maxZoom: 1.5, nodesConnectable: false,
      zoomOnDoubleClick: false, zoomOnScroll: true, panOnDrag: true, nodeDragThreshold: 5, deleteKeyCode: null,
      selectionKeyCode: null, multiSelectionKeyCode: null, noDragClassName: 'nodrag', noPanClassName: 'nopan', noWheelClassName: 'nowheel' });
  } });
  smUi.app = createApp(Root); smUi.app.mount(root);
  smUi.resize = () => { if (!current()) return; smUi.lastWidth = innerWidth;
    const editor = root.closest('.sm-editor'); if (innerWidth > 850) editor.style.setProperty('--sm-editor-height', Math.max(360, innerHeight - editor.getBoundingClientRect().top - 60) + 'px'); };
  smUi.resize(); nextTick(() => { smUi.resize(); smUpdateFinder(); }); window.addEventListener('resize', smUi.resize);
  smUi.pointerStart = () => { if (!smUi.drag) smUi.cancelled = false; };
  smUi.cancel = () => smCancelGesture(); smUi.key = e => { if (e.key === 'Escape' && smUi.drag) { e.preventDefault(); e.stopPropagation(); smCancelGesture(); } };
  root.addEventListener('pointerdown', smUi.pointerStart, true); root.addEventListener('pointercancel', smUi.cancel, true);
  document.addEventListener('keydown', smUi.key, true); window.addEventListener('blur', smUi.cancel);
}
function smDestroy() {
  ++smUi.serial; smUi.drag = null; smClearPreview();
  smUi.root?.removeEventListener('pointerdown', smUi.pointerStart, true); smUi.root?.removeEventListener('pointercancel', smUi.cancel, true);
  if (smUi.key) document.removeEventListener('keydown', smUi.key, true); if (smUi.cancel) window.removeEventListener('blur', smUi.cancel);
  if (smUi.resize) window.removeEventListener('resize', smUi.resize);
  smUi.app?.unmount(); smUi.api?.$destroy(); smUi.app = null; smUi.api = null; smUi.root = null;
}
