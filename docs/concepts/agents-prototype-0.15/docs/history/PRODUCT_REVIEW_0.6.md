# Product Review 0.6 — Character Design System

## Executive assessment

The character editor has moved from a preset picker to a reusable visual-identity system. The strongest product decision is the separation of **agent capability** from **agent embodiment**: teams can choose the visual metaphor they connect with without implying capability, trust or authority.

## Product perspectives

### Product strategy

The character system is no longer decorative. It supports recognition across the roster, teaching, team language and persistent social identity while the Agent Definition Model remains provider-neutral and operationally authoritative.

### Team adoption and bonding

Meaningful choices now include silhouette, parts, palette, expression, idle style, material, accessories, nickname, greeting, motto and signature. This provides enough authorship for teams to feel that they designed a teammate rather than selected an icon.

### Information architecture

The appearance flow is now five explicit stages:

1. Models — fast starting recipes
2. Parts — procedural composition
3. Style — palette, material and presence
4. Team — social identity and reusable visual language
5. Packs — portability and team libraries

This keeps the first-use path short while giving advanced users depth.

### Character taxonomy

Human / pet / animal / item are broad top-level families. Rendering uses the more technical silhouette taxonomy (human / quadruped / bird / head / object). This avoids coupling user-facing language to renderer implementation.

### Extensibility

Catalog, compatibility rules, model construction and stage control are separate. A new recipe can usually be added as data. New geometry families belong in the model factory rather than Vue.

### UX and accessibility

Character thumbnails make presets and roster entries recognizable without reading names. Text labels remain alongside visual symbols. Direct manipulation is additive: all customization remains accessible from conventional controls. Reduced motion is respected.

### Performance

The stage uses procedural geometry and no post-processing stack. Expensive non-editor views stay lazy-loaded. Geometry/material cleanup remains explicit.

### Persistence and portability

Schema 1.3.0 adds composable appearance data, built-in/team styles and character packs. Imports are migrated and validated. Custom packs travel as JSON and can later be backed by Markdown/frontmatter in the vault.

### Governance

Appearance remains a presentation layer. Character changes do not modify role, tool permissions, guardrails, autonomy, eval results or runtime projection.

## Remaining production priorities

1. Implement real Obsidian vault repositories for characters/styles/packs.
2. Add undo/redo for character-design operations.
3. Generate/capture persistent pack thumbnails instead of only runtime SVG previews.
4. Add asset budgets and validation if custom GLTF packs are introduced.
5. Add visual regression tests for representative character recipes.
6. Run the full Vite / vue-tsc / Vitest suite in an environment where dependencies can be installed.
