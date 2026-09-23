# Product review verification

Review baseline: `b79605eb1f8694770078126b33e79a118448dc8a`. Local review date: 2026-09-23. Source snapshot retrieved through GitHub Actions with its archive identity retained; concept inputs match the PR branch. Root architecture configuration changes are based on the branch's original file, not unrelated changes in the temporary PR merge snapshot.

## Exact locally tested output

- HTML: `docs/concepts/companion/index.html`
- Bytes: **1,119,472**
- SHA-256: **`7c8fe3feaf3acf4cfcbd39de7c61e7c4957c4a2233c7ca94c4f4a8537b17dfb7`**
- Actual local runtime: Chromium **144.0.7559.96**, Linux headless; Python Playwright **1.57.0**.
- JavaScript syntax interpreter: Node **22.16.0**. This is not the root template's qualified Node 24 toolchain.

| Executed local check | Result | Scope |
| --- | ---: | --- |
| Current containers/connections suite | 64 passed | Includes actual endpoint dragging and geometry checks. |
| Reference workspace | 50 passed | Current reference/content workflow, with explicitly controlled states. |
| Reference graph interactions | 8 passed | Current Vue Flow interaction paths. |
| Reconciliation/recovery | 34 passed | Current modal/content safeguards. |
| Unified library/spatial behavior | 67 passed | Current library/content/section behavior. |
| New product safety/recovery | 47 passed | Import, persistence adapter, limits, no-op edits, camera boundary and narrow recovery UI. |
| **Current concept assertion total** | **270 passed** | All six suites ran against the exact same output above. |
| Assembly rejection tests | 5 passed | Exact assembly, missing/extra source inventory, vendor tampering and stale output. |
| Authored JavaScript syntax | 48 files passed | No execution of project operations. |
| Exact source assembly / whitespace check | Passed | Deterministic reconstruction and `git diff --check`. |

Machine-readable local summary: [verification-product.json](verification-product.json). Raw suite reports and screenshots are produced under `reports/concepts/`; the read-only CI workflow retains these as `companion-browser-evidence`.

No observed page/console errors or runtime network requests occurred in the six current local suites. Totals are named assertions, including model, controlled-state, geometry and synthetic-event fixtures, not a count of physical-pointer journeys. Historical reports are retained but not added.

## Explicitly separate evidence

**Real browser storage:** the local environment rejected loopback navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. The new `companion-storage.browser.py` therefore has no local passing claim. It uses a real loopback HTTP origin, unmodified browser Storage and two pages, and is required by CI's `--real-storage` run. File-origin behavior remains a separate unverified boundary even if HTTP-origin storage passes.

**Pinned analyzer:** the local environment has no installed root npm dependencies. The new three analyzer fixtures must execute under the actual pinned Fallow version in the ordinary template verification workflow. They are not replaced by JSON-shape assertions or a mocked analyzer. Production import rules, required coverage and thresholds are not relaxed.

**Remote status:** consult the checks on the final PR head. Creating a workflow or scheduling a run is not passing evidence. This record reports the local candidate; any later CI closure is recorded separately with the exact source commit and workflow run.

## Reproduction

From the repository root:

```sh
python3 scripts/concepts/build-companion.py --check
python3 tests/concepts/companion-assembly.test.py
for file in docs/concepts/companion/src/*.js; do node --check "$file"; done
CHROMIUM_EXECUTABLE=/path/to/chromium python3 scripts/concepts/run-browser-checks.py --real-storage
# After normal repository dependency provisioning with its qualified toolchain:
node --test tests/tooling/companion-boundaries.checks.mjs
node scripts/quality/check-architecture.mjs
```

The runner removes stale per-suite reports, requires nonempty passing assertions and matching artifact hashes, and stops on failure. It preserves raw output. No personal vault, native app, actual setup command, activation or publication is used by the concept suites.

## Remaining qualification limits

No claim is made for native Obsidian, real filesystem adapters or CLI operations, production code generation, Windows/macOS devices, physical touch/pen, screen-reader conformance, all WCAG criteria, file-origin persistence or atomic multi-window locking. The prototype remains an illustrative companion, not a second production generator.
