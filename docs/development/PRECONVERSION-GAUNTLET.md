# Pre-conversion implementation checkpoint

## Boundary and baseline

**PRE-CONVERSION BLOCKED.** SH-001–022 and CX-001–007 are in scope. Stop before CP-001;
no native companion conversion, publication, tags, PR merges or personal vault changes.

Implementation branch: `build/preconversion-shell`. Draft PR #17 base:
`docs/shell-first-companion-delivery-plan` (open PR #16, `2cadc495d5989760b09f257289b33e9d7c356e70`).
Source integration also preserves current main `9a56505ee3af90583d5e057774705078d6e99aff`
and open PR #5 `6a39dd03947e4f8da40c03dc42f4a8b5e34065b4` through the verified merge
snapshot `8be4fd03b6cadc3185f0010042d2ee5f323c12ab`. Integration commit: `7ce25382d90dd87e942249533acd69b6e8f14017`.
First implementation: `afbc4119f34639db8d1b6e62c7632a7ed1f1a3ce`.
Prerequisite branches are unchanged.
PR #15 is parallel, unmerged runtime work, not a claimed part of this candidate.

The commit containing this checkpoint is the source identity for its contents;
consult the PR head/commit history for the current revision, not the local recovery
snapshot commit. Exact executable hashes and commands are in the linked verification record.

## Current slice and evidence

[SH-001 inventory](SHELL-CAPABILITY-INVENTORY.md) retains all task and acceptance scope.
[SH-011](../tasks/shell/SH-011.md) implements data-only discovery and version-1
request/progress/result/error/receipt contracts. It does not expose write execution;
that integration remains [SH-012](../tasks/shell/SH-012.md).

Read [operation protocol](OPERATION-PROTOCOL.md) and [execution/review record](../testing/preconversion-gauntlet/SH-011.md).
Task frontmatter is the status authority; this checkpoint is not a second status database.

## Blockers and next executable steps

Complete current-head pinned-toolchain CI, full maker/consumer regressions and an
independent review before advancing SH-011. Local dependency-free checks use Node
22.16.0/npm 10.9.2, not the qualified Node 24.21.0/npm 11.19.1 pair. Native/platform,
manual accessibility, live dependency-support/security and calibrated performance
qualification remain incomplete; successful catalog discovery does not qualify them.

Then implement dependency-ready SH-015; continue SH-002/shared runtime qualification
without duplicating open PR #15. No CX task is promoted from historical browser counts.
SH-022 and CX-007 remain blocked by their mandatory prerequisites and evidence.

At resume, inspect live main/PR #5/#15/#16/implementation head, task frontmatter,
this checkpoint and failed/finished CI. Revalidate changed contracts; do not reconstruct
an older head or accept pending checks as passed. No background continuation is promised.

## First integrated candidate and consumer repair

The frozen `80a426f` candidate completed its hosted verification/browser/native/security
workflow, but the separate full consumer workflow failed at example removal because
the intentional README change had not updated its reviewed ownership hash. The
containing repair commit updates that preimage without relaxing edited-file guards;
see [exact results and repair](../testing/preconversion-gauntlet/INTEGRATION-80a426f.md).
Recheck the repaired head's complete consumer workflow before advancing SH-011.
