import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadTemplateSnapshot } from '../../scripts/compiler/index.ts';

const roots = ['src', 'scripts', 'tests', 'harness', 'docs', '.github', 'bin', 'plugins', 'configs'];
const relocated = ['TEMPLATE-GUIDE.md', 'SHELL-FIRST-OVERVIEW.md', 'DESIGN-CONSTRAINTS.md', 'PROJECT-SETUP-HANDOUT.md'];
const rootFiles = ['package.json', 'package-lock.json', 'manifest.json', 'versions.json', 'tsconfig.json', '.gitignore', '.nvmrc', 'AGENTS.md', 'LICENSE', 'README.md', 'app.mjs', 'shell.mjs'];
/** A generated-project layout: product README/AGENTS at the root, framework documents under docs/framework/. */
async function generatedLayout(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'template-snapshot-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const folder of roots) await mkdir(join(root, folder), { recursive: true });
  for (const name of rootFiles) await writeFile(join(root, name), name === 'package.json' || name.endsWith('.json') ? '{}\n' : name + '\n');
  await mkdir(join(root, 'docs/framework'), { recursive: true });
  for (const name of relocated) await writeFile(join(root, 'docs/framework', name), '# ' + name + '\n');
  return root;
}

test('a generated project snapshots relocated framework documents from docs/framework/', async t => {
  const root = await generatedLayout(t);
  const snapshot = await loadTemplateSnapshot(root);
  const paths = snapshot.frameworkFiles.map(file => file.path);
  for (const name of relocated) {
    assert.ok(paths.includes('docs/framework/' + name), name);
    assert.ok(!paths.includes(name), name + ' is not read from the root');
  }
  assert.ok(paths.includes('package.json'));
});

test('a missing root file without a relocated home still fails the snapshot', async t => {
  const root = await generatedLayout(t);
  await rm(join(root, 'package.json'));
  await assert.rejects(loadTemplateSnapshot(root), { code: 'ENOENT' });
  await writeFile(join(root, 'package.json'), '{}\n');
  await rm(join(root, 'docs/framework/TEMPLATE-GUIDE.md'));
  const snapshot = await loadTemplateSnapshot(root);
  assert.ok(!snapshot.frameworkFiles.some(file => file.path.endsWith('TEMPLATE-GUIDE.md')));
});
