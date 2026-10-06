const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { persistenceCode, noteEntity } from '../../src/cli/compiler/emitters/persistence-code.ts';
import { relationshipCode } from '../../src/cli/compiler/emitters/relationship-code.ts';
import { relationshipDefinitions, relationshipScope } from '../../src/cli/compiler/emitters/relationship-model.ts';
import { httpCode } from '../../src/cli/compiler/emitters/http-code.ts';
import { fixtureNoteTests } from '../../src/cli/compiler/emitters/fixture-notes-code.ts';
import { nativeCode } from '../../src/cli/compiler/emitters/native-code.ts';
import { dataDocument, model, recorder, template } from './compiler-emitters-fixture.mjs';
import { starterDocument } from '../support/starter-documents.mjs';

// Native persistence, relationship integrity, HTTPS providers, fixture-note and native-integration emission.
const withFeatures = text => ({ ...template, text: path => path === 'src/bootstrap/features.ts' ? text : template.text(path) });
const registry = body => `import x from 'y';\nexport function createFeatures(services) {\n  return createNoteFeatures(services, ${body}));\n}\n`;
// The live src/bootstrap/features.ts is consumer-owned: renaming, `make feature` and example removal rewrite it,
// so every check reads this pinned registry instead of the checkout's current one.
const pinnedRegistry = withFeatures(registry('register => ({\n    items: register(itemFeature),\n  }'));
const persist = async (m, snapshot = pinnedRegistry) => { const out = recorder(); await persistenceCode(snapshot, m, out.add); return out; };

test('native repositories get typed documents, a persistence test and one registry entry each', async () => {
  const out = await persist(model(await dataDocument([['estimate', 'number'], ['done', 'checkbox', true], ['labels', 'tags']])));
  assert.deepEqual([...out.files.keys()], ['src/generated/application/documents/starter-task.ts', 'tests/project/persistence/starter-task.test.ts',
    'src/generated/application/documents/starter-project.ts', 'tests/project/persistence/starter-project.test.ts', 'src/bootstrap/features.ts',
    'tests/project/persistence/registry.test.ts', 'src/generated/application/note-operations.ts']);
  const task = out.text('src/generated/application/documents/starter-task.ts').split('\n');
  assert.equal(task[0], 'import { defineEntity, fields } from "../../../domain/entity.ts";');
  assert.deepEqual(task.slice(11, 17), [
    'function isF3(value: unknown): value is number { return matches(value,{"type":"number"}); }',
    "const f3 = {required:true as const,kind:\"number\" as const,read(value:unknown) { return isF3(value) ? success(value) : failure('validation','error.entity'); }};",
    'function isF4(value: unknown): value is boolean { return matches(value,{"type":"boolean"}); }',
    "const f4 = {required:true as const,kind:\"boolean\" as const,read(value:unknown) { return isF4(value) ? success(value) : failure('validation','error.entity'); }};",
    'function isF5(value: unknown): value is Array<string> { return matches(value,{"type":"array","items":{"type":"string"}}); }',
    "const f5 = {required:true as const,kind:\"list\" as const,read(value:unknown) { return isF5(value) ? success(Object.freeze([...value])) : failure('validation','error.entity'); }};"]);
  assert.deepEqual(task.slice(21, 28), ['export const entity = defineEntity("starter-task",1,{"title": f0,', '"status": fields.optional(f1),', '"due_date": fields.optional(f2),',
    '"estimate": fields.optional(f3),', '"done": f4,', '"labels": fields.optional(f5),', '"project_ref": fields.optional(f6),']);
  assert.equal(task.at(-2), 'export const feature = defineNoteFeature({document,defaultFolder:"Starter/Task"});');
  assert.equal(out.text('src/generated/application/documents/starter-project.ts').split('\n')[0], 'import { defineEntity, fields } from "../../../domain/entity.ts";');
  assert.equal(out.text('src/bootstrap/features.ts'), 'import { feature as GStarterTask } from "../generated/application/documents/starter-task.ts";\n'
    + 'import { feature as GStarterProject } from "../generated/application/documents/starter-project.ts";\n'
    + registry('register => ({\n    items: register(itemFeature),\n    GStarterTask: register(GStarterTask),\n    GStarterProject: register(GStarterProject),\n  }'));
  const persistence = out.text('tests/project/persistence/starter-task.test.ts');
  assert.ok(persistence.includes('\n  const values = {"title":"fixture","status":"fixture","due_date":"2026-01-01","estimate":1,"done":false,"labels":["fixture"],"project_ref":"fixture","parent_ref":"fixture"};\n'));
  assert.ok(out.text('tests/project/persistence/registry.test.ts').includes('  try { expect((await registry.repositories.GStarterTask.list()).ok).toBe(true);\nexpect((await registry.repositories.GStarterProject.list()).ok).toBe(true); }\n'));
  assert.equal(out.text('src/generated/application/note-operations.ts'), await template.text('templates/companion/runtime/note-operations.ts'));
});

test('a project with only a title-only entity and no required optional fields imports no optional helper', async () => {
  const document = await dataDocument(); const task = document.design.semantic.entities[0];
  task.properties = task.properties.filter(p => p.key === 'title'); document.design.semantic.relationships = [];
  document.design.dataSources.sources[0].operations.pop();
  const m = model(document), wire = (await import('../../src/cli/compiler/emitters/note-contracts.ts')).noteWireSchemas(m.entities[0], 'create');
  for (const op of m.sources[1].operations) Object.assign(op, (await import('../../src/cli/compiler/emitters/note-contracts.ts')).noteWireSchemas(m.entities[0], op.slug.replace('-tasks', '')));
  assert.ok(wire.input);
  const out = await persist(m);
  assert.equal(out.text('src/generated/application/documents/starter-task.ts').split('\n')[0], 'import { defineEntity } from "../../../domain/entity.ts";');
});

test('the generated registry entries follow the retained callback shape and refuse other layouts', async () => {
  const m = model(await dataDocument());
  const removed = await persist(m, withFeatures(registry('() => ({\n\n  }')));
  const imports = 'import { feature as GStarterTask } from "../generated/application/documents/starter-task.ts";\nimport { feature as GStarterProject } from "../generated/application/documents/starter-project.ts";\n';
  assert.equal(removed.text('src/bootstrap/features.ts'), imports + registry('register => ({\n\n    GStarterTask: register(GStarterTask),\n    GStarterProject: register(GStarterProject),\n  }'));
  const wrapped = await persist(m, withFeatures(registry('(add) => ({\n    task: add(taskFeature),\n  }')));
  assert.equal(wrapped.text('src/bootstrap/features.ts'), imports + registry('(add) => ({\n    task: add(taskFeature),\n    GStarterTask: add(GStarterTask),\n    GStarterProject: add(GStarterProject),\n  }'));
  const invalid = { message: 'GENERATOR_INVALID: Review customized feature registry before generating native repositories.' };
  for (const body of ['() => ({\n    task: register(taskFeature),\n  }', 'register => ({\n    task: other(taskFeature),\n  }', 'register => ({\n    task: register(taskFeature);\n  }'])
    await assert.rejects(persist(m, withFeatures(registry(body))), invalid);
  await assert.rejects(persist(m, withFeatures(registry('register => ({\n  }') + registry('register => ({\n  }'))), invalid);
  await assert.rejects(persist(m, withFeatures(registry('register => ({\n    gstartertask: register(other),\n  }'))),
    { message: 'GENERATOR_INVALID: Generated repository keys collide with an existing feature registration.' });
});

test('native repositories refuse framework keys, untitled entities and nested values', async () => {
  const refuse = async (edit, message) => { const document = await dataDocument(); edit(document); await assert.rejects(persist(model(document)), { message: 'GENERATOR_INVALID: ' + message }); };
  await refuse(document => { document.design.semantic.entities[1].slug = 'project'; },
    'Remove/rename the corresponding framework example before registering its canonical entity key.');
  await refuse(document => { document.design.semantic.entities[1].properties[0].required = false; }, 'Declare a title field for a native note repository.');
  await refuse(document => { document.design.semantic.entities[1].properties[0].key = 'Title'; }, 'Native property mapping requires portable frontmatter keys.');
  await refuse(document => { document.design.semantic.entities[1].properties[1].type = 'list'; },
    'Native notes require scalar values or string lists; nested objects need a separate declared codec.');
  assert.equal((await persist(model(await starterDocument('blank')))).files.size, 0);
});

test('note entities resolve only exact declared native mappings or read-only entity lists', async () => {
  const document = await dataDocument(), m = model(document);
  assert.equal(noteEntity(m, 'ds-source-1', 'ds-operation-2')?.slug, 'starter-task');
  assert.equal(noteEntity(m, 'ds-source-1', 'ds-operation-9'), undefined);
  assert.equal(noteEntity(m, 'ds-source-30', 'ds-operation-31'), undefined);
  assert.equal(noteEntity(m, 'ds-source-10', 'ds-operation-12')?.slug, 'starter-task');
  const op = m.sources[1].operations[0], implementation = op.contract.implementation;
  const unsupported = { message: 'GENERATOR_INVALID: Unsupported persistence adapter.' };
  for (const declared of [{ ...implementation, extra: true }, { ...implementation, kind: 'http' }, { ...implementation, operation: 'purge' }]) {
    op.contract.implementation = declared; assert.throws(() => noteEntity(m, 'ds-source-10', op.id), unsupported);
  }
  op.contract.implementation = implementation; op.contract.resource = 'Elsewhere';
  assert.throws(() => noteEntity(m, 'ds-source-10', op.id), { message: 'GENERATOR_INVALID: Native repository needs an exact declared entity folder.' });
});

test('relationship emission copies the runtime, scopes the write guard and emits native integrity checks', async () => {
  const m = model(await dataDocument()), out = recorder();
  await relationshipCode(template, m, out.add);
  assert.deepEqual([...out.files].map(([path, entry]) => [path, entry.ownership]), [['design/relationships.json', 'managed'], ['src/generated/domain/note-values.ts', 'managed'],
    ['src/generated/domain/relationships.ts', 'managed'], ['tests/project/relationships.test.mjs', 'managed'], ['src/generated/application/relationship-session.ts', 'managed'],
    ['tests/project/relationships/starter-task.test.mjs', 'managed'], ['src/generated/bootstrap/relationships.ts', 'managed']]);
  const rules = [{ id: 'er-relationship-8', source: 'starter-task', target: 'starter-project', key: 'project_ref', sourceCard: '0..*', targetCard: '0..1', onDelete: 'restrict' },
    { id: 'er-relationship-20', source: 'starter-task', target: 'starter-task', key: 'parent_ref', sourceCard: '0..*', targetCard: '0..1', onDelete: 'restrict' }];
  assert.deepEqual(JSON.parse(out.text('design/relationships.json')), { rules, writeGuard: ['er-relationship-8', 'er-relationship-20'], scope: 'generated-runtime-preflight-not-cross-process-transaction' });
  const session = out.text('src/generated/application/relationship-session.ts');
  assert.ok(session.includes("'../domain/relationships.ts'") && session.includes("'../domain/note-values.ts'") && !session.includes("'./relationships.ts'"));
  const copied = out.text('tests/project/relationships.test.mjs');
  assert.ok(copied.startsWith("import { test } from 'vitest';") && copied.includes("'../../src/generated/domain/relationships.ts'") && !copied.includes('templates/companion/runtime'));
  const bootstrap = out.text('src/generated/bootstrap/relationships.ts').split('\n');
  assert.equal(bootstrap[6], ` const session=createRelationshipSession(${JSON.stringify(rules)},async()=>{`);
  assert.equal(bootstrap[7], '  const results=await Promise.all([shell.repositories.GStarterTask.list(),shell.repositories.GStarterProject.list()]);');
  const native = out.text('tests/project/relationships/starter-task.test.mjs').split('\n');
  assert.deepEqual(native.slice(5, 8), ['import { document as GStarterProjectDocument } from "../../../src/generated/application/documents/starter-project.ts";',
    'import { createGTaskNotesAdapter } from "../../../src/generated/infrastructure/sources/task-notes.ts";', 'import { createRelationshipIntegrity } from "../../../src/generated/bootstrap/relationships.ts";']);
  assert.ok(native[16].endsWith(`const port=createGTaskNotesAdapter(shell,createRelationshipIntegrity(shell));const base={"title":"fixture"};`));
  assert.equal(native[19], `  const child=await port["create-tasks"]({values:{...base,title:'Child',"parent_ref":parent.record.id},requestId:'child'});`);
});

test('relationship scope follows writable mappings and read lists, and refuses unsupported deletion rules', async () => {
  const readOnly = await starterDocument('tasks-projects'), m = model(readOnly);
  assert.deepEqual(relationshipScope(m), { rules: [], entities: [] });
  assert.deepEqual(relationshipScope(m, true).entities.map(e => e.slug), ['starter-task', 'starter-project']);
  const out = recorder(); await relationshipCode(template, m, out.add);
  assert.deepEqual([...out.files.keys()], ['design/relationships.json', 'src/generated/domain/note-values.ts', 'src/generated/domain/relationships.ts',
    'tests/project/relationships.test.mjs', 'src/generated/application/relationship-session.ts', 'src/generated/bootstrap/relationships.ts']);
  assert.deepEqual(JSON.parse(out.text('design/relationships.json')).writeGuard, []);
  const unrelated = await starterDocument('tasks-projects'); unrelated.design.dataSources.sources[0].operations[0].resource = 'Other';
  const cut = recorder(); await relationshipCode(template, model(unrelated), cut.add); assert.equal(cut.files.size, 5);
  const none = recorder(); await relationshipCode(template, model(await starterDocument('blank')), none.add); assert.equal(none.files.size, 0);
  const cascade = await dataDocument(); cascade.design.semantic.relationships[1].onDelete = 'cascade';
  assert.throws(() => relationshipScope(model(cascade)), { message: 'GENERATOR_INVALID: Native relationship writes require supported cardinalities and restrict deletion. Cascade/unlink require a separately implemented transaction.' });
  const connected = await dataDocument(); connected.design.semantic.relationships.push({ id: 'er-relationship-21', name: 'Sub-project', source: 'er-entity-5', target: 'er-entity-5', key: 'parent_project', sourceCard: '0..*', targetCard: '0..1', onDelete: 'restrict' });
  connected.design.dataSources.sources[1].operations.push({ id: 'ds-operation-19', slug: 'archive-tasks', name: 'Archive', direction: 'write', method: 'adapter', resource: 'Starter/Task', description: 'Unimplemented',
    input: { mode: 'fields', entity: null, many: false, fields: [{ name: 'id', type: 'string', required: true }], schema: null }, output: { mode: 'none', entity: null, many: false, fields: [], schema: null } });
  const tested = recorder(); await relationshipCode(template, model(connected), tested.add);
  assert.deepEqual([...tested.files.keys()].filter(path => path.includes('/relationships/')), ['tests/project/relationships/starter-task.test.mjs']);
  const duplicate = model(await dataDocument()); duplicate.document.design.semantic.relationships.push({ ...duplicate.document.design.semantic.relationships[0] });
  assert.throws(() => relationshipDefinitions(duplicate), { message: 'GENERATOR_INVALID: Duplicate relationship id.' });
  const dangling = model(await dataDocument()); dangling.document.design.semantic.relationships[0].target = 'er-entity-404';
  assert.throws(() => relationshipDefinitions(dangling), { message: 'GENERATOR_INVALID: Dangling relationship entity.' });
});

test('HTTPS sources get a typed provider, a provider test and the copied runtime suite', async () => {
  const out = recorder(); await httpCode(template, model(await dataDocument()), out.add);
  assert.deepEqual([...out.files].map(([path, entry]) => [path, entry.ownership]), [['src/generated/infrastructure/json-http.ts', 'managed'],
    ['src/generated/infrastructure/sources/status-api-http.ts', 'extension'], ['tests/project/http/status-api.test.mjs', 'managed'], ['tests/project/http.test.mjs', 'managed']]);
  const runtime = out.text('src/generated/infrastructure/json-http.ts');
  assert.ok(runtime.includes("'../domain/contract.ts'") && !runtime.includes("'./contract.ts'"));
  const provider = out.text('src/generated/infrastructure/sources/status-api-http.ts').split('\n');
  assert.equal(provider[4], ' const runtime=createJsonHttpPort({"id":"ds-source-30","locator":"https://example.invalid/v1","auth":"runtime","credentialRef":"status-token","operations":[{"slug":"status","method":"GET","resource":"/status","input":null,"output":{"type":"object","properties":{"status":{"type":"string","enum":["ready","busy"]},"checked":{"type":"string","format":"date-time"}},"required":["status"],"additionalProperties":false}},{"slug":"ping","method":"POST","resource":"/ping","input":{"type":"object","properties":{"count":{"type":"integer"}},"required":["count"],"additionalProperties":true},"output":null}]},configuration);');
  assert.equal(provider[5], ' const port:GStatusApiPort={"status":(input,signal)=>runtime.port["status"]!(input,signal),"ping":(input,signal)=>runtime.port["ping"]!(input,signal)};');
  const tests = out.text('tests/project/http/status-api.test.mjs');
  assert.ok(tests.includes('transport:async()=>{calls++;return new Response(JSON.stringify({"status":"ready"}));}});'));
  assert.ok(tests.includes('transport:async()=>{calls++;return new Response(null);}});\n try{const service=createGStatusApiService(provider.port);expect(await service["ping"]({"count":1})).toEqual(undefined);'));
  const suite = out.text('tests/project/http.test.mjs');
  assert.ok(suite.startsWith("import { test } from 'vitest';") && suite.includes('../src/generated/infrastructure/json-http.ts') && !suite.includes('templates/companion/runtime'));
  const none = recorder(); await httpCode(template, model(await starterDocument('tasks-projects')), none.add); assert.equal(none.files.size, 0);
  const unsafe = model(await dataDocument()); unsafe.sources[2].contract.locator = 'http://example.invalid';
  assert.throws(() => httpCode(template, unsafe, recorder().add));
});

test('fixture-note checks cover every native and relationship-scoped entity', async () => {
  const out = recorder(); fixtureNoteTests(model(await dataDocument()), out.add);
  assert.deepEqual([...out.files].map(([path, entry]) => [path, entry.ownership]), [['tests/project/fixtures/canonical-starter-task.test.ts', 'managed'],
    ['tests/project/fixtures/canonical-starter-project.test.ts', 'managed']]);
  const text = out.text('tests/project/fixtures/canonical-starter-project.test.ts').split('\n');
  assert.equal(text[1], 'import { createFixtureEngine } from "../../../scripts/test-data/engine.mjs";');
  assert.equal(text[7], "it('seeded starter-project Markdown is readable by the canonical repository without a fake codec', async () => {");
  assert.equal(text[9], '  const notes=generated.files.filter(file=>file.path.startsWith("Starter/Project/") && file.path.endsWith(\'.md\'));');
  const none = recorder(); fixtureNoteTests(model(await starterDocument('blank')), none.add); assert.equal(none.files.size, 0);
});

test('native declarations lower into developer-owned definitions, tests and a managed registry', async () => {
  const m = model(await starterDocument('blank')), empty = recorder();
  nativeCode(m, empty.add);
  assert.deepEqual([...empty.files.keys()], ['src/generated/bootstrap/native-integrations.ts']);
  assert.equal(empty.text('src/generated/bootstrap/native-integrations.ts'), 'import type { NativeFileDefinition, NativeMenuDefinition } from "../../domain/native-integrations.ts";\n\n'
    + 'export const projectFileTypes: readonly NativeFileDefinition[] = [];\nexport const projectContextMenus: readonly NativeMenuDefinition[] = [];\n');
  m.document.design.nativeIntegrations = { schemaVersion: 1, fileTypes: [{ id: 'board', name: 'Board', extension: 'board', format: 'json', initialContent: '{}' }],
    contextMenus: [{ id: 'share', name: 'Share', extensions: ['md', 'board'] }] };
  const out = recorder(); nativeCode(m, out.add);
  assert.deepEqual([...out.files].map(([path, entry]) => [path, entry.ownership]), [['src/generated/domain/native/board.file-extension.ts', 'extension'], ['tests/project/native/board.test.ts', 'extension'],
    ['src/generated/domain/native/share.context-menu.ts', 'extension'], ['tests/project/native/share.test.ts', 'extension'],
    ['src/generated/bootstrap/native-integrations.ts', 'managed'], ['NATIVE-INTEGRATIONS.md', 'managed']]);
  assert.deepEqual(out.text('src/generated/bootstrap/native-integrations.ts').split('\n').slice(1), ['import { definition as nativeFile0 } from "../domain/native/board.file-extension.ts";',
    'import { definition as nativeMenu0 } from "../domain/native/share.context-menu.ts";', 'export const projectFileTypes: readonly NativeFileDefinition[] = [nativeFile0];',
    'export const projectContextMenus: readonly NativeMenuDefinition[] = [nativeMenu0];', '']);
  const guide = out.text('NATIVE-INTEGRATIONS.md');
  assert.ok(guide.includes('## File types\n- **.board** — Board: command **Create Board**, folder menu **Create Board**, dedicated TextFileView and file menu **Open Board**.\n'));
  assert.ok(guide.includes('## File context actions\n- **Share** — extensions .md, .board. Edit the domain handler'));
  m.document.design.nativeIntegrations.contextMenus = [];
  const files = recorder(); nativeCode(m, files.add); assert.ok(files.text('NATIVE-INTEGRATIONS.md').includes('## File context actions\nNone declared.\n'));
  m.document.design.nativeIntegrations = { schemaVersion: 1, fileTypes: [], contextMenus: [{ id: 'share', name: 'Share', extensions: ['md'] }] };
  const menus = recorder(); nativeCode(m, menus.add); assert.ok(menus.text('NATIVE-INTEGRATIONS.md').includes('## File types\nNone declared.\n'));
});
