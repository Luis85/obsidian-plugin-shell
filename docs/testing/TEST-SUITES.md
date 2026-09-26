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

Durations are single measured runs on the reference Linux container recorded
below; they are orientation, not budgets.

| Suite | Purpose | Command | Runner | Prerequisites | In `verify` | Measured |
| --- | --- | --- | --- | --- | --- | --- |
| `runtime` | Plugin runtime: domain, application services, adapters, Vue/Pinia, in-memory Obsidian test kit (73 files) | `npm test` / `npm run test:runtime` | Vitest `vitest.config.mjs` | none | own step (production coverage run) | 48 s |
| `cli` | Central `shell.mjs` CLI: parsing, plans, processes, kit/archive distribution, `new`, capability discovery (7) | `npm run test:cli` | `node --test` | none | tooling | 91 s |
| `cli:journey` | Packs the framework ZIP, extracts it and builds generated consumers (1 script) | `npm run test:cli:journey` | node script | `QUALIFIED_NPM` | opt-in | 190 s |
| `generator` | Project compiler, runtime guards, starters and the shared safe file-plan engine (15) | `npm run test:generator` | `node --test` | none | tooling | 187 s |
| `companion` | Companion concept contracts: project JSON, storymaps, details, composition, isolation zone, concept metrics (6) | `npm run test:companion` | `node --test` | none | tooling | 13 s |
| `companion:assembly` | Offline assembly check, Python assembly/tamper test, syntax check of every concept module | `npm run test:companion` (runs with `companion`) | Python + `node --check` | `python3` | opt-in | 5 s |
| `companion:browser` | Aggregated concept browser suites, including real-origin storage, on one exact artifact (26 scripts) | `npm run test:companion:browser` | Python Playwright | `PYTHON` with `playwright`, `CHROMIUM_EXECUTABLE` | opt-in | 411 s |
| `companion:browser-manual` | Historical concept browser scripts the aggregated runner does not execute (8) | see [concept verification](../concepts/companion/VERIFICATION.md) | manual | Python `playwright` | opt-in | not automated |
| `test-data` | Companion test-data kit: generators, storage plans, loopback server/client, inventory (5) | `npm run test:test-data` | `node --test` | none | tooling | 7 s |
| `makers` | Maker recipes and catalog, event contracts, generated-code formatting, example removal, README ownership (7) | `npm run test:makers` | `node --test` | none | tooling | 98 s |
| `native` | Native host protocol and dev-loop tooling units, no Obsidian launch (14) | `npm run test:native-tooling` | `node --test` | none | tooling | 3 s |
| `native:host` | Real Obsidian smoke in an isolated scratch vault | `npm run test:native -- --allow-download` | node script | provisioned `.native-runner` | opt-in | not run here |
| `setup` | Setup identity, npm install policy, staged build/local install, CSS identity, harness preview (5) | `npm run test:setup` | `node --test` | none | tooling | 6 s |
| `release` | Release preparation/plans/execution, audit classification, maintenance, qualification triggers (8) | `npm run test:release` | `node --test` | none | tooling | 3 s |
| `quality` | Analyzer, lint, coverage inventory, maintainability, presentation, repository/test-quality policies, evidence producers, this manifest, agent hooks (15) | `npm run test:quality` | `node --test` | `npm run build` (analyzer-archive copies `dist/`) | tooling | 89 s |
| `baseline` | Dependency-free verification baseline and HTTP style specimen, repeated three times (8) | `npm run test:baseline` | `verify-baseline.mjs` | none | own step | 20 s |
| `browser-specimen` | Host-style specimen assertions in a real browser | `node scripts/testing/suites.mjs browser-specimen` | node script + Playwright | Chromium | opt-in | 11 s |
| `e2e` | Served harness in Chromium: showcase, modals, persistence, accessibility, design system (11) | `npm run test:e2e` | Playwright | Chromium, `npm run harness:build` | opt-in | 78 s |
| `project` | Generated product tests under `tests/project` (only in companion-generated projects) | `npm test` in the generated project | Vitest `vitest.project.config.mjs` | generated project | opt-in | n/a here |
| `project:ui-effects` | Generated composition/UI-effect checks (generated projects only) | `npm run test:ui-effects` in the generated project | `node --test` | generated project | opt-in | n/a here |
| `obsidian` | Vitest-driven E2E against a real sandboxed Obsidian (`tests/obsidian`, added by the native dev loop) | `npm run test:obsidian` | npm script | provisioned native runner | opt-in | ~30 s, 4 cases (Obsidian 1.13.7 under Xvfb) |

`npm run test:generator` and `npm run test:framework-cli` remain as aliases of
the `generator` and `cli` suites (both now include their whole responsibility:
starters and file plans, capability discovery). `npm run test:setup-policy` still
runs only the npm install policy file of the `setup` suite.

### Why these boundaries

- **CLI vs generator vs companion.** `shell.mjs` operations, packaging and
  project creation change independently from the compiler that lowers a design
  into files, and both change independently from the companion concept's JSON
  contracts. Each has its own CI workflow (`framework-cli`, `project-generator`,
  `companion-concept-verification`) and now its own local command.
- **Test data.** The seeded test-data kit ships into generated projects, so its
  generators, storage plans and loopback adapters are tested without the concept.
- **Makers, setup and release.** Authoring tools, first-run setup/build and the
  release/supply-chain path are separate maintainer journeys with separate risks.
- **Native tooling vs native host.** Protocol, receipt and isolation logic is unit
  tested everywhere; only `native:host` and `obsidian` launch a real host.
- **Quality.** Gate checkers and evidence producers are tested with negative
  fixtures, apart from the product code they gate.
- **Browser suites** (`e2e`, `browser-specimen`, `companion:browser`) and slow
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

Tooling fixtures (`*-fixture.mjs`, `file-symlink.mjs`), runtime fixtures/helpers,
Playwright fixtures and generated project fixtures are helpers, not tests. A new
helper with another name must be declared, so a misnamed test cannot hide as one.

Suites whose files a distributed framework kit omits (the concept prototype and
its browser runner) are `optional`: their absence is valid, but a runner present
without its tests (or the reverse) still fails. Prerequisites are probed before a
suite starts; a missing browser, Python package, environment variable or build
output reports the suite as `not-run` with a provisioning hint and a nonzero exit,
never as passed. Manual suites also exit nonzero.

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
3. Run the suite alone (`npm run test:<suite>`), then `npm run verify`.

## Workflow coverage

| Workflow | Suites |
| --- | --- |
| `showcase-verification`, `template-authoring` | all `verify` suites (via setup/verify), `e2e`; showcase also `native:host` |
| `setup-compatibility` | all `verify` suites via setup, npm install policy of `setup` |
| `framework-cli` | `cli`, `cli:journey` |
| `project-generator` | `generator`, `companion-project` of `companion`, generated `project` suites |
| `companion-concept-verification` | `companion:assembly`, `test-data`, four `companion` files, `companion:browser` |
| `baseline-verification` | `baseline` |
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
  suites) with a scratch Python venv and `CHROMIUM_EXECUTABLE`; `cli:journey`
  190 s (packed ZIP, two extracted kits, independent generated consumers) with `QUALIFIED_NPM` and `RUNNER_TEMP` in a scratch directory.
- `native:host` was not run: its isolated native runner was not provisioned, and
  the runner reported it as `not-run` with exit code 1. `project` and
  `project:ui-effects` have no files in this checkout (they exist in generated
  projects). `obsidian` (four `*.obsidian.ts` cases) passed through
  `npm run test:obsidian` in about 30 s after the native dev loop was merged.
