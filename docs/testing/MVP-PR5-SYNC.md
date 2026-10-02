# PR #5 synchronization — 2026-09-27

PR #28 remains the draft implementation branch `feat/mvp-journey-lens-core`, based on
PR #5 (`docs/companion-plugin-prd`), not `main`.

## Reconciled revisions

- Previous implementation head: `b4a701a97ab73879f4464d5a3902d674491cac93`.
- Inspected PR #5 head: `e540157e63c9b81fdadb7bd84eca4aa56a8809b0`.
- Merge commit: `71b52e50faef793e9427601ae793186dd2cbc09d`.
- Merged tree: `8a798be0b4563bcd1609508ae11ff6f8ea347287`.

The merge preserves both parent histories. Upstream visual-surface removal,
immutable revision/pinning protections and prototype-skill changes were retained
alongside the MVP editor. There were no overlapping edited paths between the
upstream delta and the feature delta. Source archives were checked against their
Git trees before composition; the merged local tree matched the pushed tree.

While fixes were being verified, another implementation commit advanced this
branch to `fe0d3ffd5db680d56c3301dfa133aa6bcdf45975`. It already contains the same
kit configuration fix, the corrected editor reset and new clickdummy generation.
A non-fast-forward update was refused, not forced. Those newer changes are retained;
this follow-up adds only the explicit extracted-configuration regression assertion
and this record, not an older replacement of the compiler, styles or analyzer config.

## Verification performed during reconciliation

| Check | Result | Scope |
| --- | --- | --- |
| Sitemap and upstream visual-surface suites | 95 passed, no failed/skipped/TODO | Exact merged source before the concurrent clickdummy increment |
| Authoring contract/composition/store suites | 15 passed, no failed/skipped/TODO | Same merged source |
| Extracted kit before correction | 2 passed, 1 failed | Reproduced missing `.framework/template/tsconfig.sitemap.json` |
| Extracted kit with both authoring configurations | 3 passed, no failed/skipped/TODO | Full pack/extract/setup/generate/replay/conflict test; 83 seconds in the completed run |
| Scoped reset inspection | Old compiled selector did not match; corrected selector matched | Local DOM supplement using the actual prior Vue bundle, not a new qualified build |

The archive regression now compares both `tsconfig.sitemap.json` and
`tsconfig.authoring.json` against the extracted template's exact bytes. The retained
kit implementation has blob `c2b53337eeb8f3df02d6bda9b46bed168641904b`, matching the
locally exercised correction. The broader concurrently added compiler changes need
their own current-head tests; earlier kit success is not their qualification.

Local tools were Node 22.16.0 and TypeScript 5.8.3, supplementary to the qualified
repository toolchain. Initial bounded test attempts timed out; the subsequent full
kit run completed successfully. Local browser file navigation was administratively
blocked. In-memory DOM checks used an explicit test-only storage adapter; they do
not prove file-origin or durable storage behavior. The full local browser replay
did not complete, so no complete browser acceptance result is claimed here.

Current-head hosted CI, independent generated clickdummy/native companion checks,
MVP acceptance and publication remain separately tracked in PR #28. No thresholds,
permissions, dependency versions or release approvals were changed by this
synchronization. No pull request was merged, no force push occurred, and no release
was published.
