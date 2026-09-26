# Storymaps verification and delivery record

**2026-09-24 · Local implementation and qualification; not pushed to PR #5.**

## Exact baseline and artifacts

Implementation began on PR #5 at `e71c655fe376e51a520fb8f194800e9294eb8e4e`. The branch advanced during the work. The final local delivery incorporates the Windows path/CRLF test repair from **`b0f50ecb6ef1c1db75f5d1358185d860d8801742`**, whose complete source tree was independently reproduced as **`f32a1b3a368f039ea386dda1e55dd02f506758e8`**. Its repair record and canonical-path/unsafe-key regression assertions are retained unchanged except for updated seed counts and the now-unsupported future format version.

| Artifact | Identity |
| --- | --- |
| `index.html` | 1,630,560 bytes; SHA-256 `c06d8cd35be88683fedc496570afc6ff935a58ea106b7a32f132a2cacf967a72` |
| `companion-project.json` | SHA-256 `dc6b446e3b179f3cb01bd2d4f82eeccd21554417ec499d5112084cf10cfa40f5` |
| Concept authoring inputs | 115 explicitly inventoried inputs; shared Storymaps validator additionally registered as a tooling entry |

The source archive, local patch and downloadable HTML represent this implementation. They are not remote commits or GitHub CI artifacts. The available GitHub connection was read-only and direct Git access failed; **PR #5 was not updated by this delivery**. Apply the supplied patch to its stated base and run the normal workflows before treating the branch as qualified.

## Executed results

| Verification | Actual result |
| --- | --- |
| Storymaps browser suite | **60 named assertions passed** |
| All 17 declared non-network browser suites | **959 named assertions passed**, including those 60 |
| Node JSON/CLI, Storymaps and test-data tests | **73 passed**: 13 project-contract, 33 Storymaps, 27 test-data tests |
| Assembly, inventory and tamper rejection | **12 passed** |
| Authored concept JavaScript syntax | **84 modules parsed** |
| Concept Python syntax | **29 files parsed** |
| Rebuilt HTML and built-in/example JSON | Exact matches |
| Final source whitespace check | `git diff --check` passed |

All 17 passing raw browser reports carry the final HTML hash, contain only passing named assertions, and report no observed page/console errors, fatal exceptions or unexpected requests in their exercised scope. The combined record is `reports/concepts/storymaps-local-qualification.json` in the evidence package.

Individual browser suites were executed in bounded parallel batches and independently verified by report identity; one earlier sequential orchestration was interrupted by the container time limit. Targeted repeats replaced their earlier report rather than adding to the total. This is **not** a claim that the `--real-storage` runner completed successfully.

| Suite | Assertions |
| --- | ---: |
| storymaps | 60 |
| project-transfer | 65 |
| product-audit | 67 |
| consistency | 89 |
| style-guide | 37 |
| test-data | 39 |
| editors | 64 |
| data-sources | 77 |
| single-vault | 47 |
| semantic | 76 |
| er-polish | 67 |
| containers | 64 |
| reference | 50 |
| reference-graph | 8 |
| reconciliation | 34 |
| unified | 67 |
| safety | 48 |

## What the tests establish

Actual browser controls create a PRD-linked map, activities, steps, releases and stories; edit details and links; navigate through the PRD and sitemap backlink paths; move cards with pointer input and named non-drag controls; use Undo/Redo; cancel a drag; preserve and discard drafts; review removal; duplicate/archive/restore maps; and switch Map/Outline representations.

The export test downloads actual Markdown and full-project JSON. Those JSON bytes pass through the real Node CLI in an isolated temporary vault, return unchanged on stdout and create no target or foreign-file modifications. A reviewed file import reproduces the full semantic document. Older v1 input without storymaps starts with an empty collection. The self-project export must match the checked-in example.

Explicitly labeled controlled-state fixtures cover same-revision concurrent edits, failed Storage writes, stale retained storage, active operations, renamed targets and missing references. They complement actual input tests; they are not real concurrent Obsidian sessions or real-origin persistence evidence. The 500-story test validates deterministic model layout, not large-graph browser speed.

The existing unified editor regression exposed an empty-storymaps migration changing the legacy compiler fingerprint after sitemap Undo/Redo. Storymaps are now excluded from `generationSnapshot`, along with visual canvas state. Full-project JSON continues to preserve them. The retained endpoint-only fingerprint assertions pass. Markdown export also escapes unresolved external IDs as well as labels; an explicit injection fixture verifies this boundary.

## Visual review

The final 1440px dark/light, 960px dark Map, and 390px dark Outline captures were reopened and inspected. The existing workbench palette, typography, controls and sidebar are retained. The material correction batch keeps canvas zoom controls in the visible pane, offers a collapsible inspector, and reduces header action density. Initial captures contained a transient import toast; the final test waits for the real toast element to detach, without altering app data or weakening CSP, before capture.

This was an **in-thread local review**, not an independent reviewer or native device review.

### Review disposition: ship for local concept review

**Persistence:** The feature guide, compatibility notes and native-conversion impact are recorded. No new global visual identity or runtime storage service was introduced.

**Fidelity:** Type and ground match the existing theme tokens. Material remains ordinary DOM cards and a genuine Vue Flow renderer. Activity/step/story/release distinctions and the two entry paths are present. The narrow Outline is an intentional non-drag adaptation of the same model. Canvas content outside the viewport is pannable; Fit and Locate are explicit actions.

**Ceiling:** The scoped editor and ordinary form/outline flows are reviewed. Formal contrast/assistive-technology conformance, maximum-scale rendering and native touch/pen behavior remain unqualified.

**Material fixes:** The listed viewport-control, inspector-width, header-density, target-inspector navigation and generation-fingerprint defects are resolved in the delivered scope. No general defect-free or native-ready claim is made.

**Keep:** Preserve the distinction between planned user experience, existing artifact references and implementation evidence.

### Design-system documentation

No changes to the incumbent global design system. Checked `src/workbench.css`, `src/ui-fields.js`, the new `src/storymap.css`, and the existing/current editor captures. The feature inherits paired dark/light surfaces and one accent, existing system-font hierarchy, shared button/form states, scope-local layout, and semantic rather than decorative card color. Existing shell-wide visual choices outside this feature were not recast as new rules or repaired unasked.

## Blocked and unexecuted gates

**Real-origin storage:** The final-artifact test exits during navigation to its loopback HTTP server with `net::ERR_BLOCKED_BY_ADMINISTRATOR`. Zero actual-origin assertions were executed. Browser policy was not bypassed. The raw failure report/log are retained in the evidence package. Earlier PR-head CI storage passes do not qualify this changed artifact.

**Root analyzer:** The four analyzer-dependent tests in `companion-boundaries.checks.mjs` cannot run because `node_modules/fallow/bin/fallow` is absent. They exit before obtaining analyzer output. Dependency installation/direct Git network access is unavailable. The explicit input inventory and assembly/tamper checks pass independently; they are not substitutes for Fallow or the root quality gates. No thresholds, exclusions or security policies were weakened.

**Environment:** Executed locally with Node 22.16.0, Python 3.13 and `/usr/bin/chromium`. Repository CI's Node/npm matrix, Windows workflows and complete production dependency/quality checks must be rerun after applying the patch. Node 22 results are supplemental, not evidence for the supported Node 24 matrix.

**Native/release:** Native Obsidian, vault Markdown codecs, file-origin persistence, assistive technologies, large-graph browser profiling, multi-window atomicity, code generation and publication remain separate gates. No release, merge, force push, source acquisition or plugin activation occurred.

## Reproduce

Use the repository's supported Node/npm toolchain for complete integration qualification:

```sh
node --test tests/tooling/companion-project.checks.mjs tests/tooling/companion-storymaps.checks.mjs tests/tooling/test-data-*.checks.mjs
python -B scripts/concepts/build-companion.py --check
python -B tests/concepts/companion-assembly.test.py
CHROMIUM_EXECUTABLE=/path/to/chromium python -B tests/concepts/companion-storymaps.browser.py
CHROMIUM_EXECUTABLE=/path/to/chromium python -B scripts/concepts/run-browser-checks.py --real-storage
```

The final command requires an environment permitting loopback browser navigation. Run the normal root/template workflows as well; the commands above cover the concept/handoff scope only.
