# Visual Page and Component editors

> Current page and component editors of the companion concept (2026-09-26). They replace the Vue Flow detail editors
> described in [DETAIL-EDITORS.md](DETAIL-EDITORS.md) and [COMPOSITION.md](COMPOSITION.md), which are now historical.
> Binding design: [visual editors spec](../../superpowers/specs/2026-09-26-visual-editors-design.md) (including its
> §11 refinements and §13 component library dependencies). Executed evidence and untested scope:
> [VISUAL-EDITORS-VERIFICATION.md](VISUAL-EDITORS-VERIFICATION.md).

The editors describe what a page or reusable component contains, how it responds to the user and which data it
shows, as a declarative UI tree rather than free canvas geometry. The same tree is the project JSON format
(`design.visualDesigns`, companion format v5), the input of the reviewed project generator (Vue SFCs with real Nuxt UI
components) and the data behind the concept's previews. The concept stays one offline `index.html` under the same
strict CSP. It renders Nuxt UI-like HTML/CSS previews, not real Nuxt UI.

The owner's implementation handoff that this work adopted is archived as a design reference, not runtime input, under
[handoff/visual-editors](handoff/visual-editors/README.md). Its TypeScript/Vue sources carry a `.ts.txt`/`.vue.txt`
suffix, its prototype is `prototype/visual-editors.html.txt` and its package manifest is `package.json.txt`, so no
build, analyzer, linter or dependency scanner treats them as project code or dependencies.

## Entry points

| From | Control | Opens |
| --- | --- | --- |
| **Pages** (sidebar) | a surface card's **Design page**, or **Start design** for a surface that is still “Shell only” | Page editor |
| **Sitemap** inspector → Links | **Open page editor** (page, modal and settings surfaces) | Page editor |
| **Storymaps** item | **Design page** next to a linked surface | Page editor |
| **Component library** detail | **Open component editor**; “Used in page and component designs” lists every design that places it | Component editor |
| Page or component editor | **Open definition** on a selected project component instance | Component editor |
| Insert pane | **Customize as component** on a Nuxt UI primitive | New library entry plus a component that wraps it |

Opening an editor never writes. **Start design** is the explicit write that creates a page or component definition.
**Back** returns to the origin view with its selection (storymap item, sitemap surface, library component or the
previous editor) and focus on the control that opened the editor. The Back stack keeps 12 entries. An origin that was
removed meanwhile falls back to its view's default.

## Three-pane grammar

Both editors use the same layout: a left pane (structure and insertion), a canvas and a right-hand inspector. At narrow
widths the panes become tabs (Structure, Canvas, Inspector).

- **Left pane.** A searchable Outline is the accessible tree (`role="tree"`, `aria-selected`). It mirrors the canvas, and
  selecting in either one selects in both. Insert lists catalog and project items. The page editor also has Layouts.
- **Canvas.** Design mode selects elements. Preview is read-only and runs the scenario's interactions. Review lists
  validation findings that link to the offending element. The component editor adds Compare. The page editor offers a
  scenario selector and Desktop/Tablet/Mobile width. A `narrow` scenario switches to Mobile. The selection toolbar
  offers Insert after, Duplicate, Wrap in group, Bind data, Add interaction and More (Move earlier/later, Move to…,
  Save selection as layout, Delete…). A breadcrumb and readiness footer sit under the canvas.
- **Inspector.** Edits the selection. Every edit goes through one write path, `veCommit`, which checks the write guards
  (active run, stale token, storage conflict), validates the whole store, records a design-history snapshot, saves and
  rolls back on failure. Undo/redo therefore covers every authoring write.

## Page editor

- **Left:** page switcher. **Outline**. **Insert** offers Nuxt UI patterns (Application Shell, CRUD List Workspace,
  Filter Bar, Master / Detail, Settings Form, Empty State), the 22 Nuxt UI catalog v1 components (Actions, Forms, Data,
  Navigation, Overlays, Feedback, Layout) and designed project components. **Layouts** offers five built-in page layouts
  (List workspace, Operations dashboard, Master / detail, Form workflow, Settings) and saved layouts. It can apply a
  layout or save the page or selection as a layout.
- **Inspector:** **Essentials** (name, catalog-schema prop form, layout rules, with Advanced collapsed). **Data**
  (bind a value to a data source operation result). **Actions** (interactions with an action builder, notes and
  acceptance).
- Patterns and layouts expand to ordinary IR on insertion, with fresh `vn-N` IDs. Component references are kept, and
  persisted data never references a recipe. Applying a layout turns its slot nodes into named `div` regions that
  contain their fallback content.

## Component editor

- **Left:** **Structure** (outline). **Insert child**: project components, Nuxt UI primitives, and Basic (semantic
  elements, a public slot, external libraries). The dependency graph and **Publish revision** open from the header.
- **Canvas:** Design, Preview, Compare and Review. Variant and state selectors. Composite children are outlined.
- **Inspector, root selected:** **Contract** (export name, description, Props, Slots, Emits). **Design**
  (implementation, defaults). **Events** (DOM event → emit). **Dependencies** (see below).
- **Inspector, child selected:** **Props** (Literal, Parent prop, Form value or Source). **Slots**. **Events**
  (→ emit or a local action). **Open definition** for project components.
- A component that already uses the open component, directly or through others, is disabled in Insert child.
  Composition cycles are refused before commit.
- **Publish revision** shows every usage first. Live instances follow the new source, and pinned instances keep their
  revision. It then publishes an immutable `x.y.z` snapshot of the contract and template. The first revision is 1.0.0,
  and later ones default to the next patch.

## Component library dependencies and external adapters (spec §13)

Use this when a reusable component wraps a third-party library, for example the owner's rich-text or code editor
wrapper. The component declares the package, and a typed, hand-owned adapter bridges it. The editors persist no
library code.

1. In the component editor, open the root's **Dependencies** tab and add `package`, exact `version` and `purpose`. At
   most 8 are allowed. The package name uses npm grammar. Versions are exact only: no ranges, tags, URLs, git or file
   specifiers. The same package must have the same version in every component, and a mismatch names both components.
2. Use **Insert child → Basic → External library**, choose the declared dependency and name the adapter
   (`^[a-z][a-z0-9-]*$`, unique per component). The canvas shows a dashed placeholder
   “External · package@version · adapter name” with its props. Review lists the info finding “Adapter must be
   implemented in code”.
3. Bind its props like any other child (Literal, Parent prop, Form value or Source). In **Events**, map the adapter's
   own event names (`^[a-zA-Z][a-zA-Z0-9:_-]*$`) to emits or local actions.

```json
{ "id": "vn-12", "kind": "external", "package": "@tiptap/vue-3", "adapter": "rich-text",
  "props": { "modelValue": { "kind": "prop", "name": "content" } },
  "events": [{ "id": "vi-3", "event": "update", "label": "Content changed",
               "actions": [{ "kind": "emit", "event": "change", "payload": { "kind": "event" } }],
               "notes": "", "acceptance": "" }] }
```

The generator merges the declared packages, at their exact versions, into the generated `package.json`. It stops,
naming both versions, if one conflicts with a framework-pinned version or with another component. For each external
node it writes the extension-owned
`presentation/components/library/<component>/<adapter>.adapter.ts`, which exports
`createAdapter(): VisualExternalAdapter<Props>` with `mount(el, props, emit)`, `update(props)` and `destroy()` stubs.
The stubs throw `NotImplementedError` and a comment names the package to import. Regeneration never overwrites an
edited adapter. The wrapper SFC mounts it after render, calls `update` on prop changes and `destroy` on unmount, and
routes `emit` calls to the node's interactions. Generated tests add an `it.todo` per adapter and a lifecycle test with
a fake adapter. Running `npm install` stays an explicit developer step. Package licenses are the author's
responsibility and are listed in `PROJECT-IMPLEMENTATION.md`.

Removing a dependency that an external node still uses is refused, naming the adapter. External nodes are valid only
in component templates and their revisions.

## Data contract summary

Full rules: spec §2 and §11–§13. The runtime contract lives in `scripts/companion/visual/*.mjs`
(`ir`, `catalog`, `validate`, `composition`, `layout`, `migrate`, `session`, `commands`, `mapping`). The concept
inlines these modules and the generator imports them.

```js
design.visualDesigns = { schema: 3, nextId, catalog: { id: 'nuxt-ui', version: 1 },  // ↔ generated @nuxt/ui 4.11.2
  pages: PageDefinition[], components: ComponentDefinition[], layouts: LayoutDefinition[], revisions: ComponentRevision[] }
```

- Node kinds: `element` (18 semantic tags), `text` (h1/h2/h3/p/span), `slot`, `component` (project reference with an
  optional pinned `revisionId`, or a `nuxt-ui` entry) and `external`. Every node may carry `name`, `visibleIn`
  (default/loading/empty/error/disabled), `a11y`, typed `layout` rules (token IDs, never raw CSS) and author `notes`.
- Values: `literal`, `prop`, `state` (a form control's current value) and `source` (data source operation field).
  Interactions hold `emit`, `navigate`, `set-state`, `toggle`, `set-value`, `focus` and `source` actions. Empty
  `actions` is an explicit implementation TODO.
- IDs are deterministic (`vn-`, `vp-`, `vc-`, `vl-`, `vr-`, `vi-` from `nextId`). No clock values or random UUIDs are
  persisted.
- Validation gates save, import, export and generation, and fails with
  `VISUAL_INVALID: <message naming the page/component/layout and element>`. It checks references (owners, library,
  components, revisions, sources, surfaces, action and scenario targets), contracts, catalog props and types, instance
  props/slots/events against the target contract, acyclic composition and the limits below.
- Editor session state (selection, viewport, open panes, inspector tab, scenario, palette) lives in `veUi` and never
  enters project JSON.

## Migration from v1–v4 and what is dropped

Companion v5 documents carry `visualDesigns` and must not carry `detailDesigns`. v1–v4 documents remain importable.
`migrateDetailDesigns` converts legacy detail designs:

- regions become `div` elements with layout rules;
- primitives become Nuxt UI entries (`u-button`, `u-input`, `u-select` …) or elements;
- bindings become `source` values;
- edges become interactions (navigate, effect, action, or both navigate and an effect);
- library free-text members become typed contracts.

Migration runs on import, on reading an export (`companion:generate`/scaffold) and once on startup for saved browser
state. Saved-state migration clears the design undo/redo history, because legacy snapshots cannot be replayed, and
says so: “This project was upgraded to the new page and component editors. Earlier undo history was cleared.”
Import shows the migration report before the explicit replacement.

**Dropped by design:** free canvas geometry (`position`, `size`) and outline references (`sourceBrickId`), counted as
`droppedPositions`, `droppedSizes` and `droppedOutlineRefs`. Real data lost nothing else:

| Input | Positions / sizes dropped | Any other counted loss |
| --- | --- | --- |
| Self-project (v4 fixture, 81 designs) | 847 / 847 | none |
| Each of the eight non-blank starters | 30–40 / 30–40 | none |

The report also counts these edge cases, all 0 on real data:

| Counter | What it counts |
| --- | --- |
| `droppedInteractions` | Edges from text, heading or slot nodes. |
| `droppedSlotRules` | Slot capacity/kind rules. |
| `listBindings` | Bound lists that render one bound item and no longer repeat. |
| `droppedFallbackBindings` | Shadowed bindings. |
| `droppedProps` | Instance values that no longer match the contract. |
| `truncatedNotes` | Notes over 4000 characters. |
| `unparsedMembers` | Library member lines that could not be typed. These are kept as `string`/`unknown` with the original text as description. |

`createdComponents` is not a loss: it lists component definitions created for library entries that pages used without
a design.

An undo entry recorded before the upgrade is refused while visual designs exist, rather than discarding them. A restored
entry that holds visual designs drops a legacy store inherited from the current design; a design that is still legacy
(for example after a failed startup upgrade) keeps its store across every undo/redo path.

## Keyboard map

Shortcuts work inside the editor, outside text fields and when no dialog is open. In text fields, native text undo
applies. Letter shortcuts fall back to the physical key (`KeyZ`/`KeyY`/`KeyD`) on non-Latin layouts.

| Keys | Action |
| --- | --- |
| Ctrl/⌘+Z · Ctrl/⌘+Shift+Z or Ctrl/⌘+Y | Undo · Redo (shared design history). Refused in Preview, like every write. Also available as toolbar buttons and palette rows |
| ↑ / ↓ · ← / → · Home / End (Outline item or canvas element focused) | Previous / next element in outline order · parent / first child · first / last |
| Alt+↑ / Alt+↓ | Move the selected element earlier / later among its siblings |
| Delete or Backspace | Delete the selected element after a consequence-aware confirmation. Refused while other interactions or state bindings reference it, and the dialog lists them |
| Ctrl/⌘+D | Duplicate the selected element |
| Escape | Clear the selection |
| Ctrl/⌘+K | Command palette with editor commands (insert table/form/modal, save or apply layout, preview, undo/redo, duplicate, bind data, add interaction) |

Pointer-free alternatives cover every pointer-only edit. **Move to…** replaces drag reparenting. It lists only
containers where the move passes full validation (depth and composition limits included). Dialogs trap and restore
focus. Findings use an icon and text.

## Limits

These are validator constants (`VISUAL_LIMITS`), unchanged by the self-project migration:

- 120 elements per definition;
- 200 pages and components in total;
- tree depth 12;
- composition depth 16;
- 60 saved layouts;
- 200 revisions;
- 40 interactions per element;
- 8 actions per interaction;
- 12 scenarios per definition;
- 32 props, slots and emits each;
- 8 dependencies per component.

Literals keep the existing bounded JSON limits. The whole project JSON stays within the 4 MB transfer limit.

## Non-goals

- Real Nuxt UI rendering inside the concept.
- Native companion conversion.
- Formal WCAG or screen-reader qualification. Keyboard alternatives are implemented, but no conformance is claimed.
- Arbitrary CSS or JavaScript authoring.
- Freeform vector design or free x/y geometry.
- Library-specific presets for external packages.

## Try it

1. Open [index.html](index.html) and choose **Load companion project**. Review and confirm. The self-project has 27
   page designs, 54 component designs and 54 published revisions.
2. Open **Pages** and choose **Design page** on a designed surface. Select elements in the Outline with the arrow keys,
   press Alt+↓ to move one, then Ctrl/⌘+Z to undo.
3. Use **Insert → Patterns → Filter Bar**. The recipe becomes ordinary elements with fresh IDs. Switch the canvas to
   **Preview** and choose another scenario or Mobile width.
4. Select a button, then **Add interaction** and add a navigate action. **Review** shows any remaining findings with
   links to the elements.
5. Open **Component library**, choose a component and **Open component editor**. In **Contract**, add a prop. Use
   **Insert child**, then **Publish revision** and read the usage impact before confirming.
6. Use **Back** repeatedly to return to the component library and then to the page editor.
7. Export the project JSON. The document is `schemaVersion: 5` and round-trips losslessly.
