import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { newDocument, openDocument, documentText } from '../../bin/domain/document.ts';
import { slug, title } from '../../bin/domain/errors.ts';
import { runOperations } from '../../bin/application/operations.ts';
import { outline } from '../../bin/application/summary.ts';
import { Workspace } from '../../bin/application/workspace.ts';
import { sketchSchema } from '../../bin/application/schema.ts';
import { projectModel } from '../../scripts/companion/compiler/model.ts';
import { noteEntity } from '../../scripts/companion/compiler/persistence-code.ts';
import { noteOperations } from '../../scripts/companion/runtime/note-operations.ts';
import { visualSources } from '../../scripts/companion/compiler/visual-ports.ts';
import { visualAllocate, visualText } from '../../scripts/companion/visual/visual-ir.mjs';
const base = () => newDocument('My sketch');
function page() { return runOperations(base(), [{ op: 'page.add', title: 'Home', as: 'home' }]); }
test('titles are the only creation fields and identifiers remain stable after renaming', () => {
  const initial = runOperations(base(), [{ op: 'page.add', title: 'Home', as: 'home' }, { op: 'component.add', title: 'Card', as: 'card' },
    { op: 'page.attach', page: '@home', components: [{ id: '@card' }, { title: 'Header' }] }, { op: 'interaction.add', page: '@home', title: 'Open', as: 'open' }]);
  assert.equal(initial.document.design.nodes[0].kind, 'view');
  assert.equal(initial.document.design.visualDesigns.components.length, 2);
  const changed = runOperations(initial.document, [{ op: 'page.rename', id: initial.aliases.home, title: 'Overview' },
    { op: 'component.rename', id: initial.aliases.card, title: 'Renamed card' }, { op: 'interaction.rename', page: initial.aliases.home, id: initial.aliases.open, title: 'Continue' }]);
  assert.equal(changed.document.design.nodes[0].id, initial.aliases.home);
  assert.equal(outline(changed.document).pages[0].title, 'Overview');
  assert.equal(outline(changed.document).components[0].title, 'Renamed card');
  assert.equal(outline(changed.document).pages[0].interactions[0].title, 'Continue');
  assert.equal(openDocument(JSON.parse(documentText(changed.document))).schemaVersion, 6);
});
test('portable deterministic slugs handle collisions, unicode, digits and reserved names', () => {
  for (const word of ['CON', 'nul', '123', '你好', 'constructor']) assert.match(slug(word, 'item'), /^item-/);
  assert.equal(slug('Résumé', 'x', ['resume', 'resume-2']), 'resume-3');
  assert.equal(title('  Page  '), 'Page');
  for (const word of ['', '\n', 'hello\x1bworld', 'x'.repeat(121)]) assert.throws(() => title(word));
  assert.throws(() => openDocument({ schemaVersion: 999 }));
});
test('collections provision exact Markdown CRUD contracts for users and agent transactions', () => {
  const result = runOperations(base(), [
    { op: 'page.add', title: 'Home' },
    { op: 'entity.add', title: 'Task', as: 'task' },
    { op: 'entity.properties', id: '@task', properties: [{ key: 'title', type: 'text', required: true }, { key: 'done', type: 'checkbox', required: false }] },
    { op: 'collection.add', title: 'Tasks', path: 'Records/Tasks', entity: '@task', as: 'tasks' },
  ]);
  const entity = result.document.design.semantic.entities[0], source = result.document.design.dataSources.sources[0];
  assert.equal(source.id, result.aliases.tasks); assert.equal(source.kind, 'collection'); assert.equal(source.entity, result.aliases.task);
  assert.equal(source.collectionPath, 'Records/Tasks'); assert.equal(entity.folder, 'Records/Tasks');
  assert.deepEqual(source.operations.map(operation => operation.slug), ['list', 'create', 'update', 'delete']);
  assert.ok(source.operations.every(operation => operation.resource === 'Records/Tasks' && operation.implementation.kind === 'note'));
  const model = projectModel(result.document), compiled = model.sources[0];
  for (const operation of compiled.operations) assert.equal(noteEntity(model, compiled.id, operation.id)?.id, entity.id);
  const collectionSchema = sketchSchema.properties.operations.items.oneOf.find(item => item.properties.op.const === 'collection.add');
  assert.deepEqual(collectionSchema.required, ['op', 'title', 'path', 'entity']);
  assert.throws(() => runOperations(result.document, [{ op: 'collection.add', title: 'Bad', path: '../Secrets', entity: entity.id }]));
  assert.throws(() => runOperations(result.document, [{ op: 'collection.add', title: 'Missing', path: 'Records/Missing', entity: 'missing' }]));
});

test('collection leases distinguish multiple Markdown records at the same revision', async () => {
  const records = new Map([['a', { id: 'a', revision: 1, values: { title: 'Alpha' } }], ['b', { id: 'b', revision: 1, values: { title: 'Beta' } }]]);
  const updated = [], deleted = [];
  const repository = {
    list: async () => ({ ok: true, value: [...records.values()] }),
    create: async () => { throw new Error('not used'); },
    update: async (snapshot, values) => { updated.push(snapshot.id); const next = { id: snapshot.id, revision: snapshot.revision + 1, values }; records.set(snapshot.id, next); return { ok: true, value: next }; },
    delete: async snapshot => { deleted.push(snapshot.id); records.delete(snapshot.id); return { ok: true, value: undefined }; },
  };
  const operations = noteOperations(repository, 'task', value => value);
  const [first, second] = await operations.list();
  assert.deepEqual([first.revision, second.revision], [1, 1]);
  const changed = await operations.update({ id: first.record.id, revision: first.revision, values: { title: 'Changed' } });
  assert.equal(changed.record.title, 'Changed');
  await operations.delete({ id: second.record.id, revision: second.revision });
  assert.deepEqual(updated, ['a']); assert.deepEqual(deleted, ['b']);
  await assert.rejects(operations.update({ id: first.record.id, revision: first.revision, values: { title: 'Stale' } }), /NOTE_REVISION_STALE/);
  assert.deepEqual([...records.keys()], ['a']);
});
test('shell wires a Collection table, explicit read binding and create interaction to the visual compiler', () => {
  const initial = runOperations(base(), [
    { op: 'page.add', title: 'Tasks', as: 'tasksPage' },
    { op: 'entity.add', title: 'Task', as: 'task' },
    { op: 'entity.properties', id: '@task', properties: [{ key: 'title', type: 'text', required: true }] },
    { op: 'collection.add', title: 'Tasks data', path: 'Records/Tasks', entity: '@task', as: 'tasks' },
    { op: 'page.collection-table', page: '@tasksPage', source: '@tasks', title: 'Task records', as: 'table' },
    { op: 'page.bind', page: '@tasksPage', node: '@table', prop: 'data', source: '@tasks', operation: 'list', field: '' },
    { op: 'interaction.add', page: '@tasksPage', title: 'Create task', as: 'create' },
    { op: 'interaction.action', page: '@tasksPage', id: '@create', action: { kind: 'source', source: '@tasks', operation: 'create',
      input: { kind: 'value', value: { values: { title: 'Example' }, requestId: 'create-task-1' } } } },
  ]);
  const page = initial.document.design.visualDesigns.pages.find(item => item.ownerId === initial.aliases.tasksPage);
  const table = page.root.find(item => item.id === initial.aliases.table);
  assert.equal(table.ref.entryId, 'u-table'); assert.equal(table.props.data.kind, 'source');
  const model = projectModel(initial.document), uses = visualSources(model);
  assert.deepEqual(uses.map(item => item.operation.slug).sort(), ['create', 'list']);
  const schema = sketchSchema.properties.operations.items.oneOf;
  assert.ok(schema.some(item => item.properties.op.const === 'page.collection-table'));
  assert.ok(schema.some(item => item.properties.op.const === 'page.bind'));
  assert.throws(() => runOperations(initial.document, [{ op: 'page.bind', page: initial.aliases.tasksPage,
    node: initial.aliases.table, prop: 'data', source: initial.aliases.tasks, operation: 'delete', field: '' }]));
});
test('source bindings validate the field path and the declared or portable prop for each node kind', () => {
  const initial = runOperations(base(), [
    { op: 'page.add', title: 'Tasks', as: 'tasksPage' }, { op: 'entity.add', title: 'Task', as: 'task' },
    { op: 'entity.properties', id: '@task', properties: [{ key: 'title', type: 'text', required: true }] },
    { op: 'collection.add', title: 'Tasks data', path: 'Records/Tasks', entity: '@task', as: 'tasks' },
    { op: 'page.collection-table', page: '@tasksPage', source: '@tasks', title: 'Task records', as: 'table' },
    { op: 'component.add', title: 'Card', as: 'card' }, { op: 'page.attach', page: '@tasksPage', components: [{ id: '@card' }] },
  ]);
  const document = structuredClone(initial.document), { tasksPage, table, tasks } = initial.aliases;
  const page = document.design.visualDesigns.pages.find(item => item.ownerId === tasksPage);
  const card = page.root.find(item => item.kind === 'component' && item.ref.kind !== 'nuxt-ui');
  const store = document.design.visualDesigns, adapter = visualAllocate(store, 'vn'), heading = visualAllocate(store, 'vn');
  page.root.push({ id: adapter, kind: 'external', package: 'example', adapter: 'chart', props: {}, events: [] }, visualText(heading, 'Heading'));
  const coded = code => error => error.code === code;
  const bind = (node, prop, field = '') => runOperations(document, [{ op: 'page.bind', page: tasksPage, node, prop, source: tasks, operation: 'list', field }]);
  assert.throws(() => bind(table, 'data', 'items..title'), coded('SOURCE_BIND_FIELD'));
  assert.throws(() => bind(table, 'notAProp'), coded('SOURCE_BIND_PROP'));
  assert.throws(() => bind(card.id, 'undeclared'), coded('SOURCE_BIND_PROP'));
  assert.throws(() => bind(adapter, 'Bad-Prop'), coded('SOURCE_BIND_PROP'));
  assert.throws(() => bind(heading, 'data'), coded('SOURCE_BIND_PROP'));
  // A portable external prop passes binding validation; the page gate still keeps adapters in component templates.
  assert.throws(() => bind(adapter, 'series', 'items'), /external libraries belong in component templates/);
  page.root.splice(page.root.findIndex(item => item.id === adapter), 1);
  const text = bind(heading, '@value').document.design.visualDesigns.pages.find(item => item.ownerId === tasksPage).root.find(item => item.id === heading);
  assert.equal(text.value.kind, 'source');
});
test('bulk reuse creates distinct instances without duplicating definitions', () => {
  const start = page();
  const created = runOperations(start.document, [{ op: 'component.add', title: 'Card', as: 'card' },
    { op: 'page.attach', page: start.aliases.home, components: [{ id: '@card' }, { id: '@card' }, { title: 'Card' }] }]);
  const model = outline(created.document);
  assert.equal(model.components.length, 2); assert.equal(model.pages[0].nodes.length, 3);
  assert.equal(new Set(model.pages[0].nodes.map(node => node.id)).size, 3);
  assert.notEqual(model.components[0].exportName, model.components[1].exportName);
});
test('layout, order, instance removal, navigation and preview states use the shared visual IR', () => {
  const start = page(), home = start.aliases.home;
  let result = runOperations(start.document, [{ op: 'page.layout', id: home, layout: 'grid' },
    { op: 'page.attach', page: home, components: [{ title: 'One' }, { title: 'Two' }] }, { op: 'page.add', title: 'Details', as: 'details' },
    { op: 'interaction.add', page: home, title: 'Open', as: 'open' }, { op: 'interaction.action', page: home, id: '@open', action: { kind: 'navigate', target: '@details' } }]);
  let nodes = outline(result.document).pages[0].nodes;
  result = runOperations(result.document, [{ op: 'page.move', page: home, id: nodes[2].id, direction: 'up' },
    { op: 'interaction.action', page: home, id: result.aliases.open, action: { kind: 'set-state', state: 'loading' } }]);
  nodes = outline(result.document).pages[0].nodes;
  assert.equal(nodes[1].title, 'Two');
  const interaction = outline(result.document).pages[0].interactions[0].id;
  result = runOperations(result.document, [{ op: 'interaction.action', page: home, id: interaction, action: { kind: 'todo' } },
    { op: 'interaction.remove', page: home, id: interaction }, { op: 'page.remove', page: home, id: nodes[1].id }, { op: 'page.layout', id: home, layout: 'row' }]);
  assert.equal(outline(result.document).pages[0].interactions.length, 0);
  assert.equal(result.document.design.visualDesigns.components.length, 2);
  assert.equal(result.document.design.nodes[0].components.length, 1);
});
test('failed batches are atomic and reject unknown operations, unsafe fields and references', () => {
  const document = base(), before = documentText(document);
  const invalid = [
    { op: 'page.add', title: '' }, { op: 'constructor' }, { op: 'missing' }, { op: 'page.add', title: 'Hi', unexpected: true },
    { op: 'page.rename', id: '@missing', title: 'No' }, { op: 'page.rename', id: 'missing', title: 'No' },
    { op: 'page.layout', id: 'missing', layout: 'flex' }, { op: 'page.move', page: 'missing', id: 'x', direction: 'left' },
    { op: 'component.rename', id: 'missing', title: 'No' }, { op: 'page.add', title: 'Bad alias', as: '__proto__' },
  ];
  for (const operation of invalid) {
    assert.throws(() => runOperations(document, [{ op: 'page.add', title: 'Must roll back' }, operation]));
    assert.equal(documentText(document), before);
  }
  assert.throws(() => runOperations(document, [{ op: 'page.add', title: 'A', as: 'a' }, { op: 'page.add', title: 'B', as: 'a' }]));
  assert.throws(() => runOperations(document, null));
  assert.throws(() => runOperations(document, Array.from({ length: 501 }, () => ({ op: 'page.add', title: 'A' }))));
});
test('mutation guard negatives preserve an existing page', () => {
  const start = page(), document = start.document, home = start.aliases.home, before = documentText(document);
  const invalid = [
    { op: 'page.attach', page: home, components: [] }, { op: 'page.attach', page: home, components: [{ id: 'missing' }] },
    { op: 'page.attach', page: home, components: [{ id: 'x', title: 'x' }] }, { op: 'page.attach', page: home, components: [{ nope: 'x' }] },
    { op: 'interaction.add', page: home, title: 'Broken', source: 'missing' }, { op: 'interaction.rename', page: home, id: 'missing', title: 'A' },
    { op: 'interaction.remove', page: home, id: 'missing' }, { op: 'page.remove', page: home, id: 'missing' },
    { op: 'page.move', page: home, id: 'missing', direction: 'up' }, { op: 'interaction.action', page: home, id: 'missing', action: { kind: 'eval' } },
    { op: 'interaction.action', page: home, id: 'missing', action: { kind: 'set-state', state: 'broken' } },
  ];
  for (const operation of invalid) { assert.throws(() => runOperations(document, [operation])); assert.equal(documentText(document), before); }
});
test('history is bounded, redo is invalidated and failed edits never enter history', () => {
  const workspace = new Workspace(base(), null);
  assert.equal(workspace.dirty, true); assert.equal(workspace.undo(), false); assert.equal(workspace.redo(), false);
  workspace.saved('abc'); assert.equal(workspace.dirty, false);
  workspace.edit([{ op: 'page.add', title: 'A' }]); assert.equal(workspace.dirty, true);
  assert.equal(workspace.undo(), true); assert.equal(workspace.dirty, false); assert.equal(workspace.redo(), true);
  workspace.undo(); workspace.edit([{ op: 'page.add', title: 'B' }]); assert.equal(workspace.redo(), false);
  assert.throws(() => workspace.edit([{ op: 'bad' }]));
  for (let i = 0; i < 52; i++) workspace.edit([]);
  for (let i = 0; i < 50; i++) assert.equal(workspace.undo(), true);
  assert.equal(workspace.undo(), false);
  assert.equal(sketchSchema.properties.operations.items.oneOf.length, 24);
});

test('nested removal retires only unused component references and preserves library definitions', () => {
  const result = runOperations(base(), [
    { op: 'page.add', title: 'Home', as: 'home' },
    { op: 'page.layout', id: '@home', layout: 'grid' },
    { op: 'page.attach', page: '@home', components: [{ title: 'Card' }, { title: 'Toolbar' }] },
  ]);
  const home = result.aliases.home, layout = outline(result.document).pages[0].nodes[0];
  const next = runOperations(result.document, [{ op: 'page.remove', page: home, id: layout.id }]);
  assert.deepEqual(next.document.design.nodes[0].components, []);
  assert.equal(next.document.design.visualDesigns.components.length, 2);
  assert.equal(outline(next.document).pages[0].nodes.length, 0);
});
test('imported required props receive typed defaults and preview actions reject irrelevant keys', () => {
  const result = runOperations(base(), [{ op: 'page.add', title: 'Home', as: 'home' }, { op: 'component.add', title: 'Control', as: 'control' }]);
  result.document.design.visualDesigns.components[0].props = [
    { name: 'enabled', type: 'boolean', required: true }, { name: 'amount', type: 'number', required: true },
    { name: 'label', type: 'string', required: true }, { name: 'preset', type: 'string', required: true, default: 'Original' },
  ];
  const edited = runOperations(result.document, [
    { op: 'page.attach', page: result.aliases.home, components: [{ id: result.aliases.control }] },
    { op: 'interaction.add', page: result.aliases.home, title: 'Action', as: 'action' },
  ]);
  const node = edited.document.design.visualDesigns.pages[0].root[0];
  assert.deepEqual(Object.fromEntries(Object.entries(node.props).map(([k,v]) => [k,v.value])), { enabled: false, amount: 0, label: '', preset: 'Original' });
  for (const action of [{ kind: 'todo', target: result.aliases.home }, { kind: 'set-state', state: 'empty', target: result.aliases.home }, { kind: 'navigate', target: result.aliases.home, state: 'empty' }]) {
    assert.throws(() => runOperations(edited.document, [{ op: 'interaction.action', page: result.aliases.home, id: edited.aliases.action, action }]));
  }
});
