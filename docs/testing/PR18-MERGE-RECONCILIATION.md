# PR #18 merge reconciliation

**Date:** 2026-09-25. **Scope:** integrate the current PR #5 base into the existing PR #18 branch without force-pushing or merging either pull request.

## Exact sources

- Prior PR #18 head: `079ca01ce32eb392d35595a8c283380c9e8c5c36`; tree `735fbad58995cee801f9aa1e80b11cc01574d317`.
- Incoming base: `1dfa991df77ea5fa742d8bd5e300c877d0d45151`; tree `ec5e5a411d580e1170a08e001995bc0d9bf7c426`, including merged PR #20.
- Common ancestor: `b0f50ecb6ef1c1db75f5d1358185d860d8801742`; tree `f32a1b3a368f039ea386dda1e55dd02f506758e8`.

All three snapshots were reconstructed from downloaded source artifacts and independently indexed to these exact Git trees. Their CI merge-snapshot commit labels were not substituted for the actual branch commits. The update uses the old PR head as first parent and incoming base as second parent.

## Conflict decisions

1. `docs/development/COMPANION-PROJECT-JSON.md`: preserve both the framework-first target and the new implementation-workspace generator section. The legacy byte-exact reader remains read-only; the generator has its own explicit plan/apply command and qualification limits.
2. `docs/tasks/shell/SH-023.md`: both branches independently allocated this ID. Keep the baseline/CI task and its existing dependencies. Preserve the incoming compiler task as [SH-035](../tasks/shell/SH-035.md), with original scope/acceptance, issue #19 provenance and implementation-under-verification status (`in-review`). Update indexes/counts to 57 tasks and make SH-028 depend on SH-035; SH-022 covers it transitively. Historical SH-023 references in PR #20 / issue #19 are explicitly mapped, not silently rewritten.

Current-status addenda prevent the previous review/plan from implying that the incoming generator is absent. Broader shared-maker integration, compiled CLI archive, in-place project bootstrap and native/complete-product qualification remain distinct from the implemented compiler increment.

## Preserved scope

Every non-Markdown file is byte-identical to the incoming base, including compiler/runtime source, `shell.mjs`, binary file-plan support, package/lockfile, analyzer/source-fingerprint configuration, workflows, tests, README ownership and concept artifacts. The root README and existing repair record are unchanged. No guards, dependencies, tests, quality thresholds or feature code are removed. No task is promoted to done.

## Executed verification

Local environment: Linux, Node 22.16.0, npm 10.9.2. This is supplemental execution, not the repository-qualified Node 24.21.0/npm 11.19.1 toolchain.

```sh
node --experimental-strip-types --test tests/tooling/project-generator*.checks.mjs tests/tooling/file-plan*.checks.mjs tests/tooling/companion-project.checks.mjs tests/tooling/test-data-*.checks.mjs
```

- Focused real compiler, generator-contract, file-plan/binary, legacy handoff and test-data tests: **85 tests, 83 passed, two platform skips, zero failures, zero TODOs**. This does not change the generated product's separate unimplemented acceptance TODOs.
- Supplemental task validation: **57 task files / 35 shell tasks**; unique IDs, allowed statuses, exact index/dependency parity, known dependencies and acyclic graph. Existing task statuses are unchanged; SH-035 retains implementation-under-verification status. SH-022 reaches every other SH-001–SH-033 task and SH-035; CP-001 still requires SH-022, SH-034 and CX-007.
- Supplemental Markdown validation: **200 documents, 747 local links, two changed-document anchors**; balanced fences, no conflict markers. External links and full Markdown semantics are not claimed.
- `git diff --cached --check` passes; the unmerged index is empty. **694 non-Markdown files**, plus root README, match the incoming base exactly. Every original compiler-task acceptance/follow-on statement is retained.
- The full `node scripts/quality/check-repository.mjs` invocation is blocked locally by missing `yaml`. No dependency installation, policy relaxation or substituted package version was used. Supplemental checks are not a full-checker pass.

No local Windows/macOS, browser, native Obsidian, fresh generated dependency install/build, or complete production quality run is claimed. Hosted checks for the new merge commit remain independent; earlier incoming-base success is not relabeled as new-head qualification.
