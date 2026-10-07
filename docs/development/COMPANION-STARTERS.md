# Companion golden starter and visual-feature showcase

> Type: reference · Part of the [docs index](../README.md)

The current Companion build starts with an empty workspace (or reopens the user's
saved project). It does not embed the Companion self-project or a starter catalog.
The shell and current authoring build share the external starter contract.

## Sources of truth

| Artifact | Authority |
| --- | --- |
| `configs/starters/companion-plugin.json` | Canonical, editable v6 Companion development model and complete starter recipe. |
| `configs/starters/feature-showcase.json` | Executable examples of every currently catalogued visual primitive, control kind, action kind, state and layout. |
| `reports/companion-mvp/index.html` | Current empty authoring build, created by `npm run companion:build`. |
| `reports/companion-mvp/companion-project*.json` | Explicit, derived qualification inputs only; not maintained project authorities or starter distribution assets. |
| `docs/concepts/companion/index.html` | The checked-in schema 6 concept that `npm run companion:build` mounts the editor islands into (`build-companion.py --check` must pass first). It embeds no starter or project; it is not the current empty entry point or the golden development template. |

The canonical starter holds the full design, not a screenshot or an HTML wrapper.
It contains 28 surfaces, 27 visual pages, 54 components and 54 pinned component
revisions, 23 routes and three journeys. These counts describe the model, not
completed business behavior. Advance the current golden model in
`configs/starters/companion-plugin.json`, never in the checked-in concept.

The current project format is **Companion project schema 6 only**. Every Companion
starter (the twelve focused examples, the golden Companion and the visual-feature
showcase: fourteen definitions) embeds a project v6 document; a definition embedding
schema 1–5 is rejected with `STARTER_VERSION`, and earlier formats are never migrated.
The eleven original examples were converted once from their v5 models (only the two
version fields changed); `agent-ready` was authored in v6. No central catalog file is required.

## Empty startup and project setup

1. Build with `npm run companion:build`, then open
   `reports/companion-mvp/index.html`. Existing project recovery takes precedence
   over the welcome screen. Corrupt or future data is not silently replaced.
2. Choose **Blank project**, or **Choose a starter** and select one or more JSON
   files from the independently downloaded starter pack. File-based starters can
   be inspected here but require the CLI because they have no editable Companion
   design; they are not coerced into a different model.
3. Review definition-driven input fields. Identity, folders and native-extension
   inputs are validated through the shared contract. Cancel leaves the project
   unchanged. Confirm the project review before creating or replacing a project.
4. Continue into project setup. The browser prototype simulates setup: it does
   not write a real boilerplate, install dependencies, activate a plugin or grant
   trust to processes. The handoff provides the separate CLI workflow.

Imports are atomic at the selected-batch level, reject duplicate IDs in a batch,
use fatal UTF-8 decoding, and verify SHA-256 over the actual imported bytes. The
limits are 4 MB per definition, 16 MB per loaded session and 256 definitions.
Operation requests retain their separate 1 MiB data limit. A source change after
review invalidates the pending review rather than replacing the project with
unreviewed bytes. A content hash is identity/integrity evidence, not a signature.

Definitions remain local to the browser session. Importing definitions never
imports process approval, machine credentials, filesystem access or test results.
The committed project retains its own existing recovery/persistence contract.

## Maintain the golden template

Use the JSON recipe rather than a manually maintained current project export:

1. Load `companion-plugin.json`, configure the project, review it and create the
   working copy. Edit its pages, components, routes and other supported model data.
2. Open **Review shell handoff** / **Export and generate**, then **Export starter
   JSON**. Save the result as `configs/starters/companion-plugin.json` after review.
   This export retains supplementary files, processes, dependencies and first-run
   choices; it updates the model and input defaults. No session approval is saved.
3. After reopening the project in another session, load its recipe again and
   select **Use recipe for current project**. Explicitly confirm attachment for
   export. This attaches a reviewed recipe without replacing project content.
   Source changes or project changes after review block attachment. Required
   additional inputs without defaults also block it rather than being guessed.
4. Validate, inspect changes, regenerate and execute applicable checks. Version
   the definition deliberately; do not silently promote it to native acceptance.

`Export project JSON` remains available, but it intentionally omits the extra
recipe. Use it for a project handoff, not as a substitute for golden-starter
maintenance. Recipe attachment supplies the separately reviewed files/processes
and uses the current project's identity/folders as export defaults. Other input
values come from that recipe's defaults.

```sh
node bin/app starters validate companion-plugin --json
node bin/app starters show companion-plugin --json
node bin/app starters coverage companion-plugin --json

# Preview the proposed definition edit; add --yes only after reviewing it.
node bin/app starters edit companion-plugin --input ./reviewed-companion-plugin.json
```

## Generate through the shell

Extract the shell and starter archives separately into the same workspace, so
`configs/starters/` is in the same package root as `bin/app`. An extracted shell alone lists zero
starters. A configured `paths.startersFolder` in `configs/user-settings.json` can
select another contained folder. There is no fallback to an embedded library.

```sh
node bin/app starters list
node bin/app new ../companion-development --starter companion-plugin
node bin/app new ../companion-development --starter companion-plugin --yes

node bin/app new ../visual-feature-demo --starter feature-showcase
node bin/app new ../visual-feature-demo --starter feature-showcase --yes
```

Only the confirmed file plan creates the project. Run subsequent processes by
explicit selection and trust, or manually run the generated project's scripts:

```sh
cd ../visual-feature-demo
npm ci
npm run typecheck:project
npm test
npm run test:ui-effects
npm run testdata:check
npm run build
npm run build:clickdummy
```

The generated project has `dist/main.js`, `dist/styles.css`, `dist/manifest.json`
and an independently compiled `clickdummy.html`. The latter runs generated Vue
source, not the authoring HTML. Install into an isolated native test vault only
through the existing separately approved development flow.

`--yes` alone never installs dependencies or starts processes. `--install`
selects a definition's `firstRun`, and also requires `--trust-processes`.
Explicit process execution is not a blanket authorization for later releases,
plugin activation, credential use or a different project's source.

## What the showcase exercises

The source-derived model inventory currently covers:

| Category | Coverage |
| --- | --- |
| Visual primitives | All 22 entries in the reviewed Nuxt UI catalog. |
| Input controls | All ten declared kinds, including booleans, select options, native date/datetime/number fields, pasted JSON and file-selected JSON. |
| Actions | All seven kinds: emit, navigate, set-state, toggle, focus, set-value and source. |
| States and layouts | Default/loading/empty/error/disabled; stack/row/grid. |
| Composition | A reusable component, slot content, props, variants, emitted events and immutable revision binding; an authored layout. |
| Navigation | Nine routes, a journey, local tabs/commands/menus and modal/drawer interactions. |
| Data | Typed source declarations and explicit authored populated/empty scenarios. No real backend is contacted. |
| Editor/native declarations | Real Journey Lens editing in the generated preview; custom `.folio` file and context-menu declarations. Native host behavior requires separate qualification. |

The default fixture adapter starts empty; an explicit read returns schema-derived
synthetic data. The authored populated scenario has two separately declared
records, and the authored empty scenario has none. These are deliberately
separate mechanisms; neither is a production database or an implicit data write.

The implementation includes generic shared runtime fixes discovered through these
examples: two-way overlay open state, menu item dispatch, select options, native
input types, JSON file ingestion and local default icons. JSON file reads reject
invalid/oversized/unsafe data, preserve the last good value, and ignore stale or
disposed reads. Legacy JSON textarea input retains its earlier paste-as-text
behavior. JSON definitions never carry executable event callbacks.

```sh
node bin/app starters coverage feature-showcase --require-model-coverage --json
```

This command reports **model inventory**, not executed or native acceptance. Its
`behaviorAcceptance` and `nativeAcceptance` values remain `not-run`; do not rewrite
them because a category appears in JSON. Read the separate candidate-bound tests.
An unbound action or missing menu handler is separately reported. Coverage of
catalog kinds is not exhaustive coverage of all combinations or all high-level
Companion workflows.

## Golden-model qualification

The normal authoring build no longer exports the self-project automatically. For
existing generation/qualification tooling, derive it explicitly:

```sh
npm run companion:build
node tooling/concepts/export-golden-project.mjs
node tooling/concepts/export-golden-project.mjs --check
```

The receipt binds the actual canonical starter bytes, exported project bytes and
empty authoring HTML. Missing starters and stale source/HTML/project receipts
fail closed. Nothing recreates a missing canonical definition from legacy seeds.
The two familiar project export names are compatibility aliases of this one
explicit export, not independent maintained files.

## Browser replay and distribution checks

The CI workflow provisions the pinned toolchain, independently installs generated
project dependencies, builds the showcase and runs real file-origin browser tests.
It is an execution recipe, not evidence of a run until CI has actually completed.

For direct replay after generation and build:

```sh
node src/companion/tests/concepts/starter-workspace.browser.mjs
node src/companion/tests/concepts/feature-showcase.browser.mjs --html ../visual-feature-demo/clickdummy.html
```

When an environment does not permit file-origin navigation, the explicit
`--inline-adapters` (starter lifecycle) and `--inline` (compiled showcase) modes
record a narrower scope. The former substitutes memory storage and a SHA-256 host
bridge. Neither mode proves native storage, native Obsidian behavior or file-origin
compatibility. Do not relabel their reports as hosted/native acceptance.

`companion:starter-browser` in the suite manifest requires the current authoring
build and a copied compiled artifact at `reports/feature-showcase/clickdummy.html`.
The concept browser suites of the checked-in concept remain separate and retain all their assertions.

Shell packaging excludes current definitions (the concept embeds no starter data,
self-project JSON or visual seed). Only a closed list of reviewed Vue Flow
runtime assets and notices remains: the generated Journey Lens needs this engine
code, not a starter. The standalone starter ZIP contains definitions only.

The omitted license in the pinned `vaul-vue@0.4.1` package is retained under
`docs/licenses/` with exact upstream-version provenance and a hard SHA-256 guard.
A different version or edited notice fails; it cannot inherit this exception.
No font binaries are included in these deliverables.

## Remaining acceptance work — do not mark complete

The visual-feature showcase is not the complete native Companion application.
The golden model still contains three explicit empty action lists and additional
high-level implementation hooks. That small count is **not** the complete missing
behavior inventory. Its descriptive visual model does not implement the native
page/component authoring tools, all persistence/data-source adapters, process
orchestration, every requirement workflow or the full self-hosting application.
The only shipped dedicated editor binding is currently `journey-lens`.

Full parity still requires an item-by-item capability-to-behavior crosswalk,
implementation of missing native/business adapters, accepted generated Companion
business tests, native Obsidian end-to-end acceptance, and complete applicable
coverage/lint/security/maintainability gates. Generated acceptance TODOs stay TODO.
Do not delete them, weaken thresholds, or count model coverage as completion.

Preserve the retained framework/Companion release sequence. Source generation,
browser replay, a native bundle build, native execution, product acceptance and
publication are different results. This change does not authorize a tag, merge,
release, listing submission, personal-vault operation or plugin activation.
