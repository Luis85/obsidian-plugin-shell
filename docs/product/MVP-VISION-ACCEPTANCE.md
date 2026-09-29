# Workbench MVP — vision acceptance scenarios

> **Version:** 1.0 · **Date:** 2026-09-29
> **Planning baseline:** PR #5 at `f3778ed120e845a781c9cc08afc9b16a8b1a3e8c`.
> **Status:** Required/proposed acceptance protocols for the [improvement plan](MVP-IMPROVEMENT-PLAN.md), not executed test results. Existing [A01–A20](../prds/MVP-IMPLEMENTATION-PLAN.md#5-acceptance-and-test-crosswalk) and parent requirements remain in force.

## Execution rules

For each scenario record candidate commit/tree, engine/starter/model hashes, target/framework, OS/toolchain/host versions, fixture identity, command/protocol, actual result, retained artifacts and limitations. Use `not-run`, `blocked`, `failed` or `passed` for each applicable evidence mode; do not award a scenario an overall pass while a required mode is missing. “Not applicable” requires a documented scope reason and must not waive a retained requirement.

Use real services/actions for claimed behavior. Keep mocked contracts, filesystem integration, independent generated builds, browser interaction, native Obsidian, manual accessibility and authorized remote execution separate. Intentional safety refusal may pass its negative assertion; it does not make the positive user journey complete.

Use synthetic data and explicitly isolated native vaults. Snapshot handwritten source, authored Markdown, existing remotes and unrelated `.obsidian`/vault content for preservation assertions. Never test against the user's personal vault or publish simply to obtain evidence. Hashes bind identity, not permission.

The small fixtures are Request Board (Angular webapp) and Quick Capture (Vue/Nuxt UI Obsidian plugin); the full Workbench self-project remains mandatory. Their detailed UI/data contracts are baselined in WM-01/02 before implementation, not invented by a test after observing output.

## Scenarios

### WVA-01 — Current capabilities and shared contracts

**Given** exact current source, supported legacy exports and versioned schema fixtures, **when** the CLI/browser paths validate or migrate them, **then** their accepted/rejected semantics agree and stable IDs, revisions and declared content survive. Confirm existing `project schema`, `project validate`, scoped generation and resume before opening replacement work. Unknown versions, unsafe shapes and invalid executable references fail without mutation. Transport-valid planning data may still have explicit generation-readiness findings.

**Evidence:** shared positive/negative fixtures, schema discovery, migration/semantic comparisons and source capability matrix. **Packages:** WM-01/02. **Legacy:** A08/A09/A17/A18.

### WVA-02 — User settings, migration and non-default paths

**Given** legacy-only, new-only, both-agreeing, both-conflicting, corrupt and future-version configurations, **when** settings are inspected/migrated, **then** the resolver explains each effective value; conflicts require a reviewed choice; original content remains recoverable. Changing a setting never silently relocates existing files. Run source/test/docs/preview generation using non-default roots; reject overlap, case conflicts, traversal, reserved destinations and symlink escapes before writing.

**Evidence:** exact before/after bytes, migration/recovery plan, resolved settings and downstream path checks. **Packages:** WM-03/11/14. **Legacy:** A03/A04/A08/A13.

### WVA-03 — A starter is an external definition

**Given** an engine and `configs/starters/<starterName>.json`, **when** a starter's metadata, parameter or ordinary generated content changes, **then** list/edit/plan/execute reflects that definition without modifying engine code or a duplicate registration. A starter can express a bounded dependency sequence of existing operations; it cannot invent an executable primitive. Edited user copies expose their changed identity/hash. Unknown operation types, dependency cycles and incompatible versions are rejected.

**Evidence:** unchanged engine hash, definition diff, discovery output and reviewed resulting plan. **Packages:** WM-04. **Legacy:** A02/A08/A17/A18.

### WVA-04 — Separate starter distribution and unsafe archives

**Given** the exact engine ZIP and separate starter ZIP, **when** they are inspected/extracted, **then** the engine contains no starter definitions, including hidden examples/template copies; the pack supplies advertised starters and provenance. Without a pack, starter selection explains the missing requirement while project-JSON intake remains usable. Reject traversal, absolute/duplicate/case-conflicting entries, unsupported links, oversized/decompression-bound violations and tampered required resources. Preserve a previously installed working pack on failed update.

**Evidence:** archive inventories, compatibility/checksum results, no-pack flow and negative fixtures. **Packages:** WM-04/14/16. **Legacy:** A01/A02/A08/A17.

### WVA-05 — Existing Angular project-vault and PRDs

**Given** an existing Git repository opened as an Obsidian project-vault with typed PRDs in the configured `docs/prds` path, **when** the extracted CLI runs setup, **then** it offers target/framework, paths, product/project description, selected PRD files or reviewed folder scan, starter/JSON input, prototype choice and first-run choice. Invalid or duplicate PRDs receive actionable locations; their presence never authorizes silent partial intake. Existing Git/remotes/notes/security settings are unchanged. `new` retains its existing stricter placement contract.

**Evidence:** complete interactive transcript, equivalent non-TTY requests, reviewed file plan and preserved-content hashes. **Packages:** WM-05/07. **Legacy:** A02–A04/A18.

### WVA-06 — Prepare only and skip first run

**Given** selected setup/prototype options, **when** the user declines first run, **then** only explicitly approved source/config/docs preparation occurs; no package install, build, browser launch, server start, native installation or activation occurs. Selecting prototype preparation alone does not grant execution. Cancellation before applying a plan produces no project changes. Later help/status identifies the exact next supported operation without labeling the project built/tested.

**Evidence:** process-spawn/network spies for negative assertions, filesystem snapshots and CLI outcomes. **Packages:** WM-05/06. **Legacy:** A04/A18.

### WVA-07 — Selected first run, failure and resume

**Given** explicit approval for selected target-specific install/build/verify/showcase steps, **when** execution succeeds, fails or is interrupted, **then** each step has an honest independent result and downstream work stops on failure. Lock mismatch requires separate resolution/review rather than silently running a different install. Changed settings/starter/model/source/lockfile invalidates affected approvals. Port conflict, existing process, registry error, missing tool and interrupted stage produce safe recovery; unrelated processes remain untouched.

**Evidence:** successful independent run, injected failures/cancellation, process ownership, fresh-resume hashes and actual readiness of showcased output. **Packages:** WM-06/16. **Legacy:** A01/A04/A17/A18.

### WVA-08 — Typed Markdown import and competing edits

**Given** pages, components, interactions and journeys in typed Markdown, **when** a file or folder is inspected/imported, **then** stable IDs, declared fields and cross-file references map to the shared project. Filenames alone are not identity. Reimport is a no-op when unchanged. Rename, missing reference, duplicate ID, future schema, invalid frontmatter, unsupported type and competing edits produce defined outcomes. Preserve unrelated frontmatter and prose; do not execute embedded HTML/scripts or remote includes. A cancelled/stale plan preserves the prior project.

**Evidence:** round-trip fixtures, owned-field merge/conflict cases, source locations, exact bytes and zero-execution assertions. **Packages:** WM-02/07/14. **Legacy:** A08/A09/A13/A14; extends the MVP with typed-document behavior.

### WVA-09 — Documentation completeness, freshness and preservation

**Given** a project with meaningful authored explanations, **when** its documentation structure is generated, **then** the index and page/component/interaction/journey documents contain correct stable references, behavior, usages and visible limitations. A component or journey change marks affected docs stale until reviewed update. Repeated export is a no-op; prose/foreign properties survive; removal proposes retirement rather than deleting notes. Generated docs do not overwrite the authored import root by default or include credentials, local approvals or session drafts.

**Evidence:** link/content assertions, provenance, stale/update/conflict cases and handwritten preservation checks. **Packages:** WM-08. **Legacy:** A09/A13/A17/A18; extends the MVP documentation promise.

### WVA-10 — Design-only and focused authoring

**Given** a clean authoring session without external Node/npm/Git or an account, **when** the user creates a page and reusable component, edits properties/bindings, adds context and previews, **then** the supported design-only journey works. Keyboard/non-drag paths reach core outcomes. Undo/redo, dirty-state warnings, component-versus-instance scope and contextual Back remain correct. No undocumented maintainer step or nested application shell is needed.

**Evidence:** real rendered interaction tests, observed task replay, focus/draft assertions and environment description. **Packages:** WM-09/15. **Legacy:** A05/A07/A18/A20.

### WVA-11 — Shared-component revision and journey impact

**Given** two pages sharing a pinned component and a linked journey, **when** its contract changes, **then** affected usages, incompatible bindings, related docs and relevant generated outputs are identified before migration. Updating selected usages preserves other pins and instance overrides. Moving/renaming a surface does not silently rewrite routes; dragging changes geometry only. Test branching journeys, modal return, deletion impact, cycles and contextual editor navigation.

**Evidence:** impact/dependency graph assertions, before/after model equality outside scope, real interaction and explicit revision migration. **Packages:** WM-02/10/12. **Legacy:** A05–A10/A13.

### WVA-12 — Real generated Obsidian UI

**Given** the accepted Quick Capture model and compatible kit, **when** an independent project is generated/built, **then** the authored layouts, components, bindings, states, commands/settings and supported local behavior appear in the actual plugin. Test fixture mode separately from the explicitly implemented note-backed workflow. Compile success does not stand in for real native persistence/theme/lifecycle evidence. Correct the model/modules/compiler, never manually patch disposable generated output to pass.

**Evidence:** input/output/build hashes, generated source review, browser assertions where relevant, and real isolated native assertions. **Packages:** WM-09/11/15/16. **Legacy:** A10/A11/A17/A19.

### WVA-13 — Real generated Angular webapp and path flexibility

**Given** the accepted Request Board definition, Angular target and non-default source/test/docs roots, **when** generation, explicit dependency handling and build run, **then** the actual UI—not just route placeholders—matches the supported definition. Exercise components, form validation, lists, local state, navigation/dialog return and error/empty/loading/disabled states. No Obsidian host dependency or maintainer path may enter browser runtime. Rebuild after a declared component change and verify refreshed docs.

**Evidence:** independent compile/build, real browser behavior, import-boundary checks and generated path/content assertions. **Packages:** WM-03/09/11/16. **Legacy:** A03/A10/A11/A13/A17; adds the primary webapp proof.

### WVA-14 — Scoped regeneration and mid-write recovery

**Given** an independently edited consumer, **when** a feature/page/component scope is generated, **then** the plan includes its required shared dependencies, registrations and corresponding tests/docs, and preserves unrelated outputs. Identical replay is a no-op. Edited managed files, missing dependencies and stale review hashes block the write. Retired files are not silently deleted. Inject a failure during application and verify the exact recovery/rollback result; do not claim filesystem-wide atomicity or blindly retry uncertain writes.

**Evidence:** scoped artifact inventories, no-op diffs, preserved extension hashes, stale-plan and mid-write failure tests. **Packages:** WM-12/14/16. **Legacy:** A10/A13/A14.

### WVA-15 — Honest offline preview

**Given** generated editable source, **when** the single-file preview opens with network disabled, **then** declared navigation, modal return and supported local effects work; fixtures are labeled and resettable; no live vault/provider or publication call occurs. Loading/error/empty/disabled scenarios are intentional. A simulated save must not claim a real durable write. Embedded assets/licenses and browser compatibility follow the supported contract. Compare semantic output with the authored model, not only screenshots.

**Evidence:** actual file-origin browser run, network-denial assertions, interaction inventory, source/output hashes and manual visual review. **Packages:** WM-11/15. **Legacy:** A11/A17/A20.

### WVA-16 — Developer-owned implementation and independent continuation

**Given** generated source and handover docs, **when** a developer stops using Workbench, **then** ordinary project commands still build/test it and explain unfinished adapters. Implement one declared business hook in developer-owned code; validate its real success/error behavior; regenerate afterward. That implementation and its tests survive. Generated stubs/TODOs cannot be counted as business acceptance, and missing required Workbench editor capabilities cannot be excused as ordinary user hooks.

**Evidence:** maintainer/authoring-dependency isolation, developer task replay, source preservation and actual hook tests. **Packages:** WM-11–13/16. **Legacy:** A10/A13/A17/A18.

### WVA-17 — Full generated native Workbench

**Given** SH-022/SH-034/CX-007 prerequisites and the full reconciled self-project export, **when** that definition and shipped kit generate Workbench in a clean workspace, **then** all retained required authoring capabilities work natively without copying source manually, an iframe or placeholder editor engines. Exercise import, sitemap/page/component edits, connected docs, persistence, close/reopen, multiple leaves, failure/conflict recovery, export and regeneration. Preserve self-project capabilities and component pins; reconcile intentional changes explicitly.

**Evidence:** whole-capability inventory, independent build, actual isolated native protocols and CP-010 evidence. **Packages:** WM-17. **Legacy:** A09/A12/A17/A19; all original native scope remains mandatory.

### WVA-18 — Security, accessibility and performance evidence

Run separate subprotocols: **S** hostile input/process/path/export boundaries and retained quality gates; **A** keyboard/no-drag, focus, screen-reader, error/status, contrast/reflow/theme/language behavior; **P** model and rendered/native timings, resources and repeated open/close lifecycle. Test both small fixtures and the full self-project. Record environments, budgets and percentile definitions; retain stricter established thresholds. An automated scan does not replace manual/native work, and a model microbenchmark does not prove UI responsiveness.

**Evidence:** distinct S/A/P reports per applicable target with negative controls, measured results and unresolved blockers. **Packages:** WM-14/15/17. **Legacy:** A08/A13/A17/A19/A20.

### WVA-19 — Exact archives, release separation and support

**Given** an eligible fixed candidate, **when** local preparation/rehearsal runs, **then** it never tags/pushes/publishes and missing/mismatched evidence blocks readiness. Verify release profiles for framework, generated consumer and native Workbench separately. Test denied authorization, changed candidate, partial upload and foreign release protection in the retained appropriate test modes. Real publication requires new explicit approval; then redownload approved bytes and execute installation/recovery smoke. Engine/starter packaging remains separate and help/support names the actual artifacts.

**Evidence:** all-OS extracted-kit tests, candidate receipts, authorization/recovery protocols, support walkthrough and approved remote evidence only when authorized. **Packages:** WM-16/19. **Legacy:** A01–A04/A15–A18.

### WVA-20 — First-change and second-change product value

**Given** equivalent accepted tasks performed manually and with Workbench, **when** participants build the first documented UI and make a later shared-component change, **then** record hands-on/elapsed time, tool familiarity, order/learning effects, assistance, rework, documentation gaps and all quality results. Include finding the next action and continuing in source. No time advantage is claimed for reduced scope or weaker acceptance. Findings guide product changes; a small recruited sample is not market-wide proof.

**Evidence:** voluntary study protocol, task/output parity, observations, limits and decisions. No silent telemetry. **Packages:** WM-08/13/18. **Legacy:** supplements A18/A20; validates the three vision promises.

## Retained acceptance crosswalk

These associations identify relevant extended scenarios, not replacement tests or automatic completion. Every original assertion still needs its own evidence.

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
scenario: WVA-XX
candidateCommit: required
candidateTree: required
engineArtifactHash: required-when-used
starterArtifactHash: required-when-used
modelHash: required-when-used
targetAndFramework: required
environmentAndTools: required
protocolOrCommand: required
mode: contract-or-filesystem-or-build-or-browser-or-native-or-manual-or-release-or-study
result: not-run
artifacts: []
limitations: []
retainedAcceptanceCases: []
approvalReference: only-for-actually-authorized-external-actions
```

This is a proposed recording template, not a new executable schema or an authorization artifact. Bind approval references to an existing approved mechanism; do not place credentials or reusable permissions in portable project data. Documentation of a planned test does not establish its execution.
