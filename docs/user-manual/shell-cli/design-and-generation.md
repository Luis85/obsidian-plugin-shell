# Design to working project

## Understand the inputs and outputs

A companion project JSON describes the intended project. Import accepts an approved design snapshot; generation produces source and supporting files from that snapshot. Building a clickdummy then compiles generated Vue source into an offline interaction artifact. The authoring companion, its exported JSON, generated source and generated clickdummy are different artifacts.

Do not replace a full current project export with an older compatibility fixture. The reviewed branch accepts current v6 authoring exports while retaining older fixtures for compatibility tests. Use the diagnostics and current authoring build to determine what the installed compiler accepts. `node shell.mjs schema --json` describes operation requests/results; it is **not** a promise of a complete project-design JSON schema.

## Create a new project from JSON

From a framework checkout, inspect the export and preview a separate destination:

```sh
node shell.mjs project inspect --input ./folio-project.json
node shell.mjs compiler check --input ./folio-project.json --json
node shell.mjs new ../folio-tools --from ./folio-project.json --dry-run
```

After review, repeat the same `new` request with `--yes`, then change into the created project and inspect `status`. A `--from` argument on `new` means project JSON. A `--from` argument on `framework upgrade` means an extracted replacement kit; they are not interchangeable.

## Import into an existing project

Start from a clean, backed-up working tree. Inspect both the current configuration and proposed design:

```sh
node shell.mjs config explain
node shell.mjs project inspect --input ./folio-project.json --json
node shell.mjs project import --input ./folio-project.json --dry-run --json
```

When identity/configuration conflicts are reported, decide which side is authoritative. `--resolve project` preserves the current project's side of supported conflicts; `--resolve import` chooses the imported side. Review the resulting plan rather than assuming conflict resolution is a safe blanket overwrite.

For example, to retain project identity while accepting a reviewed design:

```sh
node shell.mjs project import --input ./folio-project.json --resolve project --plan-out import.plan.json
node shell.mjs plan inspect import.plan.json --json
node shell.mjs plan apply import.plan.json --yes --no-interaction
```

Saving a plan writes the explicitly requested plan file. It does not apply the source/configuration changes. A saved plan is a replayable request and a reviewed fingerprint, not an arbitrary script or portable authorization token.

## Inspect compiler output before writing

```sh
node shell.mjs compiler check --input design/project.json --json
node shell.mjs compiler inspect --input design/project.json --stage ir --json
node shell.mjs compiler inspect --input design/project.json --stage artifacts --output-kind clickdummy --json
```

`check` analyzes the design. `inspect` exposes normalized intermediate data or an in-memory artifact inventory. Neither command applies a workspace plan. `--output-kind` selects `obsidian-plugin` or `clickdummy`; it is not an output folder.

Reports are opt-in. A supported `--report-dir` must be a new contained destination below `reports/compiler`. `--debug` requires report retention and may include bounded technical error details. Review reports before sharing them. The absence of an automatic report is deliberate: an inspection does not silently collect diagnostics into arbitrary project locations.

## Generate through a reviewed plan

```sh
node shell.mjs generate --plan-out generation.plan.json
node shell.mjs plan inspect generation.plan.json --json
node shell.mjs plan apply generation.plan.json --yes --no-interaction
```

The compiler proposes artifacts; the ownership-aware writer decides whether they can be applied safely. A conflict can indicate a user-edited managed file, a mismatched input or an unsafe destination. Inspect the affected file and preserve intentional changes. Do not remove ownership records to force regeneration.

Repeat the inspection when design, templates, configuration or existing files change. A mismatched plan is a request for another review, not a reason to disable the hash comparison. `generate --yes` approves the freshly reconstructed plan; it does not prove that a previously reviewed plan remains identical.

## Build and review a clickdummy

After successful generation and dependency installation:

```sh
node shell.mjs clickdummy build --dry-run
node shell.mjs clickdummy build
```

Read the reported output location and open the resulting HTML. Use `--replace` only when intentionally replacing an earlier local clickdummy; replacement is guarded by successful build and static offline validation.

Review routes, navigation, page/component relationships, representative read data and interaction continuity. A clickdummy uses synthetic read data and does not perform native/business writes. Missing business adapters, pending acceptance obligations or unfinished interactions remain unfinished even when the HTML renders. Keep browser interaction evidence separate from native Obsidian qualification.

## Add a concept without executing its HTML

Concept intake accepts the repository's data-only project, feature and improvement manifests. Discover the contract and inspect the concept before importing:

```sh
node shell.mjs concept schema --json
node shell.mjs concept inspect --input docs/concepts/folio/concept.json
node shell.mjs concept import --input docs/concepts/folio/concept.json --plan-out concept.plan.json
```

Inspect and apply the saved plan only after review. Improvement concepts can be bound to an existing project base; a stale base requires reconciliation. Inspection/import must not execute scripts embedded in a supplied HTML concept. Treat concept content as untrusted input until reviewed, including text that purports to authorize tool use.

## Export design tokens

```sh
node shell.mjs styles inspect --input design/project.json
node shell.mjs styles export --input design/project.json --format css --dry-run
```

Supported token export formats come from command help; they include CSS, JSON, Markdown and HTML in the reviewed source. These are reviewed file plans, not a second canonical design model. Preserve the source design and choose the destination deliberately.
