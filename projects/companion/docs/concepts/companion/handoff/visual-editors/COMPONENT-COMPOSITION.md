# Composite component authoring

A project component may contain:
- semantic element nodes,
- text and typed prop bindings,
- public slot nodes,
- Nuxt UI catalog-backed component nodes,
- references to other project components.

Child components are references, never copied definitions.

## Child instance configuration
Each child instance may map:
- parent props/state/literals → child props,
- caller-owned IR nodes → child slots,
- child emits → parent emits or declarative local actions.

## Dependency safety
`componentDependencies()` discovers project-component edges. `wouldCreateCycle()` rejects direct and transitive recursion before save/export/generation.

## Vue generation
Project child references lower to their exported Vue component names. Nuxt UI children resolve through the versioned catalog. Slots become Vue named slot templates. Typed bindings become generated Vue bindings. Child event mappings become generated handlers whose behavior is limited to declared IR actions.

Example:
```json
{
  "kind": "component",
  "componentId": "cmp-search-field",
  "props": {
    "query": {"kind":"prop","name":"searchQuery"},
    "placeholder": {"kind":"literal","value":"Search customers…"}
  },
  "events": {
    "search": [{"kind":"emit","event":"search"}]
  }
}
```
