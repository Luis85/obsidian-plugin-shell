---
type: PullRequest
id: publish-stale-hold-kickoff
title: "Kick-off: Re-run the stale release-PR CI hold in Publish"
kind: kickoff
increment: publish-stale-hold
status: New
head: "increment/publish-stale-hold"
base: main
---

# Kick-off: Re-run the stale release-PR CI hold in Publish

## Summary

Carries the increment documents, refines them together until the Definition of Ready passes and, once every change pull request is merged, merges `increment/publish-stale-hold` into `main`.

## Scope

### In scope

- The Increment document [[docs/increments/publish-stale-hold]], its acceptance test stubs and their refinement.

### Out of scope

- Implementation: it lands through change pull requests into `increment/publish-stale-hold`.

## Tasks

- [ ] T-1: Refine the increment until the Definition of Ready passes.
- [ ] T-2: Review the generated acceptance test stubs, one per criterion.

## Documents

- [[docs/increments/publish-stale-hold|Increment: Re-run the stale release-PR CI hold in Publish]]

## Notes

## Amendments

<!-- Appended after publication with node bin/app pr amend; each is synced to the pull request body. -->
