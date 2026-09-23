# Creating entity-backed Markdown documents

> **Status:** Retained full developer-facing target for PRD 0.4. Creation exists
> since iteration 01; iteration 03 implements a bounded entity/repository API.
> The original builder shapes below retain the complete target. Use the
> [authoring guide](BUILD-A-FEATURE.md) and [maker/catalog commands](AUTHORING-TOOLS.md)
> for the implemented signatures and supported recipes. Broader maker variants
> remain planned; the iteration guide states exact scope.

The [DocumentCreationService contract](../architecture/DOCUMENT-CREATION.md) covers validation, safe writes, events, failure behavior, and tests. This guide explains the short developer path.

## 1. The idea

Define the **entity** once: its field types, defaults, required values, and business validation. Define its **document representation** separately: destination, filename, frontmatter projection, and body. Call the shared service with entity values; do not build YAML strings or call native file APIs in each feature.

For a Todo plugin, each Task can be a normal Markdown note. Its frontmatter contains structured fields; its body holds notes or other free-form Markdown. The file is the persisted record, not an export of a separate authoritative Task database in `data.json`.

The template supplies the creation foundation, not a complete Todo application or automatic compatibility with another task plugin's schema.

## 2. Generate the starting point

After the guided setup and an existing `tasks` feature, the intended command is:

```sh
npm run make -- entity task --feature tasks --document
```

The entity maker asks for supported fields/defaults/validation and document choices. A Task preset supplies the small recipe below. It generates ordinary source and tests through the existing maker plan engine, not actual user notes.

Expected generated responsibilities include a domain entity definition, an application document definition, explicit registration, a creation action or selected existing action integration, type/validation/serialization tests, and a Markdown fixture. An optional form reuses the native modal, localization, and `make style` recipes. No business logic enters `main.ts`.

Use `--dry-run`, maker-specific `--help`, and the existing noninteractive/JSON conventions. A repeated maker invocation must not overwrite a definition you have edited.

## 3. Define Task values

The intended definition-builder shape is:

```ts
export const TaskEntity = defineEntity({
  key: 'task',
  schemaVersion: 1,
  fields: {
    title: fields.text({
      required: true,
      trim: true,
      minLength: 1,
      maxLength: 120,
    }),
    status: fields.enum(['todo', 'doing', 'done'], {
      default: 'todo',
    }),
    due: fields.date({ optional: true }),
    tags: fields.textList({ default: [] }),
  },
});
```

The implementation must provide real typed helpers/imports and infer create-input/materialized-output types from the definition. The snippet is an API contract, not permission to create another large validation framework. Reuse the selected shared validation implementation.

`type`, stable `id`, and persisted `schema_version` are managed by the registered entity/document policy in the Task recipe. They are not freely supplied by a modal. `due` accepts a valid date-only input and remains a calendar date, not a UTC instant. Unknown fields and invalid enum values fail before any file or folder is created.

Defaults apply when a value is absent. Optional due dates are omitted when absent. The same approach must preserve meaningful `0`, `false`, and explicitly allowed empty values in other entities; do not implement defaults with a blanket truthiness check.

## 4. Define the Markdown representation

The corresponding intended application definition is:

```ts
export const TaskDocument = defineDocument(TaskEntity, {
  templateId: 'task-note',
  defaultFolder: 'Tasks',
  folderSetting: 'taskFolder',
  filename: '{title}.md',
  frontmatter: [
    'type',
    'id',
    'schema_version',
    'title',
    'status',
    'due',
    'tags',
  ],
  renderBody: ({ entity, markdown }) =>
    `${markdown.heading(1, entity.title)}\n\n## Notes\n`,
});
```

The allowlist is deliberate: adding an internal field to Task must not silently expose it in frontmatter. The actual helper contracts must validate mapping keys, managed fields, and supported serialized values. More complex entities can explicitly map an internal field to a different stable property name; arbitrary object spreading is not the mapping strategy.

The projected title becomes the filename verbatim, followed only by `.md`. The service does not slugify, lowercase, trim, normalize Unicode or append an ID. Unsafe filenames fail validation, and identical or case-only conflicting paths fail without overwrite or automatic suffixing. The ID remains the durable frontmatter identity. A title is never interpreted as a destination path; folder settings stay separately validated. Existing notes keep their path when updated, including notes created under the earlier ID-suffixed policy.

The body renderer owns body content only. The service owns YAML serialization and its delimiters. The heading helper escapes plain text rather than treating a user's title as arbitrary Markdown syntax. Body labels can follow an explicit document-creation language policy; schema keys and enum values are not translated when the UI language changes.

Register the entity and its document definition through the composition registry. Domain files remain unaware of folders, Obsidian classes, or YAML. The shared DocumentCreationService must not be edited to special-case Task.

## 5. Create a Task note

The intended convenience call is:

```ts
const result = await documentCreationService.create({
  entity: 'task',
  values: {
    title: 'Prepare release checklist',
    due: '2026-09-30',
    tags: ['work', 'release'],
  },
  requestId: submissionId,
});
```

`submissionId` belongs to this form submission and stays stable across an in-flight retry. A deliberate new Task uses a new request. The service validates inputs, applies defaults and managed identity, maps the frontmatter, renders the body, validates the destination, and performs one complete native create operation.

An example result file, using a deterministic fixture ID, is:

```markdown
---
type: task
id: task-example-001
schema_version: 1
title: Prepare release checklist
status: todo
due: "2026-09-30"
tags:
  - work
  - release
---

# Prepare release checklist

## Notes
```

Its illustrative path is `Tasks/Prepare release checklist.md`. The fixture ID is stored in frontmatter and is not part of the filename or a prescribed production ID format. The serializer's qualified stable output controls exact quoting/formatting; tests additionally verify property meanings through host parsing.

A successful receipt includes entity key/ID, schema version, vault-relative path, and effective values. It does not expose `TFile`. Presentation may then request to open the note through the native navigation adapter. If opening fails, the note still exists and creation must remain successful with an accurate follow-up message.

No complete Task object or note body is copied to application diagnostics or automatically published in an event payload.

## 6. Preview and confirmation

`prepare(request)` returns the actual rendered Markdown, proposed path, managed ID/defaults, and definition/config revision without writing. The UI displays a read-only preview. `commit(plan)` uses the same values after revalidating the plan and destination.

Do not call `create(request)` again after preview if that would generate a different ID or content. The convenience `create` method is for the no-preview path and internally uses the same prepare/commit pipeline.

Cancelling before commit creates nothing. A target/schema/config change can make a plan stale; return an actionable result rather than silently creating a document different from the one reviewed. A disabled Create button prevents casual double clicks, but service-level request tracking is still required for callers outside that form.

## 7. What happens on failure

| Situation | Expected behavior |
| --- | --- |
| Empty title, invalid due date, unknown property | Field-addressable validation error; no file/folder/event. |
| Unsafe path or protected destination | Reject before writing, with a safe explanation. |
| Folder path is occupied by a file | Folder conflict, not an overwrite. |
| Destination already exists | Conflict by default; never modify or delete the existing note. |
| Explicit suffix policy and confirmed collision | Bounded safe retry; no retry for an unrelated storage error. |
| Same submission reaches the service twice | Coalesce in-flight work or return its verified prior receipt within the documented session window. |
| Same request ID with different values | Reject mismatched reuse. |
| Write may have succeeded but its outcome is uncertain | Report the candidate identity/path for reconciliation; do not create a second filename blindly. |
| Modal closes while host write is already running | Guard disposed UI and report actual outcome; do not delete a successfully written note. |
| Note created but opening/listener fails | Keep creation success; report follow-up failure without re-creating the file. |
| Metadata cache has not caught up | Use the typed receipt; do not conclude creation failed. |

The service does not promise persistent exactly-once behavior across application restarts, other plugins, or devices. Nor does a per-plugin queue create a cross-process filesystem transaction.

## 8. Events and canonical data

After confirmed creation, the service publishes the typed `documents.created` event with entity key/ID, schema version, path, and safe correlation data. It emits nothing of that kind for preview or failed writes, and does not emit another creation event when returning a known prior receipt.

The native bridge may also report `host.vault.entry-created`. A view must not count those as two new Tasks or assume a particular event/cache order. Use the canonical service event for this flow and generic host changes for a deliberately designed invalidation/reload path. The bus never becomes the Task store.

`data.json` stores plugin preferences such as `taskFolder`. Task data lives in Markdown. A future Todo list/index must read these records as its source of truth and define how manual edits are validated; creation alone does not implement that query/synchronization system.

Updating an existing Task is a separate capability. It must respect edited bodies and unrelated properties rather than call create again or overwrite the whole file from an old in-memory entity.

## 9. Extend beyond Task

A Meeting can define subject, meeting date/time, attendees, and a Notes/Decisions body. A Project can define name, status, a numeric budget, and a boolean archived field. Each has its own validation and document mapping, but uses the same service, renderer, and host writer.

Do not silently give a shared property name different host types in each entity. In Obsidian, an assigned property type applies by name across the vault. Local entity metadata does not register a host type; use consistent names or deliberate namespacing and test actual Properties UI behavior. [Research D01](../research/2026-09-22-entity-documents.md)

A domain entity without a Markdown representation remains possible: leave off the document recipe. Document-backed entities do not imply that all runtime state must become notes.

## 10. Development checks and styles

The intended commands extend existing tooling:

```sh
npm run make -- entity task --feature tasks --document
npm run entities:check
npm run entities:catalog
npm run verify
```

The first command scaffolds source only. The check validates definitions/mappings/defaults/type conflicts; the catalog is derived documentation, not a second editable schema. All implementations live in `scripts/` and share existing maker/quality infrastructure.

Task form/preview CSS follows the existing modular source pipeline. A generated style module is registered once and composes into `styles.css`, including any Vue scoped styles. No extra stylesheet assembler or event bus is needed for this feature.

Test the real Markdown emitted by the service, not only a mocked successful creation result. Cover invalid dates and managed-field overrides, quoting, no-write preview, stale plans, collisions, duplicate submissions, cancellation, raw-host/service-event overlap, delayed indexing, and failed open actions. Then confirm native Properties and Source views on the claimed platforms.

A generated definition and passing skeleton tests are not a completed Todo app. The required creation service is complete only when its actual code and native/harness evidence satisfy [DOC-01–20](../architecture/DOCUMENT-CREATION.md).
