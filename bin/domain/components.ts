import { visualAllocate, visualLocate, visualProject, visualText, visualLiteral, visualNodes, type UiNode, type ComponentDefinition } from '../../scripts/companion/visual/visual-ir.mjs';
import type { SketchDocument } from './document.ts';
import { requireSketch, slug, title } from './errors.ts';
import { pageContent, pageFor, pageNodes, surfaceFor } from './pages.ts';

export type ComponentChoice = { kind: 'new'; title: string } | { kind: 'existing'; id: string };
function componentFor(document: SketchDocument, id: string): ComponentDefinition {
  const component = document.design.visualDesigns.components.find(item => item.id === id);
  requireSketch(component, 'SKETCH_COMPONENT_MISSING', 'Select an existing designed component.');
  return component;
}
export function addComponent(document: SketchDocument, name: string): string {
  const label = title(name), design = document.design, store = design.visualDesigns;
  const id = slug(label, 'component', design.library.map(item => item.id));
  const symbol = 'Sketch' + id.split('-').map(part => part[0]!.toUpperCase() + part.slice(1)).join('');
  let exportName = symbol, suffix = 2;
  while (store.components.some(item => item.exportName.toLowerCase() === exportName.toLowerCase())) exportName = symbol + suffix++;
  const component: ComponentDefinition = { id: visualAllocate(store, 'vc'), libraryId: id, exportName,
    description: '', props: [], slots: [], emits: [], variants: [], template: [], scenarios: [] };
  component.template.push(visualText(visualAllocate(store, 'vn'), label, 'p', { name: 'Sketch title' }));
  design.library.push({ id, name: label, category: 'Data display', preview: 'record', description: '', props: '', events: '',
    slots: '', variants: 'default', a11y: '', tokens: '', replacement: '', version: '0.1.0', revision: 1, status: 'draft', origin: 'project' });
  store.components.push(component);
  return component.id;
}
export function attachComponents(document: SketchDocument, surfaceId: string, choices: readonly ComponentChoice[]): string[] {
  requireSketch(choices.length > 0 && choices.length <= 60, 'SKETCH_BATCH_LIMIT', 'Add between 1 and 60 component instances in a batch.');
  const surface = surfaceFor(document, surfaceId), content = pageContent(document, surfaceId), store = document.design.visualDesigns;
  const references = surface.components;
  requireSketch(Array.isArray(references), 'SKETCH_COMPONENT_REFERENCES', 'Page component references need repair in Companion.');
  return choices.map(choice => {
    const component = componentFor(document, choice.kind === 'new' ? addComponent(document, choice.title) : choice.id);
    const entry = document.design.library.find(item => item.id === component.libraryId)!;
    const instance = visualProject(visualAllocate(store, 'vn'), component.id, { name: entry.name });
    for (const prop of component.props.filter(item => item.required)) {
      instance.props[prop.name] = visualLiteral(prop.default ?? (prop.type === 'boolean' ? false : prop.type === 'number' ? 0 : ''));
    }
    content.push(instance);
    if (!references.some(item => item && typeof item === 'object' && 'id' in item && item.id === component.libraryId)) {
      references.push({ id: component.libraryId, slot: 'content', variant: 'default' });
    }
    return instance.id;
  });
}
export function renameComponent(document: SketchDocument, id: string, name: string): void {
  const label = title(name), component = componentFor(document, id);
  const entry = document.design.library.find(item => item.id === component.libraryId)!;
  const previous = entry.name; entry.name = label;
  for (const node of component.template) {
    if (node.kind === 'text' && node.name === 'Sketch title' && node.value.kind === 'literal' && node.value.value === previous) node.value = visualLiteral(label);
  }
}
function referencedComponents(nodes: UiNode[]): Set<string> {
  return new Set(nodes.flatMap(node => node.kind === 'component' && node.ref.kind === 'project' ? [node.ref.componentId] : []));
}
export function removeNode(document: SketchDocument, surfaceId: string, nodeId: string): void {
  const page = pageFor(document, surfaceId), hit = visualLocate(page.root, nodeId);
  requireSketch(hit, 'SKETCH_NODE_MISSING', 'The selected element no longer exists.');
  const removed = referencedComponents(visualNodes([hit.node]));
  hit.list.splice(hit.index, 1);
  const remaining = referencedComponents(pageNodes(document, surfaceId));
  const retired = new Set([...removed].filter(id => !remaining.has(id)).map(id => componentFor(document, id).libraryId));
  const surface = surfaceFor(document, surfaceId);
  if (Array.isArray(surface.components)) {
    surface.components = surface.components.filter(item => !(item && typeof item === 'object' && 'id' in item && retired.has(String(item.id))));
  }
}
