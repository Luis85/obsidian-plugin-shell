// Inspector fields: typed value conversion, value specs per node, field markup and the field dispatcher.
// Conversions throw plain errors naming the field. veApplyField is pure over a copied store; veInspectorField runs it
// inside veCommit, so a failed conversion or validation changes nothing.
const VE_BINDING_KINDS = [['literal', 'Literal'], ['source', 'Source'], ['state', 'Form value']];
const VE_INSPECTOR_FIELDS = ['ve-name', 've-prop', 've-attr', 've-role', 've-tag', 've-layout-mode', 've-layout', 've-visible', 've-a11y', 've-bind-kind', 've-bind-source', 've-bind-operation', 've-bind-field', 've-bind-state'];
const VE_ELEMENT_ATTRS = { img: ['alt', 'src'], input: ['placeholder', 'type', 'name'], button: ['type'], label: ['for'] };
const VE_LAYOUT_BOUNDS = { gap: [0, 160], padding: [0, 160], columns: [1, 12], width: [24, 1600], minWidth: [0, 1600], maxWidth: [24, 4000], 'narrow.columns': [1, 12] };
const VE_LAYOUT_CHOICES = { align: ['start', 'center', 'end', 'stretch'], justify: ['start', 'center', 'end', 'space-between'], overflow: ['visible', 'auto', 'hidden'], widthMode: ['fill', 'hug', 'fixed'], 'narrow.layout': ['stack', 'row', 'grid'] };
const VE_TOKEN_GROUPS = { gap: 'spacing', padding: 'spacing', color: 'colors', background: 'colors', radius: 'radii', typography: 'typography' };
// Raw field input → typed literal value. `undefined` means "not set": the prop falls back to its catalog default.
function veConvert(kind, raw, { label = 'Value', options = [], required = false } = {}) {
  if (kind === 'boolean') return raw === true || raw === 'true';
  const text = typeof raw === 'string' ? raw : String(raw ?? '');
  if (kind === 'number') {
    if (text.trim() === '') { if (required) throw Error(label + ' needs a number.'); return undefined; }
    const number = Number(text);
    if (!Number.isFinite(number)) throw Error(label + ' must be a number.');
    return number;
  }
  if (kind === 'enum') {
    if (text === '' && !required) return undefined;
    if (!options.includes(text)) throw Error(label + ' must be one of ' + options.join(', ') + '.');
    return text;
  }
  if (kind === 'json') {
    if (text.trim() === '') { if (required) throw Error(label + ' needs a JSON value.'); return undefined; }
    let value;
    try { value = JSON.parse(text); } catch (error) { throw Error(label + ': the JSON is invalid. ' + (error instanceof Error ? error.message : '')); }
    try { compositionLiteral(value); } catch (error) { throw Error(label + ': ' + String(error.message).replace(/^COMPOSITION_INVALID: /, '')); }
    return value;
  }
  if (text === '' && !required) return undefined;
  return text;
}
function veFieldKind(prop) { return prop.options ? 'enum' : ['string', 'number', 'boolean'].includes(prop.type) ? prop.type : 'json'; }
// The contract a component node satisfies: catalog entry, pinned revision or live project component.
function veNodeContract(store, node) {
  if (node.kind !== 'component') return null;
  if (node.ref.kind === 'nuxt-ui') return visualCatalogEntry(node.ref.entryId);
  return node.ref.revisionId ? store.revisions.find(r => r.id === node.ref.revisionId)?.contract ?? null : store.components.find(c => c.id === node.ref.componentId) ?? null;
}
// Value specs: every property the inspector can set or bind. '@value' is a text node's content.
function veValueSpecs(store, node) {
  if (node.kind === 'text') return [{ key: '@value', label: 'Text', kind: 'string', type: 'string', required: true, options: [] }];
  const contract = veNodeContract(store, node);
  return (contract?.props ?? []).map(p => ({ key: p.name, label: p.name, kind: veFieldKind(p), type: p.type, options: p.options ?? [], required: !!p.required, default: p.default, description: p.description }));
}
function veValueSpec(store, node, key) {
  const spec = veValueSpecs(store, node).find(s => s.key === key);
  visualAssert(spec, (node.name || node.id) + ' has no property ' + JSON.stringify(key) + '.');
  return spec;
}
function veCurrentExpr(node, key) { return key === '@value' ? node.value : node.props?.[key]; }
function veSetExpr(store, ref, node, key, expr) {
  if (key === '@value') return visualUpdateNode(store, ref, node.id, { value: expr ?? visualLiteral('') });
  const props = { ...node.props };
  if (expr === undefined) delete props[key]; else props[key] = expr;
  return visualUpdateNode(store, ref, node.id, { props });
}
// Typed literal for a spec with nothing chosen yet (binding switched back to Literal).
function veEmptyLiteral(spec) {
  if (spec.default !== undefined) return spec.default;
  if (spec.kind === 'json') return spec.type === 'array' ? [] : spec.type === 'object' ? {} : null;
  return veTypeDefault(spec.type);
}
// Read operations a display value can bind to, with the fields of their declared output shape.
function veReadSources(d = design()) {
  return (d.dataSources?.sources || []).map(s => ({ source: s, operations: s.operations.filter(o => ['read', 'both'].includes(o.direction)) })).filter(x => x.operations.length);
}
function veOperationFields(sourceId, operationId, d = design()) {
  const op = d.dataSources?.sources.find(s => s.id === sourceId)?.operations.find(o => o.id === operationId);
  if (!op) return [];
  const shape = dsResolveShape(op.output, d), record = shape?.type === 'array' ? shape.items : shape;
  return record?.type === 'object' ? Object.keys(record.properties || {}) : [];
}
function veControls(definition, except = null) { return visualNodes(visualRoot(definition)).filter(n => n.id !== except && visualIsControl(n)); }
function veBindingExpr(kind, spec, definition, node, d = design()) {
  // Back to Literal: optional props fall back to their default; required ones (and text) get a typed empty literal.
  if (kind === 'literal') return spec.required ? visualLiteral(veEmptyLiteral(spec)) : undefined;
  if (kind === 'source') {
    const first = veReadSources(d)[0];
    visualAssert(first, 'Declare a data source with a read operation first (Data Sources).');
    return { kind: 'source', sourceId: first.source.id, operationId: first.operations[0].id, field: '' };
  }
  if (kind === 'state') {
    const control = veControls(definition, node.id)[0];
    visualAssert(control, 'Add a form control (input, select, checkbox or switch) to this page first.');
    return { kind: 'state', nodeId: control.id };
  }
  visualAssert(false, 'Choose Literal, Source or Form value.');
}
function veBindingPatch(expr, key, value, d = design()) {
  visualAssert(expr?.kind === 'source' || (expr?.kind === 'state' && key === 've-bind-state'), 'Choose the binding kind first.');
  if (key === 've-bind-state') return { ...expr, nodeId: value };
  if (key === 've-bind-source') {
    const read = veReadSources(d).find(x => x.source.id === value);
    visualAssert(read, 'That data source has no read operation.');
    return { ...expr, sourceId: value, operationId: read.operations[0].id, field: '' };
  }
  if (key === 've-bind-operation') return { ...expr, operationId: value, field: '' };
  return { ...expr, field: value };
}
function veLayoutValue(key, raw) {
  if (key === 'wrap' || key === 'narrow.hidden') return raw === true || raw === 'true';
  if (VE_LAYOUT_BOUNDS[key]) return veConvert('number', raw, { label: key, required: true });
  if (VE_LAYOUT_CHOICES[key]) return veConvert('enum', raw, { label: key, options: VE_LAYOUT_CHOICES[key], required: true });
  visualAssert(key.startsWith('tokens.') && Object.hasOwn(VE_TOKEN_GROUPS, key.slice(7)), 'Unknown layout field ' + JSON.stringify(key) + '.');
  return String(raw);
}
function veVisibleIn(node, state, on) {
  const current = node.visibleIn ?? [...VISUAL_STATES], next = VISUAL_STATES.filter(s => (s === state ? on : current.includes(s)));
  visualAssert(next.length, 'Keep the element visible in at least one state.');
  return next.length === VISUAL_STATES.length ? undefined : next;
}
// Pure: apply one inspector field to the node in a copied store. Returns the node.
function veApplyField(store, ref, nodeId, field, key, raw) {
  const node = visualLocate(visualRoot(visualDefinition(store, ref) ?? { root: [] }), nodeId)?.node;
  visualAssert(node, 'The element no longer exists.');
  const update = patch => visualUpdateNode(store, ref, nodeId, patch);
  if (field === 've-name') return update({ name: String(raw).trim() || undefined });
  if (field === 've-a11y') return update({ a11y: String(raw).trim() ? String(raw) : undefined });
  if (field === 've-role') return update({ role: raw });
  if (field === 've-tag') return update({ tag: raw });
  if (field === 've-prop') {
    const spec = veValueSpec(store, node, key), value = veConvert(spec.kind, raw, spec);
    return veSetExpr(store, ref, node, key, value === undefined ? undefined : visualLiteral(value));
  }
  if (field === 've-attr') { const attrs = { ...node.attrs }, text = String(raw); if (text) attrs[key] = visualLiteral(text); else delete attrs[key]; return update({ attrs }); }
  if (field === 've-visible') return update({ visibleIn: veVisibleIn(node, key, raw === true) });
  if (field === 've-layout-mode') return update({ layout: raw ? { mode: veConvert('enum', raw, { label: 'Layout', options: [...VISUAL_LAYOUT_MODES], required: true }), ui: node.layout?.ui ?? compositionDefaultUI() } : undefined });
  if (field === 've-layout') {
    visualAssert(node.layout, 'Choose a layout mode first.');
    const ui = structuredClone(node.layout.ui), path = key.split('.'), value = veLayoutValue(key, raw);
    if (path.length === 2) ui[path[0]][path[1]] = value; else ui[key] = value;
    return update({ layout: { mode: node.layout.mode, ui } });
  }
  const spec = veValueSpec(store, node, key), definition = visualDefinition(store, ref);
  if (field === 've-bind-kind') return veSetExpr(store, ref, node, key, veBindingExpr(raw, spec, definition, node));
  return veSetExpr(store, ref, node, key, veBindingPatch(veCurrentExpr(node, key), field, raw));
}
// Everything a commit needs, read from the field once: the page, the element the field was rendered for, field and value.
function veCaptureField(el) {
  return { ref: vePageRef(), nodeId: el.closest?.('[data-inspected]')?.dataset.inspected || veSelectedId(), field: el.dataset.field, key: el.dataset.key || '', raw: el.type === 'checkbox' ? el.checked : el.value };
}
// Dispatcher entry (from veFieldEdit). Text-like fields keep their draft while typing and commit on change. The write is
// synchronous from the captured values; `after` redraws (text fields pass a deferred redraw, see ve-actions.js).
function veInspectorField(el, commit, after = render) {
  if (!VE_INSPECTOR_FIELDS.includes(el.dataset.field)) return false;
  if (!commit) return true;
  veEditable();
  const edit = veCaptureField(el), inline = el.dataset.error ? document.getElementById(el.dataset.error) : null;
  try { veCommit(store => { veApplyField(store, edit.ref, edit.nodeId, edit.field, edit.key, edit.raw); }); }
  catch (error) { if (inline) inline.textContent = veErrorText(error); throw error; }
  veUi.error = ''; veUi.more = false; after();
  return true;
}
// Field markup. Every control carries data-field + data-key so focus survives re-render.
function veFieldId(field, key) { return (field + '-' + key).replace(/[^A-Za-z0-9_-]/g, '_'); }
function veControlHtml(field, spec, value) {
  const id = veFieldId(field, spec.key), attrs = `id="${id}" data-field="${field}" data-key="${esc(spec.key)}"`;
  if (spec.kind === 'boolean') return `<label class="ve-check"><input type="checkbox" ${attrs} ${value === true ? 'checked' : ''}><span>${esc(spec.label)}</span></label>`;
  const label = `<label for="${id}">${esc(spec.label)}${spec.required ? ' <span class="ve-u-required" aria-hidden="true">*</span>' : ''}</label>`;
  if (spec.kind === 'enum') {
    const options = [...(spec.required ? [] : [['', 'Default' + (spec.default !== undefined ? ' (' + spec.default + ')' : '')]]), ...spec.options.map(o => [o, o])];
    return `<div class="field">${label}<select ${attrs}>${options.map(([k, name]) => `<option value="${esc(k)}"${k === (value ?? '') ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select></div>`;
  }
  if (spec.kind === 'json') {
    const text = value === undefined ? '' : JSON.stringify(value, null, 2);
    return `<div class="field">${label}<textarea ${attrs} rows="3" spellcheck="false" data-error="${id}-error" aria-describedby="${id}-error">${esc(text)}</textarea><small id="${id}-error" class="error ve-inline-error"></small></div>`;
  }
  const multiline = spec.key === '@value';
  const control = multiline ? `<textarea ${attrs} rows="2">${esc(value ?? '')}</textarea>` : `<input ${attrs} type="${spec.kind === 'number' ? 'number' : 'text'}" value="${esc(value ?? '')}" placeholder="${esc(spec.default ?? '')}" autocomplete="off">`;
  return `<div class="field">${label}${control}</div>`;
}
function veSelectHtml(label, field, key, options, value, extra = '') {
  const id = veFieldId(field, key);
  return `<div class="field"><label for="${id}">${esc(label)}</label><select id="${id}" data-field="${field}" data-key="${esc(key)}" ${extra}>${options.map(([k, name]) => `<option value="${esc(k)}"${k === value ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select></div>`;
}
// Binding summary for a non-literal value (Essentials shows it read-only and links to the Data tab).
function veBindingText(expr, definition, d = design()) {
  if (expr?.kind === 'source') {
    const source = d.dataSources?.sources.find(s => s.id === expr.sourceId), op = source?.operations.find(o => o.id === expr.operationId);
    return (source?.name || expr.sourceId) + ' / ' + (op?.name || expr.operationId) + (expr.field ? ' → ' + expr.field : ' (whole result)');
  }
  if (expr?.kind === 'state') { const n = visualLocate(visualRoot(definition), expr.nodeId)?.node; return 'Form value of ' + (n ? veNodeLabel(n) : expr.nodeId); }
  if (expr?.kind === 'prop') return 'Component property ' + expr.name;
  return '';
}
