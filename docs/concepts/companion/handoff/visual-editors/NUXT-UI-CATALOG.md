# Nuxt UI implementation catalog

The editors expose Nuxt UI as an authoring catalog, not merely a renderer hint.

## Primitives
Ready-to-use Nuxt UI entries carry a stable catalog ID, component name, curated props, slots, emits, defaults, and direct generator mapping.

## Recipes
Application Shell, CRUD List Workspace, Filter Bar, Master/Detail, Settings Form and Empty State are accelerators. A recipe expands into ordinary declarative IR before Vue generation, so users can inspect and customize the resulting structure.

## Authoring
**Insert** creates a catalog-backed node with sensible defaults. **Customize as component** starts a reusable project component from the Nuxt UI contract, after which project-specific props, slots, emits, variants and internals can be added.

## Persisted reference
```json
{"implementation":{"catalog":"nuxt-ui","entryId":"u-button","catalogVersion":1}}
```
Authored values are stored explicitly as well. The generator never needs to scrape documentation or infer implementation from the canvas.

## Generation
Validate catalog reference → expand recipes → validate props/slots/events → lower primitives → generate Vue 3 SFCs → expose typed hooks for business behavior.
