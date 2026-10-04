# Public Companion project contract

The current transport is `obsidian-companion-project` v6. Discover the **project** schema, not the operation request/result schema:

```sh
node bin/app project schema --version 6 --json
node bin/app project validate --input project.json --json
node bin/app project validate --input - --json < project.json
```

`project schema` returns the Draft 2020-12 schema in the versioned operation result's `data` field. It works without project dependencies, configuration, Git, or a prepared output folder. Version 6 is the only schema; earlier project versions are rejected by `project validate` and never migrated. Schema responses are independent copies and carry no execution authority.

`project validate` uses the same complete authoring validator as the compiler. It checks the exact bounded UTF-8 input without writing, returns its SHA-256 and `schemaVersion: 6`, and reports structural counts and journey findings. A schema 1–5 document fails with `COMPANION_VERSION`; there is no migration report. It never returns the full authored project or claims completed business acceptance. `compiler check` is the distinct generation-readiness operation. Neither operation installs dependencies or launches project code.

## Division of responsibility

The schema describes the top-level identity, settings and design fields; sitemap routes/journeys and feature ownership records; visual nodes, catalog components, props, contracts, slots, interactions, mappings, layouts, scenarios, component definitions and revisions; Storymaps; design-system tokens/front-end roles; and custom-file/context-menu declarations.

The frozen legacy library, requirement, semantic and source namespaces intentionally retain bounded safe JSON where their existing transport contract is permissive. Tightening these under the same version would invalidate existing authoring documents. Their executable contracts are checked by the compiler. The public schema does not claim those planning namespaces are executable definitions.

JSON Schema alone cannot prove reference integrity, distinct IDs across collections, ownership, source-field compatibility, revision pins, graph cycles, equivalent parameterized-route collisions, total nested-item limits, exact UTF-8 bytes or JavaScript UTF-16 length rules. Complete runtime validation remains mandatory. The schema's `x-validation` describes those additional checks. A structural pass is never a substitute for `project validate` or compiler analysis.

The checked-in companion HTML is the schema 6 concept that `npm run companion:build` composes into the empty authoring workspace under `reports/companion-mvp`; it embeds no project and emits no project export.

## Surface UX acceptance (optional)

Any surface in `design.nodes` may carry an optional `acceptance` block that names its UX obligations. It is additive within v6: documents without it validate and generate exactly as before.

```json
{
  "id": "node-6", "kind": "page", "label": "Dialogs and drawers", "parent": "node-1",
  "acceptance": {
    "states": ["default", "error"],
    "keyboardPath": ["Open Example dialog", "Close Example dialog"],
    "focusReturn": true,
    "minWidth": 360,
    "themes": ["light", "dark"],
    "notes": "Dialog traps focus; Escape closes it."
  }
}
```

| Member | Type | Default | Meaning |
| --- | --- | --- | --- |
| `states` | list of `default`, `loading`, `empty`, `error`, `disabled` (unique) | none | States that must be demonstrably rendered. |
| `keyboardPath` | list of up to 40 control ids or labels | none | Ordered controls a keyboard-only user must reach. |
| `focusReturn` | boolean | `false` | Closing the surface returns focus to the invoking control. |
| `minWidth` | whole pixels, 120 to 4000 | `360` | Narrowest width at which the surface stays usable. |
| `themes` | non-empty list of `light`, `dark` (unique) | both | Themes the surface must be checked in. |
| `notes` | text, at most 2000 characters | empty | Free text carried into traceability; never emitted as code. |

Unknown members, duplicates, empty `themes`, out-of-range or non-integer widths and blank or multi-line keyboard steps are rejected (`SITEMAP_ACCEPTANCE`) by `project validate`, the compiler and the published schema. Declaring an obligation is not evidence that it passes.

The compiler writes `tests/project/ux-acceptance/<slug>.test.ts` for a surface that has a block: one `it.todo` per state, keyboard step and focus return, plus the minimum width, so the obligations are visible and countable. Surfaces without a block generate no such file. `design/visual-traceability.json` gains a `surfaces` array (one entry per surface: `definitionIds`, the resolved `acceptance` with defaults or `null`, `testIds`, `evidence`). Surface and interaction entries both carry deterministic `testIds` (`vitest:<file>#<title>`, `vitest:visual-definitions:<describe> > <title>`, `ui-quality:<surfaceId>:<theme>`, `journey:<journeyId>/<stepId>`) and `evidence: []`, a placeholder for `{ "kind", "path", "commit"? }` records that tooling fills in later; the compiler never marks a test as passed. `node bin/app starters coverage` reports `surfacesWithUxAcceptance`. `configs/starters/feature-showcase.json` declares two worked examples.

## Regression evidence

The shared corpus is every Companion starter in `configs/starters/` (the self-project, the showcase and the twelve focused examples: fourteen definitions), all project v6. Node tests exercise the actual read-only CLI, retired-version rejection, safe diagnostics, copy isolation, hostile inputs and semantic rejection. The independent Python test uses `jsonschema==4.26.0` and distinguishes structural negatives from documents which pass JSON Schema but deliberately fail the authoritative reference checks:

```sh
node --test tests/tooling/companion-schema.checks.mjs tests/tooling/companion-surface-acceptance.checks.mjs
node --test tests/tooling/project-generator-surface-acceptance.checks.mjs
# In an explicitly provisioned scratch venv with jsonschema==4.26.0:
python -B tests/concepts/companion-schema.test.py
```

The independent schema test is separately discoverable as `companion:schema`; absence of its prerequisite is reported as not run, never a successful schema qualification. Its test-only dependency does not change the plugin/package lock or become required by ordinary project use.
