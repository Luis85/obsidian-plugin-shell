# Iteration 03 — executed verification record

Version 0.3.0; integration base `307e3fd`. Qualified code commit:
`15b8aaba7b69ab513a414257fb7908b3f61a4c87`, branch `build/iteration-three`. Execution date: 2026-09-23.
The final documentation update does not change these executable inputs or assets.

## Qualified results

- [Candidate qualification](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35804977905): complete `npm run verify`, three additional fresh runtime processes, both coverage scopes, served UI, three independent native runs and live security audit passed.
- [Windows/Linux showcase matrix](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35804980405): fresh setup and full verification passed on both platforms; Linux served UI passed.
- [npm policy matrix](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35804980530): Windows/Linux with Node 24.21.0/npm 11.19.1 and Node 24.15.0/npm 12.0.2 passed, including actual installation-policy negative controls. The default qualified pair remains 24.21.0/11.19.1.
- [Fresh template authoring](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35804980427): adopted Field Notes 1.0.0, generated Bookmarks through the public maker, passed full verification with 228 runtime tests and all 68 production inputs, then passed 24 served-browser cases.
- [Retained baseline matrix](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35804980413): 52 cases × three fresh runs passed on each platform. Pending legacy acceptance cases were not promoted.

| Scope | Executed result |
| --- | --- |
| Runtime and real components | 227 tests in 37 files; coverage runs and three additional fresh processes passed. Unexpected Vue warnings now fail the relevant component cases; the final verification log contains no Vue warning flood. |
| Node tooling | 66 cases: Linux passed 63 with three Windows-only skips. The Windows matrix separately exercises real case/8.3 aliases; no platform skip is presented as execution. |
| Static checks | Types, both linters with denied warnings, source/locale/presentation/architecture gates, full Fallow zero-finding analysis, actual entity catalog, token checks and artifact checks passed. |
| Served UI | 24/24 Chromium cases, zero retries, skips, flaky cases or unexpected failures. |
| Native Obsidian | 24 named checks × three independent Linux runs. Every run includes a cold process restart, zero unexpected errors, and identical built/installed/final candidate asset hashes. App and installer: 1.13.7 / 1.13.7; launcher: 3.2.1. |
| Security | Both all-category audit commands passed with zero reported vulnerabilities. The separate nested ESLint 9 support exception remains unresolved. |

Native checks cover actual command registration/removal, canonical Markdown CRUD,
identity/body/property preservation, reversible trash and cancellation, normalized
host events, modal validation/focus/ownership, debug commands and sanitized reports,
split/pop-out views, native headers/settings, theme/zoom, unload and restart.
The artifacts retain the exact 24 check names, screenshots and scope labels.

## Coverage

Every production TypeScript/Vue input is measured: **66 inputs**, with validated
raw counts and an independent stricter business-code gate. Percentages below are
rounded from the shown counts; missing inputs and malformed denominators fail.

| Scope | Lines | Statements | Functions | Branches |
| --- | --- | --- | --- | --- |
| Whole production | 1556/1562 (99.62%) | 2612/2681 (97.43%) | 587/600 (97.83%) | 1630/1724 (94.55%) |
| Domain/application/features | 801/802 (99.88%) | 1323/1356 (97.57%) | 279/283 (98.59%) | 980/1025 (95.61%) |
| Selected core | 879/881 (99.77%) | 1449/1485 (97.58%) | 306/310 (98.71%) | 1045/1093 (95.61%) |

Floors remain 90% lines/statements/functions and 85% branches for production,
95%/90% independently for domain/application/features, and unchanged selected-core
floors. CSS, tooling, native and browser evidence have separate scopes.

## Accepted native candidate

These Linux-built assets were installed and checked unchanged in all three native
runs. The workflow also compares pre-qualification and final artifact reports.
The retained installable archive is `candidate-plugin.zip`, containing the
manifest-derived plugin directory. Evidence artifacts have seven-day retention;
the pinned workflows and source remain reproducible after that retention expires.

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| main.js | 554016 | `df2f77e5bc3cc8bc6e58d5d18bc121403b52ad8de2a4a62d888ad25df3ef5576` |
| manifest.json | 280 | `85ae169b901f283eb77b786f0048c606d0e4d7e02975c10b4ef9d96af89a3b43` |
| styles.css | 95159 | `903b91a12ea0e1188d897299fe4587d5b5412407051be071246b9a22c34c627d` |

The Linux baseline executable-input digest is `9b6998e6f0d5719c29927bb0f075a2deafa822604a3c36174d22bf0afa71f1f9`.
It fingerprints its declared executable inputs, not the entire repository.

## Local checks and qualification corrections

The Windows worktree used locally provisioned Node 24.21.0/npm 11.19.1 and the exact
lockfile. The final mount polish passed all 227 production-coverage tests and all
66 inventory inputs, types/linters, plugin/harness builds and 24 browser cases.
An independent renamed Field Notes checkout also completed setup/resume, generated
Bookmarks, full verification and 24 browser cases before the final mount polish;
the hosted authoring workflow above qualifies the final source end to end.

Initial failed runs remain failures. Corrections included a baseline/tooling
filename mismatch, required JSON import attributes, cold lint initialization,
Windows short-path aliases, consumer-contaminated maker fixtures, actual native
modal focus ordering, duplicate no-op plugin identity, partial attachment cleanup
and view/runtime translation ownership. The real ESLint probe uses a bounded
two-input TypeScript project with the unchanged production rules and a finite
180-second startup allowance, without retries. Production lint remains separate.
Local file-symlink creation was unavailable; its skip did not replace the passing
junction controls or hosted platform checks. Playwright's local cache-lock failure
was resolved by provisioning its exact pinned browser inside the worktree.

The [independent review and improvement record](../development/ITERATION-THREE-REVIEW.md)
documents the reproduced defects and regressions. The
[iteration inventory](iteration-three-plan.json) remains distinct from the legacy
acceptance inventory. No personal vault, global installation, release, tag or
plugin-directory submission was involved.

## Remaining product scope

Broader UI/custom makers, automatic example removal, additional durable backends,
Windows-native/mobile/device/theme/accessibility matrices and public release
qualification remain pending. Explicit contained identity migration is implemented;
automatic vault migration is not. Reversible native trash retains an external-writer
race because Obsidian exposes no cross-process compare-and-trash transaction.
The official Obsidian lint dependency still retains unsupported nested ESLint 9;
a clean security audit does not close that support exception.
