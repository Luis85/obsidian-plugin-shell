# Typed-note collections

> Type: reference and how-to guide · Part of the [docs index](../README.md)

A **note collection** is a folder of Markdown notes of one `type`, each with a stable id, a status workflow and
typed frontmatter, that the `node bin/app` shell lists, checks, creates, updates, reviews and reports on. The engine
is generic; a collection is described by one JSON definition in `configs/collections/<id>.json`. The
[risk register](RISK-MANAGEMENT.md) (`risk`) is the first collection; [learnings](LEARNINGS.md) (`learning`) and
[release items](RELEASE-CANDIDATES.md) (`release-item`) were added with the steps under [Add a collection](#add-a-collection).

Code is added only for what data cannot express: a pure **collection hook** (for example the risk score and level),
named by the definition the same way wizards name actions.

## Engine API

All names are prefixed `collection*`/`Collection*`. Domain modules are framework-free (no `node:*`, no YAML).

| Module | Exports | Responsibility |
| --- | --- | --- |
| `src/cli/domain/collection-definition.ts` | `readCollectionDefinition`, `collectionField`, `collectionStatus`, `collectionInputName`, `CollectionDefinition`, `CollectionField`, `CollectionStatus`, … | Fail-closed validation of a definition |
| `src/cli/domain/collection-record.ts` | `readCollectionRecord`, `collectionCreate`, `collectionUpdate`, `collectionManagedUpdate`, `collectionValue`, `nextCollectionId`, `collectionOverdue`, `isCollectionDate`, `CollectionHook`, `CollectionRecord`, `CollectionIssue` | Reading stored frontmatter into a record plus issues; new and changed frontmatter; transitions, stamps, derived values; managed changes by other modules; id allocation |
| `src/cli/domain/collection-reference.ts` | `readCollectionAccepts`, `collectionReferenceOk`, `collectionAcceptsText`, `collectionReleaseVersion` | The `accepts` reference kinds: project paths, release versions and id prefixes |
| `src/cli/domain/collection-query.ts` | `sortCollection`, `filterCollection`, `collectionReviewQueue`, `collectionCheck`, `collectionRow`, `collectionCell`, `CollectionEntry` | Report order, filters, review queue, duplicate and overdue checks, list rows |
| `src/cli/domain/collection-register.ts` | `collectionRegister`, `mergeCollectionRegister`, `mergeCollectionBlock`, `collectionBlock`, `collectionBase`, `collectionTableText` | The generated register, marker/hash preservation of any named block (registers, release candidate READMEs), the `.base` data |
| `src/cli/domain/collection-hooks.ts` | `collectionHooks` | The explicit hook registry (`risk.scoring`) |
| `src/cli/adapters/collection-catalog.ts` | `loadCollection`, `LoadedCollection` | Built-in or project definition, its hook and model validation |
| `src/cli/adapters/collection-notes.ts` | `parseCollectionNote`, `patchCollectionNote`, `renderCollectionNote`, `scanCollectionFolder` | Safe YAML reading, in-place patching with candidate verification, rendering (the fake-data serializer), folder scanning |
| `src/cli/adapters/collection-store.ts` | `openCollection`, `readCollection`, `collectionNote`, `collectionCreatePlan`, `collectionUpdatePlan`, `collectionDate` | Folder from settings, snapshots, reviewed create/update plans with hash and inventory guards |
| `src/cli/adapters/collection-report.ts` | `collectionReportPlan` | Reviewed register (and `.base`) plan |
| `src/cli/adapters/collection-command.ts` | `collectionCommand`, `collectionInteractiveActions` | `list`, `show`, `check`, `model`, `new`, `update`, `report` for any command root |
| `src/cli/presentation/collection.ts` | `collectionWizard` | Runs the definition's `new`/`edit`/`review` wizard |
| `src/cli/presentation/wizards/collection.ts` | `collectionModule` | Wizard actions `collection.load`, `collection.open`, `collection.plan-new`, `collection.plan-update`, `collection.review-load`, `collection.review-walk`; choice providers `collection.choices`, `collection.statuses`, `collection.notes` |

Wiring that stays data-like: `collectionCommandRoots` (`src/cli/domain/command-options.ts`, root → collection id) feeds
the parser, router, help and the interactive launcher; `collectionPathDefaults` (`src/cli/domain/user-settings.ts`, path
key → default folder) feeds settings validation, the settings schema, documentation-path protection and migrations.

`collection.choices` serves any select field: it looks up the definition field whose input name equals the form
field's binding and offers its vocabulary (integer scales are labelled `3 — Possible`). Form choice providers
receive the asking field as a second argument for this.

## Definition reference

See `configs/collections/risk.json` for a complete example and `configs/schemas/collection.schema.json` for editor
completion. `readCollectionDefinition` is authoritative.

| Key | Meaning |
| --- | --- |
| `id`, `title`, `description` | Kebab-case id (the file name), display title |
| `type` | Frontmatter `type` value of the collection's notes; other Markdown in the folder is ignored |
| `pathKey` | The user-settings path key; it must be declared in `collectionPathDefaults` |
| `idPrefix`, `idDigits` | Ids like `RISK-0001` (prefix of capitals/digits ending in `-`, 3–8 digits) |
| `titleField` | A required input text field; it names new files (`<id>-<slug>.md`) |
| `hook` | Optional name in `collectionHooks`; required when a field is `derived` |
| `forms.edit`, `forms.review` | Form ids used by the generic wizard actions |
| `wizards.new`, `wizards.edit`, `wizards.review` | Wizard ids run by `<root> new|edit|review` in a terminal |
| `statuses[]` | `{ id, label, open, transitions[], stamp?, managed? }`. `open` drives overdue, `requiredWhenOpen` and review. `stamp` names a stamp field dated on entering the status and removed on leaving it. `managed: true` marks a status only another module enters or leaves (see below); no transition and no `initialStatus` may name it. |
| `initialStatus` | Default status of new notes |
| `vocabularies` | `name → [{ id, label }]`, referenced by `choice`, `integer` (whole-number ids) and `list` fields |
| `fields[]` | `{ key, label, kind, source?, required?, requiredWhenOpen?, frontmatter?, multiline?, overdue?, maxLength?, vocabulary?, default?, idPrefix?, accepts? }` |
| `body` | Template rendered once for new notes; `{{input}}` or `{{input|fallback}}` of input fields, never evaluated |
| `list.columns`, `report.columns` | System keys (`id`, `status`, `created`, `updated`, …) or frontmatter field keys |
| `report.file`, `report.title`, `report.sort[]`, `report.base` | Register file in the folder, its heading, sort keys (`asc`/`desc`, choices by vocabulary order), optional `.base` file |
| `review` | `{ stamp, match: [{ key, in[] }], overdue }`: open notes matching a choice value, or overdue, are reviewed |
| `model` | Hook-specific data, validated by the hook |

Field kinds are `text` (single-line unless `multiline`), `date` (`YYYY-MM-DD`), `integer`, `choice` and `list`.
Sources are `input` (answered), `derived` (computed by the hook; never input; stored values must match), `stamp`
(dated by the engine) and `managed` (optional frontmatter that is never input; only another module's reviewed plan
writes it through `collectionManagedUpdate`, for example the release item's `candidate`). `frontmatter: false` marks body-only input text. `default: "today"` fills a date. `idPrefix`
(for example `"RISK-"`) makes a frontmatter text or list field (without a vocabulary) hold references: every value must be
an id with that prefix and 3–9 digits, such as `RISK-0001`. Only the format is checked; whether the referenced note exists
is not (hooks are pure and never read other folders). `accepts` generalizes this for frontmatter text and list fields
without a vocabulary or `idPrefix`: each value must match one of the listed kinds, `path` (a portable project-relative
path outside protected roots such as `.git`, `.obsidian` and `node_modules`), `release-version` (`1.2.3` or
`1.2.3-rc.1`) or an id prefix such as `"RISK-"`; an id-shaped value must use a listed prefix. The engine owns
`type`, `id`, `status`, `created`, `updated` and `schema_version`.

## Guarantees

- Reads never throw for one bad note: malformed, unsafe, oversized, non-UTF-8, future (`schema_version` > 1) and
  invalid notes are issues; their bytes are never changed and they cannot be updated until fixed.
- Ids are one above the highest id found in note ids, file names and the register; a create plan is refused at apply
  time if the folder changed after review.
- Updates patch only owned keys in the existing YAML document, keep path, id, `created`, unrelated properties,
  comments and body bytes, verify the candidate by parsing it again, and apply only if the file still has the read hash.
- The register is replaced only between intact, hash-stamped markers; text outside them is preserved.
- Every write is one reviewed file plan applied with its exact `planHash` (or a default-No prompt).
- People never enter a `managed` status or write a `managed` field: `new`/`update` input and the generic forms refuse
  or omit them. `collectionManagedUpdate(definition, hook, record, { status?, set? }, asOf)` is the one way in: it skips
  people's transitions but applies stamps, derived values and completeness, and its result is patched like any update.
  Release candidates use it to move release items to `included`, `shipped` or back to `ready` in the candidate's own plan.

## Add a collection

This is how lessons learned (`learning`, notes `type: Learning`, ids `LRN-0001`, folder `paths.learnings`, default
`docs/learnings`) were added; see [learnings](LEARNINGS.md). The only engine change it needed was the generic `idPrefix`
field option for its `related-risks` references. Otherwise no engine file changes:

1. **Settings path.** In `src/cli/domain/user-settings.ts` add the default:
   `export const collectionPathDefaults = { risks: 'docs/risks', learnings: 'docs/learnings' } as const;`
   Validation, the settings schema, effective paths, documentation-path protection, `withoutImplicitPaths` and
   `settings migrate` pick it up.
2. **Settings form.** In `configs/forms/user-settings.json` add, after the risks field:
   `{ "id": "learnings", "kind": "text", "label": "Learnings folder (one Markdown note per learning)", "bind": "paths.learnings", "default": "docs/learnings" }`.
   Scripted plain-prompt tests that walk this form need one more answer (for example the answers list in
   `tests/tooling/interactive-maker-setup-ui.checks.mjs`).
3. **Definition.** Add `configs/collections/learning.json` with `"pathKey": "learnings"`, `"type": "Learning"`,
   `"idPrefix": "LRN-"`, its statuses, vocabularies, fields, `body`, `list`, `report` (for example
   `"file": "learnings.md"`, `"base": "learnings.base"`), `forms` and `wizards`. Omit `hook` when nothing is derived.
4. **Forms and wizards.** Add `configs/forms/learning.json` (selects use `"choicesFrom": "collection.choices"` and
   `"collection.statuses"`; bind each field to its input name) and, if reviewed, a review form. Copy
   `configs/wizards/risk-new.json`, `risk-edit.json` and `risk-review.json` to `learning-*.json`, change their ids and
   texts, and set `"with": { "collection": "learning" }` on the `collection.load` step. Run
   `node bin/app wizard check --json`.
5. **Command root.** In `src/cli/domain/command-options.ts` add `learning: 'learning'` to `collectionCommandRoots`. To
   filter lists by a new choice field (`--<key> <id>`), add the key to `makerValueOptions` if it is not there yet.
   Add help lines to `makerHelp` in `src/cli/adapters/commands.ts`. Routing, parsing, `helpResult`, the interactive
   launcher and `canInteract` follow from the map.
6. **Hook (only if needed).** Add a pure `CollectionHook` in `src/cli/domain/` and register it in
   `src/cli/domain/collection-hooks.ts`.
7. **Tests.** Add the new wizard and form ids to `shippedWizards`/`shippedForms` in
   `tests/tooling/interactive-maker-wizard-catalog.checks.mjs`, and add `tests/tooling/interactive-maker-<plural>-*.checks.mjs`
   (they run in the `maker` suite; learnings use `learnings-` because `interactive-maker-learning-*` belongs to the
   `learn` courses). A fake-data preset in `configs/fake-data/entities/` shows the format.
