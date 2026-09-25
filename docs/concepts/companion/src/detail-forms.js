// Draft-only modal fields. Saving performs a full contract check, never code evaluation.
function dtBegin(type, id = null, kind = null, connection = null) {
  dtCanWrite(); const doc = dtDocument(); if (!doc) throw Error('Start a detail design first.');
  const store = dtCopy(dtStore()); let record;
  if (type === 'node') {
    const existing = id && doc.nodes.find(n => n.id === id); if (id && !existing) throw Error('That element no longer exists.');
    const selected = doc.nodes.find(n => n.id === dtUi.selected), parent = selected?.kind === 'region' ? selected.id : selected?.parentId || null;
    const component = kind === 'component' ? design().library.find(c => c.id !== (doc.kind === 'component' ? doc.ownerId : null) && c.status !== 'deprecated') : null;
    if (!id && kind === 'component' && !component) throw Error('Create another reusable component in the library first.');
    record = existing ? dtCopy(existing) : dtNewNode(store, kind || 'text', parent, component);
    if (!id) { const siblings = doc.nodes.filter(n => n.parentId === parent); record.position = { x: 24 + siblings.length % 2 * 280, y: 72 + Math.floor(siblings.length / 2) * 170 }; }
  } else if (type === 'edge') {
    const existing = id && doc.edges.find(e => e.id === id); if (id && !existing) throw Error('That interaction no longer exists.');
    const source = connection?.source || dtUi.selected || doc.nodes[0]?.id, target = connection?.target || doc.nodes.find(n => n.id !== source)?.id;
    if (!existing && !target) throw Error('Add at least two elements before describing an interaction.');
    record = existing ? dtCopy(existing) : { id: dtNext(store, 'edge'), source, target, event: 'click', label: 'Continue', notes: '', acceptance: '', targetSurfaceId: null };
  } else record = { notes: doc.notes };
  dtUi.form = { type, id, documentId: doc.id, record, original: dtCopy(record), nextId: store.nextId, token: smToken(), propsText: JSON.stringify(record.props || {}, null, 2), removal: false };
  dtUi.error = ''; showModal('detail-form');
}
function dtInput(label, key, value, max = 120, multiline = false) { return uiInput(label, 'dt-' + key, value ?? '', { multiline, rows: 3, extra: `maxlength="${max}"` }); }
function dtSelectField(label, key, value, choices) { return uiSelect(label, 'dt-' + key, choices, value ?? ''); }
function dtRefChoices(choices, value) { return value && !choices.some(([id]) => id === value) ? [...choices, [value, value + ' — missing target (retained)']] : choices; }
function dtComponentFields(r) {
  const choices = design().library.filter(c => c.id !== (dtDocument().kind === 'component' ? dtDocument().ownerId : null)).map(c => [c.id, c.name]);
  const c = design().library.find(c => c.id === r.component.id);
  return `<fieldset><legend>Reusable component instance</legend>${dtSelectField('Component definition', 'componentId', r.component.id, dtRefChoices(choices, r.component.id))}
    <div class="row wrap small"><span>Pinned contract: <code>${esc(r.component.version)}</code> · Library: <code>${esc(c?.version || 'missing')}</code></span>${c && c.version !== r.component.version ? button('Review current version', 'dt-upgrade', '', 'small') : ''}</div>
    <p class="small muted">${esc(c?.description || 'Missing definitions are retained, not silently replaced.')}</p>
    ${dtSelectField('Variant', 'variantId', r.component.variantId, dtRefChoices(c ? componentVariants(c).map(v => [v.id, v.name]) : [], r.component.variantId))}
    <p class="small">Declared props: <code>${esc(c?.props || 'none')}</code>. Local overrides do not edit the reusable definition.</p>
    ${dtInput('Instance prop overrides (JSON literals only)', 'props', dtUi.form.propsText, 10000, true)}
    ${c ? `<details><summary>Component contract</summary><p>Events: ${esc(c.events || 'none')} · Slots: ${esc(c.slots || 'none')}</p><p>${esc(c.a11y || 'No accessibility notes yet.')}</p></details>` : ''}</fieldset>`;
}
function dtBindingFields(r) {
  const sources = design().dataSources?.sources || [], source = sources.find(s => s.id === r.binding?.sourceId);
  return `<details ${r.binding ? 'open' : ''}><summary>Data binding (declaration only)</summary>${dtSelectField('Data source', 'sourceId', r.binding?.sourceId, dtRefChoices([['', 'No binding'], ...sources.map(s => [s.id, s.name])], r.binding?.sourceId))}
    ${r.binding ? dtSelectField('Source operation', 'operationId', r.binding.operationId, dtRefChoices((source?.operations || []).map(o => [o.id, o.name]), r.binding.operationId)) + dtInput('Result field path (not an expression)', 'bindingField', r.binding.field) : ''}
    <p class="small muted">No provider runs in this editor. Describe the field and operation the implementation should use.</p></details>`;
}
function dtNodeFields(f, doc) {
  const r = f.record, blocked = f.id ? dtDescendants(doc, f.id) : new Set(), parents = [['', 'Canvas root'], ...doc.nodes.filter(n => n.kind === 'region' && !blocked.has(n.id)).map(n => [n.id, n.label])];
  return `${dtInput('Element label / accessible name', 'label', r.label)}<div class="cols2">${dtSelectField('Parent region', 'parentId', r.parentId, parents)}${r.kind === 'region' ? dtSelectField('Reading layout', 'layout', r.layout, [['stack', 'Vertical stack'], ['row', 'Horizontal row'], ['grid', 'Two-column grid']]) : `<p class="small muted">${esc(r.kind)} element. Containment is separate from interaction arrows.</p>`}</div>
    ${r.kind === 'component' ? dtComponentFields(r) : dtInput(r.kind === 'slot' ? 'Fallback slot content' : 'Content / placeholder', 'text', r.text, 8000, true)}
    ${r.kind === 'slot' ? '<p class="small muted">Use a slot name declared in the owner’s library contract as the element label.</p>' : ''}
    ${dtBindingFields(r)}${dtInput('Accessibility and validation notes', 'a11y', r.a11y, 2000, true)}
    <fieldset><legend>Visible in preview states</legend><div class="row wrap">${DETAIL_STATES.map(s => `<label class="dt-check"><input type="checkbox" data-field="dt-visible" data-key="${s}" ${r.visibleIn.includes(s) ? 'checked' : ''}>${s}</label>`).join('')}</div></fieldset>
    <details><summary>Canvas geometry (not implementation layout)</summary><div class="cols2">${dtInput('X position', 'x', r.position.x)}${dtInput('Y position', 'y', r.position.y)}${dtInput('Canvas width', 'width', r.size.width)}${dtInput('Canvas height', 'height', r.size.height)}</div><p class="small muted">Moving or resizing the canvas does not change reading order or generated layout.</p></details>`;
}
function dtEdgeFields(r, doc) {
  const choices = doc.nodes.map(n => [n.id, n.label]);
  return `<div class="cols2">${dtSelectField('From element', 'source', r.source, choices)}${dtSelectField('To element', 'target', r.target, choices)}</div>
    ${dtInput('Interaction label', 'label', r.label)}${dtInput('Trigger event', 'event', r.event, 60)}
    ${dtSelectField('Navigation target (optional)', 'targetSurfaceId', r.targetSurfaceId, dtRefChoices([['', 'Stay on this surface'], ...design().nodes.filter(dtPageEligible).map(n => [n.id, n.label])], r.targetSurfaceId))}
    ${dtInput('Behavior and conditions', 'notes', r.notes, 4000, true)}${dtInput('Acceptance scenario (Given / When / Then)', 'acceptance', r.acceptance, 8000, true)}
    <p class="small muted">An interaction describes intent. It does not execute code or prove a test has passed.</p>`;
}
function detailForm() {
  const f = dtUi.form, doc = dtDocument(); if (!f || !doc) return dialogBody('Detail design unavailable', '<p>Close and reopen the current design.</p>', button('Close', 'close'));
  const title = f.type === 'notes' ? 'Design intent' : (f.id ? 'Edit ' : 'Add ') + (f.type === 'edge' ? 'interaction' : f.record.kind);
  const body = f.removal ? `<div class="warning"><strong>Remove ${esc(f.record.label)}?</strong><p>${f.type === 'node' ? 'Its nested elements and attached interaction arrows are removed from this design only.' : 'Only this interaction is removed.'} Library definitions, sitemap surfaces and storymaps are retained. Undo is available.</p></div>` : f.type === 'node' ? dtNodeFields(f, doc) : f.type === 'edge' ? dtEdgeFields(f.record, doc) : dtInput('Purpose, constraints and design decisions', 'notes', f.record.notes, 8000, true);
  return dialogBody(title, `${body}<div id="dt-form-error" class="error" role="alert" tabindex="-1">${esc(dtUi.error)}</div>`,
    button('Cancel', 'close', '', 'ghost') + (f.id && !f.removal ? button('Remove…', 'dt-remove', '', 'danger') : '') + button(f.removal ? 'Remove from design' : 'Save design', f.removal ? 'dt-remove-confirm' : 'dt-save', '', 'primary'));
}
function editDetailField(el) {
  if (!el.dataset.field?.startsWith('dt-') || !dtUi.form) return false;
  const key = el.dataset.field.slice(3), f = dtUi.form, r = f.record, value = el.value;
  if (key === 'props') f.propsText = value;
  else if (key === 'parentId' || key === 'targetSurfaceId') r[key] = value || null;
  else if (['x', 'y'].includes(key)) r.position[key] = Number(value);
  else if (['width', 'height'].includes(key)) r.size[key] = Number(value);
  else if (key === 'visible') r.visibleIn = el.checked ? [...new Set([...r.visibleIn, el.dataset.key])] : r.visibleIn.filter(s => s !== el.dataset.key);
  else if (key === 'componentId') {
    const c = design().library.find(c => c.id === value); if (c) { r.component = { id: c.id, label: c.name, version: c.version, variantId: 'default' }; r.props = {}; f.propsText = '{}'; redrawModal(); }
  } else if (key === 'variantId') r.component.variantId = value;
  else if (key === 'sourceId') { const s = design().dataSources?.sources.find(s => s.id === value); r.binding = s ? { sourceId: s.id, operationId: s.operations[0]?.id || '', field: '' } : null; redrawModal(); }
  else if (key === 'operationId') r.binding.operationId = value;
  else if (key === 'bindingField') r.binding.field = value;
  else if (Object.hasOwn(r, key) && typeof r[key] === 'string') r[key] = value;
  return true;
}
function dtReviewVersion() {
  const f = dtUi.form, c = design().library.find(c => c.id === f?.record.component?.id); if (!c) throw Error('The component definition is missing.');
  // This is still a draft: the contract, retained overrides and variant are reviewed before Save.
  f.record.component.version = c.version; dtUi.error = 'Current contract selected in this draft. Review declared props and variant before saving; incompatible overrides are rejected.'; redrawModal();
}
function dtSave() {
  const f = dtUi.form; if (!f || f.removal) return;
  const record = dtCopy(f.record);
  if (f.type === 'node') {
    record.label = record.label.trim(); record.props = JSON.parse(f.propsText);
    if (JSON.stringify({ component: record.component, props: record.props }) !== JSON.stringify({ component: f.original.component, props: f.original.props }) || !f.id) dtValidateInstance(record);
  }
  dtCommit(store => {
    const doc = store.documents.find(d => d.id === f.documentId); if (!doc) throw Error('The design no longer exists.');
    if (f.type === 'notes') doc.notes = record.notes;
    else { const key = f.type === 'node' ? 'nodes' : 'edges', index = doc[key].findIndex(r => r.id === f.id); if (f.id && index < 0) throw Error('The element no longer exists.'); if (index < 0) doc[key].push(record); else doc[key][index] = record; }
    store.nextId = Math.max(store.nextId, f.nextId);
  }, f.token);
  dtUi.selected = f.type === 'node' ? record.id : dtUi.selected; dtUi.edge = f.type === 'edge' ? record.id : null;
  modalOriginal = null; closeModal(); dtUi.form = null; render(); notify('Detail design saved. Undo is available.');
}
function dtRemove() {
  const f = dtUi.form; if (!f?.removal || !f.id) return;
  dtCommit(store => { const doc = store.documents.find(d => d.id === f.documentId); if (!doc) throw Error('The design no longer exists.'); if (f.type === 'node') dtRemoveNode(doc, f.id); else doc.edges = doc.edges.filter(e => e.id !== f.id); }, f.token);
  modalOriginal = null; closeModal(); dtUi.form = null; dtUi.selected = null; dtUi.edge = null; render(); notify('Removed from this design only. Undo is available.');
}
