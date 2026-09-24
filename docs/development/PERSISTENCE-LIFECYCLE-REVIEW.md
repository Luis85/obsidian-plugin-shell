# Persistence and lifecycle independent review

The [agreed plan](PERSISTENCE-LIFECYCLE-PLAN.md) assigns three implementation
owners and a separate cross-owner review. A reviews B's lifecycle/recovery
assertions; B reviews C's retained native diagnostics and causal claims; C reviews
A's persistence/failure assertions. Parent reviews shared integration, source
identity, crosswalk extents and consumer/removal preservation.

The separate wave reviewed actual source and adversarial behavior. Qualification
is still in progress; exact frozen results belong to the execution record.

## Findings and corrections

| Finding | Correction and evidence boundary |
| --- | --- |
| Protected root/collection data left Items controls enabled although storage rejected mutation | Precise settings/entity read failures block Items controls. Qualified PL-C07 failed before correction; no default save or schema repair was introduced. |
| Retained disposed document actions could clear the receipt and prepare another write | Entry guards cover preview, commit and reset. PERSIST-66-01 failed on disposed receipt mutation before correction; all nine A tests subsequently passed. |
| Cached request deduplication could conceal a missing commit entry guard from the regression | Assert retained busy/error/opening state and a call-through service commit count. Removing only the guard failed on busy-state mutation. The diagnostic wrapper expected the later count failure and therefore also failed; original output and a read-only audit retain that distinction without a rerun. |
| Retained navigation could mutate the disposed view and save its panel preference | The expanded regression failed at the changed page state; a call-through local writer spy also protects the side effect. Add the same alive entry guard to navigation. |
| Note list expectation assumed automatic refresh | Actual Task projection uses explicit Reload notes. Component/browser assertions now first observe the committed event, then reload and check the durable row plus retained sibling draft. The initial 12/13 run remains retained. |
| Seeded browser expected a new record revision of 1 beside collection revision 2 | Compare new row revision 2 and unchanged old row revision 1, matching the actual shared writer contract. Corrected before the first served execution. |
| Native production diagnostics were described as an independent fault ledger | Native snapshot is the last 200 production diagnostic records; native adapters do not inject the independent observer. The native record and next experiment explicitly retain this gap. |

All original diagnostic attempts remain in local reports, including an initial
PL-C07 run mistakenly started under default Node 24.20.0, the qualified red run,
four unit fixture failures caused by a missing injected scheduler in Node, and
the later corrected attempts. The default-toolchain run is never qualification.

## Explicit remaining scope

The twenty-cycle served test measures actual browser scheduler, dialog and notice
handles, subscription count and leaf count. Its ordinary notice actions are zero;
it does not prove disposal of nonempty recovery registries. The separate component
scenario exercises actual sink callbacks and pending availability invalidation.
An unrelated DOM sentinel is not another plugin's native Notice. Native timer,
action and foreign-notice ownership still requires the experiment in C's record.

Request tests prove the 100-entry retention bound, discarded-preview slot reuse,
selected diagnostic privacy and oversized ASCII rejection. They do not establish
every DOC-18 input/template/collision limit or a UTF-8 byte bound: current body
checks use JavaScript string length. Keep these distinctions in acceptance links.

Review also noted that the separate Task repository editor's retained composable
actions need a focused disposal audit (`use-task-repository.ts`); its `run`
entry currently checks busy rather than owner liveness. This is follow-up work,
not a claim that every action surface is now disposal-qualified. This milestone's
runtime corrections and direct capability tests cover document creation/opening
and view navigation plus protected Items reads.

## Review requirements

- Inspect actual diffs and adversarial controls, not only worker summaries.
- Assert exact fault code/operation/count before reload or reconstruction.
- Keep unit, rendered component, served browser and real native modes distinct.
- Preserve known failures and uncertain persistence; never retry a write blindly.
- Count actual owner timers, dialogs, notices and actions individually; a zero
  bus count does not prove every resource is gone.
- Do not advance whole acceptance from several incomplete clauses or historical
  producer output. Current inputs and every registered attempt govern linkage.
- Preserve edited consumer features and remove only reviewed example identities.
- Keep all four native/Windows causes unresolved unless evidence demonstrates one.
