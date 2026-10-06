# Visual Editors — implementation handoff

## Baseline
This package is the authoritative prototype baseline. Earlier iteration notes are historical context only.

## Target
Vue 3 + Nuxt + Nuxt UI + Pinia. Domain/application code remains framework-independent TypeScript.

## Bounded contexts
- Page Design
- Layout Library
- Component Design
- Shared declarative UI IR
- Nuxt UI Catalog adapter
- Vue Generator adapter

## Required target folders
```text
app/
  domain/
    shared/
    page/
    layout/
    component/
    catalog/
  application/
    ports/
    use-cases/
    commands/
  infrastructure/
    persistence/
    generator/
  presentation/
    components/editor/
    composables/
    stores/
```

## Definition of done for implementation
- Complete project JSON round-trip is lossless.
- Schema migrations are explicit.
- Invalid references/contracts cannot save/export/generate.
- Undo/redo covers every authoring write.
- Layout instantiation generates fresh structural IDs.
- Component cycles are rejected.
- Generator output builds and type-checks.
- Nuxt UI catalog version is pinned.
- Page/component scenarios render deterministically.
- Keyboard alternatives exist for pointer-only editing.
- Import replacement is transactional.
- Editor session state is separated from portable project state.

## Do not port prototype shortcuts
Do not copy mock arrays, hard-coded customer data, presentation-only local refs or static sample bindings into domain/application code. They demonstrate UX only.
