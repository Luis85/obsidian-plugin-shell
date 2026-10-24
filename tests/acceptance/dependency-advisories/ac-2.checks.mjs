// Increment: [[docs/increments/dependency-advisories]]
// AC-2: `package.json` overrides hold exactly the reviewed `fontless@0.2.1` and `obsidian@1.12.3` entries, `tooling/security/dependency-policy.json` pins `moment` 2.31.0 and records the reason, and `npm run check:dependencies` passes on the installed graph.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '../../..');
const json = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));

test('[AC-2] the overrides are exactly the two reviewed, narrow entries', async () => {
  assert.deepEqual((await json('package.json')).overrides, { 'fontless@0.2.1': { esbuild: '0.28.2' }, 'obsidian@1.12.3': { moment: '2.31.0' } });
});

test('[AC-2] the dependency policy pins moment 2.31.0 and records why the override exists', async () => {
  const policy = await json('tooling/security/dependency-policy.json');
  assert.equal(policy.packages.moment, '2.31.0');
  assert.match(policy.reason, /obsidian@1\.12\.3/); assert.match(policy.reason, /GHSA-4p3w-j4w9-5jqw/); assert.match(policy.reason, /type declarations only/);
});

test('[AC-2] check:dependencies passes on the installed graph', () => {
  const run = spawnSync(process.execPath, ['tooling/security/check-dependencies.mjs'], { cwd: root, encoding: 'utf8', timeout: 120000 });
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.match(run.stdout, /Exact direct\/installed versions/);
});
