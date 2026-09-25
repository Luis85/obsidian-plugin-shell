# Delivery strategy: ship the framework before companion conversion

Repository overview: [shell-first delivery](../../SHELL-FIRST-OVERVIEW.md). The [root README](../../README.md) remains the current template operational guide.

**Decision date:** 2026-09-24. **Status:** Owner-directed delivery order; implementation, qualification and publication approval remain outstanding. Read with the [parent PRD](PRD.md), [companion PRD](COMPANION-PLUGIN-PRD.md), [improvement plan](COMPANION-IMPROVEMENT-PLAN.md), [CLI/generator implementation plan](../development/FRAMEWORK-CLI-GENERATOR-PLAN.md) and [task index](../tasks/README.md).

## Decision and precedence

The first shipped product is the **standalone framework developer kit: reusable shell, TypeScript CLI and project generator**. The primary journey is download GitHub release asset → extract into a new project directory → console setup/configure → import project JSON → review/generate → develop/build/test → explicitly publish the generated plugin → maintain.

No installed shell/companion plugin, maintainer checkout or global CLI is required. The extracted development project need not be inside a vault. The companion is an optional design interface and later a native consumer of the shipped framework. Its concept remains open to feature development.

This refines the previous shell-first plan: **framework shipment is no longer held until native companion readiness**. The original phrase “publication last” now applies to each qualified product separately, and specifically to companion publication after CP-010. It does not defer the first framework release behind CP tasks. An install-companion-first journey remains an optional later route, not the primary developer-kit entry or construction order.

Existing requirements, safety boundaries, quality thresholds and evidence inventories remain in force. No prior result is promoted. This planning change does not authorize merges, tags, releases, listing submissions, installation, activation or permission changes.

## Work lanes and implementation order

| Lane | Priority | Responsibility | Entry/exit |
| --- | --- | --- | --- |
| Framework | P0 | Shell APIs, shared TypeScript operations, CLI, JSON generator, fixtures, maintenance, consumer release tooling and assembled archive | SH-001–SH-033; technical gate SH-022, separately authorized framework shipment SH-034. |
| Concept | P1 | Continue design and validate the portable contract; expose framework gaps | Secondary/parallel; CX-007 selects a bounded conversion scope. |
| Native companion | P2 | Convert the agreed scope into a genuine shell-based plugin | CP-001 requires SH-022, SH-034 and CX-007; CP-010 closes native readiness. |
| Companion publication | P3 | Companion packaging, release rehearsal, support and listing | PUB-001–PUB-005 after CP-010; exact-candidate approval remains separate. |

Implementation increments are baseline/Windows-CI reconciliation (SH-023), shared TypeScript core (SH-024), CLI (SH-025), runnable archive (SH-026), setup/import (SH-027), complete project generation (SH-028), lifecycle (SH-029), maintenance (SH-030), generated-plugin release tooling (SH-031), exact-archive qualification (SH-032) and framework-side companion contract proof (SH-033). Existing SH-001–SH-021 remain prerequisites, not replaced tasks. Follow task dependencies; the increment list is not permission to ignore parallel prerequisites.

Use the [PR #5 review](../development/PR5-FRAMEWORK-READINESS-REVIEW.md) to reconcile PR #17's missing discovery work and observed Windows failures before porting/rebuilding capabilities. P1 work must not delay P0 prerequisites. Headless companion protocol tests belong to framework delivery; native companion screens/persistence do not.

## Gate G1: framework technically ready — SH-022

Require current-source evidence for all applicable shell requirements and the added CLI/archive/generator scope. SH-032 and SH-033 are explicit dependencies; their transitive coverage includes SH-023–SH-031. Keep original minimal/richer consumers, runtime/persistence/lifecycle, host/accessibility/performance and dependency requirements.

Exercise the actual assembled release archive without Git, node_modules, a companion or maintainer workspace: bootstrap, import, conflict review, non-default paths, generation, exact dependencies, build/test, native install/use, ownership-preserving regeneration/maintenance and release rehearsal. CLI direct/npm human/agent paths and an independent headless companion adapter must consume the same operations. A green repository checkout alone is insufficient.

The reviewed baseline is blocked; missing native cases, unsupported required dependencies and unresolved safety/CI failures cannot be moved into publication merely to pass. Task completion counts do not establish evidence. Changes to qualified contracts reopen affected checks.

## Gate G1R: framework shipped — SH-034

After SH-022, identify the exact retained framework archive, checksums, licenses, candidate/source/toolchain versions and destination. Rehearse first. Actual publication requires **fresh explicit owner approval** for that candidate and those actions; the task file and this user request are not approval.

Publish only approved retained bytes; do not rebuild or upgrade during promotion. Redownload and verify the published asset and repeat the clean-entry smoke flow. Missing approval leaves this gate blocked even when technically ready. CP-001 waits for the recorded shipment. No native companion is required to qualify or ship this framework.

## Gate G2: bounded concept scope — CX-007

Record the exact concept revision, accepted feature scope, questions, deferrals and acceptance scenarios. Map selected features to the shipped framework contract. This is not a whole-product feature freeze. Later design work may continue; new native dependencies require framework changes and requalification before use.

## Gate G3: native companion ready — CP-010

Build a real product through the same maintained shell APIs: persisted Markdown designs, editors, optional template/generation operations, fixtures, design-system and recovery flows. No iframe/webview wrapper or private foundation copy counts.

Execute design-only, design-to-working-plugin and developer-ownership journeys. Record actual native/platform/accessibility/performance evidence and standalone regressions against the exact accepted candidate. Browser simulation is not native evidence.

## Gate G4: authorized companion publication — PUB-001–PUB-005

Resolve current companion distribution/policy, rehearse compatible artifacts, complete onboarding/support, and obtain fresh candidate/destination/action approval for PUB-004. Reference the already shipped framework; do not hold its first release here. GitHub plugin assets and community-directory acceptance are different outcomes.

Generated-plugin release capability is delivered earlier in SH-031 and rehearsed in SH-032. Providing that capability does not publish a user's project or the companion. No gate is an authorization token.

## Change control and compatibility

Task frontmatter is the status/dependency authority; index tables are navigation. Begin with current code/evidence and implement only gaps. Keep stable IDs and a valid acyclic dependency graph. Done tasks record exact source/artifacts, commands, actual outcomes and unexecuted modes; blockers state the next action. Historical records remain dated and unchanged.

The new-kit isolated target is proposed as `.test-vault`. Existing `.dev-vault` projects are not renamed, moved or reconfigured without an explicit migration. Source/test paths remain `codebaseFolder` / `testsFolder` with `src` / `tests` defaults. Resolve the actual host config directory. Preserve the exact-byte, read-only v1 companion handoff while adding a separate project-root compiler contract.

Use task-focused PRs. This documentation increment is based on PR #5's delivered source and can be reviewed as a stacked PR while #5 is open. Integrate/retarget through reviewed operations; do not merge the prerequisite automatically.
