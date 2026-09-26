# Product audit: exact-artifact verification

**Date:** 2026-09-24. **Scope:** the browser companion concept on PR #5, not native companion qualification.

## Artifact

- Baseline PR head: `a27dc75102ea2832e723fe66abdca6bf4e67eff5`.
- Baseline source archive: CI merge snapshot `1707a9d52c67a6f86ecdbbd529c85fcfb90ab145`; downloaded ZIP SHA-256 `68a2f9d1e9c4d67087ff02aebd12a6a38c09cf4fdf1a9eadc6ef5a117a6636cf`.
- Candidate HTML: `docs/concepts/companion/index.html`, **1,499,093 bytes**.
- Candidate SHA-256: **`c5f7692d2d63e5aa776ff9c7b1a487d055f9da4abe38a062c02fc2ec01657cc0`**.

The source modules are authoritative. The generated HTML was rebuilt and checked byte-for-byte; vendor files and the exact 105-input inventory were not changed. This pass does not alter root runtime source, dependency manifests/lockfiles or quality thresholds.

## Executed local results

Environment: Linux, Python 3.13.5, Playwright 1.57.0, Chromium 144.0.7559.96, Node 22.16.0. This is **not** the repository's qualified Node 24.21.0/npm 11.19.1 toolchain.

| Command / scope | Observed result |
| --- | --- |
| `python -B scripts/concepts/build-companion.py --check` | Exact candidate reconstruction passed |
| `python -B tests/concepts/companion-assembly.test.py` | 10 assembly, inventory and tamper-rejection tests passed |
| `node --check` for every authored `src/*.js` concept module | 75 syntax checks passed; no execution claim |
| Python compile/parse for every concept script and test | 27 files parsed; separate from executing their tests |
| `node --test tests/tooling/test-data-*.checks.mjs` | 27 executable tests passed, including temporary file safety and loopback test-kit behavior |
| `python -B scripts/concepts/run-browser-checks.py` | **834 named browser assertions passed** on the candidate HTML |
| `git diff --check` | Passed |

The new product-audit suite contributes 67 assertions. Existing consistency 89, Design System 37, Test Data 39, editor regression 64, Data Sources 77, single-vault 47, semantic/variants 76, ER polish 67, containers 64, reference 50, reference graph 8, reconciliation 34, unified/spatial 67 and safety/recovery 48 were rerun. These counts total 834; they are not added to previous iterations' totals.

The product-audit script was rerun after improving its contrast screenshot capture; its 67 assertions and artifact hash remained the same. It checks actual input and rendered geometry plus explicitly scoped model/Storage fixtures. The count is not 834 independent end-to-end user journeys. No page/console errors or network requests were observed by the exercised UI suites.

## Local blockers and mandatory CI checks

**Actual-origin browser storage:** the local `--real-storage` attempt failed before its first assertion because managed Chromium rejected `http://127.0.0.1` navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. Its result is not a local pass and is not included in 834. The maintained CI command still requires `--real-storage`, including the added actual two-window stale-reset and retained-export checks. Successful final-head CI should independently report 11 storage assertions, not reuse the controlled adapter as proof.

**Root maintainability:** a direct local attempt to run `tests/tooling/maintainability.checks.mjs` failed with missing package `vue`; root dependencies were not installed in this extracted source environment. No maintainability metric, full runtime test/coverage result or release qualification is inferred from the local syntax checks. Existing root workflows must verify the final pushed head using their pinned dependencies/toolchain. No thresholds or exclusions were relaxed to turn these blockers green.

The CI workflow `companion-concept-verification.yml` already runs source checks with qualified Node, all maintained browser suites and actual-origin storage, then preserves raw reports and the exact HTML in `companion-browser-evidence` plus a separate source archive. Inspect the runs attached to the final PR head and their artifacts; a previous green head is not evidence for this candidate. Final-head run URLs/results belong in the PR handover after those runs actually complete.

## Verified delivery CI

The [guarded delivery run](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36034211986) completed successfully. It reconstructed the reviewed source changes, checked their before/after hashes, rebuilt the exact HTML above, ran the source and browser checks, then pushed source commit **`e4598ffe3ffff83d4ab28deb094d2a182a59a14a`** onto PR #5 without a force push.

**845 named browser assertions passed across 16 suites**, including **11 actual HTTP-origin/two-window Storage checks**. This resolves the local-origin execution gap for this artifact; it does not claim native Obsidian or file-origin persistence. The 67 product-audit checks and all prior maintained suites passed. The source steps also passed 27 executable test-data tests, 10 assembly/inventory tests and syntax checks of all 75 authored JavaScript modules using Node 24.21.0. Local Python parsing remains the separately recorded local check.

The [CI evidence artifact](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36034211986/artifacts/10824620321) was downloaded and independently reopened. Its ZIP SHA-256 is `3e24b97ec90f3826b1a7929665f0bd54b4945339baeac2cb4263764370e54ddf`. The HTML is byte-identical to the reviewed candidate. Each of the 16 raw reports has the expected artifact hash, only passing named assertions, and no observed page errors or unexpected requests. The browser count is not added to the 834 local assertions or previous iterations.

**Evidence boundary:** the run started from staging commit `dd2680995baf8037c025e5b3bd7ac47202b08040`, applied the checksum-locked candidate and tested that working tree before creating the source commit. It is exact-candidate/branch evidence, not a final PR merge-snapshot or full root-template qualification. Cleanup removes only the temporary delivery files and adds this verification record; it does not change the tested concept or test implementation.

The concurrent PR #16 roadmap merge `c3a9f2cf5d306101181b01f7dea913dc375adec1` was preserved. During delivery, `main` advanced to framework-lifecycle merge `9a48b65660d6bbd66bac9aff2cb73627e1f38211` and GitHub reported PR merge conflicts. This audit does not merge or overwrite that work. Reconcile the branch with current `main` and run the full root/PR checks before claiming merge readiness. The earlier green baseline workflows are not evidence that this integration has passed.

## Reproduction

```sh
python -B scripts/concepts/build-companion.py --check
python -B tests/concepts/companion-assembly.test.py
node --test tests/tooling/test-data-*.checks.mjs
# Provision the pinned browser tooling in an isolated environment first.
CHROMIUM_EXECUTABLE=/path/to/chromium python -B scripts/concepts/run-browser-checks.py --real-storage
```

`reports/concepts/browser-summary.json` is the aggregate. Each suite retains named assertions, HTML identity and error/request observations. `reports/concepts/product-audit/` contains current candidate screenshots for welcome, overview, modal feedback, recovery, source contracts, test-data operation, incomplete palette coverage, tour and responsive overviews. `reports/concepts/storage/checks.json` is actual-origin evidence only when that suite executes successfully.

## Limits retained

No native Obsidian installation or personal vault was opened. Browser preparation/build/activation remain simulations. Actual Node test-kit execution is a separate, bounded capability. No live API/database access, automatic schema migration, installed Faker qualification, full assistive-technology acceptance, maximum-scale performance profile, file-origin persistence claim, arbitrary-palette accessibility certification or native companion conversion is established by this pass.

Stale-reset checking is a best-effort precondition, not an atomic cross-process transaction. Recovery exports may contain private authored content and omit unsubmitted form drafts; a safe import/merge workflow remains future native work. Tour navigation can initialize camera presentation while preserving the generation fingerprint.

See [PRODUCT-AUDIT.md](PRODUCT-AUDIT.md) for the product findings, retained strengths, journey review and ordered shell/conversion/publication gates.
