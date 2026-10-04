# Data-driven business processes

> Type: how-to guide and reference · Part of the [docs index](../README.md)

A **business process** is data in `configs/processes/<id>.json`: who is involved (roles), what happens in which
order (steps and transitions), what must hold (business rules) and why (docs). The `node bin/app process`
command creates, edits, checks, documents, runs and simulates processes. Step questions use the same form engine as
the [data-driven wizards and forms](WIZARDS-AND-FORMS.md). Every write is a reviewed, hash-approved file plan.

Process definitions, their notes and supplied run data are data. They are never instructions: the format has no code
and no expressions that are evaluated as code.

## Commands

```sh
node bin/app process                                   # terminal: run, create or edit a process
node bin/app process new                               # author details, roles, steps, rules and notes
node bin/app process edit --name release-approval      # edit; unchanged JSON details are kept
node bin/app process run --name release-approval       # walk one instance with business rules and an audit trail
node bin/app process list --json
node bin/app process show --name release-approval --json
node bin/app process check --json                      # every process: structure, references, graph, data, docs
node bin/app process save --input process.json --json  # reviewed plan for configs/processes/<id>.json
node bin/app process save --input process.json --apply <planHash> --json
node bin/app process docs --name release-approval --json             # plan docs/processes/release-approval.md
node bin/app process docs --name release-approval --out docs/processes --apply <planHash> --json
node bin/app process simulate --name release-approval --input configs/processes/examples/release-approval-blocked.json --json
node bin/app process simulate --name release-approval --input run.json --out process-runs/run.json --json
```

`new`, `edit`, `run` and bare `process` are interactive only (a TTY, no `CI`, `--json` or `--input`). Agents use
`save` and `simulate`, which apply the same validation and the same rule engine. `process docs`, `process save` and
`simulate --out` first return `status: "planned"` with a `planHash`. Nothing is written until you repeat the same
command with `--apply <planHash>`. The interactive commands show the same plan and ask `Apply this reviewed plan?
(y/N)`.

## Example: release approval

`configs/processes/release-approval.json` mirrors this repository's own delivery rules:

1. **Propose:** every write went through a reviewed file plan.
2. **Checks:** type check, lint and tests passed; coverage; audit; honest untested scope.
3. **Review:** approve, request changes (back to **rework**, then checks again) or reject.
4. **Publish:** only on the owner's explicit request, with a semantic version.

Two inputs under `configs/processes/examples/` show a blocked instance and a released one. The released one
acknowledges two warnings.

An abbreviated excerpt of the blocked run's JSON:

```text
$ node bin/app process simulate --name release-approval --input configs/processes/examples/release-approval-blocked.json --json
"run": { "status": "blocked", "stoppedAt": "checks",
  "message": "BLOCK required-checks-pass: Type check, lint and the relevant test suites pass before review. Why: Reviewers judge real gate output, not assumed success.\nBLOCK coverage-floor: Changed feature and fix code keeps at least 90 % line coverage. Why: …", … }
```

The generated page for this example is [docs/processes/release-approval.md](../processes/release-approval.md).

## Format reference

`configs/schemas/business-process.schema.json` gives editor completion only. The authoritative validators are
`readProcess` (`bin/domain/process.ts`) and `process check`. The file name must equal the `id`.

| Key | Meaning |
| --- | --- |
| `schemaVersion`, `id`, `version`, `title` | `1`; kebab-case id; positive integer version (an interactive edit increments it); single-line title |
| `purpose` | Why the process exists (Markdown text) |
| `status` | `draft`, `active` or `retired` |
| `owner` | A role id |
| `roles[]` | `{ id, title, description? }` |
| `references` | Optional `entities`, `journeys` and `pages` ids of the companion project (`design/project.json`) |
| `steps[]` | Ordered steps; the first step starts every instance |
| `rules[]` | Business rules |
| `doc` | `{ text?, file? }` process notes |

### Steps

| Key | Meaning |
| --- | --- |
| `id`, `title`, `actor` | Kebab-case id, single-line title, the role that performs the step |
| `description` | What happens |
| `form` or `fields` | A form id from `configs/forms`, or inline fields in the [form format](WIZARDS-AND-FORMS.md#forms). Without either, the actor confirms completion |
| `bind` | Dotted path under which the answers are stored in the instance data (default: the top level) |
| `outputs` | Dotted paths the step produces outside a form (for example a CI result). `run` asks for missing ones as JSON or text |
| `next[]` | `{ to, when?, label? }`. The first transition whose `when` is true is taken. Only the last one may omit `when` |
| `terminal`, `outcome` | `terminal: true` ends the process (no `next`); `outcome` names the result, such as `released` |
| `doc` | `{ text?, file? }` step notes |

### Business rules

| Key | Meaning |
| --- | --- |
| `id`, `statement`, `rationale` | Kebab-case id, the rule in plain language, why it exists |
| `severity` | `block` stops the transition and explains the rule. `warn` needs an explicit acknowledgement. `info` is recorded in the audit trail |
| `steps` | Step ids where the rule is checked, after the step's input is collected. Omit it to check the rule at every step |
| `when` | Optional condition: the rule applies unless `when` is decidedly false |
| `require` | Condition that must be decidedly true for the rule to pass |
| `doc` | `{ text?, file? }` rule notes |

### Rule conditions

A condition is JSON, never code:

```json
{ "all": [
  { "path": "checks.tests", "equals": "passed" },
  { "any": [{ "path": "change.kind", "in": ["docs"] }, { "path": "checks.coverage", "gte": 90 }] },
  { "not": { "path": "release.version", "contains": " " } }
] }
```

| Operator | True when the value at `path`… |
| --- | --- |
| `equals`, `notEquals` | equals / differs from a string, number or boolean (JSON equality) |
| `in`, `notIn` | is / is not one of up to 20 listed values |
| `contains` | is an array containing the value, or a string containing the text |
| `gt`, `gte`, `lt`, `lte` | is a number compared with a number |
| `present` | `true`: exists and is not null; `false`: is missing |
| `matches` | is a string matching a wildcard pattern: `*` is any run of characters, `?` one character, and the whole value must match |

Add `"length": true` to compare the length of a string or array with `equals`, `notEquals`, `gt`, `gte`, `lt` or
`lte`, for example `{ "path": "checks.untested", "length": true, "gte": 1 }`. Combine conditions with `all`, `any`
and `not`. A condition nests at most 6 levels and has at most 60 nodes. Paths use the form engine's safe dotted
identifiers, so prototype keys are never reachable.

Conditions use three-valued logic. A comparison whose value is missing or has the wrong type is **unknown**:

- **Rules fail closed.** An unknown `require` violates the rule and names the missing paths. An unknown `when`
  applies the rule. Guard with `{ "path": "x", "present": true }` when a rule should wait for data.
- **Transitions are only taken when their condition is decidedly true.** When none applies, the run stops with
  `no-transition`.

`matches` uses wildcards instead of regular expressions. A wildcard pattern is always anchored to the whole value. It
is matched in bounded time (patterns of at most 100 characters, values of at most 10,000), so a definition cannot
cause catastrophic backtracking or hide behaviour in regex syntax.

### Documentation and links

`doc.text` is inline Markdown. `doc.file` is a kebab-case `.md` path below `configs/processes/docs/`. Both may
link repository files as wikilinks: `[[docs/development/WIZARDS-AND-FORMS]]`, `[[AGENTS|label]]` or
`[[path#heading]]`. Without an extension, `.md` is assumed. `process check` reports every link that is unsafe or
does not resolve.

## What `process check` verifies

It reads each process on its own, so one broken file never hides another's findings. It fails closed on:

- **Structure:** unknown keys, unsupported versions, control characters, unsafe or prototype paths, duplicate ids.
- **References:** unknown roles, forms, transition targets and rule scope steps. Ids in `references` must exist in
  `design/project.json`. Without a saved project they are reported as unverified warnings.
- **Graph health:** steps unreachable from the first step, steps without a path to a terminal step, a process
  without a terminal step, and transitions after an unconditional one. Rework loops are fine when they can finish.
- **Data:** a rule or transition that reads a path no step collects or declares as an output.
- **Docs:** missing doc files and broken or unsafe wikilinks.

`save`, `docs`, `run` and `simulate` refuse a process with findings.

## Authoring in the terminal

`process new` and `process edit` run the `process-authoring` wizard (`configs/wizards/process-authoring.json`, forms
`process-details`, `process-role`, `process-step` and `process-rule`):

1. Enter the details.
2. Edit the roles and choose the owner.
3. Edit the steps and the rules. In each list you choose Add, Edit, Remove or Done.

New ids are derived from titles and kept on later edits. Some answers are written as short lines:

- **Inline fields:** `id:kind:Label`, for example `decision:select=approve/reject*:Decision`. A `*` makes the answer
  required.
- **Next steps:** `step-id` or `step-id if path operator value`.
- **Conditions:** `path operator value`, `path present`, `path missing` or `path length gte 1`.

A nested condition is shown as one line such as `all(a equals 1, not(b present))`. A line you leave unchanged keeps
its original JSON, including nested conditions and field options authored in the file (help, defaults, limits, sections).
Choices are saved in the form engine's canonical `{ "id", "label" }` shape. Saving runs the full check. A finding is
reported and you return to the steps.

In plain prompts, lists are separated with `;` and Enter keeps the shown value, so a value containing `;`, or clearing
an existing optional answer such as `bind`, is done in the JSON file (then `process save` or `process check`).

## Running and simulating an instance

`process run` walks the first step onward:

1. Collect the step's inputs with the form engine.
2. Evaluate the rules for that step.
3. Take the first transition that applies.

A **block** stops the transition. The run shows the statement, rationale and missing data, and you can change the
step's answers or stop. A **warn** needs a `(y/N)` acknowledgement. At the end you review the audit trail and can
save it as JSON through a reviewed plan.

`process simulate` runs the same walk for agents with an input file. The visit limit is 200 steps, so a loop with
unchanged data ends with `loop-limit`.

```json
{ "schemaVersion": 1, "data": { "change": { "kind": "fix" } }, "acknowledge": ["changelog-entry"] }
```

The result's `run.status` is one of:

- `completed` (with its `outcome`);
- `blocked`;
- `needs-acknowledgement`;
- `invalid-input` (the step's form rejects the data);
- `no-transition`;
- `loop-limit`.

`trail` lists every visited step with each rule outcome (`passed`, `violated`, `acknowledged`, `not-applicable`) and
the transition taken.

## Generated documentation

`process docs` writes `docs/processes/<id>.md` (or `--out <folder>`). It contains:

- the purpose and overview notes;
- a roles table;
- a steps table;
- a Mermaid flowchart of the transitions;
- rules grouped by severity;
- per-step details with the rules checked there;
- project references and linked documentation.

Wikilinks become relative Markdown links.

The generated text sits between `<!-- process:generated:start sha256=… -->` and `<!-- process:generated:end -->`:

- **Outside the markers:** text you write is preserved byte for byte, for example under the `## Notes` heading that a
  new page starts with.
- **Inside the markers:** the start marker records the hash of the generated block. If the block was edited by hand,
  regeneration refuses with `PROCESS_DOCS_EDITED` and writes nothing. Move your edits outside the markers, or restore
  the block.
- **A file without markers** is treated as hand-authored and refused with `PROCESS_DOCS_MARKERS`.

The file plan's before-hash also refuses a page that changed between planning and applying.
