# Compiler qualification and extension

> Type: how-to guide · Part of the [docs index](../../README.md)

## Commands and evidence

`npm run test:compiler` runs unit, golden-baseline, CLI/reporting, architecture, artifact-origin, packed-distribution and four targeted mutation checks. `npm run test:compiler:properties` runs seeded fast-check invariants. `npm run test:compiler:coverage` measures domain/application coverage separately from generated product tests, with minimums of 95% lines, 90% branches and 90% functions. Coverage is not a substitute for observable output assertions.

The golden gate is `tests/fixtures/compiler/starter-golden.json`, maintained by `node tooling/compiler/golden.mjs` (`--check`, the default, compares; `--write` records). It compiles every Companion starter in `configs/starters/` (project schema 6) with the live template and pins, per starter, the starter file's SHA-256 and the path and SHA-256 of every product-scope artifact: the generated source and test roots, `harness/prototype/`, `design/`, `src/plugin/main.ts`, `src/plugin/bootstrap/features.ts` and `PROJECT-IMPLEMENTATION.md`. Files identical across all starters are recorded once. `tooling/tests/compiler-golden.checks.mjs` fails on any changed, missing or undeclared file, a changed starter input, an added or removed starter or another compiler version, and its negative controls prove each failure. Copied framework files, developer documentation and dependency manifests are qualified by the distribution and template tests instead, so unrelated shell edits never require a new baseline.

The former executable equivalence gate (`tests/tooling/compiler-compatibility.checks.mjs`, removed in `b91e3185` on 2026-10-02 with the unreleased compatibility layer) and its v5-keyed `tests/fixtures/compiler/*.json` digests and reversal chains (including the independently captured `post-mvp-base-code.json` described in [POST-MVP-INTEGRATION.md](POST-MVP-INTEGRATION.md)) were retired and remain in Git history.

Mutation tests execute a baseline and actual mutated copies of collision and reference guards. A mutant is killed only by the expected assertion after its probe executes, never by a syntax/import failure. Property tests retain seed `20260927` and 250 cases per property.

`QUALIFIED_NPM` must identify the explicitly installed npm 11.19.1 CLI for `npm run qualify:compiler`. The qualifier creates an isolated temporary workspace, compiles click-dummy output, installs its own lockfile, verifies the generated plugin, type-checks and bundles the browser entry, and executes independent offline navigation assertions. It retains step logs, hashes and an explicit passed/failed summary under `reports/compiler-qualification`. Temporary projects are removed. Compilation's warm-snapshot budget is 15 seconds for Quick Capture; this is a regression guard, not a product latency claim or maximum-scale benchmark.

The dedicated GitHub workflow runs contracts on Linux, Windows and macOS using the repository-qualified Node/npm. Linux additionally performs real browser qualification. Existing generator/starter/native workflows are unchanged; this workflow does not relabel their results.

## Adding a rule

Add the diagnostic code/help to `domain/diagnostics.ts`. For an independently safe reference check, retain the original JSON pointer and stable entity ID, and test a valid document, the failure and a simultaneous independent failure. Do not guess source positions from arbitrary exception prose. Regenerate/check the diagnostic catalog documentation.

## Adding an emitter or output

Accept the existing resolved model and a frozen template snapshot. Produce artifacts with explicit producer and ownership metadata. Reuse the collector, declare only intentional replacements and test duplicate and case-collision behavior. No filesystem reads, dependency installs or shell commands are allowed inside emitters. Add the emitter to the resolved architecture entry inventory and add behavior-based generated-output qualification, not only source substring tests.

## Compatibility review

A change to generated artifact bytes, diagnostic codes, approval hashes or command behavior needs an explicit review decision. Review the reported differences, then record them with `node tooling/compiler/golden.mjs --write` in the same change; do not update golden hashes just to make a test pass. New output kinds use `--output-kind`; the existing `--target` folder meaning is reserved. Installation, generation, bundling, typechecking, tests, native acceptance and business acceptance are separate evidence dimensions.
