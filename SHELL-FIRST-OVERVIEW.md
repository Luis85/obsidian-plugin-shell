# Shell-first product overview

**Current integrated review:** 2026-09-27, PR #5 source `ec70e2cee7d8aed6e794a15252b2b9cc48b05dcf`. Read the [product review](docs/product/PR5-PRODUCT-REVIEW.md), [improvement and polishing plan](docs/product/PR5-IMPROVEMENT-PLAN.md) and [evidence record](docs/testing/PR5-REVIEW-EVIDENCE.md). These replace older milestone summaries as the current orientation; dated execution records retain their historical scope.

## Products and delivery order

The **framework developer kit** is the reusable shell, shared TypeScript CLI, compiler, generators, safe lifecycle tooling and distributable archive. A generated consumer owns its source and continues without an installed companion or maintainer checkout. The **companion** is an optional authoring interface and later a demanding native consumer, not a prerequisite to begin development.

The controlling [delivery strategy](docs/product/DELIVERY-STRATEGY.md) remains: framework technical readiness (SH-022) → separately authorized framework shipment (SH-034) → agreed native companion conversion (CX-007/CP-001) → native acceptance (CP-010) → separately authorized companion publication. The complete [JSON-to-clickdummy MVP](docs/prds/MVP-JSON-TO-CLICKDUMMY.md) still includes the complete generated native companion; first framework shipment does not close that larger outcome.

No release was present in the repository release listing inspected for this review. Packaging and CLI implementation are real, but the complete published-asset first-use journey and release approvals remain separate.

## Choose the right entry

| Goal | Current entry and boundary |
| --- | --- |
| Develop using the existing shell | [Root README](README.md), [framework guide](docs/development/FRAMEWORK-GUIDE.md), [feature guide](docs/development/BUILD-A-FEATURE.md) |
| Create an independent consumer | [CLI guide](docs/development/FRAMEWORK-CLI.md); `new` supports reviewed starters or project JSON |
| Inspect/compile a design | [Dedicated compiler](docs/development/compiler/README.md); generation is separate from dependency installation and acceptance |
| Use the current companion authoring build | [Companion guide](docs/concepts/companion/README.md); `npm run companion:build` emits the integrated v6 HTML/JSON under `reports/companion-mvp` |
| Inspect the retained compatibility concept | [Checked-in HTML](docs/concepts/companion/index.html) and adjacent JSON remain the v5 compatibility pair, not the latest v6 artifact |
| Build a generated offline preview | [Clickdummy guide](docs/development/COMPANION-CLICKDUMMY.md); same generated Vue source, synthetic reads and explicit unavailable business writes |
| Integrate an approved concept | [Data-only concept intake](docs/development/CONCEPT-INTAKE.md); project/feature/improvement imports are distinct from selected-output compiler generation |
| Add a custom extension/view or file menu | [Native integration guide](docs/development/native-file-integrations.md); two new starters bring the catalog to 11 |
| Use optional design/agent tooling | [Prototype tools](docs/development/PROTOTYPE-TOOLING.md), [Hindsight](docs/development/HINDSIGHT.md), [Jev Studio](docs/concepts/jev-prompt-editor/README.md); none is a hidden core prerequisite |

## Use the framework today

Use the repository-selected Node/npm toolchain and exact lockfile. From a prepared checkout, inspect supported starters and a new-project plan before writing:

```sh
node shell.mjs help
node shell.mjs new --list
node shell.mjs new ../my-plugin --starter quick-capture
node shell.mjs new ../my-plugin --from ./project.companion.json
```

The target for `new` must be a new or empty independent directory. Review the returned plan before applying it. Installation runs trusted project lifecycle code and is a separate explicit step. Follow the CLI guide for exact flags, existing-project import, conflicts, regeneration and recovery; a future extracted-kit wizard must not be confused with this checkout path.

For the existing template itself, `npm run setup` uses reviewed setup and the exact dependencies. The optional `--profile native` installs assets only into the contained development vault. Open it separately and deliberately enable the plugin. Do not use a personal vault; setup does not authorize activation or change Restricted Mode. The [setup guide](docs/development/SETUP-IDENTITY.md) retains identity, protected-data and resume behavior.

## What the evidence supports

The current hosted authoring artifact has 26 browser assertions. Its independently generated workspace installed, verified and built an offline clickdummy with nine browser assertions. The self-project has 28 surfaces, 23 routes, three journeys, three features, 27 visual page designs and 54 component definitions/revisions.

The generated receipt still reports 31 pending requirements and no native companion acceptance. A buildable scaffold is not a completed editor engine, business implementation or release-ready product. The reviewed broad CI run failed on the unclassified Hindsight Python helper (`METRIC_UNCLASSIFIED_INPUT`); targeted success is not full qualification. Local checks, job-level evidence and unexecuted modes are listed in the evidence record. Repair that integration and inspect the exact current candidate's full workflows before closing a gate.

## Contribute and maintain

Read [AGENTS.md](AGENTS.md), select existing [tasks](docs/tasks/README.md), and use the new review work packages to close demonstrated gaps rather than recreate implemented code. Preserve framework-free domain/application contracts, the dedicated compiler seam, one canonical data owner, safe plans, developer-owned files, scoped styles and all quality thresholds.

The first priority is the demonstrated maintainability-inventory CI blocker. The next priorities are public v6 contract parity, one extracted-kit starter/JSON journey, scoped generation, generated-output fidelity and focused authoring/accessibility. Native companion conversion follows the retained framework gates. Publication always requires a separately qualified candidate and fresh explicit approval; this document grants none.
