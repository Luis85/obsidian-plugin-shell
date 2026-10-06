# Architecture decisions

## Bounded contexts
**Page Design** owns route/surface composition and component instances. **Component Design** owns reusable public contracts and templates. **Shared IR** owns only cross-context primitives needed for composition/generation.

## Aggregate boundaries
`EditorProject` is the import/export consistency boundary. `PageDefinition` and `ComponentDefinition` are independently editable aggregates inside it. Cross-reference validation happens at project publication/export.

## Clean-code rules
- Domain functions are pure and deterministic.
- Vue/Nuxt imports are presentation-only.
- Storage and generation implement application ports/adapters.
- Stable IDs are identity; display names are not references.
- Invalid models never reach persistence/export/generation.
- No arbitrary code in persisted IR.
- Prefer discriminated unions over optional-field bags.
- Keep compiler lowering separate from authoring representation.
- Errors use domain language and identify the offending entity.
