const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listStarters, readStarterOperation, editStarterPlan, assembleStarterPack, packStarterOperation } from '../../bin/adapters/starters/operations.ts';
import { validateDefinition } from '../../bin/adapters/starters/validation.ts';
import { code, fileStarter, request, shipped, workspace } from './starters-fixture.mjs';
import { extractKit } from './framework-archive-fixture.mjs';

// Starter operations (operations.ts): listing, schema/show/validate/coverage reads, add/edit plans and the standalone pack.
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const named = (id, overrides = {}) => fileStarter({ id, name: 'Starter ' + id, ...overrides });
const definitions = async () => [named('note-pack'), await shipped('plugin-vanilla'), await shipped('feature-showcase'), await shipped('blank')];
const read = (context, command, args = [], options = {}) => readStarterOperation(request(command, args, options), context);

test('listing projects every installed definition with its generator, inputs and processes', async () => workspace(async context => {
  const listed = await listStarters(context);
  assert.equal(listed.command, 'starters list'); assert.equal(listed.status, 'ok');
  assert.deepEqual(Object.keys(listed.data), ['folder', 'integrity', 'starters']);
  assert.deepEqual([listed.data.folder, listed.data.integrity], ['configs/starters', 'local-content-sha256; not a signature']);
  assert.deepEqual(listed.data.starters.map(row => [row.id, row.generator, row.project ?? null]), [['blank', 'companion', null], ['feature-showcase', 'companion', null],
    ['note-pack', 'files', null], ['plugin-vanilla', 'project', { projectType: 'plugin', framework: 'vanilla', targets: ['plugin'] }]]);
  const pack = listed.data.starters[2], bytes = await readFile(join(context.root, 'configs/starters/note-pack.json'));
  assert.deepEqual(pack, { id: 'note-pack', title: 'Starter note-pack', category: 'Utility', difficulty: 'Foundation', description: 'Writes a note pack.', version: '1.2.3',
    generator: 'files', file: 'configs/starters/note-pack.json', sha256: sha(bytes), inputs: validateDefinition(named('note-pack')).inputs,
    processes: [{ id: 'hello', label: 'Hello', description: 'Writes hello.', dependsOn: [] }, { id: 'again', label: 'Again', description: 'Runs after hello.', dependsOn: ['hello'] }] });
  assert.equal((await listStarters(context, 'new')).command, 'new');
}, await definitions()));

test('an empty project lists no starters and names the separate starters ZIP', () => workspace(async context => {
  const listed = await read(context, 'starters list');
  assert.deepEqual(listed.data, { folder: 'configs/starters', integrity: 'local-content-sha256; not a signature', starters: [],
    next: 'No starters installed. Extract the separate Workbench starters ZIP into this project (configs/starters/), or use starters add --input <definition.json>. The shell contains no fallback definitions.' });
}, []));

test('the schema comes from the checkout, or from the verified template copy beside a bundled kit CLI', { timeout: 300000 }, () => workspace(async context => {
  const source = JSON.parse(await readFile(join(context.frameworkRoot, 'scripts/starters/starter.schema.json'), 'utf8'));
  assert.deepEqual((await read(context, 'starters schema')).data, source);
  // Without bin/kit.json a root is a checkout: its own schema wins and a stray bin/template copy is never probed.
  const checkout = join(context.root, 'checkout'); await mkdir(join(checkout, 'bin/template/scripts/starters'), { recursive: true }); await mkdir(join(checkout, 'scripts/starters'), { recursive: true });
  await writeFile(join(checkout, 'bin/template/scripts/starters/starter.schema.json'), '{"title":"stray copy"}');
  await writeFile(join(checkout, 'scripts/starters/starter.schema.json'), '{"title":"checkout"}');
  assert.deepEqual((await read({ ...context, frameworkRoot: checkout }, 'starters schema')).data, { title: 'checkout' });
  await writeFile(join(checkout, 'scripts/starters/starter.schema.json'), '{"__proto__":{"polluted":true}}');
  assert.equal(await code(read({ ...context, frameworkRoot: checkout }, 'starters schema')), 'JSON_DATA_INVALID');
  await writeFile(join(checkout, 'bin/kit.json'), '{}');
  assert.match(await code(read({ ...context, frameworkRoot: checkout }, 'starters schema')), /^KIT_/);
  const kit = join(context.root, 'kit'); await extractKit(context.frameworkRoot, kit);
  assert.deepEqual((await read({ ...context, frameworkRoot: kit }, 'starters schema')).data, source);
}));

test('show, validate and coverage select installed definitions and refuse unknown or missing IDs', async () => workspace(async context => {
  const bytes = await readFile(join(context.root, 'configs/starters/note-pack.json'));
  assert.deepEqual((await read(context, 'starters show', ['note-pack'])).data, { valid: true, starters: [{ definition: validateDefinition(named('note-pack')), sha256: sha(bytes), file: 'configs/starters/note-pack.json' }] });
  assert.deepEqual((await read(context, 'starters validate')).data.starters.map(row => row.definition.id), ['blank', 'feature-showcase', 'note-pack', 'plugin-vanilla']);
  assert.equal(await code(read(context, 'starters show', ['absent'])), 'STARTER_UNKNOWN');
  assert.equal(await code(read(context, 'starters show')), 'STARTER_REQUIRED');
  assert.equal(await code(read(context, 'starters coverage')), 'STARTER_REQUIRED');
  const showcase = await read(context, 'starters coverage', ['feature-showcase'], { 'require-model-coverage': true });
  assert.deepEqual([showcase.data.starter, showcase.data.modeled.complete, showcase.data.sha256], ['feature-showcase', true, sha(await readFile(join(context.root, 'configs/starters/feature-showcase.json')))]);
  assert.equal((await read(context, 'starters coverage', ['blank'])).data.modeled.complete, false);
  assert.equal(await code(read(context, 'starters coverage', ['blank'], { 'require-model-coverage': true })), 'STARTER_COVERAGE');
  assert.equal(await code(read(context, 'starters coverage', ['note-pack'], { 'require-model-coverage': true })), 'STARTER_COVERAGE');
}, await definitions()));

test('add and edit plan exactly one validated definition file and refuse identity changes', () => workspace(async context => {
  const input = (name, value) => writeFile(join(context.root, name), typeof value === 'string' ? value : JSON.stringify(value));
  const plan = (command, args, file) => editStarterPlan(request(command, args, file === undefined ? {} : { input: file }), context);
  assert.equal(await code(plan('starters add', [])), 'INPUT_REQUIRED');
  await input('fresh.json', named('fresh'));
  const added = await plan('starters add', [], 'fresh.json'), bytes = await readFile(join(context.root, 'fresh.json'));
  assert.deepEqual(added.plan.changes.map(change => [change.path, change.status, change.content]), [['configs/starters/fresh.json', 'create', bytes.toString('utf8')]]);
  assert.deepEqual([added.hash, added.conflicts, added.summary], [sha(bytes), [], { id: 'fresh', file: 'configs/starters/fresh.json', sha256: sha(bytes), processes: 'not-run' }]);
  await input('existing.json', named('note-pack', { summary: 'Edited.' }));
  assert.equal(await code(plan('starters add', [], 'existing.json')), 'STARTER_EXISTS');
  assert.equal((await plan('starters edit', ['note-pack'], 'existing.json')).plan.changes[0].status, 'update');
  assert.equal(await code(plan('starters edit', ['other'], 'existing.json')), 'STARTER_ID');
  assert.equal(await code(plan('starters edit', ['fresh'], 'fresh.json')), 'STARTER_UNKNOWN');
  await writeFile(join(context.root, 'configs/starters/note-pack.json'), '{ broken');
  assert.equal((await plan('starters edit', ['note-pack'], 'existing.json')).summary.id, 'note-pack');
  await input('invalid.json', { ...named('fresh'), schemaVersion: 9 });
  assert.equal(await code(plan('starters add', [], 'invalid.json')), 'STARTER_VERSION');
}));

test('edit plans validate every other installed definition first', () => workspace(async context => {
  const folder = join(context.root, 'configs/starters'), plan = () => code(editStarterPlan(request('starters add', [], { input: 'fresh.json' }), context));
  await writeFile(join(context.root, 'fresh.json'), JSON.stringify(named('fresh')));
  await writeFile(join(folder, 'notes.txt'), ''); assert.equal(await plan(), 'resolved');
  await writeFile(join(folder, 'other.json'), JSON.stringify(named('different'))); assert.equal(await plan(), 'STARTER_ID');
  await writeFile(join(folder, 'other.json'), '{ broken');
  await assert.rejects(editStarterPlan(request('starters add', [], { input: 'fresh.json' }), context), SyntaxError);
  await writeFile(join(folder, 'other.json'), JSON.stringify(named('other')));
  await writeFile(join(folder, 'Upper.json'), '{}'); assert.equal(await plan(), 'STARTER_SOURCE');
  await rm(join(folder, 'Upper.json'));
  for (let index = 0; index < 256; index += 1) await writeFile(join(folder, `n-${index}.txt`), '');
  assert.equal(await plan(), 'STARTER_LIMIT');
}, [named('one')]));

test('edit plans bound the other installed definitions at 16 MB', () => workspace(async context => {
  const large = id => named(id, { files: Array.from({ length: 8 }, (_, index) => ({ path: `big/${index}.txt`, content: 'x'.repeat(499_000) })) });
  for (const id of ['a', 'b', 'c', 'd']) await writeFile(join(context.root, 'configs/starters', id + '.json'), JSON.stringify(large(id)));
  await writeFile(join(context.root, 'configs/starters/e.json'), JSON.stringify(named('e', { files: [{ path: 'half.txt', content: 'x'.repeat(100_000) }] })));
  await writeFile(join(context.root, 'fresh.json'), JSON.stringify(named('fresh')));
  assert.equal(await code(editStarterPlan(request('starters add', [], { input: 'fresh.json' }), context)), 'STARTER_LIMIT');
}, []));

test('a project without a starter folder can add its first definition', () => workspace(async context => {
  await writeFile(join(context.root, 'fresh.json'), JSON.stringify(named('fresh')));
  const added = await editStarterPlan(request('starters add', [], { input: 'fresh.json' }), context);
  assert.deepEqual(added.plan.changes.map(change => change.path), ['configs/starters/fresh.json']);
}, []));

test('the standalone pack holds the data-only definitions and never overwrites another archive', () => workspace(async context => {
  const pack = (options = {}) => packStarterOperation(request('starters pack', [], options), context);
  const files = await assembleStarterPack(context);
  assert.deepEqual(files.map(file => file.path), ['configs/starters/a-pack.json', 'configs/starters/note-pack.json']);
  assert.deepEqual(files[1].bytes, await readFile(join(context.root, 'configs/starters/note-pack.json')));
  assert.equal(await code(pack()), 'OUTPUT_REQUIRED');
  for (const out of ['starters.tar', 'node_modules/starters.zip', '.git/x.zip', 'a/.Obsidian/x.zip', '.framework/x.zip']) assert.equal(await code(pack({ out })), 'STARTER_PATH');
  const planned = await pack({ out: 'dist/starters.zip' });
  assert.equal(planned.status, 'planned');
  assert.deepEqual([planned.data.archive, planned.data.starters, planned.data.publication, planned.data.definitionFormat], [join(context.root, 'dist/starters.zip'), 2, 'not-authorized', 'configs/starters/$starterName.json']);
  assert.equal((await pack({ out: 'dist/starters.zip', yes: true, 'dry-run': true })).status, 'planned');
  await mkdir(join(context.root, 'dist'));
  const applied = await pack({ out: 'dist/starters.zip', yes: true }), archive = await readFile(join(context.root, 'dist/starters.zip'));
  assert.equal(applied.status, 'applied');
  const { requires, ...report } = planned.data;
  assert.equal(requires, '--yes'); assert.deepEqual(applied.data, report); assert.deepEqual([report.sha256, report.bytes], [sha(archive), archive.length]);
  assert.equal((await pack({ out: 'dist/starters.zip', yes: true })).status, 'applied');
  await writeFile(join(context.root, 'configs/starters/a-pack.json'), JSON.stringify(named('a-pack', { summary: 'Changed.' })));
  assert.equal(await code(pack({ out: 'dist/starters.zip', yes: true })), 'STARTER_ARCHIVE_EXISTS');
  assert.deepEqual(await readFile(join(context.root, 'dist/starters.zip')), archive);
  assert.deepEqual(await readdir(join(context.root, 'dist')), ['starters.zip']);
}, [named('note-pack'), named('a-pack')]));

test('an empty project has nothing to pack', () => workspace(async context => {
  assert.equal(await code(assembleStarterPack(context)), 'STARTER_EMPTY');
}, []));
