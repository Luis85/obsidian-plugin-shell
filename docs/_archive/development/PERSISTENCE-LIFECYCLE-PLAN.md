# Persistence and lifecycle acceptance plan

Baseline checked 2026-09-24: PR #12 is merged at evidence head
`a185a693dffe899bc303004122d94264cbb4a961`, all reported checks successful.
Clean main was fast-forwarded to current origin/main
`5864907` (also includes the externally merged Node type update). Work takes
place only in `.worktrees/persistence-lifecycle`, branch
`codex/persistence-lifecycle`, based on that integration commit. No `.codex/`
directory exists. Earlier worktrees, candidates, reports and the policy-blocked
cleanup directory remain untouched. Previous qualified counts are 2 verified,
54 partial and 40 not-run; these are evidence linkage, not implementation rates.

## Agreed contracts and closure criteria before implementation

Keep schema 1, all 96 legacy cases and modes, original baseline, separate Nuxt UI
matrix and blocked release profile. Reuse trusted producers and session checking.
No new packet schema is needed. Component files must use the existing
`-components.test.ts` naming contract; unit and controlled adapters stay unit.
Only actual observed producer names may become links. Whole extent requires all
referenced clauses in that mode; a suite pass or resource bus count is insufficient.

| Case | Required modes | Exact remaining assertion or capability boundary |
| --- | --- | --- |
| AC-05 | unit, browser-integrated | Exact original and saved note/envelope bytes, known versus uncertain save, queued writes blocked after uncertainty, no false success/facts, deliberate recovery and independent reconstructed durable outcome. |
| AC-07 | unit, browser-integrated | Malformed/future stored bytes preserved through real load/actions/reload, no default save, protected mutations, untouched opaque records. Audit DAT-04 distinction between absent, corrupt, inaccessible and future data; do not infer category-specific recovery or migrations from preservation. |
| AC-11 | unit, browser-integrated | Twenty actual owner cycles measuring subscriptions, timers, notices, dialogs and actions individually; sibling remains usable and baseline returns. Window/pop-out ownership and partial-startup/deferred work remain explicit where absent. |
| AC-46 | unit, browser-integrated | Failed-save suppression of success facts, exact committed projections in two views and independent runtime isolation. Reconstruction must read actual storage. |
| AC-62 | unit, browser-integrated | Cancel before and close during mutation, truthful durable outcome, preserved note, no late disposed UI, bounded retained operation state and privacy-safe diagnostics. Item deletion alone cannot prove the note clause. |
| AC-66 | unit, browser-integrated | Uncertain create stays blocked, committed open failure exposes only opening, stale/disposed actions cannot run, pending closure preserves committed follow-up truth. |
| AC-71 | component, browser-integrated, native | Actual owned handles/actions/timers/dialog cleanup, unrelated owner remains, late callbacks suppressed. Current native sibling/save controls do not establish the whole notice/timer/action contract. |

## File ownership and dependencies

| Owner | Exclusive files and responsibility |
| --- | --- |
| A, persistence | New `tests/runtime/persistence-outcomes.test.ts`; real services, repositories, shared writer, exact bytes/revisions/facts and reconstruction. Propose any production correction before editing outside this file. |
| B, lifecycle | New `tests/runtime/lifecycle-recovery-components.test.ts`, `tests/e2e/persistence-lifecycle.spec.ts`; narrow measured-resource additions to `harness/app/adapters.ts`, `test-api.ts`, `main.ts`. Additional bounded helper/spec files require coordination. Real components/actions, faults before every reconstruction, active sibling and safe recovery. |
| C, reliability | New `docs/testing/PERSISTENCE-LIFECYCLE-NATIVE.md`; read-only original-failure audit and bounded experiments below. No host launch or new instrumentation without resource coordination and demonstrated need. |
| Parent | Shared configuration, schemas, workflows, example ownership hashes/templates, crosswalk, integration, plans/ledgers/execution/review records, candidate identity, qualification and PR delivery. |

A and B coordinate exact assertion names, effect boundaries and shared writer
semantics. No shared production correction or report change is preapproved.
Harness observations count actual scheduler/sink/action ownership, not substitutes.
Example-dependent files enter reviewed removal ownership and generated-consumer
preservation checks. Heavy installs/builds/lint/coverage/native runs are serialized.

B's agreed extension adds `tests/e2e/persistence-lifecycle-fixture.ts` and
`harness/app/lifecycle-resources.ts`, plus controlled write/open pause boundaries.
Inspection found Items leaves mutations enabled after protected storage reads.
B may correct `src/presentation/composables/use-items-controller.ts` after retaining
a failing regression, blocking the precise `error.settingsRead` and
`error.pluginDataRead` outcomes while preserving preference writes for incompatible
entity collections. This is not a blanket storage-error block.

A additionally owns `tests/runtime/document-lifecycle.test.ts` for unit-mode
note cancellation, in-flight runtime disposal, bounded request retention, privacy
and retained view-action capabilities. B owns a minimal `showcase.ts` action
entry guard only if the disposed-action regression demonstrates a failure.

## Bounded diagnostic experiments

1. Windows Appearance: rehash and inspect earliest Light-control/dark-main raw
   report and screenshot separately from the later Dark-control report/trace.
   Compare driver sequence for missing propagation versus control reversion.
   Stop at the retained evidence boundary; neither implies a common cause.
2. Linux pop-out: inspect original failing and passing sessions, canonical errors,
   receipt phases and close/restart checkpoints. One newly frozen qualification
   session may add existing timeline evidence on explicitly provisioned isolated
   Linux CI. Receipt times are not throw times; CDP disconnect ends visibility.
3. Windows UI-03-04: inspect original hosted timeout and the retained one-run stage
   diagnostic to evaluate a deterministic settings-stage stall. Preserve its
   unchanged 5-second bound; no local rerun merely to obtain a pass.
4. Windows archive EBUSY: inspect original cleanup error and subsequent existing
   command receipts/controls. At most one normal fixture execution per prescribed
   verification stage; do not infer body timeout or orphan without evidence.

Distinguish plugin, host, automation, fixture and unknown. A correction requires a
reproduced mechanism and regression. Otherwise retain eliminated hypotheses and
a precise next experiment. Never force host theme classes or stop unrelated work.

## Execution, review and delivery

1. Fresh exact-lock `npm ci --strict-allow-scripts`, qualified Node 24.21.0 and
   npm 11.19.1. Install log and every failed attempt remain retained.
2. Focused positive/negative runtime/component/browser assertions, strict types and
   relevant gates. Explicitly provision Chromium. Inspect actual producer output.
3. Separate review wave: A reviews B, B reviews C, C reviews A; parent reviews
   shared integration, crosswalk extents, source identities and consumer removal.
   Reproduce findings, correct and rerun affected checks without hidden retries.
4. Freeze corrected executable source. Run full `verify`, served E2E, live
   all-category security audit and trusted runtime/coverage/artifact/browser/native
   producers through existing fixed-candidate qualification. Existing read-only CI
   can serialize complete heavyweight qualification away from this limited host.
   Exercise generated consumer, edited feature preservation, removal and literal
   archive because new example tests and harness seams affect those flows.
5. Retain exact assets/provenance, all failed/skipped/interrupted attempts, reports
   and source identities. Changed executable inputs invalidate earlier source
   evidence; asset reuse is explicit SHA-256 equality only.
6. Reconcile complete sessions, update crosswalk/ledger/current review and execution
   records together. Separate evidence-only commit from code checkpoint. Push,
   open/attach reviewable PR targeting main, inspect checks and correct demonstrated
   relevant defects. Confirm any external merge without merging ourselves.
7. Report counts, exact advancements, remaining assertion/implementation/environment/
   owner work, Windows uncertainty, commands, hashes, SHAs and checks. Ask owner
   for next step. No release, tag, publication, listing or permission change.
