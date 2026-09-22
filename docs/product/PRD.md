# Product requirements: Obsidian Plugin Shell

> **Status:** Draft implementation contract, not an implemented template.  
> **Version:** 0.1.0  
> **Prepared:** 2026-09-22  
> **Product owner:** Luis Mendez / Luis85  
> **Repository:** `Luis85/obsidian-plugin-shell`  
> **Current delivery:** Documentation only. No build, tests, quality gates, or runtime capabilities are claimed to exist yet.

## 1. Executive summary

Obsidian Plugin Shell is a reusable GitHub repository template for building maintainable Obsidian plugins with TypeScript, Vue 3, and Pinia. It supplies a working plugin foundation, an enforceable architecture, deterministic development workflows, and a browser-based frontend test environment that both humans and coding agents can use.

The product is not simply a sample plugin with more dependencies. Its value is a repeatable path from **create repository → identify plugin → implement a small domain feature → verify behavior → inspect the actual UI → install safely into a development vault → prepare a release**.

The template must make correct implementation easier than bypassing architecture, copying untested examples, or declaring success after a screenshot. A generated project must run without an AI provider, a cloud account, a paid analyzer, or access to a personal vault. Agent integrations are development conveniences; no AI runtime is included in the shipped plugin.

### 1.1 Non-negotiable owner requirements

| Area | Required outcome |
| --- | --- |
| Stack | Vite, Vitest, Oxlint, fallow, TypeScript, Vue 3, Pinia, and `eslint-plugin-obsidianmd` are integrated and exercised. |
| Architecture | Domain-oriented, clean architecture with enforced dependency directions; `main.ts` is composition/lifecycle wiring, not business logic. |
| File size | Handwritten source files have a hard 400-line limit; handwritten test files have a hard 450-line limit. |
| Plugin foundation | Working settings, local storage, a view shell, commands, ribbon integration, modals, and notices. |
| Cross-cutting behavior | Multilingual UI, consistent error handling, and controlled logging. |
| Agent readiness | Discoverable instructions, bounded implementation workflows, executable verification, and usable frontend testing tools. |
| Developer workflows | Build, test, verification, quality-control, and installation into a vault inside the codebase are scripted. |
| Evidence | Browser tests, static analysis, and real Obsidian checks report their actual scope and limitations. |

### 1.2 Proposed defaults versus researched facts

Requirements below use **MUST**, **SHOULD**, and **MAY** as product priorities. Unless explicitly marked optional, a MUST is required for the first complete template release.

English and German, npm, a small example-item feature, the detailed coverage thresholds, and the initial performance budgets are proposed template defaults. They are design decisions, not requirements imposed by Obsidian or conclusions established by the reference repositories. Changing an accepted default requires a documented decision rather than silently weakening a configuration.

Source references such as **[O1]**, **[V1]**, and **[F1]** identify the research register in section 22. External documentation describes tool capabilities; the requirements and acceptance criteria are this project's proposed contract. Current documentation and inspected dependency declarations are not proof that a particular combined version matrix works.

## 2. Problem, users, and success

### 2.1 Problem statement

Each new plugin currently requires repeated decisions about host integration, UI lifecycle, persistence, architecture, linting, tests, and deployment. Coding agents can accelerate implementation while also multiplying inconsistent patterns, oversized files, overbroad mocks, and unverified assumptions. A thin starter without executable conventions leaves each new product to rediscover the same failures.

The template must reduce that repeated work while remaining small enough that an agent or maintainer can understand one feature without loading the entire repository into context.

### 2.2 Primary users

| User | Job to be done | Evidence of value |
| --- | --- | --- |
| Plugin author | Start a new plugin without rebuilding foundational infrastructure. | A newly generated, renamed repository builds and verifies using documented commands. |
| Coding agent | Find the correct extension points, implement a bounded change, and produce reproducible evidence. | An implementation task identifies affected layers, tests, commands, and remaining uncertainty. |
| Reviewer / maintainer | Detect regressions and architecture drift without relying on an agent's narrative. | CI produces trustworthy failures, reports, and browser artifacts. |
| Plugin end user | Use a native-feeling, private, reliable plugin. | Settings persist, failures are actionable, views clean up, and the runtime works offline. |

### 2.3 Release success criteria

**SUC-01:** A fresh repository generated from the template can be initialized with a new identity and pass the documented verification pipeline without hand-editing configuration paths.

**SUC-02:** The supplied example demonstrates a complete behavior path through domain validation, an application use case, persistence, Vue presentation, and native Obsidian integration.

**SUC-03:** An agent with terminal and browser automation access can reproduce every required frontend scenario without launching Obsidian or using a personal vault.

**SUC-04:** The actual plugin bundle also passes a separate real-Obsidian acceptance check. A browser harness pass is never presented as host compatibility proof.

**SUC-05:** Deliberately invalid fixtures demonstrate that file-length, architecture, lint, translation, and artifact gates fail for the defects they claim to detect.

**SUC-06:** Installing and rebuilding in the development vault preserves existing plugin data, unrelated plugins, notes, and Obsidian security settings.

## 3. Scope

### 3.1 Included in the first complete template

A working plugin and example feature; native integration adapters; validated durable and local persistence; English/German localization; typed error handling; bounded diagnostic logging; a Vue/Pinia shell; a deterministic frontend harness; automated browser tests; static and architectural quality gates; safe development-vault installation; template initialization; CI; release preparation; and concise human/agent documentation.

Desktop Obsidian is the primary automated host target. Runtime code must remain mobile-compatible by design. A mobile compatibility claim additionally requires the real-device acceptance evidence defined below.

### 3.2 Explicit non-goals

The template does not include renovation planning, backlog management, Bases views, canvas engines, money calculations, a generic ERP, authentication, billing, synchronization infrastructure, telemetry, an in-plugin AI assistant, or a mandatory MCP server in production.

It does not introduce a dependency-injection framework, a generic repository superclass, an event-sourcing platform, an application-wide command bus, or speculative abstractions for features that do not exist. A small explicit composition root and narrow ports are sufficient.

Cloud dashboards, paid fallow services, Storybook, and additional browser/component runners are optional future integrations, not prerequisites. The template does not guarantee compatibility with every Obsidian version or third-party theme.

## 4. Research findings and reference-project assessment

The reference review examined selected build, package, entrypoint, harness, lint, and deployment files. It was not a full security or correctness audit of either project. File snapshots and research sources are recorded in section 22.

| Finding | Evidence | Decision for this template |
| --- | --- | --- |
| Renovation Planner already combines Vite, Vue, Pinia, Vitest, Oxlint, fallow, and Obsidian ESLint. | [R1] | Reuse the separation of concerns, not its product dependencies or historical exception lists. |
| Its Vite plugin build emits a CommonJS `main.js` into `dist`, separately from its browser harness. | [R2] | Keep distinct plugin and harness build targets; prove the selected output shape in the actual host. |
| Both example harnesses explicitly distinguish themselves from assertion-based tests. | [R3], [R7] | Upgrade this concept to required Playwright scenarios, assertions, and failure artifacts. |
| Backlog View exposes separate test type-checking, coverage, documentation, and verification commands. | [R6] | Treat tests, documentation, and tooling as maintained code, not unverified support files. |
| A tiny `main.ts` can delegate to another plugin class. | [R4] | Enforce thin composition throughout bootstrap code; a short re-export alone does not prove architectural quality. |
| The reference deployment script makes the repository usable as a vault. | [R5] | Preserve this convenience, default to an isolated vault inside the repository, and strengthen overwrite/path protections. |
| Obsidian provides vault-specific local-storage methods; the API definitions mark them as available since 1.8.7. | [O2] | Use a dedicated host adapter and plugin namespace, not arbitrary browser storage from components. |
| Oxlint supports Vue script analysis but does not replace full Vue-template linting. | [L1] | Run complementary Oxlint and ESLint configurations, retaining Vue and Obsidian-specific coverage. |
| fallow provides static reachability and architecture analysis, with documented limitations. | [F1]–[F4] | Make it a tested quality tool, not proof of runtime correctness or a substitute for host tests. |
| Current Vite documentation uses Rolldown configuration terminology. | [V5] | Validate the selected Vite version rather than copying historical Rollup-specific configuration blindly. |

The most important distinction is between **a tool being installed** and **a defect being detected by that tool in this repository**. Every major enforcement claim must have an executable negative fixture or a clearly identified manual review boundary.

## 5. Technology and compatibility contract

### 5.1 Required responsibilities

| Tool or library | Responsibility | What it does not prove |
| --- | --- | --- |
| TypeScript + `vue-tsc` | Strict checking of runtime code, Vue SFCs, tests, harness, and tooling projects. | Runtime validation of stored or external data. |
| Vite + Vue plugin | Development and production transforms; separate plugin/harness builds. | Runtime API availability in older Obsidian hosts. |
| Vue 3 | Compiled Single-File Components and local component lifecycle. | Business rules or persistence ownership. |
| Pinia | Explicitly scoped presentation state and view-level orchestration. | Durable storage or a canonical domain database. |
| Vitest + Vue Test Utils | Domain, application, adapter-contract, component, and gate tests. | Full layout fidelity or real Obsidian behavior. |
| Playwright Test | Real-browser harness behavior, visual comparisons, and frontend evidence. | Native Obsidian integration merely because the UI looks similar. |
| Oxlint | Fast supported correctness and code-quality rules. | Full Vue-template and Obsidian-specific lint coverage. |
| ESLint + `eslint-plugin-obsidianmd` + Vue support | Host-specific guidelines, Vue rules, and complementary typed checks. | Complete security or architecture verification. |
| fallow | Reachability, dependencies, duplication, complexity, cycles, and configured boundaries. | Dynamic host registration correctness or complete runtime reachability. |
| Vue I18n | Shared locale catalog and translation service for Vue and native UI. | Translation quality merely because keys exist. |

The proposed package manager is **npm**, with one committed lockfile. A deterministic formatter and a browser accessibility checker are supporting tools; select and pin them during WP-00. Do not introduce overlapping formatters or redundant test frameworks without a decision record.

### 5.2 Compatibility baseline: required before implementation completion

**TEC-01:** WP-00 MUST produce a compatibility matrix containing the exact Node LTS, npm, TypeScript, Vite, Vue, Pinia, Vitest, ESLint, Obsidian ESLint, Oxlint, fallow, Playwright/browser, and Obsidian API versions tested together. Package ranges and lockfile policy must be documented.

**TEC-02:** The declared `minAppVersion` MUST reflect the oldest supported host actually exercised and every API used. The choice must account for the local-storage API floor and whichever native settings API is selected. Do not claim support for an older host merely because TypeScript compiles.

**TEC-03:** Native settings implementation MUST follow the official API and lint rules applicable to that baseline. Current Obsidian ESLint guidance includes version-dependent settings-definition rules; classic and newer settings approaches must not be mixed without a compatibility rationale. [O3]

**TEC-04:** The runtime bundle MUST contain Vue, Pinia, localization, and its other required runtime dependencies. Obsidian's API module remains host-provided. Development tools and test adapters must not enter the shipped dependency graph.

**TEC-05:** Mobile-compatible runtime modules MUST NOT depend on Node or Electron APIs. Externalizing such imports does not make them mobile-safe. Node-based build/test scripts remain outside the runtime graph.

**TEC-06:** Build target syntax and required runtime APIs MUST be assessed separately. Vite transforms do not constitute arbitrary API polyfills. Any compatibility helper must be explicit and tested. [V5]

Initial dependency versions in the example repositories are observations, not recommendations to use `latest`. WP-00 resolves this intentionally bounded uncertainty before later packages rely on it.

## 6. Architecture

### 6.1 Architectural style

Use a **small modular monolith with domain-oriented feature folders inside explicit dependency layers**. Apply domain-driven design where it improves language, invariants, and feature boundaries. Avoid domain ceremony for basic host wiring.

The prescribed direction is:

```text
presentation ──> application ──> domain ──> shared
infrastructure ──> application contracts / domain / shared
bootstrap ──> concrete implementations and presentation factories
main.ts ──> bootstrap and the minimum Obsidian lifecycle surface
```

`shared` is deliberately small and framework-free. It may contain genuinely neutral primitives such as a result type or disposable contract. It is not a destination for every module that is inconvenient to classify.

### 6.2 Target repository layout

This tree describes the future implementation, not files already delivered with this PRD.

```text
src/
  main.ts
  bootstrap/
    create-plugin-runtime.ts
    register-commands.ts
    register-views.ts
    register-ribbon.ts
  domain/
    example/
    preferences/
  application/
    example/                 # use cases, public DTOs, feature-owned ports
    preferences/
    diagnostics/
  infrastructure/
    obsidian/                # host views, settings/modal/notice adapters
    persistence/             # durable document and local preference adapters
    logging/
    localization/
  presentation/
    shell/
    example/
    preferences/
    components/
    stores/
  shared/
  locales/
    en.json
    de.json
  styles/
harness/
  scenarios/
  adapters/
  fixtures/
  host-shim/
  main.ts
tests/
  unit/
  integration/
  component/
  architecture/
  quality-gates/
  e2e/
  host/
  helpers/
scripts/
docs/
  product/PRD.md
  architecture/
  adr/
  development/
  testing/
  agents/
.github/
  workflows/
  ISSUE_TEMPLATE/
AGENTS.md
CLAUDE.md
manifest.json
versions.json
package.json
package-lock.json
vite.config.ts
vite.harness.config.ts
vitest.config.ts
playwright.config.ts
eslint.config.mjs
.oxlintrc.json
.fallowrc.json
```

Do not create empty folders and unused exports just to resemble the tree. A module becomes real when a supplied behavior exercises it.

### 6.3 Architecture requirements

**ARC-01 — Thin composition:** `main.ts` MUST stay at or below **100 physical lines**, in addition to the general source policy. It may expose the host plugin class and delegate load/unload composition. It must not contain business decisions, locale dictionaries, persistence transformations, component markup, or feature algorithms.

**ARC-02 — No displaced god object:** Bootstrap files MUST only construct dependencies, connect registrations, and coordinate lifecycle. Moving business logic from `main.ts` into a large `PluginRuntime` class does not satisfy ARC-01. This includes automated import checks and reviewer inspection; no static rule is claimed to recognize all business logic.

**ARC-03 — Framework-free core:** Domain and application modules MUST NOT import Vue, Pinia, Obsidian, browser globals, Node, Electron, or infrastructure implementations. Domain rules operate on typed values; time and identifiers are supplied when needed rather than read nondeterministically.

**ARC-04 — Owned ports:** Interfaces are defined by the inner capability that needs them. Infrastructure implements those interfaces. Prefer constructor/function arguments and explicit factories over service locators or hidden globals.

**ARC-05 — Presentation boundary:** Vue components and stores call application-facing interfaces. They do not call `saveData`, access a vault, construct native notices, or read browser storage directly. Presentation uses application DTOs rather than reaching into another feature's domain internals.

**ARC-06 — Host adapter composition:** Obsidian adapters may mount presentation factories, but concrete cross-layer wiring belongs to bootstrap. A native view receives a mount/dispose factory rather than importing every component and service itself.

**ARC-07 — Feature isolation:** A feature exposes a small application contract. Cross-feature workflows use those contracts and an explicit orchestration location, not imports into sibling internals. Domain objects do not depend on unrelated domains simply because they share a repository.

**ARC-08 — Enforced graph:** Resolved dependency checks MUST cover aliases, relative paths, re-exports, type imports, supported dynamic imports, and Vue SFC imports. Every handwritten runtime file must belong to a configured zone; unclassified files must fail verification. Any tool gap needs a documented supplemental check or a restriction forbidding the unsupported pattern.

**ARC-09 — No development backdoor:** Runtime code MUST NOT import `harness`, `tests`, scripts, test fixtures, or agent integrations. The production artifact gate independently checks for harness entrypoints and development-only dependencies.

**ARC-10 — Clean code:** Prefer small cohesive modules, explicit names, immutable boundary DTOs, narrow error handling, and tests of behavior. Remove dead abstractions rather than retaining extension points for imagined consumers. Public extension contracts receive concise TSDoc; avoid narrative comments that merely restate code.

The selected fallow version is the preferred graph analyzer. Its boundary defaults and matching behavior must be understood and tested, not assumed to be restrictive for files that match no zone. [F3]

## 7. Plugin lifecycle and view ownership

**LIF-01:** A plugin runtime is created once per plugin instance. It owns application services, durable repositories, localization, and diagnostic sinks. Initialization failure releases already-created resources and exposes an actionable error without pretending the plugin initialized successfully.

**LIF-02:** Each open view receives its own Vue application and its own Pinia instance for ephemeral UI state. Views share application services through explicit injection. One view's unmount must not dispose another view's store or the plugin-wide repository.

**LIF-03:** Canonical data belongs to application/repository state, not an arbitrary view's store. Multiple views observe successful changes through a small typed subscription contract with owned unsubscribe handles. Do not add a global string-based event bus for this example.

**LIF-04:** Every Vue mount has one corresponding unmount; every subscription, observer, timer, native listener, and modal-mounted component has an owner and cleanup path. Closing, reopening, disabling, and reloading the plugin must not multiply handlers.

**LIF-05:** Use the plugin's `app` reference and supported registration APIs. Do not retain singleton custom-view references or manually detach workspace leaves during plugin unload. Resource disposal and preserving workspace layout are separate concerns. [O1]

**LIF-06:** Host elements and window-dependent behavior use the owning document/window so pop-out windows work. Theme changes, view resize, and workspace restoration are included in acceptance testing.

**LIF-07:** Startup must not scan the entire vault, seed user notes, or mount hidden UI. Open the shell through an explicit command/ribbon action or host-restored view state. Async startup and shutdown behavior must not assume the host waits for an arbitrary unload promise.

Vue's unmount and error hooks are useful lifecycle mechanisms, but application-owned subscriptions and non-Vue promises still require explicit management. [V2]

## 8. Working reference feature and native surfaces

### 8.1 Reference feature: example items

Provide one intentionally small feature that allows the user to **create, rename, and delete a labeled example item** stored in the plugin's own data. Its purpose is to demonstrate extension patterns, not become a task-management product.

**EXA-01:** An item has a stable identifier and a validated label. Proposed validation: trim surrounding whitespace, require 1–120 characters, and preserve user-entered language. Invalid input returns a typed validation outcome.

**EXA-02:** The sample provides empty, populated, saving, validation-error, persistence-error, and recovered states. A failed write must not display a success notice or falsely present an unsaved item as durable.

**EXA-03:** The path is visible in code and documentation: component → application use case → domain validation → repository port → adapter → result → UI feedback.

**EXA-04:** The default behavior creates no vault note and performs no network request. Destructive actions require deliberate interaction; cancellation has no persistence side effects.

**EXA-05:** A documented removal recipe deletes the example module, its UI, tests, translations, and registrations without deleting the infrastructure used by a new product. The complete shell remains verifiable after this recipe is exercised in a generated-repository test.

### 8.2 Shell and host integrations

| ID | Capability | Required behavior |
| --- | --- | --- |
| UI-01 | View shell | A native-feeling root view with a small header/action area, main content, empty/loading/error states, and a discoverable entry to preferences/help. No account/avatar or dashboard chrome without a feature need. |
| UI-02 | Commands | Open/focus shell, create an example item, and an appropriate diagnostics action. Stable plugin-local IDs; localized names; correct unconditional/conditional callback type; no assigned default hotkeys. |
| UI-03 | Ribbon | One supported icon with a localized tooltip that invokes the same open-shell application action as the command. It does not implement a second navigation path. |
| UI-04 | Native settings | A native plugin settings integration with validated locale choice and a small set of meaningful preferences. It shares the preference service with the shell. |
| UI-05 | Modal | A reusable native-modal adapter demonstrated by item creation/rename and destructive confirmation, including focus, labels, validation, cancellation, and cleanup. |
| UI-06 | Notices | A notification policy maps outcomes to localized native notices. Routine validation stays near its field; repeated failures are deduplicated rather than flooding the user. |
| UI-07 | Multiple leaves | Opening normally focuses an existing appropriate shell; an explicit new-view path and workspace restoration support multiple leaves without shared ephemeral UI state. |
| UI-08 | Theming | Use scoped plugin classes and Obsidian semantic CSS variables, with readable light/dark modes and no global resets. |
| UI-09 | Accessibility | Keyboard access, visible focus, semantic controls, form labels, non-color-only errors, suitable touch targets, and usable narrow layouts. |

The host integration follows Obsidian's UI and command conventions. Domain code does not know whether feedback becomes an inline message, native modal, or notice. [O1], [O3]

### 8.3 Vue and Pinia conventions

Use Vue 3 Composition API and typed Single-File Components. Dependencies are supplied through typed injection keys or explicit props. Stores expose focused actions and do not become a second application layer.

Tests must deliberately choose between stubbed store actions and real actions. Pinia's testing helper stubs actions by default; integration and end-to-end tests must use real actions when they claim to validate the behavior. Fresh store instances are required between isolated tests. [V3]

Do not automatically persist every store. Local drafts, validation state, selection, and modal visibility must not become durable merely because a persistence plugin was installed.

## 9. Persistence and local storage

### 9.1 Explicit data categories

| Category | Owner and backing store | Examples | Failure behavior |
| --- | --- | --- | --- |
| Durable plugin data | Versioned repository using Obsidian `loadData` / `saveData`. | Settings and the small reference feature's records. | Preserve prior data; report failure; never silently replace corrupt or unknown data. |
| Local UI preferences | Typed local-storage port using vault-specific host storage. | Last shell section, dismissed development hint, nonessential display preference. | Recover with safe defaults or in-memory fallback; do not block core functionality. |
| Ephemeral view state | View-owned Vue/Pinia state. | Draft text, current selection, modal state, pending UI action. | Disappears with the view unless a feature explicitly defines otherwise. |
| Vault documents | Not needed by the example; future adapters use appropriate Obsidian document APIs. | Product-specific notes introduced later. | Must be specified by the future feature, not hidden inside settings storage. |

### 9.2 Durable storage requirements

**DAT-01:** Stored payloads are treated as `unknown`, structurally validated, and transformed into a versioned internal model. A TypeScript cast is not validation.

**DAT-02:** A schema version and ordered, independently tested migrations are provided. Reapplying initialization to already migrated data does not transform it again. Unknown future schemas must not be overwritten by an older plugin.

**DAT-03:** One writer coordinates changes to the shared durable document. Concurrent settings and item saves must not overwrite one another from stale snapshots. Tests cover interleaving, ordering, and failed writes.

**DAT-04:** Corrupt data is preserved for recovery. Recovery/reset is explicit and explains the loss boundary. Do not call `saveData(defaults)` merely because a read failed; distinguish absence, invalid content, permissions, and unexpected errors.

**DAT-05:** The UI indicates pending writes and only claims durability after the write succeeds. Cancellation and expected validation failures do not produce unnecessary writes.

**DAT-06:** Important changes are persisted during normal operation. An unload-only flush is not a durability strategy. Debouncing, when used, has a documented flush/cancel owner and tests for closing the view.

**DAT-07:** Plugin storage is not advertised as encrypted secret storage. No API keys, note contents, or personal data are required by the template.

### 9.3 Local-storage requirements

**LOC-01:** The production adapter uses `App.loadLocalStorage` and `App.saveLocalStorage`, with a plugin-ID-prefixed key and per-value schema version. These are vault-specific host APIs; their existence and version floor are confirmed in the public definitions. [O2]

**LOC-02:** Only the browser harness's adapter uses browser `localStorage` directly. Domain, application, and components depend on the storage port. A fixture vault identity isolates browser test data.

**LOC-03:** Serialization, absent values, malformed values, quota/storage denial, migration, deletion, and fallback behavior have tests. The host adapter must not assume it receives a JSON string when the host API returns a deserialized value.

**LOC-04:** Reset removes only owned keys. Never call a global storage `clear()` or touch another plugin's namespace.

**LOC-05:** Two plugin IDs and two fixture vault identities must remain isolated. Documentation explains that local UI preferences are not the same as portable/synchronized durable settings.

## 10. Multilingual behavior

**I18N-01:** Ship English and German as the initial proposed locales, with English fallback. All template-owned visible UI strings—including settings, commands, ribbon tooltips, modals, notices, empty/error states, and accessibility labels—come from the shared catalog.

**I18N-02:** A single translation service serves Vue and native adapters. Vue I18n's Composition API is the proposed implementation; do not maintain a separate hand-written translation engine for host UI. [V4]

**I18N-03:** Locale resolution follows a documented order: explicit plugin preference, supported host-language mapping, English fallback. Read language using a supported host API appropriate to the compatibility baseline, not undocumented application fields.

**I18N-04:** Translation keys and parameter contracts are checked. Missing keys, mismatched interpolation parameters, and unhandled plural cases fail the translation gate. Date/number formatting is locale-aware. User content and stable identifiers are never translated automatically.

**I18N-05:** Switching the plugin locale updates mounted UI and subsequently created dialogs/notices. Host-registered labels must either be refreshed through supported APIs or clearly indicate that reload is required. Do not promise unsupported dynamic mutation of registered commands.

**I18N-06:** Test long translated text, a development-only pseudo-locale, fallback behavior, and both initial locales. Native English strings follow sentence-case conventions; translation checks are not a substitute for language review.

**I18N-07:** Localization errors do not recursively invoke logging/translation until the UI freezes. A safe fallback exists for errors raised while localization itself is initializing.

## 11. Error handling and logging

### 11.1 Error model

**ERR-01:** Expected validation, cancellation, missing-data, storage, and compatibility outcomes use explicit typed results. Unexpected exceptions are caught at application/host boundaries as `unknown` and normalized without losing the cause for local diagnostics.

**ERR-02:** A normalized failure includes a stable code, category, operation, recoverability, and a correlation identifier where useful. User-facing text comes from translation keys and safe parameters, not raw exception messages.

**ERR-03:** Async commands, ribbon callbacks, settings changes, modal submissions, view initialization, and Vue rendering each have an appropriate error boundary. Returning an unobserved promise or prefixing it with `void` is not error handling.

**ERR-04:** Recoverable failure offers the correct action: fix input, retry an operation known to be safe, choose another preference, or inspect diagnostics. Do not automatically retry destructive/non-idempotent actions.

**ERR-05:** Vue's application error handler and component boundaries are integrated. They do not claim to catch every arbitrary promise, timer, or host callback. The template must not install a global handler that suppresses errors belonging to Obsidian or other plugins. [V2]

**ERR-06:** One error has one primary user notification. Inline feedback, native notices, and diagnostics use an explicit policy to avoid duplicate messages and console spam.

### 11.2 Logging contract

**LOG-01:** Application code uses an injected structured logger interface. Raw console calls are allowed only inside the approved console sink and development tooling.

**LOG-02:** Default production console output is error-only. Debug/diagnostic verbosity is opt-in and reversible. This aligns with Obsidian's guidance to avoid unnecessary default logging. [O1]

**LOG-03:** The in-memory diagnostic buffer is bounded. Proposed defaults are at most 200 entries and 256 KiB of retained payload, with truncation markers and bounded field sizes. Tests verify the bounds under repeated failures.

**LOG-04:** Diagnostic fields follow an allowlist. Do not log vault content, note titles, file paths, user-entered item labels, secrets, or arbitrary serialized objects by default. Stack traces and causes require redaction before any user-exported diagnostic bundle.

**LOG-05:** Export is an explicit local user action with a preview/explanation of included fields. No network sink, telemetry endpoint, or hidden upload is shipped.

**LOG-06:** Reports distinguish validation/cancellation from defects. An expected negative test is allowed through a narrow expected-error contract; blanket ignoring console errors in browser tests is prohibited.

## 12. Agent-ready frontend harness

### 12.1 Product role and fidelity boundary

The harness is a first-class development and test product. It must render the **real shipped presentation components, application services, domain logic, Pinia behavior, and plugin styles**. Replace host infrastructure through ports; do not recreate the UI as separate mock markup.

Obsidian is not a normal npm runtime that can be imported into a browser. The harness is an explicitly bounded host simulation, not Obsidian itself. The mock contracts must list supported behavior and known omissions.

### 12.2 Harness requirements

**HAR-01 — Two modes:** Provide a Vite development server and a production-built harness served by a preview/static HTTP server. Headless tests run against the built harness; interactive development may use the dev server.

**HAR-02 — Safe defaults:** Bind to loopback. Do not automatically expose the server on the network, open a GUI browser in headless environments, or read a real vault. Fixtures are synthetic and committed where appropriate.

**HAR-03 — Real composition:** Production and harness bootstraps inject different adapters into the same application contracts and mount the same components. Contract tests check adapter behavior; host-only concerns remain explicitly separate.

**HAR-04 — Scenario control:** A documented URL format selects scenario, locale, theme, viewport profile, and seed. Proposed example: `/?scenario=storage-failure&locale=de&theme=dark&seed=42`. A readiness signal is based on application state, not a sleep.

**HAR-05 — Determinism:** Clock, IDs, fixture data, storage namespace, and optional latency/fault injection are controllable. Each test resets independently. A reload test deliberately retains its storage; an isolation test deliberately clears only that test's owned state.

**HAR-06 — Agent API:** Supply a typed harness-only control surface for listing scenarios, resetting a scenario, injecting a declared fault, awaiting readiness, and reading redacted diagnostics. Do not expose arbitrary evaluation, filesystem access, shell commands, or access to personal browser profiles through this surface.

**HAR-07 — Production exclusion:** Harness globals, fault injection, fixture loaders, fake host modules, and agent endpoints must be absent from the plugin artifact. A separate build assertion verifies this.

**HAR-08 — Host styling:** Use the real plugin stylesheet and a small documented semantic-variable/host-layout shim. Clearly label approximations. Do not silently vendor Obsidian's application stylesheet or third-party theme assets without verified redistribution rights and provenance.

**HAR-09 — Native surface testing:** Browser adapters for modal, settings, and notices exercise their application-facing contracts. They must not be described as testing native host internals. Real-host tests cover those adapters' actual implementation.

**HAR-10 — Multi-instance support:** At least one scenario mounts two independently owned view roots against shared canonical services, allowing agents to test synchronization and disposal without replacing the real stores.

### 12.3 Required scenario catalog

| Scenario | Behavior under observation |
| --- | --- |
| `empty` | First-run defaults, discoverability, empty state, working first action. |
| `populated` | Deterministic items and meaningful primary/secondary actions. |
| `validation` | Blank/long labels, visible inline feedback, no invalid writes. |
| `persistence` | Create/rename/delete and reload with durable results. |
| `settings` | Validated preference changes and application to mounted views. |
| `storage-failure` | Failed durable write, no false success, explicit recovery. |
| `corrupt-data` | Invalid/future schema, preserved original payload, safe recovery boundary. |
| `local-storage-denied` | Nonessential preference fallback without blocking the main feature. |
| `localization` | English, German, long text, fallback, and pseudo-locale inspection. |
| `multi-view` | Shared successful updates, independent drafts, cleanup of one view only. |
| `lifecycle` | Repeated mount/unmount without accumulating owned resources. |
| `responsive` | Light/dark themes, narrow pane, touch-sized layout, keyboard operation. |

A scenario may reuse one fixture with parameters. Do not duplicate application logic to create dozens of artificially different pages.

### 12.4 Browser automation contract

**E2E-01:** The canonical interface is the repository's Playwright CLI. Tests use accessible roles/names or stable documented test identifiers, auto-waiting assertions, and observable results rather than private implementation details or fixed delays. [T1]

**E2E-02:** Browser assertions cover workflow success and failure, persistence across reload, localization, keyboard operation, disposal, and unexpected console/page errors. Real application/store actions run in these tests.

**E2E-03:** Visual baselines cover a small intentional set of shell states. Fix the browser version, operating-system image, fonts, viewport, theme, and locale. Baseline updates are explicit reviewable changes; CI must never automatically accept its own new screenshots. [T2]

**E2E-04:** Automated accessibility checks are supplemented by keyboard/focus tests. A passing automated scanner is not described as complete accessibility certification.

**E2E-05:** Failure artifacts include a readable report, machine-readable results, screenshots, Playwright trace, relevant console output, and scenario metadata. Video is retained when useful, not generated indiscriminately for every successful run.

**E2E-06:** Artifacts identify commit/worktree state, tool versions, scenario, locale, theme, seed, and tested build hash. Missing or stale artifacts cannot substantiate a verification claim.

**E2E-07:** A controlled intentionally failing frontend fixture proves that page errors and assertion failures actually fail the runner. A successful page load alone is insufficient.

### 12.5 Optional agent adapters

Provide documented, pinned configuration examples for Playwright MCP and fallow MCP, but keep the CLI workflow authoritative and functional without either server. Microsoft supplies the Playwright MCP project; fallow documents its own MCP integration. [A3], [F5]

Use only the local fixture harness and a dedicated browser context. Do not reuse a personal browser profile. Agents must treat fixture/user content as untrusted data rather than instructions.

fallow MCP includes mutation capabilities; it must not be characterized as inherently read-only. Default guidance should allow analysis/inspection only. Fix application and permission expansion require explicit review. Browser interaction with synthetic test data is permitted; arbitrary filesystem/network privileges are not a prerequisite.

## 13. Test strategy and actual Obsidian validation

### 13.1 Layered evidence

| Test layer | Required scope | Main mechanism |
| --- | --- | --- |
| Domain | Invariants, validation, deterministic decisions. | Vitest without DOM/host dependencies. |
| Application | Use cases, persistence ordering, typed failures, subscriptions. | Vitest with narrow in-memory port adapters. |
| Adapter contract | Storage semantics, failure mapping, ownership and disposal contracts. | Shared contract suites against appropriate implementations/fakes. |
| Vue component | Public props/events, rendering, forms, localization, real/stubbed actions deliberately selected. | Vue Test Utils + Vitest; DOM environment only where needed. |
| Browser integration | Real UI workflows, layout-related behavior, keyboard/focus, error capture. | Playwright against built harness. |
| Architecture/tooling | Invalid imports, line boundaries, parser coverage, bad manifests, missing locales, wrong entrypoints. | Negative fixtures invoking actual configured tools. |
| Artifact | CJS plugin structure, required assets, external dependencies, no harness leakage. | Build inspection and loader-contract tests. |
| Real Obsidian | Actual plugin load, native registration, settings/modal/notice behavior, reload and workspace restoration. | Automated host smoke where provisioned plus documented manual acceptance. |

Vue's testing guidance supports testing public behavior with complementary unit, component, and end-to-end layers. Snapshot-only or implementation-detail assertions are not sufficient. [V1]

### 13.2 Native-host requirement

**HST-01:** Supply a reproducible native-host smoke procedure and evidence template for the oldest supported desktop version and the selected current desktop version. It uses only an isolated fixture vault and the exact plugin artifact under test.

**HST-02:** Evaluate `wdio-obsidian-service` during WP-00 as the preferred candidate for optional automated desktop-host execution. It is a third-party Obsidian testing service, not an official Obsidian test runner. Its documented capabilities include sandboxed hosts, version selection, and CI support. Pin and prove the selected integration before relying on it. [T3]

**HST-03:** Browser-based `verify` must not require downloading Obsidian during every run. Host provisioning is explicit. A missing host produces **not run / environment unavailable**, never a host-test pass. `verify:release` rejects missing required host evidence.

**HST-04:** Real-host acceptance covers plugin load/disable/re-enable, commands and ribbon, native settings, modal focus/cancel, notices, multiple leaves, pop-out windows, restored workspace state, durable settings after restart, and existing data preserved across installation.

**HST-05:** Before advertising mobile support, run a documented physical-device smoke on iOS and Android for the chosen supported scope. Browser device emulation and the absence of Node imports do not substitute for mobile host evidence. Desktop-only claims remain explicit until this is complete.

**HST-06:** No template test redistributes an Obsidian executable. Provisioning and caching must follow the applicable distribution terms and require no personal vault credentials.

## 14. Quality policy and executable enforcement

### 14.1 File-length policy

**QLT-01:** Count **physical lines, including blank lines and comments**, in each handwritten code file. A trailing newline does not create an additional content line. Empty files have zero lines; CRLF and LF count equivalently. Vue SFCs are measured as the entire file—template, script, and style together.

| File category | Hard maximum |
| --- | ---: |
| `src/main.ts` | 100 |
| Other runtime source, including `.ts`, `.vue`, and handwritten styles | 400 |
| Harness implementation and build/tool scripts | 400 |
| Test specifications and test helpers, including colocated tests | 450 |

Machine data, Markdown, lockfiles, generated reports, and generated declarations have separately documented treatment. They must not become a hiding place for handwritten executable code. The classifier must inspect all supported source extensions and fail on an unclassified executable file. Generated exemptions are explicit and provenance-backed.

The test classification takes precedence for genuine colocated tests; naming a production module `something.test.ts` does not make it safe to ship. Production imports of test-classified modules are forbidden.

**QLT-02:** Boundary fixtures prove that 400/450 lines pass and 401/451 fail, including a full Vue SFC, CRLF input, comments, and terminal-newline behavior. The checker operates on relevant working-tree files, including newly created files—not only the last committed inventory.

### 14.2 Type, lint, and complexity policy

**QLT-03:** Type-check source, Vue, tests, harness, and configuration/scripts where applicable. Enable strictness and explicit handling of unchecked indexed access and optional properties unless a reviewed compatibility decision justifies a narrower setting. No unsafe cast or `any` is accepted merely to silence host/mock typing.

**QLT-04:** Run Oxlint first, then complementary ESLint checks with Vue SFC parsing, Obsidian rules, and needed typed rules. Both must produce zero unapproved warnings. Disable genuine duplicate rules deliberately; do not disable an entire category in both tools. The Obsidian plugin's recommended configuration itself includes other lint layers, which must be accounted for. [L1], [O3]

**QLT-05:** The proposed new-code function thresholds are cyclomatic complexity at most 10 and cognitive complexity at most 15. Configure metrics supported by the pinned analyzer and publish their scope. Tiny functions and thin wrappers are not a goal in themselves; cohesive decomposition and understandable behavior are.

**QLT-06:** Lint fixtures demonstrate that rules apply inside Vue scripts and templates as intended, and that supported TypeScript extensions receive the correct parser/type context. A rule configured against no matching files is not evidence of coverage.

### 14.3 Coverage policy

Proposed initial gates, measured over the configured production source set including untested files:

| Scope | Lines | Statements | Functions | Branches |
| --- | ---: | ---: | ---: | ---: |
| Overall measured runtime | 90% | 90% | 90% | 85% |
| Domain and application | 95% | 95% | 95% | 90% |

**QLT-07:** Generated code and type-only declarations may be excluded with documented reasons. Do not exclude infrastructure, bootstrap, or error paths simply to improve percentages. Native-only coverage limitations must be visible, with integration/host evidence and a narrow reviewed exception when necessary.

**QLT-08:** Critical scenarios are required regardless of percentages: failed writes, concurrent persistence, corrupted/future schema, cancellation, disposal, namespace isolation, and invalid user input. A coverage percentage does not certify these behaviors.

### 14.4 fallow policy

**QLT-09:** Pin fallow as a development dependency and validate configuration against the installed version's schema. Explicitly identify real process entrypoints: plugin, harness, tests, scripts, and approved agent hooks. Do not mark all of `src/**` as entrypoints to hide dead code. [F1], [F2]

**QLT-10:** Run both whole-repository analysis and a production-scoped graph analysis. Test-only imports must not accidentally legitimize unused shipped features. Blocking scope includes unresolved findings classified as errors, unused runtime dependencies/exports/files, cycles, and architecture violations, after narrowly justified host-registration exceptions.

**QLT-11:** For the greenfield template, verification evaluates the complete required scope. Diff/new-only analysis is useful for feedback but is not the release gate; the configured audit mode must not silently ignore existing findings. [F1], [F2]

**QLT-12:** Proposed production-source duplication budget: at most 3% under the selected analyzer's documented metric, with an initial minimum clone size of 50 tokens and 5 lines where supported. Validate the exact fields and denominator during WP-00. Repeated fixtures and explicit independent tests receive separate reporting so the gate does not encourage unreadable test abstractions.

**QLT-13:** Document static-analysis limitations, especially dynamic host registrations and external consumers. Findings are investigated before deletion. No automatic `fix` command runs during verification or silently removes code based only on analyzer output. [F4]

**QLT-14:** Architecture analysis must prove zone coverage as well as forbidden edges. Negative fixtures include unclassified source, alias imports, re-export laundering, forbidden external packages, and development-to-production leakage.

### 14.5 Exceptions and reports

**QLT-15:** Every exceptional suppression names its narrow scope, reason, owner, tracking decision, and review/expiry condition. New projects start with no copied legacy baseline. Broad disable comments, ignored directories, weakened thresholds, and accepted screenshot changes are review-sensitive modifications.

**QLT-16:** Quality reports contain individual gate status, command, tool version, duration, exit code, checked scope, and artifact paths. Statuses include passed, failed, not run, and infrastructure error. A parser/tool crash is never converted to an empty finding set.

**QLT-17:** Critical checker fixtures intentionally fail in isolated temporary projects and assert the child process failed. Deliberately invalid fixtures must not contaminate the normal source graph or cause a recursive verification loop.

## 15. Build, local deployment, and scripts

### 15.1 Plugin artifact

**BLD-01:** The release build produces an Obsidian-loadable CommonJS `main.js`, `manifest.json`, and `styles.css` in a clean dedicated `dist/` directory. Even when a stylesheet is small, its treatment is deterministic. The loader/export shape is tested in the actual host rather than inferred from file extension alone.

**BLD-02:** The runtime bundle has no CDN dependency, harness/dev server requirement, source-only asset paths, or unintended dynamic chunks. Host-provided dependencies remain external; required library dependencies are bundled. Bundling must preserve legitimate third-party notices/licenses.

**BLD-03:** Development builds are debuggable with source maps. Public release source-map policy is explicit. Build output and source maps must not leak local secrets or absolute sensitive paths.

**BLD-04:** `manifest.json`, package version, release tag, and `versions.json` are validated for the intended release convention. Plugin identity and minimum host version are checked. The artifact report includes SHA-256 hashes of installed/released files.

### 15.2 Repository-contained development vault

**DEP-01:** Default installation target: `.dev-vault/<configured-vault-config-dir>/plugins/<manifest.id>/` inside the repository, normally with `.obsidian` as the fixture vault's config directory. The repository can therefore supply its own isolated testing vault without touching a personal vault.

**DEP-02:** Support an explicit repository-root-vault mode for the existing preferred workflow, for example a validated `--vault .` option. It must be intentional and documented. A custom config directory is configurable; production host code uses the host's actual `vault.configDir`, not a hardcoded `.obsidian` path.

**DEP-03:** Only the generated allowlisted plugin assets are installed. Preserve `data.json`, unknown plugin-owned data, unrelated plugin folders, vault notes, and other Obsidian configuration. Never run Vite directory cleaning against a repository or vault root.

**DEP-04:** Validate plugin ID and destination containment; reject traversal, unsafe roots, unexpected symlinks, and targets outside the declared development boundary unless explicitly authorized. Path normalization alone is not sufficient containment validation.

**DEP-05:** Build and validate before installing. Stage the complete artifact set before replacement; never copy a half-built bundle. Rebuild/watch mode leaves the last good install intact after a failed build. Detect concurrent deployment and provide recoverable diagnostics.

**DEP-06:** Adding the plugin to the development vault's enabled list is explicit and additive. Malformed configuration, read failures, or permission errors must not be silently treated as an empty list. Never disable Restricted Mode or modify unrelated security settings.

**DEP-07:** Print the resolved target, plugin identity, artifact hashes, and required human reload/restart actions. Provide a dry-run path that performs no writes. Generated vault/build files are ignored by Git.

Obsidian recommends a separate development vault rather than experimenting against important notes. The isolated default follows that safety principle while keeping the vault inside the codebase. [O4]

### 15.3 Command contract

These are **required future script contracts**, not commands available in the documentation-only repository. Exact internal CLI flags must be verified against pinned tool versions. The user-facing npm interface remains stable.

| Command | Required contract |
| --- | --- |
| `npm ci` | Install the committed dependency graph; never rewrite the lockfile as normal verification. |
| `npm run doctor` | Report Node/package-manager compatibility, required binaries/browsers, configuration validity, and provisioning gaps. No silent downloads. |
| `npm run template:init -- ...` | Validate and apply a new plugin/repository identity; support `--dry-run` and noninteractive use. |
| `npm run dev` | Watch the plugin build; no tests in endless watch mode and no implicit personal-vault deployment. |
| `npm run build` | Type-check required production inputs, create production artifacts, and validate their shape. |
| `npm run build:dev` | Produce debuggable plugin artifacts using the same entrypoints/asset policy. |
| `npm run build:local` | Build and safely install into the configured repository-contained development vault. |
| `npm run test-build` | Compatibility alias for `build:local`; do not maintain a second deployment implementation. |
| `npm run dev:local` | Rebuild and install only successful development artifacts to the approved local target. |
| `npm run typecheck` | Check runtime, Vue, tests, harness, and tooling projects with explicit project coverage. |
| `npm run lint` | Run complementary Oxlint and ESLint checks with unapproved warnings treated as failures. |
| `npm run lint:fix` | Explicit local autofix; never called by verification or release checks. |
| `npm run format:check` / `format` | Check formatting or explicitly apply it. |
| `npm test` | Finite Vitest execution for required non-browser suites. |
| `npm run test:watch` | Explicit interactive watch mode only. |
| `npm run test:coverage` | Execute measured suites and enforce documented coverage thresholds. |
| `npm run test:gates` | Prove negative fixtures for architecture, LoC, lint, localization, and artifact enforcement. |
| `npm run harness:dev` | Start the deterministic local browser harness and print its address. |
| `npm run harness:build` / `harness:preview` | Build and serve the harness independently of Obsidian. |
| `npm run harness:shot -- ...` | Capture a declared scenario/theme/locale/viewport/seed with metadata; finite process. |
| `npm run test:e2e` | Run required browser behavior, accessibility, and approved visual projects against the built harness. |
| `npm run test:obsidian` | Run provisioned native-host checks or explicitly report unavailable prerequisites; never fabricate a pass. |
| `npm run check:loc` | Enforce file classification and physical line limits. |
| `npm run check:architecture` | Enforce resolved dependency directions, zone coverage, and forbidden runtime dependencies. |
| `npm run check:i18n` | Validate catalog completeness and parameter contracts. |
| `npm run check:docs` | Check required docs, relative links, script references, and requirement/test traceability. |
| `npm run analyze` | Full configured fallow analysis. |
| `npm run analyze:production` | Production-scoped fallow analysis with explicit entrypoints. |
| `npm run analyze:changed` | Optional incremental feedback; never a substitute for full verification. |
| `npm run verify:fast` | Finite type/lint/LoC/architecture/unit checks suitable during an agent task; clearly a partial gate. |
| `npm run verify` | Full required static, coverage, gate-fixture, build, documentation, and browser verification. |
| `npm run check` | Compatibility alias for `verify`. |
| `npm run quality:report` | Render actual gate results with scope and build identity; mark missing evidence, do not infer success. |
| `npm run security:audit` | Separate explicit online dependency/security assessment, covering runtime and development risks. |
| `npm run verify:release` | Full verification plus required host evidence, release metadata, generated-repository checks, and artifact validation. |
| `npm run release:prepare` | Prepare versioned assets and release notes; no implicit publication or registry submission. |

Use cross-platform Node scripts instead of shell-specific copying, environment assignments, and deletion commands. Long-running servers belong only to explicitly named interactive commands. After documented dependency/browser provisioning, the normal verification pipeline should not depend on live external services.

## 16. Agentic development operating model

### 16.1 Repository instructions

**AGT-01:** A concise root `AGENTS.md` provides the project map, architecture invariants, command entrypoints, safety rules, and evidence requirements. Detailed material is linked under `docs/agents` and relevant directories rather than duplicated in a giant root instruction file.

**AGT-02:** Provider-specific files are thin adapters. `CLAUDE.md` and optional other agent instructions refer to the same authoritative conventions instead of introducing conflicting parallel policies. Scoped instructions explain genuinely local rules.

This follows the instruction-discovery and context-management principles documented for Codex and Claude Code; the implementation remains usable with other agents or none. [A1], [A2]

### 16.2 Bounded workflow

**AGT-03:** The standard task sequence is **read relevant requirements → inspect affected modules/tests → define a small plan → implement behavior and tests → run targeted checks → inspect browser evidence when UI changes → run required integration checks → report results and limitations**.

**AGT-04:** Every implementation task identifies a use case, requirement IDs, affected layer boundaries, acceptance criteria, expected commands, and allowed file ownership. A task is not complete merely because generated code compiles.

**AGT-05:** Parallel agents work in disjoint feature/package scopes where possible. Changes to dependency files, shared contracts, migrations, quality configuration, and root instructions have a named integration owner. Agents do not overwrite another worker's files or resolve conflicts by discarding unexplained changes.

**AGT-06:** Verification evidence includes exact commands, exit results, relevant artifacts, and what was not tested. Agents must not describe skipped native/mobile checks as passing, present old screenshots as current, or call a mock contract a real-host test.

**AGT-07:** No agent may weaken a gate, add a broad suppression, accept visual baselines, remove failing tests, or change supported-platform claims solely to finish its current feature. Such changes require a separately explained review decision.

### 16.3 Safety and efficiency

**AGT-08:** Repository files, issues, sample content, and browser pages are untrusted inputs. Instructions embedded in fixture/user content do not authorize shell execution, credential access, publishing, or broader permissions.

**AGT-09:** Verification must be non-destructive and finite. No default autonomous publishing, personal-vault writes, dependency upgrades, unrestricted autofix, or recurring watch process. Network-required setup is separate from ordinary offline-capable checks.

**AGT-10:** Supply runbooks for adding a feature, adding a locale, adding a command/modal, introducing a storage migration, debugging a browser failure, investigating fallow findings, and collecting host evidence. Each runbook names the relevant extension points and tests.

**AGT-11:** Optional local hooks provide fast feedback but do not replace CI. They run narrowly against relevant edits and must not repeatedly execute a full browser suite after every keystroke.

**AGT-12:** Add a feature-task template and a review/handoff template. An optional feature generator may be added later only after the manual extension recipe is proven; generation is not required to hide architecture from developers.

## 17. Template initialization, CI, and release readiness

### 17.1 Generated-repository behavior

**TPL-01:** GitHub's template-repository setting must be enabled and verified by a maintainer. Repository files alone do not set that flag. Generated repositories receive a documented first-run checklist for their own Actions permissions, rulesets, secrets, and publishing settings. [G1]

**TPL-02:** Initialization handles plugin ID, display name, description, author, repository URL, initial version, CSS/storage namespaces, documentation identity, and manifest-related references. Prefer a small identity source and generated/configured consumers over blind global text replacement.

**TPL-03:** Validate identity before writing. Support dry run; show changed files; preserve license terms and unrelated user changes; avoid interactive prompts in noninteractive mode. Re-running with the same identity is safe. Changing an installed plugin ID is explicitly treated as a data/identity migration, not a harmless rename.

**TPL-04:** A generated repository with a different name, ID, and author is created in an isolated temporary location and run through install, build, verification, and local deployment checks. A second test removes the sample feature using the documented recipe. Both must expose hardcoded template identifiers and stale paths.

### 17.2 CI

**CI-01:** Pull-request CI runs the full required verification on a pinned environment. Linux runs browser visual baselines; Windows runs cross-platform tooling/build/non-browser checks. macOS and host/mobile matrices are explicitly scheduled or release-gated according to provisioning, not silently claimed by the Linux result.

**CI-02:** Cache keys include the relevant lockfile, tool/browser versions, and platform. Cached results must not conceal a changed source tree. Browser installation/provisioning happens in explicit setup steps.

**CI-03:** Upload useful failure evidence with bounded retention and sanitized content. Required jobs fail when reports are missing, tools crash, or required suites do not run.

**CI-04:** Use least-privilege workflow permissions, pinned action revisions, and safe handling of untrusted pull requests. Do not expose publishing credentials to code from a fork. Release publication is separate and requires deliberate authorization.

**CI-05:** Runtime and development dependency risks are reviewed. Security automation must not run an uncontrolled force-upgrade to make findings disappear. Exceptions require a reason, owner, and review condition.

### 17.3 Release package

**REL-01:** Release preparation validates manifest identity/version, minimum host support, version mapping, asset names, release tag convention, license notices, and hashes. No test data, `.dev-vault`, reports, browser binaries, or MCP configuration enters the distributable.

**REL-02:** The exact candidate bundle has real-host evidence. Rebuilding after acceptance invalidates previous hash-bound evidence unless reproducibility or an unchanged hash is demonstrated.

**REL-03:** Provide a submission/release checklist based on current Obsidian requirements. Do not advertise the template itself as a community-listed production plugin or automatically submit generated plugins.

**REL-04:** Template upgrades document breaking changes to architecture, commands, storage conventions, and quality thresholds. Generated projects are not assumed to receive upstream template changes automatically.

## 18. Non-functional requirements

The following budgets are proposed acceptance targets, not measurements of an implementation. WP-00/WP-01 must define a reproducible fixture and reference environment, then record the initial measurements. A changed budget requires rationale rather than pretending an unstable benchmark is a universal guarantee.

| ID | Attribute | Proposed acceptance target |
| --- | --- | --- |
| NFR-01 | Privacy / offline | Shipped example feature and settings work without network access, account, credentials, or remote fonts/assets. |
| NFR-02 | Startup | On the documented reference desktop, warm plugin initialization p95 is at most 200 ms over 30 controlled runs; no eager whole-vault scan. Separate host startup from plugin initialization. |
| NFR-03 | Shell responsiveness | With 100 fixture items, initial shell readiness p95 is at most 500 ms after opening on the reference environment. Report measurement method and outliers. |
| NFR-04 | Artifact size | Initial target: at most 1 MiB minified uncompressed `main.js` and 100 KiB `styles.css`, excluding development maps. Report actual and compressed sizes separately. |
| NFR-05 | Resource ownership | After 20 open/close cycles, owned active subscriptions/timers/observers return to baseline; no detached view roots remain retained by application-owned registries. |
| NFR-06 | Resilience | Storage denial, corrupt/future data, failed initialization, and failed writes have explicit outcomes and no silent destructive fallback. |
| NFR-07 | Accessibility | Required keyboard/focus scenarios pass; no unapproved automated accessibility violations in the supplied scenarios; manual review covers what automation cannot. |
| NFR-08 | Portability | Documented development commands work on Windows and Linux; macOS instructions and release checks remain explicit. Runtime avoids desktop-only dependencies unless intentionally opting out of mobile support. |
| NFR-09 | Maintainability | File, boundary, lint, coverage, complexity, and analyzer gates are executable with visible exceptions. |
| NFR-10 | Reproducibility | Lockfile-controlled builds, declared tool/browser versions, deterministic fixture data, and evidence tied to source/build identity. |

Performance measurements are kept separate from noisy shared-runner timing assertions unless the environment is controlled. Functional correctness is not traded away merely to satisfy a size or speed target.

## 19. Acceptance scenarios and traceability

These scenarios define the first release's minimum acceptance surface. Implement them as tests at the appropriate layer; retain explicit manual records where a real host/device is needed.

| ID | Given / When | Then | Trace / evidence |
| --- | --- | --- | --- |
| AC-01 | A fresh generated repository is initialized with a different plugin identity. | Install, build, and verification succeed without stale template paths; dry run changes nothing. | TPL-02–04; generated-repository integration. |
| AC-02 | The plugin is loaded in the supported real host and its command/ribbon is invoked. | The native view opens/focuses correctly and registrations are not duplicated. | UI-01–03, HST-01–04; host record. |
| AC-03 | Valid example data is submitted and the write succeeds. | The correct item appears; a reload retains it; the same application behavior is used in harness and host. | EXA-01–03, DAT-05; unit + E2E + host. |
| AC-04 | Empty or oversized text is submitted. | Validation is localized, focus remains useful, and no durable write occurs. | EXA-01, ERR-01; domain + component + E2E. |
| AC-05 | A durable write fails. | No success is claimed; prior durable state remains; retry follows the declared policy. | DAT-03–05, ERR-04; integration + E2E. |
| AC-06 | Two views and a settings action update shared durable data concurrently. | No stale snapshot overwrites another successful update; each view has its own draft state. | LIF-02–03, DAT-03; integration + multi-view E2E. |
| AC-07 | Stored data is corrupt or has a future schema. | Original content is preserved; older code does not overwrite it with defaults. | DAT-01–04; migration + recovery tests. |
| AC-08 | Local storage is unavailable, or two plugin/vault namespaces coexist. | Core behavior continues and owned preference keys remain isolated. | LOC-01–05; adapter contract + E2E. |
| AC-09 | The locale changes and a long translation is displayed. | Mounted UI updates, parameters are correct, and any host-label reload requirement is explicit. | I18N-01–07; catalog + E2E + host. |
| AC-10 | A modal is cancelled, submitted, closed, and reopened. | Cancellation writes nothing; focus and owned resources are correct; errors are not duplicated. | UI-05, LIF-04, ERR-06; E2E + host. |
| AC-11 | A view closes repeatedly or the plugin reloads. | Owned handlers return to baseline; other views remain valid; workspace leaves are not manually detached. | LIF-01–07, NFR-05; lifecycle + host. |
| AC-12 | Source/test files have exactly 400/450 lines, then one additional line. | Boundary values pass and excess values fail, including complete Vue files and CRLF. | QLT-01–02; checker fixtures. |
| AC-13 | A forbidden dependency is introduced via alias, re-export, or an unclassified file. | The actual architecture gate fails with a useful explanation. | ARC-08–09, QLT-14; negative graph fixtures. |
| AC-14 | A Vue template violation, missing locale key, or unsafe async callback is introduced. | The applicable real lint/translation/type gate fails. | QLT-03–06, I18N-04, ERR-03; tool fixtures. |
| AC-15 | An export is referenced only from tests but not production. | Production-scoped analysis reports the issue unless a narrow real host entrypoint explains it. | QLT-09–13; analyzer fixtures. |
| AC-16 | A browser scenario raises an unexpected page error or fails an assertion. | The run fails and produces current trace/screenshot/report evidence. | E2E-05–07; deliberately failing runner fixture. |
| AC-17 | A production build is inspected. | It has the required host-loadable assets and contains no harness, mock, agent server, or unintended runtime chunk. | ARC-09, HAR-07, BLD-01–04; artifact tests. |
| AC-18 | A local install targets a vault with existing data and unrelated plugins. | Only allowlisted assets change; data, notes, enabled entries, and security settings are preserved. | DEP-01–07; deployment integration. |
| AC-19 | A deployment target escapes containment or configuration is malformed. | The operation fails before destructive writes and leaves prior installation intact. | DEP-04–06; path/fault fixtures. |
| AC-20 | An analyzer crashes or the native host is not provisioned. | The report says infrastructure error/not run; release verification cannot interpret it as a pass. | QLT-16, HST-03, CI-03; report tests. |
| AC-21 | Diagnostics are exported after repeated failures containing sensitive input. | Output stays bounded and redacted; nothing is uploaded automatically. | LOG-01–06; privacy + UI tests. |
| AC-22 | A user operates only with keyboard in a narrow dark/light shell. | Required actions and focus behavior remain usable; errors do not rely only on color. | UI-08–09, E2E-04; browser + manual review. |
| AC-23 | The candidate runs on the claimed mobile hosts. | Native interactions and persistence pass the documented device smoke, or support is not claimed. | HST-05, TEC-05; device evidence. |
| AC-24 | The example-removal recipe runs in a generated project. | No orphan registrations, translations, tests, or runtime dependencies remain. | EXA-05, TPL-04; template integration. |

Every implementation work package must map its changed requirements to these scenarios or add a new scenario. Requirement coverage is distinct from code coverage.

## 20. Implementation work packages

Work packages are dependency-ordered slices, not promises about elapsed time. Each ends with a demonstrable result. Dependencies on a future script can initially use the underlying documented tool command; the final template must expose the stable command contract.

| Package | Scope and key deliverables | Dependencies | Exit evidence |
| --- | --- | --- | --- |
| **WP-00 — Compatibility and decisions** | Select tested versions; prove Vite/Vue CJS loading; choose native settings API and minimum host; verify fallow schema/boundaries; assess native-runner provisioning; record ADRs. | PRD review | Compatibility matrix, minimal host-loading proof, decision records, no unsupported version claims. |
| **WP-01 — Toolchain and quality foundation** | npm/lockfile, strict TS projects, Vue/Vite/Vitest, complementary lint, formatter, line checker, graph zones, fallow scopes, gate fixtures, initial CI. | WP-00 | Exact-limit tests and deliberately invalid imports/lint fixtures fail correctly; clean scaffold checks pass. |
| **WP-02 — Runtime composition and lifecycle** | Thin main/bootstrap, owned services, mount/dispose contract, view-owned Vue/Pinia, typed application ports, host registration adapters. | WP-01 | Lifecycle and multi-instance unit/integration tests; initial native shell smoke. |
| **WP-03 — Data and cross-cutting capabilities** | Versioned durable repository, serialized writes, local storage, native settings, locale service, error model, bounded redacted logger. | WP-02 | Migration/concurrency/failure/namespace tests; settings persisted and localized in host. |
| **WP-04 — Complete example vertical slice** | Example-item domain/use cases, real components/stores, commands/ribbon, modals/notices, responsive/themed shell. | WP-03 | Create/rename/delete, cancellation, failure and reload demonstrated through actual services. |
| **WP-05 — Deterministic harness** | Separate Vite target, production component reuse, fixture adapters, scenario catalog, readiness/control API, host-style shim. | WP-04 | Scenarios reproducible headlessly and manually; production artifact excludes all harness facilities. |
| **WP-06 — Frontend and host evidence** | Playwright behavior/visual/accessibility tests, failure artifacts, multi-view/disposal cases, native smoke runbook and proven automation where selected. | WP-05 | Required E2E pass; intentionally failing runner fails; actual-host evidence has explicit scope. |
| **WP-07 — Safe local installation and identity** | Manifest checks, artifact hashing, dry-run/staged deployment, repo-contained vault, watch-last-good behavior, template identity initializer. | WP-04; integrate WP-06 evidence | Installation preservation/path-failure tests; differently named generated project builds and installs. |
| **WP-08 — Agent, CI, and release operations** | Concise/scoped instructions, feature and review runbooks, optional MCP examples, full report schema, CI security, release preparation, maintainer checklist. | WP-06, WP-07 | Fresh-agent task uses documented commands; CI failures are honest; release verification requires host evidence. |
| **WP-09 — Template qualification** | Fresh template generation, example removal, full acceptance traceability, performance/size measurements, desktop/mobile claims review, documentation cleanup. | WP-08 | AC-01–24 have passing evidence or explicitly scoped release-blocking status; no unimplemented v1 MUST is hidden. |

### 20.1 Minimum architecture decisions

Record concise ADRs for: layer/feature boundaries; per-view Pinia ownership; durable versus local storage; error/notification policy; localization and native-label refresh; dual build targets; lint ownership; fallow scope/exceptions; compatibility/native settings baseline; host/browser evidence separation; and safe local deployment.

An ADR records context, chosen option, rejected alternatives, consequences, and validation evidence. It is not a place to copy complete library documentation.

### 20.2 Definition of Ready for an implementation task

A task has a small stated outcome, requirement IDs, acceptance scenarios, affected contracts, dependency readiness, data/error behavior, and an evidence plan. UI tasks identify loading/empty/error behavior and localization. Persistence tasks identify schema and migration impact. Shared configuration changes identify the integration owner.

### 20.3 Definition of Done

Behavior is implemented through the intended layers; targeted and required integration tests run; no unapproved quality regression is introduced; UI changes have current browser evidence; host-sensitive changes have appropriate native evidence; docs/contracts are updated; generated assets are not committed accidentally; and the handoff states exact results and untested scope.

No work package is done because a tool generated a large volume of code or because an agent wrote that all checks should pass.

## 21. Risks and release decisions

| Risk | Consequence | Required mitigation |
| --- | --- | --- |
| Latest packages are combined without compatibility proof. | Lint/parser/build/runtime failures before product work begins. | WP-00 matrix, pinned lockfile, upgrade verification. |
| Harness mocks drift from Obsidian. | Browser green while plugin fails in host. | Narrow adapter contracts, deliberate mock-failure tests, separate native evidence. |
| Architecture permits unmatched files or aliases. | Business logic and host dependencies leak across boundaries. | Complete file classification and negative resolved-import fixtures. |
| Local build scripts overwrite data or security preferences. | Developer data loss or unsafe plugin enablement. | Contained fixture vault, staged allowlist copy, no silent resets, dry run. |
| Pinia owns canonical persistence. | Stale state, cross-view bugs, accidental synchronization. | Application-owned repositories; view-local stores; explicit subscriptions. |
| Quality thresholds encourage test deletion or suppression. | False confidence and unreadable abstractions. | Review-sensitive gate changes and exception registry; behavior acceptance beyond percentages. |
| Agent context becomes an enormous policy document. | Important constraints are missed or conflict. | Small root instructions and scoped progressive disclosure. |
| Test tooling is accidentally bundled. | Larger, unsafe, or incompatible plugin. | Separate entrypoints and production artifact checks. |
| Theme or application assets are copied without rights. | Redistribution and maintenance issues. | Own minimal shim; preserve provenance and licenses. |
| Release claims exceed actual device testing. | Users receive unsupported mobile/host behavior. | Evidence-bound compatibility claims and explicit not-run status. |

Before implementation proceeds beyond WP-00, settle the exact version matrix, minimum Obsidian baseline/settings API, and selected optional host automation approach. The proposed locales, thresholds, and isolated-vault default otherwise provide a concrete starting point; they are not reasons to block the initial work with open-ended discovery.

## 22. Research and source register

Sources were inspected on **2026-09-22**. Links to moving branches/documentation may change later. The file blob identifiers below preserve the identity of selected reference observations; they are not claims that the entire repositories were audited.

### 22.1 Obsidian

- **[O1]** Obsidian developer guidelines, official source: [Plugin guidelines](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/Releasing/Plugin%20guidelines.md). Inspected blob `7516a3d97c63488e45badb79a2cd239adaddada9`. Relevant to lifecycle, commands, UI, logging, and host-safe patterns.
- **[O2]** Official public TypeScript API: [obsidian.d.ts](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts). Inspected blob `4fd05b81a95a7f2316f6ca9264abef45fd2c8d58`, including `App.loadLocalStorage` / `saveLocalStorage` definitions and their version annotations.
- **[O3]** Official lint integration: [obsidianmd/eslint-plugin](https://github.com/obsidianmd/eslint-plugin). Package name, recommended/type-aware configuration, host rules, and version-sensitive settings rules.
- **[O4]** Official getting-started tutorial: [Build a plugin](https://docs.obsidian.md/Plugins/Getting%20started/Build%20a%20plugin). Development-vault separation and host loading workflow.

### 22.2 Vue, Pinia, localization, build, and lint

- **[V1]** Vue: [Testing](https://vuejs.org/guide/scaling-up/testing.html). Public behavior and complementary test layers.
- **[V2]** Vue: [Application API](https://vuejs.org/api/application.html). Application ownership, injection, unmount, and error handling.
- **[V3]** Pinia: [Testing stores](https://pinia.vuejs.org/cookbook/testing.html). Fresh instances and default action stubbing.
- **[V4]** Vue I18n: [Composition API](https://vue-i18n.intlify.dev/guide/advanced/composition). Shared localization integration.
- **[V5]** Vite: [Building for production](https://vite.dev/guide/build.html). Library/build configuration and runtime compatibility distinctions.
- **[V6]** Vitest: [Browser Mode](https://vitest.dev/guide/browser/). Evaluated as an additional option; not required alongside the initial Vue Test Utils and Playwright split.
- **[L1]** Oxc: [Oxlint usage](https://oxc.rs/docs/guide/usage/linter.html) and [compatibility](https://oxc.rs/compatibility.html). Supported analysis, Vue limitations, and complementary ESLint use.

### 22.3 fallow

- **[F1]** Project primary source: [fallow-rs/fallow](https://github.com/fallow-rs/fallow). Tool capabilities and CLI workflow overview.
- **[F2]** [Configuration overview](https://docs.fallow.tools/configuration/overview). Entry points, installed-schema/version compatibility, analysis policy, and configuration scope.
- **[F3]** [Architecture boundaries](https://docs.fallow.tools/analysis/boundaries). Zones, matching, dependency policies, and why unmatched files require attention.
- **[F4]** [Known limitations](https://docs.fallow.tools/analysis/limitations). Static analysis limits and cases requiring explicit modeling or runtime evidence.
- **[F5]** [MCP integration](https://docs.fallow.tools/integrations/mcp). Agent analysis and mutation-capability boundary.

### 22.4 Agent and test workflows

- **[A1]** OpenAI: [AGENTS.md guidance](https://developers.openai.com/codex/guides/agents-md/). Instruction discovery and scoped repository guidance; this address may redirect to the current official documentation location.
- **[A2]** Anthropic: [Claude Code best practices](https://code.claude.com/docs/en/best-practices). Context management and explore/plan/implement/verify workflow.
- **[A3]** Microsoft: [Playwright MCP](https://github.com/microsoft/playwright-mcp). Optional browser-agent integration.
- **[T1]** Playwright: [Best practices](https://playwright.dev/docs/best-practices). Isolation, robust locators, and observable test behavior.
- **[T2]** Playwright: [Visual comparisons](https://playwright.dev/docs/test-snapshots). Environment-sensitive baselines and explicit updates.
- **[T3]** WebdriverIO: [Obsidian Plugin Testing Service](https://webdriver.io/docs/wdio-obsidian-service/). Third-party native-host testing option and its stated provisioning capabilities.
- **[G1]** GitHub: [Creating a template repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-template-repository). Repository template setting and maintainer setup.

### 22.5 Inspected example-project files

| Ref | File | Inspected blob |
| --- | --- | --- |
| R1 | [Renovation Planner package.json](https://github.com/Luis85/renovation-planner/blob/main/package.json) | `507b57ad80918572c5e22a6de61d58d86c42bea7` |
| R2 | [Renovation Planner vite.config.ts](https://github.com/Luis85/renovation-planner/blob/main/vite.config.ts) | `67b96388b225101bc763d9f78728184b1aa250b1` |
| R3 | [Renovation Planner vite.harness.config.ts](https://github.com/Luis85/renovation-planner/blob/main/vite.harness.config.ts) | `0026846c6e7d3147a3138d7492a58bd8db5e1087` |
| R4 | [Renovation Planner src/main.ts](https://github.com/Luis85/renovation-planner/blob/main/src/main.ts) | `ef61d52fd6756d7ab00adfb0b0e59b08f8567515` |
| R5 | [Renovation Planner scripts/test-build.mjs](https://github.com/Luis85/renovation-planner/blob/main/scripts/test-build.mjs) | `28e6d835723f5afe1c0a9f979745b235367b23d3` |
| R6 | [Backlog View package.json](https://github.com/Luis85/backlog-view/blob/main/package.json) | `f8906c62b88f39b4dd99679e5500b3b4e93e1ada` |
| R7 | [Backlog View scripts/harness.mjs](https://github.com/Luis85/backlog-view/blob/main/scripts/harness.mjs) | `b1f8d6ca39ba614c6a59cda528d5b5039c9ceead` |
| R8 | [Backlog View src/main.ts](https://github.com/Luis85/backlog-view/blob/main/src/main.ts) | `c0308562ef9126a1c27dfa9c0317f8b53e592d81` |
| R9 | [Renovation Planner eslint.config.mjs](https://github.com/Luis85/renovation-planner/blob/main/eslint.config.mjs), selected sections | `5b5798dc7c924c00b485ad473ff39f90d9f32b2c` |
| R10 | [Renovation Planner .fallowrc.json](https://github.com/Luis85/renovation-planner/blob/main/.fallowrc.json), selected sections | `6d1f99ada63803d8ab714102aabc8b0b14a18aa3` |

### 22.6 Verification boundary of this document

This PRD is based on official/primary documentation and selected live repository reads. No sample repository was built, no plugin was run in Obsidian, no package-version combination was experimentally validated, and no runtime code was added as part of preparing this document. Those proofs are explicit deliverables of WP-00 through WP-09.
