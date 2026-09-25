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
    if(!existing && kind==='slot')record.label=dtOwner(doc)?.slots.split(/[,\n]/).map(s=>s.trim()).find(Boolean)||'default';
    if (!id) { const siblings = doc.nodes.filter(n => n.parentId === parent); record.position = { x: 24 + siblings.length % 2 * 280, y: 72 + Math.floor(siblings.length / 2) * 170 }; }
  } else if (type === 'edge') {
    const existing = id && doc.edges.find(e => e.id === id); if (id && !existing) throw Error('That interaction no longer exists.');
    const source = connection?.source || dtUi.selected || doc.nodes[0]?.id, target = connection?.target || doc.nodes.find(n => n.id !== source)?.id;
    if (!existing && !target) throw Error('Add at least two elements before describing an interaction.');
    record = existing ? dtCopy(existing) : { id: dtNext(store, 'edge'), source, target, event: 'click', label: 'Continue', notes: '', acceptance: '', targetSurfaceId: null };
  } else record = { notes: doc.notes };
  dtUi.form = { type, id, documentId: doc.id, record, original: dtCopy(record), nextId: store.nextId, token: smToken(), propsText: JSON.stringify(record.props || {}, null, 2), optionsText: JSON.stringify(record.control?.options || [], null, 2), mappingText: JSON.stringify(record.action?.input || record.action?.payload || {kind:'none'}, null, 2), removal: false };
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
    ${dtPropertyFields(r)}
    ${c ? `<details><summary>Component contract</summary><p>Events: ${esc(c.events || 'none')} · Slots: ${esc(c.slots || 'none')}</p><p>${esc(c.a11y || 'No accessibility notes yet.')}</p></details>` : ''}</fieldset>`;
}
function dtBindingFields(r) {
  const sources = design().dataSources?.sources || [], source = sources.find(s => s.id === r.binding?.sourceId);
  return `<details ${r.binding ? 'open' : ''}><summary>Data binding (declaration only)</summary>${dtSelectField('Data source', 'sourceId', r.binding?.sourceId, dtRefChoices([['', 'No binding'], ...sources.map(s => [s.id, s.name])], r.binding?.sourceId))}
    ${r.binding ? dtSelectField('Source operation', 'operationId', r.binding.operationId, dtRefChoices((source?.operations || []).map(o => [o.id, o.name]), r.binding.operationId)) + dtInput('Result field path (not an expression)', 'bindingField', r.binding.field) : ''}
    <p class="small muted">No provider runs in this editor. Describe the field and operation the implementation should use.</p></details>`;
}
function dtNodeFields(f, doc) {
  const r = f.record, blocked = f.id ? dtDescendants(doc, f.id) : new Set(), parents = [['', 'Canvas root'], ...doc.nodes.filter(n => ['region', 'slot', 'component'].includes(n.kind) && !blocked.has(n.id)).map(n => [n.id, n.label])];
  return `${dtInput('Element label / accessible name', 'label', r.label)}<div class="cols2">${dtSelectField('Parent region', 'parentId', r.parentId, parents)}${r.kind === 'region' ? dtSelectField('Reading layout', 'layout', r.layout, [['stack', 'Vertical stack'], ['row', 'Horizontal row'], ['grid', 'Two-column grid']]) : `<p class="small muted">${esc(r.kind)} element. Containment is separate from interaction arrows.</p>`}</div>
    ${r.kind === 'component' ? dtComponentFields(r) : dtInput(r.kind === 'slot' ? 'Fallback slot content' : 'Content / placeholder', 'text', r.text, 8000, true)}
    ${r.kind === 'slot' ? '<p class="small muted">Use a slot name declared in the owner’s library contract as the element label.</p>' : ''}
    ${cpControlFields(r,doc)}${r.kind === 'input' ? dtControlFields(r) : ''}${r.kind === 'component' ? dtSlotFields(r,doc) : ''}${dtBindingFields(r)}${dtInput('Accessibility and validation notes', 'a11y', r.a11y, 2000, true)}
    <fieldset><legend>Visible in preview states</legend><div class="row wrap">${DETAIL_STATES.map(s => `<label class="dt-check"><input type="checkbox" data-field="dt-visible" data-key="${s}" ${r.visibleIn.includes(s) ? 'checked' : ''}>${s}</label>`).join('')}</div></fieldset>
    <details><summary>Canvas geometry (not implementation layout)</summary><div class="cols2">${dtInput('X position', 'x', r.position.x)}${dtInput('Y position', 'y', r.position.y)}${dtInput('Canvas width', 'width', r.size.width)}${dtInput('Canvas height', 'height', r.size.height)}</div><p class="small muted">Moving or resizing the canvas does not change reading order or generated layout.</p></details>`;
}
function dtEdgeFields(r, doc) {
  const choices = doc.nodes.map(n => [n.id, n.label]);
  return `<div class="cols2">${dtSelectField('From element', 'source', r.source, choices)}${dtSelectField('To element', 'target', r.target, choices)}</div>
    ${dtInput('Interaction label', 'label', r.label)}${dtInput('Trigger event', 'event', r.event, 60)}
    ${!r.effect ? dtActionFields(r,doc) : ''}${!r.action ? cpEffectFields(r) : ''}
    ${!r.action && !r.effect ? dtSelectField('Navigation target (optional)', 'targetSurfaceId', r.targetSurfaceId, dtRefChoices([['', 'Stay on this surface'], ...design().nodes.filter(dtPageEligible).map(n => [n.id, n.label])], r.targetSurfaceId)) : ''}
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
  if (cpEditField(el)) return true;
  if (dtSearchInput(el)) return true;
  if (!el.dataset.field?.startsWith('dt-') || !dtUi.form) return false;
  const key = el.dataset.field.slice(3), f = dtUi.form, r = f.record, value = el.value;
  if (dtExecutableField(key,el,f)) return true;
  if (key.startsWith('prop-')) { try { dtPropertyInput(el); } catch (error) { dtFail(error); } }
  else if (key === 'props') { f.propsText = value; f.propErrors = {}; const panel = document.getElementById('dt-properties'); if (panel) panel.innerHTML = dtPropertyRows(r); }
  else if (key === 'parentId' || key === 'targetSurfaceId') { r[key] = value || null; if (key === 'parentId') { const parent = dtDocument().nodes.find(n => n.id === value); if (parent?.component) r.slotName = cpDefinition(parent)?.slots.split(/[,\n]/)[0]?.trim() || ''; else delete r.slotName; redrawModal(); } }
  else if (['x', 'y'].includes(key)) r.position[key] = Number(value);
  else if (['width', 'height'].includes(key)) r.size[key] = Number(value);
  else if (key === 'visible') r.visibleIn = el.checked ? [...new Set([...r.visibleIn, el.dataset.key])] : r.visibleIn.filter(s => s !== el.dataset.key);
  else if (key === 'componentId') {
    const c = design().library.find(c => c.id === value); if (c) { r.component = { id: c.id, label: c.name, version: c.version, variantId: 'default' }; dtUi.error = 'Definition changed in this draft. All local overrides are retained; repair incompatible values or explicitly reset them before saving.'; redrawModal(); }
  } else if (key === 'variantId') { r.component.variantId = value; redrawModal(); }
  else if (key === 'sourceId') { const s = design().dataSources?.sources.find(s => s.id === value); r.binding = s ? { sourceId: s.id, operationId: s.operations[0]?.id || '', field: '' } : null; redrawModal(); }
  else if (key === 'operationId') r.binding.operationId = value;
  else if (key === 'bindingField') r.binding.field = value;
  else if (Object.hasOwn(r, key) && typeof r[key] === 'string') r[key] = value;
  return true;
}
function dtReviewVersion() {
  const f = dtUi.form, c = design().library.find(c => c.id === f?.record.component?.id); if (!c) throw Error('The component definition is missing.');
  // This is still a draft: the contract, retained overrides and variant are reviewed before Save.
  f.record.component.version = c.version; delete f.record.component.revisionId; dtUi.error = 'Current contract selected in this draft. Review declared props and variant before saving; incompatible overrides are rejected.'; redrawModal();
}
function dtSave() {
  if (dtUi.form?.payloadError) return dtFail(dtUi.form.payloadError);
  const f = dtUi.form; if (!f || f.removal) return;
  if (Object.keys(f.propErrors || {}).length) throw Error('Repair the invalid number or reset its override before saving.');
  const record = dtCopy(f.record);
  if (record.control?.kind === 'select') record.control.options = JSON.parse(f.optionsText);
  if (record.action) record.action[record.action.kind === 'source' ? 'input' : 'payload'] = JSON.parse(f.mappingText);
  if (f.type === 'node') {
    record.label = record.label.trim(); record.props = dtLiteralProps(f.propsText);
    if (JSON.stringify({ component: record.component, props: record.props }) !== JSON.stringify({ component: f.original.component, props: f.original.props }) || !f.id) dtValidateInstance(record);
  }
  dtCommit(store => {
    const doc = store.documents.find(d => d.id === f.documentId); if (!doc) throw Error('The design no longer exists.');
    if (f.type === 'notes') doc.notes = record.notes;
    else { const key = f.type === 'node' ? 'nodes' : 'edges', index = doc[key].findIndex(r => r.id === f.id); if (f.id && index < 0) throw Error('The element no longer exists.'); if (index < 0) doc[key].push(record); else doc[key][index] = record; }
    if (record.control || record.slots || record.action) store.schema = 2;
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

function dtControlFields(r) {
  const kinds = ['text','textarea','number','checkbox','date','datetime-local','select','json-file','json-editor','markdown-editor'];
  return `<fieldset><legend>Generated control</legend>${dtSelectField('Input type','controlKind',r.control?.kind || 'text',kinds.map(k=>[k,k]))}
    <label class="dt-check"><input type="checkbox" data-field="dt-controlRequired" ${r.control?.required?'checked':''}>Required input</label>
    ${r.control?.kind === 'select' ? dtInput('Options (JSON label/value pairs)','controlOptions',dtUi.form.optionsText,16000,true) : ''}
    <p class="small muted">JSON and Markdown editors use plain text, not executable HTML. JSON files are local, size-limited selections.</p></fieldset>`;
}
function dtSlotFields(r,doc) {
  const c=design().library.find(c=>c.id===r.component?.id), names=(c?.slots || '').split(/[\n,]/).map(s=>s.trim()).filter(Boolean);
  const occupied=new Set(doc.nodes.filter(n=>n.id!==r.id).flatMap(n=>Object.values(n.slots || {}).flat()));
  const roots=doc.nodes.filter(n=>n.parentId===null&&n.id!==r.id&&!occupied.has(n.id));
  return names.length ? `<fieldset><legend>Instance slot content</legend>${names.map(name=>`<label class="field"><span>${esc(name)}</span><select multiple data-field="dt-slot-${esc(name)}" aria-label="Content for ${esc(name)}">${roots.map(n=>`<option value="${esc(n.id)}" ${(r.slots?.[name] || []).includes(n.id)?'selected':''}>${esc(n.label)}</option>`).join('')}</select></label>`).join('')}<p class="small muted">Choose unassigned root elements. They render inside this instance instead of twice on the page. Their array order is retained.</p></fieldset>` : '';
}
function dtActionFields(r,doc) {
  const sources=design().dataSources?.sources || [], source=sources.find(s=>s.id===r.action?.sourceId), owner=doc.kind==='component'?design().library.find(c=>c.id===doc.ownerId):null;
  return `<fieldset><legend>Generated interaction</legend>${dtSelectField('Implementation','actionKind',r.action?.kind || '',[['','Business logic hook / navigation'],['source','Call a declared source operation'],...(owner?[['emit','Emit a component event']]:[])])}
    ${r.action?.kind==='source'?dtSelectField('Source','actionSource',r.action.sourceId,sources.map(s=>[s.id,s.name]))+dtSelectField('Operation','actionOperation',r.action.operationId,(source?.operations || []).map(o=>[o.id,o.name])):''}
    ${r.action?.kind==='emit'?dtSelectField('Event','actionEvent',r.action.event,parseMembers(owner.events,'events').map(m=>[m.name,m.name])):''}
    ${r.action?dtInput('Payload mapping (data only)','actionMapping',dtUi.form.mappingText,32000,true)+'<p class="small muted">Use none, value, draft, prop, event, source or object mappings. A draft refers to its stable input node ID; expressions and commands are not supported.</p>':''}</fieldset>`;
}
function dtExecutableField(key,el,f) {
  const r=f.record, value=el.value;
  if (key==='controlKind') { r.control={kind:value}; if(value==='select')r.control.options=[]; redrawModal(); }
  else if (key==='controlRequired') { r.control=r.control || {kind:'text'}; r.control.required=el.checked; }
  else if (key==='controlOptions') f.optionsText=value;
  else if (key.startsWith('slot-')) { r.slots=r.slots || {}; const ids=Array.from(el.selectedOptions).map(o=>o.value); if(ids.length)r.slots[key.slice(5)]=ids;else delete r.slots[key.slice(5)]; }
  else if (key==='actionKind') {
    const source=design().dataSources?.sources[0]; delete r.action;
    if(value==='source')r.action={kind:'source',sourceId:source?.id || '',operationId:source?.operations[0]?.id || '',input:{kind:'none'}};
    if(value==='emit')r.action={kind:'emit',event:parseMembers(design().library.find(c=>c.id===dtDocument().ownerId)?.events || '', 'events')[0]?.name || '',payload:{kind:'none'}};
    if(value)r.targetSurfaceId=null; f.mappingText=JSON.stringify({kind:'none'},null,2); redrawModal();
  } else if (key==='actionSource') { r.action.sourceId=value; r.action.operationId=design().dataSources.sources.find(s=>s.id===value)?.operations[0]?.id || ''; redrawModal(); }
  else if (key==='actionOperation') r.action.operationId=value;
  else if (key==='actionEvent') r.action.event=value;
  else if (key==='actionMapping') f.mappingText=value;
  else return false;
  return true;
}
