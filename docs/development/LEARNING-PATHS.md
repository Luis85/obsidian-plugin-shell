# Learning paths

> Type: how-to guide and reference · Part of the [docs index](../README.md)

A **learning path** is a course: an ordered, step-by-step tutorial that teaches one skill of this repository.
Paths are JSON files in `configs/learning/paths/`, run by `node bin/app learn`. Each step can show
Markdown and links to the documentation, ask a form, offer a checklist and safe actions, and decides its
own completion through **win conditions**. Paths build on the [data-driven wizards and forms](WIZARDS-AND-FORMS.md):
they reuse the same forms, form runner, conditions and inert `{{path}}` templates, and they run registered wizards.

| Path | Teaches | Recommended first |
| --- | --- | --- |
| `author-a-wizard` | Plan, write, check and run your own wizard and form | — |
| `author-a-learning-path` | Write and validate a learning path | `author-a-wizard` |
| `idea-to-prototype-with-claude-design` | Brainstorm an idea, write its design brief in a new prototype folder, prepare a [Claude Design folder](CLAUDE-DESIGN-HANDOFF.md), get the handover files from Claude Design, save and sync them, implement the ready screens in the prototype and plan the result into the next [release candidate](RELEASE-CANDIDATES.md) | — |

The last two steps of `idea-to-prototype-with-claude-design` use the increment and release-candidate commands
(`node bin/app increment`, `node bin/app candidate`) and link their guide; the course's checks follow the files those
commands write (`docs/releases/increments/`, `docs/releases/candidates/<version>/README.md`).

## Follow a learning path

```sh
node bin/app learn                          # choose a path in a terminal
node bin/app learn --name author-a-wizard   # start or resume one path
```

The overview shows the summary, skill, audience, estimated time, recommended paths and every step.
With saved progress you choose **Resume**, **Restart** (from the first step) or **Exit**. Each step then shows its
goal, lesson, documentation links, checklist, actions and win conditions, and a menu to:

- fill in the step form, tick the checklist or trigger an action;
- **check the win conditions and complete the step** (every unmet condition is listed with its reason);
- go to the next step (once this one is completed) or back to the previous one;
- exit, which offers to save your progress.

Steps are learned in order: a step opens once every earlier step is completed. Recommended paths are shown
with their completion state but never block a start. In the terminal UI the step text is a scrollable review
page; with plain prompts it is printed, `:back` returns to the previous step, and Enter keeps the shown default.

### Progress

Progress is saved to `.workbench/learning/<path-id>.json` in the project (`--root`): the current step, completed
steps with their timestamps, form answers, ticked checklist items and the wizards you ran to their end.
`.workbench/` holds Workbench state; `.workbench/learning/` is personal learner state and is ignored by Git.

- **Reviewed writes.** Like a setup checkpoint, progress is written only through a reviewed, default-No file plan when you
  leave (or finish) a path, and only when the file still has the bytes that were loaded. Declining keeps the file unchanged.
- **Fail closed.** A progress file that is unreadable, belongs to another path or names steps or checklist items that no longer exist
  is reported and left byte for byte; restart explicitly.
- **Restart.** Choosing Restart changes the saved file only at the next reviewed save. `learn restart` plans removing it.
- **No approvals.** Progress never stores an approval: every write or process a step's wizard performs is approved inside that wizard.

## Commands for agents and scripts

```sh
node bin/app learn list --json                      # paths with a progress summary for --root
node bin/app learn show --name author-a-wizard --json   # definition, Markdown and resolved doc links per step
node bin/app learn check --json                     # validate paths, content, forms, wizards and doc links
node bin/app learn status --name author-a-wizard --json # progress and every win condition per step
node bin/app learn complete-step --name author-a-wizard --step plan-your-wizard --input step.json --json
node bin/app learn complete-step --name author-a-wizard --step plan-your-wizard --input step.json --apply <planHash> --json
node bin/app learn restart --name author-a-wizard --json  # then --apply <planHash>
```

`complete-step` takes an optional input with the step's form answers, ticked checklist items and an optional
completion time:

```json
{ "schemaVersion": 1, "answers": { "purpose": "Collect a contact", "formId": "contact", "wizardId": "onboarding" }, "checklist": [] }
```

Answers are validated like `form validate` and refused when invalid. Every win condition is then evaluated
against the would-be progress. A step with an unmet condition returns `status: "blocked"` with the `unmet` list
and no plan. A met step returns a planned progress file; repeat the command with `--apply <planHash>` to write it.
Without `completedAt` the completion is recorded at day precision (UTC midnight), so the same command
reproduces the reviewed `planHash`. Steps must be completed in order.

`wizard-completed` cannot be claimed this way: running a wizard is interactive. A step with that condition
can only be completed with `node bin/app learn` in a terminal.

## Write a learning path

1. Pick a kebab-case id and create `configs/learning/paths/<id>.json`. The file name must equal the id.
2. Write the steps. Put longer Markdown in `configs/learning/content/<id>/<file>.md`.
3. Run `node bin/app learn check --json` until `issues` is empty, then `node bin/app learn --name <id>`.

No TypeScript is needed. Forms come from `configs/forms` or inline `fields`, and wizards from `configs/wizards`.
The action and condition kinds below are the complete, code-defined vocabulary.

### A minimal path

```json
{
  "$schema": "../../schemas/learning-path.schema.json",
  "schemaVersion": 1, "id": "first-steps", "version": 1,
  "title": "First steps", "summary": "Find your way around the CLI.", "skill": "Using node bin/app",
  "audience": "New contributors", "prerequisites": [], "estimatedMinutes": 10,
  "steps": [
    {
      "id": "explore", "title": "Explore the commands", "goal": "Know where the CLI help lives.",
      "markdown": "Read [[docs/development/WIZARDS-AND-FORMS#Run, inspect and check|the commands]].",
      "checklist": [{ "id": "help", "label": "I ran node bin/app --help" }],
      "actions": [{ "id": "help", "kind": "command", "label": "Show the help", "command": "node bin/app --help" }],
      "winConditions": [{ "kind": "checklist-complete" }]
    }
  ]
}
```

## Reference

### Path

| Key | Required | Meaning |
| --- | --- | --- |
| `schemaVersion` | yes | `1` |
| `id` | yes | Kebab-case id; equals the file name |
| `version` | yes | Positive whole number; raise it when steps change |
| `title`, `skill`, `audience` | yes | Single-line text |
| `summary` | yes | What the learner achieves (up to 2000 characters) |
| `estimatedMinutes` | yes | Whole minutes, 1–6000 |
| `prerequisites` | no | Ids of paths recommended first; unknown ids and cycles are errors |
| `steps` | yes | 1–60 steps, ids unique within the path |

### Step

| Key | Meaning |
| --- | --- |
| `id`, `title`, `goal` | Kebab-case id, single-line title, and what the step teaches |
| `markdown` | Inline Markdown (up to 20000 characters) or `{ "file": "<id>/<name>.md" }` below `configs/learning/content/` (up to 64 KiB) |
| `docs` | Extra documentation links, written like wikilink targets (`docs/development/WIZARDS-AND-FORMS#Forms`) |
| `form` or `fields`, with `bind` | A registered form id or inline fields (without code hooks); answers are stored at the dotted path `bind` |
| `checklist` | Items `{ id, label, required }`; `required` defaults to `true` |
| `actions` | Up to 12 actions, see below |
| `winConditions` | Up to 12 conditions, all must hold; without conditions the learner completes the step explicitly |

All answers of a path share one object, so a later step can read an earlier answer: `{{plan.wizardId}}`
in a file, text, wizard or label renders the answer literally, never as code. A missing answer renders as nothing and the
condition stays unmet.

### Markdown and documentation links

Markdown is shown as plain text in the terminal. `[[target]]`, `[[target#Heading]]` and `[[target|label]]`
link documentation: the target is a Markdown file without `.md`, under `docs/`, `bin/` (the CLI guides) or the
repository root (`README`, `AGENTS`). These are where this repository keeps its Markdown documentation; source,
configuration and generated folders are not linkable. A heading must exist in the target page.
Raw HTML that would execute elsewhere (`<script>`, `<iframe>`, event attributes, `javascript:` URLs and similar) and control
characters are rejected.

### Actions

| Kind | Keys | Does |
| --- | --- | --- |
| `wizard` | `wizard` (id or one `{{answer}}` template) | Runs a registered wizard exactly like `node bin/app wizard --name <id>`; reaching its end is recorded |
| `form` | `form`, `bind` | Opens a registered form and stores the answers at `bind` |
| `command` | `command` | Shows a `node bin/app …` or `npm run …` command line for the learner to run; it is never executed |

A wizard "reaches its end" when it finishes its last step or an `end` step. Leaving it, declining one of its
reviews or a failure does not count. The wizard catalog is reloaded before every run, so a wizard the
learner just wrote is found, and a broken definition stops the run before anything is asked.

### Win conditions

| Kind | Keys | Met when |
| --- | --- | --- |
| `checklist-complete` | — | Every required checklist item of the step is ticked |
| `form-valid` | — | The step's answers exist and have no `form validate` issues |
| `answer` | `path` and one of `equals`, `notEquals`, `present` | The shared answers match, like a wizard `when` condition |
| `file-exists` | `file` | The project-relative file exists |
| `file-contains` | `file`, `text` | The file contains `text` as a plain substring (first 1,000,000 characters) |
| `wizard-completed` | `wizard` | The step's `wizard` action with the same `wizard` value reached its end |
| `wizard-check` | optional `wizard` | `wizard check` passes on the project's `configs/` and, if given, lists that wizard |

Every condition may have a `label`. Files are read inside the project root only: paths are portable
segments without `..`, never `.git` or `node_modules`, symbolic links are refused, and reads are bounded.
A condition that cannot be evaluated is unmet and shows why.

## Validation and safety

`readLearningPath` (`bin/domain/learning-path.ts`) validates each file and fails closed on:

- unknown keys or kinds, missing ids, and duplicate step, item or action ids;
- unsafe bind or answer paths, including prototype keys;
- control characters and executable Markdown;
- conditions without their source (a checklist, a form, or a wizard action in the same step);
- commands outside `node bin/app` and `npm run`.

`learn check` (`bin/adapters/learning-catalog.ts`) then reports:

- unknown forms and wizards;
- code hooks in inline fields;
- unknown or cyclic prerequisites;
- missing or invalid content files;
- broken documentation links and headings.

`node bin/app learn` refuses to start while any issue exists. Definitions never contain code: they name forms, wizards and
the fixed action and condition kinds above, show commands without running them, and write nothing outside the
reviewed progress plan. Any write a launched wizard makes keeps that wizard's own reviewed plan and approval.

`configs/schemas/learning-path.schema.json` provides editor completion only; the TypeScript reader is authoritative.
The tests are `tests/tooling/interactive-maker-learning-*.checks.mjs`.
