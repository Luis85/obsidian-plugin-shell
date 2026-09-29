# Typed Markdown application documentation — verification

## Source and integration

Draft PR #51 implements this feature on PR #5. The recovered implementation was
`9a032a928546cffc695ca0a3f68f196a36a1b1e1`; its hosted merge with the concurrent
Workbench product documentation was `e5625511d689cc11d831cc4c778c9ac37ed37f0a`
(PR #5 parent `f3778ed120e845a781c9cc08afc9b16a8b1a3e8c`). This continuation
uses that exact archived source rather than substituting an older project model.

The earlier bootstrap workflow at `af44809ad96edfbdf70602c876eaf7b191bd376f`
ran without feature tests and is not evidence of feature completion. The recovered
candidate passed TypeScript checking and 65/69 feature tests on the hosted runner.
Its failures exposed a malformed child-process crash test and an outdated README
ownership fingerprint after the Workbench vision changes. Both are corrected here.
The existing setup regression was updated for the additional explicit docs prompts.

## Implementation

Shared operations: `docs import`, `docs export`, `docs validate`, `docs status`,
`docs schema`, `docs recover`. The Markdown adapter maps to the native v6 model;
imports use the existing configuration/intake ownership mechanism and reviewed
file-plan writer. The packaged CLI carries the pinned YAML parser and license so
these operations work before a consumer installs dependencies.

Full exports check the semantic inverse of the native project projection. Remaining
validated subsystems stay in explicit structured project context. Editable events
have one definition, reattached to their real owner/source nodes. Component revision
immutability, authored metadata/prose, stable IDs and additive import are retained.
Generated coverage is data coverage, not a claim of finished business implementation
or prose specifications. The guide is
[Application documentation](../user-manual/shell-cli/application-documentation.md).

The continuation also removes genuinely unused public exports and gives the docs
object validator and operation-plan saver distinct names, addressing the seven
reported analyzer findings without disabling checks or lowering thresholds. The
README ownership update pins the exact inspected Workbench README, not arbitrary
future edits; the runtime ownership guard and its negative tests remain unchanged.

## Executed locally in this continuation

Source: the archived integration candidate above plus this continuation's changes.
Runtime: Node **22.16.0**, not the qualified hosted Node **24.21.0**. TypeScript
**6.0.3** and YAML **2.9.1** were recovered from the pinned hosted toolchain artifact.
The container has no registry/network access; no substitute compiler was installed.

- `npm run typecheck:framework`: passed with the repository-pinned TypeScript.
- Feature and setup suites: **89 passed**, none skipped (71 docs, 18 setup).
- Combined feature/setup and existing core/manual/guidance/documents/input-style
  replay: **147/148 passed**. The one failure is the existing human-doctor test's
  empty-stderr expectation receiving Node 22's experimental type-stripping warning.
  It is not relabeled as a passing test; pinned Node 24 CI must replay it.
- Complete retained self-project: **299 projected elements**, semantic inverse
  passed with every preserved project field.
- Handbook generation and stale-output check: passed, **70 commands**.
- Handbook audit: passed, **10 documents, 97 parsed framework examples, 13 local
  links**; the audit executes none of the examples.
- Test-suite inventory check: passed; newly named docs suites are included through
  the existing `framework-*.checks.mjs` registration.

Crash tests terminate actual child writers at three destination boundaries and then
run explicit rollback against staged preimages. An edited target and live writer
remain protected. The packaged CLI test performs actual setup, Markdown export and
import, confirms the intake fingerprint, and previews ordinary source generation
with no root `node_modules`. Its scope guard matches existing kit tests: packaging
is inapplicable only after all delete-only framework examples were explicitly
removed; a partially edited checkout must still fail, not skip.

## Hosted and remaining qualification

The revised documentation workflow requires all four named feature suites and runs
TypeScript, feature tests, existing CLI/setup regressions and the handbook audit on
Ubuntu and Windows. Check the actual new candidate's logs and commit identity;
prior green bootstrap or PR #5 runs do not qualify new code.

No full local application build, live dependency audit, analyzer rerun or native
Companion acceptance is claimed. The existing full CI and thresholds remain intact.
No merge, release, plugin activation or personal-vault operation is included.
Recovery guarantees checked process-interruption rollback, not power-loss/fsync or
filesystem-wide atomicity. There is no implicit deletion, watcher, legacy-note
adoption, automatic ID remapping or Markdown prose execution.
