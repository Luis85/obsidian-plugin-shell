# Presentation concerns

Vue single-file components own markup and minimal bindings. TypeScript composables
own screen behavior and lifecycle, and per-view stores own state shared between
panels. Application services remain responsible for canonical data, validation,
persistence and committed outcomes.

```text
src/presentation/
  components/
    ShowcaseApp.vue
    panels/
      DocumentPanel.vue
      EventsPanel.vue
      OverviewPanel.vue
      SettingsPanel.vue
      TaskRepositoryPanel.vue
  composables/
    use-document-form.ts
    use-settings-form.ts
    use-showcase-actions.ts
    use-showcase-shell.ts
    use-task-repository.ts
  context/
    showcase-context.ts
    use-services.ts
  stores/
    showcase.ts
```

An SFC imports UI components, declares props, acquires its Pinia store explicitly
and destructures the composable values used by its template. It does not hide the
store behind a returned composable alias; this makes the binding and its actual
member usage visible to readers and static analysis. Behavior composables can use
the same per-view store instance for their actions. Small static display metadata and localization bindings may
stay there. Save/load functions, watchers, failure handling, subscriptions, timing
and mutable state belong in TypeScript. Normal `<script setup lang="ts">` bindings
remain local; external `script setup src` blocks are not used.

The repository composable owns selection, edit drafts, stale-folder invalidation
and guarded asynchronous completion. The settings composable preserves local
drafts while merging clean fields after another view saves. Showcase actions bind
the shared event/notification/modal services. The shell composable owns rendering
failure containment and locale selection. The document composable owns preview
and field focus; committed write orchestration stays in the existing per-view
store and application service.

The context contract is a type-only module. Its separate Vue-facing module owns
the injection key and lookup. Neither contracts, composables nor stores import
Vue component files. Bootstrap assembles the root component and injects the actual
services; components compose other components through explicit imports.

For a new feature, start with its framework-free entity/document definition under
`src/features/<name>`. Add a composable only when presentation behavior is needed,
then a small SFC under `components` (or `components/panels`). Do not move business
validation into a screen controller. Current note makers generate definitions,
repository registration and tests; they do not silently generate a new UI tree.

`npm run check:presentation` parses the real SFC and TypeScript syntax. It rejects
misplaced files, imperative SFC script behavior and reverse imports from state
modules into SFCs. Actual failing CLI fixtures prove those checks. Existing strict
type, lint, architecture and source-size gates remain in force.

Composable tests instantiate real services, a real Pinia scope and generic storage
ports. They verify CRUD, draft preservation, disposal and event/feedback ownership
without requiring a template to contain business logic. Component, served-browser
and native tests retain separate responsibility for rendered behavior. The
reorganization preserves template markup, IDs, accessibility bindings and visual
styles; opening a created document additionally has a single-flight guard so a
late opening failure cannot alter a new draft.
