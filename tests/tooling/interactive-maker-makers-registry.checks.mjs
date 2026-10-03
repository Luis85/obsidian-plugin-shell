const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createMakerContext } from '../../bin/adapters/makers/engine.ts';
import { readRegistry, extendRegistry, validateRegistrySource } from '../../bin/adapters/makers/registry.ts';

// Drives the guarded maker planning context and the explicit feature registry editor
// (bin/adapters/makers/{engine,registry}.ts) under the maker floors, without executing recipes.
const after = (t, cleanup) => t.after ? t.after(cleanup) : t.onTestFinished(cleanup);
async function project(t, files) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'maker-registry-')));
  after(t, () => rm(root, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return root;
}
const registry = 'const items = [\n  first,\n];\n';
const contents = plan => Object.fromEntries(plan.changes.map(change => [change.path, change.content]));
const features = (body, imports = "import { taskFeature } from '../features/tasks/definition';\n") =>
  `import { createNoteFeatures } from '../application/note-feature';\n${imports}export const create = services => createNoteFeatures(services, ${body});\n`;

test('registry arrays gain one canonical entry and its import, idempotently', async t => {
  const root = await project(t, { 'src/r.ts': registry, 'src/empty.ts': 'export const items = [];\n', 'src/o.ts': "import { b } from './b';\nconst items = [{ id: 'a', run: (x) => b(x).value }]\n" });
  const context = createMakerContext(root);
  await context.editArray('src/r.ts', 'items', 'second', [{ local: 'second', from: './second' }, { local: 'Panel', from: './panel.vue', defaultImport: true }]);
  await context.editArray('src/r.ts', 'items', 'second', [{ local: 'second', from: './second' }]);
  await context.editArray('src/empty.ts', 'items', '(services) => factory(services, publisher(definition))');
  await context.editArray('src/o.ts', 'items', "{ id: 'a', run: (x) => b(x).value }", [{ local: 'b', from: './b' }]);
  await context.editArray('src/o.ts', 'items', "{ id: 'c', list: [1, true, null, 'x', y[0], { z }] }");
  assert.equal(await context.read('src/r.ts'), "import Panel from './panel.vue';\nimport { second } from './second';\nconst items = [\n  first,\n  second,\n];\n");
  const plan = await context.finish();
  const files = contents(plan);
  assert.match(files['src/empty.ts'], /factory\(services, publisher\(definition\)\)/);
  assert.match(files['src/o.ts'], /id: 'c'/);
  assert.ok(context.tests instanceof Set);
});

test('registry arrays refuse unsupported shapes, entries, edited registrations and import conflicts', async t => {
  const root = await project(t, {
    'src/r.ts': registry, 'src/broken.ts': 'const items = [', 'src/twice.ts': 'const items = [];\nconst items2 = [];\nvar items = [];\n',
    'src/object.ts': 'const items = {};\n', 'src/dupe.ts': 'const items = [a, a];\n', 'src/edited.ts': "const items = [{ id: 'x', value: 1 }];\n",
    'src/spread.ts': 'const items = [...rest];\n', 'src/imports.ts': "import { other } from './elsewhere';\nimport { b } from './b';\nimport b from './b2';\nconst items = [];\n",
  });
  const context = createMakerContext(root);
  const rejects = (path, expression, message, imports) => assert.rejects(context.editArray(path, 'items', expression, imports), { message });
  await rejects('src/broken.ts', 'x', 'REGISTRY_PARSE_ERROR: src/broken.ts');
  await rejects('src/twice.ts', 'x', 'REGISTRY_UNSUPPORTED_SHAPE: src/twice.ts:items');
  await rejects('src/object.ts', 'x', 'REGISTRY_UNSUPPORTED_SHAPE: src/object.ts:items');
  await rejects('src/dupe.ts', 'x', 'REGISTRY_DUPLICATE_KEY: src/dupe.ts:symbol:a');
  await rejects('src/edited.ts', "{ id: 'x', value: 2 }", 'REGISTRY_CONFLICT: edited registration src/edited.ts:id:x');
  await rejects('src/spread.ts', 'x', 'REGISTRY_UNSUPPORTED_ENTRY: src/spread.ts:items');
  await rejects('src/r.ts', '{ name: 1 }', 'REGISTRY_UNSUPPORTED_ENTRY: src/r.ts:items');
  await rejects('src/r.ts', '', 'REGISTRY_UNSUPPORTED_EXPRESSION: candidate');
  for (const expression of ['first?.x', 'async () => first', '(a = 1) => a', '<T>(a) => a', 'f<string>()', '`first`', '(...a) => a', '(a?) => a', '(a: string) => a', '({ a }) => a'])
    await rejects('src/edited.ts', `{ id: 'x', value: ${expression} }`, 'REGISTRY_UNSUPPORTED_EXPRESSION: src/edited.ts:items');
  await rejects('src/edited.ts', "{ id: 'x', ['value']: 1 }", 'REGISTRY_UNSUPPORTED_EXPRESSION: src/edited.ts:items');
  await rejects('src/imports.ts', 'other', 'REGISTRY_CONFLICT: other', [{ local: 'other', from: './other' }]);
  await rejects('src/imports.ts', 'b', 'REGISTRY_CONFLICT: b', [{ local: 'b', from: './b' }]);
});

test('declared outputs are formatted, deduplicated, conflict-checked and bound to the bytes they read', async t => {
  const root = await project(t, { 'src/existing.ts': "export const value = 'original';\n", 'src/read.ts': 'export const read = 1;\n' });
  const context = createMakerContext(root);
  await context.add('src/new.ts', 'export const a = "x"');
  await context.add('src/new.ts', "export const a = 'x';\n");
  await assert.rejects(context.add('src/new.ts', 'export const a = 2;'), { message: 'MAKER_DUPLICATE_OUTPUT: src/new.ts' });
  await assert.rejects(context.add('src/existing.ts', 'export const value = 1;\n'), { message: 'MAKER_CONFLICT: edited or unrelated file src/existing.ts' });
  await context.add('src/existing.ts', "export const value = 'original';\n");
  assert.equal(await context.read('src/read.ts'), 'export const read = 1;\n');
  assert.equal(await context.read('src/read.ts'), 'export const read = 1;\n');
  await context.edit('src/read.ts', source => source.replace('1', '2'));
  await assert.rejects(context.read('../outside.ts'));
  await assert.rejects(context.finish(() => writeFile(join(root, 'src/read.ts'), 'export const read = 3;\n')), { message: 'MAKER_STALE_INPUT: src/read.ts' });
  assert.equal(await readFile(join(root, 'src/existing.ts'), 'utf8'), "export const value = 'original';\n");
});

test('a concurrent change to any read input fails the plan as stale', async t => {
  const root = await project(t, { 'src/read.ts': 'export const read = 1;\n', 'src/guard.ts': 'export const guard = 1;\n' });
  const context = createMakerContext(root);
  await context.read('src/guard.ts');
  await context.add('src/new.ts', "export const created = true;\n");
  await assert.rejects(context.finish(() => writeFile(join(root, 'src/guard.ts'), 'export const guard = 2;\n')), { message: 'MAKER_STALE_INPUT: src/guard.ts' });
  const fresh = createMakerContext(root);
  await fresh.edit('src/read.ts', source => source.replace('1', '2'));
  const plan = await fresh.finish();
  assert.deepEqual(plan.changes.map(change => [change.path, change.status]), [['src/read.ts', 'update']]);
});

test('the feature registry is read from explicit register callbacks and extended without unrelated edits', async t => {
  const root = await project(t, { 'src/bootstrap/features.ts': features('register => ({\n    task: register(taskFeature),\n    project: register(projectFeature, () => folder),\n  })', "import { taskFeature } from '../features/tasks/definition';\nimport { projectFeature as projectFeature } from '../features/projects/definition';\n") });
  const parsed = await readRegistry(root);
  assert.deepEqual(parsed.registrations.map(entry => [entry.key, entry.local, entry.exported, entry.override]), [['task', 'taskFeature', 'taskFeature', false], ['project', 'projectFeature', 'projectFeature', true]]);
  const extended = extendRegistry(parsed, { key: 'note', local: 'noteFeature', from: '../features/notes/note.definition' });
  assert.match(extended, /import \{ noteFeature \} from '\.\.\/features\/notes\/note\.definition';/);
  assert.match(extended, / {4}note: register\(noteFeature\),\n {2}\}\)/);
  await validateRegistrySource(extended);
  const again = await readRegistry(root, extended);
  assert.equal(extendRegistry(again, { key: 'note', local: 'noteFeature', from: '../features/notes/note.definition' }), extended);
  assert.throws(() => extendRegistry(again, { key: 'note', local: 'noteFeature', from: '../features/other/note.definition' }), { message: 'REGISTRY_CONFLICT: note or noteFeature is already owned' });
  assert.throws(() => extendRegistry(again, { key: 'project', local: 'projectFeature', from: '../features/projects/definition' }), { message: 'REGISTRY_CONFLICT: project or projectFeature is already owned' });
  assert.throws(() => extendRegistry(again, { key: 'other', local: 'taskFeature', from: '../features/tasks/definition' }), { message: 'REGISTRY_CONFLICT: other or taskFeature is already owned' });
  await assert.rejects(validateRegistrySource('const = ;'), { message: 'REGISTRY_GENERATED_SYNTAX_ERROR: no files were changed' });
});

test('an empty parameterless callback gains its register parameter and CRLF layout is preserved', async t => {
  const source = features('() => ({})').replaceAll('\n', '\r\n');
  const root = await project(t, { 'src/bootstrap/features.ts': source });
  const parsed = await readRegistry(root);
  const extended = extendRegistry(parsed, { key: 'note', local: 'noteFeature', from: '../features/notes/note.definition' });
  assert.match(extended, /\(register\) => \(\{\r\n {4}note: register\(noteFeature\),\r\n {2}\}\)/);
  const inline = await readRegistry(root, features('register => ({ task: register(taskFeature) })'));
  assert.throws(() => extendRegistry(inline, { key: 'note', local: 'noteFeature', from: '../features/notes/note' }), { message: 'REGISTRY_UNSUPPORTED_LAYOUT: closing callback brace needs its own line' });
  const own = await readRegistry(root, features('register => ({\n    task: register(taskFeature),\n  })'));
  assert.doesNotMatch(extendRegistry(own, { key: 'note', local: 'noteFeature', from: '../features/notes/note' }), /,,/);
});

test('unsupported feature registries fail with stable codes before any edit', async t => {
  const root = await project(t, {});
  const rejects = (source, message) => assert.rejects(readRegistry(root, source), { message });
  await rejects('const = ;', 'REGISTRY_PARSE_ERROR: repair src/bootstrap/features.ts first');
  await rejects('export const none = 1;\n', 'REGISTRY_MISSING: expected the explicit feature registration callback');
  const shape = 'REGISTRY_UNSUPPORTED_SHAPE: use one explicit register callback object';
  for (const body of ['register => register', 'function (register) { return {}; }', '(a, b) => ({})', '({ x }) => ({})', '() => ({ task: register(taskFeature) })', 'register => { return {}; }'])
    await rejects(features(body), shape);
  await rejects(features('register => ({})') + 'createNoteFeatures(services, register => ({}));\n', shape);
  const entry = 'REGISTRY_UNSUPPORTED_ENTRY: preserve explicit key: register(feature) entries';
  for (const body of ['register => ({ task })', "register => ({ 'task': register(taskFeature) })", 'register => ({ task: other(taskFeature) })', 'register => ({ task: register() })', 'register => ({ task: register(load()) })', 'register => ({ task: taskFeature })'])
    await rejects(features(body), entry);
  await rejects(features('register => ({ task: register(taskFeature), Task: register(taskFeature) })'), 'REGISTRY_DUPLICATE_KEY: Task');
  await rejects(features('register => ({ task: register(unknownFeature) })'), 'REGISTRY_UNKNOWN_IMPORT: unknownFeature');
  await rejects(features('register => ({ task: register(taskFeature) })', "import { taskFeature } from './local';\n"), 'REGISTRY_UNKNOWN_IMPORT: taskFeature');
  await rejects('export const create = services => createNoteFeatures(services, () => ({}));\n', 'REGISTRY_MISSING_IMPORTS');
  await assert.rejects(readRegistry(root), { code: 'ENOENT' });
});
