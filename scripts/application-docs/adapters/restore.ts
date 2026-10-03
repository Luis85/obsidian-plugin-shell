import { validateAuthoringDocument, type AuthoringDocument } from '../../companion/authoring-contract.ts';
import { newSitemapSurface } from '../../companion/sitemap/create.ts';
import { emptyVisualDesigns, visualNodes, type UiNode, type Interaction } from '../../companion/visual/visual-ir.mjs';
import { docsObject as object, array, insist, text, equal, type Entity, type ObjectData } from '../domain/contracts.ts';
const list = (value: unknown): ObjectData[] => value === undefined ? [] : array(value).map(object);
const clone = (value: ObjectData): ObjectData => structuredClone(value);
const without = (value: ObjectData, keys: string[]): ObjectData => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const EXTRACTED: ReadonlyArray<readonly [string, string]> = [['', 'nodes'], ['', 'links'], ['', 'library'], ['', 'prds'], ['sitemap', 'routes'], ['sitemap', 'journeys'],
  ['features', 'items'], ['visualDesigns', 'pages'], ['visualDesigns', 'components'], ['visualDesigns', 'layouts'], ['visualDesigns', 'revisions']];
const FAMILIES: ReadonlyArray<readonly [string, string, string, string]> = [ ['journey', 'sitemap', 'journeys', 'name'], ['route', 'sitemap', 'routes', 'path'],
  ['feature', 'features', 'items', 'name'], ['layout', 'visualDesigns', 'layouts', 'name'],
  ['component-revision', 'visualDesigns', 'revisions', 'version'], ['prd', '', 'prds', 'name'] ];
interface Restore { entities: Entity[]; design: ObjectData; order: ObjectData; pages: ObjectData[]; library: ObjectData[]; components: ObjectData[] }
const select = (restore: Restore, type: string): Entity[] => restore.entities.filter(entity => entity.type === type);
const optional = (value: unknown): ObjectData => value === undefined ? {} : clone(object(value));
const titleOf = (entity: Entity): string => entity.data.emptyLabel ? '' : entity.title;
const editable = (entity: Entity): ObjectData => without(clone(entity.data), ['emptyLabel']);
function ordered(restore: Restore, items: ObjectData[], path: string): ObjectData[] {
  const ids = restore.order[path] === undefined ? [] : array(restore.order[path]).map(value => text(value));
  const index = (id: unknown) => { const found = ids.indexOf(String(id)); return found < 0 ? ids.length : found; };
  return items.sort((a, b) => index(a.id) - index(b.id) || (String(a.id) < String(b.id) ? -1 : 1));
}
function projectContext(current: AuthoringDocument, entities: Entity[]): Entity {
  const contexts = entities.filter(entity => entity.type === 'project');
  insist(contexts.length === 1, 'DOCS_PROJECT', 'Exactly one project context is required.');
  const context = contexts[0]!;
  insist(context.id === current.project.id && context.project === current.project.id, 'DOCS_PROJECT', 'Document belongs to a different project.');
  return context;
}
function contextDesign(current: AuthoringDocument, data: ObjectData): ObjectData {
  if (data.design === undefined) return clone(object(current.design));
  const design = clone(object(data.design));
  for (const [parent, field] of EXTRACTED) {
    const host = parent ? design[parent] === undefined ? {} : object(design[parent]) : design;
    insist(host[field] === undefined || array(host[field]).length === 0, 'DOCS_CONTEXT_DUPLICATE', 'Project context must not duplicate extracted elements: ' + field);
  }
  return design;
}
function visualDesigns(restore: Restore): ObjectData | undefined {
  const { design } = restore;
  if (design.visualDesigns !== undefined) return object(design.visualDesigns);
  const needVisual = select(restore, 'component').length || select(restore, 'page').some(page => page.fields.visual_id || page.data.visual);
  return needVisual ? object(emptyVisualDesigns()) : undefined;
}
// Defaults are used only for new authoring; existing export carries every original field.
function restorePage(restore: Restore, entity: Entity): ObjectData {
  const complete = array(restore.order.nodes ?? []).includes(entity.id);
  const surface = { ...(complete ? {} : object(newSitemapSurface({ nodes: [], links: [] }, entity.title, 'view', null))), ...optional(entity.data.surface) };
  // Exported complete surfaces omit no required native defaults; preserve extra/optional fields.
  Object.assign(surface, { id: entity.id, label: entity.title, kind: entity.fields.surface_kind ?? 'view' });
  if (entity.fields.visual_id || entity.data.visual) {
    const raw: ObjectData = { root: [], scenarios: [], notes: '', ...optional(entity.data.visual) };
    restore.pages.push({ ...raw, id: text(entity.fields.visual_id, 'visual_id'), ownerId: entity.id, name: raw.name ?? entity.title });
  }
  return surface;
}
function restoreComponent(restore: Restore, entity: Entity): void {
  const libraryId = text(entity.fields.library_id, 'library_id');
  const entry = { ...optional(entity.data.library), id: libraryId, name: entity.title };
  const previous = restore.library.find(item => item.id === libraryId);
  insist(!previous || equal(previous, entry), 'DOCS_LIBRARY_CONFLICT', 'Multiple components disagree on their shared library entry.');
  if (!previous) restore.library.push(entry);
  restore.components.push({ description: '', props: [], slots: [], emits: [], variants: [], template: [], scenarios: [],
    ...optional(entity.data.visual), id: entity.id, libraryId, exportName: text(entity.fields.export_name, 'export_name') });
}
function familyItem(entity: Entity, type: string, label: string): ObjectData {
  if (type === 'route') return { ...clone(entity.data), id: entity.id, surface: entity.fields.surface_id, path: entity.fields.path };
  const labelKey = type === 'prd' ? entity.fields.label_field === 'none' ? null : String(entity.fields.label_field ?? 'title') : label;
  return { ...editable(entity), id: entity.id, ...(labelKey === null ? {} : { [labelKey]: titleOf(entity) }) };
}
function familyHost(design: ObjectData, parent: string, chosen: Entity[]): ObjectData | null {
  if (!parent) return design;
  if (design[parent] === undefined) {
    if (!chosen.length) return null;
    design[parent] = { schema: 1, ...(parent === 'sitemap' ? { routes: [], journeys: [] } : {}) };
  }
  return object(design[parent]);
}
function restoreFamily(restore: Restore, [type, parent, field, label]: readonly [string, string, string, string]): void {
  const chosen = select(restore, type), host = familyHost(restore.design, parent, chosen);
  if (!host || !chosen.length && host[field] === undefined) return;
  host[field] = ordered(restore, chosen.map(entity => familyItem(entity, type, label)), parent ? parent + '.' + field : field);
}
const ownedRoot = (owner: ObjectData): UiNode[] => array(owner.root ?? owner.template ?? []) as UiNode[];
function rejectInlineEvents(restore: Restore): void {
  for (const owner of [...restore.pages, ...restore.components]) for (const node of visualNodes(ownedRoot(owner)))
    if ('events' in node) insist(node.events.length === 0, 'DOCS_INLINE_EVENT', 'Editable interactions belong in separate interaction documents, not duplicated inside visual data.');
}
function interactionOwner(restore: Restore, entity: Entity): { owner: ObjectData; key: 'root' | 'template' } {
  const ownerType = entity.fields.owner_type;
  insist(ownerType === 'page' || ownerType === 'component', 'DOCS_INTERACTION_OWNER', 'Interactions need a page or component owner.');
  const owner = ownerType === 'page' ? restore.pages.find(page => page.ownerId === entity.fields.owner_id) : restore.components.find(component => component.id === entity.fields.owner_id);
  insist(owner, 'DOCS_INTERACTION_OWNER', 'Interaction owner does not exist: ' + String(entity.fields.owner_id));
  return { owner, key: ownerType === 'page' ? 'root' : 'template' };
}
function attachInteraction(restore: Restore, entity: Entity): void {
  const { owner, key } = interactionOwner(restore, entity);
  const source = visualNodes(array(owner[key]) as UiNode[]).find(node => node.id === entity.fields.source_node_id);
  insist(source && 'events' in source, 'DOCS_INTERACTION_SOURCE', 'Interaction source node is missing or cannot receive events: ' + String(entity.fields.source_node_id));
  const event = { actions: [], notes: '', acceptance: '', ...editable(entity), id: entity.id, event: text(entity.fields.event), label: titleOf(entity) };
  source.events.push(event as Interaction);
}
const counter = (pattern: RegExp, id: unknown): number => Number(pattern.exec(String(id))?.[1] ?? 0) + 1;
// Never recycle identities after imports. Preserve higher counters from complete exports.
function bumpVisualCounter(restore: Restore, visual: ObjectData): void {
  const ids = [...restore.pages, ...restore.components, ...list(visual.layouts), ...list(visual.revisions)].flatMap(item => [item.id,
    ...visualNodes(ownedRoot(item)).flatMap(node => [node.id, ...('events' in node ? node.events.map(event => event.id) : [])])]);
  visual.nextId = Math.max(Number(visual.nextId ?? 1), ...ids.map(id => counter(/^(?:vp|vc|vn|vi|vl|vr)-(\d+)$/, id)));
}
function proposedDocument(current: AuthoringDocument, context: Entity, design: ObjectData): unknown {
  const data = context.data;
  const identity = data.identity === undefined ? without(object(current.project), ['id', 'name']) : object(data.identity);
  return { kind: 'obsidian-companion-project', schemaVersion: 6, executable: false,
    project: { ...identity, id: current.project.id, name: context.title },
    settings: data.settings ?? current.settings, notes: data.notes ?? current.notes, design,
    ...(data.tooling === undefined ? {} : { tooling: data.tooling }) };
}
function restoreSurfaces(restore: Restore, visual: ObjectData | undefined): void {
  const { design } = restore;
  design.nodes = ordered(restore, select(restore, 'page').map(entity => restorePage(restore, entity)), 'nodes');
  for (const entity of select(restore, 'component')) restoreComponent(restore, entity);
  for (const entity of select(restore, 'library-component')) restore.library.push({ ...clone(entity.data), id: entity.id, name: entity.title });
  if (design.library !== undefined || restore.library.length) design.library = ordered(restore, restore.library, 'library');
  if (visual) { visual.pages = ordered(restore, restore.pages, 'visualDesigns.pages'); visual.components = ordered(restore, restore.components, 'visualDesigns.components'); }
  design.links = ordered(restore, select(restore, 'transition').map(entity => ({ ...editable(entity), id: entity.id,
    label: titleOf(entity), from: entity.fields.from, to: entity.fields.to, kind: entity.fields.kind ?? 'navigate' })), 'links');
}
const position = (entity: Entity): number => Number(entity.fields.position ?? 0);
/** Explicit collection setters, not caller-supplied JSON pointers. */
export function restoreProject(current: AuthoringDocument, entities: Entity[]): AuthoringDocument {
  const context = projectContext(current, entities), design = contextDesign(current, context.data);
  const proposed = proposedDocument(current, context, design);
  const restore: Restore = { entities, design, order: context.data.order === undefined ? {} : object(context.data.order), pages: [], library: [], components: [] };
  const visual = visualDesigns(restore);
  if (visual) design.visualDesigns = visual;
  restoreSurfaces(restore, visual);
  for (const family of FAMILIES) restoreFamily(restore, family);
  rejectInlineEvents(restore);
  for (const entity of select(restore, 'interaction').sort((a, b) => position(a) - position(b))) attachInteraction(restore, entity);
  if (visual) bumpVisualCounter(restore, visual);
  if (design.nextId !== undefined) design.nextId = Math.max(Number(design.nextId), ...list(design.nodes).map(node => counter(/^node-(\d+)$/, node.id)));
  return validateAuthoringDocument(proposed);
}
