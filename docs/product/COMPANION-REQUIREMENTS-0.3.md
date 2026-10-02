# PRD: Plugin Shell companion developer workbench

> **Version:** 0.3.0 · **Date:** 2026-09-24 · **Owner:** Luis85
> **Status:** Proposed product requirements; not an implementation or release-readiness claim.
> **Working public name:** Shell Workbench · **Proposed ID:** `shell-workbench` — both subject to availability and review.
> **Inspected baseline:** `Luis85/obsidian-plugin-shell` at `d755745668974820ff4dbcdd0b9f8bfeec307ec3`, iteration 03 / plugin 0.3.0.
> **Related:** [Parent PRD](PRD.md) · [Research and primary sources](../research/2026-09-23-companion-plugin.md) · [Test strategy](../testing/TEST-STRATEGY.md) · [Test concept](../testing/TEST-CONCEPT.md).

> **Current product direction:** One vault, one project. This revision supersedes the earlier multi-project launcher, external-source default and authoring-vault deployment proposal. The historical baseline below remains evidence of earlier CLI capabilities, not the current interaction model. See [single-vault contract and implementation scope](../concepts/companion/SINGLE-VAULT.md).

## 1. Product decision

Build a single-project Obsidian companion that turns an opened vault into a developer’s project workspace. The developer opens an initially empty folder as a vault, installs the companion, defines the project, and designs its requirements, entities/relationships, sitemap, screens and shared component variants. **The currently opened vault is the project/source root.** Only when ready does the developer review additive template preparation in that same folder, install dependencies and run the shared toolchain. Generated-plugin testing uses a separate contained `.dev-vault`; installing the companion is not installing or enabling the plugin being designed.

The companion is maintained in the **same repository**, is itself built using the **same shell foundation**, and is intended for the **Obsidian Community directory**. It is an additional interface to the existing toolchain, not its replacement. The terminal remains a fully supported first-class interface.

### Non-negotiable product principles

1. **One implementation of project operations.** The UI invokes the same setup, maker, build, verification and deployment behavior as the CLI. New functionality needed by both must first acquire a shared, testable operation contract.
2. **Independent generated projects.** A consumer does not require the companion, the maintainer's monorepo, a GitHub account or a network service to keep developing an already provisioned project.
3. **Real dogfooding.** Shared runtime services and public feature APIs power actual companion features. Copying the template once into an unrelated app is insufficient.
4. **Intentional side effects.** Downloading, executing project code, modifying source, installing dependencies, deploying artifacts and activating code are distinguishable decisions.
5. **Evidence, not optimistic badges.** A successful build is not a passed native test or a public release. Failed, stale, skipped and unexecuted checks remain visible.
6. **One vault, one project.** No project registry, project picker, attach-another-project action or alternative source-root field. Other projects are other Obsidian vaults. Multiple workbench leaves share the same project and operation ownership.
7. **Design before the toolchain.** Project definition and all design work remain usable without external Node/npm/Git. Preparation enriches the existing project; it never replaces its identity or authored design.
8. **Honest distribution boundary.** Community acceptance of the project-install workflow must be established before promising marketplace availability.

The first version is desktop-only. It supplies a development workbench, not a full IDE, generic terminal, package manager, cloud service or no-code application builder.

## 2. Problem, users and jobs

### Problem statement

The template's capabilities span environment setup, identity, scaffolding, native deployment, a browser harness, multiple verification scopes and release preparation. A developer must discover commands, remember prerequisites, interpret output and understand which files and vaults will change. This creates coordination and learning work even where the underlying scripts are reliable.

The proposed companion brings these activities into one context without making another authority for project configuration or generated code. These needs are product hypotheses supported by the workflow analysis, not claims from completed user interviews.

| User | Situation | Job to be done | Desired outcome |
| --- | --- | --- | --- |
| First-time plugin author | Knows basic TypeScript but not Obsidian development conventions | Start a real plugin without guessing the setup sequence | A retained project design first, followed by a verified workspace and deliberately enabled plugin in the separate test vault. |
| Experienced author | Uses the terminal/editor daily | Discover and apply template features faster | Accurate generator forms, inspectable plans and copyable CLI equivalents. |
| Template maintainer | Evolves common runtime and scripts | Detect downstream breakage immediately | Companion and independently exported consumer pass the same relevant contracts. |
| Developer returning to a project | Tool versions, paths or source have changed | Understand readiness and resume safely | Actionable diagnostics rather than destructive reinitialization. |

Primary job: **When I open a folder as an Obsidian vault and install the companion, help me turn my idea into a designed and prepared project in that vault, without making me create or attach a second project.**

Secondary jobs: add a note-backed feature; understand entity/document mappings; run the appropriate quality gates; inspect and recover a failed run; move between UI and terminal; prepare a verifiable release handoff.

## 3. Outcomes and success measures

The north-star outcome is a **continuous design-to-development loop in one vault**: define project → capture requirements → design views/components → review preparation → add qualified template files → build → deliberately enable the generated plugin in the contained test vault → implement and verify. The same stable project identity and design survive every stage.

The following are proposed acceptance targets, not existing measurements:

| Measure | Initial target and method |
| --- | --- |
| First-project completion | At least 8 of 10 mixed-experience test participants complete the agreed happy path without facilitator intervention after prerequisites are available. Record download/install waits separately. |
| Safety comprehension | Participants can identify source folder, target vault, selected executable and the difference between install and enable before approval. |
| CLI/UI parity | All supported mutating actions have differential contract tests; no UI-only generator or installer implementation. |
| Recoverability | Every selected interruption fixture preserves unrelated data and reaches an honest recoverable or inspect-required state. |
| Portability | A generated consumer installs/builds/verifies independently of this monorepo and continues working after companion removal. |
| Coverage of delivered tools | Every stable action in the qualified template catalog has a UI entry or a clearly explained guarded advanced entry; aliases are deduplicated. |
| Dogfooding | Every public release identifies the shared foundation revision and passes companion plus standalone-consumer qualification. |

Use facilitated studies, reproducible test records and manually inspected local run records. **Do not add client-side telemetry.** Operational run history exists to explain the user's work, not to collect behavioral analytics. See research R11.

## 4. Scope and staged delivery

### Public v1 scope

A native single-project workbench; vault-local Markdown authoring; design-first onboarding; prerequisite detection only when development operations need it; qualified template staging; reviewed additive preparation in the current vault; explicit execution trust; setup/maker UI over shared CLI contracts; contained test-vault deployment; development sessions; entity inspection; scoped quality evidence; contextual learning; diagnostics; safe single-project recovery; compatibility handling; and release-preparation guidance.

Public v1 must include the requested initially empty-folder journey. “Empty” describes the folder before Obsidian and the companion add their configuration. Existing host configuration and subsequently authored notes are expected, not reasons to erase or replace the root. The source stays in the current authoring vault; `.dev-vault` is an isolated runtime test target, not a second project.

### Explicit exclusions

No multi-project dashboard or registry; source-root selection outside the current vault; new nested project folder; automatic generated-plugin activation in the authoring vault; mobile process execution; automatic Node/npm/Git/Obsidian installation; arbitrary remote-code extensions; companion self-updates; arbitrary shell-command forms; credential vault; Git hosting requirement; browser-based cloud IDE; AI code generation; automatic migration of arbitrary plugins; whole-vault indexing; unattended publishing; editing global package-manager policy; automatic security-setting changes; or silent regeneration of user-edited files.

The full parent-template roadmap remains valid. A companion button must not claim that an unimplemented view/store/modal/style/custom generator already exists. Such capability gaps become shared-tooling backlog, not UI placeholders presented as working features.

### Milestones

| Milestone | Outcome | Public promise |
| --- | --- | --- |
| M0 — feasibility and contracts | Policy interpretation, single-repository distribution rehearsal, standalone export, process and paired-vault spikes | No marketplace-ready claim. |
| M1 — internal vertical slice | Open vault → define/design one project → additive preparation → contained deployment → manual enable → feature generation → recovery | Private/beta evidence only. |
| M2 — public v1 candidate | Complete delivered-tool catalog, usability/accessibility, single-project resume/migration, diagnostics and desktop qualification | Submission candidate; listing still depends on external review. |
| M3 — subsequent improvements | Additional shared makers, opt-in supported reload bridge, reviewed template upgrades and richer release automation | Only advertise individually implemented and qualified capabilities. |

No calendar commitments are implied by these milestones.

## 5. Research-led decisions

The [research report](../research/2026-09-23-companion-plugin.md) distinguishes primary-source facts from recommendations and contains references R01–R17.

| Finding | Product consequence |
| --- | --- |
| Nx Console demonstrates generator forms over CLI behavior (R01) | Reuse the interaction model without introducing Nx as a dependency. |
| Desktop Node/Electron use requires desktop-only classification (R07) | Qualify a native desktop runner, with no mobile execution claim. |
| Community submissions now use the developer dashboard; root metadata matters (R08–R09) | Design one-repository distribution explicitly rather than assuming a nested manifest is sufficient. |
| Public naming rules differ from some current local identity validation (R10; repository setup) | Separate local validity from publishing readiness in shared validation. |
| Dependency installation and policy interpretation are material (R11) | Resolve reviewer acceptance before the public milestone. |
| Host access is not a fine-grained sandbox (R12) | Trust and approval must explain real execution permissions. |
| Official CLI, BRAT and Hot Reload cover neighboring workflows (R03–R05) | Integrate optionally; do not turn them into required foundations. |
| Accessible staged forms support orientation and revisiting steps (R17) | Use a resumable wizard; tours remain optional assistance. |

## 6. Current baseline and mandatory gaps

The inspected repository has a working Vue/Pinia/Nuxt UI foundation, entity/document services, typed events, native services, safe setup and two maker recipes. It is not yet a companion application. [Current product baseline](PRD.md)

| Area | Existing behavior | Companion work required |
| --- | --- | --- |
| Setup | Dependency-free entry, identity plans, answers, final JSON, resume and browser/native profiles | Form adapter, trust boundary, operation history and versioned compatibility. |
| Makers | `feature` and `entity --document`; plans, real tests and catalog checks | Accurate recipe forms and change/result visualization. |
| Native deployment | Only contained `.dev-vault`; no arbitrary vault option | Retain that test-target boundary. Add safe template hydration into the already populated authoring root as a separate shared contract. |
| Machine output | Final JSON on stdout; progress on stderr | Strict parsing now; additive structured progress later. |
| Capabilities | Package scripts and maker listings | Data-only versioned catalog, implementation status and risk metadata. |
| Template distribution | No public release documented at baseline | Qualified standalone source artifact and provenance/compatibility record. |
| Shared foundation | Public feature API and generic runtime services | Multi-product composition and export without a privately copied shell. |
| Release readiness | Separate evidence scopes and unresolved dependency support exception | Companion/export/platform-specific gates; no inherited automatic pass. |

The baseline selects Node **24.21.0** and npm **11.19.1**. Supported engine ranges, selected tested versions, installed versions, Obsidian API declarations and the actual host/installer version are separate facts. Read [setup](../development/SETUP-IDENTITY.md), [authoring tools](../development/AUTHORING-TOOLS.md) and [executed evidence](../testing/ITERATION-THREE.md). This PRD changes no dependency pins or existing test result.

## 7. Experience and information architecture

### Workbench shell

Use a normal Obsidian workspace view, a command-palette entry, an optional ribbon entry and the native settings tab. Reuse the template's Vue/Vite integration, not a Nuxt application. The host owns theme, window chrome and general navigation.

| Area | Main content | Primary action |
| --- | --- | --- |
| Project overview | This vault, project identity, retained design, next step and scoped health | Start designing / Continue design / Resume preparation. |
| Product design | Requirements, entity relationships, sitemap/views, content, versioned component variants, blueprints and action patterns for this project | Create or edit a design artifact. |
| Prepare project | Fixed current-vault root, environment, staged template and additive file plan | Review, approve and prepare this vault. |
| Generate | Delivered maker catalog for the already prepared project | Review source changes, then apply. |
| Develop | Watch/build status, browser/native paths, artifact identity | Start/stop a selected session. |
| Quality | Named checks, scope, freshness, failures and output | Run selected checks / Verify project. |
| Capabilities | Runtime services, entity mappings, styling, testing and documentation | Open relevant guide or supported operation. |
| Release preparation | Artifact checks, identity, disclosures and unexecuted gates | Prepare a handoff; no automatic publish. |
| Runs and recovery | Stage history, logs, partial changes and recovery choices | Inspect / Resume eligible operation. |

Keep the current vault, stable project identity, source root, separate test target and active-run indicator visible. Remove the companion project picker; another project is opened through Obsidian’s vault switcher. Use progressive disclosure: one next-step action first, detailed commands and logs on demand. Do not build an unreadable dashboard of every npm script.

### Design-first entry and preparation wizard

On first use, explain **This vault. One project.** Ask only for a project name, portable generated-plugin ID and optional descriptive information. Author details and execution prerequisites can be completed later. Initialize one `Project.md` record after explicit confirmation, then open requirements/design. Returning to the workbench resumes that same project. No template download or script execution is part of this design initialization.

| Stage | User input or review | Completion condition |
| --- | --- | --- |
| 1. Current project | Confirm the existing project and current authoring vault; explain preparation privileges | Same project remains selected implicitly; no network or execution. |
| 2. Environment | Detected Node/npm; optional Git/editor/host CLI | Required tools resolved or a saved blocked state with instructions. |
| 3. Template staging | Qualified template version and acquisition method; source root is read-only | Acquire into owned staging outside the authoring root; inspect archive safely before any root writes. |
| 4. Project identity | Review existing ID/name/description, complete author/version; optional repository | Shared validation succeeds; stable project ID and existing design are retained. |
| 5. Isolated test target | Review contained `.dev-vault` and its actual config directory, distinct from the authoring vault | Installer safety checks pass; the companion and authoring profile are not deployment targets. |
| 6. Trust and plan | Template provenance, root-relative create/update/unchanged/conflict entries, preserved design/host files, commands and hooks | Approval binds project, full design, source, tools, target and exact file preimages; no unresolved conflicts. |
| 7. Execute | Hydrate approved template files, run canonical setup, then build/verify/deploy as selected; cancellation/recovery | Actual receipts agree with current inputs; the original project/design and unrelated files survive. |
| 8. First working loop | Manual enable instructions, open generated plugin, contextual feature tour | Verified stages plus explicitly labeled observed/user-confirmed host outcome. |

Acquisition is a separate side effect from setup dry-run. Download approval may occur before stage 6; the UI must not claim the whole wizard has been read-only. A setup plan generated after trust retains the existing script's no-write/no-network dry-run contract.

### Contextual tour

Start with this vault’s project and the separate test-vault distinction, then guide a real build, a generated note feature, its entity catalog and its tests. Highlight stable semantic targets, not hard-coded screen coordinates. Users can dismiss, skip, revisit and resume the tour from Help. Forms and commands must work without it.

Do not create sample notes, run scripts, enable a plugin or mark an action successful merely because the user advanced a tooltip. On return, reconcile checkpoints with project identity, input fingerprints and actual run records. Explain a disappeared or unavailable target instead of trapping the user behind an overlay.

## 8. Functional requirements

**Priority convention:** P0 is mandatory for the M1 vertical slice or its safety prerequisites. P1 is mandatory for the M2 public v1 candidate. P2 is subsequent work. All requirements are proposed; none acquires implemented status through inclusion here.

### 8.1 Entry, prerequisites and acquisition

**FR-01 — Native entry and empty state — P0.** Open/focus the workbench through the command palette and ribbon. Empty state offers Start designing and Learn, not Create another project or Attach. With a valid project record, resume it. Missing, duplicate, corrupt or future records receive explicit inspect/recovery states, never an automatic second project. Opening and authoring do not require external Node, execute project code or contact a service. Multiple leaves share runtime-owned project and operation services while retaining local presentation state.

**FR-02 — Environment inspection — P0.** Display detected executable paths, versions, tested compatibility and missing prerequisites. Permit explicit external Node/npm CLI selection with validation. Detect GUI PATH differences without evaluating shell startup files. Never treat Electron's `process.execPath` as the project's Node executable. A blocked prerequisite keeps the wizard data and offers a recheck rather than a reset.

**FR-03 — Template selection and additive acquisition — P0.** Offer a qualified official standalone artifact, verified cached artifact or selected local archive. Show version, resolved revision, digest and compatibility. Download/extract into bounded owned staging, not directly into the authoring root. Reject unsafe archive entries. Plan each destination against the current vault: missing file → create; exact same bytes → unchanged; known owned metadata → separately reviewed update; differing existing or aliased path → conflict. Preserve the real host config directory, companion installation, Git metadata, Project.md body and existing design/notes. No blanket empty-folder rejection, clone-over-root, force overwrite or nested second project. No GitHub login or Git installation is required for the public-artifact route.

**FR-04 — Inspect before execution — P0.** Read static metadata as data. Require project trust before executing setup, maker help, dry-run, entity catalog, package scripts or project-defined configuration. A maliciously modified script is not made safe by the name of its operation. Trust is revocable and separate from approval to perform a particular mutation.

**FR-05 — Stable identity and configuration — P0.** Create one versioned project record with a stable ID independent of the public plugin ID, folder name and display name. Capture project identity during design without requiring the toolchain; require complete author/publishing fields only at their relevant stage. Use shared setup validation/planning when preparing package/manifests, not a separate UI package writer. Preserve lock resolutions, attribution, Git remotes, design references and handwritten note content. Public-valid checks remain separate. Installed identity changes require a distinct migration, never an implicit folder rename or another project.

### 8.2 Plans, setup and recovery

**FR-06 — Reviewable operation plan — P0.** Show affected paths, create/change/conflict status, intended working directory, executable, argument list, selected stages, download/install implications and excluded actions. Approval binds to the operation, source/script/lock fingerprints, toolchain and target. Changed inputs invalidate approval and require a refreshed plan. UI validation may improve feedback but the shared backend remains authoritative.

**FR-07 — Run canonical setup — P0.** Translate form data to declared setup options/answers, request the real dry-run, then invoke the supported noninteractive apply form only after approval. Preserve the existing final-JSON/stderr separation and report actual exits. A process start is not setup success. Missing, malformed or contradictory results fail closed.

**FR-08 — Durable operation lifecycle — P0.** Persist bounded, versioned stage receipts and display queued, running, waiting, cancellation-requested, succeeded, failed, cancelled, interrupted and inspect-required states. Distinguish a mutation committed before a subsequent test failure from a mutation that never happened. Cancellation acknowledges quickly but becomes complete only after owned processes and writes settle.

**FR-09 — Resume and recovery — P0.** Reuse the existing setup journal and locks instead of creating a second source of execution truth. Revalidate fingerprints and artifacts before reuse. Never blindly replay an uncertain write, delete the project to recover, force-remove a lock, or report complete rollback while dependency/cache effects remain. Present preserved changes and recovery artifacts clearly.

### 8.3 Source workspace and development vault

**FR-10 — Current-vault source and contained test target — P0.** Resolve the project root from the actual opened Obsidian vault. Notes, imports, query strings and saved absolute paths cannot redirect it. Default the generated-plugin runtime target to the existing contained `.dev-vault` contract, with validated actual target config/identity. The authoring vault’s companion installation is protected and never used as the generated-plugin destination. Show both contexts; moving a vault re-resolves the root and invalidates approvals rather than trusting synced machine paths. Keep this shared validation available to CLI operations; do not add arbitrary external-vault deployment in this change.

**FR-11 — Safe artifact deployment — P0.** Use the shared installer to stage and promote the complete accepted artifact set into the target plugin-ID directory. Verify manifest identity, source/target separation, previous installation state and candidate hashes. Preserve `data.json`, notes, unrelated plugins and last-good assets. Never deploy over the companion itself. A failed build never installs a mixed candidate.

**FR-12 — Activation and host feedback — P0.** The first release guides deliberate manual enablement in the correct vault. It never modifies Restricted Mode or enables generated code as a hidden setup step. Report installed, enabled, opened and verified as separate states; user attestation is not automated native evidence. Where host state cannot be reliably observed through supported APIs, say so and show the manual check.

**FR-13 — Resume and recover this project — P1.** Discover only the current vault’s single project record and inspect compatible source there without executing it. No project registry, external attachment or in-plugin switcher is maintained. Other projects use Obsidian’s vault switcher. A supported existing project can be adopted only through an explicit same-root metadata review; ambiguous/incompatible roots remain read-only. Legacy multi-project concept data requires explicit selection of one design, with original data and unselected entries retained/exportable; drop old absolute paths, trust, approvals and execution results. Serialize shared mutations across leaves and reject stale reviewed state.

### 8.4 Authoring and capability access

**FR-14 — Maker forms — P0.** Support the actual `feature` and `entity --document` recipes, available presets and safe folder options. Show the planned source, registration, fixture and test changes. Preserve no-force/idempotence/conflict behavior. After apply, display the maker's actual checks and retained source on failure. Do not present generated business logic as an automatically completed UI.

**FR-15 — Entity/document inspection — P1.** Display the real derived catalog's entities, schema versions, fields/defaults, folders and explicit frontmatter mappings. Mark it stale after relevant source edits. Catalog execution requires trust because it evaluates registered developer definitions. Initially inspect rather than invent a second editable schema database; edits go through supported shared makers or an external editor.

**FR-16 — Complete delivered-capability catalog — P1.** Discover the qualified action catalog and offer every implemented stable template operation through a named workflow or guarded advanced action. Show prerequisites, risk, applicable project version, documentation, CLI equivalent and evidence scope. Deduplicate aliases. Planned runtime/generator capabilities are clearly labeled, with no enabled action until a backend exists.

**FR-17 — Development sessions — P1.** Start and stop build/watch or browser-harness sessions through the real scripts. Show active target, loopback URL, output and last complete candidate. Resolve port conflicts explicitly. Closing a panel does not silently abandon or duplicate a runtime-owned session. On unload, stop owned sessions or report an unresolved termination; do not create a hidden background daemon.

**FR-18 — Quality workbench — P0/P1.** P0 runs full baseline `verify` and maker results. P1 exposes all delivered scopes in section 9. Report pass, fail, skipped, blocked, not-run and stale separately, with command, timestamp, input identity and artifact/report references. Keep service, selected-core coverage, production coverage, served-browser, native, security and release evidence distinct. A registry failure is not a clean audit.

**FR-19 — Capability learning and runtime dogfooding — P1.** Link real tasks to the template's entity/document, events, native dialogs/notices, logging, settings, styling and test APIs. Use these services in the companion itself. Optional learning examples run only in owned, identified contexts and never create user data automatically. Remove unrelated starter showcase behavior from the public companion.

### 8.5 Handoff, preferences and lifecycle

**FR-20 — Guided tutorial — P0.** Deliver the resumable, skippable tour specified in section 7. Support keyboard-only operation and visible focus. The tour never becomes a second authorization mechanism or a source of false completion.

**FR-21 — Useful local diagnostics — P0/P1.** P0 supplies structured stage errors and recovery. P1 adds searchable bounded run history and an explicitly previewed, sanitized support export. Default exports omit credentials, absolute paths, note contents, raw causes and environment dumps. Nothing is submitted automatically. Logs render as inert text, not executable HTML or terminal control sequences.

**FR-22 — Release preparation — P1.** Reuse available build/artifact checks and present missing publication prerequisites, metadata issues, disclosures and separately scoped evidence. Produce a local handoff through a shared operation when implemented. Do not claim an unimplemented release script exists. Tagging, publishing, uploading and directory submission remain deliberate maintainer actions outside public v1 automation.

**FR-23 — Settings and persistence — P1.** Provide settings for project-owned relative authoring paths, validated executable preferences, bounded cache/log retention, notices, editor integration and tutorial state. The source root remains the opened vault and is not a configurable workspace path. No known-project registry exists. English/German text uses the shared locale service. Validate and serialize writes, preserve corrupt/future data, and separate portable Markdown project/design records from machine-local trust, path resolution and execution receipts. Synced state must never grant execution authority.

**FR-24 — Compatibility and updates — P1.** Keep companion, template, shared-foundation, operation-protocol and host/toolchain versions separate. Handle unknown catalog/schema versions without executing them. Offer an explicitly selected template version when preparing this vault’s project. Other projects belong to other vaults. Updating an existing consumer is a future reviewed change plan, not a source overwrite. The companion never uses template acquisition to update its own runtime.

**FR-25 — Optional host/tool integrations — P2.** Support a feature-detected official Obsidian CLI reload bridge or an explicitly selected external reload tool after qualification. Require one reload owner, correct vault/ID targeting and approval. No arbitrary `eval`, private API dependency or automatic registration of global commands. A normal editor remains optional and is launched through a validated adapter.

**FR-26 — Companion removal — P1.** Disabling/removing the companion stops its owned work and releases resources, but does not delete consumer source, development notes, installed consumer assets, caches belonging to other tools or user configuration. Document explicit cleanup choices. Existing CLI workflows continue independently.

### Semantic design and reusable variants

**FR-27 — Entity relationship workspace — P0.** Add Entity relationships to Design in the same single-vault project. Provide entity CRUD, readable property cards, source/target handles, reviewed relationship forms, search/catalog, diagram and non-drag list, inspector, pan/zoom, snap, Undo/Redo and independent semantic visual sections. Stable IDs and saved code names survive renaming/grouping. Section removal ungroups, never deletes its entities. Screen creation does not infer business entities.

**FR-28 — Native-compatible property declarations — P0.** Declare Text, List, Number, Checkbox, Date, Date & time and Tags with required intent and optional typed defaults. Check flat-value shapes, finite numbers, calendar dates, false/zero preservation, reserved managed keys, unique field ownership and vault-wide property-name type consistency. Tags is exclusive to tags; aliases/cssclasses use List. The native adapter must additionally inspect destination property conventions. Document the generator's conservative portable subset rather than claiming all host property names are forbidden.

**FR-29 — Owned relationships and generator parity — P0.** Declare both endpoint cardinalities (0..1, 1, 0..*, 1..*), one source-owned stored property and restrict-deletion intent. Use quoted note links as Text/List, derived inverse queries and explicit validation/migration obligations. Reject missing endpoints, duplicate ownership and incompatible fields. Bind sitemap surfaces by declared entity ID. The same portable schema must feed both native UI and shared CLI generation. Entity/default/relationship changes invalidate approval; layout-only changes do not change source. Preserve handwritten source and retained obsolete files for migration. Browser source previews are not evidence that the shared compiler is implemented.

**FR-30 — Versioned component variants — P0.** Define named variants within one shared component, with a mandatory default, typed prop defaults and optional content defaults. Expose management, preview and placement selection. Changed variants require newer definition versions; instances pin version/defaults and retain local overrides until reviewed upgrade. Disclose prop and content changes. Prevent removal while referenced. Generate variant contracts and explicit selected defaults without copying definitions or accepting executable templates/styles from data.

**FR-31 — Bounded and recoverable design editing — P0.** Keep imports/drafts on failure and explicit Close/Escape discard protection. Check current owner/review snapshots before mutation; include semantic/variant state in reload/export/import/history. Fix library miniature overflow while retaining readable labels and accessible controls. Declare limits and reject oversized source previews before corrupting saved state. Test native Markdown write failures separately from controlled browser storage.

The [semantic-layer specification](../concepts/companion/SEMANTIC-LAYER.md) supplies detailed interaction, model, serializer/compiler contracts and current implementation boundaries. The [official property reference](https://obsidian.md/help/properties) anchors host compatibility; semantic constraints remain application responsibilities.

## 9. CLI-to-UI capability coverage

This inventory reflects the reviewed `package.json` and current authoring documentation. These are **existing CLI names**, not new commands introduced by this PRD. The companion adapters and capability catalog are new work. Raw project scripts are executable code even when described as checks.

| UI group/action | Existing script(s) | Scope and qualification rule |
| --- | --- | --- |
| Configure/prepare/resume | `setup` | Existing setup remains canonical after separately reviewed additive template hydration; design initialization requires neither setup nor npm. |
| Generate feature/entity | `make` | Only implemented recipes; show real file plan and generated-test results. |
| Inspect entity mappings | `entities:catalog`, `entities:check` | Derived from trusted source, not static data-only inspection. |
| Command help | `help` | Prefer trusted bundled/catalog descriptions before executing project help. |
| Build candidate | `build` | Build result does not imply test success. |
| Install contained candidate | `build:local` | Contained `.dev-vault` test target; current-vault source safety is FR-10. |
| Compatibility alias | `test-build` | Alias to local install; do not label it a test suite or duplicate the main action. |
| Watch without install | `dev` | Persistent process; no implied native activation. |
| Watch and contained install | `dev:local` | Deployment safety, current target restrictions and last-good guarantees remain. |
| Interactive browser development | `dev:ui` | Browser harness, not native Obsidian; show loopback endpoint. |
| Build/preview harness | `harness:build`, `harness:preview` | Build and served preview are separate states; preview owns a process. |
| Types | `typecheck` | Actual TypeScript/Vue types. |
| Unit/component/service tests | `test`, `test:watch` | One-shot and persistent watch actions; capture actual scope. |
| Coverage | `test:coverage`, `test:coverage:production` | Selected-core and whole-production gates remain distinct. |
| Served browser tests | `test:e2e` | Requires provisioned browser; no implicit browser download. |
| Native checks | `test:native` | Guarded advanced action; only explicitly provisioned isolated native fixtures. |
| Retained baseline | `test:baseline` | Legacy inventory; never promote all parent acceptance criteria. |
| Linters | `lint` | Both current linters, not a substitute for the full analyzer. |
| Dead-code inspection | `analyze` | Current `fallow dead-code` action; distinguish from full analyzer gate. |
| Full analyzer | `check:analyzer` | Current complete fallow report and blocking policy. |
| Architecture and presentation | `check:architecture`, `check:presentation` | Separate boundary checks, not visual review. |
| Source constraints | `check:source` | Current source/locale policy and code-line budgets. |
| Style tokens/artifacts | `check:tokens`, `check:artifacts` | Scope/provenance and complete artifact identity. |
| Dependency policy/security | `check:dependencies`, `check:security` | Show network requirement and independent results; no automatic upgrades. |
| Package-manager policy tests | `test:setup-policy` | Maintainer/advanced capability with isolated fixture requirements. |
| Verify project | `verify` | Existing composed gate; served E2E, native, live security and release remain separately labeled. |

Additional runtime capabilities are presented through FR-19, not fictitious npm scripts. Future views/components/stores/commands/modals/style/locale/custom makers enter this table only after shared implementation and qualification. Any stable catalog action omitted from the UI must have a reviewed reason; inability to implement a backend is not solved by inventing a placeholder command.

## 10. Shared execution architecture and protocol

### Responsibility boundaries

```text
Companion Vue/Nuxt UI
    -> framework-free application orchestration
        -> trusted operation adapter / runtime-owned session manager
            -> external qualified Node + project-local scripts
                -> shared setup, makers, file planner, checks and installer

CLI caller ------------------------------------------^

Companion's own documents/settings/events/feedback
    -> the same shell public services used by ordinary generated consumers
```

Domain/application code remains independent of Obsidian, Vue, Pinia, browser globals and Node. Infrastructure implements process, filesystem, download and host ports. Bootstrap wires concrete services. No Vue component directly launches a process, writes project source or imports a consumer's executable modules.

All executable automation remains under a dedicated `scripts/` structure or an explicitly shared tooling module built from it. The UI cannot import an arbitrary consumer script into the Obsidian renderer to save process overhead.

### Bootstrap before a project exists

The installed companion must be able to display its UI and acquire a source archive before project dependencies exist. Maintain one small acquisition/preflight implementation in this repository, reusable by the CLI and bundled into the companion. It handles data retrieval and owned staging, not downloaded runtime extensions.

After acquisition and trust, use the project-local setup and makers. The exact public name of a new acquisition CLI entry point is to be defined in the implementation contract; no `doctor`, `create` or other unimplemented npm command is asserted here. The existing `npm run setup` consumer entry remains supported.

### Proposed data-only capability contract

The catalog needs schema/protocol versions; template and foundation identity; action ID and implementation availability; supported options, types/defaults/enums; required tools; read/write/network/process effects; progress/result format; evidence scope; documentation reference; and compatibility constraints.

It must not contain arbitrary executable JavaScript, shell fragments, remote component URLs or implicit approval. A claimed low-risk action in an untrusted catalog does not become trusted. The runner uses supported operation IDs and qualified adapters, not arbitrary commands selected by a downloaded JSON document.

For the baseline, use a narrowly versioned compatibility adapter for the existing commands and final JSON. Introduce any event stream additively. Do not parse human text such as “passed” as authoritative machine state.

### Proposed operation records

| Record | Required information | Authority |
| --- | --- | --- |
| Project reference | Opaque ID, display identity, template/foundation revision, protocol support | Static project metadata plus machine-local root mapping. |
| Operation request | Operation ID, validated data options, project identity, selected target | Shared contract; UI and CLI equivalently validated. |
| Reviewed plan | Source/script/lock hashes, changes, stages, effects and preconditions | Shared planner; approval invalid on drift. |
| Run receipt | Run/stage IDs, state, actual command/executable, exits, fingerprints, output references | Actual execution and existing journals. |
| Artifact set | Manifest ID/version, complete asset list, hashes and producing run | Build/check/install receipts. |
| Evidence result | Check/scope, result, inputs, timestamp, tool/host identity and report | Named executed check, never an inferred broader pass. |

Do not store executable requests in Markdown frontmatter and then run them automatically. Human-readable project notes are documentation, not command authorization.

## 11. Same-repository design and dogfooding

### Recommended target, not an immediate refactor

Use a small multi-package/multi-build repository rather than two independently copied applications. npm workspaces are sufficient to evaluate initially; a larger build framework is not a product requirement. Research R16 supplies the workspace mechanism, not proof of export correctness.

Illustrative responsibilities:

```text
apps/companion/             companion feature definitions and application composition
packages/shell/             shared runtime, public contracts, host/UI foundations
scripts/                   setup, makers, shared planners, exports, checks, releases
templates/plugin/          consumer identity, entry points and template-only material
docs/                      product, research, architecture, development and evidence
manifest.json              future Community-facing companion manifest
README.md                  future root distribution explanation for both audiences
```

Exact folders are an architecture decision. Preserve the existing feature-author surface, concern boundaries, style pipeline, tests and standalone consumer commands during migration. No change to current root metadata is authorized by this documentation-only PRD.

### Export requirements

**ARCH-01.** Generate a standalone consumer source artifact from a declared revision. It includes its own manifest, package/lock metadata, scripts, required foundation source or pinned resolvable packages, fixtures, documentation and license attribution. It must not depend on unpublished workspace links, parent directories or the companion installation.

**ARCH-02.** Exclude companion product features, `.git`, credentials, personal paths, `node_modules`, development-vault contents, harness-only host CSS from native output, and private maintenance artifacts. Consumer source may include the supported harness, but its native bundle may not include harness-only assets.

**ARCH-03.** Identity setup inside an exported consumer changes that consumer only. It never renames the companion or root Community manifest. If root monorepo commands become ambiguous, they must require an explicit development target or fail with guidance; they must not silently mutate the wrong product.

**ARCH-04.** Consumer generation works without the monorepo. Qualify an actual extracted artifact in a clean fixture, not only an in-repository example benefiting from workspace resolution.

### Dogfood requirements

| Shared feature | Real companion usage | Required proof |
| --- | --- | --- |
| Public feature API and bootstrap | Projects, runs and tool capability features | No private bypass or business branches added to generic services. |
| Document creation/Markdown repository | Explicitly requested project brief or development handoff note | Preview/commit, frontmatter, revisions and body preservation through shared services. |
| Typed runtime event bus | Run-state and committed project-note events | Runtime isolation, cleanup and observed subscriber failures. |
| Modal/notice/error services | Trust/review dialogs, progress, results and recovery | Shared service use rather than direct host-class duplication. |
| Preferences and locales | Native/UI settings and English/German content | One validated queued writer and consistent locale refresh. |
| Scoped Nuxt UI and modular styles | Actual workbench and dialogs | No host reset, global theme ownership or duplicate CSS pipeline. |
| Logging/diagnostics | Bounded safe run diagnostics | Shared catalogs/redaction, no raw error export. |
| Browser/native testing | Workbench workflows and adapters | Real application behavior with scope-labeled evidence. |

**ARCH-05.** A foundation change must be exercised by both the companion and a separately exported consumer. Ordinary verification must not recursively invoke export qualification that invokes itself. Use separate top-level CI jobs with bounded fixtures.

**ARCH-06.** Consumers need no runtime dependency on the installed companion. Shared build-time provenance does not imply runtime coupling.

## 12. Filesystem, execution trust and safety

### Source and vault placement

**The authoring vault is the project/source root.** A developer opens an empty folder as an Obsidian vault before installing the companion. Obsidian configuration and the companion therefore already exist before project preparation. The native implementation adds reviewed template files alongside project notes; it must not clone over the vault, create a second project directory, or generate into an installed plugin folder. Development dependencies/build output are excluded from authored-note discovery and version control as appropriate; project notes are retained in version control.

Use the existing contained `.dev-vault` default for generated-plugin testing. This is a separate runtime host context, not another managed project. No arbitrary external-vault installer privilege is added. The new shared-tooling work is **safe hydration of a qualified template into a nonempty authoring root**, followed by canonical setup/maker contracts. Until that adapter is implemented and qualified, the browser plan remains a simulation. Existing tooling/agents remain subject to [AGENTS.md](../../AGENTS.md); this PRD never authorizes modifying a personal vault during tests.

At runtime, derive the authoring root and actual configuration folder through supported host APIs. Do not assume every profile is named `.obsidian`; protect the resolved profile, the companion installation and any retained configuration profiles. Reject escapes, links/reparse-point redirection, file/directory overlaps, case aliases and companion-ID collisions. Fixtures must include harmless existing notes, populated host configuration and an isolated contained test vault. Obsidian’s official [vault documentation](https://docs.obsidian.md/Plugins/Vault) distinguishes visible-note APIs from hidden-folder adapter access; its [configuration-folder guide](https://help.obsidian.md/Files+and+folders/Configuration+folder) documents profile overrides. These APIs require separate native qualification.

### Mandatory safety requirements

| ID | Requirement |
| --- | --- |
| SAFE-01 | Opening the companion, inspecting static metadata and browsing help perform no automatic project execution or network request. Acquisition, downloads and live audits are explicit. |
| SAFE-02 | Show that trusted project scripts run with the user's permissions. Scope grants are application safeguards, not an OS sandbox or proof of code safety. |
| SAFE-03 | Resolve a verified external executable, pass argument arrays and bind the working directory. Do not construct a shell string from form input. npm's own script execution still executes trusted project code. |
| SAFE-04 | Validate archive paths before extraction; reject traversal, absolute paths, links, duplicate/case-colliding entries, reserved paths and excessive entry/expanded-size limits. Bounds are finite, documented and negatively tested. |
| SAFE-05 | Validate source/target ownership, real paths and expected file hashes again before mutation. Coordinate CLI and UI through shared locks. Do not describe multi-file changes as a filesystem-wide atomic transaction. |
| SAFE-06 | Roll back only bytes still owned by the operation. Preserve concurrent edits and incomplete-recovery backups. Never erase the last good candidate or force-overwrite a conflict. |
| SAFE-07 | Preserve package-manager registry/proxy/certificate/auth/lifecycle policy. Do not weaken peer checks, install globally, edit PATH, request elevation or silently upgrade the locked dependency graph. |
| SAFE-08 | Never modify Restricted Mode, install over the companion, auto-enable generated code or directly rewrite host security preferences. Detect external reload tooling before promising a target is inactive. |
| SAFE-09 | Preserve note contents, unrelated plugins, `data.json` and Git remotes. Companion removal, preferences reset or recovery never deletes the project record, design notes, source or vault configuration; there is no remove-project launcher action. |
| SAFE-10 | Never log secrets or environment dumps. Treat paths and source snippets as sensitive; safe exports require preview. Render process output and downloaded descriptions as inert content. |
| SAFE-11 | The companion's runtime is fully bundled and updated through supported distribution. Acquired template/project code is never dynamically loaded as companion code. |
| SAFE-12 | Implement bounded process-tree lifecycle control on each platform. Track ownership beyond a bare reused PID. Do not kill unrelated processes or call cancellation complete while children remain active. |
| SAFE-13 | Revoked trust blocks new runs immediately. Source/lock/script changes invalidate affected approvals and evidence. Syncing settings or cloning a project must not grant trust on a new machine. |
| SAFE-14 | Validate remote schemes/hosts and redirects, avoid credential forwarding, cap downloads and handle corruption/rate limits. A checksum proves byte agreement with a reference, not publisher trust by itself. |
| SAFE-15 | Bind browser harnesses to loopback, disclose the local server and do not expose project execution through an unauthenticated network command endpoint. |

No security control makes an intentionally trusted malicious npm script harmless. The UI must explain this without hiding routine developer workflows behind a misleading permission model.

## 13. Data ownership and recovery semantics

Project source, manifests and lockfiles live at the current vault root. One `Project.md` record and Markdown design entities under configured project-owned folders are canonical authoring data. Requirements, views, component definitions and connections retain stable IDs and explicit frontmatter relations. The shared setup/maker journals remain canonical for execution. UI stores are projections of these records, not an independently editable second project database. The interactive concept’s localStorage and virtual file map demonstrate transitions only; they are not a native persistence implementation.

Machine-specific executable paths, resolved vault/test locations and trust receipts remain separate from portable notes. The native plugin derives its source root again from the host on each session. Choose and test a machine-local storage mechanism before public release; plugin `data.json` must not be assumed unsynced. Unknown/future schemas, missing records with existing source and multiple project records stop initialization and offer inspection/export without automatic overwrite.

The required `Project.md` frontmatter contains schema, stable project ID, public plugin identity and relative authoring paths; it contains no execution authorization or authoritative absolute root. Design records use the existing entity/document service patterns. Use safe host note-update APIs that preserve handwritten bodies, comments/unrelated frontmatter and external edits. Obsidian’s [Vault.process guidance](https://docs.obsidian.md/Plugins/Vault) requires checking the current content when applying a previously computed asynchronous change. Multi-file authoring still needs shared ownership, journaling and stale-reference recovery; do not claim a global atomic transaction.

A crash after source mutation but before result delivery creates an uncertain outcome. Recovery inspects journals and actual bytes, then reports what is known. A failed later test retains the generated source for correction. No automatic retry creates another project or another note to compensate for an unclear result.

## 14. Nonfunctional requirements

These are proposed budgets and quality gates; they are not benchmark results.

| ID | Requirement and evidence |
| --- | --- |
| NFR-01 Responsiveness | On a documented reference machine with one project at the declared design-size limit, cached workbench opening targets p95 under 1 second; normal interactions target feedback within 100 ms. Tool work runs asynchronously. |
| NFR-02 Bounded output | Default live output uses a bounded buffer, initially 10,000 lines or 5 MiB, with visible truncation and bounded retained logs. Burst-output tests prove the UI remains responsive. |
| NFR-03 Accessible workflow | All core tasks work with keyboard alone, visible focus, meaningful labels/errors, non-color status and reduced motion. Test 200% zoom, narrow splits and a representative screen reader; automated checks alone do not establish conformance. |
| NFR-04 Native fit | Reuse host tokens, dark/light themes and scoped Nuxt UI. No Tailwind Preflight, global theme takeover, remote fonts or unscoped portal leakage. |
| NFR-05 Localization | English and German for wizard, operation states and recovery; source IDs and machine protocol fields remain stable across locales. |
| NFR-06 Platform qualification | Test Windows, macOS and Linux process/path/cancellation behavior separately, including spaces, non-ASCII names, denied permissions and relevant case/link semantics. Existing Linux native evidence does not certify all three. |
| NFR-07 Offline behavior | Opening/help, current-project inspection, note-based design and already provisioned work remain useful offline without external Node. No broad vault indexing is needed. Acquisition requires a local/cache artifact; missing dependencies or live audits are blocked, not falsely completed. |
| NFR-08 Maintainability | Preserve framework boundaries and current code-line budgets: runtime/CSS/scripts 400, tests/helpers 450, lifecycle `main.ts` 100. No weakening of inherited lint, architecture or coverage gates. |
| NFR-09 Lifecycle hygiene | Repeated open/close, split/pop-out, enable/disable and cold restart leave no duplicate subscriptions, abandoned watchers or unauthorized running children. |
| NFR-10 Provenance | Every distributed companion and template artifact identifies producing source, relevant toolchain and accepted hashes. Reproducibility claims require an executed comparison, not merely a lockfile. |

## 15. Community distribution and release strategy

Use the current Community developer-dashboard workflow and recheck it before submission. The source-specific publishing facts and restrictions are recorded in research R07–R12; this section defines the project's proposed implementation obligations.

**REL-01 — Separate product identities.** The companion has one stable public identity. Each consumer is independently named by setup. Reserve a default-branch root distribution facade for the companion only after the M0 rehearsal validates the repository layout.

**REL-02 — Separate release streams.** Companion tags match its plain `x.y.z` manifest version. Template exports use a distinct namespace, for example `template-vX.Y.Z`, and separate asset names. Consumer releases remain the consumer author's responsibility. Do not assume a monorepo release tool's default prefixed package tag is compatible with Community installation.

**REL-03 — Complete accepted assets.** Companion releases attach the accepted `main.js`, `manifest.json` and, for this styled product, `styles.css`. Never rebuild between acceptance and publication without requalifying the new bytes. Source archives and installable plugin assets are different deliverables.

**REL-04 — Root metadata and provenance.** Root manifest, documented source build, release manifest and assets must agree. The consumer export includes consumer metadata, not the Community-facing companion identity. CI must fail if the wrong product is packaged or a consumer setup changes the root distribution identity.

**REL-05 — Policy review.** Obtain a documented interpretation for user-project dependency installation and external-workspace access before public submission. No private dependency updater or downloaded companion extension is permitted. A rejected interpretation is a product constraint to resolve, not a reason to conceal behavior.

**REL-06 — Accurate listing.** Describe external prerequisites, network endpoints/purposes, external filesystem access, local process execution and privacy behavior. Use a reviewed public name, remove unrelated sample behavior and preserve licenses. Do not claim tested platforms, capabilities or approval that the evidence does not support.

**REL-07 — Independent qualifications.** Companion UI/native qualification, template export qualification, CLI/UI parity and release installation rehearsal are separate required jobs. Existing parent-template tests and a clean vulnerability audit do not close the documented nested-ESLint support exception.

**REL-08 — Deliberate promotion.** Build/verify by default; publish only through explicit maintainer approval with the accepted artifact identity. No wizard-completion action tags, uploads, submits a listing or changes repository permissions.

## 16. Verification concept

Extend the existing test strategy; do not replace it. Add a separate companion acceptance inventory with links to requirements and real evidence. Baseline results remain tied to their existing source and scope.

### Test layers

| Layer | Required coverage |
| --- | --- |
| Domain/application | Identity, compatibility, trust/approval, plans, run-state transitions, stale evidence and safe recovery decisions. |
| Shared tooling contracts | Same normalized requests from CLI and UI produce equivalent plans, source effects, checks and failures in independent fixtures. Normalize only declared nondeterministic IDs/timestamps. |
| Filesystem/process adapters | Actual argument/cwd handling, permissions, archive bounds, symlinks/junctions, cancellation, child cleanup, locks and rollback ownership on the named platform. |
| Real UI/component harness | Forms, validation, progress, errors, keyboard, localization, multiple views and service interactions; not default-stubbed stores presented as application proof. |
| Served E2E | Fresh wizard, generator, diagnostics, missing prerequisites, stale plans and resumable tour using the actual application services. |
| Native Obsidian | Real fresh fixture vault, actual config directory, install/manual-enable path, split/pop-out, themes, unload and cold restart. |
| Export/release | Unpack the produced template outside workspace resolution; setup/generate/verify; install the exact companion assets and inspect provenance. |
| Usability/accessibility | Facilitated tasks, error recovery, keyboard/screen-reader checks and comprehension of privileges and evidence. |

Production and stricter business-code coverage floors remain inherited from the repository. Child processes, CSS, native behavior and browser evidence require their own tests; a high unit percentage is not a substitute.

### Mandatory acceptance scenarios

| ID | Scenario | Acceptance evidence | Requirements |
| --- | --- | --- | --- |
| AC-01 | Open in a fresh vault with no external Node | Define one project, edit/reload requirements and views, zero children/network; preparation alone blocks for missing tools | FR-01–04, SAFE-01 |
| AC-02 | Design then prepare the same project | Stable project/design IDs preserved; additive source-root writes protect notes/host config; actual setup and contained test deployment receipts | FR-03–12 |
| AC-03 | Switch UI to CLI and back | Same project remains usable; no hidden UI state required to build/generate | FR-07, FR-14, ARCH-04/06 |
| AC-04 | Dry-run on trusted source | Real plan; no project writes, lock/report creation, child stages or network caused by the setup dry-run | FR-06/07 |
| AC-05 | Untrusted or changed project | No execution before trust; changed script/lock/target invalidates relevant approval | FR-04/06, SAFE-13 |
| AC-06 | Interrupted download, install or setup | Owned staging and completed stages identified; retry/resume preserves user data and reports scope honestly | FR-03/08/09 |
| AC-07 | Generate and rerun feature | Actual source/tests/catalog produced; identical rerun is no-op; edited scaffold conflicts safely | FR-14/15 |
| AC-08 | Stale plan/concurrent CLI run | Shared lock/hash checks reject unsafe apply; concurrent user changes survive | FR-06/09, SAFE-05/06 |
| AC-09 | Unsafe archive/path/alias | Traversal, link, reserved/case-collision and expanded-size fixtures fail before escape or destructive mutation | FR-03/10, SAFE-04 |
| AC-10 | Occupied/wrong/companion target | Deployment blocked; existing assets, notes and data remain identical | FR-10–12, SAFE-08/09 |
| AC-11 | Build failure after last-good install | Installed complete candidate remains; no new mixed artifact set | FR-11/17 |
| AC-12 | Cancel/unload/crash with children | Honest terminal/interrupted state, owned process cleanup and preserved recovery data | FR-08/17/26, SAFE-12 |
| AC-13 | Native target has custom config directory | Correct validated target; no accidental creation of an unrelated `.obsidian` tree | FR-10/11 |
| AC-14 | Browser passes, native/audit not run | UI never shows global release-ready success | FR-18/22 |
| AC-15 | Log burst or hostile output | Bounded responsive UI, inert content and sanitized export | FR-21, NFR-02, SAFE-10 |
| AC-16 | Tour skipped/resumed after edits | No auto-run/write; checkpoints reconciled; usable keyboard path | FR-20, NFR-03 |
| AC-17 | Standalone export and companion coexist | Both use declared foundation; consumer independent; no shared IDs/storage/CSS leakage | ARCH-01–06 |
| AC-18 | Unknown future catalog/state | Inspectable limited mode, no guessed execution or destructive migration | FR-23/24 |
| AC-19 | Offline and missing caches | Accurate blocked states; existing provisioned work remains available | FR-03/18, NFR-07 |
| AC-20 | Public artifact rehearsal | Root/release identity, tags/assets and standalone template layout agree | REL-01–08 |
| AC-21 | One project, multiple workbench leaves | No launcher/switcher; shared ownership prevents second initialization and duplicate operations | FR-01/05/13 |
| AC-22 | Existing notes and occupied source files | Harmless files survive; conflicting, aliased or concurrently changed destinations block before overwrite | FR-03/06/09, SAFE-04–06 |
| AC-23 | Legacy multi-project or future records | Explicit one-design recovery with original data retained; trust/results/root are not inherited; unsupported records preserved | FR-13/23 |
| AC-24 | Author a semantic model before preparation | Entity/property/default/relationship editing, section membership, alternate list and same-project reload | FR-27/28/31 |
| AC-25 | Conflicting properties or endpoints | Actual validator rejects malformed types/defaults, shared-key conflicts and missing endpoints without canonical writes | FR-28/29 |
| AC-26 | Semantic design feeds generation | Full properties, folders, relationships and surface IDs included; stale apply blocked; grouping keeps source unchanged; native compiler tested independently | FR-27–29 |
| AC-27 | Reuse and upgrade a named variant | Correct placement/defaults, pinned prior version/props, local content preserved, in-use removal blocked | FR-30/31 |
| AC-28 | Narrow library and ER editing | Measured contained miniatures, readable property cards/edge labels and accessible non-drag controls | FR-27/31 |
| AC-29 | Schema changes after source/note creation | Owned changes only, retained obsolete source, explicit native data migration and failed-write recovery | FR-29/31 |

Representative executable acceptance wording:

```gherkin
Scenario: A changed setup plan cannot reuse approval
  Given I approved a setup plan for a specific project and target vault
  And the package lock or setup script changes before execution
  When I apply the plan from the companion
  Then no setup mutation is started using the stale approval
  And I can review a newly generated plan

Scenario: Generated code is retained when its verification fails
  Given a trusted project and an approved maker plan
  When source generation succeeds but the generated test fails
  Then the run is reported as failed with source changes retained
  And the generated files are available for inspection
  And no full-verification or release success is reported

Scenario: Setup does not silently activate a plugin
  Given a complete accepted build and an approved development-vault binding
  When the shared installer deploys the candidate
  Then only the owned plugin artifact files are changed
  And plugin settings and unrelated vault data are preserved
  And the user receives a separate deliberate enablement step
```

These are required tests, not tests executed by this documentation change.

## 17. Implementation backlog and dependencies

Use Epic → Feature → PBI → Tasks. PBIs describe delivered use cases, include acceptance evidence and follow the repository's readiness/verification process. Do not estimate all work from UI screen count alone.

| Epic | Main features and first PBIs | Dependency / exit gate |
| --- | --- | --- |
| E01 Feasibility and distribution | Document project-install policy interpretation; rehearse one-repository metadata; prove external Node execution and owned cancellation | M0 decision record; blocks public-distribution commitment. |
| E02 Shared foundation and export | Compose companion from public services; export a standalone consumer; preserve root/consumer identity separation | E01 distribution decision; ARCH-01–06. |
| E03 Shared operation contracts | Data-only capability catalog; normalize setup/maker results; bind plan approval; CLI/UI differential tests | Existing contracts retained; no UI-only mutations. |
| E04 Native workbench and trust | Open/focus view; empty state; prerequisite inspection; machine-local project trust and settings | E02/E03; AC-01/05/18. |
| E05 Design-first project preparation | Define single project; persist requirements/views; stage template; review additive hydration; apply/resume canonical setup | E03/E04; AC-01/02/04/06/21–23. |
| E06 Isolated generated-plugin runtime | Retain contained test target; complete-asset deployment; deliberate enablement; custom config handling | Explicit safety-contract approval; AC-10/11/13. |
| E07 Authoring and capability UI | Maker forms, entity catalog, complete delivered-tool catalog, real-service learning | E03/E05; AC-03/07. |
| E11 Semantic design and generation | Declare schemas/properties/relationships; organize ER sections; bind views; lower the reviewed blueprint into shared document makers; qualify native records/migrations | E03/E05; FR-27–29/31; AC-24–26/29. |
| E12 Reusable component variants | Manage typed variants; preview/place; preserve pinned instances; review upgrades and generator mappings; verify bounded miniatures | E07; FR-30/31; AC-27/28. |
| E08 Development and quality | Session ownership, watch/harness, all baseline checks, scoped evidence and failure navigation | E06/E07; AC-12/14/15/19. |
| E09 Onboarding and polish | Resumable contextual tour, keyboard/screen-reader, native themes, English/German, single-project recovery and context clarity | M1 working slice; AC-16 plus usability study. |
| E10 Public release qualification | Diagnostics/privacy, uninstall continuity, all desktop matrices, review disclosures and exact-asset rehearsal | All public-v1 P0/P1 and policy gate closed; AC-17/20. |

First vertical-slice PBIs: **Define this vault’s project**, **Persist and resume the project design**, **Inspect development prerequisites**, **Stage a qualified template**, **Review additive preparation in the authoring vault**, **Execute and resume setup**, **Install a complete candidate in the contained test vault**, **Generate a note feature**, **Inspect verification results**. Each native PBI must exercise shared behavior and real file/host boundaries, not a success-only UI simulation.

Definition of Ready: capability and implementation status identified; shared contract agreed; path/security effects specified; UX failure states designed; requirement/test traceability present; no unresolved prerequisite hidden inside the PBI.

Definition of Done: real implementation through approved boundaries; deterministic positive/negative tests; CLI/UI parity where applicable; actual scoped execution recorded; documentation and catalog updated; accessibility/lifecycle checks appropriate to the change; no weakened gates or unsupported success claims.

## 18. Risks, decisions and open questions

| Risk / question | Recommended decision | Owner / closure evidence |
| --- | --- | --- |
| Project dependency install conflicts with Community policy | Seek early interpretation using actual process/cwd/dependency boundaries; do not conceal behavior | Maintainer; written review outcome before public candidate. |
| Root template identity conflicts with root distribution manifest | Separate companion facade and standalone template export, then rehearse | Architecture/release; independent export and install evidence. |
| Authoring root is already populated before template acquisition | Add shared staged/additive hydration, protect actual host profiles and design notes; keep generated-plugin deployment contained | Tooling/security; occupied-root, custom-profile and stale-write fixtures. |
| GUI PATH, npm wrappers and process cancellation differ by OS | External executable selection and platform-specific owned adapters | Engineering; three-platform evidence. |
| Companion becomes a second implementation | Shared operation contract and differential tests are required | Architecture; source review and parity tests. |
| Trust is misrepresented as isolation | Explain OS permissions; no sandbox claim or automatic code execution | Security/UX; comprehension test and negative controls. |
| New generator UI gets ahead of actual makers | Catalog availability derives from qualified implementation | Product/tooling; no phantom actions. |
| Template acquisition quietly introduces incompatible dependencies | Pin artifact/toolchain compatibility; preserve lock and user policy | Maintenance; exact-source clean-install evidence. |
| Generated source depends on monorepo symlinks | Export outside repository and without companion installed | Release; AC-17. |
| Unsupported nested lint dependency is forgotten | Retain and link the current exception until independently resolved | Maintenance; no audit-equals-support claim. |
| Name/ID conflicts or public rules change | Validate the working name and current rules before submission | Maintainer; directory validation. |
| Machine-local trust storage accidentally syncs | Select and test storage design before M2; synced metadata grants nothing | Architecture/security; cross-machine negative fixture. |

Product choices settled by this proposal: **one project per vault; the opened vault is the source root; design before preparation; additive template hydration; contained `.dev-vault` for generated-plugin testing; no companion project picker or external source workspace**. Desktop-first, local development without an account, canonical CLI, no generic terminal, no telemetry, manual activation and separately qualified outputs from the same repository remain unchanged.

Still to resolve through implementation evidence: policy acceptance, final public name, exact shared-package layout, capability schema/version policy, machine-local storage mechanism, platform process-tree implementation and supported current-root/config discovery, safe Markdown-entity serialization, lossless native recovery and additive hydration APIs. These do not justify inventing unverified capabilities.

## 19. Public-v1 acceptance checklist

- [ ] Community policy interpretation and one-repository distribution rehearsal are documented.
- [ ] The companion is a real shell consumer, not a maintained copy or special-case runtime fork.
- [ ] An initially empty-folder vault can define and retain one project without Node/npm, then prepare that same root without replacing design/notes/configuration or requiring GitHub login.
- [ ] Existing-source adoption, legacy data recovery, moved vaults and multiple leaves preserve the singleton and cannot inherit machine trust.
- [ ] Missing prerequisites, offline conditions, conflicts, failed tests and interruption have recoverable, truthful UI states.
- [ ] Every implemented stable template tool is available through an appropriate UI path, with unsupported future tools clearly distinguished.
- [ ] Shared CLI/UI contracts, approvals, locks, safe deployment and generated-source preservation are exercised by negative tests.
- [ ] Standalone consumers work without this monorepo and after companion removal.
- [ ] Windows, macOS and Linux claims are supported by named executed tests; native evidence remains separate from the harness.
- [ ] Keyboard, screen-reader, theme, zoom, narrow-pane and localization qualification is recorded.
- [ ] Privacy/disclosures, bounded diagnostics, lifecycle cleanup and no-self-update behavior are reviewed.
- [ ] Root/release metadata and exact accepted assets agree; no unrelated sample code is shipped.
- [ ] All remaining exceptions are explicit, and no unexecuted check is represented as passing.

## 20. Source and evidence conventions

External facts use the R01–R17 register in the [dated research report](../research/2026-09-23-companion-plugin.md). Repository capability claims come from the pinned baseline, current [setup](../development/SETUP-IDENTITY.md), [makers](../development/AUTHORING-TOOLS.md), [package scripts](../../package.json), [actual setup entry](../../scripts/setup.mjs), [parent PRD](PRD.md) and [verification record](../testing/ITERATION-THREE.md).

This document adds a proposed product. It does not implement the companion, approve new filesystem privileges, change dependency policy, publish artifacts, reserve a listing or upgrade existing evidence. Any implementation-status update must identify its code revision, actual commands and scope-labeled results.


## Data Sources: semantic contracts on the sitemap

The single project owns a reusable catalog of external services/APIs, databases and the generated plugin's active Obsidian vault. Each source declares named operations, supported business-data directions, resource metadata, authentication reference names and independent input/output shapes. Shapes may reference a declared ER entity or define an external payload without polluting the entity model.

Sitemap surfaces use these operations through labeled read (source → surface), write (surface → source) or bidirectional flows. These are separate from navigation and containment and never make a screen reachable. A response acknowledgement does not imply bidirectional synchronization. Sources expose their current usages and support explicit editing, deprecation and guarded removal. Declared data flows feed the same reviewed generation plan as surface and entity contracts.

Source-kind capabilities, bounded schemas, dangling references, incompatible directions and unsafe locations are validated before canonical changes. Source/operation deletion, surface deletion and entity removal cannot silently break usages. Undo/Redo, draft recovery and review invalidation apply; geometry-only edits do not change contracts. Credential values, database connection strings, SQL execution, external requests, native vault writes and inferred synchronization are outside the interactive concept.

See the implemented [Data Sources contract](../concepts/companion/DATA-SOURCES.md) and [qualification record](../concepts/companion/DATA-SOURCES-VERIFICATION.md). Native runtime adapters and compiler integration remain separately accepted implementation work.
