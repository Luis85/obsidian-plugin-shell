# MVP execution: sitemap core increment

**Date:** 2026-09-27. **Status:** partial implementation, not completed MVP acceptance.

Plan: [MVP implementation](../../prds/MVP-IMPLEMENTATION-PLAN.md). Integration contract: [sitemap core](../../development/COMPANION-SITEMAP-CORE.md).

## Baseline and source

Implementation starts from documentation PR #26 commit `d538021fc8da82e3b145199ea2acbd09942808ae`, itself based on PR #5 commit `6178b1025336941ad6fb10eae4e26930622363f9`. Branch: `feat/mvp-journey-lens-core`.

The actual Journey Lens source was located in `docs/concepts/sitemap-editor` on the inspected base. The source hashes and its unverified Vue-build status are recorded in the integration guide. The earlier PRD preparation did not locate it; this is a source-discovery correction, not a new source upload or a claimed ZIP-integrity comparison.

## Implemented

The shared TypeScript core validates and edits the existing canonical surfaces, links and canvas. It adds separate hierarchy/navigation/journey projections, explicit route preservation, staged route/journey/feature subsystem contracts, conservative deletion-impact review, stale-safe candidate transactions and bounded undo/redo.

The framework-free per-view session integrates through a required full-project validator and canonical persistence port. It preserves history on failed writes, freezes after uncertain outcomes, refuses concurrent stale edits and distinguishes committed facts from detached view observation. No duplicate document writer, event bus or browser storage service was introduced.

The real `project inspect` operation now returns an additive read-only sitemap summary. Full transport stays v5; staged extension fields are not accepted by the current full-project importer. No source JSON or assembled concept HTML was regenerated in this increment.

## Initial subset verification

Initially the workspace could not clone GitHub because DNS resolution failed, so validation began with the new core and focused tests in a partial workspace. Files were read/pushed through the connected GitHub API. The full review source was subsequently retrieved from the existing CI artifact, as recorded below. Vue/Nuxt UI/Vue Flow build dependencies remained unavailable locally.

| Check | Actual result and scope |
| --- | --- |
| Core command/projection/history tests | 28 passed |
| Canonical host-port/session tests | 19 passed against an in-memory canonical host; not native persistence evidence |
| Safety/route/feature/boundary tests | 20 passed |
| Total focused tests | **67 passed, zero failed, skipped or TODO** |
| Strict TypeScript core check | Passed with local TypeScript 5.8.3; library checking was not skipped |
| Local runtime | Node 22.16.0 with explicit experimental type stripping |
| Qualified repository toolchain | Node 24.21.0/npm 11.19.1/TypeScript 6.0.3 not executed locally |
| Full checkout integration | Four tests added; not run in the partial local workspace |
| Existing full quality/analyzer/coverage gates | Not run locally; no thresholds/exclusions changed |
| Vue build/browser/native/full generator/release | Not run; no acceptance claim |

Commands for the executed subset:

```sh
tsc -p tsconfig.sitemap.json
node --experimental-strip-types --test \
  tests/tooling/companion-sitemap-core.checks.mjs \
  tests/tooling/companion-sitemap-host.checks.mjs \
  tests/tooling/companion-sitemap-safety.checks.mjs
```

Regression development included red tests for missing core/session modules and two actual JSON safety defects: a sparse array disguised with an extra property, and an array subclass serialization hook. Both defects were fixed and their negative tests pass. These assertions test the actual implementation, not a separate rewrite.

The framework CLI workflow now includes the strict core check and all four sitemap test files on its existing OS matrix. A configured workflow is not a passing result. Exact hosted run status and any unresolved checks belong in the implementation PR; no green hosted qualification is asserted by this record.

## Follow-up: full review source and integration checks

The existing source-verification workflow produced artifact `10932015585` in run `36319059023`. It was downloaded through the GitHub artifact API, verified and extracted without executing archive content. ZIP SHA-256: `429f97f2bedeb9cf5ae6fc32b0328098c55c2bf150cf6ada8cc58e2214be55f7`.

Its recorded merge-checkout commit is `821afae80024f6352641893be7f49b81b475b4f9`, from head `b673943fd7d62aa9ac9ff8b9d1b6ee99c2ff115d`. Reconstructing all Git blob/tree hashes from the archive produced the exact GitHub tree `eb3b24af6a832ab61aefd7f32500a098b5ee4c47`. All 18 implementation source/test/config/document files matched the locally tested files before the follow-up one-line export cleanup.

On this full review source, the following commands ran locally:

```sh
node --experimental-strip-types --test --test-concurrency=1 tests/tooling/companion-sitemap-*.checks.mjs
node --experimental-strip-types --test tests/tooling/companion-project.checks.mjs tests/tooling/companion-storymaps.checks.mjs
node --experimental-strip-types shell.mjs project inspect --input docs/concepts/companion/companion-project.json --json
python -B scripts/concepts/build-companion.py --check
python -B tests/concepts/companion-assembly.test.py
node scripts/quality/check-source.mjs
```

| Follow-up check | Actual result |
| --- | --- |
| Complete sitemap suite, including four real-checkout integration cases | **71 passed**, zero failed/skipped/TODO; this includes the initial 67, not 71 additional tests |
| Existing project JSON / Storymaps compatibility suites | **67 passed**, separate from the sitemap suite |
| Actual CLI invocation against the golden companion JSON | Status `ok`, no diagnostics; 28 surfaces, one native view, 23 internal pages, 26 transitions; no invented route/journey/feature metadata |
| Exact offline concept assembly | Passed; unchanged HTML SHA-256 `ba3a5b657ddea349c5c49c5dbc8857f7bcf06e2dc84b3fb27131187c02712d3a` |
| Assembly/inventory/tamper tests | **19 passed** |
| Source line limits and locale parity | Passed; 811 inputs, 202 translated keys |

The local tools remain Node 22.16.0 and TypeScript 5.8.3. Recovering source did not install the qualified toolchain or frontend dependencies, and these results do not establish native companion or MVP acceptance.

The first hosted project-generator run `36319059029` built the shell but stopped at the unchanged analyzer gate because the new internal `SitemapError` class was unnecessarily exported. The class was made module-private; no suppression or gate change was introduced. The strict core check, all 71 sitemap tests and source-limit checks passed locally again after that cleanup. The same first hosted run's three starter shards passed generation/install/build/typecheck/test for all nine starters. Existing shell E2E and fixture/baseline workflows also reported success on the pre-cleanup head; neither is acceptance of a generated native companion.

Hosted checks on the follow-up head must be read separately in PR #28. Prior successes are not relabelled as final-head qualification, and the failed pre-cleanup generator run is retained honestly.

## Work-package gap register

| Package | Status after this increment | Remaining gate |
| --- | --- | --- |
| WP-01 | Source located and pinned; baseline partially inspected | Complete capability/surface inventory and exact-artifact baseline qualification |
| WP-02 | Shared editor core and host interface implemented | Port and mount real Vue/Nuxt UI/Vue Flow UI in the companion; complete editor commands; browser/keyboard acceptance |
| WP-03 | Staged subsystem types/validators implemented | Coordinated v6 envelope/types/JSON Schema/migrations/exporters and legacy fixture parity; no manual version bump |
| WP-04 | Not implemented | Updated self-project seed/visual seed/export and actual UI round trip |
| WP-05 | Not implemented | Generated source plus offline clickdummy from exact JSON |
| WP-06 | Not implemented | Dependency-aware scoped generators and compatible concept intake |
| WP-07 | Not implemented | Trusted rich-editor modules, native persistence wiring and independent generated companion |
| WP-08 | Not implemented | Complete extracted-kit starter-or-JSON setup and optional GitHub association |
| WP-09 | Not implemented | Qualified prepare/publish workflow; actual writes require separate authorization |
| WP-10 | Not qualified | All MVP acceptance, exact candidate/merged revision and released-asset replay |

This increment contributes to A05–A10, A13 and A19 at the structural/host-contract level only; it does not close their UI, generator or native acceptance. The initial PRD's 250-surface scale target is not supported by the current 60-surface transfer contract and must be reconciled explicitly in WP-03, not silently bypassed by this core.

No PR merge, public release, tag, native-vault installation, credential mutation or security-policy change was performed. Keep the implementation PR in draft while these MVP gates remain open.
