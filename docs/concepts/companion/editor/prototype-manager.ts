import { prototypeApi as api } from '../../../../scripts/companion/prototypes/api.ts';
import type { PrototypeAction, PrototypeSelection } from '../../../../scripts/companion/prototypes/model.ts';
import { prototypeView } from './prototype-view.ts';
import { prototypeNavigation, type PrototypeBrowse } from './prototype-navigation.ts';
import type { PrototypeForm, PrototypeHost } from './prototype-host.ts';
/** Typed DOM island; the existing host remains the only project persistence owner. */
export function mountPrototypes(root: HTMLElement, host: PrototypeHost) {
  let selection: PrototypeSelection | null = null, mode: PrototypeForm = '', message = '', error = false, busy = false, closed = false;
  let renderedKey = '', draft: Record<string,string> = {}, slugEdited = false, comparison: string | null = null;
  const browse: PrototypeBrowse = {query:'',status:'all'};
  function pick(key: string): PrototypeSelection {
    const [prototypeId = '',versionId = '',variantId = '',extra] = key.split('/');
    if (extra !== undefined) throw Error('Choose an existing saved variant.');
    return {prototypeId,versionId,variantId};
  }
  function draw() {
    if (closed) return;
    const snapshot = host.read(); renderedKey = api.key(snapshot.workspace);
    if (selection) { try { api.selected(snapshot.workspace,selection); } catch { selection = null; } }
    if (!selection) {
      // Editor context may outlive a replaced/imported workspace; validate it before restoring.
      for (const candidate of [snapshot.opened, snapshot.workspace.active]) {
        if (!candidate) continue;
        try { api.selected(snapshot.workspace,candidate); selection = {...candidate}; break; }
        catch { /* A stale remembered selection must not prevent opening this workspace. */ }
      }
      if (!selection) {
        const p = snapshot.workspace.prototypes[0], v = p?.versions[0], x = v?.variants[0];
        selection = p && v && x ? {prototypeId:p.id,versionId:v.id,variantId:x.id} : null;
      }
    }
    root.innerHTML = prototypeView(snapshot,selection,mode,message,error,busy,browse,comparison);
    for (const input of root.querySelectorAll<HTMLInputElement>('.pm-form input')) if (Object.hasOwn(draft,input.name)) input.value = draft[input.name]!;
  }
  function discardForm() {
    if (mode && !host.confirm('Discard the unsubmitted prototype form?')) return false;
    mode = ''; draft = {}; slugEdited = false; return true;
  }
  function change(action: PrototypeAction) {
    const snapshot = host.read();
    if (api.key(snapshot.workspace) !== renderedKey) throw Error('The project changed. Review the refreshed workspace before saving.');
    if (!snapshot.writable) throw Error('Editing is paused. Resolve the current operation or storage conflict first.');
    host.save(api.change(snapshot.workspace,action),renderedKey);
    mode = ''; draft = {}; message = 'Saved to this browser project. Export the workspace to persist it through the shell.';
  }
  function focusAfter(action?: string) {
    const controls = [...root.querySelectorAll<HTMLElement>('[data-pm]')];
    const target = error ? root.querySelector<HTMLElement>('[role="alert"]') : mode ? root.querySelector<HTMLElement>('.pm-form input')
      : (action === 'select' ? root.querySelector<HTMLElement>('.pm-row.selected') : controls.find(el => el.dataset.pm === action && !el.hasAttribute('disabled')))
        ?? root.querySelector<HTMLElement>('.pm-row.selected,.pm-message');
    if (target) { if (target.matches('[role="alert"],.pm-message')) target.tabIndex = -1; target.focus(); }
  }
  async function run(operation: () => void | Promise<void>) {
    if (busy || closed) return;
    const action = root.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.pm : undefined;
    error = false;
    try {
      busy = true; root.setAttribute('aria-busy','true');
      for (const control of root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input,select,button')) control.disabled = true;
      await operation();
    } catch (cause) { message = cause instanceof Error ? cause.message : 'The operation failed. No success is assumed.'; error = true; }
    finally {
      busy = false; root.removeAttribute('aria-busy');
      if (!closed) {
        try { draw(); focusAfter(action); }
        catch {
          const alert = document.createElement('p'); alert.className = 'pm-alert'; alert.setAttribute('role','alert'); alert.tabIndex = -1;
          alert.textContent = 'The project is unavailable. Reopen Manage prototypes to refresh. Unsubmitted form text is retained below.';
          root.prepend(alert); alert.focus();
        }
      }
    }
  }
  const click = (event: MouseEvent) => {
    if (busy || !(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('[data-pm]');
    if (!button || !root.contains(button) || button.disabled) return;
    event.preventDefault(); event.stopPropagation();
    const action = button.dataset.pm;
    if (mode && !['cancel','export','directory','generate','compare','reset-filter'].includes(action ?? '') && !discardForm()) return;
    if (['create','fork','version','details','prototype-details','version-details'].includes(action ?? '')) {
      mode = action as PrototypeForm; draft = {}; slugEdited = false; draw(); root.querySelector<HTMLInputElement>('.pm-form input')?.focus(); return;
    }
    if (action === 'cancel') { mode = ''; draft = {}; draw(); focusAfter('create'); return; }
    if (action === 'compare') { comparison = comparison === null ? 'working' : null; draw(); root.querySelector<HTMLElement>('[data-pm-comparison],[data-pm="compare"]')?.focus(); return; }
    if (action === 'reset-filter') { browse.query = ''; browse.status = 'all'; draw(); root.querySelector<HTMLElement>('[data-pm-query]')?.focus(); return; }
    if (action === 'import') { root.querySelector<HTMLInputElement>('.pm-import')?.click(); return; }
    void run(async () => {
      const snapshot = host.read();
      if (action === 'select') {
        const next = pick(button.dataset.key ?? ''); api.selected(snapshot.workspace,next);
        selection = next; message = ''; return;
      }
      if (action === 'export' || action === 'directory') { await host.exportWorkspace(action === 'export' ? 'json' : 'directory'); message = 'Export created. No vault files or installed plugins were changed.'; return; }
      if (action === 'generate') { host.exportActive(); message = 'Exported the pinned saved variant, not the current working copy.'; return; }
      if (action === 'deactivate') { if (host.confirm('Deactivate the generator variant? Managed generation will be blocked until another variant is activated.')) change({type:'deactivate'}); return; }
      if (!selection) throw Error('Select a variant first.');
      const item = api.selected(snapshot.workspace,selection);
      if (action === 'open') {
        if (host.confirm('Replace the current working design with this saved snapshot? Save current work to a draft first. The active generator variant will not change.')) host.open(selection,renderedKey);
      } else if (action === 'save') {
        if (host.confirm('Replace this draft snapshot with the complete current working design? Seal a version or fork first to retain its prior contents.')) change({type:'save',selection,document:snapshot.working});
      } else if (action === 'restore-snapshot') {
        if (!comparison || comparison === 'working') throw Error('Choose a saved reference to restore.');
        const source = pick(comparison), origin = api.selected(snapshot.workspace,source);
        let number = 1; while (item.prototype.versions.some(v => v.id === 'recovery-' + number)) number++;
        const recoveryId = 'recovery-' + number;
        if (host.confirm(`Restore ${origin.variant.name} into ${item.variant.name}? The previous draft will be retained in sealed version ${recoveryId}. Working copy and generator selection will not change.`)) change({type:'restore-snapshot',selection,source,recoveryId});
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
    event.preventDefault(); event.stopPropagation(); if (busy) return;
    const fields = new FormData(event.target), value = (name:string) => String(fields.get(name) ?? '').trim();
    for (const [key,item] of fields) if (typeof item === 'string') draft[key] = item;
    void run(() => {
      const id = value('id'), name = value('name'), hypothesis = value('hypothesis');
      if (mode === 'create') { change({type:'create',id,name,description:value('description'),document:host.read().working}); selection = {prototypeId:id,versionId:'v1',variantId:'main'}; }
      else if (selection && mode === 'fork') { change({type:'fork',selection,id,name,hypothesis}); selection = {...selection,variantId:id}; }
      else if (selection && mode === 'version') { const old = {...selection}; change({type:'version',prototypeId:old.prototypeId,id,from:old.versionId}); selection = {...old,versionId:id}; }
      else if (selection && mode === 'details') change({type:'details',selection,name,hypothesis});
      else if (selection && mode === 'prototype-details') change({type:'prototype-details',prototypeId:selection.prototypeId,name,description:value('description')});
      else if (selection && mode === 'version-details') change({type:'version-details',prototypeId:selection.prototypeId,versionId:selection.versionId,label:value('label')});
    });
  };
  function filterList(focus: string) {
    const previous = root.querySelector<HTMLInputElement>(focus), start = previous?.selectionStart, end = previous?.selectionEnd;
    const list = root.querySelector('.pm-list');
    if (list) list.innerHTML = prototypeNavigation(host.read().workspace,selection,browse);
    const input = root.querySelector<HTMLInputElement>(focus); input?.focus();
    if (input?.tagName === 'INPUT' && start != null && end != null) input.setSelectionRange(start,end);
    // Only the list changes; a form or comparison draft is never remounted by typing a filter.
  }
  const input = (event: Event) => {
    if (busy || !(event.target instanceof HTMLInputElement)) return;
    if (event.target.hasAttribute('data-pm-query')) { browse.query = event.target.value; filterList('[data-pm-query]'); return; }
    if (!event.target.closest('.pm-form')) return;
    const {name,value} = event.target;
    if (!['id','name','label','description','hypothesis'].includes(name)) return;
    draft[name] = value;
    if (name === 'id') slugEdited = true;
    if (mode === 'create' && name === 'name' && !slugEdited) {
      let slug = value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      if (/^[0-9]/.test(slug)) slug = 'prototype-' + slug;
      draft.id = slug.slice(0,48).replace(/-$/,'');
      const id = root.querySelector<HTMLInputElement>('.pm-form [name="id"]'); if (id) id.value = draft.id;
    }
  };
  const changeInput = (event: Event) => {
    if (busy) return;
    if (event.target instanceof HTMLSelectElement) {
      if (event.target.hasAttribute('data-pm-status')) { browse.status = event.target.value; filterList('[data-pm-status]'); }
      if (event.target.hasAttribute('data-pm-comparison')) { comparison = event.target.value; draw(); root.querySelector<HTMLElement>('[data-pm-comparison]')?.focus(); }
      return;
    }
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
  const keyboard = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && mode && !busy) { event.preventDefault(); event.stopPropagation(); if (discardForm()) { draw(); focusAfter('create'); } }
  };
  root.addEventListener('click',click); root.addEventListener('submit',submit); root.addEventListener('input',input); root.addEventListener('change',changeInput); root.addEventListener('keydown',keyboard);
  root.classList.add('pm-workspace'); draw();
  return { canLeave: () => !busy && discardForm(), unmount() {
    closed = true; root.removeEventListener('click',click); root.removeEventListener('submit',submit); root.removeEventListener('input',input); root.removeEventListener('change',changeInput); root.removeEventListener('keydown',keyboard); root.replaceChildren();
  } };
}
