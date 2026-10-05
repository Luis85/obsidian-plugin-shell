# Klaus Editor · codebase review and clean-architecture pass

## Scope
This pass reviewed maintainability, rendering lifecycle, separation of concerns, runtime cost, testability, and UI implementation quality while retaining the existing Agent Definition Model.

## Refactoring applied

1. **Editor responsibilities split.** `CharacterEditor.vue` is now an orchestration shell. Agent selection lives in `AgentRoster.vue`; category-specific editing lives in `CharacterCustomizer.vue`; character rendering lives behind `CharacterStageScene`.
2. **Rendering infrastructure isolated.** Three.js imports are contained in `infrastructure/three`. `CharacterStage.vue` and `VoxelWorld.vue` are thin Vue lifecycle adapters. Scenes own renderer, camera, controls, raycasting, resizing, animation, and disposal.
3. **Explicit GPU cleanup.** `disposeThreeScene.ts` deduplicates and disposes textures, materials, and geometries. Both scenes stop animation loops and release WebGL contexts on teardown.
4. **State persistence separated.** Browser persistence moved from the Pinia store into `browserStateRepository.ts`; this creates a clean seam for a future Obsidian Vault repository.
5. **Application commands extracted.** Variant creation, specialist creation, snapshots, and relations moved to `application/agentCommands.ts` instead of living as store mutation details.
6. **Domain split.** The former `domain.ts` was divided into model, agent helpers, validation, and editor-domain concerns behind one barrel export.
7. **Lazy loading.** Secondary workspaces and the Environment world use async components so the character creator does not eagerly pull every view into its initial path.
8. **Tests added.** Editor-domain readiness, immutable membership operations, and application command semantics now have dedicated Vitest coverage.

## High-fidelity rendering pass
The 3D character studio now uses ACES tone mapping, capped pixel ratio, key/fill/rim lighting, shadows, fog, a presentation platform, category emissive feedback, direct raycasting, constrained OrbitControls, animated skill/tool equipment, reduced-motion handling, and multiple visual model presets. Memory and safety are represented as visible equipment rather than invisible metadata only.

The standalone HTML mirrors the same product direction with a dependency-free Canvas renderer and supports drag rotation, wheel zoom, direct body-region selection, model presets, animated capability cubes, and responsive character/customization layouts.

## Remaining production work
- Implement the production `VaultStateRepository` through Obsidian `Vault`/`FileManager` APIs.
- Add Vue Test Utils / browser-level component tests once dependencies are available.
- Establish a performance budget for low-power/mobile devices and defer the Environment renderer until explicitly opened.
- If `CharacterStageScene` grows substantially, split scene construction into `CharacterRig`, `StudioEnvironment`, and `CapabilityOrbit` collaborators.
- Gradually scope the remaining global stylesheet into feature-level CSS modules/components.

## 0.5 character-system architecture pass

### Findings addressed

- **Appearance was previously a pair of `model`/`color` strings.** It is now a typed `CharacterAppearance` domain object.
- **Model selection used UI-local arrays.** The catalog, categories, palettes, accessories, compatibility rules and defaults now live in `domain/character.ts`.
- **Character rendering risked becoming a monolithic stage class.** Visual construction moved into `CharacterModelFactory`; `CharacterStageScene` now focuses on stage/camera/raycasting/animation/lifecycle.
- **Old saved state would be incompatible with the richer appearance schema.** `domain/migrations.ts` upgrades legacy model IDs and creates appearance state during browser-state load and state replacement/import.
- **Appearance integrity was not validated.** Validation now checks model IDs, model/category consistency, scale range and accessory compatibility.
- **The roster did not consistently express character identity.** It now consumes the same appearance object as the editor/stage.

### Clean Architecture boundary

```text
Domain
  character catalog + appearance types + validation + migration
       ↓
Application
  agent commands / versioning / relations
       ↓
Presentation
  Vue editor + model picker + roster
       ↓
Infrastructure
  CharacterModelFactory → CharacterStageScene → Three.js/WebGL
  StateRepository → browser today / Obsidian Vault adapter next
```

The visual identity layer never mutates capabilities. This is intentionally enforced by the shape of the domain model rather than relying on UI convention.
