# Journey Lens workspace — recovery and interaction polish

## Source and scope

This pass continues PR35 from `007062a6ddd09fa7eb6f341c5209d7e91f027b04`
(tree `9dc045478c84444694e6e00da2da9bd1b10e228c`). The retained source archive
from run `36539494872`, artifact `11019588844`, was reconstructed byte-for-byte
before editing. The existing PR5/main ancestry, dependency lock, compiler goldens,
quality floors and publication boundaries remain unchanged.

The maintained editor is still the source for native and generated browser views.
This is a bounded file-workspace refinement, not a replacement editor or a claim
that the complete native Companion has been accepted.

## CI defects addressed

The current authoring and independently generated native-project typechecks both
stop at `use-editor.ts` with TS18046. Recovery validation narrowed a mutable record
property, then read that property inside a callback. A stable local reference now
retains the validated narrowing; all existing runtime rejection checks still run.
No cast or compiler downgrade substitutes for the missing type refinement.

The previously delivered generated persistence regression is now included. The
emitted acceptance case reads `session.snapshot()` after loading instead of
issuing another untracked document read that invalidates its own save revision.
Its regression executes the actual emitted case with the real document/session
owners and an explicitly identified assertion adapter, not a copy of the sequence.
The before-change execution passed seven cases and failed that emitted case with
`conflict` rather than the expected `committed` result.

The native workflow also selects `COMPANION_QUALIFICATION_ROOT=/tmp`. Its driver
reads that explicit override ahead of the normal runner temporary root. The prior
attempt redefined GitHub's reserved RUNNER_TEMP variable and generated under the
long runner path instead, failing evidence collection's short-root containment
check. Existing target containment and pipefail behavior remain enforced; this
change does not broaden where the native test can execute.

## Workspace improvements

- The active file is shown separately from the editable destination. A failed open
  or typing another path cannot make the current editor appear to edit that file.
  Export saved project is directly available, including before explicit recovery.
- Import reviews are invalidated as soon as a new file is selected, including an
  oversized or unreadable file. Pending reads are visible and cannot be approved.
  Typing/pasting or cancelling invalidates the read token so late bytes cannot
  overwrite the newer import draft.
- Each write approval is consumed once. A refused or uncertain import cannot be
  silently resubmitted. External edits clear approval while retaining draft text.
- Recovery names the actual failed import destination, even when a different file
  was previously open. It no longer recovers the unrelated current file after an
  uncertain create at a second path. An editor's pending save blocks replacement,
  recovery reload and cancellation while preserving independent draft ownership.
- Import/recovery use one review panel at a time. Cancelling recovery returns to
  a retained, unapproved import. The underlying editor is inert during review and
  workspace operations; review focus, Escape cancellation and opener focus return
  are handled explicitly. No focus-trapping modal is added for an inline panel.
- Late mount completion after view disposal cannot install subscriptions or
  remember another path. Download URLs are released on completion or teardown,
  including a failed click. Stored data is not deleted during cleanup.
- Controls retain the existing Nuxt UI/Obsidian tokens, with 36px minimum height,
  bounded input widths, readable wrapping paths and narrow-toolbar reflow. These
  changes do not certify mobile or assistive-technology support.

Unexported drafts remain in-memory, not crash-persistent. Export returns the last
validated project snapshot held by this view, not an unreviewed external edit.
Page/component/source editor implementation is outside this pass.

## Executed local evidence

Local Node is 22.16.0, not the qualified Node 24.21.0. Locked TypeScript 6 and the
full Vue/Nuxt build cannot be installed in this environment. For supplementary
workspace/store execution only, a local loader uses Node type erasure and fixed
import linking with the retained Vue/Pinia runtimes. It is not TypeScript, is not
committed into the project, and is never claimed as a typecheck. The committed
tests continue to use the repository-local TypeScript package on hosted runners.

| Check | Observed result |
| --- | --- |
| Pre-change workspace controls | 9 existing passed, 10 added controls failed; some fail because the new API is absent |
| Workspace lifecycle/import/recovery/keyboard/download checks | 20 passed; real composable and Vue lifecycle with explicit DOM/editor/file-port doubles |
| Actual editor store replay | 21 passed; real retained Vue/Pinia and canonical session |
| Compiler compatibility and editor generation | 27 passed; includes the executed emitted persistence case and scratch-root wiring check |
| Authoring, project owner, maintenance and journey-draft contracts | 44 passed |
| Source limits, test-suite inventory and whitespace | Passed; 309 test files, 32 suites, 32 helpers |
| Expanded browser driver and workflow syntax | Parsed; not browser or native execution |
| Compiler architecture attempt | Failed to start because the locked TypeScript dependency was unavailable |

Runs overlap and must not be added together. The first post-change workspace run
failed because its DOM double lacked the newly used focus lookup, and its pending
save control exposed cached state in an action guard. The double now models that
DOM method; action guards query the actual pending state rather than a cached UI
projection. Those failures remain recorded, not counted as passing runs.

## Hosted and manual exits

The real generated-browser suite now checks active-file identity, review focus,
editor inertness, file-selection approval invalidation, Escape/focus return,
explicit recovery destination and 375px toolbar containment, retaining a narrow
screenshot. These are added assertions, not an executed local browser result.

Fresh current-head TypeScript 6, analyzer, full build, generated/browser and native
file-lifecycle checks must pass independently. The before-change head's core CI
and dedicated compiler passes do not qualify new source; its cancelled setup run
is not a pass. Manual accessibility/device/multi-window qualification and remaining
MVP obligations stay open in [the closure map](MVP-CLOSURE-STATUS.md). No release,
tag, PR merge, personal-vault operation or blanket issue closure occurred.

## Hosted follow-up at the published polishing commit

The pass was pushed as `7433f7c5018d760b0c3aa33bb3b3a79aa6ad3d1d`.
Its authoring typecheck and authoring build passed in job `109336549314`.
Native job `109336549447` (run `36547268350`, retained artifact `11022943109`)
then independently built and typechecked the generated consumer, including the
corrected persistence test, but failed its mounted workbench test with
`ReferenceError: production is not defined`. Native host execution did not start.

The retained Flow IIFE contains one unquoted environment token. The existing
Python offline assembler already replaces this exact diagnostic expression with
a production string literal; the generated module adapter had omitted that
adaptation. It now applies the identical single-occurrence substitution after
verifying the unchanged vendor SHA-256. No new global, vendor-byte change,
warning suppression or broader runtime replacement is introduced.

A new executable control creates and destroys a real retained Flow store and
stops its owning Vue effect scope. The old adapter fails in its diagnostic path;
with the correction all five Flow adapter/stylesheet/notices/tamper tests pass.
The combined compiler compatibility, editor generation and Flow run passes 32
cases, including the prior 27 rather than an additional independent total.
This exercises retained runtime ownership, not a full DOM or native host.
Fresh combined-source hosted qualification is still required; the failed run is
retained and is not relabelled successful.
