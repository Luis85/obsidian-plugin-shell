import assert from 'node:assert/strict';
import { realpath, mkdtemp, readFile, writeFile, rm, mkdir, readdir, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { loadProjectCatalog, loadProjectGuide, projectCreatePlan, savedLegacyProjectSelection, presetBoilerplatePlan } from '../../bin/adapters/project-create.ts';
import { applyPrepared, readData } from '../../bin/adapters/storage.ts';
import { openDocument } from '../../bin/domain/document.ts';
import { execute, parseArguments } from '../../bin/adapters/commands.ts';
import { studio } from '../../bin/presentation/studio.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
const catalog = await loadProjectCatalog(), guide = await loadProjectGuide();
const childEnv = { ...process.env }; delete childEnv.NODE_TEST_CONTEXT; delete childEnv.VITEST;
const input = (preset, frontend, targets) => ({ schemaVersion: 1, catalogVersion: catalog.version, preset, ...(frontend ? { frontend } : {}), ...(targets ? { targets } : {}),
  prototypeRequest: { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers: { title: 'Issue desk', pages: ['Overview', 'Issues'], components: ['Card'], approved: true } } });
async function scratch(run) { const root = await mkdtemp(join(await realpath(tmpdir()), 'maker-presets-')); try { await run(root); } finally { await rm(root, { recursive: true, force: true }); } }
const candidate = (root, request, out = 'prepared') => projectCreatePlan({ root, frameworkRoot, out, input: request, catalog, guide });
for (const [preset, frontend, targets] of [['plugin', 'nuxt-ui'], ['plugin', 'vanilla'], ['plugin', 'angular'], ['webapp', 'nuxt-ui'], ['webapp', 'vanilla'],
  ['website', 'vanilla'], ['website', 'nuxt-ui'], ['cli'], ['hybrid', 'nuxt-ui', ['cli', 'plugin', 'webapp', 'website']], ['hybrid', 'angular', ['plugin', 'cli']]]) {
  test(`preset ${preset}/${frontend ?? 'none'} emits bounded, target-specific source and honest readiness`, async () => scratch(async root => {
    const request = input(preset, frontend, targets), plan = await candidate(root, request);
    const again = await candidate(root, request); assert.equal(plan.planHash, again.planHash);
    assert.deepEqual(await readdir(root), []); assert.equal(plan.data.stage, 'prepared-not-implemented');
    assert.equal(plan.data.installed, false); assert.equal(plan.data.built, false);
    assert.equal(plan.data.readiness.typecheck, 'not-run'); assert.equal(plan.data.readiness.dependencies, 'resolution-required');
    assert.ok(!/\{\{[a-zA-Z]/.test(plan.data.prompt));
    await applyPrepared(plan, plan.planHash);
    const output = join(root, 'prepared/source');
    const descriptor = await readData(join(output, 'shell.project.json'));
    assert.equal(descriptor.frontend, frontend ?? 'none');
    assert.deepEqual(descriptor.targets, targets ? ['plugin', 'webapp', 'website', 'cli'].filter(item => targets.includes(item)) : [preset]);
    const manifest = await readData(join(root, 'prepared/prototype.manifest.json'));
    assert.equal(manifest.status, 'incomplete'); assert.ok(manifest.artifacts.every(item => item.sha256 === null && item.verified === false));
    const document = openDocument(await readData(join(root, 'prepared/companion.project.json')));
    assert.equal(document.design.nodes.length, 2); assert.equal(document.project.name, 'Issue desk');
    assert.equal(Object.hasOwn(document, 'preset'), false);
    const pkg = await readData(join(output, 'package.json')), allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    assert.ok(Object.values(allDeps).every(pin => /^\d+\.\d+\.\d+$/.test(pin)));
    assert.equal(Boolean(allDeps.vue), frontend === 'nuxt-ui'); assert.equal(Boolean(allDeps['@angular/core']), frontend === 'angular');
    assert.equal(Boolean(allDeps.obsidian), descriptor.targets.includes('plugin'));
    const options = (await readData(join(output, 'tsconfig.json'))).compilerOptions;
    assert.equal(options.strict, true); assert.equal(options.noUncheckedIndexedAccess, true);
    assert.equal(options.skipLibCheck, descriptor.targets.includes('plugin') || frontend === 'nuxt-ui');
    assert.equal(options.rewriteRelativeImportExtensions, frontend === 'angular' ? true : undefined);
    assert.equal(options.allowImportingTsExtensions, frontend === 'angular' ? undefined : true);
    if (frontend === 'nuxt-ui') assert.deepEqual(options.paths['#build/*'], ['./node_modules/.nuxt-ui/*']);
    if (frontend === 'nuxt-ui') {
      assert.match(await readFile(join(output, 'src/presentation/mount.ts'), 'utf8'), /app\.use\(ui\)/);
      assert.match(await readFile(join(output, 'scripts/bundling/vite-shared.mjs'), 'utf8'), /shell\.project\.json/);
      const shared = await readFile(join(output, 'scripts/bundling/vite-shared.mjs'), 'utf8');
      for (const [, imported] of shared.matchAll(/from ['"](\.\/[^'"]+)['"]/g)) await readFile(resolve(output, 'scripts/bundling', imported));
    }
    if (descriptor.targets.includes('website')) {
      const html = await readFile(join(output, 'src/targets/website/pages/issues/index.html'), 'utf8');
      assert.match(html, /<h1>Issues<\/h1>/); assert.match(html, /\.\.\/\.\.\/index\.html/);
      assert.match(html, /stylesheet/); assert.equal(html.includes('type="module"'), frontend === 'nuxt-ui');
    }
    if (descriptor.targets.includes('plugin')) {
      const native = await readData(join(output, 'manifest.json')); assert.equal(native.id, descriptor.id);
      assert.match(await readFile(join(output, 'src/targets/plugin/main.ts'), 'utf8'), /generation !== this\.generation/);
    }
    const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', '--test-reporter=tap', 'tests/core.test.mjs'], { cwd: output, encoding: 'utf8', env: childEnv });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /# pass 3/);
    const replay = await readData(join(root, 'prepared/project-create.json'));
    const repeated = await candidate(root, replay); assert.ok(repeated.plan.changes.every(change => change.status === 'unchanged'));
    assert.equal((await applyPrepared(repeated, repeated.planHash)).status, 'unchanged');
  }));
}
test('generated CLI source executes real commands without frontend dependencies and uses bounded machine output', async () => scratch(async root => {
  const plan = await candidate(root, input('cli')); await applyPrepared(plan, plan.planHash);
  const cwd = join(root, 'prepared/source');
  for (const args of [[], ['help'], ['list'], ['show', 'issues'], ['overview']]) {
    const result = spawnSync(process.execPath, ['--experimental-strip-types', 'src/targets/cli/main.ts', ...args, '--json'], { cwd, encoding: 'utf8', env: { ...childEnv, CI: '1', NODE_NO_WARNINGS: '1' } });
    assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, '');
    assert.equal(result.stdout.trim().split('\n').length, 1); assert.equal(JSON.parse(result.stdout).status, 'ok');
  }
  for (const args of [['missing'], ['show'], ['help', 'extra'], ['show', 'issues', 'extra']]) {
    const result = spawnSync(process.execPath, ['--experimental-strip-types', 'src/targets/cli/main.ts', ...args, '--json'], { cwd, encoding: 'utf8', env: { ...childEnv, NODE_NO_WARNINGS: '1' } });
    assert.equal(result.status, 1); assert.equal(JSON.parse(result.stdout).status, 'failed'); assert.equal(result.stderr, '');
  }
  const bad = spawnSync(process.execPath, ['--experimental-strip-types', 'src/targets/cli/main.ts', 'missing'], { cwd, encoding: 'utf8', env: { ...childEnv, NODE_NO_WARNINGS: '1' } });
  assert.equal(bad.status, 1); assert.equal(bad.stdout, ''); assert.match(bad.stderr, /Use help/);
}));
test('new package ownership, approvals, cancellation and path boundaries preserve existing files', async () => scratch(async root => {
  const request = input('cli'), plan = await candidate(root, request);
  await assert.rejects(() => applyPrepared(plan, 'wrong'), /plan changed/);
  await assert.rejects(() => candidate(root, { ...request, prototypeRequest: { ...request.prototypeRequest, answers: { title: 'Desk', approved: false } } }), /agree/);
  await assert.rejects(() => candidate(root, request, '../escape'));
  await assert.rejects(() => projectCreatePlan({ root: frameworkRoot, frameworkRoot, out: 'bin/unsafe', input: request, catalog, guide }));
  await assert.rejects(() => projectCreatePlan({ root, frameworkRoot, out: 'cancelled', input: request, catalog, guide, signal: AbortSignal.abort() }));
  await applyPrepared(plan, plan.planHash);
  const owned = join(root, 'prepared/source/src/core/project.ts'); await writeFile(owned, '// consumer edit\n');
  await assert.rejects(() => candidate(root, request), /edited or unowned/); assert.equal(await readFile(owned, 'utf8'), '// consumer edit\n');
  await mkdir(join(root, 'foreign/source'), { recursive: true }); await writeFile(join(root, 'foreign/source/package.json'), 'consumer');
  await assert.rejects(() => candidate(root, request, 'foreign'), /edited or unowned/);
  if (process.platform !== 'win32') { await symlink(join(root, 'foreign'), join(root, 'linked')); await assert.rejects(() => candidate(root, request, 'linked')); }
}));
test('saved presets drive subsequent sketch generation and reject contradictory sidecar data', async () => scratch(async root => {
  assert.equal(await savedLegacyProjectSelection(root, catalog), null);
  const plan = await candidate(root, input('webapp', 'vanilla')); await applyPrepared(plan, plan.planHash);
  const workspace = join(root, 'prepared/source'), selected = await savedLegacyProjectSelection(workspace, catalog);
  assert.equal(selected.preset, 'webapp'); assert.equal(selected.frontend, 'vanilla');
  const document = openDocument(await readData(join(workspace, 'design/project.json')));
  const direct = await presetBoilerplatePlan(workspace, frameworkRoot, 'generated/next', document, selected, catalog);
  const args = parseArguments(['sketch', 'generate', '--out', 'generated/next']);
  const viaCommand = await execute(args, { root: workspace, frameworkRoot, input: Readable.from([]) });
  assert.equal(direct.planHash, viaCommand.planHash); assert.equal(viaCommand.selection.frontend, 'vanilla');
  const path = join(workspace, 'shell.project.json'), original = await readData(path);
  for (const patch of [{ schemaVersion: 2 }, { framework: 'vue' }, { targets: ['plugin'] }, { frontend: 'none' }, { extra: true }]) {
    await writeFile(path, JSON.stringify({ ...original, ...patch })); await assert.rejects(() => savedLegacyProjectSelection(workspace, catalog));
  }
  await writeFile(path, JSON.stringify(original));
  const hybrid = await candidate(root, input('hybrid', 'vanilla', ['plugin', 'cli']), 'hybrid'); await applyPrepared(hybrid, hybrid.planHash);
  assert.deepEqual((await savedLegacyProjectSelection(join(root, 'hybrid/source'), catalog)).targets, ['plugin', 'cli']);
}));

test('agent and studio refuse two valid but contradictory preset sidecars without generating files', async () => scratch(async root => {
  const plan = await candidate(root, input('webapp', 'vanilla')); await applyPrepared(plan, plan.planHash);
  const workspace = join(root, 'prepared/source');
  const legacy = await readFile(join(workspace, 'shell.project.json'), 'utf8');
  const canonical = JSON.stringify({ schemaVersion: 1, catalogVersion: 1, preset: 'cli', projectType: 'cli', framework: 'none', targets: ['cli'] });
  await writeFile(join(workspace, 'project.config.json'), canonical);
  const before = (await readdir(workspace)).sort();
  await assert.rejects(() => execute(parseArguments(['sketch', 'generate']), { root: workspace, frameworkRoot, input: Readable.from([]) }), { code: 'PROJECT_CONFIG_CONFLICT' });
  const transcript = []; let actions = 0;
  const ui = { write: text => transcript.push(text), ask: async prompt => {
    if (prompt.startsWith('Choose number or ID')) return actions++ === 0 ? 'generate' : 'exit';
    if (prompt.startsWith('Boilerplate output folder')) return 'generated/next';
    throw new Error('Unexpected prompt: ' + prompt);
  } };
  await studio(ui, { root: workspace, frameworkRoot, project: 'design/project.json' });
  assert.match(transcript.join(''), /PROJECT_CONFIG_CONFLICT/);
  assert.equal(await readFile(join(workspace, 'shell.project.json'), 'utf8'), legacy);
  assert.equal(await readFile(join(workspace, 'project.config.json'), 'utf8'), canonical);
  assert.deepEqual((await readdir(workspace)).sort(), before);
}));
test('studio regeneration of a saved legacy project retains its runtime and defaults to no writes', async () => scratch(async root => {
  const plan = await candidate(root, input('cli')); await applyPrepared(plan, plan.planHash);
  const workspace = join(root, 'prepared/source'), transcript = []; let actions = 0;
  const before = (await readdir(workspace)).sort();
  const ui = { write: text => transcript.push(text), ask: async prompt => {
    if (prompt.startsWith('Choose number or ID')) return actions++ === 0 ? 'generate' : 'exit';
    if (prompt.startsWith('Boilerplate output folder')) return 'generated/next';
    if (prompt.startsWith('Apply this reviewed plan?')) return '';
    throw new Error('Unexpected prompt: ' + prompt);
  } };
  await studio(ui, { root: workspace, frameworkRoot, project: 'design/project.json' });
  assert.match(transcript.join(''), /shell\.project\.json/);
  assert.doesNotMatch(transcript.join(''), /PROJECT_CONFIG_CONFLICT/);
  assert.deepEqual((await readdir(workspace)).sort(), before);
}));

test('generated build supervisor preserves last-good output and releases only its own lock after a worker crash', async () => scratch(async root => {
  const plan = await candidate(root, input('cli')); await applyPrepared(plan, plan.planHash);
  const cwd = join(root, 'prepared/source');
  await mkdir(join(cwd, 'dist')); await writeFile(join(cwd, 'dist/last-good.txt'), 'previous output');
  await writeFile(join(cwd, 'scripts/build-worker.mjs'), 'process.exit(17);\n');
  const run = () => spawnSync(process.execPath, ['scripts/build.mjs'], { cwd, encoding: 'utf8', env: childEnv });
  const crashed = run();
  assert.notEqual(crashed.status, 0); assert.match(crashed.stderr, /PROJECT_BUILD_WORKER_FAILED/);
  assert.equal(await readFile(join(cwd, 'dist/last-good.txt'), 'utf8'), 'previous output');
  assert.ok(!(await readdir(cwd)).some(name => /^(\.project-build-lock|\.build-stage-|\.build-backup-)/.test(name)));
  await mkdir(join(cwd, '.project-build-lock')); await writeFile(join(cwd, '.project-build-lock/owner.txt'), 'another build');
  const refused = run(); assert.notEqual(refused.status, 0);
  assert.equal(await readFile(join(cwd, '.project-build-lock/owner.txt'), 'utf8'), 'another build');
  assert.equal(await readFile(join(cwd, 'dist/last-good.txt'), 'utf8'), 'previous output');
}));
