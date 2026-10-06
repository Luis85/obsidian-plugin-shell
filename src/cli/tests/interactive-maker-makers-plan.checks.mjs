const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { makerFixture, installMakerFoundation } from '../../../tooling/tests/maker-fixture.mjs';
import { applyFilePlan } from '#shared/platform/file-plan.ts';
import { parseArguments, recipeOptions, builtinRecipes, slug, title, makerSymbol } from '../adapters/makers/arguments.ts';
import { planMaker } from '../adapters/makers/plan.ts';
import { dispatchMaker, builtinHandlers } from '../adapters/makers/dispatch.ts';
import { defineLocalMaker } from '../adapters/makers/custom-contract.ts';
import { loadCatalog } from '../adapters/makers/load-catalog.ts';
import { templates } from '../adapters/makers/templates.ts';
import { formatGenerated, checkGenerated } from '../adapters/makers/format-generated.ts';
import { hasSyntaxErrors } from '../adapters/makers/syntax.ts';

// Drives the maker request parser, planner, dispatch table, custom-recipe contract and entity catalog
// (src/cli/adapters/makers) under the maker floors, against an isolated author fixture with real recipes.
const args = (...values) => parseArguments(values);
const plan = (root, ...values) => planMaker(root, args(...values));
const apply = async (root, ...values) => { const planned = await plan(root, ...values); await applyFilePlan(planned.plan); return planned; };
const statuses = planned => planned.plan.changes.map(change => change.status);

test('maker arguments parse flags, values and positionals and reject malformed input', () => {
  assert.deepEqual(args('entity', 'note', '--feature', 'tasks', '--document', '--json'),
    { maker: 'entity', name: 'note', options: { '--feature': 'tasks', '--document': true, '--json': true } });
  assert.deepEqual(args(), { maker: undefined, name: undefined, options: {} });
  assert.throws(() => args('--bogus'), { message: 'Unknown maker option: --bogus' });
  assert.throws(() => args('--json', '--json'), { message: 'Repeated maker option: --json' });
  assert.throws(() => args('--feature'), { message: 'Missing value for --feature' });
  assert.throws(() => args('--feature', '--json'), { message: 'Missing value for --feature' });
  assert.throws(() => args('a', 'b', 'c'), { message: 'Expected a maker and one name' });
  assert.ok(builtinRecipes.includes('feature') && builtinRecipes.includes('plugin'));
  assert.ok(recipeOptions('feature').includes('--entity'));
  assert.deepEqual(recipeOptions('custom-local'), ['--dry-run', '--yes', '--no-interaction', '--json', '--help', '--list', '--feature']);
  for (const value of [undefined, 'Bad', 'a'.repeat(49), 'con', 'class', '-x', 'x-']) assert.throws(() => slug(value, 'name'), { message: 'Invalid name: use a lowercase non-reserved hyphenated name' });
  assert.equal(slug('reading-list', 'name'), 'reading-list');
  assert.equal(title('reading-list'), 'Reading List'); assert.equal(makerSymbol('reading-list-2'), 'readingList2');
});

test('request validation reports the first problem in contract order before any file is read', () => makerFixture(async root => {
  const rejects = (values, message) => assert.rejects(plan(root, ...values), { message });
  await rejects(['Bad', 'x'], 'Invalid recipe name: use a lowercase non-reserved hyphenated name');
  await rejects(['command', 'Bad'], 'Invalid maker name: use a lowercase non-reserved hyphenated name');
  await rejects(['feature', 'tasks', '--feature', 'x'], '--feature belongs to child recipes; feature uses its positional group name');
  await rejects(['entity', 'y', '--entity', 'z', '--feature', 'tasks'], '--entity belongs to the feature recipe; entity uses its positional entity name');
  await rejects(['command', 'y', '--feature', 'tasks', '--view', 'v'], '--view is not supported by the command recipe');
  await rejects(['command', 'y'], 'Invalid feature name (--feature is required): use a lowercase non-reserved hyphenated name');
  await rejects(['command', 'a'.repeat(48), '--feature', 'bookmarks'], 'Composed command identifier exceeds 64 characters; shorten the feature or component name');
  await rejects(['view', 'b'.repeat(46), '--feature', 'bookmarks'], 'Composed native view identifier exceeds 54 characters');
  await rejects(['feature', 'c'.repeat(46)], 'Composed native view identifier exceeds 54 characters');
  await rejects(['setting', 'c'.repeat(40), '--feature', 'tasks'], 'Composed setting entity identifier exceeds 50 characters');
  await rejects(['entity', 'x', '--feature', 'tasks', '--backend', 'sql'], 'Unknown backend; select domain, markdown or plugin-data');
  await rejects(['entity', 'x', '--feature', 'tasks', '--backend', 'domain', '--document'], '--document requires the markdown backend');
  await rejects(['entity', 'x', '--feature', 'tasks', '--preset', 'odd'], 'Unknown preset; select title, task or project');
  for (const folder of ['../up', 'a/.b', 'con', 'a ', 'a//b', ' a', 'x?', 'n'.repeat(161)])
    await rejects(['entity', 'x', '--feature', 'tasks', '--folder', folder], 'Unsafe document folder');
  await rejects(['view', 'missing', '--feature', 'absent'], 'Feature absent does not exist. Create it first with make feature absent.');
  await mkdir(join(root, 'src/features'), { recursive: true });
  await writeFile(join(root, 'src/features/flat'), 'not a folder');
  await rejects(['view', 'panel', '--feature', 'flat'], 'Feature owner must be a real directory');
  await mkdir(join(root, 'elsewhere'));
  await symlink(join(root, 'elsewhere'), join(root, 'src/features/linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(plan(root, 'view', 'panel', '--feature', 'linked'));
}));

test('planned recipes report metadata, targeted checks and idempotent reruns', () => makerFixture(async root => {
  await installMakerFoundation(root);
  const feature = await apply(root, 'feature', 'bookmarks', '--entity', 'bookmark', '--preset', 'task', '--folder', 'Work/Bookmarks');
  assert.deepEqual({ maker: feature.maker, owner: feature.owner, entity: feature.entity, preset: feature.preset, backend: feature.backend, folder: feature.folder, templateVersion: feature.templateVersion },
    { maker: 'feature', owner: 'bookmarks', entity: 'bookmark', preset: 'task', backend: 'markdown', folder: 'Work/Bookmarks', templateVersion: 2 });
  assert.deepEqual(feature.checks.map(check => [check.id, check.command, check.args[0]]), [['typecheck', 'node', 'node_modules/vue-tsc/bin/vue-tsc.js'], ['generated-tests', 'node', 'node_modules/vitest/vitest.mjs'], ['events-check', 'node', 'scripts/events/catalog.mjs'], ['entities-check', 'node', 'scripts/makers/entities.mjs']]);
  assert.equal(feature.next, 'npm run verify');
  assert.ok(feature.checks[1].args.some(path => path.endsWith('bookmarks-bookmark.test.ts')));
  assert.ok(statuses(await plan(root, 'feature', 'bookmarks', '--entity', 'bookmark', '--preset', 'task', '--folder', 'Work/Bookmarks')).every(status => status === 'unchanged'));
  await assert.rejects(plan(root, 'feature', 'bookmarks', '--entity', 'other'), { message: 'MAKER_CONFLICT: edited or unrelated file tests/runtime/generated/bookmarks-workspace-actions.test.ts' });
  await mkdir(join(root, 'src/features/fresh'));
  await assert.rejects(plan(root, 'feature', 'fresh'), { message: 'Feature fresh already exists. Use a child recipe to extend it.' });
  const domain = await apply(root, 'entity', 'reference', '--feature', 'bookmarks', '--preset', 'project');
  assert.deepEqual([domain.backend, domain.folder, domain.preset], ['domain', undefined, 'project']);
  const data = await apply(root, 'entity', 'rating', '--feature', 'bookmarks', '--backend', 'plugin-data');
  assert.equal(data.backend, 'plugin-data');
  const document = await apply(root, 'entity', 'note', '--feature', 'bookmarks', '--document');
  assert.deepEqual([document.backend, document.folder], ['markdown', 'Bookmarks']);
  const setting = await apply(root, 'setting', 'compact', '--feature', 'bookmarks');
  assert.deepEqual([setting.backend, setting.entity, setting.preference], ['plugin-data', 'bookmarks-compact-setting', undefined]);
  const preference = await apply(root, 'setting', 'quiet', '--feature', 'bookmarks', '--preference', 'notifySuccess');
  assert.deepEqual([preference.backend, preference.preference, preference.entity], ['plugin-data', 'notifySuccess', undefined]);
  const command = await apply(root, 'command', 'help', '--feature', 'bookmarks');
  assert.equal(command.entity, undefined); assert.equal(command.backend, undefined);
  // The full gate is a printed next step, never a planned check that could be reported as passed.
  assert.ok(command.checks.every(check => check.command === 'node')); assert.equal(command.next, 'npm run verify');
  const before = (await loadCatalog(root)).entities.map(entry => [entry.entity, entry.backend]);
  assert.deepEqual(before.sort(), [['bookmark', 'markdown'], ['bookmarks-compact-setting', 'plugin-data'], ['fixture-project', 'markdown'], ['fixture-task', 'markdown'], ['note', 'markdown'], ['rating', 'plugin-data'], ['reference', 'domain']]);
  const catalog = await loadCatalog(root);
  const bookmark = catalog.entities.find(entry => entry.entity === 'bookmark');
  assert.deepEqual(bookmark.fields.find(field => field.name === 'status'), { name: 'status', type: 'text', requiredInput: false, optionalStored: false, default: 'todo' });
  assert.equal(bookmark.defaultFolder, 'Work/Bookmarks'); assert.equal(bookmark.liveFolderOverride, false);
  assert.equal(catalog.entities.find(entry => entry.entity === 'reference').mappings.length, 0);
}));

test('the entity catalog rejects duplicate identities and incomplete mappings without leaving its bundle', () => makerFixture(async root => {
  await installMakerFoundation(root);
  await apply(root, 'feature', 'bookmarks', '--entity', 'bookmark');
  const definition = join(root, 'src/features/bookmarks/bookmark.definition.ts');
  const original = await readFile(definition, 'utf8');
  await writeFile(definition, original.replace("mappings: [{ field: 'title', property: 'title' }]", 'mappings: []'));
  await assert.rejects(loadCatalog(root), { message: 'Invalid document mapping' });
  await writeFile(definition, original);
  const entity = join(root, 'src/features/bookmarks/bookmark.entity.ts');
  await writeFile(entity, (await readFile(entity, 'utf8')).replace("defineEntity('bookmark'", "defineEntity('fixture-task'"));
  await assert.rejects(loadCatalog(root), /DUPLICATE/i);
}));

test('dispatch exposes the built-in table, guards owners and routes unknown recipes to the custom registry', async () => {
  for (const id of builtinRecipes) assert.equal(typeof builtinHandlers[id], 'function', id);
  const base = { name: 'x', options: {}, owner: undefined, entity: undefined, folder: 'X', preset: 'title', backend: 'markdown' };
  await assert.rejects(dispatchMaker({}, { ...base, maker: 'command' }), { message: 'MAKER_OWNER_REQUIRED: command' });
  await assert.rejects(dispatchMaker({}, { ...base, maker: 'entity', owner: 'tasks' }), { message: 'MAKER_ENTITY_REQUIRED: entity' });
  await assert.rejects(dispatchMaker({}, { ...base, maker: 'setting', owner: 'tasks', options: { '--preference': 'other' } }), { message: 'Unknown --preference; select notifySuccess|hideObsidianViewHeader' });
  const reads = [];
  await assert.rejects(dispatchMaker({ root: '/nonexistent-maker-root', async read(path) { reads.push(path); return ''; } }, { ...base, maker: 'reminder' }));
  assert.deepEqual(reads, ['scripts/makers/custom/registry.mjs']);
});

test('local recipe metadata is validated before the runner trusts its plan', async () => {
  const plan = async () => {};
  const recipe = defineLocalMaker({ name: 'reminder', version: 1, description: 'Reminder', plan });
  assert.deepEqual([recipe.name, recipe.version, recipe.description, Object.isFrozen(recipe)], ['reminder', 1, 'Reminder', true]);
  let received;
  await defineLocalMaker({ name: 'probe', version: 1, description: 'Probe', async plan(context, request) { received = [this.name, context, request]; } }).plan('context', { name: 'n', owner: 'o' });
  assert.deepEqual(received, ['probe', 'context', { name: 'n', owner: 'o' }]);
  assert.throws(() => defineLocalMaker(null), { message: 'Invalid custom recipe name: use a lowercase non-reserved hyphenated name' });
  assert.throws(() => defineLocalMaker({ name: 'feature', version: 1, description: 'x', plan }), { message: 'CUSTOM_RECIPE_BUILTIN_CONFLICT' });
  for (const invalid of [{ version: 2 }, { description: ' ' }, { description: 'x'.repeat(201) }, { description: 7 }, { plan: 'no' }])
    assert.throws(() => defineLocalMaker({ name: 'reminder', version: 1, description: 'Reminder', plan, ...invalid }), { message: 'CUSTOM_RECIPE_INVALID' });
});

test('entity templates cover the title, task and project presets with matching fixtures', () => {
  const titled = templates({ owner: 'notes', entity: 'memo', folder: 'Memos', preset: 'title' });
  assert.deepEqual(titled.entries.map(entry => entry.path), ['src/features/notes/memo.entity.ts', 'src/features/notes/memo.definition.ts', 'tests/runtime/generated/notes-memo.test.ts', 'tests/fixtures/entities/notes-memo.md']);
  assert.equal(titled.feature, 'memoFeature'); assert.match(titled.entries[3].content, /^title: "Example Memo"$/m);
  assert.match(templates({ owner: 'notes', entity: 'job', folder: 'Jobs', preset: 'task' }).entries[0].content, /status: fields\.defaulted/);
  const project = templates({ owner: 'notes', entity: 'plan', folder: 'Plans', preset: 'project' });
  assert.match(project.entries[0].content, /budget: fields\.defaulted/); assert.match(project.entries[3].content, /^name: "Example Plan"$/m);
});

test('generated formatting and syntax diagnostics stay explicit', async () => {
  const [formatted, untouched, removed] = await formatGenerated([{ path: 'a.ts', content: 'const a = "x"' }, { path: 'a.md', content: '#  Title' }, { path: 'b.ts', content: null }]);
  assert.equal(formatted.content, "const a = 'x';\n"); assert.equal(untouched.content, '#  Title'); assert.equal(removed.content, null);
  assert.deepEqual(await checkGenerated([{ path: 'a.ts', content: 'const a = "x"' }, { path: 'b.ts', content: "const b = 'y';\n" }, { path: 'c.md', content: '#  x' }, { path: 'd.ts', content: null }]), ['a.ts']);
  assert.throws(() => hasSyntaxErrors({}), { message: 'TYPESCRIPT_PARSER_UNSUPPORTED' });
  assert.equal(hasSyntaxErrors({ parseDiagnostics: [] }), false);
});
