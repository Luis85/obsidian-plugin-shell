# Claude Design folders

Every prototype can have its own **design folder**: a self-contained workspace that a designer imports
into Claude Design on its own, without the rest of the repository. It carries the prototype's brief,
screens, components, the platform's design tokens and agent instructions. Interactive prototypes made
in Claude Design are saved back into the folder, and Claude Code implements them from there in the
frontend. The goal is a short path from a design session to an app-compatible prototype to a shippable
increment.

## Journey

1. Create and set up the project, for example with `node bin/app new`.
2. Create the first prototype through the app: `node bin/app` → **Prepare a prototype with the guided
   maker**, `node bin/app prototype`, or a managed prototype with `node bin/app prototypes create`.
3. After a prototype or a new project is written, the app asks **Create a Claude Design folder at
   `docs/design/<prototype>`?** The answer defaults to No. Yes shows the complete file plan for review
   and writes it only after approval.
4. A designer pulls the project and imports `docs/design/<prototype>` into Claude Design. Claude Design
   reads `AGENTS.md` and builds interactive prototypes into `prototypes/`, records decisions in `notes/`
   and marks screens `ready` in `handoff/implementation-map.md`.
5. A developer asks Claude Code to implement the `ready` rows following `handoff/HANDOFF.md` and the
   root `AGENTS.md` gates.
6. When the project model changes, `node bin/app design status` reports the folder as stale and
   `node bin/app design sync --name <prototype>` regenerates its context.

The studio also has **Prepare or sync a Claude Design folder for this project**, which uses the
saved project JSON.

## Commands

```sh
node bin/app design status --json                       # every folder under the design root
node bin/app design status --name issue-desk --json     # one folder
node bin/app design prepare --name issue-desk --json    # plan; nothing is written
node bin/app design prepare --name issue-desk --json --apply <planHash>
node bin/app design sync --name issue-desk --json --apply <planHash>
```

`prepare` creates a folder or refreshes an existing one; `sync` requires a prepared folder. Both return
a plan and its `planHash` first. Repeat the same command with `--apply <planHash>` to write, as with
every other maker command. There is no `--yes`.

| Option | Meaning |
| --- | --- |
| `--name <slug>` | Folder name: a lowercase prototype slug (letters, digits, single hyphens, at most 48 characters, like a managed prototype ID). |
| `--project <path>` | Use this project JSON as the source instead of a managed prototype or the folder's saved source. |
| `--package <folder>` | A prepared prototype package; its `design-brief.md` becomes the folder's brief. |
| `--root <folder>` | Project root, as for the other maker commands. |

### Source of a folder

- An explicit `--project` always wins.
- A folder that was synced before keeps its source kind (project JSON or managed prototype).
- A new folder whose name matches a managed prototype in `docs/concepts/` uses that prototype's active
  variant, or else the newest version's first unarchived variant.
- Otherwise the configured project (`paths.project`, by default `design/project.json`).

The guided prototype maker passes its prepared package (`<out>/companion.project.json` and
`<out>/design-brief.md`). The new-project wizard prepares the folder inside the generated source
(`<out>/source/docs/design/<prototype>`) from its `design/project.json`, and keeps the package brief as
`notes/prototype-brief.md` because the package lies outside that project.

## Folder layout

| Path | Owner | Contents |
| --- | --- | --- |
| `README.md` | Generated | How to import the folder into Claude Design and keep it in sync. |
| `AGENTS.md`, `CLAUDE.md` | Generated | Instructions for the design agent; `CLAUDE.md` imports `AGENTS.md`. |
| `context/brief.md` | Generated | Project identity, target, scope and the prepared prototype brief. |
| `context/screens.md` | Generated | Every screen with its stable ID, route, components, interactions, acceptance and journeys. |
| `context/components.md` | Generated | The component library and where each component is used. |
| `context/design-tokens.md` | Generated | Obsidian CSS variable names for plugin targets; guidance for other targets. |
| `context/obsidian-tokens.json` | Generated | Plugin targets only: the reviewed token inventory from `docs/design/obsidian-tokens.json`. |
| `context/project.json` | Generated | The exact project model snapshot. |
| `handoff/HANDOFF.md` | Generated | Checklist for Claude Code to implement a ready prototype. |
| `handoff/implementation-map.md` | Design work | One row per screen: status, prototype files, acceptance notes. |
| `prototypes/`, `assets/`, `notes/` | Design work | Prototypes, exported images, decisions. |
| `design.manifest.json` | Generated | Source path and hash, target, folder and the hash of every generated file. |

The platform section follows the saved project starter (`project.config.json`). Without one, the shell
itself is described: an Obsidian plugin with a Vue 3 and Nuxt UI frontend.

## Sync rules

- Generated files are rewritten only while they still hold the bytes recorded in the manifest. A hand
  edit, or a file that this tool did not write, makes the plan fail with `DESIGN_FILE_CONFLICT` and
  nothing is written. Move the edit into `notes/` or `prototypes/`, or delete the file to regenerate it.
- Design-work files are created once, when absent, and never changed or deleted afterwards.
- A generated file that a newer version no longer produces is reported as `retired` and left in place.
- Applying re-checks the source hash; a project changed after review fails with `MAKER_STALE`.
- A recorded brief that is gone keeps its reference: `prepare` and `sync` fail with
  `DESIGN_BRIEF_MISSING` until it is restored or the folder is prepared again with `--package`.
- `status` reports `current`, `stale` (the source changed, or the folder moved since it was rendered),
  `source-missing` or `unmanaged` (a folder without a manifest), plus the brief reference and whether it
  is missing, edited generated files, the prototype files and the implementation-map status counts. Only
  an absent source counts as `source-missing`; cancellation, corrupt project JSON and other read errors
  are reported as errors. It never writes.

## Configuration

The design root defaults to `docs/design`. Set `paths.design` in `configs/user-settings.json` to change
it. The key is optional so that existing settings and saved setup state keep their exact path set.
The root must not overlap another configured path (`DESIGN_ROOT_OVERLAP` or `SETTINGS_OVERLAP`). Moving
an existing root is a reviewed file migration (`node bin/app settings migrate`) like the other folders;
afterwards the folders report `stale` until synced, because their instructions name the folder path.

## Boundaries

- The tool prepares files only. It does not call Claude Design, upload anything or sync with a
  claude.ai project; import and export are the designer's actions.
- Prototype HTML is a reference for Claude Code, never source to paste. The implementation uses the
  project's components, tokens and gates, and screenshots stay review evidence, not baselines.
- A prototype that adds structure (a screen, component or interaction) changes the project model first;
  the folder follows on the next sync.
- Tests: `tests/tooling/interactive-maker-design-folder*.checks.mjs` in the `maker` suite.
