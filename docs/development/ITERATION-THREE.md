# Iteration 03 — reusable entities and note repositories

This guide describes the implemented candidate APIs. Consult
[the verification record](../testing/ITERATION-THREE.md) for executed checks and
[the plan](ITERATION-THREE-PLAN.md) for scope; implementation is not a claim that
every native/device/release qualification has passed.

## Template responsibilities

The shared foundation owns input validation, explicit document projection,
preview/commit, safe storage operations, revision checks and committed events.
Task demonstrates it with title, status, due date and tags. Project demonstrates
different field types, including a numeric budget and a boolean archived flag.
Neither example defines its own file writer or duplicate entity database.

An entity is independent of Markdown. Its document recipe is an optional
application concern; the repository uses a storage port so another backend can be
introduced deliberately. This iteration supplies a Markdown-backed repository,
not a plugin-data entity backend or a general database abstraction.

## Define and use an entity

The author-facing entry is `src/features/api.ts`: `defineEntity`, `fields`,
`defineDocument`, `heading`, and `defineNoteFeature`. Put business schemas and
recipes together under `src/features/<name>`. Start with
[Build a feature](BUILD-A-FEATURE.md); the underlying framework-free implementations
remain separated into domain/application layers. Example:

```ts
const project = defineEntity('project', 1, {
  name: fields.text({ trim: true, min: 1, max: 120 }),
  budget: fields.defaulted(fields.number({ min: 0 }), 0),
  archived: fields.defaulted(fields.boolean(), false),
});
const recipe = defineDocument(project, {
  mappings: [
    { field: 'name', property: 'name' },
    { field: 'budget', property: 'budget' },
    { field: 'archived', property: 'archived' },
  ],
  title: value => value.name,
  body: value => `# ${heading(value.name)}\n\n## Notes\n\n`,
});
```

`heading` is available through the same author-facing API. Input/output types
are inferred from the definition. `fields.optional` expresses an absent value;
`fields.defaulted` applies only when absent, preserving explicit `0` and `false`.
Unknown input fields fail validation. The explicit mapping prevents a newly added
internal field from automatically appearing in a note. Schema and property keys
are stable across UI locales.

A repository requires every entity field to be mapped; otherwise it rejects the
recipe before use. A partial projection is valid only for the create-only document
service. `validateDocumentCatalog` checks registered keys and shared property types
in bootstrap, without changing vault-wide Properties settings. `npm run entities:check`
validates the actual registered definitions, and `npm run entities:catalog` prints
their derived catalog. Individual notes are limited to 1,000,000 characters and folder inspection to
1,000 Markdown paths; these fail closed without rewriting data.

Wrap the recipe in `defineNoteFeature({ document: recipe, defaultFolder: 'Projects' })`
and add one `project: register(projectFeature)` entry in `src/bootstrap/features.ts`.
Shared dependencies and lifecycle are supplied once by the factory; feature authors
do not construct repository plumbing. The inferred map exposes
`services.repositories.task` and `.project`. Project's example destination is
`Projects`; Task follows the shared preference. Infrastructure continues to
implement framework-free ports behind that seam.

```ts
const repo = services.repositories.project;
const preview = repo.prepare({ name: 'Release', budget: 0 }, 'review-1');
if (preview.ok) {
  // Display preview.value.markdown/path; confirm before this call.
  const created = await repo.commit(preview.value);
  if (created.ok) {
    const changed = await repo.update(created.value, {
      ...created.value.values, archived: true,
    });
    // Explicit later deletion uses repo.delete(changed.value), after confirmation.
  }
}
const rows = await repo.list();
```

Every operation returns a typed `Result`; callers must inspect failure before
reading `value`. `create(values, requestId)` is the direct no-preview equivalent
for already-confirmed application commands. `get(path)` validates the same folder
inventory as `list`. `discard(plan)` releases only unused previews, and `dispose()`
ends the repository runtime. Generic services never import either example.

The original showcase creation facade remains source-compatible for its form:
`parseTask` converts comma-separated text into the typed Task entity. The repository
accepts real tag arrays and `todo | doing | done` status. A new feature should use
the definition/repository API rather than copy that form-specific adapter.

## Existing notes and concurrency

Existing schema-one Task files remain canonical and are read without migration.
Loading and listing perform no writes. Deliberate updates keep the same ID/path,
creation time, handwritten body and unrelated frontmatter. Changing a title does
not rename the file or regenerate the original heading.

Update/delete operate on a last-read snapshot. An edit by another view or external
tool makes that snapshot stale; reload and review before submitting again. Do not
copy values into a new note as automatic error recovery. Unknown future schemas
and corrupt records are preserved for inspection rather than repaired silently.

Native updates compare bytes in Obsidian's coordinated processing callback.
Native deletion uses reversible vault trash after a revision check. Obsidian does
not provide a cross-process compare-and-trash transaction, so an external writer
can still race the final trash call. Runtime queues do not synchronize devices or
other plugins. The browser harness uses synthetic browser storage and cannot
establish native filesystem guarantees.

## Source conventions

Executable files describe what they do: for example,
`tests/e2e/layout-and-header.spec.ts` and
`.github/workflows/candidate-qualification.yml`. Iteration guides and verification
records retain iteration names because those names describe their historical scope.

LoC limits measure nonblank code lines, excluding comments, across each complete
file including Vue template/script/style regions. Budgets remain 400 for source,
450 for tests/helpers, and 100 for lifecycle-only `main.ts`. Physical counts are
retained for diagnostics and immutable vendor provenance. The dependency-free
scanner preserves comment-like text inside strings, templates and regex literals;
source limits apply before bundling/minification.

## Authoring, setup and runtime services

The iteration now includes [reviewed identity setup/resume and contained data migration](SETUP-IDENTITY.md),
[note-feature/entity makers and derived catalogs](AUTHORING-TOOLS.md), and
[eight host mappings plus owned notification timing/queues/actions](RUNTIME-SERVICES.md).
The author-facing runtime also includes [commands and ribbons](COMMANDS-AND-RIBBON.md),
[dedicated modal/notice services](MODALS-AND-NOTICES.md), and
[structured logging/debugging](LOGGING-AND-DEBUGGING.md). These APIs share the
template's file/lifecycle contracts; executed qualification is recorded separately.

## Scope that remains pending

The broader view/component/store/command/modal/style/locale/custom-maker catalog,
automatic example removal, additional entity backends and release automation remain
future work. The existing note-feature makers generate real definitions,
registration, tests and Markdown fixtures, not a finished business application.
Expanded Nuxt UI components, mobile/device/accessibility matrices and release
promotion remain separate qualification work.
The [upstream lint dependency exception](ITERATION-TWO-DEPENDENCY-EXCEPTION.md)
also remains open; a clean audit does not establish upstream support.

No personal vault is used, no host permission is changed, and no public release
or listing is created as part of this iteration.
