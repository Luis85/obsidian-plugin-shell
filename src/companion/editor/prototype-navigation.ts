import type { PrototypeSelection, PrototypeWorkspace } from '#shared/companion/prototypes/model.ts';
import { selectionKey, variantStatuses } from '#shared/companion/prototypes/model.ts';
import { pmEscape as e } from './prototype-markup.ts';
export interface PrototypeBrowse { query: string; status: string }
/** Filter projections only; never reorders saved arrays or implicitly changes selection. */
export function prototypeNavigation(workspace: PrototypeWorkspace, selection: PrototypeSelection | null, browse: PrototypeBrowse): string {
  const query = browse.query.trim().toLowerCase(); let total = 0, shown = 0, selectedVisible = false;
  const groups = workspace.prototypes.map((p,i) => {
    const versions = p.versions.map((v,j) => {
      const rows = v.variants.map((x,k) => {
        total++;
        const text = [p.id,p.name,p.description,v.id,v.label,x.id,x.name,x.hypothesis].join(' ').toLowerCase();
        if (!text.includes(query) || browse.status !== 'all' && (p.archived ? 'archived' : x.status) !== browse.status) return '';
        shown++;
        const key = selectionKey({prototypeId:p.id,versionId:v.id,variantId:x.id}), selected = key === selectionKey(selection);
        if (selected) selectedVisible = true;
        return `<button type="button" class="pm-row ${selected ? 'selected' : ''}" data-pm="select" data-key="${e(key)}" data-index="${i},${j},${k}" aria-current="${selected}"><span>${e(x.name)}</span><span class="pm-badge" data-status="${x.status}">${x.status}</span></button>`;
      }).join('');
      return rows ? `<h4>${e(v.label)} ${v.sealed ? '· Sealed' : ''}</h4>${rows}` : '';
    }).join('');
    return versions ? `<section class="pm-group"><h3>${e(p.name)}${p.archived ? ' · Archived' : ''}</h3><code>${e(p.id)}</code>${versions}</section>` : '';
  }).join('');
  return `<div class="pm-filters"><label>Find a prototype or variant<input type="search" data-pm-query maxlength="160" value="${e(browse.query)}" placeholder="Name, version or hypothesis"></label>
    <label>Status<select data-pm-status>${['all',...variantStatuses].map(status => `<option value="${status}"${status === browse.status ? ' selected' : ''}>${status === 'all' ? 'All statuses' : status}</option>`).join('')}</select></label>
    <p class="pm-note" role="status">${shown} of ${total} variants${selection && !selectedVisible ? '. Selected variant is outside these filters; selection is retained.' : '.'}</p>
    ${query || browse.status !== 'all' ? '<button type="button" class="btn" data-pm="reset-filter">Clear filters</button>' : ''}</div>
    ${groups || `<p>${total ? 'No matching variants. Clear the filters to see all saved work.' : 'No prototypes saved yet.'}</p>`}`;
}
