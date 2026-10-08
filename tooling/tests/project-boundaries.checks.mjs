import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { verifySteps } from '../quality/verify-steps.mjs';
import { boundarySpecifiers, boundaryTarget, checkProjectBoundaries } from '../quality/check-project-boundaries.mjs';
import { packageImports, readSourceManifest } from '../../src/shared/platform/source-manifest.mjs';

const gate = resolve(import.meta.dirname, '../quality/check-project-boundaries.mjs');
/** The fixtures' graph is this repository's: shared -> none; tui -> shared; cli -> shared, tui; companion -> shared; plugin -> shared. */
const project = (name, references) => ({ name, kind: name === 'shared' || name === 'tui' ? 'library' : name, path: `src/${name}`, references });
const manifest = { schemaVersion: 1, projects: [project('shared', []), project('tui', ['shared']), project('cli', ['shared', 'tui']), project('companion', ['shared']), project('plugin', ['shared'])] };
const imports = { '#shared/*': './src/shared/*', '#tui/*': './src/tui/*' };
const codes = (files, sources = { manifest, imports }) => checkProjectBoundaries(new Map(Object.entries(files)), sources).map(item => item.code);
const repositoryRoot = resolve(import.meta.dirname, '../..');

test('a source project importing tooling/ or the root tests/ folder is rejected', () => {
  assert.deepEqual(codes({ 'src/plugin/application/bad.ts': "import { loadThresholds } from '../../../tooling/quality/thresholds.mjs';" }), ['SOURCE_IMPORTS_TOOLING']);
  assert.deepEqual(codes({ 'src/cli/tests/bad.checks.mjs': "import { project } from '../../../tests/support/project-render.mjs';" }), ['SOURCE_IMPORTS_TESTS']);
  assert.deepEqual(codes({ 'src/shared/platform/bad.mjs': "export * from '../../../tooling/styles/vendor-policy.mjs';" }), ['SOURCE_IMPORTS_TOOLING']);
  assert.deepEqual(codes({ 'src/companion/editor/bad.ts': "const load = () => import('../../../tooling/concepts/contract-bundle.mjs');" }), ['SOURCE_IMPORTS_TOOLING']);
  assert.deepEqual(codes({ 'src/tui/bad.ts': "const fixture = require('../../tests/support/file-symlink.mjs');" }), ['SOURCE_IMPORTS_TESTS']);
  assert.deepEqual(codes({ 'src/plugin/bad.mjs': "const path = new URL('../../tooling/quality/lint-source.mjs', import.meta.url);" }), ['SOURCE_IMPORTS_TOOLING']);
});

test('plugin, companion, tui and shared never import the CLI; shared imports no project; tui imports only shared', () => {
  for (const [from, target] of [['plugin', 'cli'], ['companion', 'cli'], ['tui', 'cli'], ['shared', 'cli'], ['shared', 'plugin'], ['shared', 'tui'],
    ['shared', 'companion'], ['tui', 'plugin'], ['tui', 'companion'], ['plugin', 'companion'], ['companion', 'plugin'], ['companion', 'tui'], ['plugin', 'tui']]) {
    assert.deepEqual(codes({ [`src/${from}/feature/bad.ts`]: `import { value } from '../../${target}/feature/value.ts';` }), ['PROJECT_DEPENDENCY'], `${from} -> ${target}`);
  }
  assert.deepEqual(codes({ 'src/plugin/bad.ts': "import { value } from '../cli/value.ts';" }), ['PROJECT_DEPENDENCY']);
  assert.deepEqual(codes({ 'src/tui/engine/bad.ts': "import { value } from '#shared/platform/hash.ts'; import type { Cli } from '../../cli/app.ts';" }), ['PROJECT_DEPENDENCY']);
});

test('declared dependencies, aliases, packages and files outside the projects stay allowed', () => {
  assert.deepEqual(codes({
    'src/cli/adapters/ok.ts': "import { sha256 } from '#shared/platform/hash.ts'; import { prompt } from '#tui/prompts.ts'; import { join } from 'node:path'; import yaml from 'yaml';",
    'src/tui/engine/ok.ts': "import { sha256 } from '#shared/platform/hash.ts'; import { other } from './other.ts';",
    'src/plugin/bootstrap/ok.ts': "import { sha256 } from '#shared/platform/hash.ts'; import tokens from '../../../configs/quality/thresholds.json';",
    'src/companion/editor/ok.ts': "import { contract } from '#shared/companion/authoring-contract.ts';",
    'src/cli/tests/ok.checks.mjs': "import { fixture } from './support/fixture.mjs'; import template from '../../../templates/x.txt';",
    'tooling/quality/free.mjs': "import { run } from '../../src/cli/app.ts'; import { x } from '../../tests/support/x.mjs';",
    'tests/support/free.mjs': "import { run } from '../../src/plugin/main.ts';",
  }), []);
  // The gate reads its graph and aliases from the repository's manifest and package.json, which the fixtures mirror.
  const repository = readSourceManifest(repositoryRoot);
  assert.deepEqual(repository.projects.map(item => [item.name, item.path, item.references]), manifest.projects.map(item => [item.name, item.path, item.references]));
  assert.deepEqual(packageImports(repositoryRoot), imports);
});

test('the graph comes from the manifest: a new reference allows the import, a missing one rejects it', () => {
  const linked = { ...manifest, projects: manifest.projects.map(item => item.name === 'plugin' ? { ...item, references: ['shared', 'companion'] } : item) };
  const file = { 'src/plugin/feature/uses.ts': "import { value } from '../../companion/editor/value.ts';" };
  assert.deepEqual(codes(file), ['PROJECT_DEPENDENCY']);
  assert.deepEqual(codes(file, { manifest: linked, imports }), []);
  // An alias resolves through package.json "imports": without the #tui entry the specifier names a package, not a project.
  assert.deepEqual(codes({ 'src/plugin/bad.ts': "import { x } from '#tui/prompts.ts';" }), ['PROJECT_DEPENDENCY']);
  assert.deepEqual(codes({ 'src/plugin/bad.ts': "import { x } from '#tui/prompts.ts';" }, { manifest, imports: { '#shared/*': './src/shared/*' } }), []);
});

test('only real module references count, not strings or comments', () => {
  const source = "// import x from '../../tooling/a.mjs'\nconst text = \"import y from '../../tests/b.mjs'\";\nconst template = `require('../../tooling/c.mjs')`;\n";
  assert.deepEqual(codes({ 'src/plugin/ok.ts': source }), []);
  assert.deepEqual(boundarySpecifiers('src/plugin/vue.vue', '<script setup lang="ts">\nimport x from "../../../tooling/a.mjs";\n</script>\n<template><div /></template>').map(item => item.specifier), ['../../../tooling/a.mjs']);
  assert.equal(boundaryTarget('src/plugin/a/b.ts', '#shared/x.ts', imports), 'src/shared/x.ts');
  assert.equal(boundaryTarget('src/plugin/a/b.ts', 'vue', imports), null);
});

test('a directory under src that is not a declared project, or a code file directly under src, fails closed', () => {
  assert.deepEqual(codes({ 'src/extra/main.ts': 'export {};' }), ['UNDECLARED_PROJECT']);
  assert.deepEqual(codes({ 'src/stray.ts': 'export {};' }), ['UNDECLARED_PROJECT']);
  assert.deepEqual(codes({ 'src/stray.mjs': "import { x } from '../tooling/quality/thresholds.mjs';" }), ['UNDECLARED_PROJECT']);
  assert.deepEqual(codes({ 'src/README.md': '# not code' }), []);
});

test('check:architecture really runs the project boundary scan and fails on its violations', async () => {
  const gate = await readFile(resolve(import.meta.dirname, '../quality/check-architecture.mjs'), 'utf8');
  assert.match(gate, /import \{ scanProjectBoundaries \} from '\.\/check-project-boundaries\.mjs';/);
  assert.match(gate, /await scanProjectBoundaries\(\)/);
  assert.match(gate, /projects\.violations\.length[\s\S]*throw new Error\(`PROJECT_BOUNDARIES_FAILED/);
  // The script and the verify step are what npm run check:architecture and verify execute.
  const manifest = JSON.parse(await readFile(resolve(import.meta.dirname, '../../package.json'), 'utf8'));
  assert.equal(manifest.scripts['check:architecture'], 'node tooling/quality/check-architecture.mjs');
  assert.ok(verifySteps().some(step => step.id === 'architecture' && step.entry === 'tooling/quality/check-architecture.mjs'));
});

test('the gate command exits 1 on a src/plugin file importing tooling/ and 0 on a clean tree', async () => {
  const root = await mkdtemp(join(tmpdir(), 'project-boundaries-'));
  try {
    const write = async (path, text) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), text); };
    await write('src/plugin/main.ts', "import { sha256 } from '#shared/platform/hash.ts';\nexport const hash = sha256;\n");
    await write('src/shared/platform/hash.ts', 'export const sha256 = () => "";\n');
    await write('tooling/quality/thresholds.mjs', 'export const thresholds = {};\n');
    const missing = spawnSync(process.execPath, [gate], { cwd: root, encoding: 'utf8' });
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /PROJECT_BOUNDARY_MANIFEST_MISSING/);
    await write('workbench.sources.json', JSON.stringify({ schemaVersion: 1, projects: [project('shared', []), project('plugin', ['shared'])] }));
    await write('package.json', JSON.stringify({ imports: { '#shared/*': './src/shared/*' } }));
    const clean = spawnSync(process.execPath, [gate], { cwd: root, encoding: 'utf8' });
    assert.equal(clean.status, 0, clean.stderr);
    assert.deepEqual(JSON.parse(clean.stdout).projects, ['plugin', 'shared']);
    await write('src/plugin/application/leak.ts', "import { thresholds } from '../../../tooling/quality/thresholds.mjs';\nexport const leaked = thresholds;\n");
    const leaked = spawnSync(process.execPath, [gate], { cwd: root, encoding: 'utf8' });
    assert.equal(leaked.status, 1);
    assert.match(leaked.stderr, /src\/plugin\/application\/leak\.ts:1: SOURCE_IMPORTS_TOOLING/);
    assert.match(leaked.stderr, /PROJECT_BOUNDARIES_FAILED: 1/);
  } finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir())));
    await rm(root, { recursive: true, force: true });
  }
});
