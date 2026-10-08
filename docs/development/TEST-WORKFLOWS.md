# Browser test workflows

> Type: how-to guide and reference · Part of the [docs index](../README.md)

A **test workflow** is a browser journey written as data: "visit page A, click button X to reach page B, fill out
form Y with data Z, expect the welcome text". Each workflow lives in `configs/tests/workflows/<id>.json` and has a
generated documentation note in `docs/tests/workflows/<id>.md`. `node bin/app workflow` creates, edits, checks,
documents, runs, records and exports workflows. Runs use Playwright with headless Chromium against offline or
loopback targets only.

Workflow definitions and their test data are data, never instructions. The format has no script, CSS, XPath or
expression strategy: every locator maps to one Playwright `getBy*` call and every check to one web-first `expect`.

## Commands

```sh
node bin/app workflow                                   # terminal: create or edit a workflow
node bin/app workflow new                               # details, target, test data and the step builder
node bin/app workflow edit --name sign-up               # edit; ids, timeouts and value types in JSON are kept
node bin/app workflow list --json                       # workflows with target, steps, assertions and findings
node bin/app workflow show --name sign-up --json        # definition plus resolved test data
node bin/app workflow check --json                      # definitions, targets, fake data, templates, notes, orphans
node bin/app workflow save --input workflow.json --json # reviewed plan: definition and note together
node bin/app workflow docs [--name sign-up] --json      # regenerate notes; hand-written text is kept
node bin/app workflow run --name sign-up --json         # headless Chromium; report under reports/workflows/sign-up/
node bin/app workflow run --name sign-up --target http://127.0.0.1:4173/ --json   # same steps, another target
node bin/app workflow record --name sign-up --json      # plan writing the latest run result into the note
node bin/app workflow export --name sign-up --out tests/e2e/workflows --json      # plan an @playwright/test spec
```

`new`, `edit` and bare `workflow` are interactive only (a TTY, no `CI`, `--json` or `--input`). `save`, `docs`,
`record` and `export` first return `status: "planned"` with a `planHash`; nothing is written until the same command
runs again with `--apply <planHash>`. The interactive commands show the same plan and ask before applying.

`run` writes its JSON report to `reports/workflows/<id>/<run-id>/report.json` and `reports/workflows/<id>/latest.json`,
and screenshot steps to `reports/workflows/<id>/<run-id>/screenshots/<name>.png` (local evidence; `reports/` is not
committed). Its result status is `ok` when every step passed, `failed` when a step failed and `blocked` when
the run could not start (no usable browser, or an unbuilt prototype). A blocked run is reported as `not-run`, never as
a pass. Recording a result into the note is always a separate, reviewed `record` plan.

## Example: sign up for the demo shop

`configs/tests/workflows/sign-up.json` drives the offline fixture in `tests/fixtures/workflows/sign-up` (three static
pages and a GET form). It opens the shop, follows "Create an account", fills the form with a seeded fake contact from
the `contacts-demo` generation config and an inline plan value, submits, and checks the welcome page.

```sh
SHELL_CHROMIUM=/path/to/chrome node bin/app workflow run --name sign-up --json   # omit SHELL_CHROMIUM with the pinned browser
node bin/app workflow record --name sign-up --json
```

`configs/tests/workflows/prototype-smoke.json` is the pattern for a prepared prototype package
(`prototypes/<slug>`, created by `node bin/app prototype --out prototypes/<slug>`). It reports `not-run` until such a
package exists and its offline HTML is built; copy it and point `target.package` at your package.

## Definition format

```json
{
  "$schema": "../../schemas/test-workflow.schema.json",
  "schemaVersion": 1,
  "id": "sign-up",
  "title": "Sign up for the demo shop",
  "purpose": "Why this journey matters.",
  "status": "active",
  "target": { "kind": "static", "folder": "tests/fixtures/workflows/sign-up" },
  "viewport": { "width": 1280, "height": 800 },
  "timeoutMs": 5000,
  "data": {
    "values": { "plan": "Pro" },
    "fakeData": { "customer": { "config": "contacts-demo", "index": 0 } }
  },
  "steps": [
    { "kind": "goto", "path": "/" },
    { "kind": "click", "target": { "role": "link", "name": "Create an account" } },
    { "kind": "fill", "target": { "label": "Email" }, "value": "{{data.customer.email}}" },
    { "kind": "expectText", "target": { "testId": "greeting" }, "text": "Welcome, {{data.customer.name}}!", "match": "exact" }
  ]
}
```

The file name is the `id` (lowercase kebab-case). `status` is `draft`, `active` or `retired`. `viewport` defaults to
1280×800 (200–4000 px). `timeoutMs` is the per-step timeout (default 5000, 100–60000); a step may override it.

### Targets

| Kind | Fields | How a run reaches it |
| --- | --- | --- |
| `static` | `folder` | A project folder with `index.html`, read into memory (no symlinks, bounded size, known file types) and served read-only on an ephemeral `127.0.0.1` port. |
| `prototype` | `package` | A prepared prototype package. Its `prototype.manifest.json` names the built offline HTML (`artifact.path`, for example `prototype.html` or `source/dist/prototype.html`), served at `/`. |
| `url` | `url` | An app you already serve on loopback, such as a generated project's `npm start` preview on `http://127.0.0.1:4173/`. The run never starts it. |

Folders are project-relative without `..`, hidden or `node_modules` segments. URLs must be `http` on `127.0.0.1`,
`localhost` or `[::1]` with an explicit port and no credentials, query or fragment. During a run every request to
another origin is aborted and listed in `blockedRequests`; service workers and downloads are blocked.
`--target` overrides the target for one run: a loopback URL, a `prototypes/<slug>` package or a static folder.

### Steps

| Kind | Element (`target`) | Operands |
| --- | --- | --- |
| `goto` | none | `path` (root-relative, such as `/` or `/checkout.html#done`) |
| `click`, `check`, `uncheck` | required | none |
| `fill`, `select` | required | `value` (may be empty for `fill`) |
| `press` | optional | `key`: `Enter`, `Tab`, `Escape`, `ArrowDown`, a letter or digit, with `Control+`, `Shift+`, `Alt+`, `Meta+` |
| `waitFor` | required | optional `state`: `visible` (default), `hidden`, `attached`, `detached` |
| `expectVisible`, `expectHidden` | required | none |
| `expectText` | required | `text`, optional `match`: `contains` (default) or `exact` |
| `expectUrl` | none | `path`, optional `match`: `exact` (default) or `contains`; compared as path + query + hash |
| `expectTitle` | none | `text`, optional `match`: `exact` (default) or `contains` |
| `expectCount` | required | `count` (0–1000) |
| `expectValue` | required | `value` |
| `screenshot` | optional (one element) | `name`, optional `fullPage`, `mask`, `caption` (see [Screenshots](#screenshots)) |

Every step may also have an `id` (unique kebab-case), a single-line `note` for the documentation and `timeoutMs`.
The first step must be `goto`; a workflow has 1–200 steps. Unknown keys, unknown kinds and operands that do not
belong to the kind are refused.

### Locators

A locator names exactly one strategy:

| Strategy | Example | Playwright call |
| --- | --- | --- |
| `role` (+ optional `name`) | `{ "role": "button", "name": "Save" }` | `getByRole('button', { name: 'Save' })` |
| `label` | `{ "label": "Email" }` | `getByLabel('Email')` |
| `placeholder` | `{ "placeholder": "you@example.com" }` | `getByPlaceholder(...)` |
| `text` | `{ "text": "Welcome" }` | `getByText(...)` |
| `testId` | `{ "testId": "greeting" }` | `getByTestId(...)` |

`exact: true` turns substring matching off (not for test ids), `nth` (0–99) picks one of several matches, and
`within` scopes the search to a parent locator (at most two parents). Roles are the ARIA roles Playwright accepts,
such as `button`, `link`, `textbox`, `checkbox`, `combobox`, `heading`, `list`, `listitem`, `form` or `dialog`.
There is deliberately no CSS or XPath escape hatch: prefer accessible names, and add a `data-testid` to the app when
no accessible handle exists.

In the terminal step builder a locator is one line, parent first: `form "Sign up" > button "Create account"`,
`label "Email" exact`, `testid "submit"`, `list "Next steps" > listitem #2`.

### Test data and templates

`data.values` holds inline values (letters-and-digits keys, up to four levels, strings, numbers or booleans).
`data.fakeData` names up to ten records from the [fake-data generator](FAKE-DATA.md) by alias: `config` reuses a
saved generation config (its entity, seed, count and reference date), `entity` takes an entity id and an optional
`seed`; `index` picks the record. Records come from the generator's own seeded output, offline, so every run and
export uses the same values.

Step values, texts and locator texts may contain `{{data.path}}`, for example `{{data.customer.email}}` or
`{{data.plan}}`. Substitution is literal and single-pass: a resolved value is never scanned again. Any other use of
double braces is refused, and a template that names no text, number or boolean is a `workflow check` finding, so a
run never types an empty string by accident. Lists (such as fake-data tags) are joined with `, `.

### Screenshots

A `screenshot` step captures a PNG for **human review only**. It is never an assertion: nothing is compared with a
stored image, and no baseline or snapshot file is created or accepted.

```json
{ "kind": "screenshot", "name": "sign-up-filled", "fullPage": true, "mask": [{ "label": "Email" }], "caption": "The completed form; the email is masked." }
{ "kind": "screenshot", "name": "welcome-greeting", "target": { "role": "main" } }
```

- `name` (required): lowercase kebab-case, unique within the workflow; the file is `<name>.png`. At most 30 screenshot
  steps per workflow.
- `target` (optional): capture one element instead of the page. `fullPage: true` captures the whole scrollable page
  and cannot be combined with `target`; without either, the viewport is captured.
- `mask` (optional, up to 10 locators): elements painted over in the PNG, for example dynamic dates or personal data.
- `caption` (optional): shown in the documentation note and the run report.

Captures use disabled animations and a hidden caret. The run report lists each screenshot with its step number,
report path, size, SHA-256, caption and the browser label (pinned revision or non-pinned `SHELL_CHROMIUM` override);
the `run` result also returns the paths. The step builder offers "screenshot" with the full-page, mask and caption
questions.

The [UI review gallery](UI-REVIEW-GALLERY.md) captures and indexes its own surface matrix and cannot yet index
external screenshots, so workflow screenshots are not added to it; indexing them there is a follow-up.

## Documentation notes

`workflow docs` writes `docs/tests/workflows/<id>.md`:

- frontmatter: `type: TestWorkflow`, `id`, `title`, `target`, `status`, and after `record` also `lastRun`
  (`passed` or `failed`), `lastRunAt`, `lastRunSummary`, `lastRunDefinition` (the SHA-256 of the canonical definition
  that ran) and `lastRunScreenshots` (the run's screenshot report paths, when it took any);
- a generated block between `<!-- workflow:generated:start sha256=… -->` and `<!-- workflow:generated:end -->`:
  purpose, target, numbered steps in plain words ("Visit /", "Click button "Save"", "Fill field labelled "Email"
  with …", "Screenshot "sign-up-filled" (full page), masking 1 element: …"), the assertions, the screenshot steps, a
  test-data table with resolved values and the last recorded run with its screenshot report paths (paths only, no
  embedded images);
- everything else is yours: text between the frontmatter and the block and everything after the block is kept byte
  for byte. A new note starts with a `## Notes` section.

The recorded hash covers the frontmatter and the block. If either was edited by hand, `docs`, `save` and `record`
refuse and write nothing; move your text outside the block or restore it. A note without markers is never
overwritten. A recorded run is kept on regeneration only while the definition is unchanged; an edited workflow needs
a new run. `workflow check` reports missing, stale, edited and orphan notes (notes without a definition; a
`README.md` index is allowed).

## Export to a project's Playwright suite

`workflow export --name <id> --out <folder>` plans `<folder>/<id>.workflow.spec.ts`, an equivalent
`@playwright/test` spec: one `test.step` per workflow step, the same viewport and timeouts, templates resolved to
JSON string literals from the same seeded data. Nothing from the workflow becomes code. The spec uses root-relative
`page.goto` paths, so serve the target at the project's Playwright `baseURL`. Screenshot steps become
`page.screenshot({ path: test.info().outputPath('<name>.png'), … })` or `locator.screenshot(…)` with the same masks,
so the PNGs land in the project's test output folder (`test-results`); the exporter never emits an image comparison or
a snapshot directory. Regenerate the spec instead of editing it.

## Evidence and scope

The `workflows:browser` suite (`node tooling/testing/suites.mjs workflows:browser`) runs the shipped example with its
screenshots, a failing locator, blocked remote requests, a masked capture, loopback URL and prototype targets and the
exported spec in the Playwright test runner. It needs the `chromium` prerequisite and reports `not-run` without it. Browser resolution goes through
`src/cli/tooling/testing/browser-executable.mjs`: the pinned Playwright revision, or an explicit `SHELL_CHROMIUM` override
that the run report and the recorded note label as non-pinned. A workflow run is evidence for that workflow's steps
against that target only; it is not native Obsidian evidence, an accessibility audit or visual acceptance
(screenshots are for people to look at and are never compared with baselines).
