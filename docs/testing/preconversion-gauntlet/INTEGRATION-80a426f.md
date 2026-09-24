# First exact-candidate integration and README ownership repair

## Candidate and actual hosted results

Candidate `80a426fad6368f33ce0ce83fa6983241d1763cbf`, tree
`66fd1c8bcee2f8eb9c42d8ad8d8b6d5df94f3899`, 2026-09-24.
[Candidate qualification run 36018776432](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36018776432)
completed successfully: exact Node 24.21.0/npm 11.19.1 install, full verification,
repeated runtime suites, separately scoped coverage, served browser checks,
three fresh isolated native sessions, shared-runner timing collection, live all-category
security gate, and unchanged artifact identity. This is the workflow's actual scope,
not universal native/platform/manual accessibility or calibrated performance evidence.
The known dependency-maintenance exception is not resolved by the security pass.

At this head, Showcase verification, Setup npm policy compatibility, Fixture and
verification baseline, and Companion concept source verification also completed
successfully. Template authoring's makers job passed, but its consumer job failed.

## Failure preserved, not retried into a claimed pass

[Template authoring run 36018785685](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36018785685),
consumer job `107698255248`: setup under a distinct Atlas Notes identity, real feature
and custom-recipe authoring, complete verification, browser checks and literal Git-free
archive qualification passed. The next example-removal dry-run failed before writes:

```text
EXAMPLES_EDITED_FILES: README.md. Preserve these files and reconcile their example dependencies before removal.
```

The subsequent post-removal feature generation was skipped, not passed. Artifact
`10815754432`, renamed-template-authoring, was downloaded and its ZIP verified as
SHA-256 `0fe820aa07e01760cae1d571861a0435c0387cc62b162fd8eb520caea2c24c58`.
Its removal-plan.json contains only npm's preamble because the error was emitted to
stderr; the workflow log retains the actual failure above. It is not a valid plan.

The current shell-first README was changed deliberately during prerequisite
reconciliation and this implementation, but its source-ownership manifest still
expected the previous README hash. The guard was correct; the maintained manifest
was stale. Review confirms the existing foundation README replacement is still the
appropriate explicit outcome of removing optional examples. User-edited README files
must continue to conflict. No runtime path or preservation guard is relaxed.

## Repair and evaluation

The repair updates only the reviewed README preimage in the manifest to
`f2bf82f5b06adb71b9569453851a3dc282a2dd69614f89901f7bff4bc68bf017`.
The JSON is formatted as one record per line; a semantic comparison confirms every
other file hash, replacement, registration and ordering remains unchanged.
The implementation of example removal is unchanged.

`tests/tooling/readme-ownership.checks.mjs` exercises reviewed preview/apply,
idempotent reruns and preservation of a modified README through the real planner.
The dependency-free negative case was executed locally on Node 22.16.0:

```sh
node --test --test-name-pattern='OWN-README-02' tests/tooling/readme-ownership.checks.mjs
```

Exit 0, one selected test passed; the positive TypeScript-backed planner test was
not selected and must run with the repository's installed toolchain in CI. An
additional local comparison confirmed the exact current README hash and one semantic
manifest change. These probes do not replace the full consumer rerun.

The repair is identified by the commit containing this record. Observe its own
current-head checks; earlier candidate/native results do not automatically qualify
changed source. SH-011 remains in review, SH-022 and CX-007 blocked, and independent
review remains outstanding. No CP or PUB task is performed.
