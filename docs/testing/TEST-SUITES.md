# Test suites

The repository's tests are separated by responsibility so each part of the
project can be tested on its own. One declarative manifest,
[`tests/suites.json`](../../tests/suites.json), names every suite, its runner,
file patterns, prerequisites, whether `npm run verify` runs it, and the
workflows that cover it. [`scripts/testing/suites.mjs`](../../scripts/testing/suites.mjs)
lists, checks and runs the suites; `verify` builds its tooling step from the same
manifest.

```sh
npm run test:suites -- --list          # suites, file counts, runner, prerequisites, command
npm run test:suites -- --list --json   # machine-readable, including every classified file
npm run test:suites -- --check         # fail-closed classification (also the first verify step)
npm test                               # runtime suite (fast default, unchanged)
npm run test:cli                       # one suite by responsibility
npm run test:tooling                   # every suite verify runs in its tooling step
node scripts/testing/suites.mjs cli makers -- --test-name-pattern=CAP   # several suites + runner args
node scripts/testing/suites.mjs generator --dry-run                     # print exact commands only
```

## Suites

The rows mirror `npm run test:suites -- --list --json` (purpose, classified
file count, npm script, runner, prerequisites and `verify` mode) for this
checkout. `--check` fails with `SUITE_UNDOCUMENTED` when a suite in
`tests/suites.json` has no row here. Durations are single measured runs on the
reference Linux container recorded below, taken when several suites held fewer
files; they are orientation, not budgets, and "not measured" suites were added
or split after that run.

| Suite | Purpose | Files | Command | Runner | Prerequisites | In `verify` | Measured (2026-09-26) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `maker:pty` | Real Linux/macOS pseudo-terminal authoring, agent parity, safe review and OS terminal restoration; standard-library Python only. | 1 | `npm run test:maker:pty` | Python command | `python3` | opt-in | not measured |
| `maker` | Interactive and agent-equivalent sketch/prototype makers, data-driven guides, guarded persistence and compiler-generated handoff packages. | 116 | `npm run test:maker` | `node --test` | none | tooling | not measured |
| `workbench-plugins` | Trusted Workbench plugin SDK: plugin-local contracts, event bus, CLI/TUI contributions, framework adapters and custom starter contributions. | 1 | `npm run test:plugins` | `node --test` | none | own step | not measured |
| `native-handoff` | Immutable alternative-source verification, local Git reconstruction, no-overwrite writes and agent diagnostics. | 2 | `node scripts/testing/suites.mjs native-handoff` | Python command | `handoff-python` | opt-in | not measured |
| `airship` | Default-off project tooling, source preview mapping, safe explicit processes and regeneration preservation. | 2 | `npm run test:airship` | `node --test` | none | tooling | not measured |
| `compiler` | Dedicated compiler core, diagnostics, byte-compatibility, architecture, reporting and distribution contracts. | 22 | `npm run test:compiler` | `node --test` | none | tooling | not measured |
| `compiler:properties` | Seeded fast-check compiler invariants; requires installed development dependencies. | 1 | `npm run test:compiler:properties` | `node --test` | none | tooling | not measured |
| `prototypes` | Design-first prototype helpers, real shell delegation, shared generation/distribution and single-file build boundaries. | 6 | `npm run test:prototypes` | `node --test` | none | tooling | not measured |
| `prototypes:python` | Portable prototype package safety and static skill contract tests. | 0 | `npm run test:prototypes:python` | Python command | `python3` | opt-in | not measured |
| `companion:mvp` | Compiled Vue/Nuxt UI/Vue Flow sitemap, prototype versions/variants and complete v6 authoring round trips. | 2 | `node scripts/testing/suites.mjs companion:mvp` | Node + Python command | `python-playwright`, `concept-chromium` | opt-in | not measured |
| `runtime` | Plugin runtime: domain, application services, adapters, Vue/Pinia presentation and the in-memory Obsidian test kit. | 75 | `npm run test:runtime` | Vitest `configs/testing/vitest.config.mjs` | none | own step | 48 s |
| `cli` | Central bin/app CLI: command parsing, plans, process execution, kit/archive distribution, new-project creation and capability discovery. | 43 | `npm run test:cli` | `node --test` | none | tooling | 91 s |
| `cli:journey` | Packs the framework ZIP, extracts it and builds independent generated consumers with a qualified npm (slow, writes reports/framework-cli). | 1 | `npm run test:cli:journey` | Node command | `qualified-npm` | opt-in | 190 s |
| `generator` | Project compiler: companion JSON to generated project files, runtime guards, starters and the shared safe file-plan engine. | 28 | `npm run test:generator` | `node --test` | none | tooling | 187 s |
| `visual` | Visual-design contracts: IR, Nuxt UI catalog, validation, composition, layouts, commands, session and generated model tests. | 6 | `npm run test:visual` | `node --test` | none | tooling | not measured |
| `companion` | Companion concept contracts: schema 6 project JSON, storymaps and composition contracts, visual editor harnesses, concept isolation zone and concept metrics. | 37 | `npm run test:companion` | `node --test` | none | tooling | 13 s |
| `companion:schema` | Independent Draft 2020-12 structural validation and semantic-only negative controls over the shared current project corpus. | 1 | `node scripts/testing/suites.mjs companion:schema` | Python command | `python3`, `python-jsonschema` | opt-in | not measured |
| `companion:assembly` | Offline companion assembly check, Python assembly/tamper test and syntax check of every authored concept module. | 1 | `npm run test:companion` | Node + Python command | `python3` | opt-in | 5 s |
| `companion:browser` | Aggregated companion concept browser suites on one exact assembled artifact (Python Playwright suites plus the Node Playwright suites listed under companion:visual-browser, Chromium). | 23 | `npm run test:companion:browser` | Python command | `python-playwright`, `concept-chromium`, `chromium` | opt-in | 411 s |
| `companion:visual-browser` | Visual page and component editors end to end in the assembled concept (Node Playwright + Chromium), run through the concept browser runner so the evidence is bound to the exact artifact. | 1 | `node scripts/testing/suites.mjs companion:visual-browser` | Python command | `python3`, `chromium` | opt-in | 45 s |
| `companion:starter-browser` | Empty current authoring startup, external starter round trip, and independently compiled visual-feature showcase behavior. | 2 | `node scripts/testing/suites.mjs companion:starter-browser` | Node command | `chromium`, `companion-current-build`, `showcase-current-build` | opt-in | not measured |
| `companion:browser-manual` | Historical concept browser scripts that the aggregated runner does not execute; run individually per docs/concepts/companion/VERIFICATION.md. | 8 | see [concept verification](../concepts/companion/VERIFICATION.md) | manual | `python-playwright`, `concept-chromium` | opt-in | not automated |
| `test-data` | Companion test-data kit: seeded generators, storage plans, loopback server/client and source inventory. | 5 | `npm run test:test-data` | `node --test` | none | tooling | 7 s |
| `makers` | Authoring tools: maker recipes and catalog, checks that the custom-maker and locale recipes write into consumer projects, event contracts, generated-code formatting, example removal and README ownership. | 10 | `npm run test:makers` | `node --test` | none | tooling | 98 s |
| `memory` | Opt-in Hindsight contracts, keyless configuration, real Git/venv/stdio fixtures and desktop registration, without installing Hindsight or calling an LLM. | 4 | `npm run test:memory` | `node --test` | `python3` | own step | not measured |
| `memory:python` | Stdlib-only Python adapter tests with explicit SDK/manager doubles; not live Hindsight inference. | 2 | `npm run test:memory:python` | Python command | `python3` | own step | not measured |
| `native` | Native host protocol and dev-loop tooling units (isolation, identity, receipts, diagnostics, performance reports) without launching Obsidian. | 20 | `npm run test:native-tooling` | `node --test` | none | tooling | 3 s |
| `native:host` | Real Obsidian smoke in an isolated scratch vault (downloads the host; never a personal vault). | 0 | `npm run test:native` | Node command | `native-runner` | opt-in | not run here |
| `setup` | Guided setup identity, npm install policy, staged build/local install, CSS identity scoping and harness preview. | 6 | `npm run test:setup` | `node --test` | none | tooling | 6 s |
| `release` | Release preparation, promotion plans, remote execution, audit classification, maintenance discovery and qualification triggers. | 8 | `npm run test:release` | `node --test` | none | tooling | 3 s |
| `quality` | Repository gates: analyzer, lint, coverage inventory, maintainability, tighten-only thresholds, presentation, repository and test-quality policies, evidence producers and this suite manifest. | 30 | `npm run test:quality` | `node --test` | `build` | tooling | 89 s |
| `baseline` | Dependency-free verification baseline: fault ledger, policy, runner, report, source, token and HTTP style-specimen checks, repeated three times. | 8 | `npm run test:baseline` | Node command | none | own step | 20 s |
| `browser-specimen` | Host-style specimen assertions in a real browser (served mode). | 1 | `node scripts/testing/suites.mjs browser-specimen` | Node command | `chromium` | opt-in | 11 s |
| `e2e` | Served harness in Chromium via Playwright: showcase, modals, persistence lifecycle, accessibility and design system. | 11 | `npm run test:e2e` | Playwright `configs/testing/playwright.config.ts` | `chromium`, `harness-build` | opt-in | 78 s |
| `project` | Generated product tests (tests/project) that exist only in a project created by the companion compiler. | 0 | `node scripts/testing/suites.mjs project` | Vitest `configs/testing/vitest.project.config.mjs` | none | opt-in | n/a here |
| `project:ui-effects` | Generated composition/UI-effect checks of a companion-generated project. | 0 | `node scripts/testing/suites.mjs project:ui-effects` | `node --test` | none | opt-in | n/a here |
| `obsidian` | Vitest-driven end-to-end tests against a real sandboxed Obsidian host. | 4 | `npm run test:obsidian` | npm script `test:obsidian` | `native-runner` | opt-in | ~30 s, 4 cases (Obsidian 1.13.7 under Xvfb) |

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
   extend the owning suite's `include` in `tests/suites.json`.
3. When you add a suite, add its row to the table above (`--check` reports
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
