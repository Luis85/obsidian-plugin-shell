// Modern authoring uses imported JSON definitions. No recipe or self-project is bundled here.
const importedStarterDefinitions = new Map();
let starterImportBusy = false;
let starterImportMessage = '';
async function importStarterFiles(files) {
  if (starterImportBusy) return;
  starterImportBusy = true; starterImportMessage = ''; renderStarterResults();
  try {
    const inputs = Array.from(files || []), pending = [];
    if (!inputs.length || inputs.length + starterCatalog.starters.length > 256) throw Error('Choose between 1 and 256 starter JSON files.');
    let bytes = Array.from(importedStarterDefinitions.values()).reduce((sum, item) => sum + item.bytes, 0);
    const ids = new Set(starterCatalog.starters.map(item => item.id));
    for (const file of inputs) {
      if (!file.name.endsWith('.json') || file.size > CompanionJourney.browserStarters.maxBytes) throw Error('Each starter must be a JSON file no larger than 4 MB.');
      bytes += file.size;
      if (bytes > 16_000_000) throw Error('The imported starter library exceeds the 16 MB session limit.');
      const buffer = await file.arrayBuffer();
      if (buffer.byteLength !== file.size) throw Error('The selected starter changed while reading.');
      const definition = CompanionJourney.browserStarters.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
      if (ids.has(definition.id)) throw Error('Duplicate starter ' + definition.id + '. Reload the empty starter library before importing its replacement.');
      ids.add(definition.id);
      if (!globalThis.crypto?.subtle) throw Error('Secure hashing is unavailable. Open the prototype from localhost or a trusted local file.');
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      pending.push({ definition, bytes: file.size, entry: CompanionJourney.browserStarters.entry(definition, sha256) });
    }
    // Commit the whole validated batch, never a partially accepted library or a project replacement.
    for (const item of pending) {
      importedStarterDefinitions.set(item.definition.id, { definition: item.definition, bytes: item.bytes });
      starterCatalog.starters.push(item.entry);
    }
    starterImportMessage = pending.length + ' starter definition(s) imported. Choose one to configure. Your project is unchanged.';
  } catch (error) { starterImportMessage = error instanceof Error ? error.message : 'The starter library could not be read.'; }
  finally { starterImportBusy = false; renderStarterResults(); document.getElementById('starter-import-status')?.focus(); }
}
function starterImportControl() {
  return `<div class="field"><label for="starter-definition-files">Import starter definitions from the separate starters ZIP</label><input id="starter-definition-files" type="file" accept=".json,application/json" multiple ${starterImportBusy ? 'disabled' : ''}><p class="small muted">Extract the ZIP, then select its configs/starters/*.json files. Up to 4 MB each and 16 MB per session. Nothing is executed.</p></div><p id="starter-import-status" role="status" aria-live="polite" tabindex="-1">${esc(starterImportBusy ? 'Validating starter definitions…' : starterImportMessage)}</p>`;
}
function projectStartersView() {
  const categories = [...new Set(starterCatalog.starters.map(s => s.category))];
  return heading(project() ? 'Project starters' : 'Start your project', 'Choose a starter or create a blank project, then review project setup.', button('Import existing project', 'project-import', '', 'ghost', 'file')) +
    `<section class="starter-intro"><div><span class="eyebrow">CHOOSE → CONFIGURE → REVIEW → SET UP</span><h2>${project() ? 'Create from a reviewed definition' : 'Your workspace is empty'}</h2><p>Starters are separate, editable JSON files. Import the Companion golden template or a feature showcase from the starter pack. The application contains no hidden starter library.</p></div><div class="starter-boundary"><strong>${project() ? 'Your current project is preserved' : 'No project has been created'}</strong><p>${project() ? 'Replacing a project requires explicit review and confirmation. Export your current work first.' : 'A blank project needs no starter download. Configure its identity before setup.'}</p>${project() ? button('Export current project', 'project-export', '', 'small', 'download') : button('Blank project', 'starter-blank', '', 'primary', 'plus')}</div></section>` +
    `<section class="card">${starterImportControl()}</section><div class="starter-filter"><label for="starter-search">Find a starter<input id="starter-search" type="search" data-field="starter-search" value="${esc(starterUi.query)}" maxlength="160" placeholder="Search imported starters"></label><label for="starter-category">Category<select id="starter-category" data-field="starter-category"><option value="all">All categories</option>${categories.map(c => `<option value="${esc(c)}" ${starterUi.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label><span id="starter-count" role="status">${starterMatches().length} of ${starterCatalog.starters.length} starters</span></div><div id="starter-results">${starterResults()}</div><footer class="starter-footnote">The imported library is session-local. Existing projects survive reopening independently of starter files. Browser setup is a reviewed simulation; real source generation and process execution run through the shell.</footer>`;
}
function starterResults() {
  const matches = starterMatches();
  return matches.length ? `<div class="starter-grid">${matches.map(starterCard).join('')}</div>` : `<section class="card starter-empty"><h2>${starterCatalog.starters.length ? 'No matching starters' : 'No starters imported'}</h2><p>${starterCatalog.starters.length ? 'Change the search or category.' : 'Import JSON definitions above, or start a blank project. There is no embedded fallback.'}</p>${starterCatalog.starters.length ? button('Clear filters', 'starter-clear', '', 'ghost') : ''}${!project() ? button('Blank project', 'starter-blank', '', 'primary', 'plus') : ''}</section>`;
}
function renderStarterResults() {
  const results = document.getElementById('starter-results'), count = document.getElementById('starter-count');
  if (results) results.innerHTML = starterResults();
  if (count) count.textContent = starterMatches().length + ' of ' + starterCatalog.starters.length + ' starters';
  const message = document.getElementById('starter-import-status'), input = document.getElementById('starter-definition-files');
  if (message) message.textContent = starterImportBusy ? 'Validating starter definitions…' : starterImportMessage;
  if (input) input.disabled = starterImportBusy;
  const category = document.getElementById('starter-category');
  if (category) { category.innerHTML = '<option value="all">All categories</option>' + [...new Set(starterCatalog.starters.map(s => s.category))].map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join(''); category.value = starterUi.category; }
}
function starterCard(entry) {
  const d = entry.document?.design;
  return `<article class="starter-card" aria-labelledby="starter-title-${entry.id}"><div class="starter-card-top"><span class="starter-category">${esc(entry.category)}</span>${badge(entry.level)}</div><h2 id="starter-title-${entry.id}">${esc(entry.name)}</h2><p>${esc(entry.summary)}</p><p class="small">${d ? `${d.nodes.length} surfaces · ${d.semantic?.entities.length || 0} entities · ${allRequirements(d).length} requirements` : 'File blueprint · generated through the shell'}</p><p>${esc(entry.outcome)}</p><div class="starter-card-footer">${button(d ? 'Configure project' : 'View shell instructions', 'starter-open', entry.id, 'primary', 'arrow')}</div></article>`;
}
function openStarter(id) {
  try {
    const entry = starterEntry(id); if (!entry) throw Error('Import this starter definition before selecting it.');
    if (!entry.document) {
      showModal('copy', { title: 'Generate this file blueprint using the shell', text: 'Extract this starter into configs/starters/' + entry.id + '.json, then run:\n\nnode shell.mjs new ../my-project --starter ' + entry.id + '\n\nReview the file plan before adding --yes. Processes require separate trust.', filename: entry.id + '-instructions.txt' });
      return;
    }
    companionCanReplace(companionProjectToken());
    starterUi.draft = { starterId: id, snapshot: companionProjectToken(), ...entry.document.project, ...entry.document.settings };
    const native = entry.document.design.nativeIntegrations;
    if (native?.fileTypes.length === 1) starterUi.draft.extension = native.fileTypes[0].extension;
    if (native?.contextMenus.length === 1) starterUi.draft.extensions = native.contextMenus[0].extensions.join(',');
    starterUi.error = ''; showModal('starter-configure');
  } catch (error) { notify(error.message); }
}
function starterDraftDocument() {
  const { starterId, snapshot, ...fields } = starterUi.draft;
  companionCanReplace(snapshot);
  const catalog = { schemaVersion: 1, starters: starterCatalog.starters.filter(entry => entry.document) };
  return CompanionJourney.browserStarters.customize(catalog, starterId, fields);
}
function handleStarterAction(action, value) {
  if (action === 'starter-blank') { if (project()) notify('Export or keep your existing project. Blank creation never silently replaces it.'); else openVaultIdentity('prepare'); return true; }
  if (action === 'starter-open') { openStarter(value); return true; }
  if (action === 'starter-review') { reviewStarter(); return true; }
  if (action === 'starter-back') { starterBack(); return true; }
  if (action === 'starter-clear') { starterUi.query = ''; starterUi.category = 'all'; renderStarterResults(); return true; }
  if (action === 'starter-generate') { showModal('starter-generation'); return true; }
  if (action === 'project-example' || action === 'sample') { setView('starters'); notify('Import a starter definition to create an example project.'); return true; }
  return false;
}
function companionExampleProject() {
  throw Error('The Companion project is an external starter definition. Import companion-plugin.json and review setup.');
}
function vaultWelcomeView() { return projectStartersView(); }
function wkAfterStarterImport() {
  if (projectTransferUi.starter) { setView('prepare'); startVaultPreparation(); }
  else setView('overview');
}
function wkAfterIdentitySave(existing, after) {
  setView(existing ? 'overview' : after);
  if (!existing && after === 'prepare') startVaultPreparation();
}
document.addEventListener('change', event => {
  if (event.target.id === 'starter-definition-files') void importStarterFiles(event.target.files);
});
