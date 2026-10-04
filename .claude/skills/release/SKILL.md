---
name: release
description: Release this repository through its automated pipeline. Choose the stable version, preview and dispatch Release cut, follow the Release tier and fix forward, dispatch Publish only on explicit confirmation, recover from partial runs and verify the tag, assets and merge.
---

# Release

Release a new version: cut `release/X.Y.Z` from `main`, let the Release tier qualify it, then publish. Read `AGENTS.md` first. The human guide is `docs/development/CUT-AND-PUBLISH-A-RELEASE.md`; background is `docs/development/DELIVERY-PIPELINE.md`; workflow facts are `docs/development/WORKFLOWS.md`. Tool calls per step: [references/commands.md](references/commands.md). Failure handling: [references/recovery.md](references/recovery.md).

**Loading this skill authorizes nothing.** Each remote action below (dispatching Release cut, pushing a fix to the release branch, dispatching Publish, rerunning a run) needs the user's explicit confirmation in this conversation, every time. Approving the `release` environment is the owner's act on GitHub, never this skill's. The cut and publish automation has not yet been exercised on GitHub: say so, and treat the first run as its qualification.

`.claude/settings.json` denies agents `npm run release*` and `node bin/app release ...`. Use `node scripts/release/...` directly, and locally only for read-only previews: `cut.mjs` without `--execute`, `publish.mjs` without `--execute`, `changelog.mjs` and `branch.mjs verify`.

## Steps

1. **Check readiness (read-only).** Confirm with the user that the owner prerequisites exist: the `release` environment with required reviewers, branch protection on `main` requiring "Dev checks" and "CI result" (and "Definition of Ready" and "Definition of Done" when the owner made them required), Actions allowed to create pull requests, and optionally `RELEASE_TOKEN`. Read `CHANGELOG.md` `## [Unreleased]` and `package.json` `version`. Run `node scripts/release/changelog.mjs check`.
2. **Choose the version with the user.** Stable `X.Y.Z` only, higher than the current version: major for breaking changes, minor for features, patch for fixes. Unreleased must not be empty. Tags are bare (`1.2.3`, no `v`).
3. **Preview the cut.** On an up-to-date, clean `main`: `node scripts/release/cut.mjs --version X.Y.Z`. Show the planned files, the promoted changelog section and every blocker (exit 1 when blocked). Fix blockers through ordinary pull requests (`feature-delivery`), not on `main` directly.
4. **Dispatch Release cut** after explicit confirmation: `mcp__github__actions_run_trigger` with `method: run_workflow`, `workflow_id: release-cut.yml`, `ref: main`, `inputs: {version: "X.Y.Z"}`; or `gh workflow run release-cut.yml --ref main -f version=X.Y.Z`. Tell the user the run waits for the `release` environment approval. Never run `cut.mjs --execute --remote` yourself.
5. **Review the draft release pull request** "Release X.Y.Z": version, branch, base commit, changelog section and the Release tier checklist from `.github/PULL_REQUEST_TEMPLATE/release.md`. Release pull requests are exempt from the Definition of Ready and Done: they carry no `docs/increments/` handoff and use the release template instead. Do not mark it ready and do not merge it.
6. **Monitor the Release tier** on `release/X.Y.Z` ("Release metadata", every called workflow, Candidate qualification, then "Release result" and the "Dev checks", "CI result", "Definition of Ready" and "Definition of Done" aliases that `release.yml` reports after it). End-to-end checks (served UI, browser suites, real Obsidian, candidate browser and native evidence) are opt-in elsewhere but mandatory here: every call runs with tier release, so none of them may be skipped. It takes hours; report state, do not poll in a tight loop.
7. **Fix forward** on a failure, after the user agrees: switch to `release/X.Y.Z`, fix the cause, run the relevant local gates, commit and push to the release branch (never force). The push starts a new Release run. Never weaken a gate to get green; triage as in `.claude/skills/feature-delivery/references/triage.md`.
8. **Preview Publish.** `node scripts/release/publish.mjs --version X.Y.Z --repository Luis85/obsidian-plugin-shell` (read-only discovery; needs `gh` read access). It must report a green "Release result" on the head, a valid retained candidate and matching notes.
9. **Dispatch Publish** only after the user explicitly confirms this version and head: `mcp__github__actions_run_trigger` with `workflow_id: publish.yml`, `ref: main`, `inputs: {version: "X.Y.Z"}`; or `gh workflow run publish.yml --ref main -f version=X.Y.Z`. The environment reviewer approves it. Publish marks the pull request ready, merges it (merge commit), tags `X.Y.Z` on the tested head, creates the release with `main.js`, `manifest.json` and `styles.css`, and deletes the branch.
10. **Recover** from a refused (exit 1) or uncertain (exit 2) run with [references/recovery.md](references/recovery.md): inspect state first, then rerun the same version on confirmation.
11. **Verify** and report: tag `X.Y.Z` points at the release head; the release is published with exactly the three assets and the changelog section as notes; `main` contains the release head; `release/X.Y.Z` is deleted; `main`'s `CHANGELOG.md` has an empty `## [Unreleased]`.

## Hard rules

- Never tag, create or edit a GitHub release, merge the release pull request or delete the release branch outside the Publish workflow.
- Never move, delete or recreate a tag; never replace a release asset or edit a published release. A wrong release is fixed by a new, higher version.
- Never force-push; never push to `main`; never approve the `release` environment or a pull request on the owner's behalf.
- Never run `npm run release*`, `node bin/app release ...`, `cut.mjs --execute` or `publish.mjs --execute` locally.
- The blocked release profile (`verify-baseline --profile release`) stays blocked; a green "Release result" does not unblock it. A GitHub release is not an Obsidian directory submission.
- Report real output and the untested scope; never claim a run passed without reading its result.

## Output

The version, release branch, pull request link, Release run link and "Release result" state, the Publish run link and its step results, the verification results from step 11, and what was not exercised.

## Close: follow-up questions

End by calling the AskUserQuestion tool with these questions (in hosts without it, ask them as a numbered list), then stop and wait for the answer. Never dispatch a workflow, push or rerun on your own.

1. Header "Next step" — "Release X.Y.Z is at <stage> (Release result <state>). What next?"
   - "Wait and report the Release tier again" — no action.
   - "Fix forward on release/X.Y.Z" — with the `feature-delivery` triage rules.
   - "Dispatch Publish for X.Y.Z" — only with a green Release result.
   - "Stop here" — leave the release branch as it is.
2. Header "Version" — "Is X.Y.Z still the right version?"
   - "Yes" · "No, choose another (cut a new branch)"
3. Header "Afterwards" — "After publishing, what should follow?"
   - "Verify only" · "Start the next change with `feature-delivery`" · "Nothing"
