import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseCliArguments, validateRequest } from '../../scripts/framework/catalog.ts';
import { executeOperation } from '../../scripts/framework/operations.ts';
import { planOperation, applyOperation } from '../../scripts/framework/planning.ts';
import { configuration, defaults } from '../../scripts/framework/configuration.ts';
import { readBounded } from '../../scripts/framework/files.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
const seed = JSON.parse(await readFile(join(root, 'docs/concepts/companion/companion-project.json'), 'utf8'));
const identity = { id: 'field-notes', name: 'Field Notes', author: 'Example', version: '0.1.0', description: '' };
async function fixture(t) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'shell-cli-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'project.json'), JSON.stringify(seed));
  return { root: dir, frameworkRoot: root };
}
const run = (ctx, args) => executeOperation(parseCliArguments(args), ctx);
async function configured(t) {
  const ctx = await fixture(t);
  const response = await run(ctx, ['setup', '--id', identity.id, '--name', identity.name, '--author', identity.author, '--yes']);
  assert.equal(response.status, 'applied', JSON.stringify(response));
  return ctx;
}
function cli(args, cwd = root) {
  return spawnSync(process.execPath, [join(root, 'shell.mjs'), ...args], { cwd, encoding: 'utf8', timeout: 30000, maxBuffer: 5_000_000 });
}
test('command parser rejects unknown, duplicated and mismatched options', () => {
  for (const args of [['unknown'], ['status', '--input', 'x'], ['status', '--json', '--json'], ['setup', '--id'], ['status', 'extra']]) assert.throws(() => parseCliArguments(args));
  assert.equal(parseCliArguments(['config', 'explain', '--json']).command, 'config explain');
});
test('programmatic request validation does not execute accessors, cycles or toJSON', () => {
  let invoked = 0;
  for (const value of [{ get command() { invoked++; return 'status'; }, args: [], options: {} }, { command: 'status', args: [], options: {}, toJSON() { invoked++; } }]) assert.throws(() => validateRequest(value));
  const cycle = {}; cycle.value = cycle; assert.throws(() => validateRequest(cycle));
  assert.equal(invoked, 0);
});
test('machine parser failures emit exactly one JSON result and never prompt', () => {
  const output = cli(['unknown', '--json', '--no-interaction']);
  assert.equal(output.status, 1); assert.equal(JSON.parse(output.stdout).diagnostics[0].code, 'UNKNOWN_COMMAND');
  assert.equal(output.stdout.trim().split('\n').length, 1);
  const missing = cli(['setup', '--root', root, '--json', '--no-interaction']);
  assert.equal(missing.status, 1); assert.equal(JSON.parse(missing.stdout).diagnostics[0].code, 'IDENTITY_REQUIRED');
});
test('discovery is data-only even in a poisoned project directory', async t => {
  const ctx = await fixture(t); await writeFile(join(ctx.root, 'shell.config.json'), 'not JSON');
  await writeFile(join(ctx.root, 'package.json'), '{"type":"module"}');
  await writeFile(join(ctx.root, 'shell.config.js'), 'throw new Error("must not execute");');
  const output = cli(['capabilities', '--json'], ctx.root); assert.equal(output.status, 0, output.stderr);
  const response = JSON.parse(output.stdout); assert.equal(response.status, 'ok'); assert.ok(response.data.commands.length >= 29);
  assert.ok(response.data.makers.length >= 14);
});
test('setup previews without writes; yes changes only configuration; rerun is unchanged', async t => {
  const ctx = await fixture(t), before = await readdir(ctx.root);
  const args = ['setup', '--id', identity.id, '--name', identity.name, '--author', identity.author];
  const preview = await run(ctx, args); assert.equal(preview.status, 'planned'); assert.deepEqual(await readdir(ctx.root), before);
  assert.equal((await run(ctx, [...args, '--apply', preview.data.planHash])).status, 'applied');
  assert.equal((await run(ctx, [...args, '--yes'])).status, 'unchanged');
  assert.equal((await readdir(ctx.root)).includes('node_modules'), false);
});
test('configured/imported differences require a deliberate resolution policy', async t => {
  const ctx = await configured(t);
  const response = await run(ctx, ['project', 'import', '--input', 'project.json', '--yes']);
  assert.equal(response.diagnostics[0].code, 'IMPORT_CONFLICT');
  const imported = await run(ctx, ['project', 'import', '--input', 'project.json', '--resolve', 'project', '--yes']);
  assert.equal(imported.status, 'applied', JSON.stringify(imported));
  const saved = JSON.parse(await readFile(join(ctx.root, 'design/project.json'), 'utf8'));
  assert.equal(saved.project.id, identity.id); assert.equal(saved.schemaVersion, 4);
  assert.deepEqual(saved.design.detailDesigns, seed.design.detailDesigns);
  assert.equal((await run(ctx, ['project', 'import', '--input', 'project.json', '--resolve', 'project', '--yes'])).status, 'unchanged');
});
test('import preserves foreign and manually edited design snapshots', async t => {
  const ctx = await configured(t); await mkdir(join(ctx.root, 'design')); await writeFile(join(ctx.root, 'design/project.json'), 'foreign');
  const result = await run(ctx, ['project', 'import', '--input', 'project.json', '--resolve', 'project', '--yes']);
  assert.equal(result.diagnostics[0].code, 'IMPORT_OWNERSHIP'); assert.equal(await readFile(join(ctx.root, 'design/project.json'), 'utf8'), 'foreign');
});
test('file and stdin inspection accept full v4 while rejecting executable/future envelopes', async t => {
  const ctx = await fixture(t);
  const inspected = await run(ctx, ['project', 'inspect', '--input', 'project.json']); assert.equal(inspected.status, 'ok'); assert.equal(inspected.data.screens, 28);
  const stdin = await run({ ...ctx, inputText: JSON.stringify(seed) }, ['project', 'inspect', '--input', '-']); assert.deepEqual(stdin.data, inspected.data);
  const bad = { ...seed, executable: true }; const result = await run({ ...ctx, inputText: JSON.stringify(bad) }, ['project', 'inspect', '--input', '-']); assert.equal(result.status, 'failed');
});
test('unsafe and overlapping folders fail before writing', () => {
  for (const source of ['../src', '/tmp/src', 'scripts', 'design', 'node_modules/x', 'tests/nested']) {
    const config = defaults(identity); config.paths.codebaseFolder = source; assert.throws(() => configuration(config));
  }
  assert.equal(configuration({ ...defaults(identity), paths: { ...defaults(identity).paths, codebaseFolder: 'app/source', testsFolder: 'spec' } }).paths.testsFolder, 'spec');
});
test('saved plans bind request and preimages; yes cannot override stale approval', async t => {
  const ctx = await configured(t);
  const args = ['setup', '--id', identity.id, '--name', identity.name, '--author', identity.author];
  const planned = await run(ctx, [...args, '--plan-out', 'setup.plan.json']); assert.equal(planned.status, 'planned');
  const value = JSON.parse(await readFile(join(ctx.root, 'shell.config.json'), 'utf8')); value.project.description = 'Changed';
  await writeFile(join(ctx.root, 'shell.config.json'), JSON.stringify(value));
  const result = await run(ctx, ['plan', 'apply', 'setup.plan.json', '--yes']); assert.equal(result.status, 'failed'); assert.equal(result.diagnostics[0].code, 'PLAN_STALE');
  const stored = JSON.parse(await readFile(join(ctx.root, 'setup.plan.json'), 'utf8')); stored.request.options.yes = true;
  await writeFile(join(ctx.root, 'setup.plan.json'), JSON.stringify(stored));
  assert.equal((await run(ctx, ['plan', 'apply', 'setup.plan.json', '--yes'])).diagnostics[0].code, 'PLAN_AUTHORITY');
});
test('in-memory API plans are revalidated after configuration changes', async t => {
  const ctx = await configured(t), request = parseCliArguments(['vault', 'prepare']);
  const plan = await planOperation(request, ctx);
  const config = JSON.parse(await readFile(join(ctx.root, 'shell.config.json'), 'utf8')); config.paths.testVaultFolder = '.other-vault';
  await writeFile(join(ctx.root, 'shell.config.json'), JSON.stringify(config));
  await assert.rejects(applyOperation(plan, ctx, plan.planHash), /Inputs changed/);
  assert.ok(!(await readdir(ctx.root)).includes('.test-vault'));
});
test('vault preparation and asset installation preserve plugin data and never enable it', async t => {
  const ctx = await configured(t); assert.equal((await run(ctx, ['vault', 'prepare', '--yes'])).status, 'applied');
  await mkdir(join(ctx.root, 'dist')); await writeFile(join(ctx.root, 'dist/main.js'), 'module.exports = class {};');
  await writeFile(join(ctx.root, 'dist/manifest.json'), JSON.stringify(identity)); await writeFile(join(ctx.root, 'dist/styles.css'), '.field-notes{}');
  const installed = await run(ctx, ['plugin', 'install', '--yes']); assert.equal(installed.status, 'applied', JSON.stringify(installed));
  const target = join(ctx.root, '.test-vault/.obsidian/plugins/field-notes'); await writeFile(join(target, 'data.json'), '{"private":true}');
  assert.equal((await run(ctx, ['plugin', 'install', '--yes'])).status, 'unchanged');
  assert.equal(await readFile(join(target, 'data.json'), 'utf8'), '{"private":true}');
  assert.deepEqual(await readdir(join(ctx.root, '.test-vault/.obsidian')), ['plugins']);
});
test('inputs containing ancestor symlinks are not followed', async t => {
  const ctx = await fixture(t); await symlink(ctx.root, join(ctx.root, 'alias'), 'junction');
  await assert.rejects(readBounded(join(ctx.root, 'alias/project.json')), /symlink/);
});
test('release execution requires its separate digest; yes is not publication authority', async t => {
  const ctx = await fixture(t); const result = await run(ctx, ['release', 'operate', '--input', 'request.json', '--execute', '--yes']);
  assert.equal(result.status, 'failed'); assert.equal(result.diagnostics[0].code, 'RELEASE_AUTHORIZATION');
});
test('aborted operations do not begin planning or write configuration', async t => {
  const ctx = await fixture(t), controller = new AbortController(); controller.abort();
  const response = await run({ ...ctx, signal: controller.signal }, ['setup', '--input', 'project.json', '--yes']); assert.equal(response.status, 'cancelled');
  assert.deepEqual(await readdir(ctx.root), ['project.json']);
});

test('headless companion and terminal adapters produce the identical reviewed plan', async t => {
  const ctx = await fixture(t);
  const args = ['setup', '--id', identity.id, '--name', identity.name, '--author', identity.author, '--dry-run'];
  const headless = await run(ctx, args);
  const terminal = cli([...args, '--root', ctx.root, '--json', '--no-interaction'], ctx.root);
  assert.equal(terminal.status, 0, terminal.stdout + terminal.stderr);
  assert.deepEqual(JSON.parse(terminal.stdout), headless);
  assert.deepEqual(await readdir(ctx.root), ['project.json']);
});
test('machine schema command requires no project configuration or executable project code', () => {
  const result = cli(['schema', '--json']); assert.equal(result.status, 0, result.stderr);
  const schema = JSON.parse(result.stdout).data;
  assert.equal(schema.protocolVersion, 1); assert.ok(schema.request.oneOf.length >= 34);
  assert.equal(schema.result.properties.protocolVersion.const, 1);
});

test('explicit blank setup creates a valid inert design using the same intake path', async t => {
  const ctx = await fixture(t);
  const response = await run(ctx, ['setup', '--id', identity.id, '--name', identity.name, '--author', identity.author, '--blank', '--yes']);
  assert.equal(response.status, 'applied', JSON.stringify(response));
  const inspect = await run(ctx, ['project', 'inspect', '--input', 'design/project.json']);
  assert.equal(inspect.status, 'ok'); assert.equal(inspect.data.screens, 1); assert.equal(inspect.data.sources, 0);
});
