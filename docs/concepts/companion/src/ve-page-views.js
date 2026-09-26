// Pages list and the three-pane page editor shell (left: switcher + Outline | Insert | Layouts; canvas; inspector).
// Views only read: opening a surface never writes. Only "Start design" creates the page definition.
const VE_LEFT_PANES = [['outline', 'Outline'], ['insert', 'Insert'], ['layouts', 'Layouts']];
const VE_EDITOR_MODES = [['design', 'Design'], ['preview', 'Preview'], ['review', 'Review']];
const VE_VIEWPORT_LABELS = [['desktop', 'Desktop'], ['tablet', 'Tablet'], ['mobile', 'Mobile']];
function veSurfaces(d = design()) { return d.nodes.filter(n => ['page', 'modal', 'settings'].includes(n.kind)); }
function veCurrentPage(d = design()) { return veUi.owner ? veStore(d).pages.find(p => p.ownerId === veUi.owner) ?? null : null; }
// Keep the session reference aligned with the design (undo/redo may add or remove the page) and drop stale selection.
function veSyncPage() {
  const page = veCurrentPage();
  veUi.ref = page ? { kind: 'page', id: page.id } : null;
  veRepair();
  return page;
}
function vePageCard(surface, page) {
  const count = page ? visualNodes(page.root).length : 0;
  const meta = page ? count + ' element' + (count === 1 ? '' : 's') + ' · ' + page.scenarios.length + ' scenario' + (page.scenarios.length === 1 ? '' : 's') : 'Not designed yet. Opening it does not create data.';
  const label = page ? 'Open' : 'Design page';
  return `<article class="card ve-page-card"><span class="ve-eyebrow">${esc(surface.kind)} · ${page ? 'Designed' : 'Shell only'}</span><h2>${esc(surface.label)}</h2><p>${esc(surface.purpose || surface.description || 'Compose this surface from Nuxt UI patterns, components and layouts.')}</p><p class="small muted">${esc(meta)}</p>${button(label, 've-open-page', surface.id, page ? 'small' : 'small primary', 'grid', `aria-label="${esc(label + ' ' + surface.label)}"`)}</article>`;
}
function vePageCards(d = design()) {
  const q = (veUi.pageQuery || '').trim().toLowerCase(), all = veSurfaces(d), pages = veStore(d).pages;
  const shown = all.filter(s => [s.label, s.kind, s.slug].join(' ').toLowerCase().includes(q));
  const cards = shown.map(s => vePageCard(s, pages.find(p => p.ownerId === s.id))).join('');
  return `<p class="small muted" role="status">${shown.length} of ${all.length} surfaces</p><div class="ve-page-grid">${cards || `<div class="card"><h2>${all.length ? 'No matching surfaces' : 'Start with a surface'}</h2><p>${all.length ? 'Search another name, kind or slug. Nothing was removed.' : 'Add a Page, Modal or Settings surface in the sitemap. Views and groups are containers.'}</p></div>`}</div>`;
}
function vePagesView() {
  const d = design(), all = veSurfaces(d), designed = veStore(d).pages.filter(p => all.some(s => s.id === p.ownerId)).length;
  const orphans = veStore(d).pages.filter(p => !all.some(s => s.id === p.ownerId));
  return `<section class="ve-pages"><header class="page-heading"><div><h1>Pages</h1><p>Design the inside of every sitemap surface with Nuxt UI patterns, reusable components and layouts.</p></div><div class="row">${badge(designed + ' of ' + all.length + ' designed')}${button('Open sitemap', 'nav', 'sitemap', 'small', 'grid')}</div></header>
    <div class="ve-pages-search"><input class="ve-search" type="search" data-field="ve-page-search" value="${esc(veUi.pageQuery)}" placeholder="Find a page, modal or settings surface" aria-label="Find a page, modal or settings surface" maxlength="160" autocomplete="off"></div>
    <div id="ve-pages-results">${vePageCards(d)}</div>
    ${orphans.length ? `<section class="card mt16"><h2>Designs with a missing surface</h2><p>These page designs are kept. Restoring the original sitemap surface reconnects them.</p><ul>${orphans.map(p => `<li>${esc(p.name)}</li>`).join('')}</ul></section>` : ''}</section>`;
}
// Readiness: the full validation (with references) and every review error; warnings do not block the generator.
function veReadiness(page, findings = veReviewFindings(veStore(), { kind: 'page', id: page.id })) {
  const errors = findings.filter(f => f.severity === 'error');
  return errors.length ? { ready: false, text: errors.length === 1 ? errors[0].text : errors.length + ' review errors' } : { ready: true, text: 'Generator ready' };
}
function veSegment(label, action, options, current) {
  return `<div class="ve-segment" role="group" aria-label="${esc(label)}">${options.map(([id, name]) => `<button type="button" data-action="${action}" data-value="${id}" aria-pressed="${current === id}">${esc(name)}</button>`).join('')}</div>`;
}
// Undo/Redo for both editors' canvas toolbars; disabled in Preview and when that side of the history is empty.
function veHistoryButtons(d = design()) {
  const locked = veUi.mode === 'preview', tool = (label, action, empty) => button(label, action, '', 'small ghost', '', `aria-label="${label} design change"${locked || empty ? ' disabled' : ''}`);
  return `<div class="ve-segment" role="group" aria-label="Design history">${tool('Undo', 've-undo', !d.history.length)}${tool('Redo', 've-redo', !d.future.length)}</div>`;
}
function veCanvasToolbar(page) {
  const options = [['', 'Default state'], ...page.scenarios.map(s => [s.id, s.name + (s.width === 'narrow' ? ' · narrow' : '')])];
  const scenario = `<label class="ve-inline-field"><span>Scenario</span><select data-field="ve-scenario" aria-label="Preview scenario">${options.map(([id, name]) => `<option value="${esc(id)}"${(veUi.scenario || '') === id ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select></label>`;
  return `<div class="ve-toolbar" role="toolbar" aria-label="Canvas">${veSegment('Editor mode', 've-mode', VE_EDITOR_MODES, veUi.mode)}${scenario}<span class="ve-grow"></span>${veSegment('Canvas width', 've-viewport', VE_VIEWPORT_LABELS, veUi.viewport)}${veHistoryButtons()}${button('Health', 've-health', '', 'small ghost', 'shield', 'aria-label="Project health"')}</div>`;
}
function veSelectionBar(page) {
  const node = veUi.selected ? visualLocate(page.root, veUi.selected)?.node : null;
  if (!node || veUi.mode !== 'design') return '';
  const tool = (label, action, ico) => `<button type="button" class="icon-button" data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}">${icon(ico)}</button>`;
  const more = veUi.more ? `<div class="ve-more-menu" role="group" aria-label="More actions">${button('Move earlier', 've-move', 'earlier', 'small ghost')}${button('Move later', 've-move', 'later', 'small ghost')}${button('Move to…', 've-reparent', '', 'small ghost')}${button('Save selection as layout', 've-save-layout', 'region', 'small ghost')}${button('Delete…', 've-delete', '', 'small ghost', 'trash')}</div>` : '';
  return `<div class="ve-selection-holder"><div class="ve-selection-bar" role="toolbar" aria-label="${esc('Actions for ' + veNodeLabel(node))}"><span class="ve-selection-label">${esc(veNodeLabel(node))}</span>${tool('Insert after', 've-insert-after', 'plus')}${tool('Duplicate', 've-duplicate', 'copy')}${tool('Wrap in group', 've-wrap', 'box')}${tool('Bind data', 've-bind', 'layers')}${tool('Add interaction', 've-interaction', 'spark')}<button type="button" class="icon-button" data-action="ve-more" aria-label="More actions" title="More actions" aria-expanded="${veUi.more}">${icon('menu')}</button></div>${more}</div>`;
}
function veCanvasFooter(page, findings) {
  const trail = veOutlineTrail(page, veUi.selected), ready = veReadiness(page, findings);
  const crumbs = ['Page', ...trail.map(n => veNodeLabel(n))].map((label, i, all) => i === all.length - 1 ? `<strong>${esc(label)}</strong>` : `<span>${esc(label)}</span>`).join('<span aria-hidden="true">›</span>');
  const count = visualNodes(page.root).length;
  return `<div class="ve-footer"><nav class="ve-crumbs" aria-label="Selected element path">${crumbs}</nav><span class="ve-grow"></span><span>${count}/${VISUAL_LIMITS.nodes} elements</span><span aria-hidden="true">·</span><span class="ve-readiness ${ready.ready ? 'is-ready' : 'is-blocked'}" role="status">${ready.ready ? '✓' : '!'} ${esc(ready.text)}</span></div>`;
}
function vePageSwitcher(surface) {
  const options = veSurfaces().map(s => [s.id, s.label + (veStore().pages.some(p => p.ownerId === s.id) ? '' : ' · not designed')]);
  return `<select class="ve-page-switch" data-field="ve-page-switch" aria-label="Switch page">${options.map(([id, name]) => `<option value="${esc(id)}"${id === surface?.id ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select>`;
}
function vePaneTabs() {
  return `<div class="ve-pane-tabs" role="tablist" aria-label="Editor panes">${[['left', 'Structure'], ['canvas', 'Canvas'], ['inspector', 'Inspector']].map(([id, label]) => `<button type="button" role="tab" data-action="ve-pane" data-value="${id}" aria-selected="${veUi.pane === id}">${label}</button>`).join('')}</div>`;
}
function veLeftBody(page) {
  if (veUi.left === 'insert') return veInsertHtml('page');
  if (veUi.left === 'layouts') return veLayoutsHtml();
  return `<input class="ve-search" type="search" data-field="ve-outline-search" value="${esc(veUi.query)}" placeholder="Find in page" aria-label="Find in page outline" maxlength="160" autocomplete="off"><div id="ve-outline">${veOutlineHtml(page)}</div>`;
}
function veEditorHeader(surface, page) {
  return `<div class="ve-pane-head">${button('Back', 've-back', '', 'small ghost', '', 'aria-label="Back"')}<div class="ve-head-title"><span class="ve-eyebrow">Page editor</span><strong>${esc(page?.name || surface?.label || 'Page')}</strong></div></div><div class="ve-pane-switch">${vePageSwitcher(surface)}</div>`;
}
function vePageEditorView() {
  const page = veSyncPage(), surface = design().nodes.find(n => n.id === veUi.owner);
  const error = `<p id="ve-error" class="error ve-error" role="alert" tabindex="-1">${esc(veUi.error)}</p>`;
  if (!veUi.owner) return `<section class="ve-empty card"><h1>Page editor</h1><p>Choose a page, modal or settings surface to design.</p>${button('Browse pages', 'nav', 'pages', 'primary', 'grid')}</section>`;
  if (!page) {
    const usable = surface && ['page', 'modal', 'settings'].includes(surface.kind);
    return `<section class="ve-empty card">${button('Back', 've-back', '', 'small ghost')}<span class="ve-eyebrow">${esc(surface?.kind || 'Surface')} · Shell only</span><h1>${esc(surface?.label || 'Missing surface')}</h1>${error}<p>${usable ? 'This surface has no page design yet. Start one to insert Nuxt UI patterns, components and layouts. Opening it did not change the project.' : 'This surface no longer exists or cannot hold a page design.'}</p>${usable ? button('Start design', 've-start-page', surface.id, 'primary', 'plus') : button('Browse pages', 'nav', 'pages', 'primary', 'grid')}</section>`;
  }
  const scenario = page.scenarios.find(s => s.id === veUi.scenario) ?? null;
  const canvas = veCanvasHtml(page, visualSession(scenario), { mode: veUi.mode, selected: veUi.mode === 'preview' ? null : veUi.selected, viewport: veUi.viewport });
  const pane = id => 've-pane ve-pane-' + id + (veUi.pane === id ? ' is-active' : '');
  const findings = veReviewFindings(veStore(), { kind: 'page', id: page.id }), node = veUi.selected ? visualLocate(page.root, veUi.selected)?.node ?? null : null;
  return `<section class="ve-page-editor" aria-label="${esc('Page editor · ' + page.name)}">${vePaneTabs()}<div class="ve-editor">
    <aside class="${pane('left')}" aria-label="Page structure">${veEditorHeader(surface, page)}${veSegment('Structure tools', 've-left', VE_LEFT_PANES, veUi.left)}<div class="ve-pane-body">${veLeftBody(page)}</div></aside>
    <section class="${pane('canvas')}" aria-label="Canvas">${veCanvasToolbar(page)}<div class="ve-canvas-area">${veSelectionBar(page)}${canvas}</div>${veCanvasFooter(page, findings)}</section>
    <aside class="${pane('inspector')}" aria-label="Inspector"><div class="ve-pane-body">${error}${vePageInspectorHtml(page, node, findings)}</div></aside></div></section>`;
}
