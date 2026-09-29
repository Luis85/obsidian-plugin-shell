import type { PrototypeSelection, PrototypeWorkspace } from '../../../../scripts/companion/prototypes/model.ts';
import { prototypeApi as api } from '../../../../scripts/companion/prototypes/api.ts';
import type { PrototypeForm, PrototypeHost } from './prototype-host.ts';
const entities: Record<string, string> = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
export const pmEscape = (value: unknown): string => String(value).replace(/[&<>"']/g, c => entities[c]!);
const e = pmEscape;
const btn = (label: string, action: string, disabled = false, primary = false) => `<button type="button" class="btn ${primary ? 'primary' : ''}" data-pm="${action}"${disabled ? ' disabled' : ''}>${e(label)}</button>`;
const field = (name: string, label: string, value = '', required = true, max = 120) => `<label>${e(label)}<input name="${name}" value="${e(value)}" maxlength="${max}" ${required ? 'required' : ''}${name === 'id' ? ' pattern="[a-z][a-z0-9]*(?:-[a-z0-9]+)*"' : ''}></label>`;
function form(mode: PrototypeForm, workspace: PrototypeWorkspace, selection: PrototypeSelection | null): string {
  if (!mode) return '';
  const item = selection ? api.selected(workspace, selection) : null;
  const title = { create: 'Capture working design as a new prototype', fork: 'Fork saved variant', version: 'Create a new version', details: 'Edit variant details' }[mode];
  return `<form class="pm-form card" data-pm-form="${mode}" aria-label="${title}"><h2>${title}</h2>
    ${mode === 'details' ? '' : field('id', mode === 'version' ? 'New version slug' : mode === 'fork' ? 'New variant slug' : 'Prototype folder name', '', true, 48)}
    ${mode === 'version' ? '<p>Copies every variant from this version into editable drafts. The original version stays unchanged.</p>' : field('name', 'Display name', mode === 'details' ? item?.variant.name : '')}
    ${mode === 'create' ? field('description', 'Description (optional)', '', false, 2000) : mode === 'version' ? '' : field('hypothesis', 'What are you exploring? (optional)', mode === 'details' ? item?.variant.hypothesis : '', false, 2000)}
    <div class="pm-actions"><button class="btn primary" type="submit">${mode === 'details' ? 'Save details' : 'Create'}</button>${btn('Cancel', 'cancel')}</div>
  </form>`;
}
function nav(workspace: PrototypeWorkspace, selection: PrototypeSelection | null): string {
  return workspace.prototypes.map((p, i) => `<section class="pm-group"><h3>${e(p.name)}${p.archived ? ' · Archived' : ''}</h3><code>${e(p.id)}</code>
    ${p.versions.map((v, j) => `<h4>${e(v.label)} ${v.sealed ? '· Sealed' : ''}</h4>${v.variants.map((x, k) => {
      const key = api.selectionKey({ prototypeId:p.id,versionId:v.id,variantId:x.id });
      return `<button type="button" class="pm-row ${key === api.selectionKey(selection) ? 'selected' : ''}" data-pm="select" data-index="${i},${j},${k}" aria-current="${key === api.selectionKey(selection) ? 'true' : 'false'}"><span>${e(x.name)}</span><span class="pm-badge" data-status="${x.status}">${x.status}</span></button>`;
    }).join('')}`).join('')}</section>`).join('');
}
export function prototypeView(snapshot: ReturnType<PrototypeHost['read']>, selection: PrototypeSelection | null, mode: PrototypeForm, message: string, error: boolean, busy: boolean): string {
  const { workspace, writable, opened } = snapshot, disabled = !writable || busy;
  const active = workspace.active ? api.active(workspace) : null;
  const item = selection ? api.selected(workspace, selection) : null;
  const editable = item && !item.prototype.archived && !item.version.sealed && item.variant.status === 'draft';
  const content = item && selection ? `<div class="pm-detail">
    <div class="pm-title"><div><span class="pm-eyebrow">${e(item.prototype.name)} / ${e(item.version.label)}</span><h2>${e(item.variant.name)}</h2></div><span class="pm-badge" data-status="${item.variant.status}">${item.variant.status}</span></div>
    <p>${e(item.variant.hypothesis || 'Describe the idea this variant explores using Edit details.')}</p><code class="pm-path">${e(api.snapshotPath(selection))}</code>
    <dl class="pm-metrics"><div><dt>Surfaces</dt><dd>${item.variant.document.design.nodes.length}</dd></div><div><dt>Routes</dt><dd>${item.variant.document.design.sitemap?.routes.length ?? 0}</dd></div><div><dt>Snapshot revision</dt><dd>${item.variant.revision}</dd></div><div><dt>Version</dt><dd>${item.version.sealed ? 'Sealed' : 'Editable'}</dd></div></dl>
    <div class="pm-actions">${btn('Open in editors', 'open', disabled || item.prototype.archived, true)}${btn('Save working design here', 'save', disabled || !editable)}${btn('Fork variant', 'fork', disabled || item.prototype.archived || item.version.sealed)}${btn('Edit details', 'details', disabled || !editable)}</div>
    <p class="pm-note">Opening copies this snapshot into the working design. It does not activate it. Save working design here is an explicit snapshot update.</p>
    <h3>Review and generation</h3><div class="pm-actions">${btn('Send to review', 'review', disabled || item.variant.status !== 'draft' || item.prototype.archived)}${btn('Approve', 'approved', disabled || !['draft','review'].includes(item.variant.status) || item.prototype.archived)}${btn('Use for generation', 'activate', disabled || item.variant.status !== 'approved' || item.prototype.archived, true)}${btn('Return to draft', 'draft', disabled || ['active','draft'].includes(item.variant.status) || item.prototype.archived)}</div>
    <h3>Version and lifecycle</h3><div class="pm-actions">${btn('New version', 'version', disabled || item.prototype.archived)}${btn('Seal version', 'seal', disabled || item.prototype.archived || item.version.sealed)}${btn('Archive variant', 'archived', disabled || ['active','archived'].includes(item.variant.status) || item.prototype.archived)}${btn(item.prototype.archived ? 'Restore prototype' : 'Archive prototype', 'archive', disabled || workspace.active?.prototypeId === item.prototype.id)}</div>
  </div>` : `<div class="pm-empty"><h2>Explore more than one solution</h2><p>Capture your current sitemap, pages, interactions and fixtures. Fork a variant for sitemap B while keeping sitemap A saved.</p>${btn('Create first prototype', 'create', disabled, true)}<p>New variants start as drafts. Approve and activate one when it should drive generation.</p></div>`;
  return `<header class="pm-header"><div><span class="pm-eyebrow">DESIGN EXPLORATION</span><h1>Manage prototypes</h1><p>Many possible solutions. One explicit generation source.</p></div><div class="pm-actions">${btn('New prototype','create',disabled,true)}${btn('Import workspace','import',disabled)}${btn('Export workspace','export',busy)}${btn('Export folders ZIP','directory',busy)}</div></header>
    <section class="pm-active" aria-label="Generator selection"><div><strong>${active ? 'Active generator variant' : 'No active generator variant'}</strong><p>${active ? e(active.prototype.name + ' / ' + active.version.label + ' / ' + active.variant.name) : 'Managed generation stays blocked until you approve and activate a saved variant.'}</p><code>${active ? e(api.snapshotPath(active.selection)) : 'docs/concepts/<prototype-name>/'}</code></div><div class="pm-actions">${btn('Export active project','generate',busy || !active,true)}${btn('Deactivate','deactivate',disabled || !active)}</div></section>
    <p class="pm-note">Working copy opened from: <strong>${e(opened ? api.selectionKey(opened) : 'current project design')}</strong>. All prototype writes in this browser stay in its existing project storage until exported. Use the shell to write the folders into your project.</p>
    ${!writable ? '<p class="pm-alert" role="alert">Editing is paused. Resolve storage conflicts or finish the current operation first. Recovery exports remain available.</p>' : ''}
    <div class="pm-message ${error ? 'pm-alert' : ''}" role="${error ? 'alert' : 'status'}" aria-live="polite">${e(message)}</div>
    ${form(mode,workspace,selection)}<div class="pm-layout"><nav class="pm-list" aria-label="Prototypes, versions and variants">${nav(workspace,selection) || '<p>No prototypes saved yet.</p>'}</nav><article class="card">${content}</article></div>
    <input type="file" class="pm-import" accept=".json,application/json" hidden aria-label="Import prototype workspace JSON">
    <footer class="pm-note">Snapshots preserve the complete saved project, including its mock data. Active variants and sealed versions cannot be overwritten. Existing source-generation checks still apply; activation is not native acceptance.</footer>`;
}
