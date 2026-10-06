---
type: implementation-review
id: WB-PROTOTYPES-REVIEW
status: implemented-pending-qualified-verification
product: Workbench
feature: manage-maintain-prototypes
baseline_pr: 5
---
# Prototype implementations — review and polishing pass

## Reviewed sources and integration decision

Reviewed on 2026-09-29: the published prototype implementation at `7efe9bfd4915720c045422be1234206b1af2cc98`, its hosted authoring artifact and browser failure, and the alternate `workbench-prototype-management.zip` supplied in the conversation. The alternate manifest identifies local commit `470990fcdbf4d28d9ec4fc7b2b3c0c7cddff8576`, based on earlier PR head `bde086c4440de300f31dc550ae10e9cb9836b219`. Its archive SHA-256 is `64dcbfec3fae6864600ec24cc2ac0e9d1db9190e698b3210cb77c017114695dd`. Its test counts belong to that package, not to this implementation.

PR #5 subsequently advanced to `1a078d235043db2157efbcc702878e120264fc14`, merging the typed Markdown documentation work from PR #51. The prototype sources were unchanged by that merge. This pass retains those concurrent changes and adds only prototype-scoped behavior and its read-operation routing.

**Keep the published contract.** The alternate model uses prototype → variants → versions and `prototype-registry.json`; the published model uses prototype → versions → variants and `prototypes.json`. Combining the files would create two ownership and generation-selection authorities. No alternate schema, parallel project store, migration claim or wholesale patch application is introduced. All prototype files continue under `docs/concepts/<prototype-name>/`.

## Findings and changes

| Finding | Severity | Change in this pass | Evidence boundary |
| --- | --- | --- | --- |
| Generator and design plans were cleared after the browser storage write, so persisted state could retain a stale plan after a workspace change. | P1 | Clear plans before the commit; restore the exact prior plans and workspace on rejected persistence. | Trusted bridge test inspects the actual serialized state supplied to the storage port. |
| Form failures and workspace redraws could erase typed values; changing selection could discard an unsubmitted form without review. | P1 | Preserve submitted and in-progress fields, guard form replacement/navigation, disable controls while busy, restore useful focus and support Escape. | Actual DOM replay covers duplicate submission rejection, retained input, error focus and dismissed navigation. |
| Restoring an old solution had no explicit previous-draft recovery contract. | P1 | Restore only into an editable draft, adding a sealed recovery version in the same validated workspace change. Never overwrite the active snapshot or mutate the working editor implicitly. | Domain, filesystem-plan and browser tests cover restore, restore-back, collision, capacity and protected states. |
| A generation receipt with only a matching project ID and schema marker could be mistaken for a replaceable managed receipt. | P1 | Validate the complete receipt shape, portable selection, positive revisions, derived path, digest and unchanged bytes before replacement. | Real-filesystem adapter negative controls; existing independent A/B source-generation tests remain. |
| The portable directory decoder did not enforce exact input-byte limits before parsing, and accepted registry duplicates until later validation. | P1 | Bound each serialized file and the cumulative workspace; reject duplicate IDs and malformed digests before following dependent records. | Oversized whitespace, duplicate registry and malformed digest negative controls. |
| Counts alone cannot reveal a changed route, interaction, fixture or project setting. | P2 | Full-project read-only comparison with JSON-pointer locations, before/after values, explicit truncation and a shell read command. | Complete-document comparison tests; real sitemap editing in DOM replay. |
| The library becomes difficult to navigate as variants accumulate. | P2 | Search across prototype/version/variant names, slugs, descriptions and hypotheses; status filters, result counts, empty state and stable identity-based selection. | Filtering never changes saved arrays or active selection; middle-of-search caret regression covered. |
| Prototype titles and version labels could not be maintained after creation. | P2 | Dedicated metadata commands and forms; slugs and snapshot bytes remain stable. Sealed version labels cannot be changed directly or through import. | Domain, shell and browser checks. |
| The active generation source could scroll out of view, and A/B exports shared a filename. | P2 | Sticky desktop generator-source panel, explicit working-copy context and variant-specific active-project filenames. | Light/dark screenshots inspected; responsive CSS retained. Not a full accessibility conformance claim. |
| The hosted prototype test expected the manager root to exist after Open in editors had correctly unmounted it. | P1 verification | Assert the manager is gone and the actual Journey Lens editor is visible instead. Keep the original real-origin, reload and ZIP checks. | Failure reproduced from hosted job logs; corrected route assertion passes in scoped DOM replay. Qualified rerun is still required. |

## Behaviors adopted, and deliberately not adopted

The alternate implementation's recovery and browsing ideas are useful independently of its schema. They are implemented against the published domain and existing storage transaction rather than copied as a second manager. Comparison and display-metadata maintenance extend that same contract.

The alternate activation operation accepts a saved variant without the published approval precondition. This pass retains **explicit approval before activation**, exactly one active variant across the project, and fail-closed managed generation. Opening, saving, comparing, filtering, recovering or restoring an archive never grants activation.

Do not import an alternate workspace as though it were compatible. Use its paired review HTML for historical review only. No automatic conversion of its IDs, version history or activation state has been implemented or claimed. Likewise, opening a saved design keeps the published explicit replacement confirmation rather than silently saving or flushing another draft.

## Recovery semantics

Select an editable saved draft, open Compare design, choose a different saved reference, and review Restore reference into selected draft. The change preserves the complete old target in a new sealed `recovery-N` version and replaces only the target's project document. Target name, hypothesis and identity remain; its revision advances. The working editor and pinned generator source do not change. Recover the prior state by using that recovery snapshot as the reference for another reviewed restore.

The recovery uses the existing version/snapshot representation. It is not a Git commit, a new database, an application-release version or an automatic merge. Existing count/byte limits still apply; inability to retain recovery blocks the entire operation. Identical snapshots create no redundant checkpoint. Archive retains history; there is no destructive delete.

## Verification and residual acceptance

See [the verification record](PROTOTYPES-VERIFICATION.md) for exact commands and scopes. Local focused tests, source syntax, legacy assembly and controlled-Storage DOM replay passed. Qualified TypeScript 6/Vite, real-origin persistence, browser ZIP verification and full native Obsidian acceptance must be distinguished from those results. No broader PR #5 MVP, publication or accessibility completion is inferred.

## Review entry

Use the maintained `npm run companion:build` entry and `reports/companion-mvp/companion-journey-lens.html`, not the retained v5 compatibility HTML. [The feature guide](PROTOTYPES.md) describes current browser and shell operations. The shared workspace remains schema version 1; this pass adds commands and projections, not a new persisted envelope.
