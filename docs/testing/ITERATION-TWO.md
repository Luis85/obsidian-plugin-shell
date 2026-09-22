# Iteration 02 — executed verification and delivery record

Date: **2026-09-22**. Version **0.2.0**, plugin identity `plugin-shell`, branch `build/iteration-two`, draft PR #1. Main remains `e64e75eefb22822356cb2473b77eadee35871beb`.

**Runtime candidate qualified:** `f3a964621ccfb7678fc629666c29f37e948f6143`. [Qualification run 35782207137](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35782207137) passed its build, served-browser, three fresh native sessions, security and unchanged-asset gates. Subsequent handover changes are documentation and acceptance-inventory entries only; no runtime asset is rebuilt for delivery.

**Not unconditional acceptance:** the official Obsidian lint dependency graph still contains unsupported ESLint 9.39.5. Root ESLint 10, real rule/parser checks and the audit pass, but the fully-supported-graph criterion remains unmet. See [review finding I02-R6](../development/ITERATION-TWO-REVIEW.md) and the [investigation](../development/ITERATION-TWO-DEPENDENCY-EXCEPTION.md). PR #1 remains draft. No release, tag, merge or Community submission occurred.

## Commands and observed results

The candidate job independently selected Node **24.21.0** and npm **11.19.1**, then performed a fresh `npm ci --strict-allow-scripts` from the committed exact lockfile. No peer bypass or global npm installation was used.

| Executed check | Actual result |
| --- | --- |
| `npm ci --strict-allow-scripts` | Passed; exact direct versions, reviewed narrow lifecycle approvals and unchanged lockfile. |
| `npm run verify`: Node tooling tests | **13 passed**, including build/install safety, real npm policy repair, live-audit classification, analyzer/lint negative probes and COV-02-01. |
| Dependency verification and complete staged build | Passed; reviewed installed sources, actual fontless transform, local icons and matching JS/CSS/manifest. |
| `vue-tsc --noEmit`, strict Oxlint and ESLint | Passed; actual TypeScript/Obsidian/Vue rule and parser failures are verified by negative fixtures. |
| Source limits, locale parity and tokens | Passed: **157 checked inputs**, **116 translated keys**, nine-line `main.ts`; 968 observed host-token names, 133 reviewed names and 38 aliases. |
| Architecture and full fallow analyzer | Passed with **zero findings**; dead code, dependencies, cycles, suppressions and boundaries are enforced, not merely configured. |
| Vitest runtime/integration suite | **51 tests / 10 files passed**, followed by **three additional fresh-process runs of the same 51 tests**, no retries. |
| Retained deterministic baseline | **52 tests × 3 runs passed**. Its full-product release assessment still says release blocked. |
| `npm run test:coverage` | Selected-core numerical thresholds passed; see separate scope below. |
| `npm run test:coverage:production` | Report produced and **all 30 production TypeScript/Vue inputs accounted for**. Not a full-production coverage-target pass. |
| `npm run test:e2e` | **21 passed, 0 skipped, 0 unexpected, 0 flaky**; retries disabled. Actual loopback-served components and application services. |
| Explicit native fixture, three fresh sessions | **15 checks passed in each of 3 sessions**, each with a cold process restart; **0 unexpected page errors** and empty independent application diagnostics. No retry-to-green behavior. |
| `npm run check:security` | JSON and ordinary all-category audits both exited **0**, **0 vulnerabilities**. |
| Installed/candidate/final asset identity | Passed before native use, after cold restart and at packaging; all three native sessions used identical assets. |

The browser suite observes caught application diagnostics independently from page/console errors. Deliberately injected faults have exact expected codes; an unexpected caught error fails even when a fallback UI renders. UI-02-PENDING holds the actual persistence port behind a controlled promise, proves unchanged checkbox/header state while saving, releases it, then verifies committed state and reload persistence. There are no arbitrary sleeps in this regression.

The baseline inventory `test-plan.json` retains its original 96 acceptance IDs. No old unimplemented case was promoted by this iteration. Additional stable cases are in `iteration-two-plan.json`.

## Coverage: two distinct denominators

| Scope | Lines | Statements | Functions | Branches |
| --- | ---: | ---: | ---: | ---: |
| Selected core | **99.02%** (203/205) | 93.17% (314/337) | 93.15% (68/73) | 91.41% (181/198) |
| Whole production: all 30 TS/Vue inputs | **53.39%** (307/575) | 48.85% (470/962) | 37.19% (90/242) | 48.23% (232/481) |

Core thresholds are 95% lines and 90% other measures. Whole-production measurement is report-only and does not meet the broader product target; native adapters, composition and components need further instrumented coverage. Served/native behavioral tests do not silently contribute to these Vitest percentages.

The earlier 54.91% whole-production line result is superseded: a Nuxt virtual-import transform failed for unexecuted `mount-ui.ts`, and the coverage provider omitted that input. The production config now uses the real Nuxt/Vue resolver; `coverage-inventory.mjs` requires every production input and a total entry. COV-02-01 proves a missing input makes verification fail.

## Native and browser qualification scope

Real native qualification ran on **Linux x64 / X11 / Xvfb**, Obsidian **1.13.7 application and installer**, Electron **43.3.0**. The retained minimum and current public target are the same version. The fixture uses isolated disposable vault/config directories and actual installed plugin files; it does not use a personal vault. Window sizing was applied to the real native window, not simulated by a browser viewport.

The 15 native checks cover command opening; exact created Markdown versus preview; typed events; native modal dismissal; the actual native title row without hiding tabs/window controls; accessible view actions; new and multiple leaves; repeated command toggles with an unaffected Markdown view; native Appearance light/dark changes; real Electron 125%/150% zoom and select metrics; moved pop-out ownership and live theme/header changes; unload cleanup; runtime re-enable; shared native settings; and persistence of header/folder/note/asset identity after a cold restart. Each session performs all checks; the workflow stops on the first failure.

The served suite checks actual leaf widths **320, 480, 768, 1280 and 1920 CSS pixels**, all four panels, aligned 16/24/32px gutters, clipped-control metrics, live resizing, expanded/stacked Documents, long paths, German labels, light/dark themes, CSS-scale simulation, pending/failed preference saves, retained drafts, notice failure and header isolation. Its native header is explicitly labeled a simulation; native host behavior is separately established above.

**Not run:** Windows-native Obsidian UI, macOS-native UI, mobile, third-party themes, Windows OS-level display scaling, or a broader historical host matrix. Windows setup/build results are not Windows-native UI evidence. Local container network access to GitHub/npm and its browser navigation were unavailable; hosted execution supplies fresh installation and served/native evidence rather than invented local passes.

## Windows and Ubuntu setup compatibility

[Setup matrix 35782212498](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35782212498) passed all four jobs for this candidate's PR merge revision `a9932af88c8335f7dfdcd001b0ba9573e2464726`:

| Host | Node | Independently selected npm | Result |
| --- | --- | --- | --- |
| Windows / PowerShell | 24.15.0 | 12.0.2 | Passed |
| Windows / PowerShell | 24.21.0 | 11.19.1 | Passed |
| Ubuntu | 24.15.0 | 12.0.2 | Passed |
| Ubuntu | 24.21.0 | 11.19.1 | Passed |

Each policy report records actual EALLOWSCRIPTS reproduction, nested `npm run`/`npm ci` reloading persistent policy, only version-approved hooks running, explicit denials preserved, unchanged lock/user configuration, and an unreviewed hook blocked under strict policy. The workflow also runs guided setup and the real verification suite. PR baseline run [35782212488](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35782212488) and showcase run [35782212418](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35782212418) passed.

## Dependency and audit evidence

The original main audit reported **one low-severity esbuild advisory**, GHSA-g7r4-m6w7-qqqr, with esbuild 0.27.7. The exact before JSON and nonzero exit record are retained. The final audit captured at **20:47:12 UTC, 2026-09-22** reports **zero** in every severity; both `npm audit --json` and ordinary `npm audit` exit 0, without omitting development/optional categories or low severity. Advisory discovery is live; offline deterministic verification is a different gate.

Actual version changes: direct ESLint **9.39.5 → 10.11.0**; narrow reviewed `fontless@0.2.1 → esbuild@0.28.2` override and corresponding lifecycle approval; Node floor **22.12.0 → 22.13.0**, explicit npm **>=11.19.1 <13**. Other principal direct versions were already current compatible pins on main and were retained: Nuxt UI 4.11.2, Vue 3.5.43, Pinia 4.0.3, Vite 8.3.0, Vitest 5.0.1, TypeScript 6.0.3, typescript-eslint 8.70.1, Oxlint 1.85.0 and fallow 3.28.0. They were reviewed, not falsely presented as new upgrades.

The supported parent-update/dedupe investigation did not remove nested ESLint 9.39.5 from the official Obsidian lint integration. Its trial lockfile was not adopted. No unsupported peer override was used. This remains the explicit acceptance exception even though audit is clean; a clean audit is not proof of security or support.

## Accepted asset identity

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `main.js` | 445031 | `995196a373fcc326d6a79f9035c3879f83b42855e4dfd8939bfa687fbd98c654` |
| `styles.css` | 93484 | `bc7e568a5abd2c2b07e444054163c9108a0128e465901fd9b2214b3956c1b747` |
| `manifest.json` | 280 | `7164d1c708a4c2291cb8aca707eaf530d3d1876d94b12204f220a4a2d49a3a33` |

The install ZIP contains only these files under `plugin-shell/`. The source ZIP contains the committed source plus final handover documents, not node_modules, the native host, browser executables or font binaries. The evidence package records the candidate commit separately from documentation-only finalization and includes all three native reports, coverage summaries, served results, audit before/after, setup reports and actual screenshots. The static artifact report says `nativeHostTested: false` because that checker is static; separate native reports supply native acceptance.

## Screenshots and prior failures

Actual native captures include `native-document.png`, `native-preferences-header-shown.png`, `native-preferences-header-hidden.png`, split light/dark views, 125%/150% zoom, a moved pop-out and cold-restart persistence. Served captures include Documents and Preferences at 1920/480px, light/dark, header shown/hidden; names start `harness-` to avoid confusing simulation with native evidence.

Earlier qualification failures are not claimed as passes. Moved-document theme ownership was corrected in production; native command/settings window ownership and premature realm closure were corrected in the driver. A later repeat at `deb57b3` failed because Playwright `check()` assumed synchronous mutation of an asynchronously persisted controlled checkbox. It had no application errors. The final fix clicks once, awaits committed state, adds the deterministic slow-write regression, and requires three fresh native sessions without retries. All three pass at `f3a9646`.

See the [review/fix record](../development/ITERATION-TWO-REVIEW.md) for affected symbols, evidence, impact, corrections, regression cases and remaining scope. Broad generators, mobile support, complete coverage targets and public release promotion remain separate PRD work.
