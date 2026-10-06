# Main reconciliation review

Review date: 2026-10-06. Starting main: `963a0ec599c90dc8db75f1cb1351e2c2673df383`.
The review covers the Workbench source, CLI distribution, generated-project contracts,
Vue lifecycle, dependency updates, test boundaries and GitHub workflows.

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

The root Vue TypeScript project now discovers the newly moved CLI through its
existing `src/**/*.ts` include. The CLI imports JavaScript tooling modules and
already has a separate strict compiler configuration with JavaScript resolution.
The proposed fix preserves the original 108 runtime TypeScript inputs and 12 Vue
components, checks all 514 CLI modules through their dedicated configuration, and makes the public typecheck
command execute both. Automatic approval review rejected the Vue exclusion as a
possible coverage reduction, so this configuration change is pending the owner's
decision. The root typecheck must not be reported as passing meanwhile.

No numeric threshold, owner approval record, golden baseline or intentional
negative test has been relaxed. The self-review guard requires owner review of
the configuration/path changes; its flags remain visible.
