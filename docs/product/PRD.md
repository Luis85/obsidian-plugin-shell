# Product requirements: Obsidian Plugin Shell

> **Version:** 0.2.0  
> **Updated:** 2026-09-22  
> **Owner:** Luis85  
> **Status:** Implementation specification; repository delivery is documentation only.  
> **Product goal:** A developer can start an Obsidian plugin quickly, develop it confidently, keep it current, and release it without rebuilding the tooling around it.

## 1. Product direction

Obsidian Plugin Shell is a GitHub repository template for maintainable plugins built with TypeScript, Vue 3, and Pinia. It provides a small functioning reference feature, native Obsidian integration, a real-component frontend harness, repeatable quality checks, and a straightforward GitHub release process.

The primary journey is:

```text
Create repository → initialize identity → run the UI → change a feature
→ verify → test in Obsidian → create draft → approve and publish
```

**Current-host policy:** Target the latest public/stable Obsidian, not a historical compatibility framework and not mandatory Catalyst access. Keep dependencies current through controlled updates while retaining reproducible builds.

### 1.1 Required owner constraints

| Area | Contract |
| --- | --- |
| Stack | Vite, Vitest, Oxlint, fallow, TypeScript, Vue 3, Pinia, and `eslint-plugin-obsidianmd`. |
| Foundation | Working settings, durable storage, local preferences, view shell, commands, ribbon, modals, notices, multilingual UI, error handling, logging. |
| Architecture | Domain-oriented clean architecture; composition-only `main.ts`; enforced dependency directions. |
| File size | At most 400 physical lines per handwritten source file and 450 per test/helper file. |
| Agent readiness | Clear instructions, real frontend test tools, reproducible scenarios, and truthful verification evidence. |
| Developer experience | Safe local-vault installation, useful scripts, simple onboarding, and easy release preparation/publication. |
| Maintenance | Latest-stable-first support and an active dependency-update policy, not frozen starter dependencies. |

### 1.2 Interpretation and evidence

MUST requirements are necessary for the complete first template release. SHOULD identifies a preferred implementation with a documented exception path. MAY identifies an optional extension.

Defaults selected by this specification include npm, English/German locales, Vue I18n, Playwright Test, a small example-item feature, GitHub-native dependency/release automation, and a 100-line `main.ts` limit. Numeric performance/coverage targets are product policies, not measured results or vendor requirements.

This revision replaces v0.1 as the current contract while preserving the core requirement identifiers. It simplifies the developer-facing workflow and makes host, dependency, and release decisions explicit. Source references such as [R05] resolve in the [research register](../research/2026-09-22-template-research.md). Practical workflows are detailed in the [developer guide](../development/DEVELOPER-WORKFLOW.md) and [maintenance/release guide](../development/MAINTENANCE-AND-RELEASE.md).

## 2. Users, outcomes, and developer experience

The primary user is a developer starting a new plugin. Coding agents and reviewers are supporting users. The developer must not need to study the entire PRD or configure each tool before changing the example.

**SUC-01:** A newly generated repository with a different identity installs, builds, verifies, and produces release-ready assets without manual path repairs.

**SUC-02:** One supplied feature demonstrates UI → use case → domain validation → persistence → user feedback, including failure paths.

**SUC-03:** UI development and browser verification work without an Obsidian installation, personal vault, AI subscription, or API key.

**SUC-04:** Actual host compatibility is demonstrated separately against the declared supported host; browser success is not substituted for it.

**SUC-05:** Important quality gates have isolated negative fixtures proving that real defects produce failing results.

**SUC-06:** Local rebuilds preserve data, notes, unrelated plugins, configuration, and security decisions.

**DX-01:** The quickstart exposes no more than six primary workflow commands. Advanced commands remain discoverable through `npm run help` and the command reference.

**DX-02:** Setup provides interactive and noninteractive modes, validates identity before writing, has a dry run, and reports the next actionable command. No global npm tooling, Docker, GitHub CLI, or native compiler is required for the standard browser path unless WP-00 demonstrates an unavoidable dependency and documents it.

**DX-03:** A developer can follow one practical first-change recipe using the existing architecture without writing new infrastructure. Proposed usability target: first visible change within 15 minutes of active work after dependencies are available. This must be measured, not claimed in advance.

**DX-04:** Failures explain what failed, where to inspect evidence, and the narrow corrective action. Missing browsers, unsupported Node, blocked ports, malformed identity, and unavailable Obsidian are distinct conditions.

**DX-05:** Documentation separates the generated product's README from template-maintenance guidance. Generated users see their plugin identity, not an upstream template pitch or broken badges.

## 3. Scope and boundaries

The first complete release includes the working reference plugin, quality/tooling configurations, test harness, documentation, safe local installation, identity initialization, dependency maintenance configuration, CI, and draft/promote release workflows.

The default runtime remains mobile-compatible by design. Real-device acceptance is required before declaring mobile support. Desktop and mobile public release numbers are tracked independently.

Not included: an in-plugin AI runtime; cloud telemetry; authentication; business ERP features; Bases views; a canvas engine; a dependency-injection framework; generic repositories or event buses without a demonstrated need; SSR; npm-library publication; mandatory Storybook/Histoire; a mandatory MCP server; or support for every historical Obsidian version.

A normal plugin feature must not require creating factories, ports, events, and wrappers for every pure function. Use architecture to isolate real dependencies and business invariants, not to multiply files mechanically.

## 4. Research-informed changes

| Area | Decision in v0.2 |
| --- | --- |
| Latest Obsidian | Public/stable is the default; Catalyst is optional early warning. Record app, API declarations, installer/runtime, and mobile targets separately. |
| Native settings | Declarative `getSettingDefinitions()` only; custom read/write hooks use the application preference service. No unnecessary pre-1.13 fallback. |
| Dependencies | Exact direct versions plus lockfile, updated through reviewed PRs. Dependabot default; Renovate alternative, never both. |
| Quality tooling | Prefer fallow's built-in boundary coverage where supported rather than inventing a second import analyzer. |
| Native feedback loop | Optional official CLI reload/screenshot wrapper restricted to the configured development vault. |
| Release | Prepare metadata locally, create a candidate/draft from a fixed commit, then publish the same accepted artifacts. |
| Listing | Current Community directory submission process, with a specific first-submission checklist. |
| Simplicity | Small primary command set and a concrete first-change recipe; no mandatory release-management service or AI account. |

The reference projects contribute useful build, harness, composition, and local-deployment patterns. They are not copied wholesale, and their selected-file review was not a full audit. Research and source limitations are documented in section 22.

## 5. Technology, host compatibility, and dependency freshness

### 5.1 Tool ownership

| Tool | Responsibility |
| --- | --- |
| TypeScript + `vue-tsc` | Strict checking of runtime, Vue SFCs, tests, harness, and tooling projects. |
| Vite + Vue plugin | Separate native-plugin and browser-harness builds. |
| Vue 3 / Pinia | Typed presentation components and explicitly owned view state. |
| Vitest + Vue Test Utils | Domain, use-case, adapter-contract, component, and tool-gate tests. |
| Playwright Test | Browser behavior, visual comparison, accessibility integration, failure traces. |
| Oxlint | Fast supported correctness/quality rules. |
| ESLint + Obsidian/Vue plugins | Complementary host, Vue-template, and typed rules. |
| fallow | Production/development reachability, dependencies, duplication, complexity, boundaries. |
| Vue I18n | One localization service for Vue and native surfaces. |
| npm / GitHub Actions | Reproducible installation, orchestration, CI, maintenance, release operations. |

Use one formatter. Do not add a second browser runner, package manager, persistence plugin, or build system without an actual unmet requirement.

### 5.2 Latest-stable host contract

**TEC-01:** Maintain a machine-readable compatibility record containing tested exact tool versions, Node/npm, Obsidian application and API versions, installer/runtime details relevant to support, browser binaries, platforms, verification date, and evidence references. WP-00 establishes the first record.

**TEC-02:** A fresh template baseline selects the newest publicly released desktop Obsidian as its initial `minAppVersion`. The research snapshot is **1.13.7**; re-resolve public releases during implementation rather than treating this dated value as permanent. Older releases are not supported merely because code happens to compile against them. [R01, R02]

**TEC-03:** Use stable-supported current APIs. The declarative settings API is selected; do not maintain the legacy imperative settings tab for pre-1.13 compatibility. API declarations newer than the supported app do not authorize using early-access-only functionality. [R05, R06]

**TEC-04:** Bundle required runtime libraries. Keep Obsidian and genuinely host-provided modules external. Test/build/agent tooling must not enter the runtime dependency graph.

**TEC-05:** Runtime code MUST NOT require Node/Electron to work when mobile support is declared. Desktop development scripts may use Node. Merely externalizing a desktop-only import does not make it portable.

**TEC-06:** Choose build syntax targets and runtime APIs separately. Do not assume the development Node version or the newest desktop Chromium describes iOS/Android WebViews. No hidden remote polyfill or asset dependency is allowed.

**TEC-07:** Test latest public desktop. If a downstream project deliberately retains an older minimum, also test that fixed minimum; do not silently promise every historical version. The template advances its baseline through an explicit compatibility PR after new public releases. Ordinary dependency PRs do not silently raise an existing product's minimum host version.

**TEC-08:** Catalyst testing is optional, isolated, and nonblocking for public-host support unless it reveals a defect affecting that supported scope. The normal workflow requires no Catalyst entitlement.

### 5.3 Dependency policy

**UPD-01:** Select the latest compatible stable candidates during implementation, save exact direct dependency versions, commit one npm lockfile, and use `npm ci` for ordinary installation. Do not resolve floating `latest` on every verification run. [R22]

**UPD-02:** Default to the currently supported Active LTS Node track; the dated research selection is Node 24. Pin the tested patch in developer/CI setup, declare the supported engine range, and keep them synchronized. Evaluate a new Active LTS through a toolchain PR; do not advertise all future Node majors. [R15]

**UPD-03:** Ship Dependabot configuration for npm and GitHub Actions with frequent update checks and bounded PR volume. Group compatible families; review major updates explicitly. A documented Renovate replacement is allowed, but both bots must not manage the same dependencies. [R23, R24]

**UPD-04:** Proposed routine cooldown: three days for patch/minor candidates and seven for majors. Security remediation bypasses the routine waiting policy after targeted review. Cooldown is risk management, not evidence that an update is safe.

**UPD-05:** Every update runs the relevant full verification, including gate fixtures when analyzers/parsers/build tools change. Automerge is disabled by default. Optional low-risk patch automerge requires enforced checks and excludes host-floor, schema, release, and policy changes. No dependency merge automatically publishes the plugin.

**UPD-06:** A weekly/on-demand freshness job checks public Obsidian/API changes, direct dependency lag, Node support, and action pins. It reports current, cooling down, update available, incompatible, blocked, or source unavailable. It must not turn registry/network failures into a clean bill of health.

**UPD-07:** Track incompatible updates with a reason, owner, and review date. Proposed maintenance targets: review routine compatible updates within seven days after eligibility and assess major updates within fourteen days. Do not indefinitely ignore majors or weaken tests merely to claim currency.

**UPD-08:** Keep update discovery online and separate from offline-capable normal verification after provisioning. Review transitive/security lockfile changes too; a direct-dependency version badge alone is not the maintenance strategy.

## 6. Architecture and extension model

### 6.1 Dependency direction

```text
presentation → application → domain → shared
infrastructure → application contracts / domain / shared
bootstrap → concrete adapters and presentation factories
main.ts → minimal host lifecycle and bootstrap
```

Domain-oriented features live within the explicit layers. The target shape is `src/{bootstrap,domain,application,infrastructure,presentation,shared,locales,styles}`, plus separate `harness/`, `tests/`, `scripts/`, and `docs/`. Add directories when exercised, not as empty architectural decoration.

**ARC-01:** `main.ts` is composition/lifecycle only and at most 100 physical lines. It contains no feature algorithms, persistence transformations, locale dictionaries, or component markup.

**ARC-02:** Bootstrap only constructs dependencies, registers capabilities, and coordinates ownership. Moving business logic into a large bootstrap class is not compliance.

**ARC-03:** Domain/application have no Obsidian, Vue, Pinia, browser, Node, Electron, or concrete infrastructure imports. Inject nondeterministic time/IDs where behavior needs them.

**ARC-04:** Inner capabilities own the ports they actually need. Use explicit factories/arguments, not hidden global service locators. Pure computation need not acquire an artificial interface.

**ARC-05:** Presentation calls application contracts and handles presentation state. It never directly saves plugin data, accesses the vault/localStorage, or constructs native notices.

**ARC-06:** Host adapters receive mounting/notification/application interfaces; bootstrap wires concrete views/components. Cross-layer construction must not spread through feature files.

**ARC-07:** Feature internals are private to the feature; cross-feature work uses small application contracts. `shared` contains only genuinely neutral primitives, not displaced business logic.

**ARC-08:** Enforce resolved dependency directions for aliases, re-exports, type imports, supported dynamic imports, and Vue SFCs. Every analyzed runtime source file is classified. Prefer configured fallow boundary coverage; supplement only demonstrable gaps. [R12]

**ARC-09:** Production code cannot import harness, tests, fixtures, scripts, or agent tooling. Artifact checks independently reject development leakage.

**ARC-10:** Favor cohesive modules, explicit names, narrow public contracts, and concise TSDoc for extension points. Avoid speculative generic repositories, buses, inheritance frameworks, and excessive indirection.

## 7. Lifecycle and state ownership

**LIF-01:** One runtime owns plugin-wide services and durable repositories. Failed initialization disposes already-created resources and does not present a successful load.

**LIF-02:** Each view owns its Vue app, Pinia instance, drafts, selection, and disposable resources. Closing a view cannot destroy another view's state or shared services.

**LIF-03:** Canonical data belongs to application/repository services. Multiple views subscribe through a small typed contract with explicit unsubscribe ownership; Pinia is not the durable database.

**LIF-04:** Every mount, subscription, timer, observer, listener, and asynchronous effect has a cleanup owner. Repeated open/close/disable/re-enable must not accumulate handlers. Pay particular attention to effects created after asynchronous work. [R17]

**LIF-05:** Use the supplied plugin `app` and supported host registrations. Do not retain a singleton custom-view instance or manually detach workspace leaves during unload. [R07]

**LIF-06:** Use an element's owning document/window for pop-outs, modal placement, resize, and theme handling. Test main-window and pop-out lifecycles.

**LIF-07:** No eager whole-vault scan, unsolicited note seeding, or hidden Vue mount at startup. Save important changes during normal operation; do not depend on the host awaiting asynchronous unload work.

## 8. Working feature and native UI

### 8.1 Removable example

**EXA-01:** Supply create, rename, and delete for a small example item with stable ID and a trimmed label of 1–120 characters. Keep user text in its original language.

**EXA-02:** Show meaningful empty, populated, pending, invalid-input, persistence-failure, and recovered states. Failure never produces false success.

**EXA-03:** Demonstrate the full application path with real behavior, not disconnected sample buttons.

**EXA-04:** The feature creates no vault note, performs no network call, and makes destructive actions deliberate. Cancel means no write.

**EXA-05:** Provide and test a removal recipe that removes the example's registrations, components, tests, and locale keys while retaining reusable infrastructure. `template:init` must not force every downstream plugin to keep the sample indefinitely.

### 8.2 Native surfaces

| ID | Capability | Required behavior |
| --- | --- | --- |
| UI-01 | View shell | Small header/action area, main content, status/error states, and discoverable help/settings entry. No unnecessary dashboard chrome. |
| UI-02 | Commands | Open/focus shell, create item, and appropriate diagnostics action; stable local IDs, localized labels, correct callback type, no default hotkeys. |
| UI-03 | Ribbon | One localized accessible entry to the same open-shell behavior, not a second implementation. |
| UI-04 | Settings | Native declarative definitions using the shared preference service; localized labels, validation, searchable settings, current values, truthful save failures. |
| UI-05 | Modals | Native modal adapter for the example form and confirmation; focus, labels, cancellation, pending/error state, and cleanup. Use suitable current native controls before reimplementing them. |
| UI-06 | Notices | Central outcome-to-feedback policy. Field validation is inline; repeated errors are deduplicated. |
| UI-07 | Multiple leaves | Default open focuses a suitable existing leaf; explicit new-view and restored views remain independent. |
| UI-08 | Styling | Scoped classes, semantic host variables, light/dark modes, narrow panes; no global reset or hardcoded theme colors. |
| UI-09 | Accessibility | Keyboard operation, visible focus, semantic controls, labels, non-color-only feedback, adequate touch targets, reduced-motion respect. |

**SET-01:** Implement `getSettingDefinitions()`; keep it cheap and free of I/O because host search/indexing may call it outside visible rendering. Refresh through the supported update mechanism. [R05, R06]

**SET-02:** Implement typed/allowlisted `getControlValue` and `setControlValue` adapters when routing settings to application storage. The write override owns validation, ordering, persistence, and error handling; no competing default autosave path. Avoid arbitrary dot-path mutation. [R05]

**SET-03:** Use native settings as the canonical full preference editor. A Vue feature may expose an appropriate contextual preference, but must reuse the same service rather than maintain a duplicate settings subsystem.

Use Composition API and compiled SFCs. Components do not mount independent copies of application services. Tests deliberately select real versus stubbed Pinia actions; the testing helper's default stubbing is not used as proof that application behavior ran. [R18]

## 9. Persistence

| Data | Backing owner | Examples |
| --- | --- | --- |
| Durable plugin document | Versioned repository over `loadData` / `saveData` | Preferences and example records. |
| Local UI preferences | Namespaced host local-storage adapter | Nonessential last section/display choices. |
| Ephemeral state | Per-view Vue/Pinia | Drafts, focus, selection, modal visibility. |
| Vault documents | Future feature-specific adapter | Not required by the example. |

**DAT-01:** Treat stored payloads as `unknown`, validate structure, then construct typed values. Casts are not validation.

**DAT-02:** Include schema version and ordered tested migrations. Reopening migrated data is stable. Unknown future schemas are not overwritten by older code.

**DAT-03:** One coordinated writer updates the combined durable document. Concurrent native settings and item changes cannot overwrite each other's successful updates using stale snapshots.

**DAT-04:** Distinguish absent data, corrupt data, access failure, and unknown schema. Preserve unreadable data; never silently save defaults over it. Recovery/reset is explicit and scoped.

**DAT-05:** Claim durability only after successful persistence. Pending/error state must be visible where meaningful; cancellation/invalid input causes no write.

**DAT-06:** Persist during normal operation. Debounced writes, when justified, have tested flush/cancel ownership. An unload-only flush is insufficient.

**DAT-07:** Storage is not advertised as encrypted secret storage. The template needs no credentials.

**LOC-01:** Production local preferences use vault-specific `App.loadLocalStorage` / `saveLocalStorage` behind a port with plugin-prefixed, versioned keys. [R09]

**LOC-02:** Only the harness adapter uses browser `localStorage` directly, with separate fixture/test namespaces.

**LOC-03:** Test absent/malformed values, serialization, quota/denial, migration, deletion, and safe in-memory fallback. Respect the host API's value semantics rather than assuming it returns a JSON string.

**LOC-04:** Reset only owned keys; never call global storage clear.

**LOC-05:** Test two plugin identities and fixture vaults for isolation. Explain that local preferences are not portable/synchronized durable data.

## 10. Localization

**I18N-01:** Ship English/German with English fallback. All template-owned visible text and accessibility labels, including native surfaces, use catalogs.

**I18N-02:** One translation service based on Vue I18n serves Vue and native adapters. Do not build a competing native translation engine. [R35]

**I18N-03:** Resolve explicit plugin language, then supported host-language mapping, then fallback, using supported host APIs.

**I18N-04:** Check key completeness, interpolation parameters, plural handling, and locale-aware formatting. Never translate user content or stable identifiers.

**I18N-05:** Update mounted UI on locale changes. Refresh host-registered labels only through supported APIs; otherwise clearly disclose reload requirements.

**I18N-06:** Test both locales, longer text, fallback, and development-only pseudo-localization. English sentence-case lint must not incorrectly reject German or other languages. Prefer logical CSS properties so future RTL adoption does not require layout rewrites.

**I18N-07:** Provide safe untranslated fallbacks for localization initialization failures; no recursive error/translation loop.

## 11. Error handling, privacy, and logging

**ERR-01:** Expected validation/cancellation/storage outcomes have typed results. Unexpected exceptions are normalized from `unknown` at appropriate boundaries. Do not wrap every trivial function merely to force a result abstraction.

**ERR-02:** Failures identify a stable code, category, operation, and recoverability; user text comes from safe localized messages, not arbitrary exception strings.

**ERR-03:** Observe async failures from commands, settings, ribbon actions, modals, startup, and subscriptions. `void` alone is not error handling.

**ERR-04:** Offer the relevant recovery action. Retry only operations whose safety/idempotency is understood.

**ERR-05:** Vue error boundaries supplement, not replace, explicit host/async handling. Do not suppress global errors from Obsidian or other plugins.

**ERR-06:** One primary notification per failure; coordinate inline feedback, notices, and diagnostics.

**LOG-01:** Inject a structured logger; raw console usage is confined to the approved sink and developer scripts.

**LOG-02:** Default production console output is error-only; diagnostics verbosity is opt-in. [R07]

**LOG-03:** Bound local diagnostic memory; initial limits are 200 entries and 256 KiB retained payload, including field-size truncation.

**LOG-04:** Use allowed diagnostic fields. Exclude note content, paths, user labels, secrets, and arbitrary object dumps; redact stack/cause details before export.

**LOG-05:** Export is explicit, local, and previewable. No telemetry/network sink ships in the plugin.

**LOG-06:** Expected negative tests use narrow expected-error contracts. Browser tests fail on unexpected console/page errors.

Render user content safely; never compile untrusted templates or use unsafe HTML injection for ordinary labels. [R31]

## 12. Frontend harness and agent tools

The harness renders the shipped components, application services, domain logic, stores, and plugin styles. Only host boundaries change. It is a bounded simulation, not Obsidian itself.

**HAR-01:** Supply Vite dev and built/preview modes; required browser tests use the built harness.

**HAR-02:** Bind loopback, use synthetic data, do not expose personal vaults, and do not launch a GUI automatically in headless execution.

**HAR-03:** Production/harness composition injects adapters into the same contracts. Document mocked behavior and omissions; test adapter contracts separately.

**HAR-04:** Select scenario, locale, theme, viewport profile, and deterministic seed through documented parameters. Expose observable application readiness, not arbitrary sleeps.

**HAR-05:** Control clock, IDs, storage namespace, and declared faults. Isolate tests while allowing deliberate reload-persistence cases.

**HAR-06:** A typed harness-only control API lists/resets scenarios, injects declared faults, waits for readiness, and reads redacted diagnostics. It exposes no arbitrary filesystem, shell, or evaluation endpoint.

**HAR-07:** Build checks prove all harness globals, mocks, fixtures, fault injection, and agent endpoints are absent from the plugin.

**HAR-08:** Reuse plugin CSS with an owned minimal host-variable/layout shim. Mark approximations. Do not redistribute copied host/theme assets without verified rights/provenance.

**HAR-09:** Browser modal/settings/notice adapters validate application-facing behavior, not native host internals. Native acceptance covers the real implementations.

**HAR-10:** Include two-view and repeated-mount scenarios using real stores and shared canonical services.

Required scenario families: empty/populated, validation, durable reload, native-preference contract, write failure/recovery, corrupt/future schema, local-storage denial, localization, multiple views, lifecycle, responsive light/dark, and keyboard/focus. Reuse fixtures instead of copying application logic.

**E2E-01:** Playwright CLI is the canonical frontend automation entrypoint. Use roles/names or stable documented test IDs, auto-waiting assertions, and observable outcomes.

**E2E-02:** Exercise success/failure, cancellation, persistence, localization, ownership, and unexpected browser errors with real application actions.

**E2E-03:** Keep a small reviewed visual baseline set on a pinned OS/browser/font/viewport environment. CI never accepts its own changed screenshots. [R20]

**E2E-04:** Combine automated accessibility checks with keyboard/focus tests and manual review; do not claim certification from a scanner.

**E2E-05:** Retain readable/machine-readable results, screenshots, traces, and relevant logs on failure, with bounded retention.

**E2E-06:** Evidence names source SHA/worktree state, build hashes, tool/browser versions, scenario, locale/theme, and seed. Missing or stale evidence is not success.

**E2E-07:** An isolated intentionally failing fixture proves assertion/page errors fail the actual runner. Test server ownership/readiness too; do not reuse an unrelated stale CI server. [R19]

Optional Playwright/fallow MCP configurations are development conveniences only. Use limited permissions, synthetic fixtures, and a dedicated browser context. Review mutating tool capabilities explicitly; never characterize an entire MCP integration as read-only without checking it. [R34]

## 13. Test strategy and host evidence

| Layer | Evidence |
| --- | --- |
| Domain/application | Pure behavior, validation, concurrency, migrations, and failure mapping in Vitest. |
| Adapter/component | Shared contracts, native boundary fakes, Vue public behavior, intentional Pinia action mode. |
| Browser | Real-component flows, focus/layout, visual baselines, accessibility, disposal. |
| Tooling | Actual negative fixtures for LoC, architecture, lint, locales, manifests, analyzer output, releases. |
| Artifact | Native-loader shape, required files, dependency/external policy, no development leakage. |
| Real host/device | Registration, native settings/modal/notice, reload, pop-out/restore, persistence, claimed mobile behavior. |

**HST-01:** Test the current public desktop target and the declared minimum when different. Record the exact installed candidate artifact, host, installer/runtime, platform, and results.

**HST-02:** Prove a pinned native runner during WP-00; `wdio-obsidian-service` is the selected candidate, not an official Obsidian guarantee. Keep a documented manual acceptance path. [R21]

**HST-03:** Ordinary `verify` needs no Obsidian. `test:obsidian` reports missing provisioning as not run; release promotion requires host evidence. Build candidate before collecting hash-bound evidence, not after it.

**HST-04:** Real-host checks cover load/disable/re-enable, commands/ribbon, searchable native settings, invalid input/write failure, modal focus/cancel, notices, multiple leaves, pop-outs, restored state, restart persistence, and install preservation.

**HST-05:** Before declaring mobile compatibility, exercise the release candidate on supported current iOS and Android hosts. Record mobile app versions separately. Browser emulation is not mobile-host proof. No mobile claim is inferred from Linux CI.

**HST-06:** Use a disposable fixture vault and explicit provisioning; do not redistribute Obsidian binaries or use personal credentials/vault data. Document any test-runner setup that enables a plugin inside its own isolated sandbox; do not apply it to a developer's arbitrary vault.

## 14. Quality policy

### 14.1 Physical line limits

**QLT-01:** Count all physical lines, including comments/blanks and the entire Vue SFC. A terminal newline adds no extra content line; CRLF/LF are equivalent. Empty files count zero.

| Classification | Limit |
| --- | ---: |
| `src/main.ts` | 100 |
| Other handwritten runtime, harness implementation, scripts, and styles | 400 |
| Test specifications/helpers, including genuine colocated tests | 450 |

Machine data, Markdown, lockfiles, generated outputs/declarations have explicit separate treatment. They cannot hide handwritten executable logic. Production imports of test-classified files are forbidden. Inspect uncommitted/new relevant files too.

**QLT-02:** Fixtures prove 400/450 pass and 401/451 fail, including SFCs, CRLF, comments, blanks, and terminal-newline behavior. Do not use a script-only SFC count.

### 14.2 Type/lint/coverage/analysis

**QLT-03:** Strictly type-check runtime, Vue, tests, harness, and tooling. Handle indexed access/optional values explicitly. No unchecked `any` or unsafe casts just to accommodate mocks.

**QLT-04:** Run Oxlint and complementary ESLint/Vue/Obsidian checks with no unapproved warnings. Assign rule ownership deliberately; do not disable checks in both tools. [R10, R11]

**QLT-05:** Proposed new-code limits: cyclomatic complexity 10 and cognitive complexity 15 where the selected analyzer supports them. Document metric scope; do not fragment cohesive functions merely to game counts.

**QLT-06:** Fixtures exercise Vue script/template parser coverage, template-used bindings, supported TS extensions, async callbacks, and modern native settings rules.

**QLT-07:** Proposed coverage floors over production code including untested files: global lines/statements/functions 90%, branches 85%; domain/application 95%, branches 90%. Type-only/generated code may be excluded explicitly. Native-only limitations require narrow evidence-backed exceptions, not excluding entire layers for a better percentage.

**QLT-08:** Critical behavior tests remain mandatory regardless of percentages: failed/concurrent writes, corruption/future schema, cancellation, cleanup, namespace isolation, validation.

**QLT-09:** Pin fallow, use its installed schema, and declare genuine plugin/harness/test/script entrypoints. Do not mark every source file as an entry to conceal dead code. [R32]

**QLT-10:** Run complete repository and production-scoped analysis. Block unjustified unused runtime files/exports/dependencies, cycles, boundary violations, and unresolved configured errors. Test-only use does not automatically justify shipped code. [R13]

**QLT-11:** Full verification checks the full required scope. Changed/new-only feedback is additional, not the release gate.

**QLT-12:** Proposed duplication limit: 3% production source, initial minimum clone 50 tokens/5 lines when supported. Validate exact metric/schema during WP-00. Report repetitive tests/fixtures separately to avoid forcing unreadable test abstractions.

**QLT-13:** Account for documented static-analysis limitations and dynamic host registration. No automatic deletion/fix mode during verification. [R33]

**QLT-14:** Prefer fallow `boundaries.coverage.requireAllFiles` plus explicit zone rules, validating against the pinned schema. Test unclassified files, aliases, re-exports, forbidden packages, and production/test boundaries. Add custom enforcement only for a demonstrated tool gap. [R12]

**QLT-15:** Every suppression/exception identifies scope, reason, owner, and review condition. Do not copy legacy project baselines. Gate reductions and baseline acceptance are review-sensitive changes.

**QLT-16:** Reports distinguish passed, failed, not run, and infrastructure error, with command/tool/scope/exit status. Tool crashes or unknown output schema cannot become zero findings.

**QLT-17:** Negative fixtures execute in isolated temporary projects and assert child failure. They cannot contaminate normal source analysis or recursively run all verification.

## 15. Build and developer workflows

### 15.1 Artifact contract

**BLD-01:** Produce `dist/main.js` as tested Obsidian-loadable CommonJS, plus `dist/manifest.json` and `dist/styles.css`. Native export/loader compatibility must be proved, not inferred from a filename.

**BLD-02:** Bundle required runtime dependencies and owned assets. No CDN, dev server, hidden source path, unintended dynamic chunk, or bundled host API. Preserve required third-party license notices.

**BLD-03:** Development maps are debuggable; release map policy is explicit. No secrets or sensitive absolute paths leak into artifacts.

**BLD-04:** Validate identity/version/minimum host, package/lockfile/manifest consistency, release mapping, and asset hashes. The product is a plugin application, not an npm library: no declaration bundle, package publishing, or `vite-plugin-dts` is required.

### 15.2 Safe codebase-local testing

**DEP-01:** Default vault: `.dev-vault/` inside the repository, with installation at its configured config directory's `plugins/<id>/` path.

**DEP-02:** Support an explicit repository-root vault mode, such as validated `--vault .`, and a custom config directory. Host code uses the host's actual config-directory value.

**DEP-03:** Copy only allowlisted generated assets. Preserve `data.json`, unrelated files/plugins, notes, settings, and security preferences. Never clean a vault/repository root as a build output directory.

**DEP-04:** Validate IDs, path containment, symlinks, and explicitly allowed targets; normalization alone is insufficient. Supply dry run.

**DEP-05:** Validate/stage complete artifacts before replacing the installed set. Failed watch builds preserve the last good install; concurrent deployment is detected. Recovery leaves useful diagnostics.

**DEP-06:** Enabling the plugin in a developer fixture vault is explicit/additive. Malformed configuration is an error, not an empty list. Never turn off Restricted Mode automatically for the human development workflow.

**DEP-07:** Print destination, identity, build hashes, and any required human action. Ignore generated vault/build files in Git.

**DEP-08:** Offer an optional official CLI reload/screenshot wrapper. It requires an explicitly configured fixture vault, installed/enabled compatible CLI, and appropriate running host. Missing CLI is a documented fallback, not a blocker for browser development. Never reload a personal vault implicitly. [R08]

### 15.3 Command contract

These are future implemented commands, not executable functionality in this documentation-only repository.

The quickstart promotes six npm workflows: **setup, dev:ui, dev:local, verify, release:prepare, help**, preceded by `npm ci`. Native publication is an explicit GitHub Actions step. Keep existing useful aliases; do not duplicate their implementation.

| Command | Contract |
| --- | --- |
| `setup` | Guided identity initialization + environment checks; noninteractive flags and dry run; browser provisioning explicitly opt-in. |
| `help` / `doctor` | Discover workflows; report exact prerequisites, safe configuration, and actionable failures. |
| `template:init` | Low-level identity operation used by setup. |
| `dev:ui` / `harness:dev` | Same loopback real-component harness with HMR; no Obsidian required. |
| `dev` | Native plugin build watch without implicit deployment. |
| `dev:local` | Successful builds installed to approved local vault, with optional explicitly enabled CLI reload. |
| `build` / `build:dev` | Validated production/development artifact builds. |
| `build:local` / `test-build` | Same safe local build/install implementation. |
| `typecheck` / `lint` / `format:check` | Full configured scope; finite, non-mutating checks. |
| `lint:fix` / `format` | Explicit local mutation only, never invoked by verification. |
| `test` / `test:watch` / `test:coverage` | Finite default suite, explicit watch, measured coverage. |
| `test:setup` | Explicit browser/native test prerequisite provisioning; document network and disk needs. |
| `test:gates` | Isolated negative enforcement fixtures. |
| `harness:build` / `harness:preview` / `harness:shot` | Build, serve, or capture a specified scenario with metadata. |
| `test:e2e` | Required built-harness browser flows, reviewed visuals, accessibility checks. |
| `test:obsidian` | Provisioned native suite or truthful unavailable/not-run result. |
| `check:loc` / `check:architecture` / `check:i18n` / `check:docs` | Focused discoverable checks, composed by verification. |
| `analyze` / `analyze:production` / `analyze:changed` | Full analysis, production scope, optional incremental feedback. |
| `verify:fast` | Clearly partial finite type/lint/architecture/LoC/unit feedback. |
| `verify` / `check` | Same complete ordinary verification: static, coverage, gate fixtures, docs, build, browser. No native-host assumption. |
| `quality:report` | Render actual current evidence, including missing/failed states. |
| `deps:status` / `security:audit` | Explicit online freshness and vulnerability review; not hidden in offline verification. |
| `release:prepare -- --version X.Y.Z` | Validate/update release metadata and changelog transactionally; dry run; no implicit commit/tag/push/publication. |
| `verify:release -- --candidate <path>` | Validate a candidate and its source/hash-bound host evidence without silently rebuilding it. |
| `release:check` | Explain local/remote release prerequisites and listing readiness; optional online checks are explicit. |

Use cross-platform Node scripts, bounded command runtimes, owned child processes, and no shell-specific copy/delete assumptions. New scripts are justified by a workflow, not by a desire to wrap every tool flag.

## 16. Agent operating model

**AGT-01:** Root `AGENTS.md` is concise, points to commands/architecture, and links detailed rules. A developer or agent reads only relevant sections. [R29]

**AGT-02:** Provider-specific files are thin adapters, not competing copies of policy. AI accounts are optional.

**AGT-03:** Workflow: inspect relevant contracts/code → plan a small change → implement and test → interact with the real UI for UI changes → run required checks → report evidence and limitations. [R30]

**AGT-04:** Tasks identify outcome, requirement IDs, affected layers, acceptance cases, and verification commands. A first-change recipe demonstrates this without mandatory process paperwork for trivial edits.

**AGT-05:** Parallel work has explicit file/contract ownership. Dependencies, migrations, shared config, and releases have one integration owner.

**AGT-06:** Report exact commands and actual outcomes. Never relabel mocks, screenshots, skipped host tests, or stale reports as stronger evidence.

**AGT-07:** Agents do not weaken gates, delete meaningful tests, accept visual baselines, expand support claims, or enable publication privileges merely to finish a feature.

**AGT-08:** Treat issues, pages, fixtures, and user documents as untrusted data, not executable instructions or permission grants.

**AGT-09:** No implicit publishing, personal-vault access, force upgrades, unrestricted autofix, or autonomous long-running watcher in a verification task.

**AGT-10:** Provide focused recipes for feature/locale/command/modal changes, migrations, browser debugging, fallow findings, dependency upgrades, and host evidence.

**AGT-11:** Optional edit hooks run targeted checks; CI remains authoritative. Do not run the entire browser suite after every edit.

**AGT-12:** Supply a small task/review/handoff template. A feature generator is optional only after the manual extension recipe proves useful; do not generate unused scaffolding.

## 17. Template generation, CI, and release

### 17.1 Identity and onboarding

**TPL-01:** Maintainer setup explicitly verifies GitHub template status, Actions permissions, dependency settings, and repository rules. Files alone do not configure those administration settings.

**TPL-02:** Setup handles ID/name/description/author/repository/version, owned CSS/storage namespaces, manifest, lockfile metadata, links/badges, and generated product documentation. Prefer a small identity definition over uncontrolled text replacement.

**TPL-03:** Validate before writes; dry run; safe repeat; preserve license terms and user changes. Changing an installed plugin ID is a migration. The template repository name is not a default valid distributable ID: reject `obsidian` in an ID intended for directory submission. [R25]

**TPL-04:** Test a differently named generated repo and the example-removal recipe through build/verify/install/release preparation. No stale template IDs, paths, namespaces, or badges survive unexpectedly.

### 17.2 CI

**CI-01:** Required Linux job runs full ordinary verification; Windows checks cross-platform tooling/build/tests. Broader host/macOS/mobile coverage has an explicit matrix and evidence policy. No unsupported claims from one Linux run.

**CI-02:** Pin action revisions and tested tools; cache by lockfile/tool/browser/platform. Provision explicitly. Do not reuse reports from a different source or artifact.

**CI-03:** Preserve useful sanitized failure evidence with bounded retention. Missing required reports/suites and tool crashes fail honestly.

**CI-04:** Untrusted PR builds receive no release secrets or publication permission. Avoid privileged execution of PR content. Release mutation belongs in a narrowly privileged stage. [R28]

**CI-05:** Review runtime and development security updates. No uncontrolled force upgrade or permanent exception to hide an advisory.

**CI-06:** Required workflows remain reusable through documented commands. Dependency updates run the same relevant checks as feature changes; no bot-only quality bypass.

### 17.3 Release lifecycle

```text
Prepared source → candidate built from fixed commit → verified draft
→ host acceptance for exact assets → explicit promotion → public release
```

**REL-01:** Validate manifest/package/lockfile/version mapping, IDs, support claims, license notices, release notes, asset names, source SHA, and SHA-256 hashes. Stable release version and tag are exactly `X.Y.Z`, without `v`. [R25]

**REL-02:** Build the candidate once, then retain and test those assets. Host evidence is stored separately from source metadata and refers to the candidate hashes. Publishing cannot rebuild a different candidate or accept evidence from another commit.

**REL-03:** First-time listing is a separate maintainer workflow using the current Community directory process. Produce a submission checklist and metadata summary. Never imply that creating a GitHub release automatically approves the first listing. [R25]

**REL-04:** Document template upgrade instructions and breaking workflow/storage changes. Generated repositories do not automatically inherit upstream template changes.

**REL-05:** Default release automation uses GitHub Actions and its scoped repository token, with GitHub CLI where appropriate. It requires neither npm publication credentials nor a mandatory conventional-commit/release-management service. Local preparation does not publish.

**REL-06:** A maintainer-dispatched draft workflow validates a trusted source commit, builds/verifies the candidate, and uploads individual `main.js`, `manifest.json`, and `styles.css` assets. An optional ZIP/checksum manifest is additional. No source-only GitHub archive substitutes for plugin assets.

**REL-07:** A separate explicit promotion action verifies evidence, asset hashes, expected tag/commit, and approval before publishing. If native automation is unavailable, accept a documented maintainer-supplied host record for that candidate; never fabricate one. Failed uploads/checks leave no partially published release.

**REL-08:** Re-running a draft operation is safe only for the same source/artifact identity. Existing published versions/tags/assets are never overwritten or moved. Correct released defects with a new version; handle old-schema rollback compatibility explicitly.

**REL-09:** Invoke release stages directly or through supported dispatch/reusable workflows. Do not depend on a `GITHUB_TOKEN` tag push starting a separate push-triggered workflow. [R27]

**REL-10:** Pre-release/beta distribution is optional and documented separately. Do not blindly put semver suffixes into a stable manifest or make Catalyst/BRAT a prerequisite for ordinary releases.

**REL-11:** Template qualification exercises first draft, subsequent version, incomplete upload, missing evidence, wrong hashes/commit, duplicate version, token permission failure, and promotion recovery in a fixture/test repository before advertising one-click releases.

## 18. Non-functional requirements

Initial quantitative targets are proposals requiring measurement in a declared environment.

| ID | Target |
| --- | --- |
| NFR-01 | Runtime works offline without account, remote assets, or telemetry. |
| NFR-02 | Warm plugin initialization p95 at most 200 ms over 30 controlled reference-desktop runs; exclude host startup and avoid eager vault scans. |
| NFR-03 | Shell ready p95 at most 500 ms with 100 fixture items on the reference environment. |
| NFR-04 | Initial budget: minified uncompressed main.js at most 1 MiB, CSS at most 100 KiB; report actual/compressed sizes and justified changes. |
| NFR-05 | After 20 view open/close cycles, owned resource counts return to baseline. |
| NFR-06 | Corrupt/future data, unavailable storage, failed writes/startup produce safe actionable states. |
| NFR-07 | Required keyboard/focus checks pass; automated accessibility findings are reviewed; manual scope remains explicit. |
| NFR-08 | Standard development commands work on Windows/Linux; macOS and native/mobile support claims reflect actual evidence. |
| NFR-09 | Architecture, LoC, lint, coverage, and analyzer gates are executable and reviewable. |
| NFR-10 | Source/tool/fixture/build identity is reproducible and included in evidence. |
| NFR-11 | Quickstart/first-change onboarding meets the measured DX-01–04 usability targets. |
| NFR-12 | Dependency/host freshness is visible; outages or blocked upgrades are not described as up to date. |

Performance budgets do not justify brittle shared-runner timing gates or weakening correctness. Establish controlled benchmarks before using them as release blockers.

## 19. Acceptance scenarios

The original AC-01–24 outcomes are retained; v0.2 adds developer, maintenance, current-settings, and release cases.

| ID | Acceptance outcome | Main trace |
| --- | --- | --- |
| AC-01 | Different generated identity installs/builds/verifies; dry run makes no changes. | TPL-02–04 |
| AC-02 | Real-host command/ribbon opens/focuses the view without duplicate registration. | UI-01–03, HST-04 |
| AC-03 | Valid create/rename/delete persists after reload through real services. | EXA-01–03, DAT-05 |
| AC-04 | Invalid label produces localized inline feedback and no write. | EXA-01, ERR-01 |
| AC-05 | Failed write preserves prior data, reports no success, and supports safe recovery. | DAT-03–05 |
| AC-06 | Concurrent settings/item updates lose no successful changes; two views retain independent drafts. | DAT-03, LIF-02–03 |
| AC-07 | Corrupt/future schema is preserved without default overwrite. | DAT-01–04 |
| AC-08 | Local storage denial is nonfatal; plugin/vault namespaces stay isolated. | LOC-01–05 |
| AC-09 | Locale switch, long text, fallback, and host-label reload behavior are correct. | I18N-01–07 |
| AC-10 | Modal cancellation, submission, reopen, focus, and cleanup are correct. | UI-05, ERR-06 |
| AC-11 | Repeated view/plugin lifecycle returns resources to baseline and preserves other views. | LIF-01–07 |
| AC-12 | Exact 400/450 LoC boundaries pass and excess fails, including full SFC/CRLF. | QLT-01–02 |
| AC-13 | Alias/re-export/unclassified-file violations fail the real architecture gate. | ARC-08–09, QLT-14 |
| AC-14 | Vue/async/native-lint and locale defects fail the appropriate real checks. | QLT-03–06, I18N-04 |
| AC-15 | Test-only references do not conceal unused production exports. | QLT-09–13 |
| AC-16 | Unexpected browser error/assertion failure produces failure and current artifacts. | E2E-05–07 |
| AC-17 | Built assets load correctly and contain no harness/dev tools/unintended chunks. | BLD-01–04, HAR-07 |
| AC-18 | Local install preserves existing data, notes, other plugins, and security settings. | DEP-01–07 |
| AC-19 | Unsafe path, malformed config, or failed build causes no destructive replacement. | DEP-04–06 |
| AC-20 | Tool crash/unavailable host reports error/not-run, never pass. | QLT-16, HST-03 |
| AC-21 | Diagnostics remain bounded/redacted and never upload automatically. | LOG-01–06 |
| AC-22 | Keyboard/narrow/light/dark interactions remain usable. | UI-08–09, E2E-04 |
| AC-23 | Claimed iOS/Android support has candidate-bound device evidence. | HST-05 |
| AC-24 | Removing the example leaves no orphan wiring, translations, tests, or dependencies. | EXA-05, TPL-04 |
| AC-25 | A new developer completes the short quickstart/first-change recipe without reading the whole PRD. | DX-01–05 |
| AC-26 | Public/beta host discovery is separated; no beta-only API is silently used on stable. | TEC-02–08 |
| AC-27 | Native declarative settings are searchable, validated, and use the shared writer, including failed writes. | SET-01–03 |
| AC-28 | Lockfile install is reproducible; update PRs refresh coherent tool families and execute relevant checks. | UPD-01–05 |
| AC-29 | Freshness reports blocked/cooldown/network-failure states honestly; majors are not indefinitely hidden. | UPD-06–08 |
| AC-30 | Optional CLI operations affect only the selected development vault and fail safely when unavailable. | DEP-08 |
| AC-31 | Release preparation changes metadata consistently without tagging/pushing/publishing. | REL-01, REL-05 |
| AC-32 | First/subsequent draft releases contain individually installable assets for the specified commit. | REL-06, REL-11 |
| AC-33 | Promotion rejects missing/mismatched host evidence or changed assets; accepted assets are not rebuilt. | REL-02, REL-07 |
| AC-34 | Duplicate/retry/permission/upload failures are recoverable without overwriting a public version. | REL-08–11 |
| AC-35 | Listing readiness rejects an invalid ID, version/tag mismatch, missing assets/license/docs, and explains the current submission route. | TPL-03, REL-01–03 |

Tests identify their applicable IDs; the matrix is requirement coverage, not a replacement for measured code coverage.

## 20. Implementation work packages

Implement bounded slices. WP-00 remains necessary, but should be a focused compatibility proof, not open-ended research before a developer sees a working shell.

| Package | Outcome | Dependencies / exit evidence |
| --- | --- | --- |
| WP-00 — Current baseline | Resolve latest stable packages/host; prove Vite native loading, declarative settings write hooks, fallow coverage, Node/toolchain, native-runner choice. | Research; exact matrix and minimal working host proof. |
| WP-01 — Tooling and first-run path | npm/strict TS, build/test/lint/fallow/LoC configs, negative fixtures, help/doctor, identity setup skeleton, initial CI. | WP-00; new checkout gets clear actionable results. |
| WP-02 — Runtime and visible shell | Thin composition, services/ports, Vue/Pinia ownership, native view/registrations, initial browser mount. | WP-01; visible real shell and lifecycle tests. |
| WP-03 — Data and current settings | Versioned storage, serialized writer, host local preferences, declarative settings, localization, errors/logging. | WP-02; concurrent native/Vue writes and failure tests. |
| WP-04 — Example feature | Complete create/rename/delete, commands/ribbon, native forms/notices, responsive/accessibility states. | WP-03; complete use-case path, removal recipe. |
| WP-05 — Harness | Deterministic scenarios, real adapters/components, readiness API, stylesheet shim, loopback safety. | WP-04; all required scenarios reproducible. |
| WP-06 — Frontend/native evidence | Playwright flows/visuals/accessibility, negative runner tests, host runner/manual acceptance, candidate metadata. | WP-05; trustworthy browser and separate native results. |
| WP-07 — Local workflow and generation | Safe staged vault install, last-good watch, optional CLI, full setup identity, generated-repo tests, first-change documentation. | WP-04 and WP-06 integration; DX/local safety acceptance. |
| WP-08 — Maintenance and releases | Dependabot/freshness, secured reusable CI, metadata preparation, draft/promote stages, submission checklist, concise agent recipes. | WP-06–07; update and release failure/recovery tests. |
| WP-09 — Template qualification | Fresh generated project, example removal, measured onboarding/size/performance, platform claims, first/subsequent release rehearsal. | WP-08; AC-01–35 evidence and no hidden unmet MUSTs. |

### 20.1 Ready and done

A task is ready when outcome, affected contracts, acceptance, data/error behavior, and evidence are clear. UI tasks include empty/loading/error/localization; persistence tasks include schema and migration impact.

Done means intended-layer implementation, actual passing required checks, current browser evidence for UI work, appropriate native evidence for host-sensitive behavior, documentation updates, and an honest handoff. Neither generated code volume nor assumed test success is completion.

Record concise architecture decisions for durable choices, particularly current-host support, settings persistence ownership, view ownership, lint/analyzer roles, release identity, and update policy. Do not require a new ADR for ordinary feature implementation.

## 21. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Too much tooling obstructs the first feature. | Short primary workflow, progressive documentation, native controls, real example, no speculative frameworks. |
| Latest dependencies do not work together. | Exact candidate matrix, reviewed family updates, explicit blocked status, no unsafe peer overrides. |
| App/API/installer/mobile versions are confused. | Separate recorded values and real stable-host/device evidence. |
| Declarative settings bypass the shared document writer. | Custom storage hooks and interleaving/failure acceptance tests. |
| Harness differs from actual Obsidian. | Narrow contracts, documented mock boundaries, separate native checks. |
| Analyzer upgrade silently stops checking files. | Boundary coverage, parser/production negative fixtures, output schema validation. |
| Release workflow never triggers after bot tag creation. | Direct/reusable/dispatch orchestration, tested permissions/events. |
| Rebuild after acceptance changes the release. | Candidate manifest and hash-bound promotion of retained assets. |
| Installation or reset loses user data. | Contained fixture vault, staged allowlist writes, explicit recovery, no silent config reset. |
| Dependency or release automation grants too much access. | Least privilege, no publication from untrusted PR jobs, explicit approval. |
| Template docs or dependency checks become stale. | Visible dated source records, scheduled freshness, owner/review date for exceptions. |

The baseline decisions are made: latest public Obsidian, npm/Active LTS, current declarative settings, Dependabot default, GitHub draft/promote releases, browser-first development. WP-00 validates the exact implementations and versions rather than reopening every product decision.

## 22. Sources and delivery boundary

The [research report](../research/2026-09-22-template-research.md) records the primary sources, dated host snapshot, reference-file observations, alternatives, and uncertainty. Its R01–R35 identifiers are the citations used in this contract.

This revision is based on live repository reads and web research. It did not install the toolchain, implement a plugin, run browser/native/device tests, enable repository administration settings, activate dependency bots, or publish a release. Direct npm registry access was insufficient to establish a verified all-package patch matrix; WP-00 must supply it.

Documented commands, scheduled jobs, support targets, and release capabilities are requirements until their implementation and acceptance evidence exist. Research freshness is not runtime compatibility proof.
