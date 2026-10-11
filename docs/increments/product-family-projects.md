---
type: Increment
id: product-family-projects
title: "Obsidian Product Family prototypes as standalone projects"
owner: "Claude"
size: L
status: Done
e2e: optional
refs: []
pullRequests: [product-family-projects-kickoff]
branch: "increment/product-family-projects"
base: main
---

# Obsidian Product Family prototypes as standalone projects

<!-- Developer handoff for one pull request. `npm run dor` checks it before implementation,
`npm run dod` after it. Replace every <placeholder>; delete these comments when done. -->

## Summary

Adds the four Obsidian Product Family prototypes (Component Atlas, Storyloom, Sitemap Atlas and Dissect) as standalone projects under the existing `projects/<name>/` contract. They were delivered as one archive: four self-contained HTML files built from one shared Vue 3 + Nuxt UI source tree. The delivered files are kept as prototypes, and each project rebuilds its own file without changing the shell plugin's output.

## Outcome

`npm run check:projects` lists `component-atlas`, `storyloom`, `sitemap-atlas` and `dissect-canvas` with their prototypes, synced CI and Dependabot coverage. Inside each project, `npm ci` and `npm run check` build the self-contained HTML and pass the exchange-protocol tests, and `npm run test:e2e` verifies the built file offline in Chromium. The shell plugin's `main.js`, `styles.css` and `manifest.json` are byte-identical with and without the four projects.

## Scope

### In scope

- Four standalone projects, each with the shared family shell, only its own editor engine, its own exact lock, `.nvmrc`, README, `AGENTS.md`, `workbench.project.json`, protocol and browser tests, and CI.
- The delivered HTML files, byte for byte, as prototypes in `docs/concepts/<name>/`, and the family-wide delivery (manifest, guide, original verification, sample package) once in `docs/concepts/product-family/`.
- Root wiring: synced project workflows, Dependabot entries, the projects and concepts indexes, the changelog.
- Isolation from the shell's Nuxt UI component detection: the `Pf` component prefix and build output under `dist/`, recorded in `projects/README.md`.

### Out of scope

- Obsidian plugin packaging, vault access or a native host for any of the four tools.
- A `node bin/app projects` command; the projects are managed through the existing `check:projects` and `projects:sync` contract.
- Changing the shell's build tooling or Nuxt UI detection.
- Dependency upgrades beyond the delivered pinned versions; Dependabot proposes them per project.
- Re-running the original cross-tool browser run, which needs all four tools in one folder.

## Acceptance criteria

<!-- One `- [ ] AC-n: text` per criterion. At completion tick it and add
`Evidence: \`path\`` (a test file, doc or report that exists). -->

- [x] AC-1: `checkProjects` passes and lists `component-atlas`, `storyloom`, `sitemap-atlas` and `dissect-canvas`, each linking `docs/concepts/<name>` and `docs/concepts/product-family`, with its CI workflow synced and an npm Dependabot entry.
  Evidence: `tests/acceptance/product-family-projects/ac-1.checks.mjs`
- [x] AC-2: A project file that uses a Nuxt UI component with the shell's detected `U` prefix is reported, and no code file in the four projects contains one, so the shell's Nuxt UI component detection never picks up the projects.
  Evidence: `tests/acceptance/product-family-projects/ac-2.checks.mjs`
- [x] AC-3: Each `docs/concepts/<name>/index.html` matches the byte count and SHA-256 recorded for its file in `docs/concepts/product-family/delivery/DELIVERY-MANIFEST.json`.
  Evidence: `tests/acceptance/product-family-projects/ac-3.checks.mjs`
- [x] AC-4: Each project builds exactly its own editor: `app.config.mjs` names the editor file that is the only file in `editors/`, `package.json` defines `check` (build and protocol tests) and `test:e2e`, and its CI runs `check` on every pull request and `test:e2e` behind the `e2e` opt-in.
  Evidence: `tests/acceptance/product-family-projects/ac-4.checks.mjs`

## Affected areas

<!-- One backticked repository path or glob per line; new files must sit under an allowed root. -->

- `projects/component-atlas/**`: the Component Atlas project.
- `projects/storyloom/**`: the Storyloom project.
- `projects/sitemap-atlas/**`: the Sitemap Atlas project.
- `projects/dissect-canvas/**`: the Dissect project.
- `projects/README.md`: the projects table and the Nuxt UI detection rule.
- `docs/concepts/component-atlas/**`: the delivered Component Atlas prototype.
- `docs/concepts/storyloom/**`: the delivered Storyloom prototype.
- `docs/concepts/sitemap-atlas/**`: the delivered Sitemap Atlas prototype.
- `docs/concepts/dissect-canvas/**`: the delivered Dissect prototype.
- `docs/concepts/product-family/**`: the family-wide delivery.
- `docs/concepts/README.md`: the concepts index.
- `.github/workflows/projects--*--ci.yml`: the synced project workflows.
- `.github/dependabot.yml`: npm and Actions coverage for the four projects.
- `CHANGELOG.md`: the Unreleased entry.
- `tests/acceptance/product-family-projects/**`: the acceptance tests.
- `docs/increments/product-family-projects.md`: this handoff.
- `docs/pull-requests/product-family-projects-kickoff.md`: the pull request record.

## Test plan

<!-- Lines: - Suite `name`: …  - Gate `command`: …  - New test `tests/…`: …
     - No test change — reason   - E2E: reason for the e2e decision in the frontmatter -->

- Suite `acceptance`: runs the four acceptance tests against the committed projects, prototypes and workflows.
- Suite `quality`: the repository and workflow checks, selected because workflows change.
- New test `tests/acceptance/product-family-projects/ac-2.checks.mjs`: includes a negative fixture that proves the detection check fails on a `U`-prefixed component.
- Gate `npm run check:projects`: the standalone project contract, workflow sync and Dependabot coverage.
- Gate `npm run check:repository`: the workflow security floor for the synced copies.
- Gate `node tooling/testing/suites.mjs --check`: every new acceptance test file has a test-pyramid level.
- Gate `npm run check:self-review`: no findings on the diff.
- E2E: optional — the shell UI does not change. Each project runs its own Chromium verification (`npm run test:e2e`), run locally for this change and in its `browser` CI job on `main` or with the `e2e` label.

## Docs impact

<!-- - `docs/path.md` (how-to): what changes   — or —   None — reason -->

- `docs/concepts/README.md` (reference): the product family and its four prototypes.
- `docs/concepts/product-family/README.md` (explanation): the family, its delivery and what was and was not re-verified.

## Changelog

<!-- - Added: text  (Added, Changed, Deprecated, Removed, Fixed or Security)  — or —  None — reason -->

- Added: Obsidian Product Family prototypes as four standalone projects: `projects/component-atlas`, `projects/storyloom`, `projects/sitemap-atlas` and `projects/dissect-canvas`. Each builds its self-contained browser prototype from its own Vue 3 + Nuxt UI source, with its own lock, protocol tests, opt-in browser verification and CI, and links its delivered prototype in `docs/concepts/<name>` and the shared delivery in `docs/concepts/product-family`.

## Risks and rollback

The shared shell now exists in four copies, so a family change must be made in each project; each `AGENTS.md` says so. A future project edit that uses a `U`-prefixed Nuxt UI component, or writes build output outside `dist/`, would add styles to the shell plugin; AC-2 catches the component case. The delivered dependency set carries three audit findings (Vue SSR XSS, not used client-side; a Windows-only esbuild dev-server issue), left to Dependabot. Roll back by reverting the pull request; the shell has no dependency on the projects.

## Dependencies

None

## Open questions

<!-- "None" when ready. Each open question blocks the Definition of Ready. -->

None

## Pull requests

<!-- wb:pull-requests generated by node bin/app; edits here are replaced -->
- [[docs/pull-requests/product-family-projects-kickoff|Kick-off: Obsidian Product Family prototypes as standalone projects]] · New
<!-- /wb:pull-requests -->

## Completion record

<!-- Generated by `npm run dod -- --write`; regenerate it instead of editing. -->

- Base: `origin/main` (merge base `dde6cf9de386`)
- Changed files: 36 (33 added, 3 modified, 0 renamed, 0 deleted)
- E2E decision: optional; `e2e` label not verifiable locally

### Changed files by area

| Area | Changed files |
| --- | ---: |
| `projects/component-atlas/**` | 0 |
| `projects/storyloom/**` | 0 |
| `projects/sitemap-atlas/**` | 0 |
| `projects/dissect-canvas/**` | 0 |
| `projects/README.md` | 0 |
| `docs/concepts/component-atlas/**` | 3 |
| `docs/concepts/storyloom/**` | 3 |
| `docs/concepts/sitemap-atlas/**` | 3 |
| `docs/concepts/dissect-canvas/**` | 3 |
| `docs/concepts/product-family/**` | 11 |
| `docs/concepts/README.md` | 1 |
| `.github/workflows/projects--*--ci.yml` | 4 |
| `.github/dependabot.yml` | 1 |
| `CHANGELOG.md` | 1 |
| `tests/acceptance/product-family-projects/**` | 4 |
| `docs/increments/product-family-projects.md` | 1 |
| `docs/pull-requests/product-family-projects-kickoff.md` | 1 |
| Outside the affected areas | 0 |

### Acceptance criteria evidence

| Criterion | Done | Evidence |
| --- | --- | --- |
| AC-1 | yes | `tests/acceptance/product-family-projects/ac-1.checks.mjs` |
| AC-2 | yes | `tests/acceptance/product-family-projects/ac-2.checks.mjs` |
| AC-3 | yes | `tests/acceptance/product-family-projects/ac-3.checks.mjs` |
| AC-4 | yes | `tests/acceptance/product-family-projects/ac-4.checks.mjs` |

### Gates

`node bin/app check --plan` was not available here (no installed dependencies); run it locally and paste the result into the pull request.
