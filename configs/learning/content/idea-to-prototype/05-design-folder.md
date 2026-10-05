# Create the design folder

When the prototype maker has written the package, the app asks:

    Create a Claude Design folder at docs/design/<slug>? It holds the brief, screens, tokens and agent
    instructions for a design-to-code handoff.

The answer defaults to **No**. **Yes** prepares the folder: the app shows the complete file plan and writes it
only after you approve the review. The folder name is derived from the prototype title, so a title such as
`Reading log` becomes `docs/design/reading-log`. The folder root is `paths.design` (default `docs/design`).

If you answered No, or your slug differs from the title, prepare the folder yourself. Pass the package so the
folder uses the prototype's model and keeps its brief:

    node bin/app design prepare --name <slug> --project prototypes/<slug>/companion.project.json --package prototypes/<slug> --json
    node bin/app design prepare --name <slug> --project prototypes/<slug>/companion.project.json --package prototypes/<slug> --json --apply <planHash>

Without `--project`, the source is a managed prototype of the same name or the configured project model
(`design/project.json`); in a project without one, `prepare` fails with `DESIGN_SOURCE_MISSING`.
There is no `--yes`: the first command only plans, the second writes exactly the plan you reviewed.
Read [[docs/development/CLAUDE-DESIGN-HANDOFF#Commands|the design commands]] and
[[docs/development/CLAUDE-DESIGN-HANDOFF#Source of a folder|how the source is chosen]].

## What the folder contains

Generated (owned by sync, never edit): `README.md`, `AGENTS.md`, `CLAUDE.md`, `ENGINEERING_HANDOFF_GUIDE.md`,
`context/brief.md`, `context/screens.md`, `context/components.md`, `context/design-tokens.md`,
`context/project.json`, `handoff/HANDOFF.md` and `design.manifest.json`. Design work (created once, never
changed by the tool): `prototypes/`, `assets/`, `notes/decisions.md` and `handoff/implementation-map.md`.
See [[docs/development/CLAUDE-DESIGN-HANDOFF#Folder layout|the folder layout]] and
[[docs/development/CLAUDE-DESIGN-HANDOFF#Engineering handoff guide|what the engineering handoff guide is read from]].

Check the result with `node bin/app design status --name <slug> --json`: a fresh folder is `current`, its brief
points at `prototypes/<slug>/design-brief.md`, and every screen starts as `todo` in the implementation map.
