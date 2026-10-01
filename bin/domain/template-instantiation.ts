import {
  visualAllocate,
  visualElement,
  visualLayoutRules,
  visualNuxt,
  visualProject,
  visualText,
  type UiNode,
} from '../../scripts/companion/visual/visual-ir.mjs';
import { visualCatalogEntry, visualExpand } from '../../scripts/companion/visual/visual-catalog.mjs';
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
    if (entry.props.some(candidate => candidate.name === prop.name)) {
      node.props[prop.name] = { kind: 'prop', name: prop.name };
    }
  }
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

  const id = addComponent(document, override ?? template.name);
  created.set(template.id, id);
  const store = document.design.visualDesigns;
  const definition = store.components.find(item => item.id === id)!;
  const library = document.design.library.find(item => item.id === definition.libraryId)!;

  definition.description = template.description;
  definition.props = template.props.map(prop => ({ ...prop }));
  definition.emits = template.events.map(event => ({
    name: event.name,
    payloadType: event.payloadType,
    ...(event.description ? { description: event.description } : {}),
  }));
  library.category = template.category;
  library.description = template.description;
  library.version = template.version;
  library.origin = 'template';
  library.templateId = template.id;
  library.atomicLevel = template.atomicLevel;
  library.props = template.props.map(prop => prop.name).join(', ');
  library.events = template.events.map(event => event.name).join(', ');

  if (template.design.kind === 'catalog') {
    const node = visualNuxt(
      visualAllocate(store, 'vn'),
      template.design.entryId,
      {},
      { name: template.name, a11y: template.accessibility.notes },
    );
    bindCatalogProps(node, template, template.design.entryId);
    const entry = visualCatalogEntry(template.design.entryId)!;
    const childSlot = entry.slots.includes('default') ? 'default' : entry.slots[0];
    if (childSlot && template.children.length) {
      node.slots[childSlot] = template.children.map(child => {
        const target = catalog.get(child.template)!;
        return visualProject(visualAllocate(store, 'vn'), componentFromTemplate(document, target, catalog, created), { name: target.name });
      });
    }
    definition.implementation = { catalog: 'nuxt-ui', entryId: template.design.entryId };
    definition.template = [node];
    return id;
  }

  if (template.design.kind === 'recipe') {
    definition.template = visualExpand(store, template.design.recipeId);
    return id;
  }

  requireSketch(template.design.kind === 'composition', 'TEMPLATE_KIND',
    'Component templates use catalog, recipe or composition designs.');
  const children: UiNode[] = template.children.map(child => {
    const target = catalog.get(child.template)!;
    return visualProject(
      visualAllocate(store, 'vn'),
      componentFromTemplate(document, target, catalog, created),
      { name: target.name },
    );
  });
  if (!children.length) {
    children.push(visualText(
      visualAllocate(store, 'vn'),
      template.description,
      'p',
      { name: template.name + ' placeholder' },
    ));
  }
  definition.template = [visualElement(
    visualAllocate(store, 'vn'),
    template.design.tag,
    {
      name: template.name,
      a11y: template.accessibility.notes,
      layout: visualLayoutRules(template.design.layout),
      children,
    },
  )];
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
