# `scripts/` consolidation plan

Status: Stage D implementation through D43 on PR #60; C26 aligns maker coverage with the executable shared core. The continuation uses separately pushed
milestones on the same PR; each validation checkpoint is expected to pass the repository's existing
gates before deeper restructuring, with no threshold or scope exemptions. The inventory and sequencing below are planning inputs,
not permission to weaken any quality gate.

## Target shape

| Location | Owns | Quality gates |
| --- | --- | --- |
| `src/` | Obsidian plugin runtime only. | Production coverage/complexity; no Node, CLI or `scripts/` imports. |
| `bin/` | The developer CLI application in TypeScript: `app.ts` entry, commands, domain/application/adapters/presentation. | Production view: `tsconfig.maker.json`, ESLint + oxlint, maker coverage (90/90/90/85, 95 for `bin/domain` + `bin/application`), complexity 10/15, duplication 3%. |
| `scripts/` | Real scripts: gates, suite runners, build/dev loop, release and qualification entry points invoked by npm scripts or workflows. Thin files that call libraries. | Tooling view. |
| templates (later) | Code and text copied into generated projects. | Template/fixture views. |

**Nothing moves into `src/`.** No `scripts/` module is plugin runtime logic, and `src/` never imports
`scripts/` or `harness/` today. "Incorporate into TypeScript" therefore means the CLI's own layered
source under `bin/`.

## Current inventory (verified)

- `scripts/` holds 486 files. `scripts/framework` (60 `.ts`) is the CLI core behind `app.mjs`.
  `bin/` is its interactive maker/TUI half.
- The earlier 79-import `bin/ → scripts/` snapshot is now a migration baseline rather than the target state: shared JSON, result/error, process, input, confirmation, filesystem, project-path, concurrency and file-plan dependencies have typed owners and explicit boundaries.
- No `scripts/` module imports executable `bin/` modules now. Angular setup and legacy preset qualification exercise the public CLI boundary instead.
- Legacy preset qualification still reads its declarative compatibility catalog/guide from `bin/guides`; relocating those assets belongs with the later compiler/domain move, not this dependency-direction cleanup.
- `application-docs/adapters/settings.ts` no longer imports `bin/`; maker and docs settings share the neutral project-path policy.
- Cycles: compiler ↔ companion, and framework ↔ compiler.
- Compatibility `.mjs` entries for JSON data, process, input, confirmation, hash, project-path, bounded mapping and file plans delegate to typed core modules. Remaining untyped engines are concentrated in `makers/*.mjs`, `operations/catalog.mjs` and real tooling scripts.

| Folder | Role today | Direction |
| --- | --- | --- |
| framework | CLI core: parser, catalog, commands, kit/pack, terminal UI | → `bin/` (stage D) |
| compiler (`domain`/`application`/`adapters`) | Compiler core behind `generate` | → `bin/compiler` (stage E). `qualify-*`/`verify-*`/`check-architecture` stay |
| companion `compiler/`, `schema/`, contracts | Generator + project contracts | → `bin/` (stage E). `qualify-*` stay |
| companion `runtime/`, `devkit/`; examples `templates/` | Copied into generated projects | Templates, move only with a rewrite migration |
| application-docs | `docs *` command behaviour | → `bin/docs` (stage E) |
| makers | Maker engine; the standalone CLI has been retired behind `bin/app make` | Engine → `bin/` (E) |
| operations | Capability catalog | Catalog → `bin/` (E); `cli.mjs` stays as a script |
| shared, contracts | Libraries | Typed core module set (C) |
| hindsight | Optional memory app | Stays separate (optional), or `bin/memory` later |
| setup + `setup.mjs` | Legacy identity setup (`npm run setup`) | Keep until `bin/app setup` fully replaces it, then retire |
| `handout.mjs` | Standalone duplicate of `handout *` | Thin delegate or removal (B) |
| quality, security, testing, dev, bundling, documentation, events, maintenance, styles, harness, airship, concepts, agent, release, `help.mjs` | Real scripts | Stay. `release/prepare` and `promotion-plan` helpers become a library the CLI imports |

`scripts/bundling`, `scripts/agent`, `scripts/dev/obsidian-dev.mjs` and `scripts/companion/runtime/*`
are paths that generated projects depend on. Treat them as contracts.

## Duplication to remove

| Concern | Copies today | Single owner |
| --- | --- | --- |
| sha256 | `shared/hash.mjs`, `framework/files.ts` `hash`, `handout-model` `digest`, `setup/journal`, `hindsight/policy`, local lambdas (39 files use `createHash`) | One typed hash helper |
| Argument parsing | `framework/catalog.ts`, `bin/adapters/commands.ts`, `makers/arguments.mjs`, `release/*`, `testing/suites.mjs`, `companion/generate.mjs`, launcher routing in `app.mjs` | One parser/dispatcher in `bin/` |
| JSON result envelope | Framework/maker adapters plus pre-TypeScript bootstrap | `contracts/result-runtime.mjs` runtime + typed `contracts/result.ts`; framework adds bounded failure diagnostics |
| Process spawning | `framework/process.ts` `runNode`, `shared/process.mjs` `runNode`, direct `spawnSync('git', …)` in 7 files | One `runNode` + one git helper |
| fs / JSON / path containment | `exists` ×5, JSON readers ×4, containment checks in ~17 files | Typed fs/plan adapter |
| Confirmation prompts | `framework/input.ts`, `bin/presentation/prompts.ts`, readline in legacy CLIs | Shared yes/no policy in `scripts/shared/confirmation.mjs`; presentation layers own rendering |

## Progress on PR #60

- **A:** Launcher migration, compatibility shim and kit support pushed.
- **B1:** Legacy standalone handout command delegates to the central reviewed plan and validation CLI; added parity regression.
- **B2:** Framework and handout sha256 functions delegate to the existing shared hash helper; added binary and Unicode parity regression.
- **B3:** Documentation, setup and two qualification scripts reuse the same SHA-256 implementation; added exact-byte documentation regression.
- **B4:** Framework discovery, setup journal and handout workspace reuse the same `lstat` presence helper; missing and broken-symlink regressions added.
- **B5:** Framework, maker TUI and legacy maker entry share one yes/no decision parser; prompt rendering remains presentation-specific.
- **B6:** The file-plan safety boundary and capability-catalog digest use the shared SHA-256 implementation; exact digest parity is covered.
- **B7:** The duplicate `scripts/makers/cli.mjs` entry is retired; maker discovery and reviewed plan/apply now exercise `bin/app make`, and capability metadata names only its real sources.
- **B8:** Application-doc settings no longer import maker domain code; both use a neutral shared project-path policy, leaving two qualification-only reverse imports.
- **B9:** Angular setup qualification no longer imports maker first-run internals; it launches the compiled kit's public `first-run` showcase and drives the browser against that reviewed boundary.
- **B10:** Legacy preset qualification no longer imports maker adapters/storage; it reviews and applies `bin/app new` plans. Executable `scripts → bin` module imports are now zero.
- **B11:** Optional Hindsight/memory policy fingerprints now reuse the shared SHA-256 helper; identity/document/plan semantics remain covered by their policy suite.
- **B12:** Stage B closure restored green analyzer/typecheck/maker gates after the shared-path cleanup; helper deduplication, legacy CLI retirement and executable `scripts → bin` dependency reversal are complete.
- **C1:** `contracts/json-data` now has a strict TypeScript implementation; the legacy `.mjs` path is a compatibility re-export while importers migrate incrementally. Framework typecheck includes the typed contracts and direct parity/safety coverage.
- **C2:** `shared/process` now has a typed implementation with the legacy `.mjs` path reduced to a compatibility re-export; exit-code/signal parity is covered and shared TypeScript is part of the framework typecheck.
- **C3:** All TypeScript framework consumers of the bounded JSON contract import `contracts/json-data.ts` directly; the compatibility `.mjs` entry is now limited to remaining JavaScript/legacy consumers.
- **C4:** Typed `bin/` adapters now import the JSON contract directly from `json-data.ts`; the compatibility wrapper is no longer on the maker application's typed path.
- **C5:** `shared/file-plan.ts` now provides strict plan/change/apply contracts over the unchanged reviewed runtime. Typed callers can migrate without changing path validation, locking, stale-preimage checks or rollback semantics in the same milestone.
- **C6:** Framework create/inspect-only consumers now import the typed file-plan facade directly. Apply/rollback callers remain isolated for the next milestone.
- **C7:** Framework apply/rollback callers now use the typed file-plan facade too. The plugin-install artifact list is explicitly typed so only the reviewed `base64` encoding enters the plan boundary.
- **C8:** Maker/bin create/inspect-only adapters now import the typed file-plan facade directly; the two apply callers remain isolated for the next milestone.
- **C9:** Maker/bin apply callers (`first-run` report persistence and shared prepared-plan storage) now use the typed file-plan facade, so the maker application's typed path no longer imports `file-plan.mjs`.
- **C10:** The remaining typed application-docs and compiler adapters now import the typed file-plan facade. An audit of all 197 TypeScript files under `scripts/` found no remaining typed imports of `file-plan.mjs`, `json-data.mjs`, or `shared/process.mjs`.
- **C11:** The fully typed bounded-JSON implementation is now a dedicated `cli-data-contract` Fallow zone. Tests, tooling, maker-host and the compiler/companion tooling boundaries explicitly consume it; maker-domain remains isolated from it.
- **C12:** `contracts/result.ts` now owns the typed protocol envelope and result constructor. Framework failures adapt into that envelope, while maker success and SketchError paths construct through the same helper; a dedicated `cli-result-contract` boundary prevents implementation dependencies from leaking back into the contract.
- **C13:** Maker production coverage now includes the typed JSON contract, result envelope and file-plan facade used by `bin/`. The coverage inventory requires those files explicitly, and maker tests exercise contract success plus representative bounded-JSON refusal paths.
- **C14:** `shared/process.ts` now owns the single Node-script spawn lifecycle. `framework/process.ts` remains the policy adapter for tool discovery, process-tree termination and public diagnostics but delegates spawning, bounded capture, timeout and abort mechanics to the shared typed primitive. The primitive has its own Fallow boundary.
- **C15:** Generic `OperationError` and `requireThat` primitives moved from `framework/contracts.ts` into `contracts/errors.ts`. Framework callers keep the same re-exported API/identity, while shared core modules can now depend on the contract layer without a reverse `shared → framework` dependency.
- **C16:** Yes/no confirmation policy now lives in `shared/confirmation.ts`; framework and maker TypeScript presentation paths import it directly, the legacy `.mjs` entry is compatibility-only, and the contract has dedicated Fallow and maker-coverage ownership.
- **C17:** The typed file-plan facade is now a dedicated `cli-file-plan-contract` boundary. Tests, tooling and maker-host may consume it explicitly; maker domain remains isolated, preparing the safety-critical runtime migration without broad tooling dependencies.
- **C18:** Stdin reading and readline prompt lifecycle now live in `shared/input.ts`. `framework/input.ts` is a compatibility re-export, maker/bin callers import the shared typed transport directly, and input is explicitly owned by maker coverage plus a narrow `cli-input-contract` architecture boundary.
- **C19:** Canonical SHA-256 and lstat-presence helpers now have typed implementations with compatibility-only `.mjs` entries. Framework files/handout and memory-policy TypeScript callers import the typed helpers directly; the helpers have explicit architecture and maker-coverage ownership.
- **C20:** The shared portable project-path policy now has a canonical TypeScript implementation with compatibility-only `.mjs` entry. Maker domain and application-doc settings use it directly, maker coverage owns it, and the existing `project-path-contract` boundary now points at the typed implementation with an explicit regression.
- **C21:** Bounded asynchronous mapping now has a canonical TypeScript implementation with a compatibility-only `.mjs` entry. Direct regressions preserve input-order results, invalid-concurrency refusal and stop-scheduling-on-first-failure semantics.
- **C22:** File-plan validation, containment, locking, stale-preimage checks, staging and rollback now execute from strict `file-plan-runtime.ts`; `file-plan.mjs` is compatibility-only. The file-plan boundary explicitly depends only on typed bounded-concurrency and filesystem contracts, while existing stale-plan and apply regressions remain the behavioral guardrails.
- **C23:** The machine-result envelope now has one bootstrap-safe runtime constructor in `contracts/result-runtime.mjs`. The typed `result.ts` API delegates to it, and both the pre-TypeScript root launcher and legacy handout shim use the same constructor for failures instead of hand-building protocol objects.
- **C24:** Stage C closure: legacy JSON/process/confirmation/hash/presence/project-path/concurrency/file-plan `.mjs` entries are regression-locked as compatibility-only shims over typed owners. Typed result/error/input/file-plan/filesystem/process boundaries and maker coverage are explicit, so Stage D can move routing without reopening core contracts.
- **C25:** Merge repair: the bounded-map primitive now belongs to one Fallow zone (`cli-bounded-map-contract`) instead of two overlapping zones. The file-plan contract depends on that single boundary and the architecture regression uses the same name.
- **C26:** Maker production coverage now measures the executable shared core behind the typed facades—operation errors, bootstrap result runtime, Node-process lifecycle, file-plan runtime and bounded concurrency—at the unchanged 90/90/90/85 thresholds. Targeted maker-suite regressions cover representative result/error, concurrency, create/update/delete/base64/stale/rollback, process exit/timeout/abort/progress and output-limit paths.
- **D1:** Command-surface routing and legacy aliases moved from `app.mjs` into the typed `bin/adapters/router.ts`. `app.mjs` now only selects compiled/source `bin/app` (or re-execs Node with type stripping); `bin/app.ts` delegates framework and memory surfaces to their existing owners. The routing table has direct maker coverage.
- **D2:** The framework CLI composition root is split before relocation: result rendering/diagnostics live in `cli-output.ts`, reviewed interactive plan application lives in `cli-interactive.ts`, and `cli.ts` is reduced to root discovery, setup/new guidance and command orchestration. Behavior remains behind the existing framework CLI tests.
- **D3:** `operations.ts` is split by effect before relocation: reviewed file-plan execution, trusted project-process execution and read-only inspection now live in `operation-files.ts`, `operation-process.ts` and `operation-read.ts`. The public dispatcher retains command classification, discovery, special adapters and release authorization.
- **D4:** Framework CLI result rendering moved into `bin/presentation/terminal/cli-output.ts`. Framework orchestration imports the relocated adapter directly; the old path is a compatibility re-export. Output streams are injectable so maker production coverage verifies JSON-channel isolation, human diagnostics and legacy `new` cancellation rendering without weakening thresholds.
- **D5:** Reviewed interactive plan application moved into `bin/presentation/terminal/cli-interactive.ts`. The adapter keeps framework execution/catalog policy behind injected defaults, while maker coverage verifies review rendering, hash-bound apply, cancellation and dry-run no-prompt behavior. The former framework path is compatibility-only.
- **D6:** The framework CLI composition root moved to `bin/adapters/framework-cli.ts`; `bin/app.ts` now delegates framework routes there directly and `scripts/framework/cli.ts` is compatibility-only. Injected streams preserve stdout JSON isolation and make success/parser-failure paths part of maker production coverage.
- **D7:** Reviewed file-plan command execution moved to `bin/adapters/framework/file-operation.ts`. The dispatcher imports the relocated adapter directly, the old framework path is compatibility-only, and maker coverage drives real setup planning plus hash-bound apply through the relocated CLI.
- **D8:** Read-only framework command execution moved to `bin/adapters/framework/read-operation.ts`. The dispatcher imports the relocated adapter directly, the old framework path is compatibility-only, and maker coverage verifies version, concept-schema and configuration reads through the relocated CLI.
- **D9:** Trusted project-process execution moved to `bin/adapters/framework/process-operation.ts`. Host operations are injectable for tests, preserving real defaults while maker coverage verifies dry-run, build, browser test, project verify, preview dev, release rehearsal, install and framework-pack selection without launching external tools.
- **D10:** The public framework dispatcher moved to `bin/adapters/framework/operations.ts`; the relocated CLI and interactive adapter import it directly and `scripts/framework/operations.ts` is compatibility-only. Maker coverage verifies schema/capability discovery, maker discovery, dry-run process routing and release-operation planning.
- **D11:** Framework command definitions, profile policy and argument parsing moved to `bin/adapters/framework/catalog.ts`. Relocated framework adapters import it directly, the former framework path is compatibility-only, and maker coverage verifies shorthand parsing, common option kinds, validation failures and typo suggestions.
- **D12:** Prototype command definitions and typo-suggestion policy moved beside the relocated catalog in `bin/adapters/framework/`. Catalog/dispatcher imports are now local, both former framework paths are compatibility-only, and maker coverage locks prototype effects plus deterministic typo suggestions.
- **D13:** Machine-readable operation schema generation moved to `bin/adapters/framework/schema.ts`; the dispatcher imports it locally and `scripts/framework/schemas.ts` is compatibility-only. Maker coverage verifies command coverage, common option constraints and the canonical result envelope.
- **D14:** Framework request/context types, option validation and bounded failure adaptation moved to `bin/adapters/framework/contracts.ts`. Relocated CLI modules import it locally, `scripts/framework/contracts.ts` is compatibility-only, and maker coverage locks operation/compiler errors plus safe recovery metadata extraction.
- **D15:** Framework filesystem/root-discovery services moved to `bin/adapters/framework/files.ts`. The relocated CLI/read/process adapters import it locally, `scripts/framework/files.ts` is compatibility-only, and maker coverage verifies bounded reads, hashing, lstat presence and implicit/explicit project-root discovery.
- **D16:** Framework configuration parsing, defaults and import-conflict resolution moved to `bin/adapters/framework/configuration.ts`. The relocated filesystem adapter imports it locally, the former framework path is compatibility-only, and maker coverage verifies portable defaults, invalid identity/overlap refusal and explicit import-resolution semantics.
- **D17:** Framework npm discovery and public Node-process policy moved to `bin/adapters/framework/process.ts`. Dispatcher/process-operation imports are local, `scripts/framework/process.ts` is compatibility-only, and maker coverage verifies explicit npm selection, success/failure metadata, invalid timeout, missing tools and pre-start cancellation.
- **D18:** Owned child process-tree termination moved to `bin/adapters/framework/process-tree.ts`; the process policy imports it locally and the former framework path is compatibility-only. A real hanging child timeout regression drives the relocated termination path while preserving bounded failure metadata.
- **D19:** Handout planning/read adaptation moved to `bin/adapters/framework/handout-adapter.ts`. Read operations import it locally, `scripts/framework/handout-adapter.ts` is compatibility-only, and maker coverage creates/applies a real handout plan then verifies blocked validation/inspection readiness.
- **D20:** Project schema publication and read-only validation/migration moved to `bin/adapters/framework/project-contract.ts`. Read operations import it locally, the former framework path is compatibility-only, and maker coverage verifies current schema publication plus stdin validation with bounded digest/count output.
- **D21:** Project model measurement moved to `bin/adapters/framework/project-measure.ts`. Read operations import it locally, the former framework path is compatibility-only, and maker coverage verifies dry-run behavior, sample-count refusal and a minimal local four-operation measurement without network or writes.
- **D22:** Measurement statistics/timing moved to `bin/adapters/framework/measurement.ts`. Project measurement imports it locally, the former framework path is compatibility-only, and maker coverage locks summary math, warmup/sample accounting and synchronous-only execution.
- **D23:** Support-report projection/collection moved to `bin/adapters/framework/support-report.ts`. Both the framework CLI fallback and read dispatcher import it locally, the former framework path is compatibility-only, and maker coverage verifies diagnostic allowlisting, privacy non-disclosure and blocked/cancelled unavailable outcomes.
- **D24:** Project status/doctor and release-readiness inspection moved to `bin/adapters/framework/inspection.ts`. Support-report and read-operation import it locally, the former framework path is compatibility-only, and maker coverage verifies empty-project diagnostics plus non-authorizing blocked release readiness.
- **D24a (CI repair):** Hindsight launcher snapshots now fingerprint and atomically stage the typed shared hash dependency beside the snapshot's `hindsight/` sources. Desktop registrations remain content-addressed and old snapshots never depend on a mutable global helper.
- **D24b (CI repair):** Maker qualification now exercises generated-project inspection branches introduced by Stage D: configured/generated identity, installed dependencies, traceability obligations, doctor toolchain drift, stale generation detection and complete release assets. Thresholds remain unchanged.
- **D25:** Portable archive-path validation and deterministic ZIP assembly moved to `bin/adapters/framework/archive-path.ts` and `zip.ts`. Former framework paths are compatibility-only; maker coverage locks portable-name rejection, case-insensitive duplicate refusal and byte-deterministic archives.
- **D26:** Plugin-ID formatting, reserved-word policy, derivation and exported-ID review moved to `bin/adapters/framework/plugin-id.ts`. The former framework path is compatibility-only and maker coverage locks creation versus exported-project semantics.
- **D27:** Storybook option parsing moved to `bin/adapters/framework/storybook-options.ts`. The former framework path is compatibility-only and maker coverage locks absent, explicit on/off and invalid-option semantics.
- **D28:** Terminal style primitives and runnable next-step formatting moved to `bin/presentation/terminal/terminal-style.ts`. Relocated CLI output imports them locally, the former framework path is compatibility-only, and maker coverage locks TTY/NO_COLOR, marker, rows, duration and command-hint behavior.
- **D29:** Command help metadata and tiered human help rendering moved to `bin/adapters/framework/help-text.ts` and `bin/presentation/terminal/terminal-help.ts`. Former framework paths are compatibility-only; maker coverage locks fresh-copy metadata, profile/stage/schema option guidance and command/golden/all rendering.
- **D30:** Interactive documentation setup flow moved to `bin/presentation/terminal/docs-setup.ts`. It now shares the canonical yes/no parser instead of local regexes; the former framework path is compatibility-only and maker coverage locks decline, blocked/no-plan, cancellation and hash-bound apply behavior.
- **D31:** Documentation-parser packaging moved to `bin/adapters/framework/docs-vendor.ts`. The former framework path is compatibility-only; maker coverage verifies exact YAML version pinning and packaging only JS/JSON/license assets into the compiled kit.
- **D32:** Data-only `new --from` project intake moved to `bin/adapters/framework/project-from.ts`. The former framework path is compatibility-only; maker coverage locks bounded source loading, identity overrides, missing/malformed/future-schema refusal and plugin-ID validation.
- **D33:** Optional Storybook lifecycle moved to `bin/adapters/framework/storybook.ts` and the relocated dispatcher imports it locally. The former framework path is compatibility-only; injected-executor coverage locks status, disabled refusal, install plan/apply, installed check, dev dry-run and lock-mismatch behavior without launching external tooling.
- **D34:** The relocated framework dispatcher now consumes `bin/adapters/framework/help-text.ts` directly. Help/capabilities no longer bounce through the compatibility path, while the existing parity and rendering regressions remain the behavior guardrails.
- **D35:** Version discovery in `bin/adapters/framework/read-operation.ts` now uses the relocated filesystem adapter directly; the last dynamic hop through `scripts/framework/files.ts` is removed without changing the command surface.
- **D36:** Airship enable/disable file planning moved to `bin/adapters/framework/airship-plan.ts`. The former framework path is compatibility-only; maker coverage locks option overrides, enable/disable outputs, customized-config refusal and generation/intake ownership guards without installing or launching tooling.
- **D37:** Airship status/install/doctor/start execution moved to `bin/adapters/framework/airship.ts`, and the dispatcher imports it locally. Process execution is injectable for contract tests only; maker coverage locks opt-in, environment scrubbing, pinned install verification, safe doctor/start arguments, config conflict and wrong-version refusal without network calls.
- **D37a (CI repair):** The relocated Storybook option adapter now resolves the compiler contract from its actual repository location. Framework typecheck had failed across CI because the move retained the pre-relocation relative import depth; this repair changes only that type import.
- **D38:** Clickdummy build orchestration moved to `bin/adapters/framework/clickdummy.ts`; the relocated dispatcher imports it locally and the former framework path is compatibility-only. Host dependencies are injectable for contract tests only, while maker coverage locks dry-run, generated-project refusal, fixed worker paths, replace/timeout forwarding, output-limit refusal and receipt validation without launching a compiler.
- **D39:** Documentation schema/status/validate/recover and plan adaptation moved to `bin/adapters/framework/docs.ts`; the dispatcher imports read commands locally and the former framework path is compatibility-only. Lazy application-doc adapters remain behind the same boundary, while maker coverage verifies schema isolation, recovery apply/dry-run semantics, blocked validation, status and export/import plan forwarding without filesystem writes.
- **D40:** Test-data fixture planning/apply adaptation moved to `bin/adapters/framework/fixtures.ts`; the dispatcher imports it locally and the former framework path is compatibility-only. Maker coverage locks input/config/target refusal, hash-bound approval, isolated-vault identity, cancellation, reset planning and applied/unchanged outcomes using injected fixture storage only.
- **D41:** Setup terminal guidance moved to `bin/presentation/terminal/setup-terminal.ts`; the framework CLI imports it locally and the former framework path is compatibility-only. Prompt confirmation now uses the shared yes/no policy, while injected dependency coverage locks starter/default identity intake, optional Airship choice, separately approved generate/install/verify/preview stages, generation plan hashes and decline-to-export behavior.
- **D42:** Legacy `new` terminal prompting and summary rendering moved to `bin/presentation/terminal/starter-terminal.ts`; framework CLI/output import it locally and the former framework path is compatibility-only. Optional Airship confirmation now uses the shared yes/no policy; maker coverage locks compatibility identity, `--from` short-circuiting, cancellation/failure rendering and listing/review output.
- **D43:** Generic framework human-result rendering moved to `bin/presentation/terminal/terminal-render.ts`; CLI output now consumes the terminal renderer locally and the former framework path is compatibility-only. Maker coverage locks compatibility identity plus generic and check-result rendering while the canonical JSON result remains authoritative.
- **Remaining D44–F:** Planned; no claim of completion until their own tests and gates pass.

## Stages

Each stage is an independently reviewed milestone; the current continuation pushes milestones
on PR #60. Every stage runs the relevant suites plus
`check:maintainability`, `check:analyzer`, `check:architecture`, lint and typecheck with no threshold changes.

1. **A: launcher rename (this PR).**
   - `shell.mjs` → `app.mjs`, `bin/shell.ts` → `bin/app.ts`, and an extensionless `bin/app`.
   - `shell.mjs` stays as a forwarding shim.
   - Kits carry `app.mjs`, `bin/app` and `shell.mjs`, and still accept the pre-rename bootstrap.
2. **B: low-risk cleanup.**
   - One sha256 helper, one `exists`, one confirm prompt.
   - Make `scripts/handout.mjs` a thin delegate.
   - Retire `makers/cli.mjs` behind `bin/app make` (update `operations.json` and capability tests).
   - Remove the three reverse `scripts/ → bin/` imports.
3. **C: typed core layer — complete on PR #60.**
   - Convert `shared/file-plan.mjs`, `shared/process.mjs` and `contracts/json-data.mjs` to TypeScript.
   - Unify them with `framework/{files,contracts,input,process}.ts`: one envelope, one `runNode`. About 60 import sites.
   - Needs new fallow zones and maker-coverage include/test updates.
4. **D: CLI core into `bin/` — in progress.**
   - Move the routing from `app.mjs` into `bin/app.ts` and merge the two parsers/dispatchers.
   - Move `scripts/framework` into `bin/application/commands`, `bin/adapters/*` and `bin/presentation/terminal`.
   - Split `operations.ts` and `cli.ts` first. Otherwise the production complexity, duplication and coverage gates fail.
   - Touches about 45 test files, `tsconfig.framework.json`, the documentation tsconfig, `.fallowrc.json` and the kit's compiled paths.
5. **E: domain packages into `bin/`.**
   - Break the compiler ↔ companion cycle first.
   - Then move the compiler core, companion compiler/contracts, application-docs, the maker engine and the operations catalog.
   - Update the `test:compiler:coverage` include paths and `compiler/check-architecture.mjs`.
6. **F (optional): templates folder.**
   - Move generated-project templates out of `scripts/`.
   - Update the literal rewrites in `relationship-code.ts`/`http-code.ts` and ship a migration for existing generated projects.

## Launcher reference (stage A)

| Invocation | Notes |
| --- | --- |
| `node bin/app <command>` | Extensionless ES module (`"type": "module"`), all platforms. The form help output and docs use. |
| `./bin/app <command>` | macOS/Linux with the executable bit. |
| `npx obs-shell <command>` | Inside a project only; package `bin` maps `obs-shell` → `bin/app`. Flags pass through. |
| `npm run app -- <command>` | npm consumes flags unless they follow `--`. `npm run shell` is kept as an alias. |
| `node app.mjs <command>` | The launcher; package scripts use it. |
| `node shell.mjs <command>` | Compatibility shim for existing kits, generated projects and scripts. |

`bin/app` is classified by exact path in `scripts/quality/maintainability-inventory.mjs` (measured as
`.mjs`) and linted through an explicit ESLint `files` entry; no directory was exempted.
