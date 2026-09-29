import { validateAuthoringDocument, migrateAuthoringDocument, type AuthoringDocument } from '../../companion/authoring-contract.ts';
import { visualNodes, type UiNode } from '../../companion/visual/visual-ir.mjs';
import { docsObject as object, array, text, insist, keyOf, equal, validateEntity, type Entity, type DocType, type ObjectData } from '../domain/contracts.ts';
import { restoreProject } from './restore.ts';
const list = (value: unknown): ObjectData[] => value === undefined ? [] : array(value).map(object);
const collections = [
  { type: 'journey', parent: 'sitemap', field: 'journeys', label: 'name' },
  { type: 'route', parent: 'sitemap', field: 'routes', label: 'path' },
  { type: 'feature', parent: 'features', field: 'items', label: 'name' },
  { type: 'layout', parent: 'visualDesigns', field: 'layouts', label: 'name' },
  { type: 'component-revision', parent: 'visualDesigns', field: 'revisions', label: 'version' },
  { type: 'prd', parent: '', field: 'prds', label: 'name' },
] as const;
function omit(value: ObjectData, keys: readonly string[]): ObjectData {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}
function nodes(value: unknown): UiNode[] { return array(value) as UiNode[]; }
/** Split events only on editable page/component definitions; revisions/layouts remain self-contained. */
function extractEvents(root: unknown, ownerType: string, ownerId: string, project: string, output: Entity[]): void {
  for (const node of visualNodes(nodes(root))) if ('events' in node) {
    node.events.forEach((event, position) => output.push({ type: 'interaction', id: event.id, project, title: event.label || event.id,
      fields: { owner_type: ownerType, owner_id: ownerId, source_node_id: node.id, event: event.event, position },
      data: { ...omit(object(event), ['id', 'label', 'event']), ...(event.label === '' ? { emptyLabel: true } : {}) } }));
    node.events = [];
  }
}
/** Complete projection: non-extracted validated fields stay in the explicit project context. */
export function projectEntities(input: unknown): Entity[] {
  const doc = structuredClone(migrateAuthoringDocument(input).document), design = object(doc.design);
  const project = doc.project.id, output: Entity[] = [], order: Record<string, string[]> = {};
  const add = (entity: Entity): void => { validateEntity(entity); output.push(entity); };
  const visual = design.visualDesigns === undefined ? undefined : object(design.visualDesigns);
  const pages = list(visual?.pages), components = list(visual?.components), library = list(design.library);
  for (const surface of list(design.nodes)) {
    const id = text(surface.id), page = pages.find(item => item.ownerId === id);
    const fields: ObjectData = { surface_kind: surface.kind };
    const data: ObjectData = { surface: omit(surface, ['id', 'label', 'kind']) };
    if (page) {
      fields.visual_id = page.id;
      data.visual = omit(page, ['id', 'name', 'ownerId']);
      // Preserve legitimately different page names instead of collapsing the pair.
      if (page.name !== surface.label) object(data.visual).name = page.name;
      extractEvents(object(data.visual).root, 'page', id, project, output);
    }
    add({ type: 'page', id, project, title: text(surface.label), fields, data });
  }
  insist(pages.every(page => list(design.nodes).some(node => node.id === page.ownerId)), 'DOCS_ORPHAN_PAGE', 'A visual page has no sitemap owner.');
  for (const component of components) {
    const entry = library.find(item => item.id === component.libraryId);
    insist(entry, 'DOCS_COMPONENT_LIBRARY', 'A component has no library entry.');
    const data = { library: omit(entry, ['id', 'name']), visual: omit(component, ['id', 'libraryId', 'exportName']) };
    extractEvents(object(data.visual).template, 'component', text(component.id), project, output);
    add({ type: 'component', id: text(component.id), project, title: text(entry.name),
      fields: { library_id: component.libraryId, export_name: component.exportName }, data });
  }
  for (const entry of library.filter(item => !components.some(component => component.libraryId === item.id)))
    add({ type: 'library-component', id: text(entry.id), project, title: text(entry.name), fields: {}, data: omit(entry, ['id', 'name']) });
  for (const link of list(design.links)) add({ type: 'transition', id: text(link.id), project, title: typeof link.label === 'string' && link.label ? link.label : String(link.id),
    fields: { from: link.from, to: link.to, kind: link.kind }, data: { ...omit(link, ['id', 'label', 'from', 'to', 'kind']), ...(link.label === '' ? { emptyLabel: true } : {}) } });
  for (const { type, parent, field, label } of collections) {
    const host = parent ? design[parent] === undefined ? undefined : object(design[parent]) : design;
    if (host?.[field] === undefined) continue;
    for (const item of list(host[field])) {
      const id = text(item.id), title = typeof item[label] === 'string' && item[label] ? String(item[label]) : id;
      const actualLabel = type === 'prd' ? (Object.hasOwn(item, 'name') ? 'name' : Object.hasOwn(item, 'title') ? 'title' : '') : label;
      const fields: ObjectData = type === 'route' ? { surface_id: item.surface, path: item.path } : type === 'prd' ? { label_field: actualLabel || 'none' } : {};
      const data = omit(item, ['id', ...(type === 'route' ? ['surface', 'path'] : actualLabel ? [actualLabel] : [])]);
      if (actualLabel && item[actualLabel] === '') data.emptyLabel = true;
      add({ type, id, project, title: actualLabel && typeof item[actualLabel] === 'string' && item[actualLabel] ? String(item[actualLabel]) : title, fields, data });
    }
    order[parent ? parent + '.' + field : field] = list(host[field]).map(item => text(item.id));
    host[field] = [];
  }
  order.nodes = list(design.nodes).map(item => text(item.id)); order.links = list(design.links).map(item => text(item.id));
  order.library = library.map(item => text(item.id));
  if (visual) {
    order['visualDesigns.pages'] = pages.map(item => text(item.id)); order['visualDesigns.components'] = components.map(item => text(item.id));
    visual.pages = []; visual.components = [];
  }
  design.nodes = []; design.links = []; if (design.library !== undefined) design.library = [];
  add({ type: 'project', id: project, project, title: doc.project.name, fields: {},
    data: { identity: omit(object(doc.project), ['id', 'name']), settings: doc.settings, notes: doc.notes,
      design, order, ...(doc.tooling === undefined ? {} : { tooling: doc.tooling }) } });
  const identities = output.map(keyOf);
  insist(new Set(identities).size === identities.length, 'DOCS_DUPLICATE', 'Project projection contains duplicate document identities.');
  return output.sort((a, b) => keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : 0);
}
export function applyEntities(current: AuthoringDocument, entities: Entity[]): AuthoringDocument {
  const proposed = restoreProject(current, entities);
  validateAuthoringDocument(proposed);
  // Existing immutable revision records must survive byte-equivalent at the semantic level.
  const before = list(current.design.visualDesigns === undefined ? undefined : object(current.design.visualDesigns).revisions);
  const after = list(proposed.design.visualDesigns === undefined ? undefined : object(proposed.design.visualDesigns).revisions);
  insist(before.every(revision => after.some(item => item.id === revision.id && equal(item, revision))), 'DOCS_REVISION_IMMUTABLE', 'Published component revisions cannot be modified or removed by documentation import.');
  return proposed;
}
export function coverage(entities: Entity[]) {
  return { complete: true, preservedContext: 'project.shell-data.design',
    types: Object.fromEntries([...new Set(['project', 'page', 'component', 'interaction', 'journey', 'route', 'transition', 'layout', 'component-revision', 'library-component', 'feature', 'prd', ...entities.map(item => item.type)])]
      .map(type => [type, entities.filter(item => item.type === type).length])) };
}
