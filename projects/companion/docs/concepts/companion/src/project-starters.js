// Starter definitions are selected local JSON files, never embedded or executed. The session catalog starts empty,
// holds only definitions this browser session loaded, and every mutation uses the existing import transaction.
const starterProjectSources = new WeakMap();
const starterWorkspaceUi = { definitions: new Map(), serial: 0, loading: false, error: '', reviewHash: '', startSetup: false };
const starterCatalog = validateStarterCatalog({ schemaVersion: 1, starters: [] });
const starterUi = { query: '', category: 'all', draft: null, error: '' };
function starterEntry(id) { return starterCatalog.starters.find(s => s.id === id); }
function starterMatches() {
  const query = starterUi.query.trim().toLowerCase();
  return starterCatalog.starters.filter(s => (starterUi.category === 'all' || s.category === starterUi.category) && [s.name, s.summary, s.outcome, ...s.tags].join(' ').toLowerCase().includes(query));
}
async function starterSha256(bytes) {
  if (!crypto.subtle) throw Error('This browser needs a secure local file or localhost context to verify starter hashes.');
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}
async function readStarterDefinitions(files) {
  const serial = ++starterWorkspaceUi.serial, list = Array.from(files || []);
  starterWorkspaceUi.loading = true; starterWorkspaceUi.error = ''; render();
  try {
    if (!list.length || list.length > 256 || list.some(f => !f.name.toLowerCase().endsWith('.json') || f.size > 4000000) || list.reduce((sum, f) => sum + f.size, 0) > 16000000) throw Error('Select 1–256 JSON definitions, at most 4 MB each and 16 MB total.');
    const incoming = new Map();
    for (const file of list) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.length > 4000000) throw Error('A starter exceeded the 4 MB limit while reading.');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes), definition = CompanionContract.parseBrowserStarter(text);
      if (incoming.has(definition.id)) throw Error('Duplicate starter ID in this selection: ' + definition.id);
      const sha256 = await starterSha256(bytes);
      const entry = definition.generator.kind === 'companion' ? CompanionContract.starterProjection(definition, sha256) : null;
      incoming.set(definition.id, { definition, sha256, text, entry, bytes: bytes.length });
    }
    if (serial !== starterWorkspaceUi.serial) return;
    const merged = new Map([...starterWorkspaceUi.definitions, ...incoming]);
    if (merged.size > 256 || [...merged.values()].reduce((sum, r) => sum + r.bytes, 0) > 16000000) throw Error('Loaded starters would exceed the session limit. Reload the page before loading another pack. Your project is preserved.');
    const entries = [...merged.values()].flatMap(row => row.entry ? [row.entry] : []).sort((a, b) => a.id.localeCompare(b.id));
    validateStarterCatalog({ schemaVersion: 1, starters: entries });
    starterWorkspaceUi.definitions = merged; starterCatalog.starters = entries;
    starterUi.query = ''; starterUi.category = 'all'; starterUi.draft = null;
  } catch (error) { if (serial === starterWorkspaceUi.serial) starterWorkspaceUi.error = error.message || 'Starter import failed. Existing definitions and project were preserved.'; }
  finally { if (serial === starterWorkspaceUi.serial) { starterWorkspaceUi.loading = false; render(); if (starterWorkspaceUi.error) document.getElementById('starter-load-error')?.focus(); } }
}
function openStarter(id) {
  try {
    const row = starterWorkspaceUi.definitions.get(id), entry = starterEntry(id);
    if (!row || !entry) throw Error('Load this starter JSON first. No bundled fallback is used.');
    companionCanReplace(companionProjectToken());
    const defaults = Object.fromEntries(row.definition.inputs.filter(input => input.default !== undefined).map(input => [input.id, input.default]));
    starterUi.draft = { starterId: id, snapshot: companionProjectToken(), ...entry.document.project, ...entry.document.settings, ...defaults };
    starterWorkspaceUi.reviewHash = row.sha256; starterWorkspaceUi.startSetup = true;
    starterUi.error = ''; showModal('starter-configure');
  } catch (error) { notify(error.message); }
}
function starterDraftDocument() {
  const { starterId, snapshot, ...fields } = starterUi.draft, row = starterWorkspaceUi.definitions.get(starterId);
  companionCanReplace(snapshot);
  if (!row || row.sha256 !== starterWorkspaceUi.reviewHash) throw Error('The starter changed. Configure and review its current bytes again.');
  const supplied = Object.fromEntries(Object.entries(fields).filter(([key]) => row.definition.inputs.some(input => input.id === key)));
  return CompanionContract.configureBrowserStarter(row.definition, row.sha256, supplied);
}
function reviewStarter() {
  try {
    const entry = starterEntry(starterUi.draft.starterId);
    const text = JSON.stringify(starterDraftDocument(), null, 2) + '\n';
    // Parse structural references before opening review; this never installs a project.
    companionCandidate(text);
    Object.assign(projectTransferUi, { text, filename: entry.name + ' · external ' + entry.version, candidate: null,
      snapshot: starterUi.draft.snapshot, error: '', serial: projectTransferUi.serial + 1, loading: false,
      starter: { id: entry.id, version: entry.version, name: entry.name, sha256: starterWorkspaceUi.reviewHash } });
    showModal('project-import'); reviewCompanionImport();
  } catch (error) { starterUi.error = error.message; redrawModal(); document.getElementById('starter-error')?.focus(); }
}
function starterBack() {
  // The reviewed bytes remain the authority. Never silently discard pasted edits.
  if (!starterUi.draft || !projectTransferUi.starter || projectTransferUi.candidate === null) return;
  showModal('starter-configure');
}
function verifyStarterReview() {
  const source = projectTransferUi.starter; if (!source) return;
  const row = starterWorkspaceUi.definitions.get(source.id);
  if (!row || row.sha256 !== source.sha256) throw Error('The starter changed after review. Configure and review its current bytes again; your project is unchanged.');
}
function starterSetupAfterCreate() {
  if (!starterWorkspaceUi.startSetup || !project()) return;
  const origin = projectTransferUi.starter, row = origin && starterWorkspaceUi.definitions.get(origin.id);
  if (row && row.sha256 === origin.sha256) {
    const inputs = Object.fromEntries(Object.entries(starterUi.draft || {}).filter(([key]) => row.definition.inputs.some(input => input.id === key)));
    starterProjectSources.set(project(), { definition: structuredClone(row.definition), sha256: row.sha256, inputs });
  }
  starterWorkspaceUi.startSetup = false; startVaultPreparation();
}
function recipeInputs(row, document) {
  const values = { ...Object.fromEntries(row.definition.inputs.filter(input => input.default !== undefined).map(input => [input.id, input.default])), ...document.project, ...document.settings };
  return Object.fromEntries(row.definition.inputs.filter(input => values[input.id] !== undefined).map(input => [input.id, values[input.id]]));
}
function reviewStarterRecipe(id) {
  try {
    const p = project(), row = starterWorkspaceUi.definitions.get(id), snapshot = companionProjectToken();
    if (!p || !row || row.definition.generator.kind !== 'companion') throw Error('Open a project and explicitly load its Companion starter recipe first.');
    companionCanReplace(snapshot);
    const document = companionProjectDocument(p), inputs = recipeInputs(row, document);
    CompanionContract.exportBrowserStarter(row.definition, row.sha256, document, inputs);
    showModal('starter-recipe', { id, sha256: row.sha256, snapshot, error: '' });
  } catch (error) { notify(error.message); }
}
function attachStarterRecipe() {
  try {
    if (!document.getElementById('starter-recipe-confirm')?.checked) throw Error('Confirm which recipe will accompany the current project.');
    const row = starterWorkspaceUi.definitions.get(modalData.id);
    if (!row || row.sha256 !== modalData.sha256) throw Error('The recipe changed after review. Review its current bytes again.');
    companionCanReplace(modalData.snapshot);
    const p = project(), projectDocument = companionProjectDocument(p), inputs = recipeInputs(row, projectDocument);
    CompanionContract.exportBrowserStarter(row.definition, row.sha256, projectDocument, inputs);
    starterProjectSources.set(p, { definition: structuredClone(row.definition), sha256: row.sha256, inputs });
    showModal('starter-generation');
  } catch (error) { modalData.error = error.message; redrawModal(); }
}
function exportEditedStarter() {
  try {
    const p = project(), source = p && starterProjectSources.get(p);
    if (!source) throw Error('This session has no reviewed recipe for this project. Export project JSON instead; original starter files and processes will not be guessed.');
    const definition = CompanionContract.exportBrowserStarter(source.definition, source.sha256, companionProjectDocument(p), source.inputs);
    showModal('copy', { title: 'Edited starter definition — save under configs/starters/' + definition.id + '.json after review. Processes remain unapproved data.', text: JSON.stringify(definition, null, 2) + '\n', filename: definition.id + '.json' });
  } catch (error) { notify(error.message); }
}
function handleStarterAction(action, value) {
  if (action === 'starter-recipe') { reviewStarterRecipe(value); return true; }
  if (action === 'starter-recipe-apply') { attachStarterRecipe(); return true; }
  if (action === 'starter-open') { openStarter(value); return true; }
  if (action === 'starter-review') { reviewStarter(); return true; }
  if (action === 'starter-back') { starterBack(); return true; }
  if (action === 'starter-clear') { starterUi.query = ''; starterUi.category = 'all'; render(); return true; }
  if (action === 'starter-generate') { showModal('starter-generation'); return true; }
  if (action === 'starter-export') { exportEditedStarter(); return true; }
  if (action === 'starter-blank') {
    if (project()) { notify('This vault already has a project. Export it before reviewing a replacement starter, or open an empty vault for a new blank project.'); return true; }
    starterWorkspaceUi.startSetup = true; openVaultIdentity('overview'); return true;
  }
  if (action === 'starter-inspect-files') {
    const row = starterWorkspaceUi.definitions.get(value);
    if (row) showModal('copy', { title: 'File-based starter — inspect JSON; execute only through the shell after review.', text: row.text, filename: row.definition.id + '.json' });
    return true;
  }
  return false;
}
function editStarterField(el) {
  const field = el.dataset.field;
  if (field === 'starter-search') { starterUi.query = el.value.slice(0, 160); renderStarterResults(); return true; }
  if (field === 'starter-category') { starterUi.category = el.value; renderStarterResults(); return true; }
  if (!field?.startsWith('starter-') || !starterUi.draft) return false;
  const input = starterWorkspaceUi.definitions.get(starterUi.draft.starterId)?.definition.inputs.find(input => 'starter-' + input.id === field);
  if (!input) return false;
  const value = input.choices ? (el.value === '' ? undefined : input.choices[Number(el.value)]) : input.type === 'boolean' ? el.checked : input.type === 'integer' ? (el.value === '' ? undefined : Number(el.value)) : el.value;
  if (value === undefined) delete starterUi.draft[input.id]; else starterUi.draft[input.id] = value;
  starterUi.error = ''; return true;
}
document.addEventListener('change', event => { if (event.target?.id === 'starter-definition-files') void readStarterDefinitions(event.target.files); });
