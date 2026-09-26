# Companion JSON: Windows CI regression repair

## Failure scope

PR #5 head `e71c655fe376e51a520fb8f194800e9294eb8e4e` failed in
[Setup npm policy compatibility](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36055702007)
and [Showcase verification](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36055701992).
Both Windows npm matrix jobs (11.19.1 and 12.0.2) and the Windows showcase
reported the same two failures in `tests/tooling/companion-project.checks.mjs`.
Dependency installation and compilation had succeeded; each Windows tooling run
reported 261 passes and two failures. Linux and template-authoring passed.

## Causes and corrections

1. **Canonical path expectation.** `COMPANION-READ` compared a canonical service
   result with `path.resolve()` applied to the input. The Windows runner's
   temporary directory used `RUNNER~1`, while `realpath()` returned `runneradmin`.
   The test now independently resolves the expected filesystem path, retains the
   original supplied path as input, and checks both `vault` and `target` exactly.
   Explicit root aliases and missing nested targets are exercised on every
   platform, with an unchanged filesystem snapshot after all reads. This does
   not relax the separate rejection of target-child junctions or input links.
2. **Malformed negative fixture.** `COMPANION-BOUNDS` removed the final two
   characters of the checked-out JSON before inserting a forbidden property.
   That assumes a `}\n` ending. With CRLF it leaves the closing brace and builds
   invalid JSON, so the parser never reaches the unsafe-key guard. The fixture
   now parses the source and serializes a computed own property. No text slicing
   or changes to repository line-ending policy are needed.

The new `COMPANION-EOL` regression exercises LF and CRLF with no trailing newline,
one newline, and additional trailing whitespace. All six valid variants go
through the real CLI with exact output and zero writes. For each variant, all
three forbidden keys (`__proto__`, `constructor`, `prototype`) are checked: the
fixture must be valid JSON containing that own key, the validator must report
its specific unsafe-key error, and the CLI must fail with empty stdout and no
filesystem changes. Generic syntax failure cannot satisfy these assertions.

## Executed pre-push checks

Local supplemental environment: Linux, Node 22.16.0. It is not a Windows runner
or the qualified Node 24.21.0/npm 11.19.1 toolchain.

- The unchanged baseline reproduced both failures using a CRLF seed and an
  aliased temporary-directory parent: 10 passed, two failed. The corrected suite
  passed all 13 tests under those same conditions. The seed was restored exactly.
- `node --test tests/tooling/companion-project.checks.mjs tests/tooling/test-data-*.checks.mjs`:
  40 tests passed, zero failures or skips.
- `python -B tests/concepts/companion-assembly.test.py`: 12 tests passed.
- `python -B scripts/concepts/build-companion.py --check`: exact unchanged HTML.
- `node --check tests/tooling/companion-project.checks.mjs` and `git diff --check` passed.
- Two local negative controls replaced canonicalization with lexical resolution
  or disabled the unsafe-key guard. The corresponding regression failed in each
  case; both implementation files were restored byte-for-byte afterward.

Actual Windows qualification comes from the normal final-head PR workflows,
not the Linux reproducer. Final run links and conclusions belong in the PR
handover after completion; earlier green checks are not evidence for a new head.

## Unchanged scope

Only the test suite and this repair record change. CLI/runtime behavior, JSON
contract, HTML, golden project JSON, dependencies, lockfile, workflows and quality
thresholds are unchanged. All prior safety cases remain. No force push, merge,
release, native host launch or personal-vault access is part of this repair.
