// Increment: [[docs/increments/obsidian-api-1-14]]
// AC-1: The lockfile resolves the root `obsidian` API package to 1.14.4 with a patched `moment` (2.31.0 or later) and its exact CodeMirror peers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const json = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const atLeast = (version, floor) => {
  const [a, b] = [version, floor].map(value => value.split('.').map(Number));
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
};

test('[AC-1] the root Obsidian API package is 1.14.4 with a patched moment and its exact peers', async () => {
  const [pkg, lock] = await Promise.all([json('package.json'), json('package-lock.json')]);
  assert.equal(pkg.devDependencies.obsidian, '1.14.4');
  const api = lock.packages['node_modules/obsidian'];
  assert.equal(api?.version, '1.14.4');
  // npm resolves the dependency next to its parent first, then hoisted.
  const moment = lock.packages['node_modules/obsidian/node_modules/moment'] ?? lock.packages['node_modules/moment'];
  assert.equal(api.dependencies.moment, moment?.version);
  assert.ok(atLeast(moment.version, '2.31.0'), `moment ${moment.version} is outside the patched range`);
  for (const [name, version] of Object.entries(api.peerDependencies ?? {}))
    assert.equal(lock.packages[`node_modules/${name}`]?.version, version, `${name} matches the exact peer`);
});
