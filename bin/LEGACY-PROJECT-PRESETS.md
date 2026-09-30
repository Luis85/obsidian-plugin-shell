# Legacy PR43 request and project compatibility

This is the retained five-family reference. Default `new presets` and `new guide` now expose the eight-preset contract in [PROJECT-PRESETS.md](PROJECT-PRESETS.md); existing `prototypeRequest` inputs and `shell.project.json` projects remain supported.

# Interactive Shell Maker

The interactive workspace now has a full-screen keyboard-driven TUI. See
[TUI controls, accessibility modes and terminal tests](TUI.md). Use `--ui plain`
for the original line-oriented presentation; agent commands are unchanged.

`bin/` is the TypeScript application for make-first authoring. It is included in
framework release kits and compiler-generated projects. Use the qualified toolchain
from the repository's `AGENTS.md` and exact lockfile; this feature adds no dependency.

## New project: preset, frontend, then prototype

```sh
node bin/app new
# Alias: node bin/app make project
node bin/app new presets --json
node bin/app new guide --json
```

A fresh interactive `node bin/app` starts this flow. Existing workspaces keep the
page/component studio. `node bin/app sketch` explicitly opens that studio even
in a fresh directory. No existing project is converted or overwritten implicitly.

| Project preset | Next frontend choice | Generated runtime |
| --- | --- | --- |
| Obsidian plugin | Nuxt UI (Vue), vanilla Obsidian, Angular | Native plugin entrypoint and view |
| Web application | Nuxt UI (Vue), vanilla | Browser application |
| Website | Vanilla, Nuxt UI enhancement | Static, linked HTML pages; content works without JavaScript |
| Command-line application | No frontend step | Node CLI with human and JSON output |
| Hybrid | Choose at least two runtimes, then a compatible frontend | Separate runtime outputs sharing one framework-free core |

Angular hybrid can include plugin, webapp and CLI, but not website: there is no
Angular prerender adapter. Unsupported pairs fail rather than silently selecting
a different stack. Nuxt UI means Vue/Vite, **not a Nuxt server application**.

Next comes the data-driven project prototype interview: goals, users, workflows,
pages or commands, component placeholders, states, acceptance and design decisions.
Unresolved questions or requested concept boards block final preparation. The
complete brief needs explicit agreement, and the complete write plan needs a
separate approval. Back, cancellation, help and accessible plain mode remain
available. Choosing a stack is not approval of the product design.

The resulting package contains the agreed brief, execution prompt, replayable
`project-create.json`, catalog/guide snapshots, integration map, incomplete
artifact manifest, Companion v6 JSON, and generated **`source/`**. The separate
`source/shell.project.json` records runtime/frontend choices; the closed Companion
schema is not extended with framework fields. The canonical Claude skill and its
Codex adapter are copied, with a project-preset profile that preserves the selected
stack instead of forcing every result back to Vue/Pinia or one HTML file.

### Agent equivalence and review

Discover the current catalog and guide defaults before agreeing to them. Example:

```json
{
  "schemaVersion": 1,
  "catalogVersion": 1,
  "preset": "plugin",
  "frontend": "angular",
  "prototypeRequest": {
    "schemaVersion": 1,
    "guideId": "project-prototype",
    "guideVersion": 1,
    "answers": {
      "title": "Issue desk",
      "pages": ["Overview", "Issues"],
      "components": ["Card"],
      "approved": true
    }
  }
}
```

`prototypeRequest` is intentional: the shared JSON safety boundary rejects the
reserved key `prototype`. Hybrid adds `"targets": ["plugin", "webapp", "cli"]`.
CLI accepts omitted frontend and resolves it to `none`.

```sh
node bin/app new validate --input project-create.json --json
node bin/app new --input project-create.json --out projects/issue-desk --json
# Inspect the full prompt, document and change manifest; repeat unchanged:
node bin/app new --input project-create.json --out projects/issue-desk --json --apply <reviewed-planHash>
```

The TUI, plain prompts and agent mode use the same validated request, compiler
model and safe-plan writer. Neither selection nor preparation installs packages,
executes an AI provider, builds a finished prototype, activates a native plugin,
creates a remote repository or publishes anything.

### Use and qualify generated sources

Start with the package's `execution-prompt.md`. In `source/`, use Node 24.21.0 and
npm 11.19.1, review the generated dependency pins, then explicitly run:

```sh
npm install
# Review and commit the resolved package-lock.json; subsequent clean installs:
npm ci
npm run typecheck
npm test
npm run build
```

Each requested target is emitted under `dist/plugin`, `dist/webapp`,
`dist/website` or `dist/cli`. `npm run build:<target>` updates only that target and
retains sibling outputs. Builds use an exclusive lock and staging; a failed build
must retain the last complete output. Do not delete a stale lock without first
checking for a live build/recovery state. Native activation requires separate
explicit, isolated-vault qualification. Hybrid shares source/domain contracts,
not an implied cross-runtime storage or synchronization service.

The generated UI implements navigation and honest component placeholders, not the
agreed business interactions automatically. Website Nuxt UI adds a labeled demo
interaction without replacing static content. CLI generated commands expose the
page/command model with structured success/failure output. The complete original
Companion document remains available for subsequent implementation.

After editing pages/components with the original shell installation and
`--root <generated-source>`, `sketch generate` without `--kind` reuses the recorded
preset. Generate to a separate output folder: regeneration is not a code merge
engine. An explicit legacy `--kind` remains available. The lean generated project
does not embed a second copy of the entire shell CLI.

Catalog definitions live in `bin/guides/project-presets.json`, the new interview
in `bin/guides/project-prototype.json`, and registered source templates in
`scripts/compiler/presets/templates.json`. Catalog data may select existing
emitters and narrow capabilities; adding a new framework needs an implemented,
tested emitter, not an executable module path in user JSON. Version changes are
explicit; old requests are not silently reinterpreted. The original
`companion-prototype` guide remains backward compatible.

`.github/workflows/project-presets.yml` separately qualifies ten fresh generated
consumer combinations on the pinned toolchain: resolved locks and `npm ci`, source
typechecking, core tests, bundles, actual browser/CLI interactions, CSS ownership
and preservation after an intentionally failed build. Its logs and consumer
lockfiles are evidence; merely generating sources is not proof these checks ran.
Manual Obsidian activation, mobile, accessibility and business acceptance remain
separate. No quality or coverage thresholds are reduced by this extension.

## Make a page

```sh
node bin/app sketch
# Existing workspace: node bin/app
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
node bin/app sketch schema --json
node bin/app sketch show --json
node bin/app sketch export --json
node bin/app sketch --input sketch-request.json --json --no-interaction
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
node bin/app sketch --input sketch-request.json --json --apply <reviewed-planHash>
node bin/app sketch generate --kind obsidian-plugin --out generated/issue-desk --json
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
node bin/app prototype
# aliases: node bin/app make prototype; npm run make -- prototype
node bin/app prototype guide --json
node bin/app prototype validate --input prototype-answers.json --json
node bin/app prototype --input prototype-answers.json --out prototypes/issue-desk --json
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
`bin/app.ts` is the process composition root. The legacy CLI remains available.

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
