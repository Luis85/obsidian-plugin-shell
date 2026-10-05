# Ask Claude Design for the handover files

A design is ready to hand over when Claude Code can implement it without guessing. The folder already tells
Claude Design exactly what to deliver; your job is to ask for it and check the result.

## What the generated documents require

From section 8 of `ENGINEERING_HANDOFF_GUIDE.md`, "Prepare the design for handoff":

1. One prototype per screen ID, saved as `prototypes/<screen-id>--<variant>.html` (for example
   `node-1--compact.html`): self-contained, inline CSS and JavaScript, sample data only, no remote fonts,
   scripts, images or network requests.
2. `data-design-id` on every screen, component and interaction element, using the IDs from the guide and
   `context/components.md`.
3. Colours, spacing, radius and type only from the guide's styling contract; every new value noted in
   `notes/decisions.md` with the closest existing token.
4. Built from the listed components; anything new is justified in `notes/decisions.md`.
5. Empty, loading, error and populated states, keyboard focus and both themes for every screen that lists or
   edits data.
6. Repeated regions marked as named components, so each implementation file stays within the size budget.
7. Business rules, persistence and permissions described in `notes/decisions.md`, not encoded in prototype
   scripts.
8. In `handoff/implementation-map.md`, the prototype files and target files listed, then the row set to `ready`.

From "Hand off to Claude Code" in `AGENTS.md`: set each finished row to `ready`, list its prototype files, write
acceptance notes a reviewer can check, and save the files into the folder.

## A request you can paste into Claude Design

    Prepare the handover for Claude Code. Follow "Prepare the design for handoff" in
    ENGINEERING_HANDOFF_GUIDE.md and "Hand off to Claude Code" in AGENTS.md: save each finished screen as
    prototypes/<screen-id>--<variant>.html with data-design-id attributes, put exported images in assets/,
    record decisions, new tokens and open questions in notes/decisions.md, and in
    handoff/implementation-map.md list the prototype files and acceptance notes and set each finished row
    to ready. Do not edit any generated file.

Review the answer against the eight points above before you export. Statuses move `todo` → `designing` →
`ready`; `implemented` is set by Claude Code and `verified` by a human reviewer. More in
[[docs/development/CLAUDE-DESIGN-HANDOFF#Journey|the design-folder journey]].
