# PR #5 improvement implementation — execution record

Implementation starts from PR #5 commit `02857c2c965e4187f4b56d1e0fa5627c12cbf07d` on the stacked branch `feat/pr5-product-improvements`, PR #35. The [whole improvement plan](../product/PR5-IMPROVEMENT-PLAN.md) remains the scope; this is an incremental execution record, not full-plan completion or release approval.

## Contract and developer-path increment

IP-11's initial exact optional-Python inventory repair is committed as `9441141a9530698575de2960ed697e21a52fd55b`. Five regressions prove supported paths, content fingerprints, freshness and rejection of unreviewed languages/production substitutions. Python remains explicitly unmeasured by the JS/TS/Vue metrics; no production gate is diluted.

The following increment implements [public project-v6 schema discovery and read-only validation](../development/COMPANION-PROJECT-SCHEMA.md), [feature/page/component dependency-aware regeneration](../development/SCOPED-GENERATION.md), and [starter/JSON setup with explicit stage-by-stage resume](../development/EXTRACTED-KIT-SETUP.md). It retains the existing compiler, shared contracts, safe writer, canonical project and complete shared registries. Excluded artifacts must already be compatible; narrow generation never creates an incomplete fresh project.

The first hosted run of the inventory fix exposed another pre-existing integration defect: generated framework documentation linked to Jev Studio even though that maintainer-only concept is deliberately excluded from consumer kits. The Markdown relocation adapter now leaves an explicit non-linked boundary label for those exact excluded assets; it does not copy their runtime or ignore arbitrary missing links. The original generated-document link test remains unchanged, with a new direct relocation regression.

## Supplementary local checks

Local tools: Node 22.16.0/npm 10.9.2/TypeScript 5.8.3, Python 3.13.5. These differ from the repository-qualified toolchain, so hosted qualification remains necessary.

| Check | Result and scope |
| --- | --- |
| Optional Python inventory | 5 Node tests passed |
| Project schema/CLI | 37 Node tests passed |
| Independent Draft 2020-12 implementation | 34 corpus cases passed; semantic-only controls deliberately need the shared runtime validator |
| Scoped generation | 9 Node tests passed, including real emitter mapping and actual safe file writes/replay/conflicts |
| Setup/resume | 11 Node tests passed; process outcomes use explicit controlled executors rather than pretend live installs |
| Generated docs boundary | Direct relocation regression passed; independent generated-file inspection found no broken local links |
| Existing compiled-kit integration | 3 tests passed: actual pack/extract/bootstrap/import/generate/replay without consumer dependencies or Git |
| New compiled-kit journey | Passed: schema, starter, resumed generation, page scope, stale approval, excluded developer edit and no-op replay from the actual extracted CLI |
| Framework TypeScript | Passed with local TypeScript 5.8.3, not qualification of TypeScript 6.0.3 |
| Suite inventory and whitespace | Passed; no suite ownership or thresholds were weakened |

Retained failed attempts are not converted into successful evidence. An earlier broad local schema integration run failed a strict stderr assertion because Node 22 prints an experimental type-stripping warning; the pinned-toolchain assertion was not loosened. Two early new-kit test attempts exposed incorrect fixture assumptions (blank intentionally has no authored pages; the public plan keeps selection under `data.summary`). Corrected tests now exercise the authored Quick Capture starter and actual public result shape. The full generated-devkit suite could not run locally because the pinned YAML dependency was unavailable; its hosted run remains authoritative.

No full local dependency install, root verification, real native companion session, live AI-provider/desktop call, assistive-technology session, maximum-scale benchmark, release or tag was performed by this increment. Later increments must append their own evidence and reconcile the exact current candidate. The remaining UI, native, performance, security/support and publication packages are not marked completed by these foundation changes.
