---
type: Increment
id: nuxt-ui-4-12-0
title: "Nuxt UI 4.12.0 for the shell and generated projects"
owner: "Claude"
size: M
status: Done
e2e: optional
refs: []
pullRequests: [nuxt-ui-4-12-0-kickoff]
branch: "increment/nuxt-ui-4-12-0"
base: main
---

# Nuxt UI 4.12.0 for the shell and generated projects

<!-- Developer handoff for one pull request. `npm run dor` checks it before implementation,
`npm run dod` after it. Replace every <placeholder>; delete these comments when done. -->

## Summary

Upgrades `@nuxt/ui` from 4.11.3 to 4.12.0 for the plugin shell and for projects generated from the Companion (`VISUAL_NUXT_UI_VERSION` is what generated projects pin). The version is asserted in several reviewed places, so they move together, the committed Companion concept (which embeds that version) is regenerated, and the prototype bundle gate in the `companion-prototype-design` skill is narrowed so that a lazy import the bundler inlined into the entry chunk (Nuxt UI 4.12.0's Toaster loads `Toast.vue` that way) is no longer reported as a second file. Nuxt UI 4.12.0 also grows the shipped stylesheet from 163,320 to 165,755 bytes in the CI source-archive build, over the 160 KiB budget, so the budget is raised to 168 KiB with the owner's explicit approval.

## Outcome

The shell builds, lints, type-checks and tests against Nuxt UI 4.12.0 from a strict `npm ci`, the two hash-guarded runtime modules are unchanged, generated projects pin 4.12.0 and their prototype builds pass the bundle gate, the shipped stylesheet passes the 168 KiB budget in the source-archive build, while a second chunk or any other dynamic import target is still rejected.

## Scope

### In scope

- Exact pin `@nuxt/ui` 4.12.0 in `package.json`, the lockfile and the reviewed dependency policy.
- The version assertions: the Nuxt UI adaptation profile, `VISUAL_NUXT_UI_VERSION`, the local icon note, the README with its reviewed ownership hash, two development docs and the tests that assert the version, and the regenerated Companion concept `docs/concepts/companion/index.html`.
- The `singleBundle` gate: accept a `dynamicImports` entry that names the entry chunk itself, with positive and negative fixtures and the refreshed skill package inventory hashes.
- The stylesheet budget 160 KiB to 168 KiB in the artifacts check, the threshold floors and configuration, the boundary test and the quality docs, with the owner approval recorded for the two threshold files.

### Out of scope

- `projects/*`: each keeps its own Nuxt UI pin; `projects/companion` takes the same gate fix in its own change (Dependabot #198, merged).
- Any change to the two hash-guarded runtime modules, the Tailwind setup, the local icon set or other Nuxt UI components.
- Weakening any other check of the bundle gate: exactly one chunk, no static imports, one CSS asset and the rendered Vue, Pinia and Nuxt UI usage stay required.
- Scoping Nuxt UI component detection or trimming the 4.12.0 theme output; the owner chose the budget raise.

## Acceptance criteria

<!-- One `- [ ] AC-n: text` per criterion. At completion tick it and add
`Evidence: \`path\`` (a test file, doc or report that exists). -->

- [x] AC-1: The shell, its reviewed pins and the generated-project catalog all use Nuxt UI 4.12.0, and the two hash-guarded runtime modules are unchanged. Evidence: `tests/acceptance/nuxt-ui-4-12-0/ac-1.checks.mjs`
- [x] AC-2: The prototype bundle gate accepts a lazy import the bundler inlined into the entry chunk and still rejects any second file. Evidence: `tests/acceptance/nuxt-ui-4-12-0/ac-2.checks.mjs`
- [x] AC-3: The shipped stylesheet budget is 168 KiB in the artifacts check, the performance thresholds and their tests, recorded as an owner approval, and the committed Companion concept matches its generator. Evidence: `tests/acceptance/nuxt-ui-4-12-0/ac-3.checks.mjs`

## Affected areas

<!-- One backticked repository path or glob per line; new files must sit under an allowed root. -->

- `package*.json`: the exact `@nuxt/ui` pin and the resolved package with its transitive updates.
- `tooling/security/dependency-policy.json`: the reviewed exact version.
- `tooling/bundling/**`: the adaptation profile version and the local icon note.
- `tooling/quality/**`: the artifacts size budget and the threshold floors.
- `configs/quality/**`: the stylesheet threshold and the recorded owner approval.
- `src/shared/companion/visual/visual-catalog.mjs`: `VISUAL_NUXT_UI_VERSION`, the version generated projects pin.
- `docs/concepts/companion/index.html`: the regenerated Companion concept that embeds that version.
- `README.md`: the integration paragraph.
- `tooling/examples/ownership.json`: the reviewed README hash the developer kit checks.
- `docs/development/**`: the Companion generator, project JSON and quality assurance pages.
- `docs/architecture/STYLES.md`: the stylesheet budget statement.
- `src/cli/tests/**`: the generator tests that assert the pinned version.
- `tooling/tests/**`: the visual inspector and performance report tests.
- `.claude/skills/companion-prototype-design/**`: the narrowed bundle gate, its fixtures and the package inventory hashes.
- `CHANGELOG.md`: the Unreleased entry.
- `tests/acceptance/nuxt-ui-4-12-0/**`: the AC-1, AC-2 and AC-3 acceptance tests.
- `docs/increments/nuxt-ui-4-12-0.md`: this handoff.
- `docs/pull-requests/nuxt-ui-4-12-0-kickoff.md`: the pull request record.

## Test plan

<!-- Lines: - Suite `name`: …  - Gate `command`: …  - New test `tests/…`: …
     - No test change — reason   - E2E: reason for the e2e decision in the frontmatter -->

- Suite `acceptance`: runs the AC-1, AC-2 and AC-3 acceptance tests against the committed lockfile, pins, gate, thresholds and concept.
- Suite `prototypes`: the skill integration tests, including the new gate fixtures, and the package inventory hashes.
- Suite `generator`: generated projects pin the catalog version.
- Suite `visual`: the catalog and the visual inspector assert the version.
- Suite `compiler`: the starter golden baselines are unchanged.
- Suite `companion`: Companion project output with the new pin.
- Suite `quality`: the performance report and self-review approval tests for the raised budget.
- New test `tests/acceptance/nuxt-ui-4-12-0/ac-1.checks.mjs`: proves the pins, the catalog, the unchanged guarded modules and the README ownership record agree.
- New test `tests/acceptance/nuxt-ui-4-12-0/ac-2.checks.mjs`: proves the gate accepts the entry chunk's self-reference and rejects any other target, a static import or a second chunk.
- New test `tests/acceptance/nuxt-ui-4-12-0/ac-3.checks.mjs`: proves the 168 KiB budget in the check, the floors and the configuration, the owner approval records and the regenerated concept.
- Gate `npm run check -- --fast --base origin/main`: the diff-scoped checks and the affected suites.
- Gate `npm run check:self-review`: no findings on the diff, with the owner approvals matched.
- E2E: optional — no intended UI change; the served-UI suite is run on request through the `e2e` label.

## Docs impact

<!-- - `docs/path.md` (how-to): what changes   — or —   None — reason -->

- `docs/development/COMPANION-GENERATOR.md` (reference): the catalog is pinned to Nuxt UI 4.12.0.
- `docs/development/COMPANION-PROJECT-JSON.md` (reference): the pinned catalog version in the visual designs description.
- `docs/development/QUALITY-ASSURANCE.md` (reference): the owner-reviewed stylesheet budget change to 168 KiB.
- `docs/architecture/STYLES.md` (reference): the stylesheet budget statement.
- `README.md` (explanation): the integrated Nuxt UI version.

## Changelog

<!-- - Added: text  (Added, Changed, Deprecated, Removed, Fixed or Security)  — or —  None — reason -->

- Changed: Nuxt UI is now 4.12.0 for the plugin shell and for projects generated from the Companion, the shipped stylesheet budget is 168 KiB (owner-reviewed) to fit its theme output, and the prototype bundle gate accepts a lazy import that the bundler inlined into the entry chunk while still rejecting any second chunk or other dynamic import target.

## Risks and rollback

Nuxt UI 4.12.0 changes component internals (locale inheritance in `UApp`, computed link props in `UButton`, a `leading` variant on the input trailing icon) and bumps reka-ui to 2.11.0; the root imports only App, Badge, Button, Card, Input and Textarea and its unit and served-UI tests pass. The gate change could hide a real second file if it matched too much; it accepts only a name equal to the entry chunk and the chunk count, static imports and CSS checks are unchanged, with fixtures for the rejected cases. The raised budget gives a larger ceiling for unrelated growth; it keeps about 6 KiB of headroom and the previous limit was only 520 bytes above `main`. Roll back by reverting this pull request; the pins, hashes, thresholds and fixtures move together.

## Dependencies

Supersedes Dependabot #201. `projects/companion` (#198) follows separately with the same gate fix inside that project.

## Open questions

<!-- "None" when ready. Each open question blocks the Definition of Ready. -->

None

## Pull requests

<!-- wb:pull-requests generated by node bin/app; edits here are replaced -->
- [[docs/pull-requests/nuxt-ui-4-12-0-kickoff|Kick-off: Nuxt UI 4.12.0 for the shell and generated projects]] · New
<!-- /wb:pull-requests -->

## Completion record

<!-- Generated by `npm run dod -- --write`; regenerate it instead of editing. -->

- Base: `origin/main` (merge base `39009d13e1f3`)
- Changed files: 31 (5 added, 26 modified, 0 renamed, 0 deleted)
- E2E decision: optional; `e2e` label not verifiable locally

### Changed files by area

| Area | Changed files |
| --- | ---: |
| `package*.json` | 2 |
| `tooling/security/dependency-policy.json` | 1 |
| `tooling/bundling/**` | 2 |
| `tooling/quality/**` | 2 |
| `configs/quality/**` | 2 |
| `src/shared/companion/visual/visual-catalog.mjs` | 1 |
| `docs/concepts/companion/index.html` | 1 |
| `README.md` | 1 |
| `tooling/examples/ownership.json` | 1 |
| `docs/development/**` | 3 |
| `docs/architecture/STYLES.md` | 1 |
| `src/cli/tests/**` | 3 |
| `tooling/tests/**` | 2 |
| `.claude/skills/companion-prototype-design/**` | 3 |
| `CHANGELOG.md` | 1 |
| `tests/acceptance/nuxt-ui-4-12-0/**` | 3 |
| `docs/increments/nuxt-ui-4-12-0.md` | 1 |
| `docs/pull-requests/nuxt-ui-4-12-0-kickoff.md` | 1 |
| Outside the affected areas | 0 |

### Acceptance criteria evidence

| Criterion | Done | Evidence |
| --- | --- | --- |
| AC-1 | yes | `tests/acceptance/nuxt-ui-4-12-0/ac-1.checks.mjs` |
| AC-2 | yes | `tests/acceptance/nuxt-ui-4-12-0/ac-2.checks.mjs` |
| AC-3 | yes | `tests/acceptance/nuxt-ui-4-12-0/ac-3.checks.mjs` |

### Gates

From `node bin/app check --plan`:

| Gate | Command | Required |
| --- | --- | --- |
| check | `node bin/app check --fast --base origin/main` | yes |
| coverage-production | `npm run test:coverage:production` | yes |
| suite:maker:pty | `node tooling/testing/suites.mjs maker:pty` | no |
| suite:maker | `node tooling/testing/suites.mjs maker` | yes |
| suite:workbench-plugins | `node tooling/testing/suites.mjs workbench-plugins` | no |
| suite:airship | `node tooling/testing/suites.mjs airship` | no |
| suite:compiler | `node tooling/testing/suites.mjs compiler` | yes |
| suite:compiler:properties | `node tooling/testing/suites.mjs compiler:properties` | no |
| suite:prototypes | `node tooling/testing/suites.mjs prototypes` | no |
| suite:prototypes:python | `node tooling/testing/suites.mjs prototypes:python` | no |
| suite:companion:mvp | `node tooling/testing/suites.mjs companion:mvp` | no |
| suite:runtime | `node tooling/testing/suites.mjs runtime` | no |
| suite:cli | `node tooling/testing/suites.mjs cli` | no |
| suite:cli:journey | `node tooling/testing/suites.mjs cli:journey` | no |
| suite:generator | `node tooling/testing/suites.mjs generator` | yes |
| suite:visual | `node tooling/testing/suites.mjs visual` | yes |
| suite:companion | `node tooling/testing/suites.mjs companion` | yes |
| suite:companion:schema | `node tooling/testing/suites.mjs companion:schema` | no |
| suite:companion:assembly | `node tooling/testing/suites.mjs companion:assembly` | no |
| suite:companion:browser | `node tooling/testing/suites.mjs companion:browser` | no |
| suite:companion:visual-browser | `node tooling/testing/suites.mjs companion:visual-browser` | no |
| suite:companion:starter-browser | `node tooling/testing/suites.mjs companion:starter-browser` | no |
| suite:test-data | `node tooling/testing/suites.mjs test-data` | no |
| suite:makers | `node tooling/testing/suites.mjs makers` | yes |
| suite:memory | `node tooling/testing/suites.mjs memory` | no |
| suite:memory:python | `node tooling/testing/suites.mjs memory:python` | no |
| suite:native | `node tooling/testing/suites.mjs native` | yes |
| suite:setup | `node tooling/testing/suites.mjs setup` | yes |
| suite:release | `node tooling/testing/suites.mjs release` | yes |
| suite:acceptance | `node tooling/testing/suites.mjs acceptance` | yes |
| suite:quality | `node tooling/testing/suites.mjs quality` | yes |
| suite:baseline | `node tooling/testing/suites.mjs baseline` | no |
| suite:e2e | `node tooling/testing/suites.mjs e2e` | no |
| suite:project | `node tooling/testing/suites.mjs project` | no |
| suite:project:ui-effects | `node tooling/testing/suites.mjs project:ui-effects` | no |
| suite:obsidian | `node tooling/testing/suites.mjs obsidian` | no |
| verify | `npm run verify` | yes |
