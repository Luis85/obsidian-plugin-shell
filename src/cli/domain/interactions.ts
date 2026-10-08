import { visualAllocate, visualElement, visualText, visualLiteral, type Interaction, type VisualAction, type Mapping } from '#shared/companion/visual/visual-ir.mjs';
import type { SketchDocument } from './document.ts';
import { requireSketch, title } from '#shared/contracts/sketch-errors.ts';
import { sourceOperation } from './bricks.ts';
import { validateVisualMapping } from '#shared/companion/visual/visual-mapping.mjs';
import { pageContent, pageNodes, surfaceFor } from './pages.ts';

export function interactions(document: SketchDocument, surface: string) {
  return pageNodes(document, surface).flatMap(node => 'events' in node ? node.events.map(interaction => ({ node, interaction })) : []);
}
function interactionFor(document: SketchDocument, surface: string, id: string): Interaction {
  const selected = interactions(document, surface).find(item => item.interaction.id === id);
  requireSketch(selected, 'SKETCH_INTERACTION_MISSING', 'Select an existing page interaction.');
  return selected.interaction;
}
/** A title-only interaction is an explicit implementation TODO, never a fabricated business outcome. */
export function addInteraction(document: SketchDocument, surface: string, name: string, source?: string): string {
  surfaceFor(document, surface);
  const label = title(name), store = document.design.visualDesigns;
  const interaction: Interaction = { id: visualAllocate(store, 'vi'), label, event: 'click', actions: [], notes: '', acceptance: '' };
  if (source) {
    const node = pageNodes(document, surface).find(item => item.id === source);
    requireSketch(node && 'events' in node, 'SKETCH_INTERACTION_SOURCE', 'Choose a component or element that supports interactions.');
    node.events.push(interaction);
  } else {
    const button = visualElement(visualAllocate(store, 'vn'), 'button', { name: label,
      attrs: { type: visualLiteral('button') }, events: [interaction],
      children: [visualText(visualAllocate(store, 'vn'), label, 'span')] });
    pageContent(document, surface).push(button);
  }
  return interaction.id;
}
export function setInteractionAction(document: SketchDocument, surface: string, id: string, action: VisualAction | null): void {
  if (action?.kind === 'navigate') surfaceFor(document, action.surfaceId);
  interactionFor(document, surface, id).actions = action ? [action] : [];
}

/** Connect an interaction to the existing typed visual source-call contract. */
export function setSourceInteractionAction(document: SketchDocument, surface: string, id: string,
  sourceId: string, operationRef: string, input: unknown): void {
  const { source, operation } = sourceOperation(document, sourceId, operationRef);
  const mapping = validateVisualMapping(input) as Mapping;
  const requiresInput = (operation.input as { mode?: string } | undefined)?.mode !== 'none';
  requireSketch(requiresInput !== (mapping.kind === 'none'), 'SOURCE_ACTION_INPUT',
    requiresInput ? 'Map an explicit payload for this operation.' : 'This operation takes no payload.');
  setInteractionAction(document, surface, id, {
    kind: 'source', sourceId: String(source.id), operationId: String(operation.id), input: mapping,
  });
}
export function renameInteraction(document: SketchDocument, surface: string, id: string, name: string): void {
  interactionFor(document, surface, id).label = title(name);
}
export function removeInteraction(document: SketchDocument, surface: string, id: string): void {
  const selected = interactions(document, surface).find(item => item.interaction.id === id);
  requireSketch(selected && 'events' in selected.node, 'SKETCH_INTERACTION_MISSING', 'The interaction no longer exists.');
  selected.node.events = selected.node.events.filter(item => item.id !== id);
}
