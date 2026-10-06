import { entityAdd, entityProperties, sourceAdd, collectionAdd, brickRename, routeSet, pageParent, journeyAdd, groupAdd, navigationAdd } from '../domain/bricks.ts';
import { editDocument, type SketchDocument } from '../domain/document.ts';
import { addPage, renamePage, moveNode, setPageLayout } from '../domain/pages.ts';
import { addComponent, attachComponents, renameComponent, removeNode, pageCollectionTable, pageBindSource, type ComponentChoice } from '../domain/components.ts';
import { addInteraction, renameInteraction, removeInteraction, setInteractionAction, setSourceInteractionAction } from '../domain/interactions.ts';
import { requireSketch } from '../domain/errors.ts';
import { object, keys, text, list } from '../domain/data.ts';

/** Aliases are scoped to a transaction, never persisted as a second identity system. */
interface Transaction { document: SketchDocument; aliases: Record<string, string>; created: string[] }
type Operation = Record<string, unknown>;
type Handler = { fields: readonly string[]; run: (state: Transaction, operation: Operation) => string | void };
function ref(state: Transaction, value: unknown): string {
  const id = text(value, 'reference');
  if (!id.startsWith('@')) return id;
  const resolved = state.aliases[id.slice(1)];
  requireSketch(resolved, 'MAKER_REFERENCE', `Unknown transaction reference ${id}.`);
  return resolved;
}
function selection(state: Transaction, value: unknown): ComponentChoice {
  const item = object(value); keys(item, ['title', 'id']);
  requireSketch(Boolean(item.title) !== Boolean(item.id), 'MAKER_COMPONENT_CHOICE', 'Use either title for a new component or id for an existing one.');
  return item.title ? { kind: 'new', title: text(item.title, 'title') } : { kind: 'existing', id: ref(state, item.id) };
}
function attach(state: Transaction, op: Operation): void {
  const ids = attachComponents(state.document, ref(state, op.page), list(op.components, 'components').map(item => selection(state, item)));
  state.created.push(...ids);
}
function action(state: Transaction, op: Operation): void {
  const value = object(op.action); keys(value, ['kind', 'target', 'state', 'source', 'operation', 'input']);
  const page = ref(state, op.page), id = ref(state, op.id);
  if (value.kind === 'source') { keys(value, ['kind', 'source', 'operation', 'input']);
    setSourceInteractionAction(state.document, page, id, ref(state, value.source), text(value.operation, 'operation'), value.input); return; }
  if (value.kind === 'todo') { keys(value, ['kind']); setInteractionAction(state.document, page, id, null); return; }
  if (value.kind === 'navigate') { keys(value, ['kind', 'target']); setInteractionAction(state.document, page, id, { kind: 'navigate', surfaceId: ref(state, value.target) }); return; }
  if (value.kind === 'set-state') {
    keys(value, ['kind', 'state']);
    requireSketch(value.state === 'default' || value.state === 'loading' || value.state === 'empty' || value.state === 'error' || value.state === 'disabled', 'MAKER_STATE', 'Choose a supported preview state.');
    setInteractionAction(state.document, page, id, { kind: 'set-state', state: value.state }); return;
  }
  requireSketch(false, 'MAKER_ACTION', 'Use todo, navigate, set-state or a declared source call. No executable expressions are accepted.');
}
const handlers: Record<string, Handler> = {
  'entity.add': { fields: ['title'], run: (s, o) => entityAdd(s.document, o.title) },
  'entity.properties': { fields: ['id', 'properties'], run: (s, o) => entityProperties(s.document, ref(s, o.id), o.properties) },
  'data-source.add': { fields: ['title', 'kind'], run: (s, o) => sourceAdd(s.document, o.title, o.kind) },
  'collection.add': { fields: ['title', 'path', 'entity'], run: (s, o) => collectionAdd(s.document, o.title, o.path, ref(s, o.entity)) },
  'brick.rename': { fields: ['kind', 'id', 'title'], run: (s, o) => brickRename(s.document, o.kind, ref(s, o.id), o.title) },
  'sitemap.route': { fields: ['page', 'path'], run: (s, o) => routeSet(s.document, ref(s, o.page), o.path) },
  'sitemap.parent': { fields: ['page', 'parent'], run: (s, o) => pageParent(s.document, ref(s, o.page), o.parent === null ? null : ref(s, o.parent)) },
  'sitemap.group': { fields: ['title'], run: (s, o) => groupAdd(s.document, o.title) },
  'sitemap.link': { fields: ['from', 'to', 'title'], run: (s, o) => navigationAdd(s.document, ref(s, o.from), ref(s, o.to), o.title) },
  'journey.add': { fields: ['title', 'pages'], run: (s, o) => journeyAdd(s.document, o.title, list(o.pages, 'pages', 120).map(id => ref(s, id))) },
  'page.add': { fields: ['title'], run: (s, o) => addPage(s.document, text(o.title, 'title')) },
  'page.rename': { fields: ['id', 'title'], run: (s, o) => renamePage(s.document, ref(s, o.id), text(o.title, 'title')) },
  'page.layout': { fields: ['id', 'layout'], run(s, o) {
    requireSketch(o.layout === 'stack' || o.layout === 'row' || o.layout === 'grid', 'MAKER_LAYOUT', 'Choose stack, row or grid.');
    setPageLayout(s.document, ref(s, o.id), o.layout);
  } },
  'component.add': { fields: ['title'], run: (s, o) => addComponent(s.document, text(o.title, 'title')) },
  'component.rename': { fields: ['id', 'title'], run: (s, o) => renameComponent(s.document, ref(s, o.id), text(o.title, 'title')) },
  'page.attach': { fields: ['page', 'components'], run: attach },
  'page.collection-table': { fields: ['page', 'source', 'title'], run: (s, o) => pageCollectionTable(s.document, ref(s, o.page), ref(s, o.source), text(o.title, 'table title', 80)) },
  'page.bind': { fields: ['page', 'node', 'prop', 'source', 'operation', 'field'], run(s, o) {
    requireSketch(typeof o.field === 'string', 'MAKER_FIELD', 'field must be an output path or the empty string.');
    pageBindSource(s.document, ref(s, o.page), ref(s, o.node), text(o.prop, 'prop', 60), ref(s, o.source), text(o.operation, 'operation'), o.field);
  } },
  'page.remove': { fields: ['page', 'id'], run: (s, o) => removeNode(s.document, ref(s, o.page), ref(s, o.id)) },
  'page.move': { fields: ['page', 'id', 'direction'], run(s, o) {
    requireSketch(o.direction === 'up' || o.direction === 'down', 'MAKER_DIRECTION', 'Choose up or down.');
    moveNode(s.document, ref(s, o.page), ref(s, o.id), o.direction === 'up' ? -1 : 1);
  } },
  'interaction.add': { fields: ['page', 'title', 'source'], run: (s, o) => addInteraction(s.document, ref(s, o.page), text(o.title, 'title'), o.source === undefined ? undefined : ref(s, o.source)) },
  'interaction.rename': { fields: ['page', 'id', 'title'], run: (s, o) => renameInteraction(s.document, ref(s, o.page), ref(s, o.id), text(o.title, 'title')) },
  'interaction.remove': { fields: ['page', 'id'], run: (s, o) => removeInteraction(s.document, ref(s, o.page), ref(s, o.id)) },
  'interaction.action': { fields: ['page', 'id', 'action'], run: action },
};
export const operationCatalog = Object.entries(handlers).map(([op, handler]) => ({ op, fields: handler.fields }));
export function runOperations(document: SketchDocument, operations: unknown): { document: SketchDocument; aliases: Record<string, string>; created: string[] } {
  const state: Transaction = { document, aliases: Object.create(null), created: [] };
  const candidate = editDocument(document, draft => {
    state.document = draft;
    for (const input of list(operations, 'operations', 500)) {
      const op = object(input), name = text(op.op, 'op'), handler = handlers[name];
      requireSketch(Object.hasOwn(handlers, name) && handler, 'MAKER_OPERATION', `Unknown operation ${name}. Use sketch schema.`);
      keys(op, ['op', 'as', ...handler.fields]);
      const id = handler.run(state, op);
      if (id) state.created.push(id);
      if (op.as !== undefined) {
        const alias = text(op.as, 'as');
        requireSketch(id && /^[a-z][a-z0-9-]*$/i.test(alias) && !Object.hasOwn(state.aliases, alias), 'MAKER_ALIAS', 'Aliases must be unique, portable names on creation operations.');
        state.aliases[alias] = id;
      }
    }
  });
  return { document: candidate, aliases: state.aliases, created: state.created };
}
