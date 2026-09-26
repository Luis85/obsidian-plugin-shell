// Typed draft controls and property provenance; no expression evaluation or implicit resets.
function dtLiteralProps(text) {
  const value = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Overrides must be a JSON object.');
  for (const [key, item] of Object.entries(value)) {
    if (!/^[a-z][A-Za-z0-9]*$/.test(key) || ['constructor', 'prototype', '__proto__'].includes(key)) throw Error('Unsafe or invalid prop name: ' + key);
    if (!['string', 'number', 'boolean'].includes(typeof item) || typeof item === 'number' && !Number.isFinite(item)) throw Error('Prop ' + key + ' must be a finite number, text or boolean.');
  }
  return value;
}
function dtPropRows(node, d = design()) {
  const c = node.component?.revisionId ? d.detailDesigns?.revisions?.find(r => r.id === node.component.revisionId)?.library : d.library.find(c => c.id === node.component?.id);
  const variant = c && c.version === node.component.version ? variantFor(c, node.component.variantId) : null;
  const defaults = variant?.props || {}, members = c ? parseMembers(c.props, 'props') : [];
  const keys = [...new Set([...members.map(m => m.name), ...Object.keys(defaults), ...Object.keys(node.props)])];
  return keys.map(name => {
    const local = Object.hasOwn(node.props, name), inherited = Object.hasOwn(defaults, name), type = members.find(m => m.name === name)?.type;
    return { name, type, value: local ? node.props[name] : defaults[name], source: local ? 'Local override' : inherited ? 'Variant default' : 'Not set',
      inherited, defaultValue: defaults[name], local, compatible: !!type && (!local || typeof node.props[name] === type) };
  });
}
function dtPropertyRows(r) {
  let props;
  try { props = dtLiteralProps(dtUi.form.propsText); } catch (error) { return `<p class="warning">${esc(error.message)} Repair Advanced JSON to restore typed controls.</p>`; }
  const rows = dtPropRows({ ...r, props });
  return rows.map(row => {
    const key = esc(row.name), id = 'dt-prop-' + key, supported = ['string', 'number', 'boolean'].includes(row.type);
    const value = dtUi.form.propErrors?.[row.name]?.raw ?? row.value;
    const extra = `data-key="${key}" ${!row.local || !supported ? 'disabled' : ''} aria-describedby="${id}-status"`;
    const control = row.type === 'boolean' ? uiSelect(row.name, id, [['true', 'True'], ['false', 'False']], String(value ?? false), extra) : uiInput(row.name, id, value === undefined ? '' : String(value), { field: id, extra: extra + ' maxlength="2000"', hint: '' });
    return `<div class="dt-property-row">${control}<div id="${id}-status" class="dt-property-status"><span class="dt-tag">${esc(row.source)}</span><span>${esc(row.type || 'Not declared')}</span>${row.local ? button(row.inherited ? 'Use default' : 'Remove override', 'dt-prop-reset', row.name, 'small ghost', '', `aria-label="Reset ${key} override"`) : supported ? button('Override', 'dt-prop-override', row.name, 'small ghost', '', `aria-label="Override ${key}"`) : ''}</div>${row.local && !row.compatible ? '<p class="warning small">Retained value does not match the current declaration. Repair or explicitly remove this override before saving.</p>' : ''}${dtUi.form.propErrors?.[row.name] ? '<p class="error small" role="alert">Enter a finite number, or reset this override.</p>' : ''}</div>`;
  }).join('') || '<p class="small muted">No declared props. Configure the reusable contract in the Component library.</p>';
}
function dtPropertyFields(r) {
  return `<p class="small muted">Defaults belong to the selected variant; overrides belong to this instance. Version mismatches do not inherit current defaults.</p><div id="dt-properties">${dtPropertyRows(r)}</div><details class="dt-advanced-props"><summary>Advanced JSON / repair retained overrides</summary>${dtInput('Instance prop overrides (JSON literals only)', 'props', dtUi.form.propsText, 10000, true)}<p class="small muted">Only text, finite numbers and booleans. No expressions or nested objects.</p></details>`;
}
function dtPropertyAction(action, name) {
  const f = dtUi.form; if (!f || f.type !== 'node' || !f.record.component) throw Error('Open a component instance first.');
  const props = dtLiteralProps(f.propsText), row = dtPropRows({ ...f.record, props }).find(r => r.name === name);
  if (!row) throw Error('That prop no longer exists.');
  if (action === 'reset') delete props[name];
  else {
    if (!['string', 'number', 'boolean'].includes(row.type)) throw Error('This prop type has no literal editor.');
    props[name] = row.inherited && typeof row.defaultValue === row.type ? row.defaultValue : ({ string: '', number: 0, boolean: false })[row.type];
  }
  if (f.propErrors) delete f.propErrors[name];
  f.propsText = JSON.stringify(props, null, 2); dtUi.error = ''; redrawModal();
}
function dtPropertyInput(el) {
  const f = dtUi.form, name = el.dataset.key, props = dtLiteralProps(f.propsText);
  const row = dtPropRows({ ...f.record, props }).find(r => r.name === name);
  if (!row?.local) return;
  f.propErrors ||= {};
  if (row.type === 'number' && (!el.value.trim() || !Number.isFinite(Number(el.value)))) {
    f.propErrors[name] = { raw: el.value }; el.setAttribute('aria-invalid', 'true');
    const error = document.getElementById('dt-form-error'); if (error) error.textContent = 'Enter a finite number for ' + name + '. Empty input is not zero.';
    return;
  }
  delete f.propErrors[name]; el.removeAttribute('aria-invalid');
  props[name] = row.type === 'number' ? Number(el.value) : row.type === 'boolean' ? el.value === 'true' : el.value;
  f.propsText = JSON.stringify(props, null, 2);
  const raw = document.querySelector('[data-field="dt-props"]'); if (raw) raw.value = f.propsText;
  const error = document.getElementById('dt-form-error'); if (error && !Object.keys(f.propErrors).length) error.textContent = '';
}
