# Product requirements: Obsidian Plugin Shell

> **Version:** 0.8.0 · **Updated:** 2026-09-22 · **Owner:** Luis85  
> **Implementation milestone:** Responsive layout/header/dependency/reliability milestone, plugin version 0.2.0. The complete GitHub-template product is not yet finished.

## Product goal

A developer obtains the template, runs a guided setup, generates a feature, develops using a real-component harness and native Obsidian, verifies the work, and publishes the exact accepted assets. Target current public Obsidian with a qualified, actively maintained dependency graph.

The owner requested the first runnable iteration up to an openable showcase view. That slice now implements the native view, selected Nuxt UI components, Task Markdown workflow, shared preferences, typed events, feedback, scoped CSS, setup/local installation and executable tests. Do not interpret a working showcase as completion of every v1 capability.

## Requirements remain in force

The complete pre-implementation contract is retained verbatim in [SPECIFICATION-0.7.md](SPECIFICATION-0.7.md), incorporating [BASELINE-0.4.md](BASELINE-0.4.md) and all normative companions. Its historical capability/status paragraphs are superseded by this page and the current [iteration record](../testing/ITERATION-TWO.md); the numbered requirements, safety rules and intended final commands are not weakened or deleted.

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

| Capability | Status in iteration 02 |
| --- | --- |
| Native plugin and open/focus command/ribbon | Implemented; native opening exercised in Obsidian1.13.7. |
| Nuxt UI showcase | Real Vue/Pinia components with four panels, not a parallel mock UI. |
| Task DocumentCreationService | Working explicit Task definition, validation, exact preview/commit, complete Markdown write and separate opening. Full schema/catalog machinery still pending. |
| Settings | Native declarative tab and Vue preferences use one validated queued service; English/German, local panel preference and persisted isolated native-header visibility. |
| Event bus | Typed plugin-scoped facts, once/disposal/error observation; selected file-open bridge. Full catalog/bridge remains pending. |
| Feedback | Owner-scoped local/native notification subset and bounded diagnostics. Full timer/action/queue specification remains pending. |
| Styling | Native token roles, Nuxt UI containment, local icons, no Preflight/global head injection, one composed plugin CSS. |
| Browser harness | Actual services/components with synthetic adapters, served Playwright tests and independent captured-defect observation. |
| Setup and local install | Guided fixed-identity installer, dry run/noninteractive options, safe repository-contained asset installation. Full identity/resume/maker workflow remains pending. |
| Tooling | Exact lockfile, Vite/Vitest, strict types, Oxlint/Obsidian-Vue ESLint, source/locales, real fallow architecture and artifact checks. |
| Coverage and broad analysis | Selected core measured; full production thresholds/dead-code/complexity/duplication qualification pending. |
| CI | Read-only Linux/Windows verification, Linux served-browser and selected native smoke, temporary artifacts only. |
| Mobile/release/template qualification | Pending. Manifest desktop-only, no public release or directory submission. |

See [ITERATION-ONE.md](../development/ITERATION-ONE.md) for actual commands and installation. Do not invoke future maker/release commands from contract examples until implemented.

## Architecture invariants

Presentation → application → domain remains the dependency direction; infrastructure implements inner ports and bootstrap wires concrete services. main.ts is nine lines of lifecycle composition. Runtime services own canonical data and the bus; each view owns Vue/Pinia state and cleanup. Task Markdown remains canonical, without a duplicate Task database in data.json.

Handwritten source/CSS/scripts remain limited to 400 physical lines, tests/helpers450, main100. The current gates preserve these limits and test forbidden architecture edges. No native host stylesheet or harness tooling is packaged in the plugin. Failures cannot become false-success writes or unsafe retry actions.

## Nuxt UI and compatibility decisions

The first qualified graph uses Nuxt UI4.11.2, Vue3.5.43, Pinia4.0.3, Vite8.3.0, Vitest5.0.1, TypeScript6.0.3 and Node24.21.0. TypeScript7 was rejected by the actual parser peer constraints rather than installed with a force override. Native API declarations1.13.1 and tested host1.13.7 are recorded separately.

Nuxt UI integrates through plain Vue/Vite without the Nuxt framework/router. A narrow source-hash-guarded build adapter removes two global-style-producing modules. CSS uses an owned root and native semantic variables; selected local SVG assets and dependency notices are bundled. Expanded components, package upgrades, additional overlay/portal behaviors and mobile require requalification.

Current dependency/audit exceptions and their review boundary are in the [guide](../development/ITERATION-ONE.md). A lockfile is reproducibility, not proof that every transitive dependency has no advisory.

## Verification and definition of this milestone

The [iteration test record](../testing/ITERATION-TWO.md) identifies actual checks, source/candidate identity, failures corrected and untested scope. `verify` currently covers static/service/artifact/retained-baseline/harness-build checks; served E2E is separate. Full PRD verification and release promotion are not implemented aliases to this partial gate.

The milestone is an openable working desktop showcase. Complete template qualification still requires the retained work packages: full setup/renaming/makers, broader runtime contracts, production-wide test thresholds and analyzers, expanded host/device/accessibility evidence, and fixed-asset release rehearsal. Existing native evidence is limited to named smoke cases and cannot certify all hosts, themes or devices.
