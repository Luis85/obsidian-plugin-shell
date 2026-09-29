import { validateAuthoringDocument, type AuthoringDocument } from '../../companion/authoring-contract.ts';
import { newSitemapSurface } from '../../companion/sitemap/create.ts';
import { emptyVisualDesigns, visualNodes, type UiNode, type Interaction } from '../../companion/visual/visual-ir.mjs';
import { docsObject as object, array, insist, text, equal, type Entity, type ObjectData } from '../domain/contracts.ts';
const list = (value: unknown): ObjectData[] => value === undefined ? [] : array(value).map(object);
const clone = (value: ObjectData): ObjectData => structuredClone(value);
const without = (value: ObjectData, keys: string[]): ObjectData => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
/** Explicit collection setters, not caller-supplied JSON pointers. */
export function restoreProject(current: AuthoringDocument, entities: Entity[]): AuthoringDocument {
  const contexts = entities.filter(entity => entity.type === 'project');
  insist(contexts.length === 1, 'DOCS_PROJECT', 'Exactly one project context is required.');
  const context = contexts[0]!, data = context.data;
  insist(context.id === current.project.id && context.project === current.project.id, 'DOCS_PROJECT', 'Document belongs to a different project.');
  const design = data.design === undefined ? clone(object(current.design)) : clone(object(data.design));
  if (data.design !== undefined) {
    for (const [parent, field] of [['', 'nodes'], ['', 'links'], ['', 'library'], ['', 'prds'], ['sitemap', 'routes'], ['sitemap', 'journeys'], ['features', 'items'], ['visualDesigns', 'pages'], ['visualDesigns', 'components'], ['visualDesigns', 'layouts'], ['visualDesigns', 'revisions']]) {
      const host = parent ? design[parent] === undefined ? {} : object(design[parent]) : design;
      insist(host[field!] === undefined || array(host[field!]).length === 0, 'DOCS_CONTEXT_DUPLICATE', 'Project context must not duplicate extracted elements: ' + field);
    }
  }
  const order = data.order === undefined ? {} : object(data.order);
  const identity = data.identity === undefined ? without(object(current.project), ['id', 'name']) : object(data.identity);
  const proposed: unknown = { kind: 'obsidian-companion-project', schemaVersion: 6, executable: false,
    project: { ...identity, id: current.project.id, name: context.title },
    settings: data.settings ?? current.settings, notes: data.notes ?? current.notes, design,
    ...(data.tooling === undefined ? {} : { tooling: data.tooling }) };
  const select = (type: string) => entities.filter(entity => entity.type === type);
  const ordered = (items: ObjectData[], path: string) => {
    const ids = order[path] === undefined ? [] : array(order[path]).map(value => text(value));
    const index = (id: unknown) => { const found = ids.indexOf(String(id)); return found < 0 ? ids.length : found; };
    return items.sort((a, b) => index(a.id) - index(b.id) || (String(a.id) < String(b.id) ? -1 : 1));
  };
  const needVisual = select('component').length || select('page').some(page => page.fields.visual_id || page.data.visual);
  const visual = design.visualDesigns !== undefined ? object(design.visualDesigns) : needVisual ? object(emptyVisualDesigns()) : undefined;
  if (visual) design.visualDesigns = visual;
  const pages: ObjectData[] = [], library: ObjectData[] = [], components: ObjectData[] = [];
  // Defaults are used only for new authoring; existing export carries every original field.
  const defaultDesign = { nodes: [], links: [] };
  design.nodes = ordered(select('page').map(entity => {
    const complete = array(order.nodes ?? []).includes(entity.id);
    const surface = { ...(complete ? {} : object(newSitemapSurface(defaultDesign, entity.title, 'view', null))), ...(entity.data.surface === undefined ? {} : clone(object(entity.data.surface))) };
    // Exported complete surfaces omit no required native defaults; preserve extra/optional fields.
    Object.assign(surface, { id: entity.id, label: entity.title, kind: entity.fields.surface_kind ?? 'view' });
    if (entity.fields.visual_id || entity.data.visual) {
      const raw: ObjectData = { root: [], scenarios: [], notes: '', ...(entity.data.visual === undefined ? {} : clone(object(entity.data.visual))) };
      pages.push({ ...raw, id: text(entity.fields.visual_id, 'visual_id'), ownerId: entity.id, name: raw.name ?? entity.title });
    }
    return surface;
  }), 'nodes');
  for (const entity of select('component')) {
    const libraryId = text(entity.fields.library_id, 'library_id');
    const entry = { ...(entity.data.library === undefined ? {} : clone(object(entity.data.library))), id: libraryId, name: entity.title };
    const previous = library.find(item => item.id === libraryId);
    insist(!previous || equal(previous, entry), 'DOCS_LIBRARY_CONFLICT', 'Multiple components disagree on their shared library entry.');
    if (!previous) library.push(entry);
    components.push({ description: '', props: [], slots: [], emits: [], variants: [], template: [], scenarios: [],
      ...(entity.data.visual === undefined ? {} : clone(object(entity.data.visual))), id: entity.id, libraryId,
      exportName: text(entity.fields.export_name, 'export_name') });
  }
  for (const entity of select('library-component')) library.push({ ...clone(entity.data), id: entity.id, name: entity.title });
  if (design.library !== undefined || library.length) design.library = ordered(library, 'library');
  if (visual) { visual.pages = ordered(pages, 'visualDesigns.pages'); visual.components = ordered(components, 'visualDesigns.components'); }
  design.links = ordered(select('transition').map(entity => ({ ...without(clone(entity.data), ['emptyLabel']), id: entity.id,
    label: entity.data.emptyLabel ? '' : entity.title, from: entity.fields.from, to: entity.fields.to, kind: entity.fields.kind ?? 'navigate' })), 'links');
  const families = [ ['journey', 'sitemap', 'journeys', 'name'], ['route', 'sitemap', 'routes', 'path'],
    ['feature', 'features', 'items', 'name'], ['layout', 'visualDesigns', 'layouts', 'name'],
    ['component-revision', 'visualDesigns', 'revisions', 'version'], ['prd', '', 'prds', 'name'] ];
  for (const [type, parent, field, label] of families) {
    const chosen = select(type!);
    if (!chosen.length && parent && design[parent] === undefined) continue;
    if (parent && design[parent] === undefined) design[parent] = { schema: 1, ...(parent === 'sitemap' ? { routes: [], journeys: [] } : {}) };
    const host = parent ? object(design[parent]) : design;
    if (!chosen.length && host[field!] === undefined) continue;
    host[field!] = ordered(chosen.map(entity => type === 'route' ? { ...clone(entity.data), id: entity.id, surface: entity.fields.surface_id, path: entity.fields.path } :
      { ...without(clone(entity.data), ['emptyLabel']), id: entity.id, ...(type === 'prd' && entity.fields.label_field === 'none' ? {} : { [type === 'prd' ? String(entity.fields.label_field ?? 'title') : label!]: entity.data.emptyLabel ? '' : entity.title }) }), parent ? parent + '.' + field : field!);
  }
  for (const owner of [...pages, ...components]) for (const node of visualNodes(array(owner.root ?? owner.template ?? []) as UiNode[]))
    if ('events' in node) insist(node.events.length === 0, 'DOCS_INLINE_EVENT', 'Editable interactions belong in separate interaction documents, not duplicated inside visual data.');
  for (const entity of select('interaction').sort((a, b) => Number(a.fields.position ?? 0) - Number(b.fields.position ?? 0))) {
    const ownerType = entity.fields.owner_type;
    insist(ownerType === 'page' || ownerType === 'component', 'DOCS_INTERACTION_OWNER', 'Interactions need a page or component owner.');
    const owner = ownerType === 'page' ? pages.find(page => page.ownerId === entity.fields.owner_id) : components.find(component => component.id === entity.fields.owner_id);
    insist(owner, 'DOCS_INTERACTION_OWNER', 'Interaction owner does not exist: ' + String(entity.fields.owner_id));
    const root = array(owner[ownerType === 'page' ? 'root' : 'template']) as UiNode[];
    const source = visualNodes(root).find(node => node.id === entity.fields.source_node_id);
    insist(source && 'events' in source, 'DOCS_INTERACTION_SOURCE', 'Interaction source node is missing or cannot receive events: ' + String(entity.fields.source_node_id));
    const event = { actions: [], notes: '', acceptance: '', ...without(clone(entity.data), ['emptyLabel']),
      id: entity.id, event: text(entity.fields.event), label: entity.data.emptyLabel ? '' : entity.title };
    source.events.push(event as Interaction);
  }
  // Never recycle identities after imports. Preserve higher counters from complete exports.
  if (visual) {
    const ids = [...pages, ...components, ...list(visual.layouts), ...list(visual.revisions)].flatMap(item => [item.id,
      ...visualNodes(array(item.root ?? item.template ?? []) as UiNode[]).flatMap(node => [node.id, ...('events' in node ? node.events.map(event => event.id) : [])])]);
    visual.nextId = Math.max(Number(visual.nextId ?? 1), ...ids.map(id => Number(/^(?:vp|vc|vn|vi|vl|vr)-(\d+)$/.exec(String(id))?.[1] ?? 0) + 1));
  }
  if (design.nextId !== undefined) design.nextId = Math.max(Number(design.nextId), ...list(design.nodes).map(node => Number(/^node-(\d+)$/.exec(String(node.id))?.[1] ?? 0) + 1));
  return validateAuthoringDocument(proposed);
}
