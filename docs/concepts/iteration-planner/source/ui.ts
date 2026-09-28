import { nameOf, statusLabels, type Workspace, type Iteration, type Status, type Work } from './model.ts';
export interface ViewState {
  view: string; selectedId: string; search: string; backlogFilter: string; statusFilter: string;
  showArchived: boolean; selectedItems: Set<string>; dailyItemId: string; theme: string; remember: boolean;
  message: string; storageWarning: string; page: number;
}
export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character] ?? character));
}
export function icon(name: string, size = 18): string {
  const paths: Record<string,string> = {
    overview:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    backlog:'<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.1M3 12h.1M3 18h.1"/>',
    planning:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h3"/>',
    daily:'<path d="M8 4H4v16h16v-4M8 12l4 4L22 6"/>',
    increment:'<path d="m12 3 9 5v8l-9 5-9-5V8l9-5ZM3 8l9 5 9-5M12 13v8"/>',
    retro:'<path d="M21 11a9 9 0 1 1-3-6M21 3v6h-6M8 12h8M12 8v8"/>',
    resources:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/>',
    history:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="m5 12 4 4L19 6"/>',
    arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',chevron:'<path d="m9 5 7 7-7 7"/>',
    search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    export:'<path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5"/>',
    import:'<path d="M12 16V4m-5 5 5-5 5 5M4 15v5h16v-5"/>',
    settings:'<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3v2M12 17h.1"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1"/>',
    warning:'<path d="m12 3 10 18H2L12 3ZM12 9v5M12 17h.1"/>',
    link:'<path d="M14 3h7v7M10 14 21 3M21 14v7H3V3h7"/>',
    edit:'<path d="m15 5 4 4M4 16 17 3l4 4L8 20H4v-4Z"/>',
    leaf:'<path d="M20 3C6 2 1 9 5 16c7 7 17-1 15-13ZM5 20 16 8"/>'
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.overview}</svg>`;
}
export function button(label: string, action: string, id = '', kind = 'secondary', glyph = ''): string {
  return `<button type="button" class="btn ${kind}" data-action="${esc(action)}" data-id="${esc(id)}">${glyph ? icon(glyph) : ''}${esc(label)}</button>`;
}
export function iconButton(label: string, action: string, id: string, glyph: string): string {
  return `<button type="button" class="icon-btn" aria-label="${esc(label)}" title="${esc(label)}" data-action="${esc(action)}" data-id="${esc(id)}">${icon(glyph)}</button>`;
}
export function badge(text: string, kind = 'neutral'): string { return `<span class="badge ${esc(kind)}">${esc(text)}</span>`; }
export function statusBadge(status: Status): string { return badge(statusLabels[status],status); }
export function formatDate(date: string, weekday = false): string {
  return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',...(weekday?{weekday:'short' as const}:{}),timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
}
export function owner(state: Workspace, id: string | null): string { return state.resources.find(person => person.id === id)?.name ?? 'Unassigned'; }
export function avatar(state: Workspace, id: string | null, withName = false): string {
  const name = owner(state,id); const initials = name.split(' ').map(part=>part[0]).slice(0,2).join('');
  return `<span class="person"><span class="avatar tone-${Math.max(0,state.resources.findIndex(value=>value.id===id))%4}" title="${esc(name)}">${esc(initials)}</span>${withName?`<span>${esc(name)}</span>`:''}</span>`;
}
export function personOptions(state: Workspace, selected: string | null): string {
  return `<option value="">Unassigned</option>${state.resources.map(person=>`<option value="${esc(person.id)}" ${person.id===selected?'selected':''}>${esc(person.name)}</option>`).join('')}`;
}
export function options(values: {id:string;title:string}[], selected: string): string {
  return values.map(value=>`<option value="${esc(value.id)}" ${value.id===selected?'selected':''}>${esc(value.title)}</option>`).join('');
}
export function heading(eyebrow: string, title: string, description: string, actions = ''): string {
  return `<div class="page-heading"><div><div class="eyebrow">${esc(eyebrow)}</div><h1 id="page-title" tabindex="-1">${esc(title)}</h1><p>${esc(description)}</p></div><div class="actions">${actions}</div></div>`;
}
export function empty(title: string, description: string, action = ''): string {
  return `<section class="empty card"><span class="empty-symbol">${icon('leaf',30)}</span><h2>${esc(title)}</h2><p>${esc(description)}</p>${action}</section>`;
}
export function field(label: string, name: string, value: string, type = 'text', required = false, prefix = 'f'): string {
  return `<label class="field" for="${prefix}-${name}"><span>${esc(label)}${required?' <span aria-hidden="true">*</span>':''}</span><input id="${prefix}-${name}" name="${esc(name)}" type="${type}" value="${esc(value)}" ${required?'required':''} ${type==='text'?'maxlength="180"':''}></label>`;
}
export function textarea(label: string, name: string, value: string, prefix = 'f', rows = 3): string {
  return `<div class="field"><label for="${prefix}-${name}">${esc(label)}</label><textarea id="${prefix}-${name}" name="${esc(name)}" rows="${rows}" maxlength="10000">${esc(value)}</textarea></div>`;
}
export function workRow(state: Workspace, work: Work, iteration: Iteration): string {
  return `<div class="work-row"><span class="work-marker ${work.status}">${work.status==='done'?icon('check',13):''}</span>
    <div class="work-title"><button class="text-button" data-action="work" data-id="${esc(work.itemId)}">${esc(work.title)}</button><small>${esc(work.status==='blocked'?work.blocker:work.nextAction||'Choose the next useful step.')}</small></div>
    ${statusBadge(work.status)}<span class="estimate">${work.estimate===null?'—':`${work.estimate}h`}</span>${avatar(state,work.ownerId)}
    ${iteration.stage==='active'?iconButton('Update '+work.title,'work',work.itemId,'chevron'):''}</div>`;
}
export function iterationOptions(state: Workspace, selected: string): string {
  return [...state.iterations].reverse().map(iteration=>`<option value="${esc(iteration.id)}" ${iteration.id===selected?'selected':''}>${esc(nameOf(iteration))} · ${iteration.stage}</option>`).join('');
}
