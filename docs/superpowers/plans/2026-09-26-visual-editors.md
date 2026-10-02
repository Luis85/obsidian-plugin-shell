# Visual Page and Component Editors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PR #5's Page/Component detail editors and their `detailDesigns` model with the handoff's visual editors over a declarative UI IR (`visualDesigns`, companion transfer v5), carrying the generator, starters, self-project and tests along.

**Architecture:** A framework-free IR contract in `scripts/companion/visual/*.mjs` (validation, catalog, layouts, commands, session, migration) is inlined into the offline concept by `scripts/concepts/build-companion.py` and imported by the TypeScript generator. The concept gets new `src/ve-*.js` HTML-string views with `data-action` dispatch; the generator lowers IR to Vue SFCs with explicitly imported Nuxt UI components. Legacy `detail-*`/`composition-*` editor and compiler modules are removed after the cutover; legacy contracts remain only to validate migration input.

**Tech Stack:** Plain ES modules (`node --test`), TypeScript 6 generator (`node --experimental-strip-types`, `tsc -p tsconfig.generator.json`), offline concept (runtime-only Vue 3.5.43, strict CSP, Python 3 build), Playwright-Python browser checks, generated projects on `@nuxt/ui` 4.11.2.

**Spec:** `docs/superpowers/specs/2026-09-26-visual-editors-design.md` (read §11 "Refinements made while planning" — they are binding).

## Global Constraints

- Node 24.21.0 / npm 11.19.1 with the exact package-lock; no new dependencies in this repository. Generated projects may receive author-declared, exact-pinned dependencies (spec §13) — never ranges, URLs, git or file specifiers.
- Handwritten runtime/CSS/scripts ≤ 400 code lines per file; tests/helpers ≤ 450; count nonblank code lines excluding comments (`npm run check:source` enforces this for `scripts/`, `tests/`).
- Concept stays one offline `index.html`: CSP unchanged (`default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`), no network, no new vendor files.
- All `scripts/companion/visual/*.mjs` are concatenated into ONE concept script scope: every top-level name must be globally unique (use the per-file prefixes given below), every `import` must be a single line starting with `import `, exports only via `export const` / `export function`.
- Error messages: `VISUAL_INVALID: <message naming the page/component/layout and element>`.
- IDs are deterministic: `vn-N` nodes, `vp-N` pages, `vc-N` components, `vl-N` layouts, `vr-N` revisions, `vi-N` interactions, allocated from `visualDesigns.nextId`. Never `crypto.randomUUID()` or clock values in persisted data.
- Pinned catalog `{ id: 'nuxt-ui', version: 1 }` ↔ generated `@nuxt/ui` `4.11.2`.
- Limits: 120 elements per definition, 200 pages+components, depth 12, composition depth 16, 40 interactions per element, 8 actions per interaction, 12 scenarios, 60 layouts, 200 revisions, 32 props/slots/emits each.
- Do not weaken thresholds, delete meaningful assertions without an IR replacement, suppress directories, accept screenshot baselines, or use unsafe casts. Negative fixtures must prove actual rejection.
- Never commit to `main`; work on `feat/pr5-visual-editors`. No push, PR merge, tag or release unless the coordinator says so.
- Each commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Saved browser state from before this change** (localStorage v4 with `detailDesigns` and design history snapshots): opening the concept must migrate the current design, clear history/future with a visible notice, and never let undo resurrect `detailDesigns`. → browser check #2 in Task 18 (implemented in Task 12).
2. **Deleting a component (or its library entry) that pages still instantiate**: refused, message lists every using page/component; nothing dangles. → test in Task 4.
3. **Renaming/removing a prop, slot or emit that existing instances bind**: the contract edit is refused before commit and names the affected instances; published revisions stay valid. → test in Task 4.
4. **Applying the same layout/recipe twice, or duplicating a subtree with internal interactions**: no duplicate IDs, `nextId` strictly increases, copied `toggle`/`focus`/`set-value`/`state`/`draft` references point at the copies. → test in Task 4.
5. **Hostile or future import** (prototype keys, catalog version 2, unknown catalog entry, oversized file, v5 file that still carries `detailDesigns`): rejected with a named reason; the current project and storage are untouched. → tests in Tasks 3 and 7.

---

## File Map

Create (contract, all `scripts/companion/visual/`):

| File | Prefix | Responsibility |
| --- | --- | --- |
| `visual-ir.mjs` + `visual-ir.d.mts` | `visual*`, `VISUAL_*`, `vir*` | constants, predicates, factories, tree walking, ID allocation |
| `visual-mapping.mjs` | `vmp*` | payload-mapping and control-semantics validation (copied from legacy, renamed) |
| `visual-catalog.mjs` | `vcat*` | Nuxt UI catalog v1, recipes, built-in layouts, expansion |
| `visual-composition.mjs` | `vcmp*` | dependencies, cycle detection, usages, composition graph |
| `visual-validate.mjs` | `vv*` | full store validation |
| `visual-layout.mjs` | `vlay*` | clone with fresh IDs, instantiate/save layouts |
| `visual-commands.mjs` | `vcmd*` | pure authoring operations |
| `visual-session.mjs` | `vses*` | preview/runtime session, transitions, generated model tests |
| `visual-migrate.mjs` | `vmig*` | detail schema 1/2 → visual schema 3 |

Create (tests): `tests/tooling/visual-ir.checks.mjs`, `visual-catalog.checks.mjs`, `visual-validate.checks.mjs`, `visual-commands.checks.mjs`, `visual-session.checks.mjs`, `visual-migrate.checks.mjs`, `tests/fixtures/companion/visual-v5.json`, `tests/fixtures/companion/detail-v4.json`.

Create (generator): `scripts/companion/runtime/visual-runtime.ts`, `scripts/companion/runtime/use-visual.ts`, `scripts/companion/compiler/visual-model.ts`, `visual-code.ts`, `visual-files.ts`, `visual-tests.ts`, `visual-ports.ts`; `tests/tooling/project-generator-visual.checks.mjs`.

Create (concept): `docs/concepts/companion/src/ve-state.js`, `ve-canvas.js`, `ve-outline.js`, `ve-insert.js`, `ve-layouts.js`, `ve-page-views.js`, `ve-page-inspector.js`, `ve-interactions.js`, `ve-review.js`, `ve-component-views.js`, `ve-contract.js`, `ve-child-inspector.js`, `ve-publish.js`, `ve-actions.js`, `ve-fields.js`, `ve-entry.js`, `ve.css`; `docs/concepts/companion/seeds/visual-self-project.json`; `tests/concepts/companion-visual-editors.browser.py`.

Modify: `scripts/companion/project-contract.mjs`, `read-project.mjs`, `compiler/plan.ts`, `compiler/project-files.ts`, `compiler/host-code.ts`, `compiler/model.ts`, `scripts/concepts/build-companion.py`, `scripts/concepts/run-browser-checks.py`, `scripts/concepts/export-companion-project.py` (only if its seed path changes), `.fallowrc.json`, `package.json` (script `test:visual`), `.github/workflows/companion-concept-verification.yml`, `.github/workflows/project-generator.yml`, `tests/tooling/companion-boundaries.checks.mjs`, `companion-project.checks.mjs`, `project-starters.checks.mjs`, `project-generator*.checks.mjs`, shared concept modules listed in Task 20, starters + `starters/catalog.json`, `companion-project.json`, `index.html` (rebuilt), docs.

Delete (Task 20): concept `src/detail-*.js`, `src/composition-*.js`, `detail.css`, `composition.css`; compiler `detail-model.ts`, `detail-code.ts`, `detail-fields.ts`, `detail-mappings.ts`, `detail-tests.ts`, `detail-runtime-tests.ts`, `detail-ports.ts`; runtime `detail-runtime.ts`, `use-detail.ts`; tests `companion-details.checks.mjs`, `companion-composition.checks.mjs`, `project-generator-details.checks.mjs`, `project-generator-composition.checks.mjs` (replaced), `tests/concepts/companion-details.browser.py`, `companion-detail-polish.browser.py`, `companion-composition.browser.py`. Keep `detail-contract.mjs`, `composition-contract.mjs`, `runtime/detail-actions.ts`, `runtime/detail-controls.ts`.

## Execution order

Tasks 1 → 5 → 5b → 6 → 7 sequential (contract freeze after Task 7). Then Tasks 8–11 (generator) and 12–18 (concept) may run in parallel; they share only the frozen contract — any contract change goes back through the coordinator. Tasks 19 → 21 sequential after both tracks.

---

### Task 1: IR core and mapping validation

**Files:**
- Create: `scripts/companion/visual/visual-ir.mjs`, `scripts/companion/visual/visual-ir.d.mts`, `scripts/companion/visual/visual-mapping.mjs`
- Create: `tests/tooling/visual-ir.checks.mjs`
- Modify: `package.json` (add script), `.fallowrc.json` (add both `.mjs` to `entry`)

**Interfaces:**
- Produces: everything exported below; later tasks import these exact names.

- [ ] **Step 1: Write the failing test** — `tests/tooling/visual-ir.checks.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyVisualDesigns, visualAllocate, visualElement, visualText, visualSlot, visualNuxt, visualProject, visualWalk, visualLocate, visualNodes, visualRoot, visualDefinition, visualChildLists, visualIsRef, visualIsKey, visualIsScalar, VISUAL_CATALOG, VISUAL_LIMITS } from '../../scripts/companion/visual/visual-ir.mjs';
import { validateVisualMapping, validateVisualControl, visualMappingRefs } from '../../scripts/companion/visual/visual-mapping.mjs';

test('empty store is schema 3 with pinned catalog and counter 1', () => {
  const s = emptyVisualDesigns();
  assert.deepEqual(s, { schema: 3, nextId: 1, catalog: { id: 'nuxt-ui', version: 1 }, pages: [], components: [], layouts: [], revisions: [] });
  assert.notEqual(s.catalog, VISUAL_CATALOG);
  assert.equal(VISUAL_LIMITS.nodes, 120);
});
test('allocation is deterministic and monotonic', () => {
  const s = emptyVisualDesigns();
  assert.deepEqual([visualAllocate(s, 'vn'), visualAllocate(s, 'vp'), visualAllocate(s, 'vn')], ['vn-1', 'vp-2', 'vn-3']);
  assert.equal(s.nextId, 4);
  s.nextId = 0; assert.throws(() => visualAllocate(s, 'vn'), /VISUAL_INVALID/);
});
test('walk visits every list in document order with depth and parent', () => {
  const tree = [visualElement('vn-1', 'div', { children: [visualText('vn-2', 'Hi'), visualNuxt('vn-3', 'u-card', {}, { slots: { default: [visualText('vn-4', 'In card')] } })] }), visualSlot('vn-5', 'actions', { fallback: [visualProject('vn-6', 'vc-9')] })];
  const seen = []; visualWalk(tree, (n, at) => seen.push([n.id, at.depth, at.parent?.id ?? null]));
  assert.deepEqual(seen, [['vn-1', 1, null], ['vn-2', 2, 'vn-1'], ['vn-3', 2, 'vn-1'], ['vn-4', 3, 'vn-3'], ['vn-5', 1, null], ['vn-6', 2, 'vn-5']]);
  assert.equal(visualLocate(tree, 'vn-4').parent.id, 'vn-3');
  assert.equal(visualLocate(tree, 'missing'), null);
  assert.deepEqual(visualNodes(tree).map(n => n.id), ['vn-1', 'vn-2', 'vn-3', 'vn-4', 'vn-5', 'vn-6']);
});
test('walk tolerates malformed child lists instead of crashing', () => {
  assert.deepEqual(visualChildLists({ kind: 'element', children: 'x' }), []);
  assert.deepEqual(visualChildLists({ kind: 'component', slots: null }), []);
});
test('definitions resolve by kind; root reads template or root', () => {
  const s = emptyVisualDesigns(); s.pages.push({ id: 'vp-1', root: [] }); s.components.push({ id: 'vc-2', template: [visualText('vn-3', 'x')] });
  assert.equal(visualDefinition(s, { kind: 'page', id: 'vp-1' }).id, 'vp-1');
  assert.equal(visualRoot(visualDefinition(s, { kind: 'component', id: 'vc-2' }))[0].id, 'vn-3');
  assert.equal(visualDefinition(s, { kind: 'layout', id: 'vp-1' }), null);
});
test('predicates reject prototype keys, multiline and non-finite values', () => {
  for (const bad of ['__proto__', 'constructor', '', 'a b', 'x'.repeat(121)]) assert.equal(visualIsRef(bad), false, bad);
  assert.equal(visualIsKey('modelValue'), true); assert.equal(visualIsKey('Model'), false);
  assert.equal(visualIsScalar(Infinity), false); assert.equal(visualIsScalar(null), true); assert.equal(visualIsScalar({}), false);
});
test('mappings validate recursively and expose draft/prop references', () => {
  const m = { kind: 'object', fields: { title: { kind: 'draft', nodeId: 'vn-4' }, owner: { kind: 'prop', name: 'owner' }, fixed: { kind: 'value', value: [1, 2] } } };
  assert.equal(validateVisualMapping(m), m);
  assert.deepEqual(visualMappingRefs(m), { drafts: ['vn-4'], props: ['owner'] });
  for (const bad of [{ kind: 'script' }, { kind: 'object', fields: JSON.parse('{"__proto__":{"kind":"none"}}') }, { kind: 'value', value: { constructor: 1 } }, { kind: 'none', extra: 1 }])
    assert.throws(() => validateVisualMapping(bad), /VISUAL_INVALID/);
});
test('controls validate kind, options and byte limits', () => {
  validateVisualControl({ kind: 'select', options: [{ label: 'A', value: 'a' }] });
  assert.throws(() => validateVisualControl({ kind: 'select' }), /VISUAL_INVALID/);
  assert.throws(() => validateVisualControl({ kind: 'checkbox', maxBytes: 10 }), /VISUAL_INVALID/);
  assert.throws(() => validateVisualControl({ kind: 'eval' }), /VISUAL_INVALID/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/tooling/visual-ir.checks.mjs`
Expected: FAIL — `Cannot find module .../visual-ir.mjs`.

- [ ] **Step 3: Implement `visual-ir.mjs`**

```js
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
```

- [ ] **Step 4: Implement `visual-mapping.mjs`** (same rules as the private legacy validators in `detail-contract.mjs:127-176`, renamed; legacy file stays untouched)

```js
// Payload mappings and typed control semantics for visual designs. Data only.
import { visualAssert, visualIsRef, visualIsText, visualIsKey, visualIsPlain } from './visual-ir.mjs';
export const VISUAL_CONTROL_KINDS = Object.freeze(['text', 'textarea', 'number', 'checkbox', 'date', 'datetime-local', 'select', 'json-file', 'json-editor', 'markdown-editor']);
const vmpReserved = ['constructor', 'prototype', '__proto__'];
function vmpObject(value, keys, optional = []) { return visualIsPlain(value) && Object.keys(value).every(k => keys.includes(k) || optional.includes(k)) && keys.every(k => Object.hasOwn(value, k)); }
function vmpJson(value, depth = 0) {
  if (depth > 12) return false;
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  return !!value && typeof value === 'object' && Object.entries(value).every(([key, item]) => !vmpReserved.includes(key) && vmpJson(item, depth + 1));
}
export function validateVisualMapping(mapping, depth = 0, budget = { count: 0 }) {
  visualAssert(depth <= 6 && ++budget.count <= 120, 'Payload mapping is too large.');
  visualAssert(mapping && typeof mapping === 'object', 'Missing payload mapping.');
  if (mapping.kind === 'none' || mapping.kind === 'event') visualAssert(vmpObject(mapping, ['kind']), 'Invalid simple mapping.');
  else if (mapping.kind === 'value') visualAssert(vmpObject(mapping, ['kind', 'value']) && vmpJson(mapping.value) && JSON.stringify(mapping.value).length <= 12000, 'Invalid literal payload.');
  else if (mapping.kind === 'draft') visualAssert(vmpObject(mapping, ['kind', 'nodeId']) && visualIsRef(mapping.nodeId), 'Invalid draft mapping.');
  else if (mapping.kind === 'prop') visualAssert(vmpObject(mapping, ['kind', 'name']) && visualIsKey(mapping.name), 'Invalid prop mapping.');
  else if (mapping.kind === 'source') visualAssert(vmpObject(mapping, ['kind', 'sourceId', 'operationId', 'field']) && visualIsRef(mapping.sourceId) && visualIsRef(mapping.operationId) && visualIsText(mapping.field, 120), 'Invalid source mapping.');
  else if (mapping.kind === 'object') {
    visualAssert(vmpObject(mapping, ['kind', 'fields']) && visualIsPlain(mapping.fields) && Object.keys(mapping.fields).length <= 40, 'Invalid object mapping.');
    for (const [key, value] of Object.entries(mapping.fields)) { visualAssert(/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) && !vmpReserved.includes(key), 'Unsafe payload property.'); validateVisualMapping(value, depth + 1, budget); }
  } else visualAssert(false, 'Unsupported payload mapping.');
  return mapping;
}
export function visualMappingRefs(mapping, out = { drafts: [], props: [] }) {
  if (mapping?.kind === 'draft') out.drafts.push(mapping.nodeId);
  else if (mapping?.kind === 'prop') out.props.push(mapping.name);
  else if (mapping?.kind === 'object') for (const value of Object.values(mapping.fields)) visualMappingRefs(value, out);
  return out;
}
export function validateVisualControl(control) {
  visualAssert(vmpObject(control, ['kind'], ['required', 'options', 'maxBytes']) && VISUAL_CONTROL_KINDS.includes(control.kind), 'Unsupported control type.');
  if (control.required !== undefined) visualAssert(typeof control.required === 'boolean', 'Invalid required control.');
  if (control.options !== undefined) visualAssert(control.kind === 'select' && Array.isArray(control.options) && control.options.length > 0 && control.options.length <= 60 && control.options.every(o => vmpObject(o, ['label', 'value']) && visualIsText(o.label, 120, true) && visualIsText(o.value, 120)) && new Set(control.options.map(o => o.value)).size === control.options.length, 'Invalid select options.');
  visualAssert(control.kind !== 'select' || control.options !== undefined, 'Select options are required.');
  if (control.maxBytes !== undefined) visualAssert(['json-file', 'json-editor', 'markdown-editor', 'textarea', 'text'].includes(control.kind) && Number.isSafeInteger(control.maxBytes) && control.maxBytes > 0 && control.maxBytes <= 4_000_000, 'Invalid control byte limit.');
  return control;
}
```

- [ ] **Step 5: Write `visual-ir.d.mts`** — declarations for every export of `visual-ir.mjs` plus the IR types used by the generator:

```ts
import type { CompositionUI } from '../composition-contract.mjs';
export type Scalar = string | number | boolean | null;
export type VisualState = 'default' | 'loading' | 'empty' | 'error' | 'disabled';
export type ValueExpression = { kind: 'literal'; value: unknown } | { kind: 'prop'; name: string } | { kind: 'state'; nodeId: string } | { kind: 'source'; sourceId: string; operationId: string; field: string };
export type Mapping = { kind: 'none' } | { kind: 'event' } | { kind: 'value'; value: unknown } | { kind: 'draft'; nodeId: string } | { kind: 'prop'; name: string } | { kind: 'source'; sourceId: string; operationId: string; field: string } | { kind: 'object'; fields: Record<string, Mapping> };
export type VisualAction = { kind: 'emit'; event: string; payload: Mapping } | { kind: 'navigate'; surfaceId: string } | { kind: 'set-state'; state: VisualState } | { kind: 'toggle'; nodeId: string } | { kind: 'set-value'; nodeId: string; value: Scalar } | { kind: 'focus'; nodeId: string } | { kind: 'source'; sourceId: string; operationId: string; input: Mapping };
export interface Interaction { id: string; event: string; label: string; actions: VisualAction[]; notes: string; acceptance: string }
export interface LayoutRules { mode: 'stack' | 'row' | 'grid'; ui: CompositionUI }
interface Common { id: string; name?: string; visibleIn?: VisualState[]; a11y?: string; layout?: LayoutRules }
export type ElementNode = Common & { kind: 'element'; tag: string; attrs: Record<string, ValueExpression>; children: UiNode[]; events: Interaction[] };
export type TextNode = Common & { kind: 'text'; role: 'h1' | 'h2' | 'h3' | 'p' | 'span'; value: ValueExpression };
export type SlotNode = Common & { kind: 'slot'; name: string; fallback: UiNode[] };
export type ComponentRef = { kind: 'nuxt-ui'; entryId: string } | { kind: 'project'; componentId: string; revisionId?: string };
export type ComponentNode = Common & { kind: 'component'; ref: ComponentRef; props: Record<string, ValueExpression>; slots: Record<string, UiNode[]>; events: Interaction[]; variantId?: string; control?: { kind: string; required?: boolean; options?: { label: string; value: string }[]; maxBytes?: number } };
export type UiNode = ElementNode | TextNode | SlotNode | ComponentNode;
export interface Scenario { id: string; name: string; state: VisualState; width: 'wide' | 'narrow'; values: Record<string, unknown>; bindings: { sourceId: string; operationId: string; value: unknown }[]; recipe?: unknown }
export interface PropDefinition { name: string; type: 'string' | 'number' | 'boolean'; required: boolean; default?: Scalar; description?: string }
export interface SlotDefinition { name: string; required: boolean; description?: string }
export interface EmitDefinition { name: string; payloadType: 'void' | 'string' | 'number' | 'boolean' | 'unknown'; description?: string }
export interface Variant { id: string; name: string; values: Record<string, Scalar> }
export interface Contract { props: PropDefinition[]; slots: SlotDefinition[]; emits: EmitDefinition[]; variants: Variant[] }
export interface PageDefinition { id: string; ownerId: string; name: string; root: UiNode[]; scenarios: Scenario[]; notes: string }
export interface ComponentDefinition extends Contract { id: string; libraryId: string; exportName: string; description: string; template: UiNode[]; scenarios: Scenario[]; notes?: string; implementation?: { catalog: 'nuxt-ui'; entryId: string } }
export interface LayoutDefinition { id: string; name: string; description: string; scope: 'page' | 'region'; category: string; root: UiNode[]; slots: SlotDefinition[]; sourcePageId?: string }
export interface ComponentRevision { id: string; componentId: string; version: string; contract: Contract; template: UiNode[]; designSystem?: unknown }
export interface VisualDesigns { schema: 3; nextId: number; catalog: { id: 'nuxt-ui'; version: 1 }; pages: PageDefinition[]; components: ComponentDefinition[]; layouts: LayoutDefinition[]; revisions: ComponentRevision[] }
export type DefinitionRef = { kind: 'page' | 'component' | 'layout'; id: string };
export interface WalkAt { parent: UiNode | null; depth: number; list: UiNode[]; index: number }
export const VISUAL_SCHEMA: 3; export const VISUAL_CATALOG: { readonly id: 'nuxt-ui'; readonly version: 1 };
export const VISUAL_TAGS: readonly string[]; export const VISUAL_TEXT_ROLES: readonly string[]; export const VISUAL_STATES: readonly VisualState[];
export const VISUAL_PROP_TYPES: readonly string[]; export const VISUAL_PAYLOAD_TYPES: readonly string[]; export const VISUAL_LAYOUT_MODES: readonly string[]; export const VISUAL_DOM_EVENTS: readonly string[];
export const VISUAL_LIMITS: Readonly<Record<'nodes' | 'definitions' | 'depth' | 'composition' | 'layouts' | 'revisions' | 'interactions' | 'actions' | 'scenarios' | 'contract', number>>;
export function visualAssert(ok: unknown, message: string): asserts ok;
export function visualIsRef(value: unknown): value is string; export function visualIsText(value: unknown, max: number, required?: boolean): value is string;
export function visualIsLine(value: unknown, max: number): value is string; export function visualIsKey(value: unknown): value is string;
export function visualIsScalar(value: unknown): value is Scalar; export function visualIsPlain(value: unknown): value is Record<string, unknown>;
export function emptyVisualDesigns(): VisualDesigns; export function visualAllocate(store: VisualDesigns, prefix: string): string;
export function visualChildLists(node: UiNode): UiNode[][]; export function visualWalk(nodes: UiNode[], visit: (node: UiNode, at: WalkAt) => void, parent?: UiNode | null, depth?: number): void;
export function visualLocate(nodes: UiNode[], id: string): ({ node: UiNode } & WalkAt) | null; export function visualNodes(nodes: UiNode[]): UiNode[];
export function visualRoot(definition: PageDefinition | ComponentDefinition | LayoutDefinition | ComponentRevision): UiNode[];
export function visualDefinition(store: VisualDesigns, ref: DefinitionRef): PageDefinition | ComponentDefinition | LayoutDefinition | null;
export function visualLiteral(value: unknown): ValueExpression; export function visualLayoutRules(mode?: LayoutRules['mode'], ui?: CompositionUI): LayoutRules;
export function visualElement(id: string, tag: string, extra?: Partial<ElementNode>): ElementNode; export function visualText(id: string, value: Scalar, role?: TextNode['role'], extra?: Partial<TextNode>): TextNode;
export function visualSlot(id: string, name: string, extra?: Partial<SlotNode>): SlotNode; export function visualNuxt(id: string, entryId: string, props?: Record<string, ValueExpression>, extra?: Partial<ComponentNode>): ComponentNode;
export function visualProject(id: string, componentId: string, extra?: Partial<ComponentNode>): ComponentNode;
```
If `CompositionUI` is not exported by `composition-contract.d.mts`, add `export type CompositionUI = ReturnType<typeof compositionDefaultUI>;` there.

- [ ] **Step 6: Register** — in `package.json` scripts add `"test:visual": "node --test tests/tooling/visual-*.checks.mjs"`; in `.fallowrc.json` `entry` add `"scripts/companion/visual/visual-ir.mjs"` and `"scripts/companion/visual/visual-mapping.mjs"` after `scripts/companion/composition-contract.mjs`.

- [ ] **Step 7: Run tests**

Run: `npm run test:visual && npm run check:source`
Expected: PASS; check:source reports no limit violation.

- [ ] **Step 8: Commit**

```bash
git add scripts/companion/visual tests/tooling/visual-ir.checks.mjs package.json .fallowrc.json scripts/companion/composition-contract.d.mts
git commit -m "feat(visual): add declarative UI IR core and payload mapping contract"
```

---

### Task 2: Nuxt UI catalog, recipes and built-in layouts

**Files:**
- Create: `scripts/companion/visual/visual-catalog.mjs`, `tests/tooling/visual-catalog.checks.mjs`
- Modify: `.fallowrc.json` (entry)

**Interfaces:**
- Consumes: Task 1 factories, `visualAllocate`, `visualLiteral`, `visualLayoutRules`.
- Produces: `VISUAL_NUXT_UI_VERSION = '4.11.2'`, `VISUAL_PROP_KINDS`, `VISUAL_CONTROL_ENTRIES = ['u-input','u-textarea','u-select','u-checkbox','u-switch']`, `visualCatalog: CatalogEntry[]` (`{id, kind:'primitive', label, component, category, description, props:{name,type,default?,options?}[], slots:{name}[], emits:{name,payload}[], preview}`), `visualRecipes: {id,label,category,description,build(store)}[]`, `visualBuiltinLayouts: {id,name,category,scope,description,build(store)}[]`, `visualCatalogEntry(id) → entry|null`, `visualExpand(store, id) → UiNode[]` (recipe or built-in layout id; throws on unknown).

- [ ] **Step 1: Failing test** — `tests/tooling/visual-catalog.checks.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { emptyVisualDesigns, visualNodes, visualWalk } from '../../scripts/companion/visual/visual-ir.mjs';
import { visualCatalog, visualRecipes, visualBuiltinLayouts, visualCatalogEntry, visualExpand, VISUAL_NUXT_UI_VERSION, VISUAL_CONTROL_ENTRIES } from '../../scripts/companion/visual/visual-catalog.mjs';

test('catalog pins the Nuxt UI version installed by generated projects', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(pkg.dependencies['@nuxt/ui'] ?? pkg.devDependencies['@nuxt/ui'], VISUAL_NUXT_UI_VERSION);
});
test('catalog entries are unique, U-prefixed and self-consistent', () => {
  const ids = visualCatalog.map(e => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const e of visualCatalog) {
    assert.match(e.component, /^U[A-Z][A-Za-z]+$/); assert.equal(e.kind, 'primitive');
    for (const p of e.props) if (p.default !== undefined && ['string', 'number', 'boolean'].includes(p.type)) assert.equal(typeof p.default, p.type, e.id + '.' + p.name);
    for (const p of e.props) if (p.options) assert.ok(p.default === undefined || p.options.includes(p.default));
  }
  for (const id of ['u-button', 'u-input', 'u-table', 'u-card', 'u-modal', 'u-command-palette', 'u-separator']) assert.ok(visualCatalogEntry(id), id);
  for (const id of VISUAL_CONTROL_ENTRIES) assert.ok(visualCatalogEntry(id), id);
  assert.equal(visualCatalogEntry('u-evil'), null);
});
test('every recipe and built-in layout expands deterministically with fresh IDs and no slots', () => {
  for (const item of [...visualRecipes, ...visualBuiltinLayouts]) {
    const a = emptyVisualDesigns(), b = emptyVisualDesigns();
    const first = visualExpand(a, item.id), again = visualExpand(b, item.id);
    assert.deepEqual(first, again, item.id + ' is deterministic');
    const nodes = visualNodes(first); assert.ok(nodes.length > 0);
    assert.equal(new Set(nodes.map(n => n.id)).size, nodes.length);
    assert.ok(nodes.every(n => /^vn-\d+$/.test(n.id) && n.kind !== 'slot'), item.id + ' has no slot nodes');
    assert.equal(a.nextId, nodes.length + 1);
    visualWalk(first, n => { if (n.kind === 'component') assert.ok(visualCatalogEntry(n.ref.entryId), n.ref.entryId); });
  }
  const s = emptyVisualDesigns(); const one = visualExpand(s, 'recipe-crud-list'), two = visualExpand(s, 'recipe-crud-list');
  assert.equal(new Set([...visualNodes(one), ...visualNodes(two)].map(n => n.id)).size, visualNodes(one).length * 2);
  assert.throws(() => visualExpand(s, 'recipe-missing'), /VISUAL_INVALID/);
});
```

- [ ] **Step 2: Run** `node --test tests/tooling/visual-catalog.checks.mjs` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement `visual-catalog.mjs`**

```js
// Pinned Nuxt UI authoring catalog v1 plus recipes that expand to ordinary IR. Generated projects pin @nuxt/ui to VISUAL_NUXT_UI_VERSION.
import { visualAssert, visualAllocate, visualElement, visualText, visualNuxt, visualLiteral, visualLayoutRules } from './visual-ir.mjs';
import { compositionDefaultUI } from '../composition-contract.mjs';
export const VISUAL_NUXT_UI_VERSION = '4.11.2';
export const VISUAL_PROP_KINDS = Object.freeze(['string', 'number', 'boolean', 'array', 'object', 'unknown']);
export const VISUAL_CONTROL_ENTRIES = Object.freeze(['u-input', 'u-textarea', 'u-select', 'u-checkbox', 'u-switch']);
const vcatColors = ['primary', 'neutral', 'success', 'warning', 'error', 'info'];
const vcatP = (name, type, extra = {}) => Object.freeze({ name, type, ...extra });
const vcatEntry = (id, label, component, category, description, props, slots, emits, preview) => Object.freeze({ id, kind: 'primitive', label, component, category, description, props: Object.freeze(props), slots: Object.freeze(slots.map(name => Object.freeze({ name }))), emits: Object.freeze(emits.map(([name, payload]) => Object.freeze({ name, payload }))), preview });
export const visualCatalog = Object.freeze([
  vcatEntry('u-button', 'Button', 'UButton', 'Actions', 'Primary and secondary actions', [vcatP('label', 'string'), vcatP('color', 'string', { default: 'primary', options: vcatColors }), vcatP('variant', 'string', { default: 'solid', options: ['solid', 'outline', 'soft', 'subtle', 'ghost', 'link'] }), vcatP('icon', 'string'), vcatP('loading', 'boolean', { default: false }), vcatP('disabled', 'boolean', { default: false })], ['leading', 'default', 'trailing'], [['click', 'unknown']], 'button'),
  vcatEntry('u-input', 'Input', 'UInput', 'Forms', 'Single-line input', [vcatP('modelValue', 'unknown'), vcatP('type', 'string', { default: 'text', options: ['text', 'number', 'date', 'datetime-local', 'email', 'search'] }), vcatP('placeholder', 'string'), vcatP('icon', 'string'), vcatP('disabled', 'boolean')], [], [['update:modelValue', 'unknown']], 'input'),
  vcatEntry('u-textarea', 'Textarea', 'UTextarea', 'Forms', 'Multi-line input', [vcatP('modelValue', 'string'), vcatP('placeholder', 'string'), vcatP('rows', 'number', { default: 3 })], [], [['update:modelValue', 'string']], 'textarea'),
  vcatEntry('u-select', 'Select', 'USelect', 'Forms', 'Option selection', [vcatP('modelValue', 'unknown'), vcatP('items', 'array'), vcatP('placeholder', 'string')], [], [['update:modelValue', 'unknown']], 'select'),
  vcatEntry('u-checkbox', 'Checkbox', 'UCheckbox', 'Forms', 'Boolean form control', [vcatP('modelValue', 'boolean'), vcatP('label', 'string')], [], [['update:modelValue', 'boolean']], 'checkbox'),
  vcatEntry('u-switch', 'Switch', 'USwitch', 'Forms', 'Immediate boolean setting', [vcatP('modelValue', 'boolean'), vcatP('label', 'string')], [], [['update:modelValue', 'boolean']], 'switch'),
  vcatEntry('u-form', 'Form', 'UForm', 'Forms', 'Validated form boundary', [vcatP('state', 'object')], ['default'], [['submit', 'unknown']], 'form'),
  vcatEntry('u-form-field', 'Form Field', 'UFormField', 'Forms', 'Label, help and validation wrapper', [vcatP('label', 'string'), vcatP('name', 'string'), vcatP('description', 'string'), vcatP('required', 'boolean')], ['default'], [], 'field'),
  vcatEntry('u-table', 'Data Table', 'UTable', 'Data', 'Structured records', [vcatP('data', 'array'), vcatP('columns', 'array'), vcatP('loading', 'boolean')], ['empty', 'loading'], [['select', 'unknown']], 'table'),
  vcatEntry('u-card', 'Card', 'UCard', 'Data', 'Grouped content container', [], ['header', 'default', 'footer'], [], 'card'),
  vcatEntry('u-badge', 'Badge', 'UBadge', 'Data', 'Compact status', [vcatP('label', 'string'), vcatP('color', 'string', { options: vcatColors }), vcatP('variant', 'string', { options: ['solid', 'outline', 'soft', 'subtle'] })], ['default'], [], 'badge'),
  vcatEntry('u-avatar', 'Avatar', 'UAvatar', 'Data', 'User or entity identity', [vcatP('src', 'string'), vcatP('alt', 'string'), vcatP('text', 'string')], [], [], 'avatar'),
  vcatEntry('u-tabs', 'Tabs', 'UTabs', 'Navigation', 'Peer surface navigation', [vcatP('items', 'array'), vcatP('modelValue', 'string')], [], [['update:modelValue', 'string']], 'tabs'),
  vcatEntry('u-breadcrumb', 'Breadcrumb', 'UBreadcrumb', 'Navigation', 'Hierarchical location', [vcatP('items', 'array')], [], [], 'breadcrumb'),
  vcatEntry('u-dropdown-menu', 'Dropdown Menu', 'UDropdownMenu', 'Navigation', 'Context actions', [vcatP('items', 'array')], ['default'], [], 'menu'),
  vcatEntry('u-command-palette', 'Command Palette', 'UCommandPalette', 'Navigation', 'Keyboard-first command discovery', [vcatP('groups', 'array'), vcatP('placeholder', 'string')], [], [['update:modelValue', 'unknown']], 'menu'),
  vcatEntry('u-modal', 'Modal', 'UModal', 'Overlays', 'Focused modal workflow', [vcatP('open', 'boolean'), vcatP('title', 'string'), vcatP('description', 'string')], ['body', 'footer'], [['update:open', 'boolean']], 'overlay'),
  vcatEntry('u-drawer', 'Drawer', 'UDrawer', 'Overlays', 'Contextual side or bottom workflow', [vcatP('open', 'boolean'), vcatP('title', 'string')], ['body', 'footer'], [['update:open', 'boolean']], 'overlay'),
  vcatEntry('u-alert', 'Alert', 'UAlert', 'Feedback', 'Persistent contextual feedback', [vcatP('title', 'string'), vcatP('description', 'string'), vcatP('color', 'string', { options: vcatColors })], [], [], 'alert'),
  vcatEntry('u-progress', 'Progress', 'UProgress', 'Feedback', 'Progress indicator', [vcatP('modelValue', 'number'), vcatP('max', 'number', { default: 100 })], [], [], 'progress'),
  vcatEntry('u-skeleton', 'Skeleton', 'USkeleton', 'Feedback', 'Loading placeholder', [], [], [], 'skeleton'),
  vcatEntry('u-separator', 'Separator', 'USeparator', 'Layout', 'Visual separation', [vcatP('orientation', 'string', { default: 'horizontal', options: ['horizontal', 'vertical'] })], [], [], 'separator'),
]);
export function visualCatalogEntry(id) { return visualCatalog.find(e => e.id === id) ?? null; }
const vcatLit = values => Object.fromEntries(Object.entries(values).map(([k, v]) => [k, visualLiteral(v)]));
const vcatBox = (s, tag, mode, name, children, ui = {}) => visualElement(visualAllocate(s, 'vn'), tag, { name, layout: visualLayoutRules(mode, { ...compositionDefaultUI(), ...ui }), children });
const vcatUi = (s, entryId, name, props = {}, extra = {}) => visualNuxt(visualAllocate(s, 'vn'), entryId, vcatLit(props), { name, ...extra });
const vcatTxt = (s, value, role, name) => visualText(visualAllocate(s, 'vn'), value, role, { name });
const vcatField = (s, label, entryId, props = {}) => { const field = vcatUi(s, 'u-form-field', label + ' field', { label }); field.slots.default = [vcatUi(s, entryId, label, props)]; return field; };
const vcatCard = (s, label, value) => { const card = vcatUi(s, 'u-card', label + ' card'); card.slots.default = [vcatTxt(s, label, 'span', label + ' label'), vcatTxt(s, value, 'h2', label + ' value')]; return card; };
function vcatShell(s, content) {
  return [vcatBox(s, 'div', 'row', 'Application shell', [
    vcatBox(s, 'nav', 'stack', 'Primary sidebar', [vcatTxt(s, 'Workspace', 'span', 'Product name'), vcatUi(s, 'u-button', 'Overview link', { label: 'Overview', variant: 'ghost' })], { widthMode: 'fixed', width: 224 }),
    vcatBox(s, 'div', 'stack', 'Workspace', [vcatBox(s, 'header', 'row', 'Command bar', [vcatUi(s, 'u-breadcrumb', 'Breadcrumb', { items: [{ label: 'Workspace' }] })]), vcatBox(s, 'main', 'stack', 'Content', content)]),
  ])];
}
const vcatCrud = s => [vcatBox(s, 'section', 'stack', 'List workspace', [
  vcatBox(s, 'header', 'row', 'Heading', [vcatTxt(s, 'Records', 'h1', 'Title'), vcatUi(s, 'u-button', 'Create action', { label: 'New record', icon: 'i-lucide-plus' })]),
  ...vcatFilter(s),
  vcatUi(s, 'u-table', 'Records table', { columns: [{ accessorKey: 'name', header: 'Name' }], data: [] }, { visibleIn: ['default', 'loading', 'error', 'disabled'] }),
  vcatUi(s, 'u-alert', 'Empty message', { title: 'No records yet', description: 'Create the first record to get started.', color: 'neutral' }, { visibleIn: ['empty'] }),
])];
const vcatFilter = s => [vcatBox(s, 'div', 'row', 'Filter bar', [vcatUi(s, 'u-input', 'Search', { placeholder: 'Search…', icon: 'i-lucide-search' }), vcatUi(s, 'u-select', 'Filter', { items: ['All'], placeholder: 'Filter' }), vcatUi(s, 'u-button', 'Reset filters', { label: 'Reset', variant: 'ghost' })])];
const vcatMasterDetail = s => [vcatBox(s, 'div', 'grid', 'Master / detail', [vcatBox(s, 'section', 'stack', 'Records', [vcatUi(s, 'u-table', 'Record list', { columns: [{ accessorKey: 'name', header: 'Name' }], data: [] })]), vcatBox(s, 'section', 'stack', 'Detail', [vcatTxt(s, 'Details', 'h2', 'Detail title'), vcatTxt(s, 'Select a record to see its details.', 'p', 'Detail hint')])], { columns: 2 })];
function vcatSettings(s) { const form = vcatUi(s, 'u-form', 'Settings form'); form.slots.default = [vcatField(s, 'Name', 'u-input', { placeholder: 'Workspace name' }), vcatField(s, 'Notifications', 'u-switch', { label: 'Email notifications' })]; return [vcatBox(s, 'div', 'row', 'Settings', [vcatBox(s, 'nav', 'stack', 'Settings sections', [vcatUi(s, 'u-button', 'General section', { label: 'General', variant: 'ghost' }), vcatUi(s, 'u-button', 'Notifications section', { label: 'Notifications', variant: 'ghost' })]), form])]; }
const vcatEmpty = s => [vcatBox(s, 'section', 'stack', 'Empty state', [vcatTxt(s, 'Nothing here yet', 'h2', 'Empty title'), vcatTxt(s, 'Create the first item to get started.', 'p', 'Empty copy'), vcatUi(s, 'u-button', 'Empty action', { label: 'Create' })])];
const vcatDashboard = s => [vcatBox(s, 'section', 'stack', 'Dashboard', [vcatTxt(s, 'Overview', 'h1', 'Title'), vcatBox(s, 'div', 'grid', 'KPI summary', [vcatCard(s, 'Active', '0'), vcatCard(s, 'Revenue', '0'), vcatCard(s, 'Attention', '0')], { columns: 3 }), vcatUi(s, 'u-table', 'Activity', { columns: [{ accessorKey: 'event', header: 'Event' }], data: [] })])];
function vcatForm(s) { const form = vcatUi(s, 'u-form', 'Record form'); form.slots.default = [vcatField(s, 'Title', 'u-input', { placeholder: 'Title' }), vcatField(s, 'Description', 'u-textarea', { rows: 4 })]; return [vcatBox(s, 'section', 'stack', 'Form workflow', [vcatTxt(s, 'New record', 'h1', 'Title'), form, vcatBox(s, 'footer', 'row', 'Form actions', [vcatUi(s, 'u-button', 'Cancel', { label: 'Cancel', variant: 'ghost' }), vcatUi(s, 'u-button', 'Save', { label: 'Save' })], { justify: 'end' })])]; }
const vcatRecipe = (id, label, description, build) => Object.freeze({ id, label, category: 'Application patterns', description, build });
export const visualRecipes = Object.freeze([
  vcatRecipe('recipe-app-shell', 'Application Shell', 'Sidebar, header and content region', s => vcatShell(s, [])),
  vcatRecipe('recipe-crud-list', 'CRUD List Workspace', 'Heading, actions, filter bar, table and empty state', vcatCrud),
  vcatRecipe('recipe-filter-bar', 'Filter Bar', 'Search, filter and reset', vcatFilter),
  vcatRecipe('recipe-master-detail', 'Master / Detail', 'Record collection with a detail pane', vcatMasterDetail),
  vcatRecipe('recipe-settings', 'Settings Form', 'Section navigation plus grouped validated form', vcatSettings),
  vcatRecipe('recipe-empty-state', 'Empty State', 'Message, supporting copy and primary action', vcatEmpty),
]);
const vcatLayout = (id, name, category, description, build) => Object.freeze({ id, name, category, scope: 'page', description, build });
export const visualBuiltinLayouts = Object.freeze([
  vcatLayout('builtin-list-workspace', 'List workspace', 'application', 'Sidebar, command bar, filters and data table', s => vcatShell(s, vcatCrud(s))),
  vcatLayout('builtin-dashboard', 'Operations dashboard', 'dashboard', 'KPI row and activity table', vcatDashboard),
  vcatLayout('builtin-master-detail', 'Master / detail', 'master-detail', 'Record list with persistent detail pane', s => vcatShell(s, vcatMasterDetail(s))),
  vcatLayout('builtin-form', 'Form workflow', 'form', 'Sectioned form with actions', vcatForm),
  vcatLayout('builtin-settings', 'Settings', 'settings', 'Settings navigation and grouped forms', s => vcatShell(s, vcatSettings(s))),
]);
export function visualExpand(store, id) {
  const item = visualRecipes.find(r => r.id === id) ?? visualBuiltinLayouts.find(l => l.id === id);
  visualAssert(item, 'Unknown recipe or layout ' + JSON.stringify(id) + '.');
  return item.build(store);
}
```
Note: `vcatShell` allocates the shell IDs before content IDs only if content is built first — the calls above build `content` before the shell (argument evaluation), which is deterministic; the test checks determinism, not ordering.

- [ ] **Step 4: Register** `.fallowrc.json` entry `scripts/companion/visual/visual-catalog.mjs`.
- [ ] **Step 5: Run** `npm run test:visual` — Expected: PASS.
- [ ] **Step 6: Commit** `git add scripts/companion/visual/visual-catalog.mjs tests/tooling/visual-catalog.checks.mjs .fallowrc.json && git commit -m "feat(visual): pin Nuxt UI catalog v1 with recipes and built-in layouts"`

---

### Task 3: Composition graph and full validation

**Files:**
- Create: `scripts/companion/visual/visual-composition.mjs`, `scripts/companion/visual/visual-validate.mjs`, `tests/tooling/visual-validate.checks.mjs`, `tests/fixtures/companion/visual-v5.json`
- Modify: `.fallowrc.json`

**Interfaces:**
- Produces: `visualDependencies(nodes) → string[]` (project componentIds), `visualWouldCycle(store, parentId, childId) → boolean`, `visualUsages(store, componentId) → {kind:'page'|'component'|'layout', definitionId, definitionName, nodeId}[]`, `visualCompositionGraph(store) → void` (throws cycle/depth), `validateVisualDesigns(store, context?) → store` with `context = { surfaces?: Set<string>, library?: Set<string>, sources?: Map<string, Set<string>> }`, `visualIsControl(node) → boolean`.

- [ ] **Step 1: Create fixture** `tests/fixtures/companion/visual-v5.json` — a `visualDesigns` object (not the full envelope) that exercises every kind. Build it with this one-off script and check the output in (do not commit the script):

```js
// node --input-type=module -e "<paste>" > tests/fixtures/companion/visual-v5.json
import { emptyVisualDesigns, visualAllocate as a, visualElement, visualText, visualSlot, visualNuxt, visualProject, visualLiteral as L, visualLayoutRules } from './scripts/companion/visual/visual-ir.mjs';
const s = emptyVisualDesigns();
const cId = a(s, 'vc'), pId = a(s, 'vp');
const search = visualNuxt(a(s, 'vn'), 'u-input', { modelValue: { kind: 'prop', name: 'query' }, placeholder: L('Search…') }, { name: 'Search input' });
const button = visualNuxt(a(s, 'vn'), 'u-button', { label: L('Search') }, { name: 'Submit', events: [{ id: a(s, 'vi'), event: 'click', label: 'Submit search', notes: '', acceptance: 'Given a query, when submitted, then search is emitted', actions: [{ kind: 'emit', event: 'search', payload: { kind: 'draft', nodeId: search.id } }] }] });
s.components.push({ id: cId, libraryId: 'library-search', exportName: 'SearchField', description: 'Search input with submit', props: [{ name: 'query', type: 'string', required: false, default: '' }], slots: [{ name: 'actions', required: false }], emits: [{ name: 'search', payloadType: 'string' }], variants: [{ id: 'compact', name: 'Compact', values: { query: '' } }], template: [visualElement(a(s, 'vn'), 'div', { name: 'Root', layout: visualLayoutRules('row'), children: [search, button, visualSlot(a(s, 'vn'), 'actions')] })], scenarios: [] });
const table = visualNuxt(a(s, 'vn'), 'u-table', { data: { kind: 'source', sourceId: 'customers', operationId: 'list', field: 'items' }, columns: L([{ accessorKey: 'name', header: 'Name' }]) }, { name: 'Customer table', visibleIn: ['default', 'loading', 'error', 'disabled'] });
const empty = visualNuxt(a(s, 'vn'), 'u-alert', { title: L('No customers') }, { name: 'Empty', visibleIn: ['empty'] });
const field = visualProject(a(s, 'vn'), cId, { name: 'Customer search', props: { query: L('') }, slots: { actions: [visualNuxt(a(s, 'vn'), 'u-button', { label: L('Reset') }, { name: 'Reset', events: [{ id: a(s, 'vi'), event: 'click', label: 'Reset view', notes: '', acceptance: '', actions: [{ kind: 'set-state', state: 'default' }, { kind: 'toggle', nodeId: empty.id }] }] })] }, events: [{ id: a(s, 'vi'), event: 'search', label: 'Run search', notes: '', acceptance: '', actions: [{ kind: 'source', sourceId: 'customers', operationId: 'list', input: { kind: 'event' } }] }] });
const heading = visualText(a(s, 'vn'), 'Customers', 'h1', { name: 'Title' });
const open = visualNuxt(a(s, 'vn'), 'u-button', { label: L('Open settings') }, { name: 'Settings link', events: [{ id: a(s, 'vi'), event: 'click', label: 'Open settings', notes: '', acceptance: 'Opens settings', actions: [{ kind: 'navigate', surfaceId: 'node-settings' }] }, { id: a(s, 'vi'), event: 'focus', label: 'Unimplemented', notes: 'Business rule pending', acceptance: 'Pending product rule', actions: [] }] });
s.pages.push({ id: pId, ownerId: 'node-customers', name: 'Customers', notes: '', root: [visualElement(a(s, 'vn'), 'main', { name: 'Content', layout: visualLayoutRules('stack'), children: [heading, field, table, empty, open] })], scenarios: [{ id: 'empty', name: 'Empty list', state: 'empty', width: 'wide', values: {}, bindings: [{ sourceId: 'customers', operationId: 'list', value: { items: [] } }] }] });
const lId = a(s, 'vl');
s.layouts.push({ id: lId, name: 'Two regions', description: 'Header and body', scope: 'region', category: 'custom', slots: [{ name: 'body', required: true }], root: [visualElement(a(s, 'vn'), 'section', { name: 'Frame', children: [visualText(a(s, 'vn'), 'Header', 'h2'), visualSlot(a(s, 'vn'), 'body', { fallback: [visualText(a(s, 'vn'), 'Body', 'p')] })] })], sourcePageId: pId });
const rId = a(s, 'vr'); const c = s.components[0];
s.revisions.push({ id: rId, componentId: cId, version: '1.0.0', contract: { props: c.props, slots: c.slots, emits: c.emits, variants: c.variants }, template: JSON.parse(JSON.stringify(c.template)) });
console.log(JSON.stringify(s, null, 1));
```

- [ ] **Step 2: Failing tests** — `tests/tooling/visual-validate.checks.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateVisualDesigns } from '../../scripts/companion/visual/visual-validate.mjs';
import { visualWouldCycle, visualUsages, visualDependencies } from '../../scripts/companion/visual/visual-composition.mjs';
import { visualLocate, visualProject } from '../../scripts/companion/visual/visual-ir.mjs';
const seed = JSON.parse(await readFile('tests/fixtures/companion/visual-v5.json', 'utf8'));
const copy = () => structuredClone(seed);
const context = { surfaces: new Set(['node-customers', 'node-settings']), library: new Set(['library-search']), sources: new Map([['customers', new Set(['list'])]]) };
const page = s => s.pages[0], comp = s => s.components[0];
function findByName(list, name) { for (const n of list) { if (n.name === name) return n; const kids = n.kind === 'element' ? n.children : n.kind === 'slot' ? n.fallback : n.kind === 'component' ? Object.values(n.slots).flat() : []; const hit = findByName(kids, name); if (hit) return hit; } return null; }

test('fixture is valid with and without cross-project context', () => {
  const s = copy(); assert.equal(validateVisualDesigns(s), s);
  validateVisualDesigns(copy(), context);
});
const rejects = [
  ['future schema', s => { s.schema = 4; }, /Unsupported visual-design/],
  ['catalog v2', s => { s.catalog.version = 2; }, /pins nuxt-ui v1/],
  ['reused counter', s => { s.nextId = 2; }, /counter could reuse/],
  ['unknown store key', s => { s.executed = true; }, /Unsupported visual-design/],
  ['duplicate element id', s => { findByName(page(s).root, 'Title').id = findByName(page(s).root, 'Content').id; }, /Duplicate|duplicate/],
  ['malformed id', s => { findByName(page(s).root, 'Title').id = 'node-1'; }, /malformed ID/],
  ['unknown kind', s => { findByName(page(s).root, 'Title').kind = 'script'; }, /unsupported element kind/],
  ['unknown tag', s => { findByName(page(s).root, 'Content').tag = 'iframe'; }, /unsupported tag/],
  ['event attribute', s => { findByName(page(s).root, 'Content').attrs.onclick = { kind: 'literal', value: 'x' }; }, /attribute onclick/],
  ['expression value', s => { findByName(page(s).root, 'Title').value = { kind: 'expression', code: 'alert(1)' }; }, /unsupported value kind/],
  ['prop binding in page', s => { findByName(page(s).root, 'Title').value = { kind: 'prop', name: 'query' }; }, /undeclared prop/],
  ['unknown catalog entry', s => { findByName(page(s).root, 'Empty').ref.entryId = 'u-evil'; }, /unknown Nuxt UI catalog entry/],
  ['undeclared catalog prop', s => { findByName(page(s).root, 'Empty').props.onClick = { kind: 'literal', value: 'x' }; }, /prop onClick is not declared/],
  ['mistyped catalog prop', s => { findByName(page(s).root, 'Settings link').props.label = { kind: 'literal', value: 5 }; }, /must be a string/],
  ['missing project component', s => { findByName(page(s).root, 'Customer search').ref.componentId = 'vc-999'; }, /missing component/],
  ['undeclared instance slot', s => { const n = findByName(page(s).root, 'Customer search'); n.slots.footer = n.slots.actions; delete n.slots.actions; }, /slot footer is not declared/],
  ['undeclared component event', s => { findByName(page(s).root, 'Customer search').events[0].event = 'explode'; }, /not declared/],
  ['slot node in page', s => { page(s).root.push({ id: 'vn-900', kind: 'slot', name: 'x', fallback: [] }); s.nextId = 901; }, /slot "x" is not declared/],
  ['template emits undeclared', s => { findByName(comp(s).template, 'Submit').events[0].actions[0].event = 'boom'; }, /undeclared event/],
  ['template undeclared slot', s => { comp(s).slots = []; s.revisions = []; findByName(page(s).root, 'Customer search').slots = {}; }, /slot "actions" is not declared/],
  ['toggle missing node', s => { findByName(page(s).root, 'Reset').events[0].actions[1].nodeId = 'vn-999'; }, /missing element/],
  ['set-value on non-control', s => { findByName(page(s).root, 'Reset').events[0].actions[1] = { kind: 'set-value', nodeId: findByName(page(s).root, 'Title').id, value: 'x' }; }, /form controls/],
  ['unknown state', s => { findByName(page(s).root, 'Reset').events[0].actions[0].state = 'accepted'; }, /unknown state/],
  ['navigation to missing surface', s => { findByName(page(s).root, 'Settings link').events[0].actions[0].surfaceId = 'node-gone'; }, /navigation target/],
  ['unknown source operation', s => { findByName(page(s).root, 'Customer table').props.data.operationId = 'drop'; }, /unknown source operation/],
  ['too many actions', s => { findByName(page(s).root, 'Reset').events[0].actions = Array(9).fill({ kind: 'set-state', state: 'default' }); }, /eight actions/],
  ['empty visibility', s => { findByName(page(s).root, 'Empty').visibleIn = []; }, /preview state/],
  ['raw css layout', s => { findByName(page(s).root, 'Content').layout.ui.tokens.color = 'red; background:url(x)'; }, /token/],
  ['two pages one owner', s => { const p = structuredClone(page(s)); p.id = 'vp-900'; p.root = []; p.scenarios = []; s.pages.push(p); s.nextId = 901; }, /already designed/],
  ['owner not in sitemap', s => { page(s).ownerId = 'node-ghost'; }, /owner surface/],
  ['duplicate export name', s => { const c = structuredClone(comp(s)); c.id = 'vc-900'; c.libraryId = 'library-other'; c.template = []; s.components.push(c); s.nextId = 901; }, /unique PascalCase/],
  ['forbidden prop name', s => { comp(s).props.push({ name: 'style', type: 'string', required: false }); }, /invalid prop/],
  ['mistyped default', s => { comp(s).props[0].default = 1; }, /default of prop query/],
  ['variant sets undeclared prop', s => { comp(s).variants[0].values.size = 'lg'; }, /undeclared or mistyped prop size/],
  ['revision duplicate version', s => { const r = structuredClone(s.revisions[0]); r.id = 'vr-900'; s.revisions.push(r); s.nextId = 901; }, /unique x.y.z version/],
  ['layout undeclared slot', s => { s.layouts[0].slots = []; }, /slot "body" is not declared/],
  ['prototype pollution key', s => { findByName(page(s).root, 'Content').attrs = JSON.parse('{"__proto__":{"kind":"literal","value":1}}'); }, /attribute|invalid|allowed/],
  ['depth over 12', s => { let n = findByName(page(s).root, 'Content'); for (let i = 0; i < 12; i++) { const child = { id: 'vn-' + (900 + i), kind: 'element', tag: 'div', attrs: {}, children: [], events: [] }; n.children.push(child); n = child; } s.nextId = 1000; }, /nesting exceeds 12/],
];
for (const [name, change, pattern] of rejects) test('rejects ' + name, () => { const s = copy(); change(s); assert.throws(() => validateVisualDesigns(s, context), pattern); });

test('cycle detection covers direct, transitive and pinned-revision recursion', () => {
  const s = copy(); const c = comp(s);
  assert.equal(visualWouldCycle(s, c.id, c.id), true);
  const b = { ...structuredClone(c), id: 'vc-900', libraryId: 'library-b', exportName: 'Beta', template: [visualProject('vn-901', c.id, { props: {} })] }; s.components.push(b); s.nextId = 902;
  assert.equal(visualWouldCycle(s, c.id, b.id), true, 'c → b → c');
  c.template[0].children.push(visualProject('vn-903', b.id)); s.nextId = 904;
  assert.throws(() => validateVisualDesigns(s), /Component cycle: SearchField → Beta → SearchField/);
});
test('dependencies and usages are indexed by stable IDs', () => {
  const s = copy();
  assert.deepEqual(visualDependencies(page(s).root), [comp(s).id]);
  assert.deepEqual(visualUsages(s, comp(s).id).map(u => [u.kind, u.definitionId]), [['page', page(s).id]]);
});
```

- [ ] **Step 3: Run** `node --test tests/tooling/visual-validate.checks.mjs` — Expected: FAIL (modules missing).

- [ ] **Step 4: Implement `visual-composition.mjs`**

```js
// Component dependency graph over stable IDs. Pure.
import { VISUAL_LIMITS, visualAssert, visualWalk } from './visual-ir.mjs';
export function visualDependencies(nodes) { const found = new Set(); visualWalk(nodes, n => { if (n?.kind === 'component' && n.ref?.kind === 'project') found.add(n.ref.componentId); }); return [...found]; }
function vcmpEdges(nodes) { const out = []; visualWalk(nodes, n => { if (n?.kind === 'component' && n.ref?.kind === 'project') out.push(n.ref.revisionId ? 'rev:' + n.ref.revisionId : 'live:' + n.ref.componentId); }); return out; }
function vcmpGraphs(store) { const graphs = new Map(store.components.map(c => ['live:' + c.id, c.template])); for (const r of store.revisions) graphs.set('rev:' + r.id, r.template); return graphs; }
function vcmpLabel(store, key) { const [kind, id] = key.split(':'); const componentId = kind === 'rev' ? store.revisions.find(r => r.id === id)?.componentId : id; return store.components.find(c => c.id === componentId)?.exportName ?? id; }
export function visualWouldCycle(store, parentId, childId) {
  if (parentId === childId) return true;
  const graphs = vcmpGraphs(store), seen = new Set();
  const reaches = key => { const id = key.startsWith('rev:') ? store.revisions.find(r => 'rev:' + r.id === key)?.componentId : key.slice(5); if (id === parentId) return true; if (seen.has(key)) return false; seen.add(key); return vcmpEdges(graphs.get(key) ?? []).some(reaches); };
  return reaches('live:' + childId);
}
export function visualCompositionGraph(store) {
  const graphs = vcmpGraphs(store), done = new Set(), active = [];
  const visit = key => {
    visualAssert(!active.includes(key), 'Component cycle: ' + [...active.slice(active.indexOf(key)), key].map(k => vcmpLabel(store, k)).join(' → ') + '.');
    visualAssert(active.length < VISUAL_LIMITS.composition, 'Component composition is deeper than ' + VISUAL_LIMITS.composition + ' levels.');
    if (done.has(key)) return; active.push(key); for (const next of vcmpEdges(graphs.get(key) ?? [])) visit(next); active.pop(); done.add(key);
  };
  for (const key of graphs.keys()) visit(key);
}
export function visualUsages(store, componentId) {
  const out = [];
  for (const [kind, list, root] of [['page', store.pages, 'root'], ['component', store.components, 'template'], ['layout', store.layouts, 'root']])
    for (const d of list) visualWalk(d[root], n => { if (n.kind === 'component' && n.ref.kind === 'project' && n.ref.componentId === componentId) out.push({ kind, definitionId: d.id, definitionName: d.name ?? d.exportName, nodeId: n.id }); });
  return out;
}
```

- [ ] **Step 5: Implement `visual-validate.mjs`**

```js
// Complete, pure validation for visual designs. Gates save, export, import and generation.
import { VISUAL_SCHEMA, VISUAL_CATALOG, VISUAL_TAGS, VISUAL_TEXT_ROLES, VISUAL_STATES, VISUAL_PROP_TYPES, VISUAL_PAYLOAD_TYPES, VISUAL_LAYOUT_MODES, VISUAL_DOM_EVENTS, VISUAL_LIMITS, visualAssert, visualIsRef, visualIsText, visualIsLine, visualIsKey, visualIsScalar, visualIsPlain, visualWalk } from './visual-ir.mjs';
import { visualCatalogEntry, VISUAL_CONTROL_ENTRIES } from './visual-catalog.mjs';
import { visualCompositionGraph } from './visual-composition.mjs';
import { validateVisualMapping, validateVisualControl, visualMappingRefs } from './visual-mapping.mjs';
import { validateCompositionUI, validateCompositionScenarios, validateCompositionDesignSystem, compositionLiteral } from '../composition-contract.mjs';
const vvCommon = ['name', 'visibleIn', 'a11y', 'layout'];
const vvForbidden = ['designState', 'designScenario', 'interaction', 'ref', 'key', 'is', 'class', 'style', 'constructor', 'prototype', '__proto__'];
const vvCategories = ['application', 'dashboard', 'master-detail', 'form', 'settings', 'website', 'custom'];
const vvIdPattern = /^(vn|vp|vc|vl|vr|vi)-([1-9][0-9]*)$/;
function vvObject(value, keys, optional = []) { return visualIsPlain(value) && Object.keys(value).every(k => keys.includes(k) || optional.includes(k)) && keys.every(k => Object.hasOwn(value, k)); }
export function visualIsControl(node) { return node?.kind === 'component' && node.ref?.kind === 'nuxt-ui' && VISUAL_CONTROL_ENTRIES.includes(node.ref.entryId); }
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
    if (type === 'json') compositionLiteral(expr.value);
    else visualAssert(visualIsScalar(expr.value) && (type === 'scalar' || expr.value === null || typeof expr.value === type), where + ': literal must be ' + (type === 'scalar' ? 'a string, number, boolean or null' : 'a ' + type) + '.');
  } else if (expr.kind === 'prop') visualAssert(vvObject(expr, ['kind', 'name']) && !!scope.contract?.props.some(p => p.name === expr.name), where + ': binds undeclared prop ' + JSON.stringify(expr.name) + '.');
  else if (expr.kind === 'state') visualAssert(vvObject(expr, ['kind', 'nodeId']) && visualIsControl(scope.nodes.get(expr.nodeId)), where + ': state binding must reference a form control in this design.');
  else if (expr.kind === 'source') { visualAssert(vvObject(expr, ['kind', 'sourceId', 'operationId', 'field']) && visualIsRef(expr.sourceId) && visualIsRef(expr.operationId) && visualIsText(expr.field, 120), where + ': invalid source binding.'); vvSource(expr, scope, where); }
  else visualAssert(false, where + ': unsupported value kind ' + JSON.stringify(expr.kind) + '.');
}
function vvMapping(mapping, scope, where) {
  validateVisualMapping(mapping); const refs = visualMappingRefs(mapping);
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
  if (node.control !== undefined) { visualAssert(visualIsControl(node), where + ': only form controls have control semantics.'); validateVisualControl(node.control); }
  vvEvents(node, scope, [...contract.emits, ...VISUAL_DOM_EVENTS], where);
}
function vvNode(node, scope, at) {
  const where = scope.where + ' / ' + (node?.name || node?.id || 'element');
  const keys = { element: ['id', 'kind', 'tag', 'attrs', 'children', 'events'], text: ['id', 'kind', 'role', 'value'], slot: ['id', 'kind', 'name', 'fallback'], component: ['id', 'kind', 'ref', 'props', 'slots', 'events'] }[node?.kind];
  visualAssert(keys, where + ': unsupported element kind ' + JSON.stringify(node?.kind) + '.');
  visualAssert(at.depth <= VISUAL_LIMITS.depth, where + ': nesting exceeds ' + VISUAL_LIMITS.depth + ' levels.');
  visualAssert(vvObject(node, keys, [...vvCommon, ...(node.kind === 'component' ? ['variantId', 'control'] : [])]), where + ': unsupported element fields.');
  if (node.name !== undefined) visualAssert(visualIsLine(node.name, 120), where + ': name must be a single line.');
  if (node.visibleIn !== undefined) visualAssert(Array.isArray(node.visibleIn) && node.visibleIn.length > 0 && new Set(node.visibleIn).size === node.visibleIn.length && node.visibleIn.every(s => VISUAL_STATES.includes(s)), where + ': choose at least one supported preview state.');
  if (node.a11y !== undefined) visualAssert(visualIsText(node.a11y, 2000), where + ': accessibility notes too long.');
  if (node.layout !== undefined) { visualAssert(node.kind !== 'text' && vvObject(node.layout, ['mode', 'ui']) && VISUAL_LAYOUT_MODES.includes(node.layout.mode), where + ': invalid layout.'); validateCompositionUI(node.layout.ui); }
  if (node.kind === 'element') {
    visualAssert(VISUAL_TAGS.includes(node.tag), where + ': unsupported tag.');
    visualAssert(visualIsPlain(node.attrs) && Object.keys(node.attrs).length <= 16, where + ': invalid attributes.');
    for (const [key, value] of Object.entries(node.attrs)) { visualAssert(/^[a-z][a-z0-9-]*$/.test(key) && !key.startsWith('on') && !['style', 'class', 'is', 'key', 'ref'].includes(key), where + ': attribute ' + key + ' is not allowed.'); vvValue(value, scope, where + ' @' + key); }
    visualAssert(Array.isArray(node.children) && (!['input', 'img'].includes(node.tag) || node.children.length === 0), where + ': ' + node.tag + ' cannot contain children.');
    vvEvents(node, scope, null, where);
  } else if (node.kind === 'text') { visualAssert(VISUAL_TEXT_ROLES.includes(node.role), where + ': unsupported text role.'); vvValue(node.value, scope, where); }
  else if (node.kind === 'slot') { visualAssert(scope.slots.includes(node.name), where + ': slot ' + JSON.stringify(node.name) + ' is not declared.'); visualAssert(Array.isArray(node.fallback), where + ': invalid slot fallback.'); }
  else vvComponentNode(node, scope, where);
}
function vvDefinition(store, root, kind, context, identity, where, contract, slots = []) {
  visualAssert(Array.isArray(root), where + ': missing structure.');
  const nodes = new Map();
  visualWalk(root, node => { visualAssert(visualIsPlain(node) && !nodes.has(node.id), where + ': duplicate element ID ' + JSON.stringify(node?.id) + '.'); nodes.set(node.id, node); });
  visualAssert(nodes.size <= VISUAL_LIMITS.nodes, where + ': supports at most ' + VISUAL_LIMITS.nodes + ' elements.');
  const pinned = kind === 'revision', scoped = pinned ? () => {} : identity;
  for (const id of nodes.keys()) scoped(id, 'vn');
  const scope = { store, context, nodes, contract, where, pinned, slots: kind === 'page' ? [] : slots, identity: scoped };
  visualWalk(root, (node, at) => vvNode(node, scope, at));
  return nodes;
}
function vvScenarios(definition, nodes, where) {
  visualAssert(Array.isArray(definition.scenarios) && definition.scenarios.length <= VISUAL_LIMITS.scenarios, where + ': invalid scenarios.');
  validateCompositionScenarios({ scenarios: definition.scenarios, nodes: [...nodes.values()] });
}
export function validateVisualDesigns(store, context = {}) {
  visualAssert(vvObject(store, ['schema', 'nextId', 'catalog', 'pages', 'components', 'layouts', 'revisions']) && store.schema === VISUAL_SCHEMA, 'Unsupported visual-design collection.');
  visualAssert(Number.isSafeInteger(store.nextId) && store.nextId > 0 && store.nextId < Number.MAX_SAFE_INTEGER - 100000, 'Invalid visual ID counter.');
  visualAssert(vvObject(store.catalog, ['id', 'version']) && store.catalog.id === VISUAL_CATALOG.id && store.catalog.version === VISUAL_CATALOG.version, 'Unsupported component catalog ' + JSON.stringify(store.catalog) + '; this editor pins nuxt-ui v1.');
  for (const key of ['pages', 'components', 'layouts', 'revisions']) visualAssert(Array.isArray(store[key]), 'Invalid ' + key + ' collection.');
  visualAssert(store.pages.length + store.components.length <= VISUAL_LIMITS.definitions && store.layouts.length <= VISUAL_LIMITS.layouts && store.revisions.length <= VISUAL_LIMITS.revisions, 'Too many visual definitions.');
  const ids = new Set(); let highest = 0;
  const identity = (id, prefix) => { const m = typeof id === 'string' && vvIdPattern.exec(id); visualAssert(m && m[1] === prefix && !ids.has(id), 'Duplicate or malformed ID ' + JSON.stringify(id) + '.'); ids.add(id); highest = Math.max(highest, Number(m[2])); };
  const owners = new Set(), libraries = new Set(), exportNames = new Set(), versions = new Set();
  for (const page of store.pages) {
    const where = 'Page ' + JSON.stringify(page?.name ?? page?.id);
    visualAssert(vvObject(page, ['id', 'ownerId', 'name', 'root', 'scenarios', 'notes']), where + ': unsupported page fields.'); identity(page.id, 'vp');
    visualAssert(visualIsRef(page.ownerId) && !owners.has(page.ownerId) && (!context.surfaces || context.surfaces.has(page.ownerId)), where + ': owner surface is missing or already designed.'); owners.add(page.ownerId);
    visualAssert(visualIsLine(page.name, 120) && visualIsText(page.notes, 8000), where + ': invalid name or notes.');
    vvScenarios(page, vvDefinition(store, page.root, 'page', context, identity, where, null), where);
  }
  for (const c of store.components) {
    const where = 'Component ' + JSON.stringify(c?.exportName ?? c?.id);
    visualAssert(vvObject(c, ['id', 'libraryId', 'exportName', 'description', 'props', 'slots', 'emits', 'variants', 'template', 'scenarios'], ['implementation', 'notes']), where + ': unsupported component fields.'); identity(c.id, 'vc');
    visualAssert(typeof c.exportName === 'string' && /^[A-Z][A-Za-z0-9]*$/.test(c.exportName) && c.exportName.length <= 60 && !exportNames.has(c.exportName), where + ': export name must be a unique PascalCase Vue name.'); exportNames.add(c.exportName);
    visualAssert(visualIsRef(c.libraryId) && !libraries.has(c.libraryId) && (!context.library || context.library.has(c.libraryId)), where + ': library entry is missing or already designed.'); libraries.add(c.libraryId);
    visualAssert(visualIsText(c.description, 2000) && (c.notes === undefined || visualIsText(c.notes, 8000)), where + ': description or notes too long.');
    visualAssert(c.implementation === undefined || (vvObject(c.implementation, ['catalog', 'entryId']) && c.implementation.catalog === 'nuxt-ui' && visualCatalogEntry(c.implementation.entryId)), where + ': unknown implementation primitive.');
    vvContract(c, where); vvScenarios(c, vvDefinition(store, c.template, 'component', context, identity, where, c, c.slots.map(s => s.name)), where);
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
    visualAssert(vvObject(r, ['id', 'componentId', 'version', 'contract', 'template'], ['designSystem']), where + ': unsupported revision fields.'); identity(r.id, 'vr');
    visualAssert(store.components.some(c => c.id === r.componentId) && typeof r.version === 'string' && r.version.length <= 40 && /^\d+\.\d+\.\d+$/.test(r.version) && !versions.has(r.componentId + '@' + r.version), where + ': revision needs an existing component and a unique x.y.z version.'); versions.add(r.componentId + '@' + r.version);
    visualAssert(vvObject(r.contract, ['props', 'slots', 'emits', 'variants']), where + ': invalid published contract.'); vvContract(r.contract, where);
    if (r.designSystem !== undefined) validateCompositionDesignSystem(r.designSystem);
    vvDefinition(store, r.template, 'revision', context, identity, where, r.contract, r.contract.slots.map(s => s.name));
  }
  visualAssert(store.nextId > highest, 'The visual ID counter could reuse an existing ID.');
  visualCompositionGraph(store);
  return store;
}
```

- [ ] **Step 6: Register** both files in `.fallowrc.json` `entry`.
- [ ] **Step 7: Run** `npm run test:visual && npm run check:source` — Expected: PASS (all ~40 validate cases). If a case fails because the fixture lacks the needed shape, fix the fixture script, not the assertion.
- [ ] **Step 8: Commit** `git add scripts/companion/visual tests/tooling/visual-validate.checks.mjs tests/fixtures/companion/visual-v5.json .fallowrc.json && git commit -m "feat(visual): validate visual designs, contracts and component composition"`

---

### Task 4: Layout cloning and authoring commands

**Files:**
- Create: `scripts/companion/visual/visual-layout.mjs`, `scripts/companion/visual/visual-commands.mjs`, `tests/tooling/visual-commands.checks.mjs`
- Modify: `.fallowrc.json`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces (all mutate the passed store and return the created/affected object; callers pass a copy and validate afterwards):
  - `visualClone(store, nodes, { external = 'keep', slotsToRegions = false }) → UiNode[]`
  - `visualInstantiateLayout(store, layoutIdOrBuiltinId) → UiNode[]`
  - `visualSaveLayout(store, { name, description, category, scope, nodeIds, pageId }) → LayoutDefinition`
  - `visualCreatePage(store, { ownerId, name }) → PageDefinition`
  - `visualCreateComponent(store, { libraryId, exportName, description, implementation? }) → ComponentDefinition`
  - `visualRemoveDefinition(store, ref)` (refuses used components)
  - `visualInsert(store, ref, target, nodes) → UiNode[]` with `target = { parentId: string|null, slot?: string, index?: number }`
  - `visualRemoveNode(store, ref, nodeId)`, `visualMoveNode(store, ref, nodeId, 'earlier'|'later')`, `visualReparent(store, ref, nodeId, target)`, `visualDuplicateNode(store, ref, nodeId) → UiNode`, `visualWrapNode(store, ref, nodeId, tag='div') → UiNode`
  - `visualUpdateNode(store, ref, nodeId, patch) → UiNode` (patch keys limited to `name, visibleIn, a11y, layout, tag, role, value, attrs, props, variantId, control, slots`; `undefined` deletes optional keys)
  - `visualSetContract(store, componentId, { exportName?, description?, props?, slots?, emits?, variants? })`
  - `visualAddInteraction(store, ref, nodeId, { event, label, actions, notes, acceptance }) → Interaction`, `visualUpdateInteraction(store, ref, nodeId, interactionId, patch)`, `visualRemoveInteraction(store, ref, nodeId, interactionId)`
  - `visualSetScenarios(store, ref, scenarios)`
  - `visualPublish(store, componentId, version) → ComponentRevision`

- [ ] **Step 1: Failing tests** — `tests/tooling/visual-commands.checks.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { visualNodes, visualLocate, visualLiteral, visualNuxt } from '../../scripts/companion/visual/visual-ir.mjs';
import { validateVisualDesigns } from '../../scripts/companion/visual/visual-validate.mjs';
import { visualClone, visualInstantiateLayout, visualSaveLayout } from '../../scripts/companion/visual/visual-layout.mjs';
import * as cmd from '../../scripts/companion/visual/visual-commands.mjs';
const seed = JSON.parse(await readFile('tests/fixtures/companion/visual-v5.json', 'utf8'));
const store = () => structuredClone(seed);
const pageRef = s => ({ kind: 'page', id: s.pages[0].id });
const byName = (nodes, name) => visualNodes(nodes).find(n => n.name === name);
const ids = s => [...s.pages.map(p => p.root), ...s.components.map(c => c.template), ...s.layouts.map(l => l.root)].flatMap(visualNodes).map(n => n.id);

test('applying a built-in layout twice yields fresh unique IDs and a valid page', () => {
  const s = store(), before = s.nextId;
  cmd.visualInsert(s, pageRef(s), { parentId: null }, visualInstantiateLayout(s, 'builtin-list-workspace'));
  cmd.visualInsert(s, pageRef(s), { parentId: null }, visualInstantiateLayout(s, 'builtin-list-workspace'));
  assert.equal(new Set(ids(s)).size, ids(s).length); assert.ok(s.nextId > before); validateVisualDesigns(s);
});
test('saved layout turns slots into regions on instantiation and keeps component references', () => {
  const s = store(); const content = byName(s.pages[0].root, 'Content');
  const layout = visualSaveLayout(s, { name: 'Customer ops', description: '', category: 'application', scope: 'page', nodeIds: [content.id], pageId: s.pages[0].id });
  const nodes = visualInstantiateLayout(s, layout.id);
  assert.ok(visualNodes(nodes).every(n => n.kind !== 'slot'));
  assert.equal(byName(nodes, 'Customer search').ref.componentId, s.components[0].id);
  assert.notEqual(byName(nodes, 'Customer search').id, byName(content.children, 'Customer search').id);
  validateVisualDesigns(s);
  const regionLayout = visualInstantiateLayout(s, s.layouts[0].id);
  assert.ok(visualNodes(regionLayout).some(n => n.kind === 'element' && n.name === 'body'), 'slot "body" became a named div');
});
test('duplicate remaps internal references to the copies (Review Focus 4)', () => {
  const s = store(); const search = byName(s.pages[0].root, 'Customer search');
  const copy = cmd.visualDuplicateNode(s, pageRef(s), search.id);
  const reset = visualNodes([copy]).find(n => n.name === 'Reset');
  assert.notEqual(reset.events[0].id, byName([search], 'Reset').events[0].id);
  assert.equal(reset.events[0].actions[1].nodeId, byName(s.pages[0].root, 'Empty').id, 'external reference kept');
  validateVisualDesigns(s);
});
test('saving a region whose interactions target outside elements is refused', () => {
  const s = store(); const search = byName(s.pages[0].root, 'Customer search');
  assert.throws(() => visualSaveLayout(s, { name: 'x', description: '', category: 'custom', scope: 'region', nodeIds: [search.id], pageId: s.pages[0].id }), /Reset view.*outside the copied structure/);
});
test('removing a used component is refused with every usage (Review Focus 2)', () => {
  const s = store();
  assert.throws(() => cmd.visualRemoveDefinition(s, { kind: 'component', id: s.components[0].id }), /used by.*Customers/);
});
test('contract edits that break instances are refused before commit (Review Focus 3)', () => {
  const s = store(); const c = s.components[0];
  assert.throws(() => cmd.visualSetContract(s, c.id, { slots: [] }), /Customer search.*actions/);
  assert.throws(() => cmd.visualSetContract(s, c.id, { props: [] }), /Customer search.*query/);
  assert.throws(() => cmd.visualSetContract(s, c.id, { emits: [] }), /Customer search.*search|SearchField.*search/);
  cmd.visualSetContract(s, c.id, { description: 'Changed' }); assert.equal(c.description, 'Changed'); validateVisualDesigns(s);
});
test('removing a referenced element is refused; scenario values are pruned', () => {
  const s = store(); const empty = byName(s.pages[0].root, 'Empty');
  assert.throws(() => cmd.visualRemoveNode(s, pageRef(s), empty.id), /Reset view/);
  const title = byName(s.pages[0].root, 'Title'); s.pages[0].scenarios[0].values[title.id] = 'x';
  cmd.visualRemoveNode(s, pageRef(s), title.id);
  assert.equal(visualLocate(s.pages[0].root, title.id), null); assert.equal(title.id in s.pages[0].scenarios[0].values, false); validateVisualDesigns(s);
});
test('move, reparent, wrap and insert keep a valid tree and refuse cycles', () => {
  const s = store(); const content = byName(s.pages[0].root, 'Content'), title = byName(content.children, 'Title');
  cmd.visualMoveNode(s, pageRef(s), title.id, 'later'); assert.equal(content.children[1].id, title.id);
  assert.throws(() => cmd.visualMoveNode(s, pageRef(s), content.children.at(-1).id, 'later'), /already last/);
  const wrapper = cmd.visualWrapNode(s, pageRef(s), title.id);
  assert.throws(() => cmd.visualReparent(s, pageRef(s), wrapper.id, { parentId: title.id }), /inside itself|cannot contain/);
  cmd.visualReparent(s, pageRef(s), title.id, { parentId: null, index: 0 }); assert.equal(s.pages[0].root[0].id, title.id);
  const [added] = cmd.visualInsert(s, pageRef(s), { parentId: byName(s.pages[0].root, 'Customer search').id, slot: 'actions' }, [visualNuxt(`vn-${s.nextId++}`, 'u-badge', { label: visualLiteral('New') })]);
  assert.ok(added); validateVisualDesigns(s);
  assert.throws(() => cmd.visualInsert(s, pageRef(s), { parentId: byName(s.pages[0].root, 'Customer search').id, slot: 'nope' }, []), /slot nope/);
});
test('publish pins dependencies, snapshots the contract and rejects non-increasing versions', () => {
  const s = store(); const c = s.components[0];
  const r = cmd.visualPublish(s, c.id, '1.1.0'); assert.deepEqual(r.contract.props, c.props); validateVisualDesigns(s);
  assert.throws(() => cmd.visualPublish(s, c.id, '1.0.5'), /greater than 1.1.0/);
});
test('create component from a catalog primitive seeds a typed contract and a bound template', () => {
  const s = store(); const c = cmd.visualCreateComponent(s, { libraryId: 'library-new', exportName: 'AppButton', description: '', implementation: { catalog: 'nuxt-ui', entryId: 'u-button' } });
  assert.deepEqual(c.props.map(p => [p.name, p.type]), [['label', 'string'], ['color', 'string'], ['variant', 'string'], ['icon', 'string'], ['loading', 'boolean'], ['disabled', 'boolean']]);
  assert.deepEqual(c.slots.map(x => x.name), ['leading', 'default', 'trailing']);
  assert.equal(c.template[0].props.label.kind, 'prop'); validateVisualDesigns(s);
});
```

- [ ] **Step 2: Run** `node --test tests/tooling/visual-commands.checks.mjs` — Expected: FAIL (modules missing).

- [ ] **Step 3: Implement `visual-layout.mjs`**

```js
// Structural copies with fresh IDs. Component definitions stay references.
import { visualAssert, visualAllocate, visualWalk, visualNodes, visualLocate, visualElement } from './visual-ir.mjs';
import { visualExpand, visualBuiltinLayouts } from './visual-catalog.mjs';
function vlayRemapMapping(m, remap) { if (m?.kind === 'draft') return { ...m, nodeId: remap(m.nodeId) }; if (m?.kind === 'object') return { ...m, fields: Object.fromEntries(Object.entries(m.fields).map(([k, v]) => [k, vlayRemapMapping(v, remap)])) }; return m; }
export function visualClone(store, nodes, { external = 'keep', slotsToRegions = false } = {}) {
  const map = new Map(); visualWalk(nodes, n => map.set(n.id, visualAllocate(store, 'vn')));
  const labels = new Map(); visualWalk(nodes, n => { for (const i of n.events ?? []) labels.set(i.id, i.label); });
  const remap = (id, label) => { if (map.has(id)) return map.get(id); visualAssert(external === 'keep', 'Interaction ' + JSON.stringify(label) + ' targets an element outside the copied structure.'); return id; };
  const copy = n => {
    const out = structuredClone(n); out.id = map.get(n.id);
    if (out.kind === 'element') out.children = n.children.map(copy);
    if (out.kind === 'slot') out.fallback = n.fallback.map(copy);
    if (out.kind === 'component') out.slots = Object.fromEntries(Object.entries(n.slots).map(([k, v]) => [k, v.map(copy)]));
    if (out.kind === 'text' && out.value.kind === 'state') out.value = { ...out.value, nodeId: remap(out.value.nodeId, n.name ?? n.id) };
    for (const key of ['props', 'attrs']) if (out[key]) for (const [k, v] of Object.entries(out[key])) if (v.kind === 'state') out[key][k] = { ...v, nodeId: remap(v.nodeId, n.name ?? n.id) };
    if (out.events) out.events = out.events.map(i => ({ ...i, id: visualAllocate(store, 'vi'), actions: i.actions.map(a => ['toggle', 'focus', 'set-value'].includes(a.kind) ? { ...a, nodeId: remap(a.nodeId, i.label) } : a.kind === 'emit' ? { ...a, payload: vlayRemapMapping(a.payload, id => remap(id, i.label)) } : a.kind === 'source' ? { ...a, input: vlayRemapMapping(a.input, id => remap(id, i.label)) } : a) }));
    if (slotsToRegions && out.kind === 'slot') return visualElement(out.id, 'div', { name: out.name, children: out.fallback, ...(out.layout ? { layout: out.layout } : {}), ...(out.visibleIn ? { visibleIn: out.visibleIn } : {}) });
    return out;
  };
  return nodes.map(copy);
}
export function visualInstantiateLayout(store, id) {
  if (visualBuiltinLayouts.some(l => l.id === id)) return visualExpand(store, id);
  const layout = store.layouts.find(l => l.id === id); visualAssert(layout, 'Unknown layout ' + JSON.stringify(id) + '.');
  for (const n of visualNodes(layout.root)) if (n.kind === 'component' && n.ref.kind === 'project') visualAssert(store.components.some(c => c.id === n.ref.componentId), 'Layout ' + JSON.stringify(layout.name) + ' uses a component that no longer exists.');
  return visualClone(store, layout.root, { external: 'reject', slotsToRegions: true });
}
export function visualSaveLayout(store, { name, description, category, scope, nodeIds, pageId }) {
  const page = store.pages.find(p => p.id === pageId); visualAssert(page, 'Choose a page to save from.');
  const nodes = nodeIds.map(id => { const hit = visualLocate(page.root, id); visualAssert(hit, 'Selected element no longer exists.'); return hit.node; });
  const layout = { id: visualAllocate(store, 'vl'), name, description, scope, category, slots: [], root: visualClone(store, nodes, { external: 'reject' }), sourcePageId: pageId };
  store.layouts.push(layout); return layout;
}
```
The exact ordering inside `visualClone` matters: allocate node IDs first (map), then interaction IDs while copying — keep it as written.

- [ ] **Step 4: Implement `visual-commands.mjs`** (≤ 400 code lines; split helper `vcmdFind`/`vcmdList` as below)

```js
// Pure authoring commands. Each mutates the given (copied) store; the caller validates and persists once.
import { visualAssert, visualAllocate, visualWalk, visualNodes, visualLocate, visualDefinition, visualRoot, visualElement, visualLiteral, visualNuxt } from './visual-ir.mjs';
import { visualCatalogEntry } from './visual-catalog.mjs';
import { visualUsages } from './visual-composition.mjs';
import { visualClone } from './visual-layout.mjs';
import { visualMappingRefs } from './visual-mapping.mjs';
function vcmdDef(store, ref) { const d = visualDefinition(store, ref); visualAssert(d, 'The ' + ref.kind + ' no longer exists.'); return d; }
function vcmdHit(def, nodeId) { const hit = visualLocate(visualRoot(def), nodeId); visualAssert(hit, 'The element no longer exists.'); return hit; }
function vcmdSlots(store, node) {
  if (node.ref.kind === 'nuxt-ui') return visualCatalogEntry(node.ref.entryId)?.slots.map(s => s.name) ?? [];
  const c = node.ref.revisionId ? store.revisions.find(r => r.id === node.ref.revisionId)?.contract : store.components.find(x => x.id === node.ref.componentId);
  return c?.slots.map(s => s.name) ?? [];
}
function vcmdTargetList(store, def, target) {
  if (target.parentId === null) return visualRoot(def);
  const parent = vcmdHit(def, target.parentId).node;
  if (parent.kind === 'element') { visualAssert(!['input', 'img'].includes(parent.tag), 'A ' + parent.tag + ' cannot contain elements.'); return parent.children; }
  if (parent.kind === 'slot') return parent.fallback;
  if (parent.kind === 'component') { visualAssert(target.slot && vcmdSlots(store, parent).includes(target.slot), 'The component has no slot ' + target.slot + '.'); parent.slots[target.slot] ??= []; return parent.slots[target.slot]; }
  visualAssert(false, 'Text cannot contain elements.');
}
function vcmdReferences(def, ids) {
  const found = [];
  visualWalk(visualRoot(def), n => {
    if (ids.has(n.id)) return;
    const values = [...Object.values(n.props ?? {}), ...Object.values(n.attrs ?? {}), ...(n.kind === 'text' ? [n.value] : [])];
    if (values.some(v => v.kind === 'state' && ids.has(v.nodeId))) found.push(n.name ?? n.id);
    for (const i of n.events ?? []) if (i.actions.some(a => (a.nodeId && ids.has(a.nodeId)) || visualMappingRefs(a.payload ?? a.input).drafts.some(id => ids.has(id)))) found.push(i.label);
  });
  return found;
}
export function visualCreatePage(store, { ownerId, name }) { const page = { id: visualAllocate(store, 'vp'), ownerId, name, root: [], scenarios: [], notes: '' }; store.pages.push(page); return page; }
export function visualCreateComponent(store, { libraryId, exportName, description = '', implementation }) {
  const c = { id: visualAllocate(store, 'vc'), libraryId, exportName, description, props: [], slots: [], emits: [], variants: [], template: [], scenarios: [] };
  if (implementation) {
    const entry = visualCatalogEntry(implementation.entryId); visualAssert(entry, 'Unknown catalog primitive.');
    c.implementation = { catalog: 'nuxt-ui', entryId: entry.id };
    c.props = entry.props.filter(p => ['string', 'number', 'boolean'].includes(p.type)).map(p => ({ name: p.name, type: p.type, required: false, ...(p.default !== undefined ? { default: p.default } : {}) }));
    c.slots = entry.slots.map(s => ({ name: s.name, required: false }));
    c.emits = entry.emits.filter(e => /^[a-z][A-Za-z0-9]*$/.test(e.name)).map(e => ({ name: e.name, payloadType: 'unknown' }));
    const node = visualNuxt(visualAllocate(store, 'vn'), entry.id, Object.fromEntries(c.props.map(p => [p.name, { kind: 'prop', name: p.name }])), { name: entry.label });
    node.events = c.emits.map(e => ({ id: visualAllocate(store, 'vi'), event: e.name, label: 'Forward ' + e.name, notes: '', acceptance: '', actions: [{ kind: 'emit', event: e.name, payload: { kind: 'event' } }] }));
    c.template = [node];
  }
  store.components.push(c); return c;
}
export function visualRemoveDefinition(store, ref) {
  const def = vcmdDef(store, ref);
  if (ref.kind === 'component') { const uses = visualUsages(store, def.id).filter(u => u.definitionId !== def.id); visualAssert(!uses.length, def.exportName + ' is used by ' + uses.map(u => u.definitionName).join(', ') + '. Remove those instances first.'); store.revisions = store.revisions.filter(r => r.componentId !== def.id); }
  const key = ref.kind === 'page' ? 'pages' : ref.kind === 'component' ? 'components' : 'layouts'; store[key] = store[key].filter(d => d.id !== def.id);
}
export function visualInsert(store, ref, target, nodes) { const list = vcmdTargetList(store, vcmdDef(store, ref), target); list.splice(target.index ?? list.length, 0, ...nodes); return nodes; }
export function visualRemoveNode(store, ref, nodeId) {
  const def = vcmdDef(store, ref), hit = vcmdHit(def, nodeId), removed = new Set(visualNodes([hit.node]).map(n => n.id));
  const refs = vcmdReferences(def, removed); visualAssert(!refs.length, 'Still referenced by ' + refs.join(', ') + '. Change those first.');
  hit.list.splice(hit.index, 1);
  for (const s of def.scenarios ?? []) for (const id of Object.keys(s.values)) if (removed.has(id)) delete s.values[id];
}
export function visualMoveNode(store, ref, nodeId, direction) {
  const { list, index } = vcmdHit(vcmdDef(store, ref), nodeId), to = direction === 'earlier' ? index - 1 : index + 1;
  visualAssert(to >= 0 && to < list.length, 'The element is already ' + (direction === 'earlier' ? 'first' : 'last') + '.');
  [list[index], list[to]] = [list[to], list[index]];
}
export function visualReparent(store, ref, nodeId, target) {
  const def = vcmdDef(store, ref), hit = vcmdHit(def, nodeId);
  visualAssert(target.parentId === null || !visualLocate([hit.node], target.parentId), 'An element cannot be moved inside itself.');
  const list = vcmdTargetList(store, def, target); hit.list.splice(hit.index, 1); list.splice(target.index ?? list.length, 0, hit.node);
}
export function visualDuplicateNode(store, ref, nodeId) { const { node, list, index } = vcmdHit(vcmdDef(store, ref), nodeId); const [copy] = visualClone(store, [node]); list.splice(index + 1, 0, copy); return copy; }
export function visualWrapNode(store, ref, nodeId, tag = 'div') { const { node, list, index } = vcmdHit(vcmdDef(store, ref), nodeId); const wrap = visualElement(visualAllocate(store, 'vn'), tag, { name: 'Group', children: [node] }); list.splice(index, 1, wrap); return wrap; }
const vcmdPatchKeys = ['name', 'visibleIn', 'a11y', 'layout', 'tag', 'role', 'value', 'attrs', 'props', 'variantId', 'control', 'slots'];
export function visualUpdateNode(store, ref, nodeId, patch) {
  const { node } = vcmdHit(vcmdDef(store, ref), nodeId);
  for (const [key, value] of Object.entries(patch)) { visualAssert(vcmdPatchKeys.includes(key), 'Field ' + key + ' cannot be edited here.'); if (value === undefined) delete node[key]; else node[key] = structuredClone(value); }
  return node;
}
export function visualSetContract(store, componentId, change) {
  const c = vcmdDef(store, { kind: 'component', id: componentId }); const next = { ...c, ...structuredClone(change) };
  const broken = [];
  for (const u of visualUsages(store, componentId)) {
    const def = vcmdDef(store, { kind: u.kind, id: u.definitionId }), n = vcmdHit(def, u.nodeId).node; if (n.ref.revisionId) continue;
    for (const k of Object.keys(n.props)) if (!next.props.some(p => p.name === k)) broken.push(u.definitionName + ' / ' + (n.name ?? n.id) + ': prop ' + k);
    for (const p of next.props.filter(p => p.required)) if (!Object.hasOwn(n.props, p.name)) broken.push(u.definitionName + ' / ' + (n.name ?? n.id) + ': required prop ' + p.name);
    for (const k of Object.keys(n.slots)) if (!next.slots.some(s => s.name === k)) broken.push(u.definitionName + ' / ' + (n.name ?? n.id) + ': slot ' + k);
    for (const i of n.events) if (!next.emits.some(e => e.name === i.event) && !['click', 'focus', 'blur', 'keydown', 'change', 'input', 'submit'].includes(i.event)) broken.push(u.definitionName + ' / ' + (n.name ?? n.id) + ': event ' + i.event);
  }
  visualWalk(c.template, n => { for (const i of n.events ?? []) for (const a of i.actions) if (a.kind === 'emit' && !next.emits.some(e => e.name === a.event)) broken.push(c.exportName + ' template: emit ' + a.event); });
  visualAssert(!broken.length, 'This contract change breaks ' + broken.join('; ') + '.');
  Object.assign(c, structuredClone(change));
}
export function visualAddInteraction(store, ref, nodeId, { event, label, actions = [], notes = '', acceptance = '' }) { const { node } = vcmdHit(vcmdDef(store, ref), nodeId); visualAssert(Array.isArray(node.events), 'Text elements have no interactions.'); const i = { id: visualAllocate(store, 'vi'), event, label, actions: structuredClone(actions), notes, acceptance }; node.events.push(i); return i; }
export function visualUpdateInteraction(store, ref, nodeId, interactionId, patch) { const i = vcmdHit(vcmdDef(store, ref), nodeId).node.events?.find(x => x.id === interactionId); visualAssert(i, 'The interaction no longer exists.'); for (const [k, v] of Object.entries(patch)) { visualAssert(['event', 'label', 'actions', 'notes', 'acceptance'].includes(k), 'Field ' + k + ' cannot be edited.'); i[k] = structuredClone(v); } return i; }
export function visualRemoveInteraction(store, ref, nodeId, interactionId) { const node = vcmdHit(vcmdDef(store, ref), nodeId).node; node.events = node.events.filter(i => i.id !== interactionId); }
export function visualSetScenarios(store, ref, scenarios) { vcmdDef(store, ref).scenarios = structuredClone(scenarios); }
const vcmdSemver = v => v.split('.').map(Number);
const vcmdGreater = (a, b) => { const [x, y] = [vcmdSemver(a), vcmdSemver(b)]; for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
export function visualPublish(store, componentId, version) {
  const c = vcmdDef(store, { kind: 'component', id: componentId });
  const latest = store.revisions.filter(r => r.componentId === componentId).map(r => r.version).sort((a, b) => (vcmdGreater(a, b) ? 1 : -1)).at(-1);
  visualAssert(/^\d+\.\d+\.\d+$/.test(version) && (!latest || vcmdGreater(version, latest)), 'Version must be x.y.z and greater than ' + (latest ?? '0.0.0') + '.');
  const template = structuredClone(c.template);
  visualWalk(template, n => { if (n.kind === 'component' && n.ref.kind === 'project' && !n.ref.revisionId) { const dep = store.revisions.filter(r => r.componentId === n.ref.componentId).at(-1); visualAssert(dep, 'Publish ' + (store.components.find(x => x.id === n.ref.componentId)?.exportName ?? n.ref.componentId) + ' first.'); n.ref.revisionId = dep.id; } });
  const revision = { id: visualAllocate(store, 'vr'), componentId, version, contract: structuredClone({ props: c.props, slots: c.slots, emits: c.emits, variants: c.variants }), template };
  store.revisions.push(revision); return revision;
}
```

- [ ] **Step 5: Register** both in `.fallowrc.json`. **Run** `npm run test:visual && npm run check:source` — Expected: PASS.
- [ ] **Step 6: Commit** `git commit -m "feat(visual): add layout cloning and pure authoring commands"` (add the new files, test and `.fallowrc.json`).

---

### Task 5: Preview session, transitions and generated model tests

**Files:**
- Create: `scripts/companion/visual/visual-session.mjs`, `scripts/companion/visual/visual-session.d.mts`, `tests/tooling/visual-session.checks.mjs`
- Modify: `.fallowrc.json`

**Interfaces:**
- Produces: `visualSession(scenario?) → Session` (`{state,width,values,bindings,hidden,focused,emitted,navigation,requests}`), `visualVisible(definition, session, nodeId) → boolean`, `visualTransition(definition, session, nodeId, interactionId) → Session` (never mutates input; throws `IMPLEMENTATION_REQUIRED: <label>` for empty actions), `visualValue(session, expr, props?) → unknown`, `visualRead(value, field) → unknown`, `visualTestSource(definition) → string` (node:test source). `.d.mts` declares these with the `Session` interface.

- [ ] **Step 1: Failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { visualNodes } from '../../scripts/companion/visual/visual-ir.mjs';
import { visualSession, visualVisible, visualTransition, visualValue, visualRead, visualTestSource } from '../../scripts/companion/visual/visual-session.mjs';
const s = JSON.parse(await readFile('tests/fixtures/companion/visual-v5.json', 'utf8'));
const page = s.pages[0], byName = n => visualNodes(page.root).find(x => x.name === n);
test('visibility follows state, ancestors, toggles and narrow hiding', () => {
  const session = visualSession();
  assert.equal(visualVisible(page, session, byName('Customer table').id), true);
  assert.equal(visualVisible(page, session, byName('Empty').id), false);
  assert.equal(visualVisible(page, visualSession(page.scenarios[0]), byName('Empty').id), true);
  const hidden = { ...session, hidden: { [byName('Content').id]: true } }; assert.equal(visualVisible(page, hidden, byName('Title').id), false);
});
test('transitions apply every action in order without mutating the input', () => {
  const reset = byName('Reset'), before = visualSession({ id: 'x', name: 'x', state: 'error', width: 'wide', values: {}, bindings: [] }); const frozen = JSON.stringify(before);
  const next = visualTransition(page, before, reset.id, reset.events[0].id);
  assert.equal(next.state, 'default'); assert.equal(next.hidden[byName('Empty').id], true); assert.equal(JSON.stringify(before), frozen);
  const link = byName('Settings link'); assert.equal(visualTransition(page, visualSession(), link.id, link.events[0].id).navigation, 'node-settings');
  assert.throws(() => visualTransition(page, visualSession(), link.id, link.events[1].id), /IMPLEMENTATION_REQUIRED: Unimplemented/);
  assert.throws(() => visualTransition(page, { ...visualSession(), state: 'loading' }, link.id, link.events[0].id), /not enabled/);
  const search = byName('Customer search'); assert.deepEqual(visualTransition(page, visualSession(), search.id, search.events[0].id).requests, [{ sourceId: 'customers', operationId: 'list', interactionId: search.events[0].id }]);
});
test('values resolve literals, props, state and fixture bindings safely', () => {
  const session = visualSession(page.scenarios[0]);
  assert.deepEqual(visualValue(session, byName('Customer table').props.data), []);
  assert.equal(visualValue(session, { kind: 'prop', name: 'q' }, { q: 'x' }), 'x');
  assert.equal(visualRead({ a: { b: 1 } }, 'a.b'), 1); assert.equal(visualRead({}, '__proto__.polluted'), undefined);
});
test('generated model tests run green and count todos', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'visual-session-')); const file = join(dir, 'model.checks.mjs');
  await writeFile(file, visualTestSource(page));
  const run = spawnSync(process.execPath, ['--test', file], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr); assert.match(run.stdout, /# todo 1/); assert.match(run.stdout, /# pass [1-9]/);
});
```

- [ ] **Step 2: Run** `node --test tests/tooling/visual-session.checks.mjs` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement `visual-session.mjs`**

```js
// Deterministic preview/runtime session over one visual definition. No DOM or I/O.
import { visualAssert, visualIsPlain, visualChildLists, visualRoot, visualLocate, visualWalk } from './visual-ir.mjs';
export function visualSession(scenario = null) { return { state: scenario?.state || 'default', width: scenario?.width || 'wide', values: structuredClone(scenario?.values || {}), bindings: structuredClone(scenario?.bindings || []), hidden: {}, focused: null, emitted: [], navigation: null, requests: [] }; }
function vsesChain(root, nodeId) {
  const walk = (list, path) => { for (const n of list) { if (n.id === nodeId) return [...path, n]; for (const l of visualChildLists(n)) { const hit = walk(l, [...path, n]); if (hit) return hit; } } return null; };
  return walk(root, []);
}
export function visualVisible(definition, session, nodeId) {
  const chain = vsesChain(visualRoot(definition), nodeId); if (!chain) return false;
  return chain.every(n => session.hidden[n.id] !== true && (!n.visibleIn || n.visibleIn.includes(session.state)) && !(session.width === 'narrow' && n.layout?.ui.narrow.hidden));
}
export function visualTransition(definition, session, nodeId, interactionId) {
  const node = visualLocate(visualRoot(definition), nodeId)?.node, interaction = node?.events?.find(i => i.id === interactionId);
  visualAssert(node && interaction, 'The interaction no longer exists.');
  visualAssert(!['loading', 'disabled'].includes(session.state) && visualVisible(definition, session, nodeId), 'Interaction source is not enabled and visible.');
  if (!interaction.actions.length) throw Error('IMPLEMENTATION_REQUIRED: ' + interaction.label);
  const next = structuredClone(session);
  for (const a of interaction.actions) {
    if (a.kind === 'set-state') next.state = a.state;
    else if (a.kind === 'toggle') next.hidden[a.nodeId] = !next.hidden[a.nodeId];
    else if (a.kind === 'set-value') next.values[a.nodeId] = a.value;
    else if (a.kind === 'focus') { visualAssert(visualVisible(definition, next, a.nodeId), 'Focus target is hidden in this state.'); next.focused = a.nodeId; }
    else if (a.kind === 'navigate') next.navigation = a.surfaceId;
    else if (a.kind === 'emit') next.emitted.push({ name: a.event, source: nodeId, ...(a.payload.kind === 'value' ? { payload: a.payload.value } : {}) });
    else if (a.kind === 'source') next.requests.push({ sourceId: a.sourceId, operationId: a.operationId, interactionId });
    else visualAssert(false, 'Unsupported action.');
  }
  return next;
}
export function visualRead(value, field) {
  if (!field) return value;
  for (const key of field.split('.')) { if (['__proto__', 'constructor', 'prototype'].includes(key) || value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined; value = value[key]; }
  return value;
}
export function visualValue(session, expr, props = {}) {
  if (expr.kind === 'literal') return expr.value;
  if (expr.kind === 'prop') return Object.hasOwn(props, expr.name) ? props[expr.name] : undefined;
  if (expr.kind === 'state') return session.values[expr.nodeId];
  const fixture = session.bindings.find(b => b.sourceId === expr.sourceId && b.operationId === expr.operationId);
  return fixture ? visualRead(fixture.value, expr.field) : undefined;
}
export function visualTestSource(definition) {
  const safe = JSON.stringify(definition).replaceAll('<', '\\u003c'), cases = [], todos = [];
  visualWalk(visualRoot(definition), n => { for (const i of n.events ?? []) {
    const name = JSON.stringify('[' + i.id + '] ' + i.label);
    if (!i.actions.length) { todos.push(`test.todo(${JSON.stringify('[' + i.id + '] ' + i.label + ' — ' + (i.acceptance || i.notes || 'implementation required'))});`); continue; }
    const state = ['default', 'empty', 'error'].find(st => visualVisible(definition, { ...visualSession(), state: st }, n.id));
    cases.push(state ? `test(${name}, () => { const session = { ...visualSession(), state: ${JSON.stringify(state)} }; const before = JSON.stringify(session); const next = visualTransition(definition, session, ${JSON.stringify(n.id)}, ${JSON.stringify(i.id)}); assert.equal(JSON.stringify(session), before); assert.notEqual(JSON.stringify(next), before); });` : `test(${name}, () => { assert.fail('No enabled visible source state: repair this interaction'); });`);
  } });
  return `// Generated executable model tests. No claim of business outcomes or native UI acceptance.\nimport { test } from 'node:test';\nimport assert from 'node:assert/strict';\n${[visualAssert, visualIsPlain, visualChildLists, visualRoot, visualWalk, visualLocate, visualSession, vsesChain, visualVisible, visualTransition].map(f => f.toString()).join('\n')}\nconst definition = ${safe};\n${cases.join('\n')}\n${todos.join('\n')}\n`;
}
```
`visualLocate`/`visualWalk` stringify fine because they only reference each other and `visualChildLists`, all included. Note `visualChildLists` references `visualIsPlain`, which is why it is in the emitted list.

- [ ] **Step 4: `visual-session.d.mts`**

```ts
import type { Scenario, ValueExpression, VisualState, PageDefinition, ComponentDefinition } from './visual-ir.mjs';
export interface Session { state: VisualState; width: 'wide' | 'narrow'; values: Record<string, unknown>; bindings: Scenario['bindings']; hidden: Record<string, boolean>; focused: string | null; emitted: { name: string; source: string; payload?: unknown }[]; navigation: string | null; requests: { sourceId: string; operationId: string; interactionId: string }[] }
export function visualSession(scenario?: Scenario | null): Session;
export function visualVisible(definition: PageDefinition | ComponentDefinition, session: Session, nodeId: string): boolean;
export function visualTransition(definition: PageDefinition | ComponentDefinition, session: Session, nodeId: string, interactionId: string): Session;
export function visualRead(value: unknown, field: string): unknown;
export function visualValue(session: Session, expr: ValueExpression, props?: Record<string, unknown>): unknown;
export function visualTestSource(definition: PageDefinition | ComponentDefinition): string;
```
- [ ] **Step 5: Register, run** `npm run test:visual` — Expected: PASS.
- [ ] **Step 6: Commit** `git commit -m "feat(visual): add deterministic preview session and generated model tests"`

---

### Task 5b: Component dependencies and external nodes (spec §13)

**Files:**
- Modify: `scripts/companion/visual/visual-ir.mjs`, `visual-ir.d.mts`, `visual-validate.mjs`, `visual-commands.mjs`
- Create: `tests/tooling/visual-dependencies.checks.mjs`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: `VISUAL_DEPENDENCY_LIMIT = 8`; `visualIsPackage(value) → boolean`; `visualIsExactVersion(value) → boolean`; `visualExternal(id, packageName, adapter, extra?) → ExternalNode` (`{ id, kind:'external', package, adapter, props:{}, events:[], ...extra }`); `visualSetDependencies(store, componentId, dependencies)`; `ComponentDefinition.dependencies?: Dependency[]`, `ComponentRevision.dependencies?: Dependency[]`, `Dependency = { package: string; version: string; purpose: string }`, `ExternalNode` in the `UiNode` union (d.mts). `visualPublish` snapshots `dependencies` when present. `visualUpdateNode` accepts patch key `adapter`.

- [ ] **Step 1: Failing tests** — `tests/tooling/visual-dependencies.checks.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { visualExternal, visualLiteral, visualNodes, visualIsPackage, visualIsExactVersion } from '../../scripts/companion/visual/visual-ir.mjs';
import { validateVisualDesigns } from '../../scripts/companion/visual/visual-validate.mjs';
import { visualSetDependencies, visualPublish, visualDuplicateNode } from '../../scripts/companion/visual/visual-commands.mjs';
import { visualSession, visualTransition, visualVisible } from '../../scripts/companion/visual/visual-session.mjs';
const seed = JSON.parse(await readFile('tests/fixtures/companion/visual-v5.json', 'utf8'));
function withEditor() {
  const s = structuredClone(seed), c = s.components[0];
  c.dependencies = [{ package: '@tiptap/vue-3', version: '2.11.5', purpose: 'Rich text editing' }];
  const node = visualExternal(`vn-${s.nextId++}`, '@tiptap/vue-3', 'editor', { name: 'Editor', props: { content: { kind: 'prop', name: 'query' }, toolbar: visualLiteral(['bold', 'italic']) } });
  node.events = [{ id: `vi-${s.nextId++}`, event: 'update', label: 'Content changed', notes: '', acceptance: '', actions: [{ kind: 'emit', event: 'search', payload: { kind: 'event' } }] }];
  c.template[0].children.push(node);
  return { s, c, node };
}
test('predicates accept exact npm names and versions only', () => {
  for (const ok of ['@tiptap/vue-3', 'codemirror', 'monaco-editor', '@codemirror/lang-markdown']) assert.equal(visualIsPackage(ok), true, ok);
  for (const bad of ['Tiptap', 'github:x/y', 'https://x.y/z.tgz', '../local', '.hidden', 'a'.repeat(215), '@scope/', 'file:../x']) assert.equal(visualIsPackage(bad), false, bad);
  for (const ok of ['2.11.5', '1.0.0-beta.1']) assert.equal(visualIsExactVersion(ok), true, ok);
  for (const bad of ['^2.11.5', '~1.0.0', 'latest', '2.x', '>=1', '1.0', '']) assert.equal(visualIsExactVersion(bad), false, bad);
});
test('a wrapper component with a declared dependency and external node is valid', () => { const { s } = withEditor(); validateVisualDesigns(s); });
const rejects = [
  ['range version', ({ c }) => { c.dependencies[0].version = '^2.11.5'; }, /exact version/],
  ['git specifier', ({ c }) => { c.dependencies[0].package = 'github:ueberdosis/tiptap'; }, /npm package/],
  ['duplicate package', ({ c }) => { c.dependencies.push({ ...c.dependencies[0] }); }, /duplicate dependency/],
  ['too many dependencies', ({ c }) => { c.dependencies = Array.from({ length: 9 }, (_, i) => ({ package: 'pkg-' + i, version: '1.0.0', purpose: '' })); }, /at most 8 dependencies/],
  ['undeclared package', ({ node }) => { node.package = 'codemirror'; }, /codemirror is not a declared dependency/],
  ['bad adapter name', ({ node }) => { node.adapter = 'Editor Adapter'; }, /adapter name/],
  ['duplicate adapter', ({ c, node, s }) => { c.template[0].children.push({ ...structuredClone(node), id: `vn-${s.nextId++}`, events: [] }); }, /adapter "editor" is used twice/],
  ['external in page', ({ s, node }) => { s.pages[0].root.push({ ...structuredClone(node), id: `vn-${s.nextId++}`, events: [] }); }, /external libraries belong in component templates/],
  ['version conflict across components', ({ s, c }) => { const b = structuredClone(c); b.id = `vc-${s.nextId++}`; b.libraryId = 'library-b'; b.exportName = 'Other'; b.template = []; b.dependencies = [{ package: '@tiptap/vue-3', version: '2.10.0', purpose: '' }]; s.components.push(b); }, /@tiptap\/vue-3 is pinned to 2.11.5 in SearchField and 2.10.0 in Other/],
];
for (const [name, change, pattern] of rejects) test('rejects ' + name, () => { const ctx = withEditor(); change(ctx); assert.throws(() => validateVisualDesigns(ctx.s), pattern); });
test('removing a dependency still used by an adapter is refused; unused removal works', () => {
  const { s, c } = withEditor();
  assert.throws(() => visualSetDependencies(s, c.id, []), /Still used by adapter "editor"/);
  c.template[0].children.pop(); visualSetDependencies(s, c.id, []); assert.deepEqual(c.dependencies, []); validateVisualDesigns(s);
});
test('publish snapshots dependencies; duplicating an external node yields a duplicate adapter that validation rejects', () => {
  const { s, c, node } = withEditor();
  const r = visualPublish(s, c.id, '1.1.0'); assert.deepEqual(r.dependencies, c.dependencies);
  validateVisualDesigns(s);
  const copy = visualDuplicateNode(s, { kind: 'component', id: c.id }, node.id);
  assert.notEqual(copy.id, node.id);
  assert.throws(() => validateVisualDesigns(s), /adapter "editor" is used twice/);
});
test('external nodes participate in visibility and transitions', () => {
  const { c, node } = withEditor();
  assert.equal(visualVisible(c, visualSession(), node.id), true);
  const next = visualTransition(c, visualSession(), node.id, node.events[0].id);
  assert.deepEqual(next.emitted.map(e => e.name), ['search']);
  assert.equal(visualNodes(c.template).filter(n => n.kind === 'external').length, 1);
});
```

- [ ] **Step 2: Run** `node --test tests/tooling/visual-dependencies.checks.mjs` — Expected: FAIL (`visualExternal` not exported).

- [ ] **Step 3: `visual-ir.mjs` additions** (append; keep existing exports unchanged)

```js
export const VISUAL_DEPENDENCY_LIMIT = 8;
export function visualIsPackage(value) { return typeof value === 'string' && value.length <= 214 && /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value); }
export function visualIsExactVersion(value) { return typeof value === 'string' && value.length <= 64 && /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(value); }
export function visualExternal(id, packageName, adapter, extra = {}) { return { id, kind: 'external', package: packageName, adapter, props: {}, events: [], ...extra }; }
```

- [ ] **Step 4: `visual-validate.mjs` changes**
  - Add `vvDependencies(list, where)`: assert `Array.isArray(list) && list.length <= VISUAL_DEPENDENCY_LIMIT` (message `where + ': at most 8 dependencies.'`); each item `vvObject(d, ['package','version','purpose'])`; `visualIsPackage(d.package)` else `where + ': ' + JSON.stringify(d.package) + ' is not an npm package name (no URLs, git or file specifiers).'`; `visualIsExactVersion(d.version)` else `where + ': ' + d.package + ' needs an exact version such as 1.2.3, not ' + JSON.stringify(d.version) + '.'`; `visualIsText(d.purpose, 400)`; unique packages else `where + ': duplicate dependency ' + d.package + '.'`.
  - Components: allow optional key `dependencies` and call `vvDependencies(c.dependencies ?? [], where)`; revisions: allow optional `dependencies`, same check.
  - Store level (after components): map package → `{ version, exportName }`; on mismatch fail with `pkg + ' is pinned to ' + first.version + ' in ' + first.exportName + ' and ' + version + ' in ' + c.exportName + '.'`.
  - `vvDefinition` scope gets `dependencies` (the component/revision list, or `[]`), `external` (`true` for component and revision definitions, `false` for pages and layouts) and `adapters: new Set()`.
  - `vvNode`: keys table adds `external: ['id','kind','package','adapter','props','events']`; add the branch:

```js
  else if (node.kind === 'external') {
    visualAssert(scope.external, where + ': external libraries belong in component templates.');
    visualAssert(scope.dependencies.some(d => d.package === node.package), where + ': ' + node.package + ' is not a declared dependency of this component.');
    visualAssert(typeof node.adapter === 'string' && /^[a-z][a-z0-9-]*$/.test(node.adapter) && node.adapter.length <= 60, where + ': adapter name must be lowercase kebab-case.');
    visualAssert(!scope.adapters.has(node.adapter), where + ': adapter "' + node.adapter + '" is used twice.'); scope.adapters.add(node.adapter);
    visualAssert(visualIsPlain(node.props) && Object.keys(node.props).length <= 40, where + ': invalid props.');
    for (const [key, value] of Object.entries(node.props)) { visualAssert(visualIsKey(key), where + ': invalid prop name ' + key + '.'); vvValue(value, scope, where + ' :' + key, 'json'); }
    vvEvents(node, scope, null, where);
  }
```
  `vvValue(..., 'json')` must still accept `prop`/`state`/`source` kinds (only `literal` uses the type argument). `visualChildLists` needs no change (external has no children).

- [ ] **Step 5: `visual-commands.mjs` changes**

```js
export function visualSetDependencies(store, componentId, dependencies) {
  const c = vcmdDef(store, { kind: 'component', id: componentId });
  const used = visualNodes(c.template).filter(n => n.kind === 'external' && !dependencies.some(d => d.package === n.package));
  visualAssert(!used.length, 'Still used by adapter ' + used.map(n => JSON.stringify(n.adapter)).join(', ') + '. Remove those external elements first.');
  c.dependencies = structuredClone(dependencies);
}
```
  In `visualPublish` add `...(c.dependencies ? { dependencies: structuredClone(c.dependencies) } : {})` to the revision object. Add `'adapter'` to `vcmdPatchKeys`. `visualClone` needs no change.

- [ ] **Step 6: `visual-ir.d.mts`** — add `export interface Dependency { package: string; version: string; purpose: string }`, `export type ExternalNode = Common & { kind: 'external'; package: string; adapter: string; props: Record<string, ValueExpression>; events: Interaction[] }`, include `ExternalNode` in `UiNode`, add `dependencies?: Dependency[]` to `ComponentDefinition` and `ComponentRevision`, declare `VISUAL_DEPENDENCY_LIMIT`, `visualIsPackage`, `visualIsExactVersion`, `visualExternal`.

- [ ] **Step 7: Run** `npm run test:visual && npm run check:source` — Expected: PASS (all earlier suites unchanged).
- [ ] **Step 8: Commit** `git commit -m "feat(visual): declare component library dependencies and external adapter nodes"`

---

### Task 6: Migration from detail designs

**Files:**
- Create: `scripts/companion/visual/visual-migrate.mjs`, `tests/tooling/visual-migrate.checks.mjs`, `tests/fixtures/companion/detail-v4.json`
- Modify: `.fallowrc.json`

**Interfaces:**
- Consumes: `validateDetailDesigns` (legacy, `scripts/companion/detail-contract.mjs`), Tasks 1–5.
- Produces: `migrateDetailDesigns(detailDesigns, design) → { visualDesigns, report }` where `report = { droppedPositions, droppedSizes, droppedOutlineRefs, droppedSlotRules, listBindings, unparsedMembers: {owner, text}[], droppedProps: {owner, prop}[], createdComponents: string[] }`. Input must already pass `validateDetailDesigns`; output passes `validateVisualDesigns` (without context).

- [ ] **Step 1: Create `tests/fixtures/companion/detail-v4.json`** — take the self-project: `node -e "const p=require('./docs/concepts/companion/companion-project.json');require('fs').writeFileSync('tests/fixtures/companion/detail-v4.json',JSON.stringify(p))"`. It is the v4 envelope with 81 documents and 54 revisions (verify: `node -e "const p=require('./tests/fixtures/companion/detail-v4.json');console.log(p.schemaVersion,p.design.detailDesigns.documents.length,p.design.detailDesigns.revisions.length)"` → `4 81 54`).

- [ ] **Step 2: Failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { migrateDetailDesigns } from '../../scripts/companion/visual/visual-migrate.mjs';
import { validateVisualDesigns } from '../../scripts/companion/visual/visual-validate.mjs';
import { visualNodes } from '../../scripts/companion/visual/visual-ir.mjs';
const load = async p => JSON.parse(await readFile(p, 'utf8'));
const inputs = [['detail-v3 fixture', await load('tests/fixtures/companion/detail-v3.json')], ['self-project v4', await load('tests/fixtures/companion/detail-v4.json')]];
for (const file of (await readdir('docs/concepts/companion/starters')).filter(f => f.endsWith('.json') && f !== 'catalog.json')) inputs.push(['starter ' + file, await load('docs/concepts/companion/starters/' + file)]);
const surfaces = d => new Set(d.nodes.map(n => n.id));
for (const [name, doc] of inputs) test('migrates ' + name + ' into a valid visual store', () => {
  const detail = doc.design.detailDesigns; if (!detail) return;
  const { visualDesigns, report } = migrateDetailDesigns(structuredClone(detail), doc.design);
  validateVisualDesigns(visualDesigns, { surfaces: surfaces(doc.design), library: new Set(doc.design.library.map(l => l.id)) });
  assert.equal(visualDesigns.pages.length, detail.documents.filter(d => d.kind === 'page').length);
  assert.equal(report.droppedPositions, detail.documents.reduce((n, d) => n + d.nodes.length, 0) + (detail.revisions ?? []).reduce((n, r) => n + r.document.nodes.length, 0));
  const legacy = detail.documents.reduce((n, d) => n + d.nodes.length, 0), migrated = [...visualDesigns.pages.map(p => p.root), ...visualDesigns.components.map(c => c.template)].flatMap(visualNodes).length;
  assert.ok(migrated >= legacy, 'no element lost (list items may add nodes)');
  const edges = detail.documents.reduce((n, d) => n + d.edges.length, 0), interactions = [...visualDesigns.pages.map(p => p.root), ...visualDesigns.components.map(c => c.template)].flatMap(visualNodes).reduce((n, x) => n + (x.events?.length ?? 0), 0);
  assert.equal(interactions, edges, 'every interaction carried');
  assert.deepEqual(migrateDetailDesigns(structuredClone(detail), doc.design), { visualDesigns, report }, 'deterministic');
});
test('self-project keeps revisions, pinned instances, scenarios and acceptance text', async () => {
  const doc = inputs[1][1], { visualDesigns: v } = migrateDetailDesigns(structuredClone(doc.design.detailDesigns), doc.design);
  assert.equal(v.revisions.length, doc.design.detailDesigns.revisions.length);
  assert.ok(v.components.length >= 54);
  const all = [...v.pages.map(p => p.root), ...v.components.map(c => c.template)].flatMap(visualNodes);
  assert.ok(all.some(n => n.kind === 'component' && n.ref.revisionId));
  const acceptance = doc.design.detailDesigns.documents.flatMap(d => d.edges.map(e => e.acceptance)).filter(Boolean);
  const kept = all.flatMap(n => n.events ?? []).map(i => i.acceptance);
  for (const text of acceptance) assert.ok(kept.includes(text));
  assert.equal(v.pages.flatMap(p => p.scenarios).length + v.components.flatMap(c => c.scenarios).length, doc.design.detailDesigns.documents.flatMap(d => d.scenarios ?? []).length);
});
```

- [ ] **Step 3: Run** `node --test tests/tooling/visual-migrate.checks.mjs` — Expected: FAIL (module missing).

- [ ] **Step 4: Implement `visual-migrate.mjs`** — follow spec §2.6 exactly. Required structure:

```js
// One-way migration of detail designs (schema 1/2) to visual designs (schema 3). Only geometry is dropped, and it is counted.
import { emptyVisualDesigns, visualAllocate, visualElement, visualText, visualSlot, visualNuxt, visualProject, visualLiteral, visualLayoutRules } from './visual-ir.mjs';
import { compositionDefaultUI } from '../composition-contract.mjs';
const vmigAll = ['default', 'loading', 'empty', 'error', 'disabled'];
const vmigForbidden = ['designState', 'designScenario', 'interaction', 'ref', 'key', 'is', 'class', 'style'];
function vmigPascal(name, used) { let base = String(name).replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).map(w => w[0].toUpperCase() + w.slice(1)).join('') || 'Component'; if (!/^[A-Z]/.test(base)) base = 'C' + base; base = base.slice(0, 56); let out = base, i = 2; while (used.has(out)) out = base + i++; used.add(out); return out; }
function vmigContract(lib, report) {
  const props = [], emits = [];
  for (const [text, events] of [[lib.props, false], [lib.events, true]]) for (const line of String(text ?? '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)) {
    const m = /^([a-z][A-Za-z0-9]*):(.+)$/.exec(line);
    if (!m || vmigForbidden.includes(m[1])) { report.unparsedMembers.push({ owner: lib.id, text: line }); continue; }
    const type = m[2].trim();
    if (events) emits.push({ name: m[1], payloadType: ['void', 'string', 'number', 'boolean'].includes(type) ? type : 'unknown', ...(['void', 'string', 'number', 'boolean'].includes(type) ? {} : { description: 'Migrated from: ' + line }) });
    else if (['string', 'number', 'boolean'].includes(type)) props.push({ name: m[1], type, required: false });
    else { props.push({ name: m[1], type: 'string', required: false, description: 'Migrated from: ' + line }); report.unparsedMembers.push({ owner: lib.id, text: line }); }
  }
  const slots = String(lib.slots ?? '').split(/[\n,]/).map(s => s.trim()).filter(Boolean).filter(s => /^[a-z][A-Za-z0-9-]*$/.test(s) || (report.unparsedMembers.push({ owner: lib.id, text: s }), false)).map(name => ({ name, required: false }));
  const variants = Array.isArray(lib.variantSpecs) ? lib.variantSpecs.map(v => ({ id: v.id, name: v.name || v.id, values: Object.fromEntries(Object.entries(v.props ?? {}).filter(([k, val]) => props.some(p => p.name === k && typeof val === p.type))) })) : String(lib.variants ?? '').split(',').map(s => s.trim()).filter(Boolean).map(name => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, values: {} }));
  return { props: vmigUnique(props), slots: vmigUnique(slots), emits: vmigUnique(emits), variants: vmigUnique(variants, 'id') };
}
function vmigUnique(list, key = 'name') { const seen = new Set(); return list.filter(x => !seen.has(x[key]) && seen.add(x[key])); }
```
Then implement, in this order (write each as its own function, prefix `vmig`):
1. `vmigMapping(mapping, map)` — deep copy remapping `draft.nodeId` through `map`.
2. `vmigActions(edge, map)` — `targetSurfaceId` → `[{kind:'navigate', surfaceId}]`; `effect.type` state/toggle/value/focus/emit → `set-state{state:value}` / `toggle{nodeId:map(target)}` / `set-value{nodeId:map(target), value}` / `focus{nodeId:map(target)}` / `emit{event:value, payload: payload!==undefined ? {kind:'value', value:payload} : {kind:'none'}}`; `action.kind==='source'` → `{kind:'source', sourceId, operationId, input: vmigMapping(input)}`; `action.kind==='emit'` → `{kind:'emit', event, payload: vmigMapping(payload)}`; otherwise `[]`.
3. `vmigNode(n, ctx)` — per the table in spec §2.6. Common: `name: n.label`, `visibleIn` only when not all five states, `a11y` when non-empty. Binding → `{kind:'source', sourceId, operationId, field}` on: text/heading `value`; button `props.label`; input/number/textarea/select/checkbox `props.modelValue`; table `props.data`; alert `props.description`; list → the single `li`'s text value (`report.listBindings++`). `contentProp` on text → `{kind:'prop', name}`. `region` → `visualElement(id,'div',{layout: visualLayoutRules(n.layout, n.ui ?? compositionDefaultUI()), children})`. Inputs: `control.kind` text/date/datetime-local/number → `u-input` with `type` literal; textarea/json-file/json-editor/markdown-editor → `u-textarea`; checkbox → `u-checkbox`; select → `u-select` with `items` literal of option labels; keep `control` object as-is. Composition controls: number→`u-input type=number`, textarea→`u-textarea`, select→`u-select items=options`, checkbox→`u-checkbox label`, tabs→`u-tabs items=options`, table→`u-table columns=options.map(o=>({accessorKey:o, header:o}))`, alert→`u-alert title=label`, divider→`u-separator`, image→`img` element with `attrs.alt` literal label and `a11y` from `a11y||text`, list→`ul` with `li` per option (or one bound `li`), heading→text `h2`, slot→`visualSlot(id, n.label, {fallback: children})` (`slotCapacity`/`slotKinds` present → `report.droppedSlotRules++`), component→`visualProject(id, ctx.componentFor(n.component.id), {props: literal props filtered by contract (dropped ones → report.droppedProps), variantId (only when contract has it and it is not 'default'), ref.revisionId: ctx.revision(n.component.revisionId)})` with `slots` from `n.slots` ID lists and children carrying `slotName`. `layout` (from `ui`) also on `slot`/`component` when `n.ui` is present. Count `droppedPositions++`, `droppedSizes++` per node, `droppedOutlineRefs++` when `sourceBrickId !== null`. Attach `events` = edges with `source === n.id`, each `{id: visualAllocate(store,'vi'), event, label, notes, acceptance, actions: vmigActions(edge, map)}`.
4. `vmigTree(doc, ctx)` — pre-allocate `vn` IDs for every legacy node (document order), group children by `parentId` preserving array order, exclude nodes assigned through another node's `slots`, then convert roots.
5. `migrateDetailDesigns(detail, design)` — `store = emptyVisualDesigns()`, `report` zeros; `used = new Set()` export names; allocate `vr` IDs for legacy revisions first (`revisionMap`); determine the set of library IDs needing a component: owners of component documents ∪ instance targets (documents and revision documents) ∪ revision owners; for each (library order from `design.library`), create `{id: vc, libraryId, exportName: vmigPascal(lib.name), description: (lib.description ?? '').slice(0,2000), ...vmigContract(lib, report), template: [], scenarios: []}` and push to `report.createdComponents` when no component document exists; then convert component documents into `template`/`scenarios` (+ `notes` when non-empty), page documents into pages `{id: vp, ownerId, name: ownerLabel, root, scenarios, notes}`, and revisions into `{id, componentId, version, contract: vmigContract(r.library), template, ...(r.designSystem != null ? {designSystem: r.designSystem} : {})}`. Scenario `values` keys are remapped through the document's node map; unknown keys dropped. Return `{ visualDesigns: store, report }`.

- [ ] **Step 5: Run** `npm run test:visual` — Expected: PASS for the v3 fixture, the self-project and all eight starters. If validation fails on real data, fix the migration mapping (never loosen `validateVisualDesigns`); if a legacy value genuinely cannot be represented, add it to the report and to spec §11 via the coordinator.
- [ ] **Step 6: Commit** `git commit -m "feat(visual): migrate detail designs to visual designs with a loss report"`

---

### Task 7: Transfer format v5

**Files:**
- Modify: `scripts/companion/project-contract.mjs`, `scripts/companion/read-project.mjs`, `tests/tooling/companion-project.checks.mjs`
- Test: add cases to `tests/tooling/visual-migrate.checks.mjs`

**Interfaces:**
- Produces: `COMPANION_VERSION = 5`; `validateCompanionDocument(value)` accepts v1–v5 (v5: `design.schema === 5`, optional `design.visualDesigns` validated with context, no `detailDesigns`); `migrateCompanionDocument(value) → { document, report }` (returns a validated v5 deep copy; `report` is `null` for v5 input); `readCompanionProject` returns the migrated v5 document and exposes `migration` (report or null).

- [ ] **Step 1: Failing tests** (append to `visual-migrate.checks.mjs`)

```js
import { validateCompanionDocument, migrateCompanionDocument, parseCompanionDocument, COMPANION_VERSION } from '../../scripts/companion/project-contract.mjs';
test('v4 documents migrate to v5 and validate; v5 passes through unchanged', () => {
  const v4 = inputs[1][1]; const { document, report } = migrateCompanionDocument(structuredClone(v4));
  assert.equal(COMPANION_VERSION, 5); assert.equal(document.schemaVersion, 5); assert.equal(document.design.schema, 5);
  assert.equal('detailDesigns' in document.design, false); assert.ok(report.droppedPositions > 0);
  assert.equal(validateCompanionDocument(document), document);
  const again = migrateCompanionDocument(structuredClone(document)); assert.equal(again.report, null); assert.deepEqual(again.document, document);
});
test('hostile or inconsistent v5 imports are rejected (Review Focus 5)', () => {
  const { document } = migrateCompanionDocument(structuredClone(inputs[1][1]));
  const bad = [
    d => { d.design.detailDesigns = inputs[1][1].design.detailDesigns; },
    d => { d.design.visualDesigns.catalog.version = 2; },
    d => { d.design.visualDesigns.pages[0].root[0].kind = 'script'; },
    d => { d.schemaVersion = 6; },
    d => { d.design.schema = 4; },
  ];
  for (const change of bad) { const d = structuredClone(document); change(d); assert.throws(() => validateCompanionDocument(d)); }
  assert.throws(() => parseCompanionDocument('{"kind":"obsidian-companion-project","__proto__":{"x":1}}'));
  assert.throws(() => parseCompanionDocument('x'.repeat(5 * 1024 * 1024)), /limit/);
});
```

- [ ] **Step 2: Run** — Expected: FAIL (`migrateCompanionDocument` missing, version 4).
- [ ] **Step 3: Implement** in `project-contract.mjs`:
  - `import { validateVisualDesigns } from './visual/visual-validate.mjs';` and `import { migrateDetailDesigns } from './visual/visual-migrate.mjs';` (single-line imports).
  - `COMPANION_VERSION = 5`; add `'visualDesigns'` to `companionDesignKeys`; accepted `schemaVersion` `[1,2,3,4,5]`; `design.schema` `[1,2,3,4,5]`.
  - In `validateCompanionDesign`: when `value.visualDesigns !== undefined`, call `validateVisualDesigns(value.visualDesigns, { surfaces: new Set(value.nodes.map(n => n.id)), library: new Set(value.library.map(l => l.id)) })`.
  - In `validateCompanionDocument`: `schemaVersion >= 5` ⇒ `!Object.hasOwn(design,'detailDesigns')`; `schemaVersion < 5` ⇒ `!Object.hasOwn(design,'visualDesigns')`. Keep every existing v1–v4 rule.
  - Add:

```js
export function migrateCompanionDocument(value) {
  validateCompanionDocument(value);
  if (value.schemaVersion === COMPANION_VERSION) return { document: value, report: null };
  const document = structuredClone(value), detail = document.design.detailDesigns;
  const result = detail ? migrateDetailDesigns(detail, document.design) : null;
  delete document.design.detailDesigns;
  if (result) document.design.visualDesigns = result.visualDesigns;
  document.schemaVersion = COMPANION_VERSION; document.design.schema = COMPANION_VERSION;
  return { document: validateCompanionDocument(document), report: result?.report ?? { droppedPositions: 0, droppedSizes: 0, droppedOutlineRefs: 0, droppedSlotRules: 0, listBindings: 0, unparsedMembers: [], droppedProps: [], createdComponents: [] } };
}
```
  - `read-project.mjs`: after the existing parse/validate, replace the document with `migrateCompanionDocument(document).document` and include `migration: report` in the returned object. Read `read-project.mjs` first; keep its hashing of the original bytes unchanged (the input hash must stay the file hash).
  - Update `tests/tooling/companion-project.checks.mjs` assertions that pin `COMPANION_VERSION === 4` or expect `detailDesigns` on export to the v5 equivalents; do not delete v1–v4 import cases.
- [ ] **Step 4: Run** `npm run test:visual && node --test tests/tooling/companion-project.checks.mjs tests/tooling/companion-storymaps.checks.mjs && npm run check:source` — Expected: PASS. `companion-details`/`companion-composition` checks may now fail only where they assert the export version; update those version assertions (the suites are deleted in Task 20).
- [ ] **Step 5: Commit** `git commit -m "feat(companion): companion transfer v5 with explicit visual migration"`

**Contract freeze:** after Task 7 the coordinator records the commit SHA; Tasks 8–18 may not change `scripts/companion/visual/*` without coordinator approval.

---

### Task 8: Generated runtime for visual definitions

**Files:**
- Create: `scripts/companion/runtime/visual-runtime.ts`, `scripts/companion/runtime/use-visual.ts`
- Test: `tests/tooling/project-generator-visual.checks.mjs` (first cases)

**Interfaces:**
- Consumes: `visual-ir.d.mts`, `visual-session.d.mts`, `runtime/detail-actions.ts` (`mapDetailPayload`), `runtime/detail-controls.ts` (`parseDetailControl`, `copyDetailData`, `DetailData`), `composition-contract.mjs` (`compositionStyle`, `compositionTheme`).
- Produces:
  - `visual-runtime.ts`: `export type VisualSpec = (PageDefinition | ComponentDefinition) & { kind: 'page' | 'component' }`; `export interface VisualRequest { definitionId: string; nodeId: string; interactionId: string; event: string; values: Readonly<Record<string, DetailData>>; payload: unknown }`; `export function visualIndex(spec: VisualSpec): Map<string, UiNode>`.
  - `use-visual.ts`: `export interface VisualPort` (same shape as `DetailPort`), `export interface VisualContext { ports: VisualPort[]; navigate(target: string): void; handle(request: VisualRequest): Promise<unknown> }`, `export const visualKey`, `export function provideVisualContext(app, context)`, and `export function useVisual(spec, props, emitInteraction, emitDeclared?)` returning `{ state, visible(id), style(id), text(id), props(id), attrs(id), on(id), message, attach, theme }`.

Behavior of `useVisual` — port `use-detail.ts` (read it fully first; keep its state derivation, scenario watch, narrow observer, theme observer, pending/message handling, epoch guard and dispose logic) with these substitutions:
- `visible(id)`: `visualVisible(spec, current(), id)`.
- `style(id)`: `compositionStyle({ kind: 'region', layout: node.layout.mode, ui: node.layout.ui }, designSystem, narrow)` when the node has `layout`, else `{}`.
- `value(expr)`: `values[nodeId]` for `state`; fixture binding then live port data for `source` (same order as `bound()` today); `props[name]` for `prop`; literal value.
- `text(id)`: `detailTextValue(value(node.value), '')`.
- `props(id)`: every entry of `node.props` resolved through `value`; for control nodes also `modelValue: draft ?? resolved` and `'onUpdate:modelValue': v => setDraft(id, v)` using `parseDetailControl` when `node.control` exists; for `u-table` add `loading: state === 'loading'`; for any interactive catalog node add `disabled: ['loading','disabled'].includes(state)` unless the prop is authored.
- `attrs(id)`: resolved `node.attrs` + `'data-design-node': id`.
- `on(id)`: for each interaction → handler: if every action is local (`set-state|toggle|set-value|focus`) apply `visualTransition` to the reactive session (copy fields back) and move DOM focus via `data-design-node`; `navigate` → `context.navigate(surfaceId)`; `source` → find port, `run(mapDetailPayload(input, …))` with the same pending/error handling as today's action path; `emit` → components call `emitDeclared(event, mapped payload)`, pages record in session; empty actions → `emitInteraction(request)` then `context.handle(request)` (the generated `IMPLEMENTATION_REQUIRED` hook).

**Spec §13 amendment (external nodes):** `useVisual` also returns `external(id, createAdapter)` — a function-ref callback for the mount element: on the first element it calls `createAdapter()` once and `await adapter.mount(el, resolvedProps, (event, payload) => <run the node's interactions for event>)`; a `watch` on the resolved props calls `adapter.update(props)`; scope dispose (and element removal) calls `adapter.destroy()` exactly once; mount/update errors are caught into `message` (never thrown into Vue). Export `interface VisualExternalAdapter<P = Record<string, unknown>> { mount(el: HTMLElement, props: P, emit: (event: string, payload: unknown) => void): void | Promise<void>; update(props: P): void; destroy(): void }` from `visual-runtime.ts`. Add `'external'` to the checked surface names in the test below.

- [ ] **Step 1: Failing test** — create `tests/tooling/project-generator-visual.checks.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
test('visual runtime type-checks under the generator configuration', () => {
  const run = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--project', 'tsconfig.generator.json'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
});
test('runtime exposes the IR surface used by generated SFCs', async () => {
  const src = (await import('node:fs/promises')).readFile;
  const text = await src('scripts/companion/runtime/use-visual.ts', 'utf8');
  for (const name of ['visible', 'style', 'text', 'props', 'attrs', 'on', 'message', 'attach', 'theme', 'state']) assert.match(text, new RegExp('\\b' + name + '\\b'));
  assert.doesNotMatch(text, /\beval\b|new Function/);
});
```
- [ ] **Step 2: Run** `node --experimental-strip-types --test tests/tooling/project-generator-visual.checks.mjs` — Expected: FAIL (file missing).
- [ ] **Step 3: Implement** both files (≤ 400 code lines each) as specified.
- [ ] **Step 4: Run** the test and `npm run typecheck:generator` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(generator): add visual runtime and useVisual composable"`

---

### Task 9: Generator model for visual definitions

**Files:**
- Create: `scripts/companion/compiler/visual-model.ts`
- Modify: `scripts/companion/compiler/model.ts` (the `design.detailDesigns` capability note at line ~109 → `design.visualDesigns`)
- Test: extend `tests/tooling/project-generator-visual.checks.mjs`

**Interfaces:**
- Consumes: `Model` from `model.ts` (read it: `m.design`, `m.sourceRoot`, `m.testRoot`, `m.screens`, `m.sources`), `validateVisualDesigns`.
- Produces:
  - `visualDefinitions(m: Model): VisualDesigns` — the validated store (`emptyVisualDesigns()` when absent), validated with `{ surfaces: new Set(m.design.nodes.map(n => n.id)), library: new Set(m.design.library.map(l => l.id)), sources: new Map(m.sources.map(s => [s.id, new Set(s.operations.map(o => o.id))])) }` — adapt the field names to `Model`'s actual source/operation shape.
  - `visualSpecs(m): VisualSpec[]` — pages then components, each with `kind`.
  - `visualComponentPath(m, component)`: `${m.sourceRoot}/presentation/components/library/${component.libraryId}.vue`; `visualPagePath(m, page)`: `${m.sourceRoot}/presentation/components/details/${page.id}.vue`.
  - `visualComponentName(component): string` = `exportName`.
  - `visualNuxtImports(nodes): { name: string; path: string }[]` — for each used catalog entry: `{ name: entry.component, path: '@nuxt/ui/components/' + entry.component.slice(1) + '.vue' }`, sorted, unique.
  - `visualContractTypes(component): string` — TS source declaring `ComponentProps` (`name?: type` or required), `ComponentEvents` (`name: [payload: T]`, `void` → `[]`… keep today's `undefined` convention), `ComponentSlots` (`name?: () => unknown`).
  - `visualLibraryWithoutDefinition(m): Row[]` — library entries with no component definition (they keep today's placeholder component).
  - `visualPackages(m, frameworkDependencies: Record<string,string>): Record<string,string>` — merged exact pins from every component's `dependencies`; throws `VISUAL_INVALID: <package> is pinned to <a> by the framework and <b> by <ExportName>.` on conflict with the template's own `package.json` dependencies/devDependencies (spec §13). Add a test: a fixture component declaring `vue@3.0.0` conflicts; `@tiptap/vue-3@2.11.5` merges.

- [ ] **Step 1: Failing tests** (append)

```js
import { readFile } from 'node:fs/promises';
import { projectModel } from '../../scripts/companion/compiler/model.ts';
import { migrateCompanionDocument } from '../../scripts/companion/project-contract.mjs';
import { visualDefinitions, visualSpecs, visualNuxtImports, visualContractTypes } from '../../scripts/companion/compiler/visual-model.ts';
const self = migrateCompanionDocument(JSON.parse(await readFile('docs/concepts/companion/companion-project.json', 'utf8'))).document;
test('model exposes validated definitions and explicit Nuxt UI imports', () => {
  const m = projectModel(self), store = visualDefinitions(m);
  assert.equal(visualSpecs(m).length, store.pages.length + store.components.length);
  const imports = visualNuxtImports(store.pages.flatMap(p => p.root));
  assert.ok(imports.every(i => /^@nuxt\/ui\/components\/[A-Z][A-Za-z]+\.vue$/.test(i.path)));
  assert.match(visualContractTypes(store.components[0]), /export interface ComponentProps[\s\S]*export interface ComponentEvents[\s\S]*export interface ComponentSlots/);
});
test('invalid visual data stops generation with a named reason', () => {
  const bad = structuredClone(self); bad.design.visualDesigns.pages[0].root.push({ id: 'vn-999999', kind: 'component', ref: { kind: 'nuxt-ui', entryId: 'u-evil' }, props: {}, slots: {}, events: [] });
  assert.throws(() => visualDefinitions(projectModel(bad)), /u-evil/);
});
```
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** tests + `npm run typecheck:generator` — PASS. **Step 5: Commit** `git commit -m "feat(generator): model visual definitions, contracts and Nuxt UI imports"`

---

### Task 10: Lower IR to Vue SFCs (golden tests)

**Files:**
- Create: `scripts/companion/compiler/visual-code.ts`, `tests/fixtures/companion/visual-golden/` (expected `.vue` outputs)
- Test: extend `tests/tooling/project-generator-visual.checks.mjs`

**Interfaces:**
- Produces: `visualSfc(m, spec, store): string`.

Lowering (every node gets `data-design-node="<id>"`, `v-if="model.visible('<id>')"`, and — when it has `layout` — `:style="model.style('<id>')"`):

| IR | Output |
| --- | --- |
| `element` | `<tag v-bind="model.attrs('<id>')" v-on="model.on('<id>')">children</tag>`; `input`/`img` self-close |
| `text` | `<role>{{ model.text('<id>') }}</role>` |
| `slot` | `<slot name="<name>">fallback</slot>` (`default` → `<slot>`) |
| `component` nuxt-ui | `<UButton v-bind="model.props('<id>')" v-on="model.on('<id>')"><template #name>…</template></UButton>` with `import UButton from '@nuxt/ui/components/Button.vue'` |
| `component` project | `<ExportName v-bind="model.props('<id>')" :design-state="…" v-on="model.on('<id>')">slots</ExportName>` with typed relative import of `library/<libraryId>.vue` |
| `external` (§13) | `<div data-design-node="<id>" class="generated-external" :ref="model.external('<id>', createAdapter_<n>)" />` with `import { createAdapter as createAdapter_<n> } from './<libraryId>/<adapter>.adapter.ts'` |

Script block for a page:
```vue
<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from '../../../domain/visual/<id>.ts';
<Nuxt UI imports> <project imports>
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="<id>" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
…nodes…
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
```
Components additionally import `ComponentProps/ComponentEvents/ComponentSlots` from `domain/components/contracts/<libraryId>.ts`, use `defineProps<ComponentProps & {…}>()`, `defineEmits<ComponentEvents & {…}>()`, `defineSlots<ComponentSlots>()`, and pass the typed `emitDeclared` switch exactly like `documentCode()` in today's `detail-code.ts:33-45` (payload type guard per emit, `VISUAL_EMIT_PAYLOAD`/`VISUAL_EMIT_UNKNOWN` errors). Component definitions with an empty template produce today's placeholder component (`detail-code.ts:54-69`), unchanged except type imports.

No authored string is ever interpolated into template syntax: names and IDs are emitted only after matching `/^[A-Za-z0-9_.:-]+$/` (IDs) or `/^[A-Z][A-Za-z0-9]*$/` (export names); slot names match `/^[a-z][A-Za-z0-9-]*$/`; all text comes through `model.text()`.

Golden fixture: add one component with a declared dependency and an `external` node (adapter `editor`) so the golden files cover the external lowering.

- [ ] **Step 1: Failing golden test** (append)

```js
import { visualSfc } from '../../scripts/companion/compiler/visual-code.ts';
import { readdir, writeFile } from 'node:fs/promises';
const fixture = { ...self, design: { ...self.design, visualDesigns: JSON.parse(await readFile('tests/fixtures/companion/visual-v5.json', 'utf8')) } };
fixture.design.nodes = [...fixture.design.nodes, { id: 'node-customers', kind: 'page', label: 'Customers', parent: null }, { id: 'node-settings', kind: 'page', label: 'Settings', parent: null }];
fixture.design.library = [...fixture.design.library, { id: 'library-search', name: 'SearchField', props: 'query:string', events: 'search:string', slots: 'actions', variants: '' }];
test('SFC lowering matches reviewed golden files', async () => {
  const m = projectModel(fixture), store = visualDefinitions(m);
  for (const spec of visualSpecs(m).filter(s => ['vp', 'vc'].some(p => s.id.startsWith(p)) && (s.ownerId === 'node-customers' || s.libraryId === 'library-search'))) {
    const actual = visualSfc(m, spec, store), path = 'tests/fixtures/companion/visual-golden/' + spec.id + '.vue';
    if (process.env.UPDATE_GOLDEN) await writeFile(path, actual);
    assert.equal(actual, await readFile(path, 'utf8'), spec.id);
    assert.doesNotMatch(actual, /v-html|innerHTML|\beval\b/);
  }
});
```
(If the fixture node/library shapes above don't match `Model`'s required fields, adjust the fixture additions to the minimal valid shape `projectModel` accepts — read `model.ts`.)
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement `visual-code.ts`** (≤ 400 lines). **Step 4:** generate goldens once with `UPDATE_GOLDEN=1`, **review them by reading every line** (escaping, imports, slot templates, v-if on every node), then run without the variable — PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(generator): lower visual IR to Vue SFCs with explicit Nuxt UI imports"`

---

### Task 11: Wire visual generation into project files and retire detail compilation

**Files:**
- Create: `scripts/companion/compiler/visual-files.ts`, `visual-tests.ts`, `visual-ports.ts`
- Modify: `compiler/project-files.ts:13,61`, `compiler/host-code.ts:100-108`, `compiler/plan.ts:8,30`, `tests/tooling/project-generator*.checks.mjs`, `.fallowrc.json` (`runtime/use-detail.ts` entries → `runtime/use-visual.ts`), `.github/workflows/project-generator.yml` (test names only)
- Delete: `compiler/detail-model.ts`, `detail-code.ts`, `detail-fields.ts`, `detail-mappings.ts`, `detail-tests.ts`, `detail-runtime-tests.ts`, `detail-ports.ts`, `runtime/detail-runtime.ts`, `runtime/use-detail.ts`

**Interfaces:**
- Produces: `visualCode(templateRoot, m, add): Promise<void>` replacing `detailCode`, emitting:
  - `domain/visual/<id>.ts` (managed): `export const specification: VisualSpec = <literal>;`
  - `domain/visual-runtime.ts`, `domain/detail-actions.ts`, `domain/detail-controls.ts`, `domain/composition-contract.mjs` + `.d.mts`, `domain/visual/visual-ir.mjs` + `.d.mts`, `domain/visual/visual-session.mjs` + `.d.mts` (copied from `scripts/companion`, import paths rewritten exactly like today's `detail-code.ts:71-74` replacements).
  - `presentation/composables/use-visual.ts`.
  - Page SFCs, component SFCs, contract types; screen wrappers for pages exactly as `detail-code.ts:78-92` (import `../details/<pageId>.vue`).
  - For each interaction with empty actions: `application/interactions/<interactionId>.ts` (`NotImplementedError` hook) and `tests/acceptance/<interactionId>.test.ts` (`it.todo`), plus the dispatcher `application/visual-interactions.ts` (`handleVisualInteraction(request, sources)` switch on `interactionId`).
  - `tests/ui-effects/<id>.checks.mjs` from `visualTestSource(spec)` (managed).
  - `design/visual-traceability.json` (`{ definitions:[{id,kind,ownerId|libraryId,component}], interactions:[{definitionId,nodeId,…interaction, implementation, test, verification}], businessAcceptance:'not-implemented' }`), `verification` = `'navigation' | 'declarative-action' | 'executable-ui-effect' | 'business-todo'`.
  - `presentation/detail-layout.css` unchanged content.
  - Spec §13: the generated project's `package.json` gets `visualPackages(m, templateDeps)` merged into `dependencies` (sorted keys, exact versions); each external node emits `presentation/components/library/<libraryId>/<adapter>.adapter.ts` with ownership `'extension'` containing `import type { VisualExternalAdapter } from '<relative>/domain/visual-runtime.ts'`, `import { NotImplementedError } from '<relative>/domain/contract.ts'`, a `// Implement with: import … from '<package>'` comment, an exported `Props` interface from the node's prop names (`unknown` types), and `createAdapter()` whose three methods throw `NotImplementedError('<package> adapter <adapter>')`; plus `tests/acceptance/<libraryId>-<adapter>.adapter.test.ts` with an `it.todo` and a runtime lifecycle test (a fake adapter records mount → update → destroy and routes an emitted event to the node's interaction). `PROJECT-IMPLEMENTATION.md` lists declared packages with purpose and notes that licenses are the author's responsibility. Add assertions for these files to the Step 1 test using a migrated self-project clone with one dependency-bearing component added in-test.
  - Ports: `visualPorts(m, add)` = today's `detailPorts` with bindings collected by walking IR `source` expressions/actions; `createVisualContext(sources, pinia, openModal)`.
  - Port the assertions of `detail-tests.ts` and `detail-runtime-tests.ts` into `visual-tests.ts` (read both first; for every generated test case they emit, emit the IR equivalent: component mount per definition with each scenario, state visibility per node, control parsing, source-port loading/error/empty states, emit payload guards). List the ported case names in the commit body.
- `host-code.ts`: replace `provideDetailContext`/`createDetailContext`/`use-detail.ts` imports with the visual equivalents; keep `detail-layout.css`.
- `plan.ts`: replace `detailDocuments(model)` with `visualDefinitions(model)` (validation gate before planning) and report `definitions` instead of documents in the summary if it is shown.

- [ ] **Step 1: Failing test** (append to `project-generator-visual.checks.mjs`)

```js
import { projectFiles } from '../../scripts/companion/compiler/project-files.ts';
test('self-project generates visual files and no detail artifacts', async () => {
  const files = await projectFiles(process.cwd(), projectModel(self)); const paths = files.map(f => f.path);
  assert.ok(paths.some(p => /presentation\/components\/details\/vp-\d+\.vue$/.test(p)));
  assert.ok(paths.some(p => /domain\/visual\/vc-\d+\.ts$/.test(p)));
  assert.ok(paths.includes('design/visual-traceability.json'));
  assert.equal(paths.some(p => /use-detail\.ts$|domain\/details\/|detail-traceability/.test(p)), false);
  const sfc = files.find(f => /details\/vp-\d+\.vue$/.test(f.path)).content; assert.match(sfc, /useVisual\(spec/);
  assert.ok(files.some(f => f.path.endsWith('.vue') && /from '@nuxt\/ui\/components\/[A-Z]\w+\.vue'/.test(f.content)));
});
```
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** the files and modifications; delete the retired modules; update the older `project-generator-*.checks.mjs` so they assert the visual equivalents (same behaviors, new paths/names). Do not drop a behavior assertion without an equivalent.
- [ ] **Step 4: Verify**

```bash
npm run typecheck:generator
npm run test:generator
node --experimental-strip-types --test tests/tooling/project-generator-visual.checks.mjs
npm run check:source
```
Expected: all PASS.
- [ ] **Step 5: Real qualification of generated output** — run the same commands `project-generator.yml` runs for `qualify-project.mjs` on the self-project and `qualify-starter.mjs` for all nine starters (read the workflow for the exact invocation and environment; they install, build, type-check and test a generated workspace outside the checkout), then `qualify-styles.mjs`. Expected: every run exits 0. Record commands and results in the commit body. If a Nuxt UI component fails to build or style in the generated harness, fix lowering/imports — do not remove the catalog entry without coordinator approval.
- [ ] **Step 6: Commit** `git commit -m "feat(generator): generate visual definitions; retire detail compilation"`

---

### Task 12: Concept wiring — build, state, commit/undo and migration on load

**Files:**
- Create: `docs/concepts/companion/src/ve-state.js`
- Modify: `scripts/concepts/build-companion.py`, `.fallowrc.json`, `tests/tooling/companion-boundaries.checks.mjs` (count), `docs/concepts/companion/src/design-model.js`, `project-transfer.js`, `companion-project.js`, `state-safety.js` (only where they reference `detailDesigns`, `dtCopy`, `cpBoundHistory`, `cpRetainRevisions`)
- Test: `tests/concepts/companion-assembly.test.py` (run), new browser checks in Task 18

**Interfaces:**
- Produces (concept globals): `veUi` (session state: `{ ref: {kind,id}|null, selected: nodeId|null, left: 'outline'|'insert'|'layouts'|'structure'|'insert-child', mode: 'design'|'preview'|'review'|'compare', inspector: string, scenario: id|null, viewport: 'desktop'|'tablet'|'mobile', query: '', back: [], palette: false, error: '', notice: '' }`), `veStore(d = design())` (returns `d.visualDesigns ?? emptyVisualDesigns()`), `veCommit(change, token = smToken())` (mirrors `dtCommit` in `detail-actions.js:14-27`: guards → copy design and store → `change(store)` → `validateVisualDesigns(store, veContext(candidate))` → history snapshot → `project().design = candidate` → `saveConceptState()` or rollback → returns true), `veContext(d)`, `veTravel(direction)` (wraps the existing design history), `veReset()`, `veMigrateSaved(d)` (migrates a loaded design in place: `migrateDetailDesigns` → `visualDesigns`, delete `detailDesigns`, `history = []`, `future = []`, `veUi.notice = 'This project was upgraded to the new page and component editors. Earlier undo history was cleared.'`).

- [ ] **Step 1: Build script** — in `build-companion.py`:
  - After the detail contract block, inline in this order, stripping every line that starts with `import ` and replacing `export const `/`export function `: `visual/visual-ir.mjs`, `visual-mapping.mjs`, `visual-catalog.mjs`, `visual-composition.mjs`, `visual-validate.mjs`, `visual-layout.mjs`, `visual-commands.mjs`, `visual-session.mjs`, `visual-migrate.mjs`, each required to be in `config['entry']` (raise `ValueError('Visual contract missing from analyzer inventory: ' + path)` otherwise). They must precede `project-contract.mjs` in `shared`; also strip its two new `import` lines.
  - Add `ve-state.js` to `modules` (before `project-transfer.js`) and `ve.css` placeholder later (Task 13). Keep old modules until Task 20.
- [ ] **Step 2: Implement `ve-state.js`** (≤ 400 lines) with the interfaces above. `veCommit` computes `semantic` change as `JSON.stringify(before) !== JSON.stringify(store)` and increments `revision` only then; `designSnapshot` in `design-model.js` must include `visualDesigns` (add `...(d.visualDesigns?{visualDesigns:d.visualDesigns}:{})`) and `designHistory` must restore/retain `visualDesigns` the way it treats `detailDesigns` today (keep `nextId` monotonic: `restored.nextId = Math.max(restored.nextId, current.nextId)`).
- [ ] **Step 3: Load/import paths** — where the concept loads saved state (find the `validSavedDesign(p.design)` call sites and the startup restore in `state-safety.js`), call `veMigrateSaved(p.design)` when `p.design.detailDesigns` exists, then `saveConceptState()`. In `project-transfer.js` import: run `migrateCompanionDocument` on the parsed candidate before review; show the report in the review card (“N canvas positions dropped; M members could not be typed …”) and keep the replace-confirmation checkbox; export uses `COMPANION_VERSION` 5. In the blueprint import (`design-model.js` allowed keys), accept `visualDesigns` and migrate `detailDesigns` the same way.
- [ ] **Step 4: Inventory** — add `docs/concepts/companion/src/ve-state.js` to `.fallowrc.json` entry; update the count in `companion-boundaries.checks.mjs:72` to the new exact number (count entries, don't guess).
- [ ] **Step 5: Verify**

```bash
python3 scripts/concepts/build-companion.py
python3 scripts/concepts/build-companion.py --check
python3 -B tests/concepts/companion-assembly.test.py
node --test tests/tooling/companion-boundaries.checks.mjs tests/tooling/companion-project.checks.mjs
for f in docs/concepts/companion/src/*.js; do node --check "$f"; done
```
Expected: all pass; `index.html` rebuilt.
- [ ] **Step 6: Commit** (include `index.html`) `git commit -m "feat(concept): inline visual contract and migrate saved designs on load"`

---

### Task 13: Canvas renderer and visual language

**Files:** Create `src/ve-canvas.js`, `src/ve.css`; modify `build-companion.py` (`modules`, `styles`), `.fallowrc.json`, boundary count.

**Interfaces:**
- Produces: `veCanvasHtml(definition, session, { mode, selected, viewport, props })` → HTML string. Every node renders with `data-ve-node="<id>"`, `data-action="ve-select"`, `data-value="<id>"`, `tabindex="-1"`, `aria-selected` on the selected one; hidden nodes (per `visualVisible`) are omitted in preview and rendered dimmed with a “hidden in <state>” badge in design mode. Catalog previews by `entry.preview` (`button`, `input`, `textarea`, `select`, `checkbox`, `switch`, `table`, `card`, `badge`, `avatar`, `tabs`, `breadcrumb`, `menu`, `overlay`, `alert`, `progress`, `skeleton`, `separator`, `form`, `field`) — static, inert HTML styled like Nuxt UI (rounded, primary accent, neutral borders) using `esc()` for every value. Table rows come only from `visualValue(session, props.data)`; with no data show the table header and an “No rows in this scenario” line. Layout rules → inline style via `compositionStyle({kind:'region', layout: node.layout.mode, ui: node.layout.ui}, design().designSystem, viewport === 'mobile')` serialized with the existing concept helper (search `styleText`/`cssText` usage in `detail-preview.js` and reuse it).
- External nodes (§13) render a dashed placeholder `External · <package>@<version> · adapter <name>` listing prop names; the package is never loaded.
- `ve.css`: tokens on the concept’s existing variables (`--background-primary`, `--interactive-accent`, etc.; check `workbench.css`), three-pane grid `.ve-editor { display:grid; grid-template-columns: 260px minmax(0,1fr) 320px }`, collapsing to one column under 900px with pane tabs; canvas stage with dotted background; viewport widths desktop `max-width:1180px`, tablet `820px`, mobile `390px`; selection ring `outline: 2px solid var(--interactive-accent)` plus a label chip (not colour only); dark/light via the concept’s `data-theme`.

- [ ] **Step 1: Failing assembly test** — add this method to `AssemblyContract` in `tests/concepts/companion-assembly.test.py`:

```python
    def test_visual_editor_modules_are_assembled(self):
        html = (ROOT / 'docs/concepts/companion/index.html').read_text(encoding='utf-8')
        markers = ['function veCommit(', 'function veMigrateSaved(', 'function validateVisualDesigns(']
        markers += ['function veCanvasHtml(', '.ve-editor']
        for marker in markers:
            self.assertIn(marker, html, marker)
```
Run `python3 -B tests/concepts/companion-assembly.test.py` → FAIL (`veCanvasHtml` missing).
- [ ] **Step 2: Implement** `ve-canvas.js` and `ve.css` (≤ 400 code lines each); add `ve-canvas.js` to `modules` and `ve.css` to `styles` in `build-companion.py`; add both to `.fallowrc.json`; update the exact count in `companion-boundaries.checks.mjs`.
- [ ] **Step 3: Verify**

```bash
python3 scripts/concepts/build-companion.py
python3 scripts/concepts/build-companion.py --check
python3 -B tests/concepts/companion-assembly.test.py
node --test tests/tooling/companion-boundaries.checks.mjs
```
Expected: PASS.
- [ ] **Step 4: Commit** (include `index.html`) `git commit -m "feat(concept): render visual IR with a Nuxt UI-styled canvas"`

---

### Task 14: Page editor shell — outline, insert, layouts

**Files:** Create `src/ve-page-views.js`, `src/ve-outline.js`, `src/ve-insert.js`, `src/ve-layouts.js`; register in build/fallow/count.

**Interfaces:**
- Produces: `vePagesView()` (Pages list: every sitemap page/modal/settings surface with “Design page” / “Open” and page count), `vePageEditorView()` (three panes), `veOutlineHtml(definition)` (nested `role="tree"` list; each item `role="treeitem"`, `aria-level`, `data-action="ve-select"`, move earlier/later buttons, filter by `veUi.query`), `veInsertHtml(kind)` (tabs Patterns/Components/Project; each item has “Insert” `data-action="ve-insert"` `data-value="recipe:<id>" | "nuxt:<id>" | "project:<componentId>"`, and for primitives “Customize as component” `data-action="ve-customize"`), `veLayoutsHtml()` (built-in + saved; `data-action="ve-apply-layout"`, “Save page as layout” / “Save selection as layout” → `showModal('ve-save-layout')`).
- Top bar of the canvas: mode buttons (`ve-mode` design/preview/review), scenario select (`data-field="ve-scenario"`), viewport buttons (`ve-viewport`), selection toolbar over the selected node (`ve-insert-after`, `ve-duplicate`, `ve-wrap`, `ve-bind`, `ve-interaction`, `ve-more`), breadcrumb footer (`Page › … › <selected>`) and readiness (“Generator ready” when `validateVisualDesigns` + `veReviewFindings()` has no errors).
- Insert target rule: selected element that can contain children → append inside; selected leaf → insert after; nothing selected → append to root.

- [ ] **Step 1: Failing assembly assertion** — append the markers to `test_visual_editor_modules_are_assembled` in `tests/concepts/companion-assembly.test.py` (the method is created in Task 13):

```python
        markers += ['function vePagesView(', 'function vePageEditorView(', 'function veOutlineHtml(', 'function veInsertHtml(', 'function veLayoutsHtml(', 'role="tree"']
```
Run `python3 -B tests/concepts/companion-assembly.test.py` → FAIL (markers missing).
- [ ] **Step 2: Implement** the modules (each ≤ 400 code lines), add them to `modules`/`styles` in `build-companion.py`, to `.fallowrc.json` `entry`, and update the exact count in `companion-boundaries.checks.mjs`.
- [ ] **Step 3: Verify**

```bash
python3 scripts/concepts/build-companion.py
python3 scripts/concepts/build-companion.py --check
python3 -B tests/concepts/companion-assembly.test.py
node --test tests/tooling/companion-boundaries.checks.mjs
for f in docs/concepts/companion/src/*.js; do node --check "$f"; done
```
Expected: all PASS. Then open `index.html` in the browser pane (or run the Task 18 suite if it exists) and exercise the new UI once manually; note what was exercised in the commit body.
- [ ] **Step 4: Commit** (include `index.html`) `git commit -m "feat(concept): page editor outline, insert and layout panes"`

---

### Task 15: Page inspector, interactions, review, health

**Files:** Create `src/ve-page-inspector.js`, `src/ve-interactions.js`, `src/ve-review.js`, `src/ve-fields.js`; register.

**Interfaces:**
- `vePageInspectorHtml(definition, node)` — tabs Essentials | Data | Actions (`data-action="ve-inspector"`). Essentials: name, catalog-schema props form (one field per catalog prop; enums as `<select>`, booleans as checkbox, strings/numbers as inputs, arrays/objects as JSON textarea with parse error inline), layout (mode + gap/padding/columns; Advanced `<details>` for width, overflow, narrow override, tokens), visibility checkboxes per state, a11y notes. Data: per prop a “binding kind” select (Literal / Source / Form value) and, for Source, source → operation → field selects populated from `design().dataSources`. Actions: interaction list with add/edit/remove; the action builder (`veInteractionForm`, modal `ve-interaction`) lets the author pick event (catalog emits + DOM events), label, ordered actions (each kind with its own fields: target element select for toggle/focus/set-value, surface select for navigate, state select, source + operation + payload mapping for source, event + payload for emit), notes and Given/When/Then acceptance.
- `veFieldEdit(el)` — handles every `data-field="ve-*"` input; converts values and calls the matching command inside `veCommit`; returns `true` when handled (hooked into the same place as `editDetailField`).
- `veReviewFindings(store, ref) → {severity:'error'|'warning'|'info', text, nodeId}[]` — errors from `validateVisualDesigns` (caught message), warnings: interactions with empty actions (“Implementation required”), controls without label/a11y, tables without data binding or empty-state sibling, images without alt; info: nodes hidden in every scenario. Each finding renders as a button `data-action="ve-select"` with icon and text.
- `veHealthHtml()` — slideover listing: schema v5, catalog v1 pinned, page references, layouts, component contracts, component graph (cycles), scenarios; each pass/warn with detail text; “Inspect project JSON” opens the existing export preview.

- [ ] **Step 1: Failing assembly assertion** — append the markers to `test_visual_editor_modules_are_assembled` in `tests/concepts/companion-assembly.test.py` (the method is created in Task 13):

```python
        markers += ['function vePageInspectorHtml(', 'function veInteractionForm(', 'function veFieldEdit(', 'function veReviewFindings(', 'function veHealthHtml(']
```
Run `python3 -B tests/concepts/companion-assembly.test.py` → FAIL (markers missing).
- [ ] **Step 2: Implement** the modules (each ≤ 400 code lines), add them to `modules`/`styles` in `build-companion.py`, to `.fallowrc.json` `entry`, and update the exact count in `companion-boundaries.checks.mjs`.
- [ ] **Step 3: Verify**

```bash
python3 scripts/concepts/build-companion.py
python3 scripts/concepts/build-companion.py --check
python3 -B tests/concepts/companion-assembly.test.py
node --test tests/tooling/companion-boundaries.checks.mjs
for f in docs/concepts/companion/src/*.js; do node --check "$f"; done
```
Expected: all PASS. Then open `index.html` in the browser pane (or run the Task 18 suite if it exists) and exercise the new UI once manually; note what was exercised in the commit body.
- [ ] **Step 4: Commit** (include `index.html`) `git commit -m "feat(concept): page inspector, interaction builder and review findings"`

---

### Task 16: Component editor

**Files:** Create `src/ve-component-views.js`, `src/ve-contract.js`, `src/ve-child-inspector.js`, `src/ve-publish.js`; register.

**Interfaces:**
- `veComponentEditorView()` — left: Structure (`veOutlineHtml(component)`) | Insert child (`veInsertHtml('component')` with Project tab excluding the component itself and any component for which `visualWouldCycle(store, component.id, candidate)` is true — shown disabled with reason “Would create a cycle”), Basic tab (semantic elements `div section header main span p h2` and “Public slot”), bottom buttons Dependency graph (`ve-deps` modal listing dependencies and usages from `visualUsages`) and Publish revision (`ve-publish` modal: version input prefilled with next patch, list of usages affected, confirmation checkbox). Canvas modes Design / Preview / Compare / Review; variant select (`ve-variant`) and state select; Compare renders each variant × state in a grid.
- `veContractHtml(component)` — root selected: Contract tab (export name, description, Props/Slots/Emits sub-tabs with add/edit/remove rows; prop row = name, type, required, default, description; changes go through `visualSetContract` so breaking edits show the command's message in the inspector error region), Design tab (implementation primitive read-only + defaults), Events tab (template interactions whose actions emit).
- Dependencies (§13): the root inspector gains a **Dependencies** tab (`data-action="ve-dependency-add"` / `"ve-dependency-remove"`, fields package/version/purpose; invalid names or ranges show the validator message inline; removing a used package shows the command's refusal). Insert child gains **External library** (`data-action="ve-insert" data-value="external:<package>"`, then an adapter-name prompt), disabled with reason “Declare a dependency first” when none exist. Review lists an info finding “Adapter <name> must be implemented in code” per external node.
- `veChildInspectorHtml(component, node)` — child selected: Props (per declared prop: Literal / Parent prop / Form value + value input), Slots (declared slots with content count and “Map slot content” → sets insert target to that slot), Events (per declared emit + DOM events: map to “Emit parent event” with payload `event` or to a local action) and “Open definition” (`ve-open-definition`, pushes Back entry).

- [ ] **Step 1: Failing assembly assertion** — append the markers to `test_visual_editor_modules_are_assembled` in `tests/concepts/companion-assembly.test.py` (the method is created in Task 13):

```python
        markers += ['function veComponentEditorView(', 'function veContractHtml(', 'function veChildInspectorHtml(', 'Would create a cycle']
```
Run `python3 -B tests/concepts/companion-assembly.test.py` → FAIL (markers missing).
- [ ] **Step 2: Implement** the modules (each ≤ 400 code lines), add them to `modules`/`styles` in `build-companion.py`, to `.fallowrc.json` `entry`, and update the exact count in `companion-boundaries.checks.mjs`.
- [ ] **Step 3: Verify**

```bash
python3 scripts/concepts/build-companion.py
python3 scripts/concepts/build-companion.py --check
python3 -B tests/concepts/companion-assembly.test.py
node --test tests/tooling/companion-boundaries.checks.mjs
for f in docs/concepts/companion/src/*.js; do node --check "$f"; done
```
Expected: all PASS. Then open `index.html` in the browser pane (or run the Task 18 suite if it exists) and exercise the new UI once manually; note what was exercised in the commit body.
- [ ] **Step 4: Commit** (include `index.html`) `git commit -m "feat(concept): component editor with typed contracts, child composition and publishing"`

---

### Task 17: Actions dispatcher, keyboard, palette and entry points

**Files:** Create `src/ve-actions.js`, `src/ve-entry.js`; modify `build-companion.py` seams; modify `component-views.js:13`, `storymap-views.js:65,109`, `workflow-model.js:24`, `workflow-views.js:40`, `companion-project.js:34-35,62`, `product-actions.js`, `interaction-polish.js:6,17`, `canvas-model.js:95`.

**Interfaces:**
- `handleVisualAction(action, value) → boolean` handles every `ve-*` action named in Tasks 14–16 plus `ve-open-page` (value = surface id; creates the page via `visualCreatePage` on “Start design”, never on mere open), `ve-open-component` (value = library id; creates the component definition on “Start design”), `ve-back`, `ve-undo`, `ve-redo`, `ve-delete` (confirmation modal describing consequences), `ve-move` (`earlier|later`), `ve-reparent` (opens “Move to…” picker listing valid containers), `ve-save-layout`, `ve-apply-layout`, `ve-customize`, `ve-publish`, `ve-health`. Every write goes through `veCommit`; errors go to `veUi.error` and the inspector's `role="alert"` region, never a thrown exception.
- Keyboard (`ve-entry.js`, listener on the editor root): `ArrowUp/ArrowDown` move selection in outline order, `ArrowLeft/Right` parent/first child, `Alt+ArrowUp/Down` move earlier/later, `Delete` opens delete confirmation, `Ctrl/Cmd+D` duplicate, `Ctrl/Cmd+Z`/`Shift+Z` undo/redo, `Escape` clears selection; focus returns to the originating control after dialogs and palette actions (reuse `captureUiFocus`/`restoreUiFocus`).
- Palette: extend `paletteResults` with editor commands when an editor is open (Insert data table / form / modal, Save page as layout, Apply layout…, Preview page, Duplicate selected, Bind data…, Add interaction…).
- Build seams: `views` map `pages: vePagesView, 'page-editor': vePageEditorView, 'component-editor': veComponentEditorView`; dispatch `if(handleVisualAction(action,value)||handleStorymapAction(...))`; field `if(veFieldEdit(el)||editStorymapField(el)||...)`; modal factories `'ve-save-layout'`, `'ve-interaction'`, `'ve-publish'`, `'ve-deps'`, `'ve-delete'`, `'ve-reparent'`, `'ve-health'`; modal class toggle `'ve-modal'` for those; render hooks drop `dtDestroy()/dtMount()` for the visual editors (no Vue Flow).
- Entry rewiring: component library “Open component editor” → `ve-open-component`; storymap “Design page” → `ve-open-page` with Back entry `{view:'storymaps', map, item}`; sitemap inspector “Open page editor” → `ve-open-page`; Back restores origin view and selection.

- [ ] **Step 1: Failing assembly assertion** — append the markers to `test_visual_editor_modules_are_assembled` in `tests/concepts/companion-assembly.test.py` (the method is created in Task 13):

```python
        markers += ['function handleVisualAction(', 'if(handleVisualAction(action,value)', 'veFieldEdit(el)||', 'pages:vePagesView', "'page-editor':vePageEditorView"]
```
Run `python3 -B tests/concepts/companion-assembly.test.py` → FAIL (markers missing).
- [ ] **Step 2: Implement** the modules (each ≤ 400 code lines), add them to `modules`/`styles` in `build-companion.py`, to `.fallowrc.json` `entry`, and update the exact count in `companion-boundaries.checks.mjs`.
- [ ] **Step 3: Verify**

```bash
python3 scripts/concepts/build-companion.py
python3 scripts/concepts/build-companion.py --check
python3 -B tests/concepts/companion-assembly.test.py
node --test tests/tooling/companion-boundaries.checks.mjs
for f in docs/concepts/companion/src/*.js; do node --check "$f"; done
```
Expected: all PASS. Then open `index.html` in the browser pane (or run the Task 18 suite if it exists) and exercise the new UI once manually; note what was exercised in the commit body.
- [ ] **Step 4: Commit** (include `index.html`) `git commit -m "feat(concept): visual editor actions, keyboard paths and entry points"`

---

### Task 18: Browser qualification for the visual editors

**Files:** Create `tests/concepts/companion-visual-editors.browser.py`; modify `scripts/concepts/run-browser-checks.py` (`SUITES` add `('visual-editors','visual-editors/checks.json')`, timeout 300), `.github/workflows/companion-concept-verification.yml` (add `npm run test:visual` to the node checks step).

Use the structure of `tests/concepts/companion-details.browser.py:1-45` (same `check()`, `js()`, `act()` helpers, localStorage shim, no network requests allowed, console errors fail). Write to `reports/concepts/visual-editors/checks.json`. Required named checks (each a `check('<name>', …)` with a canonical-model readback through `js('veStore()')` or `js('project().design')`):

1. `legacy v3 import migrates with report` — import `tests/fixtures/companion/detail-v3.json`, review shows “canvas positions dropped”, confirm, `design().visualDesigns.schema === 3`, no `detailDesigns`.
2. `legacy saved state migrates and clears history` (Review Focus 1) — seed localStorage with a v4 saved state that has `detailDesigns` and non-empty `history`, reload, notice visible, `history.length === 0`, undo button disabled, `detailDesigns` absent after undo attempt.
3. `pages list opens editor; open without start does not write` — revision unchanged after open.
4. `start design creates exactly one page`.
5. `insert recipe CRUD list appears in outline and canvas in reading order`.
6. `apply built-in layout twice keeps unique ids` (Review Focus 4) — unique IDs across page.
7. `inspector edits a catalog prop and canvas updates`; `enum prop uses select`.
8. `bind table data to source operation` — `props.data.kind === 'source'`.
9. `add interaction navigate with acceptance`; `empty-action interaction shows implementation-required finding`.
10. `scenario switch hides and shows state-bound nodes in preview`.
11. `keyboard only: select, move earlier, duplicate, delete with confirmation, undo, redo` — no mouse for this check (`page.keyboard`).
12. `move to picker reparents without drag`.
13. `save page as layout then apply to another page`.
14. `component editor: customize UButton as component, add prop, add slot, add emit`.
15. `child composition: insert project component, map prop to parent prop, map event to emit`.
16. `cycle is refused in insert child` — candidate disabled with reason; forced command via `js` returns error message, store unchanged.
17. `contract edit that breaks an instance is refused with instance name` (Review Focus 3).
18. `delete used component refused with usages` (Review Focus 2).
19. `publish revision pins version; usages listed before confirm`.
20. `back from storymap returns to originating story`; `back from library returns to library`.
21. `health slideover lists all passing checks for the self-project`.
22. `hostile v5 import rejected, project unchanged` (Review Focus 5) — catalog version 2 file.
23. `narrow viewport (390px) editor usable without horizontal page scroll`.
24. `no network requests, no console errors`.
25. `component dependency: declare @tiptap/vue-3@2.11.5, insert external editor node, range version rejected inline, removing the used dependency refused` (spec §13).

- [ ] **Step 1:** Write the suite with all named checks.
- [ ] **Step 2:** Run `python3 tests/concepts/companion-visual-editors.browser.py` (needs `CHROMIUM_EXECUTABLE`; on Windows set it to the local Chromium/Chrome path) — Expected: every named check `passed`, zero console errors, zero requests.
- [ ] **Step 3:** Run `python3 scripts/concepts/run-browser-checks.py` — the legacy `details`, `detail-polish` and `composition` suites may fail until Task 20; record exactly which checks fail and why in the commit body. Any other suite failing is a regression to fix now.
- [ ] **Step 4: Commit** `git commit -m "test(concept): qualify visual editors end to end in the browser"`

---

### Task 19: Migrate starters, self-project and seeds

**Files:** Modify all `docs/concepts/companion/starters/*.json` (non-blank ones), `starters/catalog.json` (SHA-256 per file), create `docs/concepts/companion/seeds/visual-self-project.json`, modify `companion-project.js:76,81` (replace `companionExampleDetails(d,surfaces)` + `cpCompleteSelfProject(d,surfaces)` by loading the embedded seed), `build-companion.py` (embed the seed as `<script type="application/json" id="companion-visual-seed">`, hash-pinned like starters), `scripts/concepts/export-companion-project.py` (if it references legacy seed functions), `companion-project.json` (regenerated), `tests/tooling/project-starters.checks.mjs`, `tests/tooling/companion-project.checks.mjs`.

- [ ] **Step 1:** Generate migrated starters with a one-off script (not committed): for each starter JSON run `migrateCompanionDocument(JSON.parse(text)).document` and write it back with the file's existing formatting (`JSON.stringify(doc, null, 2) + '\n'`, LF). Update each `sha256` and byte size in `catalog.json` (`node -e "…createHash('sha256')…"`).
- [ ] **Step 2:** Also make `tests/concepts/companion-assembly.test.py` `setUp` copy `docs/concepts/companion/seeds` like it copies `starters`. Produce `seeds/visual-self-project.json` = `migrateDetailDesigns(selfProject.design.detailDesigns, selfProject.design).visualDesigns` from the current `companion-project.json` (before regeneration). Replace the two seed calls with `d.visualDesigns = structuredClone(JSON.parse(document.getElementById('companion-visual-seed').textContent))` guarded by `validateVisualDesigns(..., veContext(d))`.
- [ ] **Step 3:** Rebuild concept, then `python3 scripts/concepts/export-companion-project.py` and `--check`; confirm `companion-project.json` is `schemaVersion` 5 with 27 pages and the same component/revision counts as the migration test.
- [ ] **Step 4:** Update starter and project checks to expect v5/`visualDesigns` (counts per starter: pages = previous page-document count). Run:

```bash
node --test tests/tooling/project-starters.checks.mjs tests/tooling/companion-project.checks.mjs
npm run test:visual
python3 scripts/concepts/build-companion.py --check
```
Expected: PASS.
- [ ] **Step 5:** Commit `feat(companion): migrate starters and the self-project to visual designs`.

---

### Task 20: Remove legacy editors and rewire shared modules

**Files:** Delete the concept/compiler/test files listed under “Delete” in the File Map; modify `build-companion.py` (remove legacy modules, styles, `#dt-flow` CSS scope, `detail-form`/`composition-form` factories and class toggles), `.fallowrc.json` (remove entries), boundary count, `design-model.js` (drop `dtShape`, `dtIssues`, `dtCopy`, `cpBoundHistory`, `cpRetainRevisions`, `detailDesigns` keys — replace with `visualDesigns` equivalents from `ve-state.js`), `storymap-actions.js:20,52-54` (use `veCommit`-compatible persistence; revision retention no longer applies), `canvas-model.js:95` (`generationSnapshot` uses `visualDesigns`), `project-transfer.js` (`dtReset` → `veReset`), `interaction-polish.js:6,17` (`dtUi.form` → `veUi`), `component-views.js`/`product-actions.js` (`dtComponentUses` → `visualUsages`), `workflow-model.js`, `workflow-views.js`, `companion-storage.browser.py:102`, `companion-storymap-polish.browser.py`, `companion-generator-boundaries.browser.py`, `run-browser-checks.py` (remove `details`, `detail-polish`, `composition` suites), `.github/workflows/companion-concept-verification.yml` (node checks list).

- [ ] **Step 1:** `git grep -nE "\bdt[A-Z]\w*|\bcp[A-Z]\w*|detailDesigns|detail-document|dt-page|dt-component|#dt-flow|detail-form|composition-form" -- docs/concepts/companion/src scripts tests .github` — list every hit; each must be removed or rewired. Legacy contract files and `tests/fixtures/companion/detail-v3.json` stay.
- [ ] **Step 2:** Delete files, rewire, rebuild.
- [ ] **Step 3: Verify**

```bash
python3 scripts/concepts/build-companion.py && python3 scripts/concepts/build-companion.py --check
python3 -B tests/concepts/companion-assembly.test.py
for f in docs/concepts/companion/src/*.js; do node --check "$f"; done
node --test tests/tooling/test-data-*.checks.mjs tests/tooling/companion-project.checks.mjs tests/tooling/companion-storymaps.checks.mjs tests/tooling/companion-boundaries.checks.mjs
npm run test:visual && npm run test:generator && npm run typecheck:generator
python3 scripts/concepts/run-browser-checks.py --real-storage
git grep -nE "\bdt[A-Z]\w*\(|detailDesigns" -- docs/concepts/companion/src scripts/companion/compiler scripts/companion/runtime
```
Expected: all pass; the final grep prints nothing (legacy contract files are outside these paths).
- [ ] **Step 4:** Commit `refactor(concept): remove legacy detail and composition editors`.

---

### Task 21: Documentation, full verification and PR update

**Files:** Create `docs/concepts/companion/VISUAL-EDITORS.md`, `VISUAL-EDITORS-VERIFICATION.md`, `docs/concepts/companion/handoff/visual-editors/` (copy of the handoff ZIP contents: docs, `app/` reference sources renamed `*.ts.txt`/`*.vue.txt` so no analyzer or build picks them up, `prototype/visual-editors.html.txt`); modify `DETAIL-EDITORS*.md`, `COMPOSITION*.md` (first line: “Historical — superseded by VISUAL-EDITORS.md”), `PROJECT-JSON.md` (v5 section), `README.md` in `docs/concepts/companion`, `AGENTS.md` only if it names detail editors.

- [ ] **Step 1:** Write `VISUAL-EDITORS.md`: purpose, three-pane grammar, entry points, IR summary (link the spec), migration and what is dropped, keyboard map, limits, non-goals, and “Try it” steps using the self-project.
- [ ] **Step 2:** Run the full gate and record exact output summaries in `VISUAL-EDITORS-VERIFICATION.md` (command, exit code, pass/todo counts, `index.html` bytes + SHA-256, `companion-project.json` SHA-256, untested scope: physical touch/pen, screen readers, formal WCAG, native companion):

```bash
npm run verify
npm run test:visual
npm run test:generator
python3 scripts/concepts/run-browser-checks.py --real-storage
```
plus the `qualify-project`/`qualify-starter` ×9/`qualify-styles` runs from Task 11 Step 5.
- [ ] **Step 3:** Commit `docs(companion): document visual editors and record verification`.
- [ ] **Step 4:** Coordinator only, after the owner approves pushing: push `feat/pr5-visual-editors` and fast-forward/merge into `docs/companion-plugin-prd` as the owner directs; update PR #5's description (new head SHA, visual editors section replacing “Dedicated editors retained”, verification table, remaining gates). No force push.
