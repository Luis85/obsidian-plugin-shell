# Agents prototype

## Klaus Editor 0.14.0 — Model visual correction & studio cleanup

This iteration directly fixes the remaining visual defects visible in the default Klaus model. The standalone renderer now uses model-space projection for shoulder/depth placement, a coherent human silhouette, a smaller back-mounted memory pack, and a compact torso safety emblem instead of the permanent side shield. The baked stage/background character and the raster creator-banner image have been removed so Klaus is the only character competing for attention.

Key invariants remain unchanged: +Y up, +Z forward, structural-body grounding, fixed camera, turntable-owned yaw, authored joints, and semantic animation layered above the model.

See `docs/MODEL_VISUAL_FIX_0.14.md` and `design-qa.md`.

## Klaus Editor 0.12.0 — Fixed-camera turntable & voxel assembly correctness

This iteration focuses on Three.js rendering correctness. Character rotation is now a true fixed-camera turntable: horizontal drag and the 0–360° scrubber rotate only the character root. Model switching re-fits the fixed camera without resetting yaw. Procedural voxel assembly now uses explicit semantic rig tags and anchored hinge groups for rotated appendages such as ears, tails and wings, preventing center-pivot drift. The standalone fallback uses yaw-aware voxel projection so side/back views are visibly different orientations rather than a camera-like shear.

See `docs/THREE_RENDERING_REVIEW_0.12.0.md` for the coordinate, pivot and regression contracts.

# Agents · Klaus Editor prototype


## Klaus Editor 0.12.0 — 360° Turntable & Skills Workspace

This iteration focuses on editor interaction and panel isolation without changing the Agent Definition schema (still 1.4.0).

- The character is now a true turntable: horizontal drag rotates the character itself through 360° while the studio/camera remain stable.
- Front, right, back, and left snap views plus a 0–359° scrubber and 45° step controls make orientation explicit and repeatable.
- Click-to-edit and drag-to-rotate are disambiguated so a turntable drag no longer accidentally opens a body-region editor.
- Skills has a dedicated isolated workspace with search, Library/Equipped filters, skill metadata, and related tool/resource context.
- Other category controls are no longer rendered inside the Skills scroll surface; category switching is kept in a compact context switcher above it.
- Panel containment and responsive rules prevent neighboring component content from bleeding into the active side panel.

Prototype of a vault-native Obsidian agent-environment workbench. Klaus Editor is the spatial/voxel teaching surface inside the broader **Agents** plugin.

## Product model

The plugin supports three jobs:

1. **Learn** agent-environment concepts through a data-driven Requirements Academy and Klaus World.
2. **Configure** general and specialist agents, roles, skills, tools, sources, memory, paths, relations, safety policy and GURPS-compatible character metadata.
3. **Verify & project** definitions through structural validation, scenario eval metadata, trace concepts and runtime adapters.

The canonical production direction is **Markdown + frontmatter in the vault**. The Vue prototype uses browser storage only as a development convenience.

## Stack

- TypeScript
- Vue 3
- Pinia
- Vite
- Vitest
- Nuxt UI
- Three.js for the source prototype's voxel world

The companion standalone HTML uses a dependency-free canvas renderer so it can be opened directly without installation.

## Key concepts added in the research/polish pass

- Neutral Agent Definition Model, schema version `1.4.0`
- JSON Schema 2020-12 artifact in `schema/agent-definition.schema.json`
- configuration coverage separated from behavioral verification
- invocation/handoff contracts
- instruction layers: repository, path, agent and task
- tool contracts with input/output schemas, side effects, risk and approval
- guardrails and human-review policies
- MCP server entities with protocol/transport/auth/capability metadata
- skill-package entrypoints/resources/tool requirements
- trust/freshness/provenance on data sources
- variant inheritance/base-version/override metadata
- Eval Lab and trace anatomy
- runtime adapters for Obsidian Markdown, AGENTS.md, GitHub custom agents, skills, MCP config and neutral JSON
- accessible station list and responsive layout
- Obsidian/Bases integration direction


## Klaus Editor 0.9 animation & presence implementation

The Character Creator now implements the approved high-fidelity voxel-studio direction:

- editor-specific breadcrumb/status chrome rather than the generic workspace shell
- dedicated creator banner and agent roster
- Character / Environment / Animation studio modes
- high-fidelity procedural Three.js voxel workshop with square presentation pedestal, warm lanterns, shelving, plants, crates, distant voxel silhouettes and semantic capability props
- Models → Parts → Style → Team → Packs appearance workflow
- richer humanoid detailing, direct body-region picking, orbit/zoom controls and category feedback
- self-contained fallback prototype with a dependency-free canvas character renderer and embedded voxel-workshop art direction

The approved visual target and QA evidence are documented in `design-qa.md` and `docs/ANIMATION_RIG_0.9.md`.

## Development

```bash
npm install
npm run dev
npm run test
npm run build
```

The execution environment used to generate this package could not finish dependency installation, so run these commands in a normal network-enabled workspace before treating the source package as build-verified.

## Production Obsidian architecture

Use `Vault`/`FileManager` APIs for file/frontmatter writes and normalized vault paths. Keep agent entities in Markdown/frontmatter. Keep plugin data for UI preferences. Defer/lazy-load the heavy Klaus World view and provide the conventional station/list workflow everywhere, especially mobile.

See `PRODUCT_REVIEW.md` for the complete research review and implementation roadmap.

## Klaus Character Creator UI pass (0.3.0)

The Klaus Editor is now a Create-a-Sim-inspired character creator rather than a world-first dashboard. The character is the primary editing object, with an agent roster, clickable 3D body regions, labeled customization categories, category-specific forms/loadouts, contextual teaching, and an optional Environment mode that preserves the voxel-world learning surface.

See [`docs/UI_REVIEW.md`](docs/UI_REVIEW.md) for the dedicated UI/UX review, before/after screenshots, design rationale, accessibility notes, and remaining implementation priorities.

## High-fidelity + clean-architecture pass (0.4.0)

The character creator now uses a dedicated studio renderer with improved lighting, materials, shadows, model presets, direct body-region editing, animated capability equipment, category feedback, responsive polish, and reduced-motion support.

The implementation was also reorganized around clearer boundaries:

- `domain/` — model, editor rules, agent helpers, validation
- `application/` — user/application commands
- `infrastructure/state/` — prototype persistence adapter
- `infrastructure/three/` — Three.js scene adapters and GPU cleanup
- `components/editor/` — editor-specific presentation components
- `stores/` — thin reactive coordination

See [`docs/CODE_REVIEW.md`](docs/CODE_REVIEW.md).

## 0.5 character identity system

The character editor now treats appearance as a first-class domain model independent from operational capability. Teams can choose between **human, pet, animal, and item** embodiments, with fifteen starter models including humanoids, dog, cat, rabbit, owl, fox, turtle, talking head, terminal, toolbox, living book, and abstract agent cube.

Appearance stores model, palette, scale, expression, eye style, idle style, pattern, accessories, team nickname, greeting, motto, and signature symbol. Changing appearance never changes role, permissions, tools, skills, guardrails, evals, or runtime behavior.

The Three.js implementation is split into `CharacterModelFactory` (visual construction) and `CharacterStageScene` (stage/camera/interactions/lifecycle), keeping Vue presentation code independent from Three.js.


## Character Design System (0.6)

Klaus Editor now treats embodiment as a composable visual identity layer rather than a fixed model preset. The character system supports human, pet, animal and item/mascot families; procedural part slots; model thumbnails; reusable team styles; saved looks; and importable/exportable character packs.

The editor follows a progressive workflow: **Models → Parts → Style → Team → Packs**. Preset models are recipes that remain editable at the part level. Appearance is intentionally independent from role, tools, skills, permissions, evals and runtime authority.

The source is split into a character domain catalog (`domain/character.ts`), character application commands (`application/characterCommands.ts`), the dedicated design UI (`components/editor/CharacterDesignPanel.vue`), a procedural model factory (`infrastructure/three/CharacterModelFactory.ts`) and the 3D stage controller (`infrastructure/three/CharacterStageScene.ts`).


## 0.9 semantic animation rig

The character renderer now exposes a lightweight semantic procedural rig for voxel characters. Models can publish optional `head`, `leftArm`, `rightArm`, `leftLeg`, `rightLeg`, `tail`, and eye controls. Saved poses (`neutral`, `ready`, `wave`, `thinking`, `working`, `celebrate`) are part of the character appearance; runtime/editor motions (`idle`, `listen`, `think`, `work`, `celebrate`) are layered transiently without rebuilding or translating the character root. Blinking is deterministic and reduced-motion aware. See `docs/ANIMATION_RIG_0.9.md`.

## 0.8 graphics alignment pass

The procedural character renderer now uses a shared coordinate contract across humans, pets, animals, floating heads and item mascots. The structural body/footprint owns centering and grounding, while asymmetric equipment such as shields, badges, tails and halos no longer changes the character origin. Camera framing, plumbob placement and floating capability props derive from measured model bounds. See `docs/GRAPHICS_POLISH_0.8.md`.
