# Iteration 01 — verification record and remaining scope

**Date:** 2026-09-22. Read with the [implementation guide](../development/ITERATION-ONE.md). The complete product acceptance inventory remains a target; the iteration IDs below do not automatically certify all earlier AC/NUI cases.

## Executed evidence

Local implementation checks ran with Node 24.21.0 and the exact qualified dependency graph. Hosted run **35743354241**, source commit `2fc7415cb5dce5c5f1165440ab065ae59c6a096d`, independently installed the lockfile and exercised:

| Scope | Actual result |
| --- | --- |
| Windows: npm ci, iteration verify, core coverage | Passed. |
| Ubuntu: npm ci, iteration verify, core coverage | Passed. |
| Served Chromium real-component harness | Eight tests passed, zero retries, skips or flaky results. |
| Retained verification baseline | 52 distinct Node tests, three full executions = 156 passes. |
| Vitest domain/application/feedback/events/tooling | 32 tests passed; separate from the retained baseline count. |
| Native Obsidian 1.13.7 | Four checks passed: command opens view, actual Task file matches preview, typed event, native modal. The added settings test failed to locate the assumed same-window settings modal. |

The native test has been corrected to click the actual Settings control and inspect native windows rather than assume a keyboard shortcut creates `.modal.mod-settings` in the original page. Subsequent CI artifacts are authoritative for that new check; this record does not relabel the earlier failure as a pass. The first native qualification run 35741782352 passed the original four-check scope; its artifacts predate the added license banner and must not be mistaken for the current candidate.

The first served run found a test error: a supposed host sentinel was the harness toolbar button, which intentionally has fixture CSS. The corrected test appends a neutral native button outside the plugin/toolbar and verifies its computed font/radius are unchanged when plugin CSS is disabled. The strengthened theme check compares actual background colors through dark→light→dark, not a trivially resolved token string.

## Test IDs and assertions

| Family | Implemented assertions | Related target scope, not blanket completion |
| --- | --- | --- |
| Domain/paths | Calendar dates, title/tags, unsafe paths, invalid/unknown preferences. | AC-04, AC-07, AC-51, AC-55 |
| Document service | Actual YAML serializer, preview/no-write, single complete write, duplicate request, write failure, stale folder/plan, preserved opening failure. | AC-50–57, AC-62 |
| Bus | Literal payload type checking, order, once/reentrancy, unsubscribe, sync/async errors, disposal/snapshot isolation. | AC-43–46 |
| Preferences | Queued concurrent saves, invalid/corrupt/future data protection, persistence failure. | AC-05–08, AC-27 |
| Feedback/diagnostics | Owner replacement, bounded history, native handle cleanup, sink errors, post-dispose guards, safe observed codes. | AC-21, AC-65, AC-67, AC-71 |
| Tooling | Dependency-free setup help/dry run; contained installation preserving data; path rejection; actual forbidden architecture fixtures. | AC-13, AC-18–19, AC-37 |
| UI-I01–08 | Real Nuxt rendering, CSS containment, exact Markdown, known write/open failures, persisted German preferences, events/feedback/modal focus, narrow/theme layouts, independent view IDs/disposal. | Selected AC-03–11, AC-22, AC-61 and NUI cases |

Type-checking includes wrong event/entity payload negative declarations. These are compile-time assertions, not extra runtime tests to add to the count. Tests use real application services and serializer; browser/native adapters differ explicitly. The actual native file is read from the fixture vault and compared to the displayed preview, not inferred from a notice.

## Coverage is scoped

The configured selected core includes domain, application, event implementation, diagnostics and Markdown serialization. The current local measurement is **98.27% lines, 90.59% statements, 88.52% functions, 92.68% branches**. This excludes Vue/native adapters/tooling and is not overall production coverage. Full PRD thresholds and all error/migration cases are not claimed as satisfied. Hosted JSON summaries identify their exact run.

## Tool and asset qualification

Strict Vue/TypeScript checks, actual Oxlint and Obsidian/Vue ESLint, physical source limits, locale-key parity, fallow zone coverage and negative fixtures pass for the implemented scope. The native build is CommonJS with only the host API external, one composed stylesheet, no shipped host fixture, no harness endpoint and no remote fonts. Output gates check asset names, budgets, scoped rules and embedded license notices.

Nuxt UI 4.11.2 uses source-hash-guarded replacements of its two global-style modules, no router/color-mode ownership and no Preflight. The selected component subset is tested; adding untested overlay/toast facilities requires requalification.

The native report records source commit, application/installer/runtime, asset SHA-256 hashes and named checks. In run35743354241 the candidate hashes are:

- main.js: `22c7e4299ebcdb257d5ffd246c95ce6cd1afd4a9128806e59ed8db94102b24da`
- styles.css: `b0cc99057ccab569679c2ec7129738a0da75b4a35fb0d549080131771f1ebbf0`
- manifest.json: `25743743ed800b90ade6f3dcc91fb08ae438ef9fa4761e5ab1865e6e1cc84175`

This is evidence of those assets, not permission to accept a rebuilt candidate with different hashes. The hosted environment was Obsidian1.13.7/Electron43.3.0/Chrome150 on Linux; Windows CI checked build/services, not a Windows-native host.

## Reproduction and remaining work

```sh
npm ci
npm run verify
npm run test:coverage
node node_modules/@playwright/test/cli.js install chromium
npm run test:e2e
```

Optional Linux native reproduction needs Xvfb and `npm install --prefix .native-runner --save-exact obsidian-launcher@3.2.1`, then `xvfb-run -a npm run test:native -- --allow-download`. This explicitly downloads/runs a host in a disposable sandbox; it does not use a developer's vault. Browser/native reports are separate, never a silent inline fallback.

Pending qualification includes complete setup identity/resume and maker generation, full component/native adapter coverage and thresholds, all notification timing/actions, expanded host bridge/catalog, device/popup/window-theme scenarios, full accessibility review, all Nuxt UI components and final release promotion. The manifest stays desktop-only. No public release or directory submission was performed.
