# Interactive Shell Maker

The interactive workspace now has a full-screen keyboard-driven TUI. See
[TUI controls, accessibility modes and terminal tests](TUI.md). Use `--ui plain`
for the line-oriented presentation. Existing agent commands remain available.

`bin/` is the TypeScript application for make-first authoring. It is included in
framework release kits and compiler-generated projects. Use the qualified toolchain
from the repository's `AGENTS.md` and exact lockfile; this feature adds no dependency.

## Set up an existing vault for Angular

Run `node shell.mjs project-setup --root <existing-vault>` for the existing-Git,
existing-Obsidian-vault workflow. It configures `configs/user-settings.json`,
imports typed Markdown PRDs, optionally prepares an Angular prototype, edits
application bricks, and optionally generates the product scaffold in one reviewed
plan. The same services are exposed as JSON commands. See
[Angular setup, settings and agent contract](PROJECT-SETUP.md) and
[the replayable example](examples/angular-setup.json).

The generated app supports an [optional first run](FIRST-RUN.md) with separate
execution approval. [Setup checkpoints](CHECKPOINTS.md) preserve reviewed answers
without retaining approvals. [Angular bricks](ANGULAR-BRICKS.md) describes the actual
generated templates, hash routes, scoped interactions and external-adapter boundaries.
Advanced settings and typed Markdown share `configs/user-settings.json`; the setup
guide includes reviewed path migration and configured canonical-project behavior.

## Create a project

Run `node shell.mjs new` (or `node shell.mjs` without a saved project) to choose a
project preset, select a compatible frontend, and start the prototype interview.
Plugin, webapp, website, CLI and hybrid targets generate matching source adapters;
design agreement and file-write approval remain separate. See the
[project preset and agent guide](PROJECT-PRESETS.md) for the eight presets,
noninteractive requests, generated artifacts and build-qualification boundaries.

## Make a page

```sh
node shell.mjs sketch
# A saved project also opens its editor through: node shell.mjs
```

Enter a project title, choose **Sketch a new page**, and enter its title. The page
outline lets you create and attach components, multi-select reusable definitions,
bulk-create components from one title per line (semicolons in plain mode), add
interactions, choose
navigation/state behavior, reorder/remove elements, change layout, or rename.
You can return to a saved page or the component library. Undo/redo covers the last
50 successful in-memory edits; errors never enter history. Escape goes back in the
TUI; `:back` cancels a plain-mode step. Ctrl-C cancels the session, and exiting with
unsaved changes requires confirmation.

Only a title is needed to create a project, page, component or interaction. IDs,
portable names, routes, component exports and draft defaults are derived. Identity
is stable across renames. New pages default to native view-backed surfaces so a
standalone page is valid without requiring an Obsidian host-view questionnaire.
A title-only interaction is explicitly unfinished; its behavior can be navigation,
preview state or an implementation TODO. Arbitrary scripts are never accepted.

**Save Companion project JSON** writes `design/project.json`, a complete validated
v6 Companion export, not a private CLI model. Existing configured projects use the
shared import/configuration plan. **Generate boilerplate** uses the dedicated
compiler, then a reviewed package write; it can emit an Obsidian plugin scaffold
or an offline clickdummy source project. Generated source is not automatically
business-complete, installed, built or natively accepted.

## Agent and non-interactive protocol

All authoring uses the same transaction executor and prototype guide resolver.
There is no interactive-only generator. Non-TTY input, `--no-interaction`, `--input`
or `--json` never prompts. Machine mode emits exactly one JSON document to stdout;
prompts/progress are on stderr. Exit 0 means the requested operation completed
(including read-only validation); 1 means failure; cancellation exits 130. Inspect
`ready`/`pending` in prototype validation, not only its exit code.

```sh
node shell.mjs sketch schema --json
node shell.mjs sketch show --json
node shell.mjs sketch export --json
node shell.mjs sketch --input sketch-request.json --json --no-interaction
```

Example `sketch-request.json` (title is required only for a new project):

```json
{
  "schemaVersion": 1,
  "title": "Issue desk",
  "operations": [
    { "op": "page.add", "title": "Issues", "as": "issues" },
    { "op": "page.add", "title": "Details", "as": "details" },
    { "op": "component.add", "title": "Issue card", "as": "card" },
    { "op": "page.attach", "page": "@issues", "components": [
      { "id": "@card" }, { "title": "Filters" }, { "title": "Summary" }
    ] },
    { "op": "interaction.add", "page": "@issues", "title": "Open issue", "as": "open" },
    { "op": "interaction.action", "page": "@issues", "id": "@open", "action": {
      "kind": "navigate", "target": "@details"
    } }
  ]
}
```

The first run only returns a plan. Inspect `data.document`, `changes` and `planHash`.
Repeat the **same command and unchanged input** with `--apply <planHash>` to write:

```sh
node shell.mjs sketch --input sketch-request.json --json --apply <reviewed-planHash>
node shell.mjs sketch generate --kind obsidian-plugin --out generated/issue-desk --json
# Review, then repeat with --apply <the-generation-planHash>.
```

An agent can also pipe JSON using `--input -`. `--root` chooses a project folder;
`--project` chooses its contained relative JSON path. Use `show` to discover stable
IDs before editing existing entities. `@aliases` are scoped to one atomic batch.
Failed operations preserve the original document. Reusing an already applied
creation request without its old approval is a *new creation proposal*, not an
idempotency key; the old plan hash cannot authorize different changes.

No `--yes` shortcut bypasses review. Before/after hashes detect stale inputs.
The shared safe writer refuses escapes, symlinks and portable path collisions,
serializes its own writes and rolls back completed writes on failure. The maker
receipt protects edited/unowned/removed generated files; retired outputs are
reported and preserved. These safeguards are not a claim of universal cross-process
filesystem transactions. Do not blindly retry an uncertain write; inspect recovery.

## Prepare a prototype

```sh
node shell.mjs prototype
# aliases: node shell.mjs make prototype; npm run make -- prototype
node shell.mjs prototype guide --json
node shell.mjs prototype validate --input prototype-answers.json --json
node shell.mjs prototype --input prototype-answers.json --out prototypes/issue-desk --json
# Review the prompt and full file manifest, then repeat with --apply <planHash>.
```

A minimal new-prototype answer envelope is:

```json
{
  "schemaVersion": 1,
  "guideId": "companion-prototype",
  "guideVersion": 1,
  "answers": {
    "title": "Issue desk",
    "pages": ["Issues", "Details"],
    "components": ["Issue card"],
    "approved": true
  }
}
```

The example above is for an unselected project. When `project.config.json` exists,
`prototype guide` and the interactive prototype maker retain that project selection
and use its guide. Always discover the actual guide ID/version before submitting
answers; an Angular project does not silently fall back to a plugin clickdummy.

`approved: true` records agreement with the resolved brief, including accepted
visible defaults. Discover and review those defaults first. A pending request for
concept boards or unresolved blocking questions prevents final prompt generation.
The CLI does not pretend to generate board images: complete that exploration with
the canonical skill, record selected decisions, or explicitly skip it. Feature and
improvement modes additionally require a complete baseline via `--project` and its
source revision; unrelated baseline IDs, fields and designs are retained.

The package contains the full bespoke `execution-prompt.md`, `design-brief.md`,
`README.md`, `INTEGRATION.md`, complete `companion.project.json`, replayable answers
and exact guide snapshot, preparation metadata/fingerprints/dependency pins,
compiler-derived integration mapping, a pending manifest and notices, and **real
compiler-generated source/** with the canonical Claude skill and its Codex adapter.
No dependency installation or build is performed by preparation. Pass the prompt
and package to an agent to start implementation directly. The manifest deliberately
remains incomplete, with a null `prototype.html` hash, until an actual artifact is
built and verified using the copied skill helpers.

## Extend the guide using data

Edit `bin/guides/prototype.json` or supply `--guide <file.json>` in either mode.
Its versioned definition owns steps, text/list/select/confirm fields, defaults,
required values, choices, earlier-field visibility conditions, readiness constraints
and literal artifact templates. Increment `version` for changed guide contracts;
old answer versions fail rather than silently taking new meanings. Tests verify
added fields/templates without new UI branching. TUI list entry uses one item per
line; plain-mode entry uses semicolons. Defaults retain their original list
boundaries, and JSON arrays can contain semicolons unchanged.

Template tokens are literal substitutions, never JavaScript evaluation. Every
answer can be referenced by field ID. Built-in tokens include `title`, `slug`,
`brief`, `projectJson`, `answersJson`, `contextJson`, `skillPath`, `integrationJson`
and `manifestJson`. Keep the core projection fields `title`, `mode`, `pages` and
`components`, and the handoff artifacts, when expanding this prototype guide.
Unsafe, duplicate or colliding artifact paths fail in the shared writer.

## Architecture and quality

`domain/` owns validated sketch/guide operations without Node or UI dependencies.
`application/` owns transactions, discovery schema, outline and history.
`adapters/` integrates bounded IO, the existing compiler, versioned input and safe
plans. `presentation/` maps terminal choices into exactly those operations.
`bin/shell.ts` is the process composition root. The legacy CLI remains available.

```sh
npm run typecheck:maker
npm run test:maker
npm run test:coverage:maker
npm run lint
npm run check:source
npm run check:analyzer
npm run check:maintainability
npm run verify
```

`bin/` is production input, not exempt tooling. It uses the same ESLint/oxlint,
400-code-line limit, 10 cyclomatic / 15 cognitive limits, 3% duplication gate and
independent coverage floors as runtime source. Core domain/application coverage
must meet 95% lines/statements/functions and 90% branches; complete maker production
must meet 90%/85%. Missing coverage inputs fail closed. Tests retain 450 code lines.
Full `verify`, normal/fast `shell check`, compiled kits and generated workspaces all
include maker checks. The dedicated CI job uses the exact pinned toolchain.

## Integrated preset compatibility

`new` now discovers the eight named presets documented in [PROJECT-PRESETS.md](PROJECT-PRESETS.md). The earlier five-family `prototypeRequest`/`frontend` request format is still accepted by `new --input` and `new validate`; its historical reference is [LEGACY-PROJECT-PRESETS.md](LEGACY-PROJECT-PRESETS.md). Existing `shell.project.json` projects retain their original emitter during sketch regeneration. New projects use the strict `project.config.json` sidecar. A workspace containing both sidecars is rejected rather than silently choosing one. Both formats retain plan hashes and default-No writes.
