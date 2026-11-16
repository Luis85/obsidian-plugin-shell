---
type: PullRequest
id: release-cut-without-approval-kickoff
title: "Kick-off: Release cut runs without an environment approval; Publish keeps it"
kind: kickoff
increment: release-cut-without-approval
status: New
head: "increment/release-cut-without-approval"
base: main
---

# Kick-off: Release cut runs without an environment approval; Publish keeps it

## Summary

Carries the increment documents, refines them together until the Definition of Ready passes and, once every change pull request is merged, merges `increment/release-cut-without-approval` into `main`.

## Scope

### In scope

- The Increment document [[docs/increments/release-cut-without-approval]], its acceptance test stubs and their refinement.

### Out of scope

- Implementation: it lands through change pull requests into `increment/release-cut-without-approval`.

## Tasks

- [ ] T-1: Refine the increment until the Definition of Ready passes.
- [ ] T-2: Review the generated acceptance test stubs, one per criterion.

## Documents

- [[docs/increments/release-cut-without-approval|Increment: Release cut runs without an environment approval; Publish keeps it]]

## Notes

## Amendments

<!-- Appended after publication with node bin/app pr amend; each is synced to the pull request body. -->
