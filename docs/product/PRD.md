# Product requirements: Obsidian Plugin Shell

> **Version:** 0.9.0 · **Updated:** 2026-09-22 · **Owner:** Luis85
> **Implementation milestone:** Entity/repository and test-foundation milestone,
> plugin version 0.3.0. The complete GitHub-template product is not yet finished.

## Product goal

A developer obtains the template, runs a guided setup, generates a feature, develops using a real-component harness and native Obsidian, verifies the work, and publishes the exact accepted assets. Target current public Obsidian with a qualified, actively maintained dependency graph.

The owner requested the first runnable iteration up to an openable showcase view. That slice now implements the native view, selected Nuxt UI components, Task Markdown workflow, shared preferences, typed events, feedback, scoped CSS, setup/local installation and executable tests. Do not interpret a working showcase as completion of every v1 capability.

## Requirements remain in force

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
| Entity/document/repository foundation | Typed fields and explicit recipes, catalog validation, preview/commit and Markdown CRUD with revision checks. Task/Project share the same infrastructure. Note-feature makers and catalog CLI are implemented; alternate durable backends remain pending. |
| Settings | Native declarative tab and Vue preferences use one validated queued service; English/German, local panel preference and persisted isolated native-header visibility. |
| Event bus | Typed plugin-scoped facts and eight owned normalized native mappings; listener failures remain independently observable. |
| Feedback | Owned local/native handles, progress delay, transient timing/queues, persistent recovery, locale refresh and single-flight action policies. Broader manual/accessibility qualification remains separate. |
| Native service API | Dedicated ModalService info/confirm/prompt outcomes and native-first NoticeService helpers with owned cleanup and real browser/native adapter contracts. |
| Commands and ribbon | Feature-owned typed descriptors join an explicit bootstrap registry; availability, shared single-flight execution, outcome handling and native cleanup are centralized. |
| Logging and debugging | Runtime opt-in detail, typed feature catalogs, bounded redacted records, independent error diagnostics and explicit sanitized report commands. |
| Styling | Native token roles, Nuxt UI containment, local icons, no Preflight/global head injection, one composed plugin CSS. |
| Browser harness | Actual services/components with synthetic adapters, served Playwright tests and independent captured-defect observation. |
| Setup and local install | Dependency-free identity/profile review, root-lock metadata preservation, verified resume, explicit disabled-plugin data migration and contained asset installation. |
| Author tooling | Safe registered note-feature/entity recipes, real generated CRUD tests/fixtures, and actual-source entity catalog/check commands. Broader UI/custom makers remain pending. |
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
example. Identity setup, verified resume, explicit contained migration and note-feature
makers are implemented. Complete template qualification still requires the broader
UI/custom-maker catalog, automatic example removal, additional runtime contracts/analyzers,
expanded host/device/accessibility evidence,
and fixed-asset release rehearsal. Native evidence is limited to named checks and
cannot certify all hosts, themes or devices.
