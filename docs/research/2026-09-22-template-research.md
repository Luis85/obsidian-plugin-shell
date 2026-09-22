# Research: a current, approachable Obsidian plugin baseline

**Research date:** 2026-09-22  
**Scope:** Primary-source research and repository-document review; no implementation or compatibility experiment.  
**Companion contract:** [PRD](../product/PRD.md)

## 1. Conclusions

The template should make a small number of workflows dependable, rather than expose every tool as a separate onboarding decision. Keep the required stack and architecture, but make the developer journey the organizing principle: initialize identity, see the real UI, change one behavior, verify it, test it in Obsidian, and publish a reviewed release.

The principal improvements over PRD 0.1 are:

| Topic | Research-informed decision |
| --- | --- |
| Host support | Target the newest public/stable Obsidian, with a recorded compatibility baseline. Catalyst is optional early-warning testing, not a prerequisite. |
| Settings | Use the current declarative settings API only. Route its custom storage hooks through the existing application service; do not maintain a second legacy settings implementation. |
| Dependencies | Keep exact resolved dependencies reproducible while routinely updating them through reviewed pull requests. Use Dependabot by default; Renovate is an optional replacement. |
| Developer experience | Supply a short quickstart, guided identity setup, an example-change recipe, actionable diagnostics, and a small primary command surface. |
| Native workflow | Optionally integrate the official Obsidian CLI for reload and screenshots in an explicitly selected development vault. Keep browser testing independent of it. |
| Quality | Prefer supported tool capabilities over custom replacements. In particular, fallow now documents boundary coverage in addition to import rules. |
| Releases | Use a GitHub-native draft/promote workflow with an explicitly selected commit and exact tested assets. Do not require npm publishing or a release-management SaaS. |
| Listing | Document the current Community directory submission route, not an old tutorial's pull-request process. |
| Agent readiness | Make instructions small, verification finite, fixtures deterministic, and evidence tied to the tested build. Optional agents must not become runtime dependencies. |

These are design decisions, not claims that documentation alone implements them.

## 2. Verified host snapshot

| Item | Observed value | Evidence |
| --- | --- | --- |
| Latest public desktop | **1.13.7**, public release dated 2026-08-12 | Official updater metadata and dated changelog [R01, R02] |
| Latest public mobile shown in the official changelog | **1.13.8**, dated 2026-08-20 | Official changelog [R03] |
| Early-access desktop | **1.14.2** | Official updater metadata's separate beta field [R01] |
| Early-access mobile | **1.14.2**, dated 2026-09-15 | Official dated changelog [R04] |
| Declarative settings API floor | **1.13.0** | Official settings documentation and migration guide [R05, R06] |
| Development Node track | **Node 24 LTS** is the selected current default; Node 26 is Current in the observed release table | Official Node release table [R15] |

The live updater file inspected through GitHub had blob SHA `c537542b89de6db0980d222d6f31beebe093d63a`. Its top-level `latestVersion` and nested `beta.latestVersion` identify different release channels. Its `minimumVersion` is updater metadata, not the template's chosen plugin compatibility floor.

A search result and an opened cached documentation page did not always contain equally recent text. For example, a cached settings migration guide still described 1.13 as insider-only. The dated public changelog, live updater metadata, and current settings source resolve that discrepancy. Do not derive channel status from stale prose or sort all tags and select the greatest number.

**Version boundary:** The application version, npm `obsidian` API declaration version, installer/Electron version, development Node version, and mobile WebView capabilities are different facts. Updating one does not prove that the others support a newly used API.

Registry requests for a full current npm patch-version inventory were unsuccessful in this environment. Consequently this research does not invent a latest-version table for every package. The compatibility work package must resolve the latest stable candidates, record exact versions, and test the combination before generating a lockfile. The package declarations previously inspected in the two example projects are historical observations, not a tested recommendation for this template.

## 3. Native integration findings

### Settings

The official settings source supports `getSettingDefinitions()` and custom `getControlValue()` / `setControlValue()` hooks. Overriding the write hook replaces default writing, including automatic saving. Definitions are also used for search indexing and must remain cheap. [R05]

The template should therefore expose one small native settings tab backed by its validated preference service. UI controls must not independently overwrite the combined durable document. A failed native setting write needs the same truthful outcome and recovery behavior as a failed Vue action. Do not copy tutorial defaults that shallow-merge unvalidated storage and assume that this is a migration strategy.

A legacy `display()` implementation is unnecessary under the chosen current-host policy. Existing plugins supporting pre-1.13 hosts have a legitimate dual-support pattern, but this new shell does not inherit that requirement. [R06]

### Lifecycle and styling

Obsidian's guidelines favor owned registrations, appropriate command callbacks, quiet default logging, semantic CSS variables, and cleanup without manually detaching leaves on plugin unload. [R07]

Keep native host components for native tasks, while Vue owns the custom view body. Avoid rebuilding a second settings application, global CSS resets, retained singleton view instances, and assumptions that every element belongs to the main window. Current host evolution makes settings/pop-out windows an important acceptance case, not an optional cosmetic detail.

### Official CLI

The official CLI exposes plugin reload and developer screenshot commands, but communicates with the installed/running Obsidian application. It is not a substitute for a browser harness or an independently headless plugin runtime. [R08]

An optional adapter should validate the selected fixture vault and supported CLI commands before reloading. It must not discover a personal vault and operate on it implicitly. Do not require arbitrary evaluation access or a paid early-access entitlement for the standard development path.

### Local data

The public API declares vault-specific local-storage helpers. [R09] Keep those behind a narrow production adapter; browser storage is appropriate only in the harness adapter. The namespace also needs plugin identity. Durable settings/data, device-local UI preferences, and transient view state remain separate product decisions.

## 4. Build and frontend findings

Vite 8's published release describes its Rolldown-based build implementation. The selected Vite configuration should follow the selected version's supported API, not copy older Rollup configuration without verification. [R14]

This repository builds an Obsidian application plugin, not a reusable npm library. Library-mode output can be useful to produce CommonJS, but it does not justify declaration bundles, package export maps, npm publication, SSR output, runtime CDN imports, or accidental code-split chunks.

Vue recommends compiled templates, attention to dependency size, and measurement before applying performance optimizations. Watchers and other side effects need appropriate cleanup, especially when created asynchronously. [R16, R17] The resulting decisions are to compile SFCs, keep one Vue app and Pinia owner per view, and avoid speculative component frameworks or global reactive singletons.

Pinia's testing helper stubs actions by default. [R18] Component tests may deliberately use that behavior, but browser/integration tests claiming to exercise application logic must run real actions. The harness must use the same components and application services as the plugin.

Playwright supplies owned web-server lifecycle and visual comparison facilities. [R19, R20] The template should use a built harness, fixed browser/OS settings for visual baselines, explicit application readiness, isolated storage, and retained failure traces. It must reject a stale unrelated server occupying the expected port rather than silently test yesterday's build.

The WebdriverIO Obsidian service is a third-party option for real-host testing. [R21] It should be proven and pinned before being relied upon; it is not an official Obsidian guarantee. A documented manual native acceptance path remains available when the runner is not provisioned.

## 5. Quality tooling findings

Oxlint's supported Vue analysis does not replace full Vue-template linting. The official Obsidian ESLint plugin supplies version-sensitive host conventions. [R10, R11] Retain both tools, but configure ownership so that a rule is neither redundantly noisy nor disabled everywhere. Test template-referenced variables, Vue script parsing, async errors, and native settings rules through actual negative fixtures.

fallow distinguishes production and development reachability. [R13] Production analysis prevents tests from being the only reason an unused runtime export appears alive. Host entrypoints must be modeled deliberately, and dynamic behavior still needs runtime tests.

The current boundary configuration supports `coverage.requireAllFiles`, explicit rules, and declared zones. Unmatched files are otherwise unrestricted. [R12] Prefer that supported facility over a second handwritten import-graph engine, while retaining a small gate fixture proving its behavior in this project's paths and Vue files. A separate physical-line checker remains reasonable because the requested metric includes complete SFCs, comments, and blank lines.

A dependency update is not successful merely because a previously failing check stops reporting findings. Analyzer schemas, rule defaults, parser coverage, output formats, and production entrypoints need upgrade tests. No automatic code deletion or blanket suppression is part of normal verification.

## 6. Keeping dependencies current without losing reproducibility

`npm ci` requires consistency with the lockfile and does not update dependency manifests. [R22] This supports a two-lane model: deterministic normal development, explicit update pull requests.

Dependabot supports schedules, dependency groups, version policies, and cooldowns; its documented cooldown does not delay security updates. [R23] The selected default is GitHub-native Dependabot because the repository already uses GitHub and the baseline should not require installing another service. Explicit proposed policy values belong in the maintenance guide, not in claims about tool defaults.

Group related packages by compatibility relationship rather than grouping all development dependencies together. A Vue/compiler update, a Vitest/coverage update, and an ESLint/parser/plugin update can each affect a different part of the evidence pipeline. Major upgrades need a visible assessment and must not be ignored forever.

Renovate remains a supported alternative where richer package rules, release-age behavior, dashboards, or lockfile maintenance are useful. [R24] Enable one updater, not two competing bots. Neither updater should silently publish a plugin release.

The latest stable dependency can temporarily be incompatible with another selected dependency. Record the reason, owner, and review date. Do not conceal the lag by permanently widening an ignore pattern, using unsupported peer overrides, or reporting the repository as fully current.

## 7. Release and listing findings

Current submission documentation describes a Community directory dashboard, a GitHub-connected account, repository ownership, root documentation/license/manifest, version validation, and individual plugin release assets. [R25]

The template should prepare all of this before the first release. An identity initializer must distinguish the template repository's name from a valid distributable plugin ID. In particular, an ID intended for listing cannot contain `obsidian`, even though this template repository's name does.

The release version is `X.Y.Z`, and its tag must match without a `v` prefix. Ship `main.js`, `manifest.json`, and the shell's `styles.css` as individual assets; an optional ZIP is additional convenience, not their replacement. Document the one-time directory submission separately from later GitHub releases.

GitHub CLI can create draft releases and target an explicitly selected commit. [R26] A simple two-stage draft/promote workflow avoids requiring npm tokens, conventional-commit discipline, or an additional release service. The developer controls the version and approves publication; automation handles repetitive verification and asset preparation.

GitHub documents event restrictions for actions performed with `GITHUB_TOKEN`. [R27] Do not create a tag with that token and assume an independent push-triggered release workflow will necessarily execute. Call the release stages directly or through supported dispatch/reusable workflow paths.

Use restricted workflow permissions and pinned action references. [R28] Build/test jobs should not receive publication privileges. The publish stage consumes previously checked assets and verifies hashes instead of rebuilding a potentially different plugin after acceptance.

## 8. Agent and developer ergonomics

Official Codex guidance supports scoped repository instructions; Claude Code guidance emphasizes bounded context and explicit verification. [R29, R30] This template should apply those ideas without making either product mandatory.

A developer should not need to read the entire PRD to add the first feature. Provide one practical recipe that identifies a small domain rule, its use case, the existing storage adapter, the Vue component, locale entries, and one browser scenario. Infrastructure remains reusable, but trivial pure functions do not need interfaces, factories, registries, and event buses just to look architectural.

Optional Playwright/fallow agent integrations must use synthetic fixtures, limited permissions, and an isolated browser context. The command-line test suite remains authoritative. User content, repository issues, and pages shown in a browser are data, not permission to run arbitrary commands.

Vue's security guidance is particularly relevant to plugins: do not compile untrusted strings as templates or use unsafe HTML handling for ordinary user input. [R31] Error reports must not turn user content into executable markup or leak it to telemetry.

## 9. Alternatives deliberately not made prerequisites

| Option | Decision |
| --- | --- |
| Support many historical Obsidian versions | Not part of the new template's default; latest stable first. A downstream project can adopt an explicit wider support policy. |
| Catalyst as the required host | No. Optional compatibility canary only. |
| Floating `latest` dependencies during each build | No. Resolve updates in reviewed changes, then lock them. |
| Renovate plus Dependabot | No. Dependabot default; documented replacement path. |
| Mandatory release-please / semantic-release / release-it | No. GitHub-native release stages first; no hidden commit convention requirement. |
| Mandatory Storybook/Histoire or multiple browser runners | No. One real-component harness satisfies the initial need. |
| Mandatory Obsidian installation for UI iteration | No. Browser harness first, explicit native testing for host claims. |
| Mandatory MCP, cloud AI, or API keys | No. Optional development adapters only. |
| Custom analyzer framework | No. Use configured supported tools, with small fixtures verifying actual enforcement. |
| Copying the full reference projects | No. Preserve useful patterns, not their product features and accumulated exceptions. |

## 10. Primary-source register

All sources below were consulted for this research or the immediately preceding baseline review. Moving documentation is identified by access date rather than represented as an immutable specification. Research conclusions above distinguish direct observations from the template's own decisions.

| Ref | Primary source | Specific use |
| --- | --- | --- |
| R01 | [Obsidian desktop updater metadata](https://github.com/obsidianmd/obsidian-releases/blob/master/desktop-releases.json) | Public/beta version separation; live blob recorded above. |
| R02 | [Desktop 1.13.7 public changelog](https://obsidian.md/changelog/2026-08-12-desktop-v1.13.7/) | Public release date and channel. |
| R03 | [Official Obsidian changelog](https://obsidian.md/changelog/) | Current mobile/public channel context. |
| R04 | [Mobile 1.14.2 early-access changelog](https://obsidian.md/changelog/2026-09-15-mobile-v1.14.2/) | Early-access distinction. |
| R05 | [Official settings documentation source](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/User%20interface/Settings.md) | Declarative controls and custom storage hooks; inspected blob `102645dbb231de2de53faffb073de3be2b1900bc`. |
| R06 | [Migrate to declarative settings](https://docs.obsidian.md/plugins/guides/migrate-declarative-settings) | Current-only versus legacy dual support; cached channel wording cross-checked. |
| R07 | [Official plugin guidelines](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/Releasing/Plugin%20guidelines.md) | Host lifecycle, commands, logging, and style conventions. |
| R08 | [Obsidian CLI](https://obsidian.md/help/cli) | Optional native reload/screenshot workflow and prerequisites. |
| R09 | [Obsidian public API definitions](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts) | Host storage and declared API contracts. |
| R10 | [Official Obsidian ESLint plugin](https://github.com/obsidianmd/eslint-plugin) | Host rules and settings-version behavior. |
| R11 | [Oxc compatibility](https://oxc.rs/compatibility.html) | Vue analysis boundary and complementary linting. |
| R12 | [fallow boundary configuration](https://docs.fallow.tools/configuration/boundaries) | Zones, explicit rules, and boundary coverage. |
| R13 | [fallow production mode](https://docs.fallow.tools/analysis/production-mode) | Separate production reachability. |
| R14 | [Vite 8 announcement](https://v8.vite.dev/blog/announcing-vite8) | Current build-system generation and compatibility considerations. |
| R15 | [Node release table](https://nodejs.org/en/about/previous-releases) | LTS versus Current development tracks. |
| R16 | [Vue performance guidance](https://vuejs.org/guide/best-practices/performance.html) | Compiled templates, bundle awareness, and measured optimization. |
| R17 | [Vue watchers](https://vuejs.org/guide/essentials/watchers.html) | Side-effect ownership and cleanup. |
| R18 | [Pinia testing](https://pinia.vuejs.org/cookbook/testing.html) | Store isolation and action stubbing. |
| R19 | [Playwright web server](https://playwright.dev/docs/test-webserver) | Owned test server lifecycle. |
| R20 | [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) | Baseline reproducibility and review. |
| R21 | [WebdriverIO Obsidian service](https://webdriver.io/docs/wdio-obsidian-service/) | Third-party native-host testing candidate. |
| R22 | [npm ci](https://docs.npmjs.com/cli/commands/npm-ci/) | Lockfile-controlled installation. |
| R23 | [Dependabot options](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference) | Scheduling, groups, cooldown, security-update distinction. |
| R24 | [Renovate release-age policy](https://docs.renovatebot.com/key-concepts/minimum-release-age/) | Optional alternative maintenance approach. |
| R25 | [Submit your plugin](https://docs.obsidian.md/plugins/releasing/submit-plugin) | Current directory workflow, identity, versions, assets. |
| R26 | [GitHub CLI release create](https://cli.github.com/manual/gh_release_create) | Draft creation and explicit release target. |
| R27 | [Triggering a GitHub workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow) | Token/event orchestration constraints. |
| R28 | [Secure use of GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use) | Least privilege and pinned actions. |
| R29 | [Codex AGENTS.md guidance](https://developers.openai.com/codex/guides/agents-md/) | Scoped agent instructions; official URL may redirect. |
| R30 | [Claude Code best practices](https://code.claude.com/docs/en/best-practices) | Context and verification workflow. |
| R31 | [Vue security](https://vuejs.org/guide/best-practices/security.html) | Untrusted templates/content and safe rendering. |
| R32 | [fallow configuration](https://docs.fallow.tools/configuration/overview) | Installed schema, entries, and audit behavior. |
| R33 | [fallow limitations](https://docs.fallow.tools/analysis/limitations) | Static analysis evidence boundaries. |
| R34 | [fallow agent integration](https://docs.fallow.tools/integrations/mcp) | Optional agent tools and mutation permission review. |
| R35 | [Vue I18n Composition API](https://vue-i18n.intlify.dev/guide/advanced/composition) | Shared localization integration. |

### Reference repositories carried forward from the baseline review

Selected files—not complete repository audits—were inspected from [Renovation Planner](https://github.com/Luis85/renovation-planner) and [Backlog View](https://github.com/Luis85/backlog-view). Useful patterns include separate plugin/harness builds, a composition entrypoint, quality scripts, and repository-contained test builds. Their existing harness descriptions explicitly stop short of asserting complete frontend test coverage.

Relevant baseline observations: Renovation Planner `package.json` blob `507b57ad80918572c5e22a6de61d58d86c42bea7`, `vite.config.ts` blob `67b96388b225101bc763d9f78728184b1aa250b1`, `vite.harness.config.ts` blob `0026846c6e7d3147a3138d7492a58bd8db5e1087`; Backlog View `package.json` blob `f8906c62b88f39b4dd99679e5500b3b4e93e1ada`, `scripts/harness.mjs` blob `b1f8d6ca39ba614c6a59cda528d5b5039c9ceead`.

## 11. Validation still required

No package combination was installed or tested, no host was launched, no performance budget was measured, and no release was published during this research. Dependency registry access was insufficient for a verified patch-version inventory. Implementation must validate exact versions, native loader behavior, settings write failures, analyzer coverage, platform support, workflow permissions, and installation/release recovery before those capabilities are advertised.
