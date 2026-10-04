# Design in Claude Design

The design folder is made to be imported on its own: Claude Design does not need the rest of the repository.

1. Pull or commit so `docs/design/<slug>` matches the current project model. `node bin/app design status --name <slug> --json`
   should report `current`; if it reports `stale`, run `design sync` first (step *Save the design and sync*).
2. In Claude Design, start a project and import the folder `docs/design/<slug>`: attach it as a local folder, or
   link the repository and select this folder.
3. Ask Claude Design to read `AGENTS.md` first. `CLAUDE.md` only imports it.
4. Ask for an interactive prototype for one screen or flow from `context/screens.md`, then iterate.

What the design agent is told (in `AGENTS.md`), so you can review its work:

- Read `context/brief.md`, `context/screens.md`, `context/components.md`, `context/design-tokens.md`,
  `context/project.json` and `ENGINEERING_HANDOFF_GUIDE.md` first.
- Keep the screen IDs and titles. A new screen, component or interaction is proposed in `notes/decisions.md` and
  as a `proposed` row in the implementation map, never added silently.
- Use the token names from `context/design-tokens.md` as CSS custom properties with a neutral fallback, for
  example `var(--text-normal, #222)`. No second palette, no hard-coded brand colours.
- Every screen works in light and dark themes, at narrow width and from the keyboard with visible focus, and shows
  empty, loading, error and populated states.
- Only `prototypes/`, `assets/`, `notes/decisions.md` and `handoff/implementation-map.md` may change; everything
  else is generated.

The repository never talks to Claude Design: importing and exporting are your actions
([[docs/development/CLAUDE-DESIGN-HANDOFF#Boundaries|boundaries]]). For a design interview and image-based concept
boards before or alongside Claude Design, the `ideation-design` skill delegates to `companion-prototype-design`
(`.claude/skills/companion-prototype-design/SKILL.md`).
