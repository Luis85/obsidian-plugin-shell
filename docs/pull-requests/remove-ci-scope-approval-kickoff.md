---
type: PullRequest
id: remove-ci-scope-approval-kickoff
title: "Kick-off: Remove the merged ci-scope self-review approval"
kind: kickoff
increment: remove-ci-scope-approval
status: New
head: "increment/remove-ci-scope-approval"
base: main
---

# Kick-off: Remove the merged ci-scope self-review approval

## Summary

Carries the increment documents, refines them together until the Definition of Ready passes and, once every change pull request is merged, merges `increment/remove-ci-scope-approval` into `main`.

## Scope

### In scope

- The Increment document [[docs/increments/remove-ci-scope-approval]], its acceptance test stubs and their refinement.

### Out of scope

- Implementation: it lands through change pull requests into `increment/remove-ci-scope-approval`.

## Tasks

- [ ] T-1: Refine the increment until the Definition of Ready passes.
- [ ] T-2: Review the generated acceptance test stubs, one per criterion.

## Documents

- [[docs/increments/remove-ci-scope-approval|Increment: Remove the merged ci-scope self-review approval]]

## Notes

## Amendments

<!-- Appended after publication with node bin/app pr amend; each is synced to the pull request body. -->
