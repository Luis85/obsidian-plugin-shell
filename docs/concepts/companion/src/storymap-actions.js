// Concept adapter: one canonical project transaction, independent view state.
const smUi = { details: innerWidth > 1100, lastWidth: innerWidth, owner: null, map: null, item: null, mode: 'map', query: '', status: 'active', prdFilter: '',
  back: null, form: null, error: '', app: null, api: null, serial: 0, drag: null, viewports: {}, root: null };
function smCurrentMap() { return project() ? smFind(smStore(), smUi.map) : null; }
function smToken() { return JSON.stringify({ owner: designOwner(), revision: design().revision, design: designSnapshot(design()) }); }
function smFail(error) {
  smUi.error = error instanceof Error ? error.message : error;
  if (modalType === 'storymap-form' && document.getElementById('modal').open) { redrawModal(); document.getElementById('sm-form-error')?.focus(); }
  else { const el = document.getElementById('sm-page-error'); if (el) el.textContent = smUi.error; notify(smUi.error); }
  return false;
}
function smCanWrite(token = smToken()) {
  if (state.activeRun || tdUi.busy) throw Error('Finish or cancel the current operation before changing a storymap.');
  if (token !== smToken()) throw Error('The project changed during this edit. Your draft is retained. Reopen the current item before applying.');
  if (storageWarning || localStorage.getItem(STORAGE_KEY) !== persistenceSnapshot) throw Error('Resolve the storage conflict first. Export this session and the retained copy; no storymap was changed.');
}
function smPersistDesign(candidate, previous) {
  if (!validSavedDesign(candidate)) throw Error('The change would create an invalid project. Nothing was saved.');
  project().design = candidate;
  if (!saveConceptState()) { project().design = previous; throw Error('The change could not be saved. Previous data and history are retained; export recovery before closing.'); }
  designUi.plan = null; smUi.error = ''; return true;
}
function smCommit(change, token = smToken()) {
  smCanWrite(token);
  const previous = design(), candidate = smCopy(previous), store = smCopy(smStore(previous));
  const before = JSON.stringify(store); change(store);
  if (JSON.stringify(store) === before) return true;
  const now = new Date().toISOString();
  for (const map of store.maps) {
    const old = smFind(smStore(previous), map.id);
    if (old && JSON.stringify(map) !== JSON.stringify(old)) { map.revision = old.revision + 1; map.updatedAt = now; }
  }
  validateStorymaps(store); candidate.schema = 2; candidate.storymaps = store; candidate.revision++;
  candidate.history = [...previous.history, designSnapshot(previous)].slice(-DESIGN_LIMITS.history); candidate.future = [];
  return smPersistDesign(candidate, previous);
}
function smTravel(direction) {
  smCanWrite();
  const previous = design(), candidate = smCopy(previous), source = direction === 'undo' ? candidate.history : candidate.future;
  if (!source.length) return;
  const other = direction === 'undo' ? candidate.future : candidate.history;
  other.push(designSnapshot(previous)); if (other.length > DESIGN_LIMITS.history) other.shift();
  const snapshot = source.pop(); Object.assign(candidate, snapshot);
  for (const key of ['canvas', 'librarySchema', 'designSystem']) if (!Object.hasOwn(snapshot, key)) delete candidate[key];
  candidate.storymaps = smCopy(snapshot.storymaps || emptyStorymaps());
  candidate.storymaps.nextId = Math.max(candidate.storymaps.nextId, smStore(previous).nextId);
  candidate.semantic = snapshot.semantic || emptySemantic(); candidate.dataSources = snapshot.dataSources || emptyDataSources();
  candidate.semantic.nextId = Math.max(previous.semantic?.nextId || 1, candidate.semantic.nextId);
  candidate.dataSources.nextId = Math.max(previous.dataSources?.nextId || 1, candidate.dataSources.nextId);
  candidate.nextId = Math.max(previous.nextId, candidate.nextId); candidate.schema = 2; candidate.revision = previous.revision + 1;
  smPersistDesign(candidate, previous); render(); notify('Design ' + direction + ' complete. Source files and external artifacts were not deleted.');
}
function smNormalize() {
  if (smUi.owner !== designOwner()) { smUi.owner = designOwner(); smUi.map = null; smUi.item = null; smUi.back = null; smUi.viewports = {}; }
  const map = smCurrentMap(); if (!map) smUi.map = null;
  if (!smItem(map, smUi.item)) smUi.item = null;
}
function smOpen(id, origin = null, item = null) {
  smNormalize(); const map = smFind(smStore(), id); if (!map) return smFail('That storymap no longer exists.');
  if (origin) smUi.back = { view: origin, id: origin === 'prds' ? selectedPrd()?.id : designUi.selected, tab: productUi.tab, scroll: document.getElementById('content').scrollTop };
  smUi.map = id; smUi.item = item; smUi.mode = innerWidth < 700 ? 'outline' : smUi.mode; smUi.error = ''; setView('storymaps');
}
function smReturn() {
  const back = smUi.back; smUi.back = null;
  if (!back) { smUi.map = null; setView('storymaps'); return; }
  if (back.view === 'prds') { productUi.prd = back.id; productUi.tab = back.tab; }
  if (back.view === 'sitemap') selectSitemapItem('surface', back.id);
  setView(back.view); document.getElementById('content').scrollTop = back.scroll;
}
function smBegin(kind, id = null, parent = null, release = null, prdId = null) {
  try {
    smCanWrite(); const store = smCopy(smStore()), map = smCurrentMap(); let record;
    if (kind === 'map') {
      const existing = id ? smFind(store, id) : null; if (id && !existing) throw Error('That map no longer exists.');
      record = existing ? smCopy(existing) : smNewMap(store);
      const prd = prdId ? design().prds.find(p => p.id === prdId) : null;
      if (prdId && !prd) throw Error('That PRD no longer exists.');
      if (prd) { record.title = (prd.title + ' storymap').slice(0, 120); record.purpose = prd.goals.slice(0, 4000); record.audience = prd.audience.slice(0, 1000); record.prds = [{ id: prd.id, label: prd.title.slice(0, 160) }]; }
    } else {
      if (!map || map.status === 'archived') throw Error('Open an active map, or restore this archived map first.');
      const existing = id ? smItem(map, id) : null; if (id && existing?.kind !== kind) throw Error('That item no longer exists.');
      if (!id && kind === 'step' && !map.activities.some(a => a.id === parent)) throw Error('Add an activity first, then add a step to it.');
      if (!id && kind === 'story' && !map.steps.some(s => s.id === parent)) throw Error('Add a step first, then add a story to it.');
      record = existing ? smCopy(existing.record) : smNewItem(store, kind, parent, release);
    }
    smUi.form = { kind, id, mapId: map?.id || null, record, nextId: store.nextId, token: smToken(), removal: false, origin: prdId ? { view: 'prds', id: prdId, tab: productUi.tab, scroll: document.getElementById('content').scrollTop } : null };
    smUi.error = ''; showModal('storymap-form');
  } catch (error) { smFail(error); }
}
function smSave() {
  const f = smUi.form; if (!f) return;
  try {
    if (f.kind === 'move') {
      smCommit(store => { const map = smFind(store, f.mapId); if (!map || map.status === 'archived') throw Error('Open an active map first.'); smMove(map, f.id, f.record); }, f.token);
    } else if (f.kind === 'link-prd') {
      smCommit(store => {
        const prd = design().prds.find(p => p.id === f.record.id); if (!prd) throw Error('That PRD no longer exists.');
        if (!f.record.maps.every(id => smFind(store, id))) throw Error('A selected map no longer exists.');
        for (const map of store.maps) { const linked = map.prds.some(ref => ref.id === prd.id); if (!f.record.maps.includes(map.id)) map.prds = map.prds.filter(ref => ref.id !== prd.id); else if (!linked) map.prds.push({ id: prd.id, label: prd.title.slice(0, 160) }); }
      }, f.token);
    } else {
      smCommit(store => {
        const record = smCopy(f.record); record.title = record.title.trim();
        if (f.kind === 'map') {
          const index = store.maps.findIndex(m => m.id === f.id);
          if (f.id && index < 0) throw Error('That map no longer exists.');
          if (index < 0) store.maps.push(record); else store.maps[index] = record;
        } else {
          const map = smFind(store, f.mapId); if (!map || map.status === 'archived') throw Error('Open an active map first.');
          const key = { activity: 'activities', step: 'steps', story: 'stories', release: 'releases' }[f.kind];
          const index = map[key].findIndex(item => item.id === f.id);
          if (f.id && index < 0) throw Error('That item no longer exists.');
          if (index < 0) map[key].push(record); else map[key][index] = record;
        }
        store.nextId = Math.max(store.nextId, f.nextId);
      }, f.token);
    }
    modalOriginal = null; closeModal();
    if (f.kind === 'map') { if (!f.id) smUi.back = f.origin; smUi.map = f.record.id; smUi.owner = designOwner(); setView('storymaps'); }
    else { if (!['move', 'link-prd'].includes(f.kind)) smUi.item = f.record.id; render(); }
    notify('Storymap saved. Planning and links are not implementation evidence.');
  } catch (error) { smFail(error); }
}
function smConfirmRemove() {
  const f = smUi.form; if (!f?.removal || !f.id) return;
  try {
    smCommit(store => { if (f.kind === 'map') store.maps = store.maps.filter(map => map.id !== f.id);
      else { const map = smFind(store, f.mapId); if (!map) throw Error('That map no longer exists.'); smRemove(map, f.kind, f.id); } }, f.token);
    modalOriginal = null; closeModal(); smUi.item = null; render(); notify(f.kind === 'release' ? 'Release removed. Its stories are now Unplanned. Undo is available.' : 'Removed from the storymap only. Linked artifacts are retained. Undo is available.');
  } catch (error) { smFail(error); }
}
function smBeginMove(id) {
  smCanWrite();
  const map = smCurrentMap(), item = smItem(map, id); if (!item || map.status === 'archived') return smFail('Choose an item in an active map.');
  const r = item.record;
  smUi.form = { kind: 'move', id, mapId: map.id, record: { activityId: r.activityId || '', stepId: r.stepId || '', releaseId: r.releaseId ?? null, beforeId: '' }, token: smToken(), removal: false };
  smUi.error = ''; showModal('storymap-form');
}
function smBeginPrdLinks(id) {
  smCanWrite();
  const prd = design().prds.find(p => p.id === id); if (!prd) return smFail('That PRD no longer exists.');
  smUi.form = { kind: 'link-prd', record: { id, maps: smStore().maps.filter(map => map.prds.some(ref => ref.id === id)).map(map => map.id) }, token: smToken(), removal: false };
  smUi.error = ''; showModal('storymap-form');
}
function handleStorymapAction(action, value = '') {
  if (['nav', 'palette-nav'].includes(action) && value === 'storymaps') { smUi.map = null; smUi.item = null; smUi.back = null; return false; }
  if (!action.startsWith('sm-')) return false;
  if (!project()) { openVaultIdentity('storymaps'); return true; }
  try {
    const map = smCurrentMap();
    switch (action) {
      case 'sm-open': smOpen(value); break;
      case 'sm-open-prd': smOpen(value, 'prds'); break;
      case 'sm-backlink': { const [mapId, item] = value.split(':'); smOpen(mapId, 'sitemap', item); break; }
      case 'sm-overview': smUi.map = null; smUi.item = null; smUi.back = null; setView('storymaps'); break;
      case 'sm-return': smReturn(); break;
      case 'sm-new': smBegin('map', null, null, null, value || null); break;
      case 'sm-map-edit': smBegin('map', value || map?.id); break;
      case 'sm-add': { const [kind, parent, release] = value.split(':'); smBegin(kind, null, parent || null, release || null); break; }
      case 'sm-edit': { const item = smItem(map, value); if (!item) throw Error('That item no longer exists.'); smBegin(item.kind, value); break; }
      case 'sm-select': smSelect(value || null); break;
      case 'sm-mode': if (['map', 'outline'].includes(value)) { smUi.mode = value; render(); } break;
      case 'sm-save': smSave(); break;
      case 'sm-move': smBeginMove(value); break;
      case 'sm-delete': if (smUi.form?.id) { smUi.form.removal = true; redrawModal(); } break;
      case 'sm-keep': if (smUi.form) { smUi.form.removal = false; redrawModal(); } break;
      case 'sm-delete-confirm': smConfirmRemove(); break;
      case 'sm-prd-links': smBeginPrdLinks(value); break;
      case 'sm-duplicate': { let id; smCommit(store => { id = smDuplicate(store, value || map.id).id; }); smOpen(id); notify('Independent map copy created; artifact references are retained.'); break; }
      case 'sm-archive': smCommit(store => { const m = smFind(store, value); if (!m) throw Error('That map no longer exists.'); m.status = m.status === 'archived' ? 'draft' : 'archived'; }); render(); break;
      case 'sm-history': if (['undo', 'redo'].includes(value)) smTravel(value); break;
      case 'sm-details': smToggleDetails(); break;
      case 'sm-fit': smFit(); break;
      case 'sm-zoom': if (smUi.api) smUi.api.zoomTo(Math.max(.25, Math.min(1.5, smUi.api.viewport.value.zoom + (value === 'in' ? .1 : -.1)))); break;
      case 'sm-locate': smLocate(); break;
      case 'sm-surface': smGoSurface(value); break;
      case 'sm-prd': { const prd = design().prds.find(p => p.id === value); if (!prd) throw Error('PRD target missing. Relink it in map settings.'); productUi.prd = value; productUi.tab = 'document'; setView('prds'); break; }
      case 'sm-export': smExport(); break;
      case 'sm-clear-filters': smUi.query = ''; smUi.prdFilter = ''; smUi.status = 'active'; render(); break;
    }
  } catch (error) { smFail(error); }
  return true;
}
function smGoSurface(id) {
  if (!design().nodes.some(node => node.id === id)) throw Error('Sitemap target missing. Relink or remove it in the item editor.');
  selectSitemapItem('surface', id); referenceUi.panel = 'inspector'; canvasUi.inspector = 'links';
  canvasState().collapsed = canvasState().collapsed.filter(parent => !nodeDescendants(design(), parent).has(id));
  setView('sitemap'); fitMap(true);
}
// Text editing keeps native undo; map history shortcuts use the same guarded transaction.
document.addEventListener('keydown', event => {
  if (state.view !== 'storymaps' || !project() || document.querySelector('dialog[open]') || event.target.closest('input,textarea,select,[contenteditable=true]')) return;
  if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
    event.preventDefault(); if (event.repeat) return;
    try { smTravel(event.shiftKey || event.key.toLowerCase() === 'y' ? 'redo' : 'undo'); } catch (error) { smFail(error); }
  }
});
