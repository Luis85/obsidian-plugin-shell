import test from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture, projects, read, readJson, repository, source, write } from './support/source-fixture.mjs';

const manifestWith = edit => { const value = { schemaVersion: 1, projects: projects() }; edit(value.projects); return value; };
const byName = (list, name) => list.find(item => item.name === name);
/** Asserts `source check` fails with exit 1 and the given finding code. */
async function finds(root, code) {
  const checked = await source(root, 'check');
  assert.equal(checked.status, 1, JSON.stringify(checked.result));
  assert.equal(checked.result.status, 'blocked');
  assert.ok(checked.codes.includes(code), `${code} not in ${checked.codes.join(', ')}`);
  return checked;
}

test('a consistent repository: check is ok with exit 0; list and graph report projects, aliases and the build order', async t => {
  const root = await fixture(t);
  const [checked, listed, graph] = await Promise.all([source(root, 'check'), source(root, 'list'), source(root, 'graph')]);
  assert.equal(checked.status, 0, JSON.stringify(checked.result.diagnostics));
  assert.deepEqual([checked.result.protocolVersion, checked.result.command, checked.result.status, checked.result.data.findings], [1, 'source check', 'ok', []]);
  assert.equal(listed.result.data.manifest, 'declared');
  assert.deepEqual(listed.result.data.projects.map(item => [item.name, item.alias]), [['shared', '#shared/*'], ['tui', '#tui/*'], ['cli', null], ['plugin', null]]);
  assert.deepEqual(byName(listed.result.data.projects, 'shared').dependents, ['tui', 'cli', 'plugin']);
  assert.deepEqual(graph.result.data.order, ['shared', 'tui', 'cli', 'plugin']);
  assert.deepEqual(graph.result.data.adjacency.cli, ['shared', 'tui']);
  assert.deepEqual(graph.result.data.dependents.tui, ['cli']);
});

test('this repository is consistent with its own workbench.sources.json', async () => {
  const checked = await source(repository, 'check');
  assert.equal(checked.status, 0, JSON.stringify(checked.result.diagnostics, null, 2));
  assert.equal(checked.result.data.projects, 5);
});

test('a legacy project without a manifest reports SOURCE_MANIFEST_MISSING; check --fix declares the implicit project without moving files', async t => {
  const root = await fixture(t);
  await rm(join(root, 'workbench.sources.json'));
  await rm(join(root, 'src'), { recursive: true });
  await write(root, 'src/main.ts', 'export {};\n');
  const missing = await finds(root, 'SOURCE_MANIFEST_MISSING');
  assert.equal(missing.result.diagnostics[0].next, 'source check --fix');
  assert.deepEqual((await source(root, 'list')).result.data.projects.map(item => [item.name, item.path]), [['plugin', 'src']]);
  const preview = await source(root, 'check', '--fix');
  assert.equal(preview.result.status, 'planned');
  assert.deepEqual(preview.result.data.changes.map(change => [change.path, change.status]), [['workbench.sources.json', 'create']]);
  await assert.rejects(read(root, 'workbench.sources.json'), { code: 'ENOENT' });
  const applied = await source(root, 'check', '--fix', '--apply', preview.result.data.planHash);
  assert.equal(applied.result.status, 'applied', JSON.stringify(applied.result.diagnostics));
  assert.deepEqual(await readJson(root, 'workbench.sources.json'), { schemaVersion: 1, projects: [{ name: 'plugin', kind: 'plugin', path: 'src', references: [] }] });
  assert.equal(await read(root, 'src/main.ts'), 'export {};\n');
});

test('an invalid manifest is reported and left untouched; --fix refuses to regenerate from it', async t => {
  const root = await fixture(t);
  const text = JSON.stringify({ schemaVersion: 1, projects: projects(), extra: true });
  await write(root, 'workbench.sources.json', text);
  const invalid = await finds(root, 'SOURCE_MANIFEST_INVALID');
  assert.match(invalid.result.diagnostics[0].message, /"extra"/);
  const fix = await source(root, 'check', '--fix', '--yes');
  assert.equal(fix.status, 1);
  assert.equal(fix.result.diagnostics[0].code, 'SOURCE_MANIFEST_INVALID');
  assert.equal(await read(root, 'workbench.sources.json'), text);
});

test('graph findings: a cycle and an unknown reference each fail the check, and --fix refuses to derive from them', async t => {
  const cyclic = await fixture(t, { manifest: manifestWith(list => { list[0].references = ['cli']; }) });
  const cycle = await finds(cyclic, 'SOURCE_CYCLE');
  assert.match(cycle.result.diagnostics.find(item => item.code === 'SOURCE_CYCLE').message, /shared -> cli -> shared/);
  assert.equal((await source(cyclic, 'check', '--fix')).result.diagnostics[0].code, 'SOURCE_CYCLE');
  // No tsconfig can be derived for an unknown reference, so it is declared after a clean setup.
  const root = await fixture(t);
  await write(root, 'workbench.sources.json', JSON.stringify(manifestWith(list => { list[3].references = ['shared', 'ghost']; })));
  assert.match((await finds(root, 'SOURCE_UNKNOWN_REFERENCE')).result.diagnostics[0].message, /plugin references "ghost"/);
});

test('a declared project path that does not exist is SOURCE_PATH_MISSING', async t => {
  const root = await fixture(t);
  await rm(join(root, 'src/plugin'), { recursive: true });
  assert.match((await finds(root, 'SOURCE_PATH_MISSING')).result.diagnostics.find(item => item.code === 'SOURCE_PATH_MISSING').message, /src\/plugin does not exist/);
});

test('tsconfig drift is fixed only through the reviewed plan: preview writes nothing, apply regenerates, check passes', async t => {
  const root = await fixture(t);
  const config = await readJson(root, 'src/plugin/tsconfig.json');
  await write(root, 'src/plugin/tsconfig.json', JSON.stringify({ ...config, references: [] }));
  await rm(join(root, 'src/tui/tests/tsconfig.json'));
  const drifted = await finds(root, 'SOURCE_TSCONFIG_DRIFT');
  assert.equal(drifted.result.data.fixable, 2);
  const before = await read(root, 'src/plugin/tsconfig.json');
  const preview = await source(root, 'check', '--fix');
  assert.deepEqual(preview.result.data.changes.map(change => [change.path, change.status]).sort(), [['src/plugin/tsconfig.json', 'update'], ['src/tui/tests/tsconfig.json', 'create']]);
  assert.equal(await read(root, 'src/plugin/tsconfig.json'), before);
  assert.equal((await source(root, 'check', '--fix', '--yes')).result.status, 'applied');
  assert.deepEqual((await readJson(root, 'src/plugin/tsconfig.json')).references, [{ path: '../shared' }]);
  assert.deepEqual((await readJson(root, 'src/tui/tests/tsconfig.json')).references, [{ path: '..' }, { path: '../../shared' }]);
  assert.equal((await source(root, 'check')).status, 0);
});

test('the root solution and package.json "imports" drift are found and regenerated without touching other entries', async t => {
  const root = await fixture(t);
  const solution = await readJson(root, 'tsconfig.json');
  await write(root, 'tsconfig.json', JSON.stringify({ ...solution, references: [{ path: './tooling' }, ...solution.references.filter(item => item.path !== './src/cli/tests')] }));
  const pkg = await readJson(root, 'package.json');
  await write(root, 'package.json', JSON.stringify({ ...pkg, imports: { '#build/*': './node_modules/build/*', '#shared/*': './src/shared/*', '#plugin/*': './src/plugin/*' } }));
  const checked = await finds(root, 'SOURCE_IMPORTS_DRIFT');
  assert.ok(checked.codes.includes('SOURCE_TSCONFIG_DRIFT'));
  assert.equal((await source(root, 'check', '--fix', '--yes')).result.status, 'applied');
  assert.deepEqual((await readJson(root, 'package.json')).imports, { '#build/*': './node_modules/build/*', '#shared/*': './src/shared/*', '#tui/*': './src/tui/*' });
  const references = (await readJson(root, 'tsconfig.json')).references.map(item => item.path);
  assert.equal(references[0], './tooling');
  assert.ok(references.includes('./src/cli/tests'));
  assert.equal((await source(root, 'check')).status, 0);
});

test('an import into a project that is not referenced is SOURCE_UNREFERENCED_IMPORT, whether by alias or relative path', async t => {
  const root = await fixture(t);
  await write(root, 'src/plugin/view.ts', "import { tuiName } from '#tui/index.ts';\nimport { cliName } from '../cli/index.ts';\nexport const both = () => tuiName() + cliName();\n");
  const checked = await finds(root, 'SOURCE_UNREFERENCED_IMPORT');
  const found = checked.result.diagnostics.filter(item => item.code === 'SOURCE_UNREFERENCED_IMPORT');
  assert.deepEqual(found.map(item => item.next).sort(), ['source link plugin cli', 'source link plugin tui']);
  assert.match(found.find(item => item.next.endsWith('tui')).message, /src\/plugin\/view\.ts:1 \(#tui\/index\.ts\)/);
});

test('a project outside the lint, coverage or analyzer scope is SOURCE_GATE_UNCOVERED until the manifest records why', async t => {
  const root = await fixture(t);
  await write(root, 'configs/lint/eslint.config.mjs', 'export default [];\n');
  await write(root, 'configs/lint/lint-scope.mjs', "export const shellLintExclusions = Object.freeze(['src/*/tests/**', 'src/tui/**']);\n");
  await write(root, 'configs/testing/vitest.config.mjs', "export default { test: { include: ['src/tui/tests/*.ts'], coverage: { include: ['src/{shared,cli,plugin}/**/*.ts'] } } };\n");
  await write(root, 'configs/quality/fallow.json', JSON.stringify({ ignorePatterns: ['src/tui/**'] }));
  const checked = await finds(root, 'SOURCE_GATE_UNCOVERED');
  const gaps = checked.result.diagnostics.filter(item => item.code === 'SOURCE_GATE_UNCOVERED').map(item => item.message);
  assert.equal(gaps.length, 3);
  for (const gate of ['lint', 'coverage', 'analyzer']) assert.ok(gaps.some(message => message.includes(`gateExemptions.${gate}`)), gate);
  assert.ok(gaps.every(message => message.startsWith('src/tui is outside')));
  const exempt = manifestWith(list => { list[1].gateExemptions = { lint: 'fixture', coverage: 'fixture', analyzer: 'fixture' }; });
  await write(root, 'workbench.sources.json', JSON.stringify(exempt));
  const passed = await source(root, 'check');
  assert.equal(passed.status, 0, JSON.stringify(passed.result.diagnostics));
});


test('JSONC tsconfigs with comments and trailing commas pass without rewriting their text', async t => {
  const root = await fixture(t);
  for (const path of ['tsconfig.json', 'src/plugin/tsconfig.json', 'src/plugin/tests/tsconfig.json']) {
    const original = await read(root, path);
    const text = '// Maintainer notes stay intact.\n' + original.replace(/\n}\s*$/, ',\n}\n');
    await write(root, path, text);
    const checked = await source(root, 'check');
    assert.equal(checked.status, 0, JSON.stringify(checked.result.diagnostics));
    assert.equal(await read(root, path), text);
  }
});

test('a root config compiling explicit files is not rewritten as a solution', async t => {
  const root = await fixture(t);
  const config = { ...await readJson(root, 'tsconfig.json'), files: ['custom.ts'] };
  const text = JSON.stringify(config);
  await write(root, 'tsconfig.json', text);
  const checked = await finds(root, 'SOURCE_TSCONFIG_DRIFT');
  assert.equal(checked.result.data.fixable, 0);
  await source(root, 'check', '--fix', '--yes');
  assert.equal(await read(root, 'tsconfig.json'), text);
});
