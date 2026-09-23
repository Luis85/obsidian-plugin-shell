# Iteration 03 — executed verification record

Version 0.3.0; integration base `307e3fd` (iteration 02 plus the subsequent quality-tool research). Worktree `.worktrees/iteration-three`, branch `build/iteration-three`. Local execution date: 2026-09-23.

## Initial local Windows evidence (5f9c0ce)

Qualified worktree-local Node 24.21.0/npm 11.19.1, exact package-lock, no global installation or dependency upgrades. The live all-category audit reported zero vulnerabilities; the separate nested ESLint 9 support exception remains unresolved.

| Check | Actual result |
| --- | --- |
| Runtime services, components and explicit host contracts | 222 tests in 36 files passed in both coverage runs. |
| Tooling | 57 passed and one Windows file-symlink capability skip in the 58-case run; two added native-isolation checks passed separately. Directory-junction escape protection passed. The renamed identity-style suite's four cases also passed again. |
| Types and linters | vue-tsc, Oxlint with denied warnings, and real TypeScript/Obsidian/Vue ESLint with zero warnings passed. Type checking passed again after the E2E JSON-import correction. |
| Boundaries and analysis | Code-line/locale checks: 264 inputs, 161 keys; presentation, architecture, actual entity catalog and full Fallow analysis passed with zero findings. |
| Retained baseline | 52 cases × three fresh processes passed, without retries or promotion of pending acceptance cases. |
| Artifacts and harness | Complete plugin build, ownership/size/license checks, token checks and harness build passed. |
| Served UI | 24/24 Playwright tests passed, zero skips/retries/flaky cases; pinned headless Chromium 153.0.8010.12 on Windows. |
| Native Obsidian | Hosted candidate qualification pending; local host doubles and browser tests are not native evidence. |
| Renamed/generated template | Full identity setup/resume and generated-feature qualification in progress; hosted Template authoring runs the same public workflow. |

The final local `verify` invocation passed through coverage and artifact checks, then correctly rejected an unregistered baseline filename. The new tooling test was renamed to the existing `.checks.mjs` convention, retaining every test. Affected tooling/source/analyzer checks, baseline and remaining harness-build stage then passed. This records split execution, not a claim that the interrupted invocation exited successfully. CI runs the full command afresh.

## Coverage denominators

The inventory gate accounts for all **66 production TS/Vue inputs**, validates raw counters and rejects omitted files, zero aggregate denominators and overflow.

| Scope | Lines | Statements | Functions | Branches |
| --- | --- | --- | --- | --- |
| Whole production | 1543/1549 (99.61%) | 2578/2648 (97.36%) | 580/594 (97.64%) | 1622/1714 (94.63%) |
| Domain/application/features | 801/802 (99.88%) | 1323/1356 (97.57%) | 279/283 (98.59%) | 980/1025 (95.61%) |
| Selected core | 879/881 (99.77%) | 1448/1485 (97.51%) | 305/310 (98.39%) | 1045/1093 (95.61%) |

Production floors remain 90% lines/statements/functions and 85% branches. Domain/application/features independently retain 95%/90%; selected-core thresholds remain unchanged. Percentages above are rounded from the shown counts.

## Local candidate identity

These are Windows-built assets, not proof that a native host loaded them. Hosted native acceptance records its own installed hashes.

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| main.js | 553363 | `c82d75d150c3bb619ad689a39e653685eabe0e8aa45d8184aeecceec4713ea7e` |
| manifest.json | 280 | `85ae169b901f283eb77b786f0048c606d0e4d7e02975c10b4ef9d96af89a3b43` |
| styles.css | 95062 | `f2f22167e1079cd90d705ac012d4e0f2c7bf8970b2b97f5cb9588aad2250a9e3` |

## Findings corrected during qualification

- Initial hosted qualification found Windows short-path rejection, maker fixture
  contamination after consumer extension, and native modal focus ordering.
  All have targeted regressions and fixes, detailed as R26–R28 in the review record.
  The path suite passed actual Windows 8.3 and uppercase-alias setup CLI checks;
  maker checks passed from an extended consumer; 17 modal service/adapter checks
  passed with the real host's opening order modeled. Hosted reruns qualify the
  corrected candidate separately from the initial local numbers above.
- Independent architectural/data-safety review and regressions are recorded in [the review record](../development/ITERATION-THREE-REVIEW.md).
- A served assertion retained obsolete create-only wording; it now expects the shared save error while retaining no-write/no-success checks.
- Node's ESM loader rejected two identity-aware browser tests' JSON imports. Explicit JSON import attributes fixed discovery; the full 24-case run passed.
- The real ESLint negative probe exceeded its former startup deadline. Matched runs measured 81.7 seconds for the application project versus 59.1 seconds for an isolated two-input fixture; plugin loading alone took 50–51 seconds in both. Isolation reduced parsing from 24.9 to 2.1 seconds. A finite 180-second startup allowance adds no retries; all three real rule assertions and fatal-parser rejection remain. The exact two-test gate passed. Production lint still checks the full application.
- Fresh setup exposed generated Nuxt type prerequisites. Verification builds those inputs first and serializes tooling probes. Failed attempts remained failed in the journal rather than being reported ready.
- Playwright's local installer hit a cache-lock heartbeat failure. The exact pinned headless browser was provisioned inside the worktree from the URL printed by the installed Playwright dry-run.

## Evidence boundaries and remaining scope

The [iteration inventory](iteration-three-plan.json) does not promote the retained legacy acceptance inventory. Synthetic host contracts, served browser execution, native sessions and release qualification are separate evidence types.

Broader UI/custom makers, automatic example removal, additional durable backends, mobile/device/theme/accessibility matrices and public release promotion remain pending. Explicit contained identity migration is implemented; automatic vault migration is not. Native trash is reversible but retains an external-writer race because Obsidian exposes no cross-process compare-and-trash transaction.
