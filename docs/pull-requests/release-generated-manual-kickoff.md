---
type: PullRequest
id: release-generated-manual-kickoff
title: "Kick-off: Regenerate the CLI manual in the release commit"
kind: kickoff
increment: release-generated-manual
status: New
head: "increment/release-generated-manual"
base: main
---

# Kick-off: Regenerate the CLI manual in the release commit

## Summary

Carries the increment documents, refines them together until the Definition of Ready passes and, once every change pull request is merged, merges `increment/release-generated-manual` into `main`.

## Scope

### In scope

- The Increment document [[docs/increments/release-generated-manual]], its acceptance test stubs and their refinement.

### Out of scope

- Implementation: it lands through change pull requests into `increment/release-generated-manual`.

## Tasks

- [ ] T-1: Refine the increment until the Definition of Ready passes.
- [ ] T-2: Review the generated acceptance test stubs, one per criterion.

## Documents

- [[docs/increments/release-generated-manual|Increment: Regenerate the CLI manual in the release commit]]

## Notes

## Amendments

<!-- Appended after publication with node bin/app pr amend; each is synced to the pull request body. -->
