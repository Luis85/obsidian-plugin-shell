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

## Safety continuation — 2026-09-29

The previous implementation candidate `04a61533237a0e2ee79d22e83590bdbb07debeb7`
passed documentation workflow **36613865416** on both Windows and Ubuntu. The
retrieved Windows artifact records checked-out merge
`41b4f83cc2cf18a6d5d5f3ae6371a0d62ccabfca`, Node **24.21.0**, TypeScript **6.0.3**
and YAML **2.9.1**, with **71/71 feature tests**, **77/77 existing CLI/setup tests**,
and successful handbook generation/check/audit. This is evidence for that candidate,
not automatic qualification of subsequent edits.

Further executable review reproduced and fixed three gaps:

- Hidden output paths could be written but were rejected by the next index read.
  Settings and destination checks now reject them before creating any files.
- Importing a single copied file could rebind an identity while its original file
  remained. This now blocks with an explicit conflict; real file moves still work.
- Excluding an existing destination from discovery could bypass reconciliation and
  overwrite unsynchronized managed data. The destination now receives the same
  project-identity and baseline-aware conflict review. Matching documents can still
  be adopted without rewriting their authored text.

The input reader also checks regular-file type before opening, with non-blocking
flags where available, so a named pipe cannot hang the documentation command.
Index loading rejects duplicate path bindings. Preservation/deletion switches
reject string, numeric and null substitutes for the supported boolean values.

Eight new safety tests are explicitly required by the documentation workflow.
The named-pipe test uses a real FIFO on POSIX and a non-regular directory input on
Windows; neither branch is counted as a skipped test. The existing framework suite
registration includes the new suite without broadening analyzer exemptions.

Local continuation results (Node **22.16.0**, pinned TS/YAML unchanged):

- Feature and setup replay: **97/97 passed**, none skipped.
- All focused docs/CLI/setup suites: **155/156 passed**, none skipped. The sole
  failure remains the existing empty-stderr assertion receiving Node 22's
  experimental type-stripping warning. No warning filter or test weakening was
  introduced. Hosted Node 24 must qualify the new candidate.
- Framework typecheck: passed. Suite inventory: **337 test files, 35 suites,
  34 helpers**. Handbook generation/check/audit: passed, unchanged at 70 commands,
  10 authored documents, 97 parsed examples and 13 relative links.

New hosted results must be read from the safety commit's workflow. Broad runtime,
release and native acceptance retain their existing separate evidence boundaries.

## HTML handbook qualification repair — 2026-09-29

Candidate `f8cdf92b52aa21dc0a1f72423a3a00a40cbb349e` passed the dedicated
Ubuntu and Windows documentation workflow **36615427754**. The Ubuntu artifact
records merge `162fe44fdbac92c0ebf729fc0079798d55561f41`, with **79/79 documentation
tests** and **77/77 CLI/setup regressions**, no skips, on Node **24.21.0**.

The separate manual workflow **36615427723** passed both contract jobs but failed
its HTML site job **109567587503**: the new fenced `markdown` example was not in
TypeDoc's configured highlight languages. The renderer produced zero errors and
one warning, correctly failing under `treatWarningsAsErrors`.

The configuration now explicitly preserves TypeDoc's standard highlighting set
and adds Markdown. Warning severity and link/path validation remain unchanged;
no language is silently ignored and no dependency version changes. An added
contract test reads the actual registered application guide and renderer options.
It failed before the configuration change and passed afterward: **18/18 manual
contract tests**, none skipped. Local command-reference generation, deterministic
check and authored-example/link audit also passed without output changes. Actual
HTML rendering is qualified separately by the hosted site job for this repair.
