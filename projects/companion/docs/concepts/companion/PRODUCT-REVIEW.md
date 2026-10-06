# Companion concept: product review and polishing pass

Reviewed PR #5 at `b79605eb1f8694770078126b33e79a118448dc8a` on 2026-09-23. This review covers the PR's companion requirements, standalone browser concept, source assembly, current browser evidence and integration with the repository's quality gates. It does **not** turn the concept into an installable companion or replace the existing CLI.

## Verdict and priorities

The container/screen distinction, reviewed connections, independently arranged sections and reusable component model are worth retaining. The baseline's 64 container checks passed in the review environment. However, passing that suite did not cover recoverability, no-op transactions, persistence failure, maximum-size content or integration with the production analyzer. Those gaps produced reproducible defects, not just aesthetic preferences.

This pass prioritizes preservation of authored information, truthful feedback and reliable everyday edits. It avoids another redesign, another graph database, migration of existing surface identities or changes to native plugin runtime/dependency pins. The broader repository checks must be read on the final PR commit before merge: the original template-authoring failure was a real integration blocker.

## Findings and implemented corrections

Severity is assessed for this browser concept: **P1** blocks safe use/integration or risks losing retained work; **P2** breaks a normal task or gives misleading feedback; **P3** is maintainability or polish. The references below identify source responsibilities and observable checks rather than claiming every assertion is a physical-pointer task.

| ID | Severity / perspective | Baseline problem and consequence | Implemented correction and evidence |
| --- | --- | --- | --- |
| R01 | P1 · architecture / delivery | The template-authoring workflow stopped at `ARCHITECTURE_FAILED: 47`; every authored concept JavaScript file was outside Fallow's required boundary coverage. A docs-only description did not make executable JS exempt. | An isolated `companion-concept` zone, 48 exact assembled entry files and import rules in both directions. No production rule or threshold is relaxed. The builder checks assembly/analyzer inventory equality. Three real-analyzer fixtures guard coverage and prohibited imports; final pinned execution belongs to CI. |
| R02 | P1 · input recovery | Pasting invalid JSON and choosing Import redrew the textarea from the saved model, discarding the user's pasted draft. | A retained import draft survives parse/schema errors, redraw, export and Keep editing. The field receives focus and an associated error. Safety checks verify exact pasted bytes and unchanged canonical state. |
| R03 | P1 · stale transaction | Import review did not bind the complete current outline. A review could overwrite changes made after it opened, including changes outside the semantic revision. | Review binds owner, revision and the complete design snapshot. Apply refuses stale input before recording undo or replacing data. The user retains the pasted text for recovery. |
| R04 | P1 · data retention | Repeated saves could overwrite a newer browser snapshot written by another window, without explaining that local edits had diverged. | Compare against the last accepted storage snapshot before writing, observe browser storage events, block an observed conflict and retain the local in-memory session. Offer an explicitly labeled recovery export. Controlled-store checks pass; the separate real-origin suite tests actual multi-page storage events in CI. This is not atomic locking. |
| R05 | P1 · persistence / feedback | Quota, unavailable storage and oversized state could leave the user without immediate actionable feedback. Reset could imply that data was removed when removal failed. | Immediate live status, visible recovery action, save-size bound, last-good snapshot preservation and explicit failed-reset behavior. Successful reset removes only the concept key. Failure fixtures verify both retained memory and retained bytes. |
| R06 | P2 · first-use success | A new Settings surface displayed the Form layout while its draft model contained Single. The first Save could fail although the visible selection appeared valid. | Initialize the draft with the same Form layout displayed by the control. A browser test creates and saves Settings on the first attempt. |
| R07 | P2 · task efficiency | Saving an unchanged surface could create undo history and invalidate a reviewed source plan because optional defaults differed structurally. | Compare a normalized editable identity before applying. A no-op leaves model revision, history and the reviewed plan unchanged. |
| R08 | P2 · connection consistency | Legacy connections without explicit optional defaults could acquire an artificial semantic revision when opened and saved unchanged. | Normalize connection-edit identity without migrating canonical data merely to compare it. The no-op connection check uses a legacy-shaped fixture. |
| R09 | P2 · graph reliability | Camera pan and world-position limits were conflated. Focusing a valid card near the world limit could make the saved canvas invalid and reset arrangement. | Separate world bounds from camera bounds. Clamp the raw camera before validation; use the same camera policy for Vue Flow viewport events. Boundary-focus and repeated-zoom checks preserve positions, sections, anchors and the source fingerprint. Invalid/non-finite world positions still fail. |
| R10 | P2 · reviewed connections | Semantic revision alone did not detect a caption/anchor change while reconnection or structural removal was being reviewed. | Capture the actual reviewed edge/anchor snapshot and refuse intervening changes. Existing endpoint dragging, Save/Cancel/Undo and child-owned structural identity are retained. |
| R11 | P1 · import integrity | Inherited Object properties could satisfy enum lookups; a typed edge could impersonate the `contains-` structural namespace; unsafe numeric IDs could corrupt future allocation. | Own-property enum checks, nonempty/nonstructural typed-edge IDs and bounded safe-integer counter derivation before mutation. Negative fixtures assert rejection and unchanged model/history. Imported markup remains inert text in the exercised UI. |
| R12 | P2 · content limits | Duplicating a maximum-length label could create an invalid name. Copying populated content could exceed the 400-block persistence limit. | Build and validate a candidate first, reserve fresh block identities, bound the label and reject capacity overflow before changing counters/history/content. Successful copies remain independent and undoable. |
| R13 | P2 · keyboard / loss prevention | Import text and structural-detachment choices were not included in the shared dirty-form safeguard. | Track both forms. Close and Escape require a deliberate discard decision; Keep editing retains the draft. Saved-blueprint export no longer closes or destroys the import draft. |
| R14 | P2 · narrow-pane access | The new longer warning exposed an existing fixed-height shell assumption: a wrapping footer pushed recovery controls below a narrow viewport. | Use a flex-column shell with a flexible main frame and nonshrinking bars. Let the warning wrap, keep the recovery action visible and hide lower-priority footer details on small panes. Screenshot review and bounding-box assertions verify full visibility at the exercised narrow width. |
| R15 | P3 · responsiveness | Identical snapshots were rewritten to browser storage during repeated renders/camera events. | Avoid writes when serialized state equals retained state. This reduces redundant writes; it is not a measured whole-application performance claim. |
| R16 | P1 · verification reliability | Ordinary concept CI checked assembly and syntax, while browser success lived in historical reports. A stale or absent report could be mistaken for current evidence. | Add an explicit suite runner, exact HTML identity checks, nonempty named assertions, failure/error/request checks, retained logs and read-only browser CI. Five negative assembly tests reject extra inputs, missing analyzer entries, vendor tampering and stale output. |

## Cross-product assessment

### Product intent, information architecture and scope

The core job is still to help a developer outline a plugin and operate the existing template workflow from an understandable workbench. Native views remain entry containers carrying host layout and placement; screens and organizational groups remain different concepts. Visual sections organize the canvas without silently changing ownership or source-generation inputs. Stable code names remain independent of later display-name edits, with deterministic suffixes for collisions.

The pass retains the component catalog, PRD requirements, source-plan previews, setup simulation, guided tour and library/content workflows. It does not replace the large concept with a smaller unrelated demo. The concept's script catalog is a dated illustration, not live interrogation of today's CLI. The README now explicitly separates current evidence from old iterations and points reviewers to one reproduction command.

### Interaction design, accessibility and error recovery

Review-before-commit, valid alternatives to orphaning screens, discard protection, explicit export identity and immediate failure feedback take precedence over additional toolbar controls. Connection editors continue to offer a non-drag path to changing endpoints/anchors. W3C's dragging guidance requires a single-pointer non-drag alternative; keyboard support alone is not equivalent to that requirement [1]. Keeping the editable dialogs is therefore important, not merely redundant UI.

The reviewed import path now connects the invalid field to its error, focuses it and retains the user's input. Storage warnings use a live status role, and the recovery action remains reachable in the tested narrow viewport. Screenshots were inspected for failed-import recovery and narrow-pane storage recovery. This is focused accessibility work, **not** a full WCAG audit: screen-reader announcement quality, contrast in every state, 200–400% zoom, complete tab-order coverage and physical touch/pen behavior still need dedicated qualification. Existing reduced-motion handling is retained rather than duplicated.

### Security, privacy and data lifecycle

The app still executes no imported blueprint code, downloads no template, runs no shell command and touches no personal vault. Recovery is a local user-requested download, not telemetry. Import parsing now rejects additional ambiguous identities before mutation. Current browser checks observed no runtime requests or page/console errors along their exercised routes.

A recovery export contains the current committed in-memory concept state and may include private entered paths, notes or requirements. It is labeled accordingly and is neither an installable plugin nor evidence of production verification. It does not include unsaved modal drafts; those are protected in their editing context. Invalid/future stored data remains preserved until an explicit reset rather than being silently overwritten.

Cross-window conflict detection has a deliberate limit: localStorage read/compare/write is not a transaction. Simultaneous races are still possible. A production companion should use its host persistence contract, versioned writes, documented conflict resolution and migration/recovery tests rather than copying this browser-demo mechanism as a guarantee.

### Architecture, maintainability and developer experience

The concept remains a concatenated set of browser-global fragments with a real Vue Flow island, not a fully modular production Vue application. Changing that architecture during a polishing pass would risk unrelated regressions and blur the prototype/implementation boundary. Instead, this pass makes its actual entry inventory explicit and fail-closed while isolating it from production zones [2]. The new persistence code has one named responsibility, and pure comparison/validation helpers make transaction decisions easier to test.

The generated HTML is rebuilt from readable sources. Vendor code, licenses, root npm pins, lockfile and production runtime are unchanged. Exact output and source inventory checks prevent an independently edited HTML from silently drifting away from its source. Five existing browser scripts accept a selected Chromium executable so CI can use Playwright's provisioned browser rather than relying on a machine-specific `/usr/bin/chromium`.

### Quality, performance and release readiness

The local current suite passed **270 named concept assertions on one exact HTML**: 223 retained current assertions and 47 new regression assertions. Counts include controlled-state, model, geometry and synthetic-event fixtures; they are not 270 independent user journeys or 270 physical-pointer tasks. Five assembly rejection tests and 48 JavaScript syntax checks are reported separately. Real browser storage and the pinned Fallow analyzer require their separate CI evidence [3]. Older suites targeting superseded UI controls are not silently added to the total.

Large-coordinate behavior and redundant storage writes improved. No numerical claim about frame rate, startup latency, large-graph scalability or memory reduction is made. Dense graphs can still cross when users choose fixed anchors. Existing full graph rerenders/global mutable state and hard concept capacity limits remain future implementation considerations.

**Merge and release are different decisions.** This pass can close reviewed concept defects once final CI succeeds. It cannot establish native Obsidian behavior, real CLI execution, production source generation, user-vault safety, Community directory readiness or the intended same-repository dogfooding. Those remain implementation and qualification work, not missing features to simulate into a passing score.

## Follow-up acceptance work, not claimed complete

1. Qualify a real native companion against the existing CLI's planning/apply/recovery contracts and current script catalog; keep the CLI authoritative.
2. Exercise host persistence, migrations, schema compatibility and simultaneous writes without assuming browser demo storage is a production adapter.
3. Run a complete accessibility and physical-input audit across themes, magnification, assistive technologies and supported devices.
4. Measure large-graph performance before structural refactoring or increasing limits; retain exact source/semantic invariants during optimization.

## Primary references

[1] W3C, [Understanding Success Criterion 2.5.7: Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements), consulted during this review.

[2] Fallow, [Architecture boundaries configuration](https://fallow.tools/docs/configuration/boundaries/), consulted for isolated zones and required coverage. The repository's pinned analyzer, not documentation alone, is the acceptance authority.

[3] Playwright, [Python continuous integration](https://playwright.dev/python/docs/ci), consulted for isolated browser provisioning and execution. Browser evidence remains distinct from native host evidence.
