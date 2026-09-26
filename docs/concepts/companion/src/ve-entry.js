// Editor entry points, the Back stack, palette commands and the editor keyboard. Opening never writes; Back restores the
// origin view with its own selection (storymap item, sitemap surface, library component or the previous editor).
function vePageEligible(node) { return !!node && ['page', 'modal', 'settings'].includes(node.kind); }
function veEditorOpen() { return ['page-editor', 'component-editor'].includes(state.view); }
// A Back entry remembers the view, the page or component it showed, the origin's selection and the control that opened
// the editor, so focus can return to it.
function veBackEntry() {
  const entry = { view: state.view, scroll: document.getElementById('content').scrollTop, owner: veUi.owner, library: veUi.library, selected: veUi.selected, focus: uiFocusRecord(document.activeElement) };
  if (state.view === 'storymaps') Object.assign(entry, { map: smUi.map, item: smUi.item });
  if (state.view === 'sitemap') Object.assign(entry, { surface: designUi.selected, inspector: canvasUi.inspector });
  if (state.view === 'components') entry.component = productUi.component;
  return entry;
}
function vePushBack() { veUi.back = [...veUi.back, veBackEntry()].slice(-12); }
// Only selections that still exist are restored; a removed map, surface or component falls back to the view's default.
function veRestoreOrigin(back, d = design()) {
  if (back.view === 'storymaps' && back.map && smFind(smStore(), back.map)) Object.assign(smUi, { map: back.map, item: back.item ?? null });
  if (back.view === 'sitemap' && d.nodes.some(n => n.id === back.surface)) { designUi.selected = back.surface; canvasUi.inspector = back.inspector || canvasUi.inspector; }
  if (back.view === 'components' && d.library.some(l => l.id === back.component)) productUi.component = back.component;
}
function veBack() {
  const back = veUi.back.at(-1);
  veUi.back = veUi.back.slice(0, -1); veUi.error = '';
  if (back) {
    Object.assign(veUi, { owner: back.owner ?? veUi.owner, library: back.library ?? veUi.library, selected: back.selected ?? null, slotTarget: null, mode: 'design', more: false, after: false });
    veRestoreOrigin(back);
  }
  setView(back?.view || (veInComponent() ? 'components' : 'pages'));
  if (!back) return;
  document.getElementById('content').scrollTop = back.scroll;
  if (!focusUiControl(back.focus) && back.view === 'storymaps' && smUi.item) smFocusItem();
}
function veOpenPage(surfaceId) {
  const surface = design().nodes.find(n => n.id === surfaceId);
  if (!surface && !veStore().pages.some(p => p.ownerId === surfaceId)) throw Error('That surface no longer exists.');
  if (state.view === 'page-editor' && veUi.owner === surfaceId) return;
  if (state.view !== 'page-editor') vePushBack();
  Object.assign(veUi, { owner: surfaceId, selected: null, scenario: null, mode: 'design', query: '', left: 'outline', pane: 'canvas', after: false, more: false, error: '' });
  if (state.view === 'page-editor') render(); else setView('page-editor');
}
// Component library "Used in" list: the page and component designs that place this library component.
function veLibraryUses(libraryId, d = design()) {
  const store = veStore(d), component = store.components.find(c => c.libraryId === libraryId);
  if (!component) return [];
  return visualUsages(store, component.id).filter(u => u.kind !== 'layout' && u.definitionId !== component.id).map(u => {
    const definition = visualDefinition(store, { kind: u.kind, id: u.definitionId });
    return u.kind === 'page' ? { label: 'Page ' + definition.name, action: 've-open-page', value: definition.ownerId } : { label: 'Component ' + definition.exportName, action: 've-open-component', value: definition.libraryId };
  });
}
function veLibraryUsesHtml(libraryId) {
  const uses = veLibraryUses(libraryId);
  if (!uses.length) return '';
  return `<div class="card mb16"><h3>Used in page and component designs (${uses.length})</h3>${uses.map(u => button(u.label, u.action, u.value, 'small ghost')).join('')}</div>`;
}
// Palette rows [action, value, title, description, icon] while an editor shows a design; none otherwise.
function vePaletteRows() {
  if (!veEditorOpen() || !project() || !veCurrentDef()) return [];
  const page = !veInComponent(), selected = !!veUi.selected, rows = [
    ['ve-insert', 'nuxt:u-table', 'Insert data table', 'Nuxt UI table where Insert would place it', 'list'],
    ['ve-insert', 'nuxt:u-form', 'Insert form', 'Nuxt UI form where Insert would place it', 'list'],
    ['ve-insert', 'nuxt:u-modal', 'Insert modal', 'Nuxt UI modal where Insert would place it', 'list'],
  ];
  if (page) rows.push(['ve-save-layout', 'page', 'Save page as layout', 'Reuse this page structure as a saved layout', 'layers'], ['ve-left', 'layouts', 'Apply layout…', 'Choose a built-in or saved layout', 'grid']);
  rows.push(['ve-mode', 'preview', page ? 'Preview page' : 'Preview component', 'Read-only preview in the chosen scenario or state', 'search']);
  if (design().history.length) rows.push(['ve-undo', '', 'Undo design change', 'Step back in the shared design history', 'refresh']);
  if (design().future.length) rows.push(['ve-redo', '', 'Redo design change', 'Reapply the change that was undone', 'refresh']);
  if (selected) rows.push(['ve-duplicate', '', 'Duplicate selected', 'Copy the selected element right after it', 'copy']);
  if (selected && page) rows.push(['ve-bind', '', 'Bind data…', 'Bind the selected element to a data source', 'layers'], ['ve-interaction', '', 'Add interaction…', 'Declare what the selected element does', 'spark']);
  return rows;
}
// Outline order (search-filtered on the outline): the element an arrow key moves to from `id`.
function veOutlineStep(definition, id, key, query = '') {
  const shown = veOutlineMatches(definition, query), order = [], parents = new Map();
  visualWalk(visualRoot(definition), (node, at) => { if (shown.has(node.id)) { order.push(node.id); parents.set(node.id, at.parent?.id ?? null); } });
  const at = order.indexOf(id);
  if (!order.length) return null;
  if (at < 0 || key === 'Home') return order[0];
  if (key === 'End') return order.at(-1);
  if (key === 'ArrowDown') return order[Math.min(at + 1, order.length - 1)];
  if (key === 'ArrowUp') return order[Math.max(at - 1, 0)];
  if (key === 'ArrowLeft') return parents.get(id) ?? id;
  if (key === 'ArrowRight') return order.find(other => parents.get(other) === id) ?? id;
  return id;
}
// Keyboard → [action, value]. `where` is 'outline' or 'canvas' when focus is on an outline item or a canvas element,
// `from` the element that item shows (arrows start there, so the first press moves even before anything is selected).
function veKeyCommand(event, where, from = '') {
  // Letter shortcuts follow the typed character; a non-Latin layout falls back to the physical key (KeyZ/KeyY/KeyD).
  const letter = /^[a-z]$/i.test(event.key) ? event.key.toLowerCase() : /^Key[A-Z]$/.test(event.code || '') ? event.code.slice(3).toLowerCase() : '';
  const key = letter || (event.key.length === 1 ? event.key.toLowerCase() : event.key), mod = event.ctrlKey || event.metaKey;
  if (mod && !event.altKey && key === 'z') return [event.shiftKey ? 've-redo' : 've-undo', ''];
  if (mod && !event.altKey && !event.shiftKey && key === 'y') return ['ve-redo', ''];
  if (mod && !event.altKey && !event.shiftKey && key === 'd') return veUi.selected ? ['ve-duplicate', ''] : null;
  if (mod || event.shiftKey) return null;
  if (event.altKey) return veUi.selected && ['ArrowUp', 'ArrowDown'].includes(key) ? ['ve-move', key === 'ArrowUp' ? 'earlier' : 'later'] : null;
  if (key === 'Delete' || key === 'Backspace') return veUi.selected ? ['ve-delete', ''] : null;
  if (key === 'Escape') return veUi.selected ? ['ve-clear-selection', ''] : null;
  if (where && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return ['ve-step', [where, key, from].join(':')];
  return null;
}
function veFocusNode(id, where = 'outline') {
  if (!id) return false;
  const safe = CSS.escape(id), el = document.querySelector(where === 'canvas' ? `.ve-canvas-area [data-ve-node="${safe}"][data-action]` : `#ve-outline [role="treeitem"][data-value="${safe}"]`);
  el?.focus();
  return !!el;
}
// Arrow keys select in outline order; focus follows the selection (roving tabindex on the outline tree).
function veStep(value) {
  const [where, key, from] = value.split(':'), definition = veCurrentDef();
  if (!definition) return;
  const start = from && visualLocate(visualRoot(definition), from) ? from : veUi.selected;
  const next = veOutlineStep(definition, start, key, where === 'outline' ? veUi.query || '' : '');
  if (next && next !== veUi.selected) veSelect(next);
  veFocusNode(next ?? veUi.selected, where);
}
// Undo/Redo travel the one design history; like every other write they are refused in Preview.
function veHistory(direction) {
  veEditable();
  if (!veTravel(direction)) notify('Nothing to ' + direction + ' in the design history.');
}
// One listener for both editors, scoped to the editor root. Text fields keep their own keys (native text undo).
function veEditorKeydown(event) {
  const target = event.target;
  if (!(target instanceof Element) || !veEditorOpen() || event.isComposing || document.querySelector('dialog[open]')) return;
  if (!target.closest('.ve-page-editor') || target.closest('input,textarea,select') || target.isContentEditable) return;
  const item = target.closest('#ve-outline [role="treeitem"]'), node = item ? null : target.closest('.ve-canvas-area [data-ve-node]');
  const where = item ? 'outline' : node ? 'canvas' : null, command = veKeyCommand(event, where, item?.dataset.value || node?.dataset.veNode || '');
  if (!command) return;
  event.preventDefault(); event.stopPropagation();
  if (event.repeat && command[0] !== 've-step') return;
  const before = veUi.selected;
  handleVisualAction(command[0], command[1]);
  // Focus follows a selection the command changed (duplicate, undo), or one whose focused item was redrawn away.
  const active = document.activeElement;
  if (!document.querySelector('dialog[open]') && veUi.selected && (veUi.selected !== before || !active?.isConnected || active === document.body)) veFocusNode(veUi.selected, where || 'outline');
}
document.addEventListener('keydown', veEditorKeydown);
const VE_ENTRY_SESSION_ACTIONS = {
  've-clear-selection': () => { Object.assign(veUi, { selected: null, slotTarget: null, after: false, more: false }); },
};
const VE_ENTRY_ACTIONS = {
  've-open-page': veOpenPage, 'dt-page': veOpenPage, 've-back': veBack, 've-step': veStep,
  've-undo': () => veHistory('undo'), 've-redo': () => veHistory('redo'),
};
