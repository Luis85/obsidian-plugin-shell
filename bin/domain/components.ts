import { visualAllocate, visualLocate, visualProject, visualText, visualLiteral, visualNodes, visualNuxt, type ValueExpression, type UiNode, type ComponentDefinition } from '../../scripts/companion/visual/visual-ir.mjs';
import type { SketchDocument } from './document.ts';
import { visualCatalogEntry } from '../../scripts/companion/visual/visual-catalog.mjs';
import { sourceOperation } from './bricks.ts';
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
/** Insert a Nuxt UI data table with a live binding to the managed Collection.list port. */
export function pageCollectionTable(document: SketchDocument, surfaceId: string, sourceId: string, name: string): string {
  const { source, operation } = sourceOperation(document, sourceId, 'list');
  requireSketch(source.kind === 'collection' && operation.direction === 'read', 'COLLECTION_TABLE', 'Choose a Collection with its managed List operation.');
  const semantic = document.design.semantic as { entities?: { id: string; properties?: { key: string }[] }[] } | undefined;
  const entity = semantic?.entities?.find(row => row.id === source.entity);
  requireSketch(entity, 'COLLECTION_ENTITY', 'Collection entity is missing.');
  const columns = (entity.properties ?? []).slice(0, 8).map(prop => ({ accessorKey: 'record.' + prop.key, header: prop.key.replace(/_/g, ' ') }));
  const store = document.design.visualDesigns;
  const table = visualNuxt(visualAllocate(store, 'vn'), 'u-table', {
    data: { kind: 'source', sourceId: String(source.id), operationId: String(operation.id), field: '' },
    columns: visualLiteral(columns),
  }, { name: title(name, 80) });
  pageContent(document, surfaceId).push(table);
  return table.id;
}
/** Bind a page component prop (or the value of a text element) to a reusable source read port. */
export function pageBindSource(document: SketchDocument, surfaceId: string, nodeId: string, prop: string,
  sourceId: string, operationRef: string, field: string): void {
  const { source, operation } = sourceOperation(document, sourceId, operationRef);
  requireSketch(['read', 'both'].includes(String(operation.direction)), 'SOURCE_BIND_DIRECTION', 'A display binding requires a read operation.');
  requireSketch(typeof field === 'string' && field.length <= 120 &&
    (field === '' || /^(?:[A-Za-z][A-Za-z0-9_-]*|0|[1-9][0-9]*)(?:\.(?:[A-Za-z][A-Za-z0-9_-]*|0|[1-9][0-9]*))*$/.test(field)),
    'SOURCE_BIND_FIELD', 'Use a declared dotted output path or an empty path for the entire result.');
  const node = visualLocate(pageFor(document, surfaceId).root, nodeId)?.node;
  requireSketch(node, 'SOURCE_BIND_NODE', 'Choose an existing page component or text element.');
  const expr: ValueExpression = { kind: 'source', sourceId: String(source.id), operationId: String(operation.id), field };
  if (node.kind === 'text' && prop === '@value') { node.value = expr; return; }
  requireSketch(node.kind === 'component' || node.kind === 'external', 'SOURCE_BIND_PROP', 'Select a component prop or use @value for text.');
  if (node.kind === 'component') {
    let available: readonly { name: string }[] | undefined;
    if (node.ref.kind === 'nuxt-ui') available = visualCatalogEntry(node.ref.entryId)?.props;
    else if (node.ref.kind === 'project') {
      const componentId = node.ref.componentId;
      available = document.design.visualDesigns.components.find(component => component.id === componentId)?.props;
    }
    requireSketch(available?.some(candidate => candidate.name === prop), 'SOURCE_BIND_PROP', 'That component has no such declared prop.');
  } else requireSketch(/^[a-z][a-zA-Z0-9]{0,59}$/.test(prop), 'SOURCE_BIND_PROP', 'External adapter prop must be portable.');
  node.props[prop] = expr;
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
