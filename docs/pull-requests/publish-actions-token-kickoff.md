---
type: PullRequest
id: publish-actions-token-kickoff
title: "Kick-off: Let Publish run with the built-in Actions token"
kind: kickoff
increment: publish-actions-token
status: New
head: "increment/publish-actions-token"
base: main
---

# Kick-off: Let Publish run with the built-in Actions token

## Summary

Carries the increment documents, refines them together until the Definition of Ready passes and, once every change pull request is merged, merges `increment/publish-actions-token` into `main`.

## Scope

### In scope

- The Increment document [[docs/increments/publish-actions-token]], its acceptance test stubs and their refinement.

### Out of scope

- Implementation: it lands through change pull requests into `increment/publish-actions-token`.

## Tasks

- [ ] T-1: Refine the increment until the Definition of Ready passes.
- [ ] T-2: Review the generated acceptance test stubs, one per criterion.

## Documents

- [[docs/increments/publish-actions-token|Increment: Let Publish run with the built-in Actions token]]

## Notes

## Amendments

<!-- Appended after publication with node bin/app pr amend; each is synced to the pull request body. -->
