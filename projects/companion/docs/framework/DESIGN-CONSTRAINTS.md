> **Framework reference — not this project's backlog or instructions; follow ./AGENTS.md**

# Workbench — design constraints

> **Version:** 1.0 · **Date:** 2026-09-29 · **Product owner:** Luis85
> **Reviewed baseline:** PR #5, `docs/companion-plugin-prd`, commit `626336c46d559224ca3904f24e86bfa7d9c55a31`.
> **Status:** Consolidated product and engineering contract. Existing requirements retain their authority; retained MVP targets remain delivery obligations within their agreed scope; explicitly proposed additions require review. This document is not implementation, qualification, task closure or release approval.

**Focus on your idea. Save time. Not quality.**

Workbench creates and manages declarative user interfaces for webapps and Obsidian plugins. These constraints govern the whole creation-and-change workflow: product definition, authoring, configuration, documentation, generation, execution, verification, distribution and maintenance. They apply to human and agent-assisted contributions alike.

## How to use this document

Use the relevant constraint IDs in PRDs, design reviews, architecture decisions, PBIs, implementation reviews and acceptance evidence. Read the section scope before applying a rule: a constraint on the Obsidian adapter is not a requirement to embed Obsidian in an Angular webapp.

**Rule strength:** a table rule is **MUST** unless it says **SHOULD**; prohibitions are **MUST NOT**. SHOULD deviations require a recorded rationale. A rule's strength does not establish that it is already implemented.

**Basis:** **C** = consolidated constraint already expressed in the reviewed product/repository contracts; **M** = retained MVP/implementation target, not a claim of completion; **P** = proposed additional operational rule requiring explicit review before it becomes a new gate. The verification column describes evidence to obtain, not evidence produced by this documentation change. Role owners are accountabilities, not staffing assignments.

**Authority and conflict resolution:** the product vision owns naming and value; scoped PRDs and retained normative companions own detailed requirements; `AGENTS.md` owns repository contribution constraints; delivery strategy owns sequencing and authorization boundaries. This register makes those rules discoverable, not replaceable. A newer, explicitly approved amendment supersedes an older rule only in its stated scope. Preserve requirement IDs and historical evidence. Record unresolved contradictions; do not choose whichever wording makes a check easier to pass. The linked contracts remain applicable even where their detailed assertions are not repeated here.

**Completion:** modelled, validated, generated, built, behavior-tested, native-tested, accepted and published are distinct outcomes. Record evidence as `not-run`, `blocked`, `failed` or `passed` per applicable mode; justify `not-applicable` without waiving retained obligations. No document entry, fingerprint or task count proves compliance.

### Navigation

[Product](#1-product-value-scope-and-identity) · [Requirements](#2-requirements-and-traceability) · [UX](#3-user-experience-and-interaction) · [Accessibility](#4-accessibility-localization-and-inclusive-use) · [Editors](#5-declarative-editors-and-semantic-integrity) · [Design system](#6-design-system-and-visual-integration) · [Data](#7-project-model-and-data-ownership) · [Markdown](#8-typed-markdown-and-documentation) · [Settings](#9-configuration-and-paths) · [Starters](#10-external-starters-and-distribution) · [Setup](#11-project-setup-and-first-run) · [Generation](#12-compilation-generation-and-regeneration) · [Architecture](#13-architecture-and-extension-boundaries) · [Persistence](#14-persistence-events-and-recovery) · [Hosts](#15-host-and-platform-compatibility) · [Security](#16-security-privacy-and-execution) · [AI](#17-ai-and-optional-integrations) · [Quality](#18-code-quality-dependencies-and-testing) · [Performance](#19-performance-and-resource-lifecycle) · [Release](#20-delivery-release-and-operability) · [Support](#21-support-licensing-and-product-economics) · [Review gates](#22-review-and-change-control) · [Acceptance map](#23-acceptance-crosswalk) · [Sources](#24-source-register)

## 1. Product value, scope and identity

**Owner:** Product. **Scope:** all surfaces and artifacts. **Sources:** S1–S4.

| ID / basis | Constraint | Verification |
| --- | --- | --- |
| DC-PRO-01 · C | The public product name is **Workbench**. Do not introduce another public name for its CLI, compiler, shell or authoring capability. Historical names may identify retained artifacts. | Review onboarding, documentation, labels and release copy. |
| DC-PRO-02 · C | Preserve repository, package, command, manifest, storage and schema identities until a separately reviewed compatibility migration. Generated projects retain the user's chosen identity. | Inspect identifier diffs and migration scope. |
| DC-PRO-03 · C | Reduce repeated work without reducing understanding, maintainability or acceptance quality. A faster scaffold with hidden gaps does not satisfy the vision. | Compare equivalent first-change and second-change tasks and quality results. |
| DC-PRO-04 · C | Focus on declarative UI creation and evolution. Do not promise automatic business-logic completion, an IDE replacement, a backend platform or autonomous deployment. | Capability and messaging review against actual output. |
| DC-PRO-05 · M | Prove representative webapp and Obsidian-plugin workflows and retain complete generated native Workbench acceptance. Small fixtures and framework shipment do not replace the full self-project obligation. | WVA-12/13/17 and the retained native capability inventory. |
| DC-PRO-06 · C | Core authoring remains useful without an account, mandatory AI or the authoring interface running alongside the generated consumer. Design-only work does not require external Node/npm/Git or a template download. | Clean design-only session and independent consumer continuation. |

## 2. Requirements and traceability

**Owner:** Product + requirements engineering + QA. **Scope:** planned and advertised capabilities. **Sources:** S1–S8.

| ID / basis | Constraint | Verification |
| --- | --- | --- |
| DC-REQ-01 · C | Preserve existing FR/MVP/SH/CX/CP/PUB requirements, task identities, A01–A20 cases and the retained legacy acceptance inventory. DC, WM and WVA identifiers supplement them, not replace them. | Requirement and acceptance crosswalk diff. |
| DC-REQ-02 · M | Every scoped change identifies the user job, target/framework, model impact, documentation impact, ownership, failure modes and acceptance before implementation. | Ready review and representative positive/negative examples. |
| DC-REQ-03 · C | Keep intended capability, inspected source capability and executed evidence separate. Do not infer current readiness from dated PR descriptions or earlier green checks. | Candidate-bound capability matrix. |
| DC-REQ-04 · M | Unsupported semantics, unresolved references and required developer adapters are visible at the affected element. Transport-valid planning data is not automatically generation-ready. | Negative fixtures and element-level diagnostics. |
| DC-REQ-05 · C | A deferral records scope, rationale, dependencies and approval; it cannot silently remove a retained requirement or relabel unfinished product functionality as a user extension. | Backlog and conversion-baseline reconciliation. |
| DC-REQ-06 · P | Maintain a lightweight decision record for a material contract change, including affected DC IDs, alternatives, migration and the accepting roles. Do not introduce a competing task database. | Decision record linked from the existing work item. |

## 3. User experience and interaction

**Owner:** UX + frontend + CLI. **Scope:** visual authoring and guided CLI work. **Sources:** S2–S4, S8.

| ID / basis | Constraint | Verification |
| --- | --- | --- |
| DC-UX-01 · M | Make the current project, selected object, editing scope, unsaved state and next useful action understandable. Prefer contextual controls and progressive disclosure to duplicated application shells. | Unaided core-task replay, including narrow leaves. |
| DC-UX-02 · M | Distinguish editing a reusable definition from editing an instance or pinned revision. Preserve navigation context when moving between page, component and journey editors. | Definition/instance and contextual Back tests. |
| DC-UX-03 · M | Provide undo/redo for supported authoring edits and warn before discarding drafts. Do not imply that editor undo reverses committed filesystem changes or external processes. | History, navigation, close and recovery scenarios. |
| DC-UX-04 · C | Preview side effects before applying them. Destructive or conflicting operations identify affected objects/files and the recovery option rather than relying on a vague confirmation. | Reviewed-plan, cancellation and stale-plan tests. |
| DC-UX-05 · M | Represent normal, loading, empty, error, validation and disabled states where applicable. Explain unavailable actions and required setup; do not use unexplained inert controls. | State inventory exercised through real actions. |
| DC-UX-06 · M | CLI and visual entry points share operation semantics and diagnostics. Machine mode never waits for interactive input; missing required input produces an actionable failure. | Equivalent request fixtures and non-TTY runs. |

## 4. Accessibility, localization and inclusive use

**Owner:** Accessibility QA + UX + localization. **Scope:** authoring, generated supported UI and host integration. **Sources:** S3–S6, S8–S9.

| ID / basis | Constraint | Verification |
| --- | --- | --- |
| DC-A11Y-01 · M | Core outcomes are reachable by keyboard and by a non-drag alternative. Selection, ordering, connecting and editing must not rely solely on pointer gestures. | Keyboard-only and non-drag task protocols. |
| DC-A11Y-02 · M | Preserve visible focus, logical focus order, modal containment and return focus. Background layers and hidden panels must not capture interaction unexpectedly. | Dialog, popover, editor-switch and native-leaf tests. |
| DC-A11Y-03 · M | Use meaningful accessible names, semantics and announced status/errors. Color, icons or animation alone must not communicate a required distinction. | Rendered checks plus screen-reader/manual review. |
| DC-A11Y-04 · M | Check contrast, zoom/reflow, reduced motion, narrow layouts, light/dark host themes and supported-language expansion on the actual supported targets. | Recorded target-specific manual and automated evidence. |
| DC-A11Y-05 · C | Keep supported locale behavior consistent across controls, feedback and settings. Generated locale content is a draft until translated and reviewed, not an automatically selectable language. | Locale completeness, formatting and draft-discovery tests. |
| DC-A11Y-06 · C | Do not claim accessibility compliance, native/mobile support or universal theme compatibility from a screenshot or automated scan. Record the assessed scope and remaining limitations. | Evidence and public-claims review. |

## 5. Declarative editors and semantic integrity

**Owner:** Authoring + shared contracts. **Scope:** pages, components, sitemap, routes, journeys and semantic design. **Sources:** S2–S4, S8.

| ID / basis | Constraint | Verification |
| --- | --- | --- |
| DC-EDT-01 · C | Use one shared visual model for editor, preview and compiler semantics. Do not introduce a second page language or hidden preview-only database. | Shared fixtures and serialized semantic comparisons. |
| DC-EDT-02 · M | Supported layouts, controls, lists, local state, bindings, slots, events, navigation and dialogs have explicit typed contracts and target capability declarations. | Contract validation and generated behavior tests. |
| DC-EDT-03 · C | Keep sitemap hierarchy, surface identity, routes and journey transitions distinct. Dragging changes geometry only; moving or renaming a surface must not silently rewrite navigation. | Geometry-only diffs and explicit route-change plans. |
| DC-EDT-04 · M | Reusable component revisions/variants retain stable contracts and placement pins. Upgrades expose affected usages, incompatible bindings and preserved instance overrides before migration. | Multi-page impact and selective-upgrade fixtures. |
| DC-EDT-05 · M | Deletion, connection changes, branching journeys and modal return paths are validated for dependency impact. Do not leave dangling executable references or silently discard connected work. | Graph, deletion, cycle and navigation tests. |
| DC-EDT-06 · C | Entity/property/relationship declarations are design contracts, not permission to migrate persisted data. ER grouping does not become a persistence boundary; fixture mappings must not be guessed. | Semantic export, source-reference and no-migration assertions. |

## 6. Design system and visual integration

**Owner:** Design system + presentation + host adapters. **Scope:** Obsidian integration unless a rule explicitly addresses project exports. **Sources:** S5–S6, S8–S9.

| ID / basis | Constraint | Verification |
| --- | --- | --- |
| DC-DS-01 · C | Consume Obsidian semantic tokens and scope plugin styles to owned roots. Do not ship Tailwind Preflight, a broad host reset or uncontrolled global styles. | Host-style containment and theme regression tests. |
| DC-DS-02 · C | Integrate Nuxt UI through plain Vue/Vite, not ownership of a Nuxt application/router/color mode. Keep selected components, local icons and owned feedback services. | Import, component and runtime-style inventory. |
| DC-DS-03 · C | Preserve hash-guarded replacements for the two global-style-producing modules. Package upgrades require source review and browser/native requalification, not weakened guards. | Guard negative controls and upgrade evidence. |
| DC-DS-04 · C | Namespace internal CSS variables/keyframes and test overlays/portals for containment. Build matching `main.js`, `styles.css` and manifest assets together. | CSS/artifact checks and real overlay behavior. |
| DC-DS-05 · C | A project's design-system declarations are editable, portable and distinct from the Workbench host theme. Export saved values, not inferred visual styles or session drafts. | Undo/export/import and host-theme isolation tests. |
| DC-DS-06 · C | Design-system/evidence exports must not bundle font binaries or fetch remote assets. Keep extracted host CSS and harness-only frames/adapters out of plugin packages; preserve dependency notices. | Export/archive inventory and network-denial tests. |
| DC-DS-07 · C | Preserve the design-system contract limits: 12 fonts and 64 entries per other category. Validate names, notes, units, numeric ranges and references before mutation; existing stable keys remain read-only. | Bounds, duplicate-key and referenced-font deletion tests. |
| DC-DS-08 · C | Compose ordered modular CSS and imported SFC styles through one shared build pipeline into the complete plugin stylesheet. Do not hand-edit generated CSS, omit SFC styles or ship unresolved imports/unshipped assets. | Deterministic full-style build and exact packaged-artifact tests. |

## 7. Project model and data ownership

**Owner:** Shared contracts + application + persistence. **Scope:** all representations. **Sources:** S2–S6, S8.

| ID / basis | Constraint | Verification |
| --- | --- | --- |
| DC-DAT-01 · C | Stable IDs identify elements; labels, paths and filenames are not substitutes. Maintain declared relationships and revisions across edits, imports and exports. | Rename, move and round-trip fixtures. |
| DC-DAT-02 · C | Define field-level authority between the declarative model, authored Markdown, generated docs and developer-owned source. Reports/previews are derived evidence, not writable competing authorities. | Ownership mapping and competing-edit tests. |
| DC-DAT-03 · C | Validate unknown input and stored values before use. Preserve corrupt/future data, reject unsafe shapes and avoid lossy downgrade or silent default replacement. | Corrupt, future-version and hostile-shape fixtures. |
| DC-DAT-04 · M | Version changed semantics and provide explicit, reviewed migration. Preserve legacy compatible exports; do not advertise unrestricted bidirectional or code-to-design synchronization. | Version/migration and compatibility matrix. |
| DC-DAT-05 · C | Native authoring uses one project per authoring vault; the vault becomes its source root. Multiple leaves share committed project state but own their drafts/subscriptions. | Reopen and multi-leaf consistency tests. |
| DC-DAT-06 · M | Export portable committed project content, not secrets, local approvals, private paths or unsaved session state. Omitted or unsupported content must be declared rather than silently lost. | Export inventory, redaction and round-trip review. |

## 8. Typed Markdown and documentation

**Owner:** Documentation + requirements engineering + import/export adapters. **Scope:** pages, components, interactions, journeys and linked requirements. **Sources:** S1–S4.

| ID / basis | Constraint | Verification |
| --- | --- | --- |
| DC-DOC-01 · M | Support explicitly selected files and bounded folders of typed Markdown through shared CLI/application operations. Reuse existing PRD context; do not introduce a second requirements database. | File/folder intake and existing-project scenarios. |
| DC-DOC-02 · M | Define document type/version, stable identity, references, editable metadata and owned body sections. Report malformed frontmatter, duplicates and missing references with useful locations. | Positive/negative document fixtures. |
| DC-DOC-03 · M | Import is inspect → validate → plan → review → apply. Unchanged reimport is a no-op; stale plans and competing owned-field edits block until resolved. Partial intake requires explicit scope. | Reimport, conflict, cancellation and partial-batch tests. |
| DC-DOC-04 · C | Preserve unrelated frontmatter, handwritten prose and existing file identity. Reading a file or changing a path setting must not rename, move or delete it. | Exact before/after byte and identity assertions. |
| DC-DOC-05 · M | Generate a complete selected documentation structure with an index, stable cross-links, usages, supported behavior, limitations and source provenance. Missing explanations remain visible gaps, not invented rationale. | Content/link assertions and developer handover review. |
| DC-DOC-06 · M | Model changes expose stale documentation. Re-export is deterministic/no-op when unchanged; retirement is reviewed. Keep generated output separate from the authored import root by default. | Freshness, repeated export and preservation scenarios. |

## 9. Configuration and paths

**Owner:** Configuration + CLI + persistence. **Scope:** user-configurable paths and preferences, not arbitrary protected internals. **Sources:** S2–S4.

| ID / basis | Constraint | Verification |
| --- | --- | --- |
| DC-CFG-01 · M | Use `configs/user-settings.json` as the user-facing home for configurable paths/preferences, with one effective resolver used by setup, authoring, generation, documentation and run operations. | Resolver parity and downstream integration tests. |
| DC-CFG-02 · M | Apply explicit invocation overrides over saved settings over versioned defaults. Imported/starter defaults propose reviewed changes; show each effective value and its origin. | Precedence and explanation fixtures. |
| DC-CFG-03 · M | Migrate legacy `shell.config.json` path fields through a reviewed recoverable plan. Conflicting old/new values require a choice; any compatibility projection is derived, not another writer. | Legacy/new/conflicting/corrupt/future configurations. |
| DC-CFG-04 · M | Keep project/manifest identity separate from preferences. Changing a configured path changes future resolution, not the location of existing data without a separately reviewed move. | Identity-preservation and no-implicit-move tests. |
| DC-CFG-05 · M | Inventory configurable PRD/docs/concept/starter/source/test/output/preview/test-vault roots. Advertised non-default paths work through build and test, not just initial generation. | Full non-default-root consumer journey. |
| DC-CFG-06 · C | Validate containment, reserved destinations, overlaps, traversal, symlink escapes and portable case collisions before writes. Configuration cannot grant unrestricted access outside approved roots. | Cross-platform path negative controls. |

## 10. External starters and distribution

**Owner:** Starter contracts + distribution + security. **Scope:** project starters, distinct from compiler presets and design-system token defaults. **Sources:** S2–S4.

| ID / basis | Constraint | Verification |
| --- | --- | --- |
| DC-STA-01 · M | A starter is a standalone `configs/starters/<starterName>.json` definition supplying listing/editing metadata, parameters, defaults, compatibility, content/resources and subsequent supported processes. | Definition schema and discovery/plan fixtures. |
| DC-STA-02 · M | List, edit and execute read the same definition. Ordinary starter additions need no engine branch or duplicate registration; a new execution primitive requires reviewed engine implementation. | Change starter data while engine hash remains unchanged. |
| DC-STA-03 · M | Model a bounded dependency-ordered operation sequence. Reject unknown operations, cycles and incompatible dependencies; a JSON command string is not automatic execution authority. | Process-graph and zero-execution import tests. |
| DC-STA-04 · M | Distribute starter-specific definitions/resources in a separate ZIP. The engine ZIP contains the generic engine/contracts, not hidden blank starters or template/example copies that rebundle definitions. | Exact engine and starter archive inventories. |
| DC-STA-05 · M | With no starter pack, explain how to supply compatible definitions; do not invent a bundled fallback. Project-JSON intake remains usable without a starter. | No-pack and incompatible-pack journeys. |
| DC-STA-06 · M | Pin referenced resources and record provenance/compatibility. Edited copies have changed hashes; unsafe or failed extraction/update preserves the last working pack. | Tampered resources, archive bounds, path/link/collision fixtures. |

## 11. Project setup and first run

**Owner:** CLI + process orchestration + UX. **Scope:** extracted kit, fresh/existing projects and target-specific execution. **Sources:** S3–S5, S8.

| ID / basis | Constraint | Verification |
| --- | --- | --- |
| DC-SET-01 · M | Support the requested Angular existing-Git project opened as an Obsidian vault, with typed PRDs in the configured `docs/prds` root. Preserve `.git`, remotes, `.obsidian`, notes and foreign files. | Existing-project preservation snapshots. |
| DC-SET-02 · C | Keep `new`'s stricter empty-folder/vault safeguards. Existing-project preparation is a distinct explicitly scoped path, not a reason to weaken those guards. | Fresh and existing-project negative tests. |
| DC-SET-03 · M | Guide paths, product/project description, target/framework, PRD file selection or reviewed scan, starter/JSON input, prototype preparation and first-run choice. Back/cancel must not apply unreviewed writes. | Interactive transcript and equivalent noninteractive requests. |
| DC-SET-04 · M | Prototype preparation and first run are independent choices. Declining first run performs no dependency install, build, server/browser launch, native install or activation. | Process/network spies and filesystem assertions. |
| DC-SET-05 · M | Before execution show selected commands, working directory, lifecycle/network effects and target. Track generated, installed, built, verified and showcased separately; stop downstream steps on failure. | Selected-step success/failure/cancellation protocols. |
| DC-SET-06 · C | Use exact-lock installation. Missing/mismatched lockfiles require explicit dependency resolution and review, not a silent fallback. No install/prepare hook may recursively invoke setup. | Lock mismatch and lifecycle tests. |
| DC-SET-07 · M | Resume only after inspecting current settings, starter/model, relevant source and lock hashes. Never blindly retry uncertain processes, kill unrelated services or claim showcase readiness before the expected output is ready. | Stale resume, interruption, port conflict and readiness tests. |

## 12. Compilation, generation and regeneration

**Owner:** Compiler + safe-plan writer + target adapters. **Scope:** source, docs, previews and assets. **Sources:** S2–S4, S10.

| ID / basis | Constraint | Verification |
| --- | --- | --- |
| DC-GEN-01 · C | Keep snapshot-based compilation/diagnostics separate from filesystem mutation and execution. Determinism applies to declared identical inputs; fingerprints identify artifacts, not approval or authenticity. | Pure-phase and reproducibility fixtures. |
| DC-GEN-02 · M | Emit the supported declarative UI, not route placeholders presented as complete pages. Declare target/framework fidelity and distinguish fixture effects from implemented business adapters. | Real generated interaction and semantic comparisons. |
| DC-GEN-03 · C | A write plan states creates, updates, unchanged files, conflicts and retirements. Recheck relevant source/ownership hashes before apply and preserve edited or foreign files. | Stale-plan, conflict and ownership negative tests. |
| DC-GEN-04 · M | Scoped generation includes required dependencies, registrations and corresponding tests/docs. Identical replay is a no-op; changing one component must not rewrite unrelated project work. | Dependency-aware scope inventory and second-change diff. |
| DC-GEN-05 · C | Maintain developer-owned extension seams. Generated consumers build/test without Workbench authoring, a maintainer checkout or private authoring internals. | Clean independent consumer and preserved business hook. |
| DC-GEN-06 · M | Build the offline clickdummy independently from generated source. Label/reset fixtures, show unsupported behavior and never simulate durable writes as real persistence. | File-origin, network-disabled behavior tests. |
| DC-GEN-07 · C | Repair the model, maintained modules or generator rather than hand-patching disposable output to pass. Preserve last-good artifacts and report exact recovery after partial writes; do not claim whole-filesystem atomicity. | Regeneration after repair and mid-write failure injection. |

## 13. Architecture and extension boundaries

**Owner:** Architecture + framework maintainers. **Scope:** reusable foundation and native Vue composition; other targets honor equivalent separation. **Sources:** S5–S6, S8.

| ID / basis | Constraint | Verification |
| --- | --- | --- |
| DC-ARC-01 · C | Domain/application depend on framework-free contracts, not Obsidian/Vue/Pinia/browser/Node or concrete adapters. Infrastructure implements ports; bootstrap wires the runtime. | Import-boundary and negative mutation checks. |
| DC-ARC-02 · C | `main.ts` is lifecycle composition, not business logic. Register features explicitly; keep business code in `src/features/<name>` behind the small `src/features/api.ts` surface. | Composition review and distinct extension fixture. |
| DC-ARC-03 · C | Task/Project and Workbench itself are consumers, not special branches in generic services. New business features do not require editing generic persistence or `main.ts`. | Second-entity and independent-feature tests. |
| DC-ARC-04 · C | In the shell/native Vue composition, SFCs live under `src/presentation/components`; behavior belongs in TypeScript composables, per-view stores and context. Presentation TypeScript does not import Vue components. | `check:presentation` and boundary checks. |
| DC-ARC-05 · C | Native modals/notices are adapters behind shared services; feature commands/ribbons join the explicit registry. Availability checks are side-effect free and execution shares the same policy. | Real service, palette/ribbon and cleanup tests. |
| DC-ARC-06 · C | CLI, authoring and native Workbench reuse public operations, persistence, planner and generator seams. Do not create a second installer/writer or private framework copy for self-hosting. | Cross-entry-point parity and standalone consumer tests. |

## 14. Persistence, events and recovery

**Owner:** Application + persistence + host lifecycle. **Scope:** durable runtime data and state changes. **Sources:** S5–S6, S8.

| ID / basis | Constraint | Verification |
| --- | --- | --- |
| DC-PER-01 · C | Application services own committed data; views own drafts/subscriptions. Markdown stays canonical for note-backed Tasks, with no duplicate Task database in plugin data. | Multi-view updates and storage inspection. |
| DC-PER-02 · C | Explicit plugin-data entities share one serialized envelope writer with preferences. Preserve untouched raw records/revisions; no parallel `saveData` path or unsafe retry after uncertain save. | Concurrent preference/entity and failure tests. |
| DC-PER-03 · C | Prevalidate full candidate bytes; retain IDs, existing paths, creation metadata, unrelated properties and body content. Recheck disposal/folder state after awaited preflight. | Exact Markdown and race/disposal assertions. |
| DC-PER-04 · C | On note creation, use the projected title verbatim plus `.md`, with no automatic ID suffix or silent sanitization/renaming. Reject unsafe portable names and preserve existing/case-conflicting destinations. Updates retain established paths. | Filename, collision and update fixtures. |
| DC-PER-05 · C | Use revision-checked native processing and reversible trash. Do not claim cross-process compare-and-swap/atomic trash or present incomplete rollback as full restoration. | Stale revision, trash and recovery-failure tests. |
| DC-PER-06 · C | Publish committed facts only after successful persistence; use calls for requests/results. Scoped observers cannot acquire publishing capabilities; subscriber failures remain observable without relabeling committed writes. | Event capability, ordering and subscriber-failure tests. |
| DC-PER-07 · C | Subscribe before querying projections and discard stale completions. Dispose runtime/view listeners and handles; a failed open must not become another create operation. | Query race, open failure and repeated close tests. |

## 15. Host and platform compatibility

**Owner:** Host adapters + platform QA. **Scope:** supported authoring/consumer/environment combinations. **Sources:** S3–S6, S8–S9.

| ID / basis | Constraint | Verification |
| --- | --- | --- |
| DC-HOST-01 · C | Distinguish authoring host, output target, frontend framework and artifact form. Existing presets do not prove full behavior parity across combinations. | Published capability matrix and target import checks. |
| DC-HOST-02 · C | Obsidian output honors native lifecycle, themes, storage, commands and owned disposal. A webapp must not import an Obsidian dependency into browser runtime. | Independent native/browser builds and behavior tests. |
| DC-HOST-03 · C | Never test generated plugins in the user's authoring/personal vault. Use an explicitly approved, codebase-contained isolated vault; preserve notes, plugin data and unrelated plugins. | Target validation and preserved-content assertions. |
| DC-HOST-04 · C | Keep shell `.dev-vault` defaults distinct from the newer project `.test-vault/` workflow. Select/configure the target explicitly; do not silently rename or migrate either. | Legacy/new target and no-move tests. |
| DC-HOST-05 · C | Normal setup does not disable Restricted Mode, activate plugins, install global packages or provision/launch a host against a personal profile. Native test provisioning requires its separate isolated protocol. | Setup policy and explicit-operation tests. |
| DC-HOST-06 · M | Qualify documented Windows/macOS/Linux kit journeys. Host app/API/toolchain/mobile versions remain distinct; do not silently raise the host floor or claim mobile acceptance from browser responsiveness. | Exact-archive platform matrix and version review. |

## 16. Security, privacy and execution

**Owner:** Security + persistence + process/release maintainers. **Scope:** all inputs, exports and side effects. **Sources:** S2–S6, S8.

| ID / basis | Constraint | Verification |
| --- | --- | --- |
| DC-SEC-01 · C | Treat JSON, Markdown, starter definitions, repository text, issues and fixtures as untrusted data, not permission or instructions. Import must not execute scripts, HTML, remote includes or package commands. | Hostile-input and zero-execution fixtures. |
| DC-SEC-02 · M | Validate executable operations against a bounded catalog and approved scope. Reading a starter or selecting a wizard option never independently authorizes process, network, native or publication actions. | Capability and side-effect authorization tests. |
| DC-SEC-03 · M | Bound file/record/archive sizes, nesting and decompression. Reject traversal, absolute/duplicate/case-colliding archive paths, unsupported links and unsafe resource references before applying. | Resource-bound and extraction negative controls. |
| DC-SEC-04 · C | Escape user-controlled export/preview text and validate links/references for their supported context. Do not turn data into arbitrary executable expressions or remote asset loading. | Injection and network-denial tests. |
| DC-SEC-05 · C | Keep credentials, tokens, raw causes, note contents and private paths out of exported logs/support bundles. Local actionable file diagnostics are distinct from sanitized shared diagnostics. | Redaction fixtures and support-bundle review. |
| DC-SEC-06 · C | Optional remote/AI data sharing is explicit. Core local authoring does not silently add telemetry, uploads or production connections; local-first does not imply offline installation/publication. | No-network core replay and opt-in boundary tests. |
| DC-SEC-07 · M | Own local processes, bind preview/fixture services to their approved loopback boundary and use the declared protection for simulated APIs. Cancellation cleans up owned resources, never unrelated services. | Process ownership, port conflict and cleanup protocols. |

## 17. AI and optional integrations

**Owner:** Product + integration maintainers + security. **Scope:** optional assistant, memory and adjacent-tool features. **Sources:** S1–S5, S8.

| ID / basis | Constraint | Verification |
| --- | --- | --- |
| DC-AI-01 · C | Keep AI, Hindsight, Jev and other optional tooling out of the default critical path. Their absence/failure must not prevent supported core authoring and generation. | Clean environment without optional tools/providers. |
| DC-AI-02 · C | Agent-generated code/data obey the same schema, ownership, review and quality rules as human work. Model confidence cannot authorize writes, weaken tests or close acceptance gaps. | Shared validators and agent-output negative fixtures. |
| DC-AI-03 · C | PRDs/descriptions provide context, not proof of inferred business behavior. Unknown requirements and missing rationale remain explicit rather than invented as completed functionality. | Generated docs and behavior-gap review. |
| DC-AI-04 · P | Before an optional provider call, disclose the selected data scope and destination and allow cancellation; do not treat a saved provider credential as blanket project-data consent. | Consent and payload-minimization tests for the integration. |

## 18. Code quality, dependencies and testing

**Owner:** Engineering + QA. **Scope:** runtime, generators, tooling and relevant generated applications. **Sources:** S3–S7.

| ID / basis | Constraint | Verification |
| --- | --- | --- |
| DC-QLT-01 · C | Retain limits of 400 code lines for handwritten runtime/CSS/scripts, 450 for tests/helpers and 100 for `main.ts`. Count complete SFC code regions, excluding blank/comment-only lines; generated scaffolds obey the same limits. | Repository line checker and negative fixtures. |
| DC-QLT-02 · C | Whole-production coverage retains 90% lines/statements/functions and 85% branches; domain/application/features retain independent 95%/90% floors. Keep selected-core gates too; missing/invalid evidence fails closed. | Actual coverage commands, inventories and negative controls. |
| DC-QLT-03 · C | Do not weaken analyzer/architecture/complexity/duplication/style gates, suppress whole directories, remove meaningful tests, use unsafe casts or disable both linters to finish. Exemptions remain named and provenance-backed. | Configuration diff and checker-failure mutations. |
| DC-QLT-04 · C | Respect the owner-approved `docs/` working-directory exclusion from repository analyzer/Markdown-link checks; concept assembly/browser checks remain separate. Do not claim that exclusion validates docs; perform explicit review of changed documentation. | Targeted changed-doc/link review and separate concept evidence. |
| DC-QLT-05 · C | Use the exact lockfile and repository-local qualified tools, not a convenient global compiler. At this baseline `AGENTS.md` specifies Node 24.21.0, npm 11.19.1 and TypeScript 6.0.3; version changes require reviewed qualification. | Recorded actual versions and locked-tool invocations. |
| DC-QLT-06 · C | A clean audit is not proof of a fully supported dependency graph. Preserve the documented nested-ESLint support exception; do not force incompatible peers or hide live audit/registry failures. | Dependency exception and actual audit/support evidence. |
| DC-QLT-07 · C | Tests claiming behavior run real services/actions, not default-stubbed success paths. Separate unit/contracts, filesystem, generated build, browser, native, manual accessibility and authorized remote evidence. | Test/evidence inspection and mode-specific results. |
| DC-QLT-08 · C | Keep deterministic fixtures, meaningful negative cases, exact candidate/tool/protocol identity and independent error observation. A TODO, build, report validator or screenshot is not completed business/native acceptance. | Acceptance receipt with source/output hashes and limitations. |

## 19. Performance and resource lifecycle

**Owner:** Performance QA + runtime/authoring maintainers. **Scope:** small fixtures, full self-project and supported native/browser environments. **Sources:** S3–S6.

| ID / basis | Constraint | Verification |
| --- | --- | --- |
| DC-PERF-01 · M | Measure import, selection, typing, dependency impact, generation, preview and native save/reopen on declared fixture sizes. Model-only benchmarks do not prove rendered responsiveness. | Separate model, browser and native reports. |
| DC-PERF-02 · M | Retain stricter established budgets; baseline and approve missing task-specific budgets before acceptance. Record hardware, environment, data size, cold/warm conditions and percentile definitions. | Protocol/budget record and measured results. |
| DC-PERF-03 · C | Own subscriptions, timers, stores, overlays, processes and native resources by their runtime/view lifetime. Repeated open/close must not accumulate resources; do not manually detach native leaves on unload. | Repeated lifecycle/resource protocol. |
| DC-PERF-04 · M | Keep expensive work bounded and cancellable where the workflow requires it. Optimization must preserve output semantics, deterministic planning, diagnostics and safety preconditions. | Large-fixture, cancellation and semantic regression tests. |
| DC-PERF-05 · C | Do not claim productivity or responsiveness improvements from file counts, model microbenchmarks or changed acceptance scope. Report actual measurements and limitations. | Matched-task and benchmark evidence review. |

## 20. Delivery, release and operability

**Owner:** Delivery + release + QA. **Scope:** framework, generated consumer and native Workbench as separate delivery profiles. **Sources:** S3–S8, S11.

| ID / basis | Constraint | Verification |
| --- | --- | --- |
| DC-REL-01 · C | Preserve sequencing: SH-022 technical readiness → separately approved SH-034 framework shipment → reviewed CX-007/CP-001 native conversion → CP-010 native acceptance → separately approved publication. | Gate/dependency and candidate-evidence review. |
| DC-REL-02 · C | The full native product uses the shipped shared foundation and self-project definition. No iframe, copied editor engine, reduced self-project or placeholder required action substitutes for native conversion. | WVA-17 and retained full native inventory. |
| DC-REL-03 · M | Qualify exact engine/starter archives and independent consumers, not only the checkout. Keep source, archive, artifact, platform and evidence identities linked. | Extracted-kit and independent generated-project protocols. |
| DC-REL-04 · C | Preparation/rehearsal is not publishing. No plan, checksum, prior approval, task state or `--yes` grants future tag/push/release/listing/permission authority. Approval binds the candidate, destination and action. | Denied/stale-authorization and read-only rehearsal tests. |
| DC-REL-05 · C | Preserve public versions, foreign releases and retained candidate bytes; uncertain remote outcomes stop for inspection. Respect matching-tag promotion requirements and separately authorized recovery. | Retained release/recovery protocols in their permitted modes. |
| DC-REL-06 · M | Publish only accepted approved bytes; redownload/smoke-test after authorized shipment. Provide compatibility, checksums, licenses, known limitations, setup and recovery instructions for each profile. | Release/support inventory and authorized post-release evidence. |

## 21. Support, licensing and product economics

**Owner:** Product + documentation + support + release. **Scope:** user-facing claims, packages and ongoing maintenance. **Sources:** S1–S5, S8–S9.

| ID / basis | Constraint | Verification |
| --- | --- | --- |
| DC-SUP-01 · M | Help and onboarding name the actual supported commands, artifacts and next steps. Explain conflicts, missing packs/tools, failed stages and recovery without undocumented maintainer intervention. | Clean-user walkthrough and troubleshooting replay. |
| DC-SUP-02 · C | Preserve source/dependency/resource license notices and provenance. Do not assume an asset is redistributable or include protected host/font resources for convenience. | Package/export license and asset inventory. |
| DC-SUP-03 · C | Publication-policy acceptance is separate from build/native acceptance. Recheck applicable current distribution rules in publication work; do not assert certification, marketplace approval or a policy exemption. | Explicit publication-policy review with dated sources. |
| DC-SUP-04 · C | Product benefit remains a hypothesis until measured. Compare equal-scope first and second changes, including assistance, rework, elapsed time and documentation quality; no silent telemetry. | WVA-20 observations, limits and decisions. |
| DC-SUP-05 · C | Preserve inspectable local artifacts and independent continuation. Pricing, licensing topology, cloud collaboration and marketplace features are not decided or added to MVP by this constraints document. | Scope/claims review and independent continuation test. |
| DC-SUP-06 · P | A future feature introducing personal-data collection or hosted processing must identify data categories, purpose, retention/deletion, consent/other applicable obligations and support responsibility before launch. Do not imply legal or standards compliance from this checklist. | Scoped privacy/legal applicability review when that feature is proposed. |

## 22. Review and change control

These checks make the register usable without creating a second backlog or asserting new implementation.

### Ready for design or implementation

Identify the user job, entry path and target/framework; applicable DC IDs and retained requirement IDs; authoritative data and owned files; compatibility/migration implications; side effects and approval boundaries; positive/negative acceptance; and documentation to change. Identify **P** rules awaiting approval. Resolve contract conflicts before destructive behavior is implemented.

### Ready to accept a change

Review model, UX, architecture, security, accessibility and quality implications proportionate to the change. Check preserved handwritten data and unrelated files, stale/cancel/failure behavior, independent consumer impact and updated documentation. Attach actual candidate-bound evidence for each required mode, including failures and not-run scope. A documentation-only change verifies its documents and traceability; it does not promote runtime, native or release readiness.

### Exceptions and amendments

A proposed exception records the exact DC ID, affected targets/versions, reason, risk, alternative considered, compensating control, responsible owner, approver, review/expiry condition and evidence. It must cite any affected parent requirement and state whether it amends that requirement or merely changes implementation. Register it in the existing decision/task workflow. Do not rewrite old results or reuse retired DC IDs for different meanings.

No exception may fabricate evidence or retroactively authorize an external action. Weakening a retained threshold, safety boundary or owner decision requires explicit owner approval and amended governing contracts; ordinary implementation convenience is not approval. Only an actual separate, scoped authorization permits an otherwise guarded publication/native operation. Proposed additions do not silently become release blockers.

## 23. Acceptance crosswalk

The following mapping points to existing WVA scenarios (maintainer-only asset, not included) and WM packages (maintainer-only asset, not included); it is not a replacement acceptance inventory. All retained A01–A20 and scoped parent assertions still need their own evidence. A scenario passing does not automatically satisfy every rule in its family.

| Constraint family | Relevant existing scenarios | Main implementation/review home |
| --- | --- | --- |
| DC-PRO / DC-REQ | WVA-01/16/17/20 | WM-01/02/13/17/18; product review |
| DC-UX / DC-A11Y | WVA-05–07/10/11/18/20 | WM-05/06/09/10/15/18 |
| DC-EDT / DC-DS | WVA-10–13/15/17/18 | WM-09–11/15/17; retained design-system contracts |
| DC-DAT | WVA-01/08/11/17 | WM-02/07/10/17 |
| DC-DOC | WVA-08/09/11/16/20 | WM-07/08/13/18 |
| DC-CFG | WVA-02/05/13 | WM-03/05/11/14 |
| DC-STA | WVA-03/04/19 | WM-04/14/16/19 |
| DC-SET | WVA-05–07/19 | WM-05/06/16 |
| DC-GEN | WVA-11–17 | WM-11/12/16/17 |
| DC-ARC / DC-PER | WVA-01/12/14/16/17/18 | Existing shell requirements; WM-02/12/14/17 |
| DC-HOST | WVA-05/12/13/17/18/19 | WM-05/11/15–17/19 |
| DC-SEC / DC-AI | WVA-03/04/06–09/14/15/18/19 | WM-04/06–08/14; optional integration review |
| DC-QLT / DC-PERF | WVA-12–19 | Retained qualification gates; WM-14–17 |
| DC-REL | WVA-17/19 | SH-022/034, CX-007, CP-001–010, PUB tasks; WM-16/17/19 |
| DC-SUP | WVA-16/19/20 | WM-13/18/19; scoped licensing/privacy review |

### Required decision/evidence boundaries

| Boundary | Required distinction |
| --- | --- |
| Safe import | Reading and planning versus applying; content never grants process authority. |
| First run | Preparation versus install/build/verify/showcase; every stage retains its outcome. |
| Second change | Managed output versus developer-owned work; conflicts versus reviewed migrations. |
| Native evidence | Browser/fixture behavior versus actual isolated host persistence and lifecycle. |
| Release | Technical readiness versus exact-candidate approval versus completed publication. |

## 24. Source register

The consolidation used the following PR #5 documents at the reviewed commit. Relative links follow the branch as it evolves; the baseline SHA above identifies the inspected versions. Detailed linked normative companions remain authoritative for assertions not repeated here. No current public-standard, legal-compliance or live-CI certification is asserted by this register.

| Key | Source | Authority used here |
| --- | --- | --- |
| S1 | Product vision (maintainer-only asset, not included) | Name, users, promises, scope and value hypothesis. |
| S2 | Product principles (maintainer-only asset, not included) | Ownership, declarative design, docs, configuration, starters and developer control. |
| S3 | MVP improvement plan (maintainer-only asset, not included) | Retained target workflows, implementation packages and boundaries. |
| S4 | MVP vision acceptance (maintainer-only asset, not included) | WVA protocols, evidence modes and retained acceptance crosswalk. |
| S5 | [Repository instructions](AGENTS.md) | Architecture, persistence, styles, safety, exact quality gates and toolchain. |
| S6 | Framework PRD (maintainer-only asset, not included) | Retained framework requirements, owner amendments and normative companions. |
| S7 | Dependency exception (maintainer-only asset, not included) | Detailed dependency-support boundary referenced by S5/S6; not a new audit. |
| S8 | Authoring/native PRD (maintainer-only asset, not included) | Single-vault authoring, native conversion, test-data/design-system and publication boundaries. |
| S9 | [Styles](architecture/STYLES.md), [design-system contract](../concepts/companion/DESIGN-SYSTEM.md) | Detailed styling/export contracts retained through S5/S6/S8. |
| S10 | Compiler guide (maintainer-only asset, not included) | Detailed compiler/writer contract referenced by the product documentation map; read alongside S2–S4. |
| S11 | Delivery strategy (maintainer-only asset, not included) | Governing sequencing and approval policy, retained by S3/S8. |
| S12 | Product documentation map (maintainer-only asset, not included) | Entry points and separation of direction, requirements and evidence. |

**Maintenance rule:** update the relevant constraint, source link and acceptance mapping together when a governing decision changes. Leave task status and evidence where they belong; never turn this document into a green checklist without executed proof.
