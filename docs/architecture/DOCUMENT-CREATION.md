# Entity-driven DocumentCreationService

> **Contract:** PRD 0.4 extension, requirements **DOC-01–20**.  
> **Status:** Normative target. Executable creation began in iteration 01;
> iteration 03 extends the template with typed definitions and a separate CRUD
> repository. See the [iteration plan](../development/ITERATION-THREE-PLAN.md).
> Numbered requirements below remain in force; implementation and qualification
> must be read from the relevant iteration record.
> **Purpose:** Define an entity and its document representation once, then create valid, portable Markdown notes through one typed application service.  
> **Related:** [PRD](../product/PRD.md), [developer recipe](../development/ENTITY-DOCUMENTS.md), [makers](../development/SETUP-AND-MAKERS.md), [events](EVENT-BUS.md), [styles](STYLES.md), [research](../research/2026-09-22-entity-documents.md).

## 1. Product behavior

A plugin developer defines a Task with its required and optional fields, defaults, validation, and a Markdown representation. A command, modal, or application use case supplies Task values to `DocumentCreationService`. The service validates them, resolves the configured destination, builds the full document, creates the note through Obsidian, and returns a typed receipt.

```text
Entity definition + document definition + supplied values
                         ↓
       validate → defaults/managed identity → map properties
                         ↓
            prepare complete Markdown and safe path
                         ↓
       optional preview → explicit creation through host port
                         ↓
       typed receipt → documents.created → optional UI opening
```

The first supplied recipe is a Task note with `type`, `id`, `schema_version`, `title`, `status`, optional `due`, and `tags`. These additional defaults are selected template conventions, not a requirement that every downstream product use the same metadata names.

A Task note is a plain `.md` file and remains usable without the plugin. The service is **create-only**, not an ORM, a whole-vault entity database, an automatic migration engine, or a complete Todo app. Existing-note updates, indexing, queries, synchronization, bulk transactions, attachments, and arbitrary template-language execution are not required for v1.

## 2. Define entities separately from their documents

**DOC-01 — Typed entity definition.** Provide a small explicit `EntityDefinition` contract with a stable entity key, positive schema version, allowed input fields, field types, required/optional rules, defaults, validation, and materialized output. Types for create input and output must follow that definition rather than unrelated manually drifting copies. Use the template's shared runtime validation approach; do not add a second independent schema engine for this service.

Definitions are checked-in developer code, registered explicitly. There is no class reflection, decorator discovery, runtime scan of source folders, or execution of schema code read from notes. A domain entity definition contains no Obsidian, Vue, filesystem paths, or YAML-library dependencies.

**DOC-02 — Input and managed values.** Distinguish user-supplied fields from service/definition-owned values. The Task recipe supplies `type: task`, the schema version, and a generated stable ID; callers cannot override them through arbitrary frontmatter. Defaults apply to absent values, not every falsy value: preserve valid `false`, `0`, and explicitly allowed empty strings/lists. Omit absent optional fields. Accept `null` only when the declared field explicitly allows it. Reject invalid dates, enum members, unknown fields, and unsupported values before any write.

ID/time providers are injected. Generate managed values once for a prepared request; preview and commit of the same plan use those same values. Do not confuse an event ID, request ID, and entity ID.

**DOC-03 — Explicit document definition.** A separate `DocumentDefinition` references the entity and defines the destination policy, filename policy, allowed frontmatter projection/mappings, property order, and body renderer. Only declared properties are persisted; never spread an arbitrary entity or caller object into YAML. Internal fields may be excluded or mapped to stable property names. Reject duplicate output keys, protected managed-field overrides, and dangerous object keys such as `__proto__` or merge-control keys.

One default document definition per note-backed entity is sufficient for v1. Duplicate defaults fail registration. Domain entities need not all have a note representation. Rich domain objects require explicit conversion to supported frontmatter values; the document service does not serialize class internals automatically.

### Task recipe

| Property | Source / type | Rule |
| --- | --- | --- |
| `type` | Managed text | Fixed to `task` by the recipe. |
| `id` | Managed text | Stable generated identity, separate from path/title. |
| `schema_version` | Managed integer | Starts at 1; describes the persisted representation. |
| `title` | Input text | Required, trim surrounding whitespace, 1–120 characters. |
| `status` | Input enum | `todo`, `doing`, `done`; default `todo`. |
| `due` | Optional date-only string | Valid calendar date `YYYY-MM-DD`; omitted when absent. |
| `tags` | Input list of text | Default empty list; explicit tag validation, no implicit scalar-to-list coercion. |

The default folder is `Tasks`, configurable through validated plugin preferences. Creation uses the projected document title verbatim followed by `.md`: case, spaces and Unicode are preserved, with no slug conversion or appended ID. The stable ID remains in frontmatter. An existing same-title path (including a case-only alias) is a conflict: do not overwrite or choose an automatic suffix. Unsafe, reserved or oversized filenames fail validation rather than silently changing the title. No document is created merely by registering this definition.

The service preserves exactly the title returned by the document definition. A business entity may explicitly normalize values before projection; that policy must be visible to its author. The Task example and newly generated entities preserve title spelling while rejecting blank values. Filename validation rejects separators, control characters, Windows-reserved characters/device names, leading dots, trailing spaces/dots, invalid Unicode and names exceeding 255 UTF-8 bytes including `.md`. Updates retain the existing path even when a title field changes; no automatic rename or migration of earlier ID-suffixed notes occurs.

Collision checks compare NFC-normalized, case-insensitive names to reject canonically equivalent Unicode aliases, including folder aliases. Comparison never changes the proposed or stored path bytes. Native creation inspects only immediate siblings through the host's existing folder tree; it does not enumerate the vault.

## 3. Property semantics and serialization

**DOC-04 — Obsidian-friendly values.** The initial property model supports text, finite numbers, booleans, date-only values, explicitly formatted date/time values, and simple lists; enums serialize as validated scalars. Links are declared text values and must be serialized safely. Keep default frontmatter flat; do not require nested YAML objects to be editable in Obsidian's Properties UI. Honor the list conventions for `tags`, `aliases`, and `cssclasses`. [D01]

Entity schemas do not configure global Obsidian property types. Obsidian applies a property name's assigned type across the vault. Detect contradictory type declarations within the registered entity/document catalog; do not silently rewrite host type settings for the rest of the vault. Where the public API does not expose a reliable check, document the limitation and provide a manual/native acceptance check rather than accessing a private property manager. Type hints and UI controls are not proof that the host registered a type. [D01]

**DOC-05 — One safe YAML codec.** Use a real serializer, not string interpolation of `key: value` lines or ad-hoc quoting. The proposed baseline is the browser-capable `yaml` package, pinned and bundled as a runtime dependency behind the renderer contract. Use the same implementation in the plugin and harness; qualify its size/runtime/host-parser behavior before implementation completion. [D05]

The managed frontmatter block begins at the start of the generated file, uses deterministic LF line endings and stable key ordering, and is followed by a blank line and body. Preserve scalar meanings through round-trip tests, including quotes, colons, hashes, brackets, backslashes, Unicode, boolean-like text, numeric-looking identifiers, and delimiter-like strings. Disallow executable/custom YAML tags, implicit object serialization, unintended anchors/aliases, nonfinite numbers, functions, cyclic objects, and unsupported prototypes.

A date-only due value is a calendar date, not a timestamp. Do not turn it into UTC with `new Date(...).toISOString()` or shift it with the UI language/timezone. Validate real calendar days, including leap years. A declared datetime needs an explicit timezone/format policy, separate from date-only. Serialization may quote a date scalar; actual host property behavior must be tested, not inferred solely from YAML parsing.

## 4. Architecture and public API

**DOC-06 — Application service with narrow ports.** `DocumentCreationService` belongs in application code. It consumes explicit definitions plus injected validation/materialization, renderer, safe path policy, clock/ID, document-writer, and event-publication capabilities. Keep these dependencies small and reuse existing template services rather than wrapping every function in a new abstraction.

```text
src/
  domain/tasks/task.entity.ts
  application/documents/
    document-creation-service.ts
    document-definition.ts
    document-writer.ts
  application/tasks/task.document.ts
  infrastructure/documents/yaml-markdown-renderer.ts
  infrastructure/obsidian/documents/obsidian-document-writer.ts
  bootstrap/entities.ts
```

The writer adapter alone handles `TFile`, `TFolder`, `Vault`, and native operations. Application/presentation receive plain typed receipts, never an Obsidian object. A fake writer stores actual Markdown text for tests; it must not replace the service/renderer by a mock success response.

**DOC-07 — Correlated request types.** The canonical convenience API is `create({ entity, values, ...options })`. Use a registry-derived discriminated union so an entity key stays correlated with its input and result type. A Task cannot silently accept a Project payload. Narrow feature facades may bind the entity while calling the same implementation. Runtime validation remains mandatory for JavaScript, widened objects, stored input, and future integrations; TypeScript structural typing is not an all-input exactness guarantee.

`create` returns a typed result: created receipt, a verified same-request prior receipt, or a categorized failure. A successful receipt identifies entity type/ID, schema version, vault-relative path, and the effective typed values needed by the caller. It contains no live host object or implicit navigation side effect.

**DOC-08 — Prepare, preview, and commit.** In addition to `create(request)`, expose `prepare(request)` and `commit(plan)` for preview/review workflows. `create` delegates to those stages; there are not two creation implementations. Preparation validates and materializes an immutable plan with the actual managed values, rendered Markdown, intended path, and definition/config revision. It creates no folders/files, opens no view, and emits no created event.

Commit revalidates the plan's integrity, definitions, destination policy, and relevant path preconditions. Read-only preview is not authority to overwrite a changed target. A changed schema/config/path requiring different bytes returns a stale/conflict outcome or requires a newly reviewed plan; do not silently create a different document than previewed. An in-memory plan is not a credential, and TypeScript branding alone is not runtime validation.

## 5. Body and destination policies

**DOC-09 — Body-only templates.** The renderer combines serializer-owned frontmatter with a developer-defined body. A body renderer is trusted checked-in code or supported data-only content, not arbitrary code evaluated from a user note, YAML expression, or downloaded template. Helpers escape plain user text when inserting it into headings or other Markdown structures. Explicit user-authored Markdown may be accepted as body content, but it is never parsed as property overrides and never executed as a template.

The document definition owns the initial layout; `DocumentCreationService` must not hardcode Task headings. UI locale and persisted schema keys/enum values are separate. Body labels may use a chosen creation locale, captured in the prepared plan; a later UI-language change does not rewrite existing notes. Generated title headings are initial presentation, not a second automatically synchronized title field.

**DOC-10 — Safe vault-relative destination.** Resolve only inside the active, approved vault and the definition/configured allowed folder. Reject absolute paths, drive/UNC paths, URLs, traversal, control characters, unsafe/reserved names, hidden/protected directories, and the actual `vault.configDir`. Never treat the title as a literal path. Validate before and after host normalization; normalization alone is not a containment policy. Handle Unicode, case-insensitive collisions, trailing dots/spaces, separators, extensions, and tested path-length limits for supported platforms.

Output has exactly one `.md` extension. Folder creation is explicit policy and occurs only after complete validation/rendering at commit. Check file-versus-folder conflicts. Race-safe handling of an already-created parent rechecks that it is a folder. If note creation fails after parents were created, report residual directories and leave them alone by default; recursively deleting them could destroy another actor's work.

## 6. Write and failure guarantees

**DOC-11 — Complete, create-only host write.** The production adapter submits the entire validated frontmatter and body to `Vault.create(path, content)`. Do not create an empty note and then add properties through a second operation. Use supported Vault methods rather than Node filesystem access; preserve mobile capability. The public API exposes `create` and `createFolder` for these operations. [D02]

This is one complete host create call, not a claim of a filesystem-wide transaction, fsync guarantee, sync-service guarantee, or atomic multi-folder operation. The adapter must demonstrate no-overwrite behavior on the supported host and fail closed if it cannot uphold the contract. It never falls back to `modify`, delete/recreate, force replacement, or overwrite after a collision.

Subsequent editing is outside this service. A future edit capability should use the appropriate supported host mutation APIs; `FileManager.processFrontMatter` is specifically provided for changing an existing note's frontmatter. Do not mistake that guidance for a need to create an incomplete note first. [D03, D04]

**DOC-12 — Collision and concurrency.** Default collision policy is error. A separately selected suffix policy may retry only a confirmed collision, with bounded attempts and a freshly validated candidate. A preflight existence check is advisory, not a lock. Serialize conflicting attempts within this runtime, and handle host rejection or another actor creating the target. A per-plugin lock does not synchronize other plugins, external tools, devices, or Obsidian Sync.

**DOC-13 — Duplicate submission and uncertain outcomes.** Support an optional caller-stable `requestId` for one submission. Within a documented bounded in-process window, the same entity/values/options/request coalesces an in-flight attempt or returns its verified prior receipt; changed input under the same key is an error. The form retains its request ID during retry instead of generating a new ID on every click. Deliberate new creation uses a new request and can produce another Task with the same title.

This is not persistent exactly-once delivery across crashes or devices. If a write outcome is uncertain, report the candidate path/identity for reconciliation and do not blindly retry under a new filename. Treat an existing file as this request's prior success only when identity and recorded evidence establish ownership; never assume that any file found after a write error was created by this request. A stale receipt does not justify rewriting a moved or manually edited document.

**DOC-14 — Cancellation and lifecycle.** Cancellation before commit creates nothing. After a host write has started, cancellation may not stop it; do not delete a successfully created file merely because a modal closed. Resolve/report the actual created/failed/uncertain outcome, guard late updates to disposed views, and prevent a cancelled consumer from triggering a second creation. Plugin unload is not a safe rollback mechanism. The service does not depend on the host awaiting an arbitrary unload promise.

**DOC-15 — Distinguish success from follow-up work.** Successful creation does not guarantee MetadataCache indexing, a view refresh, opening the file, or a later sync operation has completed. Return the effective values from the prepared/written document and the adapter result, not an immediately reread cache. [D02]

Opening is a separate explicit presentation/application action. If opening or an event listener fails after the note was created, show created-but-open-failed or another accurate follow-up status; do not report a failed creation and encourage duplicate retries. Errors distinguish invalid entity/input, render failure, unsafe destination, stale plan, conflict, permission/storage failure, cancelled-before-write, and uncertain write. User messages are localized; logs are sanitized.

## 7. Events, source of truth, and observability

**DOC-16 — One canonical created event.** Register a typed `documents.created` event in the existing catalog. It contains entity key/ID, schema version, path, and safe request/correlation metadata, not the entire frontmatter, note body, a native object, or secrets. Publish it only after confirmed creation. No created event for preparation, validation failure, cancellation before write, or failed write. Replaying a known receipt does not publish a second creation event.

The host bridge may also observe `host.vault.entry-created`. These are different observations of related work, not two domain creations. Their order relative to promise resolution/cache events must not be assumed. Consumers use the canonical receipt/event for this service's creation flow and an explicit invalidation/deduplication strategy for generic host observations. Do not automatically emit an additional Task-specific event unless a feature deliberately owns that mapping. Listener failure follows the existing bus policy and cannot undo the successful write.

**DOC-17 — Notes are canonical.** For a note-backed Task, its `.md` frontmatter/body is the canonical persisted record. `data.json` holds plugin preferences/document-definition settings, not a second authoritative Task list. Any later index is a rebuildable projection. Users can edit notes independently; creation does not promise ongoing bidirectional synchronization between Markdown headings, paths, and properties.

Definitions are versioned. Changing a definition does not automatically migrate or rewrite existing notes. Existing future-schema notes or unrelated files at a target are preserved. Read/update/migration workflows require a separate reviewed contract; the create service is not permission to sweep the vault.

**DOC-18 — Privacy and limits.** Default diagnostics include operation/error codes and safe correlation IDs, not note titles, paths, property values, full plans, or body text. The user-visible result/preview may necessarily display its destination/content, but debug/export tooling must redact it. Put bounded limits on input sizes, body bytes, recursion-free template operations, request tracking, and collision attempts. No telemetry, external AI calls, network template fetches, or database setup are required.

The current implementation bounds both projected body and complete serialized or
patched Markdown at 1,000,000 UTF-8 bytes, rejecting unpaired surrogates rather
than silently replacing them. Counting stops at the budget without allocating an
encoded copy. This document bound is separate from the plugin-data envelope's
existing character limit and does not establish every broader DOC-18 clause.

## 8. Makers and developer extension

**DOC-19 — `make entity`.** Extend the existing maker runner with an `entity` recipe. `npm run make -- entity task --feature tasks --document` adds a typed entity definition, explicit document mapping/body template, defaults/validation, registry entry, creation action integration, and relevant type/serialization/service tests plus a Markdown fixture. A Task preset demonstrates `type`, `due`, and the other example fields. Without `--document`, an entity can remain domain-only.

Reuse existing command/modal/event/style recipes for an optional creation UI, with no business logic in main.ts. All maker implementations/templates stay under `scripts/make/`. A maker generates source; it never writes real Task notes into a user's vault. Apply existing dry-run/conflict/rerun/noninteractive/safe-plan rules. Expose `entities:check` and `entities:catalog` through scripts for definition/mapping/default/property-type conflicts and derived documentation. No catch-all registry that hides dead scaffolds from fallow.

A new Project or Meeting entity and its document definition must be addable without editing DocumentCreationService, the YAML codec, or the native writer. The catalog represents developer-owned schemas, not a runtime form-builder or user-executable workflow language.

## 9. Reference flow and test evidence

**DOC-20 — Task vertical slice and qualification.** Provide a small explicit Create Task note command/modal or harness recipe with title, due, and optional status/tags, a read-only Markdown/path preview, create/cancel, localized field errors, and accurate created/open-failure feedback. Reuse existing native UI, logger, event bus, and composed style modules. Do not introduce a full Todo app or seed notes on plugin load/setup. Native fixture tests may create synthetic notes only in their explicitly selected disposable test vault.

The original data.json-backed example may remain as the plugin-data demonstration; label the note-backed Task recipe separately. Removal recipes can remove either demonstration while retaining the infrastructure. The service must not require an in-memory Task list to be authoritative.

Required tests cover:

| Area | Evidence |
| --- | --- |
| Types/catalog | Entity/input correlation, unknown names/fields, output typing, duplicate definitions/defaults/mappings, consistent registered property types. |
| Defaults/validation | Missing versus falsy/null, managed-field override, enum/date/list errors, leap days, Unicode, unsupported object/value types. |
| Serialization | Real codec output and round-trip for dangerous-looking strings, quoted links, date-only semantics, single canonical frontmatter, explicit projection excluding internal fields. |
| Preparation | No file/folder/event effects; fixed ID/default/body/path across accepted plan and commit; stale plan rejection. |
| Filesystem boundary | Full-content create, folder/file conflicts, traversal/protected paths, race/case collisions, no overwrite/modify fallback, residual-folder policy. |
| Reliability | Double submission, mismatched request-key reuse, confirmed versus uncertain write failures, cancellation during write, no false rollback. |
| Event/cache/UI | One canonical created event; raw host event dedup; cache lag; failing listener/open action does not change creation success. |
| Extensibility | Task and a second different entity use the same service; generated entity integrates and passes existing tooling. |
| Host/browser | Harness fake stores and exposes actual Markdown bytes; native Properties/Source views show expected fields/types; all declared mobile paths remain host-API-only. |
| Lifecycle/privacy | No startup seeding, safe disposed UI, bounded request records, redacted diagnostics, no Task duplication in data.json. |

All handwritten source/generated scaffolds and CSS obey the 400-line limit; tests/helpers obey 450. The new Task form uses the already required shared CSS composition. No new stylesheet pipeline or event bus is introduced.

## 10. Evidence boundary

This document defines the proposed service and its contracts. The repository remains specification-only until code, definitions, makers, and tests are implemented. One complete host write is a design requirement to validate, not a claim that Obsidian exposes a cross-process atomic transaction. See the [research notes](../research/2026-09-22-entity-documents.md) for the primary sources and remaining qualification work.
