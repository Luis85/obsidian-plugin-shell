// Explicit, scoped authoring controls; no code or arbitrary CSS entry points.
const cpUi = { form: null, scenario: '', play: false, session: null, variantA: 'default', variantB: '', message: '', generation: 0 };
function cpField(label, key, value, choices = null, multiline = false) {
  return choices ? uiSelect(label, 'cp-' + key, choices, value ?? '') : uiInput(label, 'cp-' + key, value ?? '', { multiline, rows: multiline ? 5 : 1 });
}
function cpControlFields(r, doc) {
  const parent = doc.nodes.find(n => n.id === r.parentId), c = parent?.component && cpDefinition(parent);
  const slots = c ? c.slots.split(/[,\n]/).map(s => s.trim()).filter(Boolean) : [];
  return `${r.kind==='slot'?cpField('Content cardinality','node-slotCapacity',r.slotCapacity||'many',[['many','One or more root elements'],['one','One root element']])+cpField('Permitted content','node-slotKinds',(r.slotKinds||[]).join(','),[['','Any safe element'],['region','Regions only'],['text,heading,input,textarea,number,checkbox,select,button,list,table,alert,divider,tabs,image','Primitives only']]):''}${c ? cpField('Instance slot', 'node-slotName', r.slotName || slots[0] || '', dtRefChoices(slots.map(s => [s, s]), r.slotName)) : ''}
    ${['select', 'tabs', 'table', 'list'].includes(r.kind) ? cpField(r.kind === 'table' ? 'Column headings (one per line)' : 'Options (one per line)', 'node-options', (r.options || []).join('\n'), null, true) : ''}
    ${doc.kind === 'component' ? cpField('Content from public property', 'node-contentProp', r.contentProp || '', [['', 'Use literal content'], ...parseMembers(dtOwner(doc)?.props || '', 'props').map(m => [m.name, m.name + ' · ' + m.type])]) : ''}`;
}
function cpLayoutFields(record) {
  const number = (label, key) => {
    const bounds={gap:[0,160],padding:[0,160],columns:[1,12],width:[24,1600],minWidth:[0,1600],maxWidth:[24,4000],'narrow-columns':[1,12]};
    const [min,max]=bounds[key];
    return uiInput(label,'cp-'+key,key==='narrow-columns'?record.narrow.columns:record[key],{type:'number',extra:`min="${min}" max="${max}" step="${key.includes('columns')?1:'any'}" inputmode="decimal"`});
  };
  const tokens = { gap: 'spacing', padding: 'spacing', color: 'colors', background: 'colors', radius: 'radii', typography: 'typography' };
  return `<fieldset><legend>Spacing and layout</legend><div class="cols2">${number('Gap (px)', 'gap')}${number('Padding (px)', 'padding')}${number('Grid columns', 'columns')}${cpField('Align items', 'align', record.align, ['start', 'center', 'end', 'stretch'].map(s => [s, s]))}${cpField('Distribute content', 'justify', record.justify, ['start', 'center', 'end', 'space-between'].map(s => [s, s]))}${cpField('Wrap row content', 'wrap', String(record.wrap), [['true', 'Wrap'], ['false', 'Keep one row']])}</div></fieldset>
    <fieldset><legend>Width</legend><div class="cols2">${cpField('Sizing', 'widthMode', record.widthMode, [['fill', 'Fill available space'], ['hug', 'Fit content'], ['fixed', 'Fixed, bounded by parent']])}${number('Preferred width (px)', 'width')}${number('Minimum width (px)', 'minWidth')}${number('Maximum width (px)', 'maxWidth')}${cpField('Overflow','overflow',record.overflow,[['visible','Visible'],['auto','Scroll when needed'],['hidden','Clip overflow']])}</div></fieldset>
    <fieldset><legend>Narrow container (640 px or less)</legend><div class="cols2">${cpField('Reading layout', 'narrow-layout', record.narrow.layout, [['stack', 'Stack'], ['row', 'Row'], ['grid', 'Grid']])}${number('Grid columns', 'narrow-columns')}${cpField('Visibility', 'narrow-hidden', String(record.narrow.hidden), [['false', 'Show'], ['true', 'Hide on narrow']])}</div><p class="small muted">These overrides apply to the preview or generated container, not the whole Obsidian window.</p></fieldset>
    <fieldset><legend>Design System references</legend><div class="cols2">${Object.entries(tokens).map(([key, group]) => cpField(key[0].toUpperCase() + key.slice(1), 'token-' + key, record.tokens[key], dtRefChoices([['', 'Literal / inherited fallback'], ...(design().designSystem?.[group] || []).map(t => [t.id, t.name])], record.tokens[key]))).join('')}</div><p class="small muted">Tokens override matching literals. Missing tokens stay visible as review questions; they are not silently replaced.</p></fieldset>`;
}
function cpBegin(type, value = '') {
  dtCanWrite(); const doc = dtDocument(); if (!doc) throw Error('Open a detail design first.');
  const node = doc.nodes.find(n => n.id === (value || dtUi.selected));
  let record;
  if (type === 'layout') { if (!node) throw Error('Select an element first.'); record = dtCopy(node.ui || compositionDefaultUI()); }
  else if (type === 'scenario') {
    record = dtCopy(doc.scenarios?.find(s => s.id === value) || { id: 'scenario-' + dtStore().nextId, name: '', state: 'default', width: 'wide', values: {}, bindings: [] });
  } else record = { confirmed: false };
  cpUi.form = { type, docId: doc.id, nodeId: node?.id || null, record, error: '', token: smToken(), valuesText: JSON.stringify(record.values || {}, null, 2), bindingsText: JSON.stringify(record.bindings || [], null, 2) };
  if(type==='pin')cpUi.form.slotMap=Object.fromEntries(doc.nodes.filter(c=>c.parentId===node.id).map(c=>[c.id,c.slotName||'']));
  showModal('composition-form');
}
function compositionForm() {
  const f = cpUi.form; if (!f) return dialogBody('Editor unavailable', '<p>Reopen the design.</p>', button('Close', 'close'));
  const doc = dtDocument(), n = doc?.nodes.find(n => n.id === f.nodeId); let body, title;
  if (f.type === 'layout') { title = 'Layout & tokens · ' + (n?.label || 'Element'); body = cpLayoutFields(f.record); }
  else if (f.type === 'scenario') {
    title = 'Fixture scenario'; body = cpField('Scenario name', 'name', f.record.name) + `<div class="cols2">${cpField('State', 'state', f.record.state, DETAIL_STATES.map(s => [s, s]))}${cpField('Width', 'width', f.record.width, [['wide', 'Wide'], ['narrow', 'Narrow']])}</div>`;
    body += `<details open><summary>Local fixture values</summary><p class="small">Use element IDs as keys. Values remain local to this scenario; they never write to a DataSource.</p>${cpField('Element values (JSON)', 'values', f.valuesText, null, true)}<div class="cp-id-list">${doc.nodes.filter(n => !['region', 'component', 'slot'].includes(n.kind)).map(n => `<p><code>${esc(n.id)}</code> ${esc(n.label)}</p>`).join('')}</div></details>`;
    body += `<fieldset><legend>Capture an existing test-data recipe</legend>${cpField('Enabled output recipe','recipe',f.recipe||'',[['','Choose a recipe'],...tdSettings().recipes.filter(r=>r.enabled).map(r=>[r.operation,r.operation])])}${button('Capture recipe output','cp-capture-recipe','','small')}<p class="small">Pure seeded generator only. Captured output stays fixed until explicitly recaptured; no provider or file writes.</p></fieldset>`;
    body += `<details><summary>DataSource result fixtures</summary>${cpField('Binding fixtures (JSON array)', 'bindings', f.bindingsText, null, true)}<p class="small">Each entry declares sourceId, operationId and value. Preview uses only these supplied fixture values; no provider or network request runs.</p></details>`;
  } else {
    title = f.type === 'publish' ? 'Publish immutable component revision' : 'Review instance revision';
    const uses = doc?.kind === 'component' ? cpImpact(doc.ownerId).length : 0;
    body = cpRevisionChanges(doc,n) + `<p>${f.type === 'publish' ? 'Capture these internals, public properties, variants, token values and their dependency revisions. Later edits will not change this snapshot.' : 'Pin this instance to a new snapshot of the working definition. Local property values and slot content are retained. Incompatible values block the change.'}</p><p>${f.type === 'publish' ? uses + ' direct or transitive use records. Existing pins are not upgraded automatically.' : 'This changes the selected instance only. Inspect Preview before exporting.'}</p><label class="cp-confirm"><input type="checkbox" data-field="cp-confirmed" ${f.record.confirmed ? 'checked' : ''}>${f.type === 'publish' ? 'Publish this revision' : 'Apply this reviewed instance update'}</label>`;
  }
  if(f.type==='pin' && n?.component) { const current=design().library.find(c=>c.id===n.component.id),slots=current?.slots.split(/[,\n]/).map(s=>s.trim()).filter(Boolean)||[];body+=doc.nodes.filter(c=>c.parentId===n.id).map(c=>cpField('Retained slot content: '+c.label,'remap-'+c.id,f.slotMap[c.id],dtRefChoices(slots.map(s=>[s,s]),f.slotMap[c.id]))).join(''); }
  return dialogBody(title, body + `<div id="cp-error" role="alert" class="error">${esc(f.error)}</div>`, button('Cancel', 'close', '', 'ghost') + (f.type === 'scenario' && dtDocument()?.scenarios?.some(s => s.id === f.record.id) ? button('Remove fixture', 'cp-delete-scenario', '', 'danger') : '') + button(f.type === 'publish' ? 'Publish revision' : 'Save changes', 'cp-save', '', 'primary'));
}
function cpEditField(el) {
  if (!el.dataset.field?.startsWith('cp-')) return false;
  const key = el.dataset.field.slice(3), value = el.value;
  if (key==='recipe' && cpUi.form) {cpUi.form.recipe=value;return true;}
  if (key.startsWith('node-') && dtUi.form) { const field = key.slice(5); dtUi.form.record[field] = field === 'options' ? value.split('\n').filter(Boolean) : field==='slotKinds'?value.split(',').filter(Boolean):value; return true; }
  if (key.startsWith('effect-') && dtUi.form) {
    const r = dtUi.form.record; if (key === 'effect-type') { if (value) { r.effect = { type: value, value: value === 'state' ? 'default' : '' }; r.targetSurfaceId = null; } else delete r.effect; redrawModal(); }
    else if (r.effect) { if(key==='effect-payload') { try { if(value.trim())r.effect.payload=JSON.parse(value);else delete r.effect.payload; dtUi.form.payloadError=''; } catch {dtUi.form.payloadError='Enter a scalar JSON payload.';} } else {const target=dtDocument().nodes.find(n=>n.id===r.target);r.effect.value=r.effect.type==='value'&&target?.kind==='checkbox'?value==='true':r.effect.type==='value'&&target?.kind==='number'?(value.trim()?Number(value):NaN):value;} } return true;
  }
  if (key.startsWith('preview-')) { const field = key.slice(8); cpUi[field === 'scenario' ? 'scenario' : field] = value; if (field === 'scenario') { const scenario = dtDocument()?.scenarios?.find(s => s.id === value); if (scenario) { dtUi.previewState = scenario.state; dtUi.width = scenario.width; } } cpUi.session = null; render(); return true; }
  const f = cpUi.form; if (!f) return false;
  if(key.startsWith('remap-'))f.slotMap[key.slice(6)]=value;
  else if (key === 'values') f.valuesText = value;
  else if (key === 'bindings') f.bindingsText = value;
  else if (key === 'confirmed') f.record.confirmed = el.checked;
  else if (key.startsWith('token-')) f.record.tokens[key.slice(6)] = value;
  else if (key.startsWith('narrow-')) f.record.narrow[key.slice(7)] = key === 'narrow-columns' ? (value.trim() ? Number(value) : NaN) : key === 'narrow-hidden' ? value === 'true' : value;
  else if (f.type === 'layout' && ['gap', 'padding', 'columns', 'width', 'minWidth', 'maxWidth'].includes(key)) f.record[key] = value.trim() ? Number(value) : NaN;
  else f.record[key] = key === 'wrap' ? value === 'true' : value;
  return true;
}
function cpSave() {
  const f = cpUi.form; if (!f) return;
  try {
    const record = dtCopy(f.record);
    if (f.type === 'scenario') { record.values = JSON.parse(f.valuesText); record.bindings = JSON.parse(f.bindingsText); }
    dtCommit(store => {
      cpUpgradeStore(store); const doc = store.documents.find(d => d.id === f.docId), n = doc?.nodes.find(n => n.id === f.nodeId);
      if (!doc) throw Error('This design no longer exists.');
      if (f.type === 'layout') { if (!n) throw Error('This element no longer exists.'); validateCompositionUI(record); n.ui = record; }
      else if (f.type === 'scenario') { doc.scenarios ||= []; const i = doc.scenarios.findIndex(s => s.id === record.id); if (i < 0) { record.id = 'scenario-' + store.nextId++; doc.scenarios.push(record); } else doc.scenarios[i] = record; }
      else {
        if (!record.confirmed) throw Error('Confirm the revision operation first.');
        if (f.type === 'publish') cpPublish(store, doc.ownerId);
        else {
          if (!n?.component) throw Error('Select a component instance.');
          const revision = cpPublish(store, n.component.id); for(const child of doc.nodes.filter(c=>c.parentId===n.id))child.slotName=f.slotMap[child.id]; const proposed = { ...n, component: { ...n.component, version: revision.version, revisionId: revision.id } };
          dtValidateInstance(proposed, { ...design(), detailDesigns: store });
          const names = revision.library.slots.split(/[,\n]/).map(s => s.trim());
          if (doc.nodes.some(child => child.parentId === n.id && !names.includes(child.slotName))) throw Error('Map retained content to a declared slot before updating this instance.');
          n.component = proposed.component;
        }
      }
    }, f.token);
    modalOriginal = null; closeModal(); cpUi.form = null; cpUi.session = null; render(); notify('Composition saved. Undo is available; published snapshots remain immutable.');
  } catch (error) { f.error = error.message; redrawModal(); }
}
function cpEffectFields(edge) {
  const target=dtDocument()?.nodes.find(n=>n.id===edge.target),choices=edge.effect?.type==='state'?DETAIL_STATES.map(s=>[s,s]):edge.effect?.type==='value'&&target?.kind==='checkbox'?[['true','Checked'],['false','Unchecked']]:edge.effect?.type==='value'&&['select','tabs'].includes(target?.kind)?(target.options||[]).map(s=>[s,s]):null;
  return `<fieldset><legend>Executable UI effect</legend>${cpField('Effect', 'effect-type', edge.effect?.type || '', [['', 'Business behavior — implementation required'], ['state', 'Set preview state'], ['toggle', 'Toggle target visibility'], ['value', 'Set target value'], ['focus', 'Focus target control'], ['emit', 'Emit declared public event']])}${edge.effect ? cpField(edge.effect.type === 'state' ? 'Target state' : edge.effect.type === 'emit' ? 'Declared event name' : 'Literal value', 'effect-value', edge.effect.value, choices) : ''}${edge.effect?.type==='emit'?cpField('Event payload (JSON scalar; leave blank for void)','effect-payload',edge.effect.payload===undefined?'':JSON.stringify(edge.effect.payload)):''}<p class="small muted">Only declared UI effects execute. Navigation uses the target above. Business rules in prose remain implementation work.</p></fieldset>`;
}
