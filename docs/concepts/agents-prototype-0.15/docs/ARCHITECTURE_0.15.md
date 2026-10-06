# 0.15 architecture and implementation handover

## Dependency direction

The domain imports only domain modules. The application imports application/domain code, but no framework, browser API or infrastructure implementation. Infrastructure implements the application contracts. Pinia is a presentation adapter; the composition root selects BrowserStateRepository, SystemClock and CryptoIdGenerator and provides them to the Vue application.

The presentation renderer components necessarily construct their Three.js stage adapter. The stricter dependency rule applies to the domain, application and stores; this refactor does not pretend that all Vue-to-Three integration has been replaced by a general-purpose rendering port.

```text
main / browser composition
  ├── constructs concrete repository, clock and ID generator
  └── provides AgentsContext
        └── Pinia presentation adapter
              ├── agent/character commands → domain rules
              └── PersistenceCoordinator → StateRepository port

Vue stage component → Three.js stage adapter
  → CharacterModelFactory
      → five silhouette builders
      → PatternAssembler / AccessoryAssembler
      → MaterialFactory / face helpers / authored rig
```

The source architecture checker enforces resolved relative imports, inward dependencies, no broad domain barrel, no infrastructure imports in stores, no hidden runtime time/random calls in the inner layers, no empty catches, and a 110-line factory ceiling.

## Application command contract

```ts
const commands = createAgentCommands({ clock, ids })
const result = commands.addVariant(currentState, selectedAgentId, 'Review')
if (result.ok) {
  // Only the presentation adapter commits these references.
  state.value = result.value.state
  selectedAgentId.value = result.value.selectedAgentId ?? selectedAgentId.value
} else {
  diagnostics.value = result.diagnostics
}
```

Commands clone the plain-data graph before changing it. They return an operation value, the next PluginState and optional selection. A failure cannot expose a partly modified draft. Time and identifier generation are explicit dependencies. Identifier allocation checks existing identities and rejects a broken/colliding provider rather than creating duplicates.

Implemented operations include specialist creation, variants, snapshots, relations, saving styles, applying looks, creating packs and importing packs. Snapshot time is validated; version increments occur after the historical clone. Look application preserves nickname, greeting, motto, signature and operational permissions. Relationship operations reject self links, duplicates and inheritance cycles. Imported saved-look identities are remapped when they collide with existing looks.

This is not full event sourcing or a fully immutable UI. Ordinary form controls still edit the reactive in-memory draft with v-model. Multi-entity application operations are transactional, while field edits remain direct. Persistence validates before writing. Converting every field edit into an application command, adding undo/redo and implementing incremental persistence are separate future steps.

## Persistence lifecycle

The port has asynchronous load and save methods returning Result. A missing key is successful empty storage; a failed read or invalid saved JSON is an error, not an empty workspace.

Startup loads once even when initialize is called concurrently. A successful load is not immediately rewritten. A failed load opens an in-memory seed session, publishes diagnostics and sets recoveryRequired. Autosave cannot overwrite the unreadable value until an explicit save authorizes replacement. The global status panel remains available across views.

Edits increment a revision and mark the draft dirty. Autosave waits 350 ms after the last edit. Pending timers are cancelled when disabled, replaced or disposed. Each save captures a detached snapshot and the coordinator serializes writes. An older completion cannot mark a newer edit clean. Failed writes leave the session dirty, preserve actionable diagnostics and do not poison the queue. An already-running write is not cancelled by store disposal.

The coordinator catches repository exceptions and snapshot-copy failures. BrowserStateRepository additionally validates at the I/O boundary and maps security/quota/generic host errors. Save size is bounded consistently with reload size. The prototype uses one localStorage key, not an atomic multi-file Vault transaction. Separate browser tabs are not coordinated; concurrent tabs can still overwrite each other's work.

A warning to leave the page is registered while dirty. Browser lifecycle warnings are a fallback, not a guarantee of saving pending work. Use Save now or export before closing a session with errors.

## Validation and migration

The validation pipeline is:

```text
bounded JSON parse → plain-data inspection → version dispatch
 → full nested legacy/current shape → explicit migration
 → current shape → domain/reference/recipe checks → Result
```

The plain-data check rejects cycles, nonfinite numbers, nonplain objects, reserved prototype-related keys, excessive depth and excessive traversal size. JSON text is bounded to 5 × 1024 × 1024 JavaScript characters. The character-pack file control also enforces a 5 MiB byte limit. These are intentionally distinguished: string length and UTF-8 file size are not the same measure.

Structural validators cover nested agents, capabilities, memory, permissions, evaluations, versions, appearance, parts, styles and packs. Semantic checks validate identity collisions, operational references, aliases, model/category/part compatibility and inheritance. High-risk configuration issues can remain warnings: passing structural validation is not permission to execute tools.

Supported legacy appearance/catalog migration is explicit and tested with representative fixtures derived from the supplied seed. No corpus of real historical Vaults was available. Unknown model identities and unsupported schema versions are not silently repaired. Existing snapshot appearance data is migrated too.

The JSON schemas are generated from the same structural declarations (`schema:generate` and `schema:check`). They describe shape, not every cross-entity rule. The runtime codec remains necessary for compatibility, reference integrity and safety limits. Optional pack/style references may generate warnings because a portable look can contain its visual settings without the source catalog being installed. Packs are data recipes referencing known built-in model/part IDs; arbitrary imported meshes or executable code are not supported.

## Rendering responsibilities and ownership

CharacterModelFactory is 70 lines and dispatches by silhouette. Each builder writes into a shared local-coordinate BuildContext. Face, pattern and accessory construction are separate. Domain recipes carry compatibility and default selections; presentation metadata supplies labels, descriptions, tags, palettes and editor layout categories.

The coordinate convention remains +Y up, +Z forward, structural footprint at the origin and ground at Y=0. Patterns/accessories attach after structural bounds are measured. Semantic rigging preserves authored hinge assemblies. Turntable yaw changes the character root, not the camera. The dedicated animation controller owns pose/motion transforms.

Every model has an idempotent dispose method. It removes the root from its parent and disposes each geometry/material/texture once, including template materials with no attached mesh. Stage rebuild also disposes previous decorations instead of merely clearing children. This is owned resource cleanup, not a new renderer backend or GPU performance benchmark.

The 17 source parity contracts compare normalized syntax bodies against the uploaded baseline, including the five silhouettes, screen faces, bounds, accessory anchors/construction, patterns, finish parameters, eyes, badge, hinge helper, rig, animation and turntable. The factory orchestration, resource ownership and integration intentionally changed. Static body parity is not proof of correct world-space output; the actual Three.js suites and manual checks remain required.

## Old-to-new path map

| Previous location | Replacement |
| --- | --- |
| src/domain/index.ts | Removed; import the specific domain module or presentation catalog |
| src/domain/model.ts | domain/agents/types, characters/types, relations/types, shared/types, shared/PluginState |
| src/domain/character.ts | domain/characters rules/appearance plus presentation/character-catalog |
| src/domain/editor.ts | presentation/character-catalog/editorCategories |
| src/domain/migrations.ts | application/state/migratePluginState and StateCodec |
| src/domain/validation.ts | domain/shared validation plus application/validation shapes |
| src/application/agentCommands.ts | application/agents/agentCommands factory |
| src/application/characterCommands.ts | application/characters/characterCommands factory |
| src/stores/agents.ts | presentation/stores/agents + applicationContext |
| src/components and src/App.vue | presentation/components and presentation/App.vue |
| src/seed.ts | application/bootstrap/seedState and characterDefaults |
| src/infrastructure/three/CharacterModelFactory.ts | infrastructure/three/models/CharacterModelFactory + builders/helpers |
| Other flat Three.js scene files | infrastructure/three/scene |

Do not retain the removed source modules alongside the new tree. The broad-barrel architecture check will intentionally reject that mixed arrangement.

## Future Obsidian adapter

Implement StateRepository in the Obsidian integration layer and provide it instead of BrowserStateRepository. The adapter must map configured entity paths to Markdown/frontmatter, parse/validate external edits, surface permission/conflict/partial-write diagnostics, and define an atomicity or recovery strategy for multi-file changes. Add repository contract tests and actual Vault integration tests. The current port establishes the seam; it does not solve Vault concurrency, filesystem writes or plugin packaging.

## Official integration references consulted

- Nuxt UI Vue installation: https://ui.nuxt.com/docs/getting-started/installation/vue
- Nuxt UI module documentation (Vue plugin and Tailwind imports): https://nuxt.com/modules/ui
- Pinia setup-store injection: https://pinia.vuejs.org/core-concepts/
- Three.js Object3D transform/attachment API: https://threejs.org/docs/pages/Object3D.html

The Nuxt UI wiring follows the documented Vue plugin and CSS entry. Installed-version integration remains a verification gate, not a completed runtime claim.
