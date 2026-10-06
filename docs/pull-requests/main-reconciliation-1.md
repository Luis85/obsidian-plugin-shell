---
type: PullRequest
id: main-reconciliation-1
title: "Reconcile CLI source layout and quality gates"
kind: change
increment: main-reconciliation
status: New
delivers: [AC-1, AC-2]
head: "pr/main-reconciliation/main-reconciliation-1"
base: increment/main-reconciliation
---

# Reconcile CLI source layout and quality gates

## Summary

Moves Workbench CLI development into src/cli and builds a portable bin product with bundled authoring tools, templates and verified runtime assets. Repairs disposed settings actions, manual provenance and project CI aliases; records the Dependabot review and remaining TypeScript configuration approval in docs/development/MAIN-RECONCILIATION.md.

## Scope

### In scope

- CLI layout, demonstrated lifecycle defects, dependency review and quality gates.

### Out of scope

- Product feature expansion and release publication.

## Tasks

- [ ] T-1: Move CLI sources, build and independently execute the standalone distribution, reconcile quality gates and validate dependency decisions.

## Documents

- [[docs/increments/main-reconciliation|Increment: Reconcile main quality gates and Vue lifecycle behavior]]
- [[docs/development/MAIN-RECONCILIATION]]

## Notes

## Amendments

<!-- Appended after publication with node bin/app pr amend; each is synced to the pull request body. -->
