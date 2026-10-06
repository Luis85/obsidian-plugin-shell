# Klaus Editor 0.7 — approved voxel-studio implementation

## Goal

Implement the selected Klaus Editor mockup as the default Character Creator experience while preserving the existing data-driven agent model and composable character-design system.

## Implemented composition

- **Editor chrome** — Agents mark, Workspace › Klaus Editor breadcrumb, vault and schema status.
- **Creator banner** — product identity, design/customize/bring-to-life progression, calm voxel scenery.
- **Agent roster** — larger recognizable portraits with active state and add-agent affordance.
- **Character studio** — Character, Environment and Animation modes plus render-quality control.
- **Stage overlays** — agent identity card, semantic props, contextual presence teaching and camera controls.
- **Character designer** — Models, Parts, Style, Team and Packs steps.
- **Quick customization** — display identity, greeting, palette and accessories without leaving the Models step.

## 3D direction

The production Vue source uses `CharacterStageScene` and `CharacterModelFactory`; Vue presentation components do not construct Three.js geometry directly.

The new Three.js workshop contains:

- ACES tone mapping and SRGB output
- key/fill/rim lighting with warm practical lanterns
- square voxel presentation pedestal with emissive accent strips
- workshop/library shelving and books
- voxel plants and crates
- window/distant-night silhouettes
- low-opacity environmental particles
- semantic floating props for skills, memory and tools
- category-aware model highlighting and direct selection
- bounded orbit/zoom controls
- reduced-motion-aware idle animation

The self-contained HTML keeps a dependency-free canvas fallback. It now uses the same layout and a richer embedded voxel-workshop backdrop while retaining a live procedural character on top.

## Character fidelity

Humanoid rendering was refined with layered hair, face/cheek treatment, shirt/jacket/lapel separation, memory pack, safety prop, badge and chunkier light shoes. The production Three.js model factory remains the higher-fidelity implementation and supports all character categories.

## Product constraints retained

Appearance remains presentation only. Changing character form or visual style does not alter skills, tools, permissions, role, eval evidence or runtime authority.

## Architecture impact

The implementation preserves the existing separation:

`domain character recipes → application commands → Vue editor → CharacterModelFactory → CharacterStageScene`

The visual overhaul therefore does not leak renderer concerns into the domain model or Pinia store.
