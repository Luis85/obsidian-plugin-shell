# Agents / Klaus Editor — Product Review 0.5

## Product thesis

Agents is strongest when it combines a rigorous, vault-native Agent Definition Model with a playful social identity layer. The character is how a team recognizes and bonds with an agent; it must never be used as a proxy for authority, intelligence, permissions, or evaluation quality.

## Review by product perspective

### Product strategy
- Keep **Agents** as the management system and **Klaus Editor** as the character/environment configuration experience.
- Treat embodiment as durable team identity, not novelty decoration.
- Preserve a neutral source model and project into runtime/provider formats through adapters.

### Team adoption and bonding
- Give teams meaningful control: model category, model, palette, expression, eye style, idle behavior, accessories, nickname, greeting, motto, and signature symbol.
- Show the chosen embodiment everywhere an agent is recognized, especially the roster.
- Keep shared names and visual cues stable across versions unless intentionally changed.

### Character taxonomy
- Four top-level categories: Human, Pet, Animal, Item.
- Starter catalog contains fifteen models.
- Character model definitions are data, not branches in the Vue editor.
- The renderer is factory-driven by silhouette so future models can reuse or extend a visual grammar.

### Agent semantics
- `appearance` is its own domain object.
- Appearance changes do not modify role, tools, skills, path policy, autonomy, guardrails, evals, or runtime behavior.
- Operational name and team nickname are separate fields.

### UX and information architecture
- Dedicated **Look** category separates social identity from operational identity.
- Category-first model browsing reduces a long undifferentiated model list.
- Character customization uses progressive disclosure: category → model → team identity → palette → presence → accessories.
- 3D direct manipulation stays supplemental to explicit controls for accessibility and precision.

### Accessibility
- Character category/model selection remains fully available as DOM controls.
- Character form does not require interpreting color alone; model names, categories, descriptions and selection marks remain visible.
- Motion respects `prefers-reduced-motion`.
- Non-human models are not semantically ranked or described as smarter/weaker.

### Architecture and maintainability
- `domain/character.ts` owns character taxonomy, catalog, compatibility and defaults.
- `CharacterModelFactory` owns model construction.
- `CharacterStageScene` owns camera, stage, raycasting, animation and lifecycle only.
- Vue components consume domain APIs rather than branching on raw model IDs wherever possible.

### Performance
- Heavy 3D remains isolated to the character view and is compatible with lazy loading at the view boundary.
- Rebuild the character only when appearance changes; rebuild inventory only when capability loadout changes.
- Explicitly dispose geometries/materials/WebGL state when models or views are replaced.
- Pixel ratio remains capped to avoid excessive GPU cost on high-density screens.

### Obsidian readiness
- The appearance object is ordinary machine-readable frontmatter/JSON-compatible data.
- No character feature requires Node or Electron APIs, preserving the route to mobile support.
- Production persistence should continue through Vault/FileManager APIs rather than direct filesystem access.

## Remaining implementation priorities

1. Add an Obsidian `VaultStateRepository` and frontmatter migration for pre-1.2 agents.
2. Add thumbnail generation/caching for the character library so model cards can show real previews.
3. Add user-defined custom model packs through a validated plugin extension API, without permitting arbitrary executable code.
4. Add character randomization constrained by selected category/palette for quick team workshops.
5. Add import/export migration tests for schema 1.1 → 1.2.
6. Add visual regression tests for each silhouette and mobile layout.
