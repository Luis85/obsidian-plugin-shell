# Companion concept verification

> Executed 2026-09-23. Scope: interactive HTML concept only.
> No production code, package lock, host setting, deployment permission or existing evidence was changed.

## Accepted concept artifact

| Property | Value |
| --- | --- |
| Artifact | `docs/concepts/companion/index.html` |
| Size | 122469 bytes |
| SHA-256 | `f3d1c226026aef5fa9a9d3197dd44cb993346fa98ac0c0c838850d2c20668a9c` |
| Browser | Chromium 144.0.7559.96, headless, Linux |
| Result | 52 named browser interaction checks passed |
| Page/console errors in exercised routes | 0 |
| Network requests in exercised routes | 0 |

The [machine-readable record](browser-checks.json) lists each named assertion. These are 52 concept checks across interaction journeys, not 52 isolated production acceptance tests and not claims that every PRD criterion is implemented.

## Executed checks

The actual [browser test script](../../../tests/concepts/companion.browser.py) exercised the fresh-vault wizard, source/cache selection, identity rejection, target designation, plan approval, setup, deliberate activation, feature and entity makers, source revisions, no-op reruns, failed-test source retention, scoped verification, stale builds, target collisions, sessions, catalog search, inspect-only attachment, trust, note preview/commit, text export, theme switching, cancellation/resume, tour resumption, escaped preview text, malformed state and responsive navigation.

Captured viewports: 1512 × 1040, 1024 × 768 and 390 × 844. Visual inspection covered the initial workspace, maker review, light-theme release view and narrow wizard. Screenshot inspection is not a pixel-baseline test or a claim of screen-reader conformance.

All inline JavaScript sections also passed `node --check` during authoring using the available Node 22.16.0. This is a syntax check of the HTML concept, **not** qualification of the repository's selected Node/npm toolchain. No dependency installation or full `npm run verify` was performed for this concept-only addition.

## Reproduce with already provisioned tools

```sh
python tests/concepts/companion.browser.py \
  --browser /path/to/chromium \
  --report reports/concepts/companion/browser-checks.json \
  --screenshots reports/concepts/companion/screenshots
```

Requires a separately provisioned Python environment with Playwright and a Chromium executable. The script does not install packages, provision a browser, modify a vault or trigger network-dependent tests. `CHROMIUM_PATH` is an alternative to `--browser`.

## Evidence boundaries

Direct `file://` and loopback navigation were rejected by the managed browser with `ERR_BLOCKED_BY_ADMINISTRATOR`. The policy was not changed. The tested HTML was supplied through Playwright `set_content`, using the same inline application bytes. Direct local-file opening is the intended delivery mode but was not established by that environment.

About-blank storage denial was exercised as a real browser fallback. Persistence/hydration cases used a controlled `Storage` stand-in; they qualify parsing, serialization and UI recovery paths, not native origin storage, Obsidian sync behavior or machine-local trust isolation.

No real template download, archive validation, npm process, source write, host reload, plugin enablement, filesystem collision or security audit was executed. A simulated success/failure is an interface fixture, not corresponding backend evidence. CLI/UI differential tests, all desktop platforms, real Nuxt UI integration, runtime dogfooding, native accessibility and Community acceptance remain future work.

## Corrections during review

The initial command-palette test reproduced a focus defect: leaving the search field emitted `change`, rebuilding and detaching the selected result. Search now updates on input only; checkbox/select fields handle change separately. The final keyboard path passed.

The maker run captures approved options before its delayed fixture stage, so editing the form during a pending run cannot alter the already approved request. Source-root duplicates are rejected in the modeled create/attach path. Storage denial and corrupt/future state now have distinct messages. Resume displays its actual existing CLI form and does not silently reclassify prior failed runs.

The test harness initially encountered CSP restrictions on a string-evaluating wait helper. It was replaced with external polling; the prototype's CSP was not weakened. Earlier failed attempts are not counted as passes. The final 52-check run completed with the artifact identity above.
