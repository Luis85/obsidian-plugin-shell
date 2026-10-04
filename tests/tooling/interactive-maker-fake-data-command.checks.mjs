import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { execute, parseArguments } from '../../bin/adapters/commands.ts';
import { fakeDataCommand } from '../../bin/adapters/fake-data-command.ts';
import { builtinFakeData, insideRoot, loadFakeCatalog } from '../../bin/adapters/fake-data-catalog.ts';
import { routeArguments } from '../../bin/adapters/router.ts';
import { readData } from '../../bin/adapters/storage.ts';
import { newDocument, documentText } from '../../bin/domain/document.ts';
import { runOperations } from '../../bin/application/operations.ts';
const repository = resolve(import.meta.dirname, '../..');
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'fake-data-command-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
/** The real maker parser and dispatcher, exactly as `node bin/app fake-data …` routes them. */
const cli = (root, ...argv) => execute(parseArguments(['fake-data', ...argv], []), { root, frameworkRoot: repository, input: process.stdin });
const files = async folder => (await readdir(folder)).sort();
async function tree(folder) {
  const result = {};
  for (const name of await files(folder)) result[name] = await readFile(join(folder, name), 'utf8');
  return result;
}
async function saveProject(root) {
  const { document } = runOperations(newDocument('Demo'), [{ op: 'entity.add', title: 'Client', as: 'client' },
    { op: 'entity.properties', id: '@client', properties: [{ key: 'company', type: 'text', required: true }, { key: 'email', type: 'text', required: false }, { key: 'score', type: 'number', required: true }] },
    { op: 'collection.add', title: 'Clients', path: 'Records/Clients', entity: '@client' }]);
  await mkdir(join(root, 'design'), { recursive: true });
  await writeFile(join(root, 'design/project.json'), documentText(document));
  return document.design.semantic.entities[0];
}

test('fake-data is a maker command with its own options, help and routing', () => {
  assert.equal(routeArguments(['fake-data', 'entities']).surface, 'maker');
  assert.deepEqual(routeArguments(['help', 'fake-data']).args, ['fake-data', '--help']);
  const args = parseArguments(['fake-data', '--entity', 'contact', '--count', '3', '--seed', '9', '--config', 'x', '--base'], []);
  assert.deepEqual({ ...args.flags }, { entity: 'contact', count: '3', seed: '9', config: 'x', base: true });
  return execute(parseArguments(['fake-data', '--help'], []), { root: repository, frameworkRoot: repository, input: process.stdin }).then(help => {
    assert.ok(help.commands.includes('fake-data')); assert.match(help.help, /fake-data save-config --input generation\.json/);
  });
});

test('a plan writes nothing; the exact planHash applies it; a re-run reports unchanged and edited notes are refused', async () => scratch(async root => {
  const args = ['--entity', 'contact', '--count', '5', '--out', 'Fake Data/Contacts', '--seed', '7', '--base', '--json'];
  const plan = await cli(root, ...args);
  assert.equal(plan.status, 'planned'); assert.equal(plan.files, 6); assert.deepEqual(await files(root), []);
  assert.ok(plan.changes.every(change => change.status === 'create')); assert.ok(plan.changes.at(-1).path.endsWith('/contact.base'));
  await assert.rejects(() => cli(root, ...args, '--apply', 'f'.repeat(64)), /MAKER_APPROVAL|plan changed/);
  assert.deepEqual(await files(root), []);
  const applied = await cli(root, ...args, '--apply', plan.planHash);
  assert.equal(applied.status, 'applied'); assert.equal(applied.report.written.length, 6);
  const folder = join(root, 'Fake Data/Contacts'), written = await tree(folder);
  assert.equal(written[plan.sample.path.split('/').at(-1)], plan.sample.content);
  const again = await cli(root, ...args);
  assert.ok(again.changes.every(change => change.status === 'unchanged'));
  assert.equal((await cli(root, ...args, '--apply', again.planHash)).status, 'unchanged');
  const victim = join(folder, Object.keys(written)[0]);
  await writeFile(victim, 'my own edits\n');
  await assert.rejects(() => cli(root, ...args), /already exist with different content/);
  assert.equal(await readFile(victim, 'utf8'), 'my own edits\n');
  assert.deepEqual((await cli(root, '--entity', 'contact', '--count', '2', '--out', 'Fake Data/Contacts', '--seed', '8', '--json')).changes.map(change => change.status), ['create', 'create']);
}));

test('targets stay relative, inside the root and outside framework template inputs', async () => scratch(async root => {
  for (const out of ['../escape', '/abs/x', 'Notes/.obsidian', '.git/x', 'a/../b'])
    await assert.rejects(() => cli(root, '--entity', 'contact', '--out', out, '--json'), /FAKE_DATA_FOLDER|relative folder/, out);
  await assert.rejects(() => cli(repository, '--entity', 'contact', '--out', 'src/fake', '--json'), /template input directory/);
  assert.throws(() => insideRoot(root, '../x'), /inside the project root/);
  for (const [argv, pattern] of [[['--json'], /exactly one/], [['--entity', 'contact', '--config', 'contacts-demo'], /exactly one/],
    [['--entity', 'nobody'], /Unknown fake-data entity nobody/], [['--config', 'nobody'], /Unknown generation config nobody/],
    [['--entity', 'contact', '--count', 'many'], /--count needs a whole number/], [['--entity', 'contact', '--count', '1001'], /--count must be/],
    [['--entity', 'contact', '--seed', '99999999999'], /--seed needs a whole number/], [['explode'], /Use fake-data entities/],
    [['show', '--name', 'Nope!'], /--name must be an entity id/], [['show-config', '--name', 'nope'], /Unknown generation config nope/]])
    await assert.rejects(() => cli(root, ...argv), pattern, argv.join(' '));
  assert.deepEqual(await files(root), []);
}));

test('saved generation configs list, show, re-run byte-identically, accept overrides and save through reviewed plans', async () => scratch(async root => {
  const listed = await cli(root, 'configs', '--json');
  assert.deepEqual(listed.configs.map(item => [item.id, item.source]), [['contacts-demo', 'builtin'], ['learnings-demo', 'builtin'], ['risks-demo', 'builtin'], ['tasks-board', 'builtin']]);
  assert.equal((await cli(root, 'show-config', '--name', 'contacts-demo')).config.seed, 42);
  const generation = { schemaVersion: 1, id: 'team', title: 'Team', entity: 'contact', count: 4, out: 'People/Team', seed: 11, base: false };
  await writeFile(join(root, 'generation.json'), JSON.stringify(generation));
  const save = await cli(root, 'save-config', '--input', 'generation.json', '--json');
  assert.deepEqual(save.changes.map(change => [change.path, change.status]), [['configs/fake-data/generations/team.json', 'create']]);
  await cli(root, 'save-config', '--input', 'generation.json', '--apply', save.planHash);
  const saved = await readData(join(root, 'configs/fake-data/generations/team.json'));
  assert.deepEqual(saved, { $schema: '../../schemas/fake-data-generation.schema.json', ...generation, referenceDate: '2026-01-01' });
  assert.deepEqual((await cli(root, 'configs')).configs.map(item => [item.id, item.source]).at(-1), ['team', 'project']);
  const first = await cli(root, '--config', 'team');
  await cli(root, '--config', 'team', '--apply', first.planHash);
  const bytes = await tree(join(root, 'People/Team'));
  await rm(join(root, 'People'), { recursive: true });
  await cli(root, '--config', 'team', '--apply', (await cli(root, '--config', 'team')).planHash);
  assert.deepEqual(await tree(join(root, 'People/Team')), bytes, 'a saved, seeded config reproduces byte-identical notes');
  const override = await cli(root, '--config', 'team', '--count', '2', '--seed', '12', '--out', 'People/Other', '--base');
  assert.deepEqual([override.count, override.seed, override.out, override.base, override.files], [2, 12, 'People/Other', true, 3]);
  await writeFile(join(root, 'generation.json'), JSON.stringify({ ...generation, count: 6 }));
  assert.equal((await cli(root, 'save-config', '--input', 'generation.json')).changes[0].status, 'update', 'a changed config is reviewed as an update');
  await writeFile(join(root, 'generation.json'), JSON.stringify({ ...generation, id: 'contacts-demo' }));
  await assert.rejects(() => cli(root, 'save-config', '--input', 'generation.json'), /built-in generation config id/);
  await writeFile(join(root, 'generation.json'), JSON.stringify({ ...generation, entity: 'ghost' }));
  await assert.rejects(() => cli(root, 'save-config', '--input', 'generation.json'), /Unknown fake-data entity ghost/);
}));

test('custom entities validate, save, generate by id or file, and project entities are inferred from design/project.json', async () => scratch(async root => {
  const recipe = { schemaVersion: 1, id: 'recipe', title: 'Recipe', folder: 'Recipes', titleProperty: 'dish',
    properties: [{ key: 'dish', type: 'text', generator: { faker: 'commerce.productName' } }, { key: 'minutes', type: 'number', generator: { faker: 'number.int', args: { min: 5, max: 90 } } }] };
  await writeFile(join(root, 'recipe.json'), JSON.stringify(recipe));
  await writeFile(join(root, 'unsafe.json'), JSON.stringify({ ...recipe, properties: [{ key: 'dish', type: 'text', generator: { faker: 'helpers.fake', args: { pattern: '{{x}}' } } }] }));
  assert.deepEqual(await cli(root, 'validate', '--input', 'recipe.json').then(result => [result.valid, result.status]), [true, 'ok']);
  const invalid = await cli(root, 'validate', '--input', 'unsafe.json');
  assert.deepEqual([invalid.valid, invalid.status, invalid.issues[0].code], [false, 'failed', 'FAKE_DATA_GENERATOR']);
  const fromFile = await cli(root, '--entity', 'file:recipe.json', '--count', '3', '--out', 'Recipes');
  assert.equal(fromFile.entity, 'file:recipe.json'); assert.equal(fromFile.files, 3);
  const plan = await cli(root, 'save-entity', '--input', 'recipe.json');
  await cli(root, 'save-entity', '--input', 'recipe.json', '--apply', plan.planHash);
  assert.equal((await cli(root, 'show', '--name', 'recipe')).source, 'project');
  assert.equal((await cli(root, '--entity', 'recipe', '--out', 'Recipes')).sample.path.startsWith('Recipes/'), true);
  await writeFile(join(root, 'contact.json'), JSON.stringify({ ...recipe, id: 'contact' }));
  await assert.rejects(() => cli(root, 'save-entity', '--input', 'contact.json'), /built-in entity id/);
  await writeFile(join(root, 'configs/fake-data/entities/contact.json'), JSON.stringify({ ...recipe, id: 'contact' }));
  await assert.rejects(() => cli(root, 'entities'), /reuses the built-in id contact/);
  await rm(join(root, 'configs/fake-data/entities/contact.json'));
  const semantic = await saveProject(root);
  const entities = await cli(root, 'entities', '--json');
  assert.deepEqual(entities.entities.map(item => item.source), ['builtin', 'builtin', 'builtin', 'builtin', 'builtin', 'builtin', 'builtin', 'project', 'semantic']);
  assert.equal(entities.entities.at(-1).ref, `semantic:${semantic.id}`);
  const shown = await cli(root, 'show', '--name', `semantic:${semantic.slug}`);
  assert.deepEqual([shown.source, shown.entity.titleProperty, shown.entity.folder], ['semantic', 'company', 'Records/Clients']);
  const generated = await cli(root, '--entity', `semantic:${semantic.id}`, '--count', '2');
  assert.equal(generated.out, 'Fake Data/Records/Clients'); assert.match(generated.sample.content, /^---\ncompany: "/);
  await assert.rejects(() => cli(root, 'show', '--name', 'semantic:missing'), /no entity missing/);
  await writeFile(join(root, 'configs/fake-data/entities/broken.json'), '{"schemaVersion": 1,');
  await assert.rejects(() => loadFakeCatalog(root), /broken.json/);
}));

test('inside the framework checkout the built-in folder is the project folder and is read once', async () => {
  const catalog = await loadFakeCatalog(repository);
  assert.equal(catalog.shared, true); assert.equal(builtinFakeData, join(repository, 'configs/fake-data') + '/');
  assert.ok([...catalog.entities.values()].every(entry => entry.source === 'builtin'));
  assert.deepEqual(Object.keys(await fakeDataCommand({ command: 'fake-data', action: 'entities', flags: {} }, { root: repository, frameworkRoot: repository }, async () => ({}))), ['entities']);
});
