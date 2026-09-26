// Both entry routes use the same project-owned map and detail surface.
function storymapView() {
  smNormalize(); const map = smCurrentMap();
  return `<section class="sm-workspace" aria-label="Storymaps"><p id="sm-page-error" class="error" role="alert" tabindex="-1">${esc(smUi.pageError)}</p>${map ? smDetail(map) : smOverview()}</section>`;
}
function smOverview() {
  const all = smStore().maps, query = smUi.query.trim().toLowerCase(), paused = smPaused() ? 'disabled' : '';
  const maps = all.filter(m => (smUi.status === 'all' || (smUi.status === 'archived' ? m.status === 'archived' : m.status !== 'archived')) && (!smUi.prdFilter || m.prds.some(p => p.id === smUi.prdFilter)) && (!query || (m.title + ' ' + m.purpose + ' ' + m.audience).toLowerCase().includes(query)));
  const rows = maps.map(m => `<tr><td><button class="sm-map-link" data-action="sm-open" data-value="${esc(m.id)}">${esc(m.title)}</button><p class="sm-summary">${esc(m.purpose || 'No outcome described yet.')}</p></td><td data-label="State">${esc(smStateLabel(m.status))}</td><td data-label="PRDs">${m.prds.map(r => esc(design().prds.find(p => p.id === r.id)?.title || (r.label + ' — missing'))).join('<br>') || 'Not linked'}</td><td data-label="Stories">${m.stories.length}</td><td data-label="Releases">${m.releases.length}</td><td data-label="Updated"><time datetime="${esc(m.updatedAt)}">${esc(m.updatedAt.slice(0, 10))}</time></td><td><div class="row wrap">${m.status !== 'archived' ? button('Edit', 'sm-map-edit', m.id, 'small', '', paused) : ''}${button('Duplicate', 'sm-duplicate', m.id, 'small', '', paused || (smPaused() || all.length >= STORYMAP_LIMITS.maps ? 'disabled' : ''))}${button(m.status === 'archived' ? 'Restore' : 'Archive', 'sm-archive', m.id, 'small', '', paused)}</div></td></tr>`).join('');
  return `<header class="page-heading"><div><h1>Storymaps</h1><p>Plan a coherent user experience. Connect its stories to requirements and screens.</p></div>${button('Create storymap', 'sm-new', '', 'primary', 'plus', smPaused() || all.length >= STORYMAP_LIMITS.maps ? 'disabled' : '')}</header>
  <div class="sm-filters">${uiInput('Find a storymap', 'sm-query', smUi.query, { type: 'search', extra: 'maxlength="120" placeholder="Search names, outcomes or audiences"' })}${smSelectField('Show', 'statusFilter', smUi.status, [['active', 'Active maps'], ['archived', 'Archived maps'], ['all', 'All maps']])}${smSelectField('Linked PRD', 'prdFilter', smUi.prdFilter, [['', 'Any PRD'], ...design().prds.map(p => [p.id, p.title])])}</div>
  ${maps.length ? `<div class="sm-table-scroll"><table class="sm-table"><caption class="sr-only">${maps.length} matching storymaps</caption><thead><tr><th scope="col">Storymap / outcome</th><th scope="col">State</th><th scope="col">PRDs</th><th scope="col">Stories</th><th scope="col">Releases</th><th scope="col">Updated</th><th scope="col">Actions</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="sm-empty"><h2>${all.length ? 'No maps match these filters' : 'Start with what your user needs to accomplish'}</h2><p>${all.length ? 'Clear the filters to see the project’s maps.' : 'Create an activity, break it into steps, then add stories. Place stories in release slices when the first useful experience becomes clear.'}</p>${all.length ? button('Clear filters', 'sm-clear-filters', '', '') : button('Create blank storymap', 'sm-new', '', 'primary', 'plus', paused)}<p class="small muted">${all.length ? '' : 'You can also create or link a map from any PRD detail page. A sitemap is optional.'}</p></div>`}
  <footer class="sm-footnote">${smHistoryControls()}<span>One project per vault · ${all.length}/${STORYMAP_LIMITS.maps} maps · Planning is not implementation evidence.</span></footer>`;
}
function smStateLabel(state) { return ({ draft: 'Draft', review: 'In review', archived: 'Archived' })[state]; }
function smHistoryControls() {
  return `<div class="row">${button('Undo', 'sm-history', 'undo', 'small', '', smPaused() || !design().history.length ? 'disabled' : '')}${button('Redo', 'sm-history', 'redo', 'small', '', smPaused() || !design().future.length ? 'disabled' : '')}</div>`;
}
function smDetail(map) {
  const archived = map.status === 'archived', disabled = smReadOnly(map) ? 'disabled' : '';
  const reviewCount = smReviewFindings(map, design()).length;
  const representations = [['map', 'Map'], ['outline', 'Outline'], ['review', 'Review' + (reviewCount ? ' (' + reviewCount + ')' : '')]];
  const modeButtons = representations.map(([value, title]) => button(title, 'sm-mode', value, 'small' + (smUi.mode === value ? ' selected' : ''), '', `aria-pressed="${smUi.mode === value}"`)).join('');
  const settings = archived ? button('Restore map', 'sm-archive', map.id, 'small', '', smPaused() ? 'disabled' : '') : button('Map settings', 'sm-map-edit', map.id, 'small', 'settings', disabled);
  return `<div class="sm-breadcrumb">${button('All storymaps', 'sm-overview', '', 'small ghost')}${smUi.back ? button('Back to ' + (smUi.back.view === 'prds' ? 'PRD' : 'sitemap'), 'sm-return', '', 'small ghost') : ''}</div>
  <header class="page-heading sm-heading"><div><h1 tabindex="-1">${esc(map.title)}</h1>${map.purpose.length > 260 ? `<details class="sm-long-purpose"><summary>${esc(map.purpose.slice(0, 180))}… · Read full outcome</summary><p class="sm-prose">${esc(map.purpose)}</p></details>` : `<p>${esc(map.purpose || 'Describe the intended outcome in map settings.')}</p>`}<div class="sm-meta"><span>${smStateLabel(map.status)}</span><span>${map.stories.length} stories · ${map.releases.length} release slices</span>${map.prds.length ? `<details class="sm-prd-menu"><summary>${map.prds.length} linked PRDs</summary><div>${map.prds.map(ref => smArtifactButton(ref, 'prd')).join('')}</div></details>` : '<span>No linked PRDs</span>'}</div></div>
  <div class="row wrap">${settings}<details class="sm-export-menu"><summary class="btn small">${icon('download')} Export</summary><div>${button('Export Markdown', 'sm-export', '', 'small', 'download')}${button('Export project JSON', 'project-export', '', 'small', 'download')}</div></details></div></header>
  ${archived ? '<p class="sm-notice">Archived map · browse, review and export freely. Restore it before editing.</p>' : state.activeRun || tdUi.busy ? '<p class="sm-notice" role="status">Editing is paused while an operation is active.</p>' : ''}
  <div class="sm-toolbar" role="group" aria-label="Storymap actions"><div class="row wrap">${button('Add activity', 'sm-add', 'activity', 'small', 'plus', disabled)}${button('Add release', 'sm-add', 'release', 'small', 'plus', disabled)}${smHistoryControls()}</div><div class="row wrap"><div class="sm-mode-switch" role="group" aria-label="Storymap representation">${modeButtons}</div>${smUi.mode === 'map' ? button('Details', 'sm-details', '', 'small', '', `aria-pressed="${smUi.details}" aria-controls="sm-inspector"`) + button('Fit map', 'sm-fit', '', 'small') + button('Locate selection', 'sm-locate', '', 'small', '', !smUi.item ? 'disabled' : '') : ''}</div></div>
  ${smUi.mode !== 'review' ? smFinder(map) : ''}
  ${smUi.mode === 'map' ? `<div class="sm-editor" data-details="${smUi.details ? 'open' : 'closed'}"><div class="sm-canvas-wrap"><div id="sm-flow" role="region" aria-label="Storymap canvas. Use Outline for non-drag editing."></div>${!map.activities.length ? `<div class="sm-canvas-empty"><h2>Add the first activity</h2><p>Describe a meaningful user goal, then add its steps and stories.</p>${button('Add activity', 'sm-add', 'activity', 'primary', 'plus', disabled)}</div>` : ''}<div class="sm-viewport-controls" role="group" aria-label="Canvas zoom">${button('Zoom out', 'sm-zoom', 'out', 'small')}<output id="sm-zoom">100%</output>${button('Zoom in', 'sm-zoom', 'in', 'small')}</div><div id="sm-drop-status" class="sm-drop-status" role="status"></div></div><aside id="sm-inspector" class="sm-inspector" aria-label="Selected storymap item">${smInspector(map)}</aside></div>` : smUi.mode === 'review' ? smReviewView(map) : `<div class="sm-outline" aria-label="Storymap outline">${smOutline(map)}</div>`}
  <p id="sm-announcement" class="sm-footnote" role="status" aria-live="polite">${smUi.mode === 'map' ? 'Drag stories between steps and releases, or use Move. Select a title for details.' : 'The same saved map, shown without dragging. Review findings are planning questions, not test results.'}</p>`;
}
function smFinder(map) {
  return `<div class="sm-story-filters">${uiInput('Find stories', 'sm-itemQuery', smUi.itemQuery, { type: 'search', extra: 'maxlength="160" placeholder="Title, context, acceptance or linked artifact"' })}${smSelectField('Release', 'releaseFilter', smUi.releaseFilter, [['', 'All releases'], ...map.releases.map(r => [r.id, r.title]), ['unplanned', 'Unplanned']])}${smSelectField('Show stories', 'findingFilter', smUi.findingFilter, [['', 'All stories'], ['missing', 'With missing targets'], ['acceptance', 'Without acceptance notes'], ['interface', 'Needs interface mapping']])}</div><div id="sm-find-results">${smFinderResults(map)}</div>`;
}
function smFinderResults(map) {
  if (!smHasFilters()) return '';
  const matches = smMatchingStories(map, design(), smUi), ids = new Set(matches.map(s => s.id)), selected = smItem(map, smUi.item);
  const context = r => (map.steps.find(s => s.id === r.stepId)?.title || '') + ' / ' + (map.releases.find(l => l.id === r.releaseId)?.title || 'Unplanned');
  return `<div class="sm-find-summary"><span role="status">${matches.length} of ${map.stories.length} stories match${smUi.mode === 'map' ? ' · the map keeps its complete structure' : ''}.</span>${button('Clear story filters', 'sm-find-clear', '', 'small ghost')}</div>${selected?.kind === 'story' && !ids.has(selected.record.id) ? '<p class="small muted">Selected story is outside these filters. Its details are retained.</p>' : ''}${matches.length ? `<div class="sm-find-list" role="region" aria-label="Matching stories">${matches.map(r => `<button class="sm-find-result" data-action="sm-find-item" data-value="${esc(r.id)}"><strong>${esc(r.title)}</strong><small>${esc(context(r))}</small></button>`).join('')}</div>` : '<p class="small muted">Try another phrase or clear the filters. No saved stories were removed.</p>'}`;
}
function smUpdateFinder() {
  const map = smCurrentMap(); if (!map) return;
  const results = document.getElementById('sm-find-results'); if (results) results.innerHTML = smFinderResults(map);
  const outline = document.querySelector('.sm-outline'); if (outline) outline.innerHTML = smOutline(map);
  const matched = new Set(smMatchingStories(map, design(), smUi).map(s => s.id));
  document.querySelectorAll('.sm-card-story').forEach(card => card.classList.toggle('sm-match', smHasFilters() && matched.has(card.dataset.smItem)));
  smUi.resize?.();
}
function smReviewView(map) {
  const findings = smReviewFindings(map, design()), disabled = smReadOnly(map) ? 'disabled' : '';
  return `<section class="sm-review" aria-label="Storymap review"><header><h2>Review the intended experience</h2><p>These questions help refine the design. A linked artifact or filled field does not prove implementation or verification.</p></header>
  <h3>Release outcomes</h3><div class="sm-release-list">${[...map.releases, { id: null, title: 'Unplanned', outcome: 'Not assigned to a release.' }].map(r => {
    const scope = smReleaseSummary(map, r.id);
    return `<section class="sm-release-review"><div><h4>${esc(r.title)}</h4><p class="sm-prose">${esc(r.outcome || 'No intended outcome described yet.')}</p><p class="small muted">${scope.stories} stories across ${scope.steps} of ${scope.totalSteps} steps · not a completion score</p>${scope.emptySteps.length ? `<details><summary>Steps without stories in this slice (${scope.emptySteps.length})</summary><p>${esc(scope.emptySteps.join(' · '))}</p><p class="small muted">Some steps may intentionally be outside this release.</p></details>` : ''}</div>${r.id ? button('Edit outcome', 'sm-edit', r.id, 'small', '', disabled) : ''}</section>`;
  }).join('')}</div><h3>Questions and missing references (${findings.length})</h3>${findings.length ? `<ol class="sm-review-list">${findings.map(f => `<li><div><strong>${esc(f.title)}</strong><p>${esc(f.detail)}</p></div>${smReviewAction(f, disabled)}</li>`).join('')}</ol>` : '<p class="sm-review-empty">No findings from these checks. This is not an implementation, accessibility or release approval.</p>'}</section>`;
}
function smReviewAction(finding, disabled) {
  const creation = { 'empty-map': ['Add activity', 'activity'], 'empty-activity': ['Add step', 'step:' + finding.id], 'empty-step': ['Add story', 'story:' + finding.id] }[finding.code];
  return creation ? button(creation[0], 'sm-add', creation[1], 'small', '', disabled) : button('Review item', 'sm-repair', finding.id, 'small', '', disabled);
}
function smArtifactButton(ref, kind) {
  const target = kind === 'prd' ? design().prds.find(p => p.id === ref.id) : design().nodes.find(n => n.id === ref.id);
  return target ? button(target.title || target.label, kind === 'prd' ? 'sm-prd' : 'sm-surface', ref.id, 'small ghost') + (kind==='surface'&&dtPageEligible(target)?button('Design page','dt-page',ref.id,'small'):'') : `<span class="sm-missing">${esc(ref.label || ref.id)} — target missing</span>`;
}
function smItemButtons(map, item) {
  const disabled = smReadOnly(map) ? 'disabled' : '';
  return button('Edit', 'sm-edit', item.id, 'small', '', `${disabled} aria-label="Edit ${esc(item.title)}"`) + button('Move…', 'sm-move', item.id, 'small', '', `${disabled} aria-label="Move ${esc(item.title)}"`);
}
function smInspector(map) {
  const item = smItem(map, smUi.item); if (!item) return `<div class="row between"><h2>Map guide</h2>${button('Close', 'sm-details', '', 'small ghost')}</div><p>Activities group the user’s goals. Steps read left to right. Stories describe capabilities and variations.</p><h3>Plan useful slices</h3><p>Release lanes express intended outcomes. Unplanned retains stories until you decide their scope.</p><h3>Connect, do not copy</h3><p>Select an item to link existing sitemap items. Their names follow the original identity; missing targets remain visible.</p><p class="small muted">${esc(map.audience || 'No audience or scenario described yet.')}</p>`;
  const r = item.record;
  return `<div class="row between wrap"><h2>${esc(r.title)}</h2><span class="muted small">${esc(item.kind)}</span>${button('Close', 'sm-details', '', 'small ghost')}</div><div class="row wrap">${smItemButtons(map, r)}</div>
  ${item.kind === 'activity' ? button('Add step', 'sm-add', 'step:' + r.id, 'small', 'plus', smReadOnly(map) ? 'disabled' : '') : ''}
  ${item.kind === 'step' ? button('Add story', 'sm-add', 'story:' + r.id, 'small', 'plus', smReadOnly(map) ? 'disabled' : '') : ''}
  ${item.kind === 'story' ? `<dl><dt>Step</dt><dd>${esc(map.steps.find(s => s.id === r.stepId)?.title)}</dd><dt>Release</dt><dd>${esc(map.releases.find(s => s.id === r.releaseId)?.title || 'Unplanned')}</dd></dl><h3>Description</h3><p class="sm-prose">${esc(r.description || 'No description yet.')}</p><h3>Acceptance notes</h3><p class="sm-prose">${esc(r.acceptance || 'No acceptance notes yet.')}</p>` : ''}
  ${item.kind === 'release' ? `<h3>Intended outcome</h3><p class="sm-prose">${esc(r.outcome || 'No intended outcome described yet.')}</p><p>${map.stories.filter(s => s.releaseId === r.id).length} stories planned. This is not delivery evidence.</p>` : `<h3>Sitemap items</h3><div class="sm-ref-buttons">${r.surfaces.map(ref => smArtifactButton(ref, 'surface')).join('') || `<p class="muted">${r.ui === 'none' ? 'No UI required' : 'Not linked yet'}</p>`}</div><p class="small muted">Edit this item to link, relink or remove references. Links here do not imply links on its children.</p>`}
  ${item.kind === 'story' ? `<h3>Requirements</h3>${r.requirements.map(ref => smRequirementButton(ref)).join('') || '<p class="muted">Not linked yet.</p>'}` : ''}<p class="small muted">Stable identity: ${esc(r.id)}</p>`;
}
function smRequirementButton(ref) {
  const prd = design().prds.find(p => p.id === ref.prdId), req = prd?.requirements.find(r => r.id === ref.id);
  return req ? button(prd.title + ' / ' + req.title, 'sm-requirement', JSON.stringify([ref.prdId, ref.id]), 'small ghost') : `<span class="sm-missing">${esc(ref.label || ref.id)} — target missing</span>`;
}
function smRequirementLabels(story) {
  return story.requirements.map(ref => { const p = design().prds.find(p => p.id === ref.prdId), q = p?.requirements.find(q => q.id === ref.id); return q ? p.title + ' / ' + q.title : (ref.label || ref.id) + ' — target missing'; });
}
function smOutline(map) {
  if (!map.activities.length) return '<div class="sm-empty"><h2>No activities yet</h2><p>Add an activity from the toolbar to start the map.</p></div>';
  const matching = new Set(smMatchingStories(map, design(), smUi).map(s => s.id)), filtered = smHasFilters(), disabled = smReadOnly(map) ? 'disabled' : '';
  const storyRow = r => `<article class="sm-outline-story ${r.id === smUi.item ? 'selected' : ''}" data-sm-item="${esc(r.id)}"><div><button class="sm-outline-title" data-action="sm-find-item" data-value="${esc(r.id)}">${esc(r.title)}</button><p class="small sm-prose">${esc(r.description || 'No description yet.')}</p><details class="sm-story-notes"><summary>Acceptance and references</summary><h5>Acceptance notes</h5><p class="small sm-prose">${esc(r.acceptance || 'No acceptance notes yet.')}</p><h5>Requirements</h5><div class="sm-ref-buttons">${r.requirements.map(smRequirementButton).join('') || '<span class="small muted">Not linked yet</span>'}</div></details><div class="sm-ref-buttons">${r.surfaces.map(ref => smArtifactButton(ref, 'surface')).join('') || `<span class="small muted">${r.ui === 'none' ? 'No UI required' : 'No sitemap links yet'}</span>`}</div></div><div class="row wrap">${smItemButtons(map, r)}</div></article>`;
  const activities = map.activities.map(a => {
    const steps = map.steps.filter(s => s.activityId === a.id && (!filtered || map.stories.some(r => r.stepId === s.id && matching.has(r.id))));
    if (filtered && !steps.length) return '';
    return `<section class="sm-outline-activity"><div class="row between wrap"><h2>${esc(a.title)}</h2><div class="row wrap">${smItemButtons(map, a)}${button('Add step', 'sm-add', 'step:' + a.id, 'small', 'plus', disabled)}</div></div>${a.surfaces.map(r => smArtifactButton(r, 'surface')).join('')}
    ${steps.map(s => `<section class="sm-outline-step"><div class="row between wrap"><h3>${esc(s.title)}</h3><div class="row wrap">${smItemButtons(map, s)}${button('Add story', 'sm-add', 'story:' + s.id, 'small', 'plus', disabled)}</div></div>${s.surfaces.map(r => smArtifactButton(r, 'surface')).join('')}${[...map.releases, { id: null, title: 'Unplanned' }].map(l => {
      const stories = map.stories.filter(r => r.stepId === s.id && r.releaseId === l.id && matching.has(r.id));
      if (filtered && !stories.length) return '';
      return `<section class="sm-outline-lane"><div class="row between wrap"><h4>${esc(l.title)} <span class="muted">(${stories.length})</span></h4>${button('Add story here', 'sm-add', 'story:' + s.id + ':' + (l.id || ''), 'small ghost', 'plus', disabled)}</div>${stories.map(storyRow).join('') || '<p class="small muted">No stories in this slice.</p>'}</section>`;
    }).join('')}</section>`).join('') || '<p class="muted">Add a step to this activity.</p>'}</section>`;
  }).join('');
  return (activities || '<p class="sm-empty">No stories match these filters. Clear the filters to restore the complete outline.</p>') + `<section class="sm-outline-activity"><h2>Release outcomes</h2>${map.releases.map(r => `<div class="sm-outline-story"><div><h3>${esc(r.title)}</h3><p class="sm-prose">${esc(r.outcome || 'No outcome described yet.')}</p></div><div class="row">${smItemButtons(map, r)}</div></div>`).join('') || '<p>No release slices yet. Stories remain Unplanned.</p>'}</section>`;
}
function smPrdSection(prd) {
  const maps = smStore().maps.filter(m => m.prds.some(ref => ref.id === prd.id));
  return `<section class="sm-prd-section" aria-label="Linked storymaps">${smReturnLink()}<div class="row between wrap"><h3>Storymaps <span class="muted">(${maps.length})</span></h3><div class="row wrap">${button('Create linked storymap', 'sm-new', prd.id, 'small', 'plus')}${button('Link existing', 'sm-prd-links', prd.id, 'small')}</div></div>${maps.map(m => `<div class="sm-linked-map">${button(m.title, 'sm-open-prd', m.id, 'small ghost')}<span class="small muted">${smStateLabel(m.status)} · ${m.stories.length} stories</span></div>`).join('') || '<p class="small muted">Plan the user experience without copying this PRD’s requirements into another backlog.</p>'}</section>`;
}
function smSurfaceBacklinks(id) {
  const uses = smSurfaceUses(id); return `<section class="sm-backlinks">${smReturnLink()}${dtPageEligible(design().nodes.find(n=>n.id===id))?button('Open page editor','dt-page',id,'small primary'): ""}<h3>Used in storymaps (${uses.length})</h3>${uses.map(({ map, item }) => `<p>${button(map.title + ' / ' + item.title, 'sm-backlink', map.id + ':' + item.id, 'small ghost')}</p>`).join('') || '<p class="small muted">No direct storymap links to this surface.</p>'}</section>`;
}
