---
type: Increment
id: dependency-advisories
title: "Clear the live security audit for 0.5.0"
owner: "Claude"
size: S
status: Done
e2e: none
refs: []
pullRequests: [dependency-advisories-kickoff, dependency-advisories-1]
issues: [dependency-advisories]
branch: "increment/dependency-advisories"
base: main
---

# Clear the live security audit for 0.5.0

<!-- Developer handoff for one pull request. `npm run dor` checks it before implementation,
`npm run dod` after it. Replace every <placeholder>; delete these comments when done. -->

## Summary

The live all-category security audit (`npm run check:security`) fails on the committed lockfile: six advisories were published against `undici` 8.11.0, `fast-uri` 3.1.8, `happy-dom` 21.0.3 and `moment` 2.29.4. It blocks Candidate qualification, so release 0.5.0 cannot qualify. Three have fixes inside the existing version ranges; `moment` 2.29.4 is pinned exactly by the `obsidian@1.12.3` type package that `eslint-plugin-obsidianmd` 0.4.2 (the latest release) nests, so it needs one narrow, reviewed override. The same change is then ported to `release/0.5.0`.

## Outcome

A fresh `npm ci` of the committed lockfile passes `npm run check:security` with every installed dependency category, and `npm run check:dependencies` records and enforces the reviewed `moment` override, so Candidate qualification of 0.5.0 can pass its security gate.

## Scope

### In scope

- Lockfile refresh inside existing ranges: `undici` 8.12.3 (via `unifont` `^8.0.0`) and `fast-uri` 3.1.9 (via `ajv` `^3.0.1`).
- The exact dev pin `happy-dom` 21.0.3 to 21.0.4.
- One narrow override `obsidian@1.12.3` to `moment` 2.31.0 (the version the direct `obsidian` 1.14.4 already uses), with its reason and the `moment` version recorded in `tooling/security/dependency-policy.json`.

### Out of scope

- Other dependency updates, broader overrides or a forced `eslint-plugin-obsidianmd` downgrade.
- The ESLint 9 nested-peer exception of `docs/development/ITERATION-TWO-DEPENDENCY-EXCEPTION.md`.
- Porting to `release/0.5.0` and publishing 0.5.0, which follow with the `release` skill.

## Acceptance criteria

<!-- One `- [ ] AC-n: text` per criterion. At completion tick it and add
`Evidence: \`path\`` (a test file, doc or report that exists). -->

- [x] AC-1: Given the committed `package-lock.json`, every installed `undici`, `fast-uri`, `happy-dom` and `moment` resolves outside the advisory ranges (undici 8.0.0-8.12.1, fast-uri 3.0.0-3.1.8, happy-dom 17.0.0-21.0.3, moment 2.29.2-2.30.1), and a fresh install passes `npm run check:security`. Evidence: `tests/acceptance/dependency-advisories/ac-1.checks.mjs`
- [x] AC-2: `package.json` overrides hold exactly the reviewed `fontless@0.2.1` and `obsidian@1.12.3` entries, `tooling/security/dependency-policy.json` pins `moment` 2.31.0 and records the reason, and `npm run check:dependencies` passes on the installed graph. Evidence: `tests/acceptance/dependency-advisories/ac-2.checks.mjs`

## Affected areas

<!-- One backticked repository path or glob per line; new files must sit under an allowed root. -->

- `package.json`: the `happy-dom` pin and the `moment` override.
- `package-lock.json`: the refreshed resolutions.
- `tooling/security/dependency-policy.json`: the reviewed `moment` version and reason.
- `tests/acceptance/dependency-advisories/`: the acceptance tests.
- `CHANGELOG.md`: the Unreleased entry.
- `docs/increments/dependency-advisories.md`: this handoff.
- `docs/pull-requests/`: the kick-off and change pull request records.
- `docs/issues/`: the increment issue.

## Test plan

<!-- Lines: - Suite `name`: …  - Gate `command`: …  - New test `tests/…`: …
     - No test change — reason   - E2E: reason for the e2e decision in the frontmatter -->

- Suite `acceptance`: one acceptance test per criterion reading the committed lockfile, `package.json` and the dependency policy.
- Gate `npm run check:security`: the live all-category audit after a fresh `npm ci`.
- Gate `npm run check:dependencies`: the reviewed versions, sources and the fontless transform.
- Gate `npm run check`: types, lint and tests, including the happy-dom component tests on 21.0.4.
- Gate `node tooling/testing/suites.mjs --check`: the new test files have a suite and level.
- Gate `node src/cli/tooling/release/changelog.mjs check`: the Unreleased entry.
- E2E: none; no runtime, UI or served code changes, only dev and transitive dependency versions.

## Docs impact

<!-- - `docs/path.md` (how-to): what changes   — or —   None — reason -->

- None — dependency versions only; the override's reason is recorded in `tooling/security/dependency-policy.json`.

## Changelog

<!-- - Added: text  (Added, Changed, Deprecated, Removed, Fixed or Security)  — or —  None — reason -->

- Security: Update `undici` to 8.12.3, `fast-uri` to 3.1.9 and `happy-dom` to 21.0.4, and resolve the `moment` nested under `eslint-plugin-obsidianmd` to 2.31.0 through one reviewed override, so the all-category audit passes again.

## Risks and rollback

Risk: `happy-dom` 21.0.4 changes component-test behaviour; the full test gate runs on it. Risk: the override gives `obsidian@1.12.3` a newer `moment` than it pins; that package is type declarations only (`"main": ""`) and `moment` 2.31.0 is the version the direct `obsidian` 1.14.4 already uses. Risk: the live audit fails again when a new advisory is published; that is the gate's purpose. Rollback: revert the change pull request.

## Dependencies

None; the npm registry must be reachable for the install and the live audit.

## Open questions

None. The owner chose to fix on `main` first and then port to `release/0.5.0`.

## Issues

<!-- wb:issues generated by node bin/app; edits here are replaced -->
- [[docs/issues/dependency-advisories|Clear the live security audit for 0.5.0]] · Done
<!-- /wb:issues -->

## Pull requests

<!-- wb:pull-requests generated by node bin/app; edits here are replaced -->
- [[docs/pull-requests/dependency-advisories-kickoff|Kick-off: Clear the live security audit for 0.5.0]] · New
- [[docs/pull-requests/dependency-advisories-1|Clear the live security audit with in-range updates and one moment override]] · Merged · [#222](https://github.com/Luis85/obsidian-plugin-shell/pull/222)
<!-- /wb:pull-requests -->

## Completion record

<!-- Generated by `npm run dod -- --write`; regenerate it instead of editing. -->

- Base: `origin/main` (merge base `bbbbf2631de0`)
- Changed files: 10 (6 added, 4 modified, 0 renamed, 0 deleted)
- E2E decision: none; `e2e` label not verifiable locally

### Changed files by area

| Area | Changed files |
| --- | ---: |
| `package.json` | 1 |
| `package-lock.json` | 1 |
| `tooling/security/dependency-policy.json` | 1 |
| `tests/acceptance/dependency-advisories/` | 2 |
| `CHANGELOG.md` | 1 |
| `docs/increments/dependency-advisories.md` | 1 |
| `docs/pull-requests/` | 2 |
| `docs/issues/` | 1 |
| Outside the affected areas | 0 |

### Acceptance criteria evidence

| Criterion | Done | Evidence |
| --- | --- | --- |
| AC-1 | yes | `tests/acceptance/dependency-advisories/ac-1.checks.mjs` |
| AC-2 | yes | `tests/acceptance/dependency-advisories/ac-2.checks.mjs` |

### Gates

`node bin/app check --plan` was not available here (no installed dependencies); run it locally and paste the result into the pull request.
