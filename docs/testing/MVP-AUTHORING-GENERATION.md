# MVP execution: integrated authoring to generated clickdummy

> Historical record. Since this record, the project format is schema 6 only: the eleven v5 starters were converted to v6, earlier formats are rejected rather than migrated, and the checked-in v5 artifact is only the build base of the authoring build. Rows below keep their original scope.

Date: 2026-09-27. PR #28 remains a draft stacked on PR #5. This record extends the historical [sitemap-core record](MVP-SITEMAP-CORE.md); it does not replace earlier evidence or claim completion of the whole [MVP plan](../prds/MVP-IMPLEMENTATION-PLAN.md).

## Implemented path

The actual Vue 3/Pinia/Nuxt UI/Vue Flow Journey Lens editor is composed into the companion. Its route/hierarchy/journey changes use canonical IDs, guarded saved-state transactions and the v6 authoring adapter. The modern self-project is exported through the real companion exporter and accepted by the existing CLI/compiler.

The compiler now emits a standalone browser composition from the same generated Vue pages, component definitions, visual state, navigation, services and contracts as the plugin. `node shell.mjs clickdummy build` reuses the shipped prototype worker; it is not a second renderer or an iframe of the authoring concept. See [usage and boundaries](../development/COMPANION-CLICKDUMMY.md).

The qualification operation binds the modern HTML and full JSON to its build receipt, generates a separate workspace, runs its own exact-lock install/build/typecheck/tests, then builds and browser-tests its single-file clickdummy. The workflow retains both input and output evidence separately.

## Source changes and regression findings

The continuation preserved newer PR #5 visual editor protection commits. No force push or merge into PR #5 was performed.

| Finding | Fix and regression |
| --- | --- |
| v6 composition reinterpreted immutable v5 starter bytes | Keep the hash-verified catalog at its actual version; migrate configured copies through the authoring adapter |
| Vue `markRaw` decorated canonical JSON with a hidden property | Keep saved data in a shallow ref without modifying its data shape; execute the real composable against the pinned Vue/Pinia runtime |
| Graph composition retained CSS selectors but dropped declarations | Include the complete retained scoped Vue Flow stylesheet under the island namespace |
| Native browser button border leaked into Nuxt controls | Island-only, low-specificity defaults beneath utilities; no host-wide reset |
| Same-view host redraw discarded dirty editor input | Refuse the redraw until save/cancel; verify dirty navigation and theme-change behavior |
| Compiled kit omitted authoring TypeScript configs | Ship both configs with the template; retain the existing archive-consumer test |
| v6 route records included IDs omitted by the generated type | Preserve route identity in the type and compile a real v6 route declaration in a regression |
| Wrapped select labels included all option text | Emit explicit `for`/`id` labels; preserve the strict accessible-label browser selectors |
| Fallow build/test role declarations lacked activation and the modern builder was a runtime root | Add file-based activation and classify the build entry as support; retain real runtime/dependency gates without a dependency ignore |

## Executed hosted evidence before the label correction

Head `2438f73508a874572a9fba34169eb2bd41fb03fa`, merge checkout `2f2ea052df5efb33b3b7d8b23ce0a0536bb8b7bb`, concept run `36326791129` produced artifact `10934461406` (`companion-mvp-authoring`). Its downloaded ZIP SHA-256 is `44cd403f26056d103b89e4edb7b8cc421131a8ea30c128b2ce1fda6e1ccba838`.

The integrated authoring UI passed **26 named browser assertions** on the actual file-origin build. This covers the real runtime mount, routes/IDs/revisions, rename, move, Undo/Redo, page-editor navigation, new surface and journey, full export/import, modal focus, dirty input, narrow containment and zero external requests/uncaught errors.

The independent generated workspace completed `npm ci`, `npm run verify:project` and `npm run build:clickdummy`, each with exit status 0. Generated acceptance TODOs remain explicitly unimplemented and are not counted as completed product behavior. The clickdummy was **4,166,827 bytes**, SHA-256 `fccc5a578398bdd1bb559ac0d2a40a4b3e4ee0b315716050241bebb92b4b0361`; this is the historical pre-label-correction artifact, not the final delivery hash.

The exact project JSON is **2,248,925 bytes**, SHA-256 `a51523d0526b0e4315c9e2a6148ac768fea8b5d50b90fb68877508aa6cb46bcc`: 28 surfaces, 23 routes, three journeys, three features, 27 visual page designs, 54 component definitions and 54 retained component revisions. Its generated copy preserves the complete definition.

The clickdummy browser run stopped after its single-file assertion because the accessible label included option text. That run is **failed**, not retrospectively passed because a local diagnostic could select the same control by CSS. The source-level label fix and regression are part of the follow-up change. Final-head results and exact final artifact hashes must be read from PR #28 and its latest qualification artifacts.

The qualified hosted toolchain is Node 24.21.0/npm 11.19.1/TypeScript 6.0.3. A completed generated-source verification is not native companion acceptance. Separate root analyzer/archive/coverage jobs remain mandatory; their status is not inferred from this authoring job.

## Local checks and limits

The new clickdummy/generation/CLI/evidence/configuration regressions pass locally: **14 tests**, no failures, skips or TODO. Both generated route typing and accessible-label tests were observed failing before their source fixes. The configuration tests check declared scope consistency; the unchanged full Fallow gate must still execute the actual binary.

Earlier focused authoring/core/generator checks passed. A later attempt at a combined large local suite timed out before completion after 165 reported passing cases; it is not claimed as a completed suite. Local Node 22.16.0 and TypeScript 5.8.3 are supplementary. Full frontend dependency installation was unavailable locally, so actual requested-stack builds and file-origin acceptance use the retained hosted runs.

A local diagnostic executed the unchanged historical clickdummy with an inline origin and CSS selectors solely to isolate the label defect. Its nine successful flow checks are diagnostic, not substitutes for the committed file-origin/accessibility test.

## Remaining work packages

| Package | Current boundary |
| --- | --- |
| WP-01/02 | Source recovered; actual editor integrated and core authoring journey exercised. Complete broader editor-command, manual accessibility and scale acceptance remain separate |
| WP-03 | v6 authoring/CLI/compiler adapter implemented; frozen legacy reader retained. Public schema discovery and complete transition closure still open |
| WP-04 | Modern complete self-project exported and round-tripped. Checked-in v5 artifact remains the explicit compatibility fixture; modern output is under `reports/companion-mvp` |
| WP-05 | Actual generated browser target and independent build implemented; final file-origin browser result must match its exact artifact |
| WP-06 | JSON-scoped feature/page/component integration and reviewed concept change sets remain open |
| WP-07 | Full native companion authoring capabilities and canonical Markdown save/reopen remain open; generated editor stubs are not accepted as implemented capabilities |
| WP-08 | Existing setup/new-project foundation retained; complete extracted-kit starter-or-JSON/GitHub journey not closed |
| WP-09/10 | Release preparation/publication qualification, all remaining merge gates and actual published-asset replay not closed |

No tag, release, publication, native-vault installation, credential update or authorization bypass was performed. Do not merge PR #5 as complete MVP delivery solely on this increment.
