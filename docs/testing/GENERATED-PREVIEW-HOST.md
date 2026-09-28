# Generated preview host — PR #35 continuation

## Scope and starting point

This is a bounded IP-05/IP-08/IP-11 increment of the [PR #5 improvement plan](../product/PR5-IMPROVEMENT-PLAN.md), not completion of those packages. It continues `feat/pr5-product-improvements` from `957bf427212ffe21fcd8fbe93d42419b6344a501`. The source archive retained by companion run `36365182498` / artifact `10946519770` identifies its pull-request merge checkout as `46dc93364033f07b234681e1e397cc790b9c6d98`; its tar SHA-256 is `c4c3fd573d8e86ec711155af3e87f5afdaeaf91f3cf37909889f2580ef7f8404`.

The existing compiler, project contracts, safe generation planner, read-only synthetic adapters and native boundaries remain in place. The change is in maintained browser-generation sources, not hand-edited generated output.

## Reproduced defects and implementation

The original generated modal function was exercised in Chromium with explicit frame doubles. A thrown frame mount left one dialog and one retained frame. Calling native `dialog.close()` left one DOM dialog and its frame, with zero frame releases. These are browser-host contract reproductions, not whole-app or native-host acceptance.

`clickdummy-host-code.ts` now emits a browser-only owner with one teardown path for the Close button, Escape, native close, parent closure and reset. It disposes descendants in reverse order, contains mount/show/cleanup failures, removes listeners and returns focus to the opener or the labelled surface control. The existing twelve-dialog bound remains. Reentrant closure during mounting releases the returned frame rather than retaining an already-closed owner.

A separate preview lifecycle owns pagehide/pageshow, reset and final disposal. The generated main frame can be recreated after page suspension rather than remaining unmounted forever. Readiness is removed on teardown and restored after a real preview mount. This recreates synthetic stores; it is not persistence of local edits or proof of real back/forward-cache behavior. Pinia disposal runs even when application teardown fails. Reset replaces its preview address rather than adding a blank history entry and returns keyboard focus to Reset preview.

The generated toolbar gains a project h1, visible focus indicators, minimum 36px control height and a 375px-friendly wrapping layout. Business-write limitations and synthetic-data labels remain explicit. This is not a visual redesign, localization completion or formal accessibility claim.

## Compatibility is checked, not discarded

`post-mvp-base-code.json` and `template-inputs.json` are unchanged. All twelve original product snapshots were verified before editing. `preview-host-delta.json` records only four intentional generated-file changes per fixture: the new browser-host module, its entry, the preview toolbar component and its stylesheet.

The compatibility test checks every new file hash first, reverses only that explicit delta, then requires the exact original aggregate digest. All other product bytes remain covered by the original snapshot. A negative control changes the new host output and proves rejection. This is a reviewed source-byte transition, not automatic acceptance of screenshot baselines or a directory exclusion.

## Verification

Supplementary local tools: Node 22.16.0, npm 10.9.2, TypeScript 5.8.3, Chromium 144.0.7559.96 and the preinstalled Python Playwright driver's JavaScript core `1.57.0-beta-1764944708000`. Local TypeScript and Node declarations were linked into an untracked node_modules; package.json and the lockfile were not changed. These tools do not qualify the repository's pinned toolchain.

| Check | Observed result |
| --- | --- |
| Original generated modal failure controls | Both defects reproduced with explicit frame doubles |
| Compatibility, emission and lifecycle tests | 26 passed; no failure, skip or TODO |
| Compiler target and documentation tests | 9 passed; overlap with the broad compiler run below |
| Emitted-host browser contracts | 12 named cases passed; zero external requests and page/console errors |
| Framework TypeScript after supplying local Node declarations | Passed; initial attempt lacked Node declarations |
| Source limits, suite ownership, compiler architecture | Passed; 293 test files, 31 suites, 32 helpers |
| Broad local compiler attempt | Failed overall: 61 passing cases, missing fallow and fast-check prevented two checks |
| Local exact file-origin host run | Blocked by Chromium policy: ERR_BLOCKED_BY_ADMINISTRATOR |

The successful local browser run used a separately identified about:blank fixture because local file URLs are blocked. It tested the actual emitted host module with source SHA-256 `226ff252aa627f2dbed6caef67f6eadb04b1e57a9604f4209f85969e59327ada`, actual HTML dialogs and explicit mounting/disposal doubles. It did not relax the committed file-origin checker. Synthetic page-transition events are labelled as such.

The earlier historical compatibility run failed as expected after implementation and before the reviewed delta was added. Those failed attempts are not passing evidence. Results from overlapping test commands must not be added into a larger pass count.

## Executable qualification

The existing compiler qualification command now runs the emitted-host file-origin contracts before independently installing, verifying and building the Quick Capture project. Its generated-file browser checker retains declared navigation and network/error rejection and additionally exercises labelled states, inert loading/disabled content, modal focus return, reset, complete canonical JSON download, deep links, simulated page restoration and narrow reflow. It retains desktop/narrow screenshots for review, not automatically accepted baselines.

With the repository's locked tools and explicitly provisioned browser:

```sh
node scripts/compiler/verify-preview-host.mjs
npm run qualify:compiler
# Or check a separately built output against its exact canonical input:
node scripts/compiler/verify-browser.mjs /path/to/clickdummy.html /path/to/design/project.json
```

`qualify:compiler` still requires QUALIFIED_NPM and retains its existing full generated-project checks. Current-head hosted results must be inspected separately. Adding assertions or retaining a screenshot is not evidence that they passed.

## Open obligations

IP-05 still needs companion-output interaction/visual parity and useful sample content. IP-06 still requires observed authoring tasks; IP-08 still requires manual assistive-technology, localization and device/native-leaf qualification. IP-09 real-host starter lifecycle, the separately gated IP-10 native companion, optional live SDK/desktop/provider acceptance and separately authorized publication remain open. Nothing here merges, publishes, tags, deploys to a personal vault or promotes pending native/business requirements.
