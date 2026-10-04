# Test suites

The repository's tests are separated by responsibility so each part of the
project can be tested on its own. One declarative manifest,
[`tests/suites.json`](../../tests/suites.json), names every suite, its runner,
file patterns, prerequisites, whether `npm run verify` runs it, the workflows
that cover it and the [test-pyramid level](#test-pyramid-levels) of every test
file. [`scripts/testing/suites.mjs`](../../scripts/testing/suites.mjs)
lists, checks and runs the suites; `verify` builds its tooling step from the same
manifest.

```sh
npm run test:suites -- --list          # suites, file counts, runner, prerequisites, command
npm run test:suites -- --list --json   # machine-readable, including every classified file
npm run test:suites -- --check         # fail-closed classification and levels (also the first verify step)
npm run test:suites -- --pyramid       # test files per pyramid level, with shape warnings (--json too)
npm run test:unit                      # every unit-level test file, across suites
npm run test:integration               # every integration-level test file, across suites
npm test                               # runtime suite (fast default, unchanged)
npm run test:cli                       # one suite by responsibility
npm run test:tooling                   # every suite verify runs in its tooling step
node scripts/testing/suites.mjs cli makers -- --test-name-pattern=CAP   # several suites + runner args
node scripts/testing/suites.mjs generator --dry-run                     # print exact commands only
```

## Suites

The rows mirror `npm run test:suites -- --list --json` (level, purpose,
classified file count, npm script, runner, prerequisites and `verify` mode) for
this checkout. Level is the suite's `level`; `(+ …)` names the other levels its
`levels` overrides give to some of its files. `--check` fails with `SUITE_UNDOCUMENTED` when a suite in
`tests/suites.json` has no row here. Durations are single measured runs on the
reference Linux container recorded below, taken when several suites held fewer
files; they are orientation, not budgets, and "not measured" suites were added
or split after that run.

| Suite | Level | Purpose | Files | Command | Runner | Prerequisites | In `verify` | Measured (2026-09-26) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `maker:pty` | integration | Real Linux/macOS pseudo-terminal authoring, agent parity, safe review and OS terminal restoration; standard-library Python only. | 1 | `npm run test:maker:pty` | Python command | `python3` | opt-in | not measured |
| `maker` | integration (+ unit, component) | Interactive and agent-equivalent sketch/prototype makers, data-driven guides, guarded persistence and compiler-generated handoff packages. | 116 | `npm run test:maker` | `node --test` | none | tooling | not measured |
| `workbench-plugins` | component | Trusted Workbench plugin SDK: plugin-local contracts, event bus, CLI/TUI contributions, framework adapters and custom starter contributions. | 1 | `npm run test:plugins` | `node --test` | none | own step | not measured |
| `native-handoff` | not in the manifest | Immutable alternative-source verification, local Git reconstruction, no-overwrite writes and agent diagnostics. | 2 | `node scripts/testing/suites.mjs native-handoff` | Python command | `handoff-python` | opt-in | not measured |
| `airship` | unit (+ integration) | Default-off project tooling, source preview mapping, safe explicit processes and regeneration preservation. | 2 | `npm run test:airship` | `node --test` | none | tooling | not measured |
| `compiler` | integration (+ unit) | Dedicated compiler core, diagnostics, byte-compatibility, architecture, reporting and distribution contracts. | 22 | `npm run test:compiler` | `node --test` | none | tooling | not measured |
| `compiler:properties` | unit | Seeded fast-check compiler invariants; requires installed development dependencies. | 1 | `npm run test:compiler:properties` | `node --test` | none | tooling | not measured |
| `prototypes` | integration (+ unit) | Design-first prototype helpers, real shell delegation, shared generation/distribution and single-file build boundaries. | 6 | `npm run test:prototypes` | `node --test` | none | tooling | not measured |
| `prototypes:python` | integration | Portable prototype package safety and static skill contract tests. | 0 | `npm run test:prototypes:python` | Python command | `python3` | opt-in | not measured |
| `companion:mvp` | e2e | Compiled Vue/Nuxt UI/Vue Flow sitemap, prototype versions/variants and complete v6 authoring round trips. | 2 | `node scripts/testing/suites.mjs companion:mvp` | Node + Python command | `python-playwright`, `concept-chromium` | opt-in | not measured |
| `runtime` | unit (+ component, integration) | Plugin runtime: domain, application services, adapters, Vue/Pinia presentation and the in-memory Obsidian test kit. | 75 | `npm run test:runtime` | Vitest `configs/testing/vitest.config.mjs` | none | own step | 48 s |
| `cli` | integration (+ unit) | Central bin/app CLI: command parsing, plans, process execution, kit/archive distribution, new-project creation and capability discovery. | 43 | `npm run test:cli` | `node --test` | none | tooling | 91 s |
| `cli:journey` | integration | Packs the framework ZIP, extracts it and builds independent generated consumers with a qualified npm (slow, writes reports/framework-cli). | 1 | `npm run test:cli:journey` | Node command | `qualified-npm` | opt-in | 190 s |
| `generator` | integration (+ unit) | Project compiler: companion JSON to generated project files, runtime guards, starters and the shared safe file-plan engine. | 28 | `npm run test:generator` | `node --test` | none | tooling | 187 s |
| `visual` | unit (+ integration) | Visual-design contracts: IR, Nuxt UI catalog, validation, composition, layouts, commands, session and generated model tests. | 6 | `npm run test:visual` | `node --test` | none | tooling | not measured |
| `companion` | unit (+ component, integration) | Companion concept contracts: schema 6 project JSON, storymaps and composition contracts, visual editor harnesses, concept isolation zone and concept metrics. | 37 | `npm run test:companion` | `node --test` | none | tooling | 13 s |
| `companion:schema` | integration | Independent Draft 2020-12 structural validation and semantic-only negative controls over the shared current project corpus. | 1 | `node scripts/testing/suites.mjs companion:schema` | Python command | `python3`, `python-jsonschema` | opt-in | not measured |
| `companion:assembly` | integration | Offline companion assembly check, Python assembly/tamper test and syntax check of every authored concept module. | 1 | `npm run test:companion` | Node + Python command | `python3` | opt-in | 5 s |
| `companion:browser` | e2e | Aggregated companion concept browser suites on one exact assembled artifact (Python Playwright suites plus the Node Playwright suites listed under companion:visual-browser, Chromium). | 23 | `npm run test:companion:browser` | Python command | `python-playwright`, `concept-chromium`, `chromium` | opt-in | 411 s |
| `companion:visual-browser` | e2e | Visual page and component editors end to end in the assembled concept (Node Playwright + Chromium), run through the concept browser runner so the evidence is bound to the exact artifact. | 1 | `node scripts/testing/suites.mjs companion:visual-browser` | Python command | `python3`, `chromium` | opt-in | 45 s |
| `companion:starter-browser` | e2e | Empty current authoring startup, external starter round trip, and independently compiled visual-feature showcase behavior. | 2 | `node scripts/testing/suites.mjs companion:starter-browser` | Node command | `chromium`, `companion-current-build`, `showcase-current-build` | opt-in | not measured |
| `companion:browser-manual` | e2e | Historical concept browser scripts that the aggregated runner does not execute; run individually per docs/concepts/companion/VERIFICATION.md. | 8 | see [concept verification](../concepts/companion/VERIFICATION.md) | manual | `python-playwright`, `concept-chromium` | opt-in | not automated |
| `test-data` | unit (+ integration) | Companion test-data kit: seeded generators, storage plans, loopback server/client and source inventory. | 5 | `npm run test:test-data` | `node --test` | none | tooling | 7 s |
| `makers` | integration (+ unit) | Authoring tools: maker recipes and catalog, checks that the custom-maker and locale recipes write into consumer projects, event contracts, generated-code formatting, example removal and README ownership. | 10 | `npm run test:makers` | `node --test` | none | tooling | 98 s |
| `memory` | integration (+ unit) | Opt-in Hindsight contracts, keyless configuration, real Git/venv/stdio fixtures and desktop registration, without installing Hindsight or calling an LLM. | 4 | `npm run test:memory` | `node --test` | `python3` | own step | not measured |
| `memory:python` | unit | Stdlib-only Python adapter tests with explicit SDK/manager doubles; not live Hindsight inference. | 2 | `npm run test:memory:python` | Python command | `python3` | own step | not measured |
| `native` | integration (+ unit) | Native host protocol and dev-loop tooling units (isolation, identity, receipts, diagnostics, performance reports) without launching Obsidian. | 20 | `npm run test:native-tooling` | `node --test` | none | tooling | 3 s |
| `native:host` | e2e | Real Obsidian smoke in an isolated scratch vault (downloads the host; never a personal vault). | 0 | `npm run test:native` | Node command | `native-runner` | opt-in | not run here |
| `acceptance` | acceptance | Acceptance criterion tests of increments, generated as pending stubs by `node bin/app increment new` and `increment ac add`, `node scripts/delivery/acceptance.mjs stubs` or `npm run dor -- --write` and implemented before the Definition of Done passes. | 0 | `node scripts/testing/suites.mjs acceptance` | `node --test` | none | tooling | not measured |
| `setup` | integration (+ unit) | Guided setup identity, npm install policy, staged build/local install, CSS identity scoping and harness preview. | 6 | `npm run test:setup` | `node --test` | none | tooling | 6 s |
| `release` | integration (+ unit) | Release preparation, promotion plans, remote execution, Definition of Ready/Done delivery checks, audit classification, maintenance discovery and qualification triggers. | 17 | `npm run test:release` | `node --test` | none | tooling | 3 s |
| `quality` | integration (+ unit) | Repository gates: analyzer, lint, coverage inventory, maintainability, tighten-only thresholds, presentation, repository and test-quality policies, evidence producers and this suite manifest. | 30 | `npm run test:quality` | `node --test` | `build` | tooling | 89 s |
| `baseline` | unit (+ integration) | Dependency-free verification baseline: fault ledger, policy, runner, report, source, token and HTTP style-specimen checks, repeated three times. | 8 | `npm run test:baseline` | Node command | none | own step | 20 s |
| `workflows:browser` | e2e | Browser test workflows run in real headless Chromium: the shipped sign-up example with review screenshots, failing locators, blocked remote requests, masked captures, loopback URL and prototype targets, and the exported spec in the Playwright runner. | 1 | `node scripts/testing/suites.mjs workflows:browser` | Node command | `chromium` | opt-in | 10 s |
| `browser-specimen` | e2e | Host-style specimen assertions in a real browser (served mode). | 1 | `node scripts/testing/suites.mjs browser-specimen` | Node command | `chromium` | opt-in | 11 s |
| `e2e` | e2e | Served harness in Chromium via Playwright: showcase, modals, persistence lifecycle, accessibility and design system. | 11 | `npm run test:e2e` | Playwright `configs/testing/playwright.config.ts` | `chromium`, `harness-build` | opt-in | 78 s |
| `project` | component | Generated product tests (tests/project) that exist only in a project created by the companion compiler. | 0 | `node scripts/testing/suites.mjs project` | Vitest `configs/testing/vitest.project.config.mjs` | none | opt-in | n/a here |
| `project:ui-effects` | component | Generated composition/UI-effect checks of a companion-generated project. | 0 | `node scripts/testing/suites.mjs project:ui-effects` | `node --test` | none | opt-in | n/a here |
| `obsidian` | e2e | Vitest-driven end-to-end tests against a real sandboxed Obsidian host. | 4 | `npm run test:obsidian` | npm script `test:obsidian` | `native-runner` | opt-in | ~30 s, 4 cases (Obsidian 1.13.7 under Xvfb) |

`npm run test:generator` and `npm run test:framework-cli` remain as aliases of
the `generator` and `cli` suites (both now include their whole responsibility:
starters and file plans, capability discovery). `npm run test:setup-policy` still
runs only the npm install policy file of the `setup` suite.

### Why these boundaries

- **CLI vs generator vs companion.** `bin/app` operations, packaging and
  project creation change independently from the compiler that lowers a design
  into files, and both change independently from the companion concept's JSON
  contracts. Each has its own CI job (`framework-cli`, `generated-companion` and
  `starter` in `ci.yml`) or workflow (`companion-concept-verification`) and now
  its own local command.
- **Test data.** The seeded test-data kit ships into generated projects, so its
  generators, storage plans and loopback adapters are tested without the concept.
- **Makers, setup and release.** Authoring tools, first-run setup/build and the
  release/supply-chain path are separate maintainer journeys with separate risks.
- **Native tooling vs native host.** Protocol, receipt and isolation logic is unit
  tested everywhere; only `native:host` and `obsidian` launch a real host.
- **Quality.** Gate checkers and evidence producers are tested with negative
  fixtures, apart from the product code they gate.
- **Browser suites** (`e2e`, `browser-specimen`, `companion:browser`, `companion:visual-browser`) and slow
  journeys (`cli:journey`) are opt-in because they need explicit provisioning.
- **End-to-end in CI.** The browser and real-host suites (`e2e`, `browser-specimen`, `companion:browser`,
  `companion:visual-browser`, `companion:starter-browser`, `companion:mvp`, `obsidian`, `native:host`) are
  end-to-end: in workflows they run only when a run opts in (the pull request label `e2e`, or the `e2e`
  input) and always in the Release tier. The command list is in
  [GitHub Actions workflows](../development/WORKFLOWS.md#end-to-end-opt-in).

## Test pyramid levels

Every test file has exactly one level. [Test strategy](TEST-STRATEGY.md#3-test-levels-and-responsibilities)
explains why the pyramid has this shape; this is the reference. A file is judged
by the widest boundary any of its cases crosses: one case that spawns the CLI
makes the whole file `integration`.

| Level | What it exercises | Examples |
| --- | --- | --- |
| unit | One module in-process with in-memory or checked-in inputs and test doubles for its ports. No child process, temp directory, network, browser or host. Repository-rule checks that read checked-in files in-process belong here. | `tests/runtime/domain.test.ts`, `tests/tooling/interactive-maker-tui-state.checks.mjs`, `tests/tooling/test-quality.checks.mjs` |
| component | A composed part in-process with its real collaborators: a Vue view with its store, the plugin bootstrapped on the in-memory Obsidian host, a CLI/TUI command or editor session driven through its presentation layer. | `tests/runtime/view-state.test.ts`, `tests/runtime/*-components.test.ts`, `tests/tooling/companion-visual-*.checks.mjs` |
| integration | Real boundaries without a browser or host: child processes (`node bin/app`, npm, git, Python), temp directories and repositories, generated projects on disk, loopback servers. Negative fixtures that run a checker as a process are here. | `tests/tooling/framework-*.checks.mjs`, `tests/tooling/suite-levels-cli.checks.mjs`, `cli:journey` |
| e2e | A real browser or a real Obsidian host. Only whole suites are e2e; each must be `opt-in` and run commands the [e2e opt-in policy](../development/WORKFLOWS.md#end-to-end-opt-in) recognizes, so workflows run it only on the `e2e` label or input and always in the Release tier. Reserved for `tests/e2e/**`, `tests/obsidian/**`, `tests/browser-specimen/**`, `tests/browser-workflows/**` and `tests/concepts/*.browser.{py,mjs}`. | `e2e`, `obsidian`, `companion:browser`, `workflows:browser` |
| acceptance | Acceptance-criteria checks of one increment, traced to its handoff. Reserved for `tests/acceptance/**`. | none yet |

The levels, their order (bottom first) and reserved `paths` are declared once in
`testLevels` in `tests/suites.json`. Each suite has a `level`; a suite whose
files differ adds `levels`, a map from level to file patterns of that suite:

```json
"level": "unit",
"levels": { "component": ["tests/runtime/*-components.test.ts"], "integration": ["tests/runtime/tooling.test.ts"] }
```

`npm run test:suites -- --pyramid` counts files per level and adds the measured
time of single-level suites from the Measured column above. It warns (and still
exits 0) when the shape inverts, by default when `e2e` holds more files than
`integration` or `integration` more than `unit`; `pyramid.warnWhen` in the
manifest sets those pairs and their `maxRatio`. Counted on 2026-10-04 in this
checkout:

| Level | Test files | Suites with such files |
| --- | --- | --- |
| acceptance | 0 | none yet |
| e2e | 52 | 8, all opt-in |
| integration | 246 | 21 |
| component | 50 | 4 |
| unit | 178 | 19 |

The repository tooling is integration-heavy (most `tests/tooling` files drive
the real CLI or temp repositories), so `--pyramid` currently warns
`PYRAMID_INVERTED` for integration over unit. That is the honest shape, not a
gate; new pure logic should get unit tests.

`--level unit[,component…]` runs every suite with files at those levels:
`node --test` and Vitest suites run only those files; a suite whose runner
cannot select files (a command or Playwright suite) runs only when all its files
match, otherwise it is listed as not selected. `npm run test:unit` and
`npm run test:integration` are the two shortcuts; prerequisites still apply, so a
missing Python or build reports that suite as `not-run`.

### Labeling a new test

1. Decide the level from what the file does, by the table above.
2. If it equals its suite's `level`, nothing to do. Otherwise add the path (or a
   naming-convention pattern such as `tests/runtime/*-components.test.ts`) to the
   suite's `levels.<level>` list.
3. A new e2e test belongs in an e2e suite under a reserved e2e path; never
   override a single file to `e2e`.
4. Run `npm run test:suites -- --check`.

## Fail-closed classification

`npm run test:suites -- --check` (the first `verify` step) walks every file under
`tests/tooling`, `tests/runtime`, `tests/verification`, `tests/harness-styles`,
`tests/browser-specimen`, `tests/concepts`, `tests/e2e`, `tests/obsidian` and
`tests/project` (the last three and `tests/concepts` may be absent). Each file must
match exactly one suite `include` (minus its `exclude`) or one `helpers` entry.
`tests/support` and `tests/fixtures` are helper roots. It fails with:

| Code | Meaning and fix in `tests/suites.json` |
| --- | --- |
| `UNCLASSIFIED_TEST_FILE` | No suite or helper claims the file: add a pattern to the owning suite's `include`, or a `helpers` entry for a non-test module. |
| `AMBIGUOUS_TEST_FILE` | Two entries claim it: narrow one `include` or add an `exclude`. |
| `UNDECLARED_TEST_DIRECTORY` / `UNDECLARED_TEST_FILE` | A new `tests/*` directory or loose file: declare it under `roots`/`helperRoots` or move it. |
| `EMPTY_SUITE` / `TEST_ROOT_MISSING` | A non-optional suite matches nothing, or a required root disappeared. |
| `SUITE_INVENTORY_MISMATCH` | A suite with an `inventory` (the concept browser runner) differs from the files its runner actually executes. |
| `TOOLING_NOT_IN_VERIFY` / `TOOLING_NOT_IN_EVIDENCE` | The `verify` tooling suites must equal the evidence producer's tooling inventory (`tests/tooling/**/*.{checks,test}.mjs`), so `SHELL_EVIDENCE_TOOLING=1` runs the identical set. |
| `SUITE_SCRIPT_MISSING` / `SUITE_SCRIPT_MISMATCH` | A declared `npmScript` is absent from `package.json` or does not run that suite. |
| `TEST_LEVELS_UNDECLARED` / `TEST_LEVELS_INVALID` | `testLevels` is missing, or a level lacks a lowercase name, a summary or valid `paths`. |
| `SUITE_LEVEL_MISSING` / `SUITE_LEVEL_UNKNOWN` | A suite has no `level`, or a `level`/`levels` key that `testLevels` does not declare. |
| `AMBIGUOUS_TEST_LEVEL` / `UNUSED_LEVEL_PATTERN` / `SUITE_LEVEL_OVERRIDES_INVALID` | Two `levels` patterns claim one file, a pattern claims none of the suite's files, or `levels` is malformed or repeats the suite's own level. |
| `TEST_LEVEL_PATH_MISMATCH` | A file under a level's reserved `paths` resolves to another level, or a file elsewhere resolves to a reserved level. |
| `E2E_LEVEL_OVERRIDE` | `e2e` appears in `levels`, or an e2e suite has overrides: e2e is a whole-suite level. |
| `E2E_SUITE_NOT_OPT_IN` / `E2E_SUITE_NOT_IN_POLICY` / `E2E_POLICY_LEVEL_MISMATCH` | An e2e suite is not `opt-in`, its commands are unknown to `scripts/quality/e2e-policy.mjs`, or a suite whose commands that policy calls end-to-end is not level `e2e`. |
| `SUITE_UNDOCUMENTED` / `SUITE_DOCUMENTATION_MISSING` | A suite has no `` | `name` | `` row in the guide named by `documentation` (this page), or that guide cannot be read. |

Tooling fixtures (`*-fixture.mjs`, `file-symlink.mjs`), runtime fixtures/helpers,
Playwright fixtures and generated project fixtures are helpers, not tests. A new
helper with another name must be declared, so a misnamed test cannot hide as one.

Suites whose files a distributed framework kit omits (the concept prototype and
its browser runner) are `optional`: their absence is valid, but a runner present
without its tests (or the reverse) still fails. Prerequisites are probed before a
suite starts; a missing browser, Python package, environment variable or build
output reports the suite as `not-run` with a provisioning hint and a nonzero exit,
never as passed. A Chromium revision that differs from the one Playwright pins is
reported as `not-run` with the reason `browser-revision-mismatch` and the exact
`SHELL_CHROMIUM=<path>` opt-in (see the cloud and agent sessions section of the
developer workflow). Manual suites also exit nonzero.

## How `verify` uses the manifest

`scripts/quality/verify.mjs` runs `suites.mjs --check`, then (unless
`SHELL_EVIDENCE_TOOLING=1` selects the unchanged evidence producer) runs each
`verify: "tooling"` suite as its own serialized `node --test --test-concurrency=1`
call, printing `▶ tooling suite: <name> (<n> files)`. Every tooling suite runs
even after one fails, and the step then fails naming the failed suites, so a
single `verify` still reports the complete tooling set. `runtime` and `baseline`
remain dedicated `verify` steps (production coverage and `verify-baseline`).

## Adding a test

1. Name the file by behavior with the responsibility prefix of its suite, for
   example `tests/tooling/framework-<behavior>.checks.mjs` for the CLI.
2. Run `npm run test:suites -- --check`. If it reports the file as unclassified,
   extend the owning suite's `include` in `tests/suites.json`. If the file's
   [level](#labeling-a-new-test) differs from the suite's `level`, add it to the
   suite's `levels`.
3. When you add a suite, give it a `level` and add its row, with that level, to
   the table above (`--check` reports `SUITE_LEVEL_MISSING` and
   `SUITE_UNDOCUMENTED` until you do).
4. Run the suite alone (`npm run test:<suite>`), then `npm run verify`.

## Workflow coverage

| Workflow | Suites |
| --- | --- |
| `ci` › `showcase`, template-authoring jobs | all `verify` suites (via setup/verify), `e2e` |
| `ci` › `framework-cli` | `cli`, `cli:journey`, `prototypes`, `prototypes:python` |
| `ci` › `generated-companion`, `starter` | `generator`, `visual`, `companion-project` of `companion`, generated `project` suites |
| `ci` › `real-obsidian` | `obsidian` |
| `ci` › `baseline` | `baseline` |
| `setup-compatibility` | all `verify` suites via setup on the Node 24.15.0 / npm 12 legs (the qualified-toolchain legs defer verify to `ci`), npm install policy of `setup` |
| `companion-concept-verification` | `companion:assembly`, `test-data`, `visual`, the concept `companion` files, `companion:visual-browser` (its own step first), then `companion:browser` |
| `candidate-qualification` | `runtime`, `e2e`, `native:host` through evidence producers; `release` via rehearsal |
| `release-rehearsal` | `release` path via `release:rehearse` |
| `dev` › `fast` (Dev checks) | no node `--test` suite (`check --fast --skip-suites` reports the ones the diff selects as skipped; `verify` runs them in `ci`): typecheck, lint, eslint and related Vitest tests on the diff, `suites.mjs --check`, `check:repository`, changelog structure and the advisory self-review guard |
| `ci` › `self-review` | none: the blocking diff-based self-review guard |
| `release` | every row above through the workflows it calls with `tier: release` (every matrix leg), plus `candidate-qualification` |

Workflows keep their existing explicit commands; the manifest records which suite
each covers.

## Measured run

Measured once each on 2026-09-26 in a shared Linux container (Node 24.21.0,
npm 11.19.1) while other workloads ran, so times are indicative only:

- Tooling suites (`verify` tooling step): cli 91 s, generator 187 s, companion 13 s,
  test-data 7 s, makers 98 s, native 3 s, setup 6 s, release 3 s, quality 89 s;
  about 8.3 minutes in total, all passed.
- `runtime` 48 s (73 files, 413 tests), `baseline` 20 s (three repetitions),
  `companion:assembly` 5 s (15 Python tests plus the concept syntax check).
- Opt-in, provisioned in scratch directories: `browser-specimen` 11 s and `e2e`
  78 s (50 tests) with `PLAYWRIGHT_BROWSERS_PATH`; `companion:browser` 411 s (26
  suites) with a scratch Python venv and `SHELL_CHROMIUM`; `cli:journey`
  190 s (packed ZIP, two extracted kits, independent generated consumers) with `QUALIFIED_NPM` and `RUNNER_TEMP` in a scratch directory.
- `native:host` was not run: its isolated native runner was not provisioned, and
  the runner reported it as `not-run` with exit code 1. `project` and
  `project:ui-effects` have no files in this checkout (they exist in generated
  projects). `obsidian` (four `*.obsidian.ts` cases) passed through
  `npm run test:obsidian` in about 30 s after the native dev loop was merged.

## Optional Airship contracts

`npm run test:airship` uses the `airship` suite for data validation, generator opt-in, source-location metadata, approved launch behavior and ownership preservation. The `Airship generated-project compatibility` workflow adds independent generated-project install/build and live upstream proxy/browser qualification. It does not submit AI-provider prompts. See [Airship integration](../tooling/AIRSHIP.md).
