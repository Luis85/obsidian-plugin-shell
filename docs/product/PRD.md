# Product requirements: Obsidian Plugin Shell

> **Version:** 0.5.0  
> **Updated:** 2026-09-22  
> **Owner:** Luis85  
> **State:** Specification plus an implemented, isolated host-stylesheet specimen. The plugin runtime, setup/makers, full harness, and release automation are not implemented yet.

## 1. Product direction

Provide an approachable, current Obsidian plugin baseline: obtain the template, run guided setup, generate a useful first feature, develop in a real-component browser harness and the native host, verify, then publish the exact accepted assets.

This revision strengthens errors/notifications and frontend evidence, adds original host-style fixture assets, and reviews the complete product from developer, end-user, UX, accessibility, architecture, quality, data integrity, privacy, performance, maintenance, and release perspectives. It does not add a notification-center product or another general-purpose framework.

### Normative structure and preservation

The exact previous specification is preserved as [BASELINE-0.4.md](BASELINE-0.4.md), using its original blob `eb6e37ed128c6bbe6a2eba895729d2643c8cfb3e`. Its numbered requirements, command contracts, work packages and AC-01–62 remain incorporated here. No previous requirement is deleted by shortening this front door.

Historical version/status text and dated research snapshots in that baseline are not current capability claims. The current status above and this revision's explicit refinements take precedence. The companion contracts below remain normative. New error/notification and harness-style requirements refine the prior generic rules; they do not weaken data safety, architecture, or release evidence.

| Contract | Scope |
| --- | --- |
| [Baseline requirements](BASELINE-0.4.md) | Existing core requirements, AC-01–62, WP-00–09. |
| [Setup and makers](../development/SETUP-AND-MAKERS.md) | TOOL-01–06, SETUP-01–12, MAKE-01–12. |
| [Typed events](../architecture/EVENT-BUS.md) | EVT-01–16. |
| [Modular styles](../architecture/STYLES.md) | CSS-01–12. |
| [Document creation](../architecture/DOCUMENT-CREATION.md) | DOC-01–20. |
| [Errors and notifications](../architecture/ERRORS-AND-NOTIFICATIONS.md) | Adds ERR-07–18 and NTF-01–12. |
| [Harness styles and evidence](../testing/HARNESS-STYLES.md) | Adds HSS-01–12. |

## 2. Users and success

The developer should not need to study the full specification before a first change. Agents and reviewers use the same commands and architecture. End users receive native-feeling, local-first functionality with honest outcomes and actionable recovery.

Retain SUC-01–06 and DX-01–05. A successful generated repository must actually install/build/verify, not merely contain extensive documentation. Setup and maker readiness remain pending. A standalone stylesheet page is useful but is not a completed first plugin feature.

## 3. Scope and capability status

| Capability | State after this revision |
| --- | --- |
| Current product/architecture/developer contracts | Specified and reviewed. |
| Original modular host stylesheet | Implemented as isolated fixture source. |
| Static/style specimen with interactive controls | Implemented; no real plugin business behavior. |
| Loopback fixture server and focused Node tests | Implemented; seven tests executed successfully in the editing environment. |
| ErrorService/NotificationService and integrated captured-defect observer | Specified; not implemented. |
| Vue/Pinia plugin, DocumentCreationService, typed bus | Specified; not implemented. |
| Fresh-checkout npm setup/make/full verify | Specified; no package.json/toolchain yet. |
| Full Vite/Playwright/native harness | Pending. |
| Host/device compatibility and release acceptance | Not run. |

All previous requested capabilities remain in scope. No OS push notifications, cloud telemetry, persistent notification inbox, distributed tracing, generic retry platform, full theme emulator, or automated user-note migration is added.

## 4. Product review

The [review report](../reviews/2026-09-22-product-review.md) records twenty findings against baseline commit `c62303e1d60a77b1496ed06f7142e1952dcf78c0`, their changes, actual evidence and unresolved runtime work.

The most consequential findings are the distinction between specified and implemented capabilities; fragmented notification ownership; committed versus uncertain mutation outcomes; captured Vue defects escaping browser-only error checks; missing original host styling; and the risk of a static specimen being mistaken for native compatibility.

## 5. Stack, compatibility and updates

TEC-01–08 and UPD-01–08 remain required: Vite/Vitest/Oxlint/fallow/TypeScript/Vue 3/Pinia/Obsidian ESLint, one formatter/package manager, latest compatible stable dependencies, exact qualified lockfile, current public Obsidian target, and explicit update PRs.

No version matrix was established by the fixture tests. Node 22.16.0 and Chromium 144 used for the bounded review are environment observations, not new supported-version policies. Resolve exact current stable candidates in WP-00. Optional Catalyst coverage is not a standard-development prerequisite.

## 6. Architecture

Retain ARC-01–10 and the direction:

```text
presentation → application → domain → shared
infrastructure → application contracts / domain / shared
bootstrap → concrete adapters and view factories
main.ts → minimal lifecycle and composition
```

Expected failures are application data; translation, native notices and DOM belong to presentation/adapters. Introduce one shared feedback coordinator around real user operations, not arbitrary new Notice calls throughout domain/services/components. The harness uses the same failure/notification policy, substituting only supported host sinks.

## 7. Lifecycle

LIF-01–07 remain. Views own Vue/Pinia and local disposables; the runtime owns canonical services and the typed bus. Add explicit ownership for notification handles, timers, action callbacks, diagnostic observers and in-flight completion guards.

Closing a view is neither cancelling a committed write nor dismissing another plugin's notices. Unload disposes only owned resources. No global host error suppression or notice-container sweep.

## 8. UI, recovery and notifications

EXA-01–05, UI-01–10 and SET-01–03 remain. Use a predictable surface policy: validation beside fields; durable recovery in the owning form/view; bounded optional native notices; one updating progress state; no error alert for cancellation before mutation.

NTF-01–12 define kind, ownership, localized messages, deduplication, update/dismiss behavior, timers, accessibility, actions, and native/harness adapters. The public Notice API does not automatically supply a severity-aware queue, action framework, or targetable notification manager. Qualify those template behaviors explicitly.

## 9. Data and documents

DAT-01–07, LOC-01–05 and DOC-01–20 remain unchanged in intent. Markdown is canonical for note-backed entities. Creation uses the existing prepare/commit pipeline and stable submission identity, with no silent overwrite or uncertain-write retry.

Feedback preserves effect facts. A created document whose open action fails stays created; the offered retry is open, not create. A lost/uncertain create response stays uncertain until reconciled. Listener and notification failures cannot roll back a committed operation.

## 10. Localization and accessibility

Retain I18N-01–07 and prior accessibility requirements. Localized feedback includes native notices, recovery actions, field errors, and accessible labels. Stable operation/error codes are not translated. User values never become executable HTML or template code.

Use polite status announcements for routine updates and alerts selectively. Essential recovery is not only in an expiring toast. A modal requires actual focus/inert/keyboard behavior; a CSS backdrop or aria-modal attribute alone is insufficient. The specimen's German option translates its demo messages only and does not claim a complete localized application.

## 11. Error and diagnostic contract

ERR-01–06 and LOG-01–06 are retained and extended by ERR-07–18. Key additions: canonical effect-aware outcomes, single feedback ownership, safe retry capabilities, Vue containment with independent test observability, reporter-failure fallback, pre-buffer redaction, and honest degraded mode.

No console-only success signal or empty catch may conceal an unexpected defect. Production can show a useful fallback while tests still fail through an independent captured-defect ledger. Expected fault scenarios must assert exact code/scope/count, including that the intended fault actually occurred.

## 12. Harness and stylesheet

HAR-01–10/E2E-01–07/CSS-01–12 remain and are clarified by HSS-01–12. The original `harness/styles/obsidian.css` supplies scoped semantic tokens and native-like controls/settings/overlays through five modules. It is separate from generated plugin styles.css and excluded from release artifacts.

Reports identify one of three modes: standalone style specimen, integrated real-component harness, or native candidate. Fast HMR shares style sources; release-fidelity tests use exact composed plugin CSS and matching compiled Vue identifiers. None may conceal missing plugin CSS under added shim rules.

## 13. Test strategy

Keep all existing unit/application/adapter/component/bus/document/browser/tooling/artifact/native tests. Add independent captured-error and notification-lifecycle assertions, missing-host/plugin-style negative cases, host-model provenance, and exact-error-count scenarios.

Focused fixture tests delivered now establish only their declared scope. Full real-component and native tests still need implementation. Required cases can be assigned to core and targeted profiles rather than an unnecessarily exhaustive Cartesian matrix, but every required behavior must be covered. Missing evidence is not pass.

## 14. Quality policy

QLT-01–17 remain: source/CSS/tooling 400 physical lines, tests/helpers 450, main.ts 100, complete SFC count, strict types, complementary linters, full/production fallow, actual negative fixtures, and reviewed exceptions. Composed build output keeps its separate size/provenance policy.

The fixture source and server obey those limits. Its Node tests are temporary dependency-free qualification for the bounded stylesheet delivery; integrate them into the selected existing test projects when the real toolchain is implemented. Do not add a competing permanent test framework.

## 15. Commands and current executable scope

All intended npm command contracts in baseline section 15 remain pending. No package.json is invented just to make a documentation-led repository appear operational.

These two focused commands are implemented now:

```sh
node scripts/harness/serve-style-fixture.mjs --port 4174
node --test tests/harness-styles/server.test.mjs
```

The first serves a fixed allowlist on loopback for manual specimen inspection and terminates on SIGINT/SIGTERM. The second runs seven finite tests. They do not initialize a plugin, install packages, create notes, or satisfy full verify.

All tooling stays in scripts; host CSS and specimen code stay in harness. The proper native Vite build still composes plugin source CSS/SFCs into one styles.css; it never packages the original host shim.

## 16. Agent workflow

AGT-01–12 remain, with evidence labels made explicit. Agents use the same error/notification helpers and maker rules, not locally invented success patterns. They cannot hide a caught defect by deleting the observer, muting the ledger, accepting screenshots, or widening expected errors.

The short README and current PRD are entrypoints; read detailed contracts only for the task. Reference the retained numbered requirements rather than copying the complete baseline into every provider file.

## 17. Template, maintenance and releases

TPL-01–04, CI-01–06 and REL-01–11 remain. First setup, generated-repository qualification, current dependencies and native acceptance still need implementation. Fixture source/server/report assets are never part of a plugin distribution.

Release promotion consumes fixed source and accepted JS/CSS/manifest hashes. Fixture checks are not native evidence. A shim update or a changed plugin stylesheet invalidates the relevant visual comparison; neither is an excuse to rebuild a different candidate after acceptance.

## 18. Non-functional requirements

NFR-01–13 remain proposed targets until measured in the qualified environment. Error/notification contracts add bounded queues/actions/timers/diagnostics, no notification storms, and zero orphan owner resources after cleanup. Suggested progress/expiry/queue defaults are documented policies to qualify, not upstream Obsidian guarantees.

No blanket claims of WCAG conformance, pixel equivalence to native Obsidian, future-host compatibility, or cross-device write guarantees are made from this specimen.

## 19. Acceptance and traceability

AC-01–62 are preserved byte-for-byte in the baseline. This revision adds twenty cases, bringing the specified total to 82:

| ID | Required outcome | Trace |
| --- | --- | --- |
| AC-63 | Canonical failures preserve category, safe identity and actual effect state across layers. | ERR-07–09 |
| AC-64 | Invalid fields receive associated persistent guidance without one toast per field. | NTF-02, NTF-06 |
| AC-65 | Same operation updates one progress/terminal notification; independent attempts stay distinct. | NTF-01, NTF-03–04 |
| AC-66 | Uncertain writes never expose an unsafe create retry; committed/open-failed exposes only safe follow-up. | ERR-09–11, NTF-10 |
| AC-67 | Reporter/translator/sink failure is bounded, nonrecursive, and does not falsify the operation. | ERR-13–14, NTF-07 |
| AC-68 | A contained Vue/render defect still fails an ordinary browser scenario through the independent ledger. | ERR-12, ERR-15, HSS-08 |
| AC-69 | Expected-fault scenarios reject missing faults, unexpected extra faults and ledger overflow. | ERR-15, HSS-08–09 |
| AC-70 | Notice burst/dedup/expiry/dismiss obey bounds without losing essential recovery or test evidence. | NTF-04–05, NTF-11 |
| AC-71 | View/runtime disposal removes owned handles/actions/timers, preserving other views/plugins. | NTF-03, NTF-10–11 |
| AC-72 | Keyboard, focus, live announcements and persistent recovery work in the declared environment. | NTF-06–09 |
| AC-73 | Native Notice capability/targeting/timer limitations are modeled without private API assumptions. | NTF-07–08 |
| AC-74 | Host-style fixture is original, scoped and provenance-labeled; no copied app.css/fonts or release inclusion. | HSS-01–02, HSS-11 |
| AC-75 | Missing host CSS, missing plugin CSS, wrong scope identifiers or accidental shim packaging fail checks. | HSS-06–07 |
| AC-76 | Light/dark/narrow/long-text/forced-color/reduced-motion cases have explicit mode and evidence. | HSS-04–05 |
| AC-77 | CSS-only specimen cannot be reported as a real native/Vue/service test. | HSS-03, HSS-05 |
| AC-78 | Host comparison records actual host/runtime/style/build identity and remains unverified when not run. | HSS-01, HSS-06 |
| AC-79 | Makers reuse canonical error/notification policy and provide failure/cleanup tests. | ERR-16, POL-04 |
| AC-80 | Freshness/release evidence excludes fixture-only success and preserves all previous safety requirements. | POL-01, REL-02, HSS-12 |
| AC-81 | Loopback specimen server rejects arbitrary paths/writes and serves declared assets with safe headers. | HSS-11–12 |
| AC-82 | Complete required scenario coverage is finite and does not recursively regenerate test projects. | POL-05–06 |

“Specified total” is not a passing-test count. The review reports actual executed checks separately.

## 20. Implementation packages

WP-00–09 retain their baseline dependencies and outcomes. Integrate this pass into them rather than add a parallel project:

| Package | Refinement |
| --- | --- |
| WP-00/01 | Qualify current tools/native APIs, establish truthful readiness, incorporate focused fixture tests. |
| WP-02/03 | Implement shared failure/outcome handling, notification sinks and owner lifecycle with real services. |
| WP-04 | Demonstrate success, validation, uncertain write and committed-with-follow-up-error in existing examples. |
| WP-05/06 | Mount real Vue/components using original host CSS; captured-error observer, negative fidelity tests, native comparison. |
| WP-07 | Generate the same error/notification/style patterns, with failure and cleanup tests. |
| WP-08/09 | Upgrade/release rehearsal retains scope-bound evidence and exact candidate assets. |

A first-working developer milestone may precede complete template qualification; label it honestly. Every previously required complete-v1 capability remains required.

## 21. Polishing rules and risk control

**POL-01:** Current capability tables and handoffs distinguish specified, implemented, locally tested, native-verified and released. Never promote status based on documentation alone.

**POL-02:** Preserve numbered requirements rather than rewriting their entire text every iteration. Use one current entrypoint and focused normative companions; historic baseline status is not current.

**POL-03:** Keep the starter small: no notification inbox, theme engine, distributed error platform or new generic framework. Reuse current boundaries and policies.

**POL-04:** Generated code follows canonical feedback/ownership paths and existing quality gates. No scaffold-local exceptions, new log sinks, or global emitters to make it pass.

**POL-05:** Map all required scenarios to explicit core/targeted/native profiles. Avoid redundant full Cartesian runs, but never skip required coverage silently. Record environment and mode.

**POL-06:** Template-qualification tests run isolated generated repositories using a finite project selection. They do not recursively regenerate themselves. Scope the generator-of-generators test explicitly while retaining all generated runtime checks; no quiet blanket skip.

See the review for remaining implementation risks and priorities. The main outstanding risk is still the distance between a specification and a working fresh-checkout workflow.

## 22. Sources and evidence

The [new research register](../research/2026-09-22-reliability-harness-review.md) records Vue error behavior, native Notice API, accessible feedback, Playwright evidence and stylesheet guidance. Earlier R/S/D sources remain with the baseline/companions.

The [review record](../reviews/2026-09-22-product-review.md) contains exact bounded checks and environment limitations: the HTTP server was tested using Node, while administrator-blocked browser loopback navigation required inline specimen rendering for Chromium checks. No native/plugin/toolchain/full-harness claim follows from that test mode.
