# Storymaps improvement and polishing pass

**2026-09-25 · Browser concept; baseline `851c7ff0e44b7a5da36fbe0e956d4bf5282cf35d`.**

## Scope and evidence

Reviewed the existing Storymaps overview, PRD entry, map editing, references, history, archive lifecycle, project transfer and the newer Page/Component integration. This pass preserves the incumbent workbench, pinned Vue Flow/Vue/Pinia runtimes, generator, detail editors, single-vault model and full-project **format 3 / design schema 3**. It is not native conversion or a new design system.

The review used the current source and an exercised desktop/narrow browser flow, not old feature screenshots alone. Baseline captures cover overview, map, selection, editing and narrow Outline. One batched implementation inspection and a corrective confirmation covered Map, Review, Outline, editing, repeated creation and overview at 1440, 960 and 390 CSS pixels. Review was performed in-thread, not by an independent researcher. Customer interviews, real assistive technology and native device trials were not performed.

## Findings and disposition

Priorities describe product defects, not security vulnerability ratings. All rows below are addressed in this increment's stated scope; the deferred qualification section remains separate.

| ID | Priority / perspective | Finding | Resolution and observable evidence |
| --- | --- | --- | --- |
| SP-01 | P2 / task focus | An empty inspector consumed the map's horizontal space. | Start with Details closed; selecting a card opens its inspector. New browser assertion checks the initial collapsed state. |
| SP-02 | P2 / findability | There was no search within a saved map. | Search title, description, acceptance, activity/step context and linked artifact names. Real typing does not change the Vue Flow mount serial or canonical document. |
| SP-03 | P2 / scope review | Release and design gaps could not be isolated. | Combine release and advisory filters; exact named results locate stories. Outline retains ancestor context; clear filters restores the full experience. |
| SP-04 | P2 / orientation | Selection could disappear from filtered content without explanation. | Retain selection and explain when it is outside results. Fit/Locate remain explicit operations. |
| SP-05 | P2 / delivery interpretation | The map lacked a dedicated way to review an intended release. | Review shows outcomes, story/step scope and named empty steps with an explicit not-a-completion-score label. It writes no authoring fields. |
| SP-06 | P2 / repair flow | Missing context, references and acceptance intent were difficult to locate. | Derived findings open exact saved records; empty structures directly open activity/step/story creation. Browser checks exercise the creation path and exact target. |
| SP-07 | P2 / repeated input | Each new story required reopening creation and selecting context. | Save & add another commits one story and opens a clean next draft with the same step/release, without copying content or links. |
| SP-08 | P2 / keyboard and validation | Fast submission and field-specific error recovery were inconsistent. | Ctrl/Cmd+Enter saves only the active Storymaps form; removal/discard dialogs and IME/repeated events are excluded. Invalid titles receive focus and accessible error state; correction clears that state. |
| SP-09 | P2 / keyboard continuity | Saving or closing details could lose meaningful focus. | Save focuses the saved item; closing Details restores the toolbar button. Browser tests assert actual focus identity. |
| SP-10 | P2 / requirement traceability | Requirement references were passive and earlier PRD filters could hide their targets. | Qualified PRD/requirement IDs resolve the exact target, clear a hiding filter and focus its control. They never copy or edit requirement content. |
| SP-11 | P2 / return navigation | Following a reference lost the map's review context. | Back to storymap restores selection, representation, filters and scroll. PRD/sitemap round trips and the retained Page-editor return path are exercised. |
| SP-12 | P2 / reference selection | Long requirement lists were difficult to search without losing track of selections. | Separate searchable picker and selected-outside-search count; searching is excluded from dirty-draft detection and never prunes references. |
| SP-13 | P1 / lifecycle integrity | Archive blocked cards but not every metadata/link entry point. | A central transaction invariant rejects archived content/deletion/link changes; explicit Restore remains available. PRD choices and review repair controls are disabled for archived maps. |
| SP-14 | P1 / state integrity | Invalid normalized dates could pass the timestamp check. | Require canonical ISO round-trip equality. Impossible dates and 24:00 are rejected; a valid leap-day fixture remains accepted. |
| SP-15 | P2 / feedback correctness | A stale form error could persist on the page after the draft was discarded. | Scope form and page errors separately. The browser verifies no misleading retained-draft page message after discard. |
| SP-16 | P2 / paused work | Some mutation controls looked actionable during blocked operations. | Pause metadata/add/history controls consistently; canonical guards remain authoritative. Controlled active-run UI and test-data command fixtures are explicitly labeled. |
| SP-17 | P3 / interaction cost | Layout repeatedly filtered every story cell; drag previews recalculated complete geometry. | Index activity columns and story cells once per layout; reuse the gesture's captured layout. Tests reject hidden recalculation and prove deterministic results without persisted coordinates. |
| SP-18 | P2 / drag reliability | Opening details at drag start could shift the gesture's coordinate frame. | Select without opening details at drag start. Semantic commit, one-step history and cancel behavior are retained. |
| SP-19 | P2 / responsive and content | Overview tables, long outcomes and reference controls constrained narrow use. | Narrow labeled rows, wrapping references, expanded long outcomes and measured modal footers. Batched geometry checks cover 1440/960/390px, including all repeated-entry footer actions. |
| SP-20 | P2 / contract documentation | Storymaps documentation still described format v2 and could imply the whole shell was read-only. | Describe current format v3, unchanged legacy support and the separate inspection/scaffolding commands. Native conversion impact remains planned, not marked complete. |

## Architecture and compatibility

`storymap-review.js` contains renderer-independent reference indexes, search, release summaries and findings. These functions return derived values without mutating input. Vue Flow remains a controlled projection; array ordering and parent/release identities retain their meaning outside the renderer. Cards and non-drag forms use the same command/validation path.

No new persisted Storymaps fields or schema version are required. The golden self-project changes **three existing Storymaps acceptance strings only** to describe the improved interaction contract. It retains 27 surfaces, five PRDs, 30 requirements, 54 library definitions, 11 entities, the existing map and the three existing detail designs. The map data and detail-design data remain equal to the baseline.

The exact source inventory increases from **127 to 128** for the one new registered module. The boundary test requires the new exact count; orphan detection and production thresholds remain intact. No dependency, vendored runtime, package lock, production runtime or normal workflow policy changes are part of this pass.

The read-only `companion:generate` still returns original bytes. The separately implemented `companion:scaffold` generator still plans/applies reviewed scaffolding, retains the full authored document and marks business acceptance as implementation work. Neither review findings nor storymap links grant execution authority or prove generated application behavior.

## Verification receipt

Final HTML: **1,759,627 bytes**, SHA-256 `51d8add72f8755052a62abb29eeda2cc684610ab602ec43c442c01eb3de3dcc3`.

Final companion JSON: **182,156 bytes**, SHA-256 `5457bea193bcd24a16b5a0d9b5dca00755755f5a6cdfa6f24116049e2455c3f8`.

The following completed checks refer to the final HTML and saved project example above. Counts refer to one complete execution per scope and are not added across iterations. Named browser assertions include actual controls, geometry and model readback plus explicitly labeled concurrency/guard fixtures; they are not all independent end-to-end journeys.

| Local check | Result |
| --- | --- |
| Complete non-storage browser regression | **1,097 named assertions in 20 suites passed** |
| New Storymaps polishing browser suite | **54 named assertions passed** |
| Retained Storymaps browser suite | **60 named assertions passed** |
| Detail / full-project / Storymaps / read-only CLI / test-data tooling | **143 tests passed**, including **48 Storymaps tests** (15 new) |
| Project generator | **30 tests passed** |
| Assembly / inventory / tamper rejection | **12 tests passed** |
| Syntax only | **96 authored JavaScript modules and 32 concept Python files parsed** |

The new and retained Storymaps suites are included in, not added to, the complete browser regression recorded in the delivery comment and raw summary. Four dependency-backed boundary probes were attempted locally but could not obtain analyzer output because `node_modules/fallow/bin/fallow` is absent. They are not counted as passes. The source inventory/assembly checks remain independent and do not substitute for the hosted analyzer/lint/type/coverage gates.

The new browser evidence is under `reports/concepts/storymap-polish/`; the complete runner produces `reports/concepts/browser-summary.json` with the exact HTML hash and each suite's raw report. It rejects missing/stale reports, failed assertions, page/console errors and unexpected requests. The new suite is in the existing normal CI runner, rather than an optional manual check.

Local Node 22.16.0/Python/Chromium results supplement, not replace, the supported hosted Node/npm matrix. Local browser Storage is the declared in-memory adapter. Actual-origin Storage was attempted separately and stopped at loopback navigation with `net::ERR_BLOCKED_BY_ADMINISTRATOR`; zero actual-origin assertions were obtained locally. Browser policy was not bypassed. Hosted real-origin and dependency-backed gates are tracked against the actual pushed PR head, not inferred from local checks or the previous head's green jobs.

## Qualification remaining

Native Obsidian persistence/Markdown codecs, physical touch/pen devices, screen readers, formal contrast/WCAG conformance, maximum-scale browser profiling, immutable historical component versions and concurrent native windows remain separate gates. A deterministic 500-story model test and avoiding repeated layout work do **not** establish a 500-card rendering performance guarantee. No real-time collaboration, remote synchronization, automatic story generation or native publication was added.

Archive is a guarded authoring state, not an access-control/security boundary. Shared project Undo/Redo intentionally restores historical design state, including archive transitions. The browser concept's existing global assembly is retained; native conversion must use typed domain/services, not import concept globals as a production implementation.

## Reproduce

```sh
python -B scripts/concepts/build-companion.py --check
python -B tests/concepts/companion-assembly.test.py
node --test tests/tooling/companion-details.checks.mjs tests/tooling/companion-project.checks.mjs tests/tooling/companion-storymaps.checks.mjs tests/tooling/test-data-*.checks.mjs
node --test tests/tooling/project-generator.checks.mjs
CHROMIUM_EXECUTABLE=/path/to/chromium python -B scripts/concepts/run-browser-checks.py --real-storage
```

Use the repository's supported Node/npm toolchain for hosted/root qualification. The last command requires permitted loopback browser navigation. Local Node 22 required `--experimental-strip-types` for the generator command. Complete root/template workflows remain necessary beyond these focused commands.

## Primary implementation references

- [Vue Flow controlled changes](https://vueflow.dev/guide/controlled-flow.html): intercept changes and apply the allowed projection; isolate this API because its default behavior is documented as changing in a future major version. No version upgrade was performed.
- [Vue performance guidance](https://vuejs.org/guide/best-practices/performance.html): reduce unnecessary updates and profile representative workloads. The implementation uses scoped derived indexes and mount-stability regression checks, not an unmeasured FPS claim.
- [W3C dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html): retain single-pointer non-drag alternatives through Move controls; keyboard operation is also tested. These checks do not establish full WCAG conformance.
