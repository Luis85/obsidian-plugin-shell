# Vue, TypeScript and maintainability contract

Apply the target repository's rules first. These are prototype delivery expectations,
not permission to add another architecture beside the generated shell.

## Vue and presentation

Use Vue 3 single-file components with `<script setup lang="ts">` and explicitly typed
props, emits and slots. Keep scripts to imports, typed contracts and composable/template
bindings as required by the shell. Put orchestration/view behavior in TypeScript
composables, per-view projections and drafts in Pinia, and injection keys/types in the
existing context layer. Assemble the component tree in bootstrap. Do not introduce
presentation TypeScript imports of SFCs against the repository's boundary checker.

Prefer semantic native elements and actual selected Nuxt UI components over fake visual
lookalikes. Keep component contracts small and reusable. A page-instance edit must not
mutate a reusable definition. Name components by responsibility, use stable domain IDs
for list keys, and preserve instance identity through filters and sorting. Derive values
with computed state rather than unnecessary watcher chains. Do not mutate props or
share mutable fixture objects across independent mounted views.

Every subscription, timer, listener and watcher has an owner and cleanup. Preserve the
shell's lifecycle/disposal semantics rather than inventing a global singleton. Async
results must not update an unmounted/disposed view. Late reads must not overwrite newer
selections or query results. Pending operations need explicit disabled/duplicate rules.
Keep drafts after a failed save; do not announce success before persistence resolves.

Use existing token/scoped-style APIs, local icons and the appropriate target container
for overlays. Focus trapping/return, keyboard actions and menu positioning must work in
the isolated host surface, including narrow panes. A generic browser success does not
prove native Obsidian style containment.

## Pinia and state ownership

Create state per mounted view/runtime, not one application-global singleton. Use
`storeToRefs` or equivalent correct reactive access when destructuring store state.
Store actions coordinate through injected application contracts; canonical persistence
remains in the application/service owner. Forms edit isolated drafts, and explicit
commit/cancel/reset actions have tested semantics. Do not turn a watcher into an implicit
save. Browser storage is an optional adapter, not a parallel source of truth.

Model pending/error/empty/disabled/dirty transitions explicitly. Keep the data model,
UI session state, fixture scenario and portable authoring model separate. Resetting a
clickdummy restores synthetic state, not the user's actual plugin/vault. Test independent
mounts and teardown to expose accidental cross-view state.

## TypeScript

Use the target strict compiler configuration and real Vue type checking. Use `unknown`
at external JSON/storage/provider boundaries and narrow with runtime validation; a type
assertion is not validation. Prefer discriminated unions for explicit states/results and
named types for ports, identifiers and contracts. Avoid `any`, double casts, broad index
signatures, unguarded non-null assertions, `@ts-ignore`, and swallowed exceptions.

Domain/application types must not import Vue, Pinia, Obsidian, browser or Node APIs.
Represent clocks, IDs, persistence, network, dialogs and notifications through the actual
shell/application seams where needed. Favor small pure functions and explicit dependency
injection over convenience globals. Preserve supported schema constraints rather than
silently widening invalid data or silently dropping fields.

## Clean architecture and clean code

Use feature-specific responsibilities behind the shell's shared feature API; do not
patch generic persistence services for each business feature. The composition root wires
ports to adapters. Respect the actual compiler's managed/extension/framework ownership;
generated changes should originate in the authoring model whenever representable.

Choose names from the agreed domain vocabulary. Keep functions focused and make state
transitions and side effects apparent. Comments explain a non-obvious decision/constraint,
not compensate for opaque code. Prefer simple concrete code to speculative abstraction.
Do not build a generalized plugin platform to demonstrate one feature. Maintain the
repository's source-size, lint, analyzer and coverage gates without exclusions that hide
new behavior. Keep source/style assets and custom dependency licenses documented.

## Tests with meaningful assertions

Write a failing behavioral test before implementation. Unit tests exercise pure rules;
service tests exercise real use cases and failure semantics; store/component tests use
real Pinia actions and actual component contracts. Mock host boundaries, not the behavior
you are claiming to verify. With `createTestingPinia`, use `stubActions: false` when
testing actions; default automatic stubs do not establish implemented behavior.

Assert visible results and side effects: exact committed values/write counts, retained
drafts on failure, no success notice after rejection, independent views, cancellation,
disposal and stale-read protection. Test props/emits/slots through public interfaces.
Avoid snapshot-only tests and sleeps without a meaningful readiness condition.

End-to-end tests run against the source-built HTML, with named happy/failure/regression
journeys and real keyboard/pointer input. Check default/loading/empty/error/disabled and
agreed dirty/success states. Include light/dark, narrow width and blocked storage. Keep
advisory visual review, automated assertions, scaffold tests, business acceptance and
native qualification distinct. A TODO or a fake adapter returning success is not proof
of the corresponding business capability.

References: the pinned repository AGENTS/build/tests are authoritative; Vue's testing
guide and Pinia's testing cookbook are linked in execution-and-qa.md.
