import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, realpath, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceInputs } from '../../scripts/testing/source-inputs.mjs';
import { standaloneSource, updateReadmeOwnership } from '../../scripts/framework/distribution.ts';
import { hash } from '../../scripts/framework/files.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
const projectFixture = 'docs/concepts/companion/companion-project.json';
test('release adaptation recognizes only the reviewed README across checkout line endings', async () => {
  const source = await readFile(join(root, 'README.md'));
  const metadata = await readFile(join(root, 'scripts/examples/ownership.json'));
  const canonical = Buffer.from(source.toString('utf8').replace(/\r\n/g, '\n'));
  const crlf = Buffer.from(canonical.toString('utf8').replace(/\n/g, '\r\n'));
  const expected = standaloneSource('README.md', canonical);
  for (const original of [canonical, crlf]) {
    const adapted = standaloneSource('README.md', original);
    assert.deepEqual(adapted, expected, 'distribution text must not vary by checkout EOL');
    const updated = JSON.parse(updateReadmeOwnership(original, adapted, metadata));
    assert.equal(updated.files.find(file => file.path === 'README.md').sha256, hash(adapted));
  }
  for (const original of [Buffer.concat([crlf, Buffer.from('edited')]), Buffer.concat([canonical, Buffer.from('\n')])]) {
    assert.throws(() => updateReadmeOwnership(original, standaloneSource('README.md', original), metadata), /reviewed preimage/);
  }
  const compressed = Buffer.from([0, 13, 10, 255]);
  assert.deepEqual(standaloneSource('harness/vendor.css.gz', compressed), compressed);
});
test('source-only archive includes and fingerprints the actual imported project fixture', async () => {
  const inventory = await sourceInputs(root);
  const file = inventory.files.find(item => item.path === projectFixture);
  assert.ok(file, 'fixture required by generator tests must be transported, not suppressed');
  assert.equal(file.sha256, hash(await readFile(join(root, projectFixture))));
  const catalogPath = 'docs/concepts/companion/starters/catalog.json';
  const catalogBytes = await readFile(join(root, catalogPath));
  assert.equal(inventory.files.find(item => item.path === catalogPath)?.sha256, hash(catalogBytes));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  assert.equal(catalog.starters.length, 9, 'retain all nine reviewed starters');
  for (const starter of catalog.starters) {
    const path = `docs/concepts/companion/starters/${starter.file}`;
    const actualHash = hash(await readFile(join(root, path)));
    assert.equal(actualHash, starter.sha256, path + ': catalog integrity');
    assert.equal(inventory.files.find(item => item.path === path)?.sha256, actualHash, path);
  }
});
test('optional project fixture contributes exact bytes and refuses parent redirects', async t => {
  const folder = await realpath(await mkdtemp(join(tmpdir(), 'framework-fixture-inventory-')));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const inventory = await sourceInputs(root);
  for (const path of inventory.roots.filter(path => !path.startsWith('docs/concepts/'))) {
    const original = join(root, path);
    const { lstat } = await import('node:fs/promises');
    if ((await lstat(original)).isDirectory()) await mkdir(join(folder, path), { recursive: true });
    else { await mkdir(dirname(join(folder, path)), { recursive: true }); await writeFile(join(folder, path), ''); }
  }
  const before = await sourceInputs(folder);
  await mkdir(dirname(join(folder, projectFixture)), { recursive: true });
  await writeFile(join(folder, projectFixture), '{"fixture":1}');
  const first = await sourceInputs(folder);
  assert.notEqual(first.digest, before.digest);
  await writeFile(join(folder, projectFixture), '{"fixture":2}');
  assert.notEqual((await sourceInputs(folder)).digest, first.digest);
  await rm(join(folder, 'docs/concepts'), { recursive: true });
  const outside = join(folder, 'outside'); await mkdir(outside);
  await symlink(outside, join(folder, 'docs/concepts'), 'junction');
  await assert.rejects(sourceInputs(folder), /SOURCE_SYMLINK/);
});
test('reviewed style removal preserves tokens across checkout line endings', async t => {
  const { planExampleRemoval } = await import('../../scripts/examples/plan.mjs');
  const folder = await realpath(await mkdtemp(join(tmpdir(), 'framework-removal-')));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const metadata = await readFile(join(root, 'scripts/examples/ownership.json'), 'utf8');
  const ownership = JSON.parse(metadata);
  const copy = async path => {
    const content = (await readFile(join(root, path), 'utf8')).replace(/\r\n/g, '\n');
    await mkdir(dirname(join(folder, path)), { recursive: true });
    await writeFile(join(folder, path), content); return content;
  };
  // Exercise the actual three stylesheet replacements in a bounded fixture.
  // Canonical checkout EOL is not permission to adopt edited source hashes.
  ownership.files = ownership.files.filter(file => ['src/styles/shell.css', 'src/styles/panels.css', 'src/styles/layout.css'].includes(file.path));
  assert.equal(ownership.files.length, 3);
  await mkdir(join(folder, 'scripts/examples'), { recursive: true });
  await writeFile(join(folder, 'scripts/examples/ownership.json'), JSON.stringify(ownership));
  await copy('src/bootstrap/features.ts');
  for (const file of ownership.files) {
    if (file.sha256 !== null) assert.equal(hash(await copy(file.path)), file.sha256, file.path);
    if (file.template) await copy('scripts/examples/templates/' + file.template);
  }
  const report = await planExampleRemoval(folder);
  const shell = report.plan.changes.find(change => change.path === 'src/styles/shell.css');
  const panels = report.plan.changes.find(change => change.path === 'src/styles/panels.css');
  assert.match(shell.content, /var\(--plugin-shell-surface\)/);
  assert.match(panels.content, /var\(--plugin-shell-control-radius\)/);
  assert.ok(!shell.content.includes('.shell-sidebar'));
  const path = join(folder, 'src/styles/shell.css');
  const canonical = await readFile(path, 'utf8');
  await writeFile(path, canonical.replace(/\n/g, '\r\n'));
  await assert.rejects(planExampleRemoval(folder), /EXAMPLES_EDITED_FILES/);
  await writeFile(path, canonical + '\n/* unreviewed edit */\n');
  await assert.rejects(planExampleRemoval(folder), /EXAMPLES_EDITED_FILES/);
  await writeFile(path, canonical);
  assert.deepEqual((await planExampleRemoval(folder)).plan, report.plan);
});
