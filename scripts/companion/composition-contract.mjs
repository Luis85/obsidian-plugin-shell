// Portable composition declarations. Values are data, never CSS, HTML or expressions.
export const COMPOSITION_CONTROLS = Object.freeze(['heading', 'textarea', 'select', 'checkbox', 'number', 'table', 'list', 'alert', 'divider', 'tabs', 'image']);
export function compositionDefaultUI() {
  return { gap: 12, padding: 16, columns: 2, align: 'stretch', justify: 'start', wrap: true,
    overflow: 'visible', widthMode: 'fill', width: 320, minWidth: 0, maxWidth: 1600,
    narrow: { layout: 'stack', columns: 1, hidden: false },
    tokens: { gap: '', padding: '', color: '', background: '', radius: '', typography: '' } };
}
function cpAssert(ok, message) { if (!ok) throw Error('COMPOSITION_INVALID: ' + message); }
function cpObject(v, keys, required = keys) { return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).every(k => keys.includes(k)) && required.every(k => Object.hasOwn(v, k)); }
function cpText(v, max = 120) { return typeof v === 'string' && v.length <= max; }
function cpRef(v) { return cpText(v) && /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(v) && !['__proto__', 'constructor', 'prototype'].includes(v); }
function cpNumber(v, low, high) { return typeof v === 'number' && Number.isFinite(v) && v >= low && v <= high; }
export function compositionLiteral(value, depth = 0, budget = { count: 0 }) {
  cpAssert(depth <= 8 && ++budget.count <= 2000, 'Fixture exceeds depth or item limits.');
  if (value === null || typeof value === 'boolean' || cpText(value, 8000) || typeof value === 'number' && Number.isFinite(value)) return value;
  cpAssert(value && typeof value === 'object' && (Array.isArray(value) || Object.prototype.toString.call(value) === '[object Object]'), 'Use JSON fixture values.');
  for (const [key, item] of Object.entries(value)) { cpAssert(!['__proto__', 'constructor', 'prototype'].includes(key), 'Unsafe fixture key.'); compositionLiteral(item, depth + 1, budget); }
  return value;
}
export function validateCompositionUI(ui) {
  const defaults = compositionDefaultUI(); cpAssert(cpObject(ui, Object.keys(defaults)), 'Unsupported layout fields.');
  cpAssert(cpNumber(ui.gap, 0, 160) && cpNumber(ui.padding, 0, 160), 'Gap/padding must be between 0 and 160 px.');
  cpAssert(Number.isInteger(ui.columns) && cpNumber(ui.columns, 1, 12), 'Choose 1–12 grid columns.');
  cpAssert(['start', 'center', 'end', 'stretch'].includes(ui.align) && ['start', 'center', 'end', 'space-between'].includes(ui.justify) && typeof ui.wrap === 'boolean', 'Invalid alignment or wrapping.');
  cpAssert(['visible','auto','hidden'].includes(ui.overflow), 'Invalid overflow behavior.');
  cpAssert(['fill', 'hug', 'fixed'].includes(ui.widthMode) && cpNumber(ui.width, 24, 1600) && cpNumber(ui.minWidth, 0, 1600) && cpNumber(ui.maxWidth, 24, 4000) && ui.minWidth <= ui.maxWidth, 'Invalid width constraints.');
  cpAssert(cpObject(ui.narrow, ['layout', 'columns', 'hidden']) && ['stack', 'row', 'grid'].includes(ui.narrow.layout) && Number.isInteger(ui.narrow.columns) && cpNumber(ui.narrow.columns, 1, 12) && typeof ui.narrow.hidden === 'boolean', 'Invalid narrow layout.');
  cpAssert(cpObject(ui.tokens, Object.keys(defaults.tokens)) && Object.values(ui.tokens).every(v => v === '' || cpRef(v)), 'Choose token identities, not CSS values.');
}
export function validateCompositionNode(node) {
  if (node.ui !== undefined) validateCompositionUI(node.ui);
  if (node.slotName !== undefined) cpAssert(node.slotName === '' || cpRef(node.slotName), 'Invalid instance slot name.');
  if (node.contentProp !== undefined) cpAssert(node.contentProp === '' || cpRef(node.contentProp), 'Invalid content-property reference.');
  if (node.slotCapacity !== undefined) cpAssert(node.kind==='slot' && ['one','many'].includes(node.slotCapacity), 'Invalid slot cardinality.');
  if (node.slotKinds !== undefined) cpAssert(node.kind==='slot' && Array.isArray(node.slotKinds) && node.slotKinds.length<=20 && node.slotKinds.every(k=>['region','text','input','button','component',...COMPOSITION_CONTROLS].includes(k)), 'Invalid permitted slot content.');
  if (node.options !== undefined) cpAssert(Array.isArray(node.options) && node.options.length <= 30 && node.options.every(v => cpText(v, 120)), 'Use at most 30 bounded options.');
}
export function validateCompositionEffect(edge, doc) {
  if (!edge.effect) return;
  cpAssert(!edge.targetSurfaceId, 'Choose navigation or a local effect, not both.');
  const e = edge.effect;
  cpAssert(cpObject(e, ['type', 'value','payload'], ['type','value']) && ['state', 'toggle', 'value', 'focus', 'emit'].includes(e.type), 'Unsupported UI effect.');
  cpAssert(typeof e.value === 'boolean' || cpText(e.value, 2000) || cpNumber(e.value, -1e9, 1e9), 'Use a literal effect value.');
  if (e.type === 'state') cpAssert(['default', 'loading', 'empty', 'error', 'disabled'].includes(e.value), 'Unknown effect state.');
  if (e.type === 'focus') cpAssert(doc.nodes.some(n => n.id === edge.target && ['input', 'textarea', 'select', 'checkbox', 'number', 'button', 'tabs'].includes(n.kind)), 'Focus needs a focusable target.');
  if (e.payload!==undefined)cpAssert((cpText(e.payload,2000)||typeof e.payload==='boolean'||cpNumber(e.payload,-1e9,1e9)), 'Use a scalar event payload.');
  if(e.type==='value'){const target=doc.nodes.find(n=>n.id===edge.target);if(target?.kind==='checkbox')cpAssert(typeof e.value==='boolean','Checkbox effects need a boolean value.');if(target?.kind==='number')cpAssert(typeof e.value==='number','Numeric effects need a number.');if(['select','tabs'].includes(target?.kind))cpAssert(target.options?.includes(e.value),'Choose a declared option for the target.');}
  if (e.type === 'emit') cpAssert(cpRef(e.value), 'Choose a declared event name.');
}
export function validateCompositionScenarios(doc) {
  if (doc.scenarios === undefined) return;
  cpAssert(Array.isArray(doc.scenarios) && doc.scenarios.length <= 12, 'Use at most twelve scenarios per design.');
  const ids = new Set();
  for (const s of doc.scenarios) {
    cpAssert(cpObject(s, ['id', 'name', 'state', 'width', 'values', 'bindings','recipe'], ['id','name','state','width','values','bindings']) && cpRef(s.id) && !ids.has(s.id) && cpText(s.name, 120) && s.name.trim(), 'Invalid or duplicate scenario.'); ids.add(s.id);
    cpAssert(['default', 'loading', 'empty', 'error', 'disabled'].includes(s.state) && ['wide', 'narrow'].includes(s.width), 'Invalid scenario state/width.');
    cpAssert(s.values && typeof s.values === 'object' && !Array.isArray(s.values) && Object.keys(s.values).every(id => doc.nodes.some(n => n.id === id)), 'Scenario values must reference local elements.');
    compositionLiteral(s.values);
    if(s.recipe!==undefined)cpAssert(cpObject(s.recipe,['sourceId','operationId','engine','seed','count','fingerprint']) && cpRef(s.recipe.sourceId) && cpRef(s.recipe.operationId) && cpText(s.recipe.engine,60) && Number.isSafeInteger(s.recipe.seed) && cpNumber(s.recipe.seed,0,2147483647) && Number.isInteger(s.recipe.count) && cpNumber(s.recipe.count,1,100) && /^[a-f0-9]{1,8}$/.test(s.recipe.fingerprint), 'Invalid captured recipe provenance.');
    cpAssert(Array.isArray(s.bindings) && s.bindings.length <= 20, 'Too many fixture bindings.');
    const sources = new Set();
    for (const b of s.bindings) {
      cpAssert(cpObject(b, ['sourceId', 'operationId', 'value']) && cpRef(b.sourceId) && cpRef(b.operationId), 'Invalid fixture binding.');
      const key = b.sourceId + ':' + b.operationId; cpAssert(!sources.has(key), 'Duplicate fixture binding.'); sources.add(key); compositionLiteral(b.value);
    }
  }
}
export function compositionRead(value, field) {
  if (!field) return value;
  for (const key of field.split('.')) { if (!cpRef(key) || value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined; value = value[key]; }
  return value;
}
export function compositionVisible(doc, session, node) {
  const visited = new Set(); let current = node;
  while (current) {
    if (visited.has(current.id) || session.hidden?.[current.id] === true || !current.visibleIn.includes(session.state) || session.width === 'narrow' && current.ui?.narrow.hidden) return false;
    visited.add(current.id); if (!current.parentId) return true; current = doc.nodes.find(n => n.id === current.parentId);
  }
  return false;
}
export function compositionSession(scenario = null) {
  return { state: scenario?.state || 'default', width: scenario?.width || 'wide', values: structuredClone(scenario?.values || {}), bindings: structuredClone(scenario?.bindings || []), hidden: {}, focused: null, emitted: [], navigation: null };
}
export function compositionTransition(doc, session, edgeId) {
  const edge = doc.edges.find(e => e.id === edgeId), source = edge && doc.nodes.find(n => n.id === edge.source);
  cpAssert(edge && source, 'The interaction no longer exists.');
  cpAssert(!['loading', 'disabled'].includes(session.state) && compositionVisible(doc, session, source), 'Interaction source is not enabled and visible.');
  if(edge.effect?.type==='focus')cpAssert(compositionVisible(doc,session,doc.nodes.find(n=>n.id===edge.target)), 'Focus target is hidden in this state.');
  const next = structuredClone(session);
  if (edge.targetSurfaceId) next.navigation = edge.targetSurfaceId;
  else if (!edge.effect) throw Error('IMPLEMENTATION_REQUIRED: ' + edge.label);
  else {
    const { type, value } = edge.effect;
    if (type === 'state') next.state = value;
    else if (type === 'toggle') next.hidden[edge.target] = !next.hidden[edge.target];
    else if (type === 'value') next.values[edge.target] = value;
    else if (type === 'focus') next.focused = edge.target;
    else if (type === 'emit') next.emitted.push({ name: value, source: edge.source, ...(edge.effect.payload!==undefined?{payload:edge.effect.payload}:{}) });
    else throw Error('COMPOSITION_INVALID: Unsupported UI effect.');
  }
  return next;
}
export function compositionStyle(node, system, narrow = false) {
  const ui = node.ui || compositionDefaultUI(), tokens = ui.tokens;
  const space = (id, fallback) => { const t = system?.spacing?.find(t => t.id === id); return t && cpNumber(t.value,0,1000) && ['px','rem','em'].includes(t.unit) ? t.value + t.unit : fallback + 'px'; };
  const layout = narrow ? ui.narrow.layout : node.layout;
  const style = { overflow:ui.overflow, boxSizing: 'border-box', minWidth: `min(100%, ${ui.minWidth}px)`, maxWidth: `min(100%, ${ui.maxWidth}px)`, width: ui.widthMode === 'fill' ? '100%' : ui.widthMode === 'fixed' ? `min(100%, ${ui.width}px)` : 'fit-content', gap: space(tokens.gap, ui.gap), padding: space(tokens.padding, ui.padding) };
  if (['region', 'slot', 'component'].includes(node.kind)) Object.assign(style, { display: layout === 'grid' ? 'grid' : 'flex', flexDirection: layout === 'row' ? 'row' : 'column', flexWrap: ui.wrap ? 'wrap' : 'nowrap', alignItems: ui.align, justifyContent: ui.justify, gridTemplateColumns: `repeat(${narrow ? ui.narrow.columns : ui.columns}, minmax(0, 1fr))` });
  for (const [property, token] of [['color', tokens.color], ['backgroundColor', tokens.background]]) {
    const t = system?.colors?.find(t => t.id === token);
    if (t && /^#[0-9a-f]{6}$/i.test(t.light) && /^#[0-9a-f]{6}$/i.test(t.dark)) style[property] = `var(--composition-color-${t.id}, ${t.light})`;
  }
  const radius = system?.radii?.find(t => t.id === tokens.radius); if (radius && cpNumber(radius.value,0,1000) && ['px','rem','em'].includes(radius.unit)) style.borderRadius = radius.value + radius.unit;
  const typo = system?.typography?.find(t => t.id === tokens.typography);
  if (typo && cpNumber(typo.size,6,160) && ['px','rem','em'].includes(typo.unit) && cpNumber(typo.weight,100,900) && cpNumber(typo.lineHeight,.5,5) && cpNumber(typo.letterSpacing,-10,20)) Object.assign(style, { fontSize: typo.size + typo.unit, fontWeight: typo.weight, lineHeight: typo.lineHeight, letterSpacing: typo.letterSpacing + 'px' });
  const font = typo && system?.fonts?.find(f=>f.id===typo.font); if(font && cpText(font.stack,300) && /^[A-Za-z0-9 ,\"'._-]+$/.test(font.stack))style.fontFamily=font.stack;
  return style;
}
export function compositionTestSource(doc) {
  const safe = JSON.stringify(doc).replaceAll('<', '\\u003c');
  const cases = doc.edges.filter(e => e.effect || e.targetSurfaceId).map(e => {
    const state = ['default', 'empty', 'error'].find(state => compositionVisible(doc, { state }, doc.nodes.find(n => n.id === e.source)));
    if (!state) return `test(${JSON.stringify(e.label)}, () => { assert.fail('No enabled visible source state: repair this interaction'); });`;
    const expected = e.targetSurfaceId ? `assert.equal(result.navigation, ${JSON.stringify(e.targetSurfaceId)});` : e.effect.type === 'state' ? `assert.equal(result.state, ${JSON.stringify(e.effect.value)});` : e.effect.type === 'toggle' ? `assert.equal(result.hidden[${JSON.stringify(e.target)}], true);` : e.effect.type === 'value' ? `assert.deepEqual(result.values[${JSON.stringify(e.target)}], ${JSON.stringify(e.effect.value)});` : e.effect.type === 'focus' ? `assert.equal(result.focused, ${JSON.stringify(e.target)});` : `assert.deepEqual(result.emitted, [{name:${JSON.stringify(e.effect.value)},source:${JSON.stringify(e.source)}${e.effect.payload===undefined?'':',payload:'+JSON.stringify(e.effect.payload)}}]);`;
    return `test(${JSON.stringify('[' + e.id + '] ' + e.label)}, () => { const session = compositionSession(); session.state = ${JSON.stringify(state)}; const before = JSON.stringify(session); const result = compositionTransition(doc, session, ${JSON.stringify(e.id)}); ${expected} assert.equal(JSON.stringify(session), before); });`;
  });
  return `// Generated executable model tests. No claim of business outcomes or native UI acceptance.\nimport { test } from 'node:test';\nimport assert from 'node:assert/strict';\n${cpAssert.toString()}\n${compositionVisible.toString()}\n${compositionSession.toString()}\n${compositionTransition.toString()}\nconst doc = ${safe};\n${cases.join('\n')}\n${doc.edges.filter(e => !e.effect && !e.targetSurfaceId).map(e => 'test.todo(' + JSON.stringify('Business implementation: ' + e.label) + ');').join('\n')}\n`;
}

export function compositionTheme(system, dark = false) {
  return Object.fromEntries((system?.colors || []).filter(t => cpRef(t.id) && /^#[0-9a-f]{6}$/i.test(t.light) && /^#[0-9a-f]{6}$/i.test(t.dark)).map(t => ['--composition-color-' + t.id, dark ? t.dark : t.light]));
}
export function validateCompositionDesignSystem(system) {
  if (system == null) return;
  compositionLiteral(system);
  for (const group of ['spacing', 'radii']) for (const t of system[group] || []) cpAssert(cpRef(t.id) && cpNumber(t.value, 0, 1000) && ['px', 'rem', 'em', '%'].includes(t.unit), 'Invalid spacing/radius token.');
  for (const t of system.colors || []) cpAssert(cpRef(t.id) && /^#[0-9a-f]{6}$/i.test(t.light) && /^#[0-9a-f]{6}$/i.test(t.dark), 'Invalid theme color token.');
  for (const t of system.typography || []) cpAssert(cpRef(t.id) && cpNumber(t.size, 6, 160) && ['px', 'rem', 'em'].includes(t.unit) && cpNumber(t.weight, 100, 900) && cpNumber(t.lineHeight, .5, 5) && cpNumber(t.letterSpacing, -10, 20), 'Invalid typography token.');
}
