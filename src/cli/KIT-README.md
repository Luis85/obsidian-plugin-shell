# Workbench X.Y.Z: Obsidian plugin shell kit

This folder is the downloadable Workbench CLI. It creates Obsidian plugins on the
Plugin Shell: TypeScript, Vue 3, Pinia, Nuxt UI, Vite and Vitest, with a fixed
architecture, generators and one quality gate. It needs Node.js 22.13 or newer and
nothing else: no clone, no global install and no `node_modules` for the kit itself.

## Which download you have

| Download | Contains | Use it when |
| --- | --- | --- |
| `workbench-shell-with-starters-X.Y.Z.zip` | The CLI and every project starter in `configs/starters/` | You want to start or migrate a plugin now. Recommended. |
| `workbench-shell-X.Y.Z.zip` | The CLI only | You bring your own project JSON exported by the companion (`new --from`), or only analyze an existing project (`adopt`). |

Both come with `workbench-distributions.json` and `workbench-SHA256SUMS`. Check the
ZIP before you extract it; a checksum detects a damaged download, it does not prove
where the file came from, so download only from the project's GitHub release page.

```text
bin/app             the only entry point: node bin/app help
bin/                runtime, templates, tools and licenses; keep the folder together and do not edit it
configs/starters/   starter definitions (only in the with-starters download)
package.json        npm aliases for the same commands (npm run new, npm run help)
README.md           this file
LICENSE
```

## Start a plugin in five commands

```sh
sha256sum --check --ignore-missing workbench-SHA256SUMS
mkdir workbench && cd workbench && unzip ../workbench-shell-with-starters-X.Y.Z.zip
node bin/app new --list
node bin/app new ../my-notes --starter blank --id my-notes --name "My Notes" --author "Your Name"
node bin/app new ../my-notes --starter blank --id my-notes --name "My Notes" --author "Your Name" --yes
```

The fourth command only previews the files. The fifth writes the project into a
new or empty folder outside this kit and outside any Obsidian vault. Then:

```sh
cd ../my-notes
npm ci
npm run check
```

Read the new project's `AGENTS.md` and `BRIEF.md` next. The project is independent
of this folder: it carries its own copy of the CLI (`node bin/app`), its own
documentation under `docs/framework/` and the same `check` gate.

Plugin IDs use lowercase letters, digits and hyphens and must not contain
`obsidian` or `plugin`. `blank` gives an empty workspace; the everyday starters
(`quick-capture`, `daily-journal`, `tasks-projects`, `vault-dashboard` and others)
add a designed workspace. The `plugin-*`, `webapp-*`, `hybrid-*`, `cli` and
`website` starters are project starters that begin with a prototype interview:
`node bin/app new --starter plugin-nuxtui` in a terminal, or
`node bin/app new guide --starter plugin-nuxtui --json` for agents.

## Stay inside the framework

Every generated project enforces these boundaries with `npm run check`. Put code
where the framework expects it and the generators, gates and upgrades keep working.

| Concern | Where it belongs |
| --- | --- |
| Business features | `src/plugin/features/<name>/`, importing only `src/plugin/features/api.ts`. One registration in `src/plugin/bootstrap/`. |
| Commands and ribbon icons | Feature command factories, joined in the bootstrap command registry. |
| Dialogs and notices | `services.modals` and `services.notices`; features never construct `Modal` or `Notice`. |
| Settings and stored data | Plugin-data entities and preferences through the one `PluginDataStore`; never a second `saveData` path. |
| Notes | Repositories that keep note IDs, unrelated frontmatter and body text. |
| UI | Vue files under `src/plugin/presentation/components`; behaviour in composables, per-view state in stores. |
| Domain and application | Framework-free: no `obsidian`, Vue, browser or Node imports. |
| `main.ts` | Lifecycle composition only, at most 100 code lines. |
| File size | At most 400 code lines per source file and 450 per test file. |

`npm run make -- --list` shows the generators for features, entities, commands and
events. Guides shipped in this kit: [build a feature](../../docs/development/BUILD-A-FEATURE.md),
[commands and ribbon](../../docs/development/COMMANDS-AND-RIBBON.md),
[modals and notices](../../docs/development/MODALS-AND-NOTICES.md),
[plugin-data entities](../../docs/development/PLUGIN-DATA-ENTITIES.md),
[presentation structure](../../docs/development/PRESENTATION-STRUCTURE.md),
[authoring tools](../../docs/development/AUTHORING-TOOLS.md) and
[adopt an existing project](../../docs/development/ADOPT-EXISTING-PROJECT.md).

## Prompts for an AI coding agent

Copy one prompt into Claude Code, Codex or another coding agent that can run
commands. Replace the values in angle brackets first. Both prompts name this
release, X.Y.Z, so the agent downloads exactly the kit you are reading about.

### 1. Install Workbench and start a new plugin

```text
Set up the Workbench Obsidian plugin shell and start a new plugin with me.

1. Work in <parent folder>. If it has no extracted Workbench kit (a folder with bin/app
   and configs/starters/), download workbench-shell-with-starters-X.Y.Z.zip and
   workbench-SHA256SUMS from https://github.com/Luis85/obsidian-plugin-shell/releases/tag/X.Y.Z,
   run `sha256sum --check --ignore-missing workbench-SHA256SUMS` and stop if it does not
   print OK. Extract the ZIP into a new empty folder named workbench.
2. Check `node --version` is 22.13 or newer. Do not run npm install in the kit folder.
3. In the kit folder run `node bin/app new --list`. Ask me what the plugin should do,
   recommend a starter (blank unless a listed starter fits), and agree a plugin ID
   (lowercase, hyphens, without "obsidian" or "plugin"), a display name and an author.
4. Preview: `node bin/app new ../<id> --starter <starter> --id <id> --name "<name>" --author "<author>"`.
   Show me the summary. After I agree, run the same command with `--yes`. The target
   must be a new folder outside the kit and outside any Obsidian vault.
5. In the new project run `npm ci` and `npm run check`, and show me the real output.
6. Read the project's AGENTS.md and BRIEF.md. Fill BRIEF.md with me: goal, users,
   must-have journeys, out of scope. Do not invent product behaviour.
7. Stop and summarise: the project folder, the commands you ran with their results,
   and the first feature you propose to build with `npm run make -- --list`.

Rules: follow the project's AGENTS.md. Preview before you write. Report actual command
output, never assumed success. Never open a personal vault, publish, tag, push or
install global packages unless I ask.
```

### 2. Migrate an existing plugin into a clean shell

```text
Migrate my existing Obsidian plugin at <old plugin folder> into a clean Workbench
plugin shell, built inside the shell's boundaries and concerns.

1. Treat <old plugin folder> as read-only. Note whether it is a clean Git checkout.
2. Get the kit: download workbench-shell-with-starters-X.Y.Z.zip and
   workbench-SHA256SUMS from https://github.com/Luis85/obsidian-plugin-shell/releases/tag/X.Y.Z,
   check them with `sha256sum --check --ignore-missing workbench-SHA256SUMS`, and extract
   the ZIP into a new empty folder <kit folder> next to the old plugin, not inside it.
3. Analyze without changing anything: `node <kit folder>/bin/app adopt analyze --target <old plugin folder>`.
   Then read the old manifest.json, package.json, main entry, settings tab, commands,
   ribbon icons, views, event handlers, vault reads and writes, every loadData/saveData
   call with the shape of its data, styles and dependencies.
4. Write a migration map as a table: each old capability, the shell location it moves
   to (feature in src/plugin/features/<name>, command factory, services.modals or
   services.notices, plugin-data entity or preference, note repository, Vue component
   plus composable, scoped style), and anything that cannot fit. Show it to me and wait.
5. Create the clean project with the old plugin's manifest id, so existing users keep
   their settings and data.json:
   `node <kit folder>/bin/app new <new project folder> --starter blank --id <old id> --name "<old name>" --author "<author>"`
   Preview first, apply with `--yes` after I agree. If the CLI refuses the ID (for example
   it contains "obsidian" or "plugin"), stop and ask me: a new ID is a new plugin for
   every user and needs an explicit data migration.
6. In the new project: `npm ci`, `npm run check` (green before porting), then read AGENTS.md.
   Set manifest.json minAppVersion to at least the old one and plan the next version above
   the old release with me.
7. Port one capability at a time, smallest first. Scaffold with the generators that
   `npm run make -- --list` shows (preview each with `--dry-run`), keep host UI behind services.modals and services.notices, keep main.ts lifecycle only,
   and read the old data.json shape through a plugin-data entity or preference that keeps
   unknown fields. Write tests that run the real services, including one that loads a copy
   of an old data.json. Run `npm run check` after each capability and show the output.
8. When nothing uses the Task, Project and Items examples any more, remove them with
   `npm run examples:remove` (preview, then apply).
9. Verify in the contained sandbox only: `npm run -s dev:obsidian -- --json`, after I have
   allowed the Obsidian download. Never point a tool at my personal vault.
10. Stop and report: the migration map with each row ported, partly ported or not ported,
    every command with its real output, behaviour that changed for users, and open
    questions. Do not delete or edit the old plugin, publish, tag or push unless I ask.
```
