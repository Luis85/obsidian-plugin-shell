// Consequence-aware delete and the "Move to…" picker that replaces drag. Both open a dialog first and write once, on
// confirm, through veCommit. A refused delete (still referenced, or a component still used) is shown before any change.
function veDeleteApply(store, form) {
  const ref = { kind: form.kind, id: form.definitionId };
  if (form.target === 'definition') visualRemoveDefinition(store, ref); else visualRemoveNode(store, ref, form.nodeId);
}
// Dry run on a copy: what the delete removes, or why it is refused. Nothing is written.
function veDeletePlan(form, store = veStore()) {
  const definition = visualDefinition(store, { kind: form.kind, id: form.definitionId });
  if (!definition) return { name: 'Design', refusal: 'The ' + form.kind + ' design no longer exists.' };
  const node = form.target === 'element' ? visualLocate(visualRoot(definition), form.nodeId)?.node : null;
  if (form.target === 'element' && !node) return { name: 'Element', refusal: 'That element no longer exists.' };
  const nodes = visualNodes(node ? [node] : visualRoot(definition)), removed = new Set(nodes.map(n => n.id));
  const plan = {
    name: node ? veNodeLabel(node) : definition.name || definition.exportName, elements: nodes.length,
    interactions: nodes.reduce((sum, n) => sum + (n.events?.length || 0), 0),
    scenarios: node ? (definition.scenarios || []).filter(s => Object.keys(s.values).some(id => removed.has(id))).length : (definition.scenarios || []).length,
    revisions: !node && form.kind === 'component' ? store.revisions.filter(r => r.componentId === definition.id).length : 0,
  };
  try { veDeleteApply(structuredClone(store), form); } catch (error) { plan.refusal = veErrorText(error); }
  return plan;
}
function veCount(n, one, many = one + 's') { return n + ' ' + (n === 1 ? one : many); }
function veDeleteLines(form, plan) {
  if (form.target === 'element') {
    const nested = plan.elements - 1;
    return [nested ? 'Deletes ' + plan.name + ' and ' + veCount(nested, 'nested element') + '.' : 'Deletes ' + plan.name + '.',
      plan.interactions ? veCount(plan.interactions, 'interaction') + ' on them ' + (plan.interactions === 1 ? 'is' : 'are') + ' removed.' : 'No interactions are removed.',
      plan.scenarios ? 'Values in ' + veCount(plan.scenarios, 'scenario') + ' for them are dropped.' : 'No scenario values change.'];
  }
  if (form.kind === 'page') return ['Deletes the page design ' + plan.name + ' with ' + veCount(plan.elements, 'element') + ' and ' + veCount(plan.scenarios, 'scenario') + '.', 'The sitemap surface stays; you can start a new design later.'];
  return ['Deletes the component design ' + plan.name + ' with ' + veCount(plan.elements, 'template element') + ' and ' + veCount(plan.revisions, 'published revision') + '.', 'The library entry stays; you can start a new design later.'];
}
// ve-delete: '' deletes the selected element, 'definition' the open page or component design.
function veOpenDelete(value = '') {
  veEditable();
  const definition = veCurrentDef(), target = value === 'definition' ? 'definition' : 'element';
  if (!definition) throw Error(veInComponent() ? 'Start a component design first.' : 'Start a page design first.');
  const nodeId = target === 'element' ? veSelectedId() : null;
  veUi.deleteForm = { target, kind: veInComponent() ? 'component' : 'page', definitionId: definition.id, nodeId, error: '', token: smToken() };
  showModal('ve-delete');
}
function veDeleteDialog() {
  const form = veUi.deleteForm;
  if (!form) return dialogBody('Delete unavailable', '<p>Nothing is selected. Close this dialog; nothing was changed.</p>', button('Close', 'close'));
  const plan = veDeletePlan(form), lines = plan.refusal ? [] : veDeleteLines(form, plan);
  const body = `<p id="ve-delete-error" class="error" role="alert" tabindex="-1">${esc(form.error)}</p>`
    + (plan.refusal ? `<p class="ve-refusal">${icon('alert')}<span>${esc('Cannot delete: ' + plan.refusal)}</span></p>` : `<ul class="ve-usages">${lines.map(line => `<li>${esc(line)}</li>`).join('')}</ul><p class="ve-pane-note">Undo restores it.</p>`);
  return dialogBody('Delete ' + plan.name + '?', body, button('Cancel', 'close', '', 'ghost') + button('Delete', 've-delete-confirm', '', 'danger', 'trash', plan.refusal ? 'disabled' : 'autofocus'));
}
// After an element delete the selection moves to its previous sibling, else the next one, else its parent.
function veDeleteNeighbor(form) {
  if (form.target !== 'element') return null;
  const definition = visualDefinition(veStore(), { kind: form.kind, id: form.definitionId }), hit = definition ? visualLocate(visualRoot(definition), form.nodeId) : null;
  return hit ? (hit.list[hit.index - 1] ?? hit.list[hit.index + 1] ?? hit.parent)?.id ?? null : null;
}
function veDeleteConfirm() {
  const form = veUi.deleteForm;
  if (!form) throw Error('Open Delete again.');
  veEditable();
  const plan = veDeletePlan(form), next = veDeleteNeighbor(form);
  if (plan.refusal) throw Error(plan.refusal);
  veCommit(store => { veDeleteApply(store, form); }, form.token);
  veUi.deleteForm = null; closeModal();
  Object.assign(veUi, { selected: next, more: false, after: false, slotTarget: null, error: '' }); render();
  // The control that opened the dialog may have been the deleted element's own outline item: focus its neighbour then.
  const active = document.activeElement;
  if (!active?.isConnected || active === document.body || active === document.getElementById('content')) veFocusNode(next);
  notify(plan.name + ' deleted. Undo is available.');
}
// Containers that may receive the element: never the element itself or its descendants, never text, inputs, images,
// external libraries or components without a content slot, and not the list it already sits in.
function veReparentSlots(node, store) {
  if (node.kind === 'element') return ['input', 'img'].includes(node.tag) ? [] : [null];
  if (node.kind === 'slot') return [null];
  if (node.kind !== 'component') return [];
  if (node.ref.kind === 'nuxt-ui') { const slot = veContainerSlot(node); return slot ? [slot] : []; }
  return (veNodeContract(store, node)?.slots ?? []).map(s => s.name);
}
// "root", "<nodeId>" or "<nodeId>|<slot>" → the visualReparent target.
function veReparentTarget(value) { const [parentId, slot] = value === 'root' ? [null, null] : value.split('|'); return { parentId, ...(slot ? { slot } : {}) }; }
// Dry run with full validation, so a container the move would push past the depth or composition limits is never
// offered. The copy holds only the moved definition (cloned) next to the components and revisions it may reference;
// other pages and layouts cannot change the outcome, and leaving them out keeps the picker fast on large projects.
function veReparentFits(store, definition, nodeId, value) {
  const component = Object.hasOwn(definition, 'template'), ref = { kind: component ? 'component' : 'page', id: definition.id };
  try {
    const own = structuredClone(visualDefinition(store, ref));
    const copy = { ...store, layouts: [], pages: component ? [] : [own], components: component ? store.components.map(c => (c.id === own.id ? own : c)) : store.components };
    visualReparent(copy, ref, nodeId, veReparentTarget(value)); validateVisualDesigns(copy, veContext(design()));
    return true;
  } catch { return false; }
}
function veReparentCandidates(definition, nodeId, store = veStore()) {
  const root = visualRoot(definition), hit = visualLocate(root, nodeId);
  if (!hit) return [];
  const own = new Set(visualNodes([hit.node]).map(n => n.id)), out = [];
  if (hit.list !== root) out.push({ value: 'root', label: (Object.hasOwn(definition, 'template') ? 'Template' : 'Page') + ' root', kind: 'Top level', depth: 0 });
  visualWalk(root, (node, at) => {
    if (own.has(node.id)) return;
    for (const slot of veReparentSlots(node, store)) {
      const list = slot === null ? (node.kind === 'element' ? node.children : node.fallback) : node.slots?.[slot];
      if (list !== hit.list) out.push({ value: slot === null ? node.id : node.id + '|' + slot, label: veNodeLabel(node) + (slot ? ' › ' + slot : ''), kind: veKindLabel(node), depth: at.depth });
    }
  });
  return out.filter(c => veReparentFits(store, definition, nodeId, c.value));
}
function veOpenReparent() {
  veEditable();
  const id = veSelectedId();
  if (!veCurrentDef()) throw Error('Start a design first.');
  veUi.reparentForm = { nodeId: id, error: '', token: smToken() };
  showModal('ve-reparent');
}
function veReparentDialog() {
  const form = veUi.reparentForm, definition = veCurrentDef(), node = form && definition ? visualLocate(visualRoot(definition), form.nodeId)?.node : null;
  if (!node) return dialogBody('Move unavailable', '<p>The element no longer exists. Close this dialog; nothing was changed.</p>', button('Close', 'close'));
  const candidates = veReparentCandidates(definition, node.id);
  const rows = candidates.map(c => `<li style="--ve-level:${c.depth}">${button(c.label, 've-reparent-confirm', c.value, 'small ghost', '', `aria-label="${esc('Move into ' + c.label + ', ' + c.kind)}"`)}<span class="ve-tree-kind">${esc(c.kind)}</span></li>`).join('');
  const body = `<p id="ve-reparent-error" class="error" role="alert" tabindex="-1">${esc(form.error)}</p><p>Choose where ${esc(veNodeLabel(node))} goes. It is appended at the end of the chosen container; Move earlier and later adjust its place.</p>`
    + (rows ? `<ul class="ve-reparent-list" aria-label="Containers">${rows}</ul>` : '<p class="ve-pane-note">No other container can hold this element.</p>');
  return dialogBody('Move ' + veNodeLabel(node) + ' to…', body, button('Cancel', 'close', '', 'ghost'));
}
function veReparentConfirm(value) {
  const form = veUi.reparentForm, definition = veCurrentDef();
  if (!form) throw Error('Open Move to… again.');
  veEditable();
  const choice = definition ? veReparentCandidates(definition, form.nodeId).find(c => c.value === value) : null;
  if (!choice) throw Error('That container is no longer available. Choose another one.');
  veCommit(store => { visualReparent(store, veEditorRef(), form.nodeId, veReparentTarget(value)); }, form.token);
  veUi.reparentForm = null; closeModal();
  Object.assign(veUi, { selected: form.nodeId, more: false, after: false, error: '' }); render();
  notify('Moved into ' + choice.label + '. Undo is available.');
}
const VE_STRUCTURE_ACTIONS = {
  've-delete': veOpenDelete, 've-delete-confirm': veDeleteConfirm, 've-reparent': veOpenReparent, 've-reparent-confirm': veReparentConfirm,
};
