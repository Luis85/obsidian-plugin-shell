# Companion concept: cross-product audit and improvement pass

**Date:** 2026-09-24. **Target:** PR #5, `docs/companion-plugin-prd`.
**Inspected baseline:** `a27dc75102ea2832e723fe66abdca6bf4e67eff5`, obtained from its independently archived CI merge snapshot `1707a9d52c67a6f86ecdbbd529c85fcfb90ab145`.

## Verdict and decision

Keep the existing concept and its single-vault information architecture. The useful product loop is already present: describe an outcome, model the plugin, review generated contracts, exercise isolated test data, and prepare the development workspace deliberately. Another feature expansion or visual redesign would not address the most consequential findings.

This pass strengthens **truthful guidance, recovery before data loss, keyboard continuity and readable review states**. It does not make the companion a native plugin. It does not promote simulated build/test results to real evidence, make a database port a SQL engine, or convert a style guide into automatic component-token binding.

Eighteen findings below have implemented corrections. This is an expert inspection and regression pass, not observed research with representative users. Product desirability, time-to-first-success and commercial viability are hypotheses until tested with developers.

## Evidence and method

The source archive digest was verified before extraction. Fresh baseline captures covered the welcome screen, example overview, PRDs, sitemap, entities, data sources, test data, design system, components, preparation and preferences. Additional browser probes reproduced the reset race, incorrect review routing, skipped palette result, lost operation focus and incomplete contrast disclosure.

The candidate was then exercised with actual browser clicks, keyboard input, DOM/geometry observations and explicitly identified canonical-state fixtures. The maintained suites rerun the existing editor, graph, content, generation, recovery and export contracts. The new `companion-product-audit.browser.py` records each assertion and current-artifact screenshots. `companion-storage.browser.py` separately exercises actual loopback-origin Storage and two windows; an injected Storage adapter is never described as equivalent evidence.

The final artifact identity, command results and limitations are in [PRODUCT-AUDIT-VERIFICATION.md](PRODUCT-AUDIT-VERIFICATION.md). Screenshots and raw reports are generated under `reports/concepts/` and uploaded by the existing Companion verification workflow. They are output artifacts, not manually maintained source images. Prior review reports keep their own dated scope and counts.

## Journey review

| Step | Task inspected | Health after this pass | Evidence / remaining limit |
| --- | --- | --- | --- |
| 1 | Enter the empty one-vault workspace | Clear design-first starting point; keyboard users can bypass the shell | Fresh capture and skip-link input checks; installation is simulated host context |
| 2 | Understand the example project and next action | Improved: missing requirements and advisory findings are visible | `02-overview.png`; optional guidance does not block source review |
| 3 | Capture requirements and traceability | Retained; outcomes take precedence over an apparently ready scaffold | Existing PRD/editor checks; mapped requirements are not implemented requirements |
| 4 | Shape screens, containment and navigation | Retained; no graph feature removal or geometry rewrite | Existing sitemap/graph/editor suites; large-world routing remains bounded best effort |
| 5 | Model entities and source operations | Improved cross-editor orientation and repair links | `05-sources.png`, stage/routing checks, existing entity/source suites |
| 6 | Compose reusable components | Retained contracts, content and variants; introductory copy now describes plugin interfaces | Existing component, reference and variant suites; preview is not a compiled production component |
| 7 | Define and export a design system | Improved: incomplete default-pair checks are explicitly disclosed in UI and exports | `07-palette-coverage.png`; arbitrary palette accessibility is not certified |
| 8 | Configure and try isolated test data | Improved focus, cancellation, busy states and bounded status announcements | `06-test-data.png`, interaction checks and executable Node test-kit tests; no live-source fallback |
| 9 | Review preparation and the test target | Retained reviewed/additive preparation; actual old target appears consistently | Target-review checks and existing single-vault suites; browser preparation remains simulated |
| 10 | Learn the workflow | Improved: all eleven tour steps are reachable, including source, style and test-data work | `08-tour.png`; tour may initialize camera layout but does not change the generation fingerprint |
| 11 | Recover and continue safely | Improved: export either copy, and refuse destructive reset from a stale session | `03-modal-feedback.png`, `04-recovery.png`, controlled and separately required actual-origin storage checks |

Candidate screenshots also cover the overview at 1440px dark, 960px light, 560px dark and 390px light. They establish these layouts, not universal mobile support. At narrow widths the primary next-step action now follows the explanatory copy instead of compressing it into a tall sliver.

## Implemented findings

P1 denotes a credible data-loss or recovery risk; P2 denotes significant task, feedback or accessibility friction; P3 denotes clarity/consistency. These are prioritization judgments, not an automated compliance score.

| ID / priority | Reproduced issue and consequence | Implemented correction and owning seam |
| --- | --- | --- |
| PA-01 / P1 | Reset from a stale window removed a newer retained snapshot even though normal saving already refused to overwrite it. | `state-safety.js` compares the current raw snapshot before reset, keeps both copies on conflict and explains recovery. Tests distinguish conflict prevention from actual removal failure. |
| PA-02 / P2 | Recovery export was discoverable primarily after failure, and the current session was the only accessible copy. | Preferences and the palette expose session export proactively. During a warning, Preferences/reset also expose the exact retained browser bytes, including unsupported or malformed data, without parsing, importing or modifying them. |
| PA-03 / P2 | Unexpected-interaction guidance suggested reset as a recovery action. | Advice now points to exporting through Preferences before reload. Reset remains a separately confirmed destructive action. |
| PA-04 / P2 | Notifications for actions blocked by an open native dialog appeared in the inert/dimmed background. | `workbenchNotify` places escaped text in the active dialog layer with polite status semantics and no focus move; non-modal notices retain the shell toast. |
| PA-05 / P2 | Replacing the operation panel lost selector/button focus and could strand keyboard users. | `tdPaintSimulation` uses the existing stable focus helpers, restores the same control, falls back to Cancel/Run as appropriate, and does not steal focus from outside the panel. Result scrolling is retained. |
| PA-06 / P2 | A large result payload doubled as a live status announcement. | A stable, separate live region reports running, completed, cancelled or failed. The result remains a named, focusable content region, not a JSON live announcement. |
| PA-07 / P2 | Operation/input controls remained editable during an in-flight test, creating ambiguous execution context. | Busy controls are disabled, the edit handler guards operation changes, and cancellation remains available. No automatic live retry is introduced. |
| PA-08 / P2 | Overview displayed no structural blockers while hiding advisory findings present in its underlying model. | Review attention now shows blocking/advisory totals, text severity, actionable first findings and a complete-list route. A bounded list explicitly discloses truncation. |
| PA-09 / P2 | An example with zero requirements recommended preparing source and displayed a misleadingly neutral 0/0 mapping count. | Next-step guidance recommends a testable outcome; traceability says no active requirements. This is not a new generation gate. |
| PA-10 / P2 | Entity/source and acceptance issues used generic or wrong editor destinations. | Prefix-specific semantic/source routing and requirement-first routing precede generic component matching; node-specific and unknown-issue fallbacks are retained. |
| PA-11 / P2 | Added workspaces lacked an active step in the overarching workflow. | Sources/entities belong to Structure, Design System to Compose, Test Data to Review, and preparation/capabilities to Prepare & build. The five-stage model stays intact. |
| PA-12 / P2 | The six-step tour no longer represented the expanded product. | An eleven-step tour covers outcomes, screens, entities, sources, components, styles, test data, preparation, quality and recovery. Persisted tour indices validate against its declared length rather than a stale constant. |
| PA-13 / P2 | Arrow Up from the palette search skipped the last result. | Initial and subsequent selection use separate handling; both directions and an empty result set are checked. |
| PA-14 / P2 | Repeated shell navigation had no first-tab bypass. | A visible-on-focus link transfers keyboard focus directly to the workspace without creating data. |
| PA-15 / P2 | In a 390px pane the next-step action squeezed explanatory copy into a narrow column; advisory labels also competed for width. | The narrow workflow layout uses a two-column icon/text grid with the action below; advisory text and its action have deliberate grid placement. Tests assert reading width as well as absence of overflow. |
| PA-16 / P2 | Removing a default color key silently removed its contrast pair, leaving only passing results visible. | UI, Markdown and HTML disclose exactly which default pairs were not evaluated. Complete coverage still explicitly excludes full accessibility certification. |
| PA-17 / P2 | Retained target copy assumed every nondefault project used `.dev-vault`. | The test-data banner, confirmation and success notice name the actual previous target. The reviewed change remains declarative; no existing files are moved or deleted. |
| PA-18 / P3 | The component introduction described generic websites/applications rather than the plugin task. | Copy now describes reusable plugin interfaces, screen placement, content and shared variants without changing the catalog. |

## Cross-product perspectives

| Perspective | Assessment / decision | Qualification still required |
| --- | --- | --- |
| Product value and scope | Preserve the design-to-review loop and optional shell-first entry. No additional subsystem in this pass. | Observe developers reaching a first useful reviewed plugin design; compare against a shell-only workflow. |
| Onboarding and information architecture | Improved outcome guidance, complete tour and coherent stage mapping. Existing single-project identity stays visible. | First-use tests without facilitator assistance; distinguish authoring vault from target-plugin test vault. |
| Interaction and visual design | Retain the established theme, spacing system and editor metaphors. Fix observed narrow composition and continuity rather than reskinning. | Long sessions, dense real projects, zoom/text scaling and unusual host layouts. |
| Accessibility | Improve bypass navigation, modal feedback, focus after asynchronous redraw and bounded status. Missing contrast checks are visible. | Assistive-technology testing, every interaction state, physical touch and authored-token combinations; no WCAG conformance claim. |
| Requirements and domain semantics | Keep requirement mapping, entity relationships and data movement distinct from implementation, navigation and containment. Repair links point to owning editors. | Native domain/adapter contracts, real migrations and production business behavior. |
| Developer experience and generation | Preserve source review, ownership/conflict checks and stale-plan invalidation. The template remains usable independently of the companion. | Compile generated implementations, integrate shell services and dogfood the native companion only after shell prerequisites. |
| Data integrity and recovery | Close the observed stale reset path; expose both recoverable copies, not only the current one. | Raw localStorage read/check/remove is not atomic cross-process CAS. Safe re-import/merge is not implemented. Unsaved modal drafts are outside session exports. |
| Security and privacy | No new dependencies, external requests, credential collection or production source calls. Retained exports are explicitly private. | Native secret handling, process execution and source installation need separate review. User-authored text can itself contain sensitive information; exports are not guaranteed sanitized. |
| Performance and resource use | Do not rebuild graph algorithms or vendor bundles speculatively. Keep bounded finding lists and localized simulation redraw. | This pass does not claim measured throughput or maximum-scale improvements. Profile large graphs, histories, fixtures and repeated native view lifecycle. |
| Quality and maintainability | Keep source modules authoritative, deterministic assembly and exact inventory. Extend existing focus/field seams, and register the new regression suite in the maintained runner. | Root maintainability/coverage/tooling gates must pass independently on the qualified CI toolchain. The legacy compact prototype renderers are not a new production architecture. |
| Operations, support and release | Separate simulated evidence, actual test-kit execution and real browser-storage evidence. Recovery guidance does not recommend deleting data. | Host/device acceptance, installation/update/unload behavior and marketplace preparation remain later gates. |
| Licensing, localization and compatibility | No font binaries, vendor bytes, lockfile or license changes. Workbench remains English-only and host-inspired, not real host theming. | Native accessibility/localization, any selected font's distribution rights, third-party attribution and supported host/platform matrix before publication. |

## Follow-up gates, in order

1. **Shell qualification first.** Prove standalone setup, makers, shared service contracts, safe document creation, error/notification boundaries, deterministic generators and the independent verification scopes on the supported toolchain. Do not use concept screenshots as shell acceptance.
2. **Companion conversion after prerequisites.** Build the actual companion on that shell; introduce native vault persistence and lifecycle-owned views through existing contracts. Migrate data explicitly, preserve raw unsupported state, implement safe import/recovery, inject development adapters deliberately, and test source-root/test-vault boundaries with actual temporary vaults.
3. **Native product acceptance.** Run representative-user tasks, assistive-technology checks, realistic-scale profiling and device/platform tests. Prove generated source compiles and fixtures reach the intended consumer. Define the supported source capabilities rather than claiming universal SQL/query fidelity.
4. **Publication last.** Qualify packaging, licensing, support/documentation and update/recovery behavior. This audit does not authorize a tag, release, listing submission or main-branch merge.

## Guidance used

The audit's fixes are grounded in observed repository behavior. The following primary guidance informed the acceptance criteria, rather than substituting for execution:

- [WAI-ARIA APG: Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) — active-layer interaction and keyboard focus.
- [WCAG 2.2 Understanding: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) — concise, programmatically determinable status without unnecessary focus changes.
- [WCAG 2.2 Understanding: Bypass Blocks](https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html) — a way around repeated navigation.

These references are not an accessibility certification, legal opinion or substitute for native testing.
