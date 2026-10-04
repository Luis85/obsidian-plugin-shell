# Runtime authoring milestone

Baseline: `386353f5ef3bc6ec94d19057bef159e4efa6e7a1`, clean main, 2026-09-23.
PR #8 remains open and is reference evidence only. This branch starts from
origin/main and does not incorporate its release executor. No `.codex/` exists.

## Confirmed inventory and acceptance

| Package | Existing foundation | Remaining acceptance |
| --- | --- | --- |
| A: EVT-03/05/06/11/16 | Runtime-scoped synchronous bus, correlated publication union, native bridge, event/listener makers | Narrow observing/publishing ports; explicitly composed descriptors and source-derived catalog/checker; actual compiler/checker negative controls; generated real-bus lifecycle |
| B: EXA-01–03, AC-03/04 | Typed plugin-data repository, shared serialized writer, revisions and uncertainty lockout | Optional item CRUD reference with stable IDs and trimmed 1–120 labels; real multi-view projections/drafts and failure/recovery states; complete reviewed removal |
| C: Windows qualification | Retained same-byte failing full session and passing plugin-free probe | One controlled instrumented comparison with contemporaneous window/theme/focus/config evidence; fix only an identified defect or retain precise blocker |

## Dependency order and ownership

1. Establish baseline, read contracts, install exact Node 24.21.0/npm 11.19.1
   lockfile, and agree A's public API before B depends on it.
2. Event worker owns event contract/descriptors, bus adaptation, event/listener
   maker code, catalog tooling and focused compiler/runtime/tooling tests.
   Preserve `EventInput` correlation and existing synchronous delivery semantics.
   Split publication and observation ports; expose observer-only services and
   explicitly scoped feature publishers. Send the exact API to parent/B before
   dependent implementation. Do not edit shared bootstrap/package/removal files.
3. Reference worker owns `src/features/items`, its presentation components,
   composable/store, localized copy and focused real-service/view/E2E tests.
   Use existing plugin-data committed facts without duplicate publication.
   Subscribe before querying; guard overlapping loads and disposal. Send required
   bootstrap registrations to parent. Shared styles remain parent-owned.
4. Native worker owns bounded diagnosis and a scope-labeled evidence report.
   Preserve previous failed evidence, isolated vault/config, assertion limits,
   active-tab guard and bounded partial-file polling. No speculative theme fix.
5. Parent owns shared registries/contracts integration, package scripts,
   workflow triggers, styles, example-removal hashes/templates, docs/status,
   complete verification and delivery. No dependency changes are planned.

All maintained changes stay in `.worktrees/runtime-authoring`. Workers share
this checkout and must coordinate ownership before edits. Heavy installs,
builds, type-aware lint and coverage run serially on this limited-RAM host.

## Review and verification

Separate review wave inspects another worker's actual diff and adversarial
behavior: type rights/correlation, schema/catalog drift, persistence/uncertainty,
multi-view lifecycle, generated consumer/removal and author ergonomics. Fix
concrete findings, then polish documentation and UX copy.

Run targeted actual compiler/runtime/tooling negative controls; full `verify`
including both unchanged coverage gates and complete inventory; served E2E;
live all-category security. Qualify a distinct consumer with custom source/local
maker, generated event/listener/plugin-data feature, reviewed example removal
and an independent post-removal feature. Record fresh-checkout/archive scope.

Freeze code source, qualify/build and retain one candidate's assets; bind later
browser/native evidence to those bytes. Corrections require a new candidate.
Preserve failed attempts and separate evidence-only commits. Hosted read-only
qualification is preferred; inspect workflow triggers and actual results.

The separate [test inventory](../testing/runtime-authoring-plan.json),
[execution record](../testing/RUNTIME-AUTHORING.md) and
[review corrections](RUNTIME-AUTHORING-REVIEW.md) retain scope and outcomes.

Deliver imperative commits, pushed topic branch and an attached reviewable PR.
Report code/evidence SHAs, exact commands/results, asset hashes, independent
review corrections and unqualified scope. No merge, public release/tag/upload,
listing, global install or permission change is authorized. Ask the owner for
the next step after PR delivery.
