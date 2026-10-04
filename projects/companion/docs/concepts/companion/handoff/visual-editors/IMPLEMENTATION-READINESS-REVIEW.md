# Implementation Readiness Review

## Executive assessment
The prototype is ready to serve as the implementation baseline for an application-first visual UI workbench. Its differentiator is not freeform drawing: it is structured composition that remains declarative enough to validate, serialize and lower into Vue 3 + Nuxt UI code.

The handoff baseline contains three authoring domains: Pages, Layouts and Components. Nuxt UI is a versioned implementation catalog. Pages compose semantic nodes and component instances; Layouts capture reusable structure; Components own reusable public contracts and internal composition. Project JSON is the portable source of truth.

## Product strategy
**Primary users:** product-minded developers, solution designers, technical product owners and teams defining SaaS/enterprise interfaces before or alongside implementation.

**Primary job:** assemble a realistic application interface quickly while retaining enough structural, responsive, data, interaction and component-contract depth for deterministic code generation.

**Explicit non-goals:** general vector design, arbitrary CSS/JavaScript authoring, backend/business-logic generation, full Figma replacement, live production data editing.

## UX / interaction
Strengths retained:
- Page and Component editors share a three-pane grammar.
- Progressive disclosure keeps common actions close to selection.
- Outline / Insert / Layouts are separate jobs.
- Data and Actions have dedicated authoring surfaces.
- Scenarios make loading/empty/error/permission states first-class.
- Component instance configuration is distinct from definition editing.
- Command palette provides an expert path.

Handoff requirements:
- All write actions must participate in one undo transaction model.
- Selection must survive non-destructive inspector edits.
- Unsaved drafts must be explicit; navigation must not silently discard them.
- Delete, replace-definition, publish-revision and import-replace require consequence-aware confirmation.
- Keyboard focus must return predictably after dialogs and command palette actions.

## Information architecture
Top level: Pages | Components.
Page editor: Outline | Insert | Layouts.
Component editor: Structure | Insert child.
Inspector tabs are contextual and must not become global navigation.
Review is a representation of the current document, not a separate persisted document.

## Accessibility
Implementation target: WCAG 2.2 AA-oriented behavior.
- Every drag operation requires a non-drag alternative.
- Canvas selection must mirror an accessible outline.
- Focus rings cannot depend on color alone.
- Error/warning state must include text/icon semantics.
- Dialog focus trap/restore and keyboard escape are mandatory.
- Dense enterprise tables need keyboard and screen-reader qualification.
- Responsive authoring must not imply actual mobile accessibility acceptance.

## Domain model
Aggregate consistency boundary: EditorProject.
Editable aggregates: PageDefinition, LayoutDefinition, ComponentDefinition.
Stable IDs are references; names are labels.
Layouts instantiate fresh page-node IDs while preserving reusable component IDs.
Components may reference project components and Nuxt UI catalog entries.
Recursive component dependencies are invalid.

## Generator
Generation pipeline:
1. Parse/version project.
2. Validate schema and IDs.
3. Validate page/layout/component references.
4. Validate component props/slots/emits.
5. Detect component cycles.
6. Resolve versioned Nuxt UI catalog references.
7. Expand recipes into normal IR.
8. Validate bindings/actions.
9. Lower IR into Vue SFC AST/text.
10. Format/type-check generated project.

Arbitrary JavaScript must never be persisted in IR.

## Persistence and portability
One project export contains Pages, Layouts, Components, catalog version and generator target.
Import is review -> validation -> explicit replace/merge decision; this prototype supports replace semantics as the safe baseline.
Local editor state (selection, zoom, open panels, preview play state) is not portable domain data.

## Performance
- Virtualize large outlines/catalogs when needed.
- Keep canvas rendering derived from selected document, not whole-project deep watchers.
- Index component usages/dependencies rather than rescanning every render.
- Validate incrementally during authoring; run complete validation at save/export/generation.
- Lazy-render compare frames and heavy previews.

## Security
- JSON is data only.
- Reject prototype-pollution keys and excessive nesting/size.
- Do not evaluate imported expressions.
- Asset URLs require an explicit asset policy.
- Generated code must escape literal text/attributes.

## Implementation sequence
1. Shared IR + validators + migrations.
2. Project repository/codec and undo command boundary.
3. Nuxt UI catalog and recipe expansion.
4. Component editor contract/composition.
5. Page editor composition/layouts.
6. Preview/scenario runtime.
7. Vue generator.
8. Accessibility/performance qualification.
9. Native target-application integration.
