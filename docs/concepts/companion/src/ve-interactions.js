// Interaction builder (modal 've-interaction'). The draft lives in veUi.interactionForm and is written once, on Save,
// through veCommit. An interaction without actions is the explicit implementation TODO the generator keeps.
const VE_ACTION_KINDS = [['navigate', 'Navigate to a surface'], ['set-state', 'Show a state'], ['toggle', 'Toggle an element'], ['focus', 'Focus an element'], ['set-value', 'Set a form value'], ['source', 'Call a data source'], ['emit', 'Emit an event']];
const VE_MAPPINGS = [['none', 'No payload'], ['event', 'Event payload'], ['draft', 'Form value'], ['value', 'Fixed JSON value']];
// Unparsed JSON payload text per mapping object (survives reordering; parsed on Save).
const veJsonDrafts = new WeakMap();
function veEventChoices(store, node) {
  const contract = veNodeContract(store, node), emits = (contract?.emits ?? []).map(e => e.name);
  return [...new Set([...emits, ...VISUAL_DOM_EVENTS])];
}
function veSurfaceChoices(d = design()) { return d.nodes.filter(n => !['group', 'action'].includes(n.kind)).map(n => [n.id, n.label + ' · ' + n.kind]); }
function veFocusable(n) { return visualIsControl(n) || n.ref?.entryId === 'u-button' || (n.kind === 'element' && ['button', 'input'].includes(n.tag)); }
function veActionTargets(definition, kind) {
  const nodes = visualNodes(visualRoot(definition));
  return kind === 'focus' ? nodes.filter(veFocusable) : kind === 'set-value' ? nodes.filter(visualIsControl) : nodes;
}
function veBooleanControl(node) { return ['u-checkbox', 'u-switch'].includes(node?.ref?.entryId); }
// Given / When / Then parts of an acceptance text. Unprefixed text belongs to Given.
function veAcceptanceParts(text) {
  const parts = { given: '', when: '', then: '' }, loose = [];
  let current = null;
  for (const line of String(text || '').split('\n')) {
    const match = /^(given|when|then)\b\s*(.*)$/i.exec(line.trim());
    if (match) { current = match[1].toLowerCase(); parts[current] = parts[current] ? parts[current] + '\n' + match[2] : match[2]; }
    else if (current) parts[current] += '\n' + line;
    else loose.push(line);
  }
  const extra = loose.join('\n').trim();
  if (extra) parts.given = parts.given ? extra + '\n' + parts.given : extra;
  return parts;
}
// Unchanged parts keep the original text byte for byte; edited parts are written as Given/When/Then lines.
function veAcceptanceText(form) {
  if (['given', 'when', 'then'].every(k => form[k] === form.initial[k])) return form.original;
  return [['Given', form.given], ['When', form.when], ['Then', form.then]].filter(([, v]) => v.trim()).map(([k, v]) => k + ' ' + v.trim()).join('\n');
}
function veNewMapping(kind, definition) {
  if (kind === 'draft') return { kind: 'draft', nodeId: veControls(definition)[0]?.id ?? '' };
  if (kind === 'value') return { kind: 'value', value: null };
  return { kind: ['none', 'event'].includes(kind) ? kind : 'none' };
}
function veNewAction(kind, definition, d = design()) {
  const first = list => list[0] ?? '';
  if (kind === 'navigate') return { kind, surfaceId: first(veSurfaceChoices(d).map(([id]) => id)) };
  if (kind === 'set-state') return { kind, state: 'default' };
  if (['toggle', 'focus'].includes(kind)) return { kind, nodeId: first(veActionTargets(definition, kind).map(n => n.id)) };
  if (kind === 'set-value') { const target = veActionTargets(definition, kind)[0]; return { kind, nodeId: target?.id ?? '', value: veBooleanControl(target) ? false : '' }; }
  if (kind === 'source') { const s = d.dataSources?.sources.find(x => x.operations.length); return { kind, sourceId: s?.id ?? '', operationId: s?.operations[0].id ?? '', input: { kind: 'none' } }; }
  if (kind === 'emit') return { kind, event: 'activate', payload: { kind: 'none' } };
  visualAssert(false, 'Choose an action kind.');
}
function veInteractionNode() {
  const page = veCurrentPage(), node = page && veUi.selected ? visualLocate(page.root, veUi.selected)?.node : null;
  if (!node) throw Error('Select an element first.');
  if (!Array.isArray(node.events)) throw Error(veKindLabel(node) + ' has no interactions. Select a button, control or element.');
  return { page, node };
}
function veOpenInteraction(interactionId = '') {
  veEditable();
  const { node } = veInteractionNode(), existing = interactionId ? node.events.find(i => i.id === interactionId) : null;
  if (interactionId && !existing) throw Error('The interaction no longer exists.');
  if (!existing && node.events.length >= VISUAL_LIMITS.interactions) throw Error('An element holds at most ' + VISUAL_LIMITS.interactions + ' interactions.');
  const record = existing ? structuredClone(existing) : { event: veEventChoices(veStore(), node)[0], label: '', actions: [], notes: '', acceptance: '' };
  const parts = veAcceptanceParts(record.acceptance);
  veUi.interactionForm = { nodeId: node.id, interactionId: existing?.id ?? null, record, ...parts, initial: parts, original: record.acceptance, error: '', token: smToken() };
  showModal('ve-interaction');
}
// Field changes update the draft; a changed action shape redraws the dialog.
function veActionField(form, index, key, value, definition) {
  const actions = form.record.actions, action = actions[index];
  if (!action) return false;
  if (key === 'kind') { actions[index] = veNewAction(value, definition); return true; }
  if (key === 'sourceId') { const s = design().dataSources?.sources.find(x => x.id === value); Object.assign(action, { sourceId: value, operationId: s?.operations[0]?.id ?? '' }); return true; }
  if (key === 'mapping') { action[action.kind === 'emit' ? 'payload' : 'input'] = veNewMapping(value, definition); return true; }
  if (key === 'mappingNode') { action[action.kind === 'emit' ? 'payload' : 'input'].nodeId = value; return false; }
  if (key === 'mappingValue') { veJsonDrafts.set(action[action.kind === 'emit' ? 'payload' : 'input'], value); return false; }
  if (key === 'nodeId' && action.kind === 'set-value') { const target = visualLocate(visualRoot(definition), value)?.node; Object.assign(action, { nodeId: value, value: veBooleanControl(target) ? false : '' }); return true; }
  if (key === 'value') { action.value = typeof value === 'boolean' ? value : String(value); return false; }
  action[key] = value;
  return false;
}
function veInteractionField(el) {
  const form = veUi.interactionForm, field = el.dataset.field;
  if (!['ve-int', 've-act'].includes(field)) return false;
  if (!form) return true;
  const key = el.dataset.key, value = el.type === 'checkbox' ? el.checked : el.value;
  if (field === 've-int') { if (['given', 'when', 'then'].includes(key)) form[key] = value; else if (['event', 'label', 'notes'].includes(key)) form.record[key] = value; return true; }
  const page = veCurrentPage();
  if (page && veActionField(form, Number(el.dataset.index), key, value, page)) redrawModal();
  return true;
}
// Complete the draft: parse JSON payloads and name the first incomplete action.
function veInteractionData(form) {
  const label = form.record.label.trim();
  if (!label) throw Error('Give the interaction a label, for example “Open customer”.');
  const actions = form.record.actions.map((action, i) => {
    const copy = structuredClone(action), draft = veJsonDrafts.get(action.payload ?? action.input), mapping = copy.payload ?? copy.input, where = 'Action ' + (i + 1) + ' (' + VE_ACTION_KINDS.find(([k]) => k === copy.kind)[1] + ')';
    if (mapping?.kind === 'value' && draft !== undefined) mapping.value = veConvert('json', draft, { label: where + ' payload' }) ?? null;
    const missing = { navigate: 'surfaceId', toggle: 'nodeId', focus: 'nodeId', 'set-value': 'nodeId', source: 'operationId', emit: 'event' }[copy.kind];
    if (missing && !copy[missing]) throw Error(where + ': choose ' + { surfaceId: 'a surface', nodeId: 'a target element', operationId: 'a source operation', event: 'an event name' }[missing] + '.');
    if (mapping?.kind === 'draft' && !mapping.nodeId) throw Error(where + ': choose the form control whose value is sent.');
    return copy;
  });
  return { event: form.record.event, label, actions, notes: form.record.notes, acceptance: veAcceptanceText(form) };
}
function veSaveInteraction() {
  const form = veUi.interactionForm, page = veCurrentPage();
  if (!form || !page) throw Error('Reopen the interaction from the inspector.');
  veEditable();
  const data = veInteractionData(form), ref = { kind: 'page', id: page.id };
  veCommit(store => { if (form.interactionId) visualUpdateInteraction(store, ref, form.nodeId, form.interactionId, data); else visualAddInteraction(store, ref, form.nodeId, data); }, form.token);
  veUi.interactionForm = null; modalOriginal = null; closeModal();
  Object.assign(veUi, { selected: form.nodeId, inspector: 'actions', error: '' }); render();
  notify(data.actions.length ? 'Interaction saved. Undo is available.' : 'Interaction saved as “Implementation required”. The generator keeps it as a TODO.');
}
function veRemoveInteraction(interactionId) {
  const { node } = veInteractionNode(), interaction = node.events.find(i => i.id === interactionId);
  if (!interaction) throw Error('The interaction no longer exists.');
  vePageWrite((store, ref) => { visualRemoveInteraction(store, ref, node.id, interactionId); return node.id; });
  notify('Interaction “' + interaction.label + '” removed. Undo is available.');
}
function veDraftActions(change) {
  const form = veUi.interactionForm, page = veCurrentPage();
  if (!form || !page) throw Error('Reopen the interaction from the inspector.');
  change(form.record.actions, page); form.error = ''; redrawModal();
}
const VE_INTERACTION_ACTIONS = {
  've-interaction-add': () => veOpenInteraction(),
  've-interaction-edit': value => veOpenInteraction(value),
  've-interaction-remove': veRemoveInteraction,
  've-interaction-save': veSaveInteraction,
  've-act-add': () => veDraftActions((actions, page) => { if (actions.length >= VISUAL_LIMITS.actions) throw Error('An interaction runs at most ' + VISUAL_LIMITS.actions + ' actions.'); actions.push(veNewAction('navigate', page)); }),
  've-act-remove': value => veDraftActions(actions => { actions.splice(Number(value), 1); }),
  've-act-move': value => veDraftActions(actions => {
    const [index, direction] = value.split(':'), from = Number(index), to = from + (direction === 'up' ? -1 : 1);
    if (to >= 0 && to < actions.length) [actions[from], actions[to]] = [actions[to], actions[from]];
  }),
};
// Dialog markup. Every action control carries data-index + data-key, so focus survives a redraw.
function veActAttrs(index, key) { return `id="ve-act-${index}-${key}" data-field="ve-act" data-index="${index}" data-key="${key}"`; }
function veActField(label, index, key, control) { return `<div class="field"><label for="ve-act-${index}-${key}">${esc(label)}</label>${control}</div>`; }
function veActSelect(index, key, options, value) {
  const list = options.some(([k]) => k === value) ? options : [[value, value || 'Choose…'], ...options];
  return `<select ${veActAttrs(index, key)}>${list.map(([k, name]) => `<option value="${esc(k)}"${k === value ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select>`;
}
function veMappingFields(index, mapping, definition) {
  const kinds = VE_MAPPINGS.some(([k]) => k === mapping.kind) ? VE_MAPPINGS : [[mapping.kind, 'Keep existing ' + mapping.kind + ' mapping'], ...VE_MAPPINGS];
  let html = veActField('Payload', index, 'mapping', veActSelect(index, 'mapping', kinds, mapping.kind));
  if (mapping.kind === 'draft') html += veActField('Form control', index, 'mappingNode', veActSelect(index, 'mappingNode', veControls(definition).map(n => [n.id, veNodeLabel(n)]), mapping.nodeId));
  if (mapping.kind === 'value') html += veActField('JSON value', index, 'mappingValue', `<textarea ${veActAttrs(index, 'mappingValue')} rows="2" spellcheck="false">${esc(veJsonDrafts.get(mapping) ?? JSON.stringify(mapping.value))}</textarea>`);
  return html;
}
function veActionFields(action, index, definition, d = design()) {
  const nodes = kind => veActionTargets(definition, kind).map(n => [n.id, veNodeLabel(n)]);
  if (action.kind === 'navigate') return veActField('Surface', index, 'surfaceId', veActSelect(index, 'surfaceId', veSurfaceChoices(d), action.surfaceId));
  if (action.kind === 'set-state') return veActField('State', index, 'state', veActSelect(index, 'state', VISUAL_STATES.map(s => [s, s]), action.state));
  if (['toggle', 'focus'].includes(action.kind)) return veActField('Target element', index, 'nodeId', veActSelect(index, 'nodeId', nodes(action.kind), action.nodeId));
  if (action.kind === 'set-value') {
    const target = visualLocate(visualRoot(definition), action.nodeId)?.node;
    const value = veBooleanControl(target) ? `<input type="checkbox" ${veActAttrs(index, 'value')}${action.value === true ? ' checked' : ''}>` : `<input type="text" ${veActAttrs(index, 'value')} value="${esc(action.value ?? '')}" autocomplete="off">`;
    return veActField('Form control', index, 'nodeId', veActSelect(index, 'nodeId', nodes('set-value'), action.nodeId)) + veActField('Value', index, 'value', value);
  }
  if (action.kind === 'source') {
    const sources = d.dataSources?.sources || [], source = sources.find(s => s.id === action.sourceId);
    return veActField('Data source', index, 'sourceId', veActSelect(index, 'sourceId', sources.map(s => [s.id, s.name]), action.sourceId)) + veActField('Operation', index, 'operationId', veActSelect(index, 'operationId', (source?.operations || []).map(o => [o.id, o.name + ' · ' + o.direction]), action.operationId)) + veMappingFields(index, action.input, definition);
  }
  return veActField('Event name', index, 'event', `<input type="text" ${veActAttrs(index, 'event')} value="${esc(action.event)}" maxlength="60" autocomplete="off">`) + veMappingFields(index, action.payload, definition);
}
function veActionRow(action, index, count, definition) {
  const tools = `${button('Up', 've-act-move', index + ':up', 'small ghost', '', `aria-label="Move action ${index + 1} earlier"${index === 0 ? ' disabled' : ''}`)}${button('Down', 've-act-move', index + ':down', 'small ghost', '', `aria-label="Move action ${index + 1} later"${index === count - 1 ? ' disabled' : ''}`)}${button('Remove', 've-act-remove', String(index), 'small ghost', 'trash', `aria-label="Remove action ${index + 1}"`)}`;
  return `<li class="ve-action-row"><fieldset><legend>Action ${index + 1}</legend><div class="ve-action-grid">${veActField('Kind', index, 'kind', veActSelect(index, 'kind', VE_ACTION_KINDS, action.kind))}${veActionFields(action, index, definition)}</div><div class="ve-inspector-actions">${tools}</div></fieldset></li>`;
}
function veInteractionForm() {
  const form = veUi.interactionForm, page = veCurrentPage(), node = form && page ? visualLocate(page.root, form.nodeId)?.node : null;
  if (!node) return dialogBody('Interaction unavailable', '<p>The element no longer exists. Close this dialog; nothing was changed.</p>', button('Close', 'close'));
  const events = veEventChoices(veStore(), node), eventOptions = (events.includes(form.record.event) ? events : [form.record.event, ...events]).map(e => [e, e]);
  const actions = form.record.actions;
  const list = actions.length ? `<ol class="ve-action-list">${actions.map((a, i) => veActionRow(a, i, actions.length, page)).join('')}</ol>` : '<p class="ve-pane-note">No actions yet. Saving now records “Implementation required”, which the generator keeps as a TODO.</p>';
  const body = `<p id="ve-int-error" class="error" role="alert" tabindex="-1">${esc(form.error)}</p>
    <div class="field-grid">${veSelectHtml('Event', 've-int', 'event', eventOptions, form.record.event)}${uiInput('Label', 've-int-label', form.record.label, { field: 've-int', extra: 'data-key="label" maxlength="120" required autocomplete="off" autofocus' })}</div>
    <fieldset><legend>Actions, in order</legend>${list}${button('Add action', 've-act-add', '', 'small', 'plus', actions.length >= VISUAL_LIMITS.actions ? 'disabled' : '')}</fieldset>
    <fieldset><legend>Acceptance</legend>${['given', 'when', 'then'].map(k => uiInput(k[0].toUpperCase() + k.slice(1), 've-int-' + k, form[k], { field: 've-int', multiline: true, rows: 2, extra: `data-key="${k}" maxlength="2600"` })).join('')}</fieldset>
    ${uiInput('Notes', 've-int-notes', form.record.notes, { field: 've-int', multiline: true, rows: 2, extra: 'data-key="notes" maxlength="4000"' })}`;
  return dialogBody((form.interactionId ? 'Edit interaction · ' : 'Add interaction · ') + veNodeLabel(node), body, button('Cancel', 'close', '', 'ghost') + button('Save interaction', 've-interaction-save', '', 'primary', 'check'));
}
// One-line summary per action for the inspector list.
function veActionSummary(action, definition, d = design()) {
  const name = id => { const n = visualLocate(visualRoot(definition), id)?.node; return n ? veNodeLabel(n) : id; };
  if (action.kind === 'navigate') return 'Navigate to ' + (d.nodes.find(n => n.id === action.surfaceId)?.label || action.surfaceId);
  if (action.kind === 'set-state') return 'Show the ' + action.state + ' state';
  if (action.kind === 'toggle') return 'Toggle ' + name(action.nodeId);
  if (action.kind === 'focus') return 'Focus ' + name(action.nodeId);
  if (action.kind === 'set-value') return 'Set ' + name(action.nodeId) + ' to ' + JSON.stringify(action.value);
  if (action.kind === 'source') { const s = d.dataSources?.sources.find(x => x.id === action.sourceId); return 'Call ' + (s?.name || action.sourceId) + ' / ' + (s?.operations.find(o => o.id === action.operationId)?.name || action.operationId); }
  return 'Emit ' + action.event;
}
