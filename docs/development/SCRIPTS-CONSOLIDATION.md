# `scripts/` consolidation plan

Status: Stage C typed-core consolidation complete; C25 repaired the merged architecture boundary; Stage D is next. The continuation uses separately pushed
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
- **Remaining D–F:** Planned; no claim of completion until their own tests and gates pass.

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
4. **D: CLI core into `bin/`.**
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
