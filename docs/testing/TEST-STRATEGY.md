# Test strategy

> Type: explanation · Part of the [docs index](../README.md)

**Version:** 1.2 · **Date:** 2026-10-04 (first issued 2026-09-22) · **Owner:** template maintainer  
**Normative for:** PRD 0.6, TST-01–16 and AC-83–90; previous acceptance requirements remain.  
**Suites and commands:** [Test suites](TEST-SUITES.md) · **Legacy plan and baseline:** [reference](TEST-CONCEPT.md) and [test-plan.json](test-plan.json)

This page explains how the repository approaches testing and why. The numbered
TST rules are normative. Which suite runs what, and how to add a test, is in
[Test suites](TEST-SUITES.md#adding-a-test).

## 1. Purpose and scope

The template must make trustworthy verification an ordinary part of development, not a separate report written at release time. A developer or agent must be able to answer: what behavior was checked, against which source and host, what failed or did not run, and what remains before release.

There are three distinct products under test: the reusable template and its setup/makers; a plugin generated from it; and the tools/tests that claim those products are correct. A passing tool check does not establish plugin behavior, and a passing generated demo does not establish that every maker works.

**TST-01 — Explicit evidence scope.** Every run identifies its mode: Node/tooling baseline, HTTP specimen, browser specimen, explicit inline diagnostic, real-component browser, native host, device, artifact, generated repository, manual assessment, security or performance. Results from one mode cannot silently satisfy another.

The repository contains the real Vue/Pinia/Obsidian plugin runtime, the `node bin/app` CLI, the dedicated compiler and the projects it generates. The qualified stack is Vitest (domain, application and component tests, with coverage), Playwright Test (served UI in the browser harness), Node's built-in test runner (CLI, compiler, generator, makers, setup, release and quality tooling) and an explicitly provisioned real-Obsidian runner. `tests/suites.json` assigns every test file to exactly one suite. The original host-style specimen and its Node baseline remain as the retained legacy acceptance inventory, not as a substitute for the runtime suites.

## 2. Risk-based priorities

Prioritize loss, corruption, unsafe mutation and false-success failures over screenshot completeness. Risk describes impact and exposure, not a numeric product-quality score.

| Risk band | Examples | Minimum treatment |
| --- | --- | --- |
| Critical | Overwriting notes; duplicate creation after uncertain writes; stale persistence snapshots; unsafe setup/maker edits; permission/publication mistakes; hidden contained defects. | Positive and negative tests, explicit boundary/race cases, independent assertions on data/effects, and required integration/native proof where the host matters. |
| High | Leaked subscriptions; repeated notifications; broken migrations; inaccessible recovery; missing compiled CSS; broken generated registrations. | Unit/contracts plus real-component tests, lifecycle/fault scenarios, targeted native cases. |
| Normal | Help text, nonessential layout refinements, static catalog formatting. | Focused deterministic assertions and review; visual checks only where useful. |

**TST-02 — Ownership.** A feature author supplies tests and evidence with the change. Reviewers check that assertions detect the relevant defect, not just that the suite is green. The template maintainer owns policy, baselines, exceptions and tool upgrades. Native/device acceptance has an identified actor and candidate hash. Coding agents have no authority to weaken these obligations or declare missing environments passed.

## 3. Test levels and responsibilities

| Level | What to exercise | Implementation |
| --- | --- | --- |
| Domain | Invariants, field validation, date-only semantics, immutable values. | Vitest in Node without DOM/host imports. |
| Application | Use-case outcomes, serialized writes, cancellation, post-commit facts, projections. | Vitest with narrow stateful port adapters and deterministic barriers. |
| Contract/infrastructure | Same contract against production adapter where possible and faithful fake; native overload/ownership assumptions. | Vitest with the in-memory [Obsidian test kit](OBSIDIAN-TEST-KIT.md) and selected real-host cases. |
| Component | Public props/events, real form interactions, store action policy, localization, recovery and cleanup. | Vue Test Utils/Vitest with explicit per-test ownership. |
| Browser | Real components/services with controlled host adapters, style behavior, focus, accessibility, captured defects. | Playwright Test against the built harness (`npm run test:e2e`); no parallel fake application. |
| Native/device | Actual plugin load, commands/settings/Notice/Modal, Properties, pop-outs, reload, supported device behavior. | Real-Obsidian runner in contained vaults ([dev loop](OBSIDIAN-DEV-LOOP.md)) plus recorded manual/device acceptance. |
| Build/artifact | CJS entry, one composed stylesheet, licenses/assets, no mocks/tooling, hashes. | Build inspection and native loader checks. |
| Template/tooling | Fresh setup, safe plans, makers, differently named repository, example removal, release failures. | Node test runner suites over isolated generated repositories and bounded child processes. |
| Gate qualification | Deliberate wrong import, extra line, missing translation, caught error, empty suite, bad report. | Negative fixtures that invoke the real configured tools on isolated defects; failure must actually propagate. |

Vitest supports separate test projects and coverage configuration. Its default coverage scope does not automatically include every untested file, so configure the intended production source explicitly. Pinia's test helper stubs actions by default; tests claiming application execution must opt into real actions. [T1, T2, T3]

**TST-03 — Test public behavior.** Assert outputs, persisted content, effects and ownership—not incidental private method calls alone. Mocks verify a deliberate boundary, not an entire system fabricated to return success. Snapshots complement assertions; they do not replace validation of fields, transitions or writes.

### The test pyramid

The table above says what each concern needs. The pyramid says how much of the
system a test runs, and therefore how fast, how isolated and how often it can
run. Every test file carries one of five labels, bottom to top:

- **unit**: one module in-process, with in-memory or checked-in inputs (domain
  rules, a parser, a renderer, a repository-rule check reading checked-in files).
- **component**: a composed part in-process with its real collaborators (a Vue
  view with its Pinia store, the plugin on the in-memory Obsidian test kit, a
  terminal command or editor session driven through its presentation layer).
- **integration**: real process, filesystem or network boundaries without a
  browser or host (the CLI as a child process, temp repositories, generated
  projects on disk, loopback servers, a checker run against negative fixtures).
- **e2e**: a real browser or a real Obsidian host.
- **acceptance**: the acceptance criteria of one increment, traced to its
  handoff.

A file takes the level of the widest boundary any of its cases crosses, because
the file, not the case, is what suites schedule and what a reviewer moves. The
labels describe scope, not purpose: schema, policy and inventory checks are not
a separate "contract" layer, they are unit tests when they read checked-in files
in-process and integration tests when they run a checker as a process. Keeping
five conventional labels keeps the pyramid comparable across projects generated
from this template.

The bottom layers should be the widest: they are cheap, deterministic and
pinpoint a defect. Today the tooling side is integration-heavy because most CLI,
generator and release behavior is proven through real processes and temporary
repositories; `npm run test:suites -- --pyramid` reports the counts and warns
when a layer outgrows the one below it. The warning is a prompt to add unit
tests for new pure logic, not a gate, and never a reason to delete honest
integration tests.

End-to-end tests are expensive and need provisioning, so their place in the
pyramid is enforced. Only whole suites are e2e; each must be opt-in for
`verify` and run commands the [e2e opt-in policy](../development/WORKFLOWS.md#end-to-end-opt-in)
recognizes. Workflows run those steps on a pull request only when it carries the
`e2e` label or a run sets the `e2e` input, and always in the Release tier, where
they are mandatory. `npm run test:suites -- --check` fails when an e2e suite
escapes that policy or when a suite the policy calls end-to-end is labeled
lower. [Test suites](TEST-SUITES.md#test-pyramid-levels) lists the levels,
examples and how to label a new test.

## 4. Required scenario families

Preserve all previously specified cases for setup, makers, composition/LoC, events, modular styles, entity documents, error/notification handling and releases. The machine inventory assigns AC-01–90 an owner, risk, required modes, present evidence links and a gap statement.

For documents, test a successful complete write, invalid input with no side effect, collision, stale prepared plan, failed write, uncertain write, same-request retry, cancellation before/during write, cache lag, failed opening and failing event subscriber. Inspect actual Markdown and the existing destination; do not infer persistence from a toast.

For notifications, test effect-aware outcomes, one progress/terminal handle per operation, independent operations, persistent recovery, missing/extra expected faults, observer overflow, sink/translator failure and disposal. A production fallback can be useful while its test still fails because an unexpected defect occurred.

For the bus, test correlated types, listener order, reentrant once/unsubscribe, synchronous throws and rejected promises, late subscribers, two plugin instances, two views, startup native events and unload-before-ready. Domain facts are not native actions or durable delivery guarantees.

For setup/makers, begin with no node_modules and a different identity; test path/registry conflicts, protected directories, unchanged user files, cancellation and partial failure. A generated repository must not recursively regenerate itself indefinitely. Test the generator-of-generators once inside a bounded parent qualification job.

## 5. Determinism

**TST-04 — Controlled inputs.** Inject time, IDs, randomness and scheduling where business behavior depends on them. Prefer fixed data and explicit input partitions for examples. Property-based tests record the generator seed and shrunk replay path, retain counterexamples and replay them independently. fast-check is pinned and runs with fixed seeds in the compiler property suite (`npm run test:compiler:properties`) and the bounded mutation check. [T4]

Use fake timers for expiry/debounce tests, restore them after each case, and assert resource cleanup. Control promise interleavings with deferred barriers rather than sleep. Test date-only values under UTC, Europe/Berlin DST transitions and a negative-offset timezone without converting them into timestamps. Vitest's clock facilities and Playwright's clock controls address different execution contexts; record which one is controlled. [T5, T6]

**TST-05 — Isolation.** Fresh repositories, temp folders, stores, observers, browser contexts and namespace keys per independent case. Shared state is permitted only within a named multi-step scenario. HTTP test servers request an ephemeral loopback port and wait for a listening signal. HTTP scheduling and operating-system timing are nondeterministic; assert content/status/order guarantees rather than elapsed milliseconds.

**TST-06 — Repetition is not retry.** Baseline verification executes the complete inventory three times in fresh child processes, with zero retries. Every run must pass and have the same semantic outcome digest. Durations, random report directory names and ports are excluded from that digest; relevant source bytes and policy are hashed separately. Repeated success is evidence of repeatability under those inputs, not a mathematical proof against all nondeterminism.

Playwright Test (`retries: 0`) and Vitest (default of zero retries) follow the same no-hidden-retry principle. Diagnostic retries can be requested separately, but first-run failure remains recorded as flaky/failed and cannot become an ordinary pass. Playwright explicitly distinguishes flaky from first-run-passing cases. [T7]

## 6. Fault injection and the observer

**TST-07 — Independent failure observation.** Tests observe browser errors, console errors, rejected operations and caught application/Vue/subscriber defects through an independent ledger. Expected faults name exact code, scope and count; they fail when absent, extra or overflowing. Redaction and bounded diagnostics cannot erase the test verdict.

In production, Vue's error handler and subscriber failures report into the runtime's bounded `services.diagnostics` records, independent of debug level and log delivery; runtime tests assert those independent caught-error records, and browser tests record page and console errors. The legacy specimen keeps its test-only bounded fault ledger (`scripts/testing/fault-ledger.mjs`). That ledger is not a production logger, and no production import from scripts/testing is allowed.

Inject faults at owned ports: rejected save, denied local storage, duplicate filename, delayed readiness, out-of-order save completion, failing notification sink. Do not corrupt personal vaults or globally suppress errors. A faulty fake must be rejected by its contract tests. Negative controls include removing the host stylesheet and emitting a controlled browser console error; the corresponding positive invariant must then fail.

## 7. Coverage and completion metrics

**TST-08 — Three separate metrics.** Execution pass rate, requirement evidence and code coverage are independent. A test count never implies acceptance coverage; a requirement label never proves all its assertions; a high line percentage never proves critical failure behavior.

The runtime thresholds are enforced: `npm run test:coverage:production` gates every production TS/Vue input at 90% lines/statements/functions and 85% branches, with independent domain/application/features floors of 95% and 90% branches; `npm run test:coverage` keeps the selected-core gate, and the maker and compiler code carry their own gates (`configs/quality/thresholds.json`). Production inclusion is explicit, the coverage provider is pinned, exclusions are documented, untested files stay visible and missing or invalid coverage input fails closed. The legacy Node baseline measures no production coverage, and its report says so. [T2]

Mutation testing is used selectively to evaluate assertion strength: `npm run test:mutation` is a bounded, seeded guard qualification over selected domain validations, not a whole-program mutation score, and the compiler suite adds targeted mutation checks. A whole-program tool such as Stryker is not adopted; mutation results are additional evidence, not proof of correctness. [T8]

**TST-09 — Traceability without false completion.** Catalogue links use `partial` or `whole` extent. All declared links and required modes must be satisfied before a case is marked verified. The scope-gated report never treats inline browser results as served/native evidence. Legacy acceptance rows stay partial or not-run until whole evidence in every required mode exists; newer evidence links in additively through the [acceptance crosswalk](acceptance-crosswalk.json) ([executable evidence](EXECUTABLE-EVIDENCE.md)).

## 8. Profiles and gates

| Profile | Entry condition | Exit condition |
| --- | --- | --- |
| Baseline (implemented) | Node available, declared fixture/tool source present. | Strict plan/source inventory, exact real test IDs, all repeated runs pass, no skip/todo/empty suite or source drift. |
| Specimen browser (implemented, provisioning required) | Explicit local Playwright and browser; HTTP navigation permitted for served mode. | Twelve real browser checks per host profile, fresh contexts, exact fault expectations, stable outcomes, correct evidence mode. |
| Fast development (implemented) | Installed qualified toolchain. | `node bin/app check` runs every step without fail-fast; `check --fast` narrows tests to changed files. Both are clearly partial and never replace `verify`. |
| Pull request/full verify (implemented; browser separate) | Installed pinned toolchain. | `npm run verify` runs the static/service/coverage/artifact/baseline gates and gate fixtures; `--keep-going`, `--only`, `--skip`, `--json` and `reports/verify/summary.{json,md}` expose per-step status. Served browser evidence stays `npm run test:e2e`; native/release qualification stays separate. See [quality assurance](../development/QUALITY-ASSURANCE.md#npm-run-verify-steps-partial-runs-and-reports). |
| Template qualification (partial) | Working setup/makers. | Generator, maker and setup suites already exercise isolated generated repositories; the complete fixed set with identity/removal/installation/upgrade/release tests and no recursion is not yet established. |
| Release (blocked) | Actual candidate assets and independent host evidence. | Full requirements, approved exceptions, exact hashes/source/host/devices, no high-risk unresolved defect. |

The executable suites are separated by responsibility (runtime, CLI, generator,
companion, test data, makers, native tooling, setup, release, quality, baseline and
the opt-in browser/host suites). [Test suites](TEST-SUITES.md) lists each command,
runner, prerequisite and whether `verify` runs it; `tests/suites.json` classifies
every test file into exactly one suite and fails closed otherwise.

**TST-10 — Fail closed.** Missing tool, missing report, malformed output, zero tests, wrong test inventory, unexpected skip/todo, timeout, stale source or unclassified error cannot be a pass. Reports retain failure and blocked/not-run state. A reporter crash is an infrastructure error, not an empty finding list.

**TST-11 — Release guard.** The current release profile intentionally exits 2 as blocked. It is an honest readiness guard, not a completed release verifier. Do not remove that guard merely because the baseline is green. Implement artifact/native evidence validation in the actual release package before enabling promotion.

## 9. Accessibility, performance and security

Accessibility combines semantic/keyboard/focus assertions, automated axe scanning in the served browser suite, and manual screen-reader/native checks. Forced-colors or reduced-motion rendering is not assistive-technology certification. A CSS-backed browser dialog is not a native Obsidian Modal test. [T9]

Performance budgets require a controlled environment, warm-up policy, sample count and recorded browser/host/build. Shared CI timing is advisory unless the benchmark environment is qualified. Test resource counts after repeated lifecycle operations; do not infer leaks solely from noisy memory samples.

Security checks include synthetic hostile input, path containment, allowlisted HTTP routes, fixture-only data, redacted artifacts, no runtime test hooks, no publication secrets in PR jobs, and validated installed dependencies. Source regex tripwires are labeled as such: they are not a parser, penetration test, or proof of complete security.

## 10. Maintenance and governance

**TST-12 — Defect workflow.** Record a reproducible case, risk, affected scope/source, expected/actual behavior, evidence and owner. Reproduce before fixing when possible; add the narrow regression test and run affected broader levels. Never delete a failing test solely to finish a feature.

**TST-13 — Flake policy.** Investigate nondeterministic inputs and ownership first. A temporary quarantine requires owner, reason, tracking issue and expiry; critical safety cases cannot be silently quarantined. Required gate failure remains visible until explicitly approved resolution. The current baseline accepts no quarantine/skip.

**TST-14 — Upgrade policy.** Analyzer, parser, runner and compiler upgrades must re-run their negative fixtures and maker/artifact tests. Screenshot updates are separate reviewed changes. Native/fixture version metadata distinguishes a source change from an actual host comparison.

**TST-15 — Evidence retention.** Store JSON, readable summary and JUnit with source/input fingerprints and exact mode/tool/environment. Keep failure traces/screenshots bounded and synthetic. Reports are outputs, not committed pass badges. Integrity hashes bind bytes; they are not signatures or protection from a trusted maintainer modifying reports/code.

**TST-16 — Incremental implementation.** Preserve existing requirements and make progress visible. The qualified baseline, the Vitest/Playwright Test stack, the real services and components and the caught-defect observer exist; native, device and release qualification are the remaining steps. Do not add competing permanent test stacks or ship a fake all-green runtime suite.

## 11. Sources

Primary documentation consulted 2026-09-22; qualify library capabilities against the versions pinned in `package-lock.json`.

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

This page states practice and rules, not results. Execution results belong to dated records in the [archive](../_archive/README.md), starting with the first [verification record](../_archive/testing/2026-09-22-verification-record.md), and to the reports of each actual run.
