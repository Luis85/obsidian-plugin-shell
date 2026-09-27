// Visual editor action and field dispatch. Session changes (selection, panes, modes) touch veUi only; every design write
// goes through veCommit. Failures land in veUi.error and the visible alert region, never as a thrown exception.
function veFail(error) {
  const text = veErrorText(error);
  const dialog = document.getElementById('modal').open ? { 've-save-layout': [veUi.layoutForm, 've-layout-error'], 've-interaction': [veUi.interactionForm, 've-int-error'], 've-publish': [veUi.publishForm, 've-publish-error'], 've-external': [veUi.externalForm, 've-external-error'], 've-delete': [veUi.deleteForm, 've-delete-error'], 've-reparent': [veUi.reparentForm, 've-reparent-error'] }[modalType] : null;
  if (dialog?.[0]) { dialog[0].error = text; redrawModal(); document.getElementById(dialog[1])?.focus(); return; }
  veUi.error = text;
  const output = document.getElementById('ve-error');
  if (output) output.textContent = text;
  notify(text);
}
// The definition the open editor works on: the page in the page editor, the component in the component editor.
function veInComponent() { return state.view === 'component-editor'; }
function veCurrentDef(d = design()) { return veInComponent() ? veCurrentComponent(d) : veCurrentPage(d); }
function veEditorRef() {
  const definition = veCurrentDef();
  if (!definition) throw Error(veInComponent() ? 'Start a component design first.' : 'Start a page design first.');
  return { kind: veInComponent() ? 'component' : 'page', id: definition.id };
}
// Write to the open page or component, then select what the change returns (only after the write succeeded).
function veWrite(change, done = () => {}) {
  veEditable();
  const ref = veEditorRef();
  let selected;
  veCommit(store => { selected = change(store, ref); });
  if (typeof selected === 'string') veUi.selected = selected;
  veUi.error = ''; veUi.more = false; done(); render();
}
function veStartPage(surfaceId) {
  const surface = design().nodes.find(n => n.id === surfaceId);
  if (!surface || !['page', 'modal', 'settings'].includes(surface.kind)) throw Error('Choose a page, modal or settings surface.');
  veCommit(store => { visualCreatePage(store, { ownerId: surface.id, name: surface.label }); });
  veUi.owner = surface.id; veUi.left = 'insert'; veUi.error = ''; render();
  notify('Page design started. The sitemap is unchanged.');
}
function veSelect(nodeId) {
  const definition = veCurrentDef();
  if (!definition || !visualLocate(visualRoot(definition), nodeId)) throw Error('That element no longer exists.');
  veUi.selected = nodeId; veUi.more = false; veUi.after = false; veUi.slotTarget = null; render();
}
// Insert and layout application share the insert target rule; the first new node becomes the selection. A slot chosen
// with "Map slot content" (component editor) takes precedence until the insert succeeds.
function veTargetFor(definition) {
  const slot = veUi.slotTarget;
  return slot ? { parentId: slot.nodeId, slot: slot.slot } : veInsertTarget(definition, veUi.selected, veUi.after);
}
function veInsertValue(nodesFor) {
  veWrite((store, ref) => {
    const definition = visualDefinition(store, ref), nodes = nodesFor(store, ref);
    visualInsert(store, ref, veTargetFor(definition), nodes);
    return nodes[0]?.id;
  }, () => { veUi.after = false; veUi.slotTarget = null; veUi.left = 'outline'; });
}
function veMove(value) {
  const [direction, id = veUi.selected] = value.split(':');
  if (!['earlier', 'later'].includes(direction)) throw Error('Choose whether to move the element earlier or later.');
  if (!id) throw Error('Select an element to move.');
  veWrite((store, ref) => { visualMoveNode(store, ref, id, direction); return id; });
}
function veSelectedId() { if (!veUi.selected) throw Error('Select an element first.'); return veUi.selected; }
function veOpenSaveLayout(scope) {
  if (!veCurrentPage()) throw Error('Start a page design first.');
  veUi.layoutForm = veLayoutFormFor(scope); veUi.more = false;
  showModal('ve-save-layout');
}
const VE_SESSION_ACTIONS = {
  've-left': value => { veUi.left = VE_LEFT_PANES.some(([id]) => id === value) ? value : 'outline'; veUi.pane = 'left'; },
  've-pane': value => { veUi.pane = ['left', 'canvas', 'inspector'].includes(value) ? value : 'canvas'; },
  've-mode': value => { veUi.mode = (veInComponent() ? VE_COMPONENT_MODES : VE_EDITOR_MODES).some(([id]) => id === value) ? value : 'design'; veUi.more = false; },
  've-viewport': value => { veUi.viewport = VE_VIEWPORTS.includes(value) ? value : 'desktop'; },
  've-insert-tab': value => { const kind = veInComponent() ? 'component' : 'page'; veUi.insertTab = veInsertTabs(kind).some(([id]) => id === value) ? value : veInsertTabs(kind)[0][0]; },
  've-insert-after': () => { veSelectedId(); veUi.after = true; veUi.left = 'insert'; veUi.pane = 'left'; },
  've-bind': () => { veSelectedId(); veUi.inspector = 'data'; veUi.pane = 'inspector'; },
  've-interaction': () => { veSelectedId(); veUi.inspector = 'actions'; veUi.pane = 'inspector'; },
  've-more': () => { veUi.more = !veUi.more; },
  've-inspector': value => { veUi.inspector = VE_INSPECTOR_TABS.some(([id]) => id === value) ? value : 'essentials'; },
  've-advanced': () => { veUi.advanced = !veUi.advanced; },
  ...VE_COMPONENT_SESSION_ACTIONS, ...VE_ENTRY_SESSION_ACTIONS,
};
const VE_ACTIONS = {
  've-open-component': veOpenComponent, 've-start-page': veStartPage, 've-select': veSelect,
  've-insert': value => (value.startsWith('external:') ? veOpenExternal(value.slice(9)) : veInsertValue((store, ref) => veInsertNodes(store, value, ref))),
  've-apply-layout': value => veInsertValue(store => visualInstantiateLayout(store, value)),
  've-move': veMove,
  've-duplicate': () => { const id = veSelectedId(); veWrite((store, ref) => visualDuplicateNode(store, ref, id).id); },
  've-wrap': () => { const id = veSelectedId(); veWrite((store, ref) => visualWrapNode(store, ref, id).id); },
  've-save-layout': veOpenSaveLayout, 've-save-layout-confirm': veSaveLayout,
  've-health': () => showModal('ve-health'),
  ...VE_INTERACTION_ACTIONS, ...VE_COMPONENT_ACTIONS, ...VE_ENTRY_ACTIONS, ...VE_STRUCTURE_ACTIONS,
};
function handleVisualAction(action, value) {
  const session = VE_SESSION_ACTIONS[action], write = VE_ACTIONS[action];
  if (!Object.hasOwn(VE_SESSION_ACTIONS, action) && !Object.hasOwn(VE_ACTIONS, action)) return false;
  try {
    // A palette command closes the palette first, so focus returns to the control that opened it.
    if (modalType === 'palette' && document.getElementById('modal').open) closeModal();
    if (session) { session(value); veUi.error = ''; render(); } else write(value);
  } catch (error) { veFail(error); }
  return true;
}
// Search fields re-render only their own results so typing keeps focus; the scenario and page switcher re-render.
// Inspector text fields keep their draft while typing (commit false) and write on change; selects and checkboxes write at once.
function veFieldEdit(el, commit = el.type === 'checkbox' || el.tagName === 'SELECT', after = render) {
  const field = el.dataset.field;
  if (!field?.startsWith('ve-')) return false;
  try {
    if (veInteractionField(el) || veInspectorField(el, commit, after) || veComponentField(el, commit, after)) return true;
    if (veSaveLayoutField(el) || veComponentDialogField(el)) return true;
    if (field === 've-page-search') { veUi.pageQuery = el.value; document.getElementById('ve-pages-results').innerHTML = vePageCards(); return true; }
    if (field === 've-outline-search') { veUi.query = el.value; const definition = veCurrentDef(); if (definition) document.getElementById('ve-outline').innerHTML = veOutlineHtml(definition); return true; }
    if (field === 've-insert-search') { veUi.insertQuery = el.value; document.getElementById('ve-insert-results').innerHTML = veInsertResults(veInComponent() ? 'component' : 'page'); return true; }
    if (field === 've-scenario') {
      const scenario = veCurrentPage()?.scenarios.find(s => s.id === el.value) ?? null;
      veUi.scenario = scenario?.id ?? null;
      if (scenario?.width === 'narrow') veUi.viewport = 'mobile';
      render(); return true;
    }
    if (field === 've-page-switch') { veOpenPage(el.value); return true; }
  } catch (error) { veFail(error); return true; }
  return false;
}
// Outline items are list items, not buttons: Enter and Space select the focused one (arrow keys follow with the editor keyboard).
document.addEventListener('keydown', event => {
  const item = event.target;
  if (!(item instanceof Element) || item.getAttribute('role') !== 'treeitem' || !item.closest('#ve-outline') || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  handleVisualAction('ve-select', item.dataset.value || '');
});
// Inspector text fields write once, on change (blur or Enter); the shared input listener only keeps their draft.
// The write happens at once, but the redraw waits: a Tab first moves focus (restored after the redraw), and a pointer
// press that blurred the field must finish its click on the current DOM, so the click is not lost to a replaced target.
let vePointerDown = false;
function veRedrawAfterInput() {
  const redraw = () => setTimeout(render);
  if (!vePointerDown) { redraw(); return; }
  let done = false;
  const once = () => { if (!done) { done = true; redraw(); } };
  document.addEventListener('pointerup', once, { once: true, capture: true });
  document.addEventListener('pointercancel', once, { once: true, capture: true });
}
document.addEventListener('pointerdown', () => { vePointerDown = true; }, true);
document.addEventListener('pointerup', () => { vePointerDown = false; }, true);
document.addEventListener('pointercancel', () => { vePointerDown = false; }, true);
document.addEventListener('change', event => {
  const el = event.target;
  if (el instanceof Element && [...VE_INSPECTOR_FIELDS, ...VE_COMPONENT_FIELDS].includes(el.dataset.field) && el.type !== 'checkbox' && el.tagName !== 'SELECT') veFieldEdit(el, true, veRedrawAfterInput);
});
