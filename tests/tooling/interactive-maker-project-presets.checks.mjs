import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { loadProjectCatalog, projectGuide, projectRequest, projectPlan } from '../../bin/adapters/projects.ts';
import { projectSelectionRequest, readProjectCatalog, resolveProjectSelection, validateProjectSelection, availableFrameworks } from '../../scripts/compiler/domain/project-presets.ts';
import { compileProject, loadTemplateSnapshot } from '../../scripts/compiler/index.ts';
import { newDocument, documentText, openDocument } from '../../bin/domain/document.ts';
import { runOperations } from '../../bin/application/operations.ts';
import { applyPrepared } from '../../bin/adapters/storage.ts';
import { execute, parseArguments } from '../../bin/adapters/commands.ts';
import { main } from '../../bin/shell.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
const catalog = await loadProjectCatalog();
function selection(preset, extra = {}) { return resolveProjectSelection(catalog, { schemaVersion: 1, catalogVersion: 1, preset, ...extra }); }
async function request(preset, extra = {}, answers = {}) {
  const selected = selection(preset, extra), guide = await projectGuide(selected, catalog);
  const { projectType, ...configuration } = selected;
  return { ...configuration, interview: { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version,
    answers: { title: 'Project matrix', pages: ['Overview', 'Details'], components: ['Summary'], approved: true, ...answers } } };
}
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'maker-presets-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
function context(root, value) { return { root, frameworkRoot, input: Readable.from(value ? [JSON.stringify(value)] : []) }; }
function mutate(fn) { const copy = structuredClone(catalog); fn(copy); return copy; }
test('catalog has all eight requested presets; presets are defaults, not framework identities', () => {
  assert.deepEqual(catalog.presets.map(item => item.id), ['plugin-nuxtui', 'plugin-vanilla', 'plugin-angular', 'webapp-nuxtui', 'webapp-vanilla', 'website', 'cli', 'hybrid']);
  assert.equal(selection('plugin-nuxtui', { framework: 'vanilla' }).projectType, 'plugin');
  assert.equal(selection('website', { framework: 'angular' }).framework, 'angular');
  assert.deepEqual(availableFrameworks(catalog, ['cli']), ['none']);
  assert.deepEqual(selection('hybrid', { framework: 'vanilla', targets: ['cli', 'webapp', 'plugin'] }).targets, ['plugin', 'webapp', 'cli']);
  const expanded = mutate(c => c.presets.push({ ...c.presets[0], id: 'internal-plugin', label: 'Internal plugin' }));
  assert.equal(readProjectCatalog(expanded).presets.length, 9);
  assert.equal(resolveProjectSelection(expanded, { schemaVersion: 1, catalogVersion: 1, preset: 'internal-plugin' }).framework, 'nuxtui');
});
test('catalog rejects malformed versions, adapters, names, defaults and incompatible Angular pins', () => {
  const mutations = [c => c.schemaVersion = 2, c => c.version = 0, c => c.extra = true,
    c => c.frameworks = [], c => c.frameworks[0].id = 'svelte', c => c.frameworks[0].label = '',
    c => c.frameworks[0].description = '\x1b[2J', c => c.frameworks[0].id = 'vanilla',
    c => c.targets[0].frameworks = ['none'], c => c.targets[3].frameworks = ['angular'],
    c => c.targets[0].id = 'unsupported', c => c.presets[0].id = '../bad', c => c.presets[0].id = c.presets[1].id,
    c => c.presets[0].projectType = 'desktop', c => c.presets[0].defaultFramework = 'none',
    c => c.presets[0].defaultFramework = 'unknown', c => c.presets[7].defaultFramework = 'none',
    c => c.angularPins.rxjs = '^7.8.2', c => delete c.angularPins.tslib,
    c => c.angularPins['@angular/core'] = '21.0.0'];
  for (const change of mutations) assert.throws(() => readProjectCatalog(mutate(change)), /./);
  for (const value of [null, 4, [], { version: 1 }]) assert.throws(() => readProjectCatalog(value));
});
test('selection rejects ambiguous/incompatible targets and never silently substitutes frameworks', () => {
  const invalid = [ ['unknown', {}], ['cli', { framework: 'nuxtui' }], ['website', { framework: 'none' }],
    ['cli', { targets: ['webapp'] }], ['plugin-angular', { framework: null }], ['hybrid', {}],
    ['hybrid', { targets: ['plugin'] }], ['hybrid', { targets: ['plugin', 'plugin'] }],
    ['hybrid', { targets: ['cli', '../plugin'] }], ['website', { targets: ['website', 'webapp'] }],
    ['website', { catalogVersion: 2 }], ['website', { unsafe: true }]];
  for (const [preset, extra] of invalid) assert.throws(() => selection(preset, extra));
  assert.throws(() => validateProjectSelection(catalog, { ...selection('cli'), projectType: 'plugin' }));
});
test('all presets compile through shared v6 validation into actual target-specific source', async () => {
  const template = await loadTemplateSnapshot(frameworkRoot);
  const document = runOperations(newDocument('Actual <source>'), [{ op: 'page.add', title: 'Page </script>' }]).document;
  for (const preset of catalog.presets) {
    const selected = selection(preset.id, preset.id === 'hybrid' ? { targets: ['plugin', 'webapp', 'cli'] } : {});
    const result = await compileProject({ source: documentText(document), outputKind: 'project', projectSelection: selected, template });
    assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
    assert.equal(result.readiness.dependencies, 'resolution-required');
    const files = new Map(result.artifacts.map(item => [item.path, item.content]));
    assert.deepEqual(JSON.parse(files.get('project.config.json')), selected);
    assert.deepEqual(openDocument(JSON.parse(files.get('design/project.json'))), document);
    assert.ok(!files.get('src/core/project.ts').includes('</script>'));
    assert.match(files.get('README.md'), /NOT a resolved dependency graph/);
    const pkg = JSON.parse(files.get('package.json'));
    assert.equal(JSON.parse(files.get('tsconfig.json')).compilerOptions.rewriteRelativeImportExtensions, undefined, 'no-emit SFC validation must not rewrite virtual .vue imports');
    for (const path of ['tsconfig.angular.json', 'tsconfig.cli.json']) if (files.has(path)) assert.equal(JSON.parse(files.get(path)).compilerOptions.rewriteRelativeImportExtensions, true, path);
    for (const target of selected.targets) assert.ok(files.has(`src/targets/${target}/main.ts`));
    if (selected.framework === 'none') { assert.ok(!files.has('src/ui/mount.ts')); assert.ok(!pkg.devDependencies.vite); assert.ok(!pkg.scripts['build:prototype']); }
    if (selected.framework === 'vanilla') { assert.deepEqual(pkg.dependencies, {}); assert.match(files.get('src/ui/mount.ts'), /createElement/); }
    if (selected.framework === 'angular') {
      assert.ok(files.has('scripts/angular-linker.mjs')); assert.equal(pkg.devDependencies['@babel/core'], '7.29.0');
      assert.ok(pkg.dependencies['@angular/core']); assert.ok(!pkg.dependencies.vue); assert.ok(!pkg.dependencies['zone.js']);
      assert.match(files.get('src/ui/mount.ts'), /createApplication/); assert.match(files.get('src/ui/mount.ts'), /app.destroy/);
      assert.equal(JSON.parse(files.get('tsconfig.angular.json')).angularCompilerOptions.compilationMode, 'full');
    }
    if (selected.framework === 'nuxtui') {
      assert.equal(pkg.dependencies['@nuxt/ui'], '4.11.2'); assert.ok(!pkg.dependencies.nuxt);
      assert.match(files.get('scripts/bundling/vite-shared.mjs'), /Unqualified Nuxt UI module/);
      assert.ok(files.has('src/ui/Starter.vue'));
      for (const [, imported] of files.get('scripts/bundling/vite-shared.mjs').matchAll(/from ['"](\.\/[^'"]+)['"]/g)) assert.ok(files.has('scripts/bundling/' + imported.slice(2)), imported);
    }
    assert.ok(result.diagnostics.some(item => item.code === 'COMPILER_ADAPTER_REQUIRED'));
  }
  const missing = await compileProject({ source: documentText(document), outputKind: 'project', template });
  assert.equal(missing.status, 'failed'); assert.equal(missing.artifacts.length, 0);
  const conflicting = await compileProject({ source: documentText(document), outputKind: 'clickdummy', projectSelection: selection('cli'), template });
  assert.equal(conflicting.status, 'failed');
});
test('new guide discovery produces safe parseable replay input with explicit agreement still false', async () => scratch(async root => {
  const discovered = await execute(parseArguments(['new', 'guide', '--preset', 'cli']), context(root));
  assert.equal(discovered.input.interview.answers.approved, false);
  assert.match(discovered.guide.context, /none/);
  discovered.input.interview.answers.title = 'CLI review';
  const data = await execute(parseArguments(['new', 'validate', '--input', '-']), context(root, discovered.input));
  assert.equal(data.ready, false); assert.match(data.brief, /No frontend/);
  assert.deepEqual((await execute(parseArguments(['new', 'presets']), context(root))).catalog, catalog);
  const hybrid = await execute(parseArguments(['new', 'guide', '--preset', 'hybrid', '--framework', 'angular', '--targets', 'cli,plugin']), context(root));
  assert.deepEqual(hybrid.selection.targets, ['plugin', 'cli']);
}));
test('project plan has deterministic bytes, default no writes, independent sidecars and safe regeneration', async () => scratch(async root => {
  const input = await request('webapp-vanilla');
  const options = { root, frameworkRoot, out: 'prepared', input };
  const a = await projectPlan(options), b = await projectPlan(options);
  assert.equal(a.planHash, b.planHash);
  await assert.rejects(() => readFile(join(root, 'prepared/project.config.json')));
  assert.match(a.data.prompt, /vanilla/); assert.doesNotMatch(a.data.prompt, /\{\{\w/);
  await assert.rejects(() => applyPrepared(a, 'not-the-reviewed-hash'), /plan changed/);
  assert.equal((await applyPrepared(a, a.planHash)).status, 'applied');
  const read = async path => JSON.parse(await readFile(join(root, 'prepared', path), 'utf8'));
  const doc = openDocument(await read('companion.project.json'));
  assert.equal(doc.design.nodes.length, 2); assert.ok(!Object.hasOwn(doc, 'framework'));
  assert.deepEqual(await read('project.config.json'), await read('source/project.config.json'));
  assert.equal((await read('prototype.manifest.json')).artifact.sha256, null);
  const replay = await read('project-request.json'); assert.equal((await projectRequest(replay)).ready, true);
  const unchanged = await projectPlan(options); assert.equal((await applyPrepared(unchanged, unchanged.planHash)).status, 'unchanged');
  await writeFile(join(root, 'prepared/source/src/core/project.ts'), '// user-owned change\n');
  await assert.rejects(() => projectPlan(options), /modified|edited|conflict|owned/i);
}));
test('unapproved, unresolved, stale-guide and unsafe-directory requests fail without producing source', async () => scratch(async root => {
  const input = await request('cli');
  for (const changes of [{ approved: false }, { conceptBoards: 'requested' }, { openQuestions: ['Which users?'] }]) {
    const changed = structuredClone(input); Object.assign(changed.interview.answers, changes);
    assert.equal((await projectRequest(changed)).ready, false);
    await assert.rejects(() => projectPlan({ root, frameworkRoot, out: 'bad', input: changed }), /agree|exploration|questions/);
  }
  const stale = structuredClone(input); stale.interview.guideVersion = 99;
  await assert.rejects(() => projectRequest(stale), /guideId\/guideVersion/);
  await assert.rejects(() => projectRequest({ ...input, unknown: true }), /Unknown fields/);
  await assert.rejects(() => projectPlan({ root, frameworkRoot, out: '../escape', input }));
  await assert.rejects(() => projectPlan({ root, frameworkRoot, out: 'cancelled', input, signal: AbortSignal.abort() }));
  await assert.rejects(() => readFile(join(root, 'bad/companion.project.json')));
}));
test('agent selection flags cannot silently override input; irrelevant action flags are rejected', async () => scratch(async root => {
  const input = await request('cli');
  const commands = [ ['new', '--input', '-', '--framework', 'angular'], ['new', 'presets', '--apply', 'x'],
    ['new', 'guide', '--input', '-'], ['new', 'validate', '--input', '-', '--apply', 'x'],
    ['new', 'unknown'], ['new', '--project', 'x'], ['new'], ['sketch', 'show', '--preset', 'cli'] ];
  for (const args of commands) await assert.rejects(() => execute(parseArguments(args), context(root, input)));
}));
test('machine stdout stays one JSON response, including TTY/CI and failed validation', async () => scratch(async root => {
  const input = await request('cli');
  const output = [], errors = [];
  const io = { input: Readable.from([JSON.stringify(input)]), output: new Writable({ write(c, _e, done) { output.push(String(c)); done(); } }),
    error: new Writable({ write(c, _e, done) { errors.push(String(c)); done(); } }), env: {} };
  io.input.isTTY = true; io.error.isTTY = true;
  assert.equal(await main(['new', '--input', '-', '--json', '--ui', 'tui', '--root', root, '--out', 'machine'], frameworkRoot, io), 0);
  assert.equal(output.length, 1); assert.equal(JSON.parse(output[0]).status, 'planned'); assert.equal(errors.length, 0);
  const child = spawnSync(process.execPath, ['--experimental-strip-types', 'shell.mjs', 'new', '--list', '--json'], { cwd: frameworkRoot, encoding: 'utf8', timeout: 15000 });
  assert.equal(child.status, 0, child.stderr + child.stdout);
  assert.ok(JSON.parse(child.stdout).data);
}));
test('sketch regeneration respects a saved project selection rather than defaulting to Vue plugins', async () => scratch(async root => {
  await mkdir(join(root, 'design'));
  const document = runOperations(newDocument('CLI'), [{ op: 'page.add', title: 'Commands' }]).document;
  await writeFile(join(root, 'design/project.json'), documentText(document));
  await writeFile(join(root, 'project.config.json'), JSON.stringify(selection('cli')));
  const plan = await execute(parseArguments(['sketch', 'generate', '--out', 'code']), context(root));
  assert.equal(plan.outputKind, 'project');
  assert.ok(plan.changes.some(item => item.path === 'code/src/targets/cli/main.ts'));
  assert.ok(!plan.changes.some(item => item.path === 'code/src/ui/Starter.vue'));
}));

test('selection replay excludes the derived type and does not alias the saved target list', () => {
  const original = selection('hybrid', { framework: 'vanilla', targets: ['plugin', 'cli'] });
  const replay = projectSelectionRequest(original);
  assert.deepEqual(Object.keys(replay), ['schemaVersion', 'catalogVersion', 'preset', 'framework', 'targets']);
  assert.deepEqual(resolveProjectSelection(catalog, replay), original);
  replay.targets.pop(); assert.deepEqual(original.targets, ['plugin', 'cli']);
});

test('new help retains legacy creation metadata alongside discoverable preset guidance', async () => scratch(async root => {
  const help = await execute(parseArguments(['new', '--help']), context(root));
  const legacy = help.commands.find(command => command.id === 'new');
  assert.equal(legacy.options.from, 'value'); assert.equal(legacy.options.starter, 'value');
  assert.match(help.help, /new <dir>.*--from <project\.json>/);
  assert.match(help.help, /new presets --json/);
  assert.deepEqual(help.makerCommands, ['new', 'sketch', 'prototype', 'settings', 'project-setup', 'first-run']);
  legacy.options.from = 'flag';
  const again = await execute(parseArguments(['new', '--help']), context(root));
  assert.equal(again.commands[0].options.from, 'value', 'Help cannot mutate command policy');
}));
