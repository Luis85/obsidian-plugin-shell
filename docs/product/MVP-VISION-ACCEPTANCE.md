# Workbench MVP — vision acceptance scenarios

> **Version:** 1.1 · **Date:** 2026-09-29
> **Planning baseline:** PR #5 at `f3778ed120e845a781c9cc08afc9b16a8b1a3e8c`; quality amendment based on `40799d9489e0bd436a47f819732292e8a35a4774`.
> **Status:** Acceptance protocols for the [improvement plan](MVP-IMPROVEMENT-PLAN.md), not executed test results. Existing [A01–A20](../prds/MVP-IMPLEMENTATION-PLAN.md#5-acceptance-and-test-crosswalk) and parent requirements remain in force.
> **Mandatory amendment:** [MVP-QR-01 — operational, fixture-backed and backend-integrable boilerplate](MVP-BOILERPLATE-QUALITY.md). Its BQ-01–10 clauses and BQA-01–10 protocols supplement these twenty scenarios.

## Execution rules

For each scenario record candidate commit/tree, engine/starter/model/fixture/contract hashes, target/framework, OS/toolchain/host versions, interaction inventory, command/protocol, actual result, retained artifacts and limitations. Use `not-run`, `blocked`, `failed` or `passed` for each applicable evidence mode; do not award a scenario an overall pass while a required mode is missing. “Not applicable” requires a documented scope reason and must not waive a retained requirement or conceal an unimplemented interaction.

Use real services/actions for claimed behavior. Keep mocked contracts, filesystem integration, independent generated builds, browser interaction, native Obsidian, C# and Java backend integration, manual accessibility and authorized remote execution separate. Intentional safety refusal may pass its negative assertion; it does not make the positive user journey complete.

Use synthetic data and explicitly isolated native vaults. Snapshot handwritten source, authored Markdown, custom adapters, existing remotes and unrelated `.obsidian`/vault content for preservation assertions. Never test against the user's personal vault or publish simply to obtain evidence. Hashes bind identity, not permission.

The small fixtures are Request Board (Angular webapp) and Quick Capture (Vue/Nuxt UI Obsidian plugin); the full Workbench self-project remains mandatory. Their detailed UI/data contracts are baselined in WM-01/02 before implementation, not invented by a test after observing output. All selected designed interactions must have operational fixtures/scenarios, including stateful data changes. Missing live business implementation is not an acceptable reason for disabled controls in demo mode. Demo completeness does not replace actual native Workbench persistence or production acceptance.

## Scenarios

### WVA-01 — Current capabilities and shared contracts

**Given** exact current source, supported legacy exports and versioned schema fixtures, **when** the CLI/browser paths validate or migrate them, **then** their accepted/rejected semantics agree and stable IDs, revisions and declared content survive. Confirm existing `project schema`, `project validate`, scoped generation and resume before opening replacement work. Unknown versions, unsafe shapes and invalid executable references fail without mutation. Transport-valid planning data may still have explicit generation-readiness findings. Preserve interaction-to-fixture/scenario and wire-contract references under MVP-QR-01; no incomplete selected action may be hidden from the inventory.

**Evidence:** shared positive/negative fixtures, schema discovery, migration/semantic comparisons and source capability matrix. **Packages:** WM-01/02. **Legacy:** A08/A09/A17/A18. **Quality extension:** BQA-02/06.

### WVA-02 — User settings, migration and non-default paths

**Given** legacy-only, new-only, both-agreeing, both-conflicting, corrupt and future-version configurations, **when** settings are inspected/migrated, **then** the resolver explains each effective value; conflicts require a reviewed choice; original content remains recoverable. Changing a setting never silently relocates existing files. Run source/test/docs/fixture/preview generation using non-default roots; reject overlap, case conflicts, traversal, reserved destinations and symlink escapes before writing. Runtime configuration exposes only intended non-secret values, never the entire local settings file.

**Evidence:** exact before/after bytes, migration/recovery plan, resolved settings and downstream path checks. **Packages:** WM-03/11/14. **Legacy:** A03/A04/A08/A13. **Quality extension:** BQA-04/05/09.

### WVA-03 — A starter is an external definition

**Given** an engine and `configs/starters/<starterName>.json`, **when** a starter's metadata, parameter or ordinary generated content changes, **then** list/edit/plan/execute reflects that definition without modifying engine code or a duplicate registration. A starter can express a bounded dependency sequence of existing operations; it cannot invent an executable primitive. Edited user copies expose their changed identity/hash. Unknown operation types, dependency cycles and incompatible versions are rejected. Included interaction fixtures/scenarios are complete; missing data or handler references cannot be passed off as a working starter.

**Evidence:** unchanged engine hash, definition diff, discovery output and reviewed resulting plan. **Packages:** WM-04. **Legacy:** A02/A08/A17/A18. **Quality extension:** BQA-01/02.

### WVA-04 — Separate starter distribution and unsafe archives

**Given** the exact engine ZIP and separate starter ZIP, **when** they are inspected/extracted, **then** the engine contains no starter definitions, including hidden examples/template copies; the pack supplies advertised starters, their fixtures and provenance. Without a pack, starter selection explains the missing requirement while project-JSON intake remains usable. Reject traversal, absolute/duplicate/case-conflicting entries, unsupported links, oversized/decompression-bound violations and tampered required resources. Preserve a previously installed working pack on failed update. Backend reference examples follow the same separate-pack boundary.

**Evidence:** archive inventories, compatibility/checksum results, no-pack flow and negative fixtures. **Packages:** WM-04/14/16. **Legacy:** A01/A02/A08/A17. **Quality extension:** BQA-01/07/08.

### WVA-05 — Existing Angular project-vault and PRDs

**Given** an existing Git repository opened as an Obsidian project-vault with typed PRDs in the configured `docs/prds` path, **when** the extracted CLI runs setup, **then** it offers target/framework, paths, product/project description, selected PRD files or reviewed folder scan, starter/JSON input, prototype choice and first-run choice. Invalid or duplicate PRDs receive actionable locations; their presence never authorizes silent partial intake. Existing Git/remotes/notes/security settings are unchanged. `new` retains its existing stricter placement contract. The proposed demo requires no real API/database, account or manually entered seed data.

**Evidence:** complete interactive transcript, equivalent non-TTY requests, reviewed file plan and preserved-content hashes. **Packages:** WM-05/07. **Legacy:** A02–A04/A18. **Quality extension:** BQA-01.

### WVA-06 — Prepare only and skip first run

**Given** selected setup/prototype options, **when** the user declines first run, **then** only explicitly approved source/config/docs/fixture preparation occurs; no package install, build, browser launch, server start, native installation or activation occurs. Selecting prototype preparation alone does not grant execution. Cancellation before applying a plan produces no project changes. Later help/status identifies the exact next supported operation without labeling the project built/tested.

**Evidence:** process-spawn/network spies for negative assertions, filesystem snapshots and CLI outcomes. **Packages:** WM-05/06. **Legacy:** A04/A18. **Quality extension:** BQA-01.

### WVA-07 — Selected first run, failure and resume

**Given** explicit approval for selected target-specific install/build/verify/showcase steps, **when** execution succeeds, fails or is interrupted, **then** each step has an honest independent result and downstream work stops on failure. Lock mismatch requires separate resolution/review rather than silently running a different install. Changed settings/starter/model/fixtures/contracts/source/lockfile invalidates affected approvals. Port conflict, existing process, registry error, missing tool and interrupted stage produce safe recovery; unrelated processes remain untouched. A successful demo starts with usable fixture data and scenarios; it must not require a production backend or manual repair.

**Evidence:** successful independent run, injected failures/cancellation, process ownership, fresh-resume hashes and actual readiness of showcased output. **Packages:** WM-06/16. **Legacy:** A01/A04/A17/A18. **Quality extension:** BQA-01/02/04.

### WVA-08 — Typed Markdown import and competing edits

**Given** pages, components, interactions and journeys in typed Markdown, **when** a file or folder is inspected/imported, **then** stable IDs, declared fields and cross-file references map to the shared project. Filenames alone are not identity. Reimport is a no-op when unchanged. Rename, missing reference, duplicate ID, future schema, invalid frontmatter, unsupported type and competing edits produce defined outcomes. Preserve unrelated frontmatter and prose; do not execute embedded HTML/scripts or remote includes. A cancelled/stale plan preserves the prior project. Preserve supported scenario references; missing mock semantics are actionable completeness findings, never fabricated behavior.

**Evidence:** round-trip fixtures, owned-field merge/conflict cases, source locations, exact bytes and zero-execution assertions. **Packages:** WM-02/07/14. **Legacy:** A08/A09/A13/A14; extends the MVP with typed-document behavior. **Quality extension:** BQA-02/06.

### WVA-09 — Documentation completeness, freshness and preservation

**Given** a project with meaningful authored explanations, **when** its documentation structure is generated, **then** the index and page/component/interaction/journey documents contain correct stable references, behavior, usages and visible limitations. Include scenario/fixture and integration-contract origins and mode/reset instructions. A component or journey change marks affected docs stale until reviewed update. Repeated export is a no-op; prose/foreign properties survive; removal proposes retirement rather than deleting notes. Generated docs do not overwrite the authored import root by default or include credentials, local approvals or session drafts.

**Evidence:** link/content assertions, provenance, stale/update/conflict cases and handwritten preservation checks. **Packages:** WM-08. **Legacy:** A09/A13/A17/A18; extends the MVP documentation promise. **Quality extension:** BQA-09/10.

### WVA-10 — Design-only and focused authoring

**Given** a clean authoring session without external Node/npm/Git or an account, **when** the user creates a page and reusable component, edits properties/bindings, adds context and previews, **then** the supported design-only journey works. Keyboard/non-drag paths reach core outcomes. Undo/redo, dirty-state warnings, component-versus-instance scope and contextual Back remain correct. No undocumented maintainer step or nested application shell is needed. Assigning and reviewing fixture/scenario references must fit the same editing workflow.

**Evidence:** real rendered interaction tests, observed task replay, focus/draft assertions and environment description. **Packages:** WM-09/15. **Legacy:** A05/A07/A18/A20. **Quality extension:** BQA-02/04/10.

### WVA-11 — Shared-component revision and journey impact

**Given** two pages sharing a pinned component and a linked journey, **when** its contract changes, **then** affected usages, incompatible bindings, fixtures/scenarios, related docs and relevant generated outputs are identified before migration. Updating selected usages preserves other pins and instance overrides. Moving/renaming a surface does not silently rewrite routes; dragging changes geometry only. Test branching journeys, modal return, deletion impact, cycles and contextual editor navigation.

**Evidence:** impact/dependency graph assertions, before/after model equality outside scope, real interaction and explicit revision migration. **Packages:** WM-02/10/12. **Legacy:** A05–A10/A13. **Quality extension:** BQA-02/06/10.

### WVA-12 — Operational generated Obsidian UI

**Given** the accepted Quick Capture model and compatible kit, **when** an independent project is generated/built, **then** the authored layouts, components, bindings, states, commands/settings and every designed interaction operate with their required fixtures. Execute coherent simulated capture/edit/delete and cancel/failure paths, asserting mock state and visible effects. No declared action can be disabled because its real backend is missing. Test the fixture-backed demo separately from the explicitly implemented real note-backed workflow. Compile success or mock success does not stand in for real native persistence/theme/lifecycle evidence. Correct the model/modules/compiler, never manually patch disposable output to pass.

**Evidence:** input/fixture/contract/output/build hashes, interaction inventory, generated source review, browser assertions where relevant and real isolated native assertions. **Packages:** WM-09/11/15/16. **Legacy:** A10/A11/A17/A19. **Quality extension:** BQA-01–06/10.

### WVA-13 — Operational Angular webapp and path flexibility

**Given** the accepted Request Board definition, Angular target and non-default source/test/docs/fixture roots, **when** generation, explicit dependency handling and build run, **then** the actual UI—not just route placeholders—operates across all selected interactions with coherent fixture-backed behavior. Exercise components, form validation, lists, create/edit/delete, filtering, local state, navigation/dialog return and applicable error/empty/loading/disabled states. Verify read-after-write and cancel/failure semantics. No Obsidian dependency or maintainer path may enter browser runtime. Rebuild after a declared component change and verify refreshed fixtures/contracts/docs. Prove backend substitution separately through BQA-07/08/09; neither backend is required to start the demo.

**Evidence:** independent compile/build, real browser behavior, complete interaction/scenario inventory, import-boundary checks and generated path/content assertions. **Packages:** WM-03/09/11/16. **Legacy:** A03/A10/A11/A13/A17; adds the primary webapp proof. **Quality extension:** BQA-01–09.

### WVA-14 — Scoped regeneration and mid-write recovery

**Given** an independently edited consumer, **when** a feature/page/component scope is generated, **then** the plan includes its required shared dependencies, registrations and corresponding tests/docs/fixtures/contracts, and preserves unrelated outputs. Identical replay is a no-op. Edited managed files, missing dependencies and stale review hashes block the write. Retired files are not silently deleted. Preserve developer-owned integration adapters and fixture overrides. Inject a failure during application and verify the exact recovery/rollback result; do not claim filesystem-wide atomicity or blindly retry uncertain writes.

**Evidence:** scoped artifact inventories, no-op diffs, preserved extension hashes, stale-plan and mid-write failure tests. **Packages:** WM-12/14/16. **Legacy:** A10/A13/A14. **Quality extension:** BQA-05/06/10.

### WVA-15 — Operational, honest offline preview

**Given** generated editable source, **when** the single-file preview opens with network disabled, **then** every designed interaction in the selected output has executable fixture/scenario support. Navigation, modal return, local effects and simulated business writes operate coherently; mutations appear in subsequent reads/views. Fixtures are labeled, selectable and resettable; no live vault/provider/API or publication call occurs. Loading/error/empty/disabled scenarios are intentional, not missing implementations. A simulated save changes isolated mock state but never claims a real database write. Reset isolates pending responses. Embedded assets/licenses and browser compatibility follow the supported contract. Compare semantic output with the authored model, not only screenshots.

**Evidence:** actual file-origin browser run, network-denial assertions, complete interaction/fixture inventory, stateful behavior assertions, source/output hashes and manual visual review. **Packages:** WM-11/15. **Legacy:** A11/A17/A20. **Quality extension:** BQA-01–05.

### WVA-16 — Developer-owned integration and independent continuation

**Given** a generated application whose demonstration already works, **when** a developer stops using Workbench, **then** ordinary project commands still build/test it and explain production integration responsibilities. Replace the mock with an HTTP/native adapter through the same typed ports; validate actual success/error responses without changing pages/components. A differing existing API may require an owned mapper. Run the same frontend build against the C# and Java reference services through configuration only as specified in BQA-07/08. Regenerate afterward and preserve the custom integration and its tests. Missing live services fail visibly with no silent mock fallback. Stubs/TODOs cannot count as designed-interaction coverage or excuse missing Workbench editor engines.

**Evidence:** authoring/maintainer-dependency isolation, mock-before-integration task replay, source preservation, actual adapter/contract tests and separate backend execution records. **Packages:** WM-11–13/16. **Legacy:** A10/A13/A17/A18. **Quality extension:** BQA-05–10.

### WVA-17 — Full generated native Workbench

**Given** SH-022/SH-034/CX-007 prerequisites and the full reconciled self-project export, **when** that definition and shipped kit generate Workbench in a clean workspace, **then** all retained required authoring capabilities work natively without copying source manually, an iframe or placeholder editor engines. Exercise import, sitemap/page/component edits, connected docs, actual persistence, close/reopen, multiple leaves, failure/conflict recovery, export and regeneration. Preserve self-project capabilities and component pins; reconcile intentional changes explicitly. Consumer demo fixtures do not replace this real native authoring acceptance.

**Evidence:** whole-capability inventory, independent build, actual isolated native protocols and CP-010 evidence. **Packages:** WM-17. **Legacy:** A09/A12/A17/A19; all original native scope remains mandatory. **Quality extension:** BQA-10.

### WVA-18 — Security, accessibility and performance evidence

Run separate subprotocols: **S** hostile input/process/path/export boundaries, mock/live isolation, production fixture exclusion and retained quality gates; **A** keyboard/no-drag, focus, screen-reader, error/status, contrast/reflow/theme/language behavior across applicable scenarios; **P** model and rendered/native timings, resources and repeated open/close lifecycle. Test both small fixtures and the full self-project. Record environments, budgets and percentile definitions; retain stricter established thresholds. An automated scan does not replace manual/native work, and a model microbenchmark does not prove UI responsiveness. Missing fixtures/handlers, corrupt responses and stale scenario references must fail the applicable negative controls.

**Evidence:** distinct S/A/P reports per applicable target with negative controls, measured results and unresolved blockers. **Packages:** WM-14/15/17. **Legacy:** A08/A13/A17/A19/A20. **Quality extension:** BQA-02/04–06/10.

### WVA-19 — Exact archives, release separation and support

**Given** an eligible fixed candidate, **when** local preparation/rehearsal runs, **then** it never tags/pushes/publishes and missing/mismatched evidence blocks readiness. Verify release profiles for framework, generated consumer and native Workbench separately. Test denied authorization, changed candidate, partial upload and foreign release protection in the retained appropriate test modes. Real publication requires new explicit approval; then redownload approved bytes and execute installation/recovery smoke. Engine/starter packaging remains separate and help/support names the actual artifacts. An operational-boilerplate release claim needs complete interaction coverage and both reference-backend proofs, not a build alone.

**Evidence:** all-OS extracted-kit tests, candidate receipts, authorization/recovery protocols, demo/integration support walkthrough and approved remote evidence only when authorized. **Packages:** WM-16/19. **Legacy:** A01–A04/A15–A18. **Quality extension:** BQA-01/07–10.

### WVA-20 — First-change and second-change product value

**Given** equivalent accepted tasks performed manually and with Workbench, **when** participants build and experiment with the first documented UI and make a later shared-component change, **then** record hands-on/elapsed time, time to first usable demo, tool familiarity, order/learning effects, assistance, rework, documentation gaps and all quality results. Include scenario selection/reset, finding the next action and integrating/continuing in source without UI rewrites. No time advantage is claimed for reduced scope or weaker acceptance. Findings guide product changes; a small recruited sample is not market-wide proof.

**Evidence:** voluntary study protocol, task/output parity, observations, limits and decisions. No silent telemetry. **Packages:** WM-08/13/18. **Legacy:** supplements A18/A20; validates the three vision promises. **Quality extension:** BQA-10.

## Mandatory operational-boilerplate gate

Use [MVP-QR-01](MVP-BOILERPLATE-QUALITY.md) alongside the cases above. Its ten BQA protocols explicitly add clean demo startup, complete interaction coverage with negative controls, stateful mock behavior, deterministic scenarios/reset, mode isolation, wire-contract parity, separate C# and Java integration runs, hosting configuration and preservation through regeneration.

Require executable fixture/scenario coverage and passing applicable assertions for **100% of the interactions in the reviewed selected design**, with zero missing handlers or unimplemented-action placeholders. Preserve the denominator and list approved actual scope exclusions; legitimate disabled/error states are test cases, not exclusions. Source-code coverage, generated file counts and TODO counts are different measures. A partial artifact cannot pass as complete, and a blank design cannot qualify the generator in place of representative nontrivial projects.

Keep demo, backend integration and real native/production evidence distinct. BQA protocols are not executed merely because this documentation names them. Earlier A/WVA records retain their dated result and must not be promoted to the amended requirement without requalification.

## Retained acceptance crosswalk

These associations identify relevant extended scenarios, not replacement tests or automatic completion. Every original assertion still needs its own evidence. BQA connections are additive through the scenario references above.

| Retained case | Added scenarios |
| --- | --- |
| A01 kit launch/platform/toolchain | WVA-04/07/19 |
| A02 starter/JSON setup | WVA-03–05/19 |
| A03 identity/paths/GitHub | WVA-02/05/13/19 |
| A04 cancel/failure/resume | WVA-02/05–07/19 |
| A05 integrated editor operations | WVA-10/11 |
| A06 hierarchy/routes/journeys | WVA-11 |
| A07 connected editors/context | WVA-10/11 |
| A08 schemas/migrations/unsafe data | WVA-01–04/08/18 |
| A09 self-project/round trips | WVA-01/08/09/11/17 |
| A10 scoped source generation | WVA-11–14/16 |
| A11 offline generated interactions | WVA-12/13/15 |
| A12 complete generated companion | WVA-17 |
| A13 ownership/regeneration | WVA-02/08/09/11/13/14/16/18 |
| A14 concept intake | WVA-08/14 plus retained project/feature/improvement concept tests |
| A15 local release preparation | WVA-19 |
| A16 authorized release/recovery | WVA-19; remote mode remains unexecuted without approval |
| A17 source/artifact/evidence integrity | WVA-01/03/04/07/09/12/13/15–19 |
| A18 help/handoff/noninteractive | WVA-01/03/05–07/09/10/16/19/20 |
| A19 native lifecycle/persistence | WVA-12/17/18 |
| A20 scale/accessibility | WVA-10/15/18; WVA-20 adds product learning, not a performance substitute |

## Evidence receipt template

```yaml
scenario: WVA-XX-or-BQA-XX
candidateCommit: required
candidateTree: required
engineArtifactHash: required-when-used
starterArtifactHash: required-when-used
modelHash: required-when-used
interactionInventoryHash: required-for-operational-boilerplate
fixtureAndContractHashes: required-when-used
targetAndFramework: required
applicationMode: demo-or-backend-integration-or-native-or-not-applicable
environmentAndTools: required
protocolOrCommand: required
mode: contract-or-filesystem-or-build-or-browser-or-native-or-backend-or-manual-or-release-or-study
result: not-run
artifacts: []
limitations: []
retainedAcceptanceCases: []
approvalReference: only-for-actually-authorized-external-actions
```

This is a proposed recording template, not a new executable schema or an authorization artifact. Bind approval references to an existing approved mechanism; do not place credentials or reusable permissions in portable project data. Documentation of a planned test does not establish its execution.
