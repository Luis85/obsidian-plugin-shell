# Data Sources and sitemap data flows

Status: implemented in the standalone companion concept. Native connection adapters and a production blueprint compiler remain separate implementation work. This specification extends [the single-project vault](SINGLE-VAULT.md) and [the semantic layer](SEMANTIC-LAYER.md), not the user's host-vault permissions.

## Product intent

A developer declares where a plugin gets or sends business data, reuses each declaration throughout the sitemap, and hands implementation an explicit operation contract. The editor must not imply that drawing an arrow connects a service, authenticates, synchronizes records or writes notes.

The central model has three different objects:

| Object | Meaning | Example |
| --- | --- | --- |
| Data source | Reusable service, database or active-vault declaration | Tasks API |
| Source operation | Named behavior with its own resource, direction, input and output | Fetch tasks; Push task |
| Data flow | One operation used by one sitemap surface, with an explicit direction and trigger | Collection receives Fetch tasks when opened |

The catalog belongs to the one project in the current authoring vault. Source records are not ER entities, UI components, navigation destinations or containers. A source may have many operations and many usages, but has one placed card in the sitemap in this iteration. Operations are maintained centrally, not copied onto every usage.

## Developer journey

1. Open **Design → Data Sources** and add an external API, database or Obsidian vault source. Define its purpose and stable code name. Source locations are optional design metadata.
2. Add a named operation. Specify supported data movement, a resource, and separate input and output shapes.
3. Choose **Connect to card**, select the sitemap surface, operation, direction and trigger, and review the plain-language arrow meaning before saving. Alternatively, place the source on the sitemap and drag a data handle to a surface; the same review opens before committing.
4. Inspect usages in the catalog or select a surface's **Data** inspector tab. Edit the source once to maintain its shared operation contracts. Deprecate a source to prevent new usages while preserving current ones.
5. Review generator previews. Missing required payload shapes block that review; declarations can still be stored and exchanged as unfinished drafts.

**Try the example:** Use example outline → Data Sources → Use example sources → Show on sitemap. The example is explicitly requested, never automatically inserted into a real project. It demonstrates Fetch tasks from an API, Push task to an API, Read/save task notes in the active vault, and Read summary from a database. No test records or network requests are created.

## Direction has one clear reference point

**Input** always means data **entering the data source**. **Output** always means data **leaving the data source**. This does not change depending on which card happens to be selected.

| Business intent | Diagram | Shape required for generation | Other operation shape |
| --- | --- | --- | --- |
| Read / fetch / query | Source → surface | Output | Input may describe query or filter data |
| Write / save / push | Surface → source | Input | Output may describe an acknowledgement or resulting record |
| Read and write | Source ↔ surface | Both | Each shape is independently declared |

A GET with query parameters still represents reading business data; a POST returning a result is not automatically bidirectional synchronization. HTTP method and business direction are independent except that GET/HEAD cannot declare a write in this concept. A POST-based search can be a read operation.

Bidirectional means that both business-data directions are intended. It does not define polling, subscriptions, automatic write-back, merge policies, conflict resolution, background access or permission to upload vault data. For different API methods/resources, use separate operations and two unidirectional usages instead of compressing incompatible contracts into a single arrow.

Flow triggers are declarations: when the card opens, when a form submits, explicit user action, background task, or application event. Mapping/behavior notes describe transformations and failure handling; their text is never executed.

## Managed source types

### External service / API

Declare an optional HTTPS base URL, then per-operation HTTP method and resource path. Examples use `https://api.example.test` and `/tasks/{id}`. Query inputs belong in the operation's input contract, not credential-bearing URL strings.

The editor rejects URL user information, query strings, fragments, unsafe control characters and non-HTTPS schemes. It does not fetch discovery documents, test connectivity, register OAuth clients, store headers or execute requests. API modeling currently describes JSON-like payloads; multipart uploads, binary media, response status variants and streamed/event schemas are follow-on contracts.

### Database

Declare an optional logical connection reference such as `reportingDatabase` and a logical table or collection such as `public.tasks`. The editor does not accept a connection URI or SQL statement. Driver selection, hosting, parameterized queries, access controls, platform compatibility and credentials are explicitly left to infrastructure adapters. A declared database is not proof that it can be accessed from Obsidian or mobile.

### Obsidian vault

The location is `vault://active`: the generated plugin's active vault at runtime. It is not the authoring vault, an arbitrary filesystem path or a selector for another vault. Operations declare visible vault-relative folders such as `Records/Task`.

Protected/hidden folders, absolute paths and parent traversal are rejected. There is no direct mutation of `.obsidian`, no replacement of the authoring vault and no permission implied by a line on the canvas. Native adapters must preserve unrelated frontmatter, note body content and external edits.

## Input and output shapes

Each operation declares both sides independently:

| Definition mode | Behavior |
| --- | --- |
| Not declared yet | Valid unfinished draft; a used side blocks generation review |
| No payload | Explicit absence, such as a write acknowledgement with no body |
| Declared ER entity | Live reference to an existing semantic entity; optionally a collection |
| Define fields | Named fields, primitive/object/array types and required flags; optionally a collection |
| JSON Schema (advanced) | Bounded JSON Schema subset for nested payloads |

An ER reference includes its managed ID and type, declared fields and relationship-bearing link properties. Ordinary Obsidian lists can contain strings and numbers; the preview preserves this rather than assuming all lists contain strings. Tags and relationship link lists remain string arrays. Dates are represented as strings in this first contract projection; native validation and date-format enforcement still belong to the implementation.

Use separate field or JSON Schema definitions for API DTOs or partial create/update payloads. A full persisted entity is not automatically a valid create request; managed fields may not exist before creation. Matching labels or similar fields do not infer mappings. When a referenced shape differs from the surface's bound entity, the generator review warns that explicit transformation is needed.

Field definitions support string, number, integer, boolean, object, array and null. Simple arrays are arrays of strings; simple objects are open objects. Advanced mode supports `type`, `properties`, `required`, `items`, `additionalProperties`, `enum`, `description`, `format` annotations and an optional 2020-12 `$schema` identifier. Primitive type unions are supported. Unknown keywords, remote `$ref`, repeated enum members, enum/type contradictions and missing required-property declarations are rejected.

These are **definition checks and TypeScript previews**, not a full JSON Schema implementation or a validator for live request/response values. Formats are annotations. Advanced mode deliberately does not claim OpenAPI import, references, combinators, regex constraints, arbitrary schemas or runtime validation. Field names are bounded portable identifiers; advanced object property names use the same policy in this iteration.

Switching a shape editor's mode preserves that mode's pending edits. Only the active definition is committed. Invalid JSON or schema input remains in the dialog for correction; it is never silently replaced by an inferred shape.

## Catalog lifecycle and maintenance

Sources have stable IDs and file-safe code names. Display names and purpose text can change without recreating connections. Source kind can change only after its operations have been removed. Operation code names also remain stable; duplicate source/operation code names and duplicate same-operation/card/direction usages are rejected.

- **Draft:** can be connected while modeling. Review surfaces a draft-status warning.
- **Active in design:** selected for the intended implementation, not authenticated or tested.
- **Deprecated:** existing usages remain visible and editable; new operation/card usages are refused until the source is reactivated or replaced.

Each source exposes current usages. Edits update the shared live contract and invalidate the generator review. This iteration does not version-pin operation contracts or migrate stored records. New source versions, breaking-change analysis and migration plans are explicit future work rather than hidden assumptions.

Source deletion is blocked while used. Operation deletion and incompatible direction changes are blocked while referenced. Surface deletion and wholesale blueprint replacement cannot orphan data flows. An ER entity used by an operation shape cannot be removed until that reference is changed. Removing a flow removes only that design usage; it does not delete a source, surface, remote record, note or generated file.

All commits share outline Undo/Redo and persistence. No-op saves do not change revisions or history. Destructive edits are explicit. Open forms reject changed owners, revisions and source-contract snapshots. Invalid model edits leave canonical data and counters unchanged. ID counters do not move backwards when history is restored.

## Sitemap interaction contract

Source cards are a separate Vue Flow projection appended to the original surface nodes. Data flows are projected separately from navigation and containment. They never satisfy navigation reachability and never change a screen's parent or section membership.

Data sources use distinct drawn type icons, teal dotted lines, text labels and explicit arrowheads. Read/write/both directions remain understandable without color. Connected data ports remain visible when idle; unused surface data ports appear on hover/focus or during a connection gesture. Existing navigation handles keep their own behavior. Captions and the Data inspector provide click/keyboard alternatives to drawing a connection.

The source layer can be hidden without deleting declarations. The Outline has a separate source list; source placement does not insert a fictitious view. Fit includes placed source cards. Sources support pointer positioning, existing alignment guides, numeric coordinates and keyboard movement (24 world units; Shift 96). Position-only changes are undoable but do not invalidate generated contracts.

Data connections use explicitly identified facing ports and the existing bounded orthogonal routing helper. The actual edge SVG permits overflow in world space while the outer viewport clips. Endpoint tests compare SVG coordinates with measured handles, and a regression fixture deliberately reinstates the old clipping rule to prove detection. Dense/overlapping diagrams can still have crossings or label collisions; the route is not a global optimality guarantee.

## Generator handoff

Source definitions, resolved operation shapes and surface usages feed the existing reviewed source-plan previews:

| Preview | Purpose |
| --- | --- |
| `src/application/data-sources/<source>-port.ts` | Pure typed operation contract; no adapter implementation |
| `docs/data-sources/<source>.json` | Source, operations and resolved payload definitions |
| `src/bootstrap/data-flow-outlines.ts` | Explicit source-operation-to-surface bindings |
| `docs/DATA-FLOW-HANDOFF.md` | Intent, direction, trigger and implementation obligations |
| Existing per-surface outline | References to its declared data-flow usages |

Source edits and live ER contract changes require a new review. Source positions, layer visibility and canvas arrangements do not affect these generated files. All previews remain marked as non-executable concept output. No API client, database driver, vault adapter, mapping function, test result or runtime registration is fabricated.

## Security and recovery boundaries

Credential settings contain a symbolic reference name only, such as `TASKS_API_KEY`, with a declared authentication strategy. No credential-value input exists. HTTPS URLs and logical references are validated, and source/operation/schema imports have explicit key and size limits. Credentials could still be pasted into arbitrary descriptive text by a user; this is not a secret-scanning product. UI and export documentation warn against that.

Portable blueprints and recovery data include entered public locations, folder declarations, field names and free text. Treat them as project data, not automatically public-safe documents. The concept makes no network requests and never resolves a remote schema. Restored and imported models validate source/card/entity references before they can reach the canvas. The existing best-effort browser storage conflict protection applies; it is not atomic locking or native vault persistence.

Implementation must independently enforce runtime permissions, secret resolution, payload validation, request cancellation, timeouts, bounded retries, redacted logs, loading/empty/error states, write conflicts and opt-in external disclosure. The diagram is not authorization.

## Limits and acceptance

Current limits: 24 sources; 12 operations per source; 120 data flows; 40 fields per field shape; custom schema at most 12,000 characters, six nested levels and 120 schema nodes. Source positions are bounded to ±50,000 world units. These are defensive bounds, not a demonstrated performance service level.

The dedicated `tests/concepts/companion-data-sources.browser.py` runs in the exact-artifact companion suite alongside all retained editor tests. It covers real catalog/form controls, actual handle-drag review/commit, source projections, both arrowheads, geometry, clipping negative control, shape/parser integrity, input retention, deletion guards, history, generator stability and serialized restart. Controlled fixtures are labeled separately from real pointer interactions. See [DATA-SOURCES-VERIFICATION.md](DATA-SOURCES-VERIFICATION.md) for exact completed evidence and unverified boundaries.

## Primary references and design decisions

Checked 2026-09-24. References inform the contract; they do not establish native implementation completion.

1. [Obsidian Properties](https://obsidian.md/help/properties): native property types, shared name/type behavior, string/number list values and nested-property limitations. Keep ER note schemas separate from arbitrary nested API payloads.
2. [Obsidian Vault API](https://docs.obsidian.md/Plugins/Vault): active-vault file access and safe modification guidance. Use host-aware adapters and preserve current note content; never treat a data-source declaration as a filesystem grant.
3. [JSON Schema object reference](https://json-schema.org/understanding-json-schema/reference/object): properties, required and additionalProperties are distinct. The field editor leaves additional properties allowed; advanced mode can explicitly close an object.
4. [OpenAPI 3.1.1 Operation Object](https://spec.openapis.org/oas/v3.1.1.html#operation-object): request and response contracts are separate concerns. Borrow this separation without claiming OpenAPI import/export or automatic synchronization.
