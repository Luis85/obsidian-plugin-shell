// Portable authoring documents are deliberately separate from recovery snapshots.
const projectTransferUi = { text: '', filename: '', candidate: null, snapshot: '', error: '', serial: 0, loading: false };
let projectFoldersDraft = null;
function companionFolders(p = project()) { return { ...(p?.folders || COMPANION_DEFAULT_FOLDERS) }; }
function validCompanionProjectFolders(value) {
  if (value === undefined) return true;
  try { validateCompanionFolders(value); return true; } catch { return false; }
}
function companionProjectDocument(p = project()) {
  if (!p) throw Error('Define a project before exporting.');
  const identity = Object.fromEntries(['id', 'name', 'author', 'version', 'description'].map(key => [key, p[key] || '']));
  return validateCompanionDocument({ kind: COMPANION_FORMAT, schemaVersion: COMPANION_VERSION, executable: false,
    project: identity, settings: companionFolders(p), design: { schema: 3, ...designSnapshot(ensureProductModel(p.design)) }, notes: designCopy(p.notes || []) });
}
function companionJson(p = project()) {
  const text = JSON.stringify(companionProjectDocument(p), null, 2) + '\n';
  parseCompanionDocument(text); // Count the actual pretty-printed UTF-8 bytes too.
  return text;
}
function companionExport() {
  if (state.activeRun || tdUi.busy) return notify('Finish or cancel the current operation before exporting.');
  try {
    const text = companionJson();
    showModal('copy', { title: 'Full project JSON — saved authoring data and folder settings. Keep private. No trust, source files, approvals or verification receipts.',
      text, filename: project().id + '.companion.json' });
  } catch (error) { notify(error.message); }
}
function companionProjectToken() { return JSON.stringify({ project: project(), files: state.vaultFiles }); }
function companionCanReplace(snapshot) {
  if (state.activeRun || tdUi.busy) throw Error('Finish or cancel the current operation first.');
  if (snapshot !== companionProjectToken()) throw Error('The current project changed. Review the import again; nothing was replaced.');
  if (storageWarning || localStorage.getItem(STORAGE_KEY) !== persistenceSnapshot) throw Error('Resolve the browser-storage warning or conflict before replacing a project. Export both copies first.');
  const p = project(), files = state.vaultFiles;
  if (p ? files['Project.md'] !== p.projectNote : Object.keys(files).some(path => /^project\.md(?:\/|$)/i.test(path))) {
    throw Error('Project.md is not an unchanged owned record. Nothing was replaced.');
  }
}
function companionCandidate(text) {
  const document = parseCompanionDocument(text);
  const d = document.design;
  if (!structuralDesign(d)) throw Error('The design contains unsupported or malformed fields. Nothing was imported.');
  if (d.nextId < importCounter(d)) throw Error('The design counter could reuse an existing ID. Nothing was imported.');
  const p = newPlanningProject(document.project);
  Object.assign(p.design, designCopy(d));
  p.folders = designCopy(document.settings);
  p.notes = designCopy(document.notes);
  if (!validSavedDesign(p.design)) throw Error('The imported design cannot be retained safely.');
  return p;
}
function openCompanionImport(example = false) {
  if (state.activeRun || tdUi.busy) return notify('Finish or cancel the current operation first.');
  Object.assign(projectTransferUi, { text: example ? companionJson(companionExampleProject()) : '',
    filename: example ? 'Bundled companion project' : '', candidate: null, snapshot: companionProjectToken(),
    error: '', loading: false, serial: projectTransferUi.serial + 1 });
  showModal('project-import');
  if (example) reviewCompanionImport();
}
function companionTransferError(error) {
  projectTransferUi.error = error instanceof Error ? error.message : 'The project could not be read.';
  redrawModal();
  document.getElementById('project-transfer-error')?.focus();
}
function reviewCompanionImport() {
  try {
    if (projectTransferUi.loading) return;
    const snapshot = companionProjectToken();
    companionCanReplace(snapshot);
    projectTransferUi.snapshot = snapshot;
    projectTransferUi.candidate = companionCandidate(projectTransferUi.text);
    projectTransferUi.error = '';
    redrawModal();
    document.getElementById('project-import-summary')?.focus();
  } catch (error) { projectTransferUi.candidate = null; companionTransferError(error); }
}
function applyCompanionImport() {
  const u = projectTransferUi;
  try {
    if (!u.candidate || u.loading || !document.getElementById('project-import-confirm')?.checked) throw Error('Review the project and confirm the replacement first.');
    companionCanReplace(u.snapshot);
    const p = companionCandidate(u.text); // Never trust a cached or edited review.
    const before = state;
    state = { ...state, project: p, vaultFiles: { ...state.vaultFiles, 'Project.md': p.projectNote },
      wizard: null, generator: { ...state.generator, plan: null }, runs: [], view: 'overview' };
    if (!saveConceptState()) { state = before; throw Error('The project could not be saved. The current project is unchanged; export recovery before closing.'); }
    tdDropSession(); dtReset(); smUi.owner=null; smNormalize(); designUi.plan = null; designUi.selected = p.design.nodes[0]?.id || null;
    designUi.error = ''; productUi.prd = null; productUi.component = null;
    dsUi.selected = null; dsUi.catalogSelected = null; erUi.selected = null; erUi.edge = null;
    u.serial++; u.candidate = null; modalOriginal = null; closeModal(); setView('overview');
    notify('Project imported into this vault’s workspace. No source was generated, acquired or activated.');
  } catch (error) { companionTransferError(error); }
}
async function readCompanionImportFile(file) {
  const u = projectTransferUi, serial = ++u.serial;
  u.candidate = null; u.error = ''; u.loading = true; u.text = ''; u.filename = file?.name || '';
  redrawModal();
  try {
    if (!file || file.size > COMPANION_MAX_BYTES) throw Error('Choose a JSON file no larger than 4 MB.');
    const bytes = await file.arrayBuffer();
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (serial !== u.serial || modalType !== 'project-import') return;
    u.text = text; u.loading = false; reviewCompanionImport();
  } catch (error) {
    if (serial !== u.serial || modalType !== 'project-import') return;
    u.loading = false; companionTransferError(error);
  }
}
function companionSettingsCard() {
  const p = project(), folders = companionFolders();
  return `<section class="card mt16"><h3>Project files &amp; JSON handoff</h3><p>${p ? 'Saved folder settings travel with the full project export.' : 'Load the companion example, import a full project, or start a blank project.'}</p>
    ${p ? `<dl class="receipt"><dt>Codebase folder</dt><dd><code>${esc(folders.codebaseFolder)}/</code></dd><dt>Tests folder</dt><dd><code>${esc(folders.testsFolder)}/</code></dd></dl>` : ''}
    <div class="row wrap">${p ? button('Configure project folders', 'project-folders', '', 'small', 'folder') + button('Export project JSON', 'project-export', '', 'small', 'download') : ''}${button('Import project JSON', 'project-import', '', 'small', 'file')}${button('Load companion project', 'project-example', '', 'small', 'box')}</div>
    <p class="small muted">Import replaces the one project only after review. Recovery snapshots below are a different format. The shell handoff currently prints JSON only.</p></section>`;
}
function companionImportDialog() {
  const u = projectTransferUi, p = u.candidate, current = project();
  const summary = p ? `<section class="card mt16" id="project-import-summary" tabindex="-1"><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><dl class="receipt"><dt>Plugin ID</dt><dd>${esc(p.id)}</dd><dt>Design</dt><dd>${p.design.nodes.length} surfaces · ${p.design.prds.length} PRDs · ${allRequirements(p.design).length} requirements</dd><dt>Models</dt><dd>${p.design.semantic?.entities.length || 0} entities · ${p.design.dataSources?.sources.length || 0} data sources · ${p.design.library.length} components</dd><dt>Codebase / tests</dt><dd>${esc(p.folders.codebaseFolder)} / ${esc(p.folders.testsFolder)}</dd><dt>Review findings</dt><dd>${designIssues(p.design).length} — a valid draft is not generation readiness</dd></dl>
    <label class="checkbox"><input type="checkbox" id="project-import-confirm"><span>${current ? 'Replace ' + esc(current.name) + ' with this project.' : 'Load this project into the current workspace.'} Clear simulated runs, approvals and prepared state. Keep host files.</span></label></section>` : '';
  return dialogBody('Import a full project', `<p>Choose an export or paste JSON, then review it. Use the file picker for large exports. No file is executed. Your current project is unchanged until confirmation.</p>
    <div class="field"><label for="project-import-file">Project JSON file (up to 4 MB)</label><input type="file" id="project-import-file" accept=".json,application/json" ${u.loading ? 'disabled' : ''}></div>
    <p class="small" role="status">${u.loading ? 'Reading selected file…' : esc(u.filename)}</p>
    <div class="field"><label for="project-import-text">Or paste the full project JSON</label><textarea id="project-import-text" rows="7" data-field="project-import-text" spellcheck="false" ${u.loading ? 'disabled' : ''}>${esc(u.text)}</textarea></div>
    <p class="small muted">Includes saved identity, requirements, screens, component content/variants, entities, source operations, test recipes, design tokens, arrangement, notes and folders. Excludes unsubmitted drafts, execution trust, machine paths, generated files and test receipts.</p>
    <div class="error" id="project-transfer-error" role="alert" tabindex="-1">${esc(u.error)}</div>${summary}`,
    button('Cancel', 'close', '', 'ghost') + (current ? button('Export current project', 'project-backup', '', '', 'download') : '') +
    button('Review JSON', 'project-import-review', '', '', 'search', u.loading ? 'disabled' : '') +
    button(current ? 'Replace project' : 'Import project', 'project-import-apply', '', 'primary', 'file', !p || u.loading ? 'disabled' : ''));
}
function openCompanionFolders() {
  if (!project() || state.activeRun || tdUi.busy) return notify('Define a project and finish any current operation first.');
  projectFoldersDraft = { ...companionFolders(), snapshot: companionProjectToken(), error: '' };
  showModal('project-folders');
}
function companionFoldersDialog() {
  const f = projectFoldersDraft;
  return dialogBody('Project folders', `<p>Paths are relative to the future project target inside your vault. They do not relocate the current shell, rename source files, or change your test-vault target.</p>
    ${field('Codebase folder', 'project-codebase-folder', f.codebaseFolder, 'Default: src. Example: plugin/src.')}
    ${field('Tests folder', 'project-tests-folder', f.testsFolder, 'Default: tests. Example: plugin/tests.')}
    <p class="small muted">Use separate portable relative folders. Absolute paths, parent traversal, reserved host folders and overlapping folders are rejected. Existing illustrative scaffold previews retain their legacy src/tests layout; this setting belongs to the new JSON handoff.</p>
    <div class="error" role="alert" id="project-folders-error" tabindex="-1">${esc(f.error)}</div>`, button('Cancel', 'close', '', 'ghost') + button('Save folders', 'project-folders-save', '', 'primary'));
}
function saveCompanionFolders() {
  const f = projectFoldersDraft;
  try {
    companionCanReplace(f.snapshot);
    const folders = validateCompanionFolders({ codebaseFolder: f.codebaseFolder, testsFolder: f.testsFolder });
    const before = state, p = project();
    state = { ...state, project: { ...p, folders, rev: p.rev + 1 }, wizard: null, generator: { ...state.generator, plan: null } };
    if (!saveConceptState()) { state = before; throw Error('Folder settings could not be saved. The previous settings are unchanged.'); }
    designUi.plan = null; modalOriginal = null; closeModal(); render(); notify('Project folder settings saved. No files were moved or generated.');
  } catch (error) { f.error = error.message; redrawModal(); document.getElementById('project-folders-error')?.focus(); }
}
function handleCompanionTransfer(action) {
  const actions = { 'project-export': companionExport, 'project-import': openCompanionImport,
    'project-example': () => openCompanionImport(true), 'project-import-review': reviewCompanionImport,
    'project-import-apply': applyCompanionImport, 'project-folders': openCompanionFolders, 'project-folders-save': saveCompanionFolders,
    'project-handoff': () => showModal('project-handoff'),
    'project-backup': () => downloadText({ text: companionJson(), filename: project().id + '.companion.json' }) };
  if (!Object.hasOwn(actions, action)) return false;
  actions[action](); return true;
}
function editCompanionTransfer(el) {
  if (el.dataset.field === 'project-import-text') {
    projectTransferUi.serial++; projectTransferUi.text = el.value; projectTransferUi.candidate = null;
    projectTransferUi.error = '';
    // Keep a large pasted document in its existing textarea, preserving caret and
    // avoiding a full modal replacement on every keystroke.
    document.getElementById('project-import-summary')?.remove();
    document.getElementById('project-transfer-error').textContent = '';
    document.querySelector('#modal [data-action="project-import-apply"]').disabled = true;
    return true;
  }
  const key = { 'project-codebase-folder': 'codebaseFolder', 'project-tests-folder': 'testsFolder' }[el.dataset.field];
  if (!key || !projectFoldersDraft) return false;
  projectFoldersDraft[key] = el.value; return true;
}
document.addEventListener('change', event => {
  if (event.target.id === 'project-import-file') void readCompanionImportFile(event.target.files[0]);
});
document.getElementById('modal').addEventListener('close', () => { projectTransferUi.serial++; });
function companionHandoffDialog() {
  const folders = companionFolders(), filename = (project()?.id || 'my-plugin') + '.companion.json';
  return dialogBody('Project JSON → shell script', `<p>Export the full project, save it locally, then run this command from the shell checkout. Use your actual vault directory.</p>
    ${command('npm run --silent companion:generate -- --input "' + filename + '" --vault "/path/to/vault" --target "."')}
    <p><strong>Version 1 returns the supplied JSON only.</strong> It validates the envelope and contained target, prints the original bytes to stdout, and writes nothing. Full boilerplate generation is the next implementation stage.</p>
    <dl class="receipt"><dt>Future codebase</dt><dd>&lt;target&gt;/${esc(folders.codebaseFolder)}/</dd><dt>Future tests</dt><dd>&lt;target&gt;/${esc(folders.testsFolder)}/</dd></dl>
    <p class="small muted">Use a nested relative target such as plugins/companion when needed. Target and folder checks do not authorize installation or execution. The browser never launches the shell.</p>`,
    button('Close', 'close', '', 'ghost') + (project() ? button('Export project JSON', 'project-export', '', 'primary', 'download') : ''));
}
