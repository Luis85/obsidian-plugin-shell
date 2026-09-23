# Iteration 04 — executed verification record

Integration base: `d755745668974820ff4dbcdd0b9f8bfeec307ec3`, confirmed merged PR #3.
Branch: `build/template-foundation`. Plugin development version: 0.4.0.
Date: 2026-09-23. Final candidate qualification is in progress; this working record
does not claim final acceptance before the complete runs finish.

## Evidence established during implementation

- Locally provisioned official Node 24.21.0 archive checked against its published
  SHA-256 list; npm 11.19.1 installed locally, with no global package changes.
- Fresh strict lockfile installation passed. Prettier 3.9.9, fast-check 4.10.2
  and @axe-core/playwright 4.13.0 are exact development dependencies.
- Seeded real Markdown properties passed 100 cases per property, including
  exact round-trips, stale-write preservation and uncertain-attempt deduplication.
- Targeted domain mutation baseline passed; all three selected unknown-field,
  Gregorian-century and finite-number guard corruptions were detected. Reports
  retain source hash, seed 23092026 and shrinking/replay paths.
- Served accessibility checks passed all three cases: both host themes/all panels,
  validation and owned overlays, a failing unlabeled-control negative fixture,
  German narrow layout, reduced motion and forced colors. Keyboard/focus tests
  accompany scanning. No manual screen-reader or physical-device claim follows.
- Independent persistence review reproduced and corrected unsafe JSON array
  serialization and silent normalization of untouched records.

## Failures and environment boundaries

The first complete integration attempt reached tooling qualification and failed
on a stale exact generated-test count (22 expected, 23 actually passed). This is
not recorded as a verification pass. Later runs supersede it only after correction.
The initial accessibility run reported real contrast failures; source corrections
and a subsequent full accessibility run passed without rule exclusions.

Playwright's automatic browser-cache installation failed its filesystem lock
heartbeat. The exact pinned Chrome-for-Testing 153.0.8010.12 archive was provisioned
inside the worktree and selected explicitly through `SHELL_CHROMIUM`; browser
tests ran against it. Archive extraction initially failed timestamp restoration;
extraction without restoring archive timestamps completed. No browser test retry
was used to conceal a failed assertion.

Windows file symlinks are unavailable in this environment; the tooling runner
reports that platform case explicitly. Its separate actual junction and Windows
case/8.3 controls passed. A source-archive consumer uses a fresh installation
instead of a worktree dependency link. Browser, synthetic host, real native and
device results must be reported separately.

Final command totals, consumer results, source SHA and accepted asset hashes are
recorded below after qualification. No tag, public release, directory submission,
permission change or automatic merge is authorized by this record.
