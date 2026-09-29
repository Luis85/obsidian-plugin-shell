# PR #50 review and recovery-tooling polish

Review baseline: head `166fbd38be4464d24fbebeda29ad75bfea0d96c6`, tested initially
through its merge artifact `7bb3bc6b9d787f86a2cee7e8d1f0b5a4621f7218` against
PR #5 at `4894a9c0c2cfee00859bdf153390beb9aedf195f`.

## Scope and disposition

This is a review of **reconstructible source publication**, not a replacement of
the active native integration. The 48 archived file payloads and original manifest
remain byte-identical. Publishing an incompatible alternative over the current
compiler or changing its historical claims would be a regression, not polish.

| Finding | Priority | Reproduction and correction |
| --- | --- | --- |
| Verification reopened source files during copying | High | A real local Git fixture reproduced changed bytes being written after `verify()` succeeded. Reconstruction now uses only an immutable, hash-verified snapshot and performs final readback. |
| `git archive` was not an exact baseline reader | High | A local `info/attributes` `export-ignore` rule omitted an inherited fixture file while restore reported success. Raw commit/tree/blob loading now ignores attributes and replacement refs, verifies object IDs, recomputes the full tree and denies automatic network fetches. |
| Extra directory symlinks were invisible to inventory | High | An extra directory symlink under the actual archived `source/` passed the original verifier. Explicit directory inspection now rejects links/junctions, and regular-file checks also reject hard links and special files. |
| The excluded archive left an executable workflow in CLI kits | Medium | `included('.github/workflows/native-source-handoff.yml')` returned true although its sources were not shipped. The workflow is now excluded in both distribution paths; root-directory links are also correctly treated as unshipped. |
| Recovery could fail after reserving output without a clear completion contract | Medium | Added full preflight, exclusive file creation, directory guards, an incomplete marker, verified readback, portable completion receipt and explicit no-retry guidance. Failure never triggers automatic deletion or overwrite. |
| Human-only diagnostics and thin test coverage | Medium | Added `--plan --out`, single-object `--json`, bounded actionable diagnostics, an opt-in registered suite, real Git fixture tests, failure injection, cross-platform historical reconstruction and retained workflow evidence. |

The first two negative controls used a real **synthetic local Git baseline** with
an injected baseline ID; they do not claim historical-native execution. The third
used the actual 48-file archive. The regression suite uses production recovery
functions, a real Git object database and real filesystem writes; test substitution
is limited to the synthetic baseline identity and deliberate failure/race injection.

## Architecture and safety review

`handoff_core.py` owns pinned provenance, immutable source data and portable path/
file validation. `handoff_git.py` owns bounded, local-only Git reads and exact object
verification. `handoff_output.py` owns new-directory writes, failure preservation and
readback. `restore.py` composes them and formats user/agent output. The CLI does not
accept another baseline, a bypass hash, an overwrite switch or executable commands.

The three original hazards are covered by tests that would fail against the old
behavior. Additional controls cover manifest metadata tampering, missing/extra
files, Windows-unsafe names, case/file-directory collisions, source changes after
verification, Git replacement refs, inherited Git environment, invalid Git output,
missing baseline objects, disk failures, interruption, binary blob framing, injected output links/files, readback
tampering, outside-checkout constraints, JSON failures and unchanged repositories.
The baseline executable mode is preserved and checked on POSIX; Windows file-mode
semantics are not represented as a POSIX executable-bit qualification.

Git and the OS filesystem are trusted local tools. Capturing verified inputs and
exclusive output creation reduces accidental/concurrent-change risks but is not a
sandbox against a malicious same-user process continually replacing directories.
Output is not a cross-platform atomic directory transaction. Success requires both
a completed receipt and absence of the incomplete marker; partial output is retained.
No recovery result grants release or native acceptance.

## Executed local evidence

Local host: Linux, Python 3.13.5, Git 2.47.3, Node 22.16.0 with experimental
TypeScript stripping where required. This differs from the qualified Node/npm
matrix. No global TypeScript substitute, dependency update or clean locked npm
installation was used for these checks.

- Original negative controls reproduced the three recovery defects and the kit/
  directory-root distribution omissions before their fixes.
- **40 Python tests passed**, zero failures/skips, including the real Git fixture,
  filesystem failure injection, immutable snapshot and JSON contracts.
- **Eight Node distribution tests passed**, including the actual compiler template
  loader over the complete current source and retention of both active starters.
- The registered suite inventory passed: 295 test files, 32 suites, 32 helpers.
- Root code-line limits and locale parity passed; every new Python module/test is
  below the existing 400/450-code-line ceiling (no exemption added).
- Manifest SHA-256 and source Git tree are unchanged. `restore.py --check --json`
  verified all 48 files, 3,748,075 source bytes and one historical deletion.

These totals are different layers, not one combined acceptance count. New runtime,
browser, coverage, native-host and current-lock TypeScript acceptance are **not**
claimed from these local runs. The historical production-baseline reconstruction is
owned by the hosted workflow; local integration tests use an explicit synthetic Git
baseline. Current-head hosted results must be read from the PR checks, not inferred
from the preceding head's success.

## Reference rationale

The official [Git archive documentation](https://git-scm.com/docs/git-archive)
documents `export-ignore`, `export-subst` and `info/attributes` overrides. Exact
reconstruction therefore uses [raw Git objects](https://git-scm.com/docs/git-cat-file)
instead of an archive. [Git's global options](https://git-scm.com/docs/git) document
replacement-ref disabling and `--no-lazy-fetch` (Git 2.45+). These are independent
of plugin/API behavior.

The Python [archive extraction guidance](https://docs.python.org/3.12/library/tarfile.html#hints-for-further-verification)
explains that extraction filters alone do not prevent every unsafe archive feature
or resource-exhaustion case. The new helper does not extract tar archives: it uses
bounded, verified regular-file snapshots, explicit safe paths and exclusive writes.

## Remaining product work, not hidden by this pass

The archived alternative still has explicit-save draft-loss and unfinished starter
acceptance obligations. Its incompatible declaration shape has not been migrated.
The active native starters retain their separate real-host/device acceptance scope.
A future adoption should select one canonical native contract, preserve existing
user files/drafts, migrate deliberately, and qualify the resulting runtime rather
than treating this immutable source handoff as a production implementation upgrade.
