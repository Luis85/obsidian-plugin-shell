# Generate and inspect note features

The implemented maker catalog has two recipes: `feature` creates a grouped,
registered note-backed feature; `entity --document` adds another note entity to
an existing group. They use the public feature API and shared repository runtime.
The full view/component/store/command/modal/style/locale/custom-maker catalog is
still pending. Domain-only entities remain available through the manual
`defineEntity` API; this maker rejects missing `--document` instead of generating
an unused module.

Use the qualified installed toolchain. Help works before dependency installation;
planning uses the installed TypeScript parser to validate the actual registry.
Nothing installs dependencies, fetches templates, publishes, or creates user notes.

```sh
npm run make -- --list
npm run make -- feature bookmarks --entity bookmark --dry-run
npm run make -- feature bookmarks --entity bookmark --yes --no-interaction
npm run make -- entity meeting --feature bookmarks --document --dry-run
npm run make -- entity meeting --feature bookmarks --document --yes --no-interaction
```

The optional `--preset title|task|project` chooses a tested small starting schema.
The title preset supplies one required title; Task adds status/tags/optional due;
Project supplies name/budget/archived. Defaults preserve zero and false. Change
the ordinary generated source to express your actual business validation.
`--folder` selects a safe default note folder. This is scaffolding, not a finished
business application or a generated user interface.

Each recipe creates a named entity module and document/feature definition inside
`src/features/<group>`, one explicit typed registration in
`src/bootstrap/features.ts`, a real-service CRUD test and an exact Markdown
fixture. The returned repository is the creation/update/delete action surface;
there is no orphan wrapper or extra dependency wiring for the author. No business
logic enters `main.ts`. See [Build a feature](BUILD-A-FEATURE.md) for the manual API.
When adding a UI to generated business logic, place Vue markup in
`src/presentation/components` and behavior in `composables` or `stores`; keep the
typed injection contract in `context`. The maker does not mix Vue behavior into
the entity definition or invent a new UI framework. See
[Presentation concerns](PRESENTATION-STRUCTURE.md) for the enforced layout.

Apply runs the actual typecheck, generated Vitest test and entity check. Output
records each executed check. Full `npm run verify` remains a separately listed
next step and is never reported as passed without execution. A check failure
returns nonzero and retains generated source for inspection and correction.

For machine output use `npm run --silent make -- ... --json`. Human prompts go
to stderr. Noninteractive apply needs `--yes`; missing input and unknown flags
fail. `--dry-run` reads/prints the complete path/hash/change plan without locks,
directories, reports, source writes or checks that would generate output.

## Repeated runs and safe edits

An identical, fully registered rerun is a no-op for source files. Modified
scaffolds, conflicting names, case collisions, Windows device names, unsafe
paths and symlinks fail before mutation. There is no force-overwrite option.
Registry edits use the actual TypeScript syntax tree and accept only the explicit
registration callback; unfamiliar structure fails with a manual-repair message.
Unrelated source and registry text is retained.

Setup and makers share the read-only file planner and `.codex-authoring.lock`.
Apply stages complete bytes and rechecks original hashes before every write.
On failure it restores only content still matching its own writes. Concurrent
user edits are retained. Incomplete recovery keeps the lock, original/staged
bytes and `recovery.json`; inspect those files and confirm no operation is running
before any deliberate recovery. Locks are never removed automatically as stale.
This coordinates cooperating tools, not all editors or a filesystem-wide atomic
transaction. A failed run may leave newly created empty parent directories.

## Inspect actual registered definitions

```sh
npm run entities:check
npm run entities:catalog
npm run --silent entities:catalog -- --json
```

These commands follow the explicit feature registry, bundle the actual trusted
source definitions with the installed Vite toolchain, and validate their real
catalog. Output includes entity/schema identity, default folder and override,
field types/defaults, and explicit document mappings. Duplicate registrations,
incomplete mappings and conflicting property types fail. No runtime source scan,
second editable schema database, host property-setting mutation or user note is
involved. The catalog is derived stdout; redirect it deliberately if a file is
wanted. Definitions are trusted developer code, not a sandbox for downloaded
schemas or executable content stored in notes.

Tooling tests cover deterministic dry runs, exact reruns, edited-file and stale
registry conflicts, unsafe/case/symlink paths, shared locks and rollback ownership.
An isolated differently named fixture generates three distinct note entities,
runs the generated tests through the real codec/repository and checks the derived
catalog after removing controlled seed examples and their registry entries.
The fixtures copy only shared foundation code, never a consumer's live business
folders or registry. A separate regression runs the maker suite from an actually
extended consumer after removing those seeds and preserving a consumer edit.
Generated tests use the generic entity fixture and storage ports, so they
do not depend on the worked examples. Removing the entire showcase still requires
the separately documented UI/context/localization cleanup; the fixture does not
claim that broader removal flow is automatic.

Ordinary maker qualification runs only those generated tests and catalog checks,
never another full verification that recursively invokes itself. It reuses the
already installed exact dependency graph; that test alone
does not claim a fresh install, browser/native UI, the full maker catalog, or the
complete generated-template release qualification.
