# Code Review 0.6

## Refactoring completed

### Character domain

Character taxonomy, part compatibility, recipes, styles and packs live in `src/domain/character.ts`. They have no Vue or Three.js dependency.

### Application commands

State-changing character workflows that represent product actions live in `src/application/characterCommands.ts`:

- save team style
- create pack from current agent
- import pack
- apply saved look

This keeps serialization and cross-entity mutation out of the generic Vue customizer.

### Presentation

`CharacterCustomizer.vue` is again focused on general agent customization. Appearance editing moved to `CharacterDesignPanel.vue`, which owns only the visual-identity workflow.

`CharacterThumbnail.vue` is the lightweight recognition surface for lists, cards and the roster.

### Three.js infrastructure

`CharacterModelFactory.ts` owns procedural geometry. `CharacterStageScene.ts` owns renderer lifecycle, camera, controls, stage lighting, raycasting and animation. Vue does not import Three.js directly.

### Cleanup and lifecycle

The renderer, controls, observers, geometries, materials and WebGL context are explicitly disposed. Character and inventory geometry rebuild independently so skill/tool edits do not reconstruct the character mesh.

## Clean Architecture boundary

```text
Domain
  character definitions + compatibility + validation
        ↑
Application
  character commands
        ↑
Presentation
  CharacterDesignPanel / CharacterThumbnail
        ↓
Infrastructure
  CharacterModelFactory / CharacterStageScene
```

The direction of dependency remains inward: domain code knows nothing about Vue, browser downloads or Three.js.

## Known compromises

- The built-in catalog is still code-backed constants. For production, custom packs should be repository-backed vault entities.
- Browser file download/import lives in `CharacterDesignPanel.vue`; a dedicated pack I/O adapter would be appropriate once Obsidian persistence exists.
- `CharacterModelFactory` is intentionally procedural and centralized. If the part library grows substantially, split builders by silhouette rather than adding a large switch indefinitely.
- Full Vue typecheck/build/test could not be executed in this environment because npm dependency installation timed out. Core TypeScript domain/application files pass strict `tsc` checks independently.
