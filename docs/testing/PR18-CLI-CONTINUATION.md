# PR18 CLI continuation and integration evidence

Date: 2026-09-25. This record documents implementation and bounded verification, not a framework shipment or native companion conversion. The current executable checkpoint is `5e546bb9ae0e45da128eee4a4ef9a196a76ea1ab`, tree `2c2c78ad482498eaa052259b0f851b615dd197ae`. The follow-up preserves those runtime/tooling bytes and corrects one cross-platform test fixture plus documentation references; its exact commit is identified in the PR. Consult the [CLI guide](../development/FRAMEWORK-CLI.md), [task index](../tasks/README.md) and earlier [implementation record](FRAMEWORK-CLI-IMPLEMENTATION.md).

## Source reconciliation

The continuation found existing CLI/kit implementation at `a706ef83988c5ff41d96e9fa2fb33a7ea3c83085` and preserved it. Merge `73235ae695f49d2870db4892ee3be723d381c5cb` integrated base `3cd1f7b04025df02a9fc1407fc598112a072a965`, retaining storymaps and scoped design-system generation. Fix `042519bdcf34ff79b58091cc50ebd810379df272` corrected distribution/source-inventory defects; `d1cb588aeac9d92a9d2fc6478875a27e8b18ee07` added CLI interaction, input and export capabilities.

While those changes were being verified, the base advanced again. Merge `cddc56a374290d4e42ec69580ca87249dbfecb35` integrated v4 composition base `08ed974eacc0a7c87106ea2f2e4bb3bc34e81310`. Final checkpoint `5e546bb...` also preserves base `5dcd886c0f9a588d28892bc92ec231266f5e54ca` and its explicit ambient declaration/complete-metrics regression. The standalone Python-inventory fixture remains compatible with intentionally unshipped prototype sources.

The latest incoming code includes actual page/component composition generation, captured component revisions, slots, scenarios, local effects and generated tests. It is retained upstream implementation, not work newly authored by this CLI continuation. Analyzer entries, generator bootstrap metadata, file-plan safeguards, imports and task identity were reconciled additively. No pull request was merged, no history was forced, and the submitted Git trees matched the independently prepared local trees exactly.

## Delivered continuation capabilities

The central TypeScript handler/API now exposes scoped help and version information; immutable discovery metadata; safe structured request validation; bounded/cancellable input and prompts; source-derived design freshness; and inspected/reviewed design-system CSS, JSON, Markdown and HTML exports. The exports use the existing shared scoped compiler, not another theme implementation. File plans protect current user edits, prohibit saved-plan/output collisions and reject protected paths and alternate test-vault destinations.

The release adapter does not start under `--dry-run`, including when execute/authorization flags are present. Imported JSON, confirmation flags and saved plans never grant publication permission. Blank setup follows the current export schema, and v4 large design metadata has its own fixed input profile without increasing operation-request/approval limits.

## Regressions reproduced and corrected

| Finding | Correction and exercised negative control |
| --- | --- |
| Windows kit packing refused the reviewed README after CRLF checkout | Normalize only distributed UTF-8 text; accept only exact reviewed LF/CRLF content. Added text or even an extra line still fails ownership. Binary data and source checkout bytes remain unchanged. |
| Source-only archive omitted a JSON fixture imported by stylesheet tests | Include the actual optional project fixture in source transport and fingerprints; reject redirected ancestors. No unresolved-import suppression. |
| Full analyzer reported duplicate/private exports | Share a pure JSON formatter with a compiler compatibility export, remove private kit exports, name the CLI parser separately and register its actual dynamic entry point. No finding exclusions. |
| Typed request fields could be parsed again as CLI switches | Validate command, positional data and options directly; discovery returns isolated copies. Malformed flag types and command strings are rejected. |
| Prompt/input cancellation could wait for more input | Owned listeners settle on EOF/abort, enforce UTF-8/byte limits and are removed after completion. |
| `release operate --dry-run` could launch an adapter with execute flags | A real controlled adapter writes a sentinel if invoked; the regression proves no adapter start and a planned/not-run result. |
| Actual v4 traceability exceeded the old generic JSON read limit | Separate 4,000,000-byte/120,000-entry/depth-40 design-data profile. Operation inputs remain 1 MiB/20,000 entries/depth 32; hostile keys still fail. |
| Incoming README/styles no longer matched example-removal preimages | Update only four reviewed hashes and preserve design-system tokens in minimal shell/panel templates. Actual removal planning succeeds without reintroducing the sidebar. |

## Local execution and limitations

Local environment: Linux, Node 22.16.0, npm 10.9.2, TypeScript 5.8.3. This is supplemental, not the repository-qualified Node 24.21.0/npm 11.19.1/TypeScript 6.0.3 toolchain. Pinned dependencies and lockfile were not changed to accommodate it.

On exact executable checkpoint `5e546bb...`:

```sh
node --experimental-strip-types --test --test-concurrency=1 \
  tests/tooling/framework-core.checks.mjs \
  tests/tooling/framework-process.checks.mjs \
  tests/tooling/framework-input-style.checks.mjs \
  tests/tooling/framework-distribution.checks.mjs \
  tests/tooling/capability-discovery.checks.mjs
node node_modules/typescript/bin/tsc --noEmit --project tsconfig.framework.json
node scripts/quality/check-source.mjs
```

Result: **53 tests passed; zero failures, skips or TODOs**. Supplemental TypeScript checking passed. Source/locale checking passed for **622 inputs and 202 translated keys**. Whitespace and exact tree checks passed.

An earlier broad v4 integration run reported **392 tests: 386 passed, two platform skips and four failures because the local `fallow` executable was absent**. Those failures are retained, not converted into passes. The run included a real compiled/extracted kit and generator/fixture/contract tests, but source-adaptation fixes were still being finalized during it; it is not a frozen whole-candidate qualification. A separately exercised 172-test checkpoint before v4 reported 170 passes/two platform skips. These totals are different runs and must not be added together.

No fresh full npm installation, production coverage gate, browser/native Obsidian execution, Windows/macOS local run, public release, or directory submission was performed locally. The standard repository checker requires absent installed dependencies including `yaml`; the analyzer requires the absent `fallow`. Hosted results qualify only their exact commits.

## Hosted execution boundaries

The [Framework CLI and release archive run](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36136168953) passed on Windows, macOS and Linux at **042519bd**. Its actual archive extraction, direct/npm entry, generated consumer installation/build/tests belong to that earlier source, not the later v4 integration. The broader checks on that commit exposed the five analyzer findings addressed by d1cb588; no blanket green result is claimed.

The base v4 generator/concept workflows and later ambient-contract fix have their own evidence. Current integrated-code workflow completion must be checked at `5e546bb...` or the subsequent fixture/documentation correction; a queued or running workflow is not passed. Final PR metadata links those current results without rewriting this dated execution record.

## Current-head CI findings and final fixture/documentation correction

At `5e546bb...`, the qualified generator job passed **399 tooling tests (395 passed, four platform skips, no failures)** and the full analyzer reported **zero findings**. The standard repository checker then rejected links from two restored PR #17 documents to evidence files not present in this branch. Their links now identify the exact original PR #17 commit, preserving historical evidence rather than inventing local receipts. The original source inventory and acceptance routing remain unchanged.

The [current archive matrix](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36141074841) completed archive/bootstrap/generation/install/build/test qualification on Linux and macOS. Windows stopped during focused tooling tests: a newly added stylesheet-removal regression incorrectly compared its CRLF checkout with the exact LF ownership manifest. The corrected test constructs a bounded canonical fixture containing the actual three reviewed stylesheet replacements. It verifies original hashes, exercises the real removal planner, rejects changed EOL and appended edits in the fixture, and restores an identical plan. It does not relax the production writer, change ownership hashes or modify checkout files. Broader full-archive example-removal qualification remains separate from this focused three-stylesheet assertion.

The affected distribution suite passes all four tests locally. Fresh final-head Windows/full workflow results remain required; a previous Linux/macOS pass is not a Windows result and the documentation fixes do not themselves establish later gate completion.

## Remaining product and qualification gates

The runnable central workflow is not completion of the 57-task backlog. All legacy MJS business tooling has not been ported to TypeScript; general maker conventions and framework internals still use their established roots while configured paths relocate generated product files. Arbitrary source-root/runtime-data migrations, complete Windows descendant-process cleanup, richer live Obsidian RPC, all guided accessibility/native scenarios and final full-production qualification remain open. Test-data v1 targets remain explicitly limited to the existing isolated fixture contract.

No business implementation is inferred from generated TODOs, a passing scaffold test, imported traceability or layout generation. The companion itself remains unconverted. SH-022 technical readiness and SH-034 separately authorized shipment are not closed; CP/PUB gates remain downstream. The toolkit may prepare/rehearse a generated-plugin release, but no framework/plugin publication was authorized or executed here.
