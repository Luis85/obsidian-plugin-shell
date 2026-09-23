# Acceptance closure execution record

This milestone starts from open [PR #10](https://github.com/Luis85/obsidian-plugin-shell/pull/10)
at `b426bbdddd4d966fd6ce430996d2542bd7511aaf`, following qualified code
`fd59c80195dee549ddbaaa23c28a06c091b18274`. Branch `codex/acceptance-closure`
is stacked on `codex/executable-qualification`; main remains clean at
`2d4087e93289a21d797fab4cd641ecde6cf16a82`. No merge or release is authorized.

The [plan](../development/ACCEPTANCE-CLOSURE-PLAN.md) fixes file ownership,
required modes, diagnostic boundaries and verification order before edits.
The previous producer report establishes **1 verified / 14 partial / 81 not-run**.
These describe evidence linkage, not implementation percentages. Current counts
will be recorded from a complete actual producer session after freezing code.
The 96-row legacy plan, historical baseline, blocked release profile and separate
[34-row Nuxt UI matrix](NUXT-UI-ACCEPTANCE.md) remain unchanged.

## Execution in progress

- Fresh `npm ci --strict-allow-scripts`: passed, 693 packages from the unchanged
  lockfile using Node 24.21.0 and npm 11.19.1.
- Preliminary `npm run build`: passed; these are development bytes, not yet the
  fixed-source candidate.
- `npm run check:security`: passed, zero vulnerabilities across all categories.
  The nested ESLint 9 support exception remains independently unresolved.
- Focused real-service acceptance tests: two passed. Diagnostic observer tests:
  two passed; controlled EventEmitter fixtures are not real native evidence.
- Complete runtime producer: **312/312 passed**, no skips/retries, before the
  final evidence-validator correction. Its exact input identity remains retained;
  frozen-source qualification must execute the corrected complete input set.
- Focused browser first attempt: two failures caused by the missing favicon's
  console 404 after the application assertions completed. Both traces are retained
  under `reports/acceptance-closure/browser-first/`. An explicit self-contained
  favicon corrected the harness; the next focused run passed both cases.
- Strict TypeScript and targeted test ESLint: passed.
- Complete browser producer: **35/35 passed**, no skips/retries, including the
  corrected fresh-service reload assertions. Every runtime/browser crosswalk link
  was found by exact file, name and mode in its actual producer output.
- Both independent evidence findings were reproduced before correction:
  malformed diagnostic receipts were accepted, and two generated-driver failures
  overwrote one output directory. All **four** corrected diagnostic/parser/actual
  driver retention regressions passed. The two failed controls remain retained.

These local runtime/browser packets precede final diagnostic-validation and
crosswalk wording corrections. They are supporting development evidence, not
current-source candidate qualification. Full `verify`, selected producer
repetitions, native sessions and generated-consumer/archive flows run on the
subsequent frozen source using the existing read-only qualification workflows.

The [independent review](../development/ACCEPTANCE-CLOSURE-REVIEW.md) records actual
cross-owner findings and corrections. The [native investigation](NATIVE-RELIABILITY-INVESTIGATION.md)
starts from both first failed reports, retains their hashes and makes no causal
closure claim. Diagnostic additions affect test tooling only; shipped runtime
behavior is unchanged.

Raw local output is retained under `reports/acceptance-closure/`. The previous
worktree and every prior candidate/report are preserved. Full verification,
served producers, independent review and fixed-source delivery are pending;
no unexecuted pass is claimed.
