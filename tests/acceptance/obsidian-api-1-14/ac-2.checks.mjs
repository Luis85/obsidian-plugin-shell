// Increment: [[docs/increments/obsidian-api-1-14]]
// AC-2: The manifest floor, the default real-Obsidian host and the native smoke target are all 1.14.4, and released versions keep their recorded floors.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requestedAppVersion } from '../../../tooling/testing/obsidian-host.mjs';

const root = resolve(import.meta.dirname, '../../..');
const text = path => readFile(resolve(root, path), 'utf8');

test('[AC-2] the declared floor is the host the real-Obsidian tooling launches', async () => {
  const manifest = JSON.parse(await text('manifest.json'));
  assert.equal(manifest.minAppVersion, '1.14.4');
  assert.equal(requestedAppVersion({}), manifest.minAppVersion, 'test:obsidian and dev:obsidian default to the floor');
  const native = await text('tooling/testing/check-native.mjs');
  assert.match(native, /targetApp: '1\.14\.4'/);
  assert.match(native, /resolveVersion\('1\.14\.4', 'latest'\)/);
  const cacheKeys = (await text('.github/workflows/ci.yml')).match(/obsidian-host-\$\{\{ runner\.os \}\}-app-[\d.]+/g);
  assert.deepEqual(cacheKeys, ['obsidian-host-${{ runner.os }}-app-1.14.4'], 'the CI host cache follows the floor');
  const versions = JSON.parse(await text('versions.json'));
  for (const release of ['0.1.0', '0.2.0', '0.3.0', '0.4.0']) assert.equal(versions[release], '1.13.7', `released ${release} keeps its recorded floor`);
});
