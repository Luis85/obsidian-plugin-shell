# Test data and Design System: verification record

## Baseline and exact candidate

This increment starts from PR #5 head `e413ec628b4227c4b8dc8b6ec3d12b8487533557`, whose three-editor selection, data-flow, container-child and in-modal removal fixes are preserved. See `EDITORS-REVIEW.md` for that review rather than treating it as newly authored work here.

The locally exercised generated HTML is **1,481,550 bytes**, SHA-256 **`3ec17ce8523657cb8db2c13e1c03e8e849ac43bb51a8de3f3afeba363b0e3910`**. Exact reconstruction passed. The explicit build/analyzer inventory is **103 inputs: 74 authored JS, 17 authored CSS, seven executable test-kit modules and five unchanged vendor JS/CSS inputs**.

Production runtime source, dependency pins, root lockfile and vendor bytes are unchanged. The test kit has its own isolated analyzer zone; only that zone and tests may import it. No production boundary or numeric quality threshold is relaxed. The `.test-vault/` directory is ignored; no actual user vault is written by building or opening the concept.

## Completed local execution

| Check | Observed result |
| --- | --- |
| Design System browser suite | 37 assertions passed |
| Test-data browser suite | 39 assertions passed |
| Retained three-editor review | 64 assertions passed |
| Retained Data Sources | 77 assertions passed |
| Retained single-vault workflow | 47 assertions passed |
| Retained semantic model and variants | 76 assertions passed |
| Retained ER polish | 67 assertions passed |
| Retained containers/connections | 64 assertions passed |
| Retained reference workspace/graph | 58 assertions passed |
| Retained reconciliation/recovery | 34 assertions passed |
| Retained unified library/spatial | 67 assertions passed |
| Retained product safety/recovery | 47 assertions passed |
| **Completed browser assertions** | **677 passed** |
| Real-origin browser storage | Environment-blocked navigation; zero assertions executed |
| Real Node fixture, filesystem, HTTP server and client tests | **24 passed**, zero failed/skipped |
| Assembly/inventory/tamper tests | **10 passed** |
| JavaScript syntax | 74 authored fragments and seven kit modules passed |
| Python syntax | 25 source files parsed |

Local Node was 22.16.0/npm 10.9.2; this is not the repository's qualified Node/npm combination. The required full template workflows must execute independently on the final pushed head. No dependency installation, actual Faker package qualification, native Obsidian launch or release was performed locally.

`python3 -B scripts/concepts/run-browser-checks.py --real-storage` correctly returned failure when loopback navigation was blocked by the execution environment. The 677 earlier assertions passed on one artifact; the blocked Storage suite was not removed, skipped, replaced with a Storage mock or labeled successful. GitHub's retained workflow must actually execute that separate suite. Final-head CI results are recorded in the PR, without rewriting this historical local observation.

The browser totals include controlled-state, computed-style, geometry and actual-input assertions, not 677 distinct physical-user journeys. Normal concept suites use their explicitly declared Storage test adapter. The independent real-origin suite has a different evidence scope.

## Executable test-data proof

The browser test downloads the actual ZIP, unpacks it into a temporary directory and invokes its real CLI. It proves a read-only initial plan, approved fixture application matching every browser-preview byte, and reset that preserves an unrelated note. The kit also supplies an actual HTTP client; separate Node tests run it against the actual ephemeral loopback server and verify list/upsert/delete, payload validation, path/query encoding, cancellation and disposal.

The filesystem suite exercises real temporary files, ownership receipts, stale approvals, manual edits, retained obsolete fixtures, preserved plugin configuration, symlinks/junctions, hardlinks, case collisions and recovery locks. It does not claim an OS-level transaction against a malicious process racing directory replacement.

A controlled injected provider verifies the optional Faker seam and provider-specific approval identity. This is **not evidence that the actual Faker package was installed or tested**. Built-in deterministic generation requires no package installation.

## Review findings resolved in this increment

| Perspective / risk | Resolution |
| --- | --- |
| Product fidelity: random values alone do not simulate a source | Separate fixed fixtures, explicit stateful datasets, vault seeding, loopback HTTP and injected database ports; no SQL-engine fidelity claim |
| Reliability: repeat runs drift or break relationships | Fixed seed/date/provider, field-local streams and allocated shared entity identities before links |
| Data safety: regeneration/reset may overwrite notes | Preview hash approval, strict target containment, receipt ownership, conflicts on manual edits, scoped locks and rollback |
| Model integrity: request/output or folder mismatch | Live declared schemas, shared entity pools, cross-operation dataset validation, no invented mapping |
| Interaction race: cancelled or old request overwrites new state | Session/controller identity checks, abort on operation/source/page changes and stale contract checks |
| Bounded execution: nested arrays multiply work before file limits | Independent expanded-value budget in addition to record/file/byte limits |
| HTTP correctness/security: ambiguous routes, input collisions, live fallback | Unique whole-segment parameter rules, exact loopback Host/token, duplicate input rejection, no redirects/proxy fallback |
| Design-system clarity: authored tokens accidentally restyle the host | Scoped samples and saved declarations; host font references with local fallback; component styling remains explicit |
| Export safety: authored text becomes executable markup or CSS | Typed allowlists, escaping, script-free standalone HTML with CSP, no font/asset downloads |
| Recovery: stale token edit, deletion or target change loses work | Full-snapshot owner guards, existing removal-review pattern, exact draft return, used-font protection and no-op/Undo semantics |

## Visual and interaction evidence

Batched inspection covered the populated typography editor in the workbench's dark theme, light/narrow color editor, exported narrow HTML guide, test-data workspace and light/narrow recipe form. Corrections included the existing border token, available icons, accurate offline-export banner and explicit keyboard-modality focus tests. Export and Save controls remain reachable; content scrolls inside its allocated region.

Evidence paths: `reports/concepts/style-guide/`, `reports/concepts/test-data/`, the retained editor-suite folders, and the exact-artifact `browser-summary.json`. Outputs may contain the deliberately synthetic examples entered by the tests. No font binaries belong in retained delivery packages.

## Remaining qualification

The companion is still the interactive concept, not an installed native plugin. These exports do not automatically wire the generated plugin's bootstrap, apply design tokens to component implementations, supply a production API/database adapter or install Faker. Native transport/CORS integration, generated-plugin compilation against the new ports, actual database-engine seeding, full JSON Schema, filesystem crash/power-loss recovery, screen-reader/device acceptance and maximum-scale performance need separate qualification. Current limits are guardrails, not performance guarantees. Authored descriptions/defaults can contain private project data; export is not a secret scanner.
