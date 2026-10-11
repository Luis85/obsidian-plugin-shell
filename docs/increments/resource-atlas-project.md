---
type: Increment
id: resource-atlas-project
title: "Resource Atlas as the fifth product family project"
owner: "Claude"
size: L
status: Done
e2e: optional
refs: []
pullRequests: [resource-atlas-project-kickoff]
branch: "increment/resource-atlas-project"
base: main
---

# Resource Atlas as the fifth product family project

<!-- Developer handoff for one pull request. `npm run dor` checks it before implementation,
`npm run dod` after it. Replace every <placeholder>; delete these comments when done. -->

## Summary

Adds Resource Atlas, the fifth Obsidian Product Family tool, as the standalone project `projects/resource-atlas`. It plans roles and FTE over a period, blocks time and reports person-days. It was delivered as its own Vue 3 + Nuxt UI source with a self-contained HTML build. The other four family projects learn about it through the shared exchange protocol, so all five carry the same protocol.

## Outcome

`npm run check:projects` lists `resource-atlas` with its prototype, synced CI and Dependabot coverage. Inside the project, `npm ci` and `npm run check` build `dist/resource-atlas.html` and pass the calculation and serialization tests. The delivered HTML is kept byte for byte as a prototype. All five family projects carry a byte-identical protocol that names Resource Atlas, and the shell plugin's output is unchanged.

## Scope

### In scope

- `projects/resource-atlas`: the delivered source with its own exact lock, `.nvmrc`, `AGENTS.md`, `workbench.project.json` and CI. Nuxt UI components use the `Pf` prefix, and the intermediate build sits under `dist/shell/`.
- The delivered `resource-atlas.html`, byte for byte, as the prototype in `docs/concepts/resource-atlas/`.
- The Resource Atlas entry in the shared protocol, protocol tests, family tagline and icon of the other four projects, and the family wording in their READMEs and the product-family README.
- Root wiring: kit and generated-project exclusion, Dependabot, synced workflow, projects and concepts indexes, changelog.

### Out of scope

- Obsidian plugin packaging or vault access for Resource Atlas.
- Changes to Resource Atlas's calculations, UI or German copy.
- Dependency upgrades beyond the delivered pinned versions.
- Running the cross-tool exchange checks in CI; they need the other four built files beside it.

## Acceptance criteria

<!-- One `- [ ] AC-n: text` per criterion. At completion tick it and add
`Evidence: \`path\`` (a test file, doc or report that exists). -->

- [x] AC-1: `checkProjects` passes and lists `resource-atlas`, linking `docs/concepts/resource-atlas` and `docs/concepts/product-family`, with its CI workflow synced and an npm Dependabot entry.
  Evidence: `tests/acceptance/resource-atlas-project/ac-1.checks.mjs`
- [x] AC-2: A project file that uses a Nuxt UI component with the shell's detected `U` prefix is reported, no code file in `projects/resource-atlas` contains one, and the project registers the `Pf` prefix and builds under `dist/`.
  Evidence: `tests/acceptance/resource-atlas-project/ac-2.checks.mjs`
- [x] AC-3: `docs/concepts/resource-atlas/index.html` is the delivered `resource-atlas.html`: 976316 bytes with SHA-256 `eac459aa86ae12b6efba462cf4b545ee6c9483ed1cced8eb3346c02444c2e0f9`.
  Evidence: `tests/acceptance/resource-atlas-project/ac-3.checks.mjs`
- [x] AC-4: All five family projects carry a byte-identical exchange protocol whose `APPS` names `component-atlas`, `storyloom`, `sitemap-atlas`, `dissect` and `resource-atlas`.
  Evidence: `tests/acceptance/resource-atlas-project/ac-4.checks.mjs`
- [x] AC-5: `projects/resource-atlas` defines `check` (build and tests) and `test:e2e`, and its CI runs `check` on every pull request and `test:e2e` behind the `e2e` opt-in, keeping the `.qa/` results.
  Evidence: `tests/acceptance/resource-atlas-project/ac-5.checks.mjs`

## Affected areas

<!-- One backticked repository path or glob per line; new files must sit under an allowed root. -->

- `projects/resource-atlas/**`: the Resource Atlas project.
- `projects/component-atlas/**`: the Resource Atlas entry in the shared protocol, tests, tagline and docs.
- `projects/storyloom/**`: the same family update.
- `projects/sitemap-atlas/**`: the same family update.
- `projects/dissect-canvas/**`: the same family update.
- `projects/README.md`: the projects table.
- `docs/concepts/resource-atlas/**`: the delivered prototype.
- `docs/concepts/component-atlas/README.md`: the family members list.
- `docs/concepts/storyloom/README.md`: the family members list.
- `docs/concepts/sitemap-atlas/README.md`: the family members list.
- `docs/concepts/dissect-canvas/README.md`: the family members list.
- `docs/concepts/product-family/README.md`: the fifth tool.
- `docs/concepts/README.md`: the concepts index.
- `.github/workflows/projects--resource-atlas--ci.yml`: the synced project workflow.
- `.github/dependabot.yml`: npm and Actions coverage for the new project.
- `src/cli/adapters/framework/distribution.ts`: keeps the prototype out of the developer kit.
- `src/cli/compiler/emitters/framework-docs.ts`: keeps the prototype out of generated projects.
- `src/cli/tests/interactive-maker-compiler-emitters-kit.checks.mjs`: proves it stays maintainer-only.
- `CHANGELOG.md`: the Unreleased entry.
- `tests/acceptance/resource-atlas-project/**`: the acceptance tests.
- `docs/increments/resource-atlas-project.md`: this handoff.
- `docs/pull-requests/resource-atlas-project-kickoff.md`: the pull request record.

## Test plan

<!-- Lines: - Suite `name`: …  - Gate `command`: …  - New test `tests/…`: …
     - No test change — reason   - E2E: reason for the e2e decision in the frontmatter -->

- Suite `acceptance`: runs the five acceptance tests against the committed projects, prototype and workflows.
- Suite `quality`: the repository and workflow checks, selected because workflows change.
- New test `tests/acceptance/resource-atlas-project/ac-2.checks.mjs`: includes a negative fixture that proves the detection check fails on a `U`-prefixed component.
- Gate `npm run check:projects`: the standalone project contract, workflow sync and Dependabot coverage.
- Gate `npm run check:repository`: the workflow security floor for the synced copy.
- Gate `node tooling/testing/suites.mjs --check`: every new acceptance test file has a test-pyramid level.
- Gate `npm run check:self-review`: no findings on the diff.
- E2E: optional — the shell UI does not change. Resource Atlas runs its own Chromium verification (`npm run test:e2e`), run locally with the four other built files for the exchange checks, and in its `browser` CI job on `main` or with the `e2e` label.

## Docs impact

<!-- - `docs/path.md` (how-to): what changes   — or —   None — reason -->

- `docs/concepts/README.md` (reference): Resource Atlas in the product family list.
- `docs/concepts/product-family/README.md` (explanation): the fifth tool and the shared protocol.

## Changelog

<!-- - Added: text  (Added, Changed, Deprecated, Removed, Fixed or Security)  — or —  None — reason -->

- Added: Resource Atlas as the fifth Obsidian Product Family project (`projects/resource-atlas`): roles, FTE and person-day planning as a self-contained browser prototype built from its own Vue 3 + Nuxt UI source, with its own lock, tests and CI. The other four family projects now list it in their shared exchange protocol.

## Risks and rollback

The shared protocol now exists in five copies; each project's `AGENTS.md` says a protocol change is made in all five, and AC-4 fails when they drift. A future edit that uses a `U`-prefixed Nuxt UI component in Resource Atlas would add styles to the shell plugin; AC-2 catches it. The delivered dependency set carries the same audit findings as the other four, left to Dependabot. Roll back by reverting the pull request; the shell has no dependency on the projects.

## Dependencies

Stacks on #115 (increment `product-family-projects`): it reuses that increment's `Pf` prefix rule, kit exclusions and product-family documents. Merge #115 first.

## Open questions

<!-- "None" when ready. Each open question blocks the Definition of Ready. -->

None

## Pull requests

<!-- wb:pull-requests generated by node bin/app; edits here are replaced -->
- [[docs/pull-requests/resource-atlas-project-kickoff|Kick-off: Resource Atlas as the fifth product family project]] · New
<!-- /wb:pull-requests -->

## Completion record

<!-- Generated by `npm run dod -- --write`; regenerate it instead of editing. -->

- Base: `origin/main` (merge base `fb55df10b536`)
- Changed files: 22 (11 added, 11 modified, 0 renamed, 0 deleted)
- E2E decision: optional; `e2e` label not verifiable locally

### Changed files by area

| Area | Changed files |
| --- | ---: |
| `projects/resource-atlas/**` | 0 |
| `projects/component-atlas/**` | 0 |
| `projects/storyloom/**` | 0 |
| `projects/sitemap-atlas/**` | 0 |
| `projects/dissect-canvas/**` | 0 |
| `projects/README.md` | 0 |
| `docs/concepts/resource-atlas/**` | 3 |
| `docs/concepts/component-atlas/README.md` | 1 |
| `docs/concepts/storyloom/README.md` | 1 |
| `docs/concepts/sitemap-atlas/README.md` | 1 |
| `docs/concepts/dissect-canvas/README.md` | 1 |
| `docs/concepts/product-family/README.md` | 1 |
| `docs/concepts/README.md` | 1 |
| `.github/workflows/projects--resource-atlas--ci.yml` | 1 |
| `.github/dependabot.yml` | 1 |
| `src/cli/adapters/framework/distribution.ts` | 1 |
| `src/cli/compiler/emitters/framework-docs.ts` | 1 |
| `src/cli/tests/interactive-maker-compiler-emitters-kit.checks.mjs` | 1 |
| `CHANGELOG.md` | 1 |
| `tests/acceptance/resource-atlas-project/**` | 5 |
| `docs/increments/resource-atlas-project.md` | 1 |
| `docs/pull-requests/resource-atlas-project-kickoff.md` | 1 |
| Outside the affected areas | 0 |

### Acceptance criteria evidence

| Criterion | Done | Evidence |
| --- | --- | --- |
| AC-1 | yes | `tests/acceptance/resource-atlas-project/ac-1.checks.mjs` |
| AC-2 | yes | `tests/acceptance/resource-atlas-project/ac-2.checks.mjs` |
| AC-3 | yes | `tests/acceptance/resource-atlas-project/ac-3.checks.mjs` |
| AC-4 | yes | `tests/acceptance/resource-atlas-project/ac-4.checks.mjs` |
| AC-5 | yes | `tests/acceptance/resource-atlas-project/ac-5.checks.mjs` |

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
| suite:cli | `node tooling/testing/suites.mjs cli` | yes |
| suite:cli:journey | `node tooling/testing/suites.mjs cli:journey` | no |
| suite:generator | `node tooling/testing/suites.mjs generator` | yes |
| suite:visual | `node tooling/testing/suites.mjs visual` | no |
| suite:companion | `node tooling/testing/suites.mjs companion` | no |
| suite:companion:schema | `node tooling/testing/suites.mjs companion:schema` | no |
| suite:companion:assembly | `node tooling/testing/suites.mjs companion:assembly` | no |
| suite:companion:browser | `node tooling/testing/suites.mjs companion:browser` | no |
| suite:companion:visual-browser | `node tooling/testing/suites.mjs companion:visual-browser` | no |
| suite:companion:starter-browser | `node tooling/testing/suites.mjs companion:starter-browser` | no |
| suite:test-data | `node tooling/testing/suites.mjs test-data` | no |
| suite:makers | `node tooling/testing/suites.mjs makers` | no |
| suite:native | `node tooling/testing/suites.mjs native` | no |
| suite:setup | `node tooling/testing/suites.mjs setup` | no |
| suite:acceptance | `node tooling/testing/suites.mjs acceptance` | yes |
| suite:quality | `node tooling/testing/suites.mjs quality` | yes |
| suite:baseline | `node tooling/testing/suites.mjs baseline` | no |
| suite:e2e | `node tooling/testing/suites.mjs e2e` | no |
| suite:project | `node tooling/testing/suites.mjs project` | no |
| suite:project:ui-effects | `node tooling/testing/suites.mjs project:ui-effects` | no |
| suite:obsidian | `node tooling/testing/suites.mjs obsidian` | no |
| verify | `npm run verify` | yes |
