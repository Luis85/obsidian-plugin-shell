# Release: refusals, uncertain runs and recovery

Release cut and Publish are idempotent: each step reads remote state first and is skipped when it is already done. Rerunning the same version resumes. Ask the user before every rerun.

## Exit codes (`cut.mjs`, `publish.mjs` and the workflow logs)

| Exit | Meaning | What to do |
| --- | --- | --- |
| 0 | Done, or planned in a preview. | Continue or verify. |
| 1 | Refused before any remote write, or blocked in a preview. | Read the code, fix the cause through the normal path, dispatch again. |
| 2 | Uncertain: a remote write may or may not have happened. | Inspect state first (below), then rerun the same version. Never retry a different way. |

## Common refusals

| Code | Cause | Fix |
| --- | --- | --- |
| `CUT_NOT_ON_BASE`, `CUT_TREE_NOT_CLEAN`, `CUT_BASE_NOT_CURRENT` | The preview ran off `main`, on a dirty tree or a stale `main`. | Switch to an up-to-date clean `main`. |
| `CUT_BRANCH_EXISTS`, `CUT_TAG_EXISTS` | `release/X.Y.Z` or tag `X.Y.Z` exists. | Resume the existing branch, or choose a new version; never delete a tag. |
| `VERSION_NOT_NEW` | The version is not above `package.json`. | Choose a higher version. |
| `RELEASE_NOTES_EMPTY` | `## [Unreleased]` has no entries. | Add entries through an ordinary pull request. |
| `RELEASE_PR_NOT_FOUND`, `RELEASE_PR_AMBIGUOUS` | No, or more than one, open pull request from `release/X.Y.Z` to `main`. | Leave exactly one; ask the owner. |
| `RELEASE_RESULT_MISSING`, `RELEASE_RESULT_NOT_GREEN` | The Release tier did not finish or failed on this commit. | Wait, or fix forward. |
| `SOURCE_NOT_ON_DEFAULT_BRANCH` | A merged pull request's head is not on `main`. | Stop and ask the owner; never tag it. |
| `PUBLISH_LOCKED` | A local lock from another publish exists. | Confirm no publish is running, then the owner removes that lock. |
| `CUT_REMOTE_BRANCH_DIVERGED` | `origin/release/X.Y.Z` differs from the local cut. | Inspect; it is never force-pushed. |

## Before rerunning an uncertain Publish

Check, in this order, and report each:

1. The release pull request: merged, or still open (draft or ready)?
2. `main`: does it contain the release head (`git merge-base --is-ancestor <sha> origin/main`)?
3. Tag `X.Y.Z`: absent, or pointing at the release head? A tag at any other commit is a stop: ask the owner.
4. The GitHub release `X.Y.Z`: absent, draft with missing assets, or published? A published release is immutable.
5. The branch `release/X.Y.Z`: still at the head, or deleted?

Then, with confirmation, dispatch Publish again for the same version. It skips finished steps, completes a partial draft release by uploading only missing assets, and never replaces an asset.

## Branch protection refuses the merge

A merge refused by branch protection is reported as uncertain (exit 2). Common causes: a required approving review, or a red or missing latest "CI result" (or "Definition of Ready"/"Definition of Done" alias) on the head because the Release tier had not succeeded on that commit yet. The owner approves the pull request, waits for or reruns the Release workflow, or provides `RELEASE_TOKEN`; then Publish is dispatched again.

## Conflicts with main

When `main` gained `## [Unreleased]` entries after the cut, the release pull request can conflict in `CHANGELOG.md`. Stop and ask the owner: either cut a new, higher version from the new `main`, or merge `main` into the release branch (which then ships those changes; their entries move into the `[X.Y.Z]` section) and let Release rerun.
