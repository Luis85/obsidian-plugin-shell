# Three-editor verification record

Reviewed baseline: `e72c3a6eb56f9fbb107679e41c1094d4900dab21`.
Date: 2026-09-24. This record captures completed local evidence. Final-head GitHub CI outcomes are recorded in the PR, not inferred from this file or from a previous green commit.

## Exact artifact

- Path: `docs/concepts/companion/index.html`
- Bytes: **1,327,849**
- SHA-256: **`4b28ae3d9ca42f409cf7c32ad9e9998d25f415922950edf134ab7e037c2d4325`**
- Build/analyzer inventory: **86 inputs: 66 maintained JavaScript files, 15 maintained stylesheets, 5 retained vendor JS/CSS assets**.
- Vendor bytes, package/lockfile, native runtime source and production thresholds are unchanged.

## Completed checks

| Check | Observed result |
| --- | ---: |
| New three-editor regressions | 64 passed |
| Existing Data Sources suite | 77 passed |
| Single-vault workflow | 47 passed |
| Semantic model and component variants | 76 passed |
| ER geometry and interaction polish | 67 passed |
| Containers and connections | 64 passed |
| Reference workspace | 50 passed |
| Reference graph | 8 passed |
| Reconciliation and recovery | 34 passed |
| Unified library and spatial behavior | 67 passed |
| Product safety and recovery | 47 passed |
| **Total local browser assertions** | **601 passed** |
| Actual loopback-origin Storage suite | Blocked before assertions; not counted as passed |
| Assembly/inventory/tamper-rejection tests | 10 passed |
| Authored JavaScript syntax | 66 files passed |
| Python AST parsing | 23 files passed |
| Exact source reconstruction | Passed |
| `git diff --check` | Passed |

Local execution used Python Playwright and `/usr/bin/chromium`. Node 22.16.0 was used only for authored-JavaScript syntax checks; it is not the repository-qualified Node/npm toolchain. Qualified root-template verification must run in GitHub Actions with the repository's pinned tooling.

The attempted `--real-storage` run correctly remains **failed** in `browser-summary.json`: loopback navigation returned `net::ERR_BLOCKED_BY_ADMINISTRATOR` before any Storage assertion. It did not replace Storage with a mock or bypass the blocked origin. All 601 preceding assertions passed on the same artifact. CI retains the independent nine-assertion real-origin suite; only a completed CI report can establish its result.

## What the new suite demonstrates

`tests/concepts/companion-editors.browser.py` exercises source creation, operation creation, source-to-native-view and reverse write drags, handle-to-body drop review, keyboard port activation, duplicate-flow rejection, hidden-target/layer reveal, selection/context switching, catalog filters, container handle-menu child creation, Undo/Redo and deletion from the ER and Data Sources modals.

The suite additionally uses explicit controlled state to exercise same-revision concurrent changes, expired record identities, busy-state refusal, a stable geometry arrangement for physical pointer targets, and no-op history. It checks that removal review and cancellation do not change canonical state, keeps unsaved captions and hidden data-shape fields, and distinguishes saved data restored by Undo from text never saved.

Every new suite report includes the exact HTML hash, named assertions, scope labels, fatal errors, console errors and runtime request collection. No page or console errors or runtime network requests were observed on the exercised routes. The counts are assertions, **not 601 independent physical-user journeys**. Local HTML injection and controlled Storage do not establish native-vault persistence.

The retained Data Sources geometry fixture now explicitly invokes Fit before probing the whole graph. This is necessary because Show on sitemap deliberately focuses the selected source rather than reframing every card. No assertion or acceptance threshold was removed.

## Before/after and visual evidence

The four reported-defect command fixtures were executed against both the baseline artifact and the corrected artifact. The old version substituted a different source for an unconfigured source, showed the stale surface in the inspector, projected two lines for a new container child, and lacked removal in the ER relationship modal. The corrected artifact rejected substitution, showed source context, projected one Contains line and exposed in-modal removal. The raw comparison is retained as `reported-defects-before-after.json` in the downloadable review evidence.

Batched screenshot inspection covered the source inspector and ER removal review at a wide desktop viewport, plus the Data Sources catalog and data-flow removal at a narrow 760-pixel viewport in light theme. The missing shared trash glyph was corrected. Final screenshots use a clean illustrative workspace rather than the concurrent-edit test fixtures. Keyboard focus and horizontal-overflow assertions supplement these captures.

Current screenshot paths under `reports/concepts/editors/`:

- `sitemap-source-inspector-dark.png`
- `entity-removal-dark.png`
- `sources-light-narrow.png`
- `data-flow-removal-light-narrow.png`

## Reproduction

```sh
python3 -B scripts/concepts/build-companion.py --check
python3 -B tests/concepts/companion-assembly.test.py
CHROMIUM_EXECUTABLE=/path/to/chromium python3 -B tests/concepts/companion-editors.browser.py
CHROMIUM_EXECUTABLE=/path/to/chromium python3 -B scripts/concepts/run-browser-checks.py --real-storage
```

The permanent read-only companion workflow runs the registered current suites, including these new tests and actual multi-page Storage, on one exact artifact. Root-template authoring, compatibility, showcase and fixture workflows remain required separate evidence on the final PR head. Older green results cannot qualify this iteration.

## Not established

Native companion installation, actual API/database/vault operations, compiled semantic generator output, file-origin persistence, atomic simultaneous writes, complete WCAG/screen-reader/device coverage and measured maximum-scale performance remain outside this evidence. The shared helpers reduce duplicate selection/removal logic; they do not turn concept globals into a production module architecture. See [EDITORS-REVIEW.md](EDITORS-REVIEW.md).
