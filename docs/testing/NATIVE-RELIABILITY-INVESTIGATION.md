# Native reliability investigation

Investigation date: 2026-09-23. Neither historical failure has a demonstrated
root cause. The Windows failure includes unchanged host configuration, not just
an incorrectly styled plugin view. The Linux errors were received by the main
renderer during the driver phase named `popout-close`; their empty stacks do not
identify the throwing code. Later successful runs do not close either issue.

## Bounded experiment agreed before execution

The acceptance-closure plan assigns this track read-only inspection of retained
reports, logs, screenshots, observations and exact driver/host source. The parent
approved that experiment before execution. It compares the first failed Windows
and Linux attempts of candidate `79d668858612b0d631094f04306c6818e8fe066b`
against their contemporaneous observations and retained comparison runs. No host
was launched, no retained report changed, and no theme value/class, timeout,
retry, error filter or screenshot baseline changed during this investigation.

All local paths below are relative to the preserved sibling worktree
`.worktrees/executable-qualification`. The original candidate workflow is
[35895304729](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35895304729).
This is distinct from the older PR #8 Windows failure described in
[the previous investigation](RUNTIME-AUTHORING-NATIVE.md), whose raw checkout
is not present at the historical relative path. That older report is not
reconstructed or represented as newly inspected evidence.

## Retained identities and outcomes

Both first failed attempts used Obsidian app/installer 1.13.7, launcher 3.2.1,
Electron 43.3.0 and Chrome 150.0.7871.212. Windows reported 1023 × 800 at DPR 2;
Linux used the isolated native Xvfb setup. Their installed asset hashes match:

| Asset | SHA-256 |
| --- | --- |
| main.js | `d2f069ec4b4352b9794f9907a6b9988ee42c57359785a8fc8c81e4bdadd330ef` |
| styles.css | `3a09390ad8f4570c6b9947bd0c9231075ae5357dbf14ade4387bc5d7ac8316e7` |
| manifest.json | `84c725b25a67053a3ca5652b0111270ba5e3b3d4ff7f06f870352a2ff2018380` |

| Retained attempt | Outcome | Cleanup reporting |
| --- | --- | --- |
| Windows `reports/native/attempts/2026-09-23T17-31-48.785Z-14636` | Failed after 22 checkpoints; 0 captured renderer errors; light body assertion failed at the unchanged 5-second bound; no cold restart | No `cleanupFailure` or `scratchPreserved` recorded |
| Windows `reports/native/attempts/2026-09-23T17-48-10.979Z-6172` | One previously authorized instrumented comparison; 31 checkpoints, 0 captured renderer errors, cold restart | No cleanup failure; observer/sampler completion recorded |
| Linux `reports/ci-79d6688-full-35895304729/reports/native-run-1/attempts/2026-09-23T17-31-01.055Z-20692` | First session passed 31 checkpoints | No cleanup failure recorded |
| Linux `reports/ci-79d6688-full-35895304729/reports/native/attempts/2026-09-23T17-31-26.151Z-20961` | Second session failed despite reaching 31 checkpoints: 3 renderer errors | No cleanup failure recorded |

Absence of a cleanup-failure field describes the original producer's result; it
is not a new process inventory or independent cleanup proof. Performance samples
remain intact in each Windows attempt: 3 warmups and 30 measured samples for
each of 2 metrics (132 total across the attempts). Shared-load and controlled
reference classifications remain separate in the
[existing curated measurements](evidence/executable-qualification-windows.json).

## Windows: direct observations and limits

The first attempt's `theme-observations.json` records these UTC boundaries:

| Time | Observation |
| --- | --- |
| 17:32:26.872 | Before dark action: main body light, host theme `system` |
| 17:32:28.775 | Dark assertion passed: main/settings bodies dark, host theme `obsidian`, actual scheme selector `obsidian` |
| 17:32:29.344 | Before light action: main/settings bodies dark, host theme `obsidian`, actual scheme selector `obsidian` |
| 17:32:35.266 | Failed light action: main/settings bodies still dark, host theme `obsidian`, actual scheme selector `obsidian` |

The driver reached its body-class assertion after `selectOption('moonstone')`,
the locator value assertion, the Appearance screenshot, two settings animation
frames, main foreground request and two main animation frames. The retained
`native-appearance-light.png` itself visibly shows **Dark**. Thus the selector
value assertion succeeded earlier in the sequence while the later screenshot
and boundary observation show Dark again. The record lacks a continuous event
trace during this first attempt; it cannot distinguish a callback that did not
commit the value from a committed value that was subsequently reverted.

The host-source inspection retained in
`.qualification/native-comparison-79/host-source-inspection.json` identifies
app.js SHA-256 `8efbf581e259cabef4f9c9a34814cfe3c02863757377e56b3603933c50e89898`
inside app ASAR SHA-256
`a52a7daf1e2460bae03de80f2816604bd16a56cd374fbe5ce8d1a9ef5604059d`.
Its extracted source shows the real dropdown change callback invoking
`changeTheme`, which writes `vault.setConfig('theme', value)`, and the Appearance
tab rebuilding on `css-change`. Those source relationships describe the expected
path; they are not a record that the failing callback executed.

The later passing comparison used the same retained assets, driver checkpoint
`456b49a1f76174671aaca5b5a0d216a15e7d92c2` and separately hashed diagnostic
observers. It recorded light-selection capture on node 7 at 17:48:45.107,
main `css-change` at 17:48:45.140 and `config-changed` at 17:48:45.141, both with
`moonstone`. By change bubbling at 17:48:45.141 that select node was disconnected;
the rebuilt control represented Light. Node replacement therefore occurs on a
successful path too. The independent foreground samples report `msedge` while
the DOM reports focus; neither signal establishes the earlier failure's cause.
Observers can also perturb scheduling. This comparison is not a controlled
failure reproduction and is not current-source native acceptance.

Eliminated narrow explanations: missing Light option (present); selector
ambiguity (unique-selector assertion passed); a plugin-only dark class while
the host was light (both host config/body remained dark at failure); an
uncaught renderer error recorded during this attempt (none captured). Not
eliminated: transient host changes, callback/realm lifecycle, automation timing,
load, focus effects or plugin influence on the host. No one category is proven.

## Linux: exact errors and limits

The failed report retains three separate identical errors, without deduplication:

```json
{"message":"illegal access","stack":"","url":"app://obsidian.md/index.html","phase":"popout-close"}
```

`check-native.mjs` captures a page's URL when its `pageerror` event reaches the
driver. The immediately preceding theme observations show the main window at
that URL and both Appearance and plugin pop-outs at `about:blank`. This supports
receipt on the main page, not a throw site in pop-out code.
`native-header-checks.mjs` sets `popout-close` before
opening the owned View actions menu and selecting Close this view; the phase
also covers subsequent header/diagnostic/foreign-style checks until
`plugin-unload`. There are no original error timestamps, stable page IDs,
throw stacks or individual action boundaries. Attribution to the menu click,
view disposal, a pending callback or a host cross-window operation is unknown.

The error-free first Linux session and failing second session both contain
`GPU process isn't usable. Goodbye.` in `host.log`, at 17:31:15.290132 and
17:31:35.667197 respectively, between initial launch and cold restart.
Both also log a missing temporary launcher JSON file. These messages alone do
not distinguish the failed session and do not establish a GPU or filesystem
cause. Suppressing them or changing GPU flags would be speculative.

The producer correctly failed at its final renderer-error gate even though all
31 checkpoints, including cold restart, were reached. Installed assets and
post-restart bytes matched. This eliminates missing installation and a failure
to reach restart as explanations for the reported terminal failure; it does not
establish that lifecycle cleanup was correct at every earlier instant. Plugin,
host, automation and environment causes remain unresolved.

## Diagnostic correction and next bounded work

The demonstrated tooling gap is missing error receipt timing/page identity and
phase transition history. The new
[diagnostic observer](../../scripts/testing/native-diagnostic-observer.mjs)
adds a separate `nativeDiagnostics` timeline while retaining the legacy errors
and failure gate. The driver also rechecks those errors after cleanup, closing
the prior gap where an error arriving during browser closure followed the last
error assertion. Neither original failure is attributed to that late-error gap.
The observer has no polling, delays, theme writes, event cap or deduplication.
Receipt timestamps come from the driver clock, not the renderer's throw time.
The observer remains registered during browser closure, capturing events delivered
before CDP disconnects; it cannot observe renderer errors after disconnection,
including during a later host-process stop. It removes only its own listeners
at disposal. The final host log preserves stderr already delivered during cleanup.
This improves the next failure's evidence; it does not fix or
explain either original native failure.

The [tooling regressions](../../tests/tooling/native-diagnostic-observer.checks.mjs)
exercise duplicate empty-stack errors, distinct same-URL pages, explicit phase
history, monotonic receipt times, closing errors before disposal, idempotent
disposal, foreign listener preservation and rejection of post-disposal acquisition.
They use EventEmitter page doubles to qualify observation/ownership behavior;
they are not native-host reproduction tests. Qualified Node 24.21.0 executed
`node --test tests/tooling/native-diagnostic-observer.checks.mjs`: **2 passed,
0 failed, 0 skipped**. The log is
`reports/acceptance-closure/native-diagnostic-targeted.log` in the current worktree.
Candidate qualification remains a separate execution record.

Independent review also reproduced two evidence-tool defects: supplemental
diagnostic events could contradict the canonical error list, and the generated
foundation driver overwrote its fixed report directory. The parser now validates
the optional schema, times, phases, page identities, disposal and one-to-one error
receipts; the foundation driver retains unique attempt directories and a separate
latest-report copy. Real isolated child executions with a missing provider prove
failure retention without launching or downloading a host. The pre-fix controls
failed, and all four corrected observer/parser/retention tests passed. These
corrections do not establish either historical failure's cause.

For Windows, the next separately authorized isolated diagnostic should attach
capture/bubble select events, stable select-node identity, main config/CSS events,
per-window mutation/frame observations and independent foreground sampling before
one unchanged dark/light sequence. Preserve the first outcome, all samples and
cleanup. If it fails, stop and correlate that same attempt before proposing a
runtime correction. Do not derive an idle window from an earlier session.

For Linux, use the new timeline in the next fixed-candidate qualification.
If the failure recurs, preserve its full first report and add one separately
bounded diagnostic with renderer exception details (including empty stack),
cross-window context IDs and close/unload boundaries; a plugin-free versus
plugin-enabled comparison must use the same isolated host and sequence and
retain both outcomes. Lack of recurrence in routine qualification is not cause
closure. Do not repeat until green or extend assertion deadlines.

## Raw file integrity references

Recomputed with PowerShell `Get-FileHash -Algorithm SHA256` during this read-only
investigation. Complete logs/reports remain in the retained directories above.

| File within the corresponding attempt | SHA-256 |
| --- | --- |
| Windows first `report.json` | `662b8887b65cadc5ab13b4dc44b20485de4786b55ee1d2b213b50593b0658cd6` |
| Windows first `theme-observations.json` | `b4d25b4f96ecc93b126aaae73c861168996d724442cbe3f8b7c14c74c0966a78` |
| Windows first `host.log` | `5314c5a6331c8b71ab49c4b0b065598be6ab411932e445038bdcad63cfa53b99` |
| Windows comparison `report.json` | `e53287e26d52de8cc87ac98a1b079bfa1301419b335a60beb1f6b8cb80ef719b` |
| Windows comparison `observations.json` | `c2b0008608a718982d99d68dad433a49fe2d1da969d9c249c03734fbb32609c6` |
| Windows comparison `foreground.jsonl` | `bbf6d9cadfbec2f43934698aa267d9b4baf6b9fe0ec58d6fe6a0c04e5b7a9604` |
| Linux first pass `report.json` | `49ad7e12481c52db4a4522ad334695a8f4849cdcec685e29ae3016af452f0c64` |
| Linux first pass `host.log` | `f88d0009eb662c1cae47713dcb472d24977174fe7a95e83ca2364e4f3a1357f6` |
| Linux first failure `report.json` | `8294aafd39fd317fabe6119c7a9a7bf36cf780ea58c7d8921ba4ac1b0a59dfe7` |
| Linux first failure `host.log` | `59067c4213a54dc5de9777a83800c225d4ac875c6d8ebeac57cff1cb9de99b1e` |
