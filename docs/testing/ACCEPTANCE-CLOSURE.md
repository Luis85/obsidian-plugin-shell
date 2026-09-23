# Acceptance closure execution record

**Follow-up qualification pending:** the later evidence-head Windows showcase
check exposed missing archive-command diagnostics and a cleanup `EBUSY`. A narrow
test-fixture correction now preserves command outcomes, reporting failures and
primary/cleanup errors without changing limits or retries. The accepted results
below remain bound to `e14c1c3`; they do not qualify the corrected source until its
new frozen-candidate run completes. Earlier reports/assets are retained.

Frozen code: `e14c1c303df75a80a8a287ee8d8a66d4efb9b738`, development version 0.4.0.
[PR #11](https://github.com/Luis85/obsidian-plugin-shell/pull/11), branch
`codex/acceptance-closure`, now targets **main**. It began stacked on then-open
PR #10 at `b426bbdddd4d966fd6ce430996d2542bd7511aaf`. PR #10 was merged externally
at 19:52:23 UTC while this task was running. After confirming the merge and the
unchanged baseline tree, the clean main checkout was fast-forwarded to
`3d9a46046e01509b5285c5d986d54e8a7be2c689` and PR #11 was retargeted. The original
qualification worktree/evidence remains preserved as specifically requested.
The evidence-only documentation
commit follows this frozen code; no runtime assets were rebuilt for that commit.
No merge, tag, publication, listing or permission change is authorized.

## Acceptance results and exact advancement

The [candidate workflow](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35913168402)
passed. Read-only audit rehashed all 32 raw receipt files in its ten registered
producer packets, reparsed framework results, checked repeated semantic inventories,
and independently reproduced its complete acceptance report exactly. Source and
policy input digest is `5b029e21c04080bd7b64f8672421afb1e932ed47b7f6036c1bae086b3a24e3ec`.
The [compact audit](evidence/acceptance-closure-candidate.json) retains every row,
mode, transition, source/asset identity and remaining classification.

| Complete producer session | Verified | Partial | Not-run |
| --- | ---: | ---: | ---: |
| Previous qualified `fd59c80195dee549ddbaaa23c28a06c091b18274` | 1 | 14 | 81 |
| Current frozen `e14c1c3` | 2 | 54 | 40 |

These are evidence-linkage counts, not implementation percentages. The previous
counts were also recomputed from the retained original raw acceptance report.
All 96 rows and their required modes remain unchanged; no linked test name is
unobserved in the current candidate session. AC-03 remains verified.

**AC-06 advances from partial to verified.** Its existing real-service unit
assertion and new served assertion overlap Items and preference writes. The
browser holds the first save, submits the other view's preferences, proves zero
writes before release and exactly two complete stored envelopes afterward,
retains independent drafts, and checks late-view and fresh-reload UI state.
The harness Storage boundary remains explicit; this does not qualify native I/O.

**41 cases advance from not-run to partial:** AC-01, AC-05, AC-07, AC-10,
AC-14–15, AC-17–19, AC-21–22, AC-24, AC-28, AC-31–34, AC-36–38, AC-40–42,
AC-50–54, AC-56–59, AC-61–63, AC-66–67, AC-72, AC-74, AC-76 and AC-82.
Each has an audited exact assertion link now observed in actual current output.
Most advancement links existing behavior; new AC-05/66 assertions additionally
prove exact note preservation, no false success after failure, post-persist
acknowledgment loss with blocked unsafe retries, and opening-only recovery.
Those two cases remain partial because shared plugin-data failure, stale/disposed
recovery and pending-owner closure clauses are not all established by those links.

The [96-row closure ledger](../development/ACCEPTANCE-CLOSURE-LEDGER.md) records
actual source/assertion references and precise closure criteria. Its remaining
groups overlap; they are not percentages and must not be summed:

| Remaining class | Cases / concrete work |
| --- | --- |
| Existing assertions needing additional audited evidence | 89 rows retain supporting assertions but lack whole, current, required-mode evidence. Exact IDs and boundaries are in the audit/ledger. |
| Missing automated assertions or mode binding | 91 rows: every remaining case except AC-02, AC-23 and AC-30. Priorities include corrupt/future browser data, complete persistence failure/recovery, lifecycle resources, locale/dialog breadth, entity/YAML negatives and retained-baseline producer modes. |
| Missing implementation | AC-09 host-locale/fallback breadth; AC-33 trusted Actions publication surface; AC-35 complete listing validator; AC-44 EVT-10 envelope metadata. No unrelated roadmap feature was added. |
| Native/manual/environment qualification | 32 rows: AC-02,04,09–11,16,18,20,22–23,25–27,30,36,45,48–49,54–55,60–61,64–65,68,70–73,76,78,94. These retain their individual native, manual, device or specimen requirements. |
| External/owner prerequisites | AC-23,25,28,30,32–35,72,80: device/support scope, onboarding/manual participants, supported dependency graph, explicit host setup and authorized repository/release operations. |

The separate [34-case Nuxt UI matrix](NUXT-UI-ACCEPTANCE.md), historical baseline
and blocked release profile remain visible and unchanged. Integrity reports are
not release authorization credentials.

## Frozen-source verification

The candidate performed a fresh exact-lock `npm ci --strict-allow-scripts` using
Node **24.21.0** and npm **11.19.1**, then the real
`npm run release:rehearse -- --commit e14c1c303df75a80a8a287ee8d8a66d4efb9b738 --version 0.4.0`.
That command runs full `npm run verify` and retains its accepted build once.

| Command/scope | Actual result |
| --- | --- |
| Full `npm run verify` | Passed static/types/linters/analyzer/repository/presentation/source/catalog/token/artifact gates, tooling, both coverage gates, retained baseline and harness build. |
| Trusted tooling producer inside verify | 173 cases: 169 passed, four exact Windows-only skips on Linux; zero failures. Skips establish no acceptance link. |
| `evidence run runtime`, three fresh processes | 312/312 in 54 files each; identical semantic inventories, zero retries. |
| `test:coverage` and `evidence run coverage` | Both unchanged gates passed. All 97 production inputs: 99.46% lines, 97.43% statements, 97.52% functions, 94.93% branches. Independent domain/application/features floors passed. |
| `check:maintainability` | 801 production functions, zero function findings; 33/4,393 duplicated eligible lines = 0.751195%. Four Vue template aggregate findings remain separately reported, not promoted to source-function qualification. |
| `test:baseline --repeat 3` | 52 cases in each of three runs; release remains blocked. |
| `evidence run browser` (actual Playwright served tests) | 35/35 in eight files; zero skips/failures/retries. |
| `evidence run artifact` | Matching complete assets and provenance/size checks passed. |
| `evidence run native`, three sessions | 31/31 each in isolated Linux Obsidian; zero recorded renderer errors or cleanup failures. |
| Separate `test:native --allow-download --performance` | 31 checks; all 66 samples retained (six warmups, 60 measured), p95 9.10 ms initialization / 85.70 ms Items readiness. Shared-runner advisory, not controlled-reference certification. |
| `npm run check:security` | Live all-category audit passed with zero vulnerabilities. Nested ESLint 9 support remains a separate unresolved exception. |
| Qualified `release:rehearse --check` on downloaded packet | Passed read-only source/lock/asset integrity validation; no rebuild or publication. |

Local pre-candidate work separately passed fresh strict installation (693 packages),
312 runtime tests, 35 served scenarios, types/test lint/source/repository/test-quality/
analyzer checks and the reviewed removal plan. Both evidence-tool findings were
reproduced before correction; all four corrected observer/parser/actual-child
retention regressions passed. Their synthetic/fixture modes do not establish
native-host behavior. Local producer inputs preceding final policy/tool corrections
remain preserved as development evidence rather than relabeled current execution.

## Exact retained assets

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| main.js | 586834 | `d2f069ec4b4352b9794f9907a6b9988ee42c57359785a8fc8c81e4bdadd330ef` |
| styles.css | 88547 | `3a09390ad8f4570c6b9947bd0c9231075ae5357dbf14ade4387bc5d7ac8316e7` |
| manifest.json | 280 | `84c725b25a67053a3ca5652b0111270ba5e3b3d4ff7f06f870352a2ff2018380` |

Candidate record hash: `33b82299f9948fc3f7ae12f616434b6e26e0609f5dd629d43bbaba712944db39`.
Downloaded qualified archive hash, independently matched to GitHub's digest:
`72420d56630aea47ca4c14da93b0c7e1ff40648f7f96ca40c4996e7fbbb55c84`.
Source ZIP: `5d2edd0b345e2df581ebf7b4d81a23848d1e964329034f963bfcb44a2e17ede5`.
Installable ZIP: `3bc82f9830363aa1a1ee0bc2f2bee16f96fc62aafc8c6f234da6779f063bdb54`.
The audit inspected 1,340 evidence archive entries, 601 source ZIP entries and
four plugin ZIP entries with no font-file entries.

The three runtime asset hashes equal the prior qualified assets. This is explicit
byte equality; earlier Windows runs retain their own source/driver identities.
No new Windows native run is claimed. JS gzip/Brotli are 174,669/150,287 bytes;
CSS 11,702/9,964. The matching build graph retains 72 YAML modules with rendered
length 171,883; this is not an additive minified/compressed size attribution.

## Native findings and limits

The [native investigation](NATIVE-RELIABILITY-INVESTIGATION.md) and
[earliest Windows raw audit](NATIVE-RELIABILITY-EARLIEST-WINDOWS.md) retain all
inspected failures, comparisons, samples, cleanup outcomes and hashes. Neither
native failure class has a demonstrated cause. The earliest PR #8 failure showed
Light in Appearance while main stayed dark; the later 79d6688 failure showed Dark
again with unchanged host configuration. They must not be assigned a shared cause
from one failed assertion. The Linux failure retained three empty-stack errors
received on the main renderer during `popout-close`; its GPU warning also occurs
in a passing session and is not a causal discriminator.

Current diagnostic timelines provide stable page IDs, driver receipt times and
phase transitions. All four current native reports contain 25 events ending in
observer disposal. Every canonical error still fails, and inconsistent diagnostic
receipts are rejected. Renderer observation ends at CDP disconnect; subsequent
host-process termination is outside that channel. Final already-received host
logs are retained. The generated foundation driver now preserves separate attempts.
These are evidence-tool corrections, not speculative product fixes.

## Other failures and current qualification boundary

The original focused browser attempt failed both console assertions because the
harness implicitly requested missing `/favicon.ico`; both traces are retained.
The explicit self-contained favicon fixed that defect without error filtering.
The two review regressions failed before correction: a malformed diagnostic schema
was accepted, and generated failures overwrote previous attempts. Failed outputs
remain under `reports/acceptance-closure/`.

One Windows Node 24.21.0/npm 11.19.1
[setup-matrix job](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35913221327/job/107358065660)
failed existing `UI-03-04` at its unchanged 5,000 ms limit during production
coverage. The same job previously passed all 312 tests; the new acceptance tests
ran after the failure in the affected isolated process. Its complete log is retained.
Other independent Windows showcase/setup jobs passed; those do not erase this
failure. One bounded local transformed-source diagnostic passed 312 tests and all
coverage gates, timing the affected test at about 322 ms. No bottleneck or cause
was reproduced; no timeout, isolation setting or source behavior was changed.
The diagnostic is not frozen-candidate acceptance. This intermittent failure
remains an explicit unresolved CI qualification issue.
The [timeout audit](evidence/acceptance-closure-ci-timeout.json) retains the exact
PR merge checkout/tree identity, original job log, diagnostic configuration and
all diagnostic receipt hashes. The merge tree equals the frozen code tree.

The evidence-only `7a292e4` Windows showcase run
[35916883304](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35916883304)
subsequently failed the existing archive-analysis fixture with `EBUSY` on its Git
staging directory after 61.8 seconds. No command receipts survived, so neither a
prior timeout nor its cause can be established. Its artifact is retained with
SHA-256 `308db9ba0e1c1aed15a2eafa4983d166e50d339ad71cbf56601f7c847a4298dd`.
An owned-child timeout probe did not reproduce an orphan. A distinct error-masking
probe also failed its own final cleanup; neither is presented as a passing host
reproduction. Known fixture processes were no longer present in the subsequent
read-only inspection. Automatic approval review rejected manual deletion of
`.qualification/cleanup-masking-repro-SeD42d` as “blocked by policy,” with no more
specific reason. That directory remains preserved; deletion was not retried.

The supported correction is diagnostic/error preservation only. Per-command
started/result receipts retain fixed limits, status, signal, output and error
details. Work completion and cleanup outcome are distinct. A reporting failure
cannot replace a child failure; cleanup cannot replace the work failure. Five
focused controls passed after independent review, including telemetry I/O failure
and actual timeout/nonzero command cases. The 60-second/12 MiB default command
bounds, all analyzer assertions and lack of automatic retries remain unchanged.

Windows archive extraction first reported timestamp-restoration errors. The
verified original ZIP and that extraction are retained; a separate extraction
with `tar -m` then passed byte/hash checks. This is evidence transport, not a
rerun of a failed product test.

## Generated consumer and archive

The [direct frozen-source consumer run](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35913168383)
and separate [PR consumer run](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35913221382)
passed. The [consumer audit](evidence/acceptance-closure-consumer.json) rehashed
19 raw producer receipts, 60 metric raw receipts and 1,934 individual corpus
receipts; all six producer packets reparse consistently. These are independent
modified/archive identities, not the base candidate's asset or acceptance claims.

Atlas Notes 1.0.0 installs freshly, edits Bookmarks to a 100-character limit,
adds a local Reminder maker, typed event/listener and plugin-data Rating,
removes reviewed examples, then adds Reading. All five full verification stages
passed both runtime coverage executions: initial 312 tests/54 files, edited
325/65, removed 285/58, post-Reading 293/64, and literal archive 312/54. Each
stage also passed the separate 52-case baseline three times. Served counts are
35 before removal, two after removal and two in the final browser producer.
Every count retains its actual log or structured-reporter scope in the audit.

The final consumer retains 103 production inputs and unchanged independent
business/coverage/maintainability floors. Its edited Bookmarks bytes remain
`ba9b3f20d82192311eb7b409a36ef65037ac07a45fdaa87900f6d8dbff51fced`
across the pre-removal receipt, source/metric snapshots and final downloaded file.
Both new example-dependent acceptance tests are removed by the reviewed plan;
the shared diagnostic helpers and their foundation-driver regressions survive.

The literal source archive proves absent ancestor Git discovery, freshly adopts
Archive Notes and executes setup/verify plus real runtime/artifact producers with
`kind: archive` and null Git revision. Its assets have their own hashes; no archive
or current consumer native execution is claimed. Final consumer acceptance remains
0 verified / 16 partial / 80 not-run: absent example links stay unobserved rather
than inheriting the base candidate's two verified rows.

The downloaded consumer archive SHA-256 is
`a53ae1776153f36c9dc91a2463aa3106194a1c36b7fa96a99ff12ed74bb74312`.
The first read-only audit invocation rejected ANSI-colored log formatting; its
output remains retained. Correcting that ignored reader allowed the audit to
complete; no consumer test, source or retained report was rerun or edited.

All code-head checks completed: eleven successful, one failed Windows setup job
described above. The evidence-only commit retains this historical failure even
if later independent checks pass. Final source-input verification still matches
`faf4a176492234d512a352f5399f2c98c98f2aa11432b61566ac90b8249e3cd1`.

## Ordered next milestone

1. Investigate the retained Windows coverage timeout with bounded stage/resource
   observation on the actual hosted profile; preserve its first failure and
   deadlines. Continue bounded Windows Appearance and Linux pop-out diagnostics
   from the distinct original observations, stopping on the first reproduced failure.
2. Close implemented persistence and lifecycle gaps with served corrupt/future-data,
   shared-writer failure, stale/disposed recovery and owned-resource assertions
   (AC-05/07/11/46/62/66/71), retaining exact bytes, counts and independent faults.
3. Close locale/dialog/entity/YAML and producer-mode gaps (AC-04/09/10/12/13/50–53
   and the retained baseline families) without changing required modes.
4. Scope missing event metadata and listing validation separately. Keep manual/device,
   onboarding and supported-dependency prerequisites owner-visible. Public release
   interfaces/operations require their own explicit authorization and qualification.
