// Layouts pane and Save-layout dialog. Built-in layouts are catalog data; saved layouts live in visualDesigns.layouts.
// Applying one inserts independent nodes with fresh IDs at the insert target; component references are kept.
const VE_LAYOUT_CATEGORIES = [['application', 'Application'], ['dashboard', 'Dashboard'], ['master-detail', 'Master / detail'], ['form', 'Form'], ['settings', 'Settings'], ['website', 'Website'], ['custom', 'Custom']];
function veLayoutCategory(id) { return VE_LAYOUT_CATEGORIES.find(([key]) => key === id)?.[1] || id; }
function veLayoutCard(layout, saved) {
  const meta = saved ? 'Saved · ' + veLayoutCategory(layout.category) + ' · ' + (layout.scope === 'region' ? 'Region' : 'Page') : 'Built-in · ' + veLayoutCategory(layout.category);
  return `<li class="ve-layout-card"><div class="ve-insert-text"><strong>${esc(layout.name)}</strong><code>${esc(meta)}</code><span>${esc(layout.description || 'No description')}</span></div><div class="ve-insert-actions">${button('Apply', 've-apply-layout', layout.id, 'small', 'plus', `aria-label="${esc('Apply layout ' + layout.name)}"`)}</div></li>`;
}
function veLayoutsHtml() {
  const saved = veStore().layouts, hasPage = !!veUi.ref && veUi.ref.kind === 'page', chosen = hasPage && !!veUi.selected;
  const actions = `<div class="ve-layout-actions">${button('Save page as layout', 've-save-layout', 'page', 'small', 'download', hasPage ? '' : 'disabled')}${button('Save selection as layout', 've-save-layout', 'region', 'small', 'download', chosen ? '' : 'disabled aria-describedby="ve-layout-selection-note"')}</div>${chosen ? '' : '<p id="ve-layout-selection-note" class="ve-pane-note">Select an element to save it as a region layout.</p>'}`;
  const builtIn = `<section class="ve-insert-group" aria-label="Built-in layouts"><h3>Built-in</h3><ul>${visualBuiltinLayouts.map(l => veLayoutCard(l, false)).join('')}</ul></section>`;
  const mine = `<section class="ve-insert-group" aria-label="Saved layouts"><h3>My layouts · ${saved.length}/${VISUAL_LIMITS.layouts}</h3>${saved.length ? `<ul>${saved.map(l => veLayoutCard(l, true)).join('')}</ul>` : '<p class="ve-pane-note">No saved layouts yet.</p>'}</section>`;
  return `${actions}${builtIn}${mine}<p class="ve-pane-note">Applying a layout adds independent elements with fresh IDs where Insert would place them. Components stay references to their definitions.</p>`;
}
// Dialog state is session-only; the layout is written once, on Save.
function veLayoutFormFor(scope) {
  const page = veCurrentPage(), node = veUi.selected && page ? visualLocate(page.root, veUi.selected)?.node : null;
  const base = scope === 'region' && node ? veNodeLabel(node) : page?.name || 'Page';
  return { scope: scope === 'region' && node ? 'region' : 'page', name: (base + ' layout').slice(0, 120), description: '', category: 'custom', error: '' };
}
function veSaveLayoutDialog() {
  const form = veUi.layoutForm || veLayoutFormFor('page'), selected = !!veUi.selected;
  const scopes = [['page', 'Entire page'], ...(selected ? [['region', 'Selected element']] : [])];
  const body = `<p id="ve-layout-error" class="error" role="alert" tabindex="-1">${esc(form.error)}</p>
    ${uiInput('Layout name', 've-layout-name', form.name, { extra: 'maxlength="120" required autocomplete="off" autofocus' })}
    ${uiInput('Description', 've-layout-description', form.description, { multiline: true, rows: 3, extra: 'maxlength="400"' })}
    <div class="field-grid">${uiSelect('Category', 've-layout-category', VE_LAYOUT_CATEGORIES, form.category)}${uiSelect('Save', 've-layout-scope', scopes, form.scope)}</div>
    <p class="small muted">Structure, layout rules, component references and named slots are kept. Page identity, route and preview data are not. Interactions that target elements outside the saved part are refused.</p>`;
  return dialogBody('Save as reusable layout', body, button('Cancel', 'close', '', 'ghost') + button('Save layout', 've-save-layout-confirm', '', 'primary', 'download'));
}
function veSaveLayoutField(el) {
  const key = { 've-layout-name': 'name', 've-layout-description': 'description', 've-layout-category': 'category', 've-layout-scope': 'scope' }[el.dataset.field];
  if (!key || !veUi.layoutForm) return false;
  veUi.layoutForm[key] = el.value;
  return true;
}
function veSaveLayout() {
  const form = veUi.layoutForm, page = veCurrentPage();
  if (!form || !page) throw Error('Open a page before saving a layout.');
  const name = form.name.trim();
  if (!name) throw Error('Give the layout a name.');
  const nodeIds = form.scope === 'region' ? [veUi.selected].filter(Boolean) : page.root.map(n => n.id);
  if (!nodeIds.length) throw Error(form.scope === 'region' ? 'Select an element to save.' : 'Add elements to the page before saving it as a layout.');
  let layout = null;
  veCommit(store => { layout = visualSaveLayout(store, { name, description: form.description.trim(), category: form.category, scope: form.scope, nodeIds, pageId: page.id }); });
  veUi.layoutForm = null; modalOriginal = null; closeModal(); veUi.left = 'layouts'; render();
  notify('Layout “' + layout.name + '” saved. The page is unchanged.');
}
