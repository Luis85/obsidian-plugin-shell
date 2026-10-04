# Test data: derived recipes, isolated fixture files and runnable simulators

Status: companion authoring and preview are implemented, together with an exportable, executable Node test-data kit. The native companion is not newly installed by this feature. Wiring the target plugin to a test port remains explicit bootstrap work; real database drivers, production adapters and automatic native activation are not implemented here.

## Developer journey

**Design sources/entities → Enable operation recipes → Configure seed/count/behavior → Preview → Export runnable kit → Build/install into `.test-vault/` → Review/apply fixture plan → Test → Review/reset owned fixtures.**

A source is not a random-data file alone. It needs a data contract, generator recipe, behavior and a delivery adapter. One definition therefore feeds these outputs:

| Source kind | Generated test data | How the plugin consumes it |
| --- | --- | --- |
| Active Obsidian vault | Markdown files with correctly typed frontmatter in declared entity/source folders | The plugin's real vault repository while `.test-vault/` is open |
| External service/API | Input examples and response fixtures; declared methods and resources | Isolated in-memory application port, or an explicitly started loopback HTTP simulator and generated HTTP client |
| Database | Record fixtures and explicit dataset/identity configuration | In-memory database-style application port; **not** SQL/driver/migration fidelity |

The browser previews data and can run the in-memory adapter. It does not start servers, install dependencies or write vault files. Download is real: the ZIP contains readable executable modules and the exact reviewed manifest, not a simulated success message.

## Recipe model

`dataSources.testing` is optional, so old outlines remain valid. Schema 1 stores a fixed UTC reference date, non-negative seed, locale (`en` or `de`), count (1–100 per entity/root collection), and operation recipes. Each recipe references stable source and operation IDs, not copied live credentials or an endpoint snapshot.

A recipe declares enabled state, behavior (`fixture`, `list`, `upsert`, `delete`), shared dataset, identity field, scenario, delay, error status, and optional input/output field-generator rules. Every source operation starts disabled. Enable a whole source or configure individual recipes. Deprecated sources cannot generate new test data. Removing an unused operation/source also removes its owned recipes; broken references are never silently redirected to another source.

Input continues to mean data entering the source; output means data leaving it. Rules use bounded field paths; arrays use `/*`. Providers are Auto, sequence/prefix, synthetic name, reserved-domain email, integer, boolean, date, UUID and literal JSON. Literal JSON must still satisfy the declared type. Unsupported schema keywords, missing shapes, broken paths or invalid values block preview with a repairable error. A malformed literal stays in its recipe until corrected. No expression evaluation, arbitrary module path or remote schema resolution exists.

Entity-referenced payloads use the live semantic definition and shared pools. Operation-level field overrides apply to custom DTOs; they do not fork the identity of a shared entity. Set entity defaults in the Entities editor. Defaults/enums/const values are respected and generated records are validated before any filesystem operation.

## Determinism and related records

The same saved manifest, engine/provider version and seed produce the same output. Field-local streams avoid changing unrelated values when operation order changes. The fixed reference date, rather than today's date, controls synthetic dates. The built-in engine is `shell-fixtures/1`, provider `builtin-v1`.

All entity identities are allocated before relationships. One record at index N links to index N in its target pool, including cyclic/self relationships. This deliberately simple pairing satisfies required minimums and one-to-one bounds for equal-sized pools; it does not claim realistic random distributions, arbitrary uniqueness policies or relationship business rules. Vault seeding includes referenced entity dependencies so its generated links resolve to seeded notes.

Vault folders must be safe relative note folders, and an entity-bound operation must agree with its entity's folder. Nested API DTOs are not silently flattened into frontmatter: custom vault payloads must be flat scalar/list objects or need an explicit mapping. Notes are labeled synthetic in their body. Input/output JSON examples live in hidden `.fixtures/`, not among visible vault notes.

Bounded execution: 100 records per entity/root collection, 3,000 output files, 5 MB output, and 200,000 expanded values. Unsupported or oversized requests fail before filesystem apply. These are safety guardrails, not performance benchmarks or promises of representative production volume.

## Stateful and failure simulations

A **fixed response** validates/captures requests and returns its fixture; a write does not silently modify a later read. **List + upsert/delete** with the same source/dataset/key explicitly model read-after-write. List requires a collection of objects with unique scalar identities and no input. Upsert replaces a complete matching object, not an inferred patch. Delete requires an existing identity. Different list initializations for one dataset are refused rather than depending on iteration order. Filtering, pagination, mapping, authorization, retries and synchronization must be implemented explicitly when required.

Each adapter has isolated state, a 1,000-record dataset bound, at most 100 captured requests, reset/dispose, delays and cancellation. Scenarios are populated, empty collection, deliberate 400–599 error, and slow response (at least 1,000 ms; configured delays at most 5,000 ms). Empty/error vault recipes do not seed notes and do not delete previous notes. Empty single-object responses need a different contract or error scenario.

The local HTTP simulator uses an ephemeral `127.0.0.1` port and random session token. Requests require the exact host and Bearer token. CORS preflight is accepted only for the explicit `app://obsidian.md` origin and supported headers/methods; this policy is tested but is not native-Obsidian transport acceptance evidence. Other origins, ambiguous routes, live proxy URLs, oversized bodies, invalid JSON and wrong payloads fail closed. No request is forwarded to the source's production location.

`client.mjs` supplies a development-only HTTP application port with explicit URL/token, safe path/query/body serialization, request/response checks, timeout, cancellation/disposal and redirect rejection. A source operation slug becomes its port method name. GET/HEAD query inputs need named object fields; path parameters occupy whole unique segments and need scalar input declarations. GET/HEAD cannot drive stateful mutations. Harnesses can inject a reviewed transport or use the memory adapter instead. Merely drawing a source connection does not install this client into the plugin.

## Export and native workflow

The reviewed source preview and downloadable kit contain:

```text
scripts/test-data/
  manifest.json
  engine.mjs
  adapters.mjs
  storage.mjs
  server.mjs
  client.mjs
  cli.mjs
  faker-provider.mjs
  faker-example.mjs
  package.json
  README.md
```

The default kit uses only Node built-ins and requires no dependency installation. Unpack at the project root, preserving `scripts/test-data/`, then use:

```sh
npm run build:local -- --vault .test-vault
node scripts/test-data/cli.mjs plan
node scripts/test-data/cli.mjs apply --approve <reviewed-sha256>
node scripts/test-data/cli.mjs serve
node scripts/test-data/cli.mjs reset-plan
node scripts/test-data/cli.mjs reset --approve <reviewed-sha256>
```

Build/install is the existing root-template command, not a new capability claimed from the HTML. Open `.test-vault/` as a separate Obsidian vault and manually enable the installed plugin. The root CLI retains its historical `.dev-vault` default; pass the explicit argument above. New companion projects declare `.test-vault`. Older project targets require a confirmation action; their directories/files are not moved or removed. The authoring vault's configuration is preserved.

## Ownership, preview and reset safety

The exported runner defaults to **plan** with no filesystem mutation. Apply/reset each require the exact SHA-256 approval from their own plan. The hash binds manifest, provider, receipt and observed file hashes. All preconditions are checked again under a scoped lock before writes.

Only `.test-vault` is a target. The writer rejects escaping paths, symlink/junction roots and segments, hardlinked files, nonregular files and case-folding collisions. A receipt lists owned paths/hashes. Foreign files and edited fixtures produce conflicts; they are not overwritten even when their current content happens to match desired data. Ordinary regeneration retains obsolete owned files. Explicit reset removes only unchanged receipt-owned files and never targets `.obsidian`, plugin `data.json`, ordinary notes, the authoring vault or an existing `.dev-vault`.

Writes are staged with precondition checks and rollback. If another writer prevents safe rollback, backup content is retained in a recovery lock directory rather than discarded. This is not an OS-enforced transaction against a malicious process replacing directories between checks. Stop competing writers, preserve and inspect recovery data, and do not automatically delete unknown locks. Production/remote database seeding is intentionally excluded.

## Faker decision

[Faker usage guidance](https://fakerjs.dev/guide/usage) supports seeded output but notes that changing its version changes values and that relative-date methods need a fixed reference date. It also warns against shipping the full browser package. Consequently the companion uses a compact built-in deterministic provider and exports an optional development-only Faker integration.

`faker-provider.mjs` accepts an explicitly injected **10.5.0** Faker instance, reseeds per field, fixes the reference date and supports names and reserved-domain email values. The example installs nothing automatically. Opt in with an exact dev dependency in the kit, retain the generated lockfile, then review a new provider-specific plan. Built-in and Faker plans are not interchangeable. The injection contract is tested with a controlled provider; actual package installation and qualification are reported separately, not implied. [Faker v10's runtime requirements](https://fakerjs.dev/guide/upgrading) inform the kit's modern Node/ESM boundary.

## Review and acceptance

The prior three-editor review remains valid as historical evidence, and its regressions run alongside the new suites. Test-data generation does not change source directions, entity relationships, navigation/containment or selected-inspector ownership.

The browser suite exercises settings, readiness, deterministic previews, errors, stale reviews, cancellation, actual kit download, portable recipes and narrow layout. It unpacks the downloaded kit into an isolated temporary directory and runs its actual CLI: dry plan, approved apply, byte-for-byte comparison with browser preview, and safe reset preserving an unrelated note. Separate Node tests cover cyclic entities, bounded expansion, payload validation, read-after-write, failure/cancellation, real HTTP/client/CORS, file ownership, symlink/hardlink/case guards, stale approval and reset. Current totals and final-head CI belong to `TEST-DATA-DESIGN-VERIFICATION.md` and the PR, not to an earlier green run.
