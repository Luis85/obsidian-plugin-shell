# PR #5 product review — evidence and limits

**Date:** 2026-09-27. This record supports the [product review](../product/PR5-PRODUCT-REVIEW.md) and [improvement plan](../product/PR5-IMPROVEMENT-PLAN.md). It is an inspection/reproduction record, not full repository verification, native companion acceptance or release authorization.

## Source identity

Reviewed PR #5 head: `ec70e2cee7d8aed6e794a15252b2b9cc48b05dcf`. Source tree: `221a4ef3c80117a501912a99f94bd2e06e92da2e`. Branch: `docs/companion-plugin-prd`.

Source came from the current [Companion concept source verification run](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36346512538), artifact `10940428449` (`companion-review-source`), rather than an assumed local checkout. Direct cloning was unavailable in the review environment. The retained source marker is GitHub's merge checkout `f4f6fd5f54dd1cb8432186594a24312176f8799b`; [comparison with the PR head](https://github.com/Luis85/obsidian-plugin-shell/compare/ec70e2cee7d8aed6e794a15252b2b9cc48b05dcf...f4f6fd5f54dd1cb8432186594a24312176f8799b) returned one additional merge commit and no changed files. The reviewed source is therefore tree-equivalent, not the same commit identity.

| Retained input | SHA-256 |
| --- | --- |
| Source artifact ZIP | `3e2f4dc2bd91450e720b12b120d2ab25b1296622737b9ac2eff94a0a00e0b066` |
| Nested source tar.gz | `0755a1f1e3cb2a35698a69b3d33e4d0bbd91a6bdba3706faea93d8cb0f4d230f` |
| MVP authoring artifact ZIP, ID `10940477045` | `be5ae98e501753cbb90bffe8b20cce164fbc697ceba34b6bad2ad5fb6a05c390` |

The artifact API records expiry on 2026-10-04 for these run artifacts. Preserve approved evidence before expiry when qualifying a release; this document retains identifiers and hashes, not an assurance of indefinite remote availability.

## Current hosted artifact inspected

The downloaded `companion-mvp-authoring` archive contains build, browser, inspection, install/project/build logs and separate generated-output receipts.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Current authoring `index.html` | 3,887,705 | `b5a586267c1a8bc2bfefcb208b884974a8e6d7e352e7430d26e78ef0af379f49` |
| Current v6 `companion-project.json` | 2,248,937 | `d8a987a2fa4d2a0ae6c5748c4f2455a0eb93796da0c0cb75a9acae4b70666c91` |
| Generated `clickdummy.html` | 4,167,429 | `20d207f58c0ec902f3b2c5730445732af4eb2adbbfa564c0e2dea92cbe60b638` |

`browser.json` records **26 authoring assertions**: actual Vue/Pinia/Vue Flow integration, canonical IDs/routes, committed rename/move/undo, modal focus, adjacent page-editor navigation, new journey/surface, export/import, dirty-input protection, narrow containment and offline execution. `generation/browser.json` records **nine clickdummy assertions**: single-file operation, compiled non-modal pages, real preview states, modal containment/return, full JSON export, independent reset, no external requests and no uncaught errors. Neither record contains an error or external request.

`generation/checks.json` reports install, generated project verification and clickdummy build exit status 0. `generation/summary.json` reports `scaffold-qualified`, 2,063 files, 27 page designs, 54 component definitions/revisions, 131 visual interactions, 33 acceptance TODOs and two business TODOs. It also explicitly reports **31 pending requirements**, `requirementAcceptance: not-implemented` and `nativeAcceptance: not-run`. Its compile-time readiness fields remain `not-run`; the subsequent execution receipts are separate evidence, not a reason to rewrite the earlier compiler result.

The authoring and generated screenshots were inspected visually. The narrow authoring capture is 880 pixels wide. The graph screenshot is a post-test state, not a clean initial layout; its filename is not reliable proof of the displayed theme. Generated-output observations concern the actual captured design, not a guessed CSS root cause.

## Hosted workflow snapshot

At the recorded inspection of head `ec70e2c`, the following PR-triggered workflows were observed. This table is a dated snapshot, not a live CI badge and not an exhaustive branch-protection determination.

| Workflow / run | Observed result |
| --- | --- |
| [Companion concept source verification / 36346512538](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36346512538) | Success |
| [Dedicated compiler qualification / 36346512517](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36346512517) | Success |
| [Native integration starters / 36346512495](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36346512495) | Success; contract/runtime-double/generated-starter scope, not complete native companion acceptance |
| [Optional memory tooling contracts / 36346512510](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36346512510) | Success; offline fixture scope |
| [CI / 36346512502](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36346512502) | Failed; Windows Showcase stopped at maintainability classification |
| [Setup npm policy compatibility / 36346512507](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36346512507) | In progress at inspection |

The later completed [Windows Showcase job 108696684776](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36346512502/job/108696684776) failed at `scripts/quality/check-maintainability.mjs` with `METRIC_UNCLASSIFIED_INPUT: scripts/hindsight/embedded.py`. The maintained [inventory](../../scripts/quality/maintainability-inventory.mjs) only classifies Python beneath `scripts/concepts` and `tests/concepts`; the new optional Hindsight Python tooling is outside that policy. The install and preceding tooling, type/lint, source, presentation, architecture and zero-finding analyzer steps had passed in that job. Later steps and its served-showcase replay were not reached. This is an actual integrated-tree blocker, not an npm-install failure or a reason to weaken the gate. Fix the explicit language inventory with negative controls and separate Python evidence before rerunning full verification (R11/IP-11).

The same workflow's [Windows Framework CLI job 108696684938](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36346512502/job/108696684938) passed, including extracted-archive consumer verification. Its [Real Obsidian E2E job 108696685011](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36346512502/job/108696685011) also passed; that shell-host evidence is not complete native companion acceptance. No uninspected job or downstream skipped mode is promoted to success.

The [repository releases endpoint](https://api.github.com/repos/Luis85/obsidian-plugin-shell/releases?per_page=5) returned an empty list at inspection. This review created no release or tag. Recheck latest source and every applicable workflow before a merge/release decision; documentation changes do not inherit an automatic current-head green claim.

## Local reproduction

Environment: Linux, Node **22.16.0**, npm **10.9.2**, TypeScript **5.8.3** available, Python **3.13.5**. This differs from the repository-qualified Node 24.21.0/npm 11.19.1/TypeScript 6.0.3. No full dependency install or root `npm run verify` was run. Source was unpacked into a disposable directory, not a personal vault.

| Command / group | Observed result | Evidence scope |
| --- | --- | --- |
| Focused compiler/authoring/sitemap/concept Node command below | 81 passed, zero failed/skipped/TODO | Source contracts and negative paths |
| `node --experimental-strip-types --test --test-concurrency=1 tests/tooling/visual-*.checks.mjs` | 168 passed, zero failed/skipped/TODO | Visual IR/catalog/migration/commands/dependencies |
| `node --experimental-strip-types --test --test-concurrency=1 tests/hindsight/*.checks.mjs` | 67 passed, zero failed/skipped/TODO | Real local configuration/subprocess fixtures; external SDK/provider doubles |
| `python3 -B -m unittest discover -s tests/hindsight -p 'test_*.py' -v` | 24 passed | Embedded/provider adapter fixtures, not live models |
| `node --test docs/concepts/jev-prompt-editor/tests/domain.test.cjs docs/concepts/jev-prompt-editor/tests/logic.test.cjs` | 148 passed, zero failed/skipped/TODO | Domain behavior over retained compiled prototype code; not a new frontend build |
| `python3 docs/concepts/jev-prompt-editor/tests/schema.test.py` | 20 checks passed | Schema/example consistency |
| `python3 scripts/concepts/build-companion.py --check` | Passed | Legacy concept: 3,423,529 bytes, SHA-256 `1c988bc6603ad215eafc590af89068d681728bb7918223b87af8f481403bcd77` |
| `python3 scripts/concepts/export-companion-project.py --check` | Passed | Legacy v5 export: 2,242,151 bytes, SHA-256 `be2c2f4a0dd9f1829426e839cc2ccfef6c2df81fe1ab741c19226160d1c74d5f` |
| `python3 tests/concepts/companion-mvp.browser.py` against downloaded current HTML | Blocked before navigation, exit 1 | `net::ERR_BLOCKED_BY_ADMINISTRATOR` for `file://` |
| Same browser command with `--clickdummy` | Blocked before navigation, exit 1 | Same environment policy; not a product regression or successful replay |

The focused command was:

```sh
node --experimental-strip-types --test --test-concurrency=1 \
  tests/tooling/compiler-core.checks.mjs \
  tests/tooling/companion-authoring-contract.checks.mjs \
  tests/tooling/companion-sitemap-core.checks.mjs \
  tests/tooling/companion-sitemap-safety.checks.mjs \
  tests/tooling/companion-concept-intake.checks.mjs
```

The Node groups total **464 passing tests**. Python tests, schema checks, deterministic assembly checks and hosted browser assertions are reported separately to avoid mixing unlike evidence. The local browser policy was not bypassed; inline-origin or mocked-storage execution was not relabeled as file-origin acceptance. The generated clickdummy was inspected from the current hosted artifact, not rebuilt locally.

## Source-to-finding map

Paths below are relative to the reviewed source. Later edits require fresh comparison, especially where entry documentation is updated by this review.

| Review area | Primary source seams |
| --- | --- |
| CLI entry, setup, scopes and discovery | [CLI](../../scripts/framework/cli.ts), [catalog](../../scripts/framework/catalog.ts), [operations](../../scripts/framework/operations.ts), [schemas](../../scripts/framework/schemas.ts), [inspection](../../scripts/framework/inspection.ts) |
| v6 and compatibility | [authoring contract](../../scripts/companion/authoring-contract.ts), [post-MVP compiler integration](../development/compiler/POST-MVP-INTEGRATION.md), [sitemap model](../../scripts/companion/sitemap/model.ts) |
| Compiler boundaries | [pipeline](../../scripts/compiler/application/pipeline.ts), [frontend adapter](../../scripts/compiler/adapters/frontend.ts), [architecture](../development/compiler/ARCHITECTURE.md), [generation](../../scripts/framework/generation.ts) |
| Concept intake and regeneration | [concept operations](../../scripts/framework/concepts.ts), [pure application](../../scripts/companion/concepts/apply.ts), [contract](../development/CONCEPT-INTAKE.md), [file planner](../../scripts/shared/file-plan.mjs) |
| Editor interaction and layout | [graph composable](../concepts/companion/editor/composables/use-graph.ts), [editor composable](../concepts/companion/editor/composables/use-editor.ts), [visual editor guide](../concepts/companion/VISUAL-EDITORS.md), [browser assertions](../../tests/concepts/companion-mvp.browser.py) |
| Native starters | [custom TextFileView](../../src/infrastructure/obsidian/custom-file-view.ts), [registrations](../../src/infrastructure/obsidian/native-integrations.ts), [native guide](../development/native-file-integrations.md) |
| Optional tooling | [Hindsight verification](../development/HINDSIGHT-VERIFICATION.md), [Jev guide](../concepts/jev-prompt-editor/README.md), [Jev runner](../concepts/jev-prompt-editor/src/domain/logic/runner.ts), [prototype skill](../../.claude/skills/companion-prototype-design/SKILL.md) |
| Quality and distribution | [suite inventory](../../tests/suites.json), [CI](../../.github/workflows/ci.yml), [kit distribution](../../scripts/framework/distribution.ts), [submission checks](../../scripts/framework/submission.ts), [delivery gates](../product/DELIVERY-STRATEGY.md) |

External review criteria were checked against primary W3C WCAG 2.2 material and current official Obsidian developer-policy/submission pages, linked where used in the review/plan. No market, pricing, legal-compliance or formal accessibility claim was inferred.

## Unexecuted and excluded scope

No new real Obsidian session, personal-vault operation, full native companion acceptance, real Hindsight SDK/provider/desktop session, live Jev call, cross-platform installation, manual assistive-technology session, native mobile test, maximum-scale benchmark, penetration test, authenticated release execution or full repository qualification was performed in this review. Documentation changes are not implementation of the improvement plan. Runtime, lockfiles, quality thresholds and publication permissions remain unchanged by the documentation update.
