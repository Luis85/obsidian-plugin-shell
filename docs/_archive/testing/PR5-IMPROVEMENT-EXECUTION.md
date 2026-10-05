# PR #5 improvement implementation — execution record

Implementation starts from PR #5 commit `02857c2c965e4187f4b56d1e0fa5627c12cbf07d` on the stacked branch `feat/pr5-product-improvements`, PR #35. The [whole improvement plan](../product/PR5-IMPROVEMENT-PLAN.md) remains the scope; this is an incremental execution record, not full-plan completion or release approval.

## Contract and developer-path increment

IP-11's initial exact optional-Python inventory repair is committed as `9441141a9530698575de2960ed697e21a52fd55b`. Five regressions prove supported paths, content fingerprints, freshness and rejection of unreviewed languages/production substitutions. Python remains explicitly unmeasured by the JS/TS/Vue metrics; no production gate is diluted.

The following increment implements [public project-v6 schema discovery and read-only validation](../../development/COMPANION-PROJECT-SCHEMA.md), [feature/page/component dependency-aware regeneration](../../development/SCOPED-GENERATION.md), and [starter/JSON setup with explicit stage-by-stage resume](../../development/EXTRACTED-KIT-SETUP.md). It retains the existing compiler, shared contracts, safe writer, canonical project and complete shared registries. Excluded artifacts must already be compatible; narrow generation never creates an incomplete fresh project.

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

## Continuation — compiler qualification repair (2026-09-28)

Resumed PR #35 at `fd7e4f11a611c62f23a44653453a76e5784ad48a`. The hosted template-authoring example-removal artifact (`10943785079`, run `36353507302`) fails the compiler golden comparisons: the test supplied the deliberately changed consumer feature registry to output expectations captured against the original framework registry. The old expected product hashes are unchanged. An exact baseline registry input, independently checked against blob `064349ef392f44f54659ad61a5336fdce10b2027` at original capture commit `931db74da3576d20b862583395cb0a1b9a4412e5`, now fixes that input only inside the compatibility test. An additional compiler test proves real supplied consumer registry edits still reach output and alter the fingerprint. No production registry is replaced or ignored.

The compiler coverage command now includes the existing scoped-selection regression suite. Its floors stay **95% lines, 90% branches, 90% functions**; an executable regression guards both the floors and inclusion. Seventeen focused compatibility/documentation tests passed locally. A supplementary coverage attempt exercised 47 passing cases and measured 97.90% lines / 93.84% branches / 96.55% functions, but the command **failed** because this environment lacks the pinned `fast-check` dependency. Those measurements are diagnostic, not a passing full coverage claim. The exact-toolchain hosted gate remains required.

## Continuation — authoring, measurements and support

The compiler repair is pushed as `395c65e28faa18c9f419a46eb3f040b792e9dfb3`. Its hosted compiler run `36359318985` passed on Linux (including actual browser/generated-output steps) and Windows. macOS exposed three new scoped-writer fixtures using the symlinked OS temporary-root spelling (`PLAN_UNSAFE_ROOT`). The fixture now canonicalizes only its newly created scratch directory; production containment remains unchanged. Full latest-head qualification must still be checked after this correction.

IP-06/07 implementation adds focused-canvas/panel restoration, persistent draft/recovery status, deterministic non-overlapping fallback layout, explicit reviewed whole-map arrangement and non-drag coordinates through the existing canonical session. Saved geometry is never rearranged implicitly. Undo/Redo and stale-write protection remain shared. Per-instance graph IDs and snapshot-memoized positions prevent shared graph ownership and repeated layout work on search changes. Minimum control sizes, reduced-motion styling and composition/editable shortcut guards contribute to IP-08 but are not manual accessibility acceptance. See [the authoring guide](../../development/AUTHORING-EXPERIENCE.md).

IP-12 adds `project measure` through the public catalog/dispatcher: real bounded import/export/projection/arrangement operations, cold/warmup/all measured samples, monotonic timing, real queued cancellation, raw distributions and non-isolated heap observations. IP-13 adds opt-in `support report`, using an explicit allowlist rather than redacting whole logs; private content, IDs, paths, hashes, causes and arbitrary messages are excluded. Collection errors are generic and cannot leak a private OS path. Neither tool writes, uploads, executes project code or infers native/release readiness. The [guide](../../development/LOCAL-SUPPORT-AND-MEASUREMENTS.md) and [integrated threat model](../../security/COMPANION-THREAT-MODEL.md) document different export boundaries and safe recovery.

Supplementary local evidence (Node 22.16.0, npm 10.9.2, TypeScript 5.8.3; not the qualified hosted toolchain):

| Check | Result |
| --- | --- |
| Focused new/existing arrangement, actual Vue/Pinia store, scope, measurement and support suites | 33 passed, no failure/skip/TODO |
| Broader existing sitemap and framework core plus measurement/support regressions | 110 passed, no failure/skip/TODO; overlaps the focused run and is not added to it |
| Framework TypeScript with locally available Node typings | Passed; no lockfile or dependency version changed |
| Pure sitemap TypeScript | Passed |
| Suite inventory | 291 files, 31 suites, 32 helpers; every new test has existing suite ownership |

Four real local measurement runs used blank (2 surfaces), Quick Capture (5), the retained companion self-project migrated without invented routes (28), and a synthetic maximum-surface fixture (60). Each retained ten measurements per operation plus cold/warmup samples. The complex companion's observed p95 was about 201 ms for import/migration and 29 ms for arrangement in this environment; the sixty-surface fixture was much lighter because it had no visual component library. These are observations, not agreed budgets, frame-time/native measurements or proof of maximum-complexity readiness. The measured layout cost motivated per-snapshot graph caching instead of recomputing positions on every search change.

Initial new-test runs used error-message regexes for typed `OperationError` codes and correctly failed; the tests now assert the exact `code` property rather than changing production errors. A first local TypeScript attempt lacked Node declarations; a preinstalled local declaration package enabled a supplementary check without changing the project lockfile. Those attempts are retained as failures/environment limits, not silently promoted.

Five new named assertions plus panel-restoration expectations are added to the actual file-origin authoring browser suite. Their current candidate build and run depend on hosted frontend provisioning; no local Nuxt/Vue Flow build or browser success is claimed here. IP-05 generated visual parity, full IP-08 manual/device acceptance, IP-09 real-host starter lifecycle, IP-10 complete native companion, IP-14 real SDK/desktop/provider and IP-15 publication remain open. No native conversion, live provider operation, release authorization or all-plan completion is inferred from this increment.

## Continuation — generated preview ownership and interaction qualification

The [generated preview host record](GENERATED-PREVIEW-HOST.md) continues IP-05/IP-08/IP-11 from `957bf427212ffe21fcd8fbe93d42419b6344a501`. It records two reproduced modal-owner leaks, the shared generated dialog/page lifecycle, focus and narrow-toolbar improvements, and expanded independent generated-output browser assertions. Original compiler goldens remain unchanged; an exact four-file browser-only delta is verified before reconstructing each of the twelve original product digests.

Twenty-six focused compatibility/emission/lifecycle tests and twelve supplementary real-dialog browser cases passed locally. The local file-origin run was blocked by browser policy; the successful browser cases used an explicitly labelled inline fixture with frame doubles. The broad compiler attempt failed overall because fallow and fast-check were unavailable. Full exact-toolchain hosted, complete generated UI, real back/forward-cache, manual accessibility, native and publication evidence remain separate; no work package is marked complete merely by adding tests.

## Continuation — current base and authored preview scenarios

[Base integration](PR35-MVP-BASE-INTEGRATION.md) records the conflict reconciliation
at `ef49ab70`: both Journey Lens implementations are retained, including contextual
navigation, compact fallback geometry, explicit arrangement and focus/draft guards.
TypeScript 6 workspace selection remains enforced; no local TypeScript 5 substitute
was used for this continuation.

[Generated preview scenarios](GENERATED-PREVIEW-SCENARIOS.md) records the subsequent
IP-05/IP-08/IP-11 work: exact per-surface authored samples, scoped mode inheritance,
local reset and pending-request isolation, plus independent browser assertions.
The [MVP closure map](MVP-CLOSURE-STATUS.md) retains complete native companion,
manual acceptance and separately authorized shipment obligations.

## Local continuation — generated native Journey Lens

The [native integration record](JOURNEY-LENS-NATIVE-IMPLEMENTATION.md) documents the
unpublished candidate based on PR35 `2ea6c19a` and PR5 `7c26f37`. It integrates the
actual shared editor, guarded whole-project file persistence, complete record
maintenance, recovery, regeneration and generated native/browser acceptance
tests. Local runtime evidence is recorded without substituting for TypeScript 6,
build, browser or real-host verification. The supplied exact-base patch is the
delivery; GitHub write operations were unavailable, so no push/merge/issue closure
or whole-plan completion is claimed.
