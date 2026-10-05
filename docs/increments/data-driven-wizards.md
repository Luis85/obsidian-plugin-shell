---
type: Increment
id: data-driven-wizards
title: "Data-driven wizards, forms, learning paths, processes, note collections and test workflows"
owner: "Luis85"
size: L
status: Done
e2e: optional
refs: ["#77", "#74", docs/development/WIZARDS-AND-FORMS.md]
pullRequests: ["#77"]
---

# Data-driven wizards, forms, learning paths, processes, note collections and test workflows

## Summary

Every guided `node bin/app` process becomes a JSON wizard in `configs/wizards` built from
reusable JSON forms in `configs/forms`, run by one form engine and one wizard engine with
named hooks and actions. New data-driven CLI capabilities sit on that engine: learning
paths, business processes, a seeded fake-data generator, typed-note collections (risks,
learnings, release items, release candidates) and Playwright browser test workflows. The
plugin runtime renders the same form format with `defineForm` and `DataForm`.

## Outcome

A maintainer adds a guided process, course, business process, collection or browser
journey by writing JSON (and Markdown) under `configs/`, checks it with the matching
`check` command and runs it in a terminal or through reviewed `--json` plans, without
editing the CLI dispatcher or the runners.

## Scope

### In scope

- The form and wizard engines, the `wizard` and `form` commands and the conversion of settings, first-run, project-setup, `new`, prototype, brainstorm, framework `setup` and the `new <dir>` starter interview.
- The dependency-free setup form reader for `npm run setup`.
- Runtime forms in the plugin: `defineForm`, `DataForm` and the showcase Forms page.
- `fake-data` with reusable generation configs, `learn` with three courses, `process`, the typed-note collection engine with `risk`, `learning` and `release-item`, `candidate` and `workflow`.

### Out of scope

- Tagging, publishing or editing `CHANGELOG.md` from a release candidate.
- Screenshot baselines or visual comparison in browser test workflows.
- Calling Claude Design, uploading designs or running hosted browsers.
- Replacing the Increment, PullRequest and Issue documents of `node bin/app increment`, `pr` and `issue`.

## Acceptance criteria

- [x] AC-1: Every shipped wizard and form loads from `configs/wizards` and `configs/forms`, references only registered hooks, actions and forms, and `wizard check` reports no issues. Evidence: `tests/tooling/interactive-maker-wizard-catalog.checks.mjs`
- [x] AC-2: The wizard runner walks steps with conditions, barriers, retries and back navigation, and a failed action is reported or retried without a success result. Evidence: `tests/tooling/interactive-maker-wizard-runner.checks.mjs`
- [x] AC-3: The settings, first-run and brainstorm processes run on the wizard engine and keep their reviewed plans. Evidence: `tests/tooling/interactive-maker-settings-integration.checks.mjs`, `tests/tooling/interactive-maker-first-run.checks.mjs`, `tests/tooling/interactive-maker-brainstorm-wizard.checks.mjs`
- [x] AC-4: `node bin/app new <dir>` and the framework `setup` interview, including the hosting choice, run on the wizard engine. Evidence: `tests/tooling/interactive-maker-starter-wizard.checks.mjs`, `tests/tooling/interactive-maker-hosting-wizard.checks.mjs`, `tests/tooling/framework-setup-journey.checks.mjs`
- [x] AC-5: `npm run setup` reads its questions from `configs/forms/setup-identity.json` and stops before asking when the form contains an unsupported kind, key or id. Evidence: `tests/tooling/setup-form.checks.mjs`
- [x] AC-6: Plugin features render JSON forms with `DataForm`, which validates drafts without persisting, and the runtime rejects CLI-only constructs. Evidence: `tests/runtime/data-form-components.test.ts`, `tests/runtime/data-form-definitions.test.ts`, `tests/tooling/interactive-maker-runtime-form-format.checks.mjs`
- [x] AC-7: Example removal still removes the showcase forms through reviewed hashes. Evidence: `tests/tooling/example-removal-rehearsal.checks.mjs`
- [x] AC-8: `fake-data` generates seeded, reproducible notes through one reviewed plan, refuses to overwrite existing notes, and saves and re-runs generation configs. Evidence: `tests/tooling/interactive-maker-fake-data-domain.checks.mjs`, `tests/tooling/interactive-maker-fake-data-command.checks.mjs`, `tests/tooling/interactive-maker-fake-data-wizard.checks.mjs`
- [x] AC-9: `learn` runs courses with checked wikilinks, forms, checklists, actions and win conditions, and saves progress only through a reviewed plan. Evidence: `tests/tooling/interactive-maker-learning-domain.checks.mjs`, `tests/tooling/interactive-maker-learning-cli.checks.mjs`, `tests/tooling/interactive-maker-learning-runner.checks.mjs`
- [x] AC-10: The `idea-to-prototype-with-claude-design` course cites only existing commands and its win conditions follow the real prototype package, design folder, release item and release candidate. Evidence: `tests/tooling/interactive-maker-learning-idea-to-prototype.checks.mjs`
- [x] AC-11: `process` checks the step graph and business rules, simulates a run and regenerates docs without overwriting edited generated blocks. Evidence: `tests/tooling/interactive-maker-process-domain.checks.mjs`, `tests/tooling/interactive-maker-process-rules.checks.mjs`, `tests/tooling/interactive-maker-process-docs.checks.mjs`
- [x] AC-12: `risk` keeps risks as typed Markdown notes in `paths.risks`, updates only named keys and keeps unrelated properties and the body. Evidence: `tests/tooling/interactive-maker-risk-domain.checks.mjs`, `tests/tooling/interactive-maker-risk-command.checks.mjs`
- [x] AC-13: `learning` keeps lessons learned as typed notes in `paths.learnings` with their review workflow. Evidence: `tests/tooling/interactive-maker-learnings-domain.checks.mjs`, `tests/tooling/interactive-maker-learnings-command.checks.mjs`
- [x] AC-14: `release-item` and `candidate` assemble and document release candidates through reviewed plans and never tag, publish or edit the changelog. Evidence: `tests/tooling/interactive-maker-release-items-command.checks.mjs`, `tests/tooling/interactive-maker-candidates-domain.checks.mjs`, `tests/tooling/interactive-maker-candidates-command.checks.mjs`
- [x] AC-15: `workflow` validates journeys as data, keeps a hash-protected note per workflow, runs them against loopback targets and writes screenshots as review evidence only. Evidence: `tests/tooling/interactive-maker-workflow-domain.checks.mjs`, `tests/tooling/interactive-maker-workflow-docs.checks.mjs`, `tests/tooling/interactive-maker-workflow-command.checks.mjs`

## Affected areas

- `bin/**`: the form and wizard engines, the new commands and the converted processes.
- `configs/forms/**`: reusable form definitions.
- `configs/wizards/**`: wizard definitions.
- `configs/guides/**`: the prototype guides moved from `bin/guides`.
- `configs/schemas/**`: JSON schemas of the new definition formats.
- `configs/fake-data/**`: fake-data entities and generation configs.
- `configs/learning/**`: learning paths and their Markdown content.
- `configs/processes/**`: business process definitions.
- `configs/collections/**`: typed-note collection definitions.
- `configs/tests/**`: browser test workflows.
- `src/**`: runtime forms, `DataForm`, the showcase Forms page and locales.
- `templates/examples/**`: example removal templates.
- `scripts/setup.mjs`: the setup form reader.
- `scripts/setup/**`: the setup form and hosting questions.
- `scripts/examples/**`: reviewed hashes for example removal.
- `scripts/quality/fallow-node-tests.json`: analyzer entry for browser workflow tests.
- `docs/development/**`: guides for every new capability.
- `docs/increments/**`: this Increment document.
- `docs/processes/**`: the generated release-approval process note.
- `docs/tests/**`: generated browser workflow notes.
- `docs/testing/**`: the test suite guide.
- `docs/user-manual/**`: the regenerated command manual manifest.
- `.claude/skills/**`: path references and the ideation tool map.
- `*.md`: `AGENTS.md`.
- `.gitignore`: local workflow reports.
- `.github/workflows/ci.yml`: the Windows showcase and example-removal job budgets for the added suites.
- `.github/workflows/setup-compatibility.yml`: the Windows setup job budget for the added suites.
- `package.json`: the `@faker-js/faker` dependency and scripts.
- `package-lock.json`: the locked dependency.
- `tests/**`: tests, fixtures and the suite manifest.

## Test plan

- Suite `maker`: the engines, every converted process and the new commands.
- Suite `cli`: command dispatch, help and JSON output.
- Suite `setup`: the setup form reader and hosting questions.
- Suite `generator`: generated projects run the CLI before dependencies are installed.
- Suite `workflows:browser`: browser test workflows against the loopback fixture.
- Gate `npm run verify -- --json --keep-going`: the full pre-PR gate.
- New test `tests/tooling/interactive-maker-wizard-catalog.checks.mjs`: every shipped wizard and form.
- New test `tests/tooling/interactive-maker-wizard-runner.checks.mjs`: the wizard runner.
- E2E: optional, because the showcase Forms page is covered by component tests and the served UI was not changed otherwise.

## Docs impact

- `docs/development/WIZARDS-AND-FORMS.md` (how-to): author wizards and forms.
- `docs/development/RUNTIME-FORMS.md` (how-to): runtime forms in plugin features.
- `docs/development/FAKE-DATA.md` (how-to): generate fake data.
- `docs/development/LEARNING-PATHS.md` (how-to): author and run learning paths.
- `docs/development/BUSINESS-PROCESSES.md` (how-to): author business processes.
- `docs/development/NOTE-COLLECTIONS.md` (reference): the typed-note collection engine.
- `docs/development/RISK-MANAGEMENT.md` (how-to): manage risks.
- `docs/development/LEARNINGS.md` (how-to): manage lessons learned.
- `docs/development/RELEASE-CANDIDATES.md` (how-to): manage release items and candidates.
- `docs/development/TEST-WORKFLOWS.md` (how-to): author and run browser test workflows.

## Changelog

- Added: Data-driven wizards and forms: every guided shell process (settings, first-run, project-setup, new project, prototype, brainstorm, the framework `setup` interview and stage approvals, and the `new <dir>` starter interview) is now a JSON wizard in `configs/wizards`, with reusable forms in `configs/forms`. New `node bin/app wizard` and `node bin/app form` commands run, list, show, check and validate them; a new guided process needs only JSON unless it calls a new service.
- Added: Browser test workflows: `node bin/app workflow` keeps Playwright journeys as data in `configs/tests/workflows/<id>.json` (offline/loopback targets: static folder, prototype package, loopback URL; accessibility-first data-only locators; inline and seeded fake-data test data with inert `{{data.path}}` templates; actions, assertions and review-only screenshot steps) with list/show/check/save/docs/run/record/export and `workflow new|edit` wizards. Each workflow has a generated, hash-protected note in `docs/tests/workflows`; runs use headless Chromium through the shared browser resolver and write reports and screenshots under `reports/workflows`; `export` plans an equivalent `@playwright/test` spec. Screenshots are never compared with baselines.
- Added: Release items and release candidates: `node bin/app release-item` keeps release items, the product changes a release ships (`type: ReleaseItem`, `ITEM-0001`, `paths.releaseItems`, default `docs/releases/items`; separate from the Increment documents of `node bin/app increment`), and `node bin/app candidate new|list|show|add|remove|status|docs|check` assembles, freezes and documents release candidates in `paths.releaseCandidates/<version>/README.md` (default `docs/releases/candidates`) through reviewed plans, with a generated release item table, risk summary, release checklist and changelog draft. Candidates never tag, publish or edit this changelog. The collection engine gains the generic `accepts` field option, managed fields and statuses, and named generated blocks.
- Added: Learning path `idea-to-prototype-with-claude-design`: an 11-step course from a brainstorm to a design brief in a new prototype folder, the Claude Design folder question and `design prepare`, designing and requesting the handover files in Claude Design, saving into `docs/design/<slug>` with `design sync`, implementing in the prototype and recording a release item in the next release candidate, with a glossary and a where-to-find-what table.
- Added: Lessons learned as typed Markdown notes: `node bin/app learning` lists, shows, checks, creates, updates, reviews and reports learnings (`type: Learning`, `LRN-0001` ids) in the configurable `paths.learnings` folder (default `docs/learnings`), with a draft → validated → applied workflow, follow-ups, related risk ids, a `learnings-demo` fake-data preset, and a generic `idPrefix` field option in the note-collection engine.
- Added: Risk management: `node bin/app risk` keeps a risk register as Markdown notes (`type: Risk`, `RISK-0001` ids) in the configurable `paths.risks` folder (default `docs/risks`), with list/show/check/new/update/report for agents (reviewed plans, `--apply <planHash>`), `risk new|edit|review` wizards, a probability × impact model in `configs/collections/risk.json`, a marker-preserving `risk-register.md` with a matrix and optional `risks.base`, and a `risk`/`risks-demo` fake-data preset. Built on a generic typed-note collection engine (`docs/development/NOTE-COLLECTIONS.md`).
- Added: Data-driven business processes: `node bin/app process` lists, shows, checks, saves, documents and simulates `configs/processes/<id>.json` (roles, steps, transitions, block/warn/info business rules with a safe JSON condition language, Markdown notes with checked wikilinks). `process new|edit|run` author and walk processes in a terminal through the form engine. Writes are reviewed, hash-approved plans, and docs regeneration keeps authored text and refuses edited generated blocks. Includes the `release-approval` example.
- Added: Data-driven learning paths: courses in `configs/learning/paths` teach a skill step by step with Markdown, checked documentation wikilinks, forms, checklists, safe actions (run a wizard, open a form, show a command) and win conditions (checklist, form, answer, file, wizard run and wizard check). `node bin/app learn` runs them in a terminal and resumes saved progress (`.workbench/learning/<id>.json`, written only through a reviewed plan); `learn list|show|check|status|complete-step|restart` serve agents. Ships "Author a data-driven wizard" and "Author a learning path".
- Added: The `node bin/app` CLI loads `yaml` lazily in the note-collection and fake-data code too, so it keeps running before dependencies are installed.
- Added: Fake-data generator: `node bin/app fake-data` creates seeded, reproducible Markdown notes with YAML frontmatter from built-in presets (contact, task, project, book, meeting), project definitions or saved-project entities, optionally with an Obsidian Bases table, through one reviewed file plan. Runs can be saved and re-run as generation configs in `configs/fake-data/generations`. Adds the exact dependency `@faker-js/faker` 10.6.0 (MIT), bundled into the kit with its license notice.
- Added: Data-driven forms in the plugin runtime: a feature ships a JSON form in `src/features/<feature>/forms/`, declares it with `defineForm` from the feature API and renders it with the shared `DataForm` component, which validates the draft and returns typed values without persisting anything. The runtime reads the same format as `configs/forms` but rejects CLI-only hooks and kinds; the showcase gains a Forms page.
- Changed: `node bin/app new <dir>` now runs its interview on the shared wizard engine (`configs/wizards/new-starter.json`). Starter inputs are asked as a generated form: choices and booleans are numbered menus, invalid answers are re-asked instead of ending the interview, and `:back` revisits earlier questions. Number form fields accept `required: false`.
- Changed: Prototype guides moved from `bin/guides` to `configs/guides`; their content, ids and versions are unchanged.
- Changed: `npm run setup` asks its identity, MCP and hosting-platform questions from `configs/forms/setup-identity.json` (shared form format) through a dependency-free reader, `scripts/setup/form.mjs`. Only `text`/`confirm` fields whose ids match the unchanged `--answers` keys are accepted; any other kind, key or id stops setup before a question is asked. Prompts now show human labels and help, e.g. `Plugin ID (id) [plugin-shell]: `.

## Risks and rollback

The converted interviews could ask questions in a different order or miss a default the
hand-written code had; the scripted interview tests pin the answers and plans. Every new
command writes only through reviewed, hash-approved plans, so a revert of this pull
request restores the previous interviews without migrating any data. Notes written by
`risk`, `learning`, `release-item` and `candidate` stay plain Markdown.

## Dependencies

Stacked on #74; merge after it.

## Open questions

None.

## Completion record

<!-- Generated by `npm run dod -- --write`; regenerate it instead of editing. -->

- Base: `origin/claude/pr73-docs-ci-workflows-m5erae` (merge base `8995f57999be`)
- Changed files: 351 (264 added, 83 modified, 2 renamed, 2 deleted)
- E2E decision: optional; `e2e` label not verifiable locally

### Changed files by area

| Area | Changed files |
| --- | ---: |
| `bin/**` | 118 |
| `configs/forms/**` | 24 |
| `configs/wizards/**` | 23 |
| `configs/guides/**` | 2 |
| `configs/schemas/**` | 8 |
| `configs/fake-data/**` | 13 |
| `configs/learning/**` | 17 |
| `configs/processes/**` | 4 |
| `configs/collections/**` | 3 |
| `configs/tests/**` | 2 |
| `src/**` | 21 |
| `templates/examples/**` | 2 |
| `scripts/setup.mjs` | 1 |
| `scripts/setup/**` | 2 |
| `scripts/examples/**` | 1 |
| `scripts/quality/fallow-node-tests.json` | 1 |
| `docs/development/**` | 14 |
| `docs/increments/**` | 1 |
| `docs/processes/**` | 1 |
| `docs/tests/**` | 2 |
| `docs/testing/**` | 1 |
| `docs/user-manual/**` | 3 |
| `.claude/skills/**` | 4 |
| `*.md` | 2 |
| `.gitignore` | 1 |
| `.github/workflows/ci.yml` | 1 |
| `.github/workflows/setup-compatibility.yml` | 1 |
| `package.json` | 1 |
| `package-lock.json` | 1 |
| `tests/**` | 73 |
| Outside the affected areas | 0 |

### Acceptance criteria evidence

| Criterion | Done | Evidence |
| --- | --- | --- |
| AC-1 | yes | `tests/tooling/interactive-maker-wizard-catalog.checks.mjs` |
| AC-2 | yes | `tests/tooling/interactive-maker-wizard-runner.checks.mjs` |
| AC-3 | yes | `tests/tooling/interactive-maker-settings-integration.checks.mjs`, `tests/tooling/interactive-maker-first-run.checks.mjs`, `tests/tooling/interactive-maker-brainstorm-wizard.checks.mjs` |
| AC-4 | yes | `tests/tooling/interactive-maker-starter-wizard.checks.mjs`, `tests/tooling/interactive-maker-hosting-wizard.checks.mjs`, `tests/tooling/framework-setup-journey.checks.mjs` |
| AC-5 | yes | `tests/tooling/setup-form.checks.mjs` |
| AC-6 | yes | `tests/runtime/data-form-components.test.ts`, `tests/runtime/data-form-definitions.test.ts`, `tests/tooling/interactive-maker-runtime-form-format.checks.mjs` |
| AC-7 | yes | `tests/tooling/example-removal-rehearsal.checks.mjs` |
| AC-8 | yes | `tests/tooling/interactive-maker-fake-data-domain.checks.mjs`, `tests/tooling/interactive-maker-fake-data-command.checks.mjs`, `tests/tooling/interactive-maker-fake-data-wizard.checks.mjs` |
| AC-9 | yes | `tests/tooling/interactive-maker-learning-domain.checks.mjs`, `tests/tooling/interactive-maker-learning-cli.checks.mjs`, `tests/tooling/interactive-maker-learning-runner.checks.mjs` |
| AC-10 | yes | `tests/tooling/interactive-maker-learning-idea-to-prototype.checks.mjs` |
| AC-11 | yes | `tests/tooling/interactive-maker-process-domain.checks.mjs`, `tests/tooling/interactive-maker-process-rules.checks.mjs`, `tests/tooling/interactive-maker-process-docs.checks.mjs` |
| AC-12 | yes | `tests/tooling/interactive-maker-risk-domain.checks.mjs`, `tests/tooling/interactive-maker-risk-command.checks.mjs` |
| AC-13 | yes | `tests/tooling/interactive-maker-learnings-domain.checks.mjs`, `tests/tooling/interactive-maker-learnings-command.checks.mjs` |
| AC-14 | yes | `tests/tooling/interactive-maker-release-items-command.checks.mjs`, `tests/tooling/interactive-maker-candidates-domain.checks.mjs`, `tests/tooling/interactive-maker-candidates-command.checks.mjs` |
| AC-15 | yes | `tests/tooling/interactive-maker-workflow-domain.checks.mjs`, `tests/tooling/interactive-maker-workflow-docs.checks.mjs`, `tests/tooling/interactive-maker-workflow-command.checks.mjs` |

### Gates

From `node bin/app check --plan`:

| Gate | Command | Required |
| --- | --- | --- |
| check | `node bin/app check --fast --base origin/claude/pr73-docs-ci-workflows-m5erae` | yes |
| coverage-production | `npm run test:coverage:production` | yes |
| check-presentation | `npm run check:presentation` | yes |
| suite:maker:pty | `node scripts/testing/suites.mjs maker:pty` | no |
| suite:maker | `node scripts/testing/suites.mjs maker` | yes |
| suite:workbench-plugins | `node scripts/testing/suites.mjs workbench-plugins` | no |
| suite:airship | `node scripts/testing/suites.mjs airship` | no |
| suite:compiler | `node scripts/testing/suites.mjs compiler` | yes |
| suite:compiler:properties | `node scripts/testing/suites.mjs compiler:properties` | no |
| suite:prototypes | `node scripts/testing/suites.mjs prototypes` | yes |
| suite:prototypes:python | `node scripts/testing/suites.mjs prototypes:python` | no |
| suite:companion:mvp | `node scripts/testing/suites.mjs companion:mvp` | no |
| suite:runtime | `node scripts/testing/suites.mjs runtime` | yes |
| suite:cli | `node scripts/testing/suites.mjs cli` | yes |
| suite:cli:journey | `node scripts/testing/suites.mjs cli:journey` | no |
| suite:generator | `node scripts/testing/suites.mjs generator` | yes |
| suite:visual | `node scripts/testing/suites.mjs visual` | no |
| suite:companion | `node scripts/testing/suites.mjs companion` | yes |
| suite:companion:schema | `node scripts/testing/suites.mjs companion:schema` | no |
| suite:companion:assembly | `node scripts/testing/suites.mjs companion:assembly` | no |
| suite:companion:browser | `node scripts/testing/suites.mjs companion:browser` | no |
| suite:companion:visual-browser | `node scripts/testing/suites.mjs companion:visual-browser` | no |
| suite:companion:starter-browser | `node scripts/testing/suites.mjs companion:starter-browser` | no |
| suite:test-data | `node scripts/testing/suites.mjs test-data` | no |
| suite:makers | `node scripts/testing/suites.mjs makers` | yes |
| suite:memory | `node scripts/testing/suites.mjs memory` | no |
| suite:memory:python | `node scripts/testing/suites.mjs memory:python` | no |
| suite:native | `node scripts/testing/suites.mjs native` | no |
| suite:setup | `node scripts/testing/suites.mjs setup` | yes |
| suite:acceptance | `node scripts/testing/suites.mjs acceptance` | no |
| suite:quality | `node scripts/testing/suites.mjs quality` | yes |
| suite:baseline | `node scripts/testing/suites.mjs baseline` | no |
| suite:workflows:browser | `node scripts/testing/suites.mjs workflows:browser` | yes |
| suite:e2e | `node scripts/testing/suites.mjs e2e` | no |
| suite:project | `node scripts/testing/suites.mjs project` | no |
| suite:project:ui-effects | `node scripts/testing/suites.mjs project:ui-effects` | no |
| suite:obsidian | `node scripts/testing/suites.mjs obsidian` | no |
| verify | `npm run verify` | yes |
