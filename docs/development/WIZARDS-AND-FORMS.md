# Data-driven wizards and forms

> Type: how-to guide and reference · Part of the [docs index](../README.md)

Every guided process of the `node bin/app` shell is a **wizard**, defined in JSON under `configs/wizards/`.
The questions a wizard asks are **forms**, defined under `configs/forms/` or inline in a wizard step.
TypeScript keeps only what data cannot express: named **actions** (load, plan, review, apply) and named
**form hooks** (dynamic choices, commit/normalize, effects). A definition can name a hook, never contain code.

| Wizard | Command | What it guides |
| --- | --- | --- |
| `settings` | `node bin/app settings` | `user-settings` form, then a reviewed settings or path-migration plan |
| `first-run` | `node bin/app first-run` | Skip/verify/showcase choice, reviewed execution plan, separate consent |
| `project-setup` | `node bin/app project-setup` | Settings, `project-identity`, `prd-intake`, prototype brief, bricks, reviewed plan, checkpoints |
| `new-project` | `node bin/app new` | Project starter, prototype brief (configs/guides), output folder, reviewed package |
| `prototype` | `node bin/app prototype` | Prototype brief, output folder, reviewed package, optional design folder |
| `brainstorm` | `node bin/app brainstorm` | Eight capture sections, reviewed request and file plan, optional import and verification |
| `framework-setup` | `node bin/app setup` (terminal) | Source (starter or project JSON), identity and explicit Airship/MCP opt-ins; only missing answers are asked |
| `fake-data` | `node bin/app fake-data` | Entity, `fake-data-run` form (or a new entity via `fake-data-entity`/`fake-data-property`), sample note, reviewed write, optional saved generation config |
| `new-starter` | `node bin/app new <dir>` (terminal) | Target directory, installed starter, that starter's own `inputs[]` as a generated form, then Airship and single native-extension options; only missing answers are asked |
| `framework-setup-stages` | after `setup` applies | Documentation import, then generate/install/verify/preview, each separately approved, then documentation export |

Prompt labels, defaults and order are unchanged from the former hand-written flows (the framework `setup`
confirmations now use the shared `(y/N)` prompt, which asks again on an unclear answer). The existing plain
and terminal-UI journey tests run against the definitions without modification. The prototype briefs
keep their published guide contract (`guideId`/`guideVersion`) and moved from `bin/guides/` to
`configs/guides/`.

## Run, inspect and check

```sh
node bin/app wizard                      # choose any wizard in a terminal
node bin/app wizard --name settings      # run one by id
node bin/app wizard list --json          # wizards and forms with steps, fields and reference issues
node bin/app wizard show --name first-run --json
node bin/app wizard check --json         # validate every definition and every hook it names
node bin/app form --name project-identity --out answers/identity.json
node bin/app form validate --name project-identity --input identity.json --json
```

Running a wizard or form is interactive only (a TTY, no `CI`, `--json` or `--input`). Agents use
`form validate` and each process's existing machine commands (`settings --input`, `new --input`, and so on).
`form --out` reviews the answers and saves them through the same default-No reviewed file plan as every
other write.

## Add a guided process

1. Add a form if the questions are reusable, for example `configs/forms/contact.json`:

   ```json
   {
     "$schema": "../schemas/form.schema.json",
     "schemaVersion": 1, "id": "contact", "version": 1, "title": "Contact",
     "fields": [
       { "id": "name", "kind": "title", "label": "Contact name" },
       { "id": "channel", "kind": "select", "label": "Channel", "choices": ["mail", "chat"], "default": "mail" }
     ]
   }
   ```

2. Add the wizard, `configs/wizards/onboarding.json`. The file name must equal its `id`.

   ```json
   {
     "$schema": "../schemas/wizard.schema.json",
     "schemaVersion": 1, "id": "onboarding", "version": 1, "title": "Onboarding",
     "steps": [
       { "id": "contact", "kind": "form", "form": "contact", "bind": "contact" },
       { "id": "review", "kind": "action", "action": "wizard.review", "with": { "value": "contact" } },
       { "id": "save", "kind": "action", "action": "wizard.save-json", "barrier": true,
         "with": { "value": "contact", "file": "answers/{{contact.channel}}.json" } },
       { "id": "done", "kind": "end", "text": "Saved {{contact.name}}." }
     ]
   }
   ```

3. Run `node bin/app wizard check --json`, then `node bin/app wizard --name onboarding`.

A wizard that only collects, reviews and saves needs no code. It uses the built-in actions
`wizard.review`, `wizard.agree` and `wizard.save-json`. When it needs a service, add a module in
`bin/presentation/wizards/` exporting `{ actions, hooks }` and list it once in `wizardModules`
(`bin/presentation/wizards/registry.ts`). Then give it a command entry like the existing ones in
`bin/app.ts`. Names are global and duplicates fail at startup. Each module's actions are tested
through real services (see `tests/tooling/interactive-maker-wizard-*.checks.mjs`).

## Forms

A form edits one JSON value in place. Each field reads and writes `bind`, a dotted path that defaults to
the field `id`. A form-level `commit` hook may normalize or validate the finished value; `user-settings`
commits through `readSettings`.

| Kind | Asks | Notable keys |
| --- | --- | --- |
| `text` | Single- or multi-line text | `required`, `maxLength`, `multiline`, `help`, `message` |
| `title` | One-line title (same rules as `titleInput`) | `maxLength` |
| `number` | Finite number | `integer`, `min`, `max`, `required: false` (a blank answer leaves it unset) |
| `select` | One choice | `choices` (strings or `{id,label}`), or `choicesFrom` (a choice-provider hook) |
| `multi` | Several choices | `choices`/`choicesFrom`, `required` |
| `boolean` | Yes/No menu | `yes`, `no` labels |
| `confirm` | Explicit agreement, default No | (always asked fresh) |
| `list` | Several text items | `separator` (plain, default `;`), `joiner`, `suffix`, `multiline` (newline-separated in the terminal UI), `maxItems` |
| `record` | One text answer per key of an object | `bind` (required); the label is a prefix before each key |
| `section` | A nested field group, optionally behind a `gate` question | `form` or `fields`, `bind`, `prepare`/`commit` hooks |

Every field may also use these keys:
- `when`: a condition on an earlier sibling field (`field`) or on the form value (`path`), with exactly one of
  `equals`, `notEquals`, `present` or `changed`.
- `transient`: ask without storing the answer in the value.
- `effect`: a hook run after the answer.
- `message`: replaces the generic validation text.

Labels, choice labels and gates can contain `{{path}}` or `{{path|fallback}}` templates. These are literal
substitutions from the wizard state, never evaluated code.

**Behaviour while answering:**
- **Plain prompts:** Enter keeps the shown default. An invalid answer is reported and the question is asked
  again. `:back` returns to the previous question.
- **Terminal UI:** answers are validated in place, and Escape returns to the previous question.
- **Back at the first question** leaves the form, which returns the wizard to its previous step.

## Wizards

State is one JSON object shared by all steps. Steps run in order:

| Kind | Does | Keys |
| --- | --- | --- |
| `form` | Runs a form (`form`) or inline `fields` against `bind`; `initial` seeds an absent value | `form`/`fields`, `bind`, `initial` |
| `guide` | Runs a prototype guide loaded into state; `agreement` requires its readiness constraints | `guide`, `initial`, `bind`, `agreement` |
| `action` | Calls a registered action; `with` passes template parameters | `action`, `with`, `interactive` |
| `message` | Writes text | `text` |
| `end` | Ends the wizard, optionally with a completion message | `text` |

Every step may also use these keys:
- `when`: a condition on a state `path`.
- `title` and `details`: the terminal-UI header location and detail lines, merged with the wizard-level `context`.
  Only steps with a `title` update the header.
- `barrier`: Back can never return past this step. Use it after a reviewed write.
- `retry`: on a reported failure, ask again from this step (`true`) or from a named earlier step.

Wizard-level keys:
- `cancelMessage`: turns Back from the first step into a quiet cancel.
- `reportErrors`: reports a failure instead of exiting with it.

Back returns to the previous interactive step, meaning a `form`, a `guide` or an action marked `interactive`.
Revisited steps are always asked again, even when their `when` condition was meant for first entry
(for example "only when the checkpoint has no settings").

## Outside the wizard engine

The `new <dir>` interview maps each starter's `inputs[]` (`configs/starters/*.json`) to a form at runtime:
string → text, integer → whole number, boolean → Yes/No, choices → select. An optional choice input without a
default gets a Skip choice. Supplied `--values`/`--answers`/identity flags are never asked, and every answer still
passes the starter's own validation. Invalid answers are reported and asked again instead of ending the interview,
and `:back` at the first question cancels. The remaining flows below are deliberately not wizards.

| Flow | Why it is not a wizard here |
| --- | --- |
| `npm run setup` | Dependency-free Node script that must run before dependencies and TypeScript tooling are installed. Its questions are still data: `configs/forms/setup-identity.json`, read by `scripts/setup/form.mjs`, which supports only `text` and `confirm` fields (`id`, `kind`, `label`, `help`) whose ids equal the setup `--answers` keys, and fails closed on anything else. See [setup identity](SETUP-IDENTITY.md). |
| Studio editors (pages, bricks, templates) | Open-ended edit menus, not linear guided processes. |
| Project handout | A Markdown checklist that is filled in and validated, not asked live. |

## Validation and safety

- `readForm` and `readWizard` (`bin/domain/`) validate structure and fail closed:
  - unknown keys, kinds or versions;
  - unsafe or prototype paths;
  - duplicate ids;
  - conditions on later fields;
  - control characters.
- The catalog (`bin/adapters/wizard-catalog.ts`) then checks every referenced form, action and hook,
  rejects recursive section includes, and requires each file to be named after its id.
- `configs/schemas/*.schema.json` gives editor completion only. The TypeScript readers are authoritative.
- Definitions are read when a wizard starts, so an edited file applies to the next run, and a broken
  reference stops the run before anything is asked.
- Every write still goes through a reviewed, hash-approved file plan, and process execution keeps its
  separate approval. Definitions cannot add approvals, run commands or write without a review.
- The plugin runtime renders the same format with its own reader (`src/domain/forms`) and the `DataForm` component,
  limited to forms without CLI hooks; definitions live in `src/features/<feature>/forms/`. See [runtime forms](RUNTIME-FORMS.md).
