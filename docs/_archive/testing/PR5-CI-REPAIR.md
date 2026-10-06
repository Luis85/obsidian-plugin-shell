# PR #5 CI repair — 2026-09-28

## Scope

Repair the existing `docs/companion-plugin-prd` branch from
`02857c2c965e4187f4b56d1e0fa5627c12cbf07d`. The failing hosted runs inspected were
CI `36348783692` and setup compatibility `36348783674`. Selectively backport
CI fixes from PR #35 at `957bf427212ffe21fcd8fbe93d42419b6344a501`; do not merge
its new product features, change dependency pins or lower quality thresholds.

## Corrections

- Generated framework documentation retains named prose for explicitly excluded
  maintainer assets instead of broken local links. The Jev concept remains excluded.
- The three reviewed optional-memory Python files remain hash-bound, explicitly
  unmeasured inventory entries. Production metrics and unknown-file rejection stay
  unchanged; setup does not acquire a Python prerequisite.
- Historical compiler output goldens use their original recorded feature registry.
  Consumer edits still reach real output and change its fingerprint. Output hashes
  are not regenerated to accept a regression.
- Browser evidence separates the owned JSON report from diagnostic stdout/stderr.
  Version 2 requires its own bounded UTF-8 report; no console-substring fallback
  hides malformed output, failed assertions, retries or nonzero exits. Version 1
  parsing remains explicit. The evidence CLI also recognizes linked launchers and
  canonicalizes the selected workspace without weakening source-path checks.

The existing three-platform framework CLI jobs run real reporter and evidence
regressions early. The stacked PR's optional-memory process-lifecycle changes and
unfinished product work are not part of this backport.

## Local verification

Supplementary environment: Node 22.16.0, not the qualified hosted toolchain.

- Before repair, 7 of 8 documentation/transport assertions failed. Adding only a
  consumer-owned registry comment failed 12 historical compiler cases.
- After repair, all 40 targeted documentation, inventory, compiler, transport and
  child-process evidence tests passed without skips or TODOs; 12 additional compiler
  core tests passed. All 14 compatibility cases also passed with the registry edit.
- The unchanged dependency-free baseline passed 52 tests in each of three runs.
- Generated quick-capture documentation passed a complete local-link smoke check;
  excluded concept payloads remained absent.
- Suite inventory: 284 files, 30 suites and 31 helpers. Source limits and whitespace
  checks passed.

Pinned dependencies are unavailable locally, so the complete generated-devkit test
and real Vitest/Playwright reporter tests require the fresh hosted run. Local
reporter fixtures do not establish browser UI, native-host or live-provider
acceptance. Previous hosted passes do not qualify this new revision. No merge,
release, tag, personal-vault deployment or provider operation was performed.
