# Verification record — strategy and deterministic baseline

**Date:** 2026-09-22. **Reviewed base:** `9ae1d30b532b78cb58ba3620ea00af4f4f73e59d`.

This record concerns the original stylesheet specimen and the new verification tooling. It is not a plugin release, native acceptance, production coverage report, or proof that planned Vue/services/setup/makers exist.

## Implemented and executed

| Command/check | Result | Scope |
| --- | --- | --- |
| `node scripts/testing/verify-baseline.mjs --repeat 3 --json` | Passed: **40 distinct Node tests**, three independent suite executions, **120 passing executions**, zero retries. | HTTP specimen, inventory policy, fault observer, source/LoC, runner negative controls, stylesheet tripwires, report integrity. |
| Optional browser probe, explicit inline mode, repeated twice | Passed: **8 distinct checks**, **16 passing executions** in fresh browser contexts. | Inline original CSS/JS specimen only. |
| Same browser probe, served mode, repeated twice | **Infrastructure error**, exit 2: `ERR_BLOCKED_BY_ADMINISTRATOR`. | This environment blocks Chromium loopback navigation. No served-browser or CSP/import-loading pass is claimed. |
| `node scripts/testing/verify-baseline.mjs --profile release --json` | **Blocked**, exit 2, `RELEASE_NOT_IMPLEMENTED`. | No native/candidate verifier exists; this guard cannot publish or certify a release. |
| Unknown CLI option | Rejected, exit 2. | No silently ignored flags. |
| Temporary copy with a new 401-line script | Rejected by actual CLI, exit 1, `SOURCE_LINE_LIMIT`. | Working-tree source gate, not only a unit test of a counting function. |
| Temporary copy with an unregistered test file | Rejected, exit 2, `UNREGISTERED_TEST_FILE`. | A new test cannot silently fall outside the explicit runner inventory. |
| `node --check` over current JS/MJS tooling/specimen/tests | Passed. | Syntax only, not the future TypeScript/Oxlint/ESLint gate. |
| JSON/JUnit parsing | Passed; JUnit contains all **120** Node testcase executions. | Structured reports preserve every repetition. |

The passing Node run's acceptance evidence is **9 verified within their declared narrow scope, 6 partial, 75 not run**, across 90 specified acceptance cases. Eight of the verified cases concern this newly delivered verification subsystem; the remaining one covers the HTTP specimen boundary. This is not a 90-case runtime suite. Browser diagnostic results are reported separately and are not silently promoted into integrated/native evidence. Production code coverage is **not measured**.

## Exact execution inputs and reports

The final Node, inline-browser, and blocked served-browser runs share this execution-input SHA-256:

```text
91721c5fef7a8ee77f2e774b26706a1076b9f81adab2294667014f9363ab458c
```

The digest covers the sorted files under harness/, scripts/, tests/, the machine test plan, and the baseline CI workflow. It includes new files and their bytes. It is **not** a full-repository commit attestation, and deliberately excludes the record that documents it. Runtime release evidence must separately bind complete candidate assets and trusted source identity.

Final run directories, retained in the downloadable evidence package but ignored in Git:

- Node: `reports/verification/run-1790079104050-ef9e500b-ccfc-4c4e-afa3-b7f1aa416e4f/`
- Inline browser: `reports/browser-specimen/run-1790079144117-a3b0bad8-7ad9-44cc-9c34-41272c0a2056/`
- Served browser: `reports/browser-specimen/run-1790079174844-f6965b1e-72c7-42e7-a4c2-c9b83d67192b/`
- Release guard: `reports/verification/run-1790079191972-b5fbe988-b4d4-441b-8b5f-53215a3734d4/`

Node reports include input files/hashes, executed IDs, counts, semantic outcome digests, pending suites, acceptance scope, and unmeasured coverage. Browser reports include mode, actual driver/browser, semantic observations, errors, and source digest. Repeated semantic outcomes match; timestamps, temporary paths, and durations are not forced equal or represented as deterministic.

## Environment and reproduction

Executed locally on Linux with Node **22.16.0**, npm **10.9.2**, and installed Chromium **144.0.7559.96**. The available browser driver was the pre-provisioned `playwright-core` **1.57.0-beta-1764944708000** embedded in the environment's Python Playwright installation. These are **observations**, not a new recommended dependency matrix or instructions to install an old prerelease.

The optional browser command used explicit trusted local overrides:

```sh
node scripts/testing/check-browser-specimen.mjs --mode inline --repeat 2 \
  --driver /opt/pyvenv/lib/python3.13/site-packages/playwright/driver/package/index.mjs \
  --browser /usr/bin/chromium
```

Normal future use resolves a qualified local `@playwright/test` installation and its provisioned browser. No package was fetched, no unpinned npx installation was used, and no driver/browser files are committed. The default served mode never silently falls back to inline.

Combined shell validations were terminated by the outer tool deadline before the second browser repetition completed. Their results remained infrastructure-error and were not accepted. The final browser command was run independently to completion; the incomplete records were not rewritten as success or hidden by a retry mechanism inside the test runner.

## Defects caught while codifying the strategy

The new tests exposed inherited `NODE_TEST_CONTEXT` breaking nested negative-runner isolation; child environments now remove it. A plan-evidence test caught an overly permissive acceptance predicate that could accept one complete link while another required assertion failed; every whole-coverage link is now required. A stylesheet assertion initially assumed a literal light-theme selector despite the fixture using light defaults; it now checks the actual declared model while browser tests exercise both computed themes.

Failure preservation was strengthened: a successful first repetition cannot promote acceptance when another repetition fails, and JUnit contains all repetitions rather than only the first. The controlled browser error test proves console-error observation with exact count; pageerror monitoring is installed, but no claim is made that this fixture exercises the future captured-Vue-error integration.

## Configured, not executed here

A baseline GitHub workflow now specifies Ubuntu/Windows checks using exact **Node 24.21.0** and full-SHA-pinned official checkout/setup-node/upload-artifact actions. Those action references were read from GitHub's API. Local Node 22 results do not establish Node 24 or Windows success. Workflow publication and a completed hosted run must be inspected independently before claiming CI success. No browser, native, or release job is disguised as part of the dependency-free baseline workflow.

## Still pending

Qualified Vitest/Vue/Pinia coverage, real application/adapter suites, independent captured Vue defects, full Vite style artifact parity, actual entity Markdown creation, native Obsidian and mobile devices, screen-reader/axe qualification, property-based and mutation testing, fresh setup/maker generation, dependency-update integration, and release candidates remain pending. Their cases stay in the machine inventory with explicit evidence modes and owners.

The [strategy](TEST-STRATEGY.md) defines the risk policy and release conditions; the [test concept](TEST-CONCEPT.md) defines concrete runners, fixtures, oracles, and their migration into the required stack. The current gate verifies only what can be genuinely executed now.
