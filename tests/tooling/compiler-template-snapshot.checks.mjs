import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadTemplateSnapshot } from '../../bin/compiler/index.ts';
import { relocateFrameworkDocuments } from '../../bin/compiler/emitters/framework-docs.ts';
import { templateRootFiles, templateRoots as roots } from '../../bin/compiler/domain/template-inputs.ts';

// README.md and AGENTS.md exist at both homes in a generated project: the product's at the root, the framework's under docs/framework/.
const frameworkOnly = ['TEMPLATE-GUIDE.md', 'SHELL-FIRST-OVERVIEW.md', 'DESIGN-CONSTRAINTS.md', 'PROJECT-SETUP-HANDOUT.md'];
const relocated = ['README.md', 'AGENTS.md', ...frameworkOnly];
const rootFiles = templateRootFiles.filter(name => !frameworkOnly.includes(name));
/** A generated-project layout: product README/AGENTS at the root, framework documents under docs/framework/. */
async function generatedLayout(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'template-snapshot-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const folder of roots) await mkdir(join(root, folder), { recursive: true });
  for (const name of rootFiles) await writeFile(join(root, name), name.endsWith('.json') ? '{}\n' : 'product ' + name + '\n');
  await mkdir(join(root, 'docs/framework/workflows'), { recursive: true });
  for (const name of relocated) await writeFile(join(root, 'docs/framework', name), '# ' + name + '\n');
  await mkdir(join(root, '.github/workflows'), { recursive: true });
  await writeFile(join(root, '.github/workflows/ci.yml'), 'product ci\n');
  await writeFile(join(root, 'docs/framework/workflows/ci.yml'), 'framework ci\n');
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
  assert.ok(!paths.includes('.github/workflows/ci.yml'), 'the product CI is not framework input');
  // Relocation keeps the framework copies; the product README/AGENTS.md never replace them.
  const entries = new Map(snapshot.frameworkFiles.map(file => [file.path, { ...file }]));
  relocateFrameworkDocuments(entries);
  assert.equal(entries.get('docs/framework/README.md').content, '# README.md\n');
  assert.equal(entries.get('docs/framework/AGENTS.md').content, '# AGENTS.md\n');
  assert.equal(entries.get('docs/framework/workflows/ci.yml').content, 'framework ci\n');
  assert.ok(!entries.has('README.md') && !entries.has('AGENTS.md'));
});

test('relocation refuses to overwrite an existing file at the relocated path', () => {
  const file = (path, content) => [path, { path, content, ownership: 'framework' }];
  const entries = new Map([file('README.md', 'product\n'), file('docs/framework/README.md', 'framework\n')]);
  assert.throws(() => relocateFrameworkDocuments(entries), /GENERATOR_INVALID: .*docs\/framework\/README\.md/);
  assert.equal(entries.get('docs/framework/README.md').content, 'framework\n');
});

test('a missing root file without a relocated home still fails the snapshot', async t => {
  const root = await generatedLayout(t);
  await rm(join(root, 'package.json'));
  await assert.rejects(loadTemplateSnapshot(root), error => error?.diagnostic?.code === 'COMPILER_TEMPLATE_INVALID'
    && error.diagnostic.message === 'Missing template input: package.json' && !error.diagnostic.message.includes(root));
  await rm(join(root, 'plugins'), { recursive: true });
  await writeFile(join(root, 'package.json'), '{}\n');
  await assert.rejects(loadTemplateSnapshot(root), error => error?.diagnostic?.message === 'Missing template input: plugins');
  await mkdir(join(root, 'plugins'));
  await rm(join(root, 'docs/framework/TEMPLATE-GUIDE.md'));
  const snapshot = await loadTemplateSnapshot(root);
  assert.ok(!snapshot.frameworkFiles.some(file => file.path.endsWith('TEMPLATE-GUIDE.md')));
});
