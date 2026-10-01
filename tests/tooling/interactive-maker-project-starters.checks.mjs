import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { projectStarters, projectStarter, projectGuide, projectRequest, projectPlan } from '../../bin/adapters/projects.ts';
import { readProjectGenerator, projectSelection, validateProjectSelection, angularPackages } from '../../scripts/compiler/domain/project-starter.ts';
import { compileProject, loadTemplateSnapshot } from '../../scripts/compiler/index.ts';
import { newDocument, documentText, openDocument } from '../../bin/domain/document.ts';
import { runOperations } from '../../bin/application/operations.ts';
import { applyPrepared } from '../../bin/adapters/storage.ts';
import { execute, parseArguments } from '../../bin/adapters/commands.ts';
// Maker-only surface: these requests must not be routed to the framework CLI.
import { makerMain as main } from '../../bin/app.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
const starters = await projectStarters(frameworkRoot);
const expectedIds = ['cli', 'hybrid-angular', 'hybrid-nuxtui', 'hybrid-vanilla', 'plugin-angular', 'plugin-nuxtui', 'plugin-vanilla', 'webapp-angular', 'webapp-nuxtui', 'webapp-vanilla', 'website'];
const useCaseMatrix = Object.freeze({
  'obsidian-plugin': ['plugin-angular', 'plugin-nuxtui', 'plugin-vanilla'],
  webapp: ['webapp-angular', 'webapp-nuxtui', 'webapp-vanilla'],
  'terminal-app': ['cli'],
  website: ['website'],
});
const selection = id => starters.find(item => item.id === id).selection;
const identity = { id: 'custom-project', version: '1.0.0', sha256: 'a'.repeat(64) };
const pins = Object.fromEntries(angularPackages.map(name => [name, name.startsWith('@angular/') ? '22.0.0' : name === 'rxjs' ? '7.8.2' : '2.8.1']));
async function request(id, answers = {}) {
  const guide = await projectGuide(selection(id));
  return { schemaVersion: 2, starter: id, interview: { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version,
    answers: { title: 'Project matrix', pages: ['Overview', 'Details'], components: ['Summary'], approved: true, ...answers } } };
}
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'maker-starters-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
function context(root, value) { return { root, frameworkRoot, input: Readable.from(value ? [JSON.stringify(value)] : []) }; }
test('installed project starters replace the preset catalog; each records its own identity and complete selection', () => {
  assert.deepEqual(starters.map(item => item.id), expectedIds);
  for (const starter of starters) {
    assert.deepEqual(starter.selection.starter, { id: starter.id, version: starter.version, sha256: starter.sha256 });
    assert.deepEqual(validateProjectSelection(structuredClone(starter.selection)), starter.selection);
    assert.equal(starter.file, `configs/starters/${starter.id}.json`);
  }
  assert.deepEqual(selection('webapp-angular').targets, ['webapp']); assert.equal(selection('webapp-angular').framework, 'angular');
  assert.deepEqual(selection('hybrid-vanilla').targets, ['plugin', 'webapp', 'website', 'cli']);
  assert.equal(selection('cli').framework, 'none'); assert.equal(selection('cli').angularPins, undefined);
  const angular = starters.filter(item => item.selection.framework === 'angular');
  assert.deepEqual(angular.map(item => item.id), ['hybrid-angular', 'plugin-angular', 'webapp-angular']);
  for (const item of angular) assert.deepEqual(item.selection.angularPins, pins, 'Offline inputs provision one reviewed Angular pin set.');
});
test('primary project use-cases have complete starter coverage and expected variants', () => {
  for (const [useCase, ids] of Object.entries(useCaseMatrix)) for (const id of ids)
    assert.ok(selection(id), useCase + ' is missing ' + id);
  assert.deepEqual(useCaseMatrix['obsidian-plugin'].map(id => selection(id).framework).sort(), ['angular', 'nuxtui', 'vanilla']);
  assert.deepEqual(useCaseMatrix.webapp.map(id => selection(id).framework).sort(), ['angular', 'nuxtui', 'vanilla']);
  assert.deepEqual(selection('cli').targets, ['cli']);
  assert.deepEqual(selection('website').targets, ['website']);
});
test('project generator rejects unknown fields, adapters, target sets and Angular pin drift', () => {
  const valid = { kind: 'project', projectType: 'hybrid', framework: 'vanilla', targets: ['plugin', 'cli'] };
  assert.deepEqual(readProjectGenerator(valid), valid);
  assert.deepEqual(readProjectGenerator({ kind: 'project', projectType: 'plugin', framework: 'angular', targets: ['plugin'], angularPins: pins }).angularPins, pins);
  const invalid = [null, [], 4, { ...valid, extra: true }, { ...valid, kind: 'files' }, { ...valid, projectType: 'desktop' }, { ...valid, framework: 'Svelte UI' },
    { ...valid, targets: [] }, { ...valid, targets: 'plugin' }, { ...valid, targets: ['plugin', 'plugin'] }, { ...valid, targets: ['cli', 'plugin'] },
    { ...valid, targets: ['plugin', '../cli'] }, { ...valid, targets: ['plugin', 'webapp', 'website', 'cli', 'cli'] }, { ...valid, targets: ['plugin'] },
    { kind: 'project', projectType: 'website', framework: 'vanilla', targets: ['webapp'] }, { kind: 'project', projectType: 'website', framework: 'vanilla', targets: ['website', 'webapp'] },
    { kind: 'project', projectType: 'cli', framework: 'nuxtui', targets: ['cli'] }, { kind: 'project', projectType: 'website', framework: 'none', targets: ['website'] },
    { ...valid, framework: 'angular' }, { ...valid, angularPins: pins }, { ...valid, framework: 'angular', angularPins: { ...pins, rxjs: '^7.8.2' } },
    { ...valid, framework: 'angular', angularPins: { ...pins, tslib: undefined } }, { ...valid, framework: 'angular', angularPins: { ...pins, '@angular/core': '21.0.0' } },
    { ...valid, framework: 'angular', angularPins: { ...pins, zone: '1.0.0' } }, { ...valid, framework: 'angular', angularPins: [] }];
  for (const value of invalid) assert.throws(() => readProjectGenerator(value), /./, JSON.stringify(value));
});
test('saved selections and identities are strict; legacy preset sidecars are refused explicitly', () => {
  const saved = projectSelection(identity, { kind: 'project', projectType: 'cli', framework: 'none', targets: ['cli'] });
  assert.deepEqual(saved, { schemaVersion: 2, starter: identity, projectType: 'cli', framework: 'none', targets: ['cli'] });
  for (const starter of [{ ...identity, id: '../x' }, { ...identity, version: 'latest' }, { ...identity, sha256: 'no' }, { ...identity, name: 'extra' }, 'cli'])
    assert.throws(() => validateProjectSelection({ ...saved, starter }));
  assert.throws(() => validateProjectSelection({ ...saved, projectType: 'plugin' }));
  assert.throws(() => validateProjectSelection({ ...saved, kind: 'project' }), /Unknown/);
  assert.throws(() => validateProjectSelection({ schemaVersion: 1, catalogVersion: 1, preset: 'cli', projectType: 'cli', framework: 'none', targets: ['cli'] }), /Unknown|Unsupported/);
  assert.throws(() => validateProjectSelection({ ...saved, schemaVersion: 1 }), /project starter/);
  assert.throws(() => projectSelection(identity, { kind: 'companion' }));
});
test('every project starter compiles through shared v6 validation into actual target-specific source', async () => {
  const template = await loadTemplateSnapshot(frameworkRoot);
  const document = runOperations(newDocument('Actual <source>'), [{ op: 'page.add', title: 'Page </script>' }]).document;
  for (const { selection: selected } of starters) {
    const result = await compileProject({ source: documentText(document), outputKind: 'project', projectSelection: selected, template });
    assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
    assert.equal(result.readiness.dependencies, 'resolution-required');
    const files = new Map(result.artifacts.map(item => [item.path, item.content]));
    assert.deepEqual(JSON.parse(files.get('project.config.json')), selected);
    assert.deepEqual(openDocument(JSON.parse(files.get('design/project.json'))), document);
    assert.ok(!files.get('src/core/project.ts').includes('</script>'));
    assert.match(files.get('README.md'), /NOT a resolved dependency graph/); assert.match(files.get('README.md'), new RegExp('Starter: ' + selected.starter.id));
    const pkg = JSON.parse(files.get('package.json'));
    const tsconfig = JSON.parse(files.get('tsconfig.json'));
    assert.equal(tsconfig.compilerOptions.rewriteRelativeImportExtensions, undefined, 'no-emit SFC validation must not rewrite virtual .vue imports');
    assert.equal(tsconfig.compilerOptions.resolveJsonModule, true);
    assert.ok(tsconfig.include.includes('plugins/**/*.ts'));
    assert.match(pkg.scripts.test, /plugins\/\*\/tests\/\*\.test\.ts/);
    for (const path of ['src/core/plugin-api.ts', 'src/core/plugin-runtime.ts', 'plugins/registry.ts', 'plugins/starter-extension/manifest.json',
      'plugins/starter-extension/config.json', 'plugins/starter-extension/src/index.ts', 'plugins/starter-extension/tests/plugin.test.ts', 'plugins/README.md'])
      assert.ok(files.has(path), path);
    assert.match(files.get('src/core/plugin-api.ts'), /interface PluginObject/);
    assert.match(files.get('plugins/starter-extension/src/index.ts'), /export const PluginObject/);
    assert.equal(JSON.parse(files.get('plugins/starter-extension/manifest.json')).id, 'starter-extension');
    assert.equal(JSON.parse(files.get('plugins/starter-extension/config.json')).enabled, true);
    for (const path of ['configs/types/tsconfig.angular.json', 'configs/types/tsconfig.cli.json']) if (files.has(path)) assert.equal(JSON.parse(files.get(path)).compilerOptions.rewriteRelativeImportExtensions, true, path);
    if (selected.targets.includes('cli')) {
      assert.equal(JSON.parse(files.get('configs/types/tsconfig.cli.json')).compilerOptions.rootDir, '../..');
      assert.equal(pkg.scripts['start:cli'], 'node dist/cli/src/targets/cli/main.js');
    }
    for (const target of selected.targets) assert.ok(files.has(`src/targets/${target}/main.ts`));
    if (selected.framework === 'none') { assert.ok(!files.has('src/ui/mount.ts')); assert.ok(!pkg.devDependencies.vite); assert.ok(!pkg.scripts['build:prototype']); }
    if (selected.framework === 'vanilla') { assert.deepEqual(pkg.dependencies, {}); assert.match(files.get('src/ui/mount.ts'), /createElement/); }
    if (selected.framework === 'angular') {
      assert.ok(files.has('scripts/angular-linker.mjs')); assert.equal(pkg.devDependencies['@babel/core'], '7.29.0');
      assert.equal(pkg.dependencies['@angular/core'], selected.angularPins['@angular/core']); assert.equal(pkg.devDependencies['@angular/compiler-cli'], selected.angularPins['@angular/compiler-cli']);
      assert.ok(!pkg.dependencies.vue); assert.ok(!pkg.dependencies['zone.js']);
      assert.match(files.get('src/ui/mount.ts'), /createApplication/); assert.match(files.get('src/ui/mount.ts'), /app.destroy/);
      assert.equal(JSON.parse(files.get('configs/types/tsconfig.angular.json')).angularCompilerOptions.compilationMode, 'full');
    }
    if (selected.framework === 'nuxtui') {
      assert.equal(pkg.dependencies['@nuxt/ui'], '4.11.2'); assert.ok(!pkg.dependencies.nuxt);
      assert.match(files.get('scripts/bundling/vite-shared.mjs'), /Unqualified Nuxt UI module/);
      assert.ok(files.has('src/ui/Starter.vue'));
      for (const [, imported] of files.get('scripts/bundling/vite-shared.mjs').matchAll(/from ['"](\.\/[^'"]+)['"]/g)) assert.ok(files.has('scripts/bundling/' + imported.slice(2)), imported);
    }
    assert.ok(result.diagnostics.some(item => item.code === 'COMPILER_ADAPTER_REQUIRED'));
  }
  for (const projectSelection of [undefined, { ...selection('cli'), framework: 'nuxtui' }, { ...selection('cli'), schemaVersion: 1 }]) {
    const refused = await compileProject({ source: documentText(document), outputKind: 'project', projectSelection, template });
    assert.equal(refused.status, 'failed'); assert.equal(refused.artifacts.length, 0);
  }
  const conflicting = await compileProject({ source: documentText(document), outputKind: 'clickdummy', projectSelection: selection('cli'), template });
  assert.equal(conflicting.status, 'failed');
});
test('new starters and new guide discovery produce safe parseable replay input with explicit agreement still false', async () => scratch(async root => {
  const listed = await execute(parseArguments(['new', 'starters']), context(root));
  assert.deepEqual(listed.starters.map(item => item.id), expectedIds);
  assert.deepEqual(listed.flow, ['starter', 'prototype', 'agreement', 'plan-review', 'apply']);
  assert.deepEqual(listed.starters.find(item => item.id === 'hybrid-angular').targets, ['plugin', 'webapp', 'website', 'cli']);
  const discovered = await execute(parseArguments(['new', 'guide', '--starter', 'cli']), context(root));
  assert.equal(discovered.input.schemaVersion, 2); assert.equal(discovered.input.starter, 'cli');
  assert.equal(discovered.input.interview.answers.approved, false);
  assert.match(discovered.guide.context, /none/); assert.deepEqual(discovered.selection, selection('cli'));
  discovered.input.interview.answers.title = 'CLI review';
  const data = await execute(parseArguments(['new', 'validate', '--input', '-']), context(root, discovered.input));
  assert.equal(data.ready, false); assert.match(data.brief, /No frontend/);
  await assert.rejects(() => execute(parseArguments(['new', 'guide']), context(root)), /--starter/);
  await assert.rejects(() => execute(parseArguments(['new', 'guide', '--starter', 'webapp']), context(root)), /installed project starter/);
  await assert.rejects(() => execute(parseArguments(['new', 'guide', '--starter', 'hybrid']), context(root)), /hybrid-nuxtui/);
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
  assert.deepEqual((await read('project.config.json')).starter, selection('webapp-vanilla').starter);
  assert.equal((await read('prototype.manifest.json')).artifact.sha256, null);
  const replay = await read('project-request.json'); assert.deepEqual(Object.keys(replay), ['schemaVersion', 'starter', 'interview']);
  assert.equal((await projectRequest(replay, frameworkRoot)).ready, true);
  const unchanged = await projectPlan(options); assert.equal((await applyPrepared(unchanged, unchanged.planHash)).status, 'unchanged');
  await writeFile(join(root, 'prepared/source/src/core/project.ts'), '// user-owned change\n');
  await assert.rejects(() => projectPlan(options), /modified|edited|conflict|owned/i);
}));
test('unapproved, unresolved, stale-guide, legacy-preset and unsafe-directory requests fail without producing source', async () => scratch(async root => {
  const input = await request('cli');
  for (const changes of [{ approved: false }, { conceptBoards: 'requested' }, { openQuestions: ['Which users?'] }]) {
    const changed = structuredClone(input); Object.assign(changed.interview.answers, changes);
    assert.equal((await projectRequest(changed, frameworkRoot)).ready, false);
    await assert.rejects(() => projectPlan({ root, frameworkRoot, out: 'bad', input: changed }), /agree|exploration|questions/);
  }
  const stale = structuredClone(input); stale.interview.guideVersion = 99;
  await assert.rejects(() => projectRequest(stale, frameworkRoot), /guideId\/guideVersion/);
  await assert.rejects(() => projectRequest({ ...input, unknown: true }, frameworkRoot), /Unknown fields/);
  await assert.rejects(() => projectRequest({ ...input, schemaVersion: 1 }, frameworkRoot), /schemaVersion 2/);
  await assert.rejects(() => projectRequest({ schemaVersion: 1, catalogVersion: 1, preset: 'cli', interview: input.interview }, frameworkRoot), /Unknown fields/);
  for (const starter of ['missing', 'blank', undefined]) await assert.rejects(() => projectRequest({ ...input, starter }, frameworkRoot), /project starter/);
  await assert.rejects(() => projectPlan({ root, frameworkRoot, out: '../escape', input }));
  await assert.rejects(() => projectPlan({ root, frameworkRoot, out: 'cancelled', input, signal: AbortSignal.abort() }));
  await assert.rejects(() => readFile(join(root, 'bad/companion.project.json')));
}));
test('an empty shell has no project starters and no hidden fallback', async () => scratch(async root => {
  assert.deepEqual(await projectStarters(root), []);
  await assert.rejects(() => projectStarter(root, 'cli'), /No project starters are installed/);
  await assert.rejects(() => execute(parseArguments(['new', 'guide', '--starter', 'cli']), { ...context(root), frameworkRoot: root }), /Extract the separate starters ZIP/);
}));
test('agent selection flags cannot silently override input; irrelevant action flags are rejected', async () => scratch(async root => {
  const input = await request('cli');
  const commands = [['new', '--input', '-', '--starter', 'plugin-angular'], ['new', 'starters', '--apply', 'x'], ['new', 'starters', '--starter', 'cli'],
    ['new', 'guide', '--input', '-'], ['new', 'validate', '--input', '-', '--apply', 'x'], ['new', 'presets'], ['new', '--preset', 'cli'],
    ['new', 'unknown'], ['new', '--project', 'x'], ['new'], ['sketch', 'show', '--starter', 'cli'], ['new', 'guide', '--framework', 'angular']];
  for (const args of commands) await assert.rejects(async () => execute(parseArguments(args), context(root, input)), args.join(' '));
  for (const [args, code] of [[['new', '--starter', 'cli'], 'PROJECT_TERMINAL_REQUIRED'], [['new', '--starter', 'blank'], 'TARGET_REQUIRED'], [['new', '--input', '-', '--starter', 'cli'], 'PROJECT_AMBIGUOUS_INPUT']])
    await assert.rejects(() => execute(parseArguments(args), context(root, input)), error => error.code === code, code);
}));
test('machine stdout stays one JSON response; directory creation refuses project starters', async () => scratch(async root => {
  const input = await request('cli');
  const output = [], errors = [];
  const io = { input: Readable.from([JSON.stringify(input)]), output: new Writable({ write(c, _e, done) { output.push(String(c)); done(); } }),
    error: new Writable({ write(c, _e, done) { errors.push(String(c)); done(); } }), env: {} };
  io.input.isTTY = true; io.error.isTTY = true;
  assert.equal(await main(['new', '--input', '-', '--json', '--ui', 'tui', '--root', root, '--out', 'machine'], frameworkRoot, io), 0);
  assert.equal(output.length, 1); assert.equal(JSON.parse(output[0]).status, 'planned'); assert.equal(errors.length, 0);
  const shell = args => spawnSync(process.execPath, ['--experimental-strip-types', 'shell.mjs', ...args, '--json'], { cwd: frameworkRoot, encoding: 'utf8', timeout: 30000 });
  const child = shell(['new', '--list']);
  assert.equal(child.status, 0, child.stderr + child.stdout);
  const listed = JSON.parse(child.stdout).data.starters.find(item => item.id === 'cli');
  assert.equal(listed.generator, 'project'); assert.deepEqual(listed.project, { projectType: 'cli', framework: 'none', targets: ['cli'] });
  const guided = shell(['new', 'guide', '--starter', 'cli']);
  assert.equal(guided.status, 0, guided.stderr + guided.stdout); assert.equal(JSON.parse(guided.stdout).data.input.starter, 'cli');
  const directory = shell(['new', join(root, 'direct'), '--starter', 'cli']);
  assert.equal(directory.status, 1); assert.equal(JSON.parse(directory.stdout).diagnostics[0].code, 'STARTER_KIND');
  await assert.rejects(() => readFile(join(root, 'direct/package.json')));
}));
test('sketch regeneration respects a saved starter selection and refuses legacy preset sidecars', async () => scratch(async root => {
  await mkdir(join(root, 'design'));
  const document = runOperations(newDocument('CLI'), [{ op: 'page.add', title: 'Commands' }]).document;
  await writeFile(join(root, 'design/project.json'), documentText(document));
  await writeFile(join(root, 'project.config.json'), JSON.stringify(selection('cli')));
  const plan = await execute(parseArguments(['sketch', 'generate', '--out', 'code']), context(root));
  assert.equal(plan.outputKind, 'project');
  assert.ok(plan.changes.some(item => item.path === 'code/src/targets/cli/main.ts'));
  assert.ok(!plan.changes.some(item => item.path === 'code/src/ui/Starter.vue'));
  assert.equal((await execute(parseArguments(['sketch', 'generate', '--out', 'code', '--apply', plan.planHash]), context(root))).status, 'applied');
  assert.deepEqual(JSON.parse(await readFile(join(root, 'code/project.config.json'), 'utf8')), selection('cli'));
  await writeFile(join(root, 'project.config.json'), JSON.stringify({ schemaVersion: 1, catalogVersion: 1, preset: 'cli', projectType: 'cli', framework: 'none', targets: ['cli'] }));
  await assert.rejects(() => execute(parseArguments(['sketch', 'generate', '--out', 'code']), context(root)), /Unknown|Unsupported/);
}));
test('new help documents project starters alongside directory-creation metadata', async () => scratch(async root => {
  const help = await execute(parseArguments(['new', '--help']), context(root));
  const legacy = help.commands.find(command => command.id === 'new');
  assert.equal(legacy.options.from, 'value'); assert.equal(legacy.options.starter, 'value');
  assert.match(help.help, /new <dir>.*--from <project\.json>/);
  assert.match(help.help, /new starters --json/); assert.match(help.help, /new guide --starter/);
  assert.doesNotMatch(help.help, /--preset|--framework|--targets|new presets/);
  assert.deepEqual(help.makerCommands, ['new', 'brainstorm', 'sketch', 'prototype', 'settings', 'project-setup', 'first-run']);
  legacy.options.from = 'flag';
  const again = await execute(parseArguments(['new', '--help']), context(root));
  assert.equal(again.commands[0].options.from, 'value', 'Help cannot mutate command policy');
}));
