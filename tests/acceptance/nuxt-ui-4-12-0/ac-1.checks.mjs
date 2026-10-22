// Increment: [[docs/increments/nuxt-ui-4-12-0]]
// AC-1: The shell, its reviewed pins and the generated-project catalog all use Nuxt UI 4.12.0, and the two hash-guarded runtime modules are unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { VISUAL_NUXT_UI_VERSION } from '../../../src/shared/companion/visual/visual-catalog.mjs';

const root = resolve(import.meta.dirname, '../../..');
const read = path => readFile(resolve(root, path));
const json = async path => JSON.parse(await read(path));
const VERSION = '4.12.0';

test('[AC-1] package, lock, dependency policy, adaptation profile and generated-project catalog agree on 4.12.0', async () => {
  const [pkg, lock, policy, adaptation, installed] = await Promise.all([json('package.json'), json('package-lock.json'),
    json('tooling/security/dependency-policy.json'), json('tooling/bundling/ui-adaptation.json'), json('node_modules/@nuxt/ui/package.json')]);
  assert.equal(pkg.dependencies['@nuxt/ui'], VERSION);
  assert.equal(lock.packages['node_modules/@nuxt/ui']?.version, VERSION);
  assert.equal(installed.version, VERSION);
  assert.equal(policy.packages['@nuxt/ui'], VERSION);
  assert.equal(adaptation.version, VERSION);
  assert.equal(VISUAL_NUXT_UI_VERSION, VERSION);
});

test('[AC-1] every runtime module the shell replaces still has its reviewed hash', async () => {
  const adaptation = await json('tooling/bundling/ui-adaptation.json');
  const replaced = Object.entries(adaptation.replaced);
  assert.equal(replaced.length, 2, 'the adaptation replaces exactly the colour and head plugins');
  for (const [path, expected] of replaced)
    assert.equal(createHash('sha256').update(await read(path)).digest('hex'), expected, `${path} is the reviewed module`);
});

test('[AC-1] the README and its reviewed ownership record name the same bytes', async () => {
  const ownership = await json('tooling/examples/ownership.json');
  const record = ownership.files.find(file => file.path === 'README.md');
  assert.equal(record?.sha256, createHash('sha256').update(await read('README.md')).digest('hex'));
});
