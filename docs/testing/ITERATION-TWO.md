# Iteration 02 — verification record

## Candidate checkpoint (before final hosted qualification)

Recovered source: `build/iteration-two` at `2b995b574df073e328f311b90284379ed1dce3f1`, based on main `e64e75eefb22822356cb2473b77eadee35871beb`. Previous hosted native run **35767003639** failed a theme-transition assertion after passing native title targeting, essential actions, new/multiple leaves and foreign-leaf isolation. That run is historical failure evidence, not final acceptance.

Local resumed environment: Linux, Node **22.16.0**, npm **10.9.2**. Source recovered from the exact GitHub source archive; installed modules recovered from the explicitly reviewed hosted dependency-candidate artifact. This is **not** a local fresh `npm ci` on the declared npm toolchain. GitHub/npm DNS is unavailable locally.

Executed locally on the revised source: real build; Vue/TypeScript checks; Oxlint and Obsidian/Vue ESLint; source/locale/token/artifact checks; full zero-finding fallow analysis and separate boundaries; 51 Vitest tests; all current tooling regressions; retained **52 Node baseline cases × 3 fresh runs**, zero retries; harness production build; separate core and whole-production coverage. Numerical core threshold is 95% lines / 90% statements/functions/branches. Production coverage is report-only and never substitutes the core denominator.

Local coverage at this checkpoint:

| Metric | Selected core | Whole production TS + Vue |
|---|---:|---:|
| Lines | 99.02% | 54.91% |
| Statements | 93.17% | 50.26% |
| Functions | 93.15% | 37.65% |
| Branches | 91.41% | 48.43% |

The actual local served Playwright command was attempted with `/usr/bin/chromium`: **20 tests failed at navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`**. This is an infrastructure restriction, not served-browser evidence or a reason to weaken tests. Hosted Chromium must run the same tests with retries zero. No inline screenshot substitute is accepted.

## Required final hosted evidence

The candidate workflow starts from a fresh exact-lock checkout, independently selects Node 24.21.0/npm 11.19.1, runs strict allow-scripts installation, all gates, three additional fresh Vitest processes, both coverage scopes, 20 served tests and actual Linux Obsidian 1.13.7 (the current public target and retained minimum). It captures real Documents/Preferences images in wide/narrow, light/dark and shown/hidden states. Native checks include actual title row, multiple leaves, unaffected Markdown, real view menu/command/native settings, theme transitions, moved pop-out, native Electron zoom125/150, unload/reload, cold process restart and installed asset hashes.

A separate job captures `npm audit --json` for the exact pre-remediation main. The final candidate runs both JSON and ordinary `npm audit`, all categories/severities, and reports network failures as infrastructure errors. The reviewed exploratory dependency artifact had zero advisories; that is not a substitute for this candidate's final fresh-install audit.

Windows/Ubuntu setup policy uses Node24.15.0/npm12.0.2 and Node24.21.0/npm11.19.1. It invokes actual fresh guided setup, reproduces the real EALLOWSCRIPTS regression, verifies allowed/denied lifecycle hooks with a local test registry and executes the full normal gates. A Windows build is not native Windows UI evidence.

## Acceptance scope and stable inventory

The original `test-plan.json` and its 96 acceptance IDs remain unchanged. Its report remains explicitly release-blocked because unimplemented full-template cases are not promoted. The iteration inventory is [iteration-two-plan.json](iteration-two-plan.json); test IDs embedded in actual runtime/tooling/served sources and named native checks are stable regression identifiers. Actual machine reports and source commit/asset hashes take precedence over historical counts in prose.

Final results, execution URLs, accepted asset hashes and any remaining not-run matrix entries must be appended after the hosted qualification completes. Do not label this checkpoint's native/browser/security matrix passed.
