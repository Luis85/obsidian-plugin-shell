# Workbench — product and delivery overview

**Focus on your idea. Save time. Not quality.**

Workbench is a developer-focused tool to create and manage declarative user interfaces for **webapps and Obsidian plugins**. Its three product promises are time savings without quality loss, documentation along the way, and developer experience. Read the [product vision](docs/product/PRODUCT-VISION.md), [principles](docs/product/PRODUCT-PRINCIPLES.md) and [documentation map](docs/product/README.md).

**Documentation update:** 2026-09-29. The [vision review](docs/product/PR5-VISION-REVIEW.md) examined PR #5 at `15f74eaec78b5555bed94e4310472db841e371f7`. It is a product/documentation review, not a new runtime qualification. This filename is retained so existing links keep working.

## One product, complementary capabilities

The **visual authoring experience** helps users describe and connect pages, reusable components, interactions, routes and journeys. The **CLI and developer kit** support inspectable preparation, validation, generation and ongoing development. The **shared compiler** translates supported declarative definitions into artifact data. The **reusable shell** provides the maintained Obsidian foundation and host/persistence/lifecycle contracts.

These are capabilities and delivery surfaces within Workbench, not alternative public product names. A generated consumer owns its source and must remain usable without an installed authoring interface or maintainer checkout. Design-only authoring remains legitimate; it does not require every downstream build tool.

Keep three choices separate: where Workbench authoring runs, what runtime the user's project targets, and which supported frontend that project selects. Creating a webapp is not the same as making Workbench itself a hosted service. The installed [project starters](bin/PROJECT-STARTERS.md) also include website, CLI and hybrid choices; their existence neither changes the primary UI focus nor guarantees equal generation fidelity across targets.

## Choose the right entry

| Goal | Entry and boundary |
| --- | --- |
| Understand Workbench and its direction | [Product vision](docs/product/PRODUCT-VISION.md); intended outcomes, not completed-feature claims |
| Develop using the existing Obsidian foundation | [Root README](README.md), [framework guide](docs/development/FRAMEWORK-GUIDE.md), [feature guide](docs/development/BUILD-A-FEATURE.md) |
| Create an independent consumer or inspect CLI capabilities | [CLI guide](docs/development/FRAMEWORK-CLI.md); use the documented plans and supported options |
| Inspect or compile a declarative design | [Dedicated compiler](docs/development/compiler/README.md); generation is separate from dependency installation and acceptance |
| Use the current authoring build | [Authoring guide](docs/concepts/companion/README.md); `npm run companion:build` emits the integrated v6 HTML/JSON under `reports/companion-mvp` |
| Inspect the retained compatibility concept | [Checked-in HTML](docs/concepts/companion/index.html) and adjacent JSON remain the v5 compatibility pair, not the current v6 build |
| Build a generated offline preview | [Clickdummy guide](docs/development/COMPANION-CLICKDUMMY.md); generated Vue source, synthetic reads and explicit unavailable business writes |
| Integrate an approved concept | [Data-only concept intake](docs/development/CONCEPT-INTAKE.md); intake and selected-output compilation are different operations |
| Add a custom extension/view or file menu | [Native integration guide](docs/development/native-file-integrations.md); host integration still needs relevant native acceptance |
| Use optional design/agent tooling | [Prototype tools](docs/development/PROTOTYPE-TOOLING.md), [Hindsight](docs/development/HINDSIGHT.md), [Jev Studio](docs/concepts/jev-prompt-editor/README.md); none is a hidden prerequisite for the core workflow |

## Use the existing framework checkout

Use the repository-selected Node/npm toolchain and exact lockfile. From a prepared checkout, inspect supported starters and a new-project plan before writing:

```sh
node shell.mjs help
node shell.mjs new --list
node shell.mjs new ../my-plugin --starter quick-capture
node shell.mjs new ../my-plugin --from ./project.companion.json
```

The target for `new` must be a new or empty independent directory. Review the returned plan before applying it. Installation runs trusted project lifecycle code and is a separate explicit step. Follow the CLI guide for exact flags, existing-project import, conflicts, regeneration and recovery. The broader intended setup journey must not be confused with this existing checkout entry.

For the existing template itself, `npm run setup` uses reviewed setup and the exact dependencies. The optional `--profile native` installs assets only into the contained development vault. Open it separately and deliberately enable the plugin. Do not use a personal vault; setup does not authorize activation or change Restricted Mode. The [setup guide](docs/development/SETUP-IDENTITY.md) retains identity, protected-data and resume behavior.

The product name is Workbench, but the executable remains `shell.mjs` and current package/manifest/schema identities and `companion` paths remain unchanged. Do not substitute a fictional `workbench` command or rename a storage namespace as part of a documentation update.

## Intended connected workflow

**Describe → configure → import or choose a starter → compose → review and validate → generate source and documentation → implement, test and evolve.**

This is the product direction, not a claim that every step is complete in every target. In particular, the requested configurable user settings, typed Markdown project-document workflows and separately distributed JSON starters retain their explicit [product requirements and boundaries](docs/product/PRODUCT-PRINCIPLES.md). Existing project starters do not prove those workflows are finished.

“Manage” includes identity, reuse, revisions, dependency impact and safe regeneration. Documentation must preserve authored intent and make ownership clear; a generated folder structure alone is not complete product documentation.

## Evidence and qualification boundaries

The [compiler implementation](scripts/compiler/index.ts) emits readiness states with bundle, typecheck and tests initially `not-run`, and product acceptance `not-inferred`. Its project-starter path describes a navigable starting scaffold that still needs visual component and business-action implementation. Compilation success does not establish a complete product.

The [authoring guide](docs/concepts/companion/README.md) distinguishes the current browser concept, the retained v5 fixtures and the independently generated clickdummy. None is a substitute for full native Workbench acceptance. Preserve separate evidence for authored definitions, generated source, built previews, behavior tests, native operation and user acceptance.

The [2026-09-27 integrated review](docs/product/PR5-PRODUCT-REVIEW.md), [improvement plan](docs/product/PR5-IMPROVEMENT-PLAN.md) and [evidence record](docs/testing/PR5-REVIEW-EVIDENCE.md) retain their historical scope. Their test counts, pending requirements, release observations and CI failure are not current-head claims. Recheck the exact candidate before closing a gate; neither old success nor an old blocker should be repeated as live status without that check.

## Delivery order remains explicit

The controlling [delivery strategy](docs/product/DELIVERY-STRATEGY.md) remains: framework technical readiness (SH-022) → separately authorized framework shipment (SH-034) → agreed native conversion (CX-007/CP-001) → native acceptance (CP-010) → separately authorized publication.

The complete [JSON-to-clickdummy MVP](docs/prds/MVP-JSON-TO-CLICKDUMMY.md) still includes the complete generated native authoring product. A framework shipment does not close that larger outcome. One product name does not collapse the separate qualification and shipment decisions, approve a release, or claim a published download exists.

## Contribute and maintain

Read [AGENTS.md](AGENTS.md), the [product principles](docs/product/PRODUCT-PRINCIPLES.md) and the existing [tasks](docs/tasks/README.md). Reconcile current implementation and evidence before creating duplicate work. Preserve framework-free domain/application contracts, the dedicated compiler seam, explicit canonical ownership, reviewed plans, developer-owned files, scoped styles and every quality threshold.

Prioritize coherent, representative user workflows and safe later changes, not simply more disconnected editors. Keep Hindsight/Jev outside the default critical path unless product scope is explicitly changed. Publication always requires a separately qualified candidate and fresh explicit approval; this document grants none.
