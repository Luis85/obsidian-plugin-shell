# PR #18 Project Starters reconciliation

**Date:** 2026-09-25. This record covers the saved-patch reconciliation, not completion of the framework backlog or release qualification.

## Source identities

PR #18 head before this change: `67122e2d472cdc3230e63ac7b8a11eeac69063dc`, tree `dfec0929e564d4cb5acfde0de7ddf3ee589aad52`.
Incoming PR #5 branch: `798be2523d9a70232f4d1432cbc3f3ede631ac1e`, tree `2d8dcfbd049662a3f381ec444ca571b067c0ba73`.
Both source archives were reconstructed and matched to their exact Git trees before editing. The saved reconciliation patch applied cleanly to the head snapshot. The final commit records both parents; branch advancement is non-forced.

## Reconciliation decisions

Preserve all nine JSON-backed starters, catalog hashes, research, browser concept, generator workflow and tests from the incoming base. Preserve PR #18's shared CLI, compiler integration, ownership checks and release boundaries. Add the starter directory to source-archive/evidence inventory without requiring concept assets in every framework checkout. Analyzer entries include both CLI and starter inputs; no threshold or suppression is relaxed.

Correct the saved patch's inventory test: it named nonexistent bookmarks/habits/reading-list files rather than the actual `.companion.json` catalog entries. The test now checks the catalog and every reviewed starter against both actual bytes and the source inventory. Update the CLI self-project expectation from 27 to 28 screens for the newly added gallery. Add CX-008 task frontmatter, preserve its implementation text and qualification boundary, and index all 58 tasks.

Package manifests, dependency lockfile, plugin manifest and versions remain unchanged from PR #18's prior head. The complete incoming prototype and starter data remain byte-identical; the existing PR #18 roadmap is retained. This change does not publish, tag, activate a plugin, merge a pull request or close SH-022/SH-034.

## Executed validation

Local environment: Linux, Node 22.16.0, npm 10.9.2. The preinstalled TypeScript 5.8.3 was made available only through an ignored local dependency link for the compiler/ownership checks. No package was downloaded, no global package was installed, and no dependency pin was changed. These are supplemental results, not the repository-qualified Node/npm/TypeScript matrix.

```sh
NODE_OPTIONS=--experimental-strip-types node --test --test-concurrency=1 \
  tests/tooling/framework-*.checks.mjs \
  tests/tooling/capability-discovery.checks.mjs \
  tests/tooling/project-starters.checks.mjs \
  tests/tooling/project-generator*.checks.mjs \
  tests/tooling/file-plan*.checks.mjs \
  tests/tooling/companion-project.checks.mjs
node scripts/quality/check-source.mjs
python -B scripts/concepts/build-companion.py --check
python -B tests/concepts/companion-assembly.test.py
```

Final focused run: **222 tests; 220 passed, two platform skips, zero failures and zero TODOs**. This includes real CLI subprocesses, compiled ZIP extraction/bootstrap/import/generation, all-starter plan/apply/replay, stale input and consumer-file preservation. It does not independently install dependencies or build/run the generated plugin in Obsidian.

Source checks passed for 637 inputs and 202 translated keys. All 15 concept assembly tests passed. The assembled concept remains 2,315,230 bytes with SHA-256 `2698d226db6142215a250cbd090ebaf20e1f940fd588f924445ddd8092c1c51b`. Supplemental task/schema/index/dependency, Markdown-link, conflict-marker and whitespace checks passed.

An initial inventory-only red run reproduced the nonexistent filename. The first broader run had 215 passes, two failures and two platform skips: the stale screen count and unavailable TypeScript import. Those failures were not hidden or reclassified as passes; the final run above used the corrected expectation and available local compiler. An earlier overlapping launch was terminated before the corrections and has no completed verdict.

The full repository checker could not execute locally because `yaml` is unavailable. Full pinned-toolchain, hosted analyzer, browser/native and generated-consumer build qualification must be attributed to the new commit's actual CI runs. Previous-head workflow results are not evidence for this commit.
