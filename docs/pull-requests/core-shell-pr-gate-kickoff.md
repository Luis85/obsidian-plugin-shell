---
type: PullRequest
id: core-shell-pr-gate-kickoff
title: "Kick-off: Pull requests run the core shell gate; generators run on their inputs and nightly"
kind: kickoff
increment: core-shell-pr-gate
status: New
head: "increment/core-shell-pr-gate"
base: main
---

# Kick-off: Pull requests run the core shell gate; generators run on their inputs and nightly

## Summary

Carries the increment documents, refines them together until the Definition of Ready passes and, once every change pull request is merged, merges `increment/core-shell-pr-gate` into `main`.

## Scope

### In scope

- The Increment document [[docs/increments/core-shell-pr-gate]], its acceptance test stubs and their refinement.

### Out of scope

- Implementation: it lands through change pull requests into `increment/core-shell-pr-gate`.

## Tasks

- [ ] T-1: Refine the increment until the Definition of Ready passes.
- [ ] T-2: Review the generated acceptance test stubs, one per criterion.

## Documents

- [[docs/increments/core-shell-pr-gate|Increment: Pull requests run the core shell gate; generators run on their inputs and nightly]]

## Notes

## Amendments

<!-- Appended after publication with node bin/app pr amend; each is synced to the pull request body. -->
