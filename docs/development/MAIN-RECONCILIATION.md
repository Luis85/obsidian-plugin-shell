# Main reconciliation review

> Type: explanation · Part of the [docs index](../README.md)

Review date: 2026-10-06. Starting main: `963a0ec599c90dc8db75f1cb1351e2c2673df383`.
The review covers the Workbench source, CLI distribution, generated-project contracts,
Vue lifecycle, dependency updates, test boundaries and GitHub workflows.

## Current reconciliation result — 2026-10-06

This section supersedes the historical hold decisions and partial verification
results below. Ten compatible PRs (#97, #88, #90, #86, #85, #84, #87, #89, #92 and
#94) merged after green checks; incompatible TypeScript 7 PR #93 is closed without
merging. The combined implementation at `4c375dc3`, including main `36ffeab1`,
passed the complete `npm run verify -- --json --keep-going`: **32 passed, zero
failed, skipped or not-run stages**. The full agent check passed all six stages.
Later changes only synchronize delivery metadata and record the owner decisions.
The final copied-bin acceptance also passed after the metadata synchronization.
Evidence is retained in `reports/reconciliation/integrated-verification.json`,
`integrated-full-verify.log`, `integrated-check.log` and `final-copied-bin.log`.

The owner explicitly approved the five prepared approval records for the seven
source-migration configuration findings, including their entry in
`configs/quality/self-review-approvals.json`. The records name exact changed lines;
no lint rule, numeric threshold, runtime input or CLI module is removed from its
gate. The earlier strict TypeScript-project approval remains in effect.

The owner declined the Moment override. The advisory remains open under
[MOMENT-ADVISORY-EXCEPTION](MOMENT-ADVISORY-EXCEPTION.md), with the live security
gate unchanged. Main candidate qualification cannot be called green while those
findings remain. No release or publication is authorized.

## Source and product ownership

Develop the plugin runtime under `src/` and the Workbench CLI under `src/cli/`.
`npm run app:dev -- <arguments>` executes CLI source. `npm run build:cli` produces
`bin/`; `node bin/app <arguments>` executes that product. The maintainer checkout
ignores this build output. Generated consumers retain the compiled CLI in their
initial commit so a fresh clone can run setup before dependency installation.
Fresh Workbench checkouts run the exact locked install and then `npm run build:cli`.
Guided setup and workflow setup perform that build explicitly.

The entire `bin` folder can be copied to an unrelated directory. It contains its
ES-module boundary, launcher, bundled runtime, bundled TypeScript and formatting
tools, template data, plugin defaults, notices and integrity manifests. Node.js
22.13 or newer remains a runtime prerequisite; the qualified development version
is Node 24.21.0. Building or testing a generated project still requires that
project's dependencies and any separately provisioned browser/native host.

The assembler builds and verifies a candidate before replacing the previous
artifact. It refuses edited or unknown owned files, preserves installed app
plugins, coordinates concurrent builds and restores the previous directory on a
failed replacement. Recompiling a generated project retains its upstream kit
templates and upgrade metadata. Root ZIP convenience files are optional at
runtime; the portable folder verifies its own bootstrap files.

The independent projects under `projects/` retain their own framework revisions
and lockfiles. This change updates the Workbench generator and future output;
it does not silently regenerate existing product implementations.

## Findings addressed

| Finding | Consequence | Change and regression evidence |
| --- | --- | --- |
| CLI development source and product files shared `bin` | Source-relative imports, templates and installed tools prevented a clear standalone product boundary | Moved modules to `src/cli`; built and copied only `bin` into an empty directory in `tests/acceptance/main-reconciliation/ac-1.checks.mjs` |
| Closed settings forms retained callable save/toggle actions | A stale view reference could persist preferences after disposal | Both actions check scope lifetime before doing work; real preference services and persistence assertions in `tests/runtime/presentation-composables.test.ts` |
| Manual provenance fingerprinted all of package.json | Unrelated Dependabot updates failed `MANUAL_STALE` despite unchanged documentation | Fingerprint the displayed package version explicitly; keep catalog and renderer hashes; test dependency-only edits and actual version/catalog drift in `framework-manual.checks.mjs` |
| Projects-only required-check aliases could pass while project CI failed | Companion Vitest and TypeScript PRs had green aliases alongside red actual CI | Wait for the newest pull-request workflow run for the exact head SHA; reject failed, cancelled or skipped evidence; test the alias shell behavior in `projects-boundary.checks.mjs` |
| Companion Vitest packages updated independently | `vitest` and its coverage provider could have incompatible exact peers | Group `vitest` and `@vitest/*` minor/patch updates |
| Actions updates touched synchronized workflow copies separately | Projects boundary checks detected source/copy drift | Group Actions updates across the root and independent project workflow directories |
| Candidate evidence capped the complete tooling inventory at 30 minutes | Main qualification terminated with `EVIDENCE_TIMEOUT`; the current inventory takes about 43 minutes | Bound tooling at 60 minutes and the candidate job at 100 minutes; retain 30-minute limits for other producers, all test deadlines, and real timeout/rejection probes in `evidence-cli.checks.mjs` |
| Runtime evidence still counted relocated CLI files as plugin inputs | Candidate coverage rejected a complete 120-input runtime report by expecting 514 CLI inputs in it | Share the runtime inventory between evidence and its coverage gate; retain the separate CLI gate and test that new runtime folders and missing inputs still fail closed |
| Rebuild and generation paths assumed the old layout | Source discovery, docs, lint probes and generated starter inputs diverged | Rebased source imports and paths, preserved the existing starter golden outputs, and retained negative checker fixtures |
| Bundled authoring tools exceeded the first-run application budget | Generated-source verification was blocked before process approval | Minify the vendor compiler, retain inline license notices and exercise its real AST API; keep the 32 MB first-run and 8 MB per-file limits |

## Architecture and Vue review

The runtime already has useful boundaries: framework-free domain/application
contracts, bootstrap composition, feature registration, native adapters and
per-view state. Keep these boundaries instead of adding another service or store
layer. Architecture and presentation checks verify resolved imports, source-zone
coverage and thin Vue component scripts.

The settings correction preserves the existing application service as the owner
of preferences. It leaves serialization and persistence in the application
layer; the composable owns only drafts, pending state and view lifetime. The
existing runtime suites exercise committed events, independent observer errors,
cross-view changes and repeated mount/disposal cycles.

The CLI move keeps its domain/application/adapters/presentation/compiler
separation. Source execution uses current development templates even when a local
`bin` build exists. The built CLI uses its verified packaged templates and identity,
including when an unrelated source checkout exists beside it.

## Dependabot decisions

Reviewed the exact PR heads and their actual workflow results. No required checks
were bypassed and no repository settings were changed.

| PR | Update | Decision |
| --- | --- | --- |
| [#84](https://github.com/Luis85/obsidian-plugin-shell/pull/84) | Actions cache 6.1.0 | Hold: synchronized workflow drift; Projects boundary and CI failed |
| [#85](https://github.com/Luis85/obsidian-plugin-shell/pull/85) | Root vue-i18n 11.4.13 | Hold: Typed Markdown documentation failed on the whole-package provenance hash |
| [#86](https://github.com/Luis85/obsidian-plugin-shell/pull/86) | Companion Vitest 5.0.3 | Hold: coverage provider remains 5.0.2; exact peer install fails; actual Companion CI failed |
| [#87](https://github.com/Luis85/obsidian-plugin-shell/pull/87) | Root vue-tsc 3.3.12 | Hold: Typed Markdown documentation failed |
| [#88](https://github.com/Luis85/obsidian-plugin-shell/pull/88) | Companion Fallow 3.31.0 | Hold despite green CI: the project's report contract explicitly accepts 3.30.0 |
| [#89](https://github.com/Luis85/obsidian-plugin-shell/pull/89) | Root ESLint 10.12.0 | Hold: reviewed dependency policy pins 10.11.0; policy/CI checks failed |
| [#90](https://github.com/Luis85/obsidian-plugin-shell/pull/90) | Companion ESLint 10.12.0 | Hold despite green CI: the project's reviewed dependency policy still pins 10.11.0 |
| [#91](https://github.com/Luis85/obsidian-plugin-shell/pull/91) | Companion Lucide 1.2.139 | Merged after applicable checks passed; merge commit `0d3dc44a0ad0cdbfb5cd5fe636197e4c27157391` |
| [#92](https://github.com/Luis85/obsidian-plugin-shell/pull/92) | Root Lucide 1.2.139 | Hold: Typed Markdown documentation failed |
| [#93](https://github.com/Luis85/obsidian-plugin-shell/pull/93) | Companion TypeScript 7.0.2 | Hold: incompatible qualified parser/compiler policy; actual Companion CI failed |
| [#94](https://github.com/Luis85/obsidian-plugin-shell/pull/94) | Root Node types 26.6.4 | Hold: Typed Markdown documentation failed |

After these repairs land, rebase the held documentation-only failures and rerun
their checks. Fallow, ESLint and TypeScript upgrades still require their own
contract/policy review. Companion CI should additionally exercise its existing
dependency-policy and analyzer contracts: a successful product build alone did
not detect the incompatibilities in #88 and #90.

## Dependency security

The live all-category audit initially reported four affected packages: one high
and three moderate reports. A narrow lockfile update changes only the transitive
`source-map-js` package from 1.2.1 to 1.2.2, addressing
[GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
No direct package constraint or reviewed dependency policy changed.

The remaining moderate advisory is
[GHSA-4p3w-j4w9-5jqw](https://github.com/advisories/GHSA-4p3w-j4w9-5jqw)
in Moment, propagated through the pinned Obsidian SDK and its ESLint plugin.
The audit's proposed fix downgrades the qualified Obsidian toolchain. That is not
an appropriate automatic repair; this needs a reviewed upstream update or a
separately qualified override. The security gate remains visible and blocking.

## Test and workflow recommendations

- Keep source tests and product portability tests separate. Product tests should
  run from a copied `bin` folder without the checkout, Git or node_modules.
- Run expensive compiler, archive and coverage suites sequentially. Concurrent
  deep runs caused CPU timeouts and memory pressure in this environment; a green
  retry only establishes the sequential execution conditions actually tested.
- Preserve golden output and negative fixtures. A layout change should update
  source paths, not accept unrelated generated output changes.
- Keep runtime and CLI coverage scopes explicit and independently gated. All
  moved handwritten CLI modules remain in the dedicated maker checks; generated
  distribution copies must not be counted a second time as authored code.
- Keep real project CI as the evidence behind required-check aliases. A skipped
  or stale run is not a successful qualification of the current head.
- Add browser/native evidence when a change affects rendered behavior or host
  integration. This review does not constitute Windows, macOS, native-host or
  release qualification.
- Reduce the remaining tooling complexity in focused changes. The final
  maintainability report has zero gated findings across 635 production inputs
  and 47 template inputs, but records 258 advisory findings in tooling and 48 in
  fixtures. Highest-priority tooling functions include `dispatch` in
  `scripts/hindsight/cli.ts` (cognitive complexity 92), `compileDesignSystem` in
  `scripts/companion/design-system-css.mjs` (74), and `executeSetup` in
  `scripts/setup/execute.mjs` (66). Extract dispatch handlers and stage operations
  with their existing behavioral tests; keep parser and failure-path fixtures.

## Verification and open decisions

The initial full `verify --json --keep-going` completed with 25 passed, 6 failed
and 1 dependent step skipped. It ran while layout repairs were still being made,
so its failures include superseded source paths and source-digest changes.
It is retained as an initial diagnostic, not presented as a green final gate.

That run passed all 515 production runtime tests and the production/selected-core
coverage gates: 97.44% statements, 95.04% branches, 97.68% functions and 99.11%
lines. Plugin and harness builds passed. Subsequent targeted runs prove copied-bin
portability, exact unchanged starter goldens, generated-source verification,
runtime artifact tamper detection and stable template-preserving rebuilds.
Detailed local output is retained under `reports/reconciliation/`.

Final validation of implementation commit `02d79da2`, reconciled with main at
`151e2f64`, used Node 24.21.0, npm 11.19.1 and the exact lockfile:

| Check | Actual result |
| --- | --- |
| Repaired packaging/generator/workflow regressions, including both increment acceptance tests | 60 passed, zero failures |
| Blank starter generation and replay | 3 passed |
| Reviewed starter golden contracts | 11 passed; all 14 starter baselines unchanged |
| Complete maker suite with coverage | 176 files passed; 1,142 tests passed, one existing skip |
| Maker coverage, 529 CLI/shared inputs | Passed: 93.35% statements, 87.91% branches, 93.57% functions, 94.90% lines; independent core gate passed |
| Final selected verification | 11/11 passed: suite inventory, plugin build, source lint, ESLint, maker types, maker coverage and gate, repository checks, analyzer, maintainability, legacy baseline |
| Full analyzer | Zero findings; every input parsed |
| Legacy baseline | 53 tests passed in each of three runs; existing release block retained |
| Fast agent check with suites delegated | Four passed, root typecheck failed, expensive suites explicitly skipped |
| Live dependency audit after the narrow fix | Zero high/critical and three moderate reports; security gate failed |
| Self-review guard | Seven findings requiring review of source/configuration ownership changes |

The selected verification is explicitly a **partial run**. It does not supersede
the failed full-run verdict or imply that the root typecheck passed. Logs and the
machine-readable result are `reports/reconciliation/final-verification.log` and
`reports/reconciliation/final-verification.json`. The copied-bin acceptance test
used kit source hash
`f027674b5c12e810cc63ba50bcf83eba1c8c350ff5d591c7bcff9f317f4f4912`.
Browser, real Obsidian, Windows and macOS checks were not run in this review;
the served UI did not change and native hosts were not provisioned.

The first hosted Dev run failed during setup: `bin/app`, `bin/README.md` and
`bin/plugins/DEVELOPER-GUIDE.md` were still tracked, leaving an incomplete product
in fresh checkouts. The builder correctly refused that directory because its
integrity inventory was missing. These generated files are now untracked; their
development inputs remain in `src/cli`. The builder's integrity checks are unchanged.

The owner explicitly approved separate strict runtime and CLI typechecking on
2026-10-06. The Vue project excludes `../../src/cli/**`; the public
`npm run typecheck` runs Vue checking and the strict maker configuration, and
passes. This preserves all 108 runtime TypeScript inputs, 12 Vue components and
514 CLI modules. No compiler strictness flag changed. The inventory proof remains
in `reports/reconciliation/type-scope-proof.json`.

`tests/tooling/framework-checkout-build.checks.mjs` copies only Git-tracked files
into a fresh directory, builds the complete CLI, and verifies that a copied `bin`
runs independently. It also runs the public typecheck against that checkout and
injects a real assignment error into each source tree to prove both checks fail
when appropriate. This guards against local build output concealing a broken
checkout or a source tree silently escaping typechecking.

The CI follow-up passed all three fresh-checkout/type-error tests, 23 existing
configuration/distribution regressions, and the same fast gate used by Dev CI:
five executed checks passed, zero failed, with expensive suites explicitly
delegated to the Integration tier. This resolves the runtime typecheck failure
shown in the earlier verification table. The separate self-review and security
findings remain as documented below.

The seven self-review flags cover five files: ESLint's existing error-severity
rules moved with the CLI; Fallow entries/zones moved and its generated
`bin/template/package.json` copy is ignored; gate-selection paths moved; maker
coverage moved to `src/cli`; runtime coverage names its original runtime folders.
Both coverage configurations still load the reviewed thresholds and have empty
exclusion lists. These findings have not been waived or entered into the
owner-only approval file.

No numeric threshold, owner approval record, golden baseline or intentional
negative test has been relaxed. The self-review guard requires owner review of
the configuration/path changes; its flags remain visible.

The implementation is published as draft
[#96](https://github.com/Luis85/obsidian-plugin-shell/pull/96), stacked on planning
draft [#95](https://github.com/Luis85/obsidian-plugin-shell/pull/95).
The Dependabot merge is already on main. This change does not authorize a release,
tag, listing submission or product publication.

## Follow-up product review and polish — 2026-10-06

This pass reviews the existing product without extending its feature set. The
runtime harness was inspected at 360 px and 1360 px, in light and dark themes,
across Overview, Documents, Forms, Events & feedback, and Preferences. The initial
20-panel scan had zero axe findings and no horizontal overflow, but visual
inspection exposed a form layout defect that those checks did not detect.

| Perspective | Finding and disposition |
| --- | --- |
| Task completion and recovery | Task note selection could clear an uncertain-write error and allow another action without a successful reload. Recovery now has independent blocked state, retained through failed reloads. A successful explicit reload or change of note folder resets it. |
| Vue lifecycle and concurrency | A retained edit action could replace the selected note while a write was pending. Public edit actions now honor pending and recovery state; applying a committed result stays an internal operation. |
| Persistence and feedback | An unexpected settings-notification failure was caught as a save failure even after preferences had committed. Feedback has its own error boundary and diagnostic, preserving the actual persistence result. |
| Visual consistency and touch | The generic text-input rule also sized multi-choice checkboxes to full width and 36 px height, squeezing labels into multiple lines. Checkboxes retain native sizing; the clickable label uses the existing host control-height token. |
| Accessibility and forms | Choice errors described the group but not the focused checkbox; list instructions had no control association. Controls now reference both guidance and errors. Optional selects without defaults can be cleared without resetting other drafts; declared defaults retain their existing semantics. |
| Test coverage | The general accessibility and responsive-panel loops omitted Forms. Forms now participates, with real browser assertions for checkbox geometry, readable labels, keyboard error recovery, conditional list guidance, and submission without persistence. |
| Delivery and diagnosis | Draft CI previously deferred the clean-checkout regression to Integration. Dev now executes it and keeps its output, the fast-gate JSON, and checked-out revision in a seven-day artifact. No gate is weakened. |
| Architecture and maintainability | Existing framework-free services, per-view composables, thin Vue components, and source/build ownership remain intact. The fixes use those boundaries without adding another abstraction layer. |
| Performance and resource ownership | Existing served tests exercise twenty mount/disposal cycles and owned timers, dialogs, notices and subscriptions. They passed; no new runtime dependency or background activity was added. Native performance remains separately qualified. |
| Standalone CLI and supply chain | Reviewed replacement/integrity checks, user-plugin preservation, source execution, and isolated-bin acceptance coverage. Their established contracts remain. No dependency or lockfile changed in this pass; the documented Moment advisory and held updates still need separate qualification. |

The three new lifecycle tests failed against the previous implementation before
the fixes. They use real preference/note services with controlled storage or
feedback failures and check persisted bytes, write counts, retained drafts, and
absence of false success. Form tests exercise the real shared component.

Browser evidence uses the explicitly selected `/usr/bin/chromium`, Chromium
151.0.7922.173, rather than the locked Playwright browser revision. Screenshots in
`reports/ui-gallery/gallery.html` are review evidence, not accepted baselines.
Windows, macOS, native Obsidian, other browser engines and the independent
Companion implementation are not newly qualified by this runtime harness pass.

Follow-up validation uses Node 24.21.0, npm 11.19.1 and the unchanged lockfile:

| Check | Actual result |
| --- | --- |
| Selected verification | 26 passed, zero failed; explicitly partial, not a complete `verify` verdict |
| Dev fast gate against the PR base | Five executed checks passed, zero failed; expensive suite delegation remains explicit |
| Runtime production and selected-core coverage | All 81 files and 520 tests passed; 97.44% statements, 95.12% branches, 97.69% functions, 99.11% lines; both gates passed |
| Served browser suite | All 51 tests passed, including both themes, 320–1920 px layouts, keyboard/error recovery and existing persistence/lifecycle journeys |
| Clean-checkout and public type-error regressions | Three passed, including copied-bin execution without checkout dependencies and negative errors in both strict source projects |
| Standalone authoring acceptance | Passed: copied `bin` generates a project and authors a feature without checkout dependencies; missing consumer dependencies are reported honestly |
| Maintainability | Zero gated findings across 635 production inputs and 47 template inputs; tooling/fixture advisories remain separate |
| Legacy baseline | 53 tests passed in each of three runs |
| Self-review | Zero findings for the follow-up; the complete PR retains the same seven earlier configuration flags |
| Gallery | 20 captures, zero capture failures; inspected changed Forms in narrow light and desktop dark layouts |

The selected verification includes exact dependency policy, CLI/plugin/harness
builds, the full analyzer, both strict type projects, source and test ESLint,
source limits, repository/project policy, architecture/presentation boundaries,
test-quality checks, entity/event catalogs, style gates and artifact integrity.
The full all-tooling/maker qualification was not repeated for this focused
runtime/CSS/workflow change. Earlier full-run evidence remains historical.
Machine output is retained in `reports/reconciliation/polish-verification.json`,
`polish-checkout.log`, `polish-e2e.log`, `polish-self-review.json` and
`polish-pr-self-review.json`. Gallery metadata records parent `929ff1b9`; its
captures show the follow-up working tree, not that parent's unchanged sources.
