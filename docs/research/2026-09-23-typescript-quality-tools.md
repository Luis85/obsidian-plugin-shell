# TypeScript quality tools for Obsidian Plugin Shell

**Research date:** 2026-09-23  
**Status:** researched recommendations; not an installation or qualification record  
**Repository baseline:** `8ea6e938d978d25328c6c3527a801af98265a573` on `main`, after the merge of PR #1  
**Delivery companion:** [Adoption and verification plan](../development/TYPESCRIPT-QUALITY-TOOLS-PLAN.md)

## 1. Recommendation

Improve the effectiveness and coverage of the existing stack before expanding its dependency graph. The most useful additions are **fast-check for generated behavioral tests, axe for rendered accessibility checks, one formatter, and test-specific lint rules**. Trial **StrykerJS** next to measure assertion strength in critical services. Stronger type-aware rules and broader lint coverage are configuration improvements to tools already present, not reasons to introduce another general-purpose linter.

Do not install every tool in this report. The proposed sequence is: strengthen existing checks; add small, complementary developer checks; extend behavioral and accessibility evidence; then qualify heavier or platform-dependent analysis. Keep Fallow as the primary dependency/architecture analyzer and preserve the native-host, artifact and data-safety checks that generic TypeScript tools cannot replace.

This assessment combines inspection of the repository's actual configuration with primary documentation and upstream repositories. Tool capabilities, project recommendations and executed evidence are distinguished throughout. No candidate packages were installed, no benchmark or new runtime test was executed, and no claim is made that a permissive peer range proves compatibility. Existing execution results remain in the [iteration-two test record](../testing/ITERATION-TWO.md).

## 2. What the template already has

The inspected [package manifest](../../package.json) pins TypeScript 6.0.3, typescript-eslint 8.70.1, ESLint 10.11.0, Oxlint 1.85.0, Fallow 3.28.0, vue-tsc 3.3.11, Vitest 5.0.1 and Playwright 1.63.0. These are observed repository versions, not recommendations to install the latest version of every package.

| Area | Observed implementation | Consequence for this research |
| --- | --- | --- |
| Compiler checks | [tsconfig.json](../../tsconfig.json) enables `strict` and `noUncheckedIndexedAccess`; `typecheck` invokes vue-tsc. | Preserve Vue SFC checking. Consider additional compiler options incrementally. |
| Semantic linting | [ESLint configuration](../../eslint.config.mjs) combines TypeScript, Vue and official Obsidian rules, project-service parsing and two explicit promise rules. | Typed linting already exists, but the broader typescript-eslint `recommendedTypeChecked` preset is not enabled. |
| Lint scope | [verify.mjs](../../scripts/quality/verify.mjs) runs both linters against `src`, with warnings rejected. | Tests, harness code and tooling need deliberate lint scopes rather than an assumed repository-wide guarantee. |
| Dependency and architecture analysis | [.fallowrc.json](../../.fallowrc.json) defines zones and complete file coverage; [the boundary gate](../../scripts/quality/check-architecture.mjs) checks resolved Fallow results. | Knip or dependency-cruiser would overlap substantially; architecture checking is not missing. |
| Runtime tests and coverage | [Vitest configuration](../../vitest.config.mjs) gates a selected core; the separate production command includes an inventory check. | Keep selected-core and whole-production coverage distinct. Coverage percentage does not establish assertion strength. |
| Type contracts | [tests/runtime/types.ts](../../tests/runtime/types.ts) includes positive cases and `@ts-expect-error` cases for event and document contracts. | Extend and report these contracts; do not describe type testing as absent. |
| Artifact containment | [Artifact checks](../../scripts/quality/check-artifacts.mjs) verify the three-file output, CJS host entry, notices, CSS containment, development leaks and hashes. | A generic bundle-size package would not replace these checks. |
| Existing size budgets | The artifact gate caps raw JavaScript at 1 MiB and CSS at 100 KiB. | Size Limit is optional, not a missing baseline safeguard. |
| Repository-specific policy | [Source checks](../../scripts/quality/check-source.mjs), token checks and gate fixtures enforce additional constraints. | Preserve line limits, localization parity, style containment and real negative controls. |
| Security | Separate dependency-policy and live all-category audit commands exist. | New security tools should cover different risks, not weaken or silently replace the existing audit. |

The [test strategy](../testing/TEST-STRATEGY.md) already proposes fast-check, selective mutation testing and automated accessibility scanning. The recommendations below operationalize that roadmap; they do not retroactively mark it implemented. The [dependency-support exception](../development/ITERATION-TWO-DEPENDENCY-EXCEPTION.md) also remains open. A root ESLint 10 installation and a clean vulnerability audit do not resolve the recorded nested dependency-support issue.

## 3. Priority and ownership

Priority describes proposed adoption order, not current implementation status. Each detection domain should have one primary owner; overlap is justified only where an independent check covers a demonstrated blind spot.

| Priority | Tool or change | Primary value for this template | Decision |
| --- | --- | --- | --- |
| P0 | Existing typescript-eslint, vue-tsc and compiler configuration | Unsafe typed operations, missing cases, public contract regressions and unlinted owned code | Strengthen first. |
| P1 | Prettier or Oxfmt | Predictable formatting across TypeScript, Vue, CSS and Markdown | Select one after a representative-file trial. |
| P1 | `@vitest/eslint-plugin`, `eslint-plugin-playwright` | Defects in tests themselves, including missing awaits and focused tests | Add scoped rules after peer compatibility checks. |
| P1 | fast-check | Input combinations and state transitions affecting canonical Markdown and preferences | Highest-priority new behavioral test dependency. |
| P1 | `@axe-core/playwright` | Accessibility defects in the actual rendered Nuxt UI harness | Integrate into the existing browser suite. |
| P2 | StrykerJS with its Vitest runner | Whether critical assertions detect faulty implementations | Compatibility trial, then a focused mutation job. |
| P2 | Stylelint | Owned CSS correctness beyond the custom host-containment checks | Adopt a narrow, Tailwind-aware configuration. |
| P2 | CodeQL, dependency review, Gitleaks, actionlint | Complementary source, dependency-diff, secret and workflow risks | Introduce separately with explicit platform and permission requirements. |
| P2 | markdownlint, CSpell; later TSDoc/TypeDoc | Documentation consistency and maintainable extension contracts | Keep the initial policy small and actionable. |
| Conditional | Fallow additional modes and bundle visualization | Complexity/duplication trends and native bundle attribution | Reuse existing analysis first; report before adding new gates. |

## 4. Strengthen the tools already installed

### 4.1 Type-aware ESLint and compiler policy

TypeScript-aware presets can use type information to find defects beyond syntax-level linting. The current configuration enables the Obsidian package's type-checked rules but uses typescript-eslint's ordinary `recommended` preset. Review `recommendedTypeChecked`, then explicitly consider the `no-unsafe-*` rules and `switch-exhaustiveness-check` for discriminated outcomes. Do not enable an entire stricter preset without evaluating its effect on Vue and the host adapters. [S01], [S02]

For this plugin, prioritize unchecked stored data reaching services, incorrect handling of operation outcomes, and asynchronous lifecycle failures. Extend coverage to runtime tests, E2E tests, harness code and owned `.mjs` scripts using appropriate configurations. Do not force JavaScript tooling or every configuration file into an unrelated TypeScript project merely to satisfy the parser.

Review `exactOptionalPropertyTypes` for contracts where an absent field differs from an explicitly undefined field. Introduce it with migration tests rather than an automatic compiler-policy change. The option tightens assignment behavior for optional properties; it is not runtime validation. [S03]

A particularly important limitation: `void somePromise()` can satisfy the default `no-floating-promises` policy without handling rejection. Retain real error observation and explicit rejection handling at lifecycle boundaries; syntax alone must not become evidence of safe asynchronous behavior. Review the current attribute exception in `no-misused-promises` against the actual UI bindings rather than removing or expanding it blindly. [S04]

### 4.2 Type-contract tests through the existing compiler

Vitest provides `expectTypeOf` and `assertType`, with separate compiler-backed type testing. Ordinary transpiled test execution is not equivalent to running those checks. Preserve the existing vue-tsc negative fixtures and, where clearer reporting helps, add a dedicated type-test project configured and invoked explicitly. [S05]

Recommended contracts include correlated event names/payloads, entity keys and input fields, operation-result discrimination, subscription cleanup handles and adapter interfaces. A deliberate type mismatch must fail the actual CI command; widening the contract so a negative case becomes legal must also fail. Avoid installing a second type-testing framework merely to rename tests that already work. Revisit declaration-package tooling only if the project later publishes a reusable SDK.

### 4.3 Fallow remains the primary analyzer

Fallow documents analysis beyond unused code, including architecture, duplication and complexity. That does not mean every available mode is active in this repository's `dead-code` invocation. Inspect the selected version's configuration and reports before deciding which additional modes to expose. [S06]

One concrete policy review is already visible: the bootstrap zone currently allows imports from test, harness and tooling zones. Consider tightening production bootstrap boundaries, with positive composition-root examples and deliberately forbidden imports. This is a policy recommendation, not evidence that such imports currently exist. Add cycle or complexity reporting through the existing analyzer where its qualified capabilities fit; do not infer that these checks already block changes.

## 5. Complementary tools worth adding

### 5.1 One formatter: Prettier as the conservative default, Oxfmt as a candidate

Prettier is a dedicated formatting option. Oxfmt's current documentation also lists Vue, CSS, JSON, YAML and Markdown support, so dismissing it as TypeScript-only would be inaccurate. Because Oxlint is already present, Oxfmt deserves a representative-file comparison, but sharing an ecosystem is not itself a qualification result. [S07], [S08]

My recommendation is to select Prettier unless the Oxfmt trial demonstrates equivalent required behavior and acceptable maintenance characteristics. Run the trial on SFCs, decorators or other syntax actually used, scripts, Markdown code fences and modular CSS. Use only one formatter in CI and editors.

Keep import sorting and Tailwind class reordering out of the initial adoption. Preserve order-sensitive imports, exact Markdown expectations, generated/vendor provenance and source-hash-guarded files. Formatting may increase physical line counts: refactor oversized owned files instead of raising the repository's 400/450-line limits. A formatting-only change should be reviewed separately from behavioral changes.

### 5.2 Lint the tests with test-specific rules

The Vitest and Playwright ESLint plugins provide rules aimed at test correctness, not application behavior. Relevant examples include expectation usage, focused tests and missing awaits on Playwright operations. [S09], [S10]

Scope each plugin to its matching test suite and select rules against the repository's actual failure modes. Preserve deliberate fault injection and native-driver constraints rather than enabling every stylistic recommendation. Compare existing Oxlint coverage before assigning duplicate ownership. Verify the selected releases' ESLint 10 peer support and actual rule execution; a package name in configuration is not proof that its rules run.

For this template, the acceptance test is straightforward: an isolated focused test, a missing awaited browser action, and an invalid assertion must each cause the real configured checker to fail. Exclude those intentionally broken fixtures only from ordinary positive runs, never from gate qualification.

### 5.3 fast-check: generated inputs and stateful properties

fast-check generates test inputs and shrinks failures into smaller counterexamples. It can complement existing Vitest examples without replacing the runner. Replay depends on retaining the reported seed and path; model-based scenarios can additionally require their command replay path. [S11], [S12], [S13]

Start with project-specific invariants: preview never writes; rejected input creates no note; accepted Task values serialize and parse according to the supported schema; conflict handling preserves existing bytes; uncertain writes cannot create a second note through blind retry; committed writes are not relabeled as failures because a subscriber or opening action fails. Generate Unicode, separators, YAML-sensitive characters, empty values and date-only boundaries within explicit valid/invalid input partitions.

Then model preference saves, subscription disposal and document-operation transitions using the real services with controlled ports. Avoid reproducing the same implementation algorithm in the test oracle. Inject scheduling barriers rather than sleeping. A timeout around a promise does not by itself cancel the work, so bound generated operations and ensure cleanup. [S14]

Use a committed counterexample corpus plus bounded generated runs. Fixed replay inputs support regression checks; expanded runs may vary seeds provided every failure records enough information to reproduce it. Repetition must not turn a first failure into a passing retry.

### 5.4 axe in the existing Playwright harness

`@axe-core/playwright` integrates automated accessibility scans with Playwright and can inspect a page after interactions reveal controls or overlays. It detects some common accessibility defects but does not establish complete accessibility or replace manual assessment. [S15]

For this plugin, scan Overview, Documents, Events & feedback and Preferences in relevant states: validation errors, disabled/pending actions, menus and dialogs. Exercise both supported interface languages and host-owned light/dark styling where the harness can represent them. Include every plugin-owned teleported overlay, not just descendants of the main root. Do not accidentally scan unrelated host chrome and then suppress large containers to get a clean result.

Keep explicit keyboard, focus-return and recovery-action assertions. Add a deliberately unlabeled control to an isolated fixture to prove the scan reaches it. Browser results remain browser evidence; real Obsidian modal behavior, screen-reader use and supported device acceptance need their own qualification. A Vue accessibility lint plugin is an optional earlier check, but it cannot substitute for inspecting rendered Nuxt UI controls. [S16]

### 5.5 StrykerJS: selective mutation testing

Stryker's Vitest runner executes tests against mutated implementations. Its documented integration requires the project's Vitest installation, with runner-specific configuration and limitations. This is a tool for investigating assertion strength, not a replacement for coverage or native testing. [S17]

Trial it on domain validation, document state transitions, preference serialization and event/error policies. Good targets include removing the conflict guard, treating uncertain persistence as safely retryable, or converting a post-commit notification failure into a failed write. Avoid starting with the complete Vue/Nuxt UI bundle or assuming that browser/native tests are part of a Node mutation run.

Compatibility is an explicit open question: the upstream development manifest inspected for this research declares a broad Vitest peer range, while its own development dependency was Vitest 4.1.11. This repository uses Vitest 5.0.1. A development-branch manifest and permissive peers are not proof that a particular published runner supports this exact stack. Qualify matched published Stryker packages with a real smoke mutation; do not downgrade the template merely to install the tool. [S18]

Start with an advisory report and explicit critical-guard mutations. Review survivors, uncovered code, exclusions and equivalent mutations before setting a score threshold. Keep execution failures distinct from genuine mutation results; no missing report or empty mutation set may become a green percentage.

### 5.6 Stylelint for owned styles

Stylelint adds CSS-specific checking and configurable rules. Its role here would be correctness and maintainability of owned styles, not replacement of the existing selector scoping, token, namespace and artifact checks. [S19]

Qualify the configuration against Tailwind 4 directives, composed CSS modules and Vue style blocks with the appropriate syntax support. Use narrow allowances for intentional framework syntax. Do not lint extracted host CSS or third-party output as if the template authored it, and do not hide all application CSS behind a broad ignore. A malformed declaration should fail Stylelint; an unscoped selector should continue failing the existing containment gate.

### 5.7 Security and workflow checks

CodeQL provides JavaScript/TypeScript source analysis. Dependency review evaluates dependency changes in pull requests. These cover different questions from the existing whole-tree vulnerability audit. Availability and setup differ between public repositories and private template consumers; do not assume that every generated repository has the same entitlements. [S20], [S21]

For this project, trial CodeQL against synthetic source-to-sink examples relevant to path handling or unsafe rendering, while recognizing that custom Obsidian APIs may need additional modeling. Keep all-category audit results independent: dependency review should not conceal an existing vulnerability merely because it was not introduced in the current diff.

Gitleaks is useful for repository/history secret scanning; actionlint checks GitHub Actions workflows. Use synthetic canaries and redacted evidence, not actual credentials. Pin CLI or action versions, qualify installation on supported development platforms and avoid expanding workflow permissions unnecessarily. These tools do not belong in the shipped plugin. [S22], [S23]

A single dependency-update service can support this policy. Renovate documents grouping, pinning and scheduling controls; use Renovate or the team's chosen alternative, not competing bots. Group tightly coupled tooling, preserve exact-lock and install-hook policy, and require reviewed compiler/linter, UI/bundler and native qualification as appropriate. This research does not activate a bot or change repository security settings. [S24]

### 5.8 Documentation and public contracts

markdownlint checks Markdown conventions; CSpell can check spelling with a project dictionary. Use them on owned documentation and relevant interface text, with deliberate English/German dictionaries and a small vocabulary for Obsidian, Nuxt and domain terms. These checks do not verify whether the documented behavior is true. [S25], [S26]

TSDoc supplies structured comment conventions and TypeDoc can generate documentation from TypeScript entry points. They become more valuable as reusable entity, event, adapter and maker contracts stabilize. Document supported extension points rather than exposing every internal symbol or making comment volume a proxy for quality. Generation must not convert a pending maker into an advertised working capability. [S27], [S28]

## 6. Tools to defer or use only for a demonstrated gap

| Candidate | Research finding | Project decision |
| --- | --- | --- |
| Knip | Finds unused files, dependencies and exports, with framework-aware discovery. [S29] | Useful alternative, but substantial overlap with Fallow. Require a reproducible missed case before installing both. |
| dependency-cruiser | Supports dependency rules and dependency visualization. [S30] | Consider only for an unmet rule or visualization need; do not replace working Fallow boundary gates without equivalent negative probes. |
| Biome | Current language-support documentation still marks Vue support experimental. [S31] | Not a drop-in replacement for this Vue/Obsidian lint stack; formatting and host-rule parity would need separate proof. |
| Oxlint type-aware mode | Uses additional type-aware infrastructure and documents a dedicated installation/invocation. [S32] | Evaluate only after pinned TypeScript, Vue and rule parity are established. Do not assume it replaces vue-tsc or official Obsidian rules. |
| SonarJS/SonarQube | A broader JavaScript/TypeScript analysis ecosystem exists in the current SonarJS project. [S33] | Optional for organization-wide reporting. Avoid overlapping default complexity/duplication policies and old archived plugin guidance. |
| Size Limit | Provides package-size budgeting and related analysis. [S34] | The template already gates raw native artifact sizes. Add only for a distinct, agreed measurement or reporting need. |
| Bundle visualizer | Can attribute modules and sizes in bundler output. [S35] | Useful diagnostic report; qualify the plugin against the actual native bundler, not just the browser harness. |

For bundle analysis, first add a change-versus-baseline report to the existing byte budgets and identify which dependencies enter `dist/main.js`. A web-harness measurement is not a native-plugin measurement, and compressed transfer size is not startup time. Keep visualization output under reports, not the three-file install artifact. Never rebuild a supposedly frozen native-qualified candidate merely to obtain a report.

## 7. Compatibility and rollout guardrails

At the research date, typescript-eslint documents TypeScript support `>=4.8.4 <6.1.0` and ESLint support including major 10. This supports retaining the repository's TypeScript 6.0.3 choice; it does not establish support for every plugin or nested dependency. Check each exact selected release rather than treating one package's range as the whole graph's compatibility policy. [S36]

Before adopting a tool, require a strict clean installation, a declared input inventory, a positive case and a real negative control, actionable reporting, and a documented owner. Evaluate wall time and memory on representative repository inputs rather than citing upstream speed claims as local measurements. Add development dependencies only where necessary; keep analyzers, test adapters and report generators out of runtime artifacts.

Use new gates first on a bounded scope, resolve their findings, and then make the agreed scope blocking. Do not blanket-ignore directories, weaken existing thresholds, silently accept snapshot changes or interpret a scanner error as zero findings. Every temporary exception needs a reason, owner, scope and review condition. Existing release-readiness gaps and the dependency-support exception remain visible.

## 8. Primary sources

Sources were consulted on 2026-09-23. Documentation and default-branch source describe upstream capabilities at the time of inspection; they are not a compatibility certificate for untested package combinations. Numbered references are used throughout the assessment.

| Ref | Primary source |
| --- | --- |
| S01 | [typescript-eslint: typed linting](https://typescript-eslint.io/getting-started/typed-linting/) |
| S02 | [typescript-eslint: exhaustive switch checking](https://typescript-eslint.io/rules/switch-exhaustiveness-check/) |
| S03 | [TypeScript: exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html) |
| S04 | [typescript-eslint: no-floating-promises and void](https://typescript-eslint.io/rules/no-floating-promises/) |
| S05 | [Vitest: testing types](https://vitest.dev/guide/testing-types) |
| S06 | [Fallow: official repository](https://github.com/fallow-rs/fallow) |
| S07 | [Prettier: documentation](https://prettier.io/docs/index.html) |
| S08 | [Oxfmt: formatter guide](https://oxc.rs/docs/guide/usage/formatter) |
| S09 | [Vitest ESLint plugin](https://github.com/vitest-dev/eslint-plugin-vitest) |
| S10 | [Playwright ESLint plugin](https://github.com/mskelton/eslint-plugin-playwright) |
| S11 | [fast-check: introduction](https://fast-check.dev/docs/introduction/) |
| S12 | [fast-check: reading and replaying reports](https://fast-check.dev/docs/tutorials/quick-start/read-test-reports/) |
| S13 | [fast-check: model-based testing](https://fast-check.dev/docs/advanced/model-based-testing/) |
| S14 | [fast-check: timeouts and asynchronous work](https://fast-check.dev/docs/configuration/timeouts/) |
| S15 | [Playwright: accessibility testing with axe](https://playwright.dev/docs/accessibility-testing) |
| S16 | [Vue accessibility ESLint plugin](https://github.com/vue-a11y/eslint-plugin-vuejs-accessibility) |
| S17 | [StrykerJS: Vitest runner](https://stryker-mutator.io/docs/stryker-js/vitest-runner/) |
| S18 | [StrykerJS: development-branch Vitest runner manifest](https://github.com/stryker-mutator/stryker-js/blob/master/packages/vitest-runner/package.json) |
| S19 | [Stylelint: configuration](https://stylelint.io/user-guide/configure/) |
| S20 | [GitHub: CodeQL code scanning](https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-code-scanning) |
| S21 | [GitHub: dependency review](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review) |
| S22 | [Gitleaks: official repository](https://github.com/gitleaks/gitleaks) |
| S23 | [actionlint: official repository](https://github.com/rhysd/actionlint) |
| S24 | [Renovate: configuration options](https://docs.renovatebot.com/configuration-options/) |
| S25 | [markdownlint: official repository](https://github.com/DavidAnson/markdownlint) |
| S26 | [CSpell: documentation](https://cspell.org/) |
| S27 | [TSDoc: documentation](https://tsdoc.org/) |
| S28 | [TypeDoc: documentation](https://typedoc.org/) |
| S29 | [Knip: documentation](https://knip.dev/) |
| S30 | [dependency-cruiser: official repository](https://github.com/sverweij/dependency-cruiser) |
| S31 | [Biome: language support](https://biomejs.dev/internals/language-support/) |
| S32 | [Oxlint: type-aware linting](https://oxc.rs/docs/guide/usage/linter/type-aware) |
| S33 | [SonarSource: current SonarJS repository](https://github.com/SonarSource/SonarJS) |
| S34 | [Size Limit: official repository](https://github.com/ai/size-limit) |
| S35 | [Bundler visualizer: official repository](https://github.com/btd/rollup-plugin-visualizer) |
| S36 | [typescript-eslint: supported dependency versions](https://typescript-eslint.io/users/dependency-versions/) |

[S01]: https://typescript-eslint.io/getting-started/typed-linting/
[S02]: https://typescript-eslint.io/rules/switch-exhaustiveness-check/
[S03]: https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html
[S04]: https://typescript-eslint.io/rules/no-floating-promises/
[S05]: https://vitest.dev/guide/testing-types
[S06]: https://github.com/fallow-rs/fallow
[S07]: https://prettier.io/docs/index.html
[S08]: https://oxc.rs/docs/guide/usage/formatter
[S09]: https://github.com/vitest-dev/eslint-plugin-vitest
[S10]: https://github.com/mskelton/eslint-plugin-playwright
[S11]: https://fast-check.dev/docs/introduction/
[S12]: https://fast-check.dev/docs/tutorials/quick-start/read-test-reports/
[S13]: https://fast-check.dev/docs/advanced/model-based-testing/
[S14]: https://fast-check.dev/docs/configuration/timeouts/
[S15]: https://playwright.dev/docs/accessibility-testing
[S16]: https://github.com/vue-a11y/eslint-plugin-vuejs-accessibility
[S17]: https://stryker-mutator.io/docs/stryker-js/vitest-runner/
[S18]: https://github.com/stryker-mutator/stryker-js/blob/master/packages/vitest-runner/package.json
[S19]: https://stylelint.io/user-guide/configure/
[S20]: https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-code-scanning
[S21]: https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review
[S22]: https://github.com/gitleaks/gitleaks
[S23]: https://github.com/rhysd/actionlint
[S24]: https://docs.renovatebot.com/configuration-options/
[S25]: https://github.com/DavidAnson/markdownlint
[S26]: https://cspell.org/
[S27]: https://tsdoc.org/
[S28]: https://typedoc.org/
[S29]: https://knip.dev/
[S30]: https://github.com/sverweij/dependency-cruiser
[S31]: https://biomejs.dev/internals/language-support/
[S32]: https://oxc.rs/docs/guide/usage/linter/type-aware
[S33]: https://github.com/SonarSource/SonarJS
[S34]: https://github.com/ai/size-limit
[S35]: https://github.com/btd/rollup-plugin-visualizer
[S36]: https://typescript-eslint.io/users/dependency-versions/
