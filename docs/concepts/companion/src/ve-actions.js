// Visual editor action and field dispatch. Session changes (selection, panes, modes) touch veUi only; every design write
// goes through veCommit. Failures land in veUi.error and the visible alert region, never as a thrown exception.
function veErrorText(error) { return String(error instanceof Error ? error.message : error).replace(/^VISUAL_INVALID: /, ''); }
function veFail(error) {
  const text = veErrorText(error);
  if (modalType === 've-save-layout' && document.getElementById('modal').open && veUi.layoutForm) {
    veUi.layoutForm.error = text; redrawModal(); document.getElementById('ve-layout-error')?.focus(); return;
  }
  veUi.error = text;
  const output = document.getElementById('ve-error');
  if (output) output.textContent = text;
  notify(text);
}
function vePageRef() {
  const page = veCurrentPage();
  if (!page) throw Error('Start a page design first.');
  return { kind: 'page', id: page.id };
}
// Write to the open page, then select what the change returns (only after the write succeeded).
function vePageWrite(change, done = () => {}) {
  const ref = vePageRef();
  let selected;
  veCommit(store => { selected = change(store, ref); });
  if (typeof selected === 'string') veUi.selected = selected;
  veUi.error = ''; veUi.more = false; done(); render();
}
function veOpenPage(surfaceId) {
  const surface = design().nodes.find(n => n.id === surfaceId);
  if (!surface && !veStore().pages.some(p => p.ownerId === surfaceId)) throw Error('That surface no longer exists.');
  if (state.view === 'page-editor' && veUi.owner === surfaceId) return;
  if (state.view !== 'page-editor') veUi.back = [...veUi.back, { view: state.view, scroll: document.getElementById('content').scrollTop }].slice(-12);
  Object.assign(veUi, { owner: surfaceId, selected: null, scenario: null, mode: 'design', query: '', left: 'outline', pane: 'canvas', after: false, more: false, error: '' });
  if (state.view === 'page-editor') render(); else setView('page-editor');
}
function veBack() {
  const back = veUi.back.at(-1);
  veUi.back = veUi.back.slice(0, -1); veUi.error = '';
  setView(back?.view || 'pages');
  if (back) document.getElementById('content').scrollTop = back.scroll;
}
function veStartPage(surfaceId) {
  const surface = design().nodes.find(n => n.id === surfaceId);
  if (!surface || !['page', 'modal', 'settings'].includes(surface.kind)) throw Error('Choose a page, modal or settings surface.');
  veCommit(store => { visualCreatePage(store, { ownerId: surface.id, name: surface.label }); });
  veUi.owner = surface.id; veUi.left = 'insert'; veUi.error = ''; render();
  notify('Page design started. The sitemap is unchanged.');
}
function veSelect(nodeId) {
  const page = veCurrentPage();
  if (!page || !visualLocate(page.root, nodeId)) throw Error('That element no longer exists.');
  veUi.selected = nodeId; veUi.more = false; veUi.after = false; render();
}
// Insert and layout application share the insert target rule; the first new node becomes the selection.
function veInsertValue(nodesFor) {
  const after = veUi.after;
  vePageWrite((store, ref) => {
    const page = visualDefinition(store, ref), nodes = nodesFor(store);
    visualInsert(store, ref, veInsertTarget(page, veUi.selected, after), nodes);
    return nodes[0]?.id;
  }, () => { veUi.after = false; veUi.left = 'outline'; });
}
function veMove(value) {
  const [direction, id = veUi.selected] = value.split(':');
  if (!['earlier', 'later'].includes(direction)) throw Error('Choose whether to move the element earlier or later.');
  if (!id) throw Error('Select an element to move.');
  vePageWrite((store, ref) => { visualMoveNode(store, ref, id, direction); return id; });
}
function veSelectedId() { if (!veUi.selected) throw Error('Select an element first.'); return veUi.selected; }
function veOpenSaveLayout(scope) {
  if (!veCurrentPage()) throw Error('Start a page design first.');
  veUi.layoutForm = veLayoutFormFor(scope); veUi.more = false;
  showModal('ve-save-layout');
}
const VE_SESSION_ACTIONS = {
  've-left': value => { veUi.left = VE_LEFT_PANES.some(([id]) => id === value) ? value : 'outline'; },
  've-pane': value => { veUi.pane = ['left', 'canvas', 'inspector'].includes(value) ? value : 'canvas'; },
  've-mode': value => { veUi.mode = VE_EDITOR_MODES.some(([id]) => id === value) ? value : 'design'; veUi.more = false; },
  've-viewport': value => { veUi.viewport = VE_VIEWPORTS.includes(value) ? value : 'desktop'; },
  've-insert-tab': value => { veUi.insertTab = VE_INSERT_TABS.some(([id]) => id === value) ? value : 'patterns'; },
  've-insert-after': () => { veSelectedId(); veUi.after = true; veUi.left = 'insert'; veUi.pane = 'left'; },
  've-bind': () => { veSelectedId(); veUi.inspector = 'data'; veUi.pane = 'inspector'; },
  've-interaction': () => { veSelectedId(); veUi.inspector = 'actions'; veUi.pane = 'inspector'; },
  've-more': () => { veUi.more = !veUi.more; },
};
const VE_ACTIONS = {
  've-open-page': veOpenPage, 'dt-page': veOpenPage, 've-back': veBack, 've-start-page': veStartPage, 've-select': veSelect,
  've-insert': value => veInsertValue(store => veInsertNodes(store, value)),
  've-apply-layout': value => veInsertValue(store => visualInstantiateLayout(store, value)),
  've-move': veMove,
  've-duplicate': () => { const id = veSelectedId(); vePageWrite((store, ref) => visualDuplicateNode(store, ref, id).id); },
  've-wrap': () => { const id = veSelectedId(); vePageWrite((store, ref) => visualWrapNode(store, ref, id).id); },
  've-save-layout': veOpenSaveLayout, 've-save-layout-confirm': veSaveLayout,
};
function handleVisualAction(action, value) {
  const session = VE_SESSION_ACTIONS[action], write = VE_ACTIONS[action];
  if (!Object.hasOwn(VE_SESSION_ACTIONS, action) && !Object.hasOwn(VE_ACTIONS, action)) return false;
  try {
    if (session) { session(value); veUi.error = ''; render(); } else write(value);
  } catch (error) { veFail(error); }
  return true;
}
// Search fields re-render only their own results so typing keeps focus; the scenario and page switcher re-render.
function veFieldEdit(el) {
  const field = el.dataset.field;
  if (!field?.startsWith('ve-')) return false;
  try {
    if (veSaveLayoutField(el)) return true;
    if (field === 've-page-search') { veUi.pageQuery = el.value; document.getElementById('ve-pages-results').innerHTML = vePageCards(); return true; }
    if (field === 've-outline-search') { veUi.query = el.value; const page = veCurrentPage(); if (page) document.getElementById('ve-outline').innerHTML = veOutlineHtml(page); return true; }
    if (field === 've-insert-search') { veUi.insertQuery = el.value; document.getElementById('ve-insert-results').innerHTML = veInsertResults('page'); return true; }
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
