# Workbench MVP — operational boilerplate quality requirement

> Type: reference · Part of the [docs index](../README.md)

> **Requirement:** MVP-QR-01 · **Version:** 1.0 · **Date:** 2026-09-29
> **Authority:** Owner-directed mandatory MVP quality requirement, not an optional enhancement.
> **Change baseline:** PR #5, `docs/companion-plugin-prd`, `40799d9489e0bd436a47f819732292e8a35a4774`.
> **Implementation status:** Requirement recorded; runtime implementation and acceptance are not established by this document.

## 1. Required outcome

**Workbench MUST generate a fully operational boilerplate for the selected target. Every designed interaction in that output MUST include the mock data, fixtures and executable behavior needed for users to experiment with and test the application immediately after the documented build/start steps. Replacing the simulation with an actual backend, including a C# or Java application, MUST NOT require rewriting the generated UI.**

The first usable result is an interactive application with coherent state, not a navigation skeleton, screenshot gallery, static dataset or collection of TODO handlers. A missing production backend is not a reason to disable a designed action in the demonstration.

This requirement tightens the [MVP plan](MVP-IMPROVEMENT-PLAN.md) and [acceptance scenarios](MVP-VISION-ACCEPTANCE.md). It supplements MVP-13–18/23/24 and [design constraints](../../DESIGN-CONSTRAINTS.md) DC-UX-05, DC-GEN-02/05/06 and DC-ARC-01/06. Where earlier prose permits an unavailable business action or a reference-only result, that cannot satisfy acceptance for an interaction included in the selected design. Historical evidence remains historical; this amendment does not retroactively qualify earlier artifacts.

## 2. Scope and important distinctions

**Selected target** includes its runtime, frontend choice and artifact profile. A webapp must run as a webapp; an Obsidian plugin must also be tested in the actual isolated host. A browser preview cannot substitute for native acceptance. The same rule applies to every target combination advertised as supporting the selected design, not only to the small reference projects.

**Every designed interaction** includes page/component controls, navigation, forms, commands, dialogs, data operations and applicable host actions within the reviewed output scope. Disabled-by-design states are valid scenarios; disabling an action because its implementation or backend is missing is not. Pure UI actions need a reproducible state/navigation fixture, not an unnecessary fake API or independent database.

**Fully operational in demonstration mode** means real UI logic and real changes to isolated simulated state. It does not assert production persistence, real identity verification, real payment/delivery, or complete domain logic. Mock outcomes must remain visibly identified as simulated. Missing semantics must produce an actionable modeling/generation blocker; the generator must not silently invent product decisions or omit the interaction to improve a coverage count.

**Backend integration** here means connecting or serving the generated web UI through a language-neutral service boundary. C# and Java are backend integration examples, not new promises to generate WPF, JavaFX, native desktop UI, or arbitrary complete business servers. Host-specific Obsidian operations retain their native adapters. Both backend reference examples below are required integration evidence; their exact framework versions are selected and pinned during implementation.

The complete native Workbench still needs actual authoring persistence and lifecycle acceptance under CP-010. Simulated consumer data is an addition, not permission to replace Workbench's own save/reopen behavior with a mock. Existing generation/install/launch/publication approvals and framework-first delivery gates remain intact.

## 3. Mandatory acceptance clauses

### BQ-01 — Ready to build, start and demonstrate

The generated project MUST include all required source, configuration, fixtures, handlers, styles/assets, tests and build/start instructions. After the disclosed prerequisites and explicitly approved dependency/build steps, the developer can launch the selected target in demo mode without installing a production backend, database, AI provider or account, creating sample data manually, copying source from the maintainer checkout or repairing generated files.

The existing first-run choice MUST offer this demo path with preloaded scenarios. Declining first run still starts no processes. Build, launch, interaction acceptance and production readiness remain separate states. Record time to first usable demonstration and manual interventions; do not invent a promised duration before measuring it.

### BQ-02 — Complete interaction-to-fixture coverage

The compiler MUST derive an inventory from the selected canonical design, including shared dependencies and applicable host interactions. Each interaction references its stable ID, originating page/component/journey, preconditions, handler/action contract, input/state fixture, applicable scenarios, expected visible result, state changes and executable acceptance tests.

Fixtures MAY be shared across interactions; each interaction must declare the dependency rather than carrying contradictory private copies. A component fixture composes into the surrounding application's scenario. Fixture-only pages detached from the generated application do not qualify.

Every included interaction MUST have an executable normal path and its applicable alternative/failure cases. A lifecycle guard or legitimate unavailable state must also have a scenario demonstrating the intended reason. An unsupported interaction, missing handler, absent fixture or broken reference blocks the complete-boilerplate readiness claim. An explicitly partial export remains partial and cannot be called MVP-complete.

### BQ-03 — Stateful, coherent mock behavior

Mocks MUST implement the observable contract, not just return success. For a designed create/edit/delete workflow, validate the submitted values, update one isolated application-owned mock state, and reflect the result in subsequent detail/list/count/filter views. Respect declared relationships, ordering, pagination, validation and optimistic-version/conflict behavior where designed.

Cancel must leave committed mock state unchanged. Failed mutations must not appear as successful commits; optimistic changes require the specified rollback/reconciliation. Navigation, modal return, selection and drafts follow actual UI semantics. Do not duplicate these behaviors in separate mock-only pages.

For external effects such as uploads, messaging or transactions, provide the designed progress/result/error interaction with synthetic assets and isolated simulated outcomes. Never perform the external effect in demo mode or label a simulated effect as real. This is explicit scenario behavior, not inferred production business logic.

### BQ-04 — Useful, deterministic and editable scenarios

Ship realistic synthetic, schema-valid datasets with consistent identifiers and relationships. Include populated and empty states; applicable validation, loading/delay, not-found, permission-denied, conflict and service-failure scenarios; and recovery/retry behavior where designed. Numeric/date/null/enum boundaries and long content must exercise relevant controls. Avoid an unbounded Cartesian product: record why each scenario is applicable or not applicable to each interaction.

Provide named scenario selection and a reset-to-seed action without source editing. Pin the seed, clock and identifier sequence when they affect results. Reset cancels or isolates pending work so that late responses cannot repopulate a cleared scenario. Default demo state is session-scoped; any opt-in persistence must disclose lifetime, namespace and reset semantics and remain isolated from live data.

Datasets and scenario parameters MUST be inspectable and editable as validated project data. Ordinary data changes must not require edits to UI source. The standalone offline preview embeds the selected data at build time; rebuilding that artifact after editing its inputs is acceptable and must be documented. Data imports do not execute scripts or arbitrary handler expressions.

### BQ-05 — Safe demonstration and truthful modes

Demo mode MUST work without production services and MUST NOT make live business/API, telemetry, personal-vault or provider calls. The built offline preview must operate with network disabled; interactive mocks cannot depend solely on a service worker, CDN or local server unavailable to a file-origin artifact. Target-native demo operations must remain behind isolated adapters; explicit real-host qualification runs separately in the approved scratch vault.

Show the active mode and scenario. Selecting integration mode requires explicit configuration; absent credentials or an unavailable server must fail visibly, never silently fall back to mock success. Switching mode must discard/isolate demo state and pending responses, not upload fixtures or mix synthetic and live records. Production packaging must exclude demo datasets/scenario controls or enforce an equally reviewable build-time exclusion; UI hiding alone is insufficient. No credentials belong in portable settings, fixtures or generated bundles.

### BQ-06 — One UI with replaceable adapters

Generated pages/components and application logic MUST depend on typed application/data-source ports, not on concrete mock stores or backend-specific classes. Bootstrap/configuration selects a mock adapter, an HTTP/service adapter, or the applicable native-host adapter. Both mock and service adapters implement the same observable request/result/error semantics, including asynchronous completion and cancellation where supported.

No page should contain backend-origin branching or direct fixture imports. A custom backend can require an adapter implementation or DTO mapper, but that work must be confined to documented, developer-owned integration boundaries. For a conforming backend, switching requires configuration/composition only; the UI and feature behavior remain unchanged. Preserve adapters, custom tests and fixture overrides during regeneration.

### BQ-07 — Language-neutral API contracts

For interactions that cross an HTTP backend boundary, deliver a versioned OpenAPI document and typed client contracts, request/response examples and contract tests. Pure navigation and native-only operations need no invented HTTP endpoints. Specify operation IDs, methods/paths, inputs, validation errors, result/error shapes, pagination/filter/sort semantics and the authentication integration boundary where applicable.

Make serialization explicit: identifier representation, nullable versus absent fields, date/time/time-zone handling, decimals and integers beyond the client-safe range, enums and concurrency tokens. Provide boundary test vectors so a C# or Java implementation does not depend on accidental JavaScript conventions. Do not imply that JSON Schema alone captures stateful business semantics.

Keep one reviewed authority for wire contracts. Generated types, fixtures, docs and clients must identify their source/version and detect drift. Existing backends may supply the accepted contract or use an explicit mapper; Workbench must not rewrite their API silently. Pin an OpenAPI dialect/toolchain supported by the chosen validators and clients; availability of a newer specification is not compatibility evidence. Shared contract tests must validate actual responses as well as the mock, rather than trusting compile-time types.

### BQ-08 — Demonstrable C# and Java integration

Provide runnable reference integrations for a C#/ASP.NET Core service and a Java/Spring Boot service, each implementing the same representative API contract. They are examples to prove the boundary, not mandatory runtimes for demo users or claims of generated production business systems. Keep starter-specific examples/resources in the separately distributed starter/reference pack, not hidden in the engine archive.

The same generated frontend build MUST complete the representative list/detail/create/edit/delete and applicable validation/error workflow against either reference service, changing only approved runtime configuration. The test must make real HTTP requests with interception disabled. Reuse semantic assertions from the mock suite while keeping each backend's execution evidence distinct.

Ship a practical integration guide covering separate UI/API hosting and serving the web build from an existing application: configurable API base URL and UI base path, route fallback/deep-link reload, asset paths, local development proxy or explicit origin policy, authentication/credential and error mapping, build-output copy/deployment commands and version compatibility. Do not instruct users to disable browser security, embed secrets, or treat client-side role simulation as server authorization.

For an existing API that differs from the reference contract, document the adapter/mapper changes and verify that page/component source remains untouched. Neither example establishes plug-and-play compatibility with every C# or Java application, proprietary protocol or in-process desktop host.

### BQ-09 — Presentation and developer handover

The generated handover MUST explain how to start the demo, switch/reset scenarios, edit fixtures, inspect interaction coverage, run tests, configure a backend, identify remaining production responsibilities and regenerate safely. Link the UI interaction, fixture, contract, mock behavior and corresponding source/test/docs through stable IDs.

Keep live integration work visible without leaving demonstration interactions unfinished. A concise walkthrough must let a reviewer experiment, not merely watch a fixed scripted happy path. Preserve working components, styling, keyboard interaction, responsive behavior and host conventions in both modes.

### BQ-10 — Readiness gates and negative controls

Demo readiness requires **100% of the interactions in the reviewed selected design** to have executable fixture/scenario coverage and passing applicable behavior assertions, with zero missing handlers or unimplemented-action placeholders. Report the denominator, exclusions approved as actual scope changes, and per-case evidence; this is interaction completeness, not a source-code coverage percentage. A blank design does not replace the nontrivial reference projects required to qualify the generator.

Validate structural completeness during compilation/planning before advertising a complete output. Behavioral readiness requires tests on the actual built target after generation. Removing a handler/fixture, corrupting a response or breaking a referenced scenario MUST make the relevant gate fail. A build success, a generated test TODO or a toast assertion without state checks does not pass.

Record demo behavior, backend integration and production/native acceptance separately. Test evidence binds the model, interaction inventory, fixtures, contract, engine/starter, generated source/build and runtime versions. Regeneration of a shared contract must update affected fixtures/tests/docs or block drift; it must not quietly rewrite custom adapters. Preserve all existing security, architecture, accessibility, performance and release gates.

## 4. Concrete example: editing a request

The user opens a seeded Request Board, filters a list, opens a request and edits its priority. An invalid value shows the declared field error and leaves the record unchanged. A valid save updates the mock record, version, list/detail display and affected counts. Navigating away and back retains that session's change. A conflict scenario produces the declared recovery UI instead of a success notice. Cancel discards only the draft. Reset restores the original deterministic dataset.

The UI calls the same `updateRequest` port throughout. In demo mode the mock adapter owns the simulated state; in integration mode the service adapter sends the specified request and maps the response. The same frontend then runs against the C# and Java reference servers. A simulated session save is not advertised as a real database write.

## 5. Additional acceptance protocols

These BQA IDs supplement, not replace, the retained A and WVA cases. All are initially **not-run** for this amendment; each needs exact-candidate evidence.

| ID | Required proof | Existing acceptance connection |
| --- | --- | --- |
| BQA-01 | From clean generated source and disclosed prerequisites, approve build/start and experiment immediately with populated demo data, without backend/AI/account/manual source repair. Also verify first-run skip. | A01–04/A11/A18; WVA-05–07/12/13/15. |
| BQA-02 | Enumerate every selected interaction; verify normal/applicable failure scenarios and dependencies. Remove a handler, fixture and scenario reference in separate negative controls; each blocks readiness. | A10/A11/A17; WVA-12/13/15/18. |
| BQA-03 | Execute stateful create/read/update/delete, cancel, filtering and invalid/conflicting writes where designed; assert cross-view read-after-write and failure rollback, not only notices. | A10/A11; WVA-12–16. |
| BQA-04 | Select deterministic normal/empty/latency/error/permission scenarios; reset while work is pending; validate late-response isolation, editable fixture validation and declared reload behavior. | A08/A11/A19; WVA-08/15/18. |
| BQA-05 | Disable network for the offline build; prove no live services or personal-vault effects. Switch modes and fail a real service: no mock fallback, data mixing or fixture uploads. Verify production artifact exclusion. | A11/A17/A19; WVA-14/15/18. |
| BQA-06 | Run wire-contract vectors and semantic tests against mocks and actual service responses, including serialization/error drift. Add a custom mapper, regenerate, and preserve its bytes/tests. | A08/A10/A13/A17; WVA-01/11/14/16. |
| BQA-07 | Run the same frontend build against the C# reference server over real HTTP; complete the representative workflow and its validation/failure cases using configuration only. Record SDK, server, contract and build identities. | A17/A18; WVA-13/16/19. |
| BQA-08 | Repeat BQA-07 against the Java reference server without changing UI source or rebuilding the frontend for that backend. Record JDK/build-tool/server evidence separately. | A17/A18; WVA-13/16/19. |
| BQA-09 | Follow integration instructions for separate hosting and same-origin hosting, including a non-root UI path, deep-link refresh, assets and the applicable authentication/origin boundary. | A03/A17/A18; WVA-02/13/16/19. |
| BQA-10 | Observe a reviewer exploring fixtures and a developer replacing an adapter without UI rewrites; change a component/contract and regenerate consistent tests/docs while preserving owned work. Repeat native qualification separately. | A12/A13/A19/A20; WVA-11/14/16–20. |

## 6. Integration into the existing implementation plan

No parallel task-status database or automatic task closure is introduced. Add the following criteria to the existing responsible task scopes and readiness dependencies; their tests are mandatory before claiming this quality requirement complete.

| Existing packages | Additional deliverable / responsibility |
| --- | --- |
| WM-01/02 | Product/contract owner: inventory all interactions; agree explicit mock semantics; version scenario and wire contracts; no fabricated domain behavior. |
| WM-03/04 | Configuration/starter owners: discover fixture/scenario paths and mode defaults; deliver complete data packs and backend references through the existing separate-pack boundary. |
| WM-05/06 | CLI/process owner: a ready-to-demonstrate first-run path with preloaded fixtures, explicit execution and truthful readiness; demo needs no real backend. |
| WM-07–10 | Docs/editor owners: preserve interaction-to-fixture references through Markdown/JSON and expose scenario state, missing coverage and usable review controls. |
| WM-11 | Compiler/adapters owner: emit operational stateful mock behavior, typed ports, service adapter and integration contracts; prove both C# and Java examples. |
| WM-12/13 | Ownership/DX owners: regenerate fixtures/contracts/tests/docs together; preserve custom adapters; ship demo and backend handover guides. |
| WM-14/15 | Security/QA owners: isolation, wire-validation failures, zero silent fallback, production exclusion, keyboard/host/performance checks across scenarios. |
| WM-16 | Distribution/QA owner: exact-archive demo and both real reference-service proofs, using independent generated output and new negative gates. |
| WM-17–19 | Native/product/release owners: repeat native behavior without replacing real Workbench persistence; measure presentation effort; gate matching release claims on actual evidence. |

Implement contract/inventory changes first, then shared mock state/scenarios and generation, then service adapters/reference integrations, then independent artifact and reviewer acceptance. Reuse existing data-source/test-data/compiler/planner seams. Do not add a second generator, hard-code examples into core services or create a mandatory external mocking service.

The amendment tightens I1 first-run, I2 UI/docs output and I3 exact-kit readiness in the MVP plan. SH-022/032/033 must include the applicable new foundation evidence before a release claims this requirement. SH-034, CX-007, CP-010 and PUB approvals keep their existing sequence. No document or quality gate authorizes publication.

## 7. Source and verification boundary

The desired behavior and acceptance above are product requirements, not claims of existing implementation. The integration approach uses OpenAPI because it describes HTTP APIs independently of implementation language. Microsoft's ASP.NET Core documentation describes OpenAPI support; Spring's Java REST guide demonstrates a JSON HTTP service. These support the proposed integration boundary, not the completeness of Workbench's current generator:

- [OpenAPI specification](https://spec.openapis.org/oas/latest.html), introductory contract model; consulted 2026-09-29. Pin the supported dialect during implementation rather than adopting a version implicitly.
- [ASP.NET Core OpenAPI overview](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/openapi/overview), consulted 2026-09-29.
- [Spring: Building a RESTful Web Service](https://spring.io/guides/gs/rest-service/), consulted 2026-09-29.

This documentation change does not implement mock handlers, API clients or reference backends. No new source build, browser/native test or .NET/Java integration run is claimed. Review the current candidate before implementation; retain earlier source observations as dated evidence rather than rewriting their results.
