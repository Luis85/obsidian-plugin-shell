# Build a feature on the template

Start in `src/features`, not in the persistence adapters. For a generated starting
point, run `npm run make -- feature bookmarks --entity bookmark --dry-run`, review,
then apply with `--yes --no-interaction`. See [Authoring tools](AUTHORING-TOOLS.md).
The manual steps below explain the same ordinary editable source. The template provides
typed definitions, validation helpers, document rendering, safe repository CRUD,
events, preferences, diagnostics and view lifecycle. Write your business rules
against those services. Task and Project are worked examples you can replace.

The [framework guide](FRAMEWORK-GUIDE.md) maps the complete authoring surface and
explains owner permits, asynchronous cleanup, protected-storage guidance and
production qualification. Use a captured permit for view-owned note update/delete
operations so closing a view during preflight cannot start a later mutation.

## Define the business data

Create `src/features/bookmarks/entity.ts`:

```ts
import { defineEntity, fields } from '../api';

export const bookmarkEntity = defineEntity('bookmark', 1, {
  title: fields.text({ nonblank: true, min: 1, max: 120 }),
  favorite: fields.defaulted(fields.boolean(), false),
});
```

Input and materialized types are inferred. Required fields are checked at runtime;
defaults apply only when absent. `false` and `0` remain meaningful. Unknown fields
are rejected. An entity does not need a Markdown representation.

## Add an optional document recipe

Create `src/features/bookmarks/definition.ts`:

```ts
import { defineDocument, defineNoteFeature, heading } from '../api';
import { bookmarkEntity } from './entity';

export const bookmarkFeature = defineNoteFeature({
  defaultFolder: 'Bookmarks',
  document: defineDocument(bookmarkEntity, {
    mappings: [
      { field: 'title', property: 'title' },
      { field: 'favorite', property: 'favorite' },
    ],
    title: value => value.title,
    body: value => `# ${heading(value.title)}\n\n## Notes\n\n`,
  }),
});
```

The mapping is explicit. Every persisted entity field must be represented, so
registration cannot silently discard values. The template supplies stable IDs,
schema/creation metadata, safe filenames, YAML serialization and revision checks.
Your recipe owns the initial body. Later entity updates preserve handwritten
content and unrelated frontmatter rather than regenerating that body.

## Register once

Import the feature in `src/bootstrap/features.ts` and add one entry to the existing
registration callback:

```ts
bookmark: register(bookmarkFeature),
```

The callback returns an inferred repository map: `services.repositories.bookmark`.
Repository dependencies and disposal are supplied once by bootstrap. A live folder
preference can be supplied as `register(bookmarkFeature, () => currentFolder)`.
Do not change `main.ts`, native/browser adapters or the repository implementation.

## Call the service from a business action

```ts
const bookmarks = services.repositories.bookmark;
const plan = bookmarks.prepare({ title: 'Plugin ideas' }, 'new-bookmark-1');
if (plan.ok) {
  // Show plan.value.markdown/path, then await the user's create action.
  const created = await bookmarks.commit(plan.value);
  if (created.ok) {
    const updated = await bookmarks.update(created.value, {
      ...created.value.values,
      favorite: true,
    });
    // Inspect updated.ok before using updated.value.
  }
}
const listed = await bookmarks.list();
```

`get(path)` reads a validated snapshot. `delete(snapshot)` is an explicit reversible
trash operation. For an already-confirmed command, `create(values, requestId)`
combines preparation and commit. Result failures are data: show a useful message,
retain drafts, and reload/review stale records. Never retry uncertain writes under
a new identity. Reuse the template's typed facts for committed changes, direct
calls for requests/results, and diagnostics for contained failures.

For UI, inject only the services/repositories that your feature consumes and keep
drafts in its view/store. The existing showcase context is an example, not a
requirement to place every plugin feature into that demonstration screen.

## Verify the extension

Test your actual actions against the same repository and codec. Assert persisted
bytes and failure effects, not only a success notification. The template's feature
registration tests demonstrate an independent third entity without modifying the
shared infrastructure. For code that talks to Obsidian directly (commands, views,
settings tabs, vault/metadata listeners), use the in-memory
[Obsidian test kit](../testing/OBSIDIAN-TEST-KIT.md) instead of hand-written mocks.
Then run `npm run verify` and relevant served/native tests.

Keep source files under 400 code lines (tests/helpers 450, lifecycle main 100),
excluding comments/blanks, and name files for their responsibility. The complete
maker catalog is described in [Authoring tools](AUTHORING-TOOLS.md). Choose
[plugin-data entities](PLUGIN-DATA-ENTITIES.md) explicitly for records belonging in
plugin data; keep note-backed values exclusively in Markdown. Setup identity/resume
and fixed-candidate release rehearsal are separate commands.
