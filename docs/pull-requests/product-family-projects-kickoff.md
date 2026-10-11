---
type: PullRequest
id: product-family-projects-kickoff
title: "Kick-off: Obsidian Product Family prototypes as standalone projects"
kind: kickoff
increment: product-family-projects
status: New
head: "increment/product-family-projects"
base: main
---

# Kick-off: Obsidian Product Family prototypes as standalone projects

## Summary

Delivers the whole increment in one pull request from `increment/product-family-projects` into `main`: the increment documents, the four standalone projects, the delivered prototypes, the root wiring and the acceptance tests. It replaces draft #114, which carried the same change from another branch.

## Scope

### In scope

- The Increment document [[docs/increments/product-family-projects]] and its acceptance tests.
- The implementation: `projects/component-atlas`, `projects/storyloom`, `projects/sitemap-atlas` and `projects/dissect-canvas`, the prototypes in `docs/concepts/`, the synced workflows, Dependabot entries, indexes and changelog.

### Out of scope

- Separate change pull requests: the increment is small enough to land as one.

## Tasks

- [x] T-1: Refine the increment until the Definition of Ready passes.
- [x] T-2: Review the generated acceptance test stubs, one per criterion.

## Documents

- [[docs/increments/product-family-projects|Increment: Obsidian Product Family prototypes as standalone projects]]

## Notes

## Amendments

<!-- Appended after publication with node bin/app pr amend; each is synced to the pull request body. -->
