import { prototypeApi as api } from '../../../../scripts/companion/prototypes/api.ts';
import type { PrototypeAction, PrototypeSelection } from '../../../../scripts/companion/prototypes/model.ts';
import { prototypeView } from './prototype-view.ts';
import type { PrototypeForm, PrototypeHost } from './prototype-host.ts';
/** Small typed DOM island using the workbench's existing tokens; no second project store or global handlers. */
export function mountPrototypes(root: HTMLElement, host: PrototypeHost) {
  let selection: PrototypeSelection | null = null, mode: PrototypeForm = '', message = '', error = false, busy = false, closed = false;
  let renderedKey = '';
  const read = () => host.read();
  function draw() {
    if (closed) return;
    const snapshot = read(); renderedKey = api.key(snapshot.workspace);
    if (selection) { try { api.selected(snapshot.workspace,selection); } catch { selection = null; } }
    if (!selection) {
      const p = snapshot.workspace.prototypes[0], v = p?.versions[0], x = v?.variants[0];
      if (p && v && x) selection = { prototypeId:p.id,versionId:v.id,variantId:x.id };
    }
    root.innerHTML = prototypeView(snapshot,selection,mode,message,error,busy);
  }
  function change(action: PrototypeAction) {
    const snapshot = read();
    if (api.key(snapshot.workspace) !== renderedKey) throw Error('The project changed. Review the refreshed workspace before saving.');
    if (!snapshot.writable) throw Error('Editing is paused. Resolve the current operation or storage conflict first.');
    host.save(api.change(snapshot.workspace,action),renderedKey);
    mode = ''; message = 'Saved to this browser project. Export the workspace to persist it through the shell.';
  }
  async function run(operation: () => void | Promise<void>) {
    if (busy || closed) return;
    error = false;
    try { busy = true; root.setAttribute('aria-busy','true'); await operation(); }
    catch (cause) { message = cause instanceof Error ? cause.message : 'The operation failed. No success is assumed.'; error = true; }
    finally { busy = false; root.removeAttribute('aria-busy'); if (!closed) { draw(); root.querySelector<HTMLElement>(error ? '[role="alert"]' : '.pm-message')?.setAttribute('tabindex','-1'); } }
  }
  const click = (event: MouseEvent) => {
    if (busy || !(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('[data-pm]');
    if (!button || !root.contains(button) || button.disabled) return;
    event.preventDefault(); event.stopPropagation();
    const action = button.dataset.pm;
    if (['create','fork','version','details'].includes(action ?? '')) {
      mode = action as PrototypeForm; draw(); root.querySelector<HTMLInputElement>('.pm-form input')?.focus(); return;
    }
    if (action === 'cancel') { mode = ''; draw(); return; }
    if (action === 'import') { root.querySelector<HTMLInputElement>('.pm-import')?.click(); return; }
    void run(async () => {
      const snapshot = read();
      if (action === 'select') {
        const [i,j,k] = (button.dataset.index ?? '').split(',').map(Number);
        const p = snapshot.workspace.prototypes[i!], v = p?.versions[j!], x = v?.variants[k!];
        if (!p || !v || !x) throw Error('That selection no longer exists.');
        selection = { prototypeId:p.id,versionId:v.id,variantId:x.id }; mode = ''; message = ''; return;
      }
      if (action === 'export' || action === 'directory') { await host.exportWorkspace(action === 'export' ? 'json' : 'directory'); message = 'Export created. No vault files or installed plugins were changed.'; return; }
      if (action === 'generate') { host.exportActive(); message = 'Exported the pinned saved variant, not the current working copy.'; return; }
      if (action === 'deactivate') { if (host.confirm('Deactivate the generator variant? Managed generation will be blocked until another variant is activated.')) change({type:'deactivate'}); return; }
      if (!selection) throw Error('Select a variant first.');
      const item = api.selected(snapshot.workspace,selection);
      if (action === 'open') {
        if (host.confirm('Replace the current working design with this saved snapshot? Save current work to a draft first. The active generator variant will not change.')) host.open(selection,renderedKey);
        return;
      }
      if (action === 'save') {
        if (host.confirm('Replace this draft snapshot with the complete current working design? This includes its sitemap, pages, interactions and fixtures.')) change({type:'save',selection,document:snapshot.working});
      } else if (action === 'activate') {
        if (host.confirm('Use ' + item.variant.name + ' for generation? The previous active variant will become approved.')) change({type:'activate',selection});
      } else if (action === 'seal') {
        if (host.confirm('Seal this entire version? Its saved content cannot be edited or extended. Create a new version for further changes.')) change({type:'seal',prototypeId:selection.prototypeId,versionId:selection.versionId});
      } else if (action === 'archive') {
        if (host.confirm(item.prototype.archived ? 'Restore this prototype without activating it?' : 'Archive this prototype? All versions and snapshots are retained.')) change({type:'archive',prototypeId:selection.prototypeId,archived:!item.prototype.archived});
      } else if (action === 'draft' || action === 'review' || action === 'approved' || action === 'archived') change({type:'status',selection,status:action});
    });
  };
  const submit = (event: SubmitEvent) => {
    if (!(event.target instanceof HTMLFormElement)) return;
    const form = event.target; event.preventDefault(); event.stopPropagation();
    const fields = new FormData(form), value = (name:string) => String(fields.get(name) ?? '').trim();
    void run(() => {
      const id = value('id'), name = value('name'), hypothesis = value('hypothesis');
      if (mode === 'create') { change({type:'create',id,name,description:value('description'),document:read().working}); selection = {prototypeId:id,versionId:'v1',variantId:'main'}; }
      else if (selection && mode === 'fork') { change({type:'fork',selection,id,name,hypothesis}); selection = {...selection,variantId:id}; }
      else if (selection && mode === 'version') { const old = {...selection}; change({type:'version',prototypeId:old.prototypeId,id,from:old.versionId}); selection = {...old,versionId:id}; }
      else if (selection && mode === 'details') change({type:'details',selection,name,hypothesis});
    });
  };
  const importFile = (event: Event) => {
    if (!(event.target instanceof HTMLInputElement) || !event.target.classList.contains('pm-import')) return;
    const file = event.target.files?.[0]; if (!file) return;
    const expected = renderedKey;
    void run(async () => {
      if (file.size > 32_000_000) throw Error('Prototype workspace exceeds the 32 MB transport limit.');
      const text = await file.text(); if (closed) return;
      if (!host.confirm('Import this complete workspace? Conflicting or older snapshots are rejected. Export your current workspace before replacing it.')) return;
      host.importWorkspace(text,expected); message = 'Workspace imported; current working design was not replaced.';
    });
  };
  root.addEventListener('click',click); root.addEventListener('submit',submit); root.addEventListener('change',importFile);
  root.classList.add('pm-workspace'); draw();
  return { canLeave: () => !busy && (!mode || host.confirm('Discard the unsubmitted prototype form?')), unmount() {
    closed = true; root.removeEventListener('click',click); root.removeEventListener('submit',submit); root.removeEventListener('change',importFile); root.replaceChildren();
  } };
}
