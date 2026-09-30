/** Source-derived model coverage, deliberately separate from executed/native acceptance. */
import { validateAuthoringDocument } from '../companion/authoring-contract.ts';
import { visualCatalog } from '../companion/visual/visual-catalog.mjs';
import { VISUAL_CONTROL_KINDS } from '../companion/visual/visual-mapping.mjs';
import { VISUAL_ACTION_KINDS, VISUAL_STATES, VISUAL_LAYOUT_MODES, visualNodes, visualRoot, type VisualDesigns } from '../companion/visual/visual-ir.mjs';
import { validateVisualDesigns } from '../companion/visual/visual-validate.mjs';
import { editorBindings, SHIPPED_EDITORS } from '../companion/sitemap/editor-bindings.ts';
import { validateDefinition } from './validation.ts';
function inventory(expected: readonly string[], used: Set<string>) {
  return { expected: [...expected], used: [...used].sort(), missing: expected.filter(id => !used.has(id)) };
}
export function starterCoverage(input: unknown) {
  const definition = validateDefinition(input);
  if (definition.generator.kind === 'project') return { starter: definition.id, scope: 'project-selection', modeled: null,
    behaviorAcceptance: 'not-run', nativeAcceptance: 'not-run', note: 'A project starter selects compiler targets; its visual model comes from the prototype interview.' };
  if (definition.generator.kind !== 'companion') return { starter: definition.id, scope: 'file-blueprint', modeled: null,
    behaviorAcceptance: 'not-run', nativeAcceptance: 'not-run', note: 'File payloads are not a declarative visual model.' };
  const doc = validateAuthoringDocument(definition.generator.document), d = doc.design;
  const visual: VisualDesigns = validateVisualDesigns(d.visualDesigns);
  const entries = new Set<string>(), actions = new Set<string>(), controls = new Set<string>(), states = new Set<string>(), layouts = new Set<string>();
  const unbound: { definition: string; node: string; interaction: string; label: string }[] = [];
  const limitations: { code: string; definition: string; node: string; message: string }[] = [];
  const all = [...visual.pages, ...visual.components, ...visual.layouts, ...visual.revisions];
  for (const owner of all) {
    if ('scenarios' in owner) for (const scenario of owner.scenarios ?? []) states.add(scenario.state);
    for (const node of visualNodes(visualRoot(owner))) {
      for (const state of node.visibleIn ?? []) states.add(state);
      if (node.layout) layouts.add(node.layout.mode);
      if (node.kind === 'component' && node.ref.kind === 'nuxt-ui') {
        entries.add(node.ref.entryId);
        if (node.control) controls.add(node.control.kind);
        if (node.ref.entryId === 'u-dropdown-menu' && !node.events.some(event => event.event === 'item:select' && event.actions.length)) limitations.push({ code: 'MENU_ITEM_ACTION_UNBOUND', definition: owner.id, node: node.id,
          message: 'Menu items have no declared item:select actions. Menu rendering alone is not working item behavior.' });
      }
      if (!('events' in node)) continue;
      for (const event of node.events) {
        if (!event.actions.length) unbound.push({ definition: owner.id, node: node.id, interaction: event.id, label: event.label });
        for (const action of event.actions) actions.add(action.kind);
      }
    }
  }
  const categories = { primitives: inventory(visualCatalog.map(entry => entry.id), entries),
    controls: inventory(VISUAL_CONTROL_KINDS, controls), actions: inventory(VISUAL_ACTION_KINDS, actions),
    states: inventory(VISUAL_STATES, states), layouts: inventory(VISUAL_LAYOUT_MODES, layouts) };
  return { starter: definition.id, scope: 'declarative-model-inventory',
    modeled: { categories, complete: Object.values(categories).every(category => category.missing.length === 0),
      pages: visual.pages.length, components: visual.components.length, revisions: visual.revisions.length, layouts: visual.layouts.length,
      surfaces: d.nodes.length, routes: d.sitemap?.routes.length ?? 0, journeys: d.sitemap?.journeys.length ?? 0 },
    unboundInteractions: unbound, limitations, shippedEditors: [...SHIPPED_EDITORS], declaredEditorBindings: editorBindings(d),
    behaviorAcceptance: 'not-run', nativeAcceptance: 'not-run',
    note: 'Presence in JSON is not a passing interaction test. Full native Companion parity requires native adapters and candidate-bound behavioral evidence; this read-only report does not invent either.' };
}
