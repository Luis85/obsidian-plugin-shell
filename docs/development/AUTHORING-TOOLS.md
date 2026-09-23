# Authoring tools

The maker catalog generates ordinary, registered source through one reviewed file
planner. Feature authors keep domain rules in `src/features/<owner>`; Vue markup
stays in `src/presentation/components`, with behavior in composables and per-view
Pinia stores. The recipes use the existing services and exact installed toolchain.
They never install dependencies, fetch templates, create user notes or publish.

```sh
npm run make -- --list
npm run make -- feature bookmarks --entity bookmark --dry-run
npm run make -- feature bookmarks --entity bookmark --yes --no-interaction
```

An interactive terminal without a recipe opens a chooser; noninteractive invocation
prints help. `--help` and `--list` work before installation. Use
`npm run --silent make -- ... --json` for clean machine output. Required missing
owners/options, unknown flags, unsupported option combinations and invalid names
fail with a prerequisite message. `--yes` applies the selected plan; it does not
request downloads or new permissions.

Machine plans report the actual storage backend where applicable; new settings
report `plugin-data`. Unrelated recipes omit backend/folder/schema options. Default
view, command and input labels include the feature owner so multiple generated
features remain distinguishable. Existing developer-owned scaffolds are preserved.

## Recipes and integration

All child recipes take `<name> --feature <existing-owner>` unless stated otherwise.

| Recipe | Generated behavior and integration |
| --- | --- |
| `feature` | Composes entity, store, component, localized command, scoped CSS and tests from the same primitives. Defaults to a Markdown title entity; its panel creates notes through the real repository. `--entity`, `--preset` and `--backend` select the schema/backend. |
| `entity` | Defaults to a domain-only definition, validation tests and explicit domain catalog entry. `--document` or `--backend markdown` adds exact Markdown fixtures and real CRUD tests. `--backend plugin-data` selects canonical plugin data with real CRUD/conflict tests. |
| `view` | Registered Vue draft editor, per-view Pinia state, native view type/open command, localized labels, stylesheet and rendered/ownership tests. This is an editable draft surface to extend, not an invented business workflow. |
| `component` | Accessible localized SFC registered in the shared component host, with its own native view registration, stylesheet and rendered test. |
| `store` | Per-view draft/reset store with isolation tests, consumed by a generated editable panel. No automatic persistence. |
| `usecase` | Feature-owned title normalization/validation action, called by an integrated prompt-and-preview command. Explicitly previews; it does not claim to persist. |
| `command` | Localized native info command using the shared modal service; failed modal outcomes remain command failures. |
| `modal` | Validated title prompt through `services.modals`, with validation, cancellation, failure and owner-cleanup tests. The shared adapter retains native focus/disposal behavior. |
| `setting` | A new boolean feature preference with a native declarative toggle, validated schema/default and an additional palette command. Both controls share the same plugin-data repository and serialized preference writer. Optional `--preference notifySuccess\|hideObsidianViewHeader` binds a pre-existing shared preference and its existing native control instead. |
| `event` | Literal typed event and runtime payload validator, explicit command publisher, positive/negative payload and TypeScript contract tests. This is an explicitly requested local signal, not a fake persistence fact. |
| `listener` | Requires `--event <existing-name>` in the same feature. Subscribes to that typed event through the shared runtime bus, displays localized feedback and unsubscribes on disposal. |
| `style` | Requires `--view <existing-generated-view>`. Adds an owned CSS module and an actual SFC stylesheet import. No unused CSS output or global host reset. |
| `locale` | Takes only a locale name. Copies every base and explicitly registered feature key into a pending translation skeleton, with nonselectable status metadata and a completeness test. Review and translate before deliberately enabling a language. Later added keys make the test fail until the draft is updated. |
| `maker` | Takes only a recipe name. Creates a trusted local recipe in `scripts/makers/custom`, explicitly registers it and generates a composition test. The default custom recipe composes a real localized command. |

```sh
npm run make -- entity reference --feature bookmarks
npm run make -- entity rating --feature bookmarks --backend plugin-data
npm run make -- entity meeting --feature bookmarks --document --preset task
npm run make -- view dashboard --feature bookmarks
npm run make -- setting compact --feature bookmarks
npm run make -- event refreshed --feature bookmarks
npm run make -- listener refresh-feedback --feature bookmarks --event refreshed
npm run make -- style outline --feature bookmarks --view dashboard
npm run make -- maker reminder
npm run make -- reminder review --feature bookmarks
npm run make -- locale fr
```

The title preset has a required nonblank title whose spelling is preserved. Task adds status/tags/optional due;
Project supplies name/budget/archived, preserving zero and false defaults.
`--folder` selects a safe vault-relative Markdown folder. Customize these ordinary
schemas and actions for the actual product; templates do not overwrite your edits.
Domain-only and plugin-data features receive an editable draft panel when composed
as a feature; that panel makes no claim of repository persistence.

Markdown creation uses the projected title verbatim plus `.md`, without an ID
suffix. Invalid/reserved filenames fail with a localized error; same-title and
case-only path collisions fail without overwriting or choosing another filename.
IDs remain in frontmatter. Changing an existing entity title preserves its path.

## Registries and ownership

`src/bootstrap/features.ts` constructs typed repositories once. Domain-only schemas
join `src/bootstrap/authoring-domains.ts`. Runtime action factories and static Vue
panel imports join `src/bootstrap/authoring.ts`; locale modules join
`src/bootstrap/authoring-locales.ts`. No business code enters `main.ts` and no source
scan discovers features at runtime.

Each registered panel has an exact identity-derived native view type and an open
command. The common native adapter owns headers, menus and disposal. Each mount
creates separate Pinia, i18n, portal and subscriptions. Feature source imports no
host classes or Vue components. Note creation uses a new request identity for each
deliberate submission, blocks uncertain outcomes for that view and ignores late
UI updates after unmount. Repositories retain attempted-write deduplication.
The generated note form locks its input and Reset action while a write is pending
or uncertain. It displays the exact prepared note path and retains that path with
uncertain feedback for reconciliation; validation feedback is linked to the input.

Generated setting factories return a `BooleanSetting` from the public feature API
in their explicit `settings` list. Bootstrap owns these descriptors and awaits
their read-only initialization before native registration. The qualified Obsidian
API reads controls synchronously through `getControlValue`; the controller keeps
a last-committed projection for that getter, while setters await the real repository.
The native checkbox and palette command use the same controller. Defaults come
from the entity schema; reading an absent setting does not create a record.

Corrupt/future data, duplicate setting records and failed reads disable the control
with a localized error instead of replacing data with defaults. An uncertain save
retains the last committed display and blocks further writes. Matching committed
repository events refresh the projection. Native tab subscriptions are released on
hide and unload, reacquired on reopen, and guarded against late updates. This is a
bounded boolean setting API, not a general form or persistence framework.

Generated messages contain English/German starting labels. Pending languages stay
outside the selectable locale union. The pending-locale maker reads literal,
explicitly registered dictionaries without executing their source; unfamiliar
computed dictionary code requires manual translation work rather than evaluation.

## Review, formatting and conflicts

`--dry-run` validates and prints exact paths, hashes, changes and planned checks.
It writes no locks, directories, reports or generated source. The planner binds
both edited files and read-only prerequisites to their reviewed hashes.

Apply formats only planned source bytes with the pinned Prettier configuration,
then runs types, the selected generated runtime/tooling tests and the entity
catalog check. Exact Markdown fixtures remain untouched. Output records actual
check outcomes. Full `npm run verify` remains a printed next step and is never
reported as passed without execution. A failed check retains source for inspection.

Identical registered reruns are source no-ops. Edited source or owned registrations,
case collisions, reserved names, unsafe paths, symlinks and stale inputs fail before
mutation. There is no force-overwrite switch. AST registry edits preserve unrelated
entries and comments; unfamiliar shapes fail closed. Empty repository registries
need no unused callback parameter; adding their first repository inserts one.

Setup, makers and example removal share `.codex-authoring.lock` and the safe file
planner. Writes recheck hashes. Recovery restores only bytes still matching the
operation's own writes; concurrent user edits survive. Incomplete recovery retains
the lock and recovery material for inspection. This is not a filesystem-wide
transaction. Failed operations can leave newly created empty parent directories.

## Local custom recipes

The explicit `customMakers` registry contains metadata (`name`, `version`,
`description`) and an async `plan(context, request)` method. Request name/owner
are validated. Context supplies read-only source access and declarative
`add`/`editArray` planning methods plus targeted test paths. Builtin primitives are
reusable. The runner owns review, formatting, hashes, locking, writes and checks.

Local recipe code is trusted developer code, not a sandbox. There is no remote
loader, JSON command hook or automatic package installation. Recipes must return
real integrated behavior and retain meaningful tests. Unknown/duplicate recipes
fail; changing an existing custom recipe is an ordinary reviewed source edit.

## Actual entity catalog and qualification

```sh
npm run entities:check
npm run entities:catalog
npm run --silent entities:catalog -- --json
```

The catalog derives actual source from explicit registries with the installed
Vite toolchain. It reports backend, schema, fields/defaults and Markdown mappings
where present. Domain/plugin-data entries need no document mapping. Duplicate
entity identities and incomplete Markdown mappings fail; no second schema database
or user-note mutation is involved.

Maker qualification uses an isolated owner, executes every recipe and a local
custom recipe, checks generated formatting/types/tests/catalog, and proves exact
reruns and edited/stale-input conflicts. Note actions test two distinct creates,
exact bytes, no success on failed writes, uncertain lockout and late unmounts.
The native adapter tests use a synthetic host and separately prove two mounted
view owners. Browser, real-native and physical-device evidence remain distinct;
see the current iteration test record for executed full-consumer qualification.
