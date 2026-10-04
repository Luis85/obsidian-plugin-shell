/** Source-derived model coverage, deliberately separate from executed/native acceptance. */
import { validateAuthoringDocument } from '../../../scripts/companion/authoring-contract.ts';
import { visualCatalog } from '../../../scripts/companion/visual/visual-catalog.mjs';
import { VISUAL_CONTROL_KINDS } from '../../../scripts/companion/visual/visual-mapping.mjs';
import { VISUAL_ACTION_KINDS, VISUAL_STATES, VISUAL_LAYOUT_MODES, visualNodes, visualRoot, type VisualDesigns } from '../../../scripts/companion/visual/visual-ir.mjs';
import { validateVisualDesigns } from '../../../scripts/companion/visual/visual-validate.mjs';
import { editorBindings, SHIPPED_EDITORS } from '../../../scripts/companion/sitemap/editor-bindings.ts';
import { validateDefinition } from './validation.ts';
import type { StarterDefinition } from './types.ts';
function inventory(expected: readonly string[], used: Set<string>) {
  return { expected: [...expected], used: [...used].sort(), missing: expected.filter(id => !used.has(id)) };
}
type VisualOwner = VisualDesigns['pages'][number] | VisualDesigns['components'][number] | VisualDesigns['layouts'][number] | VisualDesigns['revisions'][number];
type VisualNode = ReturnType<typeof visualNodes>[number];
interface ModelUse {
  entries: Set<string>; actions: Set<string>; controls: Set<string>; states: Set<string>; layouts: Set<string>;
  unbound: { definition: string; node: string; interaction: string; label: string }[];
  limitations: { code: string; definition: string; node: string; message: string }[];
}
const notRun = { behaviorAcceptance: 'not-run', nativeAcceptance: 'not-run' } as const;
/** Project and file starters have no declarative visual model to inventory. */
function unmodeled(definition: StarterDefinition) {
  if (definition.generator.kind === 'project') return { starter: definition.id, scope: 'project-selection', modeled: null,
    ...notRun, note: 'A project starter selects compiler targets; its visual model comes from the prototype interview.' };
  return { starter: definition.id, scope: 'file-blueprint', modeled: null,
    ...notRun, note: 'File payloads are not a declarative visual model.' };
}
function recordComponent(owner: VisualOwner, node: VisualNode, use: ModelUse): void {
  if (node.kind !== 'component' || node.ref.kind !== 'nuxt-ui') return;
  use.entries.add(node.ref.entryId);
  if (node.control) use.controls.add(node.control.kind);
  if (node.ref.entryId === 'u-dropdown-menu' && !node.events.some(event => event.event === 'item:select' && event.actions.length)) use.limitations.push({ code: 'MENU_ITEM_ACTION_UNBOUND', definition: owner.id, node: node.id,
    message: 'Menu items have no declared item:select actions. Menu rendering alone is not working item behavior.' });
}
function recordNode(owner: VisualOwner, node: VisualNode, use: ModelUse): void {
  for (const state of node.visibleIn ?? []) use.states.add(state);
  if (node.layout) use.layouts.add(node.layout.mode);
  recordComponent(owner, node, use);
  if (!('events' in node)) return;
  for (const event of node.events) {
    if (!event.actions.length) use.unbound.push({ definition: owner.id, node: node.id, interaction: event.id, label: event.label });
    for (const action of event.actions) use.actions.add(action.kind);
  }
}
function modelUse(visual: VisualDesigns): ModelUse {
  const use: ModelUse = { entries: new Set(), actions: new Set(), controls: new Set(), states: new Set(), layouts: new Set(), unbound: [], limitations: [] };
  for (const owner of [...visual.pages, ...visual.components, ...visual.layouts, ...visual.revisions]) {
    if ('scenarios' in owner) for (const scenario of owner.scenarios ?? []) use.states.add(scenario.state);
    for (const node of visualNodes(visualRoot(owner))) recordNode(owner, node, use);
  }
  return use;
}
export function starterCoverage(input: unknown) {
  const definition = validateDefinition(input);
  if (definition.generator.kind !== 'companion') return unmodeled(definition);
  const doc = validateAuthoringDocument(definition.generator.document), d = doc.design;
  const visual: VisualDesigns = validateVisualDesigns(d.visualDesigns);
  const use = modelUse(visual);
  const categories = { primitives: inventory(visualCatalog.map(entry => entry.id), use.entries),
    controls: inventory(VISUAL_CONTROL_KINDS, use.controls), actions: inventory(VISUAL_ACTION_KINDS, use.actions),
    states: inventory(VISUAL_STATES, use.states), layouts: inventory(VISUAL_LAYOUT_MODES, use.layouts) };
  return { starter: definition.id, scope: 'declarative-model-inventory',
    modeled: { categories, complete: Object.values(categories).every(category => category.missing.length === 0),
      pages: visual.pages.length, components: visual.components.length, revisions: visual.revisions.length, layouts: visual.layouts.length,
      surfaces: d.nodes.length, surfacesWithUxAcceptance: d.nodes.filter(n => n.acceptance !== undefined).length, routes: d.sitemap?.routes.length ?? 0, journeys: d.sitemap?.journeys.length ?? 0 },
    unboundInteractions: use.unbound, limitations: use.limitations, shippedEditors: [...SHIPPED_EDITORS], declaredEditorBindings: editorBindings(d),
    ...notRun,
    note: 'Presence in JSON is not a passing interaction test. Full native Companion parity requires native adapters and candidate-bound behavioral evidence; this read-only report does not invent either.' };
}
