---
type: PullRequest
id: resource-atlas-project-kickoff
title: "Kick-off: Resource Atlas as the fifth product family project"
kind: kickoff
increment: resource-atlas-project
status: New
head: "increment/resource-atlas-project"
base: main
---

# Kick-off: Resource Atlas as the fifth product family project

## Summary

Delivers the whole increment in one pull request from `increment/resource-atlas-project` into `main`: the increment documents, the Resource Atlas project and prototype, the family update in the other four projects, the root wiring and the acceptance tests. It stacks on #115 (`product-family-projects`), which merges first.

## Scope

### In scope

- The Increment document [[docs/increments/resource-atlas-project]] and its acceptance tests.
- The implementation: `projects/resource-atlas`, `docs/concepts/resource-atlas`, the shared-protocol update in the four other family projects, the synced workflow, Dependabot, indexes and changelog.

### Out of scope

- Separate change pull requests: the increment is small enough to land as one.

## Tasks

- [x] T-1: Refine the increment until the Definition of Ready passes.
- [x] T-2: Review the generated acceptance test stubs, one per criterion.

## Documents

- [[docs/increments/resource-atlas-project|Increment: Resource Atlas as the fifth product family project]]

## Notes

## Amendments

<!-- Appended after publication with node bin/app pr amend; each is synced to the pull request body. -->
