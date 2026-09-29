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

## PR #55 merge-conflict resolution — 2026-09-29

Integrated target `f7050739192f5e9c0a7642dcb27b9effc42d557b` into PR #55 head
`73a1334ee3b6d370727afb091c92f5bf54e2ddd0`, with common ancestor
`1a078d235043db2157efbcc702878e120264fc14`. The recovered source trees were
verified byte-for-byte against GitHub tree IDs `bb0d4ffd`, `4a9c1aa1` and
`b1ba8800` before resolution. The actual content conflicts were in this
verification record, the prototype manager and its browser suite; the other
three PR files merged cleanly and were reviewed for integration behavior.

Retained PR #55's scoped stylesheet ancestor, host border tokens, escaped empty
path, form recovery, opened-selection behavior and optional explicitly labelled
inline replay. Retained the target branch's comparison, filtering, metadata,
sealed recovery, durable-plan invalidation and registry-loss safeguards. Opened
selection is validated before reuse, with an active/first-item fallback when
old editor context references an absent variant. No workspace schema, lockfile,
workflow gate or unrelated source was changed. Both dated evidence sections
above retain their original scopes rather than being relabelled as current.

Executed against the combined source with Node 22.16.0 runtime type stripping:
**49 prototype tests plus 14 shell/adapter tests passed (63 total, zero failures
or skips)**. The total includes six new merge regressions for valid/stale opened
selection, the empty workspace, escaped markup and style/persistence integration.
Two initial combined invocations exceeded their local process timeout; the
complete prototype and shell suites were then rerun separately to completion.

**19 retained assembly tests passed**; the exact v5 artifact hash is unchanged.
The suite manifest passed with 346 test files, 35 suites and 34 helpers. Source
limits/locale parity passed for 1,199 inputs and 202 translated keys. JavaScript
bridge syntax, Python browser-test syntax, changed-file conflict-marker scanning
and `git diff --check` passed. Outside the six reconciled PR paths, the only
additional source is the new merge-regression test file.

The merged browser suite retains real file-origin storage and ZIP/hash checks
by default, alongside both branches' interaction checks. Its explicit inline
mode remains separately labelled and is not selected by CI. The locked Node 24 /
TypeScript 6 / Vite build and real-browser suite were not executed locally for
this resolution; evaluate the merge commit's hosted results separately. This
commit updates PR #55's branch with both parents; it does not merge PR #55 into
its target, change PR #5's branch, publish or operate on a personal vault.
