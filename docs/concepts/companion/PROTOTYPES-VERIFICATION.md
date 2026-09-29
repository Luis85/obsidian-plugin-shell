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

## Continuation and reconciliation — 2026-09-29

The resumed work found that PR #5 had advanced to `7efe9bfd4915720c045422be1234206b1af2cc98` while implementation was in progress. That commit already contains the shared prototype model, browser island and shell integration. This continuation preserves that implementation, its schema and its `prototype/version/variant` hierarchy. It does not install a second workspace model or overwrite the concurrent requirements work.

### Findings corrected

1. The hosted prototype browser test waited for `#pm-root` after **Open in editors** had correctly unmounted it. The assertion now requires removal of the old panel and visibility of the real Journey Lens destination. No assertion was replaced by an unconditional delay or removed.
2. The prototype view lacked the `.ps--plugin-shell` ancestor required by the existing CSS ownership pipeline. A local wrapper now applies the compiled scoped styles; the pipeline and host styles are unchanged. Borders use the existing `--line` theme token. The empty path placeholder is escaped rather than interpreted as an HTML element.
3. Rejected prototype forms and recovery exports could erase entered fields. The typed editor now retains these values across redraws, focuses validation errors, requires confirmation before context changes, and consumes a confirmed discard once rather than prompting again during render.
4. Returning from a variant's working editor selected the first variant rather than the opened variant. The panel now restores the opened selection when it is still valid. This changes editing context only, never activation.

### Exact evidence boundaries

The prior hosted run `36627663666`, job `109608694454`, checked synthetic merge `d28981739ab31e2d19d01605b45d7d9df1fc36f7` for PR head `7efe9bfd`. It passed the locked authoring and framework typechecks, **179 authoring/contract tests**, the Vite build, and **48 existing integrated browser assertions**. It then failed in the prototype test's obsolete-panel assertion. These are baseline results, not passing evidence for the continuation.

The continuation locally reran:

- `node --experimental-strip-types --test tests/tooling/companion-prototypes*.checks.mjs tests/tooling/framework-prototypes.checks.mjs`: **32 passed, 0 failed**.
- `python3 -B tests/concepts/companion-assembly.test.py`: **19 passed**.
- `python3 -B scripts/concepts/build-companion.py --check`: unchanged **3,423,529-byte** v5 fixture, SHA-256 `1c988bc6603ad215eafc590af89068d681728bb7918223b87af8f481403bcd77`.
- `node scripts/testing/suites.mjs --check --json`: **35 suites, 338 test files, 34 helpers**, passed.
- The extended prototype browser suite, with explicit `--inline`: **22 assertions passed**, zero JavaScript errors and zero external requests. It covers real import/form/editor actions, A/B isolation, active-source export, version seals, archive/restore, form recovery, single discard confirmation, scoped styles and 1100-pixel layout containment.

The inline browser run used Chromium 144.0.7559.96, simulated browser storage and a source-based replay of the hosted authoring HTML. The replay retains the hosted bundle and substitutes the maintained typed DOM island (using Node's type erasure), trusted bridge and reviewed theme-token change. Hosted input HTML SHA-256: `94e14efa3b559ac8ff5a74b24d46cdf00e320f388ecb80b563b1a399b9f6b6a7`. Replayed HTML SHA-256: `edcda238afff175d06df2eb2dd7a562f943888694ac9bcc2f29474d05aea431f`.

This is not a fresh Vite build, TypeScript check, or real-origin persistence acceptance. The optional `--inline` mode explicitly reports simulated storage and does not run directory ZIP export because its insecure context lacks Web Crypto. **The default CI invocation is unchanged:** it uses the actual rebuilt file-origin application, real storage, real Web Crypto and all three directory/path/hash assertions, for 25 expected browser assertions. It does not opt into the fallback.

Current scoped qualification must run on the pushed continuation commit. Broader baseline workflows also had failures; this record does not assert all CI is green. No native companion installation, user's vault operation, merge, release or publication has been performed.
