# Prototype management — verification record

Baseline: PR #5 head `bde086c4440de300f31dc550ae10e9cb9836b219`, downloaded from that commit's source-review artifact. The artifact records synthetic merge `7033083122cae1f38ecb7fdea173ebbdfe4aba2b`; proposed edits are based on the actual PR head and preserve unrelated files. This record does not relabel baseline workflow results as feature acceptance.

## Executed locally

- `node --experimental-strip-types --test tests/tooling/companion-prototypes*.checks.mjs tests/tooling/framework-prototypes.checks.mjs`: **32 passed, 0 failed**. Fifteen domain tests cover complete snapshot isolation, statuses, single activation, sealed versions, archive/restore, independent versions/prototypes, inert JSON, malformed imports and directory hash validation. Seven browser-adapter boundary tests execute the unchanged trusted bridge with injected host ports, covering commit/rollback, quota preflight, stale selection, identity, import preservation and pinned handoff. Ten shell integration tests execute real plans/writes in disposable directories, including independent A/B generated output, provenance, stale-plan rejection and actual plural CLI routing.
- `node scripts/testing/suites.mjs --check`: passed after registering the modern browser suite. Existing companion/framework wildcard suites discover the new Node tests.
- Python syntax compilation of `tests/concepts/companion-prototypes.browser.py`: passed. Syntax is not browser execution.
- Supplemental composition of the maintained additions against the downloaded current authoring artifact: exact replacement seams matched. This is not the qualified Vite build or TypeScript validation.

Local runtime: **Node 22.16.0 / npm 10.9.2**, not the qualified Node 24.21.0 / npm 11.19.1. The combined CLI-guidance/domain run had 26 passes and one failure: the existing human-doctor assertion expected empty stderr, but local Node 22 emits an experimental type-stripping warning. No assertion, warning policy or production gate was weakened.

## Not accepted from this environment

The locked dependency installation is unavailable locally. **TypeScript 6.0.3/vue-tsc and the qualified Vite build have not been run locally.** No global TypeScript 5 installation was substituted.

Chromium navigation to both the generated local-file artifact and a local HTTP test origin was rejected with `net::ERR_BLOCKED_BY_ADMINISTRATOR` before application load. No screenshots or local browser passes are claimed. The new browser test is registered in the existing `journey-editor` job, after the locked typechecks/build and alongside the existing authoring regression. It exercises actual import, capture, fork, real sitemap edits, save, A/B activation, active export, real storage reload, JSON and ZIP round trips, sealed checkpoints and archival. Evidence is emitted as `reports/companion-mvp/prototypes-browser.json` and a screenshot only after successful execution reaches those steps.

Hosted checks must be read for the actual feature commit. Baseline companion verification was green, while several broader PR #5 workflows were already failing. Neither fact determines the outcome for this change. Full native Obsidian acceptance, plugin installation, dependency/build execution in a user's project, live services, publication and merge are **not performed**.


## Review and polishing pass — 2026-09-29

This section adds evidence; it does not rewrite the preceding baseline record. The reviewed implementation is `7efe9bfd`, and integration preserves the concurrent PR #51 merge at `1a078d2`. The other downloadable implementation was inspected, not applied wholesale. Its independent counts are not added to these totals.

### Executed checks

| Check | Result and scope |
| --- | --- |
| `node --experimental-strip-types --test tests/tooling/companion-prototypes*.checks.mjs tests/tooling/framework-prototypes.checks.mjs` | **49 passed, 0 failed**: 15 original domain, 12 new domain/codec/presentation, 8 bridge and 14 shell/adapter cases. Real filesystem operations and the existing independent A/B compiler cases remain. The new malformed-receipt negative control injects a compiler port and tests the real receipt adapter; it is not another full compiled-project build. |
| `python -B scripts/concepts/build-companion.py --check` | Passed; retained v5 HTML remains 3,423,529 bytes, SHA-256 `1c988bc6603ad215eafc590af89068d681728bb7918223b87af8f481403bcd77`. |
| `python -B tests/concepts/companion-assembly.test.py` | **19 passed**. |
| `node scripts/testing/suites.mjs --check` | Passed. Existing prototype test discovery and hosted browser registration retained. |
| `node --check scripts/concepts/prototype-bridge.js` and Python browser-test syntax | Passed; syntax is not runtime qualification. |
| Updated browser actions through supplemental DOM replay | **24 assertions passed** using real Chromium, the exact new source islands composed onto the hosted baseline HTML, and explicitly controlled in-memory Storage. Actual Journey Lens edits, comparison, filtering/caret, form errors/dismissal, activation, exports, recovery and restore-back executed. No uncaught browser errors or external requests recorded. |

### Browser and toolchain limits

File-origin and loopback-origin navigation remain administratively blocked locally before application load. The supplemental replay uses `set_content` and a controlled Storage port; its reload transfers that controlled state. It does not qualify actual browser-origin durability or native vault persistence. Its report is explicitly labelled `prototypes-memory-browser.json`. Real Web Crypto directory-ZIP assertions were not counted in this replay. The maintained hosted browser script retains the original real-origin reload and ZIP checks and adds the new behavior assertions.

The original hosted run `36627663666` passed repository-local TypeScript 6 checks, the Vite build, 179 authoring contract tests and 48 existing authoring browser assertions, then failed the newly added prototype test because it looked for the unmounted manager after Open in editors. That assertion is corrected to expect the manager's removal and the real editor's presence. These historical upstream passes are **not** qualification of this changed source.

Local dependency installation was attempted with lifecycle scripts disabled, but did not finish within the execution window; the local Node/npm versions also differ from the qualified versions. No TypeScript 5 substitute was used. Qualified TypeScript 6/Vite and real-origin browser acceptance for the new commit remain hosted checks, not inferred passes.

The focused Node run used the source-review checkout at `7efe9bfd` with this feature patch. The final CLI routing change is also applied to the exact `1a078d2` operations source, retaining its documentation dispatch and `saveOperationPlan` integration; concurrent helpers are not replaced. Full mixed-head qualification belongs to the candidate's hosted run. No gate, lockfile, CI threshold or retained fixture is relaxed.

### Remaining acceptance boundaries

This is browser authoring plus shell prototype management, not complete native companion acceptance. Screen-reader/manual accessibility, large-library performance on target hardware, cross-process durability and the broader PR #5 release journey were not qualified here. No merge, release, real user-vault write or plugin activation was performed.
