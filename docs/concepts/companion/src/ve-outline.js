// Outline: the one accessible tree of a visual definition (the canvas mirrors it with aria-current only).
// Search filters by name and kind and keeps the ancestors of every match; it never changes the design.
function veOutlineChildren(node) {
  if (node.kind === 'element') return [{ slot: null, nodes: node.children }];
  if (node.kind === 'slot') return [{ slot: null, nodes: node.fallback }];
  if (node.kind === 'component') return Object.entries(node.slots || {}).map(([slot, nodes]) => ({ slot, nodes }));
  return [];
}
function veOutlineText(node) { return (veNodeLabel(node) + ' ' + veKindLabel(node)).toLowerCase(); }
// IDs to show: every node when the query is empty, else each match plus its ancestors.
function veOutlineMatches(definition, query) {
  const q = query.trim().toLowerCase(), shown = new Set(), parents = new Map();
  visualWalk(visualRoot(definition), (node, at) => { parents.set(node.id, at.parent?.id ?? null); if (!q || veOutlineText(node).includes(q)) shown.add(node.id); });
  if (q) for (const id of [...shown]) { let parent = parents.get(id); while (parent && !shown.has(parent)) { shown.add(parent); parent = parents.get(parent); } }
  return shown;
}
// The item that takes Tab focus: the selected node, else the first visible one (roving tabindex).
function veOutlineFocus(definition, shown) {
  if (veUi.selected && shown.has(veUi.selected)) return veUi.selected;
  return visualNodes(visualRoot(definition)).find(node => shown.has(node.id))?.id ?? null;
}
function veOutlineMove(node, direction, disabled) {
  const label = 'Move ' + veNodeLabel(node) + ' ' + direction;
  return `<button type="button" class="ve-tree-move" data-action="ve-move" data-value="${esc(direction + ':' + node.id)}" tabindex="-1" aria-label="${esc(label)}" title="${esc(label)}"${disabled ? ' disabled' : ''}>${direction === 'earlier' ? '↑' : '↓'}</button>`;
}
function veOutlineItems(nodes, level, shown, focus, slot) {
  return nodes.map((node, index) => {
    if (!shown.has(node.id)) return '';
    const chosen = veUi.selected === node.id, lists = veOutlineChildren(node).filter(list => list.nodes.some(child => shown.has(child.id)));
    const groups = lists.map(list => `<ul role="group">${veOutlineItems(list.nodes, level + 1, shown, focus, list.slot)}</ul>`).join('');
    const where = slot ? `<span class="ve-tree-slot">in ${esc(slot)}</span>` : '';
    return `<li role="treeitem" class="ve-tree-item${chosen ? ' is-selected' : ''}" aria-level="${level}" aria-selected="${chosen}"${lists.length ? ' aria-expanded="true"' : ''} data-action="ve-select" data-value="${esc(node.id)}" tabindex="${focus === node.id ? 0 : -1}" aria-label="${esc(veNodeLabel(node) + ', ' + veKindLabel(node))}">`
      + `<span class="ve-tree-row" style="--ve-level:${level - 1}"><span class="ve-tree-label">${esc(veNodeLabel(node))}</span><span class="ve-tree-kind">${esc(veKindLabel(node))}</span>${where}`
      + `<span class="ve-tree-moves">${veOutlineMove(node, 'earlier', index === 0)}${veOutlineMove(node, 'later', index === nodes.length - 1)}</span></span>${groups}</li>`;
  }).join('');
}
function veOutlineHtml(definition) {
  const root = visualRoot(definition);
  if (!root.length) return '<p class="ve-pane-note">No elements yet. Insert a pattern, component or layout to start.</p>';
  const shown = veOutlineMatches(definition, veUi.query || '');
  if (!shown.size) return '<p class="ve-pane-note" role="status">No matching elements. Try another name or kind. Search never removes content.</p>';
  const name = definition.name || definition.exportName || definition.id;
  return `<ul role="tree" class="ve-tree" aria-label="${esc(name + ' outline')}">${veOutlineItems(root, 1, shown, veOutlineFocus(definition, shown), null)}</ul>`;
}
// Page › ancestors › selected, for the canvas footer.
function veOutlineTrail(definition, nodeId) {
  const parents = new Map(), trail = [];
  visualWalk(visualRoot(definition), (node, at) => parents.set(node.id, { node, parent: at.parent }));
  for (let at = parents.get(nodeId); at; at = at.parent ? parents.get(at.parent.id) : null) trail.unshift(at.node);
  return trail;
}
