// Visual editor session state and the one guarded write path for design.visualDesigns.
// veUi is presentation state only: it never enters project JSON, history snapshots or exports.
const VE_UPGRADE_NOTICE = 'This project was upgraded to the new page and component editors. Earlier undo history was cleared.';
function veDefaults() {
  return { ref: null, selected: null, left: 'outline', mode: 'design', inspector: 'essentials', scenario: null, viewport: 'desktop', query: '', back: [], palette: false, error: '', notice: '' };
}
const veUi = veDefaults();
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
// A design carries either legacy detail designs or visual designs, never both.
function veShape(d) {
  if (d.visualDesigns === undefined) return true;
  if (d.detailDesigns !== undefined) return false;
  try { validateVisualDesigns(d.visualDesigns); return true; } catch { return false; }
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
function veCommit(change, token = smToken()) {
  veCanWrite(token);
  const previous = design(), candidate = designCopy(previous), before = veStore(previous), store = designCopy(before);
  if (previous.detailDesigns) throw Error('This project still holds legacy detail designs. Reload to upgrade them first. Nothing was saved.');
  change(store);
  const semantic = JSON.stringify(before) !== JSON.stringify(store);
  if (!semantic) return true;
  validateVisualDesigns(store, veContext(candidate));
  candidate.visualDesigns = store; candidate.schema = COMPANION_VERSION;
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
// Undo/redo shares the one design history with every other editor; failed persistence restores the previous design.
function veTravel(direction) {
  veCanWrite();
  const d = design(), source = direction === 'undo' ? d.history : d.future;
  if (!source.length) return false;
  const previous = designCopy(d);
  designHistory(direction);
  if (storageWarning) { project().design = previous; render(); throw Error('History could not be saved. The previous design is retained; export recovery before closing.'); }
  if (veRepair()) render();
  return true;
}
// Legacy detail designs become visual designs. Geometry is not replayable, so the migrated report is returned.
function veUpgradeDesign(d) {
  const { visualDesigns, report } = migrateDetailDesigns(d.detailDesigns, d);
  validateVisualDesigns(visualDesigns);
  d.visualDesigns = visualDesigns; delete d.detailDesigns; d.schema = COMPANION_VERSION;
  return report;
}
// Saved browser state: migrate the current design in place and clear legacy undo snapshots (spec 11.9).
function veMigrateSaved(d) {
  const report = veUpgradeDesign(d);
  d.history = []; d.future = [];
  veUi.notice = VE_UPGRADE_NOTICE;
  return report;
}
function veMigrationSummary(report) {
  if (!report) return 'No migration was needed.';
  const parts = [], count = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);
  if (report.droppedPositions) parts.push(count(report.droppedPositions, 'canvas position') + ' dropped');
  if (report.droppedSizes) parts.push(count(report.droppedSizes, 'canvas size') + ' dropped');
  if (report.droppedOutlineRefs) parts.push(count(report.droppedOutlineRefs, 'outline reference') + ' dropped');
  if (report.unparsedMembers.length) parts.push(count(report.unparsedMembers.length, 'member') + ' could not be typed and kept their text as a description');
  if (report.droppedProps.length) parts.push(count(report.droppedProps.length, 'property value') + ' dropped');
  if (report.droppedSlotRules) parts.push(count(report.droppedSlotRules, 'slot rule') + ' dropped');
  if (report.listBindings) parts.push(count(report.listBindings, 'list binding') + ' no longer repeat');
  if (report.droppedFallbackBindings) parts.push(count(report.droppedFallbackBindings, 'shadowed binding') + ' dropped');
  if (report.droppedInteractions) parts.push(count(report.droppedInteractions, 'interaction') + ' from text or slot elements dropped');
  if (report.truncatedNotes) parts.push(count(report.truncatedNotes, 'note') + ' truncated');
  if (report.createdComponents.length) parts.push(count(report.createdComponents.length, 'component definition') + ' created from the library');
  return parts.length ? parts.join('; ') + '.' : 'Migrated without loss.';
}
// Startup restore: a legacy saved project and a saved preparation outline are upgraded once, then persisted.
// A design that cannot be upgraded is kept unchanged and reported; nothing is overwritten.
function veRestoreSaved() {
  const p = state.project, w = state.wizard;
  let changed = false;
  if (p?.design?.detailDesigns) {
    const candidate = designCopy(p.design);
    try {
      veMigrateSaved(candidate);
      if (!validSavedDesign(candidate)) throw Error('The upgraded design did not pass validation.');
      p.design = candidate; changed = true;
    } catch (error) {
      veUi.notice = '';
      veUi.error = 'This project could not be upgraded to the new page and component editors and is kept unchanged. ' + (error instanceof Error ? error.message : '') + ' Export recovery before editing.';
      notify(veUi.error); return false;
    }
  }
  if (w?.design?.detailDesigns) {
    // The preparation outline is a disposable copy of the project design; it is refreshed when the wizard reopens.
    try { const copy = designCopy(w.design); veUpgradeDesign(copy); copy.history = []; copy.future = []; if (!validSavedDesign(copy)) throw Error('Invalid outline'); w.design = copy; }
    catch { delete w.design; }
    changed = true;
  }
  if (!changed) return false;
  saveConceptState();
  if (veUi.notice) notify(veUi.notice);
  return true;
}
