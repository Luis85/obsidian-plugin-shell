# Manage the MVP backlog in Obsidian

**Date:** 2026-09-29. **Compatible backlog:** `WB-MVP-2026-09-29-v1`, introduced by commit `1ef9e2b92363de3108630aada4756228d6feb262`.

Open [MVP.base](MVP.base) in the repository-as-vault to browse and edit the existing PBI properties. The view uses the same frontmatter as the [54-item requirements index](README.md), not an imported database or another set of requirements. The fixed scope remains in [backlog.json](backlog.json); [governance](GOVERNANCE.md), [evidence conventions](evidence/README.md) and the existing [Node progress reporter](tooling/progress.mjs) retain their authority.

## Six views

| View | Purpose |
| --- | --- |
| Backlog | Inspect use case, lifecycle state, suggested rank, milestone, owner, estimate and explicit blocker. |
| By milestone | Review scope by delivery increment, with epic and feature context. |
| Unassigned | Identify items that still need an accountable person; a responsibility role is not an assignment. |
| Explicit blockers | Inspect actual declared blockers separately from unmet acceptance prerequisites. |
| Awaiting acceptance | Locate implemented/tested items and their required evidence profiles and acceptance-record references. |
| Shipped records | Inspect declared shipment dates and release references. |

The base filters to Markdown note properties `type: PBI`, `product: Workbench`, `release: MVP` within `docs/requirements`. It therefore excludes templates, reports and governance documents. It is an authoring view, not the fixed-baseline validator: newly added matching notes can appear before a reviewed change to `backlog.json`. Run the reporter to detect an unexpected or missing baseline item.

## Editing and interpreting progress

Use the lifecycle and property types defined in governance. Do not infer an estimate from a null value, assign a person without agreement, or copy an acceptance decision to a new specification. Changing a field in the base changes the note's metadata; it does not execute tests, obtain review approval or update related engineering-task states.

The **Accepted status claim - not evidence verified** column merely evaluates whether status is `done` or `shipped`. Its count is not accepted scope until the verification plan, current specification/candidate, evidence and acceptance decision are checked. The estimate sum covers entered values only; missing estimates remain unknown. A blocked Done claim must be resolved by review, not excused by a status formula.

The view does not resolve dependency graphs, validate evidence receipts, certify inherited gates, or authorize publication. Browser, offline, C#, Java and native acceptance remain distinct. Actual product-value measures still require the evaluation in [WB-PBI-052](WB-PBI-052.md), not a count of completed cards.

From the repository root, run the existing read-only reporter:

```sh
node docs/requirements/tooling/progress.mjs
node docs/requirements/tooling/progress.mjs --json
node docs/requirements/tooling/progress.mjs --candidate <full-implementation-commit-sha>
node --test docs/requirements/tooling/progress.test.mjs
```

Do not treat the dated [PROGRESS.md](PROGRESS.md) snapshot as a live status database. Generate a fresh report after reviewed changes. A report validates recorded consistency, not the honesty of an external execution or the authority of a publication decision.

## Reconciliation and verification

The finalization preserved the concurrently committed 54 PBI IDs, 216 criteria, 8 epics and 28 features. It did not replace them with the separate draft tree or install a second metadata schema/reporting implementation. The existing dependency-free Node tool remains the sole shipped progress utility; the independently tested Python draft was not added to the branch.

This addition changes only the Bases file, this guide and the product index. A local YAML parse confirmed a valid document with six distinct table views and the intended PBI filter. Its SHA-256 is `36c05407feab2c7e57d76a1f59628c2d18ceb0f4d837b7df734ed16eae1552fc`. Native rendering, property editing and formula evaluation inside Obsidian were **not run**. The pre-existing [validation record](VALIDATION.md) separately records its 16 Node reporter tests; those results were not relabeled as new runtime evidence during this finalization.

The view follows the documented [Obsidian Bases syntax](https://help.obsidian.md/bases/syntax), consulted 2026-09-29. YAML parsing does not prove application-level compatibility or accessibility. No application source, requirement status, implementation estimate, task gate or public release approval is changed by adding these views.
