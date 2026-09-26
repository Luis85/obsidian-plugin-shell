// Root inspector of the component editor: Contract (export name, description, Props / Slots / Emits), Design
// (implementation primitive, prop defaults, variants), Events (template interactions that emit) and Dependencies.
// Contract edits go through visualSetContract, so a change that breaks an instance is refused with the command's
// message; dependencies go through visualSetDependencies. Every write runs inside veCommit; Preview is read-only.
const VE_CONTRACT_TABS = [['contract', 'Contract'], ['design', 'Design'], ['events', 'Events'], ['dependencies', 'Dependencies']];
const VE_API_TABS = [['props', 'Props'], ['slots', 'Slots'], ['emits', 'Emits']];
const VE_CONTRACT_FIELDS = ['ve-contract', 've-contract-row', 've-variant-row', 've-dependency', 've-dep-form'];
const VE_API_NEW = { props: ['newProp', name => ({ name, type: 'string', required: false })], slots: ['newSlot', name => ({ name, required: false })], emits: ['newEvent', name => ({ name, payloadType: 'void' })] };
// Component-level write (contract, variants, dependencies): the same guards as veWrite, without changing the selection.
// `after` redraws; text fields pass the deferred redraw so a Tab or click that ended the edit is not lost.
function veComponentWrite(change, after = render) {
  veEditable();
  const ref = veEditorRef();
  if (ref.kind !== 'component') throw Error('Open a component design first.');
  veCommit(store => { change(store, ref.id); });
  veUi.error = ''; after();
}
function veComponentIn(store, id) { const c = visualDefinition(store, { kind: 'component', id }); visualAssert(c, 'The component no longer exists.'); return c; }
// Variant values follow a renamed prop, and are dropped with a removed prop or when their type no longer matches.
function veVariantsFor(c, from, to, type = null) {
  return c.variants.map(v => ({ ...v, values: Object.fromEntries(Object.entries(v.values).flatMap(([k, x]) => (k !== from ? [[k, x]] : to && (!type || typeof x === type) ? [[to, x]] : []))) }));
}
function veRowChange(c, list, index, key, raw) {
  visualAssert(Object.hasOwn(VE_API_NEW, list), 'Choose props, slots or emits.');
  const items = structuredClone(c[list]), item = items[index], out = { [list]: items };
  visualAssert(item, 'That ' + list.slice(0, -1) + ' no longer exists.');
  if (key === 'name') {
    const name = String(raw).trim();
    if (list === 'props') out.variants = veVariantsFor(c, item.name, name);
    item.name = name;
  } else if (key === 'required') item.required = raw === true;
  else if (key === 'type') {
    visualAssert(VISUAL_PROP_TYPES.includes(raw), 'Choose string, number or boolean.');
    item.type = raw; if (item.default !== undefined && typeof item.default !== raw) delete item.default;
    out.variants = veVariantsFor(c, item.name, item.name, raw);
  } else if (key === 'payloadType') item.payloadType = raw;
  else if (key === 'default') { const value = raw === '' ? undefined : veConvert(item.type, raw, { label: 'Default of ' + item.name }); if (value === undefined) delete item.default; else item.default = value; }
  else if (key === 'description') { if (String(raw).trim()) item.description = String(raw); else delete item.description; }
  else visualAssert(false, 'Unknown contract field ' + JSON.stringify(key) + '.');
  return out;
}
function veVariantChange(c, index, key, raw) {
  const variants = structuredClone(c.variants), variant = variants[index];
  visualAssert(variant, 'That variant no longer exists.');
  if (key === 'name') { variant.name = String(raw).trim(); return variants; }
  const prop = c.props.find(p => 'value:' + p.name === key);
  visualAssert(prop, 'That prop no longer exists.');
  const value = raw === '' ? undefined : veConvert(prop.type, raw, { label: variant.name + ' · ' + prop.name });
  if (value === undefined) delete variant.values[prop.name]; else variant.values[prop.name] = value;
  return variants;
}
// Pure: apply one contract, variant or dependency field to the component in a copied store.
function veApplyContractField(store, componentId, field, { list, index, key, raw }) {
  const c = veComponentIn(store, componentId);
  if (field === 've-contract') {
    visualAssert(['exportName', 'description'].includes(key), 'Unknown contract field ' + JSON.stringify(key) + '.');
    return visualSetContract(store, c.id, { [key]: key === 'exportName' ? String(raw).trim() : String(raw) });
  }
  if (field === 've-contract-row') return visualSetContract(store, c.id, veRowChange(c, list, index, key, raw));
  if (field === 've-variant-row') return visualSetContract(store, c.id, { variants: veVariantChange(c, index, key, raw) });
  const deps = structuredClone(c.dependencies || []);
  visualAssert(field === 've-dependency' && deps[index] && ['version', 'purpose'].includes(key), 'That dependency no longer exists.');
  deps[index][key] = String(raw).trim();
  return visualSetDependencies(store, c.id, deps);
}
function veDepForm() { return (veUi.depForm ??= { package: '', version: '', purpose: '', error: '' }); }
function veContractField(el, commit, after = render) {
  const field = el.dataset.field;
  if (!VE_CONTRACT_FIELDS.includes(field)) return false;
  if (field === 've-dep-form') { const form = veDepForm(); if (['package', 'version', 'purpose'].includes(el.dataset.key)) form[el.dataset.key] = el.value; return true; }
  if (!commit) return true;
  const edit = { list: el.dataset.list || '', index: Number(el.dataset.index), key: el.dataset.key || '', raw: el.type === 'checkbox' ? el.checked : el.value };
  veComponentWrite((store, id) => veApplyContractField(store, id, field, edit), after);
  return true;
}
function veContractAdd(list) {
  veComponentWrite((store, id) => {
    const c = veComponentIn(store, id), [base, make] = VE_API_NEW[list] ?? [];
    visualAssert(make, 'Choose props, slots or emits.');
    visualAssert(c[list].length < VISUAL_LIMITS.contract, 'A component declares at most ' + VISUAL_LIMITS.contract + ' ' + list + '.');
    visualSetContract(store, id, { [list]: [...c[list], make(veUniqueName(base, new Set(c[list].map(x => x.name))))] });
  });
}
function veContractRemove(value) {
  const [list, at] = value.split(':'), index = Number(at);
  veComponentWrite((store, id) => {
    const c = veComponentIn(store, id), items = structuredClone(c[list] ?? []), [removed] = items.splice(index, 1);
    visualAssert(Object.hasOwn(VE_API_NEW, list) && removed, 'That contract entry no longer exists.');
    visualSetContract(store, id, { [list]: items, ...(list === 'props' ? { variants: veVariantsFor(c, removed.name, null) } : {}) });
  });
}
function veVariantAdd() {
  veComponentWrite((store, id) => {
    const c = veComponentIn(store, id);
    visualAssert(c.variants.length < 12, 'A component declares at most 12 variants.');
    const ids = new Set(c.variants.map(v => v.id)), vid = veUniqueName('variant', ids);
    visualSetContract(store, id, { variants: [...c.variants, { id: vid, name: 'Variant ' + (c.variants.length + 1), values: {} }] });
  });
}
function veVariantRemove(value) {
  veComponentWrite((store, id) => { const c = veComponentIn(store, id); visualSetContract(store, id, { variants: c.variants.filter((_, i) => i !== Number(value)) }); });
}
// Adding a dependency shows the validator's message inline (package name grammar, exact version) and writes nothing.
function veDependencyAdd() {
  veEditable();
  const form = veDepForm(), entry = { package: form.package.trim(), version: form.version.trim(), purpose: form.purpose.trim() }, ref = veEditorRef();
  try { veCommit(store => { visualSetDependencies(store, ref.id, [...(veComponentIn(store, ref.id).dependencies || []), entry]); }); }
  catch (error) { form.error = veErrorText(error); render(); document.getElementById('ve-dep-error')?.focus(); return; }
  veUi.depForm = null; veUi.error = ''; render();
  notify(entry.package + '@' + entry.version + ' declared. The generated project installs it with an explicit npm install.');
}
function veDependencyRemove(packageName) {
  veComponentWrite((store, id) => { visualSetDependencies(store, id, (veComponentIn(store, id).dependencies || []).filter(d => d.package !== packageName)); });
  notify(packageName + ' removed from the dependencies. Undo is available.');
}
const VE_CONTRACT_SESSION_ACTIONS = {
  've-contract-tab': value => { veUi.contractTab = VE_CONTRACT_TABS.some(([id]) => id === value) ? value : 'contract'; },
  've-api-tab': value => { veUi.apiTab = VE_API_TABS.some(([id]) => id === value) ? value : 'props'; },
};
const VE_CONTRACT_ACTIONS = {
  've-contract-add': veContractAdd, 've-contract-remove': veContractRemove, 've-variant-add': veVariantAdd, 've-variant-remove': veVariantRemove,
  've-dependency-add': veDependencyAdd, 've-dependency-remove': veDependencyRemove,
};
// Markup. Every control has an id plus data-field / data-index / data-key, so focus survives a re-render.
function veRowAttrs(field, list, index, key) { return `id="${veFieldId(field + '-' + list + '-' + index, key)}" data-field="${field}" data-list="${list}" data-index="${index}" data-key="${key}"`; }
function veRowInput(label, field, list, index, key, value, type = 'text', extra = '') {
  const id = veFieldId(field + '-' + list + '-' + index, key);
  return `<div class="field"><label for="${id}">${esc(label)}</label><input ${veRowAttrs(field, list, index, key)} type="${type}" value="${esc(value ?? '')}" autocomplete="off" ${extra}></div>`;
}
function veRowSelect(label, field, list, index, key, options, value) {
  const id = veFieldId(field + '-' + list + '-' + index, key);
  return `<div class="field"><label for="${id}">${esc(label)}</label><select ${veRowAttrs(field, list, index, key)}>${options.map(([k, name]) => `<option value="${esc(k)}"${k === value ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select></div>`;
}
function veRowCheck(label, field, list, index, key, on) { return `<label class="ve-check"><input type="checkbox" ${veRowAttrs(field, list, index, key)}${on ? ' checked' : ''}><span>${esc(label)}</span></label>`; }
// A typed value control: booleans offer Unset / true / false, so "no default" stays distinct from false.
function veTypedInput(label, field, list, index, key, type, value) {
  if (type === 'boolean') return veRowSelect(label, field, list, index, key, [['', 'Not set'], ['true', 'true'], ['false', 'false']], value === undefined ? '' : String(value));
  return veRowInput(label, field, list, index, key, value, type === 'number' ? 'number' : 'text', 'placeholder="Not set"');
}
function veContractRow(list, item, index) {
  const f = 've-contract-row', remove = button('Remove', 've-contract-remove', list + ':' + index, 'small ghost', 'trash', `aria-label="${esc('Remove ' + list.slice(0, -1) + ' ' + item.name)}"`);
  const name = veRowInput('Name', f, list, index, 'name', item.name, 'text', 'maxlength="60" spellcheck="false"'), description = veRowInput('Description', f, list, index, 'description', item.description ?? '', 'text', 'maxlength="2000"');
  let body = name;
  if (list === 'props') body += `<div class="ve-field-pair">${veRowSelect('Type', f, list, index, 'type', VISUAL_PROP_TYPES.map(t => [t, t]), item.type)}${veTypedInput('Default', f, list, index, 'default', item.type, item.default)}</div>${veRowCheck('Required', f, list, index, 'required', item.required)}`;
  if (list === 'slots') body += veRowCheck('Required', f, list, index, 'required', item.required);
  if (list === 'emits') body += veRowSelect('Payload', f, list, index, 'payloadType', VISUAL_PAYLOAD_TYPES.map(t => [t, t]), item.payloadType);
  const title = list === 'slots' ? '#' + item.name : list === 'emits' ? '@' + item.name : item.name;
  return `<li class="ve-contract-row"><fieldset><legend><code>${esc(title)}</code></legend>${body}${description}<div class="ve-inspector-actions">${remove}</div></fieldset></li>`;
}
function veContractTab(component) {
  const api = VE_API_TABS.some(([id]) => id === veUi.apiTab) ? veUi.apiTab : 'props', items = component[api];
  const identity = `<div class="field"><label for="ve-contract-exportName">Vue export name</label><input id="ve-contract-exportName" data-field="ve-contract" data-key="exportName" type="text" value="${esc(component.exportName)}" maxlength="60" spellcheck="false" autocomplete="off"></div>`
    + `<div class="field"><label for="ve-contract-description">Description</label><textarea id="ve-contract-description" data-field="ve-contract" data-key="description" rows="2" maxlength="2000">${esc(component.description)}</textarea></div>`;
  const list = items.length ? `<ul class="ve-contract-list">${items.map((item, i) => veContractRow(api, item, i)).join('')}</ul>` : `<p class="ve-pane-note">No ${api} declared yet.</p>`;
  const add = button('Add ' + api.slice(0, -1), 've-contract-add', api, 'small', 'plus', items.length >= VISUAL_LIMITS.contract ? 'disabled' : '');
  return identity + veSegment('Public API', 've-api-tab', VE_API_TABS.map(([id, label]) => [id, label + ' · ' + component[id].length]), api) + list + add;
}
function veDesignTab(component) {
  const entry = component.implementation ? visualCatalogEntry(component.implementation.entryId) : null;
  const impl = entry ? `<div class="field"><label for="ve-implementation">Nuxt UI primitive</label><input id="ve-implementation" type="text" value="${esc(entry.component + ' · ' + entry.id)}" readonly></div>` : '<p class="ve-pane-note">Composed from child elements and components; no single Nuxt UI primitive.</p>';
  const defaults = component.props.length ? component.props.map((p, i) => veTypedInput(p.name + ' · ' + p.type, 've-contract-row', 'props', i, 'default', p.type, p.default)).join('') : '<p class="ve-pane-note">Declare props in the Contract tab to give them defaults.</p>';
  const variants = component.variants.map((v, i) => `<li class="ve-contract-row"><fieldset><legend>${esc(v.name)}</legend>${veRowInput('Name', 've-variant-row', 'variants', i, 'name', v.name, 'text', 'maxlength="120"')}${component.props.map(p => veTypedInput(p.name, 've-variant-row', 'variants', i, 'value:' + p.name, p.type, v.values[p.name])).join('')}<div class="ve-inspector-actions">${button('Remove', 've-variant-remove', String(i), 'small ghost', 'trash', `aria-label="${esc('Remove variant ' + v.name)}"`)}</div></fieldset></li>`).join('');
  return veSection('Implementation', impl) + veSection('Defaults', defaults) + veSection('Variants', (variants ? `<ul class="ve-contract-list">${variants}</ul>` : '<p class="ve-pane-note">No variants. Compare shows the defaults in every state.</p>') + button('Add variant', 've-variant-add', '', 'small', 'plus', component.variants.length >= 12 ? 'disabled' : ''));
}
// Which template interactions emit each declared event (DOM or child event → emit).
function veEventsTab(component) {
  const sources = [];
  visualWalk(component.template, node => { for (const i of node.events ?? []) for (const a of i.actions) if (a.kind === 'emit') sources.push({ node, interaction: i, emit: a.event }); });
  if (!component.emits.length) return '<p class="ve-pane-note">No emits declared. Add one in Contract → Emits, then map a child event to it.</p>';
  return `<ul class="ve-interactions">${component.emits.map(e => {
    const rows = sources.filter(s => s.emit === e.name).map(s => `<li>${button(veNodeLabel(s.node) + ' @' + s.interaction.event + ' → emit ' + e.name, 've-select', s.node.id, 'small ghost', 'arrow')}</li>`).join('');
    return `<li class="ve-interaction"><div class="ve-interaction-head">${badge('@' + e.name)}<span class="ve-pane-note">${esc(e.payloadType)}</span></div>${rows ? `<ul>${rows}</ul>` : '<p class="ve-pane-note">Not emitted yet. Select a child and map one of its events in Events.</p>'}</li>`;
  }).join('')}</ul>`;
}
function veDependenciesTab(component) {
  const deps = component.dependencies || [], form = veUi.depForm || { package: '', version: '', purpose: '', error: '' }, full = deps.length >= VISUAL_DEPENDENCY_LIMIT;
  const rows = deps.map((d, i) => `<li class="ve-contract-row"><fieldset><legend><code>${esc(d.package)}</code></legend><div class="ve-field-pair">${veRowInput('Version', 've-dependency', 'dependencies', i, 'version', d.version, 'text', 'maxlength="64" spellcheck="false"')}${veRowInput('Purpose', 've-dependency', 'dependencies', i, 'purpose', d.purpose, 'text', 'maxlength="400"')}</div><div class="ve-inspector-actions">${button('Remove', 've-dependency-remove', d.package, 'small ghost', 'trash', `aria-label="${esc('Remove dependency ' + d.package)}"`)}</div></fieldset></li>`).join('');
  const draft = (label, key, extra) => `<div class="field"><label for="ve-dep-${key}">${esc(label)}</label><input id="ve-dep-${key}" data-field="ve-dep-form" data-key="${key}" type="text" value="${esc(form[key])}" autocomplete="off" ${extra}></div>`;
  const add = `<fieldset class="ve-dep-form"><legend>Declare a dependency</legend><p id="ve-dep-error" class="error" role="alert" tabindex="-1">${esc(form.error)}</p>${draft('npm package', 'package', 'maxlength="214" spellcheck="false" placeholder="@tiptap/vue-3"')}${draft('Exact version', 'version', 'maxlength="64" spellcheck="false" placeholder="2.11.5"')}${draft('Purpose', 'purpose', 'maxlength="400"')}${button('Add dependency', 've-dependency-add', '', 'small primary', 'plus', full ? 'disabled' : '')}</fieldset>`;
  const note = '<p class="ve-pane-note">Exact versions only, no ranges, tags, URLs, git or file specifiers. The generated project installs them with an explicit npm install; licenses are the author\'s responsibility. External elements mount through a hand-owned adapter.</p>';
  return (rows ? `<ul class="ve-contract-list">${rows}</ul>` : '<p class="ve-pane-note">No dependencies. Declare one to insert an External library element.</p>') + add + note;
}
function veContractHtml(component) {
  const tab = VE_CONTRACT_TABS.some(([id]) => id === veUi.contractTab) ? veUi.contractTab : 'contract', locked = veUi.mode === 'preview';
  const tabs = `<div class="ve-tabs" role="tablist" aria-label="Component sections">${VE_CONTRACT_TABS.map(([id, label]) => `<button type="button" role="tab" id="ve-ctab-${id}" aria-controls="ve-ctabpanel" aria-selected="${tab === id}" data-action="ve-contract-tab" data-value="${id}">${label}</button>`).join('')}</div>`;
  const panel = tab === 'design' ? veDesignTab(component) : tab === 'events' ? veEventsTab(component) : tab === 'dependencies' ? veDependenciesTab(component) : veContractTab(component);
  const note = locked ? '<p id="ve-preview-note" class="ve-pane-note">Preview is read-only. Switch to Design to edit.</p>' : '';
  return `<span class="ve-eyebrow">Public API</span><h2>${esc(component.exportName)}</h2>${note}${tabs}<fieldset class="ve-inspector-body"${locked ? ' disabled aria-describedby="ve-preview-note"' : ''}><legend class="ve-sr">Edit ${esc(component.exportName)}</legend><div id="ve-ctabpanel" role="tabpanel" aria-labelledby="ve-ctab-${tab}">${panel}</div></fieldset>`;
}
