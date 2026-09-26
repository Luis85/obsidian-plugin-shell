// Declarative UI IR for Page, Layout and Component designs. Data only: never CSS, HTML or expressions.
import { compositionDefaultUI } from '../composition-contract.mjs';
export const VISUAL_SCHEMA = 3;
export const VISUAL_CATALOG = Object.freeze({ id: 'nuxt-ui', version: 1 });
export const VISUAL_TAGS = Object.freeze(['div', 'section', 'header', 'main', 'footer', 'nav', 'aside', 'button', 'input', 'label', 'p', 'h1', 'h2', 'h3', 'span', 'ul', 'li', 'img']);
export const VISUAL_TEXT_ROLES = Object.freeze(['h1', 'h2', 'h3', 'p', 'span']);
export const VISUAL_STATES = Object.freeze(['default', 'loading', 'empty', 'error', 'disabled']);
export const VISUAL_PROP_TYPES = Object.freeze(['string', 'number', 'boolean']);
export const VISUAL_PAYLOAD_TYPES = Object.freeze(['void', 'string', 'number', 'boolean', 'unknown']);
export const VISUAL_LAYOUT_MODES = Object.freeze(['stack', 'row', 'grid']);
export const VISUAL_DOM_EVENTS = Object.freeze(['click', 'focus', 'blur', 'keydown', 'change', 'input', 'submit']);
export const VISUAL_LIMITS = Object.freeze({ nodes: 120, definitions: 200, depth: 12, composition: 16, layouts: 60, revisions: 200, interactions: 40, actions: 8, scenarios: 12, contract: 32 });
const virReserved = Object.freeze(['__proto__', 'constructor', 'prototype']);
export function visualAssert(ok, message) { if (!ok) throw Error('VISUAL_INVALID: ' + message); }
export function visualIsRef(value) { return typeof value === 'string' && value.length > 0 && value.length <= 120 && /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value) && !virReserved.includes(value); }
export function visualIsText(value, max, required = false) { return typeof value === 'string' && value.length <= max && (!required || value.trim() !== ''); }
export function visualIsLine(value, max) { return visualIsText(value, max, true) && !/[\r\n]/.test(value); }
export function visualIsKey(value) { return typeof value === 'string' && value.length <= 60 && /^[a-z][A-Za-z0-9]*$/.test(value) && !virReserved.includes(value); }
export function visualIsScalar(value) { return value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) || visualIsText(value, 8000); }
export function visualIsPlain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
export function emptyVisualDesigns() { return { schema: VISUAL_SCHEMA, nextId: 1, catalog: { ...VISUAL_CATALOG }, pages: [], components: [], layouts: [], revisions: [] }; }
export function visualAllocate(store, prefix) {
  visualAssert(Number.isSafeInteger(store.nextId) && store.nextId > 0 && store.nextId < Number.MAX_SAFE_INTEGER - 100000, 'Invalid visual ID counter.');
  return prefix + '-' + store.nextId++;
}
export function visualChildLists(node) {
  if (node?.kind === 'element') return Array.isArray(node.children) ? [node.children] : [];
  if (node?.kind === 'slot') return Array.isArray(node.fallback) ? [node.fallback] : [];
  if (node?.kind === 'component') return visualIsPlain(node.slots) ? Object.values(node.slots).filter(Array.isArray) : [];
  return [];
}
export function visualWalk(nodes, visit, parent = null, depth = 1) {
  if (!Array.isArray(nodes)) return;
  nodes.forEach((node, index) => { visit(node, { parent, depth, list: nodes, index }); for (const list of visualChildLists(node)) visualWalk(list, visit, node, depth + 1); });
}
export function visualLocate(nodes, id) { let found = null; visualWalk(nodes, (node, at) => { if (!found && node?.id === id) found = { node, ...at }; }); return found; }
export function visualNodes(nodes) { const out = []; visualWalk(nodes, node => out.push(node)); return out; }
export function visualRoot(definition) { return Object.hasOwn(definition, 'template') ? definition.template : definition.root; }
export function visualDefinition(store, ref) {
  const list = ref?.kind === 'page' ? store.pages : ref?.kind === 'component' ? store.components : ref?.kind === 'layout' ? store.layouts : [];
  return list.find(d => d.id === ref.id) ?? null;
}
export function visualLiteral(value) { return { kind: 'literal', value }; }
export function visualLayoutRules(mode = 'stack', ui = compositionDefaultUI()) { return { mode, ui }; }
export function visualElement(id, tag, extra = {}) { return { id, kind: 'element', tag, attrs: {}, children: [], events: [], ...extra }; }
export function visualText(id, value, role = 'p', extra = {}) { return { id, kind: 'text', role, value: visualLiteral(value), ...extra }; }
export function visualSlot(id, name, extra = {}) { return { id, kind: 'slot', name, fallback: [], ...extra }; }
export function visualNuxt(id, entryId, props = {}, extra = {}) { return { id, kind: 'component', ref: { kind: 'nuxt-ui', entryId }, props, slots: {}, events: [], ...extra }; }
export function visualProject(id, componentId, extra = {}) { return { id, kind: 'component', ref: { kind: 'project', componentId }, props: {}, slots: {}, events: [], ...extra }; }
export const VISUAL_DEPENDENCY_LIMIT = 8;
export function visualIsPackage(value) { return typeof value === 'string' && value.length <= 214 && /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value); }
export function visualIsExactVersion(value) { return typeof value === 'string' && value.length <= 64 && /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(value); }
export function visualExternal(id, packageName, adapter, extra = {}) { return { id, kind: 'external', package: packageName, adapter, props: {}, events: [], ...extra }; }
