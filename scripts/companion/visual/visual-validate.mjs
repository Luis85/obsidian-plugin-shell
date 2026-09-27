// Complete, pure validation for visual designs. Gates save, export, import and generation.
import { VISUAL_SCHEMA, VISUAL_CATALOG, VISUAL_TAGS, VISUAL_TEXT_ROLES, VISUAL_STATES, VISUAL_PROP_TYPES, VISUAL_PAYLOAD_TYPES, VISUAL_LAYOUT_MODES, VISUAL_DOM_EVENTS, VISUAL_LIMITS, VISUAL_DEPENDENCY_LIMIT, visualAssert, visualIsRef, visualIsText, visualIsLine, visualIsKey, visualIsScalar, visualIsPlain, visualIsPackage, visualIsExactVersion, visualWalk } from './visual-ir.mjs';
import { visualCatalogEntry, visualReservedExport, VISUAL_CONTROL_ENTRIES } from './visual-catalog.mjs';
import { visualCompositionGraph } from './visual-composition.mjs';
import { validateVisualMapping, validateVisualControl, visualMappingRefs } from './visual-mapping.mjs';
import { validateCompositionUI, validateCompositionScenarios, validateCompositionDesignSystem, compositionLiteral } from '../composition-contract.mjs';
const vvCommon = ['name', 'visibleIn', 'a11y', 'layout', 'notes'];
const vvForbidden = ['designState', 'designScenario', 'interaction', 'ref', 'key', 'is', 'class', 'style', 'constructor', 'prototype', '__proto__'];
const vvCategories = ['application', 'dashboard', 'master-detail', 'form', 'settings', 'website', 'custom'];
const vvIdPattern = /^(vn|vp|vc|vl|vr|vi)-([1-9][0-9]*)$/;
// Element attributes: this per-tag list (the concept inspector offers exactly these) plus title, role and aria-* on
// every tag. No event, URL-navigating or document-bearing attribute (href, action, formaction, srcdoc …) exists.
export const VISUAL_ELEMENT_ATTRS = Object.freeze({ img: Object.freeze(['alt', 'src']), input: Object.freeze(['placeholder', 'type', 'name']), button: Object.freeze(['type']), label: Object.freeze(['for']) });
function vvAttrAllowed(tag, key) { return ['title', 'role'].includes(key) || /^aria-[a-z]+(?:-[a-z]+)*$/.test(key) || (VISUAL_ELEMENT_ATTRS[tag] ?? []).includes(key); }
// A literal image source is a relative path or an inline image. Browsers drop tabs/newlines and leading controls
// before reading a scheme, so the check does too.
function vvSafeSrc(value) {
  const url = typeof value === 'string' ? value.replace(/[\t\n\r]/g, '').replace(/^[\x00-\x20]+/, '') : '';
  return typeof value === 'string' && (/^data:image\//i.test(url) || (!/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^[/\\]/.test(url)));
}
function vvObject(value, keys, optional = []) { return visualIsPlain(value) && Object.keys(value).every(k => keys.includes(k) || optional.includes(k)) && keys.every(k => Object.hasOwn(value, k)); }
function vvWithin(where, fn) {
  try { return fn(); }
  catch (err) { throw Error('VISUAL_INVALID: ' + where + ': ' + String(err?.message ?? err).replace(/^(VISUAL_INVALID|COMPOSITION_INVALID): /, '')); }
}
export function visualIsControl(node) { return node?.kind === 'component' && node.ref?.kind === 'nuxt-ui' && VISUAL_CONTROL_ENTRIES.includes(node.ref.entryId); }
function vvDependencies(list, where) {
  visualAssert(Array.isArray(list) && list.length <= VISUAL_DEPENDENCY_LIMIT, where + ': at most 8 dependencies.');
  const seen = new Set();
  for (const d of list) {
    visualAssert(vvObject(d, ['package', 'version', 'purpose']), where + ': unsupported dependency fields.');
    visualAssert(visualIsPackage(d.package), where + ': ' + JSON.stringify(d.package) + ' is not an npm package name (no URLs, git or file specifiers).');
    visualAssert(visualIsExactVersion(d.version), where + ': ' + d.package + ' needs an exact version such as 1.2.3, not ' + JSON.stringify(d.version) + '.');
    visualAssert(visualIsText(d.purpose, 400), where + ': dependency purpose too long.');
    visualAssert(!seen.has(d.package), where + ': duplicate dependency ' + d.package + '.');
    seen.add(d.package);
  }
}
function vvContract(contract, where) {
  const { props, slots, emits, variants } = contract;
  visualAssert([props, slots, emits, variants].every(Array.isArray) && [props, slots, emits].every(l => l.length <= VISUAL_LIMITS.contract) && variants.length <= 12, where + ': contract lists exceed their limits.');
  for (const p of props) {
    visualAssert(vvObject(p, ['name', 'type', 'required'], ['default', 'description']) && visualIsKey(p.name) && !vvForbidden.includes(p.name) && VISUAL_PROP_TYPES.includes(p.type) && typeof p.required === 'boolean', where + ': invalid prop ' + JSON.stringify(p?.name) + '.');
    visualAssert(p.default === undefined || (typeof p.default === p.type && visualIsScalar(p.default)), where + ': default of prop ' + p.name + ' must be a ' + p.type + '.');
    visualAssert(p.description === undefined || visualIsText(p.description, 2000), where + ': prop description too long.');
  }
  for (const s of slots) visualAssert(vvObject(s, ['name', 'required'], ['description']) && /^[a-z][A-Za-z0-9-]*$/.test(s.name) && s.name.length <= 60 && !vvForbidden.includes(s.name) && typeof s.required === 'boolean' && (s.description === undefined || visualIsText(s.description, 2000)), where + ': invalid slot ' + JSON.stringify(s?.name) + '.');
  for (const e of emits) visualAssert(vvObject(e, ['name', 'payloadType'], ['description']) && visualIsKey(e.name) && !vvForbidden.includes(e.name) && VISUAL_PAYLOAD_TYPES.includes(e.payloadType) && (e.description === undefined || visualIsText(e.description, 2000)), where + ': invalid emit ' + JSON.stringify(e?.name) + '.');
  for (const [label, names] of [['prop', props.map(p => p.name)], ['slot', slots.map(s => s.name)], ['emit', emits.map(e => e.name)], ['variant', variants.map(v => v?.id)]]) visualAssert(new Set(names).size === names.length, where + ': duplicate ' + label + ' name.');
  for (const v of variants) {
    visualAssert(vvObject(v, ['id', 'name', 'values']) && visualIsRef(v.id) && visualIsLine(v.name, 120) && visualIsPlain(v.values), where + ': invalid variant.');
    for (const [key, value] of Object.entries(v.values)) { const p = props.find(p => p.name === key); visualAssert(p && typeof value === p.type && visualIsScalar(value), where + ': variant ' + v.name + ' sets undeclared or mistyped prop ' + key + '.'); }
  }
}
function vvSource(ref, scope, where) { const ops = scope.context.sources?.get(ref.sourceId); visualAssert(!scope.context.sources || (ops && ops.has(ref.operationId)), where + ': unknown source operation ' + ref.sourceId + '/' + ref.operationId + '.'); }
function vvValue(expr, scope, where, type = 'scalar') {
  visualAssert(visualIsPlain(expr), where + ': missing value.');
  if (expr.kind === 'literal') {
    visualAssert(vvObject(expr, ['kind', 'value']), where + ': invalid literal.');
    if (type === 'json') vvWithin(where, () => compositionLiteral(expr.value));
    else visualAssert(visualIsScalar(expr.value) && (type === 'scalar' || expr.value === null || typeof expr.value === type), where + ': literal must be ' + (type === 'scalar' ? 'a string, number, boolean or null' : 'a ' + type) + '.');
  } else if (expr.kind === 'prop') visualAssert(vvObject(expr, ['kind', 'name']) && !!scope.contract?.props.some(p => p.name === expr.name), where + ': binds undeclared prop ' + JSON.stringify(expr.name) + '.');
  else if (expr.kind === 'state') visualAssert(vvObject(expr, ['kind', 'nodeId']) && visualIsControl(scope.nodes.get(expr.nodeId)), where + ': state binding must reference a form control in this design.');
  else if (expr.kind === 'source') { visualAssert(vvObject(expr, ['kind', 'sourceId', 'operationId', 'field']) && visualIsRef(expr.sourceId) && visualIsRef(expr.operationId) && visualIsText(expr.field, 120), where + ': invalid source binding.'); vvSource(expr, scope, where); }
  else visualAssert(false, where + ': unsupported value kind ' + JSON.stringify(expr.kind) + '.');
}
function vvMapping(mapping, scope, where) {
  vvWithin(where, () => validateVisualMapping(mapping)); const refs = visualMappingRefs(mapping);
  for (const id of refs.drafts) visualAssert(visualIsControl(scope.nodes.get(id)), where + ': mapped draft input ' + id + ' is missing.');
  for (const name of refs.props) visualAssert(!!scope.contract?.props.some(p => p.name === name), where + ': maps undeclared prop ' + name + '.');
}
function vvAction(a, scope, where) {
  const target = id => { visualAssert(scope.nodes.has(id), where + ': action targets missing element ' + JSON.stringify(id) + '.'); return scope.nodes.get(id); };
  switch (a?.kind) {
    case 'emit': visualAssert(vvObject(a, ['kind', 'event', 'payload']) && visualIsKey(a.event) && (!scope.contract || scope.contract.emits.some(e => e.name === a.event)), where + ': emits undeclared event ' + JSON.stringify(a?.event) + '.'); vvMapping(a.payload, scope, where); break;
    case 'navigate': visualAssert(vvObject(a, ['kind', 'surfaceId']) && visualIsRef(a.surfaceId) && (!scope.context.surfaces || scope.context.surfaces.has(a.surfaceId)), where + ': navigation target is missing.'); break;
    case 'set-state': visualAssert(vvObject(a, ['kind', 'state']) && VISUAL_STATES.includes(a.state), where + ': unknown state.'); break;
    case 'toggle': visualAssert(vvObject(a, ['kind', 'nodeId']), where + ': invalid toggle.'); target(a.nodeId); break;
    case 'focus': { visualAssert(vvObject(a, ['kind', 'nodeId']), where + ': invalid focus.'); const n = target(a.nodeId); visualAssert(visualIsControl(n) || n.ref?.entryId === 'u-button' || ['button', 'input'].includes(n.tag), where + ': focus needs a focusable target.'); break; }
    case 'set-value': visualAssert(vvObject(a, ['kind', 'nodeId', 'value']) && visualIsScalar(a.value), where + ': invalid value action.'); visualAssert(visualIsControl(target(a.nodeId)), where + ': values can only be set on form controls.'); break;
    case 'source': visualAssert(vvObject(a, ['kind', 'sourceId', 'operationId', 'input']) && visualIsRef(a.sourceId) && visualIsRef(a.operationId), where + ': invalid source action.'); vvSource(a, scope, where); vvMapping(a.input, scope, where); break;
    default: visualAssert(false, where + ': unsupported action ' + JSON.stringify(a?.kind) + '.');
  }
}
function vvEvents(node, scope, allowed, where) {
  visualAssert(Array.isArray(node.events) && node.events.length <= VISUAL_LIMITS.interactions, where + ': too many interactions.');
  for (const i of node.events) {
    visualAssert(vvObject(i, ['id', 'event', 'label', 'actions', 'notes', 'acceptance']), where + ': unsupported interaction fields.'); scope.identity(i.id, 'vi');
    visualAssert(typeof i.event === 'string' && i.event.length <= 60 && /^[a-zA-Z][a-zA-Z0-9:_-]*$/.test(i.event) && (!allowed || allowed.includes(i.event)), where + ': event ' + JSON.stringify(i.event) + ' is not declared by this element.');
    visualAssert(visualIsLine(i.label, 120) && visualIsText(i.notes, 4000) && visualIsText(i.acceptance, 8000), where + ': interaction needs a single-line label and bounded notes.');
    visualAssert(Array.isArray(i.actions) && i.actions.length <= VISUAL_LIMITS.actions, where + ': at most eight actions per interaction.');
    for (const a of i.actions) vvAction(a, scope, where + ' → ' + i.label);
  }
}
function vvComponentNode(node, scope, where) {
  const ref = node.ref; let contract;
  if (ref?.kind === 'nuxt-ui') {
    visualAssert(vvObject(ref, ['kind', 'entryId']), where + ': invalid catalog reference.');
    const entry = visualCatalogEntry(ref.entryId); visualAssert(entry, where + ': unknown Nuxt UI catalog entry ' + JSON.stringify(ref.entryId) + '.');
    contract = { props: entry.props, slots: entry.slots.map(s => s.name), emits: entry.emits.map(e => e.name), required: [] };
    visualAssert(node.variantId === undefined, where + ': catalog components have no project variants.');
  } else if (ref?.kind === 'project') {
    visualAssert(vvObject(ref, ['kind', 'componentId'], ['revisionId']), where + ': invalid component reference.');
    const target = ref.revisionId ? scope.store.revisions.find(r => r.id === ref.revisionId && r.componentId === ref.componentId)?.contract : scope.store.components.find(c => c.id === ref.componentId);
    visualAssert(target, where + ': references missing component ' + JSON.stringify(ref.revisionId ?? ref.componentId) + '.');
    contract = { props: target.props, slots: target.slots.map(s => s.name), emits: target.emits.map(e => e.name), required: target.props.filter(p => p.required).map(p => p.name) };
    visualAssert(node.variantId === undefined || target.variants.some(v => v.id === node.variantId), where + ': unknown variant.');
    visualAssert(!scope.pinned || ref.revisionId, where + ': published dependencies must pin a revision.');
  } else visualAssert(false, where + ': choose a Nuxt UI entry or project component.');
  visualAssert(visualIsPlain(node.props) && Object.keys(node.props).length <= 40, where + ': invalid props.');
  for (const [key, value] of Object.entries(node.props)) { const p = contract.props.find(p => p.name === key); visualAssert(p, where + ': prop ' + key + ' is not declared by the component.'); vvValue(value, scope, where + ' :' + key, VISUAL_PROP_TYPES.includes(p.type) ? p.type : 'json'); }
  for (const name of contract.required) visualAssert(Object.hasOwn(node.props, name), where + ': required prop ' + name + ' is missing.');
  visualAssert(visualIsPlain(node.slots), where + ': invalid slot content.');
  for (const [name, list] of Object.entries(node.slots)) visualAssert(contract.slots.includes(name) && Array.isArray(list), where + ': slot ' + name + ' is not declared by the component.');
  if (node.control !== undefined) { visualAssert(visualIsControl(node), where + ': only form controls have control semantics.'); vvWithin(where, () => validateVisualControl(node.control)); }
  vvEvents(node, scope, [...contract.emits, ...VISUAL_DOM_EVENTS], where);
}
// Errors raised while validating a node carry that node's id as an own `nodeId` property, so editors can link the
// finding to the exact element even when names repeat. The message text is unchanged.
function vvNode(node, scope, at) {
  try { vvNodeCheck(node, scope, at); }
  catch (err) { if (err instanceof Error && err.nodeId === undefined && typeof node?.id === 'string') err.nodeId = node.id; throw err; }
}
function vvNodeCheck(node, scope, at) {
  const where = scope.where + ' / ' + (node?.name || node?.id || 'element');
  const keys = { element: ['id', 'kind', 'tag', 'attrs', 'children', 'events'], text: ['id', 'kind', 'role', 'value'], slot: ['id', 'kind', 'name', 'fallback'], component: ['id', 'kind', 'ref', 'props', 'slots', 'events'], external: ['id', 'kind', 'package', 'adapter', 'props', 'events'] }[node?.kind];
  visualAssert(keys, where + ': unsupported element kind ' + JSON.stringify(node?.kind) + '.');
  visualAssert(at.depth <= VISUAL_LIMITS.depth, where + ': nesting exceeds ' + VISUAL_LIMITS.depth + ' levels.');
  visualAssert(vvObject(node, keys, [...vvCommon, ...(node.kind === 'component' ? ['variantId', 'control'] : [])]), where + ': unsupported element fields.');
  if (node.name !== undefined) visualAssert(visualIsLine(node.name, 120), where + ': name must be a single line.');
  if (node.visibleIn !== undefined) visualAssert(Array.isArray(node.visibleIn) && node.visibleIn.length > 0 && new Set(node.visibleIn).size === node.visibleIn.length && node.visibleIn.every(s => VISUAL_STATES.includes(s)), where + ': choose at least one supported preview state.');
  if (node.a11y !== undefined) visualAssert(visualIsText(node.a11y, 2000), where + ': accessibility notes too long.');
  if (node.notes !== undefined) visualAssert(visualIsText(node.notes, 4000), where + ': element notes too long.');
  if (node.layout !== undefined) { visualAssert(vvObject(node.layout, ['mode', 'ui']) && VISUAL_LAYOUT_MODES.includes(node.layout.mode), where + ': invalid layout.'); vvWithin(where, () => validateCompositionUI(node.layout.ui)); }
  if (node.kind === 'element') {
    visualAssert(VISUAL_TAGS.includes(node.tag), where + ': unsupported tag.');
    visualAssert(visualIsPlain(node.attrs) && Object.keys(node.attrs).length <= 16, where + ': invalid attributes.');
    for (const [key, value] of Object.entries(node.attrs)) {
      visualAssert(/^[a-z][a-z0-9-]*$/.test(key) && vvAttrAllowed(node.tag, key), where + ': attribute ' + key + ' is not allowed on <' + node.tag + '>.'); vvValue(value, scope, where + ' @' + key);
      if (node.tag === 'img' && key === 'src' && value.kind === 'literal') visualAssert(vvSafeSrc(value.value), where + ' @src: img src must be a relative path or a data:image/ URL.');
    }
    visualAssert(Array.isArray(node.children) && (!['input', 'img'].includes(node.tag) || node.children.length === 0), where + ': ' + node.tag + ' cannot contain children.');
    vvEvents(node, scope, null, where);
  } else if (node.kind === 'text') { visualAssert(VISUAL_TEXT_ROLES.includes(node.role), where + ': unsupported text role.'); vvValue(node.value, scope, where); }
  else if (node.kind === 'slot') { visualAssert(scope.slots.includes(node.name), where + ': slot ' + JSON.stringify(node.name) + ' is not declared.'); visualAssert(Array.isArray(node.fallback), where + ': invalid slot fallback.'); }
  else if (node.kind === 'external') {
    visualAssert(scope.external, where + ': external libraries belong in component templates.');
    visualAssert(scope.dependencies.some(d => d.package === node.package), where + ': ' + node.package + ' is not a declared dependency of this component.');
    visualAssert(typeof node.adapter === 'string' && /^[a-z][a-z0-9-]*$/.test(node.adapter) && node.adapter.length <= 60, where + ': adapter name must be lowercase kebab-case.');
    visualAssert(!scope.adapters.has(node.adapter), where + ': adapter "' + node.adapter + '" is used twice.'); scope.adapters.add(node.adapter);
    visualAssert(visualIsPlain(node.props) && Object.keys(node.props).length <= 40, where + ': invalid props.');
    for (const [key, value] of Object.entries(node.props)) { visualAssert(visualIsKey(key), where + ': invalid prop name ' + key + '.'); vvValue(value, scope, where + ' :' + key, 'json'); }
    vvEvents(node, scope, null, where);
  }
  else vvComponentNode(node, scope, where);
}
function vvDefinition(store, root, kind, context, identity, where, contract, slots = [], dependencies = []) {
  visualAssert(Array.isArray(root), where + ': missing structure.');
  const nodes = new Map();
  visualWalk(root, node => { visualAssert(visualIsPlain(node) && !nodes.has(node.id), where + ': duplicate element ID ' + JSON.stringify(node?.id) + '.'); nodes.set(node.id, node); });
  visualAssert(nodes.size <= VISUAL_LIMITS.nodes, where + ': supports at most ' + VISUAL_LIMITS.nodes + ' elements.');
  const pinned = kind === 'revision', scoped = pinned ? () => {} : identity;
  for (const id of nodes.keys()) scoped(id, 'vn');
  const external = kind === 'component' || kind === 'revision';
  const scope = { store, context, nodes, contract, where, pinned, slots: kind === 'page' ? [] : slots, identity: scoped, dependencies, external, adapters: new Set() };
  visualWalk(root, (node, at) => vvNode(node, scope, at));
  return nodes;
}
function vvScenarios(definition, nodes, where) {
  visualAssert(Array.isArray(definition.scenarios) && definition.scenarios.length <= VISUAL_LIMITS.scenarios, where + ': invalid scenarios.');
  vvWithin(where, () => validateCompositionScenarios({ scenarios: definition.scenarios, nodes: [...nodes.values()] }));
}
export function validateVisualDesigns(store, context = {}) {
  visualAssert(vvObject(store, ['schema', 'nextId', 'catalog', 'pages', 'components', 'layouts', 'revisions']) && store.schema === VISUAL_SCHEMA, 'Unsupported visual-design collection.');
  visualAssert(Number.isSafeInteger(store.nextId) && store.nextId > 0 && store.nextId < Number.MAX_SAFE_INTEGER - 100000, 'Invalid visual ID counter.');
  visualAssert(vvObject(store.catalog, ['id', 'version']) && store.catalog.id === VISUAL_CATALOG.id && store.catalog.version === VISUAL_CATALOG.version, 'Unsupported component catalog ' + JSON.stringify(store.catalog) + '; this editor pins nuxt-ui v1.');
  for (const key of ['pages', 'components', 'layouts', 'revisions']) visualAssert(Array.isArray(store[key]), 'Invalid ' + key + ' collection.');
  visualAssert(store.pages.length + store.components.length <= VISUAL_LIMITS.definitions && store.layouts.length <= VISUAL_LIMITS.layouts && store.revisions.length <= VISUAL_LIMITS.revisions, 'Too many visual definitions.');
  const ids = new Set(); let highest = 0;
  const identity = (id, prefix) => { const m = typeof id === 'string' && vvIdPattern.exec(id); visualAssert(m && m[1] === prefix && !ids.has(id), 'Duplicate or malformed ID ' + JSON.stringify(id) + '.'); ids.add(id); highest = Math.max(highest, Number(m[2])); };
  const owners = new Set(), libraries = new Set(), exportNames = new Set(), versions = new Set(), depVersions = new Map();
  for (const page of store.pages) {
    const where = 'Page ' + JSON.stringify(page?.name ?? page?.id);
    visualAssert(vvObject(page, ['id', 'ownerId', 'name', 'root', 'scenarios', 'notes']), where + ': unsupported page fields.'); identity(page.id, 'vp');
    visualAssert(visualIsRef(page.ownerId) && !owners.has(page.ownerId) && (!context.surfaces || context.surfaces.has(page.ownerId)), where + ': owner surface is missing or already designed.'); owners.add(page.ownerId);
    visualAssert(visualIsLine(page.name, 120) && visualIsText(page.notes, 8000), where + ': invalid name or notes.');
    vvScenarios(page, vvDefinition(store, page.root, 'page', context, identity, where, null), where);
  }
  for (const c of store.components) {
    const where = 'Component ' + JSON.stringify(c?.exportName ?? c?.id);
    visualAssert(vvObject(c, ['id', 'libraryId', 'exportName', 'description', 'props', 'slots', 'emits', 'variants', 'template', 'scenarios'], ['implementation', 'notes', 'dependencies']), where + ': unsupported component fields.'); identity(c.id, 'vc');
    visualAssert(typeof c.exportName === 'string' && /^[A-Z][A-Za-z0-9]*$/.test(c.exportName) && c.exportName.length <= 60 && !exportNames.has(c.exportName), where + ': export name must be a unique PascalCase Vue name.'); exportNames.add(c.exportName);
    visualAssert(!visualReservedExport(c.exportName), where + ': export name ' + c.exportName + ' is reserved (a Vue built-in, a generated type or a Nuxt UI component).');
    visualAssert(visualIsRef(c.libraryId) && !libraries.has(c.libraryId) && (!context.library || context.library.has(c.libraryId)), where + ': library entry is missing or already designed.'); libraries.add(c.libraryId);
    visualAssert(visualIsText(c.description, 2000) && (c.notes === undefined || visualIsText(c.notes, 8000)), where + ': description or notes too long.');
    visualAssert(c.implementation === undefined || (vvObject(c.implementation, ['catalog', 'entryId']) && c.implementation.catalog === 'nuxt-ui' && visualCatalogEntry(c.implementation.entryId)), where + ': unknown implementation primitive.');
    vvDependencies(c.dependencies ?? [], where);
    for (const d of c.dependencies ?? []) {
      const first = depVersions.get(d.package);
      if (first) visualAssert(first.version === d.version, d.package + ' is pinned to ' + first.version + ' in ' + first.exportName + ' and ' + d.version + ' in ' + c.exportName + '.');
      else depVersions.set(d.package, { version: d.version, exportName: c.exportName });
    }
    vvContract(c, where); vvScenarios(c, vvDefinition(store, c.template, 'component', context, identity, where, c, c.slots.map(s => s.name), c.dependencies ?? []), where);
  }
  for (const l of store.layouts) {
    const where = 'Layout ' + JSON.stringify(l?.name ?? l?.id);
    visualAssert(vvObject(l, ['id', 'name', 'description', 'scope', 'category', 'root', 'slots'], ['sourcePageId']), where + ': unsupported layout fields.'); identity(l.id, 'vl');
    visualAssert(visualIsLine(l.name, 120) && visualIsText(l.description, 400) && ['page', 'region'].includes(l.scope) && vvCategories.includes(l.category) && (l.sourcePageId === undefined || visualIsRef(l.sourcePageId)), where + ': invalid layout metadata.');
    visualAssert(Array.isArray(l.slots) && l.slots.length <= 12 && l.slots.every(s => vvObject(s, ['name', 'required'], ['description']) && /^[a-z][A-Za-z0-9-]*$/.test(s.name) && typeof s.required === 'boolean'), where + ': invalid layout slots.');
    vvDefinition(store, l.root, 'layout', context, identity, where, null, l.slots.map(s => s.name));
  }
  for (const r of store.revisions) {
    const where = 'Revision ' + JSON.stringify(r?.id);
    visualAssert(vvObject(r, ['id', 'componentId', 'version', 'contract', 'template'], ['designSystem', 'dependencies', 'notes', 'scenarios']), where + ': unsupported revision fields.'); identity(r.id, 'vr');
    visualAssert(store.components.some(c => c.id === r.componentId) && typeof r.version === 'string' && r.version.length <= 40 && /^\d+\.\d+\.\d+$/.test(r.version) && !versions.has(r.componentId + '@' + r.version), where + ': revision needs an existing component and a unique x.y.z version.'); versions.add(r.componentId + '@' + r.version);
    visualAssert(vvObject(r.contract, ['props', 'slots', 'emits', 'variants']), where + ': invalid published contract.'); vvContract(r.contract, where);
    vvDependencies(r.dependencies ?? [], where);
    visualAssert(r.notes === undefined || visualIsText(r.notes, 8000), where + ': revision notes too long.');
    if (r.designSystem !== undefined) vvWithin(where, () => validateCompositionDesignSystem(r.designSystem));
    const nodes = vvDefinition(store, r.template, 'revision', context, identity, where, r.contract, r.contract.slots.map(s => s.name), r.dependencies ?? []);
    if (r.scenarios !== undefined) vvScenarios(r, nodes, where);
  }
  visualAssert(store.nextId > highest, 'The visual ID counter could reuse an existing ID.');
  visualCompositionGraph(store);
  return store;
}
