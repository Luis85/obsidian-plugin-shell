# PR35 — journey maintenance and draft recovery

## Baseline and scope

This increment continues IP-06/IP-07/IP-11 from
`ef49ab70e0fafed1968bd5de0922ad3de49ebf04`, whose parents include the current PR5
base `f140c7e89570329fc7ed40ee2d4cb885f4524fc2`. At resumption GitHub already
reported PR35 mergeable. The source artifact from companion run `36410601224`
(artifact `10964540624`) records merge checkout
`a6f67f483df7d94ec112c96cec34633be667428d`. Its raw file tree was independently
reconstructed as `bd7a248379c8debef571e31ef7f9b3d82cc20b15`, exactly the PR35
head tree. No older branch snapshot or TypeScript 5 compiler was substituted.

The existing canonical project, sitemap session, revision guards and public
compiler remain authoritative. This is a browser-authoring increment, not the
separately gated native companion or publication.

## Reproduced problems

Two before-fix controls exercised the actual original editor store with its
retained Vue/Pinia runtime and actual sitemap services:

- Reload replaced an unsaved name with the saved `Companion workbench` label.
- Creating a journey with two actions between the same surfaces silently chose
  `edge-56`, rather than leaving that choice for review.

Both controls failed their intended assertions before the correction. The UI
also had no action to reopen and maintain a saved journey.

## Implementation

**Edit journey** reopens the selected journey as a detached draft. Authors can
rename it, append/remove/reorder steps without dragging, select each surface,
and explicitly select the incoming canonical action. Existing journey and
surviving step IDs remain unchanged. Repeated surfaces, dialog opening and return
steps remain distinct steps; they do not change structural containment.

A new step preselects an action only when one ordinary matching action exists.
Ambiguous alternatives and conditional intents require explicit selection. A
condition remains a planning finding, not an executable predicate. Reordering or
rebinding clears now-invalid incoming actions; it never guesses another branch.
Unresolved saved references retain their identity and last-known labels until
explicitly repaired. Rebinding a retained valid surface can be confirmed through
**Use this surface**. Limits come from the shared sitemap contract.

Apply uses the same canonical session transaction and full-project validation.
It changes one journey, not routes, links, page designs or published component
revisions. Cancel/Escape discard only the draft; Undo/Redo restore exact saved
states. Failed/stale saves retain the draft. While a save is pending, draft
commands, duplicate submission, cancellation and reload cannot start another
write. Reload now uses the existing unsaved-edit guard.

`journey-draft.ts` contains framework-free bounded draft operations. The ephemeral
counter does not appear in exported project JSON. `JourneyFields.vue` provides
explicitly labelled controls inside the existing dialog, not a second shell.

## Verification

Local runtime: Node 22.16.0, npm 10.9.2. The locked dependency installation did not
complete in this environment; direct Git network access also failed DNS lookup.
No global or linked TypeScript 5 was used. **TypeScript 6 checking, rebuilt browser
UI and full verification are not claimed locally.**

| Layer | Observed local result |
| --- | --- |
| Original editor negative controls | Two reproduced assertion failures |
| Complete dependency-free sitemap tests | 99 passed, no skips or TODOs; includes 14 new draft cases |
| Actual editor-store replay | 18 passed, no skips or TODOs; real retained Vue/Pinia and sitemap services, explicit persistence-port doubles |
| Source limits / suite inventory / whitespace | Passed; 295 test files, 31 suites, 32 helpers |
| Browser-driver syntax | Passed; not browser execution |

The store replay used Node's own type erasure and VM module linking rather than
a TypeScript compiler. It is supplementary execution, not a substitute for the
committed test's locked TypeScript 6 path. One initial supplementary harness
invocation had an `index`/`indexOf` typo and did not execute tests; the corrected
replay completed. The installation interruption is not a dependency-install pass.

The existing Companion workflow discovers the new sitemap test, typechecks the
actual SFCs with the repository-local TypeScript 6, rebuilds the integrated HTML,
and runs the expanded file-origin browser driver. New browser assertions cover
opening an existing journey, reordering, deliberate branch selection, exact
Undo/Redo, Cancel/Escape and focus return. These are **pending hosted evidence**
until that candidate's workflow completes. The added screenshot is review evidence,
not an automatically approved visual baseline.

At the baseline head, compiler, companion, native-starter and optional-memory
workflows had passed; core CI and setup policy were still running at inspection.
Those results never qualify a later source commit.

## MVP closure still required

This addresses concrete A05/A06/A07/A09 authoring behavior, not all acceptance.
Full current-candidate onboarding/recovery across supported OSes, generated
companion interaction/visual fidelity and useful sample content, observed author
tasks, manual accessibility/device/scale evidence and real-host starter lifecycle
remain separate obligations. The complete native companion follows the retained
[delivery strategy](../../product/DELIVERY-STRATEGY.md); publication needs separate
approval. See the [improvement plan](../product/PR5-IMPROVEMENT-PLAN.md).
