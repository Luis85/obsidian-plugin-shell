# Page and component detail editors

> Current composition increment: [Layout, tokens, slots, revisions, scenarios and complete self-project](COMPOSITION.md). [Verification scope](COMPOSITION-VERIFICATION.md). Earlier increment-specific version/count statements below retain their historical scope.
This increment extends PR #5’s offline companion, including its existing Storymaps,
sitemap, component library and project JSON. Both detail canvases use the same
pinned, embedded Vue Flow runtime as those editors. It is not a second application
or an installable native companion.

## Design layers

| Layer | What it owns | What it references |
| --- | --- | --- |
| Sitemap | Native view containers, pages, modals, settings and navigation | Page detail owners |
| Storymap | Activities, steps, stories and release slices | Existing sitemap surfaces and requirements |
| Page editor | Regions, reading order, content, instances, bindings, states and interactions | One sitemap page/modal/settings owner; reusable definitions |
| Component editor | Reusable internal regions, primitives, slots and nested instances | One library definition and its declared props/events/slots/variants |

A view or group is an ownership/navigation container, not automatically a page.
Detail documents supplement the existing shell/bricks; they do not overwrite or
synchronize those older sketches implicitly. A component instance is a reference
with local overrides, not a copied library definition.

## Try the supplied example

Open `index.html`, choose **Load companion project**, review, confirm, then:

1. **Pages → Import project JSON → Open page editor** opens a composed modal with
   an input, a reusable review instance, error/loading content and an interaction.
2. Select **Project review → Edit reusable internals** to open the component
   editor. **Back** restores the originating page and selected instance.
3. **Preview → Error** exposes the authored error content. **Narrow** reviews
   reading layout at a bounded width. Controls in this symbolic wireframe are inert.
4. **Component library → ProjectJsonReview → Open component editor** opens the
   same reusable detail document, not another copy.

Sitemap inspectors expose **Open page editor** on eligible surfaces. Linked
storymap items expose **Design page** beside their sitemap reference. Returning
from that editor restores the selected story and map. Opening an unstarted
surface does not author data: **Start detail design** creates one initial region.

## Shared authoring behavior

The palette adds regions, text, inputs, buttons and component instances. Component
documents additionally offer slots. Adding inside a selected region sets an
explicit parent ID. **Edit element → Parent region** performs the same containment
change without dragging; cyclic parents and nesting beyond eight levels fail.

**Reading order → Move earlier/later** changes semantic order among siblings.
Canvas dragging and numeric X/Y/width/height change presentation geometry only.
A parent move carries its rendered children; their saved positions remain relative
to that parent. Use the region’s stack/row/grid layout for reading-layout intent.

Drag an element’s right handle to another element’s left handle, or choose
**Add interaction**. A separate draft describes event, label, behavior, optional
navigation target and Given/When/Then acceptance notes. Arrows are interactions,
not containment. A connection is not saved until confirmed. Duplicate event links
and self-links are rejected.

Select **Edit element** for content, accessible naming/validation notes, source
operation and result-field declarations, and visibility in default/loading/empty/
error/disabled states. No source provider runs in these editors. The field path is
data, not an expression interpreter.

Reusable instances pin a library contract version and variant, with bounded JSON
literal props checked against the existing prop declaration. Changing an instance
does not mutate the reusable contract. A version mismatch stays visible; **Review
current version** changes only the draft, and incompatible props must be repaired
before Save. Missing external definitions/operations/owners remain recoverable
references, not silently dropped records. Recursive component composition is
rejected across the full detail collection.

## Preview and accessibility scope

Canvas, Outline, Preview and Review expose the same saved document. Outline provides
non-drag selection, editing, containment, order and interaction authoring. Small
screens default to Outline when opening a design. Keyboard focus styling, named
controls, form labels and status/error announcements use the companion shell.

Preview follows reading order and parent layout rather than canvas positions. It
can expand reusable internals at the current pinned contract version. Props are
shown as instance values, not evaluated as template substitutions. Narrow preview
stacks rows and grids; it is a review aid, not a responsive CSS generator. A
500-rendered-element budget prevents exponentially repeated instances from
locking the preview. Native Obsidian, touch/assistive-technology qualification and
maximum-scale profiling remain separate acceptance work.

## Persistence and safety

All detail edits use one guarded copy/validate/persist transaction and the shared
bounded project history. Save failures roll back the canonical design and both
history stacks while keeping the draft. Stale drafts, competing browser storage
and active operations block writes. Undo/Redo restore the whole design and retain
monotonic identity counters. Removing a region removes only its descendants and
attached arrows, never library definitions, sitemap surfaces or storymap items.

Selection, viewport, open modal drafts, preview width/state and navigation history
are transient. Canvas moves do not change the browser’s semantic generation
fingerprint; content, containment, reading order and interactions do. The separate
shell compiler still hashes the complete input when reviewing an apply plan;
changing exported bytes requires a new reviewed compiler plan.

## Original detail contract (legacy v3)

The original increment used `schemaVersion: 3` and `design.schema: 3`. Current exports use v4; see [Composition](COMPOSITION.md). V1 and v2 imports remain
supported without inventing detail documents. V1 cannot contain Storymaps or
details; v2 cannot contain details. Unknown fields/versions, internal dangling
references, unsafe literals, invalid coordinates and composition cycles fail
before replacement.

`design.detailDesigns` has subsystem schema 1, a monotonic `nextId`, and
`documents`. Each document has a stable generated ID, kind (`page`/`component`),
`ownerId`, fallback `ownerLabel`, notes, ordered nodes and interaction edges.
Nodes have stable IDs, parent ID, kind, content, layout, geometry, optional
component reference/props/binding, accessibility notes and visible states.

Limits: 200 documents/project; 120 elements and 240 interactions/document;
4,000 total detail elements plus interactions; eight containment levels; bounded
literal props, strings and coordinates. Full-project input/output remains 4 MB;
browser retained state, including history, remains 5 MB. Imported text is escaped,
never evaluated or fetched.

The read-only `companion:generate` accepts v3 and prints the exact original bytes
without writes. The separate `companion:scaffold` preserves detail data in
`design/project.json` and `design/traceability.json` and explicitly warns that
layout execution, data binding behavior and detail acceptance remain implementation
work. This increment does not claim those details have become generated working
Vue components or passing business tests.

## Source and verification

`src/detail-model.js` is renderer-independent authoring logic;
`scripts/companion/detail-contract.mjs` is the shared browser/CLI validator.
`detail-actions.js`, `detail-forms.js`, `detail-views.js`, `detail-runtime.js`,
`detail-preview.js`, `detail-seed.js` and `detail.css` keep state, UI, renderer and
preview concerns separate. The assembly inventory and CI include every new input.

Run `python3 scripts/concepts/build-companion.py --check`,
`node --test tests/tooling/companion-details.checks.mjs`, and
`python3 tests/concepts/companion-details.browser.py`. The complete browser runner
includes the new suite alongside all existing suites. See
[DETAIL-EDITORS-VERIFICATION.md](DETAIL-EDITORS-VERIFICATION.md) for executed evidence.

The controlled projection and parent-node design follow the official Vue Flow
[node guide](https://vueflow.dev/guide/node.html),
[state guide](https://vueflow.dev/guide/vue-flow/state.html), and
[nesting example](https://vueflow.dev/examples/nodes/nesting.html), checked against
the pinned runtime already present in PR #5. Native conversion remains
[CP-003](../../tasks/companion/CP-003.md), after shell readiness.

Reloading while a detail editor is open restores all saved design data and opens its Pages or Component library overview. Selection, viewport and drill-down history remain session-only; import does not acquire execution authority. Missing component owners have a retained-design section in the library.


## Research-led authoring and review polish

The [research and requirements](DETAIL-EDITORS-RESEARCH.md) distinguish documented
competitive patterns, historical user reports and a direct audit of this concept.
The [polishing receipt](DETAIL-EDITORS-POLISH.md) records the delivered scope and
verification boundaries.

**Find the right object.** Pages searches titles, kinds and slugs. Search structure
filters element labels, kinds, content and component names while retaining their
ancestors. Search and breadcrumbs do not change the saved design. Outline shows
one tree rather than a repeated palette tree.

**Edit local properties.** Component instances expose typed text, boolean and
number fields. Each row identifies a local override, matching variant default or
unset value. Use Override to create a local value and Use default / Remove override
to reset only that property. False, zero and empty text remain real values. Blank
or non-finite numeric input blocks Save. Advanced JSON remains available for
repair, but nested objects and expressions are not accepted.

Changing a definition retains all draft overrides. Incompatible values remain
visible for explicit repair; they are not silently discarded. Defaults are not
borrowed from a different contract version or a missing variant. Contract pins do
not archive historical internals: editing reusable internals still edits the
shared definition. The Component editor's Used by panel reports direct instances,
not transitive impact, and opens each exact instance. Back restores the previous
representation, search and preview context.

**Review before handoff.** Review consolidates reference/accessibility findings and
missing design-intent or interaction descriptions. Its actions open the exact
editable object. The state table counts local elements with ancestor visibility;
reusable internals are explicitly excluded from those counts. Preview actions
open the corresponding state. Equal states are not automatically an error, and
zero questions does not mean an accessibility audit or an implementation passed.

Export design brief produces deterministic, escaped Markdown from saved design
content: owner and element IDs, reading order, configuration origins, bindings,
interactions, acceptance intent and review questions. It does not write design
state, execute providers, generate Vue layouts or run tests. Use full-project JSON
for editable transfer; the Markdown brief is not an import format.

Canvas also exposes Zoom out, 100%, Zoom in and Fit canvas. Connection labels use
short event names with readable text/background styles; the inspector retains
the full interaction label and description. Selected representations and preview
states remain visibly marked in both themes.
