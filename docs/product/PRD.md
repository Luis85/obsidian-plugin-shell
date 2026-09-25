# Product requirements: Obsidian Plugin Shell

> **Version:** 0.11.0 · **Updated:** 2026-09-23 · **Owner:** Luis85
> **Implementation milestone:** Authoring, optional examples, shared durable persistence
> and executable qualification milestone, plugin version 0.4.0. Final platform/public-release
> readiness remains evidence-bound.

## Product goal

A developer obtains the template, runs a guided setup, generates a feature, develops using a real-component harness and native Obsidian, verifies the work, and publishes the exact accepted assets. Target current public Obsidian with a qualified, actively maintained dependency graph.

The template is also a developer-facing framework foundation: reusable, typed
abstractions should support rapid plugin ideation and iteration without changing
generic persistence or lifecycle internals. The [framework guide](../development/FRAMEWORK-GUIDE.md)
maps that extension path. Production readiness is the result of qualifying the
actual consumer and its applicable requirements, not an automatic property of
starting from the template.

The owner requested the first runnable iteration up to an openable showcase view. That slice now implements the native view, selected Nuxt UI components, Task Markdown workflow, shared preferences, typed events, feedback, scoped CSS, setup/local installation and executable tests. Do not interpret a working showcase as completion of every v1 capability.

## Requirements remain in force

**Executable qualification extension:** The [selected plan](../development/EXECUTABLE-QUALIFICATION-PLAN.md)
addresses TST-08–11/15, QLT-05/12 and NFR-02–05 over the existing implementation.
Trusted producer adapters bind actual framework/native results to source, tools,
protocols and candidate assets. An additive crosswalk retains all 96 legacy
acceptance rows and required modes. Full production function-complexity and clone
measurements, ownership cycles and controlled-reference timing remain separate
from execution rates and source coverage. See the
[execution record](../testing/EXECUTABLE-QUALIFICATION.md) for measured results;
unexecuted modes and the blocked release profile remain visible.

**Runtime authoring extension:** Complete narrow publication/observation contracts,
explicit event descriptor composition and source-derived catalog/check commands.
The optional Items reference uses the existing plugin-data backend for stable-ID
create/rename/delete, with trimmed 1–120-character labels and separate per-view
drafts. It shares the preferences writer and refreshes committed projections from
typed facts. Task remains a distinct Markdown workflow. See the
[implementation and acceptance plan](../development/RUNTIME-AUTHORING-PLAN.md).
This work addresses EVT-03/05/06/11/16 and EXA-01–03; execution evidence is recorded
separately and does not promote all historical acceptance cases. The release
executor below is now part of the merged integration baseline.

**Release execution extension:** The [milestone plan](../development/RELEASE-EXECUTION-PLAN.md)
adds authenticated GitHub discovery and a separately authorized local executor for
retained candidate drafts, missing uploads and promotion. It reuses the existing
candidate/planner contracts, preserves public versions and stops on uncertain
outcomes. Promotion requires an existing matching tag. All workflows remain
read-only; no publication, tag, listing or permissions change is authorized.
The [readiness ledger](../development/TEMPLATE-READINESS-LEDGER.md) accounts for
remaining requirements and every legacy acceptance row without promoting earlier
evidence. The standard privileged Actions interface and real first/subsequent
publication qualification remain open.

**Iteration 04 extension:** Complete the local maker catalog with primitive reuse,
explicit local custom registry, domain-only definitions and useful integrated
source. Remove optional demonstrations through reviewed file/registration ownership
while preserving consumer features and shared tests. Add explicitly selected
plugin-data CRUD through the same runtime writer as preferences; do not duplicate
Markdown authority. Preserve corrupt/future data and untouched raw records, reject
stale snapshots and stop after uncertain writes. Add focused generated formatting,
seeded data properties, rendered accessibility, test/workflow/style/documentation
checks and fixed-commit retained-asset release preparation. No automatic migration,
ORM/query language, whole-vault index, publication, permission changes or automerge
is introduced. See the [plan](../development/ITERATION-FOUR-PLAN.md),
[review](../development/ITERATION-FOUR-REVIEW.md) and
[executed evidence](../testing/ITERATION-FOUR.md).

**Owner amendment — note titles:** On creation, the document service uses the
projected title verbatim as the Markdown filename, followed only by `.md`.
IDs remain in frontmatter and never appear as an automatic filename suffix.
Unsafe portable names are rejected; existing or case-conflicting destinations
are preserved and reported, without automatic renaming. Entity normalization is
an explicit upstream business rule, not filename sanitization. Existing notes
are not renamed or migrated; later updates retain their established paths.

| Iteration 04 capability | Implementation and qualification boundary |
| --- | --- |
| Maker catalog | Integrated feature/entity/view/component/store/usecase/command/modal/setting/event/listener/style/locale/custom recipes; locale drafts remain nonselectable until translated/reviewed. |
| Optional examples | Reviewed removal plan, consumer-preserving registry edits and minimal foundation source/test profile; source planning is separate from resulting-plugin qualification. |
| Plugin-data entities | Typed explicit backend, one serialized envelope writer, authenticated revision snapshots, schema preservation, committed facts and disposal. No cross-process atomicity claim. |
| Quality | Existing floors retained; generated formatting, properties, rendered axe/keyboard checks and targeted guard mutation plus bounded repository policies. |
| Maintenance/release | Dependabot configuration, truthful freshness states, consistent version plans and fixed-source retained-asset rehearsal; public promotion remains explicitly unauthorized. |

The iteration 03 table below is retained baseline context. The rows above and
current evidence supersede its pending-capability descriptions without promoting
any unrelated historical acceptance case.

**Iteration 03 scope extension:** The owner's new request adds reusable entity
definitions, optional document recipes and typed repository CRUD to the template.
This supersedes the retained exclusion of a generic repository only for the
bounded, entity-bound Markdown repository described in the
[iteration plan](../development/ITERATION-THREE-PLAN.md). ORM/query languages,
automatic migrations and whole-vault indexing remain excluded. Task is an example
consumer; shared services must support another entity without special cases.

The extension path is a first-class template capability: feature authors work in
`src/features/<name>`, import a small public authoring API, and add one explicit
registration. Shared dependencies/lifecycle are wired once. Business modules must
not be buried in adapters or require editing generic repository/service code.

The complete pre-implementation contract is retained verbatim in [SPECIFICATION-0.7.md](SPECIFICATION-0.7.md), incorporating [BASELINE-0.4.md](BASELINE-0.4.md) and all normative companions. Its historical capability/status paragraphs are superseded by this page and the current [iteration record](../testing/ITERATION-THREE.md); the numbered requirements, safety rules and intended final commands are not weakened or deleted.

| Contract | Scope |
| --- | --- |
| [Retained full specification](SPECIFICATION-0.7.md) | Existing requirement identifiers, 96 acceptance cases, work packages and complete-v1 targets. |
| [Setup and makers](../development/SETUP-AND-MAKERS.md) | Full future wizard, identity/migrations, generators and safe edit plans. |
| [Typed event bus](../architecture/EVENT-BUS.md) | Full event/catalog/bridge/lifecycle contract. |
| [Styles](../architecture/STYLES.md) | Modular source, single output, isolation and artifact parity. |
| [Documents](../architecture/DOCUMENT-CREATION.md) | Typed definitions, preview/commit, Markdown and failure semantics. |
| [Errors and notifications](../architecture/ERRORS-AND-NOTIFICATIONS.md) | Full outcomes, feedback ownership, queue/timer/recovery policy. |
| [Harness styles](../testing/HARNESS-STYLES.md) / [tokens](../design/OBSIDIAN-TOKENS.md) | Host fixture provenance, semantic roles, tokens and fidelity. |
| [Nuxt UI plan](../development/NUXT-UI-IMPLEMENTATION-PLAN.md) | Selected frontend foundation, full integration roadmap and NUI acceptance matrix. |
| [Test strategy](../testing/TEST-STRATEGY.md) / [concept](../testing/TEST-CONCEPT.md) | Determinism, negative gates, evidence and full qualification. |

The [machine plan](../testing/test-plan.json) remains the retained baseline inventory. Iteration-specific runtime/browser IDs and evidence are documented separately; they do not silently turn every prior acceptance item into verified status.

## Current capabilities

| Capability | Status in iteration 03 |
| --- | --- |
| Native plugin and open/focus command/ribbon | Implemented. Iteration 02 exercised native opening in Obsidian 1.13.7; the current candidate's native results are recorded separately. |
| Nuxt UI showcase | Real Vue/Pinia components with four panels, not a parallel mock UI. |
| Entity/document/repository foundation | Typed fields and explicit recipes, catalog validation, preview/commit and Markdown CRUD with revision checks. Task/Project share the same infrastructure. Current iteration also supplies explicit shared-writer plugin-data CRUD. |
| Settings | Native declarative tab and Vue preferences use one validated queued service; English/German, local panel preference and persisted isolated native-header visibility. |
| Event bus | Typed plugin-scoped facts and eight owned normalized native mappings; listener failures remain independently observable. |
| Feedback | Owned local/native handles, progress delay, transient timing/queues, persistent recovery, locale refresh and single-flight action policies. Broader manual/accessibility qualification remains separate. |
| Native service API | Dedicated ModalService info/confirm/prompt outcomes and native-first NoticeService helpers with owned cleanup and real browser/native adapter contracts. |
| Commands and ribbon | Feature-owned typed descriptors join an explicit bootstrap registry; availability, shared single-flight execution, outcome handling and native cleanup are centralized. |
| Logging and debugging | Runtime opt-in detail, typed feature catalogs, bounded redacted records, independent error diagnostics and explicit sanitized report commands. |
| Styling | Native token roles, Nuxt UI containment, local icons, no Preflight/global head injection, one composed plugin CSS. |
| Browser harness | Actual services/components with synthetic adapters, served Playwright tests and independent captured-defect observation. |
| Setup and local install | Dependency-free identity/profile review, root-lock metadata preservation, verified resume, explicit disabled-plugin data migration and contained asset installation. |
| Author tooling | Safe registered recipes, real generated CRUD tests/fixtures and actual-source entity catalog/check commands; the current full local catalog includes UI/custom makers and reviewed example removal. |
| Tooling | Exact lockfile, Vite/Vitest, strict types, Oxlint/Obsidian-Vue ESLint, source/locales, real fallow architecture and artifact checks. |
| Coverage and broad analysis | Whole-production and stricter domain/application/features coverage gates; complete inventory and negative probes. Full fallow zero-finding analyzer, independent architecture and presentation-concern gates. Broader complexity/duplication qualification remains pending. |
| CI | Read-only Linux/Windows verification, Linux served-browser and selected native smoke, temporary artifacts only. |
| Mobile/release/template qualification | Pending. Manifest desktop-only, no public release or directory submission. |

See [ITERATION-THREE.md](../development/ITERATION-THREE.md) and [README](../../README.md)
for actual APIs/commands. Do not invoke future maker/release commands from contract
examples until implemented.

## Architecture invariants

Presentation → application → domain remains the dependency direction; infrastructure implements inner ports and bootstrap wires concrete services. main.ts is nine lines of lifecycle composition. Runtime services own canonical data and the bus; each view owns Vue/Pinia state and cleanup. Task Markdown remains canonical, without a duplicate Task database in data.json.

Handwritten source/CSS/scripts are limited to 400 code lines, tests/helpers 450,
and main.ts 100. At the owner's iteration 03 request, comment-only and blank lines
are excluded; all code regions in an SFC count together. Physical counts remain
diagnostic. This explicitly supersedes the physical-line wording of retained
ARC-01/QLT-01/QLT-02 without changing their numerical limits. Executable file names
describe behavior/responsibility rather than iteration numbers; historical
iteration documents keep their meaningful chronology. The gates still test
forbidden architecture edges. No native stylesheet or harness tooling is packaged
in the plugin, and failures cannot become false-success writes or unsafe retries.

## Nuxt UI and compatibility decisions

The first qualified graph uses Nuxt UI4.11.2, Vue3.5.43, Pinia4.0.3, Vite8.3.0, Vitest5.0.1, TypeScript6.0.3 and Node24.21.0. TypeScript7 was rejected by the actual parser peer constraints rather than installed with a force override. Native API declarations1.13.1 and tested host1.13.7 are recorded separately.

Nuxt UI integrates through plain Vue/Vite without the Nuxt framework/router. A narrow source-hash-guarded build adapter removes two global-style-producing modules. CSS uses an owned root and native semantic variables; selected local SVG assets and dependency notices are bundled. Expanded components, package upgrades, additional overlay/portal behaviors and mobile require requalification.

The retained nested ESLint support exception and its review boundary are in the [dependency exception record](../development/ITERATION-TWO-DEPENDENCY-EXCEPTION.md). Current audit results belong to the [executed verification record](../testing/ITERATION-THREE.md). A lockfile provides reproducibility, not proof that every transitive dependency has no advisory.

## Verification and definition of this milestone

The [iteration test record](../testing/ITERATION-THREE.md) identifies actual checks,
source/candidate identity, failures corrected and untested scope. `verify` covers
static/service/production-coverage/artifact/retained-baseline/harness-build checks;
served E2E and native qualification are separate. Full PRD verification and release
promotion are not implemented aliases to this gate.

The milestone is a reusable entity/document foundation with a working desktop
example, integrated maker catalog, reviewed example removal, shared plugin-data
persistence and fixed-asset release rehearsal. The local release executor extends
that foundation. Complete template qualification still requires the specific
runtime/tooling gaps in the readiness ledger, the Actions publication interface,
real public-release qualification and expanded host/device/accessibility evidence.
Native evidence is limited to named checks and cannot certify all hosts, themes
or devices.

## Proposed companion product

The [shell-first delivery overview](../../SHELL-FIRST-OVERVIEW.md) and
[delivery strategy](DELIVERY-STRATEGY.md) define repository execution order:
qualify and ship the shared shell, TypeScript CLI and project generator first; build the native companion on that shipped framework second; publish the companion last.

The [companion developer-workbench PRD](COMPANION-PLUGIN-PRD.md) specifies a
same-repository Obsidian companion built on the shell: **one vault, one project**.
A developer opens an initially empty folder as a vault, installs the companion,
and defines/designs the project before needing Node/npm or a template. Preparation
adds reviewed source files to that same vault while preserving its notes and host
configuration. Generated-plugin testing uses the contained `.dev-vault`, not the
companion's authoring profile. Other projects are other Obsidian vaults.

The [single-vault contract](../concepts/companion/SINGLE-VAULT.md) identifies the
implemented browser concept, native persistence/hydration backlog and acceptance
boundary. The [earlier research](../research/2026-09-23-companion-plugin.md) is dated
background; its external-source and multi-project proposals are superseded.
This remains proposed native product scope, not an installable companion,
marketplace listing, native file-write qualification or change to root-template
verification results. The shared CLI stays canonical.

### Companion semantic design and variants

The companion's single-project Design workspace also declares runtime entities,
Obsidian-compatible properties, cardinalities and source-owned note relationships.
Visual ER sections organize the model without becoming persistence boundaries.
Sitemap surfaces reference declared entity IDs; the reviewed generator consumes
those declarations alongside views and reusable components. Named component
variants share one contract, pin defaults/version at placement and retain local
content until reviewed upgrades. See the [semantic-layer contract](../concepts/companion/SEMANTIC-LAYER.md).

The browser concept implements these authoring interactions and input-driven
source previews. Shared CLI lowering, native Markdown schema records,
relationship resolution and safe data migrations remain separately qualified
implementation packages; no existing root runtime behavior is replaced here.

### Framework developer-kit entry refinement — 2026-09-24

The primary developer starts with the assembled GitHub framework release archive, not an installed plugin: extract → console setup/configure → import project JSON → reviewed generation → develop/build/test → explicitly publish the generated plugin → maintain. The compiled TypeScript-authored CLI runs before dependency installation, both directly and through npm aliases, and shares operations/makers/contracts with the template and future companion. An independent project root and custom source/test paths are first-class.

The [implementation plan](../development/FRAMEWORK-CLI-GENERATOR-PLAN.md) and SH-023–SH-034 extend the existing requirements. SH-022 remains technically blocked; SH-034 requires new exact-candidate authorization. Existing read-only handoff semantics and all earlier quality/safety requirements remain unchanged. This amendment is not runtime implementation or a release claim.
