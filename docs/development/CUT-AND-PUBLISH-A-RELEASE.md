# Cut and publish a release

> Type: how-to · Part of the [docs index](../README.md)

Release a new version of this repository: cut `release/X.Y.Z` from `main`, let the
Release tier qualify it, then publish. Publish merges the release pull request,
tags `X.Y.Z`, creates the GitHub release with the plugin assets and deletes the
branch. Background is in [Delivery pipeline](DELIVERY-PIPELINE.md); workflow facts
are in [GitHub Actions workflows](WORKFLOWS.md). Agents follow the `release` skill
(`.claude/skills/release/SKILL.md`).

**Status:** the cut and publish scripts and workflows are implemented and tested
against fakes. They have not yet been exercised on GitHub; treat the first release
as the qualification run and keep its logs.

## Prerequisites (owner, once)

- **Release environment.** Settings → Environments → create `release` and add
  required reviewers. Create it before the first dispatch: GitHub creates a missing
  environment on first use without protection. Optionally restrict it to the
  `main` branch.
- **Branch protection on `main`.** Require the status checks "Dev checks" and
  "CI result". Do not require "Release result"; it never runs on ordinary pull
  requests.
- **Actions settings.** Settings → Actions → General → allow GitHub Actions to
  create and approve pull requests, so Release cut can open the draft release pull
  request with `GITHUB_TOKEN`.
- **Optional `RELEASE_TOKEN` secret.** A fine-grained token (or GitHub App token)
  with contents, pull requests and actions write on this repository. Add it when
  the cut's push and pull request should start the normal workflows, or when branch
  protection does not let `GITHUB_TOKEN` merge (for example a required approving
  review that only the owner can satisfy).
- **Locally:** the GitHub CLI (`gh`) authenticated for read access if you want the
  dry runs below.

## 1. Choose the version

Use a stable semantic version `X.Y.Z`, higher than the `version` in
`package.json` (pre-release suffixes are refused; `VERSION_NOT_NEW` otherwise).
Read `## [Unreleased]` in `CHANGELOG.md`: breaking changes need a major, new
features a minor, fixes only a patch. Unreleased must not be empty; add the
missing entries through an ordinary pull request first.

Avoid merging user-facing pull requests into `main` between the cut and Publish.
A new `[Unreleased]` entry on `main` makes the release pull request conflict in
`CHANGELOG.md`.

## 2. Preview the cut (optional, read-only)

On an up-to-date `main` checkout with a clean tree:

```sh
git switch main && git pull --ff-only
node scripts/release/cut.mjs --version X.Y.Z
```

The dry run prints the planned branch, the files release preparation changes
(`package.json`, `package-lock.json`, `manifest.json`, `versions.json`,
`CHANGELOG.md`), the promoted changelog section and every blocker
(`CUT_NOT_ON_BASE`, `CUT_TREE_NOT_CLEAN`, `CUT_BASE_NOT_CURRENT`,
`CUT_BRANCH_EXISTS`, `CUT_TAG_EXISTS`, `VERSION_NOT_NEW`, ...). It exits 1 when
blocked and writes nothing.

## 3. Cut the release branch

Dispatch **Release cut** from `main`:

- GitHub UI: Actions → Release cut → Run workflow → branch `main`, version `X.Y.Z`.
- GitHub CLI: `gh workflow run release-cut.yml --ref main -f version=X.Y.Z`.

A reviewer of the `release` environment approves the run. The job creates
`release/X.Y.Z` from `main`, commits `release: X.Y.Z` with the prepared metadata,
pushes it, opens the draft pull request "Release X.Y.Z" from
`.github/PULL_REQUEST_TEMPLATE/release.md` and dispatches the Release workflow on
the branch. Its log is retained as the `release-cut-X.Y.Z-<attempt>` artifact.

The same steps run locally from a clean `main`, with your own `gh` login:
`node scripts/release/cut.mjs --version X.Y.Z --execute` creates the branch and
commit only (review it), and adding `--remote` pushes, opens the pull request and
dispatches Release. Prefer the workflow, so the approval is recorded.

## 4. Review the release pull request

Open the draft "Release X.Y.Z" pull request. Its body states the version, branch,
base commit, the changelog section and the Release tier checklist. Fill each
checklist line with a link to the run or job, and the untested scope. Leave it as a
draft; Publish marks it ready. Marking it ready earlier is harmless but pointless:
`ci.yml`'s "CI result" on a release head passes only once "Release result" succeeded
on that commit.

## 5. Watch the Release tier

The Release workflow runs on `release/X.Y.Z`: "Release metadata", every
pull-request workflow with `tier: release`, and Candidate qualification. It takes
hours. Watch it under Actions → Release, or `gh run list --workflow release.yml
--branch release/X.Y.Z` and `gh run watch <run-id>`.

When it finishes, "Release result" and the aliases "Dev checks" and "CI result"
report on the release head. Without `RELEASE_TOKEN` these are the only checks on
the pull request.

## 6. Fix forward on the release branch

When a Release job fails, fix it on the release branch, not on `main` first:

```sh
git fetch origin
git switch release/X.Y.Z
# fix, run the relevant local gates, commit
git push origin release/X.Y.Z
```

The push starts a new Release run that supersedes the previous one. Keep fixes
small and update the `[X.Y.Z]` changelog section if the fix is user-facing. The fix
reaches `main` when Publish merges the release. A cause outside the change (a
runner or registry outage) can be rerun from the Actions page instead.

## 7. Publish

Preview first. This is read-only discovery through `gh` and reports what Publish
would do:

```sh
node scripts/release/publish.mjs --version X.Y.Z --repository Luis85/obsidian-plugin-shell
```

It refuses (exit 1) unless one open pull request from `release/X.Y.Z` targets
`main`, its head has a green "Release result", the branch head is that commit, the
successful Release run of that commit retained a valid candidate
(`qualified-candidate` or `retained-build`) with matching hashes, and the release
notes equal the changelog section.

Then dispatch **Publish** from `main`:

- GitHub UI: Actions → Publish → Run workflow → branch `main`, version `X.Y.Z`.
- GitHub CLI: `gh workflow run publish.yml --ref main -f version=X.Y.Z`.

After the `release` environment approval, Publish marks the pull request ready,
merges it with a merge commit pinned to the tested head, creates tag `X.Y.Z` at
that commit, creates the GitHub release (draft, uploads `main.js`,
`manifest.json` and `styles.css`, publishes it as latest) and deletes
`release/X.Y.Z`. Its log is retained as `publish-X.Y.Z-<attempt>`.

## 8. Resume after a partial failure

Publish and the cut are idempotent: each step reads remote state first and skips
what is done. The exit code tells you what to do next.

| Exit | Meaning | Next step |
| --- | --- | --- |
| 0 | Done (or planned, for a dry run). | Verify (step 9). |
| 1 | Refused before any write (missing check, wrong head, invalid candidate, `PUBLISH_LOCKED`, ...). | Fix the reported cause, then dispatch again. |
| 2 | Uncertain: a remote write may or may not have taken effect. | Inspect the pull request, tag `X.Y.Z` and the release on GitHub, then dispatch the same version again; it resumes from the first unfinished step. |

`PUBLISH_LOCKED` names a lock directory; remove it only after confirming no other
publish is running. A merge refused by branch protection reports exit 2: satisfy
the protection rule (or provide `RELEASE_TOKEN`) and rerun.

## 9. Verify the release

- The tag exists at the release head: `git fetch --tags origin` and
  `git rev-parse X.Y.Z^{commit}` equal the head the pull request showed.
- The GitHub release `X.Y.Z` is published (not draft) with exactly `main.js`,
  `manifest.json` and `styles.css`, and its notes are the changelog section:
  `gh release view X.Y.Z`.
- `main` contains the release head: `git merge-base --is-ancestor X.Y.Z origin/main`.
- `release/X.Y.Z` is gone: `git ls-remote --heads origin release/X.Y.Z` prints nothing.
- On `main`, `CHANGELOG.md` has an empty `## [Unreleased]` above `## [X.Y.Z]`, and
  the next change adds its entries there.

## What not to do

- Do not merge the release pull request manually; Publish merges the tested head
  and tags it in one resumable sequence.
- Do not create, move or delete tags by hand, and do not force-push a release branch.
- Do not edit or delete a published release or replace its assets. A wrong release
  is corrected by a new, higher version.
- Do not dispatch Publish for a version whose "Release result" is not green on the
  current head; it refuses, and that refusal is the safeguard.
- Do not treat a published release as an Obsidian community directory submission;
  that remains a separate owner decision
  ([maintenance and release](MAINTENANCE-AND-RELEASE.md#8-first-community-directory-submission)).
