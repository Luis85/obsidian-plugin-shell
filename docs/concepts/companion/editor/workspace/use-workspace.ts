import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useWorkspaceEnvironment, type EditorMount } from './contracts.ts';
import { importJourneyProject, projectFilePath, type JourneyProjectDocument } from '../../../../../scripts/companion/journey/project-store.ts';

/** Per-view document controls. Canonical project writes are delegated to the shared runtime owner. */
export function useWorkspace() {
  const env = useWorkspaceEnvironment(), root = ref<HTMLElement | null>(null), path = ref(env.initialPath);
  const busy = ref(false), loaded = ref(false), message = ref('Open an existing project, or explicitly create one from the generated definition.');
  const error = ref(''), importOpen = ref(false), importText = ref(''), importMode = ref<'create' | 'replace'>('create'), confirmed = ref(false);
  const recoveryOpen = ref(false), recoveryConfirmed = ref(false), changed = ref(false);
  let document: JourneyProjectDocument | undefined, editor: EditorMount | undefined, stopChanges = () => {}, stopped = false;
  let importRead=0;
  let staged: { text: string; path: string; mode: 'create' | 'replace'; target: JourneyProjectDocument } | undefined;
  const summary = ref(''), reviewed = ref(false);
  const native = env.mode === 'native';
  const canReplace = computed(() => loaded.value && document?.path === path.value);
  const canLeave = () => !busy.value && !importOpen.value && !recoveryOpen.value && (!editor || editor.canLeave());
  const stopGuard = env.guard(canLeave);
  function download(value: string, name: string) {
    const doc = root.value?.ownerDocument; if (!doc) return;
    const win = doc.defaultView; if (!win) return;
    const url = URL.createObjectURL(new Blob([value], { type: 'application/json' }));
    const link = doc.createElement('a'); link.href = url; link.download = name; link.click();
    win.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportSaved() { try { if (document) download(document.export(), 'project.companion.json'); } catch { error.value = 'Open a valid project before exporting.'; } }
  function exportRecovery() {
    if (editor) download(JSON.stringify(editor.recovery(), null, 2), 'journey-lens-recovery.json');
  }
  function release() { stopChanges(); stopChanges = () => {}; editor?.unmount(); editor = undefined; document?.dispose(); document = undefined; }
  async function attach(candidate: JourneyProjectDocument) {
    if (stopped) { candidate.dispose(); return; }
    release(); document = candidate; loaded.value = true; changed.value = false;
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
      editor = env.mount(root.value, host); await editor.ready;
      stopChanges = candidate.subscribe(event => {
        if (event.origin === candidate || stopped) return;
        changed.value = true; editor?.invalidate();
        message.value = event.uncertain ? 'Storage outcome is uncertain. Export recovery and review the saved file before continuing.' : 'Another view changed this project. Your draft is retained; review recovery before reloading.';
      });
      env.rememberPath(candidate.path);
      message.value = native ? 'Editing the selected vault file. Apply saves each reviewed change.' : 'Preview memory only. Export JSON to keep your work; resetting or closing this preview discards it.';
    } catch { release(); loaded.value = false; error.value = 'The editor could not mount. The project file was not changed.'; }
  }
  async function openFile() {
    if (!canLeave()) { error.value = 'Save or cancel the current edit before opening another project.'; return; }
    let candidate: JourneyProjectDocument;
    try { candidate = env.store.connect(projectFilePath(path.value)); } catch { error.value = 'Use a visible vault-relative .json or .companion path.'; return; }
    busy.value = true; error.value = '';
    try { await candidate.read(); await attach(candidate); }
    catch { candidate.dispose(); error.value = 'Could not open this project. Existing files and the current editor are unchanged. Check the path and project format.'; }
    finally { busy.value = false; }
  }
  function beginImport(seed = false) {
    if (!canLeave()) { error.value = 'Save or cancel the current edit before importing.'; return; }
    importOpen.value = true; importText.value = seed ? env.seed : ''; importMode.value = 'create'; confirmed.value = false;
    staged = undefined; reviewed.value = false; summary.value = ''; error.value = '';
  }
  function cancelImport() { if (busy.value) return; importRead++; if (staged && staged.target !== document) staged.target.dispose(); staged = undefined; importOpen.value = false; reviewed.value = false; }
  function invalidateReview() { confirmed.value = false; reviewed.value = false; }
  async function restoreRecovery(file: File | undefined) {
    if(!file||busy.value||!editor||!recoveryOpen.value)return;
    if(file.size>4_000_000){error.value='Recovery files must be at most 4 MB.';return;}
    const active=editor; busy.value=true;
    try{const value=JSON.parse(await file.text());if(stopped||editor!==active)return;if(await active.restore(value)!==true)throw Error('RECOVERY_INVALID');recoveryOpen.value=false;message.value='Draft restored against this exact saved design. Apply is still required to save it.';}
    catch{error.value='Recovery does not match this saved project, or is invalid. No project file was changed.';}
    finally{busy.value=false;}
  }
  async function readImport(file: File | undefined) {
    if (!file || busy.value || !importOpen.value) return;
    const read=++importRead;
    if (file.size > 4_000_000) { error.value = 'Project files must be at most 4 MB.'; return; }
    try { const text=await file.text(); if(stopped||read!==importRead||!importOpen.value)return;importText.value=text;invalidateReview(); } catch { if(!stopped&&read===importRead)error.value = 'The selected file could not be read.'; }
  }
  function reviewImport() {
    if (busy.value || !importOpen.value) return;
    try {
      const candidate = importJourneyProject(importText.value), targetPath = projectFilePath(path.value);
      if (importMode.value === 'replace' && (!document || document.path !== targetPath)) throw Error('OPEN_FIRST');
      if (staged && staged.target !== document) staged.target.dispose();
      staged = { text: importText.value, path: targetPath, mode: importMode.value, target: importMode.value === 'replace' ? document! : env.store.connect(targetPath) };
      summary.value = `${candidate.project.name} · ${candidate.design.nodes.length} surfaces · project v6. ${importMode.value === 'replace' ? 'Replace the complete currently opened project' : 'Create a new file; never overwrite an existing destination'}: ${targetPath}`;
      reviewed.value = true; confirmed.value = false; error.value = '';
    } catch { reviewed.value = false; error.value = 'Import was not approved. Validate the full project and path; open an existing file before choosing Replace.'; }
  }
  async function applyImport() {
    if (busy.value || !importOpen.value || !confirmed.value || !reviewed.value || !staged) return;
    if (staged.text !== importText.value || staged.path !== path.value || staged.mode !== importMode.value) { invalidateReview(); error.value = 'Import inputs changed. Review them again.'; return; }
    busy.value = true; error.value = '';
    try {
      const result = await staged.target.import(staged.text, staged.mode);
      if (stopped) return;
      if (result.status !== 'committed') {
        error.value = result.status === 'conflict' ? 'The destination exists or changed since you opened it. Nothing was overwritten.' : result.certainty==='unchanged'?'The write was refused. No file changed; check the parent folder and recovery status.':'The write did not complete reliably. Do not retry; review the saved file through recovery.';
        changed.value = true; editor?.invalidate(); return;
      }
      const target = env.store.connect(staged.path); if(staged.target!==document)staged.target.dispose();importOpen.value = false; reviewed.value = false; staged = undefined;
      await attach(target);
    } catch { error.value = 'Import could not be completed. Existing content is retained unless recovery reports an uncertain write.'; }
    finally { busy.value = false; }
  }
  function beginRecovery() { if (busy.value) return; recoveryOpen.value = true; recoveryConfirmed.value = false; }
  async function reloadStored() {
    if (!recoveryConfirmed.value || busy.value) return;
    busy.value = true; error.value = '';
    let candidate: JourneyProjectDocument | undefined;
    try {
      candidate = env.store.connect(document?.path ?? projectFilePath(path.value)); await candidate.recover();
      if (stopped) { candidate.dispose(); return; }
      recoveryOpen.value = false; importOpen.value = false;importRead++;if(staged&&staged.target!==document)staged.target.dispose();staged=undefined;reviewed.value=false;await attach(candidate);
    } catch { candidate?.dispose(); error.value = 'Stored project is missing or invalid. Recovery did not discard your current draft or repair the file.'; }
    finally { busy.value = false; }
  }
  onMounted(() => { void openFile(); });
  onBeforeUnmount(() => { stopped = true; stopGuard(); release(); if (staged) staged.target.dispose(); });
  return { root,path,busy,loaded,message,error,native,changed,importOpen,importText,importMode,confirmed,summary,reviewed,canReplace,
    openFile,beginImport,cancelImport,restoreRecovery,readImport,reviewImport,applyImport,invalidateReview,exportSaved,exportRecovery,
    recoveryOpen,recoveryConfirmed,beginRecovery,reloadStored };
}
