// Concept adapter: one canonical project transaction, independent view state.
const smUi = { details: false, lastWidth: innerWidth, owner: null, map: null, item: null, mode: 'map', query: '', status: 'active', prdFilter: '',
  itemQuery: '', releaseFilter: '', findingFilter: '', outbound: null, back: null, form: null, error: '', pageError: '', app: null, api: null, serial: 0, drag: null, viewports: {}, root: null };
function smPaused() { return !!state.activeRun || !!tdUi.busy || !!storageWarning; }
function smReadOnly(map = smCurrentMap()) { return map?.status === 'archived' || smPaused(); }
function smCurrentMap() { return project() ? smFind(smStore(), smUi.map) : null; }
function smToken() { return JSON.stringify({ owner: designOwner(), revision: design().revision, design: designSnapshot(design()) }); }
function smFail(error) {
  smUi.error = String(error instanceof Error ? error.message : error).replace(/^STORYMAP_INVALID: /, '');
  if (modalType === 'storymap-form' && document.getElementById('modal').open) { redrawModal(); const title = document.getElementById('sm-title'); if (title && !smUi.form?.record.title?.trim()) { title.setAttribute('aria-invalid', 'true'); title.setAttribute('aria-describedby', 'sm-form-error'); title.focus(); } else document.getElementById('sm-form-error')?.focus(); }
  else { smUi.pageError = smUi.error; const el = document.getElementById('sm-page-error'); if (el) el.textContent = smUi.error; notify(smUi.error); }
  return false;
}
function smCanWrite(token = smToken()) {
  if (state.activeRun || tdUi.busy) throw Error('Finish or cancel the current operation before changing a storymap.');
  if (token !== smToken()) throw Error('The project changed during this edit. Your draft is retained. Reopen the current item before applying.');
  if (storageWarning || localStorage.getItem(STORAGE_KEY) !== persistenceSnapshot) throw Error('Resolve the storage conflict first. Export this session and the retained copy; no storymap was changed.');
}
function smPersistDesign(candidate, previous) {
  cpRetainRevisions(candidate.detailDesigns, previous.detailDesigns);if(candidate.detailDesigns?.schema===2)candidate.schema=4;cpBoundHistory(candidate);
  if (!validSavedDesign(candidate)) throw Error('The change would create an invalid project. Nothing was saved.');
  project().design = candidate;
  if (!saveConceptState()) { project().design = previous; throw Error('The change could not be saved. Previous data and history are retained; export recovery before closing.'); }
  designUi.plan = null; smUi.error = ''; smUi.pageError = ''; return true;
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
  // Archived records may only be restored, not edited/deleted through alternate entry points.
  for (const old of smStore(previous).maps.filter(m => m.status === 'archived')) {
    const next = smFind(store, old.id);
    if (!next || JSON.stringify({ ...next, status: old.status, revision: old.revision, updatedAt: old.updatedAt }) !== JSON.stringify(old)) throw Error('Restore this archived map before editing it.');
  }
  validateStorymaps(store); candidate.schema = Math.max(previous.schema, 2); candidate.storymaps = store; candidate.revision++;
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
  for (const key of ['canvas', 'librarySchema', 'designSystem', 'detailDesigns']) if (!Object.hasOwn(snapshot, key)) delete candidate[key];
  if(previous.detailDesigns&&!candidate.detailDesigns)candidate.detailDesigns=emptyDetailDesigns();
  if(candidate.detailDesigns)candidate.detailDesigns.nextId=Math.max(candidate.detailDesigns.nextId, previous.detailDesigns?.nextId||1);
  candidate.storymaps = smCopy(snapshot.storymaps || emptyStorymaps());
  candidate.storymaps.nextId = Math.max(candidate.storymaps.nextId, smStore(previous).nextId);
  candidate.semantic = snapshot.semantic || emptySemantic(); candidate.dataSources = snapshot.dataSources || emptyDataSources();
  candidate.semantic.nextId = Math.max(previous.semantic?.nextId || 1, candidate.semantic.nextId);
  candidate.dataSources.nextId = Math.max(previous.dataSources?.nextId || 1, candidate.dataSources.nextId);
  candidate.nextId = Math.max(previous.nextId, candidate.nextId); candidate.schema = Math.max(previous.schema, 2); candidate.revision = previous.revision + 1;
  smPersistDesign(candidate, previous); render(); notify('Design ' + direction + ' complete. Source files and external artifacts were not deleted.');
}
function smNormalize() {
  if (smUi.owner !== designOwner()) { smUi.owner = designOwner(); smUi.map = null; smUi.item = null; smUi.back = null; smUi.viewports = {}; smUi.itemQuery = ''; smUi.releaseFilter = ''; smUi.findingFilter = ''; smUi.outbound = null; smUi.error = ''; smUi.pageError = ''; }
  const map = smCurrentMap(); if (!map) smUi.map = null;
  if (!smItem(map, smUi.item)) smUi.item = null;
  if (smUi.releaseFilter && smUi.releaseFilter !== 'unplanned' && !map?.releases.some(r => r.id === smUi.releaseFilter)) smUi.releaseFilter = '';
  const ids = new Set(smStore().maps.map(m => m.id)); for (const id of Object.keys(smUi.viewports)) if (!ids.has(id)) delete smUi.viewports[id];
}
function smOpen(id, origin = null, item = null) {
  smNormalize(); const map = smFind(smStore(), id); if (!map) return smFail('That storymap no longer exists.');
  if (smUi.map !== id) { smUi.itemQuery = ''; smUi.releaseFilter = ''; smUi.findingFilter = ''; }
  if (!origin) smUi.back = null;
  if (origin) smUi.back = { view: origin, id: origin === 'prds' ? selectedPrd()?.id : designUi.selected, tab: productUi.tab, requirementSearch: productUi.requirementSearch || '', scroll: document.getElementById('content').scrollTop };
  smUi.map = id; smUi.item = item; smUi.mode = innerWidth < 700 ? 'outline' : smUi.mode; smUi.error = ''; smUi.pageError = ''; setView('storymaps');
}
function smReturn() {
  const back = smUi.back; smUi.back = null;
  if (!back) { smUi.map = null; setView('storymaps'); return; }
  if (back.view === 'prds') { productUi.prd = back.id; productUi.tab = back.tab; productUi.requirementSearch = back.requirementSearch || ''; }
  if (back.view === 'sitemap') selectSitemapItem('surface', back.id);
  setView(back.view); document.getElementById('content').scrollTop = back.scroll;
}
function smBegin(kind, id = null, parent = null, release = null, prdId = null) {
  try {
    smCanWrite(); const store = smCopy(smStore()), map = smCurrentMap(); let record;
    if (kind === 'map') {
      const existing = id ? smFind(store, id) : null; if (id && !existing) throw Error('That map no longer exists.');
      if (existing?.status === 'archived') throw Error('Restore this archived map before editing it.');
      if (!id && store.maps.length >= STORYMAP_LIMITS.maps) throw Error('The project already has ' + STORYMAP_LIMITS.maps + ' maps. Remove an unneeded map before creating another.');
      record = existing ? smCopy(existing) : smNewMap(store);
      const prd = prdId ? design().prds.find(p => p.id === prdId) : null;
      if (prdId && !prd) throw Error('That PRD no longer exists.');
      if (prd) { record.title = (prd.title + ' storymap').slice(0, 120); record.purpose = prd.goals.slice(0, 4000); record.audience = prd.audience.slice(0, 1000); record.prds = [{ id: prd.id, label: prd.title.slice(0, 160) }]; }
    } else {
      if (!map || map.status === 'archived') throw Error('Open an active map, or restore this archived map first.');
      const existing = id ? smItem(map, id) : null; if (id && existing?.kind !== kind) throw Error('That item no longer exists.');
      if (!id && kind === 'step' && !map.activities.some(a => a.id === parent)) throw Error('Add an activity first, then add a step to it.');
      if (!id && kind === 'story' && !map.steps.some(s => s.id === parent)) throw Error('Add a step first, then add a story to it.');
      const collection = { activity: 'activities', step: 'steps', story: 'stories', release: 'releases' }[kind];
      if (!existing && map[collection].length >= STORYMAP_LIMITS[collection]) throw Error('This map has reached its ' + collection + ' limit. Remove an unneeded item first.');
      record = existing ? smCopy(existing.record) : smNewItem(store, kind, parent, release);
    }
    smUi.form = { kind, id, mapId: map?.id || null, record, nextId: store.nextId, token: smToken(), removal: false, origin: prdId ? { view: 'prds', id: prdId, tab: productUi.tab, requirementSearch: productUi.requirementSearch || '', scroll: document.getElementById('content').scrollTop } : null };
    smUi.error = ''; showModal('storymap-form');
  } catch (error) { smFail(error); }
}
function smSave(another = false) {
  const f = smUi.form; if (!f || f.removal) return;
  try {
    if (another && (f.id || f.kind !== 'story')) throw Error('Add another is available only when creating a story.');
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
    if (another && smCurrentMap().stories.length < STORYMAP_LIMITS.stories) { smBegin('story', null, f.record.stepId, f.record.releaseId); smAnnounce('Story saved. Add the next story in the same step and release.'); }
    else { smFocusItem(); notify(f.kind === 'move' ? 'Item moved. Undo is available.' : 'Storymap saved.'); }
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
function smFocusItem() {
  requestAnimationFrame(() => {
    if (state.view !== 'storymaps' || document.querySelector('dialog[open]')) return;
    const card = [...document.querySelectorAll('[data-sm-item]')].find(el => el.dataset.smItem === smUi.item);
    const target = card?.querySelector('[data-action="sm-select"],[data-action="sm-find-item"]') || document.querySelector('.sm-heading h1');
    target?.focus({ preventScroll: true });
  });
}
function smRememberDeparture() {
  smUi.outbound = { owner: designOwner(), map: smUi.map, item: smUi.item, mode: smUi.mode, back: smUi.back, itemQuery: smUi.itemQuery, releaseFilter: smUi.releaseFilter, findingFilter: smUi.findingFilter, scroll: document.getElementById('content').scrollTop };
}
function smReturnFromArtifact() {
  const back = smUi.outbound; if (!back || back.owner !== designOwner() || !smFind(smStore(), back.map)) throw Error('The originating storymap is no longer available.');
  Object.assign(smUi, back); smUi.outbound = null; setView('storymaps'); document.getElementById('content').scrollTop = back.scroll; smFocusItem();
}
function smReturnLink() {
  return smUi.outbound?.owner === designOwner() && smFind(smStore(), smUi.outbound.map) ? button('Back to storymap', 'sm-return-map', '', 'small ghost') : '';
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
      case 'sm-overview': smUi.map = null; smUi.item = null; smUi.back = null; smUi.pageError = ''; setView('storymaps'); break;
      case 'sm-return': smReturn(); break;
      case 'sm-return-map': smReturnFromArtifact(); break;
      case 'sm-new': smBegin('map', null, null, null, value || null); break;
      case 'sm-map-edit': smBegin('map', value || map?.id); break;
      case 'sm-add': { const [kind, parent, release] = value.split(':'); smBegin(kind, null, parent || null, release || null); break; }
      case 'sm-edit': { const item = smItem(map, value); if (!item) throw Error('That item no longer exists.'); smBegin(item.kind, value); break; }
      case 'sm-select': smSelect(value || null); break;
      case 'sm-mode': if (['map', 'outline', 'review'].includes(value)) { smUi.mode = value; render(); } break;
      case 'sm-save': smSave(); break;
      case 'sm-save-another': smSave(true); break;
      case 'sm-find-clear': smUi.itemQuery = ''; smUi.releaseFilter = ''; smUi.findingFilter = ''; render(); document.getElementById('sm-itemQuery')?.focus(); break;
      case 'sm-find-item': smUi.item = value; if (smUi.mode !== 'outline') smUi.mode = 'map'; render(); requestAnimationFrame(() => { smSelect(value); smLocate(); const row = [...document.querySelectorAll('.sm-outline-story')].find(el => el.dataset.smItem === value); row?.scrollIntoView({ block: 'center' }); row?.querySelector('button')?.focus({ preventScroll: true }); smFocusItem(); }); break;
      case 'sm-repair': if (value === map.id) smBegin('map', map.id); else { const item = smItem(map, value); if (item) smBegin(item.kind, value); } break;
      case 'sm-requirement': { const [prdId, id] = JSON.parse(value), prd = design().prds.find(p => p.id === prdId); if (!prd?.requirements.some(r => r.id === id)) throw Error('Requirement target missing. Relink it in the story editor.'); smRememberDeparture(); productUi.prd = prdId; productUi.requirementSearch = ''; productUi.tab = 'requirements'; setView('prds'); const target = [...document.querySelectorAll('[data-action="product-requirement-edit"]')].find(el => el.dataset.value === id); target?.scrollIntoView({ block: 'center' }); target?.focus({ preventScroll: true }); break; }
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
      case 'sm-prd': { const prd = design().prds.find(p => p.id === value); if (!prd) throw Error('PRD target missing. Relink it in map settings.'); smRememberDeparture(); productUi.prd = value; productUi.tab = 'document'; setView('prds'); break; }
      case 'sm-export': smExport(); break;
      case 'sm-clear-filters': smUi.query = ''; smUi.prdFilter = ''; smUi.status = 'active'; render(); break;
    }
  } catch (error) { smFail(error); }
  return true;
}
function smGoSurface(id) {
  if (!design().nodes.some(node => node.id === id)) throw Error('Sitemap target missing. Relink or remove it in the item editor.');
  smRememberDeparture(); selectSitemapItem('surface', id); referenceUi.panel = 'inspector'; canvasUi.inspector = 'links';
  canvasState().collapsed = canvasState().collapsed.filter(parent => !nodeDescendants(design(), parent).has(id));
  setView('sitemap'); fitMap(true);
}
// Text editing keeps native undo; map history shortcuts use the same guarded transaction.
document.addEventListener('keydown', event => {
  if (modalType === 'storymap-form' && document.getElementById('modal').open && !document.getElementById('discard-dialog')?.open && (event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.isComposing) { event.preventDefault(); if (!event.repeat && !smUi.form?.removal) smSave(false); return; }
  if (state.view !== 'storymaps' || !project() || document.querySelector('dialog[open]') || event.target.closest('input,textarea,select,[contenteditable=true]')) return;
  if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
    event.preventDefault(); if (event.repeat) return;
    try { smTravel(event.shiftKey || event.key.toLowerCase() === 'y' ? 'redo' : 'undo'); } catch (error) { smFail(error); }
  }
});

// Transient menus dismiss without changing the map or moving focus on pointer use.
document.addEventListener('pointerdown', event => {
  for (const menu of document.querySelectorAll('.sm-export-menu[open],.sm-prd-menu[open]')) if (!menu.contains(event.target)) menu.open = false;
}, true);
