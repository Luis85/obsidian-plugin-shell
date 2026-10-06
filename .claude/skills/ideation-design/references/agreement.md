# Design gaps and agreement record

Use this as a working checklist. The canonical interview, board and agreement rules are in `.claude/skills/companion-prototype-design/SKILL.md` (sections 2–4), `.claude/skills/companion-prototype-design/references/design-interview.md` and `.claude/skills/companion-prototype-design/assets/templates/design-brief.md`; this file only maps them to the ideation chain.

## Gaps to close before agreement

| Area | Ready when | Typical source |
| --- | --- | --- |
| Journeys | Each primary journey has a start, steps, result and a recovery path | PRD jobs, concept interactions |
| Surfaces | Every page/view/modal has a purpose, entry point and stable ID | `feature.definition.json`, `sketch show` |
| Components | Each surface lists components from the template library or the project | `templates list`, `templates show` |
| Data | Entities, where they persist (Markdown, plugin data, none) and fixtures | PRD, concept entities |
| States | Empty, loading, invalid, failure with retry, cancel | prototype guide defaults |
| Visual | Direction in words; selected board revision if any | concept boards |
| Accessibility | Keyboard, focus, themes, reduced motion, narrow layouts | guide defaults |
| Acceptance | Observable Given/When/Then cases, including a negative one | PRD success signals |
| Integration | Host surfaces, targets, starter or saved project, baseline revision | concept handoff |

## Agreement record (keep in the conversation; persist only with approval)

```text
Brief version: v<N>   Mode: new-plugin | new-feature | improvement
Concept boards: selected <board id/revision> | skipped | unavailable (fallback accepted)
Accepted assumptions: <named, bounded, explicitly accepted>
Open questions: none
Agreement: "<the user's explicit words>" on <date>
```

## Maps to prototype answers

`node bin/app prototype guide --json` fields: `conceptBoards` (never `requested` when preparing), `boardDecisions`, `openQuestions` (must be empty), `approved` (true only with the record above). For project starters the same applies to the `new` request's `interview.answers`. The `approved` answer confirms the design only; every file write still needs its own reviewed `planHash`.

## Claude Design folder notes

`design prepare` writes generated context (`README.md`, `AGENTS.md`, `CLAUDE.md`, `context/*`, `handoff/HANDOFF.md`, `ENGINEERING_HANDOFF_GUIDE.md`, `design.manifest.json`) and creates design-work files once (`prototypes/`, `assets/`, `notes/`, `handoff/implementation-map.md`). A hand-edited generated file makes the plan fail with `DESIGN_FILE_CONFLICT`; move the edit into `notes/` rather than forcing. Prototype HTML from Claude Design is a reference, never source to paste.
