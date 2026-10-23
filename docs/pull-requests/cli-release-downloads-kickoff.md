---
type: PullRequest
id: cli-release-downloads-kickoff
title: "Kick-off: Publish the downloadable Workbench CLI with each release"
kind: kickoff
increment: cli-release-downloads
status: New
head: "increment/cli-release-downloads"
base: main
---

# Kick-off: Publish the downloadable Workbench CLI with each release

## Summary

Carries the increment documents, refines them together until the Definition of Ready passes and, once every change pull request is merged, merges `increment/cli-release-downloads` into `main`.

## Scope

### In scope

- The Increment document [[docs/increments/cli-release-downloads]], its acceptance test stubs and their refinement.

### Out of scope

- Implementation: it lands through change pull requests into `increment/cli-release-downloads`.

## Tasks

- [ ] T-1: Refine the increment until the Definition of Ready passes.
- [ ] T-2: Review the generated acceptance test stubs, one per criterion.

## Documents

- [[docs/increments/cli-release-downloads|Increment: Publish the downloadable Workbench CLI with each release]]

## Notes

## Amendments

<!-- Appended after publication with node bin/app pr amend; each is synced to the pull request body. -->
