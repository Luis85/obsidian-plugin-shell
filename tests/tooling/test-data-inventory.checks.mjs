import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, lstat, writeFile, readFile, cp, readdir, rm, symlink, realpath } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { sourceInputs } from '../../scripts/testing/source-inputs.mjs';
import { fixtureManifest } from './test-data-fixture.mjs';

const sidecar = 'docs/concepts/companion/test-kit';
const projectFixture = 'docs/concepts/companion/companion-project.json';
async function scratch(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'test-kit-inventory-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
async function minimal(t) {
  const root = await scratch(t), inventory = await sourceInputs(process.cwd());
  // Every optional concept input (test kit, project fixture, starters) stays absent so redirect fixtures can occupy docs/concepts.
  for (const path of inventory.roots.filter(path => !path.startsWith('docs/concepts/'))) {
    const target = join(root, path);
    if ((await lstat(resolve(path))).isDirectory()) await mkdir(target, { recursive: true });
    else { await mkdir(dirname(target), { recursive: true }); await writeFile(target, ''); }
  }
  return root;
}

test('[TD-INVENTORY] optional kit contributes exact bytes, new files and standard limits to source evidence', async t => {
  const root = await minimal(t), before = await sourceInputs(root);
  assert.ok(!before.roots.includes(sidecar));
  await mkdir(join(root, sidecar), { recursive: true });
  const path = sidecar + '/probe.mjs';
  await writeFile(join(root, path), 'export const value = 1;\n');
  const first = await sourceInputs(root), file = first.files.find(file => file.path === path);
  assert.ok(first.roots.includes(sidecar)); assert.equal(file.limit, 400); assert.equal(file.lines, 1);
  assert.notEqual(first.digest, before.digest);
  await writeFile(join(root, path), 'export const value = 2;\n');
  const changed = await sourceInputs(root); assert.notEqual(changed.digest, first.digest);
  await writeFile(join(root, sidecar, 'extra.mjs'), 'export const extra = 3;\n');
  assert.notEqual((await sourceInputs(root)).digest, changed.digest);
  assert.deepEqual((await sourceInputs(root, ['src'])).roots, ['src']);
  assert.ok(!(await sourceInputs(root, ['src'])).files.some(file => file.path.startsWith(sidecar)));
});

test('[TD-INVENTORY-LINKS] sidecar and ancestor redirects fail instead of becoming missing optional content', async t => {
  for (const path of ['docs/concepts', sidecar]) {
    const root = await minimal(t), outside = await scratch(t), target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await symlink(outside, target, process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(sourceInputs(root), /SOURCE_SYMLINK/);
    assert.deepEqual(await readdir(outside), []);
  }
  const root = await minimal(t); await mkdir(join(root, 'docs/concepts/companion'), { recursive: true });
  await writeFile(join(root, sidecar), 'not a directory');
  await assert.rejects(sourceInputs(root), /SOURCE_NOT_DIRECTORY/);
});

test('[TD-CLI-DEFAULT] exported command locates generated manifest independently of working directory', async t => {
  const root = await scratch(t), elsewhere = await scratch(t), kit = join(root, 'scripts/test-data');
  await cp(resolve(sidecar), kit, { recursive: true });
  const run = () => spawnSync(process.execPath, [join(kit, 'cli.mjs')], { cwd: elsewhere, encoding: 'utf8', timeout: 15000 });
  const missing = run(); assert.ifError(missing.error); assert.equal(missing.status, 1); assert.match(missing.stderr, /manifest missing/);
  await writeFile(join(kit, 'manifest.json'), JSON.stringify(fixtureManifest()));
  const completed = run(); assert.ifError(completed.error); assert.equal(completed.status, 0, completed.stderr);
  const report = JSON.parse(completed.stdout); assert.equal(report.target, join(root, '.test-vault')); assert.equal(report.blockers.length, 0);
  assert.equal(report.mode, 'seed'); assert.deepEqual(await readdir(elsewhere), []);
  await assert.rejects(readFile(join(root, '.test-vault/.shell-fixtures.json')), { code: 'ENOENT' });
});


test('[PROJECT-FIXTURE-INVENTORY] canonical design bytes are transported, fingerprinted and never followed through links', async t => {
  const root = await minimal(t); const target = join(root, projectFixture);
  const before = await sourceInputs(root); assert.ok(!before.roots.includes(projectFixture));
  await mkdir(dirname(target), { recursive: true }); await writeFile(target, '{"design":"original"}');
  const first = await sourceInputs(root); assert.equal(first.files.filter(f => f.path === projectFixture).length, 1);
  await writeFile(target, '{"design":"changed"}'); assert.notEqual((await sourceInputs(root)).digest, first.digest);
  await rm(target); await mkdir(target); await assert.rejects(sourceInputs(root), /SOURCE_NOT_REGULAR/);
  await rm(target, { recursive: true });
  const outside = await scratch(t); await symlink(outside, target, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(sourceInputs(root), /SOURCE_SYMLINK/); assert.deepEqual(await readdir(outside), []);
});
