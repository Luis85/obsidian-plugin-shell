---
type: PullRequest
id: reusable-workflow-permissions-kickoff
title: "Kick-off: Guard reusable-workflow calls against permission escalation"
kind: kickoff
increment: reusable-workflow-permissions
status: New
head: "increment/reusable-workflow-permissions"
base: main
---

# Kick-off: Guard reusable-workflow calls against permission escalation

## Summary

Carries the increment documents, refines them together until the Definition of Ready passes and, once every change pull request is merged, merges `increment/reusable-workflow-permissions` into `main`.

## Scope

### In scope

- The Increment document [[docs/increments/reusable-workflow-permissions]], its acceptance test stubs and their refinement.

### Out of scope

- Implementation: it lands through change pull requests into `increment/reusable-workflow-permissions`.

## Tasks

- [ ] T-1: Refine the increment until the Definition of Ready passes.
- [ ] T-2: Review the generated acceptance test stubs, one per criterion.

## Documents

- [[docs/increments/reusable-workflow-permissions|Increment: Guard reusable-workflow calls against permission escalation]]

## Notes

## Amendments

<!-- Appended after publication with node bin/app pr amend; each is synced to the pull request body. -->
