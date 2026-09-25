# PR #5 review: framework-side companion readiness

**Review date:** 2026-09-24. **Scope:** delivered source, contracts, tooling and delivery plan; not a new visual audit or full native/product qualification. No runtime fix, merge or publication is performed by this documentation change.

## Inspected baseline and provenance

[PR #5](https://github.com/Luis85/obsidian-plugin-shell/pull/5) head `e71c655fe376e51a520fb8f194800e9294eb8e4e`, base `9a48b65660d6bbd66bac9aff2cb73627e1f38211`; tested merge snapshot `41e9376a3f55823f962fd8cd21ad87c398ee3e24`. The [source artifact](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36055702009/artifacts/10832865283) was downloaded, extracted and indexed locally: complete Git tree `ce7f1e03b4cec69a52f1d800f66b5426c3c77066`, matching the documented delivered tree. No maintainer-checkout state was assumed. GitHub review-thread discovery returned no inline threads at inspection; that is not an approval.

Read `scripts/companion/{generate,read-project,project-contract}.mjs`, `docs/concepts/companion/src/project-transfer.js`, the built-in project JSON, source/test-data contracts, maker/file-plan/setup/release entry points, package scripts and the current task/strategy files. The review distinguishes delivered implementations from the proposed first-class TypeScript CLI.

## Initial e71c655 PR checks, not the older pending summary

Observation applies to `e71c655...`; the later `b0f50ec...` repair and its separate checks are recorded below. Historical failures are not relabeled as current-head failures.

| Workflow | Observed outcome | Relevant scope |
| --- | --- | --- |
| [Companion source verification](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36055702009) | Success | Concept/source handoff verification, not native compiler qualification. |
| [Fixture and verification baseline](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36055702006) | Success | Its declared fixture/baseline checks. |
| [Template authoring](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36055701990) | Success | Existing authoring consumer workflow, not the proposed assembled-kit journey. |
| [Setup npm policy compatibility](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36055702007) | Failure | Both Windows jobs fail at fresh setup; both Ubuntu jobs pass. |
| [Showcase verification](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36055701992) | Failure | Windows fails at clean setup; Ubuntu passes. Windows verification/browser steps are skipped. |

Windows setup jobs: `107821929948` and `107821930230`; Windows showcase: `107821928333`. At initial inspection these observations located the failed stage, not its root cause. Job metadata alone did not establish a dependency, application, runner or timeout defect. The concurrent repair below identifies test-portability defects; preserve that correction and qualify it rather than repeat the diagnosis as greenfield work. No blanket release-ready claim follows from CI.

## Material integration finding: PR #17 is not incorporated here

[PR #17](https://github.com/Luis85/obsidian-plugin-shell/pull/17) was merged into the earlier planning branch, not directly into this delivered PR #5 tree. Its head `7b02821269f4286f4c3f0031f0bd4af4b4b83fe9` and PR #5 head diverge: the [comparison](https://github.com/Luis85/obsidian-plugin-shell/compare/7b02821269f4286f4c3f0031f0bd4af4b4b83fe9...e71c655fe376e51a520fb8f194800e9294eb8e4e) reports 21 commits ahead and six behind, with common ancestor `a6dd8e46cd208880550f8f49409b8a681665a17d`.

The downloaded PR #5 tree lacks `scripts/operations/cli.mjs`, `scripts/operations/catalog.mjs`, `scripts/operations/protocol.mjs`, `scripts/makers/dispatch.mjs`, `scripts/makers/recipes.json`, the `capabilities` npm alias, `tests/tooling/capability-discovery.checks.mjs`, `tests/tooling/preconversion-tasks.checks.mjs`, and PR #17's inventory/gauntlet records. Therefore the earlier discovery implementation and task evidence cannot be treated as available in this branch. This is an integration gap, not a recommendation to rebuild them.

[SH-023](../tasks/shell/SH-023.md) must reconcile the relevant source, tests, task statuses/evidence, inventories and workflow changes while preserving the newer project-transfer and main/runtime work. Inspect overlap before applying commits; do not cherry-pick an old package/README/ownership snapshot wholesale or imply the unpushed SH-015 work is included.

## Framework interaction gap matrix

| Capability | Evidence in inspected tree | Remaining framework work | Task routing |
| --- | --- | --- | --- |
| Full authoring transfer | Real reviewed browser import/export; v1 envelope and custom `src`/`tests` settings | Shared detailed TypeScript schema, compiler readiness and version policy; keep drafts distinct | SH-015, SH-024, SH-027 |
| Read-only JSON handoff | Actual bounded Node reader; returns exact original JSON, checks vault-relative future targets | Preserve compatibility; add separate project-root writer operations, never relabel this script as generation | SH-025, SH-028 |
| Capability discovery/protocol | PR #17 work is absent from this delivered tree | Reconcile it, then evolve into actual typed operation dispatch with versioned diagnostics/receipts | SH-023, SH-011, SH-024, SH-025 |
| Central CLI and kit bootstrap | Numerous useful `.mjs` entry points; no central `shell.mjs`/binary distribution here | TypeScript shared core; bootstrap before dependencies; direct/npm parity; human/agent contract | SH-024–SH-027 |
| Full boilerplate generation | Existing individual makers and safe file plans; concept previews are not a project compiler | Shared semantic compiler, field-aware makers, registrations, tests, custom path propagation and explicit obligations | SH-016–SH-019, SH-028 |
| Project/config/root boundary | Exported relative paths validated; current handoff expects a vault target | Standalone project folder independent of vault; config conflict review; safe relocations and legacy test-vault compatibility | SH-005, SH-027, SH-028 |
| Plan/apply and ownership | Real file-plan preimages, cooperating lock and recovery | Unify project-generation, setup, upgrade and companion receipts; stale binding and shared writer ownership | SH-012, SH-018, SH-030, SH-033 |
| Source/test-data integration | Real exportable Node test-data kit and bounded memory/HTTP simulators | Shared TS services and generated adapter wiring; explicit simulator vs production distinction; safe owned reset | SH-008–SH-010, SH-024, SH-029 |
| Design-system interoperability | Browser token editing and Markdown/HTML export | Shared validators/exporters/token compilation without concept-global dependency | SH-007, SH-024, SH-033 |
| Companion execution adapter | Browser simulated operations, plus user-run real handoff | Headless contract consumer for discover/plan/apply/results/recovery; no human-output parsing; capability/policy fallback | SH-033, then CP-004/CP-008 |
| Runtime framework services | Public entity/repository/lifecycle/event/feedback APIs exist | Remaining native/persistence/accessibility/performance/security scope remains subject to existing ledgers | SH-002–SH-006, SH-020, SH-021 |
| Release and archive consumer | Existing source archive checks and guarded candidate release tooling | Deliberately assembled framework kit; clean archive-to-generated-plugin proof; separate early kit shipment | SH-013, SH-026, SH-031, SH-032, SH-034 |

The rich companion self-project is a specification/transfer fixture, not an implemented native plugin. A whole JSON round trip is not proof that every component, source operation or requirement is compilable. Future native persistence and direct host execution belong to CP tasks after framework shipment; framework-side contracts and independent adapter tests belong in P0 now.

## Delivery-plan corrections

The previous plan delays all public distribution until CP-010. That conflicts with the owner-selected primary journey and instruction to ship shell/generator/CLI first. Split technical readiness SH-022, authorized framework shipment SH-034, consumer release tooling SH-031 and companion publication PUB-001–PUB-005. CP-001 now also requires SH-034. No public action is authorized by this review.

Other corrections: TypeScript rather than parallel `.mjs` business code; release-archive bootstrap rather than installed-plugin entry; project root independent of an authoring vault; configure/import conflict resolution; custom paths propagated through generated build/test tooling; common maker/compiler services; truthful generation obligations; first-class machine output; source-bound qualification and maintenance after first release.

## Supplemental local execution

Linux, Node `22.16.0`, npm `10.9.2`; not the repository-qualified Node/npm versions. No dependency installation or native host was performed.

```sh
node --test tests/tooling/companion-project.checks.mjs tests/tooling/test-data-*.checks.mjs tests/tooling/file-plan.checks.mjs
```

Result: **49 tests, 47 passed, two platform skips, zero failures**. Tests execute the existing JSON handoff, real test-data kit and file-plan behavior. This is not full repository, Windows/macOS, browser, native, generated-project or release-archive qualification. Historical PR browser counts were not rerun or added to these totals. Documentation validation is recorded in the documentation PR; no SH/CX implementation criterion is closed by editing task files.

## Concurrent repair preserved before documentation delivery

While this review was being prepared, PR #5 advanced to [b0f50ecb6ef1c1db75f5d1358185d860d8801742](https://github.com/Luis85/obsidian-plugin-shell/commit/b0f50ecb6ef1c1db75f5d1358185d860d8801742). Its only changes are the companion-project test suite and [Windows repair record](../testing/COMPANION-JSON-CI-REPAIR.md). Both files are preserved byte-for-byte in this documentation branch; its parent is the repaired head, not the superseded e71 head.

The inspected correction replaces lexical path expectations with independent canonical filesystem paths and replaces an LF-assuming JSON splice with parsed/serialized own-property fixtures. New real-CLI regressions cover root aliases, missing targets, LF/CRLF/trailing whitespace and all forbidden keys. The repair report records that installation and compilation had succeeded: these were Windows test-portability defects, not evidence of a broken package installation. This review inspected the corrected source but did not independently rerun Windows.

The [repaired source artifact](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36059214743/artifacts/10833373411) supplies the two exact Git blobs. The reconstructed repaired baseline matches tree `f32a1b3a368f039ea386dda1e55dd02f506758e8`; its tested merge snapshot is `d9ded513e1cdd0bd8cac57b00065b9c9ee64b862`. The PR #17 discovery gap remains because this repair changes neither its missing paths nor the package catalog.

On the repaired source plus this documentation, the same local handoff/test-data/file-plan command reports **50 tests: 48 passed, two platform skips, zero failures** under Linux/Node 22.16.0/npm 10.9.2. This is a separate execution, not added to the earlier 49-test total and not qualified-toolchain or Windows evidence.

At the repaired-head check observed during this review, [companion source](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36059214743) and [fixture baseline](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36059214835) passed; [setup compatibility](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36059214734), [showcase](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36059214716) and [template authoring](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36059214908) were still running. Fresh completion belongs to those runs; the documentation PR has its own checks. SH-023 must preserve/reconcile the repair and verify final integration, not implement the same fix twice.

## Review disposition

Continue P0 implementation; **framework readiness remains blocked** by missing PR #17 integration and the specified kit/CLI/compiler/adapter qualification. Preserve the concurrent Windows correction and check its exact-head results. Preserve PR #5's read-only handoff and evolving concept. Ship the independently qualified framework before native companion conversion. Reassess exact-head CI after future code changes; do not treat this dated review as live status.

## PR #20 integration addendum — 2026-09-25

The prior findings apply to the exact heads cited above. The base has since advanced to `1dfa991df77ea5fa742d8bd5e300c877d0d45151`, merging PR #20. It now includes `shell.mjs`, a shared TypeScript project compiler and runtime contracts, binary-safe file plans, source-fingerprint updates, generator tests and a generated-consumer workflow. Statements above that no generator/entry exists are historical, not the current implementation inventory.

The conflict repair retains all these executable changes byte-for-byte. Its add/add task collision is resolved by retaining the roadmap SH-023 and mapping PR #20's compiler task to [SH-035](../tasks/shell/SH-035.md); SH-028 depends on it. The handoff documentation retains both the unchanged read-only v1 reader and the separate plan/apply generator. See the [current generator guide](COMPANION-GENERATOR.md) and [merge verification](../testing/PR18-MERGE-RECONCILIATION.md).

Remaining distinctions: runtime TypeScript launch is not the planned compiled-kit bootstrap; separate vault-relative generation is not in-place extracted-project setup; configurable generated-product folders do not relocate framework roots; generated TODOs are not accepted native behavior. The PR #17 discovery paths remain absent. Framework readiness and the requested framework-before-companion shipment order are unchanged. No implementation task is marked done by conflict resolution.
