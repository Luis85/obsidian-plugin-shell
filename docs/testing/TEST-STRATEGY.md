# Test strategy

**Current applicability:** Historical statements below about the absence of
runtime code describe the retained pre-implementation baseline. The repository
now contains real Vue/application/native code; iteration 03 applies the retained
production thresholds to it without changing baseline acceptance status. See the
[iteration plan](../development/ITERATION-THREE-PLAN.md) and separate executed
iteration records for actual evidence.

**Version:** 1.0 · **Date:** 2026-09-22 · **Owner:** template maintainer  
**Normative for:** PRD 0.6, TST-01–16 and AC-83–90; previous acceptance requirements remain.  
**Execution design:** [Test concept](TEST-CONCEPT.md) · **Machine inventory:** [test-plan.json](test-plan.json)

## 1. Purpose and scope

The template must make trustworthy verification an ordinary part of development, not a separate report written at release time. A developer or agent must be able to answer: what behavior was checked, against which source and host, what failed or did not run, and what remains before release.

There are three distinct products under test: the reusable template and its setup/makers; a plugin generated from it; and the tools/tests that claim those products are correct. A passing tool check does not establish plugin behavior, and a passing generated demo does not establish that every maker works.

**TST-01 — Explicit evidence scope.** Every run identifies its mode: Node/tooling baseline, HTTP specimen, browser specimen, explicit inline diagnostic, real-component browser, native host, device, artifact, generated repository, manual assessment, security or performance. Results from one mode cannot silently satisfy another.

The current repository has an original host-style specimen and its HTTP server, not the planned Vue plugin. This iteration adds executable baseline checks and browser assertions, but does not invent tests for services that do not exist. Node's built-in runner is a temporary no-dependency bridge for these assets, not a replacement for the required Vitest strategy. The same assertions must be ported/reused once WP-00 qualifies the real stack.

## 2. Risk-based priorities

Prioritize loss, corruption, unsafe mutation and false-success failures over screenshot completeness. Risk describes impact and exposure, not a numeric product-quality score.

| Risk band | Examples | Minimum treatment |
| --- | --- | --- |
| Critical | Overwriting notes; duplicate creation after uncertain writes; stale persistence snapshots; unsafe setup/maker edits; permission/publication mistakes; hidden contained defects. | Positive and negative tests, explicit boundary/race cases, independent assertions on data/effects, and required integration/native proof where the host matters. |
| High | Leaked subscriptions; repeated notifications; broken migrations; inaccessible recovery; missing compiled CSS; broken generated registrations. | Unit/contracts plus real-component tests, lifecycle/fault scenarios, targeted native cases. |
| Normal | Help text, nonessential layout refinements, static catalog formatting. | Focused deterministic assertions and review; visual checks only where useful. |

**TST-02 — Ownership.** A feature author supplies tests and evidence with the change. Reviewers check that assertions detect the relevant defect, not just that the suite is green. The template maintainer owns policy, baselines, exceptions and tool upgrades. Native/device acceptance has an identified actor and candidate hash. Coding agents have no authority to weaken these obligations or declare missing environments passed.

## 3. Test levels and responsibilities

| Level | What to exercise | Intended implementation |
| --- | --- | --- |
| Domain | Invariants, field validation, date-only semantics, immutable values. | Vitest in Node without DOM/host imports. |
| Application | Use-case outcomes, serialized writes, cancellation, post-commit facts, projections. | Vitest with narrow stateful port adapters and deterministic barriers. |
| Contract/infrastructure | Same contract against production adapter where possible and faithful fake; native overload/ownership assumptions. | Vitest and selected real-host cases. |
| Component | Public props/events, real form interactions, store action policy, localization, recovery and cleanup. | Vue Test Utils/Vitest with explicit per-test ownership. |
| Browser | Real components/services with controlled host adapters, style behavior, focus, accessibility, captured defects. | Playwright Test against built harness; no parallel fake application. |
| Native/device | Actual plugin load, commands/settings/Notice/Modal, Properties, pop-outs, reload, supported device behavior. | Qualified native runner plus recorded manual/device acceptance. |
| Build/artifact | CJS entry, one composed stylesheet, licenses/assets, no mocks/tooling, hashes. | Build inspection and native loader checks. |
| Template/tooling | Fresh setup, safe plans, makers, differently named repository, example removal, release failures. | Isolated generated repositories and bounded child processes. |
| Gate qualification | Deliberate wrong import, extra line, missing translation, caught error, empty suite, bad report. | Real configured tools invoked on isolated defects; failure must actually propagate. |

Vitest supports separate test projects and coverage configuration. Its default coverage scope does not automatically include every untested file, so configure the intended production source explicitly. Pinia's test helper stubs actions by default; tests claiming application execution must opt into real actions. [T1, T2, T3]

**TST-03 — Test public behavior.** Assert outputs, persisted content, effects and ownership—not incidental private method calls alone. Mocks verify a deliberate boundary, not an entire system fabricated to return success. Snapshots complement assertions; they do not replace validation of fields, transitions or writes.

## 4. Required scenario families

Preserve all previously specified cases for setup, makers, composition/LoC, events, modular styles, entity documents, error/notification handling and releases. The machine inventory assigns AC-01–90 an owner, risk, required modes, present evidence links and a gap statement.

For documents, test a successful complete write, invalid input with no side effect, collision, stale prepared plan, failed write, uncertain write, same-request retry, cancellation before/during write, cache lag, failed opening and failing event subscriber. Inspect actual Markdown and the existing destination; do not infer persistence from a toast.

For notifications, test effect-aware outcomes, one progress/terminal handle per operation, independent operations, persistent recovery, missing/extra expected faults, observer overflow, sink/translator failure and disposal. A production fallback can be useful while its test still fails because an unexpected defect occurred.

For the bus, test correlated types, listener order, reentrant once/unsubscribe, synchronous throws and rejected promises, late subscribers, two plugin instances, two views, startup native events and unload-before-ready. Domain facts are not native actions or durable delivery guarantees.

For setup/makers, begin with no node_modules and a different identity; test path/registry conflicts, protected directories, unchanged user files, cancellation and partial failure. A generated repository must not recursively regenerate itself indefinitely. Test the generator-of-generators once inside a bounded parent qualification job.

## 5. Determinism

**TST-04 — Controlled inputs.** Inject time, IDs, randomness and scheduling where business behavior depends on them. Prefer fixed data and explicit input partitions for examples. When property-based testing is introduced, record the generator seed and shrunk replay path, retain counterexamples and replay them independently. fast-check documents seed/path replay; it is a planned tool, not installed by this iteration. [T4]

Use fake timers for expiry/debounce tests, restore them after each case, and assert resource cleanup. Control promise interleavings with deferred barriers rather than sleep. Test date-only values under UTC, Europe/Berlin DST transitions and a negative-offset timezone without converting them into timestamps. Vitest's clock facilities and Playwright's clock controls address different execution contexts; record which one is controlled. [T5, T6]

**TST-05 — Isolation.** Fresh repositories, temp folders, stores, observers, browser contexts and namespace keys per independent case. Shared state is permitted only within a named multi-step scenario. HTTP test servers request an ephemeral loopback port and wait for a listening signal. HTTP scheduling and operating-system timing are nondeterministic; assert content/status/order guarantees rather than elapsed milliseconds.

**TST-06 — Repetition is not retry.** Baseline verification executes the complete inventory three times in fresh child processes, with zero retries. Every run must pass and have the same semantic outcome digest. Durations, random report directory names and ports are excluded from that digest; relevant source bytes and policy are hashed separately. Repeated success is evidence of repeatability under those inputs, not a mathematical proof against all nondeterminism.

Future Playwright/Vitest CI follows the same no-hidden-retry principle. Diagnostic retries can be requested separately, but first-run failure remains recorded as flaky/failed and cannot become an ordinary pass. Playwright explicitly distinguishes flaky from first-run-passing cases. [T7]

## 6. Fault injection and the observer

**TST-07 — Independent failure observation.** Tests observe browser errors, console errors, rejected operations and caught application/Vue/subscriber defects through an independent ledger. Expected faults name exact code, scope and count; they fail when absent, extra or overflowing. Redaction and bounded diagnostics cannot erase the test verdict.

This iteration implements a test-only bounded fault ledger and connects it to specimen browser observers. Production Vue and ErrorService integration remains pending. The test ledger is not a new production logger, and no production import from scripts/testing is allowed.

Inject faults at owned ports: rejected save, denied local storage, duplicate filename, delayed readiness, out-of-order save completion, failing notification sink. Do not corrupt personal vaults or globally suppress errors. A faulty fake must be rejected by its contract tests. Negative controls include removing the host stylesheet and emitting a controlled browser console error; the corresponding positive invariant must then fail.

## 7. Coverage and completion metrics

**TST-08 — Three separate metrics.** Execution pass rate, requirement evidence and code coverage are independent. A test count never implies acceptance coverage; a requirement label never proves all its assertions; a high line percentage never proves critical failure behavior.

Retain the existing proposed runtime thresholds: overall lines/statements/functions 90%, branches 85%; domain/application 95%, branches 90%. Configure production inclusion explicitly, version-pin the coverage provider, document exclusions and retain untested-file visibility. No production coverage is measured by the current Node fixture gate. Its report says so. [T2]

Use mutation testing selectively after a working core exists—for validation, conflict policies and lifecycle logic—to evaluate assertion strength. Stryker changes code to see whether tests detect those changes; it is additional evidence, not proof of correctness or a mandatory dependency introduced here. [T8]

**TST-09 — Traceability without false completion.** Catalogue links use `partial` or `whole` extent. All declared links and required modes must be satisfied before a case is marked verified. The scope-gated report never treats inline browser results as served/native evidence. Existing end-to-end requirements remain partial/not-run until their implementation exists.

## 8. Profiles and gates

| Profile | Entry condition | Exit condition |
| --- | --- | --- |
| Baseline (implemented) | Node available, declared fixture/tool source present. | Strict plan/source inventory, exact real test IDs, all repeated runs pass, no skip/todo/empty suite or source drift. |
| Specimen browser (implemented, provisioning required) | Explicit local Playwright and browser; HTTP navigation permitted for served mode. | Eight real browser assertions, fresh contexts, exact fault expectations, stable outcomes, correct evidence mode. |
| Fast development (future) | Qualified TypeScript/Vitest/lint projects. | Selected finite static/unit checks, clearly partial. |
| Pull request/full verify (future) | Implemented runtime and installed pinned browsers/toolchain. | All relevant static/coverage/contract/component/browser checks plus gate fixtures. |
| Template qualification (future) | Working setup/makers. | Fixed set of generated repositories, identity/removal/installation/upgrade/release tests, no recursion. |
| Release (blocked now) | Actual candidate assets and independent host evidence. | Full requirements, approved exceptions, exact hashes/source/host/devices, no high-risk unresolved defect. |

The executable suites are separated by responsibility (runtime, CLI, generator,
companion, test data, makers, native tooling, setup, release, quality, baseline and
the opt-in browser/host suites). [Test suites](TEST-SUITES.md) lists each command,
runner, prerequisite and whether `verify` runs it; `tests/suites.json` classifies
every test file into exactly one suite and fails closed otherwise.

**TST-10 — Fail closed.** Missing tool, missing report, malformed output, zero tests, wrong test inventory, unexpected skip/todo, timeout, stale source or unclassified error cannot be a pass. Reports retain failure and blocked/not-run state. A reporter crash is an infrastructure error, not an empty finding list.

**TST-11 — Release guard.** The current release profile intentionally exits 2 as blocked. It is an honest readiness guard, not a completed release verifier. Do not remove that guard merely because the baseline is green. Implement artifact/native evidence validation in the actual release package before enabling promotion.

## 9. Accessibility, performance and security

Accessibility combines semantic/keyboard/focus assertions, automated scanning in the future integrated browser suite, and manual screen-reader/native checks. Forced-colors or reduced-motion rendering is not assistive-technology certification. A CSS-backed browser dialog is not a native Obsidian Modal test. [T9]

Performance budgets require a controlled environment, warm-up policy, sample count and recorded browser/host/build. Shared CI timing is advisory unless the benchmark environment is qualified. Test resource counts after repeated lifecycle operations; do not infer leaks solely from noisy memory samples.

Security checks include synthetic hostile input, path containment, allowlisted HTTP routes, fixture-only data, redacted artifacts, no runtime test hooks, no publication secrets in PR jobs, and validated installed dependencies. Source regex tripwires are labeled as such: they are not a parser, penetration test, or proof of complete security.

## 10. Maintenance and governance

**TST-12 — Defect workflow.** Record a reproducible case, risk, affected scope/source, expected/actual behavior, evidence and owner. Reproduce before fixing when possible; add the narrow regression test and run affected broader levels. Never delete a failing test solely to finish a feature.

**TST-13 — Flake policy.** Investigate nondeterministic inputs and ownership first. A temporary quarantine requires owner, reason, tracking issue and expiry; critical safety cases cannot be silently quarantined. Required gate failure remains visible until explicitly approved resolution. The current baseline accepts no quarantine/skip.

**TST-14 — Upgrade policy.** Analyzer, parser, runner and compiler upgrades must re-run their negative fixtures and maker/artifact tests. Screenshot updates are separate reviewed changes. Native/fixture version metadata distinguishes a source change from an actual host comparison.

**TST-15 — Evidence retention.** Store JSON, readable summary and JUnit with source/input fingerprints and exact mode/tool/environment. Keep failure traces/screenshots bounded and synthetic. Reports are outputs, not committed pass badges. Integrity hashes bind bytes; they are not signatures or protection from a trusted maintainer modifying reports/code.

**TST-16 — Incremental implementation.** Preserve existing requirements and make progress visible. First qualify this baseline, then port/reuse its assertions into Vitest/Playwright Test, implement real services/components, connect the caught-defect observer, and finally perform native/device/release qualification. Do not add competing permanent test stacks or ship a fake all-green runtime suite.

## 11. Sources

Primary documentation consulted 2026-09-22; library capabilities must be qualified against the versions selected by WP-00.

- **T1:** [Vitest test projects](https://vitest.dev/guide/projects.html).
- **T2:** [Vitest coverage](https://vitest.dev/guide/coverage.html): explicit source inclusion and providers.
- **T3:** [Pinia testing](https://pinia.vuejs.org/cookbook/testing.html): action stubbing and isolation.
- **T4:** [fast-check runners](https://fast-check.dev/docs/core-blocks/runners/): replay seed/path.
- **T5:** [Vitest dates](https://vitest.dev/guide/mocking/dates) and [timers](https://vitest.dev/guide/mocking/timers).
- **T6:** [Playwright clock](https://playwright.dev/docs/clock).
- **T7:** [Playwright retries](https://playwright.dev/docs/test-retries).
- **T8:** [Stryker introduction](https://stryker-mutator.io/docs/stryker-js/introduction/).
- **T9:** [Playwright best practices](https://playwright.dev/docs/best-practices).
- **T10:** [Node test runner](https://nodejs.org/api/test.html): events/custom reporters and isolation.
- **T11:** [Playwright web server](https://playwright.dev/docs/test-webserver).

The strategy supplies intended practice; the [execution record](2026-09-22-verification-record.md) distinguishes what this iteration actually exercised.
