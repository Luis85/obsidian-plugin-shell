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

Upgrades `@nuxt/ui` from 4.11.3 to 4.12.0 for the plugin shell and for projects generated from the Companion (`VISUAL_NUXT_UI_VERSION` is what generated projects pin). The version is asserted in several reviewed places, so they move together, and the prototype bundle gate in the `companion-prototype-design` skill is narrowed so that a lazy import the bundler inlined into the entry chunk (Nuxt UI 4.12.0's Toaster loads `Toast.vue` that way) is no longer reported as a second file.

## Outcome

The shell builds, lints, type-checks and tests against Nuxt UI 4.12.0 from a strict `npm ci`, the two hash-guarded runtime modules are unchanged, generated projects pin 4.12.0 and their prototype builds pass the bundle gate, while a second chunk or any other dynamic import target is still rejected.

## Scope

### In scope

- Exact pin `@nuxt/ui` 4.12.0 in `package.json`, the lockfile and the reviewed dependency policy.
- The version assertions: the Nuxt UI adaptation profile, `VISUAL_NUXT_UI_VERSION`, the local icon note, the README with its reviewed ownership hash, two development docs and the tests that assert the version.
- The `singleBundle` gate: accept a `dynamicImports` entry that names the entry chunk itself, with positive and negative fixtures and the refreshed skill package inventory hashes.

### Out of scope

- `projects/*`: each keeps its own Nuxt UI pin and its own copy of the gate; `projects/companion` (Dependabot #198) needs the same gate fix in its own change.
- Any change to the two hash-guarded runtime modules, the Tailwind setup, the local icon set or other Nuxt UI components.
- Weakening any other check of the bundle gate: exactly one chunk, no static imports, one CSS asset and the rendered Vue, Pinia and Nuxt UI usage stay required.

## Acceptance criteria

<!-- One `- [ ] AC-n: text` per criterion. At completion tick it and add
`Evidence: \`path\`` (a test file, doc or report that exists). -->

- [x] AC-1: The shell, its reviewed pins and the generated-project catalog all use Nuxt UI 4.12.0, and the two hash-guarded runtime modules are unchanged.
  Evidence: `tests/acceptance/nuxt-ui-4-12-0/ac-1.checks.mjs`
- [x] AC-2: The prototype bundle gate accepts a lazy import the bundler inlined into the entry chunk and still rejects any second file.
  Evidence: `tests/acceptance/nuxt-ui-4-12-0/ac-2.checks.mjs`

## Affected areas

<!-- One backticked repository path or glob per line; new files must sit under an allowed root. -->

- `package.json`: the exact `@nuxt/ui` pin.
- `package-lock.json`: the resolved package and its transitive updates.
- `tooling/security/dependency-policy.json`: the reviewed exact version.
- `tooling/bundling/**`: the adaptation profile version and the local icon note.
- `src/shared/companion/visual/visual-catalog.mjs`: `VISUAL_NUXT_UI_VERSION`, the version generated projects pin.
- `README.md`: the integration paragraph.
- `tooling/examples/ownership.json`: the reviewed README hash the developer kit checks.
- `docs/development/**`: the Companion generator and project JSON pages.
- `src/cli/tests/**`: the generator tests that assert the pinned version.
- `tooling/tests/**`: the visual inspector test that asserts the pinned version.
- `.claude/skills/companion-prototype-design/scripts/lib/build-output.mjs`: the narrowed bundle gate.
- `.claude/skills/companion-prototype-design/tests/integration.checks.mjs`: the gate fixtures.
- `.claude/skills/companion-prototype-design/PACKAGE-INVENTORY.json`: the refreshed hashes of the two changed skill files.
- `CHANGELOG.md`: the Unreleased entry.
- `tests/acceptance/nuxt-ui-4-12-0/**`: the AC-1 and AC-2 acceptance tests.
- `docs/increments/nuxt-ui-4-12-0.md`: this handoff.
- `docs/pull-requests/nuxt-ui-4-12-0-kickoff.md`: the pull request record.

## Test plan

<!-- Lines: - Suite `name`: …  - Gate `command`: …  - New test `tests/…`: …
     - No test change — reason   - E2E: reason for the e2e decision in the frontmatter -->

- Suite `acceptance`: runs the AC-1 and AC-2 acceptance tests against the committed lockfile, pins and gate.
- Suite `prototypes`: the skill integration tests, including the new gate fixtures, and the package inventory hashes.
- Suite `generator`: generated projects pin the catalog version.
- Suite `visual`: the catalog and the visual inspector assert the version.
- Suite `compiler`: the starter golden baselines are unchanged.
- Suite `companion`: Companion project output with the new pin.
- New test `tests/acceptance/nuxt-ui-4-12-0/ac-1.checks.mjs`: proves the pins, the catalog, the unchanged guarded modules and the README ownership record agree.
- New test `tests/acceptance/nuxt-ui-4-12-0/ac-2.checks.mjs`: proves the gate accepts the entry chunk's self-reference and rejects any other target, a static import or a second chunk.
- Gate `npm run check -- --fast --base origin/main`: the diff-scoped checks and the affected suites.
- Gate `npm run check:self-review`: no findings on the diff.
- E2E: optional — no intended UI change; the served-UI suite is run on request through the `e2e` label.

## Docs impact

<!-- - `docs/path.md` (how-to): what changes   — or —   None — reason -->

- `docs/development/COMPANION-GENERATOR.md` (reference): the catalog is pinned to Nuxt UI 4.12.0.
- `docs/development/COMPANION-PROJECT-JSON.md` (reference): the pinned catalog version in the visual designs description.
- `README.md` (explanation): the integrated Nuxt UI version.

## Changelog

<!-- - Added: text  (Added, Changed, Deprecated, Removed, Fixed or Security)  — or —  None — reason -->

- Changed: Nuxt UI is now 4.12.0 for the plugin shell and for projects generated from the Companion, and the prototype bundle gate accepts a lazy import that the bundler inlined into the entry chunk while still rejecting any second chunk or other dynamic import target.

## Risks and rollback

Nuxt UI 4.12.0 changes component internals (locale inheritance in `UApp`, computed link props in `UButton`, a `leading` variant on the input trailing icon) and bumps reka-ui to 2.11.0; the root imports only App, Badge, Button, Card, Input and Textarea and its unit and served-UI tests pass. The gate change could hide a real second file if it matched too much; it accepts only a name equal to the entry chunk and the chunk count, static imports and CSS checks are unchanged, with fixtures for the rejected cases. Roll back by reverting this pull request; the pins, hashes and fixtures move together.

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
- Changed files: 22 (4 added, 18 modified, 0 renamed, 0 deleted)
- E2E decision: optional; `e2e` label not verifiable locally

### Changed files by area

| Area | Changed files |
| --- | ---: |
| `package.json` | 1 |
| `package-lock.json` | 1 |
| `tooling/security/dependency-policy.json` | 1 |
| `tooling/bundling/**` | 2 |
| `src/shared/companion/visual/visual-catalog.mjs` | 1 |
| `README.md` | 1 |
| `tooling/examples/ownership.json` | 1 |
| `docs/development/**` | 2 |
| `src/cli/tests/**` | 3 |
| `tooling/tests/**` | 1 |
| `.claude/skills/companion-prototype-design/scripts/lib/build-output.mjs` | 1 |
| `.claude/skills/companion-prototype-design/tests/integration.checks.mjs` | 1 |
| `.claude/skills/companion-prototype-design/PACKAGE-INVENTORY.json` | 1 |
| `CHANGELOG.md` | 1 |
| `tests/acceptance/nuxt-ui-4-12-0/**` | 2 |
| `docs/increments/nuxt-ui-4-12-0.md` | 1 |
| `docs/pull-requests/nuxt-ui-4-12-0-kickoff.md` | 1 |
| Outside the affected areas | 0 |

### Acceptance criteria evidence

| Criterion | Done | Evidence |
| --- | --- | --- |
| AC-1 | yes | `tests/acceptance/nuxt-ui-4-12-0/ac-1.checks.mjs` |
| AC-2 | yes | `tests/acceptance/nuxt-ui-4-12-0/ac-2.checks.mjs` |

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
| suite:native | `node tooling/testing/suites.mjs native` | no |
| suite:setup | `node tooling/testing/suites.mjs setup` | yes |
| suite:release | `node tooling/testing/suites.mjs release` | yes |
| suite:acceptance | `node tooling/testing/suites.mjs acceptance` | yes |
| suite:quality | `node tooling/testing/suites.mjs quality` | no |
| suite:baseline | `node tooling/testing/suites.mjs baseline` | no |
| suite:e2e | `node tooling/testing/suites.mjs e2e` | no |
| suite:project | `node tooling/testing/suites.mjs project` | no |
| suite:project:ui-effects | `node tooling/testing/suites.mjs project:ui-effects` | no |
| suite:obsidian | `node tooling/testing/suites.mjs obsidian` | no |
| verify | `npm run verify` | yes |
