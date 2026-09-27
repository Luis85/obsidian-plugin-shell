# MVP PRD: JSON to clickdummy and generated companion

| Field | Value |
| --- | --- |
| Status | Proposed MVP delivery contract; not implementation or qualification evidence |
| Date | 2026-09-27 |
| Product | Obsidian Plugin Shell CLI and Companion |
| Owner | Luis Mendez |
| Integration target | PR #5, `docs/companion-plugin-prd` |
| Inspected baseline | `6178b1025336941ad6fb10eae4e26930622363f9` |
| Delivery plan | [MVP implementation plan](MVP-IMPLEMENTATION-PLAN.md) |

## 1. Outcome and decision

**PR #5 must deliver a reproducible path from a supplied project JSON file to an editable, runnable clickdummy project. The companion's own project JSON is the mandatory full-scale acceptance fixture.** The same definition must generate the complete companion plugin composition, not merely a list of files, an iframe containing the concept, or disconnected placeholder screens.

A maker downloads the published shell-cli release asset, extracts it into a new project folder, runs setup, chooses a starter or existing project JSON, configures identity and optional GitHub association, and installs the project. Later they can generate features, pages and components from JSON, import compatible concepts from `docs/concepts`, build a clickdummy, prepare a release, and explicitly publish it.

Delivery starts by integrating the new **Journey Lens sitemap editor** into the existing companion concept. Next, evolve the shared project schema/data model and regenerate the companion self-project JSON; prove that the concept imports and edits it. Then use that exact exported JSON through shell-cli to generate and qualify the complete companion and its clickdummy. Setup, incremental generation, concept integration and release complete the user journey; they must reuse these same contracts.

This documentation change specifies that work. It does not implement it, authorize a release, merge PR #5, or convert prior scaffold evidence into product acceptance.

## 2. Baseline and gap

The inspected branch already includes compiled framework-kit packaging, guided setup, JSON intake, nine JSON-backed starters, reviewed project generation, file ownership/recovery, visual page/component designs, and release-operation tooling. Reuse them rather than introducing a parallel CLI, format or generator.

The branch's current [project contract](../development/COMPANION-PROJECT-JSON.md) is **transfer v5 / design schema 5**, with visual-design subsystem schema 3 and legacy v1–v4 import compatibility. Older sections of the CLI documentation and PR description still describe v4. Implementation must use shared executable contracts, reconcile documentation drift and test actual behavior; a PR-body summary is not the schema authority.

| Existing foundation | Remaining MVP obligation |
| --- | --- |
| Companion concept and self-project seed | Integrate Journey Lens; keep the complete self-project editable and current |
| Project/compiler and visual-design contracts | Add sitemap/feature semantics without duplicate authoritative models |
| Reviewed scaffold compiler | Complete clickdummy output, scoped generators and implemented companion capabilities |
| Extracted-kit setup; `new --starter` and `new --from` | One coherent starter-or-JSON setup in the directory containing the extracted kit |
| File plans, ownership and explicit release operations | Qualify the complete fresh-download-to-publication journey |

The self-project baseline declares 28 sitemap surfaces, 27 eligible page designs, 54 component designs and 54 published revisions. These counts are **a reconciliation baseline, not immutable design targets or proof of functionality**. Preserve every existing surface and reference, or document and approve its intentional replacement. The workbench view is a container, not another page.

Sources: [generator](../development/COMPANION-GENERATOR.md), [CLI](../development/FRAMEWORK-CLI.md), [self-project seed](../concepts/companion/src/companion-project.js), [companion architecture](../architecture/COMPANION-ON-SHELL.md), [repository rules](../../AGENTS.md).

## 3. Users, jobs and scope

The primary user is a plugin maker or product owner who can provide JSON but should not need to clone the maintainer repository, assemble tooling or manually wire navigation to see a concept working. A developer or coding agent needs stable contracts, reviewable changes and protected extension code. The framework maintainer needs a reproducible shipped kit and evidence tied to its exact inputs.

**Core job:** “Turn my designed plugin into a working clickdummy and a maintainable plugin project; let me extend it without losing what I already changed.”

MVP includes the existing companion design experience, the new sitemap editor, shared schema/migrations, full and incremental generation, local concept intake, release-kit setup, optional existing-GitHub-repository association, and qualified prepare/publish operations. Both blank and curated starters use ordinary project JSON.

Not included: a hosted marketplace, accounts or cloud collaboration; mobile CLI/process execution; arbitrary HTML/CSS/JavaScript-to-Vue conversion; inferring business logic from prose; unrestricted plugin/package execution from JSON; arbitrary bidirectional code-to-design synchronization; automatic Obsidian Community listing; automatic GitHub repository creation or credential storage. Existing broader product/release obligations remain recorded; this PRD does not silently waive them.

### What the outputs mean

A **clickdummy project** has editable TypeScript/Vue source, the portable definition, fixtures, tests, build instructions and a self-contained HTML build. Navigation, dialogs, declared local state and fixture-backed scenarios work. Undeclared business behavior is explicitly unavailable, never presented as a successful save or live integration.

A **generated companion plugin** contains the entire declared companion composition, native entry/settings/views, pages, components, contracts, authoring capabilities and host adapters needed for the MVP. Its core authoring loop must work in Obsidian. JSON selects implemented, versioned capabilities from the shipped framework catalog; it does not magically encode a graph editor's source code. No manual copying or patching of the generated companion is allowed to pass acceptance.

A green scaffold is not native acceptance. A native acceptance result is not publication authorization. An offline browser concept cannot supply either.

## 4. Required user journey

| Step | User experience | Observable result / requirement |
| --- | --- | --- |
| 1 | Download shell-cli from GitHub Releases | Explicit versioned kit asset, checksum, compatibility and start instructions; MVP-01 |
| 2 | Create a new project folder | No existing vault or maintainer checkout required; MVP-01 |
| 3 | Extract the kit into that folder | Launcher and trusted kit inventory present; MVP-01 |
| 4 | Open a terminal there | Commands resolve against this project root; MVP-01 |
| 5 | Run `node shell.mjs setup` | Preflight and guided setup start before dependency installation; MVP-02 |
| 6 | Choose “Install a starter” or “Import project JSON” | Starter gallery includes Start Blank; JSON path is validated and reviewed; MVP-02 |
| 7 | Configure the project and optional GitHub association | Review identity, folders, source and remote changes; MVP-03 |
| 8 | Confirm installation | Generated project, exact dependency install and verification have distinct outcomes; MVP-04 |
| 9 | Supply JSON to generate boilerplate | Features/pages/components/full project are selectable with dependency-aware plans; MVP-13–18 |
| 10 | Import a prototype under `docs/concepts` | Review compatible data and changes before integrating; MVP-19–20 |
| 11 | Prepare a release | Local candidate and actual readiness evidence, no remote publication; MVP-21 |
| 12 | Publish a release | Separate explicit authorization; verified remote assets and recovery receipt; MVP-22 |

Dependency installation may require network access. “Self-contained” means the **built clickdummy** runs without network, not that source installation or GitHub publication is offline. Node/npm prerequisites must be disclosed before download and checked by setup. A framework ZIP must not be confused with an installable Obsidian plugin ZIP or GitHub's automatically generated source archive.

## 5. Functional requirements and acceptance

All requirements below are Must for this MVP unless an exclusion is explicit.

### A. Distribution, setup and project lifecycle

| ID | Requirement | Acceptance |
| --- | --- | --- |
| MVP-01 | Downloadable, extractable shell-cli | A clean Windows, macOS and Linux environment can launch help/setup from the release kit with the documented Node/npm prerequisites and without `node_modules`, Git checkout or global CLI installation. The exact asset passes inventory checks. |
| MVP-02 | Starter-or-JSON setup | Both options appear in the same wizard; blank is a starter. Starter selection and JSON intake converge on the same shared model and planner. Extracted kit-owned files do not incorrectly trigger the separate `new` command's empty-folder refusal. |
| MVP-03 | Reviewed configuration and optional GitHub | Configure identity, version and contained source/test folders. Keep imported identity unless explicitly overridden. Skip GitHub without losing local functionality. Review initialization/remote changes; preserve existing remotes; never store tokens in portable data. |
| MVP-04 | Install with truthful recovery | Show a plan before writes and obtain separate approval for dependency/process execution. Use the exact lockfile. Report configured/generated/installed/verified states separately. Cancellation or failure retains recoverable progress and a precise resume command. |

GitHub association means linking an existing repository, optionally initializing local Git after approval. It must not silently create a remote repository, commit, push, enable workflows or publish. Missing Git/credentials only blocks the operation that needs them. Editing source JSON, configuration or files after review invalidates the affected approval. Setup recognizes a fresh kit, configured project, interrupted installation and conflicting existing files.

### B. Journey Lens sitemap editor

| ID | Requirement | Acceptance |
| --- | --- | --- |
| MVP-05 | Integrate the actual editor | Use TypeScript, Vue 3, Pinia, Nuxt UI and Vue Flow within the companion. The editor remains an editor-only surface: no nested application shell or simulated application screens. Existing companion navigation hosts it. |
| MVP-06 | Separate hierarchy, routes and arrangement | Create/edit/reorder/move/delete surfaces with validation and Undo/Redo. Dragging changes diagram positions only. Explicit Move or a confirmed structural connection changes hierarchy. Moving/renaming a page never silently rewrites its route. |
| MVP-07 | Journey Lens and navigation | Show named, ordered journeys over the same surfaces/transitions. Distinguish hierarchy, navigational links and journey overlays; support branching paths, modal entry/return and explicit unresolved-reference findings. |
| MVP-08 | Connect adjacent editors | Selecting a surface exposes parent, siblings, children and related pages in contextual panels. Open its existing page design; navigate to component definitions and linked requirements/storymaps with contextual Back. No copied page records. |

Provide searchable Outline, selection details, add page, explicit move, link creation, fit/zoom, undo/redo, import/export and focused review. Keyboard alternatives must cover structural actions; dirty drafts and delete impact require confirmation. Removing a node must disclose affected children, routes, journeys, links and page designs. Do not silently cascade-delete linked requirements or component definitions.

Keep native `view`, `page`, `modal` and `settings` distinctions. A hierarchy child is not automatically an executable navigation action. Journey Lens overlays do not replace the existing Storymaps subsystem or its activities, stories and release slices. Component instances remain references; page edits do not mutate shared component definitions.

### C. One project schema and data model

| ID | Requirement | Acceptance |
| --- | --- | --- |
| MVP-09 | Shared authoritative contracts | Browser import/export, native persistence adapters, shell-cli, makers and generators validate the same versioned model. Published JSON Schema and CLI schema discovery agree with executable validators/types. |
| MVP-10 | Explicit migration | Preserve supported v1–v5 imports through tested migrations to the new format. Future/unknown versions fail without writes. Report any pre-existing migration loss; never discard unsupported saved content silently. |
| MVP-11 | Safe, complete round trips | Preserve all saved design fields, IDs, order, components, revisions, fixtures and notes. Invalid/stale/cancelled import leaves the prior project unchanged. Export excludes credentials, machine roots, approvals, run receipts and session drafts. |
| MVP-12 | Companion describes itself | Update the executable self-project seed, its visual seed and checked-in `companion-project.json` together. Load the JSON into an empty companion, edit it, export it, reload it, and prove semantic equality and intended edits. |

**Proposed target:** transfer `schemaVersion: 6`, `design.schema: 6`; preserve the existing envelope kind `obsidian-companion-project` and `executable: false`. This is a proposed contract, not a claim that v6 already exists. Keep visual-design subsystem schema 3 unless its own semantics require an independently reviewed change.

| Domain concept | Authoritative representation / ownership decision |
| --- | --- |
| Project identity and relative folders | Existing `project` and `settings` envelope fields |
| Surface identity, native kind, parent | Existing `design.nodes`; retain stable IDs and existing runtime ownership semantics |
| Navigation and modal transitions | Existing `design.links`, with typed, validated action semantics |
| Feature grouping | Proposed `design.features`, subsystem schema 1, containing feature records and references to owned surfaces, requirements and entry points |
| Routes and Journey Lens | Proposed `design.sitemap`, subsystem schema 1, containing route records and named journey records that reference existing surfaces/links |
| Page/component/layout definitions | Existing `design.visualDesigns`; page ownership references a surface, not a second page identity |
| Component library/contracts/revisions | Existing component and visual-design contracts, preserving revision pins and dependencies |
| PRDs, Storymaps, entities, sources, fixtures, tokens | Existing bounded subsystems; linked by ID, not flattened into sitemap cards |
| Saved diagram arrangement | Existing `design.canvas`; not the source of hierarchy, route, reading order or runtime navigation |
| Selection, viewport, preview and drafts | Per-view/session state, outside portable authoring JSON |

A route record owns its route value and references one eligible surface. A journey owns ordered steps referencing surfaces and, when executable, declared transitions; visual order must not invent actions. A feature groups existing artifacts and declares entry points/dependencies without duplicating their definitions. Define single-owner rules for pages and explicitly shared components. Pin external runtime capabilities to trusted catalog identifiers/versions, not arbitrary source paths supplied by JSON.

Validation must reject duplicate IDs, containment/composition cycles, conflicting routes, invalid ownership, incompatible props/slots/events, unsafe literal shapes and dangling executable references. Valid authoring drafts may retain explicitly unresolved planning references, but generation blocks affected executable output with actionable diagnostics. Keep the existing 4,000,000-byte transfer bound and guarded path rules unless changed through a separate justified contract decision.

### D. Generators and clickdummy behavior

| ID | Requirement | Acceptance |
| --- | --- | --- |
| MVP-13 | Feature generator | From a reviewed canonical project/slice, generate feature registration, associated pages/components/contracts, selected behavior and tests. Compute dependency closure and expose missing/shared dependencies before applying. |
| MVP-14 | Page generator | Generate the selected surface's authored Vue page, layout, route/navigation wiring, typed bindings, fixtures and tests; support page/modal/settings kinds without treating a container as a page. |
| MVP-15 | Component generator | Generate a reusable Vue component with typed props/slots/emits, variants, pinned dependencies, examples and tests. Generate a shared definition once; preserve instance overrides. |
| MVP-16 | Sitemap-to-clickdummy generator | Generate a complete source project and offline single-HTML build. Every declared navigable entry is reachable; links, modal return, local actions and fixture states execute. Sitemap-only pages use visibly generic bounded templates; authored pages use their designs. |
| MVP-17 | Whole-companion generation | From the exact exported companion JSON and released kit alone, generate/install/build the complete companion. Core sitemap/page/component authoring, project import/export and native save/reopen work without manually patching output. |
| MVP-18 | Safe regeneration | Repeating identical generation produces a no-op. Scope selection changes only reviewed dependent outputs. Preserve handwritten/extension files; surface edited managed-file conflicts; reject stale plans; never silently delete retired files. |

Full-project, feature, page, component and clickdummy generation use one normalization/compiler pipeline and existing file-plan infrastructure. Keep read-only `companion:generate` compatible; do not rebrand its byte echo as code generation. Prefer extending `shell.mjs generate`/existing makers and discovery rather than introducing independent template engines.

The compiler separates semantic model, capability resolution, rendering and filesystem application. Generated Vue remains thin; behavior lives in TypeScript application services/composables; Pinia owns view state; host/process/file access stays behind adapters. Generated code follows the shell's dependency and code-size rules. Use scoped Nuxt UI, local icons and the approved style pipeline; do not introduce Nuxt framework routing or global host resets.

For the companion, rich editors must resolve to **implemented trusted modules included in the kit**. An adapter stub or `NotImplementedError` on an MVP action is a failed acceptance criterion. JSON is sufficient as product input when combined with that versioned kit; it need not contain executable source. Ordinary users' unspecified business adapters remain explicit extension points, not fabricated successful implementations.

Clickdummy output must disclose fixture/simulation mode, permit deterministic reset, include keyboard-operable navigation and all applicable default/loading/empty/error/disabled scenarios, and make no live API, vault or publication calls. Browser navigation must work from the single file without a web server; bundle scripts, styles and approved assets with no runtime CDN imports. Source builds may use normal dependency installation. HTML and editable source must originate from the same declared definitions, not separately maintained mockups.

### E. Concept intake and review

| ID | Requirement | Acceptance |
| --- | --- | --- |
| MVP-19 | Import concepts from `docs/concepts` | Recognize full-plugin, new-feature and feature-improvement packages. Extract structured data without executing HTML. Preview scope, references, dependencies, source provenance and conflicts before integrating into the canonical project. |
| MVP-20 | Auditable integration | Preserve concept source/artifacts, record a content hash and ID mappings, invalidate stale reviews and support safe replay. Reimporting identical content is a no-op. Improvement imports require a matching reviewed base revision or explicit reconciliation. |

A compatible concept contains a human-readable brief, self-contained preview HTML, machine-readable project data, and source/build instructions when custom implementation is involved. The importable data is either a complete project envelope or a versioned concept manifest wrapping a canonical model slice plus explicit external references. A raw HTML file without recognized data is **reference-only** and must explain why it cannot generate code.

The implementation plan defines the precise package convention. Whole-project import is explicit replacement; feature import is additive; improvement import is an explicit change set against existing IDs. Never infer merge intent from filenames, titles or DOM text. Resolve collisions with reviewed reuse/remapping or refusal. Importing a concept never authorizes dependency installation, executing its source, replacing maintained framework modules, or granting publication trust.

### F. Release and operability

| ID | Requirement | Acceptance |
| --- | --- | --- |
| MVP-21 | Prepare and check a release | Review version/notes changes, produce exact candidate assets and hashes, and show applicable build/test/native/security obligations. Preparation performs no tag, commit, push or remote release mutation. Missing evidence blocks readiness. |
| MVP-22 | Explicit publication | Bind approval to repository, source commit, version/tag, notes, assets and candidate digest. Recheck remote state, upload verified assets and finalize the release only after explicit authorization. Handle partial failure without duplicating or replacing unrelated releases. |
| MVP-23 | Reproducible qualification | Retain source/schema/kit/input hashes and distinguish contract, generated-source, browser, native and release evidence. No TODO, skipped test or simulated action counts as completed MVP acceptance. |
| MVP-24 | Discoverable workflow | Release README, setup, CLI help/capabilities, generated README and companion handoff describe the same supported commands and next action. Human output is readable; machine mode is versioned and never prompts. |

Publication targets GitHub Releases. Community listing is separate. Reuse the existing reviewed release adapter and authorization digest; a global `--yes` is not publication authority. GitHub connection during setup does not authorize later publishing. Credentials remain local to approved authentication providers/environment and are excluded from project/concept exports and logs.

Maintain separate release profiles for the framework kit, an ordinary generated clickdummy/plugin and the companion. Their evidence must describe their actual functionality; profiles cannot be used to bypass inherited mandatory shell/native release gates. A clickdummy release must not be marketed as completed domain functionality.

## 6. Quality, data safety and experience

Retain the repository's existing production coverage, boundary, analyzer, scoped-style, source-limit and release requirements. No weakened threshold or broad exclusion is part of this MVP. Pin the qualified dependency/toolchain versions in the lockfile and distribution; verify integration against those versions rather than upgrading to whatever documentation calls latest.

Native companion data uses the shell's canonical Markdown/document services, preserving manual body content, unrelated frontmatter and stable IDs. JSON is the portable interchange and compiler input, not a competing native persistence database. Multiple views share committed application data but keep independent drafts. Restart, concurrent edits, persistence failure, disposal and repeated open/close must be tested. The HTML concept may retain its browser adapter; it is not the native data owner.

Use bounded reads, safe path containment, symlink/foreign-file checks, explicit preimages and the existing rollback/recovery mechanism. Plans are not authorization tokens. Checksums detect altered bytes, not whether an arbitrary publisher is trustworthy. Author-supplied text must remain escaped data; source URLs, commands and dependency requests are never automatically executed.

Qualification targets: the full companion fixture and a synthetic 250-surface/500-transition fixture within the existing transfer bound; measure import/export, selection, navigation and undo on a recorded desktop baseline. Initial budgets are <=5 seconds for bounded project import and <=100 ms p95 for selection/navigation after load. Record actual results and investigate failures; do not claim unmeasured performance. Native resource gates already required by the repository remain independent.

Verify light/dark host styling, narrow panels, keyboard-only authoring, visible focus, labelled inputs, announcements and dialog focus restoration. Automated checks and manual assistive-technology trials have separate evidence; this PRD makes no conformance claim.

## 7. End-to-end acceptance and merge/release gates

The acceptance suite in the [implementation plan](MVP-IMPLEMENTATION-PLAN.md) is the executable crosswalk for all 24 requirements. At minimum, demonstrate:

1. **Fresh kit, two starts:** Extract the exact candidate kit into two fresh folders. Complete starter setup in one and companion-JSON setup in the other. Repeat cancellation, GitHub-skip and failed-install/resume paths without losing unrelated files.
2. **Design-to-runtime loop:** In the integrated companion, change a sitemap relationship without changing its route, add a journey, edit a page and shared component, export JSON and reimport it. Generate both the offline clickdummy and complete companion from those exact bytes.
3. **Independent generated outputs:** With the maintainer checkout unavailable, install/build/test both outputs. Browse every applicable entry/transition; open the generated companion in an isolated Obsidian vault, save/reopen changes, export its project and regenerate. No manual output repair.
4. **Incremental safety:** Add a feature, page and component through JSON; integrate all three concept modes; replay generation; preserve a handwritten extension; reject an edited managed file, stale review, invalid reference and unsafe path.
5. **Release lifecycle:** Prepare a versioned candidate without network writes, prove denied publication and stale-candidate refusal, and qualify publication/recovery against a specifically authorized disposable repository before any real shipment.

**PR #5 merge gate:** all Must capabilities implemented, relevant existing quality gates and the above candidate-kit/native acceptance passed on the exact candidate source tree, and no unresolved MVP-blocking gap. Shipping requires a final replay/requalification against the actual merged revision; pre-merge evidence alone does not qualify changed source.

**Shipment gate:** separately authorize and publish the shell-cli asset from that qualified merged revision, then download that actual asset and repeat the fresh-project smoke path. Merging a PR is not permission to publish. The current documentation task must create neither a tag nor a release.

## 8. Risks and boundaries to resolve during implementation

| Risk | Required control |
| --- | --- |
| The prior Journey Lens source ZIP is not yet a verified repository input | First work package locates/imports the exact source or records reconstruction from approved behavior; do not claim source fidelity without comparison |
| V4 prose conflicts with v5 executable contracts | Pin baseline, inventory consumers, migrate together and reject schema drift |
| A complete-looking companion still contains stub editors | Capability-to-implementation inventory and native self-hosting acceptance block closure |
| Extracted-kit setup is confused with `new` outside a checkout | Dedicated in-place kit ownership tests and one shared setup operation |
| Raw prototype HTML is treated as code-generation authority | Data-only intake and explicit reference-only handling |
| Generated work overwrites developer changes | Ownership-aware plans, stale checks, reviewed reconciliation and no implicit deletion |
| Self-project growth exceeds bounded import/history | Test full fixtures and retained revisions; optimize representation, never silently truncate |
| Release workflow is considered complete after a mock | Keep candidate rehearsal, authorized integration and actual published-asset verification distinct |

## 9. References and precedence

This PRD defines the requested MVP outcome and acceptance, while existing architecture and safety contracts remain binding. The implementation plan controls sequencing. Proposed v6 fields and new CLI surfaces must become executable/documented contracts before examples are advertised as available.

Repository references: [CLI](../development/FRAMEWORK-CLI.md), [project JSON](../development/COMPANION-PROJECT-JSON.md), [generator](../development/COMPANION-GENERATOR.md), [visual editors](../concepts/companion/VISUAL-EDITORS.md), [companion-on-shell](../architecture/COMPANION-ON-SHELL.md), [delivery strategy](../product/DELIVERY-STRATEGY.md), [release execution](../development/RELEASE-EXECUTION.md).

External verification, accessed 2026-09-27: [Vue Flow controlled changes](https://vueflow.dev/guide/controlled-flow.html) supports validating node/edge changes before applying them; [GitHub release management](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository) distinguishes draft creation, asset attachment and publication. These references support implementation decisions, not claims that this MVP is already implemented.
