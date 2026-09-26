// A curated offline catalog; all mutations use the existing import transaction.
const starterCatalog = validateStarterCatalog(JSON.parse(document.getElementById('project-starters-data').textContent));
const starterUi = { query: '', category: 'all', draft: null, error: '' };
function starterEntry(id) { return starterCatalog.starters.find(s => s.id === id); }
function starterMatches() {
  const query = starterUi.query.trim().toLowerCase();
  return starterCatalog.starters.filter(s => (starterUi.category === 'all' || s.category === starterUi.category) && [s.name, s.summary, s.outcome, ...s.tags].join(' ').toLowerCase().includes(query));
}
function openStarter(id) {
  try {
    const entry = starterEntry(id); if (!entry) throw Error('This starter is not in the built-in catalog.');
    companionCanReplace(companionProjectToken());
    starterUi.draft = { starterId: id, snapshot: companionProjectToken(), ...entry.document.project, ...entry.document.settings };
    starterUi.error = ''; showModal('starter-configure');
  } catch (error) { notify(error.message); }
}
function starterDraftDocument() {
  const { starterId, snapshot, ...fields } = starterUi.draft;
  companionCanReplace(snapshot);
  return customizeStarter(starterCatalog, starterId, fields);
}
function reviewStarter() {
  try {
    const entry = starterEntry(starterUi.draft.starterId);
    const text = JSON.stringify(starterDraftDocument(), null, 2) + '\n';
    // Parse structural references before opening review; this never installs a project.
    companionCandidate(text);
    Object.assign(projectTransferUi, { text, filename: entry.name + ' · built-in ' + entry.version, candidate: null,
      snapshot: starterUi.draft.snapshot, error: '', serial: projectTransferUi.serial + 1, loading: false,
      starter: { id: entry.id, version: entry.version, name: entry.name } });
    showModal('project-import'); reviewCompanionImport();
  } catch (error) { starterUi.error = error.message; redrawModal(); document.getElementById('starter-error')?.focus(); }
}
function starterBack() {
  // The reviewed bytes remain the authority. Never silently discard pasted edits.
  if (!starterUi.draft || !projectTransferUi.starter || projectTransferUi.candidate === null) return;
  showModal('starter-configure');
}
function starterReviewBanner() {
  const provenance = projectTransferUi.starter; if (!provenance) return '';
  const entry = starterEntry(provenance.id);
  return `<section class="callout" id="starter-review-context"><div><strong>Review ${esc(entry.name)} · ${esc(entry.version)}</strong><p>Creates an independent project copy. Only confirmed replacement changes this workspace. No source files are generated here.</p><p class="small">Still to implement: ${esc(entry.implementation.join(' · '))}</p></div></section>`;
}
function handleStarterAction(action, value) {
  if (action === 'starter-open') { openStarter(value); return true; }
  if (action === 'starter-review') { reviewStarter(); return true; }
  if (action === 'starter-back') { starterBack(); return true; }
  if (action === 'starter-clear') { starterUi.query = ''; starterUi.category = 'all'; render(); return true; }
  if (action === 'starter-generate') { showModal('starter-generation'); return true; }
  return false;
}
function editStarterField(el) {
  const field = el.dataset.field;
  if (field === 'starter-search') { starterUi.query = el.value.slice(0,160); renderStarterResults(); return true; }
  if (field === 'starter-category') { starterUi.category = el.value; renderStarterResults(); return true; }
  if (!field?.startsWith('starter-') || !starterUi.draft) return false;
  const key = field.slice(8);
  if (['name','id','author','version','description','codebaseFolder','testsFolder'].includes(key)) { starterUi.draft[key] = el.value; starterUi.error = ''; }
  return true;
}
