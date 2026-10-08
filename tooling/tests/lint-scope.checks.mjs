import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, realpath, rm, rmdir, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { ESLint, Linter } from 'eslint';
import { lintOwnedSource } from '../quality/lint-source.mjs';
import { lintExcluded, lintExclusionGlobs, shellLintExclusions } from '../../configs/lint/lint-scope.mjs';
import { isShellRepository } from '../../src/shared/platform/repository-kind.mjs';
import { repositoryScope } from '../../src/cli/adapters/framework/repository-scope.ts';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const sources = [
  'src/cli/app.ts', 'src/plugin/main.ts', 'src/tui/prompts.ts', 'src/shared/contracts/sketch-errors.ts', 'src/shared/companion/runtime-contract.ts',
  'src/shared/platform/hash.ts', 'src/shared/companion/journey/project-store.ts', 'src/cli/tooling/delivery/run.mjs', 'src/companion/editor/main.ts',
  'src/companion/app/catalog.js', 'src/plugin/tests/unit/entity.test.ts', 'src/cli/tests/check.checks.mjs', 'src/plugin/harness/app/main.ts',
];
const shellLinted = ['src/cli/app.ts', 'src/plugin/main.ts', 'src/tui/prompts.ts', 'src/shared/contracts/sketch-errors.ts', 'src/shared/companion/runtime-contract.ts'];

async function project(t, kind) {
  const root = await realpath(await mkdtemp(join(tmpdir(), `lint-scope-${kind}-`)));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of sources) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), 'export {};\n'); }
  if (kind === 'generated') {
    for (const path of ['.companion/generation.json', 'configs/types/tsconfig.project.json']) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), '{}'); }
  }
  return root;
}
/** A stand-in for oxlint that records the files it was asked to lint. */
async function recorder(root) {
  const tool = join(root, 'record-oxlint.mjs');
  await writeFile(tool, "import { writeFileSync } from 'node:fs'; writeFileSync('linted.json', JSON.stringify(process.argv.slice(2).map(argument => argument.split(String.fromCharCode(92)).join('/')).filter(argument => argument.startsWith('src/'))));");
  return tool;
}
async function linted(root) {
  const tool = await recorder(root);
  await lintOwnedSource(root, tool);
  return JSON.parse(await readFile(join(root, 'linted.json'), 'utf8')).map(path => path.replaceAll('\\', '/')).sort();
}

test('the shell repository excludes tests, harness, companion and the former scripts code; a generated project excludes nothing', async t => {
  const shell = await project(t, 'shell'), generated = await project(t, 'generated');
  assert.equal(isShellRepository(shell), true);
  assert.equal(isShellRepository(generated), false);
  // `check`, `verify` and the lint scope share one definition of a shell repository.
  for (const root of [shell, generated, repositoryRoot]) assert.equal(isShellRepository(root), repositoryScope(root) === 'shell-repository', root);
  assert.deepEqual(await linted(shell), [...shellLinted].sort());
  // A generated project's src/shared, src/companion, src/cli/tooling and src/<x>/tests are product code and stay linted.
  assert.deepEqual(await linted(generated), [...sources].sort());
  assert.deepEqual(lintExclusionGlobs(generated), []);
  assert.deepEqual(lintExclusionGlobs(shell), [...shellLintExclusions]);
  for (const path of sources) assert.equal(lintExcluded(generated, path), false, path);
});

test('oxlint and ESLint share one exclusion list and agree on every path', async () => {
  const eslint = new ESLint({ cwd: repositoryRoot, overrideConfigFile: join(repositoryRoot, 'configs/lint/eslint.config.mjs') });
  assert.equal(isShellRepository(repositoryRoot), true);
  for (const path of sources) assert.equal(await eslint.isPathIgnored(join(repositoryRoot, path)), lintExcluded(repositoryRoot, path), path);
  for (const file of ['configs/lint/eslint.config.mjs', 'tooling/quality/lint-source.mjs']) {
    const text = await readFile(join(repositoryRoot, file), 'utf8');
    assert.match(text, /lint-scope\.mjs/, file);
    assert.doesNotMatch(text, /src\/companion\/\*\*|src\/cli\/tooling\/\*\*|src\/shared\/\*\*/, `${file} must not carry its own copy of the exclusions`);
  }
});


test('pure-layer import bans reject framework imports in flat and named source projects', async () => {
  const eslint = new ESLint({ cwd: repositoryRoot, overrideConfigFile: join(repositoryRoot, 'configs/lint/eslint.config.mjs') });
  const linter = new Linter();
  for (const folder of ['src', 'src/plugin', 'src/renamed-plugin']) {
    for (const layer of ['domain', 'application', 'features']) {
      const path = `${folder}/${layer}/boundary-probe.ts`;
      const config = await eslint.calculateConfigForFile(join(repositoryRoot, path));
      const rule = config.rules['no-restricted-imports'];
      assert.equal(rule[0], 2, path);
      for (const dependency of ['vue', 'obsidian', 'pinia', '@nuxt/ui', 'node:fs']) {
        const findings = linter.verify(`import * as forbidden from '${dependency}'; export { forbidden };`,
          { rules: { 'no-restricted-imports': rule } });
        assert.equal(findings.filter(item => item.ruleId === 'no-restricted-imports' && item.severity === 2).length, 1, `${path}: ${dependency}`);
      }
    }
  }
});


test('generated named-source tests retain test rules without plugin-only rules', async t => {
  const root = await project(t, 'generated');
  for (const path of ['configs/lint/eslint.config.mjs', 'configs/lint/lint-scope.mjs',
    'src/shared/platform/project-roots.mjs', 'src/shared/platform/project-configs.mjs', 'src/shared/platform/repository-kind.mjs']) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await cp(join(repositoryRoot, path), join(root, path));
  }
  await writeFile(join(root, 'package.json'), '{"type":"module"}');
  await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', strict: true }, include: ['src/**/*.ts'] }));
  await symlink(join(repositoryRoot, 'node_modules'), join(root, 'node_modules'), 'junction');
  try {
    const eslint = new ESLint({ cwd: root, overrideConfigFile: join(root, 'configs/lint/eslint.config.mjs') });
    for (const path of ['src/plugin/tests/unit/entity.test.ts', 'src/plugin/harness/app/main.ts']) {
      const config = await eslint.calculateConfigForFile(join(root, path));
      assert.equal(Object.keys(config.rules).some(name => name.startsWith('obsidianmd/')), false, path);
      assert.equal(config.rules['@typescript-eslint/no-floating-promises'][0], 2, path);
      const [valid] = await eslint.lintText('export function fixture(_value: unknown) { return 1; }', { filePath: join(root, path) });
      assert.deepEqual(valid.messages, [], path);
      const [invalid] = await eslint.lintText('Promise.resolve(1);', { filePath: join(root, path) });
      assert.ok(invalid.messages.some(item => item.ruleId === '@typescript-eslint/no-floating-promises' && item.severity === 2), path);
    }
    const production = await eslint.calculateConfigForFile(join(root, 'src/plugin/main.ts'));
    assert.ok(Object.keys(production.rules).some(name => name.startsWith('obsidianmd/')), 'product rules remain active');
  } finally { await unlink(join(root, 'node_modules')).catch(() => rmdir(join(root, 'node_modules'))); }
});
