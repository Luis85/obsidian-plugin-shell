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
| `runtime` | Plugin runtime: domain, application services, adapters, Vue/Pinia, in-memory Obsidian test kit (73 files) | `npm test` / `npm run test:runtime` | Vitest `vitest.config.mjs` | none | own step (production coverage run) | DURATION_runtime |
| `cli` | Central `shell.mjs` CLI: parsing, plans, processes, kit/archive distribution, `new`, capability discovery (7) | `npm run test:cli` | `node --test` | none | tooling | DURATION_cli |
| `cli:journey` | Packs the framework ZIP, extracts it and builds generated consumers (1 script) | `npm run test:cli:journey` | node script | `QUALIFIED_NPM` | opt-in | DURATION_cli_journey |
| `generator` | Project compiler, runtime guards, starters and the shared safe file-plan engine (15) | `npm run test:generator` | `node --test` | none | tooling | DURATION_generator |
| `companion` | Companion concept contracts: project JSON, storymaps, details, composition, isolation zone, concept metrics (6) | `npm run test:companion` | `node --test` | none | tooling | DURATION_companion |
| `companion:assembly` | Offline assembly check, Python assembly/tamper test, syntax check of every concept module | `npm run test:companion` (runs with `companion`) | Python + `node --check` | `python3` | opt-in | DURATION_companion_assembly |
| `companion:browser` | Aggregated concept browser suites on one exact artifact (26 scripts) | `npm run test:companion:browser` | Python Playwright | Python `playwright` + Chromium | opt-in | DURATION_companion_browser |
| `companion:browser-manual` | Historical concept browser scripts the aggregated runner does not execute (8) | see [concept verification](../concepts/companion/VERIFICATION.md) | manual | Python `playwright` | opt-in | not automated |
| `test-data` | Companion test-data kit: generators, storage plans, loopback server/client, inventory (5) | `npm run test:test-data` | `node --test` | none | tooling | DURATION_test_data |
| `makers` | Maker recipes and catalog, event contracts, generated-code formatting, example removal, README ownership (7) | `npm run test:makers` | `node --test` | none | tooling | DURATION_makers |
| `native` | Native host protocol and dev-loop tooling units, no Obsidian launch (14) | `npm run test:native-tooling` | `node --test` | none | tooling | DURATION_native |
| `native:host` | Real Obsidian smoke in an isolated scratch vault | `npm run test:native -- --allow-download` | node script | provisioned `.native-runner` | opt-in | not run here |
| `setup` | Setup identity, npm install policy, staged build/local install, CSS identity, harness preview (5) | `npm run test:setup` | `node --test` | none | tooling | DURATION_setup |
| `release` | Release preparation/plans/execution, audit classification, maintenance, qualification triggers (8) | `npm run test:release` | `node --test` | none | tooling | DURATION_release |
| `quality` | Analyzer, lint, coverage inventory, maintainability, presentation, repository/test-quality policies, evidence producers, this manifest (13) | `npm run test:quality` | `node --test` | none | tooling | DURATION_quality |
| `baseline` | Dependency-free verification baseline and HTTP style specimen, repeated three times (8) | `npm run test:baseline` | `verify-baseline.mjs` | none | own step | DURATION_baseline |
| `browser-specimen` | Host-style specimen assertions in a real browser | `node scripts/testing/suites.mjs browser-specimen` | node script + Playwright | Chromium | opt-in | DURATION_browser_specimen |
| `e2e` | Served harness in Chromium: showcase, modals, persistence, accessibility, design system (11) | `npm run test:e2e` | Playwright | Chromium, `npm run harness:build` | opt-in | DURATION_e2e |
| `project` | Generated product tests under `tests/project` (only in companion-generated projects) | `npm test` in the generated project | Vitest `vitest.project.config.mjs` | generated project | opt-in | n/a here |
| `project:ui-effects` | Generated composition/UI-effect checks (generated projects only) | `npm run test:ui-effects` in the generated project | `node --test` | generated project | opt-in | n/a here |
| `obsidian` | Vitest-driven E2E against a real sandboxed Obsidian (`tests/obsidian`, added by the native dev loop) | `npm run test:obsidian` | npm script | provisioned native runner | opt-in | n/a here |

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

MEASURED_RUN
