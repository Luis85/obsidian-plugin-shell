// Drafts are separate from canonical data; reference searches never prune selections.
function smInput(label, key, value, max = 120, multiline = false) {
  return uiInput(label, 'sm-' + key, value, { multiline, rows: 2, extra: `maxlength="${max}"${key === 'title' ? ' required aria-required="true"' : ''}` });
}
function smSelectField(label, key, value, options) { return uiSelect(label, 'sm-' + key, options, value ?? ''); }
function smChecks(label, key, choices, selected, query = '', disabledIds = new Set()) {
  const selectedIds = new Set(selected.map(ref => typeof ref === 'string' ? ref : ref.prdId ? JSON.stringify([ref.prdId, ref.id]) : ref.id));
  const known = new Set(choices.map(choice => choice[0]));
  const missing = selected.filter(ref => !known.has(typeof ref === 'string' ? ref : ref.prdId ? JSON.stringify([ref.prdId, ref.id]) : ref.id))
    .map(ref => [typeof ref === 'string' ? ref : ref.prdId ? JSON.stringify([ref.prdId, ref.id]) : ref.id, (ref.label || ref.id || ref) + ' — target missing']);
  const rows = [...choices, ...missing].filter(([, title]) => !query || title.toLowerCase().includes(query.toLowerCase()));
  return `<fieldset class="sm-reference-picker"><legend>${esc(label)}</legend><div class="sm-check-list">${rows.map(([id, title]) => `<label><input type="checkbox" data-field="sm-${key}" data-key="${esc(id)}" ${selectedIds.has(id) ? 'checked' : ''} ${disabledIds.has(id) ? 'disabled' : ''}><span>${esc(title)}</span></label>`).join('') || '<p class="muted small">No matching items. Existing selections are retained.</p>'}</div><small>${selectedIds.size} selected${query ? ' · ' + [...selectedIds].filter(id => !rows.some(row => row[0] === id)).length + ' selected outside this search' : ''}. Uncheck a missing target to remove its reference.</small></fieldset>`;
}
function smMoveFields(f, map) {
  const item = smItem(map, f.id), r = f.record; if (!item) return '<p>The item no longer exists. Close and reopen the current map.</p>';
  let body = '';
  if (item.kind === 'story') body += smSelectField('Destination step', 'stepId', r.stepId, map.steps.map(s => [s.id, (map.activities.find(a => a.id === s.activityId)?.title || '') + ' / ' + s.title])) + smSelectField('Release slice', 'releaseId', r.releaseId, [['', 'Unplanned'], ...map.releases.map(x => [x.id, x.title])]);
  if (item.kind === 'step') body += smSelectField('Destination activity', 'activityId', r.activityId, map.activities.map(a => [a.id, a.title]));
  const siblings = map[item.key].filter(x => x.id !== f.id && (item.kind !== 'story' || x.stepId === r.stepId && x.releaseId === r.releaseId) && (item.kind !== 'step' || x.activityId === r.activityId));
  return body + smSelectField('Insert position', 'beforeId', r.beforeId, [['', 'At the end'], ...siblings.map(x => [x.id, 'Before ' + x.title])]);
}
function smItemFields(f, map) {
  const r = f.record; let body = smInput('Title', 'title', r.title);
  if (f.kind === 'map') return body + smInput('Purpose / intended outcome', 'purpose', r.purpose, 4000, true) + smInput('Audience / scenario', 'audience', r.audience, 1000, true) + smSelectField('Map state', 'status', r.status, [['draft', 'Draft'], ['review', 'In review'], ['archived', 'Archived']]) + smChecks('Linked PRDs (optional)', 'prdRef', design().prds.map(p => [p.id, p.title]), r.prds);
  if (f.kind === 'release') return body + smInput('Intended release outcome', 'outcome', r.outcome, 4000, true) + '<p class="small muted">This lane defines planned scope, not implementation status. Removing it moves its stories to Unplanned.</p>';
  if (f.kind === 'step') body += smSelectField('Activity', 'activityId', r.activityId, map.activities.map(a => [a.id, a.title]));
  if (f.kind === 'story') {
    body += `<div class="sm-form-grid">${smSelectField('Step', 'stepId', r.stepId, map.steps.map(s => [s.id, (map.activities.find(a => a.id === s.activityId)?.title || '') + ' / ' + s.title]))}${smSelectField('Release slice', 'releaseId', r.releaseId, [['', 'Unplanned'], ...map.releases.map(x => [x.id, x.title])])}</div>`;
    body += smInput('Description', 'description', r.description, 8000, true) + smInput('Acceptance notes', 'acceptance', r.acceptance, 8000, true);
    body += smSelectField('Interface expectation', 'ui', r.ui, [['unspecified', 'Not decided yet'], ['surface', 'Uses an interface'], ['none', 'No UI required']]);
    if (r.ui === 'none' && r.surfaces.length) body += '<p class="error">Unlink the selected sitemap items before saving “No UI required”, or change the expectation. Links are never silently discarded.</p>';
  }
  body += smInput('Find sitemap items', 'surfaceQuery', f.surfaceQuery || '', 120);
  body += smChecks('Sitemap items', 'surfaceRef', design().nodes.map(n => [n.id, n.label + ' · ' + (n.kind === 'page' ? 'screen' : n.kind)]), r.surfaces, f.surfaceQuery || '');
  if (f.kind === 'story') body += smInput('Find requirements', 'requirementQuery', f.requirementQuery || '', 120) + smChecks('Requirements (optional)', 'requirementRef', design().prds.flatMap(p => p.requirements.map(q => [JSON.stringify([p.id, q.id]), p.title + ' / ' + q.title])), r.requirements, f.requirementQuery || '');
  return body;
}
function smRemovalForm(f) {
  const map = smFind(smStore(), f.kind === 'map' ? f.id : f.mapId), item = f.kind === 'map' ? map : smItem(map, f.id)?.record;
  let detail = 'The saved item will be removed. Linked PRDs, requirements and sitemap items are kept.';
  if (f.kind === 'map') detail = 'This map and its ' + (map?.stories.length || 0) + ' stories will be removed. Linked artifacts and other maps are kept.';
  if (f.kind === 'activity' || f.kind === 'step') {
    const steps = f.kind === 'step' ? [f.id] : map?.steps.filter(s => s.activityId === f.id).map(s => s.id) || [];
    detail = `This ${f.kind}, its child steps where applicable, and ${map?.stories.filter(s => steps.includes(s.stepId)).length || 0} stories will be removed. Linked artifacts are kept.`;
  }
  if (f.kind === 'release') detail = 'The release lane is removed. Its stories are retained and moved to Unplanned.';
  return dialogBody('Remove ' + (item?.title || 'saved item') + '?', `<p>${esc(detail)}</p><p>Unsaved edits are not applied. Undo restores saved data.</p>${smFormError()}`, button('Keep editing', 'sm-keep', '', 'ghost') + button('Remove ' + f.kind, 'sm-delete-confirm', '', 'danger', 'trash'));
}
function smFormError() { return `<p id="sm-form-error" class="error" role="alert" tabindex="-1">${esc(smUi.error)}</p>`; }
function storymapForm() {
  const f = smUi.form; if (!f) return dialogBody('Storymap unavailable', '<p>Close this dialog and reopen the current map.</p>');
  if (f.removal) return smRemovalForm(f);
  const map = smFind(smStore(), f.mapId); let title, body;
  if (f.kind === 'link-prd') {
    title = 'Link storymaps'; body = '<p>Choose maps for this PRD. This changes links only; no stories are generated.</p>' + smChecks('Project storymaps', 'mapRef', smStore().maps.map(m => [m.id, m.title + (m.status === 'archived' ? ' · Archived' : '')]), f.record.maps, '', new Set(smStore().maps.filter(m => m.status === 'archived').map(m => m.id)));
  } else if (f.kind === 'move') { title = 'Move ' + (smItem(map, f.id)?.record.title || 'item'); body = smMoveFields(f, map); }
  else { title = (f.id ? 'Edit ' : 'Create ') + (f.kind === 'map' ? 'storymap' : f.kind); body = smItemFields(f, map); }
  body += smFormError() + '<p class="small muted">Saved to this project · Ctrl/Cmd + Enter to save. No source files are changed.</p>';
  return dialogBody(title, `<div class="sm-form">${body}</div>`, (f.id && !['move', 'link-prd'].includes(f.kind) ? button('Remove…', 'sm-delete', '', 'danger ghost', 'trash') : '') + button('Cancel', 'close', '', 'ghost') + (!f.id && f.kind === 'story' ? button('Save & add another', 'sm-save-another', '', 'small') : '') + button(f.kind === 'move' ? 'Move item' : 'Save', 'sm-save', '', 'primary'));
}
function editStorymapField(el) {
  const key = el.dataset.field || ''; if (!key.startsWith('sm-')) return false;
  const prop = key.slice(3), value = el.value;
  if (['query', 'statusFilter', 'prdFilter'].includes(prop)) { smUi[prop === 'statusFilter' ? 'status' : prop] = value; render(); return true; }
  if (['itemQuery', 'releaseFilter', 'findingFilter'].includes(prop)) { smUi[prop] = value; smUpdateFinder(); return true; }
  const f = smUi.form; if (!f || f.removal) return true;
  const r = f.record, toggle = (array, id, make, identity = x => x.id) => { const index = array.findIndex(x => identity(x) === id); if (el.checked && index < 0) array.push(make()); if (!el.checked && index >= 0) array.splice(index, 1); };
  if (['surfaceQuery', 'requirementQuery'].includes(prop)) { f[prop] = value; redrawModal(); return true; }
  if (prop === 'surfaceRef') {
    const id = el.dataset.key, n = design().nodes.find(n => n.id === id); toggle(r.surfaces, id, () => ({ id, label: (n?.label || id).slice(0, 160) }));
  } else if (prop === 'prdRef') {
    const id = el.dataset.key, p = design().prds.find(p => p.id === id); toggle(r.prds, id, () => ({ id, label: (p?.title || id).slice(0, 160) }));
  } else if (prop === 'requirementRef') {
    const [prdId, id] = JSON.parse(el.dataset.key), q = design().prds.find(p => p.id === prdId)?.requirements.find(q => q.id === id);
    toggle(r.requirements, JSON.stringify([prdId, id]), () => ({ id, prdId, label: (q?.title || id).slice(0, 160) }), x => JSON.stringify([x.prdId, x.id]));
  } else if (prop === 'mapRef') toggle(r.maps, el.dataset.key, () => el.dataset.key, x => x);
  else if (Object.hasOwn(r, prop) && (typeof r[prop] !== 'object' || prop === 'releaseId') && !['id', 'revision', 'updatedAt'].includes(prop)) r[prop] = prop === 'releaseId' ? value || null : value;
  smUi.error = '';
  const error = document.getElementById('sm-form-error'); if (error) error.textContent = '';
  if (prop === 'title' && value.trim()) { el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); }
  if (['stepId', 'releaseId', 'activityId'].includes(prop) && f.kind === 'move') r.beforeId = '';
  if (el.type === 'checkbox' || el.tagName === 'SELECT') redrawModal();
  return true;
}
