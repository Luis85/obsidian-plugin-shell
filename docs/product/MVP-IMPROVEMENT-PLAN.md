# Workbench — vision-aligned MVP improvement plan

> **Version:** 1.1 · **Date:** 2026-09-29 · **Product owner:** Luis85
> **Planning baseline:** PR #5, `docs/companion-plugin-prd`, commit `f3778ed120e845a781c9cc08afc9b16a8b1a3e8c`.
> **Quality amendment baseline:** `40799d9489e0bd436a47f819732292e8a35a4774`; the source observations below retain their original planning baseline.
> **Status:** Implementation and acceptance plan with the mandatory owner-directed MVP-QR-01 amendment. No implementation, runtime qualification, task closure or publication is performed by updating it.
> **Companions:** [Acceptance scenarios](MVP-VISION-ACCEPTANCE.md) · [Baseline and requirement crosswalk](../_archive/product/MVP-VISION-BASELINE.md) · [Operational boilerplate quality requirement](MVP-BOILERPLATE-QUALITY.md).

## 1. MVP decision

**Make one complete UI creation-and-change workflow dependable before adding more disconnected capabilities.**

A developer must be able to bring an idea and existing documentation into Workbench, configure a project, author a useful interface, generate and run maintainable source, and make a later change without losing code or documentation. Prove this for a webapp and an Obsidian plugin. Also retain the existing requirement to generate and qualify the complete native Workbench from its own definition.

**Mandatory quality requirement — MVP-QR-01:** the selected target's boilerplate must be fully operational for UI experimentation after the documented build/start steps. Every designed interaction ships its executable behavior and required mock data/fixtures, including coherent stateful mutations. Missing production services cannot justify inert controls. Integration with a backend such as C# or Java must use replaceable adapters without rewriting pages/components. The [quality contract](MVP-BOILERPLATE-QUALITY.md) defines BQ-01–10 and BQA-01–10; it supersedes earlier allowance of unavailable business actions for interactions in the selected design. Demo readiness does not imply production business or native persistence acceptance.

This operationalizes the [vision](PRODUCT-VISION.md): **Focus on your idea. Save time. Not quality.** The three release questions are: does Workbench remove repeated work; does it retain useful documentation as the design changes; and can a developer understand, extend and recover the result?

### Authority and scope

This is the product-oriented execution supplement to the [retained MVP PRD](../prds/MVP-JSON-TO-CLICKDUMMY.md), its [implementation plan](../prds/MVP-IMPLEMENTATION-PLAN.md) and the [September 27 improvement plan](../_archive/product/PR5-IMPROVEMENT-PLAN.md). It adds vision-derived work and reconciles newer source; it does not replace their requirement IDs or erase unfulfilled acceptance. MVP-QR-01 is a later mandatory requirement, not a suggestion or a claim that the generator already meets it.

`WM-01`–`WM-19` identify work packages in this plan; `WVA-01`–`WVA-20` identify additional acceptance scenarios. BQ/BQA clauses extend these packages and cases; none is a replacement task-status system. Existing SH/CX/CP/PUB task frontmatter remains authoritative. Split implementation into those tasks or newly allocated, noncolliding task IDs after checking current source. Map every added requirement into the relevant readiness gate before closing it.

The [delivery strategy](DELIVERY-STRATEGY.md) still governs: **SH-022 technical readiness → separately approved SH-034 framework shipment → CX-007/CP-001 native conversion → CP-010 native acceptance → separately approved companion publication.** Framework shipment is a valid earlier milestone, not completion of the full Workbench MVP. Nothing here authorizes a merge, release, activation, personal-vault operation or identifier migration.

## 2. What needs adding, improving or qualifying

The baseline contains substantial reusable implementation. Do not rebuild it simply because an older plan described it as missing. Detailed sources and limits are in the [baseline review](../_archive/product/MVP-VISION-BASELINE.md).

| Area | Inspected foundation | MVP response |
| --- | --- | --- |
| Public contracts | `project schema` and `project validate` already expose project-v6 contracts and migration. | Integrate documentation metadata and shared identity rules; qualify parity, rather than introducing schema discovery again. |
| Safe generation | `generate --scope` reaches selection and the ownership-aware workspace planner. | Prove dependency impact, no-op replay and preservation through a realistic second change, including primary target paths. |
| Configuration | `shell.config.json` currently owns identity and four path settings; project presets enforce default source/test roots. | Introduce `configs/user-settings.json` with explicit migration and one effective resolver; support advertised non-default paths end to end. |
| Starters | Creation loads the existing verified starter catalog from the framework/template location. | Move starter-specific definitions and processes to external `configs/starters/<starterName>.json`; ship them in a separate ZIP. |
| Setup and recovery | Reviewed setup and resumable generate/install/verify/preview stages exist. `new` retains empty-folder/vault guards. | Compose a discoverable setup for fresh projects and explicitly approved existing project-vaults; do not bypass `new` safety rules. |
| Existing product context | Project/concept JSON intake exists; the inspected CLI catalog does not expose the requested typed UI Markdown import/export workflow. | Add typed Markdown file/folder intake and generated documentation with declared field ownership and conflict handling. |
| UI generation | The preset compiler explicitly describes navigable scaffolds whose visual bodies/business actions require implementation. | Emit all selected designed interactions with operational stateful fixtures, not placeholder pages or disabled writes; retain separate production integration responsibilities. |
| Authoring | Connected visual/page/component/journey concepts and contracts exist. | Complete the core editing tasks, meaningful states, context, revisions and documentation capture in place. |
| Native Workbench | Current authoring guidance identifies a browser concept, not complete native Workbench acceptance. | Deliver the retained full generated native product after framework shipment; a wrapper or editor scaffold does not pass. |
| Evidence | Readiness/provenance, diagnostics and local support/measurement entry points exist. | Join them into candidate-bound handover and evidence. Earlier CI results are not current qualification. |

**Main additions:** user-settings migration; external starter definitions/distribution; typed Markdown intake/documentation lifecycle; a joined setup/first-run journey; complete stateful interaction fixtures and a backend integration contract. **Main improvements:** actual target UI fidelity, approachable authoring, safe second changes and coherent developer handover. **Main qualification work:** exact archives, independent consumers, both C# and Java reference integrations, accessibility/performance, native self-hosting and demonstrable user outcomes.

## 3. MVP boundary and representative products

### Required target proofs

Use **Angular webapp** and **Vue 3/Nuxt UI Obsidian plugin** as the proposed minimum paired qualification fixtures. This incorporates the requested Angular setup without promising every framework/target combination. Keep existing Vue, vanilla, Angular, website, CLI and hybrid capabilities intact; advertised support retains its applicable regressions. A narrower fixture set cannot silently withdraw existing requirements or convert untested combinations into supported ones. MVP-QR-01 applies to the full selected design for every advertised supported target, not only to these fixtures.

Distinguish the **authoring host**, the **consumer output target**, the **frontend framework** and the **output form** (source, browser preview, native assets). A Workbench authoring webapp, cloud service or native Angular authoring application is not added to the MVP by this choice. C# and Java are backend integration proofs, not added native-UI generation targets.

| Fixture | Required experience | Why it matters |
| --- | --- | --- |
| Request Board — Angular webapp | Existing Git/project-vault with typed PRDs; list/detail/edit dialog; reusable status/form components; a navigation journey; stateful mock scenarios; the same frontend build connected independently to C# and Java reference services. | Tests existing-project setup, actual UI behavior, configurable paths, mock-to-service substitution and web delivery. |
| Quick Capture — Obsidian plugin | Capture/list/detail/settings flow; reusable components; fixture-backed demo; a separately tested real note-backed workflow; theme/lifecycle behavior; isolated native execution. | Tests the primary plugin target, documented mode/host boundaries and preserved vault data. |
| Workbench self-project | Entire reconciled required authoring composition, its actual editors, persisted designs and import/export/regeneration loop. | Retains the original full-scale native MVP obligation; the small fixtures and demo mocks do not replace it. |

Small fixture names/content are proposed test data, not additional products. Preserve the self-project's existing capabilities or record an approved replacement; do not reduce it to meet a convenient page count.

### Smallest complete declarative UI vocabulary

Qualify layouts, text, typed form controls, actions, lists/repeated content, reusable component instances, supported slots/events, local state, bindings, navigation and dialogs required by these fixtures. Include normal, loading, empty, error, validation and disabled-by-design states where applicable. Each designed interaction requires executable fixture coverage: pure UI actions use state/navigation fixtures; data operations include coherent mock reads and writes. Missing backend implementation must not create disabled stand-ins. Unsupported semantics block complete-boilerplate readiness at the responsible element; a partial/reference-only export is not an accepted substitute.

Documentation includes pages, components, interactions and journeys, with links to requirements, fixture/scenario contracts and meaningful authored descriptions. Empty generated sections are not a fulfilled documentation promise. Existing requirement formats remain supported; do not create a second PRD database.

### Outside the expansion scope

Do not add mandatory AI, cloud accounts, collaboration, a marketplace, a backend platform, arbitrary code-to-design round trips, a universal visual programming language, autonomous deployment or a general workflow engine. Mock behavior and backend integration seams are required; automatic completion of arbitrary production business systems is not. Do not expand optional Hindsight, Jev, Airship or Storybook into prerequisites. Mobile qualification, an unlimited component catalog and full parity across every target remain separately scoped unless already required by retained contracts. No quality requirement is deferred merely by calling it polish.

## 4. Golden user journeys

1. **Start from existing context:** open the already Git-initialized Angular project-vault; run the extracted CLI; choose paths; describe product/project; choose individual PRDs or review a `docs/prds` scan; select an external starter; choose whether to prepare a prototype; review generated changes; choose whether to perform the first run.
2. **Start fresh or design-only:** choose blank/starter or project JSON through one setup flow. Design-only authoring remains available without external Node/npm/Git, an AI account or a template download. Builds disclose their separate prerequisites.
3. **Create, document and experiment:** author pages/components/interactions/journeys over the shared model; capture descriptions and scenario references; validate complete fixture coverage; build/start an operational demonstration with preloaded data, selectable scenarios and reset; export meaningful documentation.
4. **Make the second change:** revise a reusable component, inspect affected usages, update the selected pages/journey, regenerate the reviewed scope, preserve handwritten code/prose/adapters, rebuild and verify that docs, fixtures and contracts match the accepted model.
5. **Integrate a backend:** use the generated wire contract and adapter guide; run the same frontend build against the C# and Java reference services using configuration only. For a different existing API, contain mapping work in an owned adapter rather than rewriting the UI.
6. **Deliver and self-host:** qualify independent consumers from exact artifacts; ship the framework only after approval; generate complete native Workbench through the same public capabilities; exercise native save/reopen and regeneration; publish only with separate approval.

Prototype preparation and first-run execution are independent choices. A user may prepare source without installing dependencies, build without launching, or skip both and return later. Selecting a starter or answering a wizard question does not authorize a package install or plugin activation. Demo readiness and backend/native/production acceptance remain separately evidenced.

## 5. Work packages

Every package is a required contribution to the relevant promised MVP journey. **Lane** governs sequencing, not importance: Foundation = existing P0 framework lane; Concept = secondary P1 authoring; Native = P2 after framework shipment; Publication = existing explicit release gates. Owners below are responsibility roles, not assigned people or capacity commitments. Dependencies identify integration prerequisites; contracts/tests can be developed earlier in parallel. The [MVP-QR-01 package crosswalk](MVP-BOILERPLATE-QUALITY.md#6-integration-into-the-existing-implementation-plan) adds mandatory criteria to these existing scopes without inventing another status database.

### WM-01 — Reconcile the candidate and capability promises

**Lane:** Foundation. **Owner:** Product + QA + technical lead. **Dependencies:** none.

Inventory the exact current branch, changes since this baseline, required task criteria, shipped artifacts and evidence. Maintain a capability matrix by target/framework/action: implemented in source, generated, built, behavior-tested, native-tested, accepted or blocked. Separate known failures from unexecuted checks. Refresh command examples and stale guidance from the actual catalog, not the PR description. Inventory every selected interaction, fixture dependency and remaining demo/integration gap under MVP-QR-01.

**Exit:** each claimed MVP capability has an owner, source seam, applicable acceptance and current evidence status; missing evidence is visible. Existing implementations are assigned integration/qualification work rather than duplicate rewrite tasks. Reconcile the old Python/Windows findings before proposing any repair. **Trace:** MVP-23/24; IP-01/11; SH-001/023; WVA-01; BQ-02/10.

### WM-02 — Complete the shared model and documentation ownership contract

**Lane:** Foundation. **Owner:** Shared contracts + requirements engineering. **Dependencies:** WM-01.

Extend the existing project-v6/visual contracts only where necessary for typed document mapping, stable external document IDs, source revision/content hashes and authored descriptions. Define field-level ownership between Markdown and the UI model. Keep JSON as the exchange/compiler representation and reports as derived evidence. Reuse current schema discovery and validators; version changed semantics rather than inventing another UI language.

Define interaction-to-fixture/scenario references, mock effect semantics, typed data-source ports and language-neutral wire contracts. Pure UI actions need state fixtures, not invented HTTP calls. Missing domain semantics block or require a reviewed modeling decision; do not fabricate production rules from prose. Derive types/examples/docs from one reviewed contract authority and test serialization boundaries.

**Exit:** browser/CLI/native adapters agree on the same fixtures, reference rules and migration results. Imported documentation is not a second uncontrolled authority. Unknown/future/invalid content is preserved and rejected appropriately; unsupported planning references are distinguishable from executable errors. **Trace:** MVP-09–12; IP-03; SH-015/035; WVA-01/08/11; BQ-02/04/07.

### WM-03 — Introduce configurable user settings without split authority

**Lane:** Foundation. **Owner:** Configuration + CLI + persistence. **Dependencies:** WM-02.

Make `configs/user-settings.json` the user-facing home for configurable paths and preferences. Inventory every user-configurable path across documentation, PRDs, concepts, starters, source, tests, output, previews and the isolated test vault. Resolve these through one service across CLI, generation, docs and authoring. Distinguish the fixed discovery location and protected implementation paths from configurable destinations; never promise that safety-reserved paths are arbitrary.

Define precedence as explicit invocation overrides over saved user settings over versioned defaults. Imported settings and starter defaults propose reviewed changes, not silent overrides. Keep project/manifest identity separate. Migrate legacy `shell.config.json` path fields by a reviewed plan, preserving originals/recovery data; conflicting old/new values block until resolved. A compatibility projection must be derived, not a second writer. Changing a path does not move existing data without a separately reviewed operation.

Include fixture/scenario locations and safe demo preferences. Runtime integration receives only explicitly selected non-secret configuration such as mode, API origin and UI base path, never the entire local user-settings file. A backend failure cannot select mock mode automatically.

**Exit:** non-default roots work through setup, source generation, docs, build, test and preview; absent/future/corrupt settings, overlap, case collisions, traversal and symlink escapes fail safely. Defaults preserve existing projects. Explain each effective value and its origin. **Trace:** SH-005/027; MVP-03/04; WVA-02/13; BQ-04/05/08.

### WM-04 — Externalize starters and their declared processes

**Lane:** Foundation. **Owner:** Starter contracts + distribution + security. **Dependencies:** WM-02/03.

Discover standalone `configs/starters/<starterName>.json` definitions. Each definition supplies listing metadata, compatibility, editable parameters, defaults, project content or versioned resource references, validation, and a bounded dependency-ordered sequence of supported operations. List/edit/execute must read the same definition; adding ordinary starter content must not require a starter-specific code branch or duplicated manifest. A new execution primitive still requires reviewed implementation.

The shell ships the engine, generic capabilities and schemas; starter-specific definitions/resources belong to the separately distributed starter pack. No bundled fallback, including a hidden blank starter. Blank/project-JSON entry remains explicit: blank as a selectable starter comes from the pack; JSON intake does not require it. Pin referenced assets and versions; editable user copies get new hashes rather than pretending to retain official integrity. Every starter's designed interactions must declare complete executable fixtures/scenarios. C# and Java reference integration resources follow the same separate-pack boundary.

**Exit:** add/change a starter using data only; preview its parameters and file/process plan; refuse missing/incompatible dependencies, cycles, unsupported operations and unsafe paths. The shell ZIP contains no starter definitions, including template/fixture copies that accidentally re-bundle them. Import never executes commands. **Trace:** SH-011/026/027; CX-008; MVP-01/02/04; WVA-03/04; BQ-01/02/08.

### WM-05 — Join setup around the developer's existing project

**Lane:** Foundation. **Owner:** CLI + UX. **Dependencies:** WM-03/04.

Compose the shared setup, import and generation operations into one guided path and equivalent noninteractive requests. Recognize fresh kit, existing Git project, explicitly selected project-vault, configured project and interrupted setup. Preserve `.git`, remotes, `.obsidian`, notes, existing docs and foreign files. Do not redirect this use case through `new`'s empty-folder path or weaken its existing protections.

Capture product/project description, target/framework and paths; offer PRD file selection, reviewed folder scan or skip; show valid, invalid and duplicate candidates. Ask separately about prototype preparation and first run. Retain starter-or-JSON selection and optional existing-GitHub association. Descriptions/PRDs provide context; they do not infer executable business logic. Explain the preloaded demo mode and that no production backend is needed for UI evaluation.

**Exit:** the Angular project-vault journey completes without moving the vault, recreating Git or overwriting files; fresh kit and JSON paths still work. Back/cancel preserve intent without unintended writes; machine mode never prompts. Native testing remains in an explicitly isolated vault, not the authoring project-vault. **Trace:** MVP-01–04/24; SH-027; IP-02; WVA-05/06; BQ-01/05.

### WM-06 — Make first run explicit, target-aware and recoverable

**Lane:** Foundation. **Owner:** Process orchestration + CLI. **Dependencies:** WM-05; integrate target adapters from WM-11.

Extend the existing setup-progress stages instead of writing another runner. Offer “prepare only,” selected install/build/verification steps and showcase launch. Show commands, working directory, lifecycle/network effects and selected target before approval. Record generated, installed, built, verified and showcased separately. Preview preparation is not a browser-launch permission; plugin launch is not activation permission.

Bind progress to settings, starter/model, fixtures/contracts, lockfile and relevant source hashes. Resume only after fresh inspection/approval; never automatically retry uncertain processes. Respect exact-lock installation; a missing/mismatched lockfile requires an explicit dependency-resolution/review step, not a silent fallback. Manage loopback process ownership, cancellation, logs and port conflicts without killing unrelated services.

The demo first run loads usable scenarios with stateful behavior and reset. It requires neither manual seed creation nor a real API/database/.NET/JDK installation. Those toolchains are separate prerequisites only for the selected backend reference tests. Expose missing interaction coverage before claiming a complete demonstration.

**Exit:** skipping performs no install/build/launch; selected steps run in dependency order; failure stops downstream execution while preserving recoverable work. Successful showcase is reported only when the expected output is ready. Test cancellation, wrong tools, offline registry failure and stale resume. **Trace:** MVP-04/24; SH-012/029; WVA-06/07; BQ-01/04/10.

### WM-07 — Import typed Markdown files and folders

**Lane:** Foundation; consumed by Concept/Native. **Owner:** Documentation adapters + shared model. **Dependencies:** WM-02/03.

Add a bounded typed Markdown contract for pages, components, interactions and journeys, reusing existing PRD intake where applicable. Specify type/version, stable identity, references, editable metadata and owned body sections. Parse a file or explicitly scoped folder into a read-only change plan; report document/field locations, invalid types, missing IDs, duplicates and unresolved references. Never execute Markdown HTML/scripts, remote includes or embedded instructions.

Preserve unrelated frontmatter and handwritten body. Define merge rules: unchanged imports are no-ops; one-sided changes can be proposed; competing edits to an owned field block until resolved. Do not infer identity from filenames alone. Preview the complete import set and require explicit scope for partial intake; failures retain the canonical project and report exact file outcomes rather than claiming filesystem-wide atomicity. Preserve supported interaction/fixture links; an incomplete imported design stays visibly incomplete until executable mock semantics are supplied.

**Exit:** all four entity types import with stable links, including rename/reimport and cross-folder references. Conflict/cancel/future-version tests preserve prior bytes. CLI and authoring use the same mapping/validation. **Trace:** new vision-derived requirement; extends MVP-09–11/19–20, SH-004/015/027; WVA-08; BQ-02/09.

### WM-08 — Generate and keep useful documentation current

**Lane:** Foundation + Concept; repeated in Native. **Owner:** Documentation + UX + compiler. **Dependencies:** WM-07.

Generate a complete, linked Markdown structure from selected project elements: index, page/component references, interaction behavior, journeys, requirement links, usage/dependency information and explicit implementation gaps. Collect descriptions/rationale at the editing step. Include source IDs, relevant revision/fingerprint and generated-field ownership. Do not invent rationale or label a scaffold as an implemented workflow.

Show freshness/impact when accepted definitions change; offer a reviewed update with preview and conflict explanations. For mixed authored/generated material, define bounded managed sections or a separate generated tree. Never overwrite the authored import root by default. A removed element produces a retirement proposal, not silent deletion of notes. Exclude drafts, credentials, machine roots and approvals from portable docs.

Document the fixture/scenario for each interaction, simulated effects, reset/persistence lifetime, wire-contract origin and backend integration boundary. Separate unfinished live integration from required operational demo behavior; the former cannot excuse gaps in the latter.

**Exit:** import → author → export → change → update is usable without rewriting explanations. Stale docs are identified; handwritten content survives; identical output is a no-op; broken links/missing required descriptions are visible. **Trace:** new vision-derived requirement; SH-007/018; MVP-11/18/24; WVA-09/20; BQ-09/10.

### WM-09 — Finish focused page and component authoring

**Lane:** Concept, then Native reuse. **Owner:** UX + presentation. **Dependencies:** WM-02.

Improve the existing editors, not a parallel prototype. Make create/insert, select nested element, edit properties/bindings, reorder, reuse a component, undo/redo and preview obvious. Provide keyboard/no-drag alternatives, dirty/saved state, contextual help and predictable Back. Keep component definitions distinct from instances; show the current editing scope and immutable revision rules.

Cover the bounded UI vocabulary and relevant loading/empty/error/disabled/validation states. Disabled states need a designed reason and scenario, not an absent handler. Place descriptions, requirement links and fixture/scenario assignments where users make decisions. Use Workbench in current product copy while retaining technical names and generated consumer identity. Decorative expansion and additional editors are not prerequisites.

**Exit:** a new developer authors both sample flows without undocumented maintainer guidance; no nested app shell, silent shared-definition edits, lost drafts or placeholder-only mandatory controls. **Trace:** MVP-05/08/14/15; IP-06/07; CX-002/003; WVA-10/12/13; BQ-02/04/09.

### WM-10 — Make navigation, reuse and change impact understandable

**Lane:** Concept + shared contracts. **Owner:** Journey/component domain + UX. **Dependencies:** WM-02/09.

Complete the connected journey and component-management loop: hierarchy, routes, navigation links and saved geometry remain separate. Explain inbound/outbound links, used-by pages, component revision pins and affected docs/tests before revision, replacement or deletion. Support explicit migration of selected usages without silently upgrading all instances.

Preserve context across page/component/journey/requirement navigation. Give invalid bindings, cycles, route collisions and unresolved executable references actionable locations. Arrangement is explicit, deterministic and undoable; it never changes reading order, parentage or routes by implication. Include fixture dependencies and scenario coverage in the impact of a changed component/action contract.

**Exit:** a shared contract change identifies affected usages; selected consumers update deliberately; unrelated pages and pinned revisions remain unchanged; branching journeys and modal return work; delete impact is reviewable. **Trace:** MVP-06–08/11/15/18; IP-07; CX-003/006; WVA-11/14; BQ-02/10.

### WM-11 — Generate operational UI, fixtures and backend integration

**Lane:** Foundation. **Owner:** Compiler + target adapters. **Dependencies:** WM-02/04; coordinate vocabulary with WM-09/10.

Extend the existing compiler and preset emitters so accepted layouts, reusable components, bindings, states and interactions produce actual source for the qualified Angular-webapp and Vue-plugin fixtures. Do not replace modeled pages with navigation-only placeholders. Remove default-root restrictions for advertised configurable paths. Unify target/framework discovery across the real entry points; at the inspected baseline the framework `generate` wrapper accepts only plugin/clickdummy output kinds, even though the compiler also has a project-preset path.

Emit typed application ports, shared stateful mock adapters, schema-valid fixture/scenario data, reset/selection controls, HTTP/service adapters and the relevant versioned OpenAPI contract. Both adapters use the same UI and observable contracts; no fixture/backend branching belongs in pages. Include reads, writes, cancel, validation and failure behavior wherever designed. A success notification without coherent state change is not implementation.

Keep production-specific behavior in documented developer-owned integration seams, already backed by a working demo implementation. Provide C#/ASP.NET Core and Java/Spring Boot reference services and integration instructions through the separate reference/starter pack. The same frontend build must work with each over real HTTP through configuration only. An existing incompatible backend may need an owned mapper but no page rewrite. Pin and test contract dialect, SDK/JDK and dependencies during implementation; demo users do not need those backend runtimes.

Keep pure compilation separate from filesystem plans and installs. Correct maintained definitions/adapters, never only the final HTML. No simulation substitutes for the actual required Workbench editor modules or native persistence.

**Exit:** generated source builds independently, all selected interactions operate with fixtures, non-default roots work, and BQA-01–09 have applicable target-specific evidence. Offline preview shares the generated UI source and honestly identifies simulation. Unsupported selected capabilities block complete-output readiness rather than passing with a disclosure. **Trace:** MVP-13–17/23; IP-05; SH-017/028/035; WVA-12/13/15/16; MVP-QR-01, BQ-01–08/10.

### WM-12 — Qualify scoped regeneration and developer ownership

**Lane:** Foundation. **Owner:** Compiler + workspace planner. **Dependencies:** WM-02/11.

Retain current selection/ownership machinery and close its complete workflow. Compute shared dependency closure, cross-target effects, impacted registrations/tests/docs/fixtures/contracts and retirement proposals before applying a feature/page/component change. Scope means a reviewed minimal dependency closure, not one isolated output file regardless of consistency.

Preserve developer extensions, custom backend adapters, fixture overrides and unrelated managed outputs; stop on edited managed files, incompatible shared dependencies or stale input. Keep canonical import requirements, separate approvals and exact plan reconstruction. Report recovery outcomes honestly if a multi-file write fails. No arbitrary code-to-model merge or automatic deletion is added.

**Exit:** repeat generation is a no-op; changing a reused component updates only the reviewed dependency set, including affected mock/integration tests; handwritten code/prose survives; stale/conflicting plans write nothing before rejection where preflight detects the conflict. Injected mid-write failure yields a precise retained recovery result. **Trace:** MVP-13–15/18–20; IP-04; SH-018/030; WVA-11/14/16; BQ-06/07/10.

### WM-13 — Deliver one understandable developer handover

**Lane:** Foundation + Concept; reused in Native. **Owner:** Developer experience + QA. **Dependencies:** WM-06/08/11/12.

Join existing help, schemas, diagnostics, provenance and readiness into a project handover: what was generated, where to edit, how to start/reset the demo, what is simulated, which production responsibilities remain, which checks ran, where docs originate and how to make the next change. Deep-link diagnostics to the element/document/file and offer a safe next action. Preserve human-readable and structured results over shared handlers.

Separate modeled, validated, generated, installed, built, demo-tested, backend-integrated and accepted states. Do not collapse them into a reassuring completion percentage. Include a command/schema compatibility guide and generated README/agent instructions that do not assume access to the maintainer repository or optional services. Document both C# and Java integration, deployment/base-path/origin configuration and the no-silent-mock-fallback rule.

**Exit:** a developer continues without Workbench, runs the generated checks, integrates a disclosed business adapter without UI rewrites and regenerates without hand-fixing generated files. The demo works before that live integration; missing evidence and production limitations remain visible. **Trace:** MVP-23/24; IP-01/02; SH-025/029; WVA-16/20; BQ-01/06–09.

### WM-14 — Preserve quality and close the new trust boundaries

**Lane:** Foundation; repeat for Native. **Owner:** Security + architecture + QA. **Dependencies:** WM-02; final review includes WM-03–08/11–13.

Extend the threat/failure model across imported Markdown/JSON, starter assets and process declarations, configuration, generated source, previews, native data and exported diagnostics. Bound input sizes/depth/file counts; validate references, archive paths, symlinks and output ownership. Treat package scripts as trusted execution requiring deliberate approval, not inert data. Checksums identify bytes; they are not publisher authentication or consent.

Retain architecture, code-size, dependency, security, lifecycle and coverage gates from the actual repository configuration. Add negative controls to prove rejection, not merely happy-path validation. Preserve unrelated notes/settings, one canonical persistence writer, explicit recovery and private data boundaries. No silent telemetry is introduced.

Enforce isolated synthetic demo state, no live business calls, no credentials in exports and no automatic mock fallback when real requests fail. Production artifacts must exclude demo datasets/controls or prove equivalent build-time isolation. Mode switches and reset must isolate pending responses and never migrate synthetic data to a backend. Corrupt wire responses and absent interaction fixtures must fail the relevant acceptance gate.

**Exit:** hostile-input, failure and concurrency fixtures demonstrate the guards; no quality threshold or scope exclusion is weakened to finish. Tests run actual services where behavior is claimed. Resolve current blockers against their current cause, not historical summaries. **Trace:** MVP-09–11/18/23; IP-11/12; SH-004/012/020/021; WVA-02/04/08/14/18; BQ-04–07/10.

### WM-15 — Qualify accessibility, host fit and interaction performance

**Lane:** Foundation target checks + Concept; repeat in Native. **Owner:** Accessibility + performance QA + UX. **Dependencies:** representative WM-09–13 output.

Test critical tasks by keyboard, without dragging, with visible focus and understandable errors/status. Review screen-reader behavior, contrast, zoom/reflow, reduced motion, narrow Obsidian leaves, host themes and supported-language expansion. Exercise applicable populated/empty/loading/error/validation and long-content scenarios, not only a default screenshot. Automated checks supplement manual interaction; passing a screenshot or browser viewport test does not establish native/mobile support.

Measure model import, selection, typing, component-change impact, generation, preview and native save/reopen on small fixtures and the full self-project. Separate model benchmarks from rendered/native timings and memory/lifecycle behavior. Retain stricter existing budgets; baseline and approve missing task-specific budgets before optimization, recording hardware/tools/data size and percentile definitions.

**Exit:** no unresolved blocker prevents the promised core tasks; thresholds have measured evidence, not invented time-savings claims. Native and browser outcomes remain separate. **Trace:** MVP-05/16/17/23; IP-08/13; SH-020; WVA-10/15/17/18; BQ-03/04/09/10.

### WM-16 — Qualify the exact kit and independent consumer journeys

**Lane:** Foundation. **Owner:** Distribution + cross-platform QA. **Dependencies:** WM-03–08/11–14 and applicable target checks from WM-15.

Exercise the assembled engine ZIP plus separate starter ZIP, not just the checkout. Cover fresh and existing-project setup, JSON without a starter pack, non-default paths, docs intake, first-run skip/select, failure/resume, scoped regeneration, source independence and local release rehearsal. Test documented desktop OS/toolchain combinations, including the retained Windows/macOS/Linux kit-launch requirement.

Prove complete interactive demonstrations with no real backend and no manual fixture/code repair. Execute the same generated frontend build against both the C# and Java reference servers without network interception, recording each environment separately. Verify integration instructions, non-root hosting/deep-link behavior, scenario isolation and production exclusion. Mutate handler/fixture/scenario/response inputs to demonstrate gate failures; generated test TODOs cannot qualify.

Bind evidence to engine/starter/model/interaction-inventory/fixture/contract/source/build/tool hashes and actual commands. Verify no maintainer paths, authoring application, hidden starter definitions or optional tooling are required. Archive qualification is local technical evidence; downloading published bytes remains a later approved release check.

**Exit:** applicable A01–A20, WVA and BQA scenarios have candidate-specific results; required failures and missing modes block readiness. A generated consumer cannot repack itself as the framework. Feed evidence into SH-032/033 and SH-022 without substituting task counts. **Trace:** MVP-01–04/18/21/23/24; IP-02/11/15; WVA-04–07/14–16/19; MVP-QR-01, BQA-01–10.

### WM-17 — Generate and accept the complete native Workbench

**Lane:** Native. **Owner:** Native product + host adapters + QA. **Dependencies:** SH-022, SH-034, CX-007; relevant WM-08–15 contracts/capabilities.

Implement the actual required Workbench capabilities as trusted, versioned modules selected by its self-project definition. Generate the complete product using the shipped compatible framework and that exact export. Use shared lifecycle, commands, settings, persistence and style boundaries; avoid companion-specific branches in generic services or a private framework copy.

The native loop includes actual sitemap/page/component authoring, document context, save/reopen, multiple leaves, conflict/failure recovery, import/export and export-to-regeneration. Reconcile every retained core capability; do not shrink the declared composition to remove difficult editors. CLI handoff remains explicit; an in-plugin process executor is not a prerequisite. Consumer-demo mocks under MVP-QR-01 do not replace this product's real authoring or persistence acceptance.

**Exit:** independent generation/build and real isolated Obsidian execution work without manual output patches, iframes, simulated durable saves or mandatory-action stubs. Pass retained A12/A19 and CP-010's full scope; small sample plugins do not substitute. **Trace:** MVP-12/17/23; IP-10; CP-001–010; WVA-17/18; BQ-01/05/10.

### WM-18 — Validate the value on first and second changes

**Lane:** Product learning alongside Foundation/Concept; repeat on Native. **Owner:** Product + research/QA. **Dependencies:** runnable WM-06/08–13 slices; native repeat after WM-17.

Run voluntary task-based evaluations using the two small fixtures: first useful documented UI and subsequent shared-component change. Compare equivalent scope and acceptance with the participant's manual workflow; record prior tool familiarity and learning/order effects. Include unaided setup, scenario exploration/reset, finding the next action, interpreting a failed operation and continuing in ordinary source code.

Measure hands-on and elapsed time, time to first usable demonstration, assistance, rework, failed steps, documentation gaps and preservation outcomes. Do not infer productivity from generated file counts or a small convenience sample. No numeric improvement is already proven; establish a baseline and agree a decision threshold before treating results as a product claim.

**Exit:** observations, limitations and product decisions are recorded. Required workflows with unresolved unaided-use blockers return to their owning packages. All faster outcomes retain the same functional/quality checks and zero observed authored-data loss. **Trace:** vision promises; IP-06; WVA-20; BQ-01/09, BQA-10.

### WM-19 — Ship bounded, supportable artifacts through existing approvals

**Lane:** Framework shipment / Publication, deliberately split. **Owner:** Release + documentation + product. **Dependencies:** WM-16 and SH-022 for F; WM-17 and CP-010 for C.

**WM-19F:** prepare the compatible engine and separate starter assets, inventory, checksums, licenses, release notes, supported matrix, setup/demo/integration walkthroughs, troubleshooting and recovery guide. Rehearse; obtain fresh candidate/destination/action approval for SH-034; publish retained bytes only; redownload and smoke-test. Missing approval remains blocked, not automatically bypassed to start native conversion.

**WM-19C:** after native acceptance, repeat the applicable release/support steps for Workbench's native artifacts under PUB-001–005. Recheck current distribution rules and permissions, preserve separate generated-consumer release profiles and provide known limitations/support instructions. Publication capability, actual GitHub shipment and directory acceptance are different outcomes.

**Exit:** approved artifacts match retained evidence, install through the documented path and have a recovery/support route. Claims of operational boilerplate include actual MVP-QR-01 evidence; earlier narrower shipments cannot be relabeled. No plan, checksum, `--yes`, prior release or task state grants future publication authority. **Trace:** MVP-21–24; IP-15; SH-031/034; PUB-001–005; WVA-19; BQ-09/10.

## 6. Delivery increments and critical dependencies

| Increment | Integrated outcome | Packages / exit |
| --- | --- | --- |
| I0 — current baseline and contracts | A truthful capability/requirement map and agreed ownership/settings/starter/document/interaction-fixture contracts. | WM-01/02; contract portions of WM-03/04/07. |
| I1 — project start | Exact inputs produce a reviewed project; Angular existing-vault and fresh/JSON paths work; first-run choice offers a populated demo without a real backend. | WM-03–06; target/mock integration from WM-11. |
| I2 — connected UI and docs | Every selected interaction operates with coherent fixtures; docs/scenarios/contracts are preserved; replaceable service adapters are generated. | WM-07–11/13; Concept work remains secondary to Foundation prerequisites. |
| I3 — second change and framework readiness | Safe regeneration, complete interaction coverage, quality/host checks, both C# and Java integration proofs and exact-archive consumer acceptance. | WM-12–16; WM-18 learning; SH-022 only after all applicable evidence. |
| I4 — framework shipment | Approved engine/starter bytes are published and redownload-verified. | WM-19F / SH-034; no native companion prerequisite. |
| I5 — full native Workbench | Complete generated native authoring, actual persistence and lifecycle acceptance. | WM-17 after SH-022/034/CX-007; repeat WM-14/15/18; CP-010. |
| I6 — native shipment | Exact accepted native candidate, support package and authorized distribution. | WM-19C / PUB tasks. |

The framework critical path is **contracts → settings/starters/intake → setup/operational generation and fixtures → backend integration/preservation/quality → exact-kit proof → approved framework shipment**. Native conversion follows that shipment. Documentation and headless authoring contracts can proceed in parallel; full native UI does not block the first framework release. A deliberately narrower earlier framework release may retain its existing scope, but must not claim completion of these additional Workbench MVP journeys or MVP-QR-01.

Estimate only after WM-01 identifies the remaining implementation and assigns people. These are reviewable work packages, not equal-sized tickets or calendar commitments. Split the large native and target-generation packages by accepted capability without weakening their exit criteria.

## 7. Acceptance, metrics and completion rules

The [acceptance companion](MVP-VISION-ACCEPTANCE.md) defines twenty additional scenarios and their mapping to the retained A01–A20 cases. The [quality requirement](MVP-BOILERPLATE-QUALITY.md#5-additional-acceptance-protocols) adds BQA-01–10 and tightens WVA-12–16: a declared interaction cannot pass merely because a missing business action is disclosed. Use unit/contract, filesystem integration, independent generated builds, real browser, real native, real backend integration, manual accessibility, release and product-study evidence separately.

| Vision promise | Measure | Guardrail |
| --- | --- | --- |
| Save time | Time to first usable demo, first UI and second-change hands-on/elapsed time; manual edits and recovery time. | Same scope and acceptance as the comparison; no manual seeding, hidden source repairs or weakened tests. |
| Document along the way | Description/reference completeness, scenario/contract traceability, stale-doc findings, correction effort and usable handover. | No invented rationale, overwritten prose or silent broken references. |
| Developer experience | Unaided task completion, assistance, actionable diagnostics, independent source continuation and adapter integration without UI rewrites. | No mandatory Workbench runtime, AI/cloud account or maintainer checkout; demo needs no production backend. |
| Quality | Complete selected-interaction behavior plus candidate-bound security, accessibility, lifecycle, backend and performance results. | No missing handlers, silent fallback, data loss or unexecuted evidence relabeled as passed. |

MVP-QR-01 requires executable fixture/scenario coverage and passing applicable tests for **100% of the reviewed selected interactions**, with an explicit denominator and zero unimplemented-action placeholders. This measures interaction completeness, not source-code coverage. Legitimate disabled/error states remain scenarios; removing a designed action or returning a fake success cannot improve the score. Demo, integration and production/native readiness are distinct claims.

**Ready:** current source reconciled; user job and target identified; canonical ownership, fixture semantics and safety effects defined; dependencies/acceptance understood; tests can distinguish real UI behavior from a scaffold. **Done:** agreed scope implemented, mandatory fixture and integration criteria satisfied, required negative/regression modes executed, source/commands/evidence recorded, documentation updated, remaining production responsibilities disclosed and gate coverage reconciled. A document, schema, generated test TODO or successful build alone is not Done.

## 8. Risks and mitigations

| Risk | Mitigation / accountable role |
| --- | --- |
| Two settings files or docs/model become competing writers. | Field ownership, one resolver, explicit migration and stale-change tests; shared-contract owner. |
| Starter externalization breaks blank setup or embeds definitions indirectly. | Separate pack/engine inventory, no-pack diagnostics, JSON-only path and archive-content tests; distribution owner. |
| Declarative processes become arbitrary code execution. | Bounded operation catalog, data-only imports, explicit process approval and negative controls; security owner. |
| Existing-vault setup damages notes or security settings. | Explicit project-vault scope, reviewed allowlisted writes, foreign-file preservation and separate isolated native test vault; CLI/persistence owner. |
| Angular/preset scaffolding is mistaken for complete UI generation. | Full interaction inventory, coherent stateful mocks, target behavior tests and blocking missing-fixture/handler gates; compiler owner. |
| Mocks hide integration failures or become a second UI. | One UI/port contract, explicit mode isolation, no fallback and real HTTP tests against both reference backends; adapter/QA owners. |
| Wire contracts drift across languages or regeneration damages custom integrations. | One contract authority, boundary test vectors, custom adapter ownership and generation drift checks; shared-contract/ownership owners. |
| Broader vocabulary expands MVP indefinitely. | Qualify representative complete flows; retain required capabilities; defer only explicitly additional features; product owner. |
| Self-hosting hides special cases or excessive complexity. | Small independent fixtures plus mandatory full self-project, shared public APIs and no manual output repair; architecture/QA owner. |
| Old green/red CI or weak reports overstate readiness. | Exact-candidate evidence, current checks and independent source/output identity; QA owner. |
| Approval or staffing blocks progress. | Keep blocked gates visible, continue nondependent contract/Concept work, never infer authorization or dates; product/release owner. |

## 9. Recommended implementation start

Start with **WM-01/02**, including the complete interaction inventory and explicit mock/wire contracts, then implement **WM-03/04** and **WM-07** against their shared ownership contracts. Use the requested Angular existing-project journey to integrate them through **WM-05/06/11**, including non-default paths and a populated, fully interactive demo. Complete stateful scenario behavior before treating the first run as presentation-ready; then prove both backend substitutions without UI changes. In parallel, validate the current scoped-generation implementation with the second-change fixture rather than rewriting it. This attacks the new vision gaps while retaining the substantial foundation already present in PR #5.
