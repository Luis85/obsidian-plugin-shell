import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { checkProjectBoundaries, moduleSpecifiers, projectDependencies, resolveSpecifier } from '../quality/check-project-boundaries.mjs';

const gate = resolve(import.meta.dirname, '../quality/check-project-boundaries.mjs');
const codes = files => checkProjectBoundaries(new Map(Object.entries(files))).map(item => item.code);

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
  assert.deepEqual(projectDependencies.cli, ['shared', 'tui']);
});

test('only real module references count, not strings or comments', () => {
  const source = "// import x from '../../tooling/a.mjs'\nconst text = \"import y from '../../tests/b.mjs'\";\nconst template = `require('../../tooling/c.mjs')`;\n";
  assert.deepEqual(codes({ 'src/plugin/ok.ts': source }), []);
  assert.deepEqual(moduleSpecifiers('src/plugin/vue.vue', '<script setup lang="ts">\nimport x from "../../../tooling/a.mjs";\n</script>\n<template><div /></template>').map(item => item.specifier), ['../../../tooling/a.mjs']);
  assert.equal(resolveSpecifier('src/plugin/a/b.ts', '#shared/x.ts'), 'src/shared/x.ts');
  assert.equal(resolveSpecifier('src/plugin/a/b.ts', 'vue'), null);
});

test('a directory under src that is not a declared project fails closed', () => {
  assert.deepEqual(codes({ 'src/extra/main.ts': 'export {};' }), ['UNDECLARED_PROJECT']);
});

test('the gate command exits 1 on a src/plugin file importing tooling/ and 0 on a clean tree', async () => {
  const root = await mkdtemp(join(tmpdir(), 'project-boundaries-'));
  try {
    const write = async (path, text) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), text); };
    await write('src/plugin/main.ts', "import { sha256 } from '#shared/platform/hash.ts';\nexport const hash = sha256;\n");
    await write('src/shared/platform/hash.ts', 'export const sha256 = () => "";\n');
    await write('tooling/quality/thresholds.mjs', 'export const thresholds = {};\n');
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
