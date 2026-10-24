---
type: PullRequest
id: obsidian-workflows-adoption-1
title: "Advisory Obsidian community validation in generated CI"
kind: change
increment: obsidian-workflows-adoption
status: Merged
delivers: [AC-1]
head: "pr/obsidian-workflows-adoption/obsidian-workflows-adoption-1"
base: increment/obsidian-workflows-adoption
platform: github
repository: "Luis85/obsidian-plugin-shell"
number: 213
url: "https://github.com/Luis85/obsidian-plugin-shell/pull/213"
publishedAt: 2026-10-23T19:20:20Z
lastSyncedAt: 2026-10-24T08:50:48Z
---

# Advisory Obsidian community validation in generated CI

## Summary

Generated GitHub projects run the official Obsidian community-directory validation (`obsidianmd/obsidian-workflows` v1.2.3, pinned by SHA) in `pr` mode as an advisory step of their CI `check` job, after `verify:artifacts` has built `dist/`. Delivers AC-1.

## Scope

### In scope

- templates/companion/devkit/workflow-ci.yml.tmpl: pr-mode validation step in the check job, pinned to v1.2.3, advisory
- tests/acceptance/obsidian-workflows-adoption/ac-1.checks.mjs

### Out of scope

- The release workflow, the workflow-policy change and the docs (AC-2 to AC-5, second change pull request)
- The shell's own workflows and Azure DevOps or none hosting

## Tasks

- [x] T-1: Add the advisory obsidianmd/obsidian-workflows step to the generated CI template
- [x] T-2: Implement the AC-1 acceptance test against compiled github-hosting projects

## Documents

- [[docs/increments/obsidian-workflows-adoption|Increment: Adopt the Obsidian community workflows for generated plugins]]

## Notes

## Amendments

<!-- Appended after publication with node bin/app pr amend; each is synced to the pull request body. -->
