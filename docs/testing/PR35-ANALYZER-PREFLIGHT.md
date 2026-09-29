# PR #35 — analyzer entry and early verification

## Reproduced hosted failure

Starting head: `75628b760a582ae84ab7500d1ebb32a6995df8af`, source tree
`f9449cc63d5f6d2f0395272047443358e8543cd6`. GitHub tested merge checkout
`095e87674e01efd588f9b9d94d0b05cd8ed934ac` with the same source tree.

CI run `36387749239`, generated-companion job `108816650246`, built successfully
then failed the full fallow 3.28.0 analyzer on exactly one unused file:
`scripts/compiler/verify-preview-host.mjs`. Setup-policy run `36387749122`,
Ubuntu Node 24.21.0/npm 11.19.1 job `108816650108`, failed the same inventory
check inside `[ANALYZER-ARCHIVE]` after its earlier tooling suites passed.
Dependency installation and the compiler/browser implementation were not the
failure in those two inspected jobs. The separate compiler workflow
`36387749140` succeeded at this preceding head; that does not qualify later edits.

## Repair and regression controls

The emitted-host browser verifier is invoked as a subprocess by the compiler
qualification driver. Its exact path is now a **test-role entry point** in the
existing `fallow-node-tests.json` plugin. This is not a file/directory suppression,
production entry point, rule change or waiver of unused private implementations.
The archive test removes that one entry and requires the actual analyzer to
identify that file; an adjacent unexpected compiler file must also be rejected.
The previous runtime/archive negative controls remain intact.

Full verification additionally runs the unchanged analyzer immediately after the
build supplies required generated inputs, before costly compiler/install suites.
Its existing later analyzer pass is retained to detect drift left by those suites.
Three orchestration tests execute the real verification script with explicitly
identified command doubles: ordinary and evidence-tooling order, and nonzero
outcomes from both early and late failures. These are orchestration tests, not
substitutes for execution of the real analyzer.

## Supplementary local verification

Node 22.16.0, npm 10.9.2; not the qualified hosted tools. The three new
orchestration tests fail against the original verification sequence and pass after
this change, with no skips or TODOs. Source limits, test-suite ownership and
whitespace checks pass (293 test files, 31 suites, 32 helpers).

The exact downloaded source archive was compared to the Git tree, including the
tracked concept build files ignored by ordinary `git add`. No archive-only files
or synthetic local Git history are pushed. The pinned analyzer and full dependency
installation are unavailable locally because package-registry DNS resolution
fails. Actual analyzer/archive and whole verification outcomes therefore remain
subject to the fresh hosted run; no successful result is inferred from new tests.

This is an IP-11 correction under the [improvement plan](../product/PR5-IMPROVEMENT-PLAN.md).
The [previous preview record](GENERATED-PREVIEW-HOST.md) remains historical.
No thresholds, dependencies, lockfile, publication authority or native scope change.
