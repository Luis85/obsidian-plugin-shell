# Earliest retained Windows failure: read-only audit

This evidence-only follow-up inspects preserved original reports, PNGs and exact
historical driver source. No host was launched and no retained evidence changed.
See the [current investigation](NATIVE-RELIABILITY-INVESTIGATION.md) for the later
Windows failure, Linux errors and bounded diagnostic follow-up.

## Original PR #8 failure

Archive root A:
`D:/Projects/obsidian-plugin-shell/.qualification/release-operations-merged-a624e28`.
Original `reports/native/report.json` was recomputed and exactly matches the
previously recorded SHA-256
`175b8d74554478d5fc1885ce3a03880ce17062390e263e6e7245dd110aac0a72`.
Its candidate identity is `4f9b3b13825c7e2fbfca414611cc7aa0143a4812`, with
Obsidian app/installer 1.13.7, launcher 3.2.1, Electron 43.3.0,
Chrome 150.0.7871.212, a 1023 × 800 native window and DPR 2.

The report failed after 16 checkpoints in `theme-transitions`: the main body
remained `theme-dark` throughout the unchanged 5-second light assertion, with
13 sampled locator mismatches. Both plugin roots were connected, owned by that
same body and dark. Dark transition had passed. The renderer-error array is
empty. No cleanup-failure field was recorded; that is original producer output,
not a new cleanup/process audit.

Crucially, the original `native-appearance-light.png` visibly shows the real
Appearance selector set to **Light** and the Appearance window itself light.
The historical driver captures that screenshot after a unique real-selector
lookup, `selectOption`, and a successful selector-value assertion. It then waits
two settings frames, foregrounds main and waits two main frames before asserting
the main body's light class. It retains the active-Appearance guard.

This differs from the 79d6688 failure's Appearance screenshot, which shows Dark.
The earliest report has no contemporaneous host-config, config/CSS-event,
per-window timestamp, independent foreground or select-node replacement trace.
There is no `theme-observations.json` or `host.log` in A's original native folder.
Thus the later failure's unchanged `obsidian` configuration cannot be attributed
to this earlier failure, nor does the shared failed assertion prove a shared cause.

The original installed JS hash is
`0063e7032123818bdc378672be054e6ea18c6b87a0c999526b26fea723553c02`, distinct from
79d6688's `d2f069...`. CSS and manifest hashes are the same as the later retained
candidate. Both source and JS identities must remain separate.

## Subsequent historical attempts, all retained

The immediate A `reports/native-theme-probe/report.json` records a plugin-free
dark/light pass, `plugins: []`, no captured renderer errors and
`processStopped: true`. It is a separate passing attempt, not an explanation of
the original failure; it lacks the later detailed event trace.

Archive root B:
`D:/Projects/obsidian-plugin-shell/.qualification/runtime-authoring-merged-2d4087e/reports/native-comparison`.
The retained instrumented attempts are:

| Attempt | Raw result |
| --- | --- |
| `plugin-free-boot-failure` | Failed before theme actions, 0 checkpoints, `getUnpinnedLeaf` / null `insertChild` during early split creation; body still `in-progress`; `NATIVE_CONFIG_CLEANUP_FAILED` retained |
| `plugin-free` | 2 dark/light checkpoints passed, no renderer errors or cleanup failure recorded; corrected fixture waits for public `workspace.layoutReady` before creating splits |
| `full` | 24 checkpoints passed, no renderer errors or cleanup failure recorded; original PR #8 candidate and installed assets retained |

Actual `observations.json` shows main `moonstone`/light at
13:01:53.856 UTC in plugin-free and 13:02:52.560 UTC in full. The full trace records
CSS at 13:02:52.508, config at 13:02:52.509 and body mutations at 13:02:52.510.
No independent foreground trace exists for those attempts. The fixture-readiness
correction explains the separate pre-theme setup failure only; it is not a theme
fix. Neither later pass reproduces the earlier failure or establishes plugin,
host, automation, focus or load as its cause.

Narrow eliminated explanation: the earliest original's Appearance screenshot
does not show an unchanged Dark selector/window; both plugin roots also followed
their actual dark main owner body, so a plugin-only stale class is not the whole
observed failure. Missing callback/event/config evidence leaves transient
propagation/reversion and cross-window scheduling unresolved.

## Recomputed hashes

Paths for B are relative to each attempt's `reports/native/` directory.

| Root/file | SHA-256 |
| --- | --- |
| A original `reports/native/report.json` | `175b8d74554478d5fc1885ce3a03880ce17062390e263e6e7245dd110aac0a72` |
| A original `reports/native/native-appearance-light.png` | `39013b64c822e94feec0d689fe9d66fb441492b8efa09016dea4fb9713a179d1` |
| A original `reports/native/native-failure.png` | `d0339139f3690da50131ed70bf4b92c082e94c679a84edf2bc6f9fdc78c00848` |
| A original `reports/native/theme-controls.json` | `368a23dc27f934671f1cb442f2931672a46d085e1fa46f4fb33d1f73ce44b77a` |
| A immediate `reports/native-theme-probe/report.json` | `42f76ead7b0be3946e98a5eb3fbde9dc93cefa414ce638d556b1fbac77d50084` |
| B boot-failure `report.json` | `7e9ea6be078e2dc3b26b266b20fefbe74b16e630372138a056d9c7f64f5b4c5c` |
| B boot-failure `observations.json` | `73312520f3ff7b4c975675317f561a85357cb5512d9b6f9093b35abbf14969e7` |
| B plugin-free `report.json` | `ef06f0db954006afcf418907fe56967ac37a8236d244e5237496a2b3ff0fc43b` |
| B plugin-free `observations.json` | `05a3c37846333cdad96fea0c1cf7f59df1dbe42f10cb4c452bd65dbc717b0fdb` |
| B full `report.json` | `676bcc6b1cc29937317656dcebcbcc70352868e1cca0ea5923ad7acc4a75532c9` |
| B full `observations.json` | `523296e2996d4f199ab4897de185f25ae002b669819651fc31e468ba469c00fc` |
