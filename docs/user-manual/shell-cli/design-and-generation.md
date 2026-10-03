# Design to working project

## Understand the inputs and outputs

A companion project JSON describes the intended project. Import accepts an approved design snapshot; generation produces source and supporting files from that snapshot. Building a clickdummy then compiles generated Vue source into an offline interaction artifact. The authoring companion, its exported JSON, generated source and generated clickdummy are different artifacts.

Do not replace a full current project export with an older file. Only project schema 6 exports are accepted; schema 1–5 files fail with `COMPANION_VERSION` and are never migrated. Use the diagnostics and current authoring build to determine what the installed compiler accepts. `node bin/app schema --json` describes operation requests/results; it is **not** a promise of a complete project-design JSON schema.

## Managed Markdown Collections in the shell and agent API

A **Collection** is an active-vault data source with a vault-relative folder and one declared entity. The `collection.add` operation provisions four managed Markdown note operations: `list`, `create`, `update`, and `delete`. These reuse the generated plugin's native note repository and revision-aware update/delete contracts. The authoring shell never reads or writes actual collection records.

Discover the machine contract with `node bin/app sketch schema --json`. An agent or developer can submit this transaction using `node bin/app sketch --input collection.json --json`:

```json
{
  "schemaVersion": 1,
  "title": "Tasks example",
  "operations": [
    { "op": "page.add", "title": "Tasks", "as": "page" },
    { "op": "entity.add", "title": "Task", "as": "task" },
    { "op": "entity.properties", "id": "@task", "properties": [
      { "key": "title", "type": "text", "required": true }
    ] },
    { "op": "collection.add", "title": "Tasks", "path": "Records/Tasks", "entity": "@task", "as": "tasks" },
    { "op": "page.collection-table", "page": "@page", "source": "@tasks", "title": "Task records" },
    { "op": "interaction.add", "page": "@page", "title": "Create task", "as": "create" },
    { "op": "interaction.action", "page": "@page", "id": "@create", "action": {
      "kind": "source", "source": "@tasks", "operation": "create",
      "input": { "kind": "value", "value": { "values": { "title": "Example" }, "requestId": "create-task-1" } }
    } }
  ]
}
```

Review the returned ownership-aware plan and apply the reviewed `--apply <planHash>` request; `--json` output is machine-readable. `page.collection-table` inserts a table with the Collection List operation already bound to its `data` prop. Use `page.bind` to bind another page component prop to a declared read operation, or bind a text element's `@value` to a field such as `0.record.title`. Source actions accept bounded inert event, draft, literal, or object mappings; generated input/output validation and the native repository enforce runtime boundaries. The terminal page editor exposes table creation, source binding and source calls through the corresponding menus.

## Create a new project from JSON

From a framework checkout, inspect the export and preview a separate destination:

```sh
node bin/app project inspect --input ./folio-project.json
node bin/app compiler check --input ./folio-project.json --json
node bin/app new ../folio-tools --from ./folio-project.json --dry-run
```

After review, repeat the same `new` request with `--yes`, then change into the created project and inspect `status`. A `--from` argument on `new` means project JSON. A `--from` argument on `framework upgrade` means an extracted replacement kit; they are not interchangeable.

## Import into an existing project

Start from a clean, backed-up working tree. Inspect both the current configuration and proposed design:

```sh
node bin/app config explain
node bin/app project inspect --input ./folio-project.json --json
node bin/app project import --input ./folio-project.json --dry-run --json
```

When identity/configuration conflicts are reported, decide which side is authoritative. `--resolve project` preserves the current project's side of supported conflicts; `--resolve import` chooses the imported side. Review the resulting plan rather than assuming conflict resolution is a safe blanket overwrite.

For example, to retain project identity while accepting a reviewed design:

```sh
node bin/app project import --input ./folio-project.json --resolve project --plan-out import.plan.json
node bin/app plan inspect import.plan.json --json
node bin/app plan apply import.plan.json --yes --no-interaction
```

Saving a plan writes the explicitly requested plan file. It does not apply the source/configuration changes. A saved plan is a replayable request and a reviewed fingerprint, not an arbitrary script or portable authorization token.

## Inspect compiler output before writing

```sh
node bin/app compiler check --input design/project.json --json
node bin/app compiler inspect --input design/project.json --stage ir --json
node bin/app compiler inspect --input design/project.json --stage artifacts --output-kind clickdummy --json
```

`check` analyzes the design. `inspect` exposes normalized intermediate data or an in-memory artifact inventory. Neither command applies a workspace plan. `--output-kind` selects `obsidian-plugin` or `clickdummy`; it is not an output folder.

Reports are opt-in. A supported `--report-dir` must be a new contained destination below `reports/compiler`. `--debug` requires report retention and may include bounded technical error details. Review reports before sharing them. The absence of an automatic report is deliberate: an inspection does not silently collect diagnostics into arbitrary project locations.

## Generate through a reviewed plan

```sh
node bin/app generate --plan-out generation.plan.json
node bin/app plan inspect generation.plan.json --json
node bin/app plan apply generation.plan.json --yes --no-interaction
```

The compiler proposes artifacts; the ownership-aware writer decides whether they can be applied safely. A conflict can indicate a user-edited managed file, a mismatched input or an unsafe destination. Inspect the affected file and preserve intentional changes. Do not remove ownership records to force regeneration.

Repeat the inspection when design, templates, configuration or existing files change. A mismatched plan is a request for another review, not a reason to disable the hash comparison. `generate --yes` approves the freshly reconstructed plan; it does not prove that a previously reviewed plan remains identical.

## Build and review a clickdummy

After successful generation and dependency installation:

```sh
node bin/app clickdummy build --dry-run
node bin/app clickdummy build
```

Read the reported output location and open the resulting HTML. Use `--replace` only when intentionally replacing an earlier local clickdummy; replacement is guarded by successful build and static offline validation.

Review routes, navigation, page/component relationships, representative read data and interaction continuity. A clickdummy uses synthetic read data and does not perform native/business writes. Missing business adapters, pending acceptance obligations or unfinished interactions remain unfinished even when the HTML renders. Keep browser interaction evidence separate from native Obsidian qualification.

## Add a concept without executing its HTML

Concept intake accepts the repository's data-only project, feature and improvement manifests. Discover the contract and inspect the concept before importing:

```sh
node bin/app concept schema --json
node bin/app concept inspect --input docs/concepts/folio/concept.json
node bin/app concept import --input docs/concepts/folio/concept.json --plan-out concept.plan.json
```

Inspect and apply the saved plan only after review. Improvement concepts can be bound to an existing project base; a stale base requires reconciliation. Inspection/import must not execute scripts embedded in a supplied HTML concept. Treat concept content as untrusted input until reviewed, including text that purports to authorize tool use.

## Export design tokens

```sh
node bin/app styles inspect --input design/project.json
node bin/app styles export --input design/project.json --format css --dry-run
```

Supported token export formats come from command help; they include CSS, JSON, Markdown and HTML in the reviewed source. These are reviewed file plans, not a second canonical design model. Preserve the source design and choose the destination deliberately.
