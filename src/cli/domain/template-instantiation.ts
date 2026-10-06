import {
  visualAllocate,
  visualElement,
  visualLayoutRules,
  visualNuxt,
  visualProject,
  visualText,
  type UiNode,
} from '../../../scripts/companion/visual/visual-ir.mjs';
import { visualCatalogEntry, visualExpand } from '../../../scripts/companion/visual/visual-catalog.mjs';
import { addComponent } from './components.ts';
import { addPage, pageFor, surfaceFor } from './pages.ts';
import { requireSketch, title } from './errors.ts';
import { validateComponentTemplateCatalog, type ComponentTemplate } from './component-template.ts';
import type { SketchDocument } from './document.ts';

function catalogOf(templates: readonly ComponentTemplate[]): Map<string, ComponentTemplate> {
  validateComponentTemplateCatalog(templates);
  return new Map(templates.map(template => [template.id, template]));
}

function bindCatalogProps(
  node: ReturnType<typeof visualNuxt>,
  template: ComponentTemplate,
  entryId: string,
): void {
  const entry = visualCatalogEntry(entryId)!;
  for (const prop of template.props) {
    if (entry.props.some((candidate: { name: string }) => candidate.name === prop.name)) {
      node.props[prop.name] = { kind: 'prop', name: prop.name };
    }
  }
}

function reusableComponent(
  document: SketchDocument,
  template: ComponentTemplate,
  canonical: boolean,
): string | undefined {
  if (!canonical) return undefined;
  const library = document.design.library.find(item => item.templateId === template.id && item.version === template.version
    && (item.templateCanonical === true || (item.templateCanonical === undefined && item.name === template.name)));
  return library && document.design.visualDesigns.components.find(item => item.libraryId === library.id)?.id;
}
function applyCatalogStructure(
  document: SketchDocument,
  template: ComponentTemplate,
  catalog: Map<string, ComponentTemplate>,
  created: Map<string, string>,
  definitionId: string,
): void {
  const store = document.design.visualDesigns, definition = store.components.find(item => item.id === definitionId)!;
  requireSketch(template.design.kind === 'catalog', 'TEMPLATE_KIND', 'Expected a catalog component template.');
  const node = visualNuxt(visualAllocate(store, 'vn'), template.design.entryId, {},
    { name: template.name, a11y: template.accessibility.notes });
  bindCatalogProps(node, template, template.design.entryId);
  const entry = visualCatalogEntry(template.design.entryId)!;
  const childSlot = entry.slots.find((candidate: { name: string }) => candidate.name === 'default') ?? entry.slots[0];
  if (childSlot) node.slots[childSlot.name] = template.children.map(child => {
    const target = catalog.get(child.template)!;
    return visualProject(visualAllocate(store, 'vn'), componentFromTemplate(document, target, catalog, created), { name: target.name });
  });
  definition.implementation = { catalog: 'nuxt-ui', entryId: template.design.entryId };
  definition.template = [node];
}
function applyCompositionStructure(
  document: SketchDocument,
  template: ComponentTemplate,
  catalog: Map<string, ComponentTemplate>,
  created: Map<string, string>,
  definitionId: string,
): void {
  requireSketch(template.design.kind === 'composition', 'TEMPLATE_KIND', 'Expected a composition component template.');
  const store = document.design.visualDesigns, children: UiNode[] = template.children.map(child => {
    const target = catalog.get(child.template)!;
    return visualProject(visualAllocate(store, 'vn'), componentFromTemplate(document, target, catalog, created), { name: target.name });
  });
  if (!children.length) children.push(visualText(visualAllocate(store, 'vn'), template.description, 'p',
    { name: template.name + ' placeholder' }));
  store.components.find(item => item.id === definitionId)!.template = [visualElement(visualAllocate(store, 'vn'), template.design.tag, {
    name: template.name, a11y: template.accessibility.notes, layout: visualLayoutRules(template.design.layout), children,
  })];
}
function applyComponentStructure(
  document: SketchDocument,
  template: ComponentTemplate,
  catalog: Map<string, ComponentTemplate>,
  created: Map<string, string>,
  definitionId: string,
): void {
  if (template.design.kind === 'catalog') { applyCatalogStructure(document, template, catalog, created, definitionId); return; }
  const definition = document.design.visualDesigns.components.find(item => item.id === definitionId)!;
  if (template.design.kind === 'recipe') { definition.template = visualExpand(document.design.visualDesigns, template.design.recipeId); return; }
  applyCompositionStructure(document, template, catalog, created, definitionId);
}
function componentFromTemplate(
  document: SketchDocument,
  template: ComponentTemplate,
  catalog: Map<string, ComponentTemplate>,
  created: Map<string, string>,
  override?: string,
): string {
  const existing = created.get(template.id);
  if (existing) return existing;
  requireSketch(!template.templateType.startsWith('page'), 'TEMPLATE_KIND', 'A page template cannot be used as a component child.');
  const canonical = override === undefined || override === template.name;
  const reusable = reusableComponent(document, template, canonical);
  if (reusable) { created.set(template.id, reusable); return reusable; }

  const id = addComponent(document, override ?? template.name);
  created.set(template.id, id);
  const definition = document.design.visualDesigns.components.find(item => item.id === id)!;
  const library = document.design.library.find(item => item.id === definition.libraryId)!;
  definition.description = template.description;
  definition.props = template.props.map(prop => ({ ...prop }));
  definition.emits = template.events.map(event => ({ name: event.name, payloadType: event.payloadType,
    ...(event.description ? { description: event.description } : {}) }));
  Object.assign(library, { category: template.category, description: template.description, version: template.version,
    origin: 'template', templateId: template.id, templateCanonical: canonical, atomicLevel: template.atomicLevel,
    props: template.props.map(prop => prop.name).join(', '), events: template.events.map(event => event.name).join(', ') });
  applyComponentStructure(document, template, catalog, created, id);
  return id;
}
function regionTag(role: string): 'header' | 'nav' | 'section' {
  if (role === 'header') return 'header';
  if (role === 'navigation') return 'nav';
  return 'section';
}

function pageFromTemplate(
  document: SketchDocument,
  template: ComponentTemplate,
  catalog: Map<string, ComponentTemplate>,
  override?: string,
): string {
  requireSketch(template.templateType.startsWith('page'), 'TEMPLATE_KIND', 'Select a page template.');
  const id = addPage(document, override ?? template.name);
  const target = pageFor(document, id);
  const store = document.design.visualDesigns;

  if (template.design.kind === 'recipe') {
    target.root = visualExpand(store, template.design.recipeId);
    return id;
  }
  requireSketch(template.design.kind === 'page', 'TEMPLATE_KIND', 'Page template uses an unsupported design.');

  const created = new Map<string, string>();
  const children = template.children.map(child => {
    const childTemplate = catalog.get(child.template)!;
    return { child, target: childTemplate,
      componentId: componentFromTemplate(document, childTemplate, catalog, created) };
  });
  const surface = surfaceFor(document, id);
  requireSketch(Array.isArray(surface.components), 'TEMPLATE_PAGE_REFERENCES',
    'Page template target has an invalid component reference list.');
  for (const row of children) {
    const definition = store.components.find(component => component.id === row.componentId)!;
    if (!surface.components.some(value => value && typeof value === 'object' && 'id' in value && value.id === definition.libraryId)) {
      surface.components.push({ id: definition.libraryId, slot: row.child.slot ?? 'content', variant: 'default' });
    }
  }
  const regions = template.slots.map(slot => visualElement(
    visualAllocate(store, 'vn'),
    regionTag(slot.role),
    {
      name: 'Template slot: ' + slot.id,
      notes: 'Accepts: ' + slot.accepts.join(', '),
      layout: visualLayoutRules('stack'),
      children: children
        .filter(row => row.child.slot === slot.id)
        .map(row => visualProject(
          visualAllocate(store, 'vn'),
          row.componentId,
          { name: row.target.name },
        )),
    },
  ));
  const unplaced = children
    .filter(row => !row.child.slot)
    .map(row => visualProject(
      visualAllocate(store, 'vn'),
      row.componentId,
      { name: row.target.name },
    ));

  target.root = [visualElement(
    visualAllocate(store, 'vn'),
    'main',
    {
      name: template.name,
      a11y: template.accessibility.notes,
      layout: visualLayoutRules(template.design.layout),
      children: [...regions, ...unplaced],
    },
  )];
  return id;
}

export function instantiateComponentTemplate(
  document: SketchDocument,
  templates: readonly ComponentTemplate[],
  templateId: string,
  name?: string,
) {
  const catalog = catalogOf(templates);
  const template = catalog.get(templateId);
  requireSketch(template, 'TEMPLATE_UNKNOWN', 'Component template not found; use templates list.');
  const label = name === undefined ? undefined : title(name, 120);

  if (template.templateType.startsWith('page')) {
    return { kind: 'page' as const, id: pageFromTemplate(document, template, catalog, label), templateId };
  }
  return {
    kind: 'component' as const,
    id: componentFromTemplate(document, template, catalog, new Map(), label),
    templateId,
  };
}
