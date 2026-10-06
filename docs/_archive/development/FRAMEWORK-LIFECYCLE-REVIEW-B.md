# Independent B review of native observation and ownership

Review scope is the actual changed lifecycle receipt helper, notification and
modal services, runtime observation hub, native ownership drivers and their
regressions. This review does not itself execute a native host or qualify assets.
Implementation and execution results are recorded separately by the parent.

## Findings and correction status

| Finding | Evidence and required correction |
| --- | --- |
| An asynchronous observer rejection escaped synchronous-only catches. | The initial lifecycle helper and runtime hub invoked callbacks returning `void` without inspecting a returned promise. TypeScript permits an async callback in that position. Owners added explicit promise rejection handling and regressions, including independent failure counting after unsubscribe and containment without recursive diagnostic reporting. |
| Final native ledgers were recorded without validation. | Both native helpers checked the primary ledger, then saved `finalObservation` without applying the same exact-fault/loss assertions. A later extra observation could therefore survive in an otherwise passing report. C added final validation before observer detachment and reconstruction, preserving primary and cleanup failures separately. Boundary installation now occurs inside cleanup protection, and observation cleanup failure marks the nested Items result failed. Actual native execution remains separate. |
| A retained runtime observer could subscribe after disposal. | The initial hub only cleared listeners, allowing a retained `observation.subscribe` to acquire a new callback after unload. Parent added the disposed guard while retaining terminal counters. B caught an initial assertion that unsubscribed before testing; the corrected assertion retains the attempted subscription through emission, so removal of the guard cannot hide behind explicit unsubscribe. |
| Synchronous observation can reenter cleanup before handle registration completes. | `NotificationPolicy.sink` called `resources.acquire` before `display` assigned `entry.sink`; a callback closing that owner removed its entry before the returned native handle became owned. Timer/action acquisition had analogous ordering gaps. Actual red controls reproduced these and the overflow, legacy replacement, successor-registry, availability and transient-release cases. Corrected code releases obsolete acquisitions, detaches old handles before emitting release, preserves newer requests/registries and checks owner/request identity before acquiring further work. B inspected each corrected emission path; final affected execution is recorded below. |

## Evidence and native scope boundaries

The driver attaches its independent ledger through a returned JSHandle; no new
production test global or private host-manager patch is needed. The observation
surface exposes only `subscribe` and `snapshot`, while event payloads contain
frozen scalar metadata. Resource receipts count successful underlying handle
creation/cleanup; controlled cleanup exceptions remain outstanding rather than
producing false release receipts. Pending availability is retained until its
promise settles, even after its action and initiating UI are disposed.

The initial, pre-amendment native public UI experiment covers owned ordinary notices, their
six-second expiry timers, native dialogs, a live sibling and a separately created
persistent native Notice. A slow host can reach natural expiry before the owner
close assertions; that first outcome must remain a failure for analysis, without
changing duration or retrying until green. There is no claim that this reachable
public UI exercises delayed progress or pending recovery availability. Those
clauses remain synthetic-service/component scope until a real native caller is
qualified on the exact accepted assets.

## Independently inspected local receipts

B read the actual retained logs, not only C's summaries:

- `c-runtime-first.log`: 40 tests in seven files passed before adversarial review.
- `c-tooling-first.log`: four native-ledger/boundary controls passed.
- `c-reentrancy-red.log`: notice, timer and action reentrant disposal all failed.
- `c-reentrancy-red-extended.log`: overflow, legacy replacement, successor registry
  and pre-availability disposal failed; five earlier controls passed.
- `c-runtime-corrected.log`: 49 tests in eight files passed after those fixes.
- `c-reentrancy-transient-red.log`: three strengthened transient/release controls
  still acquired a new notice or timer after disposal; eight controls passed.
- `c-runtime-final.log`: 53 tests in eight files passed after transient guards
  and successor-preservation controls were added.
- `c-boundary-final.log`: all 34 affected tests in four files passed after the
  final sink/overflow detachment and successor corrections; this includes all
  16 reentrant lifecycle controls.
- `c-tooling-final.log`: all four native-ledger/boundary controls passed again.

The final follow-up also detaches old sink/overflow handles before callbacks,
preserves a successor overflow, and makes native observation cleanup failure
explicit. B independently inspected those corrections and the final retained
outputs, and found no remaining actionable issue in this agreed review scope.
Full current-source verification and frozen native qualification remain the
parent's integration work; these local receipts do not replace those gates.

The Items native experiment remains controlled adapter failure inside a native
host, not a native disk fault. Its expected independent fault is exactly one
`settings.write` / `settings.save`, checked before reconstruction. Resource-only
ownership expects zero faults. Both require zero lost entries, sequence gaps and
observer failures. Historical appearance, pop-out, timeout and archive failures
remain separate and cannot be closed by this implementation or a later pass.

## Follow-up: native producer integration

Parent found that the existing trusted native adapter still required legacy
diagnostics and rejected the new `resourceOwnership` field. B reviewed the new
pure `native-resource-report.mjs` validator, its `nativeReport` caller, the actual
native driver output and the new parser controls. No verification command was
executed by B during this bounded review; the parent owns the serialized slot.

Two issues were reported and corrected:

- Successful ownership records lacked a closed nested schema: `passed()` rejected
  failure/reason keys but still accepted arbitrary fields such as `error`. The
  native adapter's root whitelist does not inspect these nested records. The
  corrected validator requires exact successful resource fields and explicit item
  fields, including paired optional diagnostic display/provenance. Caller-level
  controls reject both `error` and arbitrary unknown fields in either record.
- The history-rewrite negative modified only an acquisition, so its unmatched
  release already failed each-ledger validation. The corrected control supplies
  an internally consistent rewritten final ledger, changing both acquisition and
  matching release metadata. Both the pure validator and actual `nativeReport`
  caller reject it through cross-checkpoint prefix validation.

B independently inspected the corrected source, assertions and actual retained
`reports/framework-lifecycle/native-report-tests-04.txt` output: all nine Node
tests passed, with zero failures, cancellations or skips. That includes six new
parser/caller cases and three existing independent-observation controls. This
bounded integration review is closed with no remaining actionable finding.

The remaining reviewed ledger logic matches the driver: exact caught fault codes
and counts, zero overflow/loss, consecutive sequences, counter reconciliation,
resource acquisition/release identities, retained sibling ownership, and empty
unloaded/final resource sets. Expected-check selection keeps the new assertions
separate from historical fixture-only parsing. This is consistency validation,
not proof that report bytes came from honest native execution.

## Follow-up: public recovery example and enhanced native protocol

The parent amended the plan to implement the previously missing real UI caller.
B reviewed the new recovery composable, its actual component/served assertions,
the native CDP callback-retention helper, enhanced driver and extended report
validator. The previous no-caller limitation above describes the earlier driver;
actual new native qualification still requires execution on the frozen candidate.

The example starts a real owned confirmation modal. Recovery availability only
awaits that existing result, while the service owns the persistent review action
and delayed progress. The real native sink directly registers `action.invoke`
with `addEventListener`; the CDP helper retains that actual registered function,
invokes it twice while availability is pending and once after owner closure.
It does not substitute a detached DOM click for a retained callback. The atomic
start/close control invokes the real button and public owning leaf in one renderer
turn, before the real delayed-progress timer can fire.

Review found that starting a new example originally grouped several cleanup calls
before checking its permit. A reentrant start during old-resource release could
install a newer example whose progress/notice the outer call then removed. C
applied the existing single-flight policy before cleanup, captured old handles
and checked the permit after external cleanup. Parent separately identified the
needed permit recheck after failed-outcome feedback cleanup; that guard is also
present. B inspected both source corrections. The retained earlier checkpoint
`c-recovery-component-guarded.log` passed 25 tests in three files; the two added
cleanup/failure controls are qualified by the subsequent
`c-recovery-component-final.log`, which B independently read: all 27 tests in
three files passed. They are not inferred from the earlier pass. The final
caller-level schema control now exercises enhanced `nativeReport` checks with a
matching declared check list, and rejects a false retained-handler invocation count.

The remaining reviewed callback identity, resource counts, modal-completion
availability, cancelled-progress absence, retained replay equality and independent
fault-ledger assertions match the intended source behavior. No further source
finding was identified in this bounded review. B also independently read
`c-recovery-protocol-first.log`: all 11 public-CDP/parser/trusted-nativeReport
controls passed, with no failures, cancellations or skips. The updated native
guide correctly treats the earlier no-caller limitation as historical and the
enhanced protocol as implemented pending frozen-candidate native qualification.
This bounded review is closed. These component and tooling receipts do not claim
a served-browser or native host run.
