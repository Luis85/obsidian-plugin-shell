# Visual Page and Component editors — design

Date: 2026-09-26. Target: PR #5 (`docs/companion-plugin-prd`). Status: approved design, pending plan.

## 1. Intent

Substitute the companion concept's existing Page and Component detail editors
(Vue Flow free-geometry canvases over `design.detailDesigns`) with the
"Companion Visual Editors" implementation handoff (`visual-editors-page-editor-polished`,
supplied as a ZIP). The substitution is **full**: new editor UX *and* the handoff's
declarative UI IR as the canonical page/component data model, with the PR #21
generator, starters, self-project and tests moved to that model.

Decisions taken with the owner:

| Question | Decision |
| --- | --- |
| Depth | Full: new UI + new IR model |
| Rendering | Concept stack (offline single HTML, runtime-only Vue, strict CSP, Python build) with a Nuxt UI look; real Nuxt UI only in generated projects |
| Capabilities outside the handoff IR | Extend the IR with typed kinds; drop only free x/y geometry |
| Structure | Single cutover through a shared framework-free IR contract (approach A) |

### Success criteria

The handoff's Definition of Done, scoped to this repository:

1. Complete project JSON round-trip is lossless (v5 → v5).
2. Schema migration v3/v4 → v5 is explicit, tested and reports its only loss (geometry).
3. Invalid references/contracts cannot save, export or generate.
4. Undo/redo covers every authoring write.
5. Layout instantiation generates fresh structural IDs and preserves component IDs.
6. Component cycles are rejected before commit.
7. Generator output builds and type-checks (`qualify-project`, all nine `qualify-starter` runs).
8. Nuxt UI catalog version is pinned and matches the generated `@nuxt/ui` version.
9. Page/component scenarios render deterministically.
10. Keyboard alternatives exist for every pointer-only edit.
11. Import replacement is transactional.
12. Editor session state is separate from portable project state.

Repository rules in `AGENTS.md` continue to apply (400 code-line limit for handwritten
runtime/CSS/scripts, 450 for tests; no weakened thresholds; negative fixtures prove
checker failure; report exact commands/results and untested scope).

### Non-goals

Real Nuxt UI rendering inside the concept; native companion conversion; formal
WCAG / screen-reader qualification (keyboard alternatives are implemented but no
conformance is claimed); arbitrary CSS/JavaScript authoring; freeform vector design.

## 2. Data model

### 2.1 Envelope

Companion transfer format moves to **schemaVersion 5**; `design.schema` 5.
`design.detailDesigns` is replaced by `design.visualDesigns`. A v5 document must not
contain `detailDesigns`. v1–v4 inputs remain importable through migration (§2.5).

```js
visualDesigns = {
  schema: 3,
  nextId: <positive safe integer>,          // deterministic IDs, e.g. 'vn-41', 'page-3'
  catalog: { id: 'nuxt-ui', version: 1 },   // pinned
  pages:      PageDefinition[],
  components: ComponentDefinition[],
  layouts:    LayoutDefinition[],           // user-saved; built-ins are catalog data
  revisions:  ComponentRevision[]
}
```

No `crypto.randomUUID()` or wall-clock values in persisted IR; IDs come from `nextId`.

### 2.2 Definitions

- **PageDefinition** `{ id, ownerId, name, root: UiNode[], scenarios: Scenario[], notes }`
  — `ownerId` references a sitemap page/modal/settings node. Route derives from the sitemap.
- **ComponentDefinition** `{ id, libraryId, exportName, description, props: PropDefinition[],
  slots: SlotDefinition[], emits: EmitDefinition[], variants: Variant[], template: UiNode[],
  scenarios: Scenario[], implementation? }` — `libraryId` references `design.library`;
  `exportName` is PascalCase; `implementation` is `{ catalog: 'nuxt-ui', entryId }` when the
  component was started via "Customize as component".
  - `PropDefinition { name, type: 'string'|'number'|'boolean', required, default?, description }`
  - `SlotDefinition { name, required, description }`
  - `EmitDefinition { name, payloadType: 'void'|'string'|'number'|'boolean'|'unknown', description }`
  - `Variant { id, name, values: Record<propName, Scalar> }`
- **LayoutDefinition** `{ id, name, description, scope: 'page'|'region', category, root: UiNode[],
  slots: {name, description, required}[], sourcePageId? }` — excludes page identity, route and
  preview data.
- **ComponentRevision** `{ id, componentId, version (x.y.z), contract: {props, slots, emits, variants},
  template: UiNode[] }` — published snapshot; pages may pin `revisionId`.

### 2.3 UiNode (discriminated union)

Common optional fields on every node: `name` (outline label), `visibleIn` (subset of
`default|loading|empty|error|disabled`, default all), `a11y` (text), `layout` (the existing
composition layout rules: stack/row/grid, gap, padding, columns, align, justify, wrap,
overflow, width mode/constraints, narrow override, token IDs — never raw CSS).

| kind | fields |
| --- | --- |
| `element` | `tag` ∈ div, section, header, main, footer, nav, aside, button, input, label, p, h1, h2, h3, span, ul, li, img; `attrs: Record<string, ValueExpression>`; `children: UiNode[]`; `events: Interaction[]` |
| `text` | `value: ValueExpression`; `role` ∈ h1, h2, h3, p, span |
| `slot` | `name`; `fallback: UiNode[]` |
| `component` | `ref: {kind:'project', componentId, revisionId?} \| {kind:'nuxt-ui', entryId}`; `props: Record<string, ValueExpression>`; `slots: Record<string, UiNode[]>`; `events: Interaction[]`; `variantId?` |

- **ValueExpression**: `{kind:'literal', value: Scalar}` · `{kind:'prop', name}` ·
  `{kind:'state', name}` · `{kind:'source', sourceId, operationId, field}`.
- **Interaction**: `{ id, event, label, actions: Action[], notes, acceptance }`. Empty
  `actions` = explicit implementation TODO (preserves today's `IMPLEMENTATION_REQUIRED`).
- **Action**: `emit {event, payload?: ValueExpression}` · `navigate {surfaceId}` ·
  `set-state {state}` · `toggle {nodeId}` · `set-value {nodeId, value: Scalar}` ·
  `focus {nodeId}` · `source {sourceId, operationId, input: Mapping}` (existing mapping shape).
- **Scenario**: unchanged from composition schema 2 (`id, name, state, width, values,
  bindings, recipe?`); `values` keys reference node IDs in the same definition.

### 2.4 Catalog, recipes, layouts

`catalog.mjs` holds Nuxt UI catalog v1 (primitives with props/slots/emits/defaults, as in
the handoff's `nuxt-ui-catalog.ts`, extended with any control needed by migration), recipes
(Application Shell, CRUD List, Filter Bar, Master/Detail, Settings Form, Empty State) and
built-in layouts. **Recipes and built-in layouts expand to ordinary IR at insertion**; persisted
IR never references a recipe. Instantiation deep-copies structure, allocates fresh node IDs
from `nextId`, and keeps component references.

### 2.5 Validation

Pure functions; throw `VISUAL_INVALID: <message naming the offending entity>`:
IDs unique per project; references (owners, library, components, revisions, sources,
surfaces, nodes in actions/scenarios); contract names/duplicates; template slots/emits
declared; catalog entry exists and props are declared with matching literal types;
component instance props/slots/events match the target contract; composition acyclic,
depth ≤ 16; tree depth ≤ 12; ≤ 120 nodes per definition and ≤ 200 definitions (current
limits; raised only if the migrated self-project requires it, with the reason recorded); prototype
keys rejected; literals bounded (existing `compositionLiteral` limits). Validation gates
save, export, import and generation.

### 2.6 Migration v3/v4 → v5

`migrateDetailDesigns(detailDesigns, design) → { visualDesigns, report }`:

- Tree from `parentId` + array (reading) order; named instance slots → `component.slots`.
- `region` → `element div` with `layout` from `layout` + `ui`.
- `text` → `text p`; `heading` → `text h2`; `button` → `u-button`; `input` → `u-input`;
  `number` → `u-input` (type number); `textarea` → `u-textarea`; `select` → `u-select`;
  `checkbox` → `u-checkbox`; `tabs` → `u-tabs`; `table` → `u-table`; `alert` → `u-alert`;
  `divider` → `u-separator`; `list` → `element ul/li`; `image` → `element img` (placeholder);
  `slot` → `slot`; `component` → project ref (+ `revisionId`).
- `binding` → `source` ValueExpression on the display prop/text.
- Edges → `Interaction` on the source node: `targetSurfaceId` → `navigate`; `effect` →
  `set-state|toggle|set-value|focus|emit`; `action` → `source`/`emit` with mappings;
  none → empty actions. `notes`/`acceptance`/`label` carried.
- `visibleIn`, `a11y`, `props`, `options`, scenarios, revisions carried.
- Library free-text `props/events/slots` → typed contracts via the existing
  `name:type` grammar; unparseable lines become `string`/`unknown` with the original
  text as `description` and are listed in the report.
- Dropped: `position`, `size`, `sourceBrickId` (counted in the report).

### 2.7 Session state

Selection, zoom, viewport, open panels, inspector tab, scenario/preview play state and
command palette state live in a presentation `veUi` object, never in project JSON.

## 3. Editors (concept presentation)

HTML-string views with `data-action` delegation (the concept's primary pattern). No
Vue Flow in these editors; `#dt-flow` and `detail-runtime.js` are removed. Storymaps,
ER and data-source Vue Flow islands are untouched. A new `ve.css` maps the handoff
prototype's visual language onto concept tokens (light and dark).

**Entry.** Pages view and Component library are the entry lists; sitemap surfaces,
storymap "Design page" and library "Open component editor" deep-link; Back restores origin.

**Page editor.** Left: page switcher; Outline (searchable, accessible tree mirroring canvas)
| Insert (Nuxt UI catalog: Patterns/Components; project components) | Layouts (built-in +
saved; apply; save page/selection as layout). Canvas: Design / Preview / Review; scenario
selector; desktop/tablet/mobile width; selection toolbar (insert after, duplicate, wrap,
bind data, add interaction, more); breadcrumb + readiness footer. Inspector: Essentials
(name, catalog-schema props form, layout; Advanced collapsed) | Data (source bindings) |
Actions (interactions, action builder, acceptance); Review findings panel linking to nodes.

**Component editor.** Left: Structure | Insert child (Project / Nuxt UI / Basic: semantic
elements + public slot); Dependency graph; Publish revision. Canvas: Design / Preview /
Compare / Review; variant + state selectors; composite child outlines. Inspector: root →
Contract (export name, description, Props/Slots/Emits) | Design (implementation, defaults)
| Events (DOM → emit); child → Props (literal / parent prop / state) | Slots | Events
(→ emit / local action) + Open definition. Cycle rejection before commit; usages and
revision impact shown before publish.

**Shared.** ⌘K palette extended with editor commands; Project health slideover (full
validation); Save-layout dialog; consequence-aware confirmation for delete,
replace-definition, publish and import-replace.

**Writes.** One `veCommit(change)` mirroring `dtCommit`: write guards (active run,
stale token, storage conflict), validation, design-history snapshot, persistence,
rollback on failure. Existing undo/redo therefore covers every write.

**Preview.** Catalog nodes render as Nuxt UI-faithful HTML/CSS previews using catalog
defaults; data comes from scenario fixture bindings, never hard-coded rows.
Deterministic: same project + scenario → same markup.

**Keyboard/a11y.** Move earlier/later and "Move to…" reparent picker replace drag;
outline ↔ canvas selection sync; dialog focus trap/restore; findings use icon + text.

**Modules.** ~15–20 `src/ve-*.js` (≤ 400 code lines each) + `ve.css`, registered in
`scripts/concepts/build-companion.py` module/style lists and seams, `.fallowrc.json`,
and the inventory count in `tests/tooling/companion-boundaries.checks.mjs`.

## 4. Shared contract modules

`scripts/companion/visual/` (framework-free `.mjs` + `.d.mts`, ≤ 400 code lines each),
inlined into the concept build like existing contracts and imported by the generator:
`ir` (constructors/guards), `catalog`, `validate`, `composition` (dependencies, cycles),
`layout` (instantiate, save), `migrate`, `session` (visibility, transitions for preview
and generated tests), `commands` (pure authoring operations used by `veCommit`).
`project-contract.mjs` gates v5 and delegates to `validate`.

## 5. Generator

`plan.ts` reads validated `visualDesigns` (migrating v3/v4 first). New `compiler/visual-*.ts`
replace `detail-model.ts`, `detail-code.ts`, `detail-fields.ts`, `detail-mappings.ts`:

- element → tag; text → escaped interpolation/binding; slot → `<slot name>`;
  project component → exported SFC name with typed import; Nuxt UI component → real `U*`
  component imported explicitly (shell's explicit-component integration, no global plugin).
- literal/prop/state/source → typed bindings; interactions → handlers restricted to declared
  actions (`navigate` → navigation port; `source` → operation/mapping port; local actions →
  runtime); empty actions → `IMPLEMENTATION_REQUIRED` TODO.
- Components → `defineProps`/`defineEmits`/`defineSlots` from contracts.
- All literal text/attributes escaped.

Runtime `use-detail.ts`, `detail-actions.ts`, `detail-controls.ts` adapted to a tree spec;
`operation.ts`, `json-http.ts`, fixtures, relationships unchanged. Output paths unchanged
(`presentation/components/library/<id>.vue`, `details/<pageId>.vue`). Generated tests:
interaction transitions from IR, contract tests, scenario render checks. Repo golden tests
for lowering. `compositionTestSource` replaced by the IR equivalent. Catalog v1 ↔ generated
`@nuxt/ui` version asserted.

## 6. Data artifacts

- Eight non-blank starters migrated and checked in; `starters/catalog.json` SHA-256 updated;
  blank starter → empty `visualDesigns`.
- Seeds rewritten as IR (`detail-seed.js`, `composition-seed.js` replaced); self-project
  `companion-project.json` regenerated via `export-companion-project.py`.
- `tests/fixtures/companion/detail-v3.json` retained as migration input; new v4 fixture.

## 7. Error handling

Validate before every write/import/export/generate; failure keeps the draft and reports
a domain-language message naming the entity. Import: review (incl. migration report) →
validate → explicit replace, transactional with rollback. Existing storage-conflict and
active-run guards reused.

## 8. Testing and CI

- Node: IR validation with negative fixtures per rule; migration of v3/v4 fixtures, every
  starter and the self-project; lossless v5 round-trip; cycles; fresh-ID layouts; recipe
  expansion; each command undoable.
- Generator: golden lowering tests; updated `project-generator*.checks.mjs`; `qualify-project`
  on the self-project; `qualify-starter` ×9; `qualify-styles`.
- Browser: `companion-details`, `companion-detail-polish`, `companion-composition` suites
  replaced by `companion-visual-editors.browser.py` (both editors end-to-end, keyboard-only
  paths, Back navigation); `companion-storage`, `companion-storymap-polish` and
  `companion-generator-boundaries` updated. `run-browser-checks.py` SUITES updated.
- CI: `companion-concept-verification.yml` and `project-generator.yml` keep all jobs; only
  suite names/paths change. `npm run verify` passes.

## 9. Documentation

New `docs/concepts/companion/VISUAL-EDITORS.md` (usage + contract) and
`VISUAL-EDITORS-VERIFICATION.md`; `DETAIL-EDITORS*.md` and `COMPOSITION*.md` marked
historical/superseded; `PROJECT-JSON.md` documents v5; handoff package archived under
`docs/concepts/companion/handoff/visual-editors/` (docs, reference sources, prototype)
as design reference, not runtime input; PR #5 description updated.

## 10. Delivery stages

Subagent-driven; each stage ends green on its own checks.

1. `scripts/companion/visual/*` contract, catalog, validation, migration, commands + node tests.
2. Generator lowering + runtime adaptation + golden/qualify tests (parallel with 3).
3. Concept editors + build/inventory wiring + browser suite (parallel with 2).
4. Starter / self-project / fixture migration + hashes.
5. Remove `detail-*` / `composition-*` concept and compiler modules; rewire shared modules
   (`design-model.js`, `storymap-actions.js`, `canvas-model.js`, `project-transfer.js`,
   `interaction-polish.js`, `component-views.js`, `product-actions.js`, `companion-project.js`,
   `workflow-model.js`, `workflow-views.js`).
6. Docs; full `verify`, browser suites, all qualify jobs; PR #5 update.

## 11. Refinements made while planning

1. `state` ValueExpression is `{kind:'state', nodeId}`: the current value of a form control in the same definition.
2. `emit.payload` and `source.input` use the existing payload Mapping (`none|event|value|draft|prop|source|object`), not a bare ValueExpression.
3. ComponentDefinition gains optional `notes` (≤ 8000); ComponentRevision gains optional `designSystem` snapshot, so migration loses only geometry.
4. Catalog and project component nodes accept DOM events (`click, focus, blur, keydown, change, input, submit`) in addition to declared emits (Vue attribute fallthrough).
5. Slot nodes are valid only in component templates and layouts; applying a layout turns its slot nodes into named `div` regions containing their fallback.
6. Catalog prop types are `string|number|boolean|array|object|unknown`; array/object/unknown props take bounded JSON literals.
7. `detail-contract.mjs` and `composition-contract.mjs` stay as legacy-input validators and layout/style helpers; only editor and compiler modules are removed.
8. Removing an element that other interactions or state bindings reference is refused with the referencing list; scenario values of removed elements are pruned.
9. Migrating saved browser state clears the design undo/redo history (legacy snapshots are not replayable) and says so.

## 12. Risks

- Generator rewrite breaks starter qualification → stage 2 runs `qualify-starter` on migrated
  starters before stage 4 commits them.
- Parallel stages 2/3 both touch `visual/*` → contract frozen after stage 1; changes go through
  the coordinator.
- Inventory/seam brittleness in the Python build → stage 3 owns all build-script edits.
- Self-project size (81 definitions) against limits → limits checked in stage 1 against the
  migrated self-project.
