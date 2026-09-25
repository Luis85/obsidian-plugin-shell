// All writes are guarded, validated and persisted once. Vue Flow owns only a projection.
const dtUi = { kind: 'page', ownerId: null, selected: null, edge: null, mode: 'canvas', previewState: 'default', width: 'wide', back: [], form: null, error: '', app: null, api: null, root: null, serial: 0, drag: null, viewports: {}, query: '', pageQuery: '' };
function dtDocument() { return project() ? dtFind(dtStore(), dtUi.kind, dtUi.ownerId) : null; }
function dtReset() { dtUi.ownerId = null; dtUi.selected = null; dtUi.edge = null; dtUi.back = []; dtUi.form = null; dtUi.viewports = {}; dtUi.query = ''; dtUi.pageQuery = ''; }
function dtFail(error) {
  dtUi.error = error instanceof Error ? error.message : error;
  if (modalType === 'detail-form' && document.getElementById('modal').open) { redrawModal(); document.getElementById('dt-form-error')?.focus(); }
  else { const output = document.getElementById('dt-page-error'); if (output) output.textContent = dtUi.error; notify(dtUi.error); }
  return false;
}
function dtCanWrite(token = smToken()) {
  if (state.activeRun || tdUi.busy) throw Error('Finish or cancel the current operation before changing a detail design.');
  if (token !== smToken()) throw Error('The project changed during this edit. Your draft is retained. Reopen the current element before applying.');
  if (storageWarning || localStorage.getItem(STORAGE_KEY) !== persistenceSnapshot) throw Error('Resolve the storage conflict first. No detail design was changed. Export recovery before closing.');
}
function dtCommit(change, token = smToken()) {
  dtCanWrite(token);
  const previous = design(), candidate = dtCopy(previous), store = dtCopy(dtStore(previous)), before = JSON.stringify(store);
  cpUpgradeStore(store); change(store); cpRetainRevisions(store, dtStore(previous)); validateDetailDesigns(store); cpValidateLinks(store,previous);
  if (before === JSON.stringify(store)) return true;
  const semantic = JSON.stringify(dtSemantic(dtStore(previous))) !== JSON.stringify(dtSemantic(store));
  candidate.schema = store.schema === 2 ? 4 : 3; candidate.detailDesigns = store;
  candidate.revision = previous.revision + (semantic ? 1 : 0);
  candidate.history = [...previous.history, designSnapshot(previous)].slice(-DESIGN_LIMITS.history); candidate.future = []; cpBoundHistory(candidate);
  if (!validSavedDesign(candidate)) throw Error('This change would create an invalid project. Nothing was saved.');
  project().design = candidate;
  if (!saveConceptState()) { project().design = previous; throw Error('The change could not be saved. Previous data and history are retained; export recovery before closing.'); }
  if (semantic) designUi.plan = null; dtUi.error = ''; return true;
}
function dtTravel(direction) {
  dtCanWrite();
  const previous = design(), candidate = dtCopy(previous), source = direction === 'undo' ? candidate.history : candidate.future;
  if (!source.length) return;
  const other = direction === 'undo' ? candidate.future : candidate.history;
  other.push(designSnapshot(previous)); if (other.length > DESIGN_LIMITS.history) other.shift();
  const snapshot = source.pop(); Object.assign(candidate, snapshot);
  for (const key of ['canvas', 'librarySchema', 'designSystem', 'detailDesigns']) if (!Object.hasOwn(snapshot, key)) delete candidate[key];
  if(previous.detailDesigns && !candidate.detailDesigns) candidate.detailDesigns=emptyDetailDesigns();
  candidate.semantic = snapshot.semantic || emptySemantic(); candidate.dataSources = snapshot.dataSources || emptyDataSources();
  candidate.storymaps = dtCopy(snapshot.storymaps || emptyStorymaps());
  for (const key of ['semantic', 'dataSources', 'storymaps', 'detailDesigns']) if (candidate[key]) candidate[key].nextId = Math.max(candidate[key].nextId, previous[key]?.nextId || 1);
  candidate.nextId = Math.max(previous.nextId, candidate.nextId); cpRetainRevisions(candidate.detailDesigns, previous.detailDesigns); candidate.schema = candidate.detailDesigns?.schema === 2 ? 4 : 3;
  const semantic = JSON.stringify(generationSnapshot(candidate)) !== JSON.stringify(generationSnapshot(previous));
  candidate.revision = previous.revision + (semantic ? 1 : 0);
  if (!validSavedDesign(candidate)) throw Error('That history entry cannot be restored safely.');
  project().design = candidate;
  if (!saveConceptState()) { project().design = previous; throw Error('History could not be saved. The previous design is retained.'); }
  if (semantic) designUi.plan = null; dtUi.selected = null; dtUi.edge = null; render(); notify('Design ' + direction + ' complete. External artifacts were not changed.');
}
function dtOpen(kind, ownerId) {
  const owner = kind === 'component' ? design().library.find(c => c.id === ownerId) : design().nodes.find(n => n.id === ownerId);
  const retained = dtFind(dtStore(), kind, ownerId);
  if (!retained && (!owner || kind === 'page' && !dtPageEligible(owner))) return dtFail('Choose a page, modal, settings surface or reusable component.');
  if (state.view === kind + '-editor' && dtUi.ownerId === ownerId) return;
  dtUi.back.push({ view: state.view, kind: dtUi.kind, ownerId: dtUi.ownerId, selected: dtUi.selected, edge: dtUi.edge, mode: dtUi.mode, query: dtUi.query, previewState: dtUi.previewState, width: dtUi.width, composition: { scenario: cpUi.scenario, compare: cpUi.compare, comparison:cpUi.comparison, variantA:cpUi.variantA,variantB:cpUi.variantB }, scroll: document.getElementById('content').scrollTop });
  if (dtUi.back.length > 12) dtUi.back.shift();
  cpUi.selection=[]; cpUi.session = null; cpUi.scenario = ''; cpUi.play = false;
  Object.assign(dtUi, { kind, ownerId, selected: null, edge: null, error: '', query: '', mode: innerWidth < 700 ? 'outline' : 'canvas' });
  setView(kind + '-editor');
}
function dtReturn() {
  const back = dtUi.back.pop(); if (!back) return setView(dtUi.kind === 'page' ? 'pages' : 'components');
  Object.assign(dtUi, { kind: back.kind, ownerId: back.ownerId, selected: back.selected, edge: back.edge, mode: back.mode, query: back.query, previewState: back.previewState, width: back.width, error: '' });
  Object.assign(cpUi, back.composition || {}, { session:null, play:false, selection:[] }); setView(back.view); document.getElementById('content').scrollTop = back.scroll;
}
function dtStart() {
  const owner = dtUi.kind === 'component' ? design().library.find(c => c.id === dtUi.ownerId) : design().nodes.find(n => n.id === dtUi.ownerId);
  if (!owner || dtUi.kind === 'page' && !dtPageEligible(owner)) throw Error('The owner no longer supports a detail design.');
  dtCommit(store => { const doc = dtNewDocument(store, dtUi.kind, owner), root = dtNewNode(store, 'region'); root.position = { x: 24, y: 24 }; root.label = dtUi.kind === 'page' ? 'Page content' : 'Component content'; doc.nodes.push(root); dtUi.selected = root.id; });
  render(); notify('Detail design created. The sitemap, storymap and library contract are unchanged.');
}
function dtUpdate(change) { const id = dtDocument()?.id; if (!id) throw Error('Start a detail design first.'); dtCommit(store => { const doc = store.documents.find(d => d.id === id); if (!doc) throw Error('The design no longer exists.'); change(store, doc); }); render(); }
function handleDetailAction(action, value) {
  if (handleCompositionAction(action, value)) return true;
  if (!action.startsWith('dt-')) return false;
  try {
    const actions = {
      'dt-page': () => dtOpen('page', value), 'dt-component': () => dtOpen('component', value), 'dt-back': dtReturn, 'dt-start': dtStart,
      'dt-mode': () => { dtUi.mode = value; cpUi.session = null; render(); }, 'dt-width': () => { dtUi.width = value; cpUi.session = null; render(); },
      'dt-state': () => { dtUi.previewState = value; cpUi.session = null; render(); }, 'dt-select': () => dtSelect(value),
      'dt-edit': () => dtBegin('node', value || dtUi.selected), 'dt-add': () => dtBegin('node', null, value),
      'dt-edge': () => dtBegin('edge', value || null), 'dt-connect': () => dtBegin('edge'), 'dt-notes': () => dtBegin('notes'),
      'dt-save': dtSave, 'dt-remove': () => { dtUi.form.removal = true; redrawModal(); }, 'dt-remove-confirm': dtRemove,
      'dt-duplicate': () => dtUpdate((store, doc) => { dtUi.selected = dtDuplicateNode(store, doc, dtUi.selected); }),
      'dt-order': () => dtUpdate((store, doc) => dtMoveInOrder(doc, dtUi.selected, Number(value))),
      'dt-undo': () => dtTravel('undo'), 'dt-redo': () => dtTravel('redo'),
      'dt-fit': () => dtUi.api?.fitView({ padding: .12, minZoom: .2, maxZoom: 1, duration: 0 }),
      'dt-locate': () => { if (dtUi.selected) dtUi.api?.fitView({ nodes: [dtUi.selected], padding: .4, minZoom: .6, maxZoom: 1, duration: 0 }); },
      'dt-upgrade': dtReviewVersion, 'dt-prop-override': () => dtPropertyAction('override', value), 'dt-prop-reset': () => dtPropertyAction('reset', value),
      'dt-finding': () => dtJumpFinding(value), 'dt-use': () => dtOpenUse(value), 'dt-export-brief': dtExportBrief,
      'dt-review-state': () => { dtUi.mode = 'preview'; dtUi.previewState = value; cpUi.session = null; render(); }, 'dt-zoom': () => dtZoom(value)
    };
    if (Object.hasOwn(actions, action)) actions[action](); else return false;
  } catch (error) { dtFail(error); }
  return true;
}
