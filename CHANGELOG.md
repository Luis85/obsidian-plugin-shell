# Changelog

All notable changes to this project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Release tags are bare versions such as `1.2.3` (the Obsidian convention).

Versions 0.4.0 and 0.3.0 predate this format: their original prose is kept unchanged as the section body, and their dates are the dates of the commits that set those versions. Neither version was published, so their tags do not exist yet.

## [Unreleased]

### Added

- Tiered delivery pipeline: a fast Dev tier for every pull request including drafts, an Integration tier for pull requests marked ready for review and a Release tier that runs every check with full matrices on a `release/X.Y.Z` branch.
- Release cut and publish automation: `release:cut` creates the release branch from `main`, prepares version metadata, commits and opens a draft release pull request; `release:publish` merges the tested release head, creates the bare `X.Y.Z` tag and the GitHub release with the qualified candidate assets, then deletes the release branch. Both default to a dry-run plan and are idempotent on rerun.
- `release:changelog` validates this changelog and extracts one version's notes; release preparation promotes the Unreleased section into the new version.
- Archived historical development documents so current guidance stays discoverable.
- Data-driven wizards and forms: every guided shell process (settings, first-run, project-setup, new project, prototype, brainstorm, the framework `setup` interview and stage approvals, and the `new <dir>` starter interview) is now a JSON wizard in `configs/wizards`, with reusable forms in `configs/forms`. New `node bin/app wizard` and `node bin/app form` commands run, list, show, check and validate them; a new guided process needs only JSON unless it calls a new service.
- Data-driven business processes: `node bin/app process` lists, shows, checks, saves, documents and simulates `configs/processes/<id>.json` (roles, steps, transitions, block/warn/info business rules with a safe JSON condition language, Markdown notes with checked wikilinks). `process new|edit|run` author and walk processes in a terminal through the form engine. Writes are reviewed, hash-approved plans, and docs regeneration keeps authored text and refuses edited generated blocks. Includes the `release-approval` example.
- Data-driven learning paths: courses in `configs/learning/paths` teach a skill step by step with Markdown, checked documentation wikilinks, forms, checklists, safe actions (run a wizard, open a form, show a command) and win conditions (checklist, form, answer, file, wizard run and wizard check). `node bin/app learn` runs them in a terminal and resumes saved progress (`.workbench/learning/<id>.json`, written only through a reviewed plan); `learn list|show|check|status|complete-step|restart` serve agents. Ships "Author a data-driven wizard" and "Author a learning path".
- Fake-data generator: `node bin/app fake-data` creates seeded, reproducible Markdown notes with YAML frontmatter from built-in presets (contact, task, project, book, meeting), project definitions or saved-project entities, optionally with an Obsidian Bases table, through one reviewed file plan. Runs can be saved and re-run as generation configs in `configs/fake-data/generations`. Adds the exact dependency `@faker-js/faker` 10.6.0 (MIT), bundled into the kit with its license notice.
- Data-driven forms in the plugin runtime: a feature ships a JSON form in `src/features/<feature>/forms/`, declares it with `defineForm` from the feature API and renders it with the shared `DataForm` component, which validates the draft and returns typed values without persisting anything. The runtime reads the same format as `configs/forms` but rejects CLI-only hooks and kinds; the showcase gains a Forms page.

### Changed

- This changelog now follows Keep a Changelog 1.1.0, and release candidates carry only the released version's section as release notes.
- `node bin/app new <dir>` now runs its interview on the shared wizard engine (`configs/wizards/new-starter.json`). Starter inputs are asked as a generated form: choices and booleans are numbered menus, invalid answers are re-asked instead of ending the interview, and `:back` revisits earlier questions. Number form fields accept `required: false`.
- Prototype guides moved from `bin/guides` to `configs/guides`; their content, ids and versions are unchanged.
- `npm run setup` asks its identity and MCP questions from `configs/forms/setup-identity.json` (shared form format) through a dependency-free reader, `scripts/setup/form.mjs`. Only `text`/`confirm` fields whose ids match the unchanged `--answers` keys are accepted; any other kind, key or id stops setup before a question is asked. Prompts now show human labels and help, e.g. `Plugin ID (id) [plugin-shell]: `.

## [0.4.0] - 2026-09-23

Add the integrated maker catalog, optional-example removal and explicit plugin-data entities sharing serialized preference persistence. Preserve existing Markdown authority and protect uncertain writes. Add generated formatting, seeded data properties, rendered accessibility, targeted guard mutation and source/workflow checks. Prepare dependency freshness and fixed-commit retained-asset release rehearsal. No public release, tag or directory submission is performed.

## [0.3.0] - 2026-09-23

Template foundation development: reusable entities, Markdown repositories,
feature authoring and a Vue/Nuxt UI showcase. This version is not a published
release. Consult the iteration guides and actual test records for qualification
and outstanding support limitations.

[Unreleased]: https://github.com/Luis85/obsidian-plugin-shell/compare/0.4.0...HEAD
[0.4.0]: https://github.com/Luis85/obsidian-plugin-shell/releases/tag/0.4.0
[0.3.0]: https://github.com/Luis85/obsidian-plugin-shell/releases/tag/0.3.0
