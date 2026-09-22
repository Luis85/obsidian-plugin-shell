# Product requirements: Obsidian Plugin Shell

> **Version:** 0.7.0 · **Updated:** 2026-09-22 · **Owner:** Luis85  
> **State:** Specification plus an implemented style specimen and scope-limited verification baseline. The plugin runtime, setup/makers, full Vue harness and native release qualification are not implemented.

## 1. Product direction and normative structure

Provide an approachable current Obsidian plugin baseline: obtain the template, run guided setup, generate a first feature, develop with a real-component browser harness and native host, verify, and publish the exact accepted artifacts.

This revision retains the test strategy and adds sourced Obsidian token aliases, a pinned owner-provided host stylesheet, explicit extracted/simulated profiles, and deterministic token/fidelity checks. It does not claim a working plugin because fixture tests pass.

[BASELINE-0.4.md](BASELINE-0.4.md) remains the exact retained original specification (blob `eb6e37ed128c6bbe6a2eba895729d2643c8cfb3e`). Its requirements, command contracts, work packages and AC-01–62 remain incorporated. The v0.5 error/notification/harness requirements and AC-63–82 are retained below. Historical status/version wording is not a current capability claim; current refinements take precedence without weakening earlier safety or quality requirements.

| Normative document | Scope |
| --- | --- |
| [Retained baseline](BASELINE-0.4.md) | Core requirements, AC-01–62, WP-00–09. |
| [Setup/makers](../development/SETUP-AND-MAKERS.md) | TOOL-01–06, SETUP-01–12, MAKE-01–12. |
| [Typed events](../architecture/EVENT-BUS.md) | EVT-01–16. |
| [Styles](../architecture/STYLES.md) | CSS-01–12. |
| [Document creation](../architecture/DOCUMENT-CREATION.md) | DOC-01–20. |
| [Errors/notifications](../architecture/ERRORS-AND-NOTIFICATIONS.md) | ERR-07–18, NTF-01–12, retaining original ERR/LOG rules. |
| [Harness styles](../testing/HARNESS-STYLES.md) | HSS-01–12. |
| [Test strategy](../testing/TEST-STRATEGY.md) | Adds TST-01–16. |
| [Native tokens](../design/OBSIDIAN-TOKENS.md) | Adds TOK-01–06; default extracted host styling with precise provenance. |
| [Test concept](../testing/TEST-CONCEPT.md) | Executable profiles, fixtures, reporting, determinism and implementation roadmap. |

The [machine test plan](../testing/test-plan.json) is an executable inventory and traceability index. It does not replace normative behavior with abbreviated summaries. Test results, acceptance evidence and release readiness are distinct.

## 2. Users and outcomes

SUC-01–06 and DX-01–05 remain. A developer/agent uses the same short workflow and does not need to read the entire specification before changing a feature. End users receive native-feeling, private, reliable behavior and actionable recovery.

A successful generated repository must really install/build/verify. No placeholder package scripts or mock services may simulate that success. Current baseline tests are useful implementation progress but are not the completed first plugin feature.

## 3. Capability status

| Capability | Current state |
| --- | --- |
| Product/architecture/developer contracts | Specified, including explicit test strategy/concept. |
| Original modular host CSS and interactive style specimen | Implemented. |
| Allowlisted loopback fixture server | Implemented and locally tested. |
| Baseline test-plan validation, fault observer, source hashes/limits, real child execution, repeated reports | Implemented and locally tested. |
| Optional preprovisioned Playwright specimen checks | Implemented; local inline diagnostic mode tested. Served browser mode is environment-blocked locally. |
| Scoped Linux/Windows baseline CI | Workflow supplied; local runs do not establish hosted/Windows success. |
| Production ErrorService/NotificationService/caught-Vue observer | Specified, not implemented. The new observer is test tooling only. |
| Vue/Pinia plugin, DocumentCreationService, bus, setup/makers | Specified, not implemented. |
| Full pinned Vite/Vitest/Playwright Test toolchain and code coverage | Pending. No package.json/lockfile is fabricated for this bridge. |
| Native/device/release compatibility | Not run; release profile remains blocked. |

All previous requested capabilities remain in scope. This does not add a notification inbox, ORM, distributed event/error platform, theme emulator or autonomous release publisher.

## 4. Product review continuity

The [v0.5 review](../reviews/2026-09-22-product-review.md) retains its twenty findings and historical evidence. This pass addresses its test-evidence and finite-qualification gaps through executable inventory, fault expectations, exact test accounting, repeated runs and release scope guards. Its historical test counts are not current totals.

## 5. Stack, compatibility and updates

TEC-01–08 and UPD-01–08 remain: required Vite/Vitest/Oxlint/fallow/TypeScript/Vue/Pinia/Obsidian ESLint stack, latest compatible stable dependencies, one qualified exact lockfile, current public host and reviewed updates.

The dependency-free Node baseline is temporary qualification of existing assets, not a new permanent competing framework. Reuse/port its assertions to the selected Vitest/Playwright Test projects in WP-00/01. Registry unavailability in this editing environment is not a reason to invent a compatible latest-package matrix.

Node 22.16.0 and Chromium 144 used locally are evidence-environment observations. The workflow targets an exact Node 24.21.0 qualification environment; that does not establish complete plugin support. Record actual CI results separately.

## 6. Architecture

ARC-01–10 remain: presentation → application → domain → shared; infrastructure implements inner ports; bootstrap composes concrete adapters; main.ts owns minimal lifecycle and no business logic.

Testing utilities under scripts/tests are never runtime dependencies. The test ledger must not become a globally imported production error service. Actual application outcomes, notification policy and host/harness sinks retain their declared ownership.

## 7. Lifecycle

LIF-01–07 remain, including view/runtime ownership, no leaf detachment and late async guards. Tests own servers, ports, child processes, temporary repositories, browser contexts, fault ledgers and report outputs. Disposal must be asserted rather than hidden by blanket cleanup that conceals a leak.

## 8. UI and notifications

EXA-01–05, UI-01–10, SET-01–03 and NTF-01–12 remain. Field validation stays associated and persistent; essential recovery is not only in an expiring notice. One operation updates its feedback handle; independent operations remain distinct. Cancellation before mutation is not an error alert.

Specimen controls exercise styling only. A browser dialog, hardcoded progress element, or demo notice does not prove native adapter/service behavior. Tests must explicitly choose real Pinia actions when they claim application execution.

## 9. Data and entity documents

DAT-01–07, LOC-01–05 and DOC-01–20 remain. Markdown is canonical for note-backed Tasks, using explicit entity/document definitions and real serialization through the prepared/create/commit pipeline. No overwrite, automatic user-note migration, duplicate data.json Task authority or unsafe uncertain-write retry.

Tests inspect actual generated Markdown/writer content and state. Confirmed creation survives failed opening/subscriber/notification; retries target the follow-up, not another document creation.

## 10. Localization and accessibility

I18N-01–07 remain. Tests cover relevant locales/long text, date-only timezone independence, associated validation, keyboard/focus and persistent recovery. Force-colors/reduced-motion rendering does not establish complete accessibility or screen-reader behavior. Required manual/native evidence remains explicit.

## 11. Errors and diagnostics

ERR-01–18 and LOG-01–06 remain. An unexpected caught defect must still fail an ordinary test. The test observer records exact safe code/scope/count, rejects missing/extra expected failures and cannot erase overflow by evicting entries. Production integration into Vue/error/subscriber boundaries remains a future acceptance obligation.

No raw user content, paths, plans or secrets in default logs/reports. Current negative fixtures use synthetic values. Test helpers cannot expand publication or filesystem permissions.

## 12. Harness and styling

HAR-01–10, E2E-01–07, CSS-01–12 and HSS-01–12 remain. The original host CSS is separate from composed plugin CSS. Real plugin components/services and matching compiled style identifiers remain required for integrated evidence.

Modes are explicit: HTTP specimen, browser specimen, inline diagnostic, integrated browser and native candidate. The optional browser command never silently switches from blocked HTTP navigation to inline HTML. Missing host CSS and controlled console errors are tested negative controls, not proof of a completed native error pipeline.

## 13. Test strategy and test concept

TST-01–16 establish risk-based test levels, ownership, deterministic inputs/scheduling, isolation, no-hidden-retry repetition, independent fault observation, separate metrics, exact traceability, fail-closed gates, release boundaries, defect/flake handling, update regression and retained evidence.

The [test concept](../testing/TEST-CONCEPT.md) defines executable files, commands, IDs, profile requirements, report schemas and detailed future service scenarios. The inventory assigns every AC-01–90 an owner, risk, required modes and current evidence/gap. A partial fixture link cannot satisfy a whole native requirement.

Current baseline verification uses actual Node tests in isolated child processes with exact IDs and schema-checked event reports. Empty, skipped, missing, malformed or timed-out execution is not pass. Three fresh runs must all pass with stable semantic outcomes; input hashes are compared before/after. These checks do not measure production coverage.

## 14. Quality policy

QLT-01–17 remain unchanged in intent: 400 physical source/CSS/tooling lines, 450 test/helper lines, main.ts 100; full SFC counts; strict types; complementary lint; full/production fallow; reviewed exceptions; deliberately invalid gate fixtures.

Baseline physical-line and input checks cover their declared roots only. Limited source regex tripwires are not CSS parsing, full architecture analysis or a security audit. The planned runtime coverage floors remain unmeasured until the real coverage project exists. Test count, acceptance state and coverage must never be combined into a misleading single percentage.

## 15. Commands

Future npm commands in the retained baseline remain pending. These focused commands now work independently of package installation:

```sh
node scripts/harness/serve-style-fixture.mjs --port 4174
node scripts/testing/verify-baseline.mjs --repeat 3 --json
node scripts/testing/verify-baseline.mjs --profile release --json
```

The server is interactive; verification is finite. The release profile deliberately exits 2 with blocked readiness and no publication. Optional `check-browser-specimen.mjs --mode served` requires preprovisioned Playwright/browser; inline diagnostic mode is explicit and produces separately labeled evidence. See the concept for safe local override/provisioning details.

Reports are written into unique ignored folders. They contain execution input hashes, mode, tool/environment, actual outcomes, JUnit/readable summaries and remaining gaps. A stale report is not a fresh execution or a signed attestation.

## 16. Agent workflow

AGT-01–12 remain. Add actual tests/IDs/trace links with implementation, use finite commands and read scope/status as well as counts. No quiet inventory deletion, skip, retry-only green, observer removal, lowered threshold or visual baseline acceptance to finish work.

Property-generated tests will record seeds/replay paths after the library is pinned. Do not add fake property tests over a substitute implementation merely to fill a planned suite.

## 17. CI, maintenance and release

TPL-01–04, CI-01–06 and REL-01–11 remain. The new read-only baseline workflow calls the same finite command on Linux/Windows with pinned official actions and bounded artifact retention. It does not install an invented plugin toolchain or receive release credentials.

Release qualification still requires actual runtime/browser/artifact/native/generated-repository evidence for the candidate. The current guard stays blocked even if baseline tests are green; replace it only with the real reviewed release implementation. Full host/device and generated-repository workflows remain pending.

## 18. Non-functional targets

NFR-01–13 remain proposed until measured. Baseline runner deadlines and fresh temp directories support reliable feedback but do not certify plugin performance, mobile support, exactly-once writes, WCAG compliance or pixel equivalence to Obsidian.

## 19. Acceptance and traceability

AC-01–62 remain in the retained baseline. The v0.5 cases and eight new test-system cases follow. There are **90 specified acceptance cases**, not 90 passing implementation tests. The machine inventory is validated independently of actual execution results.

| ID | Required outcome | Trace |
| --- | --- | --- |
| AC-63 | Canonical failures preserve category, safe identity and actual effect state. | ERR-07–09 |
| AC-64 | Associated persistent field guidance, not a toast per invalid field. | NTF-02, NTF-06 |
| AC-65 | One progress/terminal handle per operation; independent attempts stay distinct. | NTF-01, NTF-03–04 |
| AC-66 | Uncertain create has no unsafe retry; committed/open-failed exposes safe follow-up only. | ERR-09–11, NTF-10 |
| AC-67 | Reporter/translator/sink failure bounded/nonrecursive and truthful. | ERR-13–14, NTF-07 |
| AC-68 | Contained Vue/render defect fails ordinary browser scenario via independent ledger. | ERR-12, ERR-15, HSS-08 |
| AC-69 | Expected-fault scenarios reject missing/extra faults and overflow. | ERR-15, HSS-08–09 |
| AC-70 | Notice bursts/dedup/expiry/dismiss preserve recovery and evidence. | NTF-04–05, NTF-11 |
| AC-71 | Disposal removes only owned handles/actions/timers. | NTF-03, NTF-10–11 |
| AC-72 | Keyboard/focus/live announcements/persistent recovery work in declared environment. | NTF-06–09 |
| AC-73 | Native Notice limitations modeled without private API assumptions. | NTF-07–08 |
| AC-74 | Original scoped/provenance-labeled fixture, no copied app.css/fonts or packaging. | HSS-01–02, HSS-11 |
| AC-75 | Missing host/plugin CSS, wrong identifiers and shim packaging fail checks. | HSS-06–07 |
| AC-76 | Theme/narrow/long-text/media cases have explicit mode/evidence. | HSS-04–05 |
| AC-77 | Specimen is not reported as native/Vue/service testing. | HSS-03, HSS-05 |
| AC-78 | Native comparison has actual identity or remains unverified. | HSS-01, HSS-06 |
| AC-79 | Makers reuse canonical feedback and failure/cleanup tests. | ERR-16, POL-04 |
| AC-80 | Freshness/release excludes fixture-only success and retains prior safeguards. | POL-01, REL-02, HSS-12 |
| AC-81 | Loopback server rejects arbitrary paths/writes and serves declared assets safely. | HSS-11–12 |
| AC-82 | Required coverage/qualification finite without recursive generation. | POL-05–06 |
| AC-83 | Plan rejects missing/duplicate acceptance and unknown evidence/test IDs. | TST-09–10 |
| AC-84 | Repeated cold runs agree without retries hiding failures. | TST-04–06 |
| AC-85 | Exact expected code/scope/count and overflow cannot conceal faults. | TST-07 |
| AC-86 | New/changed execution inputs invalidate stale evidence. | TST-10, TST-15 |
| AC-87 | Empty/skipped/malformed/crashed/missing test execution fails closed. | TST-10 |
| AC-88 | Owned test execution is bounded and timeout cleanup exercised. | TST-05, TST-10 |
| AC-89 | Execution rate, acceptance evidence and code coverage remain separate. | TST-08–09 |
| AC-90 | Baseline/inline success cannot satisfy native/release gates. | TST-01, TST-11 |

## 20. Implementation packages

WP-00–09 keep existing scope and dependencies. Integrate the test strategy rather than add a second project:

| Package | Required follow-through |
| --- | --- |
| WP-00/01 | Qualify actual current tool versions; port/reuse baseline checks in Vitest and locked CI; preserve no-dependency bootstrap tests. |
| WP-02/03 | Real service/bus/error/notification/document contracts with controlled clocks, barriers, faults and bytes. |
| WP-04 | Example and Task flows with truthful outcomes and actual persistence. |
| WP-05/06 | Real Vue harness, independent caught-defect observer, composed CSS fidelity, native/device checks. |
| WP-07 | Bounded fresh setup/generated-repository tests, maker output and removal safety. |
| WP-08/09 | Upgrade regression and exact-candidate release/native/generated qualification. |

## 21. Polishing and governance

POL-01: Distinguish specified/implemented/locally-tested/native-verified/released. POL-02: Preserve numbered requirements through one current entrypoint and focused companions. POL-03: Avoid a new inbox/theme/error/testing platform. POL-04: Generated source follows shared policies and gates. POL-05: Risk-select profiles without dropping required coverage. POL-06: Generated qualification has an explicit finite boundary; no recursive full-suite generation or hidden blanket skip.

A baseline may become useful before complete v1 qualification, but its label must remain honest. Do not lower unchanged requirements to make an early milestone look complete.

## 21.1 Native token and host-style refinement

The [token contract](../design/OBSIDIAN-TOKENS.md) is normative. It supersedes original-only default styling and blanket no-vendor assumptions specifically for the owner-requested extraction; it does not relicense third-party code, supply fonts, claim native fidelity, or put host styles in the plugin bundle. The original simulator is retained in a separate profile.

Implemented now: 133 reviewed reference names, 968 observed extracted names, 38 scoped aliases, a lossless pinned archive and one explicit comment-only runtime repair, profile-aware server/inline adapter, and token tests. No full plugin/Vite artifact/native-host certification follows.

AC-01–90 remain. Add AC-91–96:

| ID | Requirement | Evidence scope |
| --- | --- | --- |
| AC-91 | Sourced native reference and usable plugin aliases | TOK-01; code/reference checks, not all host API variables. |
| AC-92 | Snapshot hash and narrow vendor-input integrity | TOK-02; any altered decoded bytes fail. |
| AC-93 | Explicit host → plugin → fixture order and isolated profiles | TOK-03; no automatic fallback. |
| AC-94 | Theme overrides and missing-style negative browser cases | TOK-04; environment/mode recorded, native not inferred. |
| AC-95 | Accurate unknown-version/rights/font/provenance claims | TOK-05; no MIT relabel or font distribution. |
| AC-96 | Deprecated/missing aliases and drift fail checks | TOK-06; exact current alias grammar, no general CSS lint claim. |

The specified acceptance total is now 96, not a passing runtime-test count. Handwritten source limits remain 400/450; the exact immutable vendor input has a checked, documented exception. Production code now includes only the style entry/aliases, not a functioning plugin runtime.

## 22. Sources and executed evidence

Primary test-tool documentation is cited in the strategy. Earlier R/S/D and reliability sources remain with existing companions. [The execution record](../testing/2026-09-22-verification-record.md) states the actual local tests, fixed inputs, negative controls, tooling faults corrected, and blocked environments.

This iteration supplies runnable baseline verification—not the unimplemented plugin. Hosted CI, native Obsidian, mobile devices, production coverage, full generated repositories and release acceptance require their own evidence.
