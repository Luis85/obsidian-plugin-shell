# From an idea to a prototype with Claude Design

This course walks one idea through the whole design-to-code journey of this repository. You work on a
real prototype of your own; every step checks the files you produce.

1. **Brainstorm** the idea until its problem, users, options and non-goals are written down.
2. **Write the design brief**: the prototype maker creates a new prototype folder `prototypes/<slug>/`
   with `design-brief.md` and `execution-prompt.md`.
3. **Answer the design-folder question.** The app asks whether to create a Claude Design folder at
   `docs/design/<slug>`. Yes (or `node bin/app design prepare`) prepares the folder through a reviewed plan.
4. **Design in Claude Design.** Import `docs/design/<slug>` and build interactive prototypes.
5. **Ask Claude Design for the handover files** that the generated `AGENTS.md` and
   `ENGINEERING_HANDOFF_GUIDE.md` describe.
6. **Save the design into `docs/design/<slug>`** and keep the folder current with `design sync`.
7. **Implement** the `ready` screens in the prototype with Claude Code.
8. **Ship it in the next release candidate**: record an increment and add it to the candidate.

The tools prepare files only. They never call Claude Design, upload anything, commit or publish; importing
into Claude Design and exporting from it are your actions. Every write is shown as a plan first and needs
your approval (see [[docs/user-manual/shell-cli/automation-and-safety#The repeatable reviewed-plan pattern|the reviewed-plan pattern]]).

## Glossary

| Term | Meaning |
| --- | --- |
| Brief (design brief) | `prototypes/<slug>/design-brief.md`: the agreed problem, audience, outcome, scope, states and acceptance of one prototype, written by the prototype maker from your answers. Defaults you accept are recorded as assumptions. |
| Prototype package | The folder the prototype maker writes, `prototypes/<slug>/`: the brief, `execution-prompt.md` (a fresh-session prompt for an agent), `companion.project.json` (the project model), replayable answers, a manifest and a compiler-generated `source/` workspace. |
| Design folder | `docs/design/<slug>/`: a self-contained workspace you import into Claude Design on its own. Generated context (brief, screens, components, tokens, agent instructions) plus design work (`prototypes/`, `assets/`, `notes/`, the implementation map). |
| Handoff guide | Two generated files tell both agents what to deliver: `ENGINEERING_HANDOFF_GUIDE.md` (the target codebase read from its own files, with the checklist "Prepare the design for handoff") and `handoff/HANDOFF.md` (how Claude Code implements a ready prototype). `AGENTS.md` in the folder is the design agent's instruction file. |
| Implementation map | `docs/design/<slug>/handoff/implementation-map.md`: one row per screen with status `todo`, `designing`, `ready`, `implemented` or `verified`, its prototype files and acceptance notes. Designers and Claude Code edit it; sync never does. |
| Increment | A typed note (`type: Increment`, id like `INC-0001`) in `docs/releases/increments/` that records one shippable change and its `sources`, for example `prototypes/<slug>` and `docs/design/<slug>`. *Release-candidate feature.* |
| Release candidate | `docs/releases/candidates/<version>/README.md` (`type: ReleaseCandidate`): the increments planned for the next version. It is a planning record, not the plugin publication flow of [[docs/development/MAINTENANCE-AND-RELEASE|the maintenance and release guide]]. *Release-candidate feature.* |

## Where to find what

| Path | What it is | Written by |
| --- | --- | --- |
| `.workbench/learning/idea-to-prototype-with-claude-design.json` | Your progress in this course | `learn`, after review |
| `configs/user-settings.json` | Folder settings: `paths.prds`, `paths.prototypes`, `paths.design` | `node bin/app settings` |
| `docs/prds/<id>.md` | PRD draft from a brainstorm with Claude Code | `ideation-brainstorm` skill, after your yes |
| `design/project.json` | The saved project model; feature brainstorms need it | `node bin/app sketch`, setup |
| `brainstorms/<slug>/` | Feature brainstorm package: `feature.definition.json`, `candidate.project.json`, `README.md` | `node bin/app brainstorm` |
| `prototypes/<slug>/design-brief.md` | The design brief | `node bin/app prototype` |
| `prototypes/<slug>/execution-prompt.md` | Fresh-session prompt for implementing the prototype | `node bin/app prototype` |
| `prototypes/<slug>/companion.project.json` | The prototype's project model; the design folder's source | `node bin/app prototype` |
| `prototypes/<slug>/README.md`, `INTEGRATION.md` | How to build the package and how it maps to the compiler | `node bin/app prototype` |
| `prototypes/<slug>/source/` | Generated workspace in which the prototype is implemented | `node bin/app prototype` |
| `docs/design/<slug>/README.md` | How to import the folder and keep it in sync | `design prepare`, `design sync` |
| `docs/design/<slug>/AGENTS.md`, `CLAUDE.md` | Instructions for Claude Design (and Claude Code) | `design prepare`, `design sync` |
| `docs/design/<slug>/ENGINEERING_HANDOFF_GUIDE.md` | Target stack, screen-to-code map, components, tokens, budgets, handoff checklist | `design prepare`, `design sync` |
| `docs/design/<slug>/context/` | `brief.md`, `screens.md`, `components.md`, `design-tokens.md`, `project.json` | `design prepare`, `design sync` |
| `docs/design/<slug>/handoff/HANDOFF.md` | Checklist for Claude Code | `design prepare`, `design sync` |
| `docs/design/<slug>/handoff/implementation-map.md` | Screen status table | Seeded once, then you, Claude Design and Claude Code |
| `docs/design/<slug>/prototypes/`, `assets/`, `notes/decisions.md` | Exported prototypes, images and decisions | Seeded once, then your design work |
| `docs/design/<slug>/design.manifest.json` | Source, brief and the hash of every generated file | `design prepare`, `design sync` |
| `.claude/skills/ideation-journey/SKILL.md` | Router of the ideation skill chain (brainstorm, concept, design, prototype, boilerplate) | Repository skill |
| `.claude/skills/companion-prototype-design/SKILL.md` | Design interview, concept boards and prototype execution | Repository skill |
| `docs/releases/increments/` | Increment notes | `node bin/app increment new` |
| `docs/releases/candidates/<version>/README.md` | The release candidate | `node bin/app candidate new` and `candidate add` |

The repository skills live under `.claude/skills/`; learning paths can only link pages under `docs/`, `bin/`
and the repository root, so open those skill files directly.
