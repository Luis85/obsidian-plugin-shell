# Generate fake data

> Type: how-to guide · Part of the [docs index](../README.md)

`node bin/app fake-data` generates seeded, realistic sample notes: Markdown files with YAML frontmatter that
Obsidian reads as properties. Use them to fill collections, Obsidian Bases, screenshots and tests. Each run can
also write an Obsidian Bases table (`.base`), and can be saved as a reusable **generation config**.

Values come from [Faker](https://fakerjs.dev) (`@faker-js/faker` 10.6.0, MIT, English locale only) through a
fixed allowlist. The same seed always produces byte-identical notes. Nothing is written until you approve a
reviewed file plan, and existing notes are never changed.

## Generate notes in a terminal

```sh
node bin/app fake-data
```

The `fake-data` wizard (`configs/wizards/fake-data.json`) asks:

1. **What to generate.** Choose one of:
   - an existing entity;
   - a new entity you define now;
   - a saved generation config.
2. **The entity.** The built-in presets, your project definitions and the entities of the saved project
   (`design/project.json`) are offered.
3. **Amount and folder** (`configs/forms/fake-data-run.json`):
   - number of notes (1–1000);
   - target folder, relative to the project root (default `Fake Data/<entity folder>`);
   - seed;
   - whether to add a `.base` table.
4. **Sample note.** One generated note is shown first.
5. **Review.** The complete file plan is shown. The answer defaults to No.
6. **Reuse.** You may save the run as a generation config. This is a second reviewed, default-No plan.

Flags preselect answers, for example `node bin/app fake-data --generation contacts-demo` or
`node bin/app fake-data --entity book --count 30`.

### Define a new entity in the wizard

Choose **Define a new entity** to describe one property at a time (`configs/forms/fake-data-property.json`):

- key;
- Obsidian property type;
- a generator, or a list of values to pick from;
- whether every note gets a value;
- whether values must be unique.

The entity needs at least one required text property, because its value names each note. The definition is
saved to `configs/fake-data/entities/<id>.json` through a reviewed plan. If you decline, the entity is used
for this run only and cannot back a saved generation config. To change argument ranges, the body template or
labels later, edit the JSON and run `fake-data validate`.

## Agents and scripts

Every command returns one JSON document with `--json`. A write is planned first. The same command with
`--apply <planHash>` applies exactly that plan.

```sh
node bin/app fake-data entities --json                  # built-in, project and saved-project entities
node bin/app fake-data show --name contact --json       # one resolved definition
node bin/app fake-data validate --input entity.json --json
node bin/app fake-data save-entity --input entity.json --json            # plan; then --apply <planHash>

node bin/app fake-data --entity contact --count 25 --out "Fake Data/Contacts" --seed 7 --base --json
node bin/app fake-data --entity contact --count 25 --out "Fake Data/Contacts" --seed 7 --base --apply <planHash> --json

node bin/app fake-data configs --json                   # saved generation configs
node bin/app fake-data show-config --name contacts-demo --json
node bin/app fake-data --generation contacts-demo --json    # plan from a saved config
node bin/app fake-data --generation contacts-demo --count 50 --seed 9 --out "Fake Data/More" --json
node bin/app fake-data save-config --input generation.json --json        # plan; then --apply <planHash>
```

| Option | Meaning |
| --- | --- |
| `--entity <ref>` | Entity id, `semantic:<id-or-slug>` or `file:<relative.json>` (see below). |
| `--generation <id>` | A saved generation config; use either this or `--entity`. (`--config` is the project configuration path of other commands.) |
| `--count <n>` | 1–1000 notes (default 10, or the config's count). |
| `--out <folder>` | Target folder relative to `--root` (default `Fake Data/<entity folder>`, or the config's). |
| `--seed <n>` | 0–2147483647 (default 1, or the config's seed). |
| `--base` | Also write `<out>/<entity id>.base`. With `--generation` it can only turn the base on. |
| `--project <file>` | Saved project read for `semantic:` entities (default `design/project.json`). |

`--count`, `--out`, `--seed` and `--base` override a saved config for that run only. The plan's `sample`
field holds the first generated note.

## Where definitions live

| Folder | Holds |
| --- | --- |
| `configs/fake-data/entities/` | Entity definitions, one `<id>.json` each |
| `configs/fake-data/generations/` | Generation configs, one `<id>.json` each |

Both folders exist in two places:

- **Built-in:** shipped beside the framework's wizard definitions.
- **Project:** the same relative folders under the project root (`--root`, default the current folder).

Inside the framework checkout these are the same folder, which is read once. In any other project, a project
file that reuses a built-in id fails closed, and saving one is refused. Any invalid or misnamed file stops the
listing with its file name.

### Built-in presets

| Entity | Folder | Showcases |
| --- | --- | --- |
| `contact` | `Contacts` | Names, reserved `example.com/net/org` emails, companies, birthdays, tags, a notes body |
| `task` | `Tasks` | `type`, `id`, `schema_version` and `created_at`, so the plugin's Task example collection reads the notes |
| `project` | `Projects` | Plugin Project example identity, number budget, archived checkbox, owner link |
| `book` | `Books` | Author links, dates in a fixed range, page counts, ratings, read flag |
| `meeting` | `Meetings` | Date-and-time values, attendee lists, statuses, an agenda body |
| `release-item` | `Release items` | The [release item](RELEASE-CANDIDATES.md) format: `type: ReleaseItem`, `ITEM-0001` ids, proposed/ready/dropped statuses, kinds, priorities, source paths and ids, acceptance criteria and risk ids; `release-item check` accepts the notes and `candidate add` includes the ready ones |
| `learning` | `Learnings` | The [learnings](LEARNINGS.md) format: `type: Learning`, `LRN-0001` ids, its statuses, categories, tags, impact and related risk ids; `learning check` accepts the notes |
| `risk` | `Risks` | The [risk register](RISK-MANAGEMENT.md) format: `type: Risk`, `RISK-0001` ids, model statuses, dimensions, categories and 1–5 scales; `risk check` accepts the notes |

Five example generation configs are shipped:

- `contacts-demo`: 25 contacts in `Fake Data/Contacts` with a `.base` table.
- `tasks-board`: 40 tasks in `Tasks` with a `.base` table.
- `release-items-demo`: 20 release items in `docs/releases/items` (the default release items folder) with a `.base` table; generate into a scratch `--root` inside the framework checkout.
- `learnings-demo`: 20 learnings in `docs/learnings` (the default learnings folder) with a `.base` table; generate into a scratch `--root` inside the framework checkout.
- `risks-demo`: 25 risks in `docs/risks` (the default risk folder) with a `.base` table; generate into a scratch `--root` inside the framework checkout.

## Entity definition reference

Each definition is validated by `src/cli/domain/fake-data-entity.ts`. Validation fails closed on:

- unknown keys;
- unsafe or duplicate property keys;
- control characters;
- generators outside the allowlist, unknown arguments and out-of-range arguments;
- body references to undeclared properties.

`configs/schemas/fake-data-entity.schema.json` gives editor completion only.

```json
{
  "$schema": "../../schemas/fake-data-entity.schema.json",
  "schemaVersion": 1,
  "id": "recipe",
  "title": "Recipe",
  "folder": "Recipes",
  "titleProperty": "dish",
  "properties": [
    { "key": "dish", "label": "Dish", "type": "text", "generator": { "faker": "commerce.productName" }, "unique": true },
    { "key": "minutes", "type": "number", "generator": { "faker": "number.int", "args": { "min": 5, "max": 90 } } },
    { "key": "vegetarian", "type": "checkbox", "generator": { "faker": "datatype.boolean", "args": { "probability": 0.3 } } },
    { "key": "course", "type": "tags", "generator": { "choices": ["starter", "main", "dessert"] }, "items": { "min": 1, "max": 1 } },
    { "key": "method", "type": "text", "generator": { "faker": "lorem.paragraphs" }, "frontmatter": false }
  ],
  "body": "# {{dish}}\n\n{{method}}\n"
}
```

| Key | Rules |
| --- | --- |
| `id` | Lowercase kebab-case; the file is named `<id>.json`. |
| `folder` | Suggested folder; the default target is `Fake Data/<folder>`. |
| `titleProperty` | A required `text` property. Its value, slugged, names each note (`janae-wolff.md`, then `-2`, `-3` on collisions). |
| `properties[].key` | A letter, then letters, digits, `_` or `-`, up to 40 characters. Prototype names are refused, and keys are unique case-insensitively. |
| `properties[].type` | `text`, `number`, `checkbox`, `date`, `datetime`, `list`, `tags` or `link`. |
| `properties[].generator` | Exactly one of `faker` (+ `args`), `choices`, `sequence` (prefix → `PREFIX0001`) or `value` (a constant). |
| `required` | Default `true`. `false` leaves the property out of about one note in five, so filters and empty states have data. |
| `unique` | Retries up to 100 times per note, then fails with `FAKE_DATA_UNIQUE`. Not available for checkbox, list or tags. |
| `frontmatter` | `false` keeps the value for the body only, for example a long Markdown paragraph. |
| `items` | `{ "min", "max" }` items for `list` and `tags`, 0–20 (default 1–3). |
| `label` | Column name in the generated `.base` table. |
| `body` | Markdown, up to 4000 characters. `{{key}}` is replaced literally with the generated value; nothing is evaluated, and generated text is never expanded again. Default `# {{<titleProperty>}}`. |

### Property values

| Type | Written as |
| --- | --- |
| `text` | One line, at most 500 characters. Body-only values keep their paragraph breaks. |
| `number` | A YAML number. |
| `checkbox` | `true` or `false`. |
| `date` | `"YYYY-MM-DD"`. |
| `datetime` | `"YYYY-MM-DDTHH:mm:ss"`. |
| `list` | A list of text items. |
| `tags` | A list of lower-case tags (letters, digits, `_`, `-`, `/`, never only digits). |
| `link` | `"[[Target]]"`; the characters `[ ] \| # ^` are removed from the target. |

A text property filled from a date generator holds the full ISO timestamp, as the Task preset's `created_at`
needs. Frontmatter is written with the same YAML serializer and options as the plugin's note repository
(`yaml` with double-quoted strings).

### Allowlisted generators

`fake-data` only calls the methods below. Each one is dispatched explicitly in
`src/cli/adapters/fake-data-faker.ts`, never looked up by path.

| Method | Arguments (bounded) | Fits |
| --- | --- | --- |
| `person.fullName`, `person.firstName`, `person.lastName`, `person.jobTitle`, `person.bio` | — | text, list, tags, link |
| `internet.exampleEmail` (reserved example domains only), `internet.username` | — | text, list, tags, link |
| `company.name`, `company.catchPhrase`, `company.buzzPhrase` | — | text, list, tags, link |
| `location.city`, `location.country` | — | text, list, tags, link |
| `book.title`, `book.author`, `book.genre`, `book.publisher` | — | text, list, tags, link |
| `music.genre`, `music.songName`, `commerce.productName`, `commerce.department` | — | text, list, tags, link |
| `color.human`, `word.noun`, `word.adjective`, `lorem.word`, `string.uuid` | — | text, list, tags, link |
| `lorem.words`, `lorem.sentence`, `lorem.paragraph`, `lorem.paragraphs` | `min`, `max` (1–50 words, sentences or paragraphs) | text, list, tags, link |
| `string.alphanumeric` | `length` (1–64) | text, list, tags, link |
| `number.int` | `min`, `max` (±1e9, whole) | number, text, list |
| `number.float` | `min`, `max`, `fractionDigits` (0–6) | number, text, list |
| `datatype.boolean` | `probability` (0–1) | checkbox, text |
| `date.past`, `date.future` | `years` (1–100) | date, datetime, text |
| `date.recent`, `date.soon` | `days` (1–3650) | date, datetime, text |
| `date.between` | `from`, `to` (required, `YYYY-MM-DD`) | date, datetime, text |
| `date.birthdate` | `min`, `max` age (0–120) | date, datetime, text |

Relative dates are measured from the run's fixed `referenceDate` (default `2026-01-01`), never from today.
This keeps them reproducible.

### Entities of the saved project

`semantic:<id-or-slug>` reads an entity from `design.semantic.entities` in `design/project.json` (or `--project`).
Generators are inferred from each property's type and key:

| Property | Generator |
| --- | --- |
| `email` | `internet.exampleEmail` |
| `title`, `subject` | `lorem.sentence` |
| `name`, `owner`, `author` | `person.fullName` |
| `city`, `location` | `location.city` |
| `company`, `client` | `company.name` |
| Numbers | `number.int` 0–100 |
| Checkboxes | `datatype.boolean` |
| Dates | `date.past` |
| Date and time | `date.recent` |
| Lists and tags | `lorem.word` |

Other properties get Lorem words. The first required text property names the notes; without one, a `title`
property is added. Relationships are not generated. To control these choices, save the result of `fake-data show`
as a project definition and edit it.

## Generation config reference

```json
{
  "$schema": "../../schemas/fake-data-generation.schema.json",
  "schemaVersion": 1,
  "id": "contacts-demo",
  "title": "Contacts demo",
  "entity": "contact",
  "count": 25,
  "out": "Fake Data/Contacts",
  "seed": 42,
  "base": true,
  "referenceDate": "2026-01-01"
}
```

`entity` accepts the same references as `--entity`. `description` is optional, `base` defaults to `false` and
`referenceDate` to `2026-01-01`. The authoritative validator is `src/cli/domain/fake-data-config.ts`. When you save
a config under an existing id with different content, the review lists it as an `update`.

## The Bases file

With `--base`, the plan adds `<out>/<entity id>.base`:

```yaml
filters:
  and:
    - file.folder == this.file.folder
    - file.ext == "md"
properties:
  note.name:
    displayName: Name
views:
  - type: table
    name: Contact
    order:
      - file.name
      - note.name
      - note.email
```

The table shows the Markdown notes in the same folder as the `.base` file, so it keeps working after the folder
is moved. Columns follow the frontmatter properties whose keys are plain identifiers, and `label` becomes the
display name. Open the file in Obsidian 1.9 or later, where Bases is a core plugin.

## Safety and limits

- **One reviewed plan per run.** All notes and the `.base` file are written by one plan. Agents need the exact
  `planHash`; people review with a default-No prompt.
- **No overwrites.**
  - A target that already holds identical bytes is `unchanged`, so re-running a seeded config is safe.
  - A target with different content stops the run with `FAKE_DATA_CONFLICT`, and nothing is written.
  - Nothing is ever deleted.
- **Folder rules.** The target folder must be relative and inside the root. It cannot use hidden segments,
  `node_modules`, device names or `\ : * ? " < > | # ^ [ ]`. Inside a framework checkout it cannot be a
  template input folder (`src`, `docs`, `configs` and so on; see `outputBoundary`). To write into a hidden
  vault folder, pass it as `--root`, for example `--root .dev-vault`.
- **Size limits.**
  - 1000 notes per run;
  - 64 KiB per note;
  - 8 MB per plan;
  - 40 properties per entity.
- **Synthetic contact data.** Emails use reserved example domains. Faker names and cities are random and may
  match real ones.
- **Dependency.** Faker is a direct, exact-pinned dependency. It is loaded only when a generation is planned, and
  the packaged kit bundles it into `bin/app.js` with its MIT license in `bin/licenses/`.

## Tests

| File | Covers |
| --- | --- |
| `src/cli/tests/interactive-maker-fake-data-domain.checks.mjs` | Allowlist parity, validation, determinism, YAML round-trip, file names, bounds, Bases data, inference |
| `src/cli/tests/interactive-maker-fake-data-command.checks.mjs` | Plan and apply, reruns, conflicts, folder boundaries, configs, overrides, custom and semantic entities |
| `src/cli/tests/interactive-maker-fake-data-wizard.checks.mjs` | The real wizard with scripted plain prompts: default-No review, approved writes, saving and re-running configs, defining entities, Back |

All three run in the `maker` suite.
