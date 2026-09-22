# TypeScript quality tools — adoption and verification plan

**Date:** 2026-09-23  
**Status:** proposed implementation work; this documentation change installs no tools  
**Baseline:** `8ea6e938d978d25328c6c3527a801af98265a573`  
**Rationale and primary sources:** [Research report](../research/2026-09-23-typescript-quality-tools.md)

## 1. Scope and invariants

Extend the current quality system without replacing working checks or advertising unfinished capabilities. The [test strategy](../testing/TEST-STRATEGY.md), [test concept](../testing/TEST-CONCEPT.md), [agent instructions](../../AGENTS.md) and existing acceptance requirements remain authoritative. This plan does not change the current dependency-support exception or establish release readiness.

Keep Node 24.21.0/npm 11.19.1 as the documented qualified pair unless a separately verified change replaces it. Preserve the exact lockfile, narrow installation hooks, TypeScript/parser compatibility, source limits, output containment and independently provisioned host tests. Every new package must be assessed against the actual selected versions, particularly ESLint 10, Vitest 5, Vue SFCs and the native bundler.

The work packages below are proposals, not existing command names or completed backlog items. Add commands and help entries only when their implementation and negative controls exist. Put owned orchestration under `scripts/`, not in opaque shell chains or runtime plugin modules.

## 2. Work packages

### QT-00 — Establish the acceptance baseline

**Owner:** template maintainer. **Prerequisite:** none. **Scope:** no new analyzer.

Capture the source revision, toolchain, installed dependency graph, current gate inputs, exclusions and report schemas. Distinguish the selected-core coverage gate from the complete production inventory. Record the currently separate static, browser, security and native modes. Read the [dependency exception](ITERATION-TWO-DEPENDENCY-EXCEPTION.md) before attempting package updates.

**Acceptance:** a reviewer can identify which command checks each owned source category and which checks are not part of `verify`. Missing reports, unavailable registries and unprovisioned browsers have explicit error/not-run states. Existing thresholds and fixtures are unchanged. Benchmark any new candidate against this baseline rather than importing an upstream performance claim.

### QT-01 — Expand typed and test-quality checks

**Owner:** TypeScript maintainer. **Prerequisite:** QT-00.

Review typescript-eslint's type-checked preset and curated unsafe-operation/exhaustiveness rules. Add explicit configurations for `src`, runtime tests, E2E tests, harness sources and owned tooling. Keep `.mjs` scripts in a suitable JavaScript configuration and ensure Vue files retain the correct parser chain. Review optional-property semantics and promise handling as separate behavioral changes.

Preserve `tests/runtime/types.ts`. Add compiler-backed contract cases for event correlation, document entities, outcomes and cleanup handles. A Vitest type-test project is optional when it improves reporting; it must invoke a compiler and must not silently replace vue-tsc's SFC coverage. Trial the Vitest and Playwright ESLint plugins only after checking compatible published peer ranges. Avoid duplicate rule ownership between Oxlint and ESLint.

**Acceptance:** unsafe typed usage, an unhandled operation, a non-exhaustive result branch, an invalid event payload, a focused test and a missing browser await each fail their intended checker. A valid async UI handler passes and still reports unexpected rejection through the independent observer. Newly included tooling can be linted without unsafe casts, blanket exclusions or disabling official Obsidian rules.

### QT-02 — Select and qualify one formatter

**Owner:** developer-experience maintainer. **Prerequisite:** QT-00.

Compare Prettier and Oxfmt on representative TypeScript, Vue, CSS, JSON, YAML and Markdown files. Select one; document formatting choices and exact version. Initially leave import sorting and Tailwind class reordering disabled. Define narrowly justified exclusions for vendor/extracted assets, hash-guarded sources and byte-sensitive fixtures.

Perform a separately reviewed formatting change. Refactor owned files that exceed existing physical line limits after formatting; do not increase the limits. Once makers exist, apply the same formatting contract to their generated output.

**Acceptance:** check mode detects a deliberate formatting defect; a second write-format pass makes no further changes; exact Markdown outputs, source-hash guards, source limits and build checks still pass. The CI mode never rewrites files. Verify both an excluded immutable fixture and an included owned source file so an overly broad ignore cannot masquerade as success.

### QT-03 — Add property-based tests for data safety

**Owner:** application/test maintainer. **Prerequisites:** QT-00 and stable deterministic example tests.

Add a qualified fast-check release as a development dependency and execute it through the existing test stack. Start with pure validation and serialization, then real application services using controlled ports. Use explicit valid/invalid partitions rather than rejecting almost every generated input.

| Property family | Required observation |
| --- | --- |
| Task Markdown | Accepted fields round-trip under the supported schema; hostile or rejected inputs do not create a file. |
| Preview and conflicts | Preview has zero writes; a conflicting destination retains its original bytes. |
| Uncertain persistence | Subsequent actions cannot create a duplicate through blind retry; the original operation identity/path remains observable. |
| Post-commit failures | Failure to notify, publish to one subscriber or open the note does not erase the successful persistence outcome. |
| Preferences | Controlled interleavings preserve the intended serialized snapshots and local drafts. |
| Event ownership | Disposal and repeated subscribe/unsubscribe sequences do not retain listeners or deliver to an abandoned view. |
| Date-only values | Calendar values survive configured timezone/DST cases without accidental timestamp conversion. |

**Acceptance:** retain seed, shrink path and any model replay path with the failing counterexample; replay reproduces it in a fresh process. Commit minimized regressions as ordinary examples where appropriate. Bound operations and restore injected clocks, schedulers and subscriptions. Suggested starting budgets are 100 cases per selected property in PRs and 1,000 in an expanded job; these are planning values to calibrate, not measured requirements. No retry may erase the first failure.

### QT-04 — Integrate rendered accessibility checks

**Owner:** UI/accessibility maintainer. **Prerequisite:** a provisioned served Playwright harness.

Add `@axe-core/playwright` to the existing real-component browser suite. Define a shared fixture describing plugin-owned roots and overlays. Exercise all four panels, form errors, pending operations, dialogs and menus, including teleported content and two-leaf ownership where applicable. Record which language/theme/state combinations actually ran.

Pair scans with keyboard activation, focus order/return, accessible names and recovery-action assertions. Keep manual screen-reader and native-host acceptance distinct. Consider Vue template accessibility linting only for a demonstrated earlier-feedback benefit.

**Acceptance:** an intentionally unlabeled control inside a plugin-owned overlay is detected. Normal supported states produce no unaccepted findings under the agreed rule policy. The fixture cannot obtain a pass by excluding the whole plugin or by never opening an overlay. Store redacted scan output; do not turn broad suppression or an automatically accepted snapshot into the policy.

### QT-05 — Trial selective mutation testing

**Owner:** application/test maintainer. **Prerequisites:** QT-00, deterministic critical-service tests; QT-03 is beneficial but not mandatory.

Qualify a matched published StrykerJS core/Vitest-runner combination against the pinned Vitest 5 stack. Run a small Node-only trial first. Confirm actual mutation execution, test discovery, source mapping, timeouts and report production. Do not downgrade existing dependencies or imply Vue browser/native mutation support merely because this trial succeeds.

Begin with validation, collision handling, uncertain-write transitions, serialized preference writes and post-commit error classification. Separate run failures from mutation findings. Review surviving and uncovered mutations, including suspected equivalent cases. Start advisory, then set a documented non-regression policy based on the inspected baseline; do not select an arbitrary impressive score.

**Acceptance:** representative corruptions of critical guards are caught by assertions; a mutation report identifies the exercised files and effective exclusions. A missing report, zero selected mutants, failed runner or timed-out infrastructure does not pass. Preserve runtime coverage requirements: mutation score is additional evidence, not a substitute.

### QT-06 — Add owned-style and documentation checks

**Owner:** UI and documentation maintainers. **Prerequisite:** QT-00; coordinate with QT-02.

Trial Stylelint on owned CSS and Vue styles using appropriate syntax support and narrow allowances for Tailwind directives. Preserve the current token and final-artifact containment checks. Add a small Markdown convention policy and CSpell dictionaries for the actual English/German content, with reviewed domain terms rather than blanket spelling suppression.

Use TSDoc/TypeDoc later for stabilized extension contracts. Ensure generated documentation distinguishes public interfaces, internal adapters and unimplemented roadmap items.

**Acceptance:** invalid owned CSS, an unscoped selector, malformed Markdown and a misspelling fail their respective checks. Valid framework syntax and intentional domain terms pass. No formatter/linter conflict creates an endless rewrite cycle. Third-party or extracted sources retain their provenance rather than being silently rewritten.

### QT-07 — Extend security and workflow assurance

**Owner:** repository/security maintainer. **Prerequisite:** QT-00 and the required platform authorization.

Introduce actionlint and a pinned Gitleaks execution path with synthetic, redacted negative controls. Trial CodeQL and dependency review in separate, explicitly scoped jobs. Document entitlement and setup requirements for public and private template consumers. Keep the existing all-category live audit, dependency policy and install-hook checks independent.

Choose at most one dependency-update service. Group tightly coupled tooling updates and require the appropriate strict installation, negative probes, UI/build and native evidence. Do not auto-merge incompatible compiler upgrades, broaden install-script allowances, or raise the host floor through routine dependency maintenance.

**Acceptance:** a malformed workflow and a synthetic secret are detected. A controlled vulnerable dependency change demonstrates dependency-review behavior, while an existing vulnerability still fails the full audit. Source-analysis limitations for custom host APIs are recorded. Missing authorization, unsupported account features and scanner failures cannot appear as clean results. Enabling permissions, apps, secrets or branch protection requires its own authorized configuration change; this plan performs none.

### QT-08 — Improve existing architecture and bundle reporting

**Owner:** architecture/build maintainer. **Prerequisite:** QT-00.

Review bootstrap-to-test/harness/tooling allowances in `.fallowrc.json` and tighten them where production composition does not require them. Evaluate additional Fallow complexity/duplication/cycle capabilities against the pinned version before adding another analyzer. Introduce only useful, understood metrics and avoid grading developers by a synthetic aggregate score.

Keep current native artifact byte limits. Add a baseline/delta report first; trial a bundle visualizer only when module attribution is useful and compatible with the actual native build. Preserve the frozen candidate: diagnostics should be generated during its build, not by rebuilding after native acceptance. Reports never enter `dist` or the install ZIP.

**Acceptance:** allowed composition works, an intentional forbidden resolved import fails, and newly created unclassified source is rejected by coverage policy. An oversized JavaScript/CSS candidate fails the existing artifact gate. Any visualization describes the native output rather than a different harness bundle. Missing analyzer output and incompatible schemas fail closed.

## 3. Qualification fixtures and negative controls

These are proposed identifiers for new gate fixtures, not claims that corresponding files already exist. Integrate them with the current machine inventory without relabeling unrelated earlier acceptance cases.

| Identifier | Deliberate defect | Required failure evidence |
| --- | --- | --- |
| QT-TYPE-01 | Wrong correlated event payload or newly legal negative contract | Compiler-backed type check fails. |
| QT-LINT-01 | Unsafe typed operation in a covered source category | Actual configured typed rule fails. |
| QT-TEST-01 | Focused test or unawaited browser operation | Matching scoped test-lint rule fails. |
| QT-FMT-01 | Misformatted owned source | Read-only formatter check fails; repeated formatting is stable. |
| QT-PROP-01 | Faulty collision/preview implementation | A property exposes the failure and its recorded replay reproduces it. |
| QT-A11Y-01 | Unlabeled control in an opened plugin-owned overlay | Served accessibility scan includes and reports that control. |
| QT-MUT-01 | Removed critical guard | Mutation is executed and detected; empty selection is an error. |
| QT-CSS-01 | Invalid declaration and unscoped selector | Stylelint and containment checks detect their respective defects. |
| QT-SEC-01 | Synthetic secret or malformed workflow | Scanner reports the exact synthetic case without leaking credentials. |
| QT-ARCH-01 | Forbidden bootstrap import or unclassified source | Resolved boundary/coverage gate fails. |
| QT-ART-01 | Oversized output or report leaked into install files | Existing artifact checks fail. |

Every negative control needs a nearby valid case. Run controls in isolated copies or temporary inputs; never alter a personal vault, weaken ordinary gates, or ship the intentionally faulty fixture. Unexpected skipped tests, absent tools, invalid reports and checker crashes must retain a failed/blocked status.

## 4. CI placement and execution policy

| Profile | Proposed additions | Evidence boundary |
| --- | --- | --- |
| Fast local feedback | Formatting check, scoped lint, compiler/type contracts, focused tests | Partial development feedback, not full acceptance. |
| Pull request | Qualified static checks, existing full verification, bounded properties, existing coverage policies; security/workflow jobs as configured | Must preserve every current required gate and report actual inputs. |
| Served browser | axe scans plus explicit interaction/focus assertions | Provision browser separately; not native evidence. |
| Expanded analysis | More property inputs, selective mutation, optional dependency/bundle trend reports | Heavier work can run separately; a known critical defect cannot be ignored because its discovery job was advisory. |
| Native/release | Existing isolated host, candidate-hash and acceptance workflow | New static tools do not discharge device, theme, native UI or release requirements. |

No schedule or automation is created by this documentation. When implementation adds CI jobs, preserve the no-hidden-retry policy, bounded artifacts, minimal permissions and independent failure observation. Local hooks can provide convenience but cannot be the sole enforcement mechanism because they are bypassable; no new hook is required by this plan.

## 5. Evidence and completion contract

Each adopted check records its exact package/CLI versions, source revision, command and relevant configuration, input inventory, exclusions, environment, exit status, report location and positive/negative qualification results. Record seeds and replay metadata for generated failures; record selected mutation scope and outcomes for mutation analysis. Never publish personal vault contents, credential material or licensed host/font binaries as evidence.

A work package is complete only when its intended checks run against the declared inputs, deliberate defects are detected, findings are actionable, documentation/help matches the implemented commands, and the normal repository gates still pass. An exception requires a reason, owner, bounded scope and review condition. Removing an existing check requires an independently demonstrated equivalent replacement, not a cleaner dashboard.

**Delivery boundary for this change:** research, adoption plan and documentation navigation only. No dependencies, runtime source, lockfile, test configuration, quality thresholds, workflow permissions, schedules or release settings are changed. No new test pass, compatibility result or performance measurement is claimed.
