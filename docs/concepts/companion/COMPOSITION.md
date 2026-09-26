# Detailed composition, review and implementation

This increment extends the existing PR #5 Page and Component editors. The newer
Storymaps work is retained. It incorporates the detail compiler from PR #21 and
extends that compiler rather than installing a second generation system. It does
not merge either PR or claim that the generated companion has its business logic.

## Editor responsibilities

The sitemap owns surfaces and navigation; Storymaps owns user activities, stories,
releases and traceability. Pages references an existing surface. The Page editor
composes its regions, reusable instances and local content. The Component editor
authors reusable internals and its declared public contract. Changes to a page
instance never implicitly rewrite the reusable definition.

Canvas, Outline, Preview and Review remain views of one document. The grouped
palette separates Structure, Input/actions and Data/feedback. Select first, then
add inside a region or a named instance slot. Heading, text, text input, textarea,
number, checkbox, select, tabs, buttons, table, list, alert, divider and a clearly
labelled asset placeholder have distinct semantics. Assets are not fetched from
imported strings. The placeholder is not a completed image-management service.

## Layout and tokens

Layout is explicit: stack/row/grid, columns, gap, padding, alignment, justification,
wrapping, overflow, fill/hug/fixed width and minimum/maximum width. Narrow container
rules choose layout, columns and visibility independently. The narrow threshold is
640 CSS pixels; this version does not offer arbitrary user-defined breakpoint sets.

The Layout action edits these controls in a protected draft. Tokens reference
existing spacing, colors, radii and typography rather than accepting arbitrary CSS.
Missing tokens remain visible as review questions with numeric/default fallbacks.
Preview and generated Vue use the same data-only style resolver. Light/dark colors
are scoped to the generated detail root; captured components retain captured token
values. The concurrent Nuxt UI stylesheet generator remains active for the surrounding
frontend; detail styling does not replace it. Rem values and safe local font-family
names use the same declared units/provenance. No font files are fetched.

Canvas coordinates remain presentation-only. Arrange canvas computes bounded,
nonoverlapping regions without changing semantic sibling order. Outline provides
checkbox multi-selection; Ctrl/Cmd-click is its canvas counterpart. Align selected
siblings changes diagram positions only. Grouping changes containment explicitly.
Copy/paste uses a session-local subtree clipboard with new IDs and remapped internal
links; it never copies a reusable definition or uses the operating-system clipboard.

## Slots and component revisions

A reusable slot has a name, one/many cardinality and optional allowed root kinds.
Instance children belong to their caller and name the receiving slot. Defaults are
rendered only when the instance supplies no content. Save, import and generation
reject incompatible known pinned slot content rather than dropping it.

Publish revision reviews the working contract and requires confirmation. It captures
the public contract, internal graph, tokens and a pinned dependency closure. A
published revision is append-only; later working edits and Undo do not mutate it.
Instances upgrade individually through review, retaining local property values and
requiring remapping for incompatible retained slot names. No automatic bulk upgrade
occurs. Usage inspection follows both live and captured dependency contexts, so a
working definition cannot conceal consumers pinned to its older dependencies.

Snapshot retention consumes the project's existing storage budget. Full-project
Undo/Redo remains bounded by both entry count and serialized byte cost; older
history can be trimmed on a large project. Published revisions survive that trim.
No claim of twenty full-project undo entries at maximum project size is made.

## Preview, fixtures and effects

Review mode is inert. Play interactions enables only explicitly declared local UI
effects: change state, toggle an element, set a literal value, focus a control,
emit a declared component event or navigate to a declared surface. Public component
events can reach the enclosing instance's declared interaction. Business prose is
never evaluated. An unimplemented business interaction reports that implementation
is required; it is not converted into a successful mock result.

Fixture scenarios retain state, width, literal element values and source-output
snapshots. Capture test-data recipe calls the existing pure seeded generator, not
a source provider, and records its seed/count/engine/settings fingerprint. A changed
recipe does not silently replace an existing scenario. Known fixture outputs must
match the source operation's declared shape. Preview changes are transient and are
not written back into the design. Reset restores the chosen fixture.

Compare frames shows component variants, wide/narrow containers or default/error
states side by side. A bounded expansion budget protects repeated nested instances;
the budget is explicit, not a promise of unlimited-canvas performance.

Export UI effect tests emits a standalone Node test module with real assertions for
the supported effects and explicit TODOs for unimplemented business behavior. Export
design brief remains a human-readable reading-order/contract handoff. Neither is
native acceptance evidence.

## Complete companion self-project

Load companion project requires the existing review and replacement confirmation.
Its portable JSON and embedded seed now describe **all 26 eligible surfaces and all
54 reusable components**: **80 working detail designs and 54 published revisions**.
The single workbench view owns pages but is not itself duplicated as a page design.
The existing 27 sitemap surfaces, five PRDs, 30 requirements, 11 entities, Storymap,
source contracts and test recipes remain connected.

The page/editor palettes, reusable internals, forms, lists/tables, state content and
source-backed requirement examples are authoring data, editable through the same
controls as user designs. A declared interior is not evidence that its native
business behavior already exists. The self-project deliberately retains such gaps.

## Transfer and code generation

Full-project format is v4 (design schema 4); detailed composition subsystem schema
is 2. Older full-project v1/v2/v3 documents remain readable through explicit legacy
validation and are not allowed to hide new fields under old version numbers.
Working nodes, slots, scenarios and captured revisions are portable data; runtime
preview state, drafts, machine paths and execution authority are not exported.

The reviewed shell generator emits live and captured Vue detail components, local
responsive state, typed contracts, source/Pinia projections, named Vue slots and
literal-safe effect dispatch. Each captured definition receives a separate generated
identity. It also emits mounted Vue tests and standalone UI-effect model tests.
`npm run verify:project` builds, type-checks and runs both categories in the generated
workspace. PRD acceptance and unknown business effects remain explicit TODOs/hooks.

The compiler refuses unresolved runtime references, incompatible props, missing
slot mappings, invalid known fixtures and ambiguous event branches. Read-only JSON
inspection remains a separate no-write command. Plan/hash/apply and consumer-edit
conflict protections are unchanged.

## Qualification boundaries

Keyboard/pointer alternatives, responsive controls and visible focus are provided;
physical touch/pen and screen-reader trials and formal WCAG conformance still need
native acceptance. Representative measured browser render timings are diagnostics,
not a maximum-scale/native latency guarantee. Native Markdown adapters, completed
business handlers and release qualification are not part of this concept increment.

## Large self-project transfer

File and bundled imports retain the complete reviewed JSON outside the visible paste
control when large; typing in that control explicitly replaces the input and invalidates
review. Large export previews identify their 30,000-character display limit; the
download always contains the full validated payload. These presentation limits do
not truncate exported authoring data or relax the 4 MB input contract.
