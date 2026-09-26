// Insert pane: Nuxt UI patterns (recipes) and primitives, plus project components. Recipes expand to ordinary IR at
// insertion (spec 2.4); nothing persisted references a recipe. The pane itself never writes.
const VE_INSERT_TABS = [['patterns', 'Patterns'], ['components', 'Components'], ['project', 'Project']];
// Catalog components that hold page content, and the slot that receives it. Buttons, badges and menus also declare a
// default slot, but it carries their label or trigger, so they count as leaves.
const VE_CONTAINER_SLOTS = { 'u-form': 'default', 'u-form-field': 'default', 'u-card': 'default', 'u-modal': 'body', 'u-drawer': 'body' };
function veContainerSlot(node) { return node.kind === 'component' && node.ref.kind === 'nuxt-ui' ? VE_CONTAINER_SLOTS[node.ref.entryId] ?? null : null; }
function veCanContain(node) { return (node.kind === 'element' && !['input', 'img'].includes(node.tag)) || node.kind === 'slot' || !!veContainerSlot(node); }
// Insert target rule: a selected container receives the new nodes at its end; a selected leaf gets them right after it;
// with nothing selected they are appended to the root. `after` forces the leaf rule (selection toolbar "Insert after").
function veInsertTarget(definition, selectedId, after = false) {
  const hit = selectedId ? visualLocate(visualRoot(definition), selectedId) : null;
  if (!hit) return { parentId: null };
  if (!after && veCanContain(hit.node)) return { parentId: hit.node.id, ...(hit.node.kind === 'component' ? { slot: veContainerSlot(hit.node) } : {}) };
  const parent = hit.parent, slot = parent?.kind === 'component' ? Object.entries(parent.slots).find(([, list]) => list === hit.list)?.[0] : null;
  return { parentId: parent?.id ?? null, ...(slot ? { slot } : {}), index: hit.index + 1 };
}
// Literal for a required prop that declares no default, so a fresh instance passes the contract check.
function veTypeDefault(type) { return type === 'number' ? 0 : type === 'boolean' ? false : ''; }
// New nodes for an Insert value: "recipe:<id>", "nuxt:<entryId>" or "project:<componentId>". IDs come from the store.
function veInsertNodes(store, value) {
  const [kind, ...rest] = value.split(':'), id = rest.join(':');
  if (kind === 'recipe') { visualAssert(visualRecipes.some(r => r.id === id), 'Unknown pattern ' + JSON.stringify(id) + '.'); return visualExpand(store, id); }
  if (kind === 'nuxt') {
    const entry = visualCatalogEntry(id); visualAssert(entry, 'Unknown Nuxt UI component ' + JSON.stringify(id) + '.');
    const named = entry.props.find(p => ['label', 'title'].includes(p.name) && p.type === 'string');
    return [visualNuxt(visualAllocate(store, 'vn'), entry.id, named ? { [named.name]: visualLiteral(entry.label) } : {}, { name: entry.label })];
  }
  if (kind === 'project') {
    const component = store.components.find(c => c.id === id); visualAssert(component, 'The project component no longer exists.');
    const props = Object.fromEntries(component.props.filter(p => p.required).map(p => [p.name, visualLiteral(p.default ?? veTypeDefault(p.type))]));
    return [visualProject(visualAllocate(store, 'vn'), component.id, { name: component.exportName, props })];
  }
  visualAssert(false, 'Unknown insert item ' + JSON.stringify(value) + '.');
}
function veInsertMatches(text) { const q = (veUi.insertQuery || '').trim().toLowerCase(); return !q || text.toLowerCase().includes(q); }
function veInsertItem(title, meta, description, value, extra = '') {
  return `<li class="ve-insert-item"><div class="ve-insert-text"><strong>${esc(title)}</strong>${meta ? `<code>${esc(meta)}</code>` : ''}<span>${esc(description)}</span></div><div class="ve-insert-actions">${button('Insert', 've-insert', value, 'small', 'plus', `aria-label="${esc('Insert ' + title)}"`)}${extra}</div></li>`;
}
function veInsertGroups(items) {
  const groups = [...new Set(items.map(item => item.group))];
  return groups.map(group => `<section class="ve-insert-group" aria-label="${esc(group)}"><h3>${esc(group)}</h3><ul>${items.filter(item => item.group === group).map(item => item.html).join('')}</ul></section>`).join('');
}
function veInsertPatterns() {
  return visualRecipes.filter(r => veInsertMatches(r.label + ' ' + r.description)).map(r => ({ group: r.category, html: veInsertItem(r.label, '', r.description, 'recipe:' + r.id) }));
}
function veInsertPrimitives() {
  const customize = entry => `<button type="button" class="btn small ghost" data-action="ve-customize" data-value="${esc(entry.id)}" disabled aria-describedby="ve-customize-note">Customize as component</button>`;
  return visualCatalog.filter(e => veInsertMatches(e.label + ' ' + e.component + ' ' + e.category + ' ' + e.description)).map(e => ({ group: e.category, html: veInsertItem(e.label, e.component, e.description, 'nuxt:' + e.id, customize(e)) }));
}
// Project components with a visual definition. Library entries not designed yet are listed as unavailable.
function veInsertProject(kind) {
  const store = veStore(), self = kind === 'component' ? veUi.ref?.id : null;
  return design().library.filter(entry => veInsertMatches(entry.name + ' ' + (entry.description || ''))).map(entry => {
    const component = store.components.find(c => c.libraryId === entry.id);
    if (!component || component.id === self) {
      const reason = component ? 'This is the component being edited.' : 'Design it in the component editor first.';
      return { group: 'Project components', html: `<li class="ve-insert-item is-unavailable"><div class="ve-insert-text"><strong>${esc(entry.name)}</strong><span>${esc(reason)}</span></div></li>` };
    }
    return { group: 'Project components', html: veInsertItem(entry.name, component.exportName, component.description || entry.description || 'Reusable project component', 'project:' + component.id) };
  });
}
function veInsertTab() { return VE_INSERT_TABS.some(([id]) => id === veUi.insertTab) ? veUi.insertTab : 'patterns'; }
function veInsertResults(kind) {
  const tab = veInsertTab(), items = tab === 'patterns' ? veInsertPatterns() : tab === 'components' ? veInsertPrimitives() : veInsertProject(kind);
  return veInsertGroups(items) || '<p class="ve-pane-note" role="status">Nothing matches this search.</p>';
}
function veInsertHtml(kind) {
  const tab = veInsertTab();
  const tabs = `<div class="ve-segment ve-insert-tabs" role="group" aria-label="Insert source">${VE_INSERT_TABS.map(([id, label]) => `<button type="button" data-action="ve-insert-tab" data-value="${id}" aria-pressed="${tab === id}">${label}</button>`).join('')}</div>`;
  const search = `<input class="ve-search" type="search" data-field="ve-insert-search" value="${esc(veUi.insertQuery)}" placeholder="Search Nuxt UI and project components" aria-label="Search insertable items" maxlength="160" autocomplete="off">`;
  const note = tab === 'components' ? '<p id="ve-customize-note" class="ve-pane-note">Customize as component becomes available with the component editor.</p>' : '';
  const where = veUi.after && veUi.selected ? 'Inserts after the selected element.' : 'Inserts inside the selected container, after a selected element, or at the end of the page.';
  return `${tabs}${search}<p class="ve-pane-note">${esc(where)}</p>${note}<div id="ve-insert-results">${veInsertResults(kind)}</div>`;
}
