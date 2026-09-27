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
// Sitemap surfaces referenced by designs: page designs they own and navigate actions that target them, in every
// definition (published revisions included). Full validation refuses every write while such a reference dangles.
const veRevisionName = (store, r) => (store.components.find(c => c.id === r.componentId)?.exportName ?? r.componentId) + ' v' + r.version;
const veDefinitionLists = store => [['page', store.pages, 'root', x => x.name], ['component', store.components, 'template', x => x.exportName], ['layout', store.layouts, 'root', x => x.name], ['revision', store.revisions, 'template', r => veRevisionName(store, r)]];
function veNavigations(store, test) {
  const out = [];
  for (const [kind, list, root, name] of veDefinitionLists(store))
    for (const def of list) visualWalk(def[root], n => { for (const i of n.events ?? []) if (i.actions.some(a => a.kind === 'navigate' && test(a.surfaceId))) out.push({ kind, def, name: name(def), interaction: i }); });
  return out;
}
// Published revisions are never edited. Those that navigate to a matching surface are deleted when nothing that stays
// pins them (a page, component or layout outside `gone`, or a published revision that is kept); a revision that stays
// pinned blocks, naming what pins it.
function veRevisionPlan(store, test, gone = new Set()) {
  const hits = new Set(veNavigations(store, test).filter(u => u.kind === 'revision').map(u => u.def)), drop = new Set(hits);
  const pinners = r => {
    const out = new Set();
    for (const [kind, list, root, name] of veDefinitionLists(store))
      for (const def of list) if (!drop.has(def) && !gone.has(def)) visualWalk(def[root], n => { if (n.kind === 'component' && n.ref.kind === 'project' && n.ref.revisionId === r.id) out.add(kind + ' ' + name(def)); });
    return [...out];
  };
  for (let changed = true; changed;) { changed = false; for (const r of drop) if (pinners(r).length) { drop.delete(r); changed = true; } }
  return { revisions: [...drop], pinned: [...hits].filter(r => !drop.has(r)).map(r => 'published revision ' + veRevisionName(store, r) + ' (pinned by ' + pinners(r).join(', ') + ')') };
}
const veNavigationWhere = u => u.kind[0].toUpperCase() + u.kind.slice(1) + ' ' + u.name + ' / ' + u.interaction.label;
function veSurfacePlan(ids, d = design()) {
  const store = veStore(d), set = new Set(ids), test = id => set.has(id), revisions = veRevisionPlan(store, test);
  const uses = [...store.pages.filter(p => set.has(p.ownerId)).map(p => 'page design ' + p.name), ...veNavigations(store, test).filter(u => u.kind !== 'revision').map(u => 'interaction ' + u.interaction.label + ' in ' + u.kind + ' ' + u.name), ...revisions.pinned];
  return { uses, revisions: revisions.revisions };
}
function veSurfaceUses(ids, d = design()) { return veSurfacePlan(ids, d).uses; }
function veSurfaceBlock(ids, d = design()) {
  const uses = veSurfaceUses(ids, d);
  return uses.length ? 'In use by page and component designs: ' + uses.join('; ') + '. Delete those page designs and change those navigate actions first. No surface was removed.' : '';
}
function veSurfaceRevisionNote(ids, d = design()) {
  const store = veStore(d), { revisions } = veSurfacePlan(ids, d), one = revisions.length === 1;
  return revisions.length ? 'Also deletes ' + veCount(revisions.length, 'published revision') + ' that navigate' + (one ? 's' : '') + ' here and that nothing pins: ' + revisions.map(r => veRevisionName(store, r)).join(', ') + '. Undo restores ' + (one ? 'it' : 'them') + '.' : '';
}
// Part of a sitemap write that removes or replaces surfaces, after its history record: drops the unpinned published
// revisions that navigate to them. A blocked plan changes nothing.
function veRemoveSurfaceRevisions(d, ids) {
  if (!d.visualDesigns) return [];
  const plan = veSurfacePlan(ids, d), drop = new Set(plan.revisions);
  if (plan.uses.length || !drop.size) return [];
  d.visualDesigns.revisions = d.visualDesigns.revisions.filter(r => !drop.has(r));
  return plan.revisions.map(r => veRevisionName(d.visualDesigns, r));
}
function veReplaceNotice(d = design()) {
  const ids = d.nodes.map(n => n.id), block = veSurfaceBlock(ids, d);
  return block ? block.replace('No surface was removed.', 'The sitemap cannot be replaced until then.') : veSurfaceRevisionNote(ids, d);
}
// Orphans: page designs whose surface is gone (or can no longer hold a page), navigation to such surfaces and the
// published revisions that navigate there (deleted when unpinned, blocking when pinned).
function veOrphans(d = design()) {
  const store = veStore(d), surfaces = veContext(d).surfaces, missing = id => !surfaces.has(id), pages = store.pages.filter(p => missing(p.ownerId));
  const plan = veRevisionPlan(store, missing, new Set(pages));
  return { pages, links: veNavigations(store, missing).filter(u => u.kind !== 'revision' && !pages.includes(u.def)), revisions: plan.revisions, pinned: plan.pinned, missing };
}
function veOpenOrphans() {
  const { pages, links, revisions, pinned } = veOrphans();
  if (!pages.length && !links.length && !revisions.length && !pinned.length) throw Error('No design names a missing surface.');
  veUi.orphansForm = { error: '', token: smToken() }; showModal('ve-orphans');
}
const veEmptied = (u, missing) => u.interaction.actions.every(a => a.kind === 'navigate' && missing(a.surfaceId));
function veOrphansDialog() {
  const form = veUi.orphansForm, { pages, links, revisions, pinned, missing } = veOrphans(), store = veStore();
  const lines = [...pages.map(p => 'Delete the page design ' + p.name + ' (' + veCount(visualNodes(p.root).length, 'element') + ').'),
    ...revisions.map(r => 'Delete the published revision ' + veRevisionName(store, r) + ': it navigates to a missing surface and nothing pins it.'),
    ...links.map(u => 'Remove navigation to a missing surface from ' + veNavigationWhere(u) + (veEmptied(u, missing) ? '; that interaction then has no actions and becomes an implementation TODO.' : '.'))];
  const blocked = pinned.length ? `<p class="ve-refusal" role="alert">${esc('Published revisions are never edited, and these are pinned: ' + pinned.join('; ') + '. Restore the missing surface (Undo, or import a corrected project) to repair them.')}</p>` : '';
  const body = `<p id="ve-orphans-error" class="error" role="alert" tabindex="-1">${esc(form?.error || '')}</p><p>These designs name a sitemap surface that no longer exists. Until they are removed or the surface is restored, page and component edits, export and generation are refused.</p>${blocked}<ul class="ve-usages">${lines.map(line => `<li>${esc(line)}</li>`).join('')}</ul><p class="ve-pane-note">Other actions of those interactions are kept. Undo restores everything.</p>`;
  return dialogBody('Remove designs that name missing surfaces?', body, button('Cancel', 'close', '', 'ghost') + button('Remove', 've-orphans-confirm', '', 'danger', 'trash', lines.length && !pinned.length ? 'autofocus' : 'disabled'));
}
const veJoin = parts => (parts.length > 2 ? parts.slice(0, -1).join(', ') + ' and ' + parts.at(-1) : parts.join(' and '));
function veOrphansConfirm() {
  const form = veUi.orphansForm;
  if (!form) throw Error('Open the missing-surface review again.');
  const { pinned } = veOrphans();
  if (pinned.length) throw Error('Published revisions are never edited, and these are pinned: ' + pinned.join('; ') + '. Nothing was removed.');
  let pages = 0, links = 0, revisions = 0, todos = 0;
  veCommit((store, candidate) => {
    const surfaces = veContext(candidate).surfaces, missing = id => !surfaces.has(id), gone = new Set(store.pages.filter(p => missing(p.ownerId)));
    const drop = new Set(veRevisionPlan(store, missing, gone).revisions);
    pages = gone.size; store.pages = store.pages.filter(p => !gone.has(p));
    revisions = drop.size; store.revisions = store.revisions.filter(r => !drop.has(r));
    for (const u of veNavigations(store, missing)) { u.interaction.actions = u.interaction.actions.filter(a => a.kind !== 'navigate' || !missing(a.surfaceId)); links++; if (!u.interaction.actions.length) todos++; }
  }, form.token);
  veUi.orphansForm = null; closeModal(); veRepair(); render();
  const parts = [veCount(pages, 'page design'), veCount(links, 'navigation'), ...(revisions ? [veCount(revisions, 'published revision')] : [])];
  notify('Removed ' + veJoin(parts) + ' to missing surfaces.' + (todos ? ' ' + veCount(todos, 'interaction') + (todos === 1 ? ' now has no actions and is an implementation TODO.' : ' now have no actions and are implementation TODOs.') : '') + ' Undo is available.');
}
const VE_STRUCTURE_ACTIONS = {
  've-delete': veOpenDelete, 've-delete-confirm': veDeleteConfirm, 've-reparent': veOpenReparent, 've-reparent-confirm': veReparentConfirm,
  've-orphans': veOpenOrphans, 've-orphans-confirm': veOrphansConfirm,
};
