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
