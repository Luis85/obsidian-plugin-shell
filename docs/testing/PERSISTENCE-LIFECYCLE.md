# Persistence and lifecycle execution record

Work is based on integration commit `5864907`, after confirming PR #12 merged.
The active branch is `codex/persistence-lifecycle`; clean main and both earlier
qualification worktrees are preserved. The [plan](../development/PERSISTENCE-LIFECYCLE-PLAN.md)
was written before implementation and assigns three bounded workers plus a
separate [cross-owner review](../development/PERSISTENCE-LIFECYCLE-REVIEW.md).

Qualification is in progress. Previous frozen code `e2758ae` reported **2 verified,
54 partial, 40 not-run** across all 96 legacy cases. No new full-case advancement
is claimed before complete frozen-source session reconciliation. Required modes,
the historical baseline, separate Nuxt UI matrix and blocked release profile are
unchanged. Evidence counts are not implementation percentages.

## Implemented scope

- Protect Items mutation controls on exact root/entity read failures while keeping
  permitted preference writes independent of unsupported entity collections.
- Reject retained disposed document view navigation, preview, commit and reset
  actions. Pending writes retain their real outcome; opening remains separate.
- Add real-service exact-byte persistence/reconstruction, known/uncertain failure,
  queue blocking, durable revisions, runtime isolation, cancellation, request
  retention and diagnostic privacy assertions.
- Add production-component and served-browser controls for protected data,
  initiating-view closure, sibling drafts, stale/disposed opening and measured
  timer/dialog/notice/subscription/leaf cleanup.
- Reuse existing native diagnostic/error-preservation infrastructure. Four bounded
  read-only comparisons establish no root cause and justify no native runtime fix.

## Development verification and retained failures

Fresh strict installation used exact-lock Node **24.21.0** / npm **11.19.1**:
693 packages installed; initial build and strict Vue/TypeScript check passed.
Local browser provisioning explicitly selects the existing Chromium executable
with SHA-256 `9b07943f834485b43c9d54caea2951c78715f9f07070a80ab6658465ebd3e711`.
This does not constitute a native host run.

The corrected full trusted development producers passed **325/325 runtime tests**
in 57 files and **45/45 served-browser scenarios** in nine files, with no skipped,
failed or retried cases. Their original packets remain in separate source-input
sessions because reviewed ownership metadata changed between them. They supply
observed assertion names for 21 new partial crosswalk links; only the subsequent
frozen complete session can establish the current acceptance report.

Source limits/locale parity passed on 445 inputs and 191 keys; repository checks
passed seven workflows, nine stylesheets and 84 Markdown files at that point;
test-quality checks passed 79 TypeScript test inputs. Reviewed removal initially
rejected the changed README's stale ownership hash, as designed. After updating
that exact reviewed hash, the second plan passed and includes all five new
example-dependent test/helper files. The rejected first plan remains retained.

Final local strict types, ESLint over source/tests/harness, the independent source
linter (97 production inputs), presentation boundaries (24 inputs/nine Vue files),
full Fallow analyzer (zero findings), repository/source checks and the live
all-category `npm run check:security` passed. The live audit reported zero
vulnerabilities; the nested ESLint support exception remains a separate issue.
Full verify/coverage/native/consumer/archive execution belongs to the frozen
candidate phase below, not these development checks.

The qualified protected-data regression failed before its correction. An earlier
accidental Node 24.20.0 diagnostic is retained separately and never promoted.
The first eight-test attempt had three passes, four fixture setup failures from
the missing injected scheduler, and the real disposed-action failure. After the
fixture and runtime corrections, all nine A tests passed; the combined 12/13 run
exposed an incorrect expectation of automatic Task projection refresh. It now
checks the committed fact and explicit Reload notes behavior.

Independent review strengthened the disposed commit regression with real call
counts and state snapshots. Removing only its entry guard produced a retained
busy-state failure. The diagnostic wrapper expected the later call-count failure
and failed its own matcher; a read-only audit distinguishes that wrapper error
from the successful mutation detection. No rerun was used to erase it. A separate
navigate regression failed on disposed page mutation before the matching guard.

Every attempt remains under `reports/persistence-lifecycle/` or the explicitly
named `reports/pl-c07-*.log`. Source-changing corrections create new identities;
development runs are not frozen-candidate qualification.

## Native and Windows limits

The [new investigation](PERSISTENCE-LIFECYCLE-NATIVE.md) rehashes original reports
and separately audits Appearance, Linux main-renderer errors, Windows production
coverage timeout and archive cleanup EBUSY. Earliest Light versus later Dark
Appearance observations remain different. Driver receipt time is not throw time;
CDP disconnect ends renderer visibility. No original body timeout or orphan is
inferred from EBUSY. All prior candidates, failures and prohibited cleanup residual
remain untouched.

The current native diagnostic snapshot is a bounded production buffer, not an
independent caught-error observer. AC-71 still needs exact native resource/action/
foreign-notice ownership plus that observer before reload. Twenty served browser
cycles and a synthetic foreign DOM sentinel cannot fill those native clauses.

## Remaining work by category

| Category | Concrete remaining scope |
| --- | --- |
| Assertions | Complete each selected case's clauses in each required mode, broader privacy/input bounds, nonempty action registries in served cycles, window/pop-out/partial-startup cleanup. |
| Implementation | Ordered migrations/category-specific recovery are not established; retained Task repository-editor actions need a focused disposal audit; string-length body limit is not a UTF-8 byte guarantee. |
| Environment | AC-71 native resource observer and owned/foreign handles, unresolved Windows/Linux causes, broader native/manual/device qualification. |
| External/owner | Supported nested ESLint dependency graph, onboarding/manual participants and separately authorized repository/release operations. |

No merge, tag, release, publication, listing, permission change or automerge is
performed or authorized by this milestone.
