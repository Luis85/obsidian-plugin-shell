# Data Sources: verification record

This record covers the dedicated Data Sources iteration against PR baseline `3e697660f4328ac6e32d4029418ff149ca01a0cd`. It does not substitute earlier ER/single-vault results for the current artifact.

## Exact local artifact

- Path: `docs/concepts/companion/index.html`.
- Size: **1,308,354 bytes**.
- SHA-256: **`a7848e4599ee2a216843686b20cf4b9618702193ca53c63a206d524cd4613da1`**.
- Local environment: Python 3.13.5, Python Playwright 1.57.0, system Chromium, Node 22.16.0 for syntax checking only. Root-template qualification uses its pinned CI environment; local syntax checks do not establish that qualification.

## Completed local checks

| Current suite | Passing named assertions |
| --- | ---: |
| Data Sources catalog, operations, shapes and sitemap flows | 77 |
| Single-vault workflow | 47 |
| Semantic model and component variants | 76 |
| ER arrangement and connectors | 67 |
| Containers and connections | 64 |
| Reference workspace | 50 |
| Reference graph | 8 |
| Reconciliation and recovery | 34 |
| Unified library and spatial behavior | 67 |
| Product safety and recovery | 47 |
| **Completed local total** | **537** |

The dedicated suite exercises actual catalog/form controls, field editing, shape-mode draft retention, source usage/deprecation, deletion guards, source restart, actual handle dragging into the review form and saving that connection, visibility toggles, numeric positioning, keyboard positioning and history. It also uses explicitly labeled pure/model fixtures for malformed data, endpoint capabilities, schema contradictions, dangling identities, stale reviews and entity projection.

Rendered checks verify data-edge direction/marker definitions, transformed SVG endpoints against actual handle rectangles, connected port visibility, actual point hit-testing, positive/negative world coordinates and the outer clipping boundary. Deliberately restoring hidden overflow makes the visibility probe fail before removing that fixture rule. Screenshots cover the source catalog in both themes, a connected sitemap and a 720-pixel operation dialog. These assertions are not 537 independent physical-user journeys or full device/accessibility certification.

Separate checks passed:

- **10** deterministic assembly/inventory/tamper-rejection tests.
- **64** authored JavaScript syntax checks.
- Exact HTML reconstruction and `git diff --check`.
- The build/analyzer inventory contains **84 exact inputs**: 64 maintained JS modules, 15 maintained CSS files and five unchanged vendor JS/CSS inputs. No suppression or production-threshold reduction is added.

No page errors or runtime network requests were observed on the completed dedicated concept routes. Existing fixtures use controlled browser state where documented. All local reports remain tied to the exact HTML hash above.

## Local real-storage limitation

The complete runner was also invoked with `--real-storage`. After all 537 preceding assertions passed, the storage suite stopped at initial navigation with `net::ERR_BLOCKED_BY_ADMINISTRATOR` for the loopback HTTP origin. **Zero real-storage assertions executed locally.** The full runner correctly reports failure for that invocation; it is not relabeled green and no Storage mock substitutes for that suite.

The existing GitHub companion workflow explicitly invokes the runner with `--real-storage` on the delivered commit. Its final retained results must be checked before claiming actual multi-page Storage coverage. The PR description/comment records completed final-head CI separately rather than rewriting this historical local evidence.

## Review findings addressed

| Concern | Resolution and evidence |
| --- | --- |
| Navigation confused with business data | Separate source/flow collections and projections; navigation bytes unchanged when connecting data |
| Ambiguous “input/output” direction | Source-oriented labels, explicit source/card arrows, independent request/response shapes |
| Shared-source maintenance silently breaks usages | Stable identities, current-usage lists, deprecation and direction/deletion guards |
| Source/card/entity reference loss during import or restart | Validate references before rendering, preserve IDs in export/import and protect linked entities/surfaces |
| Incomplete shapes force premature guesses | Save unfinished drafts; block only generation that requires the undeclared payload |
| Diagram opacity makes a line look disconnected | Dedicated connected-handle visibility overrides scoped to data ports and measured endpoint tests |
| Canvas layout changes invalidate contracts | Positions excluded from generation fingerprint; numeric/keyboard changes are independently undoable |
| Secrets or queries mistaken for connection metadata | No credential-value editor; safe base URLs, symbolic references, bounded non-executable schemas |
| A successful preview is mistaken for execution | Explicit design-only labels and inert application-port/contract/handoff previews |

## Remaining acceptance boundaries

No native companion/vault adapters, real API requests, database queries, credential resolution, live connection tests, runtime payload validation, automated transformations, migrations, synchronization, production compilation of source previews or publication occurred. Full OpenAPI/JSON Schema support is not implemented. Native-device, screen-reader, formal WCAG and maximum-size performance acceptance remain separate. Existing localStorage conflict detection is not atomic multi-window locking.

See [DATA-SOURCES.md](DATA-SOURCES.md) for the normative feature contract and primary references.
