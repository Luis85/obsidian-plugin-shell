# Framework CLI and developer-kit workflow

> Type: reference · Part of the [docs index](../README.md)

`node bin/app` is a developer-facing TypeScript CLI with an assembled ZIP workflow. It is not a published framework release or native companion conversion. The historical [framework-first plan](../_archive/development/FRAMEWORK-CLI-GENERATOR-PLAN.md) is broader than the implemented and qualified scope below.

## Start a new plugin from a starter

`node bin/app new` (alias `npm run new --`) is the one-command front door to the
existing project compiler. It loads the external `configs/starters/*.json`
definitions (each hashed as read), applies identity-only customization (`id`,
`name`, optional `author`; no label rewrites and a provenance note in
`design/project.json`) to the embedded project schema 6 document, then plans with
the unchanged generator. Only project schema 6 is read; earlier formats are
rejected and never migrated.

```sh
node bin/app new --list [--json]
node bin/app new <dir> --starter <id> [--id <plugin-id>] [--name "<Plugin Name>"] [--author "<Author>"] [--json]
node bin/app new <dir> --starter <id> --yes [--install]
node bin/app new <dir> --starter <id> --apply <planHash>
```

- `<dir>` is absolute or relative to the invoking shell (`INIT_CWD` under `npm run new`).
  It must be absent or empty and outside the framework checkout. Its nearest existing
  ancestor becomes the generator's `--vault` and the remaining path its `--target`;
  missing folders are created only by the reviewed file plan.
- A `<dir>` inside an Obsidian vault (the folder or an ancestor has `.obsidian/`) is
  refused with `TARGET_INSIDE_VAULT`, so a personal vault never becomes a project
  folder. Pass `--inside-vault` only for a disposable test vault you own.
- Plugin IDs use lowercase letters, digits and single hyphens, start with a letter and
  must not contain `obsidian` or `plugin` (the same rule `check submission` applies,
  from `bin/adapters/framework/plugin-id.ts`). An explicit `--id my-plugin` is refused with
  a suggestion. The default ID is the folder name without the words `obsidian` and
  `plugin`; a remainder shorter than three characters is combined with the starter's
  ID (`../my-plugin` with `quick-capture` gives `my-quick-capture`, with `blank` it
  gives `my-project`). Names default to the title-cased ID.
- Without `--yes`/`--apply` the command previews: starter, identity, directory, file
  count, plan hash, warnings and conflicts. A TTY then asks for confirmation; non-TTY
  and `--json` runs exit 0 without writing. Missing required input (`<dir>`,
  `--starter`) fails with exit 1 instead of prompting outside a TTY. Applying rebuilds
  the plan and refuses a stale hash; a second run into the created folder fails with
  `TARGET_NOT_EMPTY`.
- `--install` runs `npm ci` and `npm run verify:project` inside the new project after
  a successful write, streaming output to stderr. It is not part of the plan hash or a
  saved approval. A failure reports that the project exists and how to resume.
  Without it the result lists next steps (`npm ci`, `npm run check`,
  `npm run dev:obsidian`, `npm run test:watch`) and the project's README and
  `PROJECT-IMPLEMENTATION.md`. The generated project's `README.md` and `AGENTS.md`
  describe its developer and agent kit ([generator guide](COMPANION-GENERATOR.md)).
  Pass `--author` so `manifest.json` and `package.json` name you; without it the
  author stays empty and `check submission` reports it.

Generated scaffolds keep PRD acceptance as TODO obligations; creation is not product
acceptance, native qualification or release readiness.

### From an exported companion project

```sh
node bin/app new <dir> --from <project.companion.json> [--id <plugin-id>] [--name "<Plugin Name>"] [--author "<Author>"] [--yes | --apply <planHash>] [--install] [--json]
```

`--from` accepts any complete project JSON exported by the companion, not only a
built-in starter (the shared contract accepts schemas 1–4; the tests exercise
schema 4 exports). It has the same placement, preview, plan-hash,
`--yes`/`--apply`/`--dry-run`, stale-hash and `--install` semantics as `--starter`;
the two options are mutually exclusive (`SOURCE_CONFLICT`). The path is relative to
the invoking shell. The file is read as data only: a regular, non-linked file of at
most 4 MB, parsed as UTF-8 JSON and validated by the shared project contract. The
identity comes from the JSON; `--id`, `--name` and `--author` override only those
fields (no provenance note is appended). Refusals: `PROJECT_FILE_NOT_FOUND`,
`PROJECT_JSON_MALFORMED`, `PROJECT_VERSION_UNSUPPORTED` (exported by a newer
companion), `PROJECT_INVALID`, `INVALID_PLUGIN_ID` (also for an exported ID containing
`obsidian`), `INVALID_IDENTITY`, `INPUT_LINK`
and `INPUT_LIMIT`. An exported ID containing `plugin` (such as the companion's own
`plugin-companion`) is kept but produces a preview warning that `check submission`
will fail, with a suggested `--id`; an explicit `--id` must follow the creation rule.
Editing the file after review makes its plan hash stale. See
[Companion handoff](COMPANION-HANDOFF.md).

## Adopt an existing project

`node bin/app adopt analyze|plan|skill` adds Workbench to a project that already exists. `analyze` is a bounded, read-only scan that never executes project code and reports stack, tooling and compatibility findings (`workbench-adoption-report/v1`). `plan` renders that report as one Markdown integration plan, previews it with its SHA-256 and writes only that file after `--yes` or `--apply <hash>`. `skill` installs the `adopt-existing-project` agent skill. These commands work on any folder (`--target`), without `shell.config.json`. See [Adopt an existing project](ADOPT-EXISTING-PROJECT.md).

## Golden path, help and the check gate

`node bin/app help` starts with the golden path (`new` → `install` → `dev` → `test`
→ `check` → `make`), each with a runnable example, then lists the remaining
commands by group. `help --all` lists every command with its summary, and
`help <command>` (or `<command> --help`) shows usage, options with allowed values
and defaults, common options for that command's effect, and examples. The help and
`capabilities` JSON carry the same data additively (`scope`, `goldenPath`, `groups`
and per-command `group`, `usage`, `examples`, `optionHelp`) under protocol version 1;
existing fields are unchanged. `--profile` values come from the same list that the
handlers validate.

Human mode never prints raw JSON: `status`/`doctor`, `make list`/`describe`, plans,
`check` and `check submission` have readable views, and other results are shown as
aligned key/value rows. Views end with a `Next:` command where one exists. Markers
and colour (`✓ ✗ !`) appear only on a TTY without `NO_COLOR` and with a non-`dumb`
`TERM`; otherwise output is plain ASCII (`[ok] [FAIL] [warn]`). `--json` output keeps
the same single versioned envelope.

Mistyped commands, options and maker recipes get "did you mean" suggestions from the
catalog, including multi-word commands (`plan aply` → `plan apply`). They keep the
documented exit code 1 for rejected requests; JSON results carry the candidates in
`data.suggestions` and a `next` hint such as `node bin/app help status`.

```sh
node bin/app check                 # or npm run check
node bin/app check --fast --json   # or npm run check:fast; for agent Stop hooks
node bin/app check --fast --base origin/main   # diff merge-base(origin/main, HEAD) to the working tree
node bin/app check --plan --json   # the definition of done for the diff; runs nothing
node bin/app check --dry-run       # list the steps without running them
node bin/app check submission      # or npm run check:submission
```

`check` is the fast daily and agent gate. It runs every step even after a failure,
then prints one summary with each step's status and duration, and the tail of each
failing step's output (last 60 lines, ANSI removed). It exits 1 if any step failed.
Child output is captured, not streamed. Steps call installed tool entry points with
argument arrays: no shell and no recursive npm delegation. `--timeout` applies per
step. It is not `verify`: coverage, analyzers, builds, tooling suites, browser and
native qualification stay in `verify` and CI.

| Scope | Detected by | Steps |
|---|---|---|
| Shell repository | default | `vue-tsc --noEmit`, `scripts/quality/lint-source.mjs`, `eslint src bin --max-warnings 0`, `vitest run`, `tsc --project configs/types/tsconfig.maker.json`, the `maker` suite |
| Generated project | `.companion/generation.json` and `configs/types/tsconfig.project.json` | `vue-tsc --noEmit --project configs/types/tsconfig.project.json`, `eslint src <product roots> --max-warnings 0`, `vitest run --config vitest.project.config.mjs` |

A generated project's product roots are the folders named in `configs/types/tsconfig.project.json`
that are not test roots (`tests/suites.json`), for example `<codebaseFolder>/generated`
for a custom codebase folder. ESLint, the dev watchers and the agent hooks all derive
them from `scripts/shared/project-roots.mjs`. After a passing run in a generated
project, the summary points to `npm run verify:project`; in the shell it points to
`verify`.

`check --fast` narrows every step to the diff. The changed set is
`merge-base(<base>, HEAD)` to the working tree: committed, staged, unstaged and
untracked files (`git diff --name-status --no-renames -z --relative <merge-base>` plus
`git ls-files -z --others --exclude-standard`, so non-ASCII paths arrive verbatim;
`node_modules` is excluded). `--base <ref>` picks the base. The default is the
merge-base with `origin/main` when that ref exists, else `HEAD` (the previous behaviour,
under which a committed change selects nothing). An unknown explicit `--base` fails
with `BASE_NOT_FOUND`. `data.changes.base` reports the `source` (`option`,
`origin-main` or `head`), `ref` and merge-base `commit` that were used.

| Fast step | Narrowed to | Falls back to |
|---|---|---|
| `typecheck`, `maker-types` | unchanged | unchanged |
| `lint` (`scripts/quality/lint-source.mjs`) | changed `src`, `bin`, `plugins`, `templates/companion/runtime` files | every owned input |
| `eslint` | changed code files under the eslint roots (`--no-warn-ignored`) | the full roots |
| `test` | `vitest related --run --passWithNoTests` over changed code files; skipped when none | `vitest run` |
| `suites` | `node scripts/testing/suites.mjs <names>` for the node `--test` suites a changed path selects (below); skipped when none | none |

A node suite is selected when a changed path matches its `include` globs in
`tests/suites.json` (a changed test file), or a source glob in
`configs/quality/gate-rules.json` `suiteSources` (the code the suite protects, for
example `templates/**`, `bin/compiler/**` and `scripts/companion/**` for `generator`;
`bin/adapters/makers/**` and `scripts/makers/**` for `maker`), or a change-type rule that
names it. `data.suites[]` lists each selected suite with the matched pattern and sample
paths. The slow `maker` suite therefore runs only when something it covers changed;
the full `check` still always runs it. The lint, eslint and test steps fall back to
their full form, and say why in `data.changes.reason`, when more than 200 files
changed, a code file or a file in a code root was deleted, a non-code file inside a code
root changed (JSON/Markdown fixtures, snapshots), or configuration changed
(`package.json`, `package-lock.json`, `tsconfig*.json`, `vite*.config.*`,
`vitest*.config.*`, `tests/suites.json`, `configs/**`). When git or a commit is
unavailable the changed set cannot be computed: every step runs unscoped (the full
`check` step list) and `data.changes.source` is `unavailable` with a reason that says so.
Documentation outside the code roots does not select tests.

`check --plan [--base <ref>] [--json]` computes the definition of done for the same
diff without running anything. It joins the changed paths to gates through the test
suites manifest (`include`, `workflows`), the workflows' `paths:` filters (parsed with
the pinned `yaml` library, including anchors and `!` negation) and the change-type rules
in `configs/quality/gate-rules.json`. Rule data, not code, defines: the gate commands,
the suite source globs, the change-type rules, the documentation globs and the final
gate. The JSON result keeps the check protocol (`protocolVersion` 1, `command` `check`,
`status` `planned`, `data`):

- `data.base`, `data.changes` and `data.classification` (matched rule ids, or
  `docs-only`);
- `data.gates[]`, in order, each with `id`, exact `command`, `kind`
  (`check`, `suite`, `script`, `verify`), `required`, `viaCheck` (also executed by
  `check --fast`), `why[]` (`kind` is `suite-include`, `suite-source`, `rule`,
  `workflow-paths` or `change-type`; with the matched pattern or rule, sample `paths`
  and a `count`), `estimateSeconds` (the Measured column of
  `docs/testing/TEST-SUITES.md`, else `null`), `prerequisites` and `needs`
  (`browser`, `native`, `python`, ...), and `ci[]` (each workflow named by the suite or gate with
  whether it runs for this diff and why: `always`, `paths`, `no-match` or `manual-only`);
  the `check` gate also lists its exact `steps`;
- `data.flags[]` (a change under `configs/quality/**` or the threshold code carries
  `THRESHOLD_CHANGE`: "threshold change: requires owner review"), `data.notes[]`
  (generated-snapshot regeneration for `templates/**`, `bin/compiler/**`, `scripts/compiler/**`,
  `scripts/companion/**`; workflow changes; dependency manifests; documentation-only
  diffs), `data.workflows[]` (workflows that run for this diff) and `data.estimate`.

Rules: `src/**` requires `check` and `npm run test:coverage:production`;
`src/presentation/**` adds `check:presentation`; event files add `events:check`; a
documentation-only diff requires only the documentation checks. Every plan ends with
`npm run verify`, the pre-PR full gate (`npm run verify:project` in a generated project).
A suite selected only because a path-filtered workflow runs it is reported with
`required: false`. Without git the plan has the single gate `node bin/app check` and a
`GIT_UNAVAILABLE` warning. `--plan` cannot be combined with `--fast`, and `--base` needs
`--fast` or `--plan`. Human output is one compact table (`#`, gate, command, estimate,
CI workflows, because) followed by flags, notes and `Next: npm run verify`. A plan is
orientation: it does not prove that any gate passed, and `verify` stays the authority.

`check submission` is a local mirror of documented Obsidian community review rules.
It writes nothing, but it runs the project's ESLint configuration and plugins, so its
effect is `process` (trusted project code) and `--dry-run` lists it without running
it. Each rule reports pass, fail or warn with a remediation and cites its
source in code and JSON:

- manifest fields, types and allowed keys, id format (lowercase letters and hyphens;
  digits warn), no `obsidian`/`plugin` in id or name, `x.y.z` version, `minAppVersion`,
  description format (10-250 characters, capital first letter, final period, plain
  characters) and `fundingUrl` shape ([Manifest reference](https://docs.obsidian.md/Reference/Manifest),
  [validate-manifest](https://github.com/obsidianmd/eslint-plugin/blob/master/docs/rules/validate-manifest.md));
- `versions.json` maps the current version to its `minAppVersion`
  ([sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin#releasing-new-releases));
- `LICENSE` and `README.md` exist, and the built `dist/main.js` and `dist/manifest.json`
  exist and match `manifest.json`, with `styles.css` optional
  ([Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin));
- `eslint src` with the project's configuration, which includes
  `eslint-plugin-obsidianmd` recommended and type-checked rules, summarized by rule.

A pass is not a review outcome: the Community directory also runs policy,
vulnerability and malware checks that are not reproduced here. This framework
checkout itself fails the forbidden-word and description rules (`plugin-shell`,
"Plugin Shell"), because it is a template, not a submission.

## Start from the extracted archive

The build of the framework distribution is an explicit maintainer action:

```sh
node bin/app framework pack --out ./plugin-framework.zip --yes --json
```

This uses the installed TypeScript compiler and emits a self-contained CLI below `bin/`: `bin/app` is the only launcher, `bin/app.js` is the compiled runtime, supporting templates live under `bin/template/`, plugin configuration under `bin/plugins/`, licenses under `bin/licenses/`, and integrity metadata in `bin/kit.json`. Each `bin/plugins/<id>/config.json` is editable data (for example `enabled: true`): `framework status` validates its schema (a JSON object whose optional `enabled` is a boolean) instead of fingerprinting it, and the fingerprinted default is the matching `bin/template/plugins/<id>/config.json`. Every third-party package bundled into `bin/app.js` ships its license text under `bin/licenses/` and an exact-version entry in `bin/licenses/NOTICES.json`; packing fails when a bundled package has no license file. Installed development tools (TypeScript, esbuild, Prettier) are not bundled: makers and packing load them from the project's installed dependencies. The ZIP has deterministic sorted entries and fixed timestamps. Packing does not upload, publish or install anything. A configured consumer cannot be repackaged as the framework by this command. Checksums detect corruption; they do not authenticate an untrusted distributor.

The user extracts that ZIP into a new directory and runs either:

```sh
node bin/app setup
npm run setup
```

The distributed entry point runs compiled JavaScript before `node_modules` exists. The source-checkout launcher retains Node's TypeScript development fallback; that fallback is not required in the archive. Source and distributed routes execute the same TypeScript operation handlers.

Interactive setup requests a project JSON path or a blank project identity. It reviews configuration/intake, then offers reviewed generation and separately approved network/dependency installation. Cancellation or refusal does not authorize later stages. Existing files are not deleted to make setup succeed. The standalone project root is independent of an Obsidian vault.

## Explicit human and agent workflow

```sh
node bin/app setup --input ./my-project.json --dry-run --json
node bin/app setup --input ./my-project.json --yes --json
node bin/app generate --plan-out generation.plan.json --json
node bin/app plan inspect generation.plan.json --json
node bin/app plan apply generation.plan.json --yes --json
node bin/app install --yes --json
node bin/app build --json
node bin/app test --profile project --json
node bin/app verify --profile project --json
```

A configured blank start uses `setup --id my-plugin --name "My Plugin" --author "Author" --blank --yes`. It creates an inert minimal design through the same intake validator, not a competing template generator. Supplying identity without `--blank` or `--input` only configures the project. Import can follow later.

`npm run --silent shell -- <command> --json` returns the same structured result without npm's script banner. In a generated kit, `npm run make -- feature bookmarks --dry-run` reaches the same maker planner. Optional package `bin` metadata exposes `obs-shell` when explicitly linked/installed onto PATH; global installation is never required or performed automatically.

`help`, `capabilities`, `make list`, `make describe <recipe>` and `schema` are data-only discovery. They do not load executable project configuration or custom makers. The legacy `npm run capabilities` catalog remains a separate compatibility contract; the central CLI catalog describes its current handlers. Custom-maker execution requires `--trust-custom`; metadata declarations are not a sandbox.

`--json` emits one versioned result on stdout, including parser errors. Logs/progress use bounded stderr. `--no-interaction`, JSON mode and non-TTY input never prompt. Results distinguish planned, blocked, applied, unchanged, cancelled and failed states. Nonzero exit does not imply rollback; bounded recovery and process outcomes remain available. POSIX subprocess groups are terminated on timeout/cancellation; Windows currently guarantees direct-child termination, not a general descendant-tree transaction.

## Scoped help, input and design-system exports

`node bin/app --version --json` reports the pinned framework/Node versions. `help styles export` or `styles export --help` describes that operation only; `make describe <recipe>` rejects unknown recipes. Returned command descriptors are isolated copies and cannot change execution policy. Structured API request fields are never reinterpreted as command-line options.

File and stdin intake are bounded and reject invalid UTF-8. Ctrl-C, termination, prompt EOF and input cancellation settle without waiting for an upstream EOF. Cancellation does not imply that earlier completed steps were undone. Saved plans must not occupy one of their own output paths or the configured test vault; custom-code approval is never serialized.

```sh
node bin/app styles inspect --input design/project.json --json
node bin/app styles export --input design/project.json --format css --dry-run --json
node bin/app styles export --input design/project.json --format css --yes --json
node bin/app styles export --input design/project.json --format html --yes --json
```

CSS is byte-identical to the scoped compiler used during project generation. `json`, `markdown` and self-contained `html` exports are also supported. The default output is `exports/design-system.<extension>`; `--out` selects a safe project-relative file. Existing different bytes are preserved and reported as conflicts. No fonts, scripts or remote assets are fetched. Documentation escapes authored markup and is not evidence of accessibility acceptance.

Status derives design freshness from actual input hashes. Large v4 traceability has a separate bounded 4,000,000-byte data profile; the smaller operation-request and approval limits remain unchanged. Accepted metadata does not prove business requirements are implemented.

## Import, configuration and regeneration

`shell.config.json` stores portable identity and paths. `config get`, `config explain`, `config validate` and `config set --input ...` inspect or plan changes. After generation, `manifest.json` remains the plugin identity authority. Import cannot silently replace a generated ID/version or move generated folders. Relocation requires a separately reviewed migration; this CLI does not yet automate arbitrary source-root relocation.

`project inspect --input ...` validates supported v1/v2/v3/v4 transfers and reports compiler scope. `project import --input ...` accepts a snapshot. Conflicting configured/imported identity or source/test paths require `--resolve project` or `--resolve import`. Saved data never grants execution approval.

Intake preserves `design/project.json`, the original `.framework/imported-project.json`, and a bounded ownership record. Foreign or manually changed intake files are refused. Reviewed reimport updates only the owned input record in the generation receipt; derived output evidence remains stale until generation. Edited business source is preserved, and conflicting changes produce an explicit conflict.

The generator is the existing PR #20 TypeScript compiler, not a new renderer. DataSources still produce ports, services, adapters and per-view Pinia stores. PRD acceptance obligations remain explicit TODOs until implemented and independently accepted. The integrated composition compiler generates authored page/component Vue layouts, typed primitive props, named slots, captured revisions, state visibility, source projections and declared local UI effects. Rich editor engines, arbitrary business behavior and native companion persistence remain implementation obligations; Storymaps remain design/traceability metadata. Blank setup follows the same current schema constant as project import.

Custom `codebaseFolder` and `testsFolder` relocate generated product code/tests and their build/test configuration. Framework internals remain in their existing `src` and `tests` directories. General maker recipes still follow the framework's existing feature conventions. This remaining distinction must not be described as a complete arbitrary-directory framework migration.

`companion:generate` remains dependency-free, exact-byte, read-only JSON output for project schema 6 input; earlier project versions fail with `COMPANION_VERSION`. `generate --vault ... --target ...` retains the existing separate-target workspace compiler and its raw JSON compatibility mode. New in-place generation requires an extracted verified kit; a source checkout is not automatically rewritten into a consumer. In-place `generate` compiles only the imported `design/project.json`; `--input` with another file is refused with `INPUT_REQUIRES_IMPORT` so the reviewed intake record and the managed design file cannot drift apart. Adopt a different design through `project import`.

## Test vault and fixtures

```sh
node bin/app vault prepare --yes
node bin/app plugin install --dry-run --json
node bin/app plugin install --yes --json
node bin/app data plan --input test-data-manifest.json --json
node bin/app data apply --input test-data-manifest.json --apply <approval-hash> --json
node bin/app data reset-plan --input test-data-manifest.json --json
node bin/app data reset --input test-data-manifest.json --apply <approval-hash> --json
```

Installation uses the configured isolated-vault marker and only built plugin assets. It preserves `data.json`, unrelated notes/plugins and security settings, and never enables the plugin. `.test-vault` is the new default; existing protected `.dev-vault` workflows retain their legacy installer rather than being moved silently. Alternate host configuration-directory names are supported explicitly.

Fixture commands reuse the real exported fixture engine, validators and ownership receipts. The existing v1 fixture engine supports `.test-vault` only; other targets fail explicitly. `--yes` does not replace the fixture approval hash. Reset removes only unchanged owned fixtures. Provider/HTTP simulation and production wiring are still distinct. Test-data manifest authoring/export remains the existing companion/test-kit contract rather than an implicit interpretation of unfinished recipe declarations.

## Development, maintenance and release

`build`, `test`, `verify`, `dev` and release commands call existing tools with argument arrays and bounded output. Installation uses the selected npm's `ci`, not uncontrolled latest dependency resolution. Missing tools are errors, not skipped passing checks. `verify --profile project` proves generated scaffold build/types/tests; `verify` retains the full framework quality gate. Native evidence is separate.

`framework status` verifies the pinned kit. `framework upgrade --from <extracted-kit>` produces an ownership-aware replacement plan, refuses reused versions/downgrades and edited launchers, and leaves dependency and product-source changes separate. Kit files the new version no longer ships are deleted in the same plan, but only after both kits verify and only while each file still matches its recorded fingerprint; a concurrent edit makes the plan stale instead of losing data. Runtime plugin configs are preserved: an unedited config follows the new shipped default, an edited one is kept when the default did not change, and an edit whose default also changed (or whose plugin was retired) is reported as a plan conflict that blocks apply. A project without `bin/kit.json` (including the retired schema-1 `.framework/` layout, which is never probed) fails with `KIT_REQUIRED`; there is no automatic layout migration, so extract a current kit and reapply project changes in review. Upgrade and source/data migration are not interchangeable.

`release prepare --version X.Y.Z --notes-file ...` plans the existing source-version operation and updates local configured version. It creates no tag, commit or public asset. Reimport/regeneration after a version change may require manual resolution of metadata histories; no blanket overwrite is supported.

`release check` inspects assets/obligations and remains blocked without required evidence. An optional `--input` accepts the existing bounded retained-candidate planning contract; it does not grant publication authority. `release rehearse --commit ... --version ...` uses the existing fixed-source rehearsal and its prerequisites. `release operate --input ...` uses authenticated read-only discovery; actual writes additionally require `--execute --authorize <digest>` from a separately reviewed candidate. `--yes` alone is never publication authorization. `--dry-run` prevents the release adapter from launching even when `--execute` and an authorization value are also supplied; that preview does not check candidate eligibility. GitHub release availability and Obsidian listing approval are separate outcomes.

## Shared API and remaining gates

`bin/adapters/framework/operations.ts` exports `executeOperation(request, context)`. Terminal and headless companion-facing tests submit the same validated requests and get the same plans/results. Contracts and schemas contain no terminal state; Node adapters own file/process access. The native companion has not been converted and direct mobile/runtime RPC is not implemented.

Existing MJS makers, file plans, fixture and release services are reused unchanged or selectively reconciled; their full TypeScript migration, unified legacy/current metadata, arbitrary source migrations and broader native/runtime adapters remain follow-on scope. Do not describe the 57-task backlog as complete because the central workflow runs.

The [continuation record](../_archive/testing/PR18-CLI-CONTINUATION.md) records the latest reconciliation and regression evidence; the [earlier execution record](../_archive/testing/FRAMEWORK-CLI-IMPLEMENTATION.md) distinguishes local tests, actual ZIP extraction, generated-consumer CI, native qualification and publication. SH-022/SH-034 and companion conversion/publication gates remain blocked until their actual evidence and separate authorizations exist.
