# Product review: CI evidence and analyzer follow-up

This supplements [PRODUCT-REVIEW.md](PRODUCT-REVIEW.md) and its explicitly local [verification record](PRODUCT-VERIFICATION.md). Historical evidence is not added to current totals.

## Successful browser qualification

[Companion verification run 35919008890](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35919008890) completed successfully for PR head `b4154fafd0fa42f305d333670e095e5cd111d49c`, tested through merge snapshot `5641d12c1aae44965c917e19d56bd761e9ea3aff`.

The exact HTML was 1,119,472 bytes, SHA-256 `7c8fe3feaf3acf4cfcbd39de7c61e7c4957c4a2233c7ca94c4f4a8537b17dfb7`.

| Current suite | Passing named assertions |
| --- | ---: |
| Containers and connections | 64 |
| Reference workspace | 50 |
| Reference graph | 8 |
| Reconciliation and recovery | 34 |
| Unified library and spatial behavior | 67 |
| Product safety and recovery | 47 |
| Real-origin browser storage | 7 |
| **Total** | **277** |

The storage suite exercised real Storage and storage events across two pages on a loopback HTTP origin, without a substituted storage adapter. The Linux CI browser was Chromium 143.0.7499.4 provisioned by Python Playwright 1.57.0. The source job separately passed exact reconstruction, the then-current five assembly tests and all 48 authored-JavaScript syntax checks.

The [retained browser evidence](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35919008890/artifacts/10776048432) includes the HTML, raw checks, logs and screenshots. Assertion totals include controlled-state, model, geometry and synthetic-event fixtures; they are not 277 separate physical-pointer journeys. Native Obsidian, real CLI operations, file-origin storage, atomic multi-window locking and complete accessibility qualification are not established by these results.

## Architecture blocker and subsequent full-analyzer finding

The original PR failed required architecture coverage for 47 concept JS files. After the isolated zone and exact JS entries were added, [template-authoring run 35919008707](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35919008707) passed required architecture coverage, the three real boundary fixtures, build, 168 tooling tests (four Windows-specific tests skipped on Linux), type checking, both ESLint stages, source lint, repository checks and presentation checks.

That run then correctly failed full dead-code analysis with 16 unused files: eleven maintained concept stylesheets and five retained vendor JS/CSS assets. These are assembled or hash-verified by Python rather than imported from a JS entry, so the JS-only inventory was incomplete. This failure is retained as evidence; it is not described as a successful full template run.

The follow-up registers **64 exact analyzer inputs**: 48 maintained JavaScript files, 11 maintained stylesheets and 5 vendor JS/CSS inputs. Vendor code is covered by the same isolated concept zone; production import allowances and zero-finding analyzer thresholds are unchanged. No broad ignore, dead-code suppression or dependency upgrade is added.

The assembly checks now require exact agreement between the declared build inputs, recursive on-disk JS/CSS inventory and analyzer entries. All retained vendor files, including upstream CSS used as the provenance reference for the scoped stylesheet, are verified against a pinned provenance manifest and their recorded hashes. Duplicate entries, missing assets, extra nested files, changed vendor bytes and altered provenance are rejected.

The follow-up passed **10 local assembly tests**, syntax checking and exact reconstruction. It changes no application source or generated HTML bytes. A fourth real-analyzer fixture exercises the complete 64-input concept and proves that adding an unassembled CSS file still fails the full analyzer.

**Final integration status must be read on the final PR head.** This record captures completed evidence and the corrective change; it does not claim that later scheduled workflows have passed. The PR review records the final observed result without rewriting historical reports.
