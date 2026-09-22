# Product requirements: Obsidian Plugin Shell

> **Version:** 0.3.0  
> **Updated:** 2026-09-22  
> **Owner:** Luis85  
> **Status:** Implementation specification; current repository delivery is documentation only.  
> **Product goal:** Obtain the template, run guided setup, generate a first feature, develop confidently, keep dependencies current, and release a tested Obsidian plugin.

## 1. Product direction

Obsidian Plugin Shell is a GitHub template for maintainable TypeScript/Vue 3/Pinia plugins. It supplies a working removable example, native integration, a real-component frontend harness, enforceable architecture, a typed event bus, modular composed styling, development generators, and a straightforward GitHub release workflow.

```text
Get template → npm run setup → npm run make → develop in browser/Obsidian
→ verify → create release draft → accept exact artifacts → publish
```

Node and npm are prerequisites. Installing project dependencies is part of setup; a separate `npm ci` must not be required to start the wizard. CI and ordinary explicit lockfile reinstalls still use `npm ci` directly.

Target the latest **public/stable** Obsidian and current compatible dependencies through reviewed updates. Do not require Catalyst access, an AI account, a personal vault, or a paid release/tooling service.

### 1.1 Owner requirements

| Area | Required outcome |
| --- | --- |
| Stack | Vite, Vitest, Oxlint, fallow, TypeScript, Vue 3, Pinia, and `eslint-plugin-obsidianmd`. |
| Foundation | Settings, durable storage, local preferences, view shell, commands, ribbon, modals, notices, multilingual UI, error handling, logging. |
| Architecture | Domain-oriented clean architecture with composition-only `main.ts` and enforced dependency directions. |
| File size | At most 400 physical lines per handwritten source file, 450 per test/helper file. |
| Guided installation | A fresh template can start `npm run setup` without installed project dependencies; guided configuration, installation, checks, and handoff. |
| Tooling organization | Executable scripts, shared helpers, makers, and templates live in a dedicated `scripts/` tree. |
| Boilerplate | A Symfony-inspired `make` interface generates readable, integrated, tested scaffolds and supports custom makers. |
| Events | A typed, plugin-scoped, extensible event bus with a supported Obsidian-event bridge and owned cleanup. |
| Styles | CSS can be split into modules and Vue component styles; the build composes one complete `styles.css`. |
| Agent readiness | Bounded tasks, noninteractive tooling, deterministic frontend scenarios, and truthful verification evidence. |
| Maintenance/release | Latest-stable-first compatibility, active dependency upkeep, safe codebase-local installation, and explicit tested releases. |

### 1.2 Contract organization

MUST requirements are necessary for the complete template. SHOULD identifies a preferred implementation with a documented exception path; MAY identifies optional extensions. Defaults such as npm, English/German, Vue I18n, Playwright, the example-item feature, a 100-line `main.ts`, and quantitative quality budgets are template policies—not measured results or vendor requirements.

This revision preserves existing core requirement identifiers and AC-01–35. It adds AC-36–49 and the following **normative companion contracts**. Their requirements are part of this PRD, not optional suggestions:

| Contract | Requirement IDs |
| --- | --- |
| [Guided setup and makers](../development/SETUP-AND-MAKERS.md) | TOOL-01–06, SETUP-01–12, MAKE-01–12 |
| [Typed event bus](../architecture/EVENT-BUS.md) | EVT-01–16 |
| [Modular CSS composition](../architecture/STYLES.md) | CSS-01–12 |

These replace v0.2's optional-generator/no-bus assumption and its separate-install quickstart. They do not relax architecture, lifecycle, safety, or quality controls. Practical navigation starts at the [developer workflow](../development/DEVELOPER-WORKFLOW.md); release operations are in the [maintenance guide](../development/MAINTENANCE-AND-RELEASE.md).

R01–R35 source references resolve in the [earlier research register](../research/2026-09-22-template-research.md). S01–S14 resolve in the [setup/makers/events/styles supplement](../research/2026-09-22-setup-makers-events-styles.md).

## 2. Users, outcomes, and developer experience

The primary user is a developer starting a plugin. Agents and reviewers support that developer. The first useful change must not require reading the whole PRD or configuring each underlying tool.

**SUC-01:** A differently named generated repository initializes, installs, builds, verifies, and prepares valid release assets without manual path repair.

**SUC-02:** One reference feature demonstrates real UI → application → domain validation → persistence → committed event → projection/feedback behavior, including failure paths.

**SUC-03:** Browser development/verification work without Obsidian, a personal vault, AI subscriptions, or API keys.

**SUC-04:** Real-host compatibility is established separately; browser success is not host proof.

**SUC-05:** Isolated negative fixtures prove important gates actually fail for their intended defects.

**SUC-06:** Rebuild/setup/generation preserve user data, notes, unrelated files/plugins, configuration, and security decisions.

**DX-01:** The quickstart emphasizes setup, make, dev:ui/dev:local, verify, and release:prepare, with help one command away. Advanced commands remain discoverable rather than crowding first-run guidance.

**DX-02:** Guided setup starts dependency-free, supports validated noninteractive inputs/dry run/resume, and reports next actions. No global npm tooling, Docker, GitHub CLI, native compiler, or separate package manager is required for the normal browser path unless a proven unavoidable prerequisite is explicitly documented.

**DX-03:** Provide both a maker-based first-feature recipe and a manual first-change recipe. Proposed measured usability target: first visible change within 15 minutes of active work after prerequisites/downloads are available; do not claim it before testing.

**DX-04:** Errors identify what failed, evidence location, and narrow recovery. Distinguish missing Node/browser/host, port conflicts, invalid identity, generator collision, CSS build failure, and dependency installation failure.

**DX-05:** Generated product documentation reflects its own identity. Template-maintenance documentation stays separately discoverable; stale upstream names/badges and claims must not survive initialization unnoticed.

## 3. Scope and boundaries

The first complete release includes the plugin/example, typed events and native bridge, composed styles, setup/makers, quality configuration, harness/tests, safe local deployment, dependency maintenance, CI/release workflows, and documentation.

Runtime remains mobile-compatible by design; mobile support requires device evidence. Desktop and mobile public release numbers are tracked separately.

Not included: an in-plugin AI runtime, telemetry, authentication, business ERP features, Bases views, canvas engine, reflection/DI framework, generic repository hierarchy, distributed messaging, event sourcing, durable/replaying bus, SSR, npm-library publication, mandatory Storybook/Histoire/MCP, or universal historical Obsidian compatibility.

The event bus is an explicit required integration primitive, not permission to turn every function into an event. Commands requiring results use application calls. Parent/child Vue interactions use their native mechanisms. Makers generate ordinary source, not a second runtime platform interpreting feature definitions.

## 4. Research-informed design decisions

| Area | Decision |
| --- | --- |
| Host baseline | Latest public/stable; Catalyst is optional early warning. |
| Settings | Current declarative native definitions and custom storage hooks using the application preference service. |
| Dependencies | Exact direct versions and lockfile, reviewed family updates, Dependabot default/one updater. |
| Setup | Checked-in Node-only bootstrap starts before dependency installation; no lifecycle recursion. |
| Generation | Discoverable local makers with dry-run plans, explicit integration, tests, and custom extensions. |
| Events | A typed transient notification bus; host events mapped through supported APIs with lifecycle/startup controls. |
| CSS | Explicit source imports plus compiled SFC styles, extracted by the shared Vite pipeline. |
| Quality | Prefer supported fallow boundaries/coverage and actual gate fixtures over duplicated analyzer frameworks. |
| Native workflow | Optional official CLI restricted to the approved fixture vault. |
| Release | Explicit commit/candidate, exact retained assets, host acceptance, deliberate promotion. |
| Simplicity | Small first-run surface; no mandatory remote generator templates, AI runtime, release SaaS, or npm publication. |

Selected files in Renovation Planner and Backlog View informed the baseline; they were not fully audited or copied wholesale. External documentation establishes tool capabilities, not proof that the chosen combination works. Source/evidence boundaries are in section 22.

## 5. Technology, compatibility, and freshness

### 5.1 Responsibility allocation

| Tool | Responsibility |
| --- | --- |
| TypeScript / vue-tsc / tooling checkJs | Strict runtime, Vue, harness, test, generator-output, and tooling checks. |
| Vite / Vue plugin | Native CJS and browser builds, including compiled and composed CSS. |
| Vue 3 / Pinia | Presentation and explicitly owned view state. |
| Vitest / Vue Test Utils | Domain/use-case/adapter/component/event/tooling contracts. |
| Playwright Test | Browser flows, accessibility integration, reviewed visuals, failure traces. |
| Oxlint | Fast supported correctness/quality rules. |
| ESLint / Obsidian / Vue plugins | Complementary native, template, and typed rules. |
| fallow | Reachability, dependencies, duplication, complexity, and resolved boundaries. |
| Vue I18n | One localization service for native and Vue surfaces. |
| Node scripts / npm | Guided setup, makers, orchestration, deterministic installation. |
| GitHub Actions | Required CI, maintenance checks, reviewed draft/promote operations. |

Use one formatter and one browser test stack initially. The typed bus may use a small qualified implementation behind the specified ports; its semantics must be tested rather than inherited accidentally from an emitter dependency.

### 5.2 Latest-stable host contract

**TEC-01:** Maintain a machine-readable exact compatibility record for tools, Node/npm, host application/API declarations, relevant installer/runtime, browser binaries, platforms, date, and evidence. WP-00 establishes it.

**TEC-02:** Select the newest public desktop host for a fresh qualified baseline. The dated prior research observed 1.13.7; re-resolve at implementation/qualification rather than treating that number as permanent. Do not infer old-host support from successful compilation. [R01, R02]

**TEC-03:** Use current stable-supported declarative settings, not an unnecessary pre-1.13 fallback. Newer API declarations do not authorize early-access-only calls on a stable target. [R05, R06]

**TEC-04:** Bundle required runtime libraries; externalize genuinely host-provided modules. Scripts, makers, fixture loaders, and agent integrations must not enter the runtime graph.

**TEC-05:** No Node/Electron runtime dependency when mobile support is claimed. Externalizing such a dependency is not portability; Node is appropriate in scripts only.

**TEC-06:** Distinguish build syntax from runtime API support and desktop Chromium from mobile WebViews. No remote polyfill/asset requirement is hidden in the build.

**TEC-07:** Test latest public desktop and any deliberately retained different minimum. Advance a baseline through an explicit compatibility change; a dependency PR must not silently raise an established plugin's minimum.

**TEC-08:** Optional Catalyst testing is isolated/nonblocking for public-host support unless it exposes a defect in the supported scope. Normal development needs no entitlement.

### 5.3 Dependency policy

**UPD-01:** Select latest compatible stable candidates, save exact direct versions, and commit one lockfile. Ordinary installs and setup's install stage use `npm ci`, not floating latest. [R22]

**UPD-02:** Use a tested patched Active LTS Node track; the prior dated selection was Node 24. Keep version files, engines, npm selection, and CI aligned. Assess new LTS tracks explicitly; do not promise all future Node majors. [R15]

**UPD-03:** Deliver Dependabot for npm/GitHub Actions with frequent checks and bounded PRs. Group compatible families and assess majors visibly. Renovate is a replacement, never a competing second updater. [R23, R24]

**UPD-04:** Initial proposed cooldown: three days for patch/minor, seven for majors; expedite security remediation after targeted review. Waiting is not proof of safety.

**UPD-05:** Updates run relevant complete checks, including gate/maker-output/style-parity tests when tooling changes. Automerge starts disabled. Any later narrow patch policy excludes host-floor/schema/release/policy changes and never automatically publishes.

**UPD-06:** Weekly/on-demand freshness reports host/API/dependency/Node/action status as current, cooling down, available, incompatible, blocked, or source unavailable. Discovery failure is not a clean result.

**UPD-07:** Track blocked updates with reason, owner, and review date. Proposed targets: review routine compatible updates within seven days after eligibility; assess majors within fourteen. Do not hide majors indefinitely or weaken checks to appear current.

**UPD-08:** Online discovery is separate from normal offline-capable verification after provisioning. Review transitive/security changes too. Setup installs the qualified lockfile and may report freshness; it does not automatically upgrade it.

## 6. Architecture and extension model

### 6.1 Dependency direction

```text
presentation → application → domain → shared
infrastructure → application contracts / domain / shared
bootstrap → concrete adapters and presentation factories
main.ts → minimal host lifecycle and bootstrap
```

Feature folders live within these layers. Runtime source includes `bootstrap`, `domain`, `application`, `infrastructure`, `presentation`, `shared`, `locales`, and `styles`. Harness/tests/scripts are separate. Add actual exercised modules, not empty folders to satisfy a diagram.

**ARC-01:** `main.ts` is composition/lifecycle only and at most 100 physical lines. No feature algorithms, persistence transformations, locale dictionaries, or markup.

**ARC-02:** Bootstrap constructs dependencies, registers capabilities, and coordinates ownership. A large bootstrap class containing moved business logic is not compliant.

**ARC-03:** Domain/application import no Obsidian, Vue, Pinia, browser/Node/Electron APIs, or concrete infrastructure. Inject time/IDs when needed. Event payloads use values, not host objects.

**ARC-04:** Inner capabilities own narrow necessary ports; use explicit injection/factories. Pure computation does not need ceremonial interfaces or a service locator.

**ARC-05:** Presentation calls application contracts; it does not directly save data/access vault or storage/create native notices. Event observation is through a scoped subscriber facade, not a global mutable bus.

**ARC-06:** Host adapters receive application/mounting interfaces; bootstrap wires concrete components and services. Makers update those composition registries, not feature logic in `main.ts`.

**ARC-07:** Cross-feature access uses small application contracts or declared typed facts; no sibling-internal imports. Keep `shared` neutral and small.

**ARC-08:** Enforce resolved aliases, re-exports, type imports, supported dynamic imports, and SFC imports, with all runtime files classified. Prefer qualified fallow coverage; supplement only proven gaps. [R12]

**ARC-09:** Production cannot import harness/tests/scripts/makers/fixtures/agent tooling. Independently validate output for leakage.

**ARC-10:** Cohesive modules, explicit names, concise TSDoc, and small public contracts. No speculative generic repositories, reflection frameworks, or excessive indirection.

### 6.2 Typed event bus

The [event-bus contract](../architecture/EVENT-BUS.md), EVT-01–16, is mandatory. It supplies one bus per runtime, literal correlated payload types, event catalog/descriptors, `publish`/`on`/`once`, explicit disposal, and narrow injected facades.

The bus is transient notification infrastructure, not canonical state or an awaited command path. Publication begins synchronously; asynchronous listener failures are observed without turning committed writes into failed writes. No replay/durable delivery guarantee is implied. Host input mapping, startup `create` suppression, nullable/file-folder cases, reentrancy, and ownership are explicitly tested. [S06–S09]

## 7. Lifecycle and state ownership

**LIF-01:** One runtime owns plugin-wide repositories, services, bus, and host bridge. Failed initialization disposes partially created resources and does not present success.

**LIF-02:** Each view owns its Vue app, Pinia instance, drafts/selection, and disposables. Closing one view cannot dispose another's state or the plugin bus.

**LIF-03:** Application/repository services own canonical data. Typed events invalidate projections; late views query current state. Avoid a second parallel untyped emitter or assumed event replay. Snapshot/subscription initialization must not miss intervening updates.

**LIF-04:** Every mount/subscription/observer/timer/listener/async effect has an owner. Repeated lifecycle changes do not accumulate handlers. Unsubscribe prevents future calls; already-started asynchronous work requires its own cancellation/late-result guard. [R17]

**LIF-05:** Use supplied `app`, supported host registrations, and EventRefs. No singleton custom-view retention or manually detached leaves on unload. [R07, S06]

**LIF-06:** Use owning documents/windows for pop-outs, modals, resize, and theme behavior. Owned native roots also receive their style namespace/tokens.

**LIF-07:** No eager vault scan, unsolicited notes, hidden Vue mount, startup event flood, or unload-only durability. Guard deferred layout callbacks when unload occurs first.

## 8. Reference feature and native surfaces

### 8.1 Removable example

**EXA-01:** Create/rename/delete a small example item with stable ID and trimmed 1–120-character label, preserving its language.

**EXA-02:** Empty, populated, pending, invalid, failed-write, and recovered states; no false success.

**EXA-03:** Demonstrate actual UI/use-case/domain/repository/result behavior plus post-commit event notification between views. The harness uses the same components, bus, and use cases.

**EXA-04:** No network requests or generated vault notes. Destructive action is deliberate; cancel causes no write.

**EXA-05:** A tested removal recipe removes example code/registrations/events/catalog entries/styles/fixtures/tests/locales while retaining infrastructure. Makers can create a replacement feature without keeping the example database forever.

### 8.2 Native surfaces

| ID | Capability | Required behavior |
| --- | --- | --- |
| UI-01 | Shell | Small action/header/content structure; clear loading/empty/error/help entry, no unnecessary dashboard chrome. |
| UI-02 | Commands | Open/focus, create, appropriate diagnostics; stable IDs/localized labels/correct callbacks/no default hotkeys. |
| UI-03 | Ribbon | One accessible localized entry to the same open-shell action. |
| UI-04 | Settings | Declarative native definitions, shared preference service, searchability, validation, truthful write feedback. |
| UI-05 | Modals | Native adapter and typed form contract; labels/focus/cancel/pending/errors/disposal, owned composed styles. |
| UI-06 | Notices | Central outcome policy, inline validation and deduplicated repeated failures. |
| UI-07 | Multiple leaves | Focus suitable existing view by default; explicit new/restored leaves have independent ephemeral state. |
| UI-08 | Styling | Namespaced source modules, semantic host variables, light/dark/narrow layouts, no global reset. |
| UI-09 | Accessibility | Keyboard/focus/labels/semantic controls, non-color-only errors, touch targets, reduced motion. |

**SET-01:** Use cheap I/O-free `getSettingDefinitions()` and supported updates; definitions may be indexed while not visible. [R05, R06]

**SET-02:** Custom typed/allowlisted control read/write hooks use application validation/ordering/persistence/errors; no competing autosave path or arbitrary dot-path mutation. [R05]

**SET-03:** Native settings are the canonical full editor; contextual Vue preferences reuse the same service.

Use typed Composition API/SFCs. Tests deliberately choose real versus stubbed Pinia actions; helper-default stubs are not evidence of application execution. [R18]

## 9. Persistence and local preferences

| Category | Owner | Example |
| --- | --- | --- |
| Durable | Versioned repository over `loadData`/`saveData` | Preferences and example records. |
| Local | Namespaced host-local storage adapter | Nonessential last section/display preference. |
| Ephemeral | Per-view Vue/Pinia | Draft, focus, selection, modal visibility. |
| Vault documents | Future feature adapter | Not required by the example. |

**DAT-01:** Stored payloads are `unknown`, structurally validated before typed construction; casts are not validation.

**DAT-02:** Schema version and ordered tested migrations; stable reopening and no older-code overwrite of future schemas.

**DAT-03:** One coordinated writer for the durable document; concurrent native settings/item updates cannot lose successful changes through stale snapshots.

**DAT-04:** Distinguish absent/corrupt/inaccessible/future data. Preserve it and make reset/recovery explicit; never silently overwrite with defaults.

**DAT-05:** Claim durability and publish committed facts only after successful persistence. Cancel/invalid input causes no write.

**DAT-06:** Save during normal operation; any justified debounce has tested flush/cancel ownership. Unload-only flushing is insufficient.

**DAT-07:** Do not advertise encrypted secret storage; the baseline requires no credentials.

**LOC-01:** Use namespaced versioned `App.loadLocalStorage`/`saveLocalStorage` through the production port. [R09]

**LOC-02:** Only the harness adapter directly uses browser localStorage, with isolated fixture namespaces.

**LOC-03:** Test absence, malformed data, serialization, denial/quota, migration, deletion, and safe fallback; respect host value semantics.

**LOC-04:** Reset only owned keys, never global storage.

**LOC-05:** Test two plugin IDs/vaults. Explain local versus portable/synchronized durable preferences.

## 10. Localization

**I18N-01:** English/German with English fallback; all template-owned visible and accessibility text, native surfaces included, uses catalogs.

**I18N-02:** One Vue I18n-based service for native and Vue code, not two engines. [R35]

**I18N-03:** Explicit plugin choice → supported host mapping → fallback, using supported host API.

**I18N-04:** Check keys, parameters, plurals, locale formatting. Do not translate user content or IDs.

**I18N-05:** Refresh mounted UI; host labels only through supported mechanisms, otherwise disclose reload requirements.

**I18N-06:** Test longer text, both locales, fallback, and development pseudo-localization. English sentence-case rules must not incorrectly apply to other languages. Prefer logical CSS. Generated locale skeletons remain pending review rather than claimed translations.

**I18N-07:** Safe fallback during localization initialization; no recursive error/translation loop.

## 11. Errors, privacy, and diagnostics

**ERR-01:** Expected validation/cancel/storage outcomes have typed results; normalize unexpected `unknown` exceptions at relevant boundaries. Do not wrap every trivial computation unnecessarily.

**ERR-02:** Stable code/category/operation/recoverability; safe localized user messages, not raw exception strings.

**ERR-03:** Observe async command/settings/ribbon/modal/startup/subscriber errors. `void` is not error handling.

**ERR-04:** Relevant recovery and only understood safe/idempotent retries.

**ERR-05:** Vue boundaries supplement explicit host/async handling; do not suppress errors of other plugins/Obsidian.

**ERR-06:** One primary notification per failure; coordinate inline feedback/notices/diagnostics. Listener failure is not misreported as failure of an already committed write.

**LOG-01:** Inject structured logger; raw console only in approved sink/tool scripts.

**LOG-02:** Production default error-only; explicit diagnostics verbosity. [R07]

**LOG-03:** Initial diagnostic bounds: 200 entries/256 KiB retained payload with field truncation.

**LOG-04:** Allowlisted fields; no note content, paths, user labels, secrets, arbitrary object dumps, or raw event payloads by default. Redact exported causes/stacks.

**LOG-05:** Explicit local previewable export; no telemetry/network sink.

**LOG-06:** Narrow expected-error contracts for negative tests. Unexpected browser errors fail. Event-listener failures go directly to the error sink, not into a recursive error event.

Render text safely; never compile untrusted templates or use unsafe HTML injection for ordinary input. [R31]

## 12. Frontend harness and agent tools

The harness renders production components, application/domain services, stores, event bus, and style sources; substitute only declared host boundaries. It is a simulation, not the host itself.

**HAR-01:** Vite dev and built/preview modes; required browser tests against built harness.

**HAR-02:** Loopback, synthetic data, no personal vault/network exposure or automatic GUI opener in headless mode.

**HAR-03:** Shared contracts with injected adapters; explicit fake scope/omissions and contract tests.

**HAR-04:** Scenario/locale/theme/viewport/seed selection and observable readiness, not sleeps.

**HAR-05:** Controlled clock/IDs/faults/storage/event inputs; independent tests plus deliberate reload persistence.

**HAR-06:** Typed harness-only controls for scenario listing/reset/faults/readiness/redacted diagnostics. No arbitrary evaluation/filesystem/shell endpoint.

**HAR-07:** Artifact gates exclude fake host, fixtures, faults, harness globals, makers, and agent endpoints.

**HAR-08:** Shared plugin style graph; own separately identified host shim, no unjustified vendored host/theme assets. Exact packaged CSS is tested through the style contract's artifact-fidelity mode.

**HAR-09:** Browser native-surface adapters test application contracts; actual native internals require host evidence.

**HAR-10:** Multi-view/repeated-mount scenarios use real stores and the production bus; one view closing leaves shared services/other views valid.

Required scenarios cover empty/populated, validation, reload, preferences, write failure/recovery, corrupt/future schema, local storage denial, localization, two views, lifecycle, responsive light/dark, keyboard/focus, host-event mapping, listener failure, and generated feature/style integration.

**E2E-01:** Playwright CLI is canonical, using roles/names or stable test IDs, auto-wait assertions, observable outcomes.

**E2E-02:** Real application actions cover success/failure/cancel/persistence/localization/ownership and unexpected browser errors.

**E2E-03:** Small reviewed visual set on pinned OS/browser/fonts/viewport; never CI self-acceptance. [R20]

**E2E-04:** Automated accessibility plus keyboard/focus/manual review, not scanner-based certification.

**E2E-05:** Bounded sanitized readable/JSON reports, screenshots, traces, logs on failure.

**E2E-06:** Source/worktree/build hashes, tools/browser, scenario/theme/locale/seed identify evidence. Include composed CSS hash. Missing/stale evidence is not success.

**E2E-07:** Isolated intentionally failing cases prove real runner failures. Own/validate the test server; reject unrelated stale CI processes. [R19]

MCP integrations are optional and restricted to synthetic data/dedicated contexts with reviewed mutation capability. CLI remains authoritative. [R34]

## 13. Test strategy and real-host evidence

| Layer | Evidence |
| --- | --- |
| Domain/application | Validation, migrations, concurrency, outcomes, post-commit facts. |
| Adapter/component | Narrow contracts, real/stubbed action choices, subscriptions, safe forms. |
| Bus/host bridge | Types, order, error isolation, once/unsubscribe/disposal, startup/null/folder mappings. |
| Browser/style | Real workflows, focus/layout, visual/accessibility, scoped-style parity, maker-generated slice. |
| Tooling | Fresh setup, safe plans, generators, process cancellation, real negative quality fixtures. |
| Artifact | CJS loading, one composed CSS file, complete assets, no development leakage. |
| Host/device | Native registration/settings/modal/notice, lifecycle/pop-out/restore, persistence, claimed mobile behavior. |

**HST-01:** Current public desktop and different declared minimum when retained, with exact candidate source/hash, host/installer/platform/results.

**HST-02:** Prove/pin the native runner in WP-00; `wdio-obsidian-service` remains a candidate, not official guarantee. Keep manual acceptance available. [R21]

**HST-03:** Normal `verify` needs no Obsidian; absent native provisioning is not run. Release promotion requires candidate-bound native evidence collected after candidate build.

**HST-04:** Load/disable/re-enable, command/ribbon, searchable native settings and failure, modal focus/cancel/notices, multi-leaf/pop-out/restore/restart data, event bridge cleanup, composed native styles, safe install preservation.

**HST-05:** Candidate tests on claimed supported iOS/Android hosts before mobile claims, recording separate app versions. Browser emulation/Linux CI is not device proof.

**HST-06:** Disposable fixtures, explicit lawful host provisioning, no redistribution/personal credentials/data. Any sandbox-specific enablement by a test runner remains isolated and documented; human setup does not automatically disable Restricted Mode.

## 14. Quality policy

### 14.1 Physical line limits

**QLT-01:** Count physical lines including comments/blanks and the entire SFC; terminal newline adds no extra content line; CRLF/LF equivalent; empty zero. Check new/uncommitted relevant files too.

| Category | Maximum |
| --- | ---: |
| `src/main.ts` | 100 |
| Other handwritten runtime, CSS, harness implementation, and tooling | 400 |
| Test specifications/helpers, including genuine colocated tests | 450 |

Generated application scaffolds become ordinary developer-owned source and obey these limits. Compiled `dist/styles.css` is a generated composition artifact, exempt only from per-source LoC—not from size/provenance/artifact checks. Machine data/lockfiles/Markdown/generated declarations have explicit separate treatment; none may hide handwritten executable logic. Production cannot import test-classified modules.

**QLT-02:** Real boundary fixtures for 400/450 pass and 401/451 fail, full SFC/CRLF/comment/blank/terminal-newline handling; verify generated-output exemption separately.

### 14.2 Type, lint, coverage, and analysis

**QLT-03:** Strict runtime/Vue/test/harness/tooling type checks with explicit optional/indexed handling. No unsafe casts or public `any` merely for mocks/events.

**QLT-04:** Complementary Oxlint and ESLint/Vue/Obsidian rules, no unapproved warnings; deliberate rule ownership, not disabling in both tools. [R10, R11]

**QLT-05:** Proposed cyclomatic 10/cognitive 15 where supported; document metrics without fragmenting cohesive behavior to game them.

**QLT-06:** Fixtures prove actual Vue script/template/parser/TS-extension/async/settings coverage. Generator output and typed event unions are part of that proof.

**QLT-07:** Proposed measured production coverage including untested files: global lines/statements/functions 90%, branches 85%; domain/application 95%, branches 90%. Explicit type/generated exclusions only; narrow evidence-backed native limitations, not whole-layer exclusions.

**QLT-08:** Critical behavior remains mandatory beyond percentages: failed/concurrent writes, corruption/future schema, cancel, cleanup, namespace isolation, event errors, validation, safe setup/generation.

**QLT-09:** Pin fallow and validate installed schema; real plugin/harness/test/script entries and known data-template consumers. Do not mark every runtime file an entry or ignore all maker outputs. [R32]

**QLT-10:** Whole-repo plus production analysis; block unjustified unused runtime files/exports/dependencies, cycles, boundary violations, and configured errors. Test-only references do not legitimize shipped dead code. [R13]

**QLT-11:** Full scope for full verification/release; changed-only feedback is additional.

**QLT-12:** Proposed production duplication 3%, initial clone minimum 50 tokens/5 lines when supported; validate denominator/schema. Report repetitive fixtures/templates separately without unreadable test abstraction or masking actual duplicate runtime scaffolds.

**QLT-13:** Respect static-analysis limits/dynamic native registration, investigate findings, no automatic deletion/fix in verification. [R33]

**QLT-14:** Prefer qualified `boundaries.coverage.requireAllFiles` plus explicit rules; fixture aliases/re-exports/unclassified/files/external/test boundaries. Only add custom enforcement for proven gaps. [R12]

**QLT-15:** Narrow reason/owner/scope/review condition for exceptions; no copied legacy baseline, broad suppression, or quiet threshold/baseline reductions.

**QLT-16:** Passed/failed/not-run/infrastructure-error with actual command/tool/scope/exit code. Crashes and unfamiliar output schema cannot become zero findings.

**QLT-17:** Isolated child-project negative fixtures cannot contaminate the normal graph or recursively execute all verification. Maker qualification runs generated projects as explicit isolated targets.

## 15. Build, setup, makers, and styles

### 15.1 Artifact

**BLD-01:** Dedicated `dist/` contains tested Obsidian-loadable CommonJS `main.js`, manifest, and one complete composed `styles.css`. Prove actual host/export shape.

**BLD-02:** Required runtime dependencies/owned assets bundled, host APIs external, no CDN/dev server/source-only path/unintended chunks. Preserve required licenses.

**BLD-03:** Debug maps in development; explicit release-map policy, no secrets/sensitive machine paths.

**BLD-04:** Validate identity/version/minimum host and package/lock/manifest consistency, mapping/hashes. This is a plugin application, not an npm library requiring declaration bundles/publishing.

### 15.2 Safe codebase-local testing

**DEP-01:** Default `.dev-vault/` inside the repository, with its configured config directory's `plugins/<id>/` destination.

**DEP-02:** Explicit validated repository-root-vault option and custom config dir. Host code reads its actual config directory.

**DEP-03:** Allowlisted output copies only; preserve data.json, unknown/user files, notes, unrelated plugins/config/security. Never clean a repository/vault as output.

**DEP-04:** Validate identity, containment, symlinks, approved targets; normalization alone is insufficient. Dry run.

**DEP-05:** Validate/stage complete matching JS/CSS/manifest before replacement. Failed watch/style builds preserve last good install; detect concurrent deployment and report recovery.

**DEP-06:** Developer-vault enablement is explicit/additive; malformed config is an error, not an empty list. No automatic Restricted Mode disablement.

**DEP-07:** Print resolved destination/identity/hashes/human action; generated vault/build artifacts ignored.

**DEP-08:** Optional supported CLI reload/screenshots only in the explicitly configured fixture vault. Missing CLI/host has a manual fallback; no personal-vault inference. [R08]

### 15.3 User-facing command contract

These are required future commands, not functionality already present. Root package scripts stay short and point to `scripts/` implementations where orchestration is needed.

| Command | Contract |
| --- | --- |
| `setup` | Node-only bootstrap, guided plan/identity, locked installation, selected provisioning/build/checks, resumable handoff. No preinstalled dependencies needed. |
| `make -- <kind>` | Discoverable integrated scaffolds, safe plan, tests, custom makers, machine mode. |
| `help` / `doctor` | Discover workflows/prerequisites; basic help/diagnosis works before dependency installation. |
| `template:init` | Setup's focused identity operation, no competing rewrite implementation. |
| `dev:ui` / `harness:dev` | Same loopback real-component HMR harness, no native-host requirement. |
| `dev` | Plugin build watch without implicit install. |
| `dev:local` | Successful complete builds installed into approved vault; optional opted-in CLI reload. |
| `build` / `build:dev` | Qualified production/debug builds with composed styles. |
| `build:local` / `test-build` | Same safe local build/install operation. |
| `typecheck` / `lint` / `format:check` | Finite non-mutating configured checks. |
| `lint:fix` / `format` | Explicit targeted mutations; never automatic verification fixes. |
| `test` / `test:watch` / `test:coverage` | Finite default, explicit watcher, enforced coverage. |
| `test:setup` | Explicit test prerequisite provisioning; reused by guided setup, not a second installer. |
| `test:gates` | Isolated negative enforcement tests. |
| `test:tooling` | Fresh setup and maker qualification/safety/extension tests. |
| `harness:build` / `harness:preview` / `harness:shot` | Build/serve/capture declared scenario and evidence. |
| `test:e2e` | Required built-harness workflows, visuals/accessibility, composed CSS/generated-feature evidence. |
| `test:obsidian` | Provisioned native test or truthful not-run status. |
| `check:loc` / `check:architecture` / `check:i18n` / `check:docs` | Focused checks composed into verification. |
| `events:catalog` / `events:check` | Generate/check documented typed event registry; no separate hand-maintained payload model. |
| `styles:build` / `styles:check` | Shared complete SFC/CSS pipeline and source/output validation, not root-CSS-only concatenation. |
| `analyze` / `analyze:production` / `analyze:changed` | Full, production, and optional incremental analysis. |
| `verify:fast` | Clearly partial finite feedback. |
| `verify` / `check` | Same full ordinary static/coverage/fixtures/docs/build/browser verification, including current event/style/tooling contracts. No native claim. |
| `quality:report` | Actual current results, including missing evidence. |
| `deps:status` / `security:audit` | Explicit online freshness/security review. |
| `release:prepare -- --version X.Y.Z` | Consistent staged metadata/changelog, dry run, no implicit commit/tag/push/publish. |
| `verify:release -- --candidate <path>` | Validate retained candidate and source/hash-bound host evidence without rebuilding it. |
| `release:check` | Explain release/listing prerequisites; explicit optional online checks. |

### 15.4 Guided installation and tooling layout

[TOOL-01–06 and SETUP-01–12](../development/SETUP-AND-MAKERS.md) require a dependency-free entrypoint, explicit consent/plan, no lifecycle recursion, safe identity, validated noninteractive mode, dry run, resumable failures, cross-platform child management, and truthful profile readiness. Scripts/helpers/maker templates live in `scripts/`; conventional root tool configuration remains thin/declarative.

The wizard does not install Node, globally alter packages/PATH, elevate permissions, change Git remotes, enable personal-vault security options, or publish. Selected downloads/installation are disclosed. Setup installs the qualified graph, not an automatic latest upgrade.

### 15.5 Boilerplate generation

[MAKE-01–12](../development/SETUP-AND-MAKERS.md) require feature/view/component/store/usecase/command/modal/setting/event/listener/style/locale/custom-maker recipes, introduced in bounded implementation slices. Every supported recipe generates integrated readable code with relevant tests, not orphan files or fake success.

Makers show explicit plans, preserve user work, reject unsafe paths/collisions, update structured registries, and never put business logic in main.ts. Their scripts/templates are development-only. Normal generation performs no remote template download or dependency installation.

### 15.6 Composed styles

[CSS-01–12](../architecture/STYLES.md) require ordered modular CSS plus compiled styles from real Vue components, one complete output, shared plugin/harness processing, namespaced native roots, watch/add/remove coverage, source LoC/output-budget separation, maker integration, and exact-candidate style evidence.

Use supported Vite extraction rather than raw string concatenation of scoped SFC styles. Ordinary source module organization does not require hashed CSS Modules. Generated `styles.css` is not hand-edited. [S10–S14]

## 16. Agent development model

**AGT-01:** Concise root AGENTS.md links commands/architecture/relevant detail; do not duplicate the full PRD. [R29]

**AGT-02:** Thin provider entrypoints; no conflicting policies or mandatory AI account.

**AGT-03:** Inspect → bounded plan → implement/test → real UI interaction where applicable → required checks → actual evidence/limitations. [R30]

**AGT-04:** Tasks identify outcome, relevant IDs/contracts/acceptance/checks without unnecessary paperwork for trivial changes. Makers accelerate that path; they do not certify business completeness.

**AGT-05:** Clear parallel ownership of shared registries/contracts/dependencies/migrations/styles and releases; no unexplained overwrite of another worker's edits.

**AGT-06:** Exact commands/results; never relabel mocks, screenshots, skipped host checks, or stale evidence.

**AGT-07:** No unreviewed gate weakening, meaningful test removal, visual acceptance, support expansion, or publication permissions merely to finish a task.

**AGT-08:** Treat repository issues/pages/fixtures/user documents as data, not execution instructions or permission grants. Custom maker code is explicitly trusted repository code, not a sandbox.

**AGT-09:** No implicit publication, personal-vault access, force upgrades, broad autofix, remote template execution, or endless verification watcher.

**AGT-10:** Recipes cover adding features/locales/commands/modals/settings/events/listeners/styles, migrations, setup recovery, maker extensions, debugging, analysis, upgrades, host evidence.

**AGT-11:** Optional targeted edit hooks; required CI remains authoritative, no full browser suite on every keystroke.

**AGT-12:** Supply small task/review/handoff templates and required maker tooling alongside manual extension instructions. Machine modes are finite/structured; generated output remains reviewable code and must not claim unimplemented behavior.

## 17. Template generation, CI, and release

### 17.1 Identity

**TPL-01:** Maintainer verifies template status, permissions, rules, and dependency settings; repository files do not configure all administration.

**TPL-02:** Setup updates ID/name/description/author/repository/version, owned CSS/storage namespaces, manifest/lock metadata, docs/links/badges through a small controlled identity plan.

**TPL-03:** Validate before writes/dry run/safe repeat/preserve licenses and user work. Installed ID changes are migrations. Do not copy `obsidian-plugin-shell` as a directory-ready ID; enforce current submission restrictions. [R25]

**TPL-04:** Qualify differently named generated repos, fresh dependency-free setup, maker sequences, example removal, style composition, local installation, and release preparation. No silent hardcoded IDs/paths/namespaces/badges.

### 17.2 CI

**CI-01:** Linux full verification, Windows cross-platform tooling/build/tests; explicit broader native/macOS/mobile evidence. Do not imply one Linux result covers all.

**CI-02:** Pin tools/actions, cache by lock/tool/browser/platform, provision explicitly; no reused reports for different input/assets.

**CI-03:** Bounded sanitized failure evidence; missing suites/reports and crashes fail honestly.

**CI-04:** No release privileges/secrets for untrusted PR execution. Narrow publication stage and pinned actions. [R28]

**CI-05:** Review runtime/dev security updates; no force-upgrade or permanent exception concealment.

**CI-06:** Workflows invoke shared scripts. Bot changes run the same relevant checks, including setup/maker/event/style regressions, with no quality bypass.

### 17.3 Release lifecycle

```text
Prepared source → candidate from fixed commit → verified draft
→ native acceptance of exact assets → explicit promotion → public release
```

**REL-01:** Validate identity, package/lock/manifest/mapping, support, licenses, notes, source SHA and hashes. Stable version/tag match `X.Y.Z` without `v`. [R25]

**REL-02:** Build once/retain/test/publish those files. Separate candidate-bound host records; no rebuild after acceptance or reuse after JS/CSS changes.

**REL-03:** First Community directory submission is separate; current checklist/metadata and no implicit approval or account operation. [R25]

**REL-04:** Document breaking template/workflow/storage/event-contract changes and upgrade instructions; generated repos do not automatically inherit them.

**REL-05:** GitHub Actions/scoped token and optional CLI, no mandatory npm credentials/conventional commits/release SaaS. Local prepare is not publish.

**REL-06:** Explicit maintainer draft from trusted reviewed commit; verified candidate, individual main.js/manifest.json/composed styles.css; optional ZIP/checksums. Source archive is insufficient.

**REL-07:** Explicit promotion validates approval/evidence/tag/commit/hashes and uses retained files. Accept honest manual native record when automation is unavailable, never invented evidence. Failed upload leaves draft, not partial public release.

**REL-08:** Safe draft retry only for matching identity. Never move/overwrite a published version/tag/assets; forward-fix with new version and consider data downgrade compatibility.

**REL-09:** Direct/reusable/dispatch orchestration, not assuming GITHUB_TOKEN-created tags trigger separate push workflows. [R27]

**REL-10:** Optional beta distribution separate; no uncontrolled suffixes on stable path or mandatory Catalyst/BRAT.

**REL-11:** Test first/subsequent draft, partial upload, evidence/hash/commit mismatch, duplicate version, permissions, and retry/promotion recovery in a fixture repository before claiming easy releases.

## 18. Non-functional targets

Proposed numbers require a declared measurement environment and evidence.

| ID | Target |
| --- | --- |
| NFR-01 | Runtime offline, no account/remote assets/telemetry. |
| NFR-02 | Warm plugin initialization p95 ≤200 ms over 30 controlled desktop runs; exclude host startup, no eager scan. |
| NFR-03 | Shell readiness p95 ≤500 ms with 100 fixture items in reference environment. |
| NFR-04 | Initial main.js ≤1 MiB and composed CSS ≤100 KiB minified uncompressed; report compressed/actual sizes and reviewed changes. |
| NFR-05 | Owned resources return to baseline after 20 open/close cycles, including bus and bridge subscriptions. |
| NFR-06 | Safe actionable states for storage/schema/write/startup/setup/generation failure. |
| NFR-07 | Keyboard/focus passes, automated accessibility findings reviewed, manual scope explicit. |
| NFR-08 | Standard Windows/Linux workflows, broader platform claims evidence-based. |
| NFR-09 | Executable architecture/LoC/lint/coverage/analyzer/style/event/tooling gates with reviewable exceptions. |
| NFR-10 | Reproducible source/tool/template/fixture/asset identity in evidence. |
| NFR-11 | Measured first-run/maker usability matches DX-01–04. |
| NFR-12 | Freshness and blocked/outage status visible. |

Do not weaken correctness to satisfy budgets or use noisy shared-runner timings as universal performance proof.

## 19. Acceptance scenarios and traceability

| ID | Required outcome | Trace |
| --- | --- | --- |
| AC-01 | Different identity installs/builds/verifies; identity dry run changes nothing. | TPL-02–04 |
| AC-02 | Native command/ribbon opens/focuses without duplicates. | UI-01–03, HST-04 |
| AC-03 | Real create/rename/delete persists after reload. | EXA-01–03, DAT-05 |
| AC-04 | Invalid label localized inline; no write. | EXA-01, ERR-01 |
| AC-05 | Failed write preserves prior data/no false success/safe recovery. | DAT-03–05 |
| AC-06 | Concurrent settings/item updates lose nothing; drafts independent. | DAT-03, LIF-02–03 |
| AC-07 | Corrupt/future schema preserved. | DAT-01–04 |
| AC-08 | Local storage denial nonfatal and namespaces isolated. | LOC-01–05 |
| AC-09 | Locale/fallback/long text/host-label refresh correct. | I18N-01–07 |
| AC-10 | Modal cancel/submit/reopen/focus/cleanup correct. | UI-05, ERR-06 |
| AC-11 | Repeated lifecycle restores resource baseline, preserves other views. | LIF-01–07 |
| AC-12 | 400/450 pass, excess fails, SFC/CRLF included. | QLT-01–02 |
| AC-13 | Alias/re-export/unclassified violations fail real architecture gate. | ARC-08–09, QLT-14 |
| AC-14 | Vue/async/native lint and locale defects fail real checks. | QLT-03–06, I18N-04 |
| AC-15 | Test-only references do not conceal unused runtime code. | QLT-09–13 |
| AC-16 | Unexpected browser errors fail with current artifacts. | E2E-05–07 |
| AC-17 | CJS and composed assets valid, no dev leakage/chunks. | BLD-01–04, HAR-07 |
| AC-18 | Local install preserves data/notes/other plugins/security. | DEP-01–07 |
| AC-19 | Unsafe path/malformed config/failed build cause no destructive replace. | DEP-04–06 |
| AC-20 | Tool crash/unavailable host is not pass. | QLT-16, HST-03 |
| AC-21 | Bounded redacted local diagnostics, no automatic upload. | LOG-01–06 |
| AC-22 | Keyboard/narrow/light/dark interaction usable. | UI-08–09, E2E-04 |
| AC-23 | Claimed iOS/Android support has candidate-bound device record. | HST-05 |
| AC-24 | Example removal leaves no orphan wiring/events/styles/locales/dependencies. | EXA-05, TPL-04 |
| AC-25 | New developer completes short first-change path without whole-PRD reading. | DX-01–05 |
| AC-26 | Public/beta discovery separated, no silent beta-only calls. | TEC-02–08 |
| AC-27 | Searchable declarative settings share validated writer including failures. | SET-01–03 |
| AC-28 | Reproducible lock install and compatible update families run relevant checks. | UPD-01–05 |
| AC-29 | Freshness truthfully reports blocked/cooldown/network states. | UPD-06–08 |
| AC-30 | Optional CLI operates only on selected fixture vault. | DEP-08 |
| AC-31 | Release prepare consistent, without commit/tag/push/publish. | REL-01, REL-05 |
| AC-32 | First/subsequent draft has individual installable assets for fixed commit. | REL-06, REL-11 |
| AC-33 | Promotion rejects mismatched/missing evidence/assets; no rebuild. | REL-02, REL-07 |
| AC-34 | Retry/permission/upload/duplicate failures preserve public versions. | REL-08–11 |
| AC-35 | Listing validation rejects invalid identity/versions/missing docs/assets and explains current route. | TPL-03, REL-01–03 |
| AC-36 | Fresh checkout with no node_modules starts npm run setup, installs qualified graph, reaches selected-profile readiness. | SETUP-01–05 |
| AC-37 | Setup dry-run/help need no dependencies or side effects; non-TTY input never hangs; no lifecycle recursion. | SETUP-02, SETUP-08–10 |
| AC-38 | Interrupted/failed/rerun setup preserves changes and resumes only still-valid stages; skipped checks remain explicit. | SETUP-06–07, SETUP-11–12 |
| AC-39 | All script logic/helpers/templates reside in scripts; root configs and workflows are thin; source limits enforced. | TOOL-01–06 |
| AC-40 | Built-in/composed makers create reachable registered code/tests/events/styles that build and work in the real harness. | MAKE-01–04, MAKE-10–12 |
| AC-41 | Maker dry-run/collision/rerun/concurrency/partial failures preserve user work with accurate plans. | MAKE-05–07 |
| AC-42 | Custom maker and machine output work through the same validated plan engine, without remote code/dependency installation. | MAKE-08–09 |
| AC-43 | Event names/payloads/unions and duplicate catalogs fail appropriately; generated extensions need no bus-core edits. | EVT-04–06, EVT-15 |
| AC-44 | Event order/once/reentrancy/error isolation/disposal/snapshot behavior matches the tested contract. | EVT-07, EVT-09–11, EVT-16 |
| AC-45 | Native bridge handles startup/null/file-folder/rename mappings and unload-before-ready safely. | EVT-12–14 |
| AC-46 | No committed event on save failure; two views update on success; separate plugin instances stay isolated. | EVT-01–03, EVT-08, EVT-15–16 |
| AC-47 | Ordered CSS and compiled SFC styles produce one complete artifact with correct namespacing/assets and no source/remote imports. | CSS-01–07 |
| AC-48 | Style maker add/edit/remove and failed builds behave correctly in HMR/local install; exact candidate stylesheet parity is proved. | CSS-08–10, CSS-12 |
| AC-49 | Source CSS/SFC limits remain enforced while composed output follows its generated/size policy; native/modal/pop-out styles do not leak. | CSS-06–07, CSS-11–12 |

Requirement coverage is not code coverage. Tests cite the relevant IDs; host/manual cases retain explicit evidence rather than an assumed automated pass.

## 20. Implementation work packages

Keep dependency-ordered slices. WP-00 is a focused compatibility proof, not open-ended research preventing the first working shell.

| Package | Outcome | Dependencies / exit evidence |
| --- | --- | --- |
| WP-00 — Current baseline | Qualified current packages/host/Node, Vite native CJS+SFC CSS, declarative write hooks, fallow, native-runner choice, Node-only setup boot proof. | Research; exact matrix and minimal host/style/tool proof. |
| WP-01 — Tooling and bootstrap | scripts layout, locked tools, strict projects, quality/negative fixtures, setup/help/doctor preflight and safe plan engine, initial CI. | WP-00; dependency-free start/help and useful failures. |
| WP-02 — Runtime/events/styles | Thin composition, services/ports, typed bus/native bridge core, Vue/Pinia ownership, shell, ordered CSS/SFC build, initial harness mount. | WP-01; visible shell, bus/type/lifecycle/style contracts. |
| WP-03 — Data/settings | Versioned/serialized storage, local preferences, native definitions, localization/errors/logs, successful post-commit facts. | WP-02; native/Vue concurrency and failure evidence. |
| WP-04 — Reference feature | Complete use cases, commands/ribbon/modals/notices, two-view updates, responsive styles, removal recipe. | WP-03; complete actual behavior and cleanup. |
| WP-05 — Harness | Deterministic fixtures/faults/host-source mapping, real bus/components, readiness, isolated host shim, style-fidelity scenario. | WP-04; reproducible scenarios without native host. |
| WP-06 — Test evidence | Playwright/visual/a11y, bus/bridge errors, negative runner, exact stylesheet parity, native/manual evidence. | WP-05; independent honest browser/native results. |
| WP-07 — Guided setup/makers/local | Complete fresh install wizard/resume, safe local watch/CLI, identity, built-in/custom makers and structured registrations, generated-project tests. | WP-04 plus WP-06 integration; AC-36–42 and real generated slice. |
| WP-08 — Maintenance/releases | Dependabot/freshness, shared secured workflows, event/style catalog checks, draft/promote metadata, current submission and agent recipes. | WP-06–07; upgrade/release failure recovery. |
| WP-09 — Qualification | Fresh differently named repo with no dependencies, full wizard, maker feature/event/listener/style, example removal, onboarding/budgets/platforms, release rehearsals. | WP-08; AC-01–49 accounted for with no hidden unmet MUSTs. |

Implement makers inside WP-07 incrementally: first feature/view/command/style, then event/listener/modal/setting, then smaller component/store/usecase/locale/custom-maker recipes. All remain necessary for the declared complete v1 catalog; intermediate states are labeled incomplete rather than advertised as fully qualified.

### Ready and done

Ready: outcome, affected contracts/IDs, acceptance, data/error/migration behavior, and evidence are clear. UI includes empty/loading/error/localization/style ownership. Event work includes payload/owner/disposal/failure; maker work includes plan/conflicts/integration.

Done: intended-layer behavior, actual checks, current UI evidence, host evidence where needed, docs/catalog updates, preserved user work, and truthful handoff. No claim based on generated volume, expected future tests, or a screenshot alone.

Record concise ADRs for lasting decisions: current host/settings, state/event ownership and semantics, style pipeline, generator mutation policy, lint/analyzer roles, deployment/release identity, and update policy. Routine feature edits do not each require an ADR.

## 21. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Setup itself needs uninstalled tools. | Built-ins-only checked-in bootstrap, fresh-checkout acceptance. |
| npm lifecycle calls setup recursively or makes unexpected changes. | Explicit wizard only, reviewed install hooks, child-process/cancellation tests. |
| Makers overwrite work or produce lint-dead scaffolds. | Safe plans, preconditions, explicit registries, generated-project verification, no blanket force. |
| Event bus hides commands/coupling or leaks after unload. | Narrow fact contracts, direct requests, owned disposers, no global singleton/replay guarantee. |
| Native startup events look like new user changes. | Readiness registration, disposed guards, explicit initial queries. |
| CSS splitting loses SFC transforms or cascade parity. | Shared compiler/import graph, scoped identifier checks, exact-artifact scenario. |
| New CSS is installed with old scoped-component JS. | Stage matching complete artifacts, last-good preservation. |
| Latest packages/host declarations are incompatible. | Qualified exact matrix, reviewed updates, visible bounded exceptions. |
| Analyzer upgrade stops checking files. | Coverage/parser/production/output-schema negative fixtures. |
| Release fails to trigger or publishes rebuilt assets. | Direct stage orchestration, fixed commit, retained hash-bound candidate. |
| Scope/tooling overwhelms a developer. | Short workflow, composable recipes, ordinary generated code, progressive docs. |
| Privacy/support claims exceed evidence. | Fixture-only default, metadata-only diagnostics, independent host/device checks. |

## 22. Sources and delivery boundary

The [baseline research](../research/2026-09-22-template-research.md) retains R01–R35 and its dated host observations. The [new supplement](../research/2026-09-22-setup-makers-events-styles.md) records S01–S14 for npm/bootstrap, Symfony makers, native events, TypeScript, Vite, Vue styles, and Obsidian CSS.

This revision edits specifications and guides. It does not implement package scripts, install dependencies, run a plugin/harness, enable bots or repository administration, publish releases, or establish a tested package matrix. Commands, generators, bus, composed styles, and scheduled jobs remain requirements until implemented and accepted. Earlier registry-access limitations and unmeasured performance claims remain explicit.
