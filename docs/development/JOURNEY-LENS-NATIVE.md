# Journey Lens in generated native plugins

This implementation connects the maintained Vue 3 / Nuxt UI / Vue Flow editor to
a generated plugin. It does not wrap the prototype HTML or infer an editor engine
from a static page design. Native-host acceptance remains a separate executable
check; see [implementation and evidence](../testing/JOURNEY-LENS-NATIVE-IMPLEMENTATION.md).

## Declare the editor

A validated project v6 may opt a page or view into the built-in editor:

```json
{
  "design": {
    "editors": {
      "schema": 1,
      "bindings": [
        { "surface": "existing-sitemap-surface-id", "editor": "journey-lens" }
      ]
    }
  }
}
```

This is a fragment, not a complete project. Use an existing page/view ID and keep
all other project fields. The schema accepts only the named built-in editor, not
URLs, script bodies, arbitrary packages or filesystem entrypoints. Ordinary
projects without a binding retain the previous generator behavior. The modern
Companion self-project declares the binding automatically. Only project schema 6
is read; earlier formats are rejected, never migrated.

Generate using the normal reviewed command:

```sh
node bin/app new ../folio-tools --from ./project.companion.json
node bin/app new ../folio-tools --from ./project.companion.json --apply <reviewed-plan-hash>
cd ../folio-tools
npm ci
npm run verify:project
npm run dev:obsidian -- --allow-download
```

Use the repository-qualified Node/npm and locked TypeScript 6. Do not activate a
candidate in a personal vault as a substitute for its isolated acceptance tests.
The generated `JOURNEY-LENS.md` describes the local workflow. The
`design/journey-lens.json` receipt identifies the capability; it does not certify
native acceptance or fulfill unrelated PRD requirements.

## Native file workflow

The initial path is `project.companion.json`, relative to the test vault. **Open
file** only reads: a missing or malformed file is never automatically created or
repaired. Visible portable `.json` and `.companion` paths are supported; the
parent folder must already exist. Hidden/system paths and traversal are refused.

For a new file, choose **Create from generated definition**. For an existing
export, use **Import project JSON**, select a file or paste its contents, then
**Validate and review**. Approve the complete write before applying. Create mode
never overwrites an existing file. Replace mode requires an opened file and its
reviewed exact previous bytes. Changing the input, destination or mode invalidates
the review. Imported JSON remains inert data.

Each applied editor command validates and saves the whole canonical project.
Unrelated page/component definitions, requirements, source contracts and tooling
options are preserved. **Export project** returns that last saved project, not
unapplied field values. The chosen path is remembered within the plugin runtime,
not across application restarts. Reopening the file restores committed edits.

## Editor operations

Structure, Navigation and Journey views use the same canonical surfaces and links.
Create/rename/reparent/reorder surfaces; position numerically or drag; arrange only
with explicit review; use search, outline, inspector and focused canvas. Arrange
changes geometry, not containment, routes or actions. Undo/Redo use the same
revision-checked write path.

Routes can be added, edited and removed. Navigation actions can be created,
renamed, retargeted, reclassified and removed. Removal checks references first;
references outside the sitemap are not silently rewritten. Deleting or changing a
referenced action retains affected journey steps as unresolved history until the
author deliberately repairs them.

Journeys can be created, renamed, edited and removed. Surviving journey/step IDs
remain stable. Repeated surfaces are separate steps. Up/Down controls provide a
non-drag alternative. Multiple candidate actions and conditional actions require
explicit selection; a conditional label is planning intent, not executable logic.

## Independent leaves and recovery

One plugin-scoped file owner serializes cooperative writes. Each view has its own
draft, selection and undo history. Native writes use `Vault.process` with a
synchronous exact-byte comparison. Another leaf's save or an external file change
invalidates stale approval; it does not silently merge or discard that leaf's draft.

An uncertain native write blocks further writes to that file. **Review recovery**
can export the current draft and explicitly reload/validate the actual saved file.
Only a successful read resolves uncertainty. Invalid or missing saved data remains
untouched. A downloaded draft can be restored only to its matching canonical
revision. Restoring replaces the current leaf's unsaved draft; export it first.
Closing a view discards a draft that was not exported. No crash-persistent draft
journal or cross-process filesystem transaction is claimed.

## Browser preview

Generated clickdummies use the same editor with an explicitly labelled memory-only
file store. Native adapters do not enter its dependency graph. Export JSON to retain
browser edits. Reset/closing the preview discards them. Static page scenarios and
the generic preview-state override are unavailable on an editor-bound surface:
they must not impersonate the editor's real state or authored dataset.

## Implementation and verification

The maintained interface stays in `docs/concepts/companion/editor/`. The generator
relocates its imports into the consumer, provides the same Vue Flow runtime through
an explicit injection, and creates native and memory-only composition roots. It
preserves reviewed vendor notices and exact runtime/CSS hashes; no second Vue,
runtime CDN, new dependency or font binary is introduced.

`JourneyProjectStore` is the framework-independent whole-project owner;
`journey-vault.ts` is its public Obsidian adapter. Per-view state lives in the editor
and workspace composables. Generated files retain existing ownership rules:
consumer edits survive replay or produce an explicit conflict, never a silent
replacement. Export and regenerate through the ordinary CLI plan/apply flow.

The generated native tests are selected with:

```sh
npm run test:obsidian -- --allow-download journey-lens
```

The new hosted job independently generates the modern Companion, installs/builds
it, then runs create/edit/reload and two-leaf conflict tests in isolated native
fixtures. Source/runtime tests, browser tests, native tests and manual accessibility
checks are distinct evidence layers. Their presence is not evidence of a pass.
Adjacent page/component/source editor navigation still reaches those screens'
existing implementations; this change does not implement the complete native
Companion or grant publication approval.
