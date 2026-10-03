import { validateAuthoringDocument, type AuthoringDocument } from '../../../scripts/companion/authoring-contract.ts';
import { visualNodes, type UiNode } from '../../../scripts/companion/visual/visual-ir.mjs';
import { docsObject as object, array, text, insist, keyOf, equal, validateEntity, type Entity, type ObjectData } from '../domain/contracts.ts';
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
interface Projection { project: string; design: ObjectData; output: Entity[]; order: Record<string, string[]> }
const add = (projection: Projection, entity: Entity): void => { validateEntity(entity); projection.output.push(entity); };
const emptyLabel = (value: unknown): ObjectData => value === '' ? { emptyLabel: true } : {};
const labelOr = (value: unknown, fallback: string): string => typeof value === 'string' && value ? value : fallback;
const ids = (items: ObjectData[]): string[] => items.map(item => text(item.id));
function projectPage(projection: Projection, surface: ObjectData, pages: ObjectData[]): void {
  const id = text(surface.id), page = pages.find(item => item.ownerId === id);
  const fields: ObjectData = { surface_kind: surface.kind };
  const data: ObjectData = { surface: omit(surface, ['id', 'label', 'kind']) };
  if (page) {
    fields.visual_id = page.id;
    data.visual = omit(page, ['id', 'name', 'ownerId']);
    // Preserve legitimately different page names instead of collapsing the pair.
    if (page.name !== surface.label) object(data.visual).name = page.name;
    extractEvents(object(data.visual).root, 'page', id, projection.project, projection.output);
  }
  add(projection, { type: 'page', id, project: projection.project, title: text(surface.label), fields, data });
}
function projectComponents(projection: Projection, components: ObjectData[], library: ObjectData[]): void {
  const { project } = projection;
  for (const component of components) {
    const entry = library.find(item => item.id === component.libraryId);
    insist(entry, 'DOCS_COMPONENT_LIBRARY', 'A component has no library entry.');
    const data = { library: omit(entry, ['id', 'name']), visual: omit(component, ['id', 'libraryId', 'exportName']) };
    extractEvents(object(data.visual).template, 'component', text(component.id), project, projection.output);
    add(projection, { type: 'component', id: text(component.id), project, title: text(entry.name),
      fields: { library_id: component.libraryId, export_name: component.exportName }, data });
  }
  for (const entry of library.filter(item => !components.some(component => component.libraryId === item.id)))
    add(projection, { type: 'library-component', id: text(entry.id), project, title: text(entry.name), fields: {}, data: omit(entry, ['id', 'name']) });
}
function projectLink(projection: Projection, link: ObjectData): void {
  add(projection, { type: 'transition', id: text(link.id), project: projection.project, title: labelOr(link.label, String(link.id)),
    fields: { from: link.from, to: link.to, kind: link.kind }, data: { ...omit(link, ['id', 'label', 'from', 'to', 'kind']), ...emptyLabel(link.label) } });
}
type Collection = typeof collections[number];
function labelField(type: Collection['type'], label: string, item: ObjectData): string {
  if (type !== 'prd') return label;
  return Object.hasOwn(item, 'name') ? 'name' : Object.hasOwn(item, 'title') ? 'title' : '';
}
function collectionItem(projection: Projection, { type, label }: Collection, item: ObjectData): void {
  const id = text(item.id), title = labelOr(item[label], id), actualLabel = labelField(type, label, item);
  const fields: ObjectData = type === 'route' ? { surface_id: item.surface, path: item.path } : type === 'prd' ? { label_field: actualLabel || 'none' } : {};
  const extracted = type === 'route' ? ['surface', 'path'] : actualLabel ? [actualLabel] : [];
  const data = omit(item, ['id', ...extracted]);
  if (actualLabel && item[actualLabel] === '') data.emptyLabel = true;
  add(projection, { type, id, project: projection.project, title: actualLabel ? labelOr(item[actualLabel], title) : title, fields, data });
}
function projectCollection(projection: Projection, collection: Collection): void {
  const { parent, field } = collection, design = projection.design;
  const host = parent ? design[parent] === undefined ? undefined : object(design[parent]) : design;
  if (host?.[field] === undefined) return;
  for (const item of list(host[field])) collectionItem(projection, collection, item);
  projection.order[parent ? parent + '.' + field : field] = ids(list(host[field]));
  host[field] = [];
}
/** Complete projection: non-extracted validated fields stay in the explicit project context. */
export function projectEntities(input: unknown): Entity[] {
  const doc = structuredClone(validateAuthoringDocument(input)), design = object(doc.design);
  const projection: Projection = { project: doc.project.id, design, output: [], order: {} }, { project, order } = projection;
  const visual = design.visualDesigns === undefined ? undefined : object(design.visualDesigns);
  const pages = list(visual?.pages), components = list(visual?.components), library = list(design.library);
  for (const surface of list(design.nodes)) projectPage(projection, surface, pages);
  insist(pages.every(page => list(design.nodes).some(node => node.id === page.ownerId)), 'DOCS_ORPHAN_PAGE', 'A visual page has no sitemap owner.');
  projectComponents(projection, components, library);
  for (const link of list(design.links)) projectLink(projection, link);
  for (const collection of collections) projectCollection(projection, collection);
  order.nodes = ids(list(design.nodes)); order.links = ids(list(design.links)); order.library = ids(library);
  if (visual) {
    order['visualDesigns.pages'] = ids(pages); order['visualDesigns.components'] = ids(components);
    visual.pages = []; visual.components = [];
  }
  design.nodes = []; design.links = []; if (design.library !== undefined) design.library = [];
  add(projection, { type: 'project', id: project, project, title: doc.project.name, fields: {},
    data: { identity: omit(object(doc.project), ['id', 'name']), settings: doc.settings, notes: doc.notes,
      design, order, ...(doc.tooling === undefined ? {} : { tooling: doc.tooling }) } });
  const identities = projection.output.map(keyOf);
  insist(new Set(identities).size === identities.length, 'DOCS_DUPLICATE', 'Project projection contains duplicate document identities.');
  return projection.output.sort((a, b) => keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : 0);
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
