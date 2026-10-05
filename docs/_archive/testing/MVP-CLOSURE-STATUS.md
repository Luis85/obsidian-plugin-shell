# MVP closure status — 2026-09-28

The [improvement plan](../product/PR5-IMPROVEMENT-PLAN.md) remains the scope.
This is a closure map, not approval to publish or a declaration that the complete
MVP is implemented. Source changes require new candidate-bound verification.

## Current implementation line

PR35 continues on `feat/pr5-product-improvements`. Commit `ef49ab70` reconciles
PR5 `f140c7e` without dropping either branch's authoring behavior or the exact
TypeScript 6 selection policy. See [base integration](PR35-MVP-BASE-INTEGRATION.md).
The following [scenario increment](GENERATED-PREVIEW-SCENARIOS.md) connects saved
visual scenarios to generated output; its own current-head checks must complete.

## Native Journey Lens implementation — qualification pending

The [native integration candidate](JOURNEY-LENS-NATIVE-IMPLEMENTATION.md) adds the
actual shared editor to generated plugins, full-project file persistence,
independent leaves, explicit import/recovery, complete sitemap record maintenance
and generated native acceptance tests. It also locally reconciles PR5 `7c26f37`
with PR35 `2ea6c19a`. The [resumed integration](PR35-RESUMED-INTEGRATION.md)
puts the complete source on the PR with the newer base changes. Locked TypeScript 6,
browser and native-host qualification remain separate; runtime tests establish only their stated scopes.
The actual page/component/source editor implementations remain separate work.

## Required outcomes and remaining exits

| Outcome | Implemented foundation | Remaining exit, not inferred from a unit pass |
| --- | --- | --- |
| Extracted-kit developer path | Starter/JSON intake, public v6 schema, scoped generation, reviewed staged resume and inherited/custom source freshness | Complete current-candidate replay on supported platforms, interruption/recovery cases and first-use acceptance from shipped instructions |
| Coherent authoring | Canonical sitemap owner, guarded drafts, routes and journeys, reviewed arrangement, numeric positioning, contextual navigation and focused views | Remaining command/state matrix, branching/adjacent-editor acceptance and observed developer/non-developer author tasks |
| Useful generated clickdummy | Shared generated Vue runtime, synthetic reads, local interactions, modal ownership, navigation, canonical export, authored scenario selection | Current independent build/browser evidence, complete companion interaction/visual parity and representative human-readable sample content |
| Complete native companion | Public host adapters, generated declarations/scaffolds and reusable authoring contracts | Native execution of the locally implemented Journey Lens file/edit/recovery workflow; remaining page/component/source engines; multiple-window/failing-write acceptance and individual pending requirement dispositions |
| Quality and supported use | Preserved source/architecture/analyzer/coverage gates, exact evidence inventory, privacy-safe diagnostics and bounded local measurements | Complete current-head workflows, real-host starter lifecycle, manual assistive-technology/localization/device/narrow-leaf tasks and measured scale/lifecycle budgets |
| Distribution | Guarded packaging and release-operation foundations | Separate framework shipment approval and exact published-byte replay; native companion acceptance and its separate publication approval |

Full native companion behavior remains part of the complete MVP. The retained
[delivery strategy](../../product/DELIVERY-STRATEGY.md) sequences framework readiness,
separately authorized framework shipment (SH-034), agreed native conversion
(CX-007), native acceptance and separately authorized companion shipment. Neither
this record nor green CI bypasses that sequence or substitutes browser prototypes
for native acceptance.

Optional Hindsight/live-provider and Jev lanes remain separate from the framework
critical path. A framework user does not need an LLM key to generate a project.

## Evidence reading rules

Read exact identities and limitations in the linked execution records. The six
workflows associated with previous PR35 head `73084904` passed, but they checked
merge `d61dffa9` including PR5's TypeScript-selection change, not later source.
A source archive, generated source, built HTML, native-host session, manual task
and release replay are separate evidence layers. Historical passing, failing and
cancelled attempts stay historical; none is silently promoted to a new candidate.
