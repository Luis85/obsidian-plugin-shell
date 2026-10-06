import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkDependencyPins } from '../../scripts/security/dependency-pins.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'dependency-pins-')); t.after(() => rm(root, { recursive: true, force: true }));
  const pkg = { name: 'fixture', version: '1.0.0', dependencies: { alpha: '1.2.3' }, devDependencies: { beta: '2.0.0' },
    optionalDependencies: { gamma: '3.4.5' }, overrides: { delta: '4.5.6', 'epsilon@5.6.7': { zeta: '6.7.8' } } };
  const lock = { name: 'fixture', version: '1.0.0', lockfileVersion: 3, packages: {
    '': { name: 'fixture', version: '1.0.0', dependencies: { alpha: '1.2.3' }, devDependencies: { beta: '2.0.0' }, optionalDependencies: { gamma: '3.4.5' } },
    'node_modules/alpha': { version: '1.2.3' }, 'node_modules/beta': { version: '2.0.0' }, 'node_modules/gamma': { version: '3.4.5' },
  } };
  const save = async () => {
    await writeFile(join(root, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
    await writeFile(join(root, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n');
  };
  await save(); return { root, pkg, lock, save };
}
test('exact root declarations, overrides and lock resolutions produce hash-bound offline evidence', async t => {
  const f = await fixture(t), beforePackage = await readFile(join(f.root, 'package.json')), beforeLock = await readFile(join(f.root, 'package-lock.json'));
  const report = await checkDependencyPins(f.root);
  assert.equal(report.policy, 'exact-npm-pins-v1'); assert.equal(report.checked.manifests, 1);
  assert.equal(report.checked.dependencyDeclarations, 3); assert.equal(report.checked.overrideValues, 2); assert.equal(report.checked.overrideSelectors, 1);
  assert.deepEqual(report.manifests.map(item => item.path), ['package.json']);
  assert.match(report.manifests[0].hash, /^[a-f0-9]{64}$/); assert.match(report.lockfile.hash, /^[a-f0-9]{64}$/);
  assert.deepEqual(await readFile(join(f.root, 'package.json')), beforePackage); assert.deepEqual(await readFile(join(f.root, 'package-lock.json')), beforeLock);
});
test('every mutable direct-dependency specifier class is rejected without rewriting inputs', async t => {
  const specimens = ['^1.2.3', '~1.2.3', '*', '1.x', '>=1.2.3', 'latest', 'git+https://example.invalid/repo.git', 'https://example.invalid/pkg.tgz', 'file:../pkg'];
  for (const specifier of specimens) {
    const f = await fixture(t); f.pkg.dependencies.alpha = specifier; await f.save();
    const before = await readFile(join(f.root, 'package.json'));
    await assert.rejects(checkDependencyPins(f.root), error => /DEPENDENCY_PIN_INVALID/.test(error.message) && error.message.includes('alpha') && error.message.includes(specifier));
    assert.deepEqual(await readFile(join(f.root, 'package.json')), before);
  }
});
test('dev, optional and override ranges plus ranged override selectors are rejected', async t => {
  for (const mutate of [
    f => { f.pkg.devDependencies.beta = '^2.0.0'; },
    f => { f.pkg.optionalDependencies.gamma = '~3.4.5'; },
    f => { f.pkg.overrides.delta = 'latest'; },
    f => { f.pkg.overrides = { 'epsilon@^5.6.7': { zeta: '6.7.8' } }; },
  ]) {
    const f = await fixture(t); mutate(f); await f.save(); await assert.rejects(checkDependencyPins(f.root), /DEPENDENCY_PIN_INVALID/);
  }
});
test('missing, stale and unresolved lockfile state blocks and never regenerates the lock', async t => {
  const missing = await fixture(t); await rm(join(missing.root, 'package-lock.json'));
  await assert.rejects(checkDependencyPins(missing.root), /DEPENDENCY_LOCKFILE_MISSING/);
  const stale = await fixture(t); stale.lock.packages[''].dependencies.alpha = '1.2.4'; await stale.save();
  const before = await readFile(join(stale.root, 'package-lock.json'));
  await assert.rejects(checkDependencyPins(stale.root), /DEPENDENCY_LOCK_DECLARATION_MISMATCH.*alpha/);
  assert.deepEqual(await readFile(join(stale.root, 'package-lock.json')), before);
  const unresolved = await fixture(t); unresolved.lock.packages['node_modules/alpha'].version = '9.9.9'; await unresolved.save();
  await assert.rejects(checkDependencyPins(unresolved.root), /DEPENDENCY_LOCK_RESOLUTION_MISMATCH.*alpha/);
});
test('declared workspaces are checked against their own manifest record and shared lock resolution', async t => {
  const f = await fixture(t); f.pkg.workspaces = ['packages/*'];
  f.lock.packages[''].workspaces = ['packages/*'];
  f.lock.packages['packages/tool'] = { name: 'tool', version: '0.1.0', dependencies: { omega: '7.8.9' } };
  f.lock.packages['node_modules/omega'] = { version: '7.8.9' };
  await mkdir(join(f.root, 'packages/tool'), { recursive: true });
  await writeFile(join(f.root, 'packages/tool/package.json'), JSON.stringify({ name: 'tool', version: '0.1.0', dependencies: { omega: '7.8.9' } }, null, 2) + '\n');
  await f.save();
  const report = await checkDependencyPins(f.root);
  assert.deepEqual(report.manifests.map(item => item.path), ['package.json', 'packages/tool/package.json']);
  assert.equal(report.checked.dependencyDeclarations, 4);
});
test('workspace links resolve through their lock target version while unmatched workspaces fail closed', async t => {
  const f = await fixture(t); f.pkg.workspaces = ['packages/*']; f.lock.packages[''].workspaces = ['packages/*'];
  await mkdir(join(f.root, 'packages/a'), { recursive: true }); await mkdir(join(f.root, 'packages/b'), { recursive: true });
  await writeFile(join(f.root, 'packages/a/package.json'), JSON.stringify({ name: 'a', version: '1.0.0', dependencies: { b: '2.0.0' } }));
  await writeFile(join(f.root, 'packages/b/package.json'), JSON.stringify({ name: 'b', version: '2.0.0' }));
  f.lock.packages['packages/a'] = { name: 'a', version: '1.0.0', dependencies: { b: '2.0.0' } };
  f.lock.packages['packages/b'] = { name: 'b', version: '2.0.0' };
  f.lock.packages['node_modules/b'] = { resolved: 'packages/b', link: true }; await f.save();
  assert.equal((await checkDependencyPins(f.root)).checked.manifests, 3);
  f.pkg.workspaces = ['missing/*']; await f.save();
  await assert.rejects(checkDependencyPins(f.root), /DEPENDENCY_WORKSPACE_MISSING/);
});
