# Setup recovery — inherited source with custom product folders

## Defect and scope

Continue IP-02/IP-11 from PR #35 commit
`069d7091a4748d213bb1e9d1ea0008205f9f7f2c`. The canonical project can place generated
product code under folders such as `application/` and `checks/`, but it still
ships and executes inherited framework code under `src/` and `tests/`.

The previous setup fingerprint visited only the configured folders, scripts and
harness. With custom folders, adding, changing or deleting inherited source did
not invalidate a reviewed resume hash. A change to `src/main.ts` during the
controlled verification executor was consequently recorded as current success.
A linked inherited source root was also omitted from the source-link refusal.

Four negative cases reproduce those defects before the correction; two controls
for configured product folders already passed. No dependency process or native
host was needed for these controlled service-level reproductions.

## Implementation

`setupSnapshot` now inventories the union of fixed `src/`, `tests/`, `scripts/`
and `harness/` roots and the configured product/test roots. The existing bounded
reader, symlink rejection, input hashes, safe progress planner and post-execution
comparison remain authoritative. No new project schema, writer, approval mode or
automatic retry was introduced. Map ownership still deduplicates file identities.

Unrelated build output, reports and installed dependencies remain outside this
bounded source fingerprint. It is not whole-repository attestation or installed
package verification. No claim of cross-process filesystem atomicity is added.

## Executed checks

Supplementary local environment: Node 22.16.0, npm 10.9.2 and TypeScript 5.8.3;
these are not the qualified Node/npm/TypeScript versions. TypeScript and Node
declarations were linked from preinstalled tools into ignored local node_modules.
No dependency or lockfile change is included.

| Check | Result and boundary |
| --- | --- |
| Setup journey suite | 17 passed, no skips/TODOs. New cases cover inherited and custom file additions/edits/deletions, source change during verification, source links and output exclusions. Stage executors are explicit controlled doubles. |
| Compiled-kit suite | 4 passed, no skips/TODOs, including two actual pack/extract/CLI journeys without consumer dependencies or Git. The companion journey uses `app/source` and `spec`, generates the consumer, edits inherited `src/main.ts`, and checks the exact `SETUP_INPUT_CHANGED` result before stage intent or dependency execution. |
| Compiler compatibility, emission and preview lifecycle | 26 passed, no skips/TODOs. Original generated-output goldens and the reviewed preview delta remain unchanged. |
| Framework TypeScript | Passed using supplementary local declarations/tooling. |
| Source limits, suite ownership and whitespace | Passed; 293 test files, 31 suites, 32 helpers. |

Three earlier local kit invocations were interrupted by tool-runner limits before
producing a complete result; they are not passing evidence. The uninterrupted
suite finished in about 94 seconds, including about 43 seconds for the starter
journey and 51 seconds for the companion journey. These are local observations,
not agreed performance budgets or a change to test deadlines.

The separate CI correction and its preflight regressions are documented in
[PR35-ANALYZER-PREFLIGHT.md](PR35-ANALYZER-PREFLIGHT.md). At that preceding commit,
the generated-companion job's formerly failing analyzer/integration step passed;
full CI/setup workflows were still running at inspection. New-head hosted checks
must be evaluated independently.

## Still open

This closes the reproduced custom-folder freshness gap, not the complete
[improvement plan](../product/PR5-IMPROVEMENT-PLAN.md). Full current-candidate
all-platform onboarding, generated clickdummy interaction/visual fidelity,
observed authoring, manual accessibility/device checks, real-host starter
lifecycle and the separately sequenced native companion remain distinct gates.
No release, tag, PR merge, provider call or personal-vault deployment occurred.
