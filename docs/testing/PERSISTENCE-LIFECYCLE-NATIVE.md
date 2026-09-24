# Persistence/lifecycle native and Windows investigation

Read-only experiments executed 2026-09-24 under the agreed
[milestone plan](../development/PERSISTENCE-LIFECYCLE-PLAN.md). The four original
failure categories remain unresolved. No host was launched, no retained file was
changed, and no theme action, deadline, retry, process or cleanup policy changed
during this audit. Historical passes remain historical; this document supplies
no new native acceptance link.

## Experiment boundaries and ownership

Worker C owns this record. The parent owns candidate qualification, shared
schemas/check catalogs and acceptance links. Existing instrumentation was inspected
before considering additions: `native-diagnostic-observer.mjs`, its validation and
regressions, `native-theme.mjs`, `check-native.mjs`, `native-item-ownership.mjs`,
and the archive command fixture and its five controls. These read-only experiments
demonstrate no need for additional causal-diagnostic instrumentation. The separate
native acceptance observer gaps remain explicit below.

| Experiment | Selected hypothesis and one bounded comparison | Result |
| --- | --- | --- |
| Windows Appearance | Both failures represent the same unchanged Dark selection. Rehash/read each original report and independently inspect both actual Appearance PNGs and retained later boundary trace. | Rejected as a description of the observations: earliest selector/window is Light while main is dark; later selector/window and observed host configuration are Dark. A shared cause remains unknown. |
| Linux pop-out | The original error identifies the pop-out throw site, or GPU logging uniquely identifies the failing run. Compare canonical errors and host logs of the adjacent pass/failure once. | Neither is established. Main-page receipts have empty stacks; GPU messages occur in both runs. |
| Windows coverage | A deterministic settings stage remains stalled in the retained controlled diagnostic. Compare original hosted log against that diagnostic's stage/result/resource records once. | Not reproduced: external commit and both save cycles completed. The original failure has no equivalent stage trace. |
| Windows archive | Original EBUSY establishes a preceding command timeout or surviving child. Compare original terminal log, child probe, failed masking control and the corrected fixture's retained receipts once. | Neither is established. The original body outcome is unknown, and the child probe recorded its descendant already stopped. |

Commands were `Get-Content`, scoped `rg`, `Get-FileHash -Algorithm SHA256` and
read-only directory inventories; PNGs were visually inspected. There was no fresh
runtime, coverage, archive or native execution in these four experiments. Existing
fixture execution within the parent's prescribed verification is a separate run,
with its first outcome retained rather than a diagnostic retry.

## Windows Appearance: preserve the different failures

The earliest raw report is retained under
`D:/Projects/obsidian-plugin-shell/.qualification/release-operations-merged-a624e28/reports/native`.
Its source is `4f9b3b13825c7e2fbfca414611cc7aa0143a4812`. The actual
`native-appearance-light.png` shows **Light** and a light Appearance window. The
main-window assertion remained dark at its unchanged five-second bound. The
report has no contemporaneous host-config/event trace; later configuration values
cannot be projected backward onto it. The plugin roots follow their dark owner
body, excluding a plugin-root-only mismatch as the complete observed condition.

The later source `79d668858612b0d631094f04306c6818e8fe066b` failure is retained in
`.worktrees/executable-qualification/reports/native/attempts/2026-09-23T17-31-48.785Z-14636`.
Its actual Appearance PNG shows **Dark**. The boundary trace at 17:32:35.266 UTC
records `obsidian` and dark bodies after attempted Light selection; before that
action it also records `obsidian`. The earlier successful locator-value assertion
and the later Dark screenshot do not reveal whether the host callback committed
and reverted or did not durably commit. The active-Appearance guard, unique actual
selector, real option change, screenshot, settings frames and main frames remain
in the inspected driver.

The prior instrumented passing comparison recorded select-node replacement during
a successful change. Replacement alone cannot diagnose the first failure. Neither
an OS-focus cause nor plugin, host or automation culpability is established. The
[earliest audit](NATIVE-RELIABILITY-EARLIEST-WINDOWS.md) and
[prior investigation](NATIVE-RELIABILITY-INVESTIGATION.md) retain all subsequent
comparisons and original asset identities.

Next experiment, if selected: one isolated unchanged dark/light sequence on the
frozen candidate, reusing the existing capture/bubble select, stable-node,
config/CSS, per-window mutation/frame and foreground observations. Record current
resource availability immediately before launch. Retain its first result and stop
on failure; correlate that attempt before proposing a correction. A passing run
cannot explain either historical failure.

## Linux main-renderer illegal access

The original failed second session at
`.worktrees/executable-qualification/reports/ci-79d6688-full-35895304729/reports/native/attempts/2026-09-23T17-31-26.151Z-20961`
has all 31 checkpoints and three distinct canonical errors. Each is
`illegal access`, stack `""`, URL `app://obsidian.md/index.html`, driver phase
`popout-close`. This is evidence of receipt on the main page. The phase covers
menu opening, close selection and subsequent checks until `plugin-unload`; it
does not identify which action threw. The report's final phase is `cold-restart`,
which must not replace those earlier error phases. The first session's report at
`reports/native-run-1/attempts/2026-09-23T17-31-01.055Z-20692` passed; both host
logs contain the GPU-unusable message. No error was filtered or deduplicated.

Existing current instrumentation records driver receipt timestamps, monotonic
times, stable page IDs, page-close events and phase transitions, and rechecks the
canonical error list after browser cleanup. Receipt time is not renderer throw
time. Observation ends at CDP disconnect; a later process stop is outside renderer
visibility. Absence of a historical cleanup-failure field is not an independent
process inventory or proof of every earlier resource lifetime.

The next frozen-candidate Linux session uses that existing instrumentation and
isolated provision flow. If the failure recurs, retain the full first attempt; the
next separately bounded diagnostic should add renderer exception/context IDs and
individual close/unload boundaries. Only then consider a same-host plugin-free
versus plugin-enabled comparison. None of those future runs is reported here as
executed, and nonrecurrence will not establish cause closure.

## Windows UI-03-04 production-coverage timeout

The original log belongs to source
`e14c1c303df75a80a8a287ee8d8a66d4efb9b738`, hosted run `35913221327`, job
`107358065660`. Its first runtime/selected-core settings file passed in 530 ms.
In production coverage, UI-03-04 took 5,035 ms and failed the 5,000 ms bound;
the settings file took 7,478 ms and UI-03-05 took 2,073 ms. Those are test/file
durations, not measured stages of a stalled storage call.

The retained source-transform diagnostic is a separate historical execution. Its
UI-03-04 stage envelope is 318.565 ms (framework test duration 321.6609 ms):
mounting takes 131.947 ms, external commit 10.636 ms, and the two
`first-tick` to `promises-flushed` save intervals take 30.566 and 38.348 ms.
Disposal completes in 5.324 ms. These observations reject a deterministic stall
in that execution; they do not locate the original timeout. The diagnostic's one
memory sample reports 1,050,068 KiB free of 8,197,120 KiB physical memory at
20:16:41.6301190 UTC. That is neither the original hosted machine nor a
time-correlated sample of its failed stage, so it cannot establish memory pressure
as the original cause. The transform itself can affect scheduling.

No production or test correction, limit increase or isolation change is justified
by this comparison. The [retained timeout audit](evidence/acceptance-closure-ci-timeout.json)
identifies every raw file. Next experiment: one hosted-profile run with report-only
stage and resource observations, unchanged 5-second limit and existing file
isolation, preserving first failure/success and all resource samples. A normal
candidate pass alone remains separate from this causal experiment.

## Windows archive staging EBUSY

The original source `7a292e40dde61dc6ea4134caa9b5b88093fc3cb7`, hosted run
`35916883304`, job `107370549388` failed the archive-analysis case after
61,771.4366 ms. Its terminal error is EBUSY on `rmdir` of the owned staging
directory. It has no command receipts and does not establish whether the body
completed, a command timed out or cleanup masked a previous failure.

The prior child probe records an actual ETIMEDOUT after 3,009.4072 ms, but its
descendant was already stopped. The probe failed its expectation that the child
would survive. It does not demonstrate the original orphan hypothesis. The
separate masking control failed final cleanup and never wrote its planned
structured report. Its raw stderr and the prohibited residual directory
`.worktrees/acceptance-closure/.qualification/cleanup-masking-repro-SeD42d`
remain untouched; no alternate deletion was attempted.

The existing corrected archive fixture already retains unique start/result
receipts, `bodyCompleted`, work/cleanup statuses and both primary/cleanup errors,
including receipt failure. Its default remains 60 seconds/12 MiB with zero
automatic retries and unchanged spawn behavior. The inspected historical passing
attempt `reports/analyzer-archive/f27ee38b-c198-405f-b619-856e5e5c5c36` has ten
start/result pairs, `bodyCompleted: true`, cleanup passed and no failures. That
qualifies its own reporting and execution, not the earlier lock's cause.

Next experiment is one ordinary archive case in prescribed verification using
these receipts. If EBUSY recurs, compare body/result timestamps and owned child
identity before any new action. Do not infer timeout from approximately 60 seconds,
stop unrelated processes, add retries, or use the prohibited residual as a fixture.
See the [retained archive audit](evidence/acceptance-closure-archive-failure.json).

## Provisioning and selected acceptance scope

Read-only inventory found the existing qualified launcher 3.2.1 and Windows
Obsidian app/installer 1.13.7 under the preserved
`.worktrees/executable-qualification/.native-runner` and `.native-cache`.
The app ASAR hash is
`a52a7daf1e2460bae03de80f2816604bd16a56cd374fbe5ce8d1a9ef5604059d`.
This is inventory, not approval to reuse a personal vault or an old scratch config.
At inspection the new worktree had no provisioned native runner/cache. No files
were copied, downloads started or host/config directories launched by this worker.
The inspected driver creates a fresh contained qualification vault, checks its
canonical path and uses a fresh launcher configuration with an exact safe path
check. Native execution remains owned by the parent's isolated candidate flow.

Of AC-05/07/11/46/62/66/71, only AC-71 requires native evidence. Its C/B/N modes
must remain distinct. Existing native Items ownership assertions prove a paused
controlled adapter commits after initiating-view close, the sibling retains its
draft, and a controlled rejection produces no success and one exact fault in the
production diagnostic snapshot before runtime reconstruction. That snapshot retains
only the last 200 records; native adapters do not inject the independent
`observeError` ledger. It cannot prove absence of dropped or earlier unexpected
faults. These are not native disk-failure tests and
do not count all notice handles, recovery actions, timers or foreign ownership.
Existing real modals cover confirmation/prompt/focus, not the full AC-71 lifetime.

AC-71 stays partial until one candidate-bound native scenario measures those
resources separately: establish a live sibling and a foreign persistent Notice;
open view-owned native feedback/dialog and delayed progress; capture owned action
availability; close only the initiating view; assert its actual dialog/notice
handles dismissed and its timers/actions absent while the sibling and foreign
Notice remain usable; release a previously pending action and prove no late UI
or handle resurrection; then unload and require the plugin baseline plus zero
owned resources, with the foreign Notice retained. Inject the separate caught-error
observer and assert its exact codes, occurrences and zero overflow before any
reload; inspecting only `diagnosticSnapshot()` is insufficient. Use an injected
qualification observer at existing scheduler/sink/action boundaries rather than global timer or notice-container
sweeps. The public runtime currently exposes only disposal/diagnostics, so adding
this observer requires an agreed explicit native fixture seam and matched trusted
producer check; it is not inferred from the current 31-check suite or browser data.
No production test globals or private Notice manager patch is proposed.

## Recomputed raw integrity

All hashes below were recomputed from the preserved raw files on 2026-09-24.
Roots: A = earliest archive native directory above; W = later Windows attempt;
L = failed Linux attempt; R = `.worktrees/acceptance-closure/reports/acceptance-closure`.

| Raw file | SHA-256 |
| --- | --- |
| A `report.json` | `175b8d74554478d5fc1885ce3a03880ce17062390e263e6e7245dd110aac0a72` |
| A `native-appearance-light.png` | `39013b64c822e94feec0d689fe9d66fb441492b8efa09016dea4fb9713a179d1` |
| W `report.json` | `662b8887b65cadc5ab13b4dc44b20485de4786b55ee1d2b213b50593b0658cd6` |
| W `native-appearance-light.png` | `a216f192cbad8dba6b56c7cf4428137e36d69ec1bb6d8586a2248d93f8ada2b7` |
| W `theme-observations.json` | `b4d25b4f96ecc93b126aaae73c861168996d724442cbe3f8b7c14c74c0966a78` |
| L `report.json` | `8294aafd39fd317fabe6119c7a9a7bf36cf780ea58c7d8921ba4ac1b0a59dfe7` |
| L `host.log` | `59067c4213a54dc5de9777a83800c225d4ac875c6d8ebeac57cff1cb9de99b1e` |
| R `setup-windows-24-failed.log` | `082a3a8b02ae9751e241322c7d3d6559c182e3e259999fbe633a52cd9da2a254` |
| R `settings-diagnostic/stage-summary.json` | `9f1d3ee75414610ff2eabed19fbc315ba0251defe588d0253c21549868da4e3f` |
| R `settings-diagnostic/environment-sample.json` | `d30168adc64ac56a4ede52b83eec3d063e756770c39eac9b2aad717a28f7f0d5` |
| R `evidence-head-showcase-failed.log` | `13f2be32c6a162a3efff5901d9c1a9256494a215bb86f16a562f5f502770fc4c` |
| R `analyzer-owned-child-repro.json` | `95beff16d968f8efb4fc3608a0a6b13613dd10333657b8c8956ed0e417bb2dd8` |
| R `analyzer-error-masking-repro-stderr.log` | `b2f33c6728824bbdb2cc6f54c1551caaa4b86ffd9445fc8bac66fbe03519a562` |
