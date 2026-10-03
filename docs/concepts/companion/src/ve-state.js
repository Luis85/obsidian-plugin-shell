// Visual editor session state and the one guarded write path for design.visualDesigns.
// veUi is presentation state only: it never enters project JSON, history snapshots or exports.
function veDefaults() {
  return { ref: null, owner: null, selected: null, left: 'outline', pane: 'canvas', mode: 'design', inspector: 'essentials', scenario: null, viewport: 'desktop', query: '', pageQuery: '', insertTab: 'patterns', insertQuery: '', after: false, more: false, layoutForm: null, interactionForm: null, advanced: false, back: [], palette: false, error: '', notice: '',
    library: null, variant: '', state: 'default', contractTab: 'contract', apiTab: 'props', childTab: 'props', slotTarget: null, publishForm: null, externalForm: null, depForm: null, deleteForm: null, reparentForm: null, orphansForm: null, adapterEvents: {} };
}
const veUi = veDefaults();
function veErrorText(error) { return String(error instanceof Error ? error.message : error).replace(/^VISUAL_INVALID: /, ''); }
function veReset() { Object.assign(veUi, veDefaults()); }
function veStore(d = design()) { return d.visualDesigns ?? emptyVisualDesigns(); }
// The same reference context the generator enforces: navigable surfaces, library entries and declared source operations.
function veContext(d) {
  return {
    surfaces: new Set(d.nodes.filter(n => !['group', 'action'].includes(n.kind)).map(n => n.id)),
    library: new Set(d.library.map(c => c.id)),
    sources: new Map((d.dataSources?.sources || []).map(s => [s.id, new Set(s.operations.map(o => o.id))])),
  };
}
// Context-free shape gate used by structuralDesign for current designs and history snapshots.
function veShape(d) {
  try {
    if (d.visualDesigns !== undefined) validateVisualDesigns(d.visualDesigns);
    return true;
  } catch { return false; }
}
// Design checks: the generator's full validation with references.
function veIssues(d) {
  if (d.visualDesigns === undefined) return [];
  try { validateVisualDesigns(d.visualDesigns, veContext(d)); return []; }
  catch (error) { return [{ level: 'warning', code: 'visual-reference', message: 'Pages and components: ' + veErrorText(error), node: null }]; }
}
function veBoundHistory(candidate) {
  // Keep the complete current design. Trim only old undo entries before the storage cap.
  while (candidate.history.length && JSON.stringify(candidate).length > 3500000) candidate.history.shift();
  while (candidate.future.length && JSON.stringify(candidate).length > 3500000) candidate.future.shift();
}
function veCanWrite(token = smToken()) {
  if (state.activeRun || tdUi.busy) throw Error('Finish or cancel the current operation before changing a page or component design.');
  if (token !== smToken()) throw Error('The project changed during this edit. Your draft is retained. Reopen the current element before applying.');
  if (storageWarning || localStorage.getItem(STORAGE_KEY) !== persistenceSnapshot) throw Error('Resolve the storage conflict first. No page or component design was changed. Export recovery before closing.');
}
// Every visual authoring write: guards, copy, change, full validation, history snapshot, persistence or rollback.
// `change(store, candidate)` edits the copied visual store; a write that also needs a library entry adds it to the
// copied design, so both land (or roll back) together in one undo step.
function veCommit(change, token = smToken()) {
  veCanWrite(token);
  const previous = design(), candidate = designCopy(previous), before = veStore(previous), store = designCopy(before);
  change(store, candidate);
  const semantic = JSON.stringify(before) !== JSON.stringify(store);
  if (!semantic) return true;
  validateVisualDesigns(store, veContext(candidate));
  candidate.visualDesigns = store;
  candidate.revision = previous.revision + 1;
  candidate.history = [...previous.history, designSnapshot(previous)].slice(-DESIGN_LIMITS.history); candidate.future = []; veBoundHistory(candidate);
  if (!validSavedDesign(candidate)) throw Error('This change would create an invalid project. Nothing was saved.');
  project().design = candidate;
  if (!saveConceptState()) { project().design = previous; throw Error('The change could not be saved. Previous data and history are retained; export recovery before closing.'); }
  designUi.plan = null; veUi.error = ''; return true;
}
// Selection and definition references are session state; drop the ones a restored design no longer contains.
function veRepair() {
  if (!project()) return false;
  const store = veStore(), definition = veUi.ref ? visualDefinition(store, veUi.ref) : null;
  let changed = false;
  if (veUi.ref && !definition) { veUi.ref = null; changed = true; }
  if (veUi.selected && !(definition && visualLocate(visualRoot(definition), veUi.selected))) { veUi.selected = null; changed = true; }
  if (veUi.scenario && !definition?.scenarios?.some(s => s.id === veUi.scenario)) { veUi.scenario = null; changed = true; }
  return changed;
}
function veHasContent(store) { return !!store && ['pages', 'components', 'layouts', 'revisions'].some(key => store[key].length > 0); }
// Shared by every travel path over the one design history (outline, storymap and visual undo/redo).
// `candidate` already holds the snapshot's fields; the visual store is restored with a monotonic counter and
// validated with full references.
function veRestoreVisual(candidate, snapshot, previous) {
  const counter = previous.visualDesigns?.nextId || 1;
  try {
    if (snapshot.visualDesigns) candidate.visualDesigns = { ...designCopy(snapshot.visualDesigns), nextId: Math.max(snapshot.visualDesigns.nextId, counter) };
    else if (counter > 1) candidate.visualDesigns = { ...emptyVisualDesigns(), nextId: counter };
    else delete candidate.visualDesigns;
    if (candidate.visualDesigns) validateVisualDesigns(candidate.visualDesigns, veContext(candidate));
    return candidate;
  } catch (error) { throw Error('That history entry cannot be restored safely: ' + String(error instanceof Error ? error.message : error).replace(/^VISUAL_INVALID: /, '') + ' Nothing was changed.'); }
}
// Undo/redo shares the one design history with every other editor; a refused restore or failed save keeps the previous design.
function veTravel(direction) {
  veCanWrite();
  const previous = design();
  if (!(direction === 'undo' ? previous.history : previous.future).length) return false;
  designTravel(direction);
  if (storageWarning) { project().design = previous; render(); throw Error('History could not be saved. The previous design is retained; export recovery before closing.'); }
  if (veRepair()) render();
  return true;
}
