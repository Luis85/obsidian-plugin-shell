# PR #5 — Product Review and Comprehensive Improvement / Polishing Plan

**Repository:** `Luis85/obsidian-plugin-shell`  
**PR:** #5 — `feat(companion): Project Starters, Vue Flow editors and generated plugin shells`  
**Review date:** 2026-09-30, after 19:05 CEST  
**Reviewed product source baseline:** `b39801796e0c2b3ab56f39641e7645fe698ed671`  
**Latest inspected PR head:** `e6afd4ece1832be927316438c9894138fbd2bfe5` (one subsequent commit; only analysis-fixture file staging tests changed)  
**Base at snapshot:** `8ae575fffb4912100d9360f3592d62d0fec61c79`  
**Status:** PR open, unmerged. No repository release existed at the review snapshot. At the last exact-head check, 39 of 67 checks were successful, 27 queued/in progress and one neutral; there were no reported failing conclusions yet. Pending checks are not passes.

## 1. Executive assessment

PR #5 has evolved from a Companion concept into a broad application-development platform containing a reusable Obsidian shell, typed CLI, TUI/maker experience, project schema, compiler, clickdummy pipeline, Journey Lens, visual page/component design, semantic/data modeling, test-data tooling, design-system support, native integration starters, optional Storybook/Airship/Hindsight/Jev tooling, agent-oriented workflows and extensive qualification infrastructure.

That breadth is now both the strongest asset and the largest product risk.

The technical foundation is substantially stronger than it was in the 2026-09-27 PR5 review. Several earlier P0 gaps now have real implementations:

- public Companion project-v6 schema discovery and validation;
- selected feature/page/component generation with dependency closure;
- extracted-kit setup and resumable staged execution;
- generated native Journey Lens integration with project editing and real-host lifecycle tests;
- authored scenario handling in generated previews;
- stronger journey editing and branching support;
- optional Storybook generation/workspace qualification;
- local support reports and model-operation measurement;
- broader collection/source bindings and typed source actions;
- repair of the earlier Hindsight Python maintainability-inventory problem.

The product is therefore no longer primarily blocked by missing low-level framework primitives. It is blocked by **product convergence**:

1. **The complete Companion is not yet native.** Journey Lens is the first serious native editor, but page/component authoring and the remainder of the concept are not yet a complete, accepted native product.
2. **The product story is fragmented.** Shell, kit, Companion, clickdummy, generated plugin, TUI, starter catalog, Storybook, Airship, Hindsight, Jev, prototype skill and agent workflows compete for attention.
3. **The concept/native persistence boundary is unresolved at product level.** The native Journey Lens proves safe JSON-file authoring, while the long-term Companion contract calls for real Obsidian-native canonical records and Markdown/document services with JSON as interchange/compiler input.
4. **Evidence volume exceeds evidence clarity.** The repository has very broad tests and historical records, but a reviewer still needs substantial archaeology to answer “what does the exact current candidate support?”
5. **The current PR is too large to reason about as one product increment.** At the review snapshot GitHub reported 1,626 changed files, roughly 364k additions and 564 deletions. This is an integration branch, not a normal review unit.

The next iteration should therefore be a **convergence and productization iteration**, not another breadth-expansion iteration.

## 2. Product north star

The clearest differentiated promise is:

> **Describe an application once, review it visually and structurally, generate developer-owned source, verify it, and keep iterating without losing ownership or hiding unsupported behavior.**

The platform should optimize a single loop:

**Brainstorm / define → structure → design → model data → prototype → generate → verify → develop → regenerate safely → release**

Everything in PR5 should justify itself by improving this loop.

### Primary personas

1. **Independent developer** — wants to reach a working project quickly and retain control of generated code.
2. **Product-oriented builder / PO** — wants to describe a product, pages, journeys, data and acceptance without needing to write framework code.
3. **Coding agent** — needs deterministic, discoverable, machine-readable operations equivalent to human CLI/TUI capabilities.
4. **Framework maintainer** — needs safe migrations, bounded contracts, reliable evidence and clear compatibility ownership.

Optional tools may serve these users, but must not create alternate default journeys.

## 3. Product-perspective review

### 3.1 Product strategy and positioning — strong foundation, weak packaging

**What works**

- The project has a differentiated end-to-end concept rather than a generic code generator.
- Developer ownership, guarded regeneration and explicit unsupported behavior are strong product principles.
- Companion-as-authoring-surface plus shell-as-execution-platform is a coherent architecture.

**Issues**

- The repository currently presents several products at once: template/framework, CLI/TUI, Companion, clickdummy generator, generated plugins, optional design tooling and agent tooling.
- Adjacent capabilities increasingly look equal to the core product even when they are intentionally optional.
- The product can be described technically in many ways, but there is not yet one short, user-facing promise and one default path.

**Recommendation**

Adopt an explicit product hierarchy:

- **Shell / Developer Kit** — reusable framework and execution layer.
- **Companion** — visual/structured authoring application.
- **Generated Project** — developer-owned output.
- **Clickdummy** — review artifact generated from the same definitions.
- **Optional tooling** — Storybook, Airship, Hindsight, Jev, prototype-design skill.

Only the first four belong in the default product narrative.

### 3.2 Scope and product boundaries — needs aggressive clarification

PR5 has excellent boundary documentation, but the user experience still risks “capability soup.” Optional integrations should not appear as equal first-run decisions.

Create three modes of disclosure:

- **Core:** project, requirements, sitemap/journeys, page/component design, data, prototype, generation, verification.
- **Advanced:** source adapters, design-system export, Storybook, detailed runtime/test tooling.
- **Experimental/optional:** memory, Jev automation concepts, agent-specific accelerators.

A feature should not move from Advanced/Experimental into Core merely because its tests are green.

### 3.3 Jobs-to-be-done — technically supported, not yet simplified

The main jobs are now supported in pieces, but need coherent completion:

- “Start a project without understanding the repository.”
- “Turn an idea into a structured feature.”
- “See and edit the application flow.”
- “Design a page and reusable components.”
- “Declare the data the page uses.”
- “Generate something I can show.”
- “Generate code I can own.”
- “Change one feature later without destroying my edits.”
- “Understand exactly what still needs implementation.”

The product should be evaluated against these jobs rather than the number of editors, commands or checks.

### 3.4 Information architecture — capable but over-layered

The Companion concept has improved substantially, but users still encounter multiple navigation systems: workbench stages, project/sidebar navigation, editor-specific outlines, canvas controls, inspectors and modal subflows.

Recommended top-level IA:

1. **Overview** — project status, findings, next action.
2. **Define** — vision, requirements, features, actors.
3. **Structure** — sitemap, journeys, storymaps.
4. **Design** — pages, components, design system.
5. **Data** — entities, relationships, sources, collections, test data.
6. **Prototype** — scenarios, clickdummy, review.
7. **Build** — generation, development handoff, scoped regeneration.
8. **Quality** — evidence, acceptance, diagnostics.
9. **Release** — candidate preparation only when relevant.

Within an editor, use a focused three-region grammar: Navigator/Outline, workspace, Inspector. Hide secondary global navigation while the user is doing high-focus editing.

### 3.5 Onboarding and first success — improved technically, still too infrastructural

The extracted-kit setup and resume flow are strong additions. The first-run execution wizard also clearly separates source generation from process execution.

The remaining problem is that first success is still framed mainly around infrastructure rather than outcome.

The first 10-minute success path should be:

1. create/open project;
2. choose blank or starter;
3. create one feature;
4. add two pages;
5. connect a journey;
6. add one component/data binding;
7. preview one scenario;
8. export/generate clickdummy;
9. optionally generate/build project.

Do not ask users to understand release profiles, Storybook, memory, provider tooling or detailed compiler states during this journey.

### 3.6 TUI / CLI / agent experience — major differentiator, needs one operation model

The typed CLI catalog is broad and safety-conscious. The TUI/maker layer can become a differentiator if it remains a presentation over the same domain operations.

Product rules:

- every meaningful TUI action has a versioned machine/agent equivalent;
- every agent operation has the same validation, planning and write boundaries as the human operation;
- no TUI-only hidden semantics;
- no prompt-specific JSON shape that bypasses the canonical project schema;
- human-readable summaries and JSON mode are two renderings of the same result.

The proposed **Brainstorm** use case should be implemented as the earliest stage of this same operation model, not as another isolated assistant:

- `brainstorm project`
- `brainstorm feature`
- produces/revises canonical project/feature definitions;
- collects name, purpose, actors, entities, pages, interactions, data, acceptance and open questions;
- can hand off to prototype generation or project generation only after review;
- exposes the same structured operations to coding agents.

### 3.7 Sitemap / Journey Lens — strongest editor vertical slice

Journey Lens now has the clearest path from concept to generated native behavior. The explicit separation of hierarchy, routes, navigation actions, journey overlays and canvas arrangement should be retained.

Remaining polish:

- make unresolved journey steps and missing actions visible in-context;
- support deterministic arrange/fit/focus without silently rewriting user layout;
- keep keyboard/no-drag equivalence;
- reduce inspector/canvas competition in narrow leaves;
- provide a journey review mode that shows only the current path and branch decisions.

The generated native Journey Lens should be treated as the reference pattern for porting the other editors.

### 3.8 Visual Page and Component editors — high product value, still a conversion gap

The shared declarative IR, component revisions, typed props/slots/emits, scenarios and generator linkage are strategically strong.

The biggest gap is no longer the model. It is **native product parity** and generated-runtime fidelity.

Prioritize:

- first insertion and empty states;
- deep nested selection/breadcrumbs;
- component-instance scope versus definition scope;
- explicit binding inspection;
- responsive preview states;
- impact preview before component-contract change;
- real generated component behavior where it is declared, explicit TODO where it is not;
- native save/reopen/recovery using the same project owner as Journey Lens.

### 3.9 Requirements and Storymaps — valuable, but need clearer role separation

Requirements, Storymaps, Sitemap/Journeys and Pages overlap conceptually for non-expert users.

Clarify:

- **Requirement:** what must be true.
- **Storymap:** how work/value is decomposed and sequenced.
- **Sitemap:** what surfaces exist and how they relate structurally.
- **Journey:** how an actor moves through surfaces to achieve an outcome.
- **Page design:** what one surface contains.

Cross-links should be visible but not turn every surface into an everything-editor.

### 3.10 Semantic model, entities, sources and Collections — maturing well, needs product semantics

Recent Collection/source work materially improves the implementation story. The model now needs stronger user-facing semantics:

- distinguish Entity, Collection, Source and Operation consistently;
- show which source operations are executable, simulated, or unimplemented;
- surface relationship constraints before generation;
- explain that in-process relationship preflight is not a cross-file transaction;
- present conflict/recovery language in product terms rather than repository terms.

For service/database/API integrations, generated ports should remain explicit extension points unless an approved provider implementation exists.

### 3.11 Project schema and interoperability — substantially improved

The v6 public schema/discovery work closes an important earlier gap. Keep the separation between:

- operation protocol;
- project transport schema;
- concept intake;
- visual IR;
- executable compiler semantics.

Next improvements:

- publish schema compatibility/support policy;
- add a compact schema changelog;
- generate human-readable migration notes per version;
- keep positive/negative fixture parity across browser and Node;
- consider extension namespaces only after the core format stabilizes.

### 3.12 Generator and scoped regeneration — strong architecture, needs clearer UX

Selected feature/page/component generation is now implemented. The current behavior correctly requires an existing compatible project for narrow regeneration.

Product copy should call this **scoped regeneration**, not imply an independent partial-project build.

Every plan should show:

- requested scope;
- included dependency closure;
- shared artifacts;
- retained/excluded artifacts;
- conflicts;
- files that would retire but are preserved;
- post-generation verification obligations.

A visual “why is this file included?” dependency path would materially improve trust.

### 3.13 Clickdummy and prototype fidelity — still below the authoring experience

The clickdummy is now structurally legitimate: it is generated from actual generated Vue source and supports scenarios. The remaining problem is product quality.

A generated prototype should feel like a useful product review artifact, not a compiler diagnostic page.

Create two permanent golden review projects:

1. a small task/capture product;
2. the Companion self-project.

For each, review:

- hierarchy and information density;
- realistic copy;
- component states;
- navigation and modal return;
- data scenarios;
- empty/error/loading states;
- responsive behavior;
- keyboard flow;
- visual comparison against approved semantic expectations.

### 3.14 Native Obsidian product — current critical path

The native Journey Lens is a major milestone, but it must not be mistaken for full Companion conversion.

The most important architectural decision is the canonical native authoring model.

Current generated Journey Lens edits a portable `project.companion.json` file. The broader Companion product contract also calls for genuine Obsidian-native persistence through shared document/repository services, with JSON as interchange/compiler input.

Resolve this explicitly before porting every editor:

- **JSON remains the complete portable snapshot and compiler handoff.**
- **Native authoring data is owned by one project repository/aggregate.**
- Project content that should be human-readable in Obsidian uses canonical Markdown/frontmatter/document services.
- Native views have independent drafts but share committed project state.
- Export produces canonical v6 JSON.
- Import is reviewed and transactional at the project boundary.

Do not allow each editor to invent its own persistence strategy.

### 3.15 Starter ecosystem — strategically useful, current transition must be atomic

PR5 currently contains the original integrated starter model. Stacked PR #54 proposes external declarative starter definitions and a separate starter pack with 14 definitions, including a Companion golden template and feature showcase.

The direction is good because it keeps the shell distribution generic, but it should land as one explicit product decision.

Required contracts:

- starter definition schema/version;
- shell compatibility range;
- immutable starter version/hash;
- local/offline import;
- update versus new-project semantics;
- separate starter-pack release identity;
- one discoverable catalog/index file;
- no hard-coded starter IDs in shell core;
- clear distinction between examples, templates and fully implemented runtime capabilities.

Do not let the current 11 embedded-starter story and PR54’s 14 external-starter story coexist in user docs after integration.

### 3.16 Accessibility and localization — evidence exists, qualification remains incomplete

Strengths include focus handling, labels, modal behavior, no-drag controls and narrow-layout tests.

Still required before strong accessibility claims:

- screen-reader task execution;
- focus order/return across native leaves and modal transitions;
- keyboard-only graph editing;
- zoom/reflow at narrow native widths;
- target-size/spacing review;
- contrast of generated and native states;
- reduced-motion behavior;
- translated-string growth and fallback behavior.

Browser assertions do not substitute for native assistive-technology evidence.

### 3.17 Performance and scalability — measurement infrastructure exists, product budgets do not

`project measure` is a good foundation but only covers model operations.

Add end-to-end budgets for:

- project open/import;
- canvas initial render;
- selection/navigation p95;
- typing/commit latency;
- undo/redo;
- arrangement;
- generated preview startup;
- native open/close cycles;
- memory/listener growth;
- full generation and scoped regeneration.

Use small, representative and bounded-large fixtures. Keep the PRD’s 250-surface/500-transition fixture and record machine/tool metadata.

### 3.18 Security, privacy and trust — strong principles, needs one joined threat model

The product already does many things correctly: inert JSON, reviewed plans, separate execution consent, stale-plan refusal, bounded inputs, no automatic publishing and allowlisted support reports.

Now consolidate these into one threat model spanning:

- imported project/starter/concept data;
- package/dependency execution;
- native vault writes;
- external providers;
- optional memory/tooling;
- support/evidence exports;
- release authorization.

Make trust state visible in UI: **data-only**, **local process**, **native vault write**, **network/provider**, **release mutation**.

### 3.19 Architecture and maintainability — technically disciplined, organizationally expensive

The project has strong boundaries, generated-code rules and regression coverage. The risk is now coordination cost.

Main issues:

- many compatibility seams and historical paths;
- very large PR integration scope;
- documentation and evidence duplication;
- expensive CI with recurring timeouts/queue pressure;
- optional capabilities creating more matrix dimensions.

Introduce explicit owners for:

- project schema;
- visual IR;
- compiler;
- shell public API;
- native Companion project store;
- TUI/agent protocol;
- starter format;
- optional tooling.

Material changes to one owner’s contract require a small compatibility review, not a repository-wide conceptual rewrite.

### 3.20 Quality and evidence — extensive but too difficult to consume

The repository’s strongest engineering characteristic is its refusal to relabel partial evidence as acceptance. Preserve that.

The next improvement is not “more tests.” It is **evidence compression**.

Create one generated candidate manifest:

```text
candidate
  source commit/tree
  toolchain
  project schema
  kit hash
  generated consumer hashes
  acceptance IDs
    state: pass | fail | blocked | not-run
    producer
    artifact
    scope
  known limitations
```

Render this into both human Markdown and machine JSON. Historical records remain immutable, but “current status” should be generated from current task/evidence inputs.

### 3.21 CI / developer flow — correctness strong, feedback economics weak

At the last check the new head had triggered 67 check runs, of which 39 had passed and 27 were queued/in progress (one neutral). The repository has also recently needed multiple timeout/headroom repairs.

Do not weaken release gates, but restructure execution:

- fast deterministic contract/static unit lane;
- compiler/generator integration lane;
- browser lane;
- native lane;
- optional-tooling lane;
- complete merge-candidate/release qualification lane.

Use caching, sharding and provenance-aware reuse only where it cannot hide changed inputs. Full release qualification remains mandatory on the exact candidate.

### 3.22 Documentation and support — rich but status drift is recurring

The 2026-09-27 PR5 review is already partially stale because several listed P0 gaps have since been implemented. The PR body still points to that review as the latest comprehensive assessment.

Replace hand-maintained status prose with:

- one generated `CURRENT-STATUS.md`;
- one concise user manual entry;
- one architecture map;
- one current capability matrix;
- historical reviews clearly marked as historical.

The allowlisted local support report is good. Integrate it into troubleshooting flows rather than making users discover it manually.

### 3.23 Release and adoption — intentionally incomplete

No release existed at the review snapshot. This is correct given the stated gates.

Before shipping, add a small usability/adoption evidence set:

- first success time;
- points where help is requested;
- setup failure categories;
- successful regenerate-after-edit rate;
- support-report frequency/reason;
- qualitative confidence after prototype generation.

No telemetry needs to be introduced; these can be collected in controlled usability sessions and support cases.

## 4. Delta against the 2026-09-27 PR5 improvement plan

| Previous package | Current review |
| --- | --- |
| IP-01 current status/docs | **Still required.** Status drift has already recurred after rapid implementation. |
| IP-02 extracted-kit onboarding | **Substantially implemented**, including starter/JSON setup and resume. Exact final release-archive acceptance remains. |
| IP-03 public v6 schema | **Implemented in source.** Requalify current head and stabilize compatibility policy. |
| IP-04 scoped generation | **Implemented in source.** Improve UX/explanation and complete current-head acceptance. |
| IP-05 clickdummy fidelity | **Still open / important.** Generated output needs product-level polish. |
| IP-06 focused authoring | **Partially improved.** Still needs task-based usability evidence and further decluttering. |
| IP-07 editor completeness | **Improved**, especially Journey Lens; broader native/editor parity remains. |
| IP-08 accessibility/localization | **Partial.** Manual/native AT evidence remains. |
| IP-09 native starter behavior | **Much stronger evidence exists**, but current exact-head qualification must finish. |
| IP-10 complete native Companion | **Still the main product gap.** Journey Lens is a vertical slice, not complete conversion. |
| IP-11 candidate quality/evidence | Former Python inventory blocker is repaired; **current head still needs complete candidate-bound CI**. |
| IP-12 performance | Measurement tooling exists; UI/native budgets and acceptance remain. |
| IP-13 security/support | Allowlisted support report exists; joined threat model and recovery UX remain. |
| IP-14 optional tools | Considerably expanded/qualified; keep outside default critical path. |
| IP-15 publication | **Not started by design.** No public release at snapshot. |

## 5. Comprehensive improvement and polishing plan

The plan below does **not** create a parallel backlog. Where possible, update the existing SH/CX/CP/PUB task files and IP work packages. Create new task IDs only for genuinely new accepted scope such as Brainstorm.

### Phase 0 — Establish one current truth

#### PP-01 — Generate a live capability and acceptance dashboard — P0

**Goal:** A reviewer can answer what the exact head supports in under five minutes.

Implement:

- generated capability matrix from code/catalog/task/evidence inputs;
- generated A01–A20 current-state table;
- source/tool/artifact identities;
- separation of browser, generated-source, native, manual and release evidence;
- explicit “pending current head” state.

**Acceptance:** no manually maintained completion count; every claim links to exact producer/candidate; historical records cannot override current evidence.

#### PP-02 — Reconcile PR5 status, docs and product vocabulary — P0

Update PR body/current-status docs after current CI stabilizes. Standardize terms: Project, Feature, Surface, Page, Component, Journey, Storymap, Entity, Collection, Source, Operation, Prototype, Generated Project.

**Acceptance:** CLI help, TUI, Companion, manual and generated docs use the same terms.

### Phase 1 — Product simplification and first success

#### PP-03 — Define the product hierarchy and hide optional complexity — P0/P1

Implement Core / Advanced / Optional disclosure. Move Storybook/Airship/Hindsight/Jev out of first-run navigation.

**Acceptance:** a new user can complete the core journey without encountering optional integrations unless explicitly opened.

#### PP-04 — Unified first-success journey — P0

Create one guided path from blank/starter to a two-page working prototype and generated project.

**Acceptance scenario:** blank/starter → feature → pages → journey → component/data → scenario → clickdummy → generate. Record time, errors, assistance and confidence with a small mixed user group.

#### PP-05 — Focused workbench mode — P1

While editing, collapse secondary project/navigation chrome, retain contextual Back, show one next action and a stable draft/save indicator.

**Acceptance:** 880px/narrow native leaf remains usable without canvas-obscuring persistent chrome.

### Phase 2 — Lock the native Companion foundation

#### PP-06 — Decide and implement canonical native project persistence — P0

Resolve JSON-vs-native authoring ownership before porting more editors.

Target:

- one application-level project repository;
- Markdown/document-backed canonical records where required for Obsidian-native authoring;
- JSON import/export as portable snapshot/compiler handoff;
- one revision/concurrency model;
- independent per-view drafts;
- explicit recovery for uncertain writes.

**Acceptance:** two native leaves edit the same project safely; save/reopen survives restart; unrelated Markdown/body/frontmatter survives; stale writes fail without data loss; export/reimport is semantically stable.

#### PP-07 — Freeze CX-007 native conversion baseline — P0

Create the formal bounded native scope rather than implicitly porting all concept screens.

Recommended **Core Companion MVP native scope**:

- project overview/import/export;
- requirements/features;
- Journey Lens/sitemap;
- Page editor;
- Component editor/library;
- entities/relationships;
- data sources/collections/test data;
- design system;
- prototype/clickdummy handoff;
- prepare/generate/quality handoff.

Storymaps may remain in the first native scope if its cross-link value is considered essential; optional memory/Jev/Storybook/Airship are not prerequisites.

**Acceptance:** every included behavior maps to shell capability + acceptance; every deferred surface is named.

### Phase 3 — Complete the native authoring loop

#### PP-08 — Port Page + Component editors using the Journey Lens pattern — P0

Reuse one project store, native adapter pattern and generated module contract.

**Acceptance:** open/edit/save/reopen; component revision pins; contract-change impact; nested selection; keyboard operations; import/export/regeneration.

#### PP-09 — Port semantic/data editors — P0/P1

Entities, relationships, sources, Collections, operations and test data.

**Acceptance:** generated native project reads/writes declared managed Markdown safely; external adapters remain explicit; relationship constraint failures are explained before write.

#### PP-10 — Port requirements / Storymaps / Design System integrations — P1

Do not make each a separate product island. Preserve cross-links/context and shared history rules.

**Acceptance:** requirement → storymap/journey → page → component/data trace can be followed and returned from without identity duplication.

### Phase 4 — Generated output quality

#### PP-11 — Golden project visual/runtime parity — P0/P1

Use two permanent golden projects. Add semantic visual review, not just screenshot acceptance.

**Acceptance:** generated clickdummy has coherent hierarchy/copy/spacing; all declared navigation/local effects/scenarios work; no manual edits after generation.

#### PP-12 — Reduce TODO surface in generated runtime — P0

Classify every generated obligation:

- implemented platform behavior;
- application-specific adapter;
- application-specific business rule;
- deliberately unsupported.

**Acceptance:** no “successful” generated control has an implicit TODO behind it; remaining TODOs are visible in Companion, generation receipt and generated project docs.

#### PP-13 — Scoped-regeneration impact UX — P1

Show dependency closure graph and “why included” explanations.

**Acceptance:** user can understand and approve what a feature/page/component regeneration will touch without reading compiler internals.

### Phase 5 — Starters, TUI and agent workflow

#### PP-14 — Integrate external starter-pack direction atomically — P0/P1

Treat PR54 as a product migration, not a file move.

**Acceptance:** shell contains no hard-coded starter catalog; starter pack has independent version/hash; compatibility is validated; Companion first-run and CLI/TUI use the same external definitions; old embedded-starter docs are removed/relabelled in the same integration.

#### PP-15 — TUI workflow simplification — P1

Organize TUI around jobs rather than command inventory:

- Create/Open Project
- Brainstorm
- Design
- Prototype
- Generate
- Develop/Test
- Quality
- Release
- Settings/Advanced

**Acceptance:** expert CLI remains fully available; common TUI path does not expose low-level operations prematurely.

#### PP-16 — Brainstorm Project / Brainstorm Feature — P1, new accepted product scope

Use the canonical operation layer.

**Feature flow:** name → purpose/outcome → actors → entities/data → pages → interactions/journey → acceptance → open questions → review generated definition → optional prototype → optional project boilerplate → optional build/test.

**Agent parity:** versioned JSON request/result, noninteractive mode, same validation and writes as TUI.

**Acceptance:** TUI and agent produce semantically equivalent canonical definitions; no prototype/build runs without separate execution consent.

### Phase 6 — UX, accessibility, performance and trust polish

#### PP-17 — Editor interaction polish — P1

Standardize selection, breadcrumbs, context menus, undo/redo, search, move/reorder, destructive impact and empty/error states across Journey/Page/Component/Entity/Source editors.

#### PP-18 — Accessibility/native narrow-leaf qualification — P1

Manual screen-reader + keyboard + zoom/reflow + focus-return + reduced-motion + target-size checks on representative browser and native surfaces.

#### PP-19 — Performance budgets — P1

Add UI/native measurement around existing model measurement. Use representative and 250/500 bounded-large fixtures.

#### PP-20 — Joined threat model and trust UI — P1

Label trust transitions and verify data-only imports cannot authorize execution/network/native writes/release.

### Phase 7 — Evidence, CI and support economics

#### PP-21 — Candidate evidence manifest — P0

One machine-readable manifest + generated human report for exact candidate acceptance.

#### PP-22 — CI portfolio optimization without weaker gates — P0/P1

Shard/categorize checks, reduce duplicate compilation/browser provisioning, retain exact-candidate full qualification.

**Acceptance:** shorter feedback for ordinary development; no release path can bypass full required gates.

#### PP-23 — Recovery and support UX — P1

Surface `support report`, status and recovery from the actual failure screen/CLI outcome. Provide next safe action, not generic “try again.”

### Phase 8 — Release readiness

#### PP-24 — Framework readiness decision — P0

Close actual SH-022/SH-032 prerequisites on an exact candidate. Do not infer from individual green workflows.

#### PP-25 — Framework release, only after explicit approval — gated

SH-034 remains separate. Redownload exact asset and replay first-use flow.

#### PP-26 — Native Companion CP-010 readiness — later gate

Only after the agreed native scope is implemented and qualified.

#### PP-27 — Companion publication — later gate

Separate explicit approval, exact candidate and destination. Community listing acceptance is separate from GitHub release creation.

## 6. Recommended sequencing

### Increment A — Convergence

PP-01, PP-02, PP-03, PP-06, PP-07.

**Exit:** one current product story, one native persistence decision, one bounded conversion scope.

### Increment B — Complete core authoring

PP-08, PP-09, PP-10, PP-17.

**Exit:** core Companion workflow works natively through the same project owner.

### Increment C — Make generated output credible

PP-11, PP-12, PP-13.

**Exit:** generated clickdummy/project looks and behaves like the authored definition, with explicit remaining obligations.

### Increment D — Product entry and acceleration

PP-14, PP-15, PP-16.

**Exit:** starter/TUI/agent/brainstorm paths converge on the same canonical model.

### Increment E — Qualification

PP-18–PP-23.

**Exit:** accessibility/performance/security/support/evidence are candidate-bound.

### Increment F — Shipment

PP-24–PP-27 through existing SH/CP/PUB gates.

## 7. What not to do next

- Do not add another project or visual IR format.
- Do not create a second native persistence model for each editor.
- Do not build another parallel compiler.
- Do not make optional AI/memory/Storybook tooling part of default setup.
- Do not count test totals as product completion.
- Do not port every browser screen before CX-007 defines the actual native MVP.
- Do not ship both embedded and external starter mental models at once.
- Do not patch generated HTML manually to improve clickdummy quality; fix source definitions/compiler/runtime.
- Do not relax quality thresholds to reduce CI time; optimize the execution architecture instead.
- Do not treat Journey Lens native acceptance as complete Companion acceptance.

## 8. Definition of “polished PR5”

PR5 is product-polished when a new user can:

1. understand in one screen what the Shell, Companion and generated project are;
2. start blank or from a compatible starter;
3. brainstorm/define a feature;
4. create its requirements, pages, journey, components and data;
5. review realistic scenarios in a generated clickdummy;
6. generate an independently buildable project;
7. open the real native Companion, edit and persist the project, then reopen it;
8. regenerate only the changed feature without losing developer edits;
9. see exactly which obligations remain application-specific;
10. obtain a clear candidate/evidence report without reading historical test logs.

That is the point at which the breadth of PR5 becomes a coherent product rather than an impressive collection of capabilities.

## 9. Review evidence / source orientation

Primary inspected material at or near the current PR5 line included:

- PR #5 metadata/current head and current check runs;
- `docs/product/PR5-PRODUCT-REVIEW.md` and `PR5-IMPROVEMENT-PLAN.md` (2026-09-27 baseline);
- `docs/prds/MVP-JSON-TO-CLICKDUMMY.md` and `MVP-IMPLEMENTATION-PLAN.md`;
- `docs/product/DELIVERY-STRATEGY.md`;
- `docs/development/COMPANION-PROJECT-SCHEMA.md`;
- `docs/development/SCOPED-GENERATION.md`;
- `docs/development/EXTRACTED-KIT-SETUP.md`;
- `docs/development/JOURNEY-LENS-NATIVE.md` and native integration evidence;
- `docs/development/LOCAL-SUPPORT-AND-MEASUREMENTS.md`;
- Companion visual editor, Storymaps, data source, starter and workbench review documents;
- current framework command catalog and first-run presentation;
- current SH/CX/CP/PUB task frontmatter;
- stacked PR #54 as a separate proposed starter-pack evolution.

The current PR5 head changed again after the 2026-09-27 review, including a narrow post-baseline analysis-fixture correction, and had fresh qualification still running at this review snapshot. All release/readiness conclusions must therefore be re-evaluated on the exact candidate selected for merge or release.

## 10. Prioritized finding register

These are **product findings**, not claims of exploitable vulnerabilities or unobserved runtime bugs. "Observed" indicates the inspected repository/CI/docs demonstrate the boundary. "Requires validation" means there is a reasonable usability or operability concern without a completed user study or native/manual benchmark.

| Finding | Priority | Basis | Product consequence | Primary closure |
| --- | --- | --- | --- | --- |
| F01: full Companion not natively delivered | P0, Companion | Observed native Journey Lens scope and CP task states | Browser concept cannot yet become the entire installed authoring product | PP-06–10 |
| F02: unclear canonical native persistence target | P0, Companion | Observed JSON file workflow versus broader native Markdown requirement | Ported editors may diverge in recovery/identity/transactions | PP-06 |
| F03: conversion scope not frozen | P0, Companion | CX-007 remains planned | Every new concept feature expands an undefined native critical path | PP-07 |
| F04: current product status is stale | P0, all | PR body and 2026-09-27 review precede implemented capabilities | Reviewers/users misunderstand what is actually delivered | PP-01–02 |
| F05: first-use complexity | P0/P1, adoption | Review of multiple workbench/CLI/tooling entry points; usability impact requires validation | New users may navigate tools rather than complete a job | PP-03–05 |
| F06: generated behavior/fidelity gap | P0/P1, generated outputs | Prior generated screenshots/receipts plus pending business TODOs | A prototype may look complete while action implementation is not | PP-11–12 |
| F07: native Page/Component gap | P0, Companion | Native Journey Lens is the implemented editor binding; complete native companion unaccepted | Core design loop cannot yet be performed end to end in the installed product | PP-08 |
| F08: unclear scaled scoped-generation effects | P1, developer UX | Scope mechanism exists; plan understanding is a UX concern to test | Users may approve changes they do not understand | PP-13 |
| F09: starter-model transition | P0/P1, distribution | PR54 separate/open; PR5 still has integrated starter assumptions | Two incompatible onboarding/catalog stories can emerge | PP-14 |
| F10: TUI/agent discoverability and Brainstorm gap | P1, acceleration | Existing shared CLI/maker layers; proposed Brainstorm is new scope | Product ideation may still require outside prompts/manual JSON | PP-15–16 |
| F11: incomplete accessibility and scale acceptance | P1, quality | Historic review explicitly excludes manual AT/max-scale/native coverage | The product cannot yet substantiate those use claims | PP-18–19 |
| F12: evidence volume and CI feedback cost | P0/P1, delivery | Large current check matrix; latest merge triggered mostly pending runs | Longer integration cycles and difficulty proving exact candidate | PP-21–22 |
| F13: disjoint trust explanations | P1, security/UX | Multiple independent consent and export boundaries | Users may misunderstand data versus execution authority | PP-20/23 |
| F14: release gates open | P0 for shipment | SH-022 blocked, SH-034 planned, CP-010 planned, no release at review | No published framework or full native companion promise yet | PP-24–27 |

## 11. Execution backlog and dependency crosswalk

Do not declare a PP package complete solely because an implementation exists; it also needs its defined acceptance evidence. Each row identifies the existing backlog area to update first rather than creating another independent task taxonomy.

| Sequence | Package | Depends on | Existing work to reconcile | Done when |
| --- | --- | --- | --- | --- |
| 0A | PP-01 evidence truth | Current PR candidate | IP-01, IP-11, SH-022 and acceptance crosswalk | Current-head statuses derive from exact producers |
| 0B | PP-02 vocabulary/docs | PP-01 | IP-01, MVP-24/A18 | One versioned current-status/manual entry |
| 0C | PP-06 canonical native store | Current schema/shell APIs | CP-001/002, IP-10 | Native persistence architecture and failing-write tests accepted |
| 0D | PP-07 conversion baseline | PP-06 design decision | CX-007 | Reviewed bounded scope with every native capability mapped |
| 1A | PP-03 disclosure hierarchy | PP-02 | IP-06 | Optional capabilities absent from normal first run |
| 1B | PP-04 first success | PP-03, current golden project | IP-02/05/06, A01–A11 | An observed novice flow reaches useful generated output |
| 1C | PP-05 focused workbench | PP-03 | IP-06 | Editor remains usable at narrow target widths |
| 2A | PP-08 native visual editors | PP-06/07 | CP-003–008 after exact mapping | True save/reopen, revisions and contracts |
| 2B | PP-09 semantic/data editors | PP-06/07 | CP scope, IP-10 | Native entity/source/fixture contracts actually run |
| 2C | PP-10 cross-linked authoring | PP-08/09 | CX-007/CP feature mapping | One navigable end-to-end authoring trace |
| 3A | PP-11 clickdummy parity | Current project v6 + visual IR | IP-05, A11 | Golden small and self-project previews accepted |
| 3B | PP-12 generated TODO classification | PP-11 | MVP-13–18, IP-10 | No undeclared success path remains |
| 3C | PP-13 scope impact UX | Existing scoped generation | IP-04, A10/A13 | User reviews exact closure and replay safety |
| 4A | PP-14 starter split | External starter schema accepted | PR54, CX-008, SH distribution tasks | One consistent independent starter ecosystem |
| 4B | PP-15 TUI simplification | PP-02/03 | Current maker/TUI catalog | TUI and CLI remain operation-equivalent |
| 4C | PP-16 Brainstorm | PP-15 + canonical model | New accepted task | Human and agent definitions are equivalent and guarded |
| 5A | PP-17 editor grammar | PP-08–10 | IP-07 | Same supported editing actions across editors |
| 5B | PP-18 accessibility | Representative PP-05/08/11 surfaces | IP-08, A20 | Manual and automated evidence is recorded |
| 5C | PP-19 performance | Representative PP-08/11 output | IP-12, A20 | Agreed budgets and repeatable UI/native samples |
| 5D | PP-20 threat model | PP-06/14/16 interfaces | IP-13 | Trust boundary and failure-path tests pass |
| 6A | PP-21 candidate evidence | PP-01, stabilized work | IP-11 | Exact-candidate manifest generated without false green |
| 6B | PP-22 CI economics | PP-21 | IP-11, CI workflows | Full gate intact, feedback lanes nonduplicative |
| 6C | PP-23 support/recovery | PP-04/06/20 | IP-13 | Recoverable failures have tested next-safe actions |
| 7A | PP-24 framework qualification | All applicable SH work | SH-022/032/033 | Full required evidence for immutable framework candidate |
| 7B | PP-25 framework shipment | PP-24 + approval | SH-034 | Approved bytes published, redownloaded and replayed |
| 7C | PP-26 native qualification | PP-07–10 + applicable gates | CP-009/010 | Accepted native flows fully qualified |
| 7D | PP-27 companion shipment | PP-26 + approval | PUB tasks | Exact candidate/destination authorized and verified |

## 12. Validation journeys (BDD-oriented)

### J01 — first usable project

**Given** an extracted, intact kit without `node_modules` and no Companion installed, **when** the user selects Blank or a compatible starter, reviews setup, defines a two-page feature and generates a clickdummy, **then** the output opens independently, navigates between the pages, renders the declared component states and retains an exact generation receipt. Cancelled setup or a rejected plan must not modify the project.

### J02 — native authoring after regeneration

**Given** an exported v6 design and an independent generated project, **when** the user opens it in an isolated Obsidian vault, edits Journey Lens and a Page/Component definition, saves and reopens the project, **then** the committed data survives, export preserves the same identities and regeneration produces the expected changes without manual patches.

### J03 — conflicting leaves and outside edits

**Given** two native leaves viewing the same project, **when** one leaf or an external writer commits a change while the other holds a draft, **then** the second leaf cannot silently overwrite the first. It must retain a recoverable draft, explain the conflicting revision and offer explicit reload/review.

### J04 — scoped regeneration with developer ownership

**Given** a complete previously generated project whose user-owned extension files have been edited, **when** a selected feature is regenerated, **then** the plan shows all dependent/shared/retained artifacts, repeated identical execution is a no-op, edited managed-file conflicts block, and extension files survive unchanged.

### J05 — TUI and agent parity

**Given** a blank project and the same structured answers to Brainstorm Feature, **when** the answers are submitted through the TUI and through the headless operation protocol, **then** they yield semantically equivalent validated project definitions and identical reviewable generation plans. Neither path executes dependencies or native writes merely because a prototype was requested.

### J06 — release safety

**Given** a fully qualified immutable candidate, **when** release preparation is run, **then** no tag, remote release or directory submission is created. Only a separate explicit approval for that exact candidate and destination enables external mutation; changed inputs invalidate it.

## 13. Risk register and early signals

| Risk | Early signal | Mitigation |
| --- | --- | --- |
| Native conversion never converges | Browser concept gains more features than are ported each cycle | Freeze bounded CX-007 core, run concept additions through native impact review |
| Native data ownership fragments | Editors begin storing independent copies or raw JSON sidecars | PP-06 shared project aggregate; cross-editor recovery tests |
| Generated output looks complete but is not | Simulated controls lack labels; business TODOs are buried | PP-12 obligation taxonomy and visible generation receipt |
| PR integration cost overwhelms feature delivery | Long queues, frequent stale evidence, broad merge churn | Smaller task-focused increments and PP-21/22 evidence automation |
| Starter split breaks onboarding | Different starter counts/names in CLI, Companion and docs | Atomic PR54 migration with compatibility fixtures |
| Security trust boundary becomes confusing | Users assume importing JSON authorizes install/build/provider access | Consistent trust labels and separate plans/consent |
| Accessibility defects surface late | Keyboard/AT users cannot complete an editor journey | Manual representative testing before each native editor is accepted |
| Product value remains unproven | Core flow succeeds in tests but requires maintainer assistance | First-success usability sessions and observed recovery tasks |

## 14. Immediate next iteration: two parallel tracks

**Discovery track**

1. Approve a single-page product hierarchy, language map and Core/Advanced/Optional IA.
2. Specify the canonical native project store and conversion baseline (PP-06/07).
3. Run focused user walkthroughs of one empty-project, one starter-project and one regeneration flow.
4. Resolve the PR54 starter-pack decision and define its compatibility/release contract.

**Delivery track**

1. Finish exact-head CI after the latest `main` merge and capture immutable reports.
2. Generate the live capability/evidence manifest and update stale PR/current-status language.
3. Keep the current public schema/scoped generation/setup-resume implementations; add only the missing negative cases and UX explanations.
4. Establish the native editor composition/store adapter using the existing Journey Lens pattern.
5. Choose and polish two golden clickdummy projects and eliminate the highest-impact fidelity/undeclared-TODO problems.

**Iteration exit:** every stakeholder can identify the current supported journey and remaining work; a complete native editor/persistence architecture is accepted; the representative generated output meets agreed visual/behavior expectations; all claims are tied to the exact candidate, with current pending checks still visibly pending.

---

**Source links (public GitHub):**

- [PR #5](https://github.com/Luis85/obsidian-plugin-shell/pull/5)
- [PR #54 — external starter-pack proposal](https://github.com/Luis85/obsidian-plugin-shell/pull/54)
- [Historic 2026-09-27 integrated review](https://github.com/Luis85/obsidian-plugin-shell/blob/02857c2c965e4187f4b56d1e0fa5627c12cbf07d/docs/product/PR5-PRODUCT-REVIEW.md)
- [Historic 2026-09-27 improvement plan](https://github.com/Luis85/obsidian-plugin-shell/blob/02857c2c965e4187f4b56d1e0fa5627c12cbf07d/docs/product/PR5-IMPROVEMENT-PLAN.md)
- [Current v6 project schema guide at reviewed head](https://github.com/Luis85/obsidian-plugin-shell/blob/b39801796e0c2b3ab56f39641e7645fe698ed671/docs/development/COMPANION-PROJECT-SCHEMA.md)
- [Current scoped generation guide at reviewed head](https://github.com/Luis85/obsidian-plugin-shell/blob/b39801796e0c2b3ab56f39641e7645fe698ed671/docs/development/SCOPED-GENERATION.md)
- [Current native Journey Lens guide at reviewed head](https://github.com/Luis85/obsidian-plugin-shell/blob/b39801796e0c2b3ab56f39641e7645fe698ed671/docs/development/JOURNEY-LENS-NATIVE.md)
