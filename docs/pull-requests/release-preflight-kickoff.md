---
type: PullRequest
id: release-preflight-kickoff
title: "Kick-off: Release preflight before the cut"
kind: kickoff
increment: release-preflight
status: New
head: "increment/release-preflight"
base: main
---

# Kick-off: Release preflight before the cut

## Summary

Carries the increment documents, refines them together until the Definition of Ready passes and, once every change pull request is merged, merges `increment/release-preflight` into `main`.

## Scope

### In scope

- The Increment document [[docs/increments/release-preflight]], its acceptance test stubs and their refinement.

### Out of scope

- Implementation: it lands through change pull requests into `increment/release-preflight`.

## Tasks

- [ ] T-1: Refine the increment until the Definition of Ready passes.
- [ ] T-2: Review the generated acceptance test stubs, one per criterion.

## Documents

- [[docs/increments/release-preflight|Increment: Release preflight before the cut]]

## Notes

## Amendments

<!-- Appended after publication with node bin/app pr amend; each is synced to the pull request body. -->
