# Runtime authoring: Windows native diagnosis

## Result and scope

On 2026-09-23, one instrumented plugin-free three-pane session passed its real
Appearance dark/light transition. One instrumented full session passed all **24**
unchanged native checks with **zero renderer errors**, including split views,
pop-out themes and cold restart. The earlier same-byte Windows failure remains a
failure: it was not reproduced, and this comparison does **not** establish its
cause or close general Windows qualification.

These runs used retained PR #8 candidate
`4f9b3b13825c7e2fbfca414611cc7aa0143a4812`, not this runtime-authoring branch's new
implementation. They are diagnosis of a historical candidate, not native acceptance
of the new item/event workflow. No product, native driver or dependency change was
justified or made by this work package.

The [durable evidence summary](evidence/runtime-authoring-native.json) records
checks, identities, native observations, timestamps and SHA-256 hashes of complete
local reports. Full local evidence is retained under
`reports/native-comparison/{plugin-free-boot-failure,plugin-free,full}/`.
Original PR #8 evidence under `../release-operations/reports/native/` and
`native-theme-probe/` was not modified. The original failed `report.json` still
hashes to `175b8d74554478d5fc1885ce3a03880ce17062390e263e6e7245dd110aac0a72`.

## Controlled comparison

Both planned sessions used Obsidian app/installer **1.13.7**, launcher **3.2.1**,
Node **24.21.0**, Windows x64 and native 1023 × 800 windows at device pixel ratio 2.
The full host reported Electron **43.3.0** / Chrome **150.0.7871.212**. Each launch
used a new codebase-contained scratch vault and the launcher's separately validated
fresh temporary config. No personal vault was opened. No font/cache package is
included in committed evidence.

The full session copied the retained three-file candidate without rebuilding and
checked installed hashes before use and after cold restart:

| Asset | SHA-256 |
| --- | --- |
| `main.js` | `0063e7032123818bdc378672be054e6ea18c6b87a0c999526b26fea723553c02` |
| `styles.css` | `3a09390ad8f4570c6b9947bd0c9231075ae5357dbf14ade4387bc5d7ac8316e7` |
| `manifest.json` | `84c725b25a67053a3ca5652b0111270ba5e3b3d4ff7f06f870352a2ff2018380` |

The plugin-free session installed no plugin and opened three real Markdown panes.
The full session ran the existing complete native sequence: real document CRUD,
modal/debug actions, two plugin panes plus unrelated Markdown, repeated native
header toggles, Appearance, zoom, pop-out, unload/reload, settings and cold restart.
There was one full attempt. All real Appearance controls, the active-tab guard,
foreground/two-paint waits, five-second theme assertions and bounded partial-JSON /
ENOENT polling remained unchanged. Neither classes nor host theme configuration
were forced. The read-only observer introduced no awaited theme readiness condition.

Before that comparison, the first plugin-free fixture aborted **before any theme
action**: `.workspace` existed while the body was `in-progress`, and early split
creation hit a null workspace parent (`insertChild`). Its report also recorded
`NATIVE_CONFIG_CLEANUP_FAILED`; no unrelated process was terminated or config was
force-deleted. That failed attempt is retained. Only this diagnosed fixture defect
was corrected, by waiting for the public `workspace.layoutReady` with a bounded
15-second poll. The corrected plugin-free run and full run then completed with
exit 0 and no cleanup failure. A final read-only process inventory found no
Obsidian processes. This setup correction is not a theme fix or a retry of a
failed transition.

Execution used the qualified Node binary on the retained `run.mjs` in each scoped
run directory, with `--allow-download` and `GITHUB_SHA` bound to the historical
candidate. The scripts reuse the pinned local provider/cache and existing native
helpers. `reports/native-comparison/prepare.mjs`, `observe.mjs`, per-run `run.mjs`,
`execution.log` and `summarize.mjs` retain the exact diagnostic procedure. Observer
and driver hashes are in the committed evidence summary.

## Contemporaneous findings

A read-only 100-ms sampler recorded changes across all pages: body classes,
`document.hasFocus()`, visibility, computed body background, plugin-root owner
classes, real select values/options, host `vault.getConfig` theme settings and
stylesheet identities/rule counts. Mutation observers and document/native
`css-change` / `config-changed` listeners retained event timestamps. The disk
appearance file was sampled without treating missing/partial JSON as corruption.
Observers were disposed; the observation report recorded no internal failure.

| First dark-to-light transition (UTC) | Plugin-free split | Full split |
| --- | --- | --- |
| Main first sampled light | 13:01:53.856 | 13:02:52.560 |
| Host config | `moonstone` | `moonstone` |
| Main body / background | `theme-light` / white | `theme-light` / white |
| Appearance next sample | 13:01:53.861, light | 13:02:52.566, light |
| Host change observations | CSS/config events and body mutation | CSS/config events and body mutation |

In the full session, CSS-change occurred at 13:02:52.508, config-changed at
13:02:52.509 and both documents' class mutations at 13:02:52.510. The two plugin
roots mirrored the main light body. The samples on either side of this transition
were visible. The main `is-focused` class was absent while Appearance had it;
it returned after foregrounding the main window. `document.hasFocus()` reported
true in both documents, so it cannot distinguish OS foreground ownership here.
No independent Windows foreground HWND/PID trace was captured; claiming a focus
cause from these DOM signals would exceed the evidence.

The app's config changed `obsidian` → `moonstone` with the actual selection. Disk
appearance remained `{}` through the short plugin-free sample; the full sample
later observed `{ "theme": "obsidian" }` after another dark transition. Thus disk
persistence lag is observed, not used as proof that a live transition failed.
The separate Appearance renderer did not expose `window.app`; host config was
read from the main renderer, while its controls/classes were observed directly.

## Remaining blocker and next diagnostic

The original failure lacks these contemporaneous config/event/focus observations.
This passing instrumented comparison cannot determine whether the old failure
was host propagation, scheduling, driver interaction or another environment effect.
Sampling and listeners themselves can alter timing. No supported product defect
was identified, and the historical failure must not be relabeled as success.

If the unchanged failure recurs during a separately scoped candidate qualification,
retain the first failed attempt with the same per-window timeline plus an
independent read-only Windows foreground HWND/process trace and native select
change timing. Correlate the requested value, main in-memory config, CSS/config
notifications, each body mutation, frame delivery and disk persistence before
changing code. Do not add longer waits, forced classes, suppressed assertions or
repeat-until-pass qualification. New runtime-authoring candidate bytes still need
their own clearly scoped verification; macOS, physical devices and manual
accessibility remain outside this diagnosis.

## Read-only PR/dependency baseline

At this investigation, [PR #8](https://github.com/Luis85/obsidian-plugin-shell/pull/8)
was OPEN at `12d07b90e8ae370e7f9baafbd80800f46b0164e2` with all 11 current checks
successful. It was not merged or incorporated into this branch.
[PR #6](https://github.com/Luis85/obsidian-plugin-shell/pull/6) (`@types/node` 26.6.1)
remained OPEN with 10 successful checks; Node 26 declarations do not qualify a
Node 26 runtime. [PR #7](https://github.com/Luis85/obsidian-plugin-shell/pull/7)
(TypeScript 7.0.2) remained OPEN with seven failed and three successful checks.
The actual [Showcase job log](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35857321920)
reports `ERESOLVE`: `typescript-eslint@8.70.1` requires TypeScript `>=4.8.4 <6.1.0`.
No incompatible-peer override or dependency change was attempted. The
[nested ESLint support exception](../development/ITERATION-TWO-DEPENDENCY-EXCEPTION.md)
remains distinct from these checks and security audit results.
