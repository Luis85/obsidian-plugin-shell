// Insert pane: Nuxt UI patterns (recipes) and primitives, plus project components. Recipes expand to ordinary IR at
// insertion (spec 2.4); nothing persisted references a recipe. The pane itself never writes.
const VE_INSERT_TABS = [['patterns', 'Patterns'], ['components', 'Components'], ['project', 'Project']];
// Insert child (component editor): project components, Nuxt UI primitives, semantic elements, public slots, external libraries.
const VE_CHILD_TABS = [['project', 'Project'], ['components', 'Nuxt UI'], ['basic', 'Basic']];
const VE_BASIC_TAGS = ['div', 'section', 'header', 'main', 'span', 'p', 'h2'];
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
// A public slot for Insert child: the first declared slot the template does not place yet, else a new optional slot that
// is declared in the same write (adding a slot never breaks an instance).
function veSlotFor(store, ref) {
  const component = visualDefinition(store, ref);
  visualAssert(component && ref.kind === 'component', 'Public slots belong in component templates.');
  const placed = new Set(visualNodes(component.template).filter(n => n.kind === 'slot').map(n => n.name));
  const free = component.slots.find(s => !placed.has(s.name));
  if (free) return free.name;
  const taken = new Set(component.slots.map(s => s.name)), name = ['default', 'content', 'actions'].find(n => !taken.has(n)) ?? veUniqueName('content', taken);
  visualSetContract(store, component.id, { slots: [...component.slots, { name, required: false }] });
  return name;
}
// New nodes for an Insert value: "recipe:<id>", "nuxt:<entryId>", "project:<componentId>", "element:<tag>" or "slot".
// Paragraph, heading and inline text are text nodes with that role, so their content can bind a parent prop.
function veInsertNodes(store, value, ref = null) {
  const [kind, ...rest] = value.split(':'), id = rest.join(':');
  if (kind === 'element') {
    visualAssert(VE_BASIC_TAGS.includes(id), 'Unknown element ' + JSON.stringify(id) + '.');
    const name = VE_TAG_LABELS[id];
    return [VISUAL_TEXT_ROLES.includes(id) ? visualText(visualAllocate(store, 'vn'), name, id, { name }) : visualElement(visualAllocate(store, 'vn'), id, { name })];
  }
  if (kind === 'slot') { const name = veSlotFor(store, ref); return [visualSlot(visualAllocate(store, 'vn'), name)]; }
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
  const customize = entry => `<button type="button" class="btn small ghost" data-action="ve-customize" data-value="${esc(entry.id)}" aria-label="${esc('Customize ' + entry.label + ' as component')}">Customize as component</button>`;
  return visualCatalog.filter(e => veInsertMatches(e.label + ' ' + e.component + ' ' + e.category + ' ' + e.description)).map(e => ({ group: e.category, html: veInsertItem(e.label, e.component, e.description, 'nuxt:' + e.id, customize(e)) }));
}
function veUnavailable(title, reason, value = '') {
  const id = 've-why-' + (value || title).replace(/[^A-Za-z0-9_-]/g, '_'), insert = value ? `<div class="ve-insert-actions"><button type="button" class="btn small" data-action="ve-insert" data-value="${esc(value)}" disabled aria-describedby="${id}">${icon('plus')}Insert</button></div>` : '';
  return `<li class="ve-insert-item is-unavailable"><div class="ve-insert-text"><strong>${esc(title)}</strong><span id="${id}">${esc(reason)}</span></div>${insert}</li>`;
}
// Project components with a visual definition. Library entries not designed yet are listed as unavailable. In the
// component editor the component itself is not offered, and a component that already uses it (directly or through
// other components) is disabled: inserting it would create a cycle.
function veInsertProject(kind) {
  const store = veStore(), self = kind === 'component' ? veUi.ref?.id : null;
  return design().library.filter(entry => veInsertMatches(entry.name + ' ' + (entry.description || ''))).flatMap(entry => {
    const component = store.components.find(c => c.libraryId === entry.id), group = 'Project components';
    if (component && component.id === self) return [];
    if (!component) return [{ group, html: veUnavailable(entry.name, 'Design it in the component editor first.') }];
    if (self && visualWouldCycle(store, self, component.id)) return [{ group, html: veUnavailable(entry.name, 'Would create a cycle', 'project:' + component.id) }];
    return [{ group, html: veInsertItem(entry.name, component.exportName, component.description || entry.description || 'Reusable project component', 'project:' + component.id) }];
  });
}
// Basic (component editor): semantic elements, a public slot and the declared external libraries.
function veInsertBasic() {
  const component = veCurrentComponent(), deps = component?.dependencies || [];
  const items = VE_BASIC_TAGS.filter(t => veInsertMatches(t + ' ' + VE_TAG_LABELS[t])).map(t => ({ group: 'Semantic elements', html: veInsertItem('<' + t + '>', VE_TAG_LABELS[t], VISUAL_TEXT_ROLES.includes(t) ? 'Text with this role; bind it to a prop.' : 'Container for child elements.', 'element:' + t) }));
  if (veInsertMatches('public slot')) items.push({ group: 'Public slot', html: veInsertItem('Public slot', '', 'Callers place content here. Declares a new slot when every slot is placed.', 'slot') });
  const libs = deps.filter(d => veInsertMatches('external library ' + d.package + ' ' + d.purpose));
  for (const dep of libs) items.push({ group: 'External library', html: veInsertItem(dep.package, dep.version, dep.purpose || 'Mounted by a hand-owned adapter.', 'external:' + dep.package) });
  if (!deps.length && veInsertMatches('external library')) items.push({ group: 'External library', html: veUnavailable('External library', 'Declare a dependency first', 'external:') });
  return items;
}
function veInsertTabs(kind) { return kind === 'component' ? VE_CHILD_TABS : VE_INSERT_TABS; }
function veInsertTab(kind = 'page') { const tabs = veInsertTabs(kind); return tabs.some(([id]) => id === veUi.insertTab) ? veUi.insertTab : tabs[0][0]; }
function veInsertResults(kind) {
  const tab = veInsertTab(kind), items = tab === 'patterns' ? veInsertPatterns() : tab === 'components' ? veInsertPrimitives() : tab === 'basic' ? veInsertBasic() : veInsertProject(kind);
  return veInsertGroups(items) || '<p class="ve-pane-note" role="status">Nothing matches this search.</p>';
}
function veInsertHtml(kind) {
  const tab = veInsertTab(kind), child = kind === 'component';
  const tabs = `<div class="ve-segment ve-insert-tabs" role="group" aria-label="Insert source">${veInsertTabs(kind).map(([id, label]) => `<button type="button" data-action="ve-insert-tab" data-value="${id}" aria-pressed="${tab === id}">${label}</button>`).join('')}</div>`;
  const search = `<input class="ve-search" type="search" data-field="ve-insert-search" value="${esc(veUi.insertQuery)}" placeholder="${child ? 'Find child…' : 'Search Nuxt UI and project components'}" aria-label="Search insertable items" maxlength="160" autocomplete="off">`;
  const slot = child && veUi.slotTarget ? veUi.slotTarget : null;
  const where = slot ? 'Inserts into slot ' + slot.slot + ' of the selected child.' : veUi.after && veUi.selected ? 'Inserts after the selected element.' : 'Inserts inside the selected container, after a selected element, or at the end of the ' + (child ? 'template.' : 'page.');
  return `${tabs}${search}<p class="ve-pane-note">${esc(where)}${slot ? ' ' + button('Clear', 've-map-slot', '', 'small ghost') : ''}</p><div id="ve-insert-results">${veInsertResults(kind)}</div>`;
}
