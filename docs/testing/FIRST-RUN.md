# First-run execution — verification record

Recorded 2026-09-29. Extension of draft PR #52, parent commit
`2c17ea4ded4e516f377b5a9bf3c07f84482d4a98`, based on PR #5. This record does
not authorize a release, merge, plugin activation or production installation.

## Scope

Adds an explicit optional first run after successful boilerplate generation and as
an independent first-run CLI/studio action. Human and agent use the same execution
planner and runner. Skip is the default. Execution approval is separate from file
approval. The pipeline installs dependencies, type-checks, tests, builds and optionally
serves a bounded, locally owned showcase; browser dispatch is separately selected.

Changes include version-1 settings defaults/schema additions, per-stage receipts,
source/lock/tool fingerprints, stale-plan refusal, cooperating execution locks,
owned-server health/shutdown, and process-tree cancellation support. Existing source
generation and the Angular generator are reused, not replaced.

## Executed validation

Local environment: Linux, Node **22.16.0**, npm **10.9.2**. These are not the
repository's qualified Node 24.21.0/npm 11.19.1. Node type stripping is not TypeScript
checking. The exact TypeScript 6.0.3 installation is absent; the attempted maker
compiler command failed with MODULE_NOT_FOUND. The registry was unreachable
(`curl` failed to resolve registry.npmjs.org). No substitute compiler was used.

| Completed check | Result |
| --- | --- |
| Dedicated new first-run tests | 27 passed, no failures/skips |
| Available maker regression files, executed in six bounded groups | 160 passed, no failures/skips |
| Shared file-plan and framework process tests | 21 passed, 2 existing Windows-only skips, no failures |
| Source code-line and locale gate | Passed: 1,134 inputs, 202 translated keys |
| Suite discovery | Passed: 297 test files, 35 suites, 32 helpers |
| Patch whitespace | Passed |

The 160 maker tests include the 27 dedicated first-run tests and one additional
setup-wizard integration test proving that the first-run choice follows approved
file generation and Skip performs no execution. They are not additive counts.
Existing project-runtime and compiled-distribution files remain excluded only from
the available local subset because happy-dom and TypeScript 6.0.3 are missing.
They remain selected in normal qualification. No test threshold was reduced.

Process tests execute actual local Node children with controlled fixture scripts.
They cover order, failure at each stage, cancellation, timeouts, source changes,
locks, stale approvals, corrupt reports and one-envelope agent output. One additional
smoke test uses the actual installed npm in offline mode with a dependency-free
fixture to run ci, typecheck, tests and build. This is not a real Angular build or
network installation. The .nvmrc/packageManager in these scratch fixtures explicitly
match their test toolchain; production generated projects retain their exact pins.

Preview tests bind real localhost sockets and verify HTTP responses, static asset
restrictions, host validation, port collisions, health-before-browser ordering,
browser-opener failure handling, timed/explicit shutdown and refused connections
after shutdown. Browser opening itself uses a test double: no browser or Obsidian
session was launched. The server check is not client-side Angular/Hello world
acceptance.

Initial combined regression commands exceeded the execution-call budget and were
rerun in completed bounded groups. The preview teardown test initially reused the
Node HTTP keepalive pool; it was corrected to create fresh connections so it tests
actual listener shutdown. No production assertion or threshold was weakened.

## Commands

```sh
NODE_OPTIONS=--experimental-strip-types node --test --test-concurrency=1 \
  tests/tooling/interactive-maker-first-run*.checks.mjs
# Repeat node --test for the six groups retained in regression-groups.json.
NODE_OPTIONS=--experimental-strip-types node --test --test-concurrency=1 \
  tests/tooling/file-plan*.checks.mjs tests/tooling/framework-process.checks.mjs
node scripts/quality/check-source.mjs
node scripts/testing/suites.mjs --check
git diff --check
# Attempted, blocked by the absent exact compiler:
node node_modules/typescript/bin/tsc --noEmit --project tsconfig.maker.json
```

## Evidence fingerprints

Raw logs and the exact command groups are included in the source handoff archive.

| Log | SHA-256 |
| --- | --- |
| `first-run-tests.log` | `0a01182272a149f908bcac52dd47a34b3f0ebe5ac6f6f787ecf72d6239ab9246` |
| `first-run-regression-1.log` | `4a69d4e9101f1bf37f8bca23d79aa75d9e3545fd5afe35b1ac928ae1ae8124cc` |
| `first-run-regression-2a.log` | `b33bb298f1486221b0d045467d9c9436b62c02b53ca982f6e348f7a36eb72f98` |
| `first-run-regression-2b.log` | `bdf010ca8504935eb7223ce61f8d1e9627e2b07e88d2e8b87fca330ea9fee832` |
| `first-run-regression-3.log` | `5cc84b6241ccce3ef3575be3d60dfab93c35f2abe8aa4b8a22ee06f589a0ac90` |
| `first-run-regression-4.log` | `05c3db7fa73c173f6ab155393e9d9f188a55bc4855baabbf08b03a4b313ea696` |
| `first-run-regression-5.log` | `bdca3f48dcb216064c0cb4a376236c3b6508b0ec861612dc8b8cde3d0f734367` |
| `first-run-shared-regression.log` | `fcbd33fb99081e1878448c8ca2e4c05aa47d66b47809a905850a0511014bcefc` |
| `first-run-source-check.log` | `bc361604df4b7cf50a463714a5af4c5d2418c00ea9c285ee6fc68a579f0e42db` |
| `first-run-suite-check.log` | `df8332b7a048dd09138012e7c7fc11f4f1ea8f8c480cd413208dac85775871c5` |
| `first-run-typecheck.log` | `c24ca8da4e13e89c98c10efa1feab2de2932b64b4b863696cdd784d31ee8447c` |

## Not qualified

Full locked installation, TypeScript 6.0.3, complete lint/analyzer/maintainability/
coverage/verify, compiled-kit execution, real Angular dependency installation,
AOT build and browser application acceptance, Windows taskkill/default-browser
behavior, macOS browser behavior and native Obsidian remain unqualified locally.
Use candidate-specific hosted checks and scratch-project acceptance before promotion.
No success from the parent candidate has been assigned to this extension.

The runner deliberately does not implement hot reload, background daemon control,
full Angular/business acceptance, workspace package-manager selection, automatic
retries, or rollback of arbitrary npm/application script effects. Its health check
and recorded build result must not be labeled complete product acceptance.
