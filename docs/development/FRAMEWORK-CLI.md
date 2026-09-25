# Framework CLI and developer-kit workflow

Implementation on PR #18, 2026-09-25. This is a developer-facing TypeScript CLI and assembled ZIP workflow, not a published framework release or native companion conversion. The [framework-first plan](FRAMEWORK-CLI-GENERATOR-PLAN.md) remains broader than the implemented and qualified scope below.

## Start from the extracted archive

The build of the framework distribution is an explicit maintainer action:

```sh
node shell.mjs framework pack --out ./plugin-framework.zip --yes --json
```

This uses the installed TypeScript compiler, compiles tooling into `.framework/compiled`, retains the matching template under `.framework/template`, and records file hashes, versions and source identity in `.framework/kit.json`. The ZIP has deterministic sorted entries and fixed timestamps. Packing does not upload, publish or install anything. A configured consumer cannot be repackaged as the framework by this command. Checksums detect corruption; they do not authenticate an untrusted distributor.

The user extracts that ZIP into a new directory and runs either:

```sh
node shell.mjs setup
npm run setup
```

The distributed entry point runs compiled JavaScript before `node_modules` exists. The source-checkout launcher retains Node's TypeScript development fallback; that fallback is not required in the archive. Source and distributed routes execute the same TypeScript operation handlers.

Interactive setup requests a project JSON path or a blank project identity. It reviews configuration/intake, then offers reviewed generation and separately approved network/dependency installation. Cancellation or refusal does not authorize later stages. Existing files are not deleted to make setup succeed. The standalone project root is independent of an Obsidian vault.

## Explicit human and agent workflow

```sh
node shell.mjs setup --input ./my-project.json --dry-run --json
node shell.mjs setup --input ./my-project.json --yes --json
node shell.mjs generate --plan-out generation.plan.json --json
node shell.mjs plan inspect generation.plan.json --json
node shell.mjs plan apply generation.plan.json --yes --json
node shell.mjs install --yes --json
node shell.mjs build --json
node shell.mjs test --profile project --json
node shell.mjs verify --profile project --json
```

A configured blank start uses `setup --id my-plugin --name "My Plugin" --author "Author" --blank --yes`. It creates an inert minimal design through the same intake validator, not a competing template generator. Supplying identity without `--blank` or `--input` only configures the project. Import can follow later.

`npm run --silent shell -- <command> --json` returns the same structured result without npm's script banner. In a generated kit, `npm run make -- feature bookmarks --dry-run` reaches the same maker planner. Optional package `bin` metadata exposes `obs-shell` when explicitly linked/installed onto PATH; global installation is never required or performed automatically.

`help`, `capabilities`, `make list`, `make describe <recipe>` and `schema` are data-only discovery. They do not load executable project configuration or custom makers. The legacy `npm run capabilities` catalog remains a separate compatibility contract; the central CLI catalog describes its current handlers. Custom-maker execution requires `--trust-custom`; metadata declarations are not a sandbox.

`--json` emits one versioned result on stdout, including parser errors. Logs/progress use bounded stderr. `--no-interaction`, JSON mode and non-TTY input never prompt. Results distinguish planned, blocked, applied, unchanged, cancelled and failed states. Nonzero exit does not imply rollback; bounded recovery and process outcomes remain available. POSIX subprocess groups are terminated on timeout/cancellation; Windows currently guarantees direct-child termination, not a general descendant-tree transaction.

## Scoped help, input and design-system exports

`node shell.mjs --version --json` reports the pinned framework/Node versions. `help styles export` or `styles export --help` describes that operation only; `make describe <recipe>` rejects unknown recipes. Returned command descriptors are isolated copies and cannot change execution policy. Structured API request fields are never reinterpreted as command-line options.

File and stdin intake are bounded and reject invalid UTF-8. Ctrl-C, termination, prompt EOF and input cancellation settle without waiting for an upstream EOF. Cancellation does not imply that earlier completed steps were undone. Saved plans must not occupy one of their own output paths or the configured test vault; custom-code approval is never serialized.

```sh
node shell.mjs styles inspect --input design/project.json --json
node shell.mjs styles export --input design/project.json --format css --dry-run --json
node shell.mjs styles export --input design/project.json --format css --yes --json
node shell.mjs styles export --input design/project.json --format html --yes --json
```

CSS is byte-identical to the scoped compiler used during project generation. `json`, `markdown` and self-contained `html` exports are also supported. The default output is `exports/design-system.<extension>`; `--out` selects a safe project-relative file. Existing different bytes are preserved and reported as conflicts. No fonts, scripts or remote assets are fetched. Documentation escapes authored markup and is not evidence of accessibility acceptance.

Status derives design freshness from actual input hashes. Large v4 traceability has a separate bounded 4,000,000-byte data profile; the smaller operation-request and approval limits remain unchanged. Accepted metadata does not prove business requirements are implemented.

## Import, configuration and regeneration

`shell.config.json` stores portable identity and paths. `config get`, `config explain`, `config validate` and `config set --input ...` inspect or plan changes. After generation, `manifest.json` remains the plugin identity authority. Import cannot silently replace a generated ID/version or move generated folders. Relocation requires a separately reviewed migration; this CLI does not yet automate arbitrary source-root relocation.

`project inspect --input ...` validates supported v1/v2/v3/v4 transfers and reports compiler scope. `project import --input ...` accepts a snapshot. Conflicting configured/imported identity or source/test paths require `--resolve project` or `--resolve import`. Saved data never grants execution approval.

Intake preserves `design/project.json`, the original `.framework/imported-project.json`, and a bounded ownership record. Foreign or manually changed intake files are refused. Reviewed reimport updates only the owned input record in the generation receipt; derived output evidence remains stale until generation. Edited business source is preserved, and conflicting changes produce an explicit conflict.

The generator is the existing PR #20 TypeScript compiler, not a new renderer. DataSources still produce ports, services, adapters and per-view Pinia stores. PRD acceptance obligations remain explicit TODOs until implemented and independently accepted. The integrated composition compiler generates authored page/component Vue layouts, typed primitive props, named slots, captured revisions, state visibility, source projections and declared local UI effects. Rich editor engines, arbitrary business behavior and native companion persistence remain implementation obligations; Storymaps remain design/traceability metadata. Blank setup follows the same current schema constant as project import.

Custom `codebaseFolder` and `testsFolder` relocate generated product code/tests and their build/test configuration. Framework internals remain in their existing `src` and `tests` directories. General maker recipes still follow the framework's existing feature conventions. This remaining distinction must not be described as a complete arbitrary-directory framework migration.

Legacy `companion:generate` remains dependency-free, exact-byte, read-only JSON output. `generate --vault ... --target ...` retains the existing separate-target workspace compiler and its raw JSON compatibility mode. New in-place generation requires an extracted verified kit; a source checkout is not automatically rewritten into a consumer. In-place `generate` compiles only the imported `design/project.json`; `--input` with another file is refused with `INPUT_REQUIRES_IMPORT` so the reviewed intake record and the managed design file cannot drift apart. Adopt a different design through `project import`.

## Test vault and fixtures

```sh
node shell.mjs vault prepare --yes
node shell.mjs plugin install --dry-run --json
node shell.mjs plugin install --yes --json
node shell.mjs data plan --input test-data-manifest.json --json
node shell.mjs data apply --input test-data-manifest.json --apply <approval-hash> --json
node shell.mjs data reset-plan --input test-data-manifest.json --json
node shell.mjs data reset --input test-data-manifest.json --apply <approval-hash> --json
```

Installation uses the configured isolated-vault marker and only built plugin assets. It preserves `data.json`, unrelated notes/plugins and security settings, and never enables the plugin. `.test-vault` is the new default; existing protected `.dev-vault` workflows retain their legacy installer rather than being moved silently. Alternate host configuration-directory names are supported explicitly.

Fixture commands reuse the real exported fixture engine, validators and ownership receipts. The existing v1 fixture engine supports `.test-vault` only; other targets fail explicitly. `--yes` does not replace the fixture approval hash. Reset removes only unchanged owned fixtures. Provider/HTTP simulation and production wiring are still distinct. Test-data manifest authoring/export remains the existing companion/test-kit contract rather than an implicit interpretation of unfinished recipe declarations.

## Development, maintenance and release

`build`, `test`, `verify`, `dev` and release commands call existing tools with argument arrays and bounded output. Installation uses the selected npm's `ci`, not uncontrolled latest dependency resolution. Missing tools are errors, not skipped passing checks. `verify --profile project` proves generated scaffold build/types/tests; `verify` retains the full framework quality gate. Native evidence is separate.

`framework status` verifies the pinned kit. `framework upgrade --from <extracted-kit>` produces an ownership-aware replacement plan, refuses reused versions/downgrades and edited launchers, and leaves dependency and product-source changes separate. Retired kit files require a deliberate removal migration instead of implicit deletion. Upgrade and source/data migration are not interchangeable.

`release prepare --version X.Y.Z --notes-file ...` plans the existing source-version operation and updates local configured version. It creates no tag, commit or public asset. Reimport/regeneration after a version change may require manual resolution of metadata histories; no blanket overwrite is supported.

`release check` inspects assets/obligations and remains blocked without required evidence. An optional `--input` accepts the existing bounded retained-candidate planning contract; it does not grant publication authority. `release rehearse --commit ... --version ...` uses the existing fixed-source rehearsal and its prerequisites. `release operate --input ...` uses authenticated read-only discovery; actual writes additionally require `--execute --authorize <digest>` from a separately reviewed candidate. `--yes` alone is never publication authorization. `--dry-run` prevents the release adapter from launching even when `--execute` and an authorization value are also supplied; that preview does not check candidate eligibility. GitHub release availability and Obsidian listing approval are separate outcomes.

## Shared API and remaining gates

`scripts/framework/operations.ts` exports `executeOperation(request, context)`. Terminal and headless companion-facing tests submit the same validated requests and get the same plans/results. Contracts and schemas contain no terminal state; Node adapters own file/process access. The native companion has not been converted and direct mobile/runtime RPC is not implemented.

Existing MJS makers, file plans, fixture and release services are reused unchanged or selectively reconciled; their full TypeScript migration, unified legacy/current metadata, arbitrary source migrations and broader native/runtime adapters remain follow-on scope. Do not describe the 57-task backlog as complete because the central workflow runs.

The [continuation record](../testing/PR18-CLI-CONTINUATION.md) records the latest reconciliation and regression evidence; the [earlier execution record](../testing/FRAMEWORK-CLI-IMPLEMENTATION.md) distinguishes local tests, actual ZIP extraction, generated-consumer CI, native qualification and publication. SH-022/SH-034 and companion conversion/publication gates remain blocked until their actual evidence and separate authorizations exist.
