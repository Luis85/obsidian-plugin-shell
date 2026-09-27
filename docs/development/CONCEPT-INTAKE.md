# Reviewed concept intake

**Implemented:** data-only project, feature and improvement intake through the
existing shell-cli project-import planner. This does not execute prototypes, install
dependencies, implement business logic or complete native companion acceptance.

## Inspect, review, apply, generate

```sh
node shell.mjs concept schema --json
node shell.mjs concept inspect --json
node shell.mjs concept inspect --input docs/concepts/capture/concept.json --json
node shell.mjs concept import --input docs/concepts/capture/concept.json --plan-out concept.plan.json
node shell.mjs plan inspect concept.plan.json
node shell.mjs plan apply concept.plan.json --yes
node shell.mjs generate --plan-out generation.plan.json
node shell.mjs plan apply generation.plan.json --yes
```

`concept schema` is project-independent data discovery. Inspection without `--input`
reports SHA-256 of the exact current `design/project.json` bytes. Inspection with a
file validates its data and candidate without writing. `concept import` previews by
default; `--apply <planHash>` or the normal saved-plan workflow authorizes only that
reviewed file transaction. Non-TTY and JSON modes never prompt.

Inputs must be regular `.json` or `.html` files contained in the selected project's
`docs/concepts` directory. Existing bounded reads and ancestor-link checks apply.
JSON/decoded payloads retain the 4 MB bound; HTML is bounded to 32 MB. No ZIP/source
installation or executable configuration discovery occurs.

## Formats and modes

A complete ordinary `obsidian-companion-project` JSON is a **project** import.
Supported legacy versions migrate through the shared v6 authoring contract, with
its migration report retained. Existing project configuration and generated identity
still require the normal explicit `--resolve project|import` reconciliation. This
flag does not rename internal design IDs and is unavailable for scoped imports.

A concept manifest has `kind: "obsidian-companion-concept"`, `schemaVersion: 1`,
a portable `id`, `mode`, `projectId` and `baseSha256`.

| Mode | Payload and semantics |
| --- | --- |
| `project` | `project` is the complete canonical export. `baseSha256` is null for explicit whole-project replacement or an exact required base hash. No automatic merge is inferred. |
| `feature` | Required `references` and `changes`. Changes are additive only and must add a feature owning exactly its new surfaces. Reusable components may be shared. |
| `improvement` | Required `references` and `changes`. Existing records may be explicitly replaced or removed; the exact current base must match. |

Scoped concepts require a matching `projectId` and the current 64-character lowercase
SHA-256. This binds to exact saved bytes, not a title, release number or an approximate
semantic match. Reference records contain `{collection, id}` and must resolve in
that reviewed base. Canonical references inside changes also pass the shared model
validators and project compiler model checks.

Each change contains `collection`, `op`, `id`, and a complete canonical `value` for
`add`/`replace`. `remove` has no value. Payload identity must match the change ID.
An artifact may appear only once per collection in a change set. IDs are never
silently remapped or deduplicated by label; collision diagnostics require explicit
reconciliation of the source concept.

Supported collections are `nodes`, `links`, `library`, `prds`,
`visualDesigns.pages`, `.components`, `.layouts`, `.revisions`, `sitemap.routes`,
`.journeys`, `features.items`, `semantic.entities`, `.relationships`,
`dataSources.sources` and `.flows`. These are fixed canonical collections, not
caller-selected JSON pointers or file paths. Other subsystem changes require an
explicit full-project import or later contract extension.

The current native-view/page ownership, route, component, feature and dependency
rules remain in force. Published visual revisions can be added, never overwritten
or removed by scoped concepts. Deleting a referenced artifact must also resolve its
references through explicit changes or validation refuses the whole candidate.
Removing a design artifact never implicitly deletes generated source files.
Allocation counters advance monotonically for recognized authoring IDs. Canvas
positions, routes and unrelated authoring data are not silently reinterpreted.

See the [complete runnable example](../concepts/concept-intake-example/README.md)
for valid project, feature and improvement files; `concept schema` describes the
transport. Semantic validity is still decided by the shared canonical validators,
not JSON Schema alone. A valid imported design is not native/product acceptance.

## Data-bearing HTML

Two explicit generated formats are supported:

```html
<script type="application/json" id="companion-project">...canonical JSON...</script>
<script id="prototype-project-data" type="application/json">...base64 envelope...</script>
```

The second matches the maintained prototype worker: exactly `encoding: "base64"`,
`sha256` and `content`. Base64 must be canonical, decoded text valid UTF-8 and its
SHA-256 exact. Marker scripts must have only their quoted `id` and inert
`application/json` type. More than one recognized payload is ambiguous and refused.

The reader skips comments, raw-text content, quoted attributes and template contents;
it does **not** execute scripts, mount a DOM, infer semantics from rendered pages,
or sanitize arbitrary HTML for later execution. Raw HTML without recognized data is
reported **reference-only** by inspection and refused by import. Its appearance or a
prior visual approval is not code-generation authority. Existing HTML/source files
remain unchanged; custom implementation source is not copied into runtime modules.

## Ownership, replay and failure

Intake delegates to the existing `project import` configuration/ownership planner,
then adds a bounded `.framework/concepts/<source-sha256>.json` provenance receipt.
It records source/payload/base/result hashes, mode and identities, not credentials,
absolute machine paths or portable execution approvals. It is local bookkeeping,
not a signature or an authorization token.

The original concept is an **unchanged** precondition in the shared file plan.
Source edits, base edits, changed destinations or receipts invalidate review.
Canonical JSON, intake ownership and applicable generation ownership update together
through the existing guarded plan/apply/rollback engine. A failed or cancelled
write retains its existing recovery semantics; no automatic uncertain retry occurs.
This is not a filesystem-wide or noncooperating-process atomicity guarantee.

Reimporting identical source bytes against its unchanged resulting project is a
no-op. Replaying an old concept after later project changes is rejected, rather than
reverting those changes or pretending the concept has just been applied. Edited
canonical files and foreign destinations retain existing ownership protections even
with `--yes`. Handwritten/generated extension code is not rewritten during intake;
subsequent generation uses its existing conflict and preservation rules.

## Implementation and verification

`scripts/companion/concepts/` owns framework-free data contracts and candidate
transformation. `scripts/framework/concept-input.ts` owns bounded local file and
HTML decoding; `concepts.ts` composes the shared import/file-plan infrastructure.
CLI catalog, help and programmatic operations expose the same three commands.
No second generator, storage writer or process execution path is introduced.

```sh
node --test tests/tooling/companion-concept-intake.checks.mjs
node --test tests/tooling/framework-concept-input.checks.mjs tests/tooling/framework-concepts.checks.mjs
node --test tests/tooling/framework-concepts-kit.checks.mjs
```

The final case creates an actual compiled kit, extracts it, runs its dependency-free
CLI, imports a feature, generates its authored Vue page and regenerates an
improvement while retaining consumer source edits. It does not install/build the
resulting Vue dependencies or provide native acceptance. Exact executed scope belongs
in the [continuation verification record](../testing/MVP-CONCEPT-INTAKE.md).
