// source-project-split AC-3: generated projects own a named source tree and executable local imports.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { compileProject, loadTemplateSnapshot } from '../../../src/cli/compiler/index.ts';
import { starterDocumentText } from '../../../src/shared/testing/starter-documents.mjs';
import { parseSourceManifest } from '../../../src/cli/domain/source-projects.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const template = await loadTemplateSnapshot(root);
const source = starterDocumentText('quick-capture');
function localImports(files, selected) {
  const paths = new Set(files.map(file => file.path));
  for (const file of files.filter(selected)) {
    for (const match of file.content.matchAll(/(?:from\s*|import\s*\(?\s*)['"](\.[^'"]+)['"]/g)) {
      const target = posix.normalize(posix.join(posix.dirname(file.path), match[1]));
      assert.ok([target, target + '.ts', target + '.mjs', target + '/index.ts'].some(path => paths.has(path)), `${file.path}: ${match[1]} resolves to ${target}`);
    }
  }
}

test('AC-3 companion compilation emits a declared plugin project with resolvable source and test imports', async () => {
  const result = await compileProject({ source, template });
  assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
  const files = new Map(result.artifacts.map(file => [file.path, file.content]));
  const manifest = parseSourceManifest(JSON.parse(files.get('workbench.sources.json')));
  assert.equal(manifest.projects.find(project => project.name === 'plugin').path, 'src/plugin');
  assert.equal(result.model.sourceRoot, 'src/plugin/generated');
  assert.equal(result.model.testRoot, 'src/plugin/tests/project');
  assert.ok(files.has('src/plugin/main.ts'));
  assert.ok(!files.has('src/main.ts'));
  for (const project of manifest.projects) assert.ok(files.has(project.path + '/tsconfig.json'), project.path);
  localImports(result.artifacts, file => /\.(?:ts|mjs|vue)$/.test(file.path) &&
    (file.path.startsWith(result.model.sourceRoot + '/') || file.path.startsWith(result.model.testRoot + '/') || file.path === 'src/plugin/main.ts'));
});

test('AC-3 standalone CLI starter typechecks and executes generated tests from its named source project', async t => {
  const projectSelection = { schemaVersion: 2, starter: { id: 'acceptance', version: '1.0.0', sha256: 'a'.repeat(64) }, projectType: 'cli', framework: 'none', targets: ['cli'] };
  const result = await compileProject({ source, template, outputKind: 'project', projectSelection });
  assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
  localImports(result.artifacts, file => /\.(?:ts|mjs)$/.test(file.path) && /^(?:src|plugins|tests)\//.test(file.path));
  const folder = await mkdtemp(join(tmpdir(), 'source-project-starter-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  for (const file of result.artifacts) {
    const path = join(folder, file.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.content);
  }
  await symlink(join(root, 'node_modules'), join(folder, 'node_modules'), 'dir');
  for (const args of [
    [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--project', 'tsconfig.json'],
    ['--experimental-strip-types', '--test', 'src/plugin/tests/scaffold.test.mjs', 'plugins/starter-extension/tests/plugin.test.ts'],
  ]) {
    const run = spawnSync(process.execPath, args, { cwd: folder, encoding: 'utf8', timeout: 60000 });
    assert.equal(run.status, 0, run.stdout + run.stderr);
  }
});
