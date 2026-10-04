# Semantic layer and component variants

> Product contract and implemented browser concept, 2026-09-24. Extends the [one-vault project workspace](SINGLE-VAULT.md) without changing the installed root-template runtime. Current entity-editor verification is recorded [separately](ER-EDITOR-VERIFICATION.md); the [original single-vault record](SINGLE-VAULT-VERIFICATION.md) is historical. Native adapters and the shared blueprint compiler remain implementation work.

## 1. Product model

One opened Obsidian vault is one companion developer project. The Design section now includes **Entity relationships** alongside requirements, sitemap and the component library. The ER editor describes the semantic model of the plugin being built; it does not create runtime records in the authoring vault.

For example, one companion project can design a task-management plugin containing Task, Person and Project business entities. Many eventual Project notes in that plugin do not mean multiple companion developer projects. The companion's own Project.md descriptor and an authored business entity named Project have separate identities and storage responsibilities.

The intended sequence is **define this project → requirements → entity model and sitemap → components/variants → review generation → prepare/build**. Design is iterative; the ER editor is available before Node or template preparation. A screen name never silently invents an entity, properties, persistence strategy or business rules.

## 2. Editor behavior

The diagram uses the same embedded Vue Flow engine as the sitemap, with a separate, lifecycle-owned canvas. A left catalog groups and finds entities; the center displays entity cards, relationship captions and section frames; the inspector shows the selected contract and its actions.

Each entity has a stable internal ID, immutable saved code name, editable display name/description, runtime note folder, optional visual section and ordered property declarations. Cards expose managed `id` and `type`, then up to eight authored/relationship fields; additional fields remain available in the inspector/editor rather than overflowing the card. Full properties, not only displayed rows, feed generation.

**Add entity** opens an isolated draft. Add/remove property rows, select type, required intent and optional typed defaults, then Save. Invalid fields retain the draft. Close/Escape requires an explicit discard choice after edits. Keeping a draft preserves its entered data. Unchanged saves do not create false source revisions or history.

**Connect entities** provides a keyboard-accessible relationship form. Dragging a source handle to a target handle opens the same review; it does not immediately mutate the model. Selecting a line exposes its endpoints, label, storage key and cardinalities. Endpoint changes are reviewed in that editor. Facing ports and bounded custom orthogonal routing keep endpoint geometry explicit; circle/bar/fork marks and two-direction sentences explain the counts. ER endpoint-updater dragging and SQL database execution remain outside this implementation.

**Add section** creates a named visual group. Assign entities through the entity editor. Arrange sections lays out each group's members together, then packs groups into independent bands. Removing a section ungroups its entities; it never deletes entities or relationships. Card dragging, camera movement and section labels/membership do not alter generated contracts. Undo/Redo records authored entity/relationship/grouping changes and card arrangement; camera navigation is presentation state.

**Entity list** and **Relationships** supply alternate non-drag editing paths. Position / align provides numeric positioning and alignment buttons. Guidelines snap entity edges/centers within six screen pixels, then optional Grid snap uses 20-unit spacing. Alt bypasses both; Escape cancels a gesture. Arrow keys nudge by one unit, Shift by twenty. These controls do not edit schema. See the [research and interaction contract](ER-EDITOR-REVIEW.md). The same stable entity IDs appear in the sitemap's optional **Declared entity** field. Legacy free-text entity hints remain explicitly unbound rather than being discarded or treated as a complete schema.

## 3. Obsidian property compatibility

The [official Properties documentation](https://obsidian.md/help/properties) defines seven native types, vault-wide property-name typing and quoted note links. The editor supports the following bounded subset; these are serialized property values, not a database type system.

| Editor type | Runtime value and generated TypeScript intent |
| --- | --- |
| Text | Single-line string; URLs and quoted wikilinks remain strings. |
| List | Array of strings/numbers. Relationship lists are specifically arrays of note-link strings. |
| Number | Finite literal number, including zero; never a formula. |
| Checkbox | Boolean, including false; never the strings `true`/`false`. |
| Date | Valid calendar date in YYYY-MM-DD form; generated type is string with runtime validation required. |
| Date & time | Valid local date/time in YYYY-MM-DDTHH:mm[:ss] form. Timezone conversion is not inferred. |
| Tags | Unique bounded list of tag strings, only on the `tags` property. |

Property type is shared by name throughout an Obsidian vault. Conflicting declarations such as `status: Text` on one entity and `status: Number` on another therefore block the design plan. The native adapter must additionally inspect existing destination-vault property conventions; this browser only checks the authored model.

The portable generator subset uses lowercase snake_case property keys, even though Obsidian itself permits broader names. Managed `id` and `type`, dangerous prototype keys and duplicate keys cannot be authored again. `aliases` and `cssclasses` require List. Relationship storage may not repurpose these metadata keys or `tags`. Nested objects, executable defaults, arbitrary custom type names and inferred computed properties are rejected.

The defaults editor uses typed numeric/date/date-time controls, a true/false checkbox-default selector, text inputs and JSON arrays for list/tag values. Common property presets and Save & add another are optional speed aids, not inferred schema. It validates before committing and preserves both false and zero. It accepts a conservative portable folder/tag subset; rejecting a character is not a claim that all Obsidian filenames or tags forbid that character.

## 4. Relationship contract

A relationship stores an ID, label, source entity, target entity, source-owned property key, cardinality at both ends and explicit `restrict` deletion intent.

- **Sources per one target:** zero/one/many source records that may reference a target.
- **Targets per one source:** zero/one/many targets stored by one source record. This end determines Text versus List and whether the stored value is required.

Each end supports `0..1`, `1`, `0..*` and `1..*`. One-to-one, one-to-many, many-to-many and recursive references are therefore expressible without silently introducing SQL join tables. A recursive reference is a declared capability, not proof of a qualified native traversal implementation.

For Task → Person using `assignee`, a single target is `assignee: "[[Records/Person/Example Person]]"`; multiple targets use a list of quoted links. The source owns that stored property once. The inverse is a query, not a second independently editable array. Duplicate ownership, missing endpoints and conflicts with ordinary property declarations block Save/import/generation.

The native implementation must resolve links and stable IDs safely, tolerate missing/ambiguous notes, react to renames, validate cardinality and preserve unrelated metadata/body content. Obsidian does not automatically enforce these domain relationships. Deleting an entity schema is blocked while a surface or relationship references it. Deleting a schema/relationship does not delete runtime notes; generated obsolete files are retained for a separate migration review. No cascade-delete behavior is generated.

## 5. Generator input and output

Entity/relationship declarations belong to the same portable design, history, saved state and source-review fingerprint as screens and components. They are not an independent disconnected diagram export. Existing outlines without semantic data remain valid and are not seeded automatically. **Use example model** is an explicit action available only while the semantic model is empty.

The normal **Review generator** action includes:

| Preview path | Purpose |
| --- | --- |
| `src/domain/entities/<entity>.ts` | Type, managed identity, declared properties and source-owned relationship fields. |
| `src/features/entities/<entity>/document-recipe.ts` | Data-only note-folder, field/default/cardinality and preservation recipe for shared document tooling. |
| `tests/fixtures/entities/<entity>-example.md` | Illustrative Obsidian-compatible frontmatter, including quoted links. |
| `src/bootstrap/entity-outlines.ts` | Normalized semantic input for shared compiler/registration. |
| `docs/ENTITY-RELATIONSHIPS.md` | Storage ownership and explicit unresolved validation/migration obligations. |
| Existing surface contracts and blueprint | Stable surface-to-entity mapping; full portable export retains visual sections and positions. |

Semantic source changes invalidate previously approved plans. Geometry and section edits do not change generation fingerprints or source bytes. The normalized generator schema removes diagram sections/coordinates while the complete portable blueprint preserves them. Generation remains deterministic; unchanged previews remain unchanged, developer-owned conflicts block, removed schemas retain previously emitted source. Preview capacity is checked before writing browser-emitted state: at most 600 retained files, each below 100,000 characters.

**Implementation boundary:** these are genuine input-driven source previews in the browser concept, not an implemented shared CLI blueprint compiler or compiled/published plugin. The generated recipe explicitly requires adaptation through existing entity/document makers and services. There is no second native DocumentCreationService, arbitrary code evaluation or false claim of executed generated tests.

Required native delivery packages: semantic Markdown record serializers; versioned shared blueprint schema and validator; compiler lowering to public entity/document recipes and one bootstrap registration; runtime relationship resolver and cardinality validator; source/note migration plans; consumer compilation and deterministic CRUD/failure tests. Each package needs differential UI/CLI and native-vault acceptance evidence before being labeled complete.

## 6. Component library polish and variants

The component miniatures now have fixed contained boxes, bounded inner wireframes/SVGs and a shrinkable/ellipsis label region. The detail preview keeps its normal dimensions. Overflow is not solved by hiding the component name or turning the entire library list into an inaccessible clipped region.

Each shared component may declare up to twelve named variants. Every variant has a stable ID, name, purpose, typed prop defaults and optional title/purpose/content defaults for content-bearing components. The default variant is mandatory. Existing comma-separated variant labels are adapted non-destructively into data-only descriptors; they are not converted into fabricated implementations.

Use **Variants → Add variant** or **Edit**. Prop defaults must match that component's declared string/number/boolean contract. Unknown props, wrong types, code, nested objects and duplicate IDs are rejected with the draft retained. No variant may introduce arbitrary executable markup or unscoped CSS. The preview selector resolves the chosen defaults. Placement selects a variant of one definition, not a copied definition.

Saving a changed variant requires a newer component version. Existing instances retain their pinned version, content defaults, typed prop defaults and local edits. The upgrade review shows both content and prop-default changes. Applying a reviewed upgrade replaces nonlocal defaults while preserving screen-specific content. Switching a placement's variant also preserves explicitly differing local content. Referenced variants cannot be removed; the default cannot be removed at all.

Generation emits a variant union and default descriptors once per component and includes the variant ID plus its pinned typed defaults in placement bindings. Version drift blocks generation until reviewed. This change does not claim all visual style variants or responsive permutations have implemented Vue renderers.

## 7. Persistence, safety and limits

Concept state remains one schema-2 project. Optional semantic data is versioned at schema 1. Legacy project recovery copies only one reviewed outline and preserves the complete old workspace; it never inherits executable trust, old roots or native/test results. A newer component variant does not silently remap saved instances.

Unknown shapes/keys, duplicate IDs, unsafe counters, invalid dates/defaults, path escapes, missing endpoints and vault-wide property-type conflicts fail before canonical mutations. IDs advance monotonically through undo/import so identities are not recycled into unrelated records. A stale entity, relationship, variant or generation review cannot overwrite a later design.

Bounds: 60 entities, 40 declared properties per entity, 160 relationships, 16 semantic sections, 12 variants per component; existing component/brick/global-storage bounds still apply. These are bounded concept guardrails, not measured performance or scale guarantees. Source preview capacity can be reached earlier and produces a blocking explanation without discarding the design.

No real note writes, host discovery, native SQL engine, actual CLI execution, source migration, cross-window atomic locking, full accessibility certification or release readiness is established by this browser iteration. See the [verification record](SINGLE-VAULT-VERIFICATION.md) for exact executed scopes.
