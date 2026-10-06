const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assembleProjectCli, retainKitTemplates } from '../../src/cli/adapters/framework/cli-build.ts';
import { verifyCliArtifact } from '../../src/cli/adapters/framework/cli-artifact.ts';
import { verifyKit } from '../../src/cli/adapters/framework/kit-integrity.ts';
import { hash } from '../../src/cli/adapters/framework/files.ts';
import { buildCli } from '../../scripts/bundling/build-cli.mjs';
const repository = fileURLToPath(new URL('../../', import.meta.url));
const after = (t, cleanup) => t.after ? t.after(cleanup) : t.onTestFinished(cleanup);
async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'compiled-cli-')));
  after(t, () => rm(root, { recursive: true, force: true }));
  const files = await assembleProjectCli(repository);
  for (const file of files) {
    await mkdir(dirname(join(root, file.path)), { recursive: true });
    await writeFile(join(root, file.path), file.bytes);
  }
  await verifyCliArtifact(root);
  return { root, files };
}

test('compiled authoring tools are self-contained and every artifact has a checked fingerprint', async t => {
  const { root, files } = await fixture(t);
  assert.deepEqual(await readdir(root), ['bin']);
  const ts = (await import(pathToFileURL(join(root, 'bin/tools/typescript.js')).href)).default;
  const tree = ts.createSourceFile('example.ts', 'export const answer: number = 42;', ts.ScriptTarget.Latest, true);
  assert.equal(tree.statements[0].declarationList.declarations[0].name.text, 'answer');
  const manifest = JSON.parse(await readFile(join(root, 'bin/cli.json'), 'utf8'));
  assert.deepEqual(manifest.files.map(file => file.path).sort(), files.map(file => file.path).filter(path => path !== 'bin/cli.json').sort());
  await writeFile(join(root, 'bin/app.js'), 'edited');
  await assert.rejects(verifyCliArtifact(root), { code: 'CLI_MODIFIED' });
});

test('a failed rebuild leaves the complete previous artifact intact and releases its build lock', async t => {
  const { root, files } = await fixture(t);
  await mkdir(join(root, '.companion')); await writeFile(join(root, '.companion/generation.json'), '{}');
  // A generated project with missing development sources cannot assemble a replacement.
  await assert.rejects(buildCli(root));
  for (const file of files) assert.deepEqual(await readFile(join(root, file.path)), file.bytes, file.path);
  assert.ok(!(await readdir(root)).some(path => path.startsWith('.workbench-cli-')));
  await writeFile(join(root, 'bin/keep.txt'), 'user data');
  await assert.rejects(buildCli(root), { code: 'CLI_INVENTORY' });
  assert.equal(await readFile(join(root, 'bin/keep.txt'), 'utf8'), 'user data');
});

test('runtime inventories reject missing files, duplicates, traversal and invalid fingerprints', async t => {
  const { root } = await fixture(t);
  const path = join(root, 'bin/cli.json'), source = await readFile(path, 'utf8'), manifest = JSON.parse(source);
  for (const invalid of [
    { ...manifest, schemaVersion: 2 },
    { ...manifest, files: [] },
    { ...manifest, files: [manifest.files[0], ...manifest.files] },
    { ...manifest, files: [{ ...manifest.files[0], path: 'bin/tools/../../outside' }, ...manifest.files.slice(1)] },
    { ...manifest, files: [{ ...manifest.files[0], hash: 'wrong' }, ...manifest.files.slice(1)] },
    { ...manifest, files: manifest.files.filter(file => file.path !== 'bin/app') },
  ]) {
    await writeFile(path, JSON.stringify(invalid));
    await assert.rejects(verifyCliArtifact(root));
  }
  await writeFile(path, source);
  await rm(join(root, 'bin/app.js'));
  await assert.rejects(verifyCliArtifact(root), { code: 'CLI_INVENTORY' });
});

test('rebuilding a project runtime preserves upstream templates and stable kit integrity', async t => {
  const { root, files } = await fixture(t);
  const template = { path: 'bin/template/package.json', bytes: Buffer.from('{"name":"upstream-template"}\n') };
  await mkdir(join(root, 'bin/template'));
  await writeFile(join(root, template.path), template.bytes);
  const bootstrap = ['bin/app', 'bin/package.json', 'bin/README.md', 'bin/LICENSE', 'package.json', 'README.md', 'LICENSE']
    .map(path => ({ path, hash: hash(files.find(file => file.path === path)?.bytes ?? Buffer.from('upstream')) }));
  const previous = { schemaVersion: 3, version: '0.4.0', compilerVersion: '6.0.3', sourceHash: hash('source'), bootstrap,
    files: [{ path: template.path, hash: hash(template.bytes), bytes: template.bytes.length }] };
  const rebuilt = await retainKitTemplates(root, files, previous);
  for (const file of rebuilt) await writeFile(join(root, file.path), file.bytes);
  const verified = await verifyKit(root);
  assert.deepEqual(await readFile(join(root, template.path)), template.bytes);
  assert.deepEqual(verified.bootstrap.filter(file => !file.path.startsWith('bin/')), previous.bootstrap.filter(file => !file.path.startsWith('bin/')));
  assert.equal(verified.version, previous.version);
  const fingerprints = entries => entries.map(file => [file.path, hash(file.bytes)]);
  assert.deepEqual(fingerprints(await retainKitTemplates(root, files, verified)), fingerprints(rebuilt), 'identical rebuilds keep the same identity');
});
