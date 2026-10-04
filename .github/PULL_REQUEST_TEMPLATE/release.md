<!-- Release pull request: Release cut opens it as a draft from release/X.Y.Z. Paste real output; "not run" needs a reason. -->

## Release summary

- Version: <!-- X.Y.Z -->
- Release branch: <!-- release/X.Y.Z -->
- Cut from main at: <!-- full main commit SHA the branch was cut from -->
- Release head commit: <!-- full SHA that Release qualified and Publish will tag -->

## Changelog section

<!-- Paste the output of `node scripts/release/changelog.mjs notes --version X.Y.Z` unchanged. -->

## Release tier checklist

Each line needs a link to the run or job, or "not run" with the reason.

- [ ] **Release result** is green on the release head commit: <!-- run link -->
- [ ] Release metadata (`node scripts/release/branch.mjs verify --version X.Y.Z`): branch, package/lock/manifest versions, versions.json, changelog section, absent tag
- [ ] Candidate qualification: fixed-source rehearsal, repeated runtime suites, coverage, served browser
- [ ] Native host: three fresh real-Obsidian sessions on the unchanged candidate
- [ ] Cross-OS: every Windows and macOS matrix leg of the called workflows
- [ ] Security audit: candidate qualification's live audit passed (blocking here, informational on pull requests)
- [ ] Starter distribution: separate shell and starter assets built and bound to the release head

## Publication

- Dispatch **Publish** with this version from main once Release result is green. Publish merges this pull request (merge commit), tags `X.Y.Z` on the release head, creates the GitHub release with the changelog section and the candidate assets, then deletes the release branch.
- This pull request is merged by Publish. Do not merge it manually.
- Publication requires the owner's explicit dispatch and the approval of the protected `release` environment's reviewers.

## Untested scope

<!-- What the release tier did not exercise (for example hosts, platforms or manual checks), or "none known". -->
