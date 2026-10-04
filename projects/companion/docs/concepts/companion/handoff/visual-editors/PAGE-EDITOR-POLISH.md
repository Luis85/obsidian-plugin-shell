# Page Editor usability and layout reuse pass

## Goal
Make common application-interface composition fast without flattening the model needed for enterprise interfaces and deterministic Vue generation.

## Product decisions
- Progressive disclosure: Essentials first; Data, Actions and Advanced remain one click away.
- Selection-local actions reduce pointer travel and inspector dependency.
- Outline, Insert and Layouts are distinct jobs.
- Command palette provides a keyboard-first expert path.
- Scenarios remain first-class because loading, empty, error and permission states are part of an application page.
- Layouts are reusable structural assets, not cloned pages and not components.

## Layout semantics
A layout may cover a whole page or selected region. It stores semantic UI nodes, component references, layout rules and named slots. It excludes page identity, route and transient preview data. Instantiation deep-copies structural nodes and assigns fresh node IDs while preserving stable component definition IDs.

## Depth preserved
Advanced responsive/layout properties are not removed. They are collapsed until needed. Data binding and interaction authoring retain typed IR contracts. Review findings still route to exact nodes. Generator readiness remains visible at the workspace level.

## Follow-up implementation targets
Wire layout repository persistence into the project aggregate; add layout schema migration; connect drag/drop and quick actions to application commands; add undo transactions for instantiate/save-layout; qualify keyboard navigation and screen readers; add component-contract compatibility checks during layout instantiation.
