# Angular application bricks

Angular generation now emits **AOT-compiled standalone Angular components** from
canonical page and component definitions. It does not load or evaluate user-provided
Angular templates at runtime. User titles, text, props and other values stay escaped
JSON data referenced by Angular bindings.

## Generated source

`src/ui/Starter.ts` owns page selection and the per-view presentation state.
Each page, reusable component and published component revision gets its own
`src/ui/Brick_<identity>_<digest>.ts`. File identities derive from the canonical
identity, not array order or display name; adding or renaming another component
does not renumber these files. `src/ui/brick-runtime.ts` supplies scoped value,
visibility and interaction behavior. Application instances do not share a store.

`src/core/brick-manifest.ts` retains declared routes, ordered journeys, entity
schemas and data-source contracts. These are development inputs, not an invented
backend. `design/angular-capabilities.json` maps identities to sources and lists
specific unimplemented adapters/actions with their definition and node IDs.

## Rendering and behavior

Native elements/text, nested project components, props/defaults, variants, named
slots/fallbacks and pinned immutable revisions render from the shared visual IR.
Stack/row/grid rules use the shared composition-style projection. Narrow layouts
use a named per-view CSS container; spacing/size and available design-system tokens
are projected into scoped component styles. Native attributes and text use Angular
bindings; no `innerHTML`, dynamic JavaScript expressions, JIT compiler or `eval`
is introduced.

Navigation actions select declared pages. Browser targets mirror declared routes
in the URL hash, restore a matching route on reload and handle browser back/forward.
Plugin views do not take ownership of the host window's hash. The root view removes
its hash listener on destruction. State actions, visibility, toggle, focus and
component emits use the current component instance scope. An empty action displays
an explicit implementation-required notice instead of pretending it succeeded.

Nuxt UI and external component implementations are **not silently substituted**
with a different widget library. They render an adapter-required notice, and the
capability report identifies them. Live-source expressions/actions need an explicit
provider implementation; generation does not call services, manufacture credentials,
or assert business acceptance. The native project components created by the maker
work without Nuxt UI adapters.

## Continued authoring

Use `sketch`, the existing Companion editor, or typed application documentation to
edit the canonical model. Then review `sketch generate` and apply its current hash.
The ownership-aware writer preserves matching resolved dependency locks and refuses
to overwrite hand-edited generated source. Reconcile source changes deliberately;
this is not automatic source-to-model synchronization.

The generated application can be modified directly as normal Angular source. Those
changes remain owned by the developer and require reconciliation on regeneration.
Design source remains in the configured canonical project JSON and the generated
`design/project.json` snapshot.

## Acceptance

The Angular setup qualification workflow now checks repeated reusable component
instances, the rendered grid, a declared state-changing button, URL hash navigation,
reload and the renamed page after regeneration, in an actual browser on each
supported CI operating system. Workflow existence is not proof of a passing run.
Local unit/source checks and actual AOT build checks are separate from that browser
acceptance and from the user's business acceptance.
