---
type: PullRequest
id: dependency-advisories-1
title: "Clear the live security audit with in-range updates and one moment override"
kind: change
increment: dependency-advisories
status: New
delivers: [AC-1, AC-2]
head: "pr/dependency-advisories/dependency-advisories-1"
base: increment/dependency-advisories
---

# Clear the live security audit with in-range updates and one moment override

## Summary

Refresh undici to 8.12.3 and fast-uri to 3.1.9 inside their ranges, pin happy-dom 21.0.4 and resolve the moment nested under eslint-plugin-obsidianmd to 2.31.0 through one narrow, reviewed override recorded in the dependency policy, so a fresh install passes the all-category audit. Delivers AC-1 and AC-2.

## Scope

### In scope

- `package.json`: `happy-dom` 21.0.4 and the `obsidian@1.12.3` to `moment` 2.31.0 override; `package-lock.json` refreshed inside existing ranges.
- `tooling/security/dependency-policy.json`: the reviewed `moment` version and the override's reason.
- Acceptance tests AC-1 and AC-2 and the Unreleased changelog entry.

### Out of scope

- Other dependency updates and the ESLint 9 nested-peer exception; porting to `release/0.5.0`.

## Tasks

- [ ] T-1: T-1: Refresh `undici` and `fast-uri` inside their ranges, pin `happy-dom` 21.0.4 and add the narrow `moment` override
- [ ] T-2: T-2: Record the `moment` version and reason in the dependency policy
- [ ] T-3: T-3: Implement the AC-1 and AC-2 acceptance tests and run the security, dependency and check gates

## Documents

- [[docs/increments/dependency-advisories|Increment: Clear the live security audit for 0.5.0]]

## Notes

## Amendments

<!-- Appended after publication with node bin/app pr amend; each is synced to the pull request body. -->
