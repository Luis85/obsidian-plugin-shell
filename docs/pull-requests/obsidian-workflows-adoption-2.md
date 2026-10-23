---
type: PullRequest
id: obsidian-workflows-adoption-2
title: "Obsidian draft-release workflow for generated plugins"
kind: change
increment: obsidian-workflows-adoption
status: New
delivers: [AC-2, AC-3, AC-4, AC-5]
head: "pr/obsidian-workflows-adoption/obsidian-workflows-adoption-2"
base: increment/obsidian-workflows-adoption
---

# Obsidian draft-release workflow for generated plugins

## Summary

Generated GitHub projects get `.github/workflows/obsidian-release.yml`: run manually on a pushed `X.Y.Z` tag, it builds with the pinned npm, places `main.js` and `styles.css` at the root and runs `obsidianmd/obsidian-workflows` v1.2.3 (pinned by SHA) in `release` mode, which validates with the community scanner rules, attests the build and creates a draft release. The job writes only behind the `release` environment; `obsidian-release.yml` joins the privileged-workflow allowlist under the unchanged rules. Delivers AC-2 to AC-5.

## Scope

### In scope

- templates/companion/devkit/workflow-obsidian-release.yml.tmpl, src/shared/companion/schema/hosting.mjs and tooling/quality/workflow-policy.mjs
- Tests pinning the generated workflow set and policy, and acceptance tests AC-2 to AC-5
- docs/development/WORKFLOWS.md, HOSTING-PLATFORMS.md and COMPANION-GENERATOR.md

### Out of scope

- The advisory PR-mode validation step (change pull request 1)
- Creating tags, publishing the draft release, community-list submission and an Azure DevOps equivalent

## Tasks

- [ ] T-1: Add the obsidian-release.yml devkit template and emit it for github hosting
- [ ] T-2: Allowlist obsidian-release.yml in the workflow policy and update the tests that pin the generated workflow set
- [ ] T-3: Implement the AC-2 to AC-5 acceptance tests
- [ ] T-4: Document the generated workflows, the release steps and the release environment

## Documents

- [[docs/increments/obsidian-workflows-adoption|Increment: Adopt the Obsidian community workflows for generated plugins]]

## Notes

## Amendments

<!-- Appended after publication with node bin/app pr amend; each is synced to the pull request body. -->
