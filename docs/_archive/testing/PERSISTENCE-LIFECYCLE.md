# Persistence and lifecycle execution record

Work is based on integration commit `5864907`, after confirming PR #12 merged.
The active branch is `codex/persistence-lifecycle`; clean main and both earlier
qualification worktrees are preserved. The [plan](../development/PERSISTENCE-LIFECYCLE-PLAN.md)
was written before implementation and assigns three bounded workers plus a
separate [cross-owner review](../development/PERSISTENCE-LIFECYCLE-REVIEW.md).

Frozen code is `7f14292871efb07ddace131fb9b5603de4122394`, delivered in
[PR #14](https://github.com/Luis85/obsidian-plugin-shell/pull/14). The
[candidate workflow](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35965718824)
passed. Its [read-only audit](evidence/persistence-lifecycle-candidate.json)
rehashed 32 raw receipts, reparsed all ten producer packets, verified repeated
semantic inventories and reproduced the complete acceptance report exactly.

| Complete frozen session | Verified | Partial | Not-run |
| --- | ---: | ---: | ---: |
| Previous `e2758ae` | 2 | 54 | 40 |
| Current `7f14292` | 2 | 55 | 39 |

**AC-71 advances from not-run to partial.** PL-C71 exercises actual recovery sink
callbacks, pending availability invalidation and runtime disposal. PL-B11-71
measures twenty served cycles of owned timers, dialogs, notices, subscriptions and
leaves while retaining a usable sibling. Native action/timer/foreign-notice and
independent-fault-observer clauses remain missing. AC-03 and AC-06 remain verified.
The other six selected cases retain partial status, with stronger exact-byte,
failure, reconstruction, cancellation, isolation and recovery assertions identified
in the [ledger](../development/ACCEPTANCE-CLOSURE-LEDGER.md). All 117 links are
observed, including the 21 new partial links; no whole-case extent was inflated.
Required modes,
the historical baseline, separate Nuxt UI matrix and blocked release profile are
unchanged. Evidence counts are not implementation percentages.

## Frozen-candidate verification

The workflow installs the exact lockfile freshly with Node 24.21.0/npm 11.19.1,
then runs `release:rehearse --commit 7f14292871efb07ddace131fb9b5603de4122394
--version 0.4.0`. Full verify creates one accepted build; subsequent checks reuse
those exact retained bytes.

| Command/scope | Actual result |
| --- | --- |
| `npm run verify` | Passed all static, types, both lint, analyzer, source/presentation/catalog, maintainability, tooling, coverage, artifact, legacy and harness-build gates. |
| Trusted tooling | 178 cases: 174 passed, four exact Windows-only skips on Linux; skipped cases establish no links. |
| `evidence run runtime`, three fresh processes | 325/325 in 57 files each; identical semantic inventories, no retries. |
| Both coverage gates | All 97 production inputs: 99.46% lines, 97.46% statements, 97.63% functions, 94.99% branches. Independent business floors passed unchanged. |
| Maintainability | 801 production functions, zero function findings; 33/4,394 duplicated eligible lines = 0.751024%. Four Vue template aggregates remain separately reported. Read-only source/tool/raw/per-input receipt check also passed. |
| Legacy baseline | 52 cases in each of three runs; release blocked. |
| `evidence run browser` | 45/45 served scenarios in nine files, zero skips/failures/retries. |
| `evidence run native`, three fresh sessions | 31/31 each, zero captured renderer errors, no reported cleanup failure, source/installed asset hashes matched. |
| Separate native performance session | 31 checks and all 66 samples retained; p95 initialization 15.2 ms / readiness 98.5 ms. Shared-runner advisory, not controlled-reference certification. |
| Live `npm run check:security` | Zero vulnerabilities across all installed categories; nested ESLint support remains separate. |

Existing host GPU and temporary-configuration messages remain in all four native
logs. No clean-stderr claim is made. Native timelines retain receipt ordering,
page identities and cleanup boundaries; they do not observe renderer behavior
after CDP disconnect or prove any historical failure cause.

## Retained assets and identities

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| main.js | 586915 | `ddff7ecc664a84c9a4b3fa317c5d15d7838be9b2bc4caf85dd301d2f83c6fd58` |
| styles.css | 88547 | `3a09390ad8f4570c6b9947bd0c9231075ae5357dbf14ade4387bc5d7ac8316e7` |
| manifest.json | 280 | `84c725b25a67053a3ca5652b0111270ba5e3b3d4ff7f06f870352a2ff2018380` |

Candidate record: `ddb602824c40c15cf2d90baf61576618b6f4a9f9630a99a19d431d68838414e9`.
Qualified artifact 10794241824: `666f07a68c2023eef277e912970c6eb7fd998420c628dc0b51dfb022380607fb`,
independently matched to GitHub's digest before extracting 1,377 entries.
Source ZIP: `a805fa785f74c54ae7e0be167f5e75f2c529edf213208506908b1b69eae4c5fd` (620 entries).
Installable ZIP: `e064a180c681b9bde0facacaf0976240c97c9849e4e84009ffc134b4a9be468f` (four entries).
All inspected archive inventories exclude font files. The earlier retained-build
artifact and its independent audit remain separately preserved.

The unchanged 1 MiB JS/100 KiB CSS budgets pass. JS gzip/Brotli sizes are
174,699/150,396 bytes; CSS 11,702/9,964. The matching build graph still contains
72 YAML modules with rendered length 171,883; this is not additive compressed-size
attribution. CSS/manifest bytes match the previous candidate; **JavaScript differs**,
so earlier Windows runtime qualification is not reused.

Executable input digest:
`b45e43dd26a4e734e5e93b1676e0d659d11504d5e4556ecf3c496e6c627ad930`.
Complete policy/session digest:
`d32e2b2c6c6bb9e2147ffb78025ad3d4f458697f0bd58386c09e0dcdb2d460ce`.
Subsequent evidence-only documentation is separate from the code checkpoint and
does not rebuild or relabel its assets.

## Generated consumer, removal and literal archive

The [direct frozen-source consumer run](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35965718757)
and [separate PR consumer run](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35965722844)
passed. The [consumer audit](evidence/persistence-lifecycle-consumer.json)
rehashed 19 raw producer receipts, 60 metric receipts and 1,964 individual corpus
receipts, then checked all 44 uploaded source files against recorded inventories.

Atlas Notes 1.0.0 starts from a fresh installation, generates and edits Bookmarks,
adds the local Reminder maker, event/listener and plugin-data Rating, removes the
reviewed examples while retaining consumer code, then adds Reading. All five full
verification stages passed both coverage executions: initial 325 tests/57 files,
edited 338/68, removed 285/58, post-Reading 293/64, and literal archive 325/57.
Each stage also passed the separate 52-case baseline three times. Served totals
were 45 before removal, two after removal and two in the final browser producer.

The final consumer has 103 production inputs and retains unchanged independent
business/coverage/maintainability floors. Bookmarks bytes remain
`ba9b3f20d82192311eb7b409a36ef65037ac07a45fdaa87900f6d8dbff51fced` across editing,
removal, extension and final uploaded source. All five new example-dependent
tests/helpers are removed by the reviewed plan; generic harness resources survive.
Final consumer acceptance is separately **0 verified / 16 partial / 80 not-run**:
removed example links stay visibly unobserved.

The literal source archive proves absent ancestor Git discovery, adopts Archive
Notes, installs freshly and runs full setup/verify plus real runtime/artifact
producers with `kind: archive` and null revision. Its 97 production inputs and
assets have their own identities. No consumer-native or archive-native execution
is inferred. The downloaded consumer artifact SHA-256 is
`301e583f4e5a552ddcb584b7d5fd40326c9d7379cbe5c7c0db9a25e90b3ea2ad`.

All five Linux archive-analysis attempts retained 50 start/result pairs and
completed their bodies and cleanup. Git-absence exit 128 and two expected analyzer
negative exits per attempt remain visible; they were not filtered into ordinary
command successes. The 60-second/12 MiB bounds remain unchanged.

All **12 checks on frozen code `7f14292` passed**, including Windows/Linux
showcase/baseline, both Node/npm setup profiles on both platforms, both consumer
runs, the candidate and security integration. The evidence-only head is separate;
its check status is reported in the final PR description rather than relabeling
these executions.

## Current Windows prescribed verification

The [Windows receipt audit](evidence/persistence-lifecycle-windows.json) inspects
the existing Showcase job, not another test rerun. Its PR checkout
`2502e41e47847f22782b3c09b89d39d65402c011` has the exact frozen Git tree
`604dff044836468a06c6e25d5fb12be91e4aacad`. Both prescribed setup/verify stages
completed, including four 325-test coverage executions and two archive-analysis
bodies with successful cleanup and all 20 command pairs retained at unchanged
limits. Neither the original UI-03-04 stall nor EBUSY cause is explained.

The Windows archive SHA-256 is
`05424cc04311e9212e000c2224a330abd1265489d3ffbc72e9f7a92e183c086d`.
Its rebuilt assets are separately hashed and differ from the frozen Linux assets.
JS and manifest compare equal only after diagnostic CRLF normalization; CSS does
not. No byte-equivalence or Windows native qualification is inferred, and no
speculative build correction was made. The original workflow log used literal
escaped ANSI sequences; the first reader found zero summaries and failed. That
reader/diagnostic is retained; the corrected read-only normalizer found all four
actual summaries without rerunning tests or changing the original log.

## Implemented scope

- Protect Items mutation controls on exact root/entity read failures while keeping
  permitted preference writes independent of unsupported entity collections.
- Reject retained disposed document view navigation, preview, commit and reset
  actions. Pending writes retain their real outcome; opening remains separate.
- Add real-service exact-byte persistence/reconstruction, known/uncertain failure,
  queue blocking, durable revisions, runtime isolation, cancellation, request
  retention and diagnostic privacy assertions.
- Add production-component and served-browser controls for protected data,
  initiating-view closure, sibling drafts, stale/disposed opening and measured
  timer/dialog/notice/subscription/leaf cleanup.
- Reuse existing native diagnostic/error-preservation infrastructure. Four bounded
  read-only comparisons establish no root cause and justify no native runtime fix.

## Development verification and retained failures

Fresh strict installation used exact-lock Node **24.21.0** / npm **11.19.1**:
693 packages installed; initial build and strict Vue/TypeScript check passed.
Local browser provisioning explicitly selects the existing Chromium executable
with SHA-256 `9b07943f834485b43c9d54caea2951c78715f9f07070a80ab6658465ebd3e711`.
This does not constitute a native host run.

The corrected full trusted development producers passed **325/325 runtime tests**
in 57 files and **45/45 served-browser scenarios** in nine files, with no skipped,
failed or retried cases. Their original packets remain in separate source-input
sessions because reviewed ownership metadata changed between them. They supply
observed assertion names for 21 new partial crosswalk links; only the subsequent
frozen complete session can establish the current acceptance report.

Source limits/locale parity passed on 445 inputs and 191 keys; repository checks
passed seven workflows, nine stylesheets and 84 Markdown files at that point;
test-quality checks passed 79 TypeScript test inputs. Reviewed removal initially
rejected the changed README's stale ownership hash, as designed. After updating
that exact reviewed hash, the second plan passed and includes all five new
example-dependent test/helper files. The rejected first plan remains retained.

Final local strict types, ESLint over source/tests/harness, the independent source
linter (97 production inputs), presentation boundaries (24 inputs/nine Vue files),
full Fallow analyzer (zero findings), repository/source checks and the live
all-category `npm run check:security` passed. The live audit reported zero
vulnerabilities; the nested ESLint support exception remains a separate issue.
Full verify/coverage/native/consumer/archive execution belongs to the frozen
candidate phase recorded above, not these development checks.

The qualified protected-data regression failed before its correction. An earlier
accidental Node 24.20.0 diagnostic is retained separately and never promoted.
The first eight-test attempt had three passes, four fixture setup failures from
the missing injected scheduler, and the real disposed-action failure. After the
fixture and runtime corrections, all nine A tests passed; the combined 12/13 run
exposed an incorrect expectation of automatic Task projection refresh. It now
checks the committed fact and explicit Reload notes behavior.

Independent review strengthened the disposed commit regression with real call
counts and state snapshots. Removing only its entry guard produced a retained
busy-state failure. The diagnostic wrapper expected the later call-count failure
and failed its own matcher; a read-only audit distinguishes that wrapper error
from the successful mutation detection. No rerun was used to erase it. A separate
navigate regression failed on disposed page mutation before the matching guard.

Every attempt remains under `reports/persistence-lifecycle/` or the explicitly
named `reports/pl-c07-*.log`. Source-changing corrections create new identities;
development runs are not frozen-candidate qualification.

## Native and Windows limits

The [new investigation](PERSISTENCE-LIFECYCLE-NATIVE.md) rehashes original reports
and separately audits Appearance, Linux main-renderer errors, Windows production
coverage timeout and archive cleanup EBUSY. Earliest Light versus later Dark
Appearance observations remain different. Driver receipt time is not throw time;
CDP disconnect ends renderer visibility. No original body timeout or orphan is
inferred from EBUSY. All prior candidates, failures and prohibited cleanup residual
remain untouched.

The current native diagnostic snapshot is a bounded production buffer, not an
independent caught-error observer. AC-71 still needs exact native resource/action/
foreign-notice ownership plus that observer before reload. Twenty served browser
cycles and a synthetic foreign DOM sentinel cannot fill those native clauses.

## Remaining work by category

| Category | Concrete remaining scope |
| --- | --- |
| Assertions | Complete each selected case's clauses in each required mode, broader privacy/input bounds, nonempty action registries in served cycles, window/pop-out/partial-startup cleanup. |
| Implementation | Ordered migrations/category-specific recovery are not established; retained Task repository-editor actions need a focused disposal audit; string-length body limit is not a UTF-8 byte guarantee. |
| Environment | AC-71 native resource observer and owned/foreign handles, unresolved Windows/Linux causes, broader native/manual/device qualification. |
| External/owner | Supported nested ESLint dependency graph, onboarding/manual participants and separately authorized repository/release operations. |

No merge, tag, release, publication, listing, permission change or automerge is
performed or authorized by this milestone.

## Ordered next milestone

1. Finish the bounded Task repository-editor disposal audit and the remaining
   data-recovery/input-byte clauses with real positive and negative assertions.
2. Add the agreed native qualification observer for AC-71 resource/action/foreign
   Notice ownership and an independent fault ledger before reconstruction.
3. Run the precise next Windows hosted-stage and Appearance/Linux close experiments
   from the native record, keeping first outcomes and unchanged deadlines.
4. Address locale/dialog/entity/YAML and producer-mode gaps separately; retain
   manual/device, dependency support and owner-controlled prerequisites.
