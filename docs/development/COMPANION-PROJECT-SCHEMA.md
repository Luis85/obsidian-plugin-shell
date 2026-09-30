# Public Companion project contract

The current transport is `obsidian-companion-project` v6. Discover the **project** schema, not the operation request/result schema:

```sh
node bin/app project schema --version 6 --json
node bin/app project validate --input project.json --json
node bin/app project validate --input - --json < project.json
```

`project schema` returns the Draft 2020-12 schema in the versioned operation result's `data` field. It works without project dependencies, configuration, Git, or a prepared output folder. Version 6 is the only published current schema; legacy v1–v5 inputs go through `project validate`. Schema responses are independent copies and carry no execution authority.

`project validate` uses the same complete authoring validator/migration as the compiler. It checks the exact bounded UTF-8 input without writing, returns its SHA-256 and migration report, and reports structural counts and journey findings. It never returns the full authored project or claims completed business acceptance. `compiler check` is the distinct generation-readiness operation. Neither operation installs dependencies or launches project code.

## Division of responsibility

The schema describes the top-level identity, settings and design fields; sitemap routes/journeys and feature ownership records; visual nodes, catalog components, props, contracts, slots, interactions, mappings, layouts, scenarios, component definitions and revisions; Storymaps; design-system tokens/front-end roles; and custom-file/context-menu declarations.

The frozen legacy library, requirement, semantic and source namespaces intentionally retain bounded safe JSON where their existing transport contract is permissive. Tightening these under the same version would invalidate existing authoring documents. Their executable contracts are checked by the compiler. The public schema does not claim those planning namespaces are executable definitions.

JSON Schema alone cannot prove reference integrity, distinct IDs across collections, ownership, source-field compatibility, revision pins, graph cycles, equivalent parameterized-route collisions, total nested-item limits, exact UTF-8 bytes or JavaScript UTF-16 length rules. Complete runtime validation remains mandatory. The schema's `x-validation` describes those additional checks, including the historical legacy-layout loss report. A structural pass is never a substitute for `project validate` or compiler analysis.

The current checked-in companion HTML/JSON is the v5 compatibility fixture. `npm run companion:build` emits the modern v6 authoring pair under `reports/companion-mvp`; no migration overwrites that retained historical fixture.

## Regression evidence

The shared corpus normalizes the self-project and all eleven starters. Node tests exercise the actual read-only CLI, migration, safe diagnostics, copy isolation, hostile inputs and semantic rejection. The independent Python test uses `jsonschema==4.26.0` and distinguishes structural negatives from documents which pass JSON Schema but deliberately fail the authoritative reference checks:

```sh
node --test tests/tooling/companion-schema.checks.mjs
# In an explicitly provisioned scratch venv with jsonschema==4.26.0:
python -B tests/concepts/companion-schema.test.py
```

The independent schema test is separately discoverable as `companion:schema`; absence of its prerequisite is reported as not run, never a successful schema qualification. Its test-only dependency does not change the plugin/package lock or become required by ordinary project use.
