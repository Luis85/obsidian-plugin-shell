# Reconciliation and polishing review

Date: 2026-09-23. Scope: PR #5 and the supplied Concept 09 editor.

## Merge decision

Main advanced from the common iteration-03 ancestor to `2d4087e93289a21d797fab4cd641ecde6cf16a82`. The PR head was `72165e4615b08301cc74ce67ed852b9a6b193576`. The overlapping edit was the parent product requirements file. The resolution preserves main's runtime-authoring/release/iteration-04 requirements and appends the companion proposal without weakening either contract.

Merge commit `76ab0cb5cfd7b0c1c66d1042f52b41e9895e9482` has both parents. The update is a normal fast-forward of the PR branch, not a force push or merge into main. Main's runtime, dependencies, lockfile, tests and policy gates remain authoritative. Concept 09 had only been delivered as an attachment; its readable source is now reconciled with the committed Concept 08 material rather than discarded.

## Findings and disposition

| Perspective | Finding | Resolution or remaining limit |
| --- | --- | --- |
| Product continuity | A conflict-only merge would leave the latest approved editor outside the repository. | Include the complete supplied reference-led canvas and content workspace. |
| Workflow safety | Ctrl/Command Enter could save beneath the discard confirmation dialog. | Keyboard save is blocked while the nested protection dialog is open; exact draft remains. |
| Validation | Generic errors did not identify the unnamed component. | Focus the invalid name, provide aria-invalid/describedby and retain all values. |
| Error recovery | A corrected field could keep obsolete error text. | Clear stale feedback during input; validate again on Save. |
| Reversibility | Removing a draft component offered no local recovery. | Undo remove restores its ID, content and order; survives library/preview redraw. Only the most recent removal has this local shortcut; Cancel preserves the saved screen. |
| Empty state | Removing the last block could leave an unhelpful empty column. | Explain how to restart; preserve recovery and miniature empty-state guidance. |
| Draft preservation | A stale revision prevents Save but still needs a safe handoff. | Explicit local JSON draft export; no blind retry or implicit overwrite. |
| Refresh safety | Unsaved form content could disappear on refresh. | Request browser beforeunload protection for dirty tracked forms; this is not durable draft persistence. |
| Ordering | Insertion relative to a target was ambiguous. | Upper/lower target halves mean before/after; visible insertion indicators; move buttons retained. |
| Content limits | Formatting at the limit failed without useful feedback. | Explain the limit, retain original text, expose live character count. |
| Visual clarity | Inactive formatting controls were unnecessarily faded. | Keep controls readable without forcing the whole card into an active style. |
| Navigation | Arrange and Pan popovers remained open after outside interaction. | Outside pointer dismisses; Escape closes only the popover and returns focus. |
| Terminology | Two different controls used Structure. | Use Outline for the structure-panel toggle; preserve Structure as card representation. |
| Responsive layout | Long titles and the expanded action footer need more room. | Wrap editor titles/footer; verify wide, intermediate and narrow views. |
| Data validity | Primitive/null canvas values could throw before validation. | Reject invalid types before reading optional fields. |
| Source ownership | Visual polish must not alter component library definitions or source plans. | Maintain per-instance drafts; geometry/sections/settings remain nonsemantic. |
| Engineering | Generated HTML could drift from the reviewed readable source. | Exact assembly guard; separate read-only concept source verification. |
| Repository policy | The old temporary self-committing assembly workflow conflicts with main's read-only policy. | Retire it after generating the accepted artifact; do not weaken the workflow checker. |
| Evidence | Earlier suites include obsolete toolbar assertions. | Preserve historical tests/evidence, report the failure and current scope; do not inflate the current pass count. |

## Whole-path review

The exercised path covers arriving in the example project, selecting/focusing/searching surfaces, handle drawing and line editing, moving cards, reordering on-card components, opening and editing content, applying Markdown syntax, save/undo/redo, library additions, dirty cancellation, controlled stale revisions and manual draft export. It also covers visual sections, settings, preview return, PRD/library navigation and responsive layouts.

The renderer still has dense-graph limitations. Very small Fit zoom is an overview, not readable text; use Focus and the Outline. Long offscreen drag autoscroll, full accessibility, real filesystem transactions, production scaffolding and native lifecycle remain separate work. No benchmark, user-study result or complete platform qualification is inferred from these browser checks.

See [current verification](RECONCILIATION-VERIFICATION.md) for exact tested bytes and commands.
