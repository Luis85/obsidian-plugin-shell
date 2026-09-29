import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useWorkspaceEnvironment, type EditorMount } from './contracts.ts';
import { importJourneyProject, projectFilePath, type JourneyProjectDocument } from '../../../../../scripts/companion/journey/project-store.ts';

/** Per-view document controls. Canonical project writes belong to the shared runtime owner. */
export function useWorkspace() {
  const env = useWorkspaceEnvironment(), root = ref<HTMLElement | null>(null), path = ref(env.initialPath);
  const activePath = ref(''), busy = ref(false), loaded = ref(false), readingImport = ref(false);
  const message = ref('Open an existing project, or explicitly create one from the generated definition.');
  const error = ref(''), importOpen = ref(false), importText = ref(''), importMode = ref<'create' | 'replace'>('create'), confirmed = ref(false);
  const recoveryOpen = ref(false), recoveryConfirmed = ref(false), recoveryPath = ref(''), changed = ref(false);
  const summary = ref(''), reviewed = ref(false), native = env.mode === 'native';
  let document: JourneyProjectDocument | undefined, editor: EditorMount | undefined, stopChanges = () => {}, stopped = false;
  let importRead = 0, returnToImport = false, failedPath = '', trigger: Element | null = null;
  let staged: { text: string; path: string; mode: 'create' | 'replace'; target: JourneyProjectDocument } | undefined;
  const downloads = new Set<string>();
  const isWorking = () => busy.value || !!editor?.isBusy();
  const working = computed(() => busy.value || (loaded.value && !!editor?.isBusy()));
  const canReplace = computed(() => loaded.value && activePath.value === path.value && !changed.value);
  const canLeave = () => !stopped && !isWorking() && !importOpen.value && !recoveryOpen.value && (!editor || editor.canLeave());
  const stopGuard = env.guard(canLeave);
  function revoke(url: string) { if (downloads.delete(url)) URL.revokeObjectURL(url); }
  function download(value: string, name: string) {
    const doc = root.value?.ownerDocument, win = doc?.defaultView; if (stopped || !doc || !win) return;
    const url = URL.createObjectURL(new Blob([value], { type: 'application/json' })); downloads.add(url);
    try {
      const link = doc.createElement('a'); link.href = url; link.download = name; link.click();
      win.setTimeout(() => revoke(url), 1000);
    } catch { revoke(url); throw Error('PROJECT_DOWNLOAD'); }
  }
  function exportSaved() {
    try { if (document) download(document.export(), 'project.companion.json'); }
    catch { error.value = 'Project export failed. The saved file is unchanged; keep this view open and try the download again.'; }
  }
  function exportRecovery() {
    try { if (editor) download(JSON.stringify(editor.recovery(), null, 2), 'journey-lens-recovery.json'); }
    catch { error.value = 'Recovery download failed. Keep this view open to retain its unsaved draft.'; }
  }
  function focusReview(capture = true) {
    if (capture) trigger = root.value?.ownerDocument.activeElement ?? null;
    void nextTick(() => {
      if (!stopped && (importOpen.value || recoveryOpen.value))
        root.value?.closest('.jl-workspace')?.querySelector<HTMLElement>('[data-jl-review-title]')?.focus();
    });
  }
  function restoreFocus() {
    void nextTick(() => {
      if (stopped) return;
      if (trigger?.isConnected && 'focus' in trigger && typeof trigger.focus === 'function') trigger.focus();
      else root.value?.closest('.jl-workspace')?.querySelector<HTMLElement>('[aria-label="Project file"]')?.focus();
    });
  }
  function release() {
    const previousEditor = editor, previousDocument = document, unsubscribe = stopChanges;
    editor = undefined; document = undefined; stopChanges = () => {}; loaded.value = false; activePath.value = '';
    try { unsubscribe(); } finally { try { previousEditor?.unmount(); } finally { previousDocument?.dispose(); } }
  }
  function clearStaged() { if (staged && staged.target !== document) staged.target.dispose(); staged = undefined; }
  function retainReviewFocus(previous: Element | null) {
    void nextTick(() => {
      const doc = root.value?.ownerDocument;
      if (previous && !previous.isConnected && doc?.activeElement === doc?.body) focusReview(false);
    });
  }
  function invalidateReview() {
    const previous = reviewed.value ? root.value?.ownerDocument.activeElement ?? null : null;
    importRead++; readingImport.value = false; confirmed.value = false; reviewed.value = false; summary.value = ''; clearStaged();
    // Schedule after the mutations queue Vue's DOM update, not before the control is removed.
    if (previous) retainReviewFocus(previous);
  }
  async function attach(candidate: JourneyProjectDocument) {
    if (stopped) { candidate.dispose(); return; }
    release(); document = candidate; loaded.value = true; activePath.value = candidate.path; changed.value = false;
    await nextTick(); if (stopped || !root.value) { candidate.dispose(); return; }
    const host = {
      selected: null, ownerId: env.ownerId, storageLabel: native ? 'Saved project · vault file' : 'Preview memory only · no data saved to the vault',
      read: () => candidate.read(), validate: (design: Parameters<JourneyProjectDocument['validate']>[0]) => candidate.validate(design),
      save: (request: Parameters<JourneyProjectDocument['save']>[0]) => candidate.save(request),
      select() {}, openPage: (surface: string) => env.navigate('page', surface),
      openComponents: () => env.navigate('components'), openSources: () => env.navigate('sources'),
      importProject: () => beginImport(), exportProject: exportSaved,
      exportRecovery: (value: unknown) => download(JSON.stringify(value, null, 2), 'journey-lens-recovery.json'),
    };
    try {
      const mounted = env.mount(root.value, host); editor = mounted; await mounted.ready;
      if (stopped || editor !== mounted) return;
      stopChanges = candidate.subscribe(event => {
        if (event.origin === candidate || stopped) return;
        invalidateReview(); changed.value = true; editor?.invalidate();
        message.value = event.uncertain ? 'Storage outcome is uncertain. Download recovery and review the saved file before continuing.' : 'Another view or an external edit changed this project. Your draft is retained; review recovery before reloading.';
      });
      env.rememberPath(candidate.path); failedPath = ''; path.value = candidate.path;
      message.value = native ? 'Apply saves each reviewed change to the active vault file.' : 'Preview memory only. Export JSON to keep your work; resetting or closing this preview discards it.';
    } catch {
      if (!stopped) { release(); error.value = 'The editor could not mount. No additional project write was made. Reopen the saved file.'; }
    }
  }
  async function openFile() {
    if (!canLeave()) { error.value = 'Save or cancel the current edit before opening another project.'; return; }
    let candidate: JourneyProjectDocument;
    try { candidate = env.store.connect(projectFilePath(path.value)); }
    catch { error.value = 'Use a visible vault-relative .json or .companion path.'; return; }
    busy.value = true; error.value = '';
    try { await candidate.read(); await attach(candidate); }
    catch { candidate.dispose(); if (!stopped) error.value = 'Could not open this project. Existing files and the current editor are unchanged. Check the path and project format.'; }
    finally { busy.value = false; }
  }
  function beginImport(seed = false) {
    if (!canLeave()) { error.value = 'Save or cancel the current edit before importing.'; return; }
    invalidateReview(); failedPath = ''; importOpen.value = true; importText.value = seed ? env.seed : ''; importMode.value = 'create'; error.value = ''; focusReview();
  }
  function cancelImport() {
    if (stopped || isWorking()) return;
    invalidateReview(); importOpen.value = false; error.value = ''; restoreFocus();
  }
  async function readImport(file: File | undefined) {
    if (!file || stopped || isWorking() || !importOpen.value) return;
    invalidateReview(); const read = importRead; error.value = '';
    if (file.size > 4_000_000) { error.value = 'Project files must be at most 4 MB.'; return; }
    readingImport.value = true;
    try {
      const text = await file.text();
      if (!stopped && read === importRead && importOpen.value) importText.value = text;
    } catch { if (!stopped && read === importRead) error.value = 'The selected file could not be read. Select it again or paste the project JSON.'; }
    finally { if (read === importRead) readingImport.value = false; }
  }
  function reviewImport() {
    if (stopped || isWorking() || readingImport.value || !importOpen.value) return;
    invalidateReview();
    try {
      const candidate = importJourneyProject(importText.value), targetPath = projectFilePath(path.value);
      if (importMode.value === 'replace' && (!canReplace.value || !document)) throw Error('OPEN_FIRST');
      staged = { text: importText.value, path: targetPath, mode: importMode.value, target: importMode.value === 'replace' ? document! : env.store.connect(targetPath) };
      summary.value = `${candidate.project.name} · ${candidate.design.nodes.length} surfaces · project v6. ${importMode.value === 'replace' ? 'Replace the complete currently opened project' : 'Create a new file; never overwrite an existing destination'}: ${targetPath}`;
      reviewed.value = true; error.value = '';
    } catch { error.value = 'Import was not approved. Validate the full project and path; open a current file before choosing Replace.'; }
  }
  async function applyImport() {
    if (stopped || isWorking() || readingImport.value || !importOpen.value || !confirmed.value || !reviewed.value || !staged) return;
    if (staged.text !== importText.value || staged.path !== path.value || staged.mode !== importMode.value) { invalidateReview(); error.value = 'Import inputs changed. Review them again.'; return; }
    const request = staged; busy.value = true; confirmed.value = false; reviewed.value = false; error.value = '';
    try {
      const result = await request.target.importProject(request.text, request.mode);
      if (stopped) return;
      if (result.status !== 'committed') {
        failedPath = request.path;
        error.value = result.status === 'conflict' ? 'The destination exists or changed since you opened it. Nothing was overwritten. Review the saved file before continuing.' : result.certainty === 'unchanged' ? 'The write was refused. No file changed; check the parent folder and recovery status, then review again.' : 'The write did not complete reliably. Do not retry; review the saved file through recovery.';
        if (request.path === activePath.value) { changed.value = true; editor?.invalidate(); }
        return;
      }
      const target = env.store.connect(request.path); importOpen.value = false; invalidateReview(); await attach(target); restoreFocus();
    } catch { if (!stopped) { failedPath = request.path; error.value = 'Import could not be completed. Review the saved file before another write; no automatic retry was made.'; } }
    finally { clearStaged(); busy.value = false; }
  }
  function beginRecovery() {
    if (stopped || isWorking() || recoveryOpen.value) return;
    returnToImport = importOpen.value; recoveryPath.value = failedPath || activePath.value || path.value;
    invalidateReview(); importOpen.value = false; recoveryOpen.value = true; recoveryConfirmed.value = false; focusReview();
  }
  function cancelRecovery() {
    if (stopped || isWorking()) return;
    recoveryConfirmed.value = false; recoveryOpen.value = false; importOpen.value = returnToImport; returnToImport = false;
    if (importOpen.value) focusReview(false); else restoreFocus();
  }
  async function restoreRecovery(file: File | undefined) {
    if (!file || stopped || isWorking() || !editor || !recoveryOpen.value) return;
    if (file.size > 4_000_000) { error.value = 'Recovery files must be at most 4 MB.'; return; }
    const active = editor; busy.value = true; error.value = '';
    try {
      const value = JSON.parse(await file.text()); if (stopped || editor !== active) return;
      if (await active.restore(value) !== true) throw Error('RECOVERY_INVALID');
      recoveryOpen.value = false; returnToImport = false; recoveryConfirmed.value = false;
      message.value = 'Draft restored against this exact saved design. Apply is still required to save it.'; restoreFocus();
    } catch { if (!stopped) error.value = 'Recovery does not match this saved project, or is invalid. No project file was changed.'; }
    finally { busy.value = false; }
  }
  async function reloadStored() {
    if (stopped || !recoveryOpen.value || !recoveryConfirmed.value || isWorking()) return;
    busy.value = true; recoveryConfirmed.value = false; error.value = '';
    let candidate: JourneyProjectDocument | undefined;
    try {
      candidate = env.store.connect(projectFilePath(recoveryPath.value)); await candidate.recover();
      if (stopped) { candidate.dispose(); return; }
      recoveryOpen.value = false; importOpen.value = false; returnToImport = false; invalidateReview(); await attach(candidate); restoreFocus();
    } catch { candidate?.dispose(); if (!stopped) error.value = 'Stored project is missing or invalid. Recovery did not discard your current draft or repair the file.'; }
    finally { busy.value = false; }
  }
  function escapeReview(event: KeyboardEvent) {
    if (event.defaultPrevented || (!importOpen.value && !recoveryOpen.value)) return;
    event.preventDefault(); event.stopPropagation(); if (isWorking()) return;
    if (recoveryOpen.value) cancelRecovery(); else cancelImport();
  }
  onMounted(() => { void openFile(); });
  onBeforeUnmount(() => { stopped = true; invalidateReview(); stopGuard(); for (const url of downloads) revoke(url); release(); });
  return { root,path,activePath,busy,working,loaded,message,error,native,changed,importOpen,importText,importMode,confirmed,summary,reviewed,canReplace,readingImport,
    openFile,beginImport,cancelImport,restoreRecovery,readImport,reviewImport,applyImport,invalidateReview,exportSaved,exportRecovery,escapeReview,
    recoveryOpen,recoveryConfirmed,recoveryPath,beginRecovery,reloadStored,cancelRecovery };
}
