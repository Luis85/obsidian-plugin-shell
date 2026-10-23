---
type: PullRequest
id: cli-release-downloads-1
title: "Publish the CLI and starters downloads with each release"
kind: change
increment: cli-release-downloads
status: New
delivers: [AC-1, AC-2, AC-3, AC-4, AC-5]
head: "pr/cli-release-downloads/cli-release-downloads-1"
base: increment/cli-release-downloads
---

# Publish the CLI and starters downloads with each release

## Summary

Publish verifies the `workbench-distributions-<sha>` artifact of the same green Release run (version, source commit, file set, manifest hashes and `workbench-SHA256SUMS`) and uploads `workbench-shell-X.Y.Z.zip`, `workbench-starters-X.Y.Z.zip`, `workbench-distributions.json` and `workbench-SHA256SUMS` after the plugin assets; it refuses before any write when they do not match and resumes without replacing uploaded assets. README and the publish guide describe the download, check and scaffold steps. Delivers AC-1 to AC-5.

## Scope

### In scope

- tooling/release/publish.mjs, publish-discovery.mjs and src/cli/tooling/release/distribution-assets.mjs
- Publish fixtures and tests; acceptance tests AC-1 to AC-5; README and release docs

### Out of scope

- Cutting or publishing 0.5.0, npm packages, a separate CLI version line and the starter fetcher

## Tasks

- [x] T-1: Verify and upload the distribution artifact in Publish (discovery, plan, upload, resume)
- [x] T-2: Refusal and resume tests with the fake remote, and acceptance tests through the real publish CLI
- [x] T-3: Acceptance test of the extracted downloads scaffolding a plugin without node_modules
- [x] T-4: Document the release downloads in the README, publish guide, workflows and CLI reference

## Documents

- [[docs/increments/cli-release-downloads|Increment: Publish the downloadable Workbench CLI with each release]]

## Notes

## Amendments

<!-- Appended after publication with node bin/app pr amend; each is synced to the pull request body. -->
