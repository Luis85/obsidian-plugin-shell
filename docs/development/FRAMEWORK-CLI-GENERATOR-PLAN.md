# Framework release, CLI and project generator implementation plan

**Implementation checkpoint, 2026-09-25:** The central CLI and compiled-kit workflow are now implemented on PR #18. See [current workflow](FRAMEWORK-CLI.md). Remaining task criteria and native/publication gates are not marked complete.
**Decision:** 2026-09-24. **Status:** accepted delivery direction; implementation is pending. Command names and proposed paths below are design contracts, not available commands. The executable name `obs-shell` is provisional.

Read the [delivery strategy](../product/DELIVERY-STRATEGY.md), [task index](../tasks/README.md), [PR #5 framework review](PR5-FRAMEWORK-READINESS-REVIEW.md) and [current read-only JSON contract](COMPANION-PROJECT-JSON.md). This plan adds scope to existing SH tasks; it does not replace their safety or qualification criteria.

## Current implementation baseline — 2026-09-25

PR #20 has been merged into the base at `1dfa991df77ea5fa742d8bd5e300c877d0d45151`. Preserve its TypeScript compiler, runtime contracts, `shell.mjs` dispatch, binary-safe file-plan extension and generator workflow/tests. The [generator guide](COMPANION-GENERATOR.md) documents current `node shell.mjs generate` and `companion:scaffold` behavior; setup/make currently forward to existing handlers. The implementation is tracked under [SH-035](../tasks/shell/SH-035.md), resolving its concurrent SH-023 collision without dropping scope.

This does not complete the central TypeScript CLI or compiled developer kit: the present compiler launches TypeScript at runtime, expects a separate vault-relative target, retains framework `src`/`tests` roots, and preserves PRD acceptance as explicit TODOs. SH-028 now depends on SH-035 to extend the existing compiler. Other command examples and packaging contracts below remain targets, not availability claims. The dated PR #5 review retains its original scope and has an integration addendum.

## 1. Primary product journey

Download the versioned **framework developer-kit release asset** from GitHub Releases; extract it into a new project folder; run setup from the terminal; configure project/plugin identity; import a project JSON; review and generate boilerplate; implement remaining behavior; build; test; prepare and explicitly publish the resulting plugin; continue maintenance with the same CLI.

The user does not start from an installed plugin, a companion installation, a maintainer checkout or a globally installed command. The extracted folder becomes the development project. Node/npm are explicit prerequisites; Git, browser provisioning, Obsidian and GitHub authorization become prerequisites only for operations needing them. Network-dependent dependency installation is disclosed; a dependency-free bootstrap is not a promise of fully offline development.

The companion remains optional, one-project-per-authoring-vault, and usable for design without Node. Its browser JSON export already enables the handoff; the native companion is not required to qualify or ship the framework.

## 2. Distribution and version ownership

The first framework shipment is a reviewed asset such as `plugin-framework-<version>.zip`, not merely the repository's automatic source ZIP and not an installable Obsidian plugin. It contains the matching compiled CLI, schemas, maker/template inputs, shared framework modules, dependency baseline, notices and integrity/version manifest. Public npm publication is not required: packed local modules or a self-contained layout must work without unpublished workspace references.

Proposed layout before setup:

```text
my-plugin/
  shell.mjs                 # generated bundle from authored TypeScript
  package.json              # bootstrap aliases, no interactive lifecycle hook
  README.md
  LICENSE
  .framework/
    release.json
    packages/
    templates/
    schemas/
```

The distributed CLI must run **before** `node_modules` exists and without compiling itself. Author implementation in TypeScript; distribute compiled JavaScript and declarations where applicable. Keep authored tooling in dedicated tooling/scripts modules; a root compiled launcher is not a second handwritten CLI. Bootstrap uses the bundled version; after installation any delegation is to the project's pinned compatible version. No silent fetch of latest packages, global installation or automatic upgrade.

Framework, CLI, template, transfer schema, operation protocol, generator and plugin versions have separate identities. A release manifest records the compatible set. Plugin identity/version remains authoritative in `manifest.json` after initialization; machine-local settings and approvals never become portable identity.

## 3. Invocation and discoverability

Required equivalent entry points:

```sh
node shell.mjs setup
npm run setup
node shell.mjs status
npm run --silent shell -- status --json
node shell.mjs make feature bookmarks --dry-run
npm run make -- feature bookmarks --dry-run
```

An installed `obs-shell` binary is additional convenience, not a bootstrap prerequisite. Test Windows command shims and POSIX execution separately. Keep legacy setup/make/build/verify/release entry points as thin compatibility facades. Never call an npm alias recursively from the handler to which that alias delegates.

The first command surface includes setup/config/project import, make discovery/planning/apply, status/doctor, build/test/verify, isolated vault preparation/plugin installation, test-data plan/apply/reset, framework maintenance and release preparation/rehearsal. A catalog labels each operation implemented, unavailable or planned; help must not promise unavailable execution.

`status` is fast and read-only: project/version/path/state/known-blocker orientation. `doctor` diagnoses and proposes repairs; repairs are separately approved operations. Neither runs arbitrary configuration modules nor launches Obsidian incidentally. Working-directory resolution is explicit, supports an override, rejects ambiguous roots and distinguishes framework bootstrap, generated project and missing configuration.

## 4. Shared TypeScript architecture

```text
Terminal arguments/prompts ──┐
Companion operation adapter ┼─> typed tooling operations -> host ports
Contract tests ──────────────┘              |
                                 schema + semantic model
                                 recipes + plan + receipts

Plugin UI / commands / exposed app operations
                  -> shared feature use cases -> injected host adapters
```

Extract logical boundaries before mandating a repository-wide package move. Preserve `src/features/api.ts` as the reviewed compatibility surface. Domain/application and shared semantic contracts stay free of Node, Obsidian, Vue, Pinia and terminal imports. Filesystem/process access belongs to Node adapters; native vault/persistence/lifecycle belongs to Obsidian adapters. CLI owns parsing, help, prompts, rendering, cancellation and exit mapping only.

Reuse entity/document definitions, validation/defaults, source contracts, generation recipes, ownership rules, diagnostics, migrations, data providers and design-token exporters. Do not duplicate generic services into generated features or let plugin runtime bundles import CLI/process code. Companion UI must not parse human terminal text or maintain another compiler. Optional exposed feature operations use the same handler with deliberate exposure and capability checks; do not automatically export all plugin methods to the terminal.

Existing `.mjs` implementations are the behavioral migration baseline, not disposable code. First reconcile the discovery work from PR #17 through SH-023. Then port modules incrementally with compatibility/differential tests, retaining existing guards, declarations and analyzer inventories. A thin `.mjs` facade is allowed; a parallel JS business implementation is not.

## 5. Setup, configuration and import

`setup` is a resumable coordinator over independently callable operations:

```text
inspect prerequisites -> configure -> import/blank design -> resolve conflicts
  -> validate -> plan -> review/apply -> install dependencies -> report next action
```

Do not attach the wizard to npm install/prepare hooks. Persist checkpoints only on explicit mutations; status and previews stay read-only. Resume revalidates manifest/config/inputs/artifacts instead of trusting a stale completed-step flag. Cancellation and failures retain truthful effects and safe recovery instructions.

Portable operational configuration (proposed `shell.config.json`) stores versioned relative paths and selected defaults. Ignored local configuration stores machine-specific paths. `config explain` reports effective values and provenance. Flag overrides are explicit; sensitive environment values are not echoed. Identity/paths in an imported design cannot silently replace previously configured identity or move source. Human import shows differences; noninteractive conflict resolution requires an explicit policy.

Source/test names remain `codebaseFolder` / `testsFolder`, default `src` / `tests`. Changing a path later is a separate migration with build/test/lint/harness/import/ownership updates, not just changing a string. New-kit isolated test-vault default is `.test-vault`; preserve the existing `.dev-vault` installation and require an explicit migration for older projects. Resolve the host's actual configuration directory; do not assume `.obsidian` universally.

Import stores an accepted design snapshot and provenance after review. It does not execute JSON, URLs, custom recipes, dependency hooks, install a template or generate source implicitly. In the wizard, each subsequent action remains a separately explained/approved step. Exports never carry credentials, execution approvals, generated-file ownership or verification authority.

## 6. JSON contract and deterministic project generation

Preserve the existing `obsidian-companion-project` v1 envelope and exact-byte read-only CLI. The current `scripts/companion/generate.mjs` command remains a compatibility handoff; it must not silently become a writer. Its vault-relative target semantics remain documented separately. New project-root operations do not require any Obsidian vault.

Promote detailed nested authoring validation out of browser-only code into shared TypeScript. Import validity, draft validity and generation readiness are distinct. Validate references/IDs, bounds, schema versions, relationships, source operations, component/action bindings and future-version behavior. Normalize a deterministic semantic intermediate representation; viewport/selection changes must not change generation fingerprints.

The compiler uses **the same maker implementations as `make`**, with dependency closure and field-aware generation. Supported identity, containers/screens, entities, components, actions, settings, source/test bindings, styles, tests and build configuration become ordinary editable source. Every selected design element is classified implemented, scaffolded, documented/manual, unsupported or blocked. Distinguish generated executable structure from implemented business behavior. No placeholder test or TODO is acceptance proof.

A project generation report maps source design IDs to generated paths and outstanding implementation/testing obligations. Full companion self-project JSON is a large contract fixture; it is not proof of a fully implemented native companion. Prove useful bounded Tasks and non-Task consumers independently. Unsupported selected behavior blocks a readiness claim or is explicitly deferred, never omitted.

## 7. Plans, ownership and trust

Plan/apply is shared across setup, makers, full generation, migrations and maintenance. Plans bind schema/generator/template/config/input identities, root, ownership and preimage hashes. Applying stale plans fails closed. `--yes` skips only a confirmation; it does not override unsafe paths, foreign/edited files, incompatible versions or approvals for a different action.

`--dry-run` writes no project files; `--plan-out` is the explicit, narrow exception that writes the requested plan artifact. Read-only catalog/status commands write nothing. Recheck containment, links/junctions/case collisions and expected bytes under cooperating-tool locks. Recovery preserves external edits and reports applied/rolled-back/preserved/uncertain states honestly. Do not claim filesystem-wide atomicity or cross-process CAS.

Keep framework-owned code, user-owned features and regenerable artifacts distinguishable. Generation manifests record recipe/input/preimage provenance without replacing the dependency lockfile. Reimport/regeneration is additive and conflict-aware. Template upgrade, source regeneration and runtime-data migration are distinct operations. Never mutate a running plugin's settings behind its shared persistence writer.

Trusted local custom recipes/project scripts are executable code, not sandboxed by their descriptor. Catalog discovery uses data only; explicit execution requires trust and bounded process handling. Imported text is never permission to run code or fetch URLs.

## 8. Human and agent contracts

One handler serves both presentations. Interactive prompts are cancelable and show defaults, effect boundaries and repair instructions. JSON and noninteractive modes never prompt, including parser errors and missing arguments. A missing required value yields a stable diagnostic and nonzero result rather than a hung agent.

Define versioned request/result/progress/receipt schemas, stable diagnostic codes and documented exit classes. JSON mode emits one result object on stdout; stderr receives bounded diagnostics/progress. Child-process output cannot corrupt JSON. Streaming NDJSON, when supported, is explicit and ends with an actual result. Record timeouts/cancellation/partial writes without fabricating rollback. Include capabilities, side effects, network needs, supported versions and examples in discoverable metadata. This shared schema can drive help/docs/form metadata but does not auto-approve execution.

## 9. Build, tests, installation and maintenance

CLI lifecycle handlers reuse existing build/verify/test/installer/evidence services, not subprocess wrappers around aliases that recurse. Keep last-good complete artifacts after failure. Unit/contract, filesystem, harness, generated consumer and actual native evidence remain distinct. Unavailable required native prerequisites mean blocked/not-run, never passed.

Install only into an approved contained test environment and preserve notes, plugin `data.json`, unrelated plugins and security settings. Installation does not enable a plugin or disable Restricted Mode. Seed/reset only unchanged owned fixture files. Extract the real test-data kit and token/export capabilities into shared tooling; do not treat a downloadable simulator as production source wiring. Real adapters and memory/HTTP simulations are explicit modes.

An optional native-control adapter may use supported Obsidian CLI commands after checking compatibility and an explicit vault/plugin target. Keep design/build usable without Obsidian and keep runtime invocation out of initial bootstrap. A rich live RPC bridge, arbitrary evaluation, broad CLI-extension marketplace and mobile process execution are not first-shipment dependencies. User-run CLI handoff plus typed requests/receipts is the supported fallback until direct native execution is separately accepted.

Maintenance includes doctor, framework/version status, reviewed updates, ownership-aware regeneration and source/runtime migrations, plus versioned deprecation of compatibility aliases. Global latest never overrides a pinned project. Tests cover user edits before planning and before apply, incompatible upgrades and failed recovery.

## 10. Three release responsibilities

| Release concern | Owner/gate | Timing |
| --- | --- | --- |
| Framework kit: shell + generator + CLI | SH-026 packaging, SH-032 archive proof, SH-022 technical readiness, SH-034 authorized shipment | First product shipment; before CP-001. |
| Generated plugin release capability | SH-031 | Must work in first framework; dry-run/rehearsal is acceptance, not a public side effect of tests. |
| Native companion publication/listing | CP-010 then PUB-001 through PUB-005 | Last; never holds the first framework release hostage. |

Re-use current candidate/rehearsal/guarded release operations. Separate repository creation/source push, tag creation, draft upload, promotion and community submission with action-specific approvals. Existing release execution expects a matching tag; do not silently add tag creation to it. Publish only the tested candidate's bytes. Protect imported private designs, machine config, fixtures and secrets from source and release exports.

SH-034 requires a fresh owner approval naming exact framework candidate, archive hashes, destination and requested actions. It also verifies the downloaded published asset. No task status or this documentation update authorizes those actions. CP-001 waits for this shipment as well as technical readiness and CX-007. An unavailable publication approval is an explicit blocker, not permission to bypass the requested order.

Generated Obsidian assets are `main.js`, `manifest.json` and optional `styles.css`; release-tag identity and community listing are separately checked against current official policy. The framework ZIP is not an installable plugin. Companion directory approval is never inferred from GitHub upload success.

## 11. Implementation increments and dependency order

| Increment | Tasks | Exit proof |
| --- | --- | --- |
| 0. Reconcile actual source and CI | SH-001, SH-023; preserve PR #17 discovery | One integration baseline; failures explained/fixed and exact-head checks rerun. |
| 1. Shared foundation and TypeScript CLI | SH-002–SH-012, SH-015–SH-018 as dependencies permit; SH-024, SH-025 | Standalone status -> make plan/apply -> verify slice; no companion imports. |
| 2. Runnable kit and project bootstrap | SH-013, SH-014, SH-026, SH-027 | Extracted archive runs setup before dependency installation; JSON/config conflict review works. |
| 3. Full project generator and lifecycle | SH-028, SH-029, SH-030, SH-031, SH-019 | JSON-derived Tasks plus a distinct consumer build/test; maintenance and release rehearsal work. |
| 4. Framework qualification and shipment | SH-020, SH-021, SH-032, SH-033 -> SH-022 -> SH-034 | Exact archive journey, shared companion adapter contract, fresh owner-approved kit publication. |
| 5. Companion conversion and publication | CX-007 + SH-022 + SH-034 -> CP-001–CP-010 -> PUB lane | Real native product on the shipped kit, then separately authorized publication. |

Not every task in a row is immediately ready; frontmatter dependencies govern. Concept design may continue secondarily without delaying P0. Do not convert the companion, rename root identity, weaken acceptance or fold public mutations into a preconversion gauntlet. A gauntlet without publication authorization stops blocked at SH-034.

## 12. Mandatory release-archive acceptance

Use the actual assembled release asset, not a checkout or a source archive presented as equivalent. In clean disposable environments, remove Git metadata, dependencies, maintainer paths, companion installation and global CLI. Run both direct and npm forms; setup/import default and non-default folders; generate; install exact dependencies; build/test/verify; install into isolated native environment; exercise useful behavior; rehearse release; edit/regenerate/update and preserve changes. At SH-034, redownload the published bytes and compare the qualified hashes.

Run Windows, macOS and Linux for the advertised desktop support; record unsupported/not-run modes explicitly and do not claim them supported. Include spaces, case collisions, links/junctions, Unicode-content policy, wrong/future JSON, conflicting config, occupied root, interruption/resume, stale plan, failed install, stdout discipline, canceled prompt, path relocation, native absence and source/license/privacy inventories. Lockfile mismatch fails before uncontrolled resolution; dependency changes require a reviewed new lockfile. Bind receipts to source, archive, toolchain, input and output hashes. Browser mocks do not establish native acceptance.

## Primary references checked 2026-09-24

- [GitHub releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases): automatic source archives and separately attached release assets are distinct.
- [npm package entry points](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/): binary registration does not remove PATH/bootstrap requirements.
- [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/): requires a matching existing lockfile; it does not repair dependency mismatches.
- [Node TypeScript distribution](https://nodejs.org/learn/typescript/publishing-a-ts-package): distribute compiled entry points and explicitly manage declarations/tooling.
- [Obsidian CLI](https://obsidian.md/help/cli): runtime interaction needs the desktop host; use explicit vault targeting.
- [Obsidian submission](https://docs.obsidian.md/plugins/releasing/submit-plugin): GitHub assets and initial community-directory submission are separate. Recheck policy at release execution.
