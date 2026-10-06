# Implement the ready screens in the prototype

Now Claude Code turns the `ready` rows into code. Two generated documents drive it:

- `docs/design/<slug>/handoff/HANDOFF.md`: before starting, run `node bin/app design status --name <slug>` and sync
  a stale folder; build only `ready` rows; read their prototype files, the screen in `context/screens.md`, the
  decisions in `notes/decisions.md` and `ENGINEERING_HANDOFF_GUIDE.md`.
- `prototypes/<slug>/execution-prompt.md`: the fresh-session prompt for the prototype package. Work in
  `prototypes/<slug>/source/`, read `source/AGENTS.md` and the `companion-prototype-design` skill first (in this
  repository: `.claude/skills/companion-prototype-design/SKILL.md`), and do not commit, push or publish without
  separate authorization.

## A request you can paste into Claude Code

    Implement the ready rows of docs/design/<slug>/handoff/implementation-map.md, following
    docs/design/<slug>/handoff/HANDOFF.md, inside the prototype package prototypes/<slug>/source/
    as described by prototypes/<slug>/execution-prompt.md.

## Rules the implementation follows

- A prototype HTML file is a visual and behavioural reference, never source to paste. Rebuild it with the project's
  components, composables, stores and tokens; no inline styles, copied colour literals or remote assets.
- Map `data-design-id` attributes to the screen, component and interaction IDs and keep them in test selectors
  where the conventions allow it.
- A prototype that adds a screen, component or interaction changes the project model first (for example with
  `node bin/app sketch`), then the folder follows with `node bin/app design sync --name <slug>`.
- Business behaviour, persistence and permissions come from the requirements, not from prototype sample data.

## Build and verify

The package `README.md` ("Build after implementation") lists the exact install, type-check and standalone HTML
build commands for `source/`. The prototype tooling is described in
[[docs/development/PROTOTYPE-TOOLING#Entry points|prototype tooling]] (`npm run prototype:tools -- discover --repo .`
shows the available commands) and the offline clickdummy in
[[docs/development/COMPANION-CLICKDUMMY#Generate and build|the clickdummy guide]]. Angular projects use the
[[bin/ANGULAR-BRICKS|Angular bricks]]. Run the gates of the root [[AGENTS]] file, at least `node bin/app check`
([[docs/user-manual/shell-cli/development-and-testing#Choose the right test/check|choose the right check]]).
A successful build or screenshot is review evidence, not native or business acceptance.

When a screen is built, Claude Code sets its row to `implemented` with the commit or pull request;
`verified` is set by a human after review. This step checks for an `implemented` row.
