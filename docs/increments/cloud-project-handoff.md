---
type: Increment
id: cloud-project-handoff
title: "Cloud project handoff skill"
owner: "Claude"
size: M
status: Done
e2e: none
refs: []
pullRequests: [cloud-project-handoff-kickoff]
branch: "increment/cloud-project-handoff"
base: main
---

# Cloud project handoff skill

<!-- Developer handoff for one pull request. `npm run dor` checks it before implementation,
`npm run dod` after it. Replace every <placeholder>; delete these comments when done. -->

## Summary

A cloud session cannot write to a folder on the user's machine, so starting a new plugin project from an idea in Claude Code on the web needed a hand-run workflow: generate the project in the scratchpad, install and check it, then hand over a zip, the companion project JSON and a takeover prompt for a local session. The `cloud-project-handoff` skill makes that workflow reusable, and a structural and behavioural test keeps its recipe and prompt honest.

## Outcome

A user in a cloud session can name an idea, a target folder, a plugin ID and a name, and receive `<id>.zip`, `<id>.companion.json` and a filled-in `<id>-TAKEOVER.md` that a local Claude Code session follows to unpack, install and check the project, without either session pushing, installing into a vault or starting feature work.

## Scope

### In scope

- The `cloud-project-handoff` skill in `.claude/skills/cloud-project-handoff/` with its project-JSON recipe and takeover prompt template, and its thin Codex adapter in `.agents/skills/cloud-project-handoff/`.
- `tooling/tests/agent-cloud-project-handoff-skill.checks.mjs`: structure, citations, safety rules, placeholders and a real run of the recipe against `project validate` and `new --from --dry-run`.
- Discoverability: the skill index in `docs/README.md`, a row in `AGENTS.md`, a section in `docs/development/CLOUD-AND-LOCAL-SESSIONS.md` and a changelog entry.

### Out of scope

- New CLI commands or scripts: the skill drives the existing `new`, `project validate` and `examples:remove` paths.
- `project` and `files` kind starters (`cli`, `webapp*`, `hybrid-*`, `plugin-*`, `website`): the skill points them at `new --starter` instead.
- Automating the zip and delivery steps, and running the takeover prompt on Windows in CI.

## Acceptance criteria

<!-- One `- [ ] AC-n: text` per criterion. At completion tick it and add
`Evidence: \`path\`` (a test file, doc or report that exists). -->

- [x] AC-1: The cloud-project-handoff skill and its Codex adapter pass the shared skill structure checks: frontmatter, cited commands and files, safety rules and a final AskUserQuestion close naming increment-handoff.
  Evidence: `tests/acceptance/cloud-project-handoff/ac-1.checks.mjs`
- [x] AC-2: The documented project-JSON recipe derives a project from the blank starter that `project validate` accepts and `new --from --dry-run` plans without conflicts or writes, and it refuses a project-kind starter.
  Evidence: `tests/acceptance/cloud-project-handoff/ac-2.checks.mjs`
- [x] AC-3: The takeover prompt template documents every placeholder it uses and keeps the local limits: no `npm install`, no remote or push, no personal vault and no feature work.
  Evidence: `tests/acceptance/cloud-project-handoff/ac-3.checks.mjs`

## Affected areas

<!-- One backticked repository path or glob per line; new files must sit under an allowed root. -->

- `.claude/skills/cloud-project-handoff/**`: the skill and its references.
- `.agents/skills/cloud-project-handoff/SKILL.md`: the Codex adapter.
- `tooling/tests/agent-cloud-project-handoff-skill.checks.mjs`: the skill contract test.
- `tests/acceptance/cloud-project-handoff/**`: the acceptance tests.
- `AGENTS.md`: the skill row.
- `docs/README.md`: the skill index entry.
- `docs/development/CLOUD-AND-LOCAL-SESSIONS.md`: the cloud-to-local section.
- `CHANGELOG.md`: the Unreleased entry.
- `docs/increments/cloud-project-handoff.md`: this handoff.
- `docs/pull-requests/cloud-project-handoff-kickoff.md`: the kick-off pull request record.

## Test plan

<!-- Lines: - Suite `name`: …  - Gate `command`: …  - New test `tests/…`: …
     - No test change — reason   - E2E: reason for the e2e decision in the frontmatter -->

- Suite `quality`: runs `tooling/tests/agent-cloud-project-handoff-skill.checks.mjs` with the other agent skill contracts.
- Suite `acceptance`: runs one acceptance test per criterion.
- New test `tests/acceptance/cloud-project-handoff/ac-1.checks.mjs`: runs the structure checks in a fresh process.
- New test `tests/acceptance/cloud-project-handoff/ac-2.checks.mjs`: runs the recipe checks against the real CLI.
- New test `tests/acceptance/cloud-project-handoff/ac-3.checks.mjs`: runs the takeover prompt checks.
- Gate `npm run check:self-review`: no findings on the diff.
- E2E: none — no user interface change; agent skill Markdown and a tooling test only.

## Docs impact

<!-- - `docs/path.md` (how-to): what changes   — or —   None — reason -->

- `docs/development/CLOUD-AND-LOCAL-SESSIONS.md` (how-to): adds "Start in the cloud, continue locally"; the skill index in `docs/README.md` lists the skill.

## Changelog

<!-- - Added: text  (Added, Changed, Deprecated, Removed, Fixed or Security)  — or —  None — reason -->

- Added: `cloud-project-handoff` skill that turns an idea into a generated, checked plugin project in a cloud session and hands it over as a zip, project JSON and takeover prompt.

## Risks and rollback

The recipe copies a starter's companion document and edits a few fields; a starter schema change could break it, which the contract test catches by running the recipe against `project validate` and `new --from`. Roll back by reverting this pull request.

## Dependencies

None

## Open questions

<!-- "None" when ready. Each open question blocks the Definition of Ready. -->

None

## Pull requests

<!-- wb:pull-requests generated by node bin/app; edits here are replaced -->
- [[docs/pull-requests/cloud-project-handoff-kickoff|Kick-off: Cloud project handoff skill]] · New
<!-- /wb:pull-requests -->

## Completion record

<!-- Generated by `npm run dod -- --write`; regenerate it instead of editing. -->

- Base: `origin/main` (merge base `0b9bb1a8b739`)
- Changed files: 16 (10 added, 6 modified, 0 renamed, 0 deleted)
- E2E decision: none; `e2e` label not verifiable locally

### Changed files by area

| Area | Changed files |
| --- | ---: |
| `.claude/skills/cloud-project-handoff/**` | 3 |
| `.agents/skills/cloud-project-handoff/SKILL.md` | 1 |
| `tooling/tests/agent-cloud-project-handoff-skill.checks.mjs` | 1 |
| `tests/acceptance/cloud-project-handoff/**` | 3 |
| `AGENTS.md` | 1 |
| `docs/README.md` | 1 |
| `docs/development/CLOUD-AND-LOCAL-SESSIONS.md` | 1 |
| `CHANGELOG.md` | 1 |
| `docs/increments/cloud-project-handoff.md` | 1 |
| `docs/pull-requests/cloud-project-handoff-kickoff.md` | 1 |
| Outside the affected areas | 2 |

### Acceptance criteria evidence

| Criterion | Done | Evidence |
| --- | --- | --- |
| AC-1 | yes | `tests/acceptance/cloud-project-handoff/ac-1.checks.mjs` |
| AC-2 | yes | `tests/acceptance/cloud-project-handoff/ac-2.checks.mjs` |
| AC-3 | yes | `tests/acceptance/cloud-project-handoff/ac-3.checks.mjs` |

### Gates

From `node bin/app check --plan`:

| Gate | Command | Required |
| --- | --- | --- |
| check | `node bin/app check --fast --base origin/main` | yes |
| coverage-production | `npm run test:coverage:production` | yes |
| suite:maker:pty | `node tooling/testing/suites.mjs maker:pty` | no |
| suite:maker | `node tooling/testing/suites.mjs maker` | no |
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
