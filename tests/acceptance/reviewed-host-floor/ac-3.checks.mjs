// Increment: [[docs/increments/reviewed-host-floor]]
// AC-3: The tested-host pins (host default, native smoke target and template, evidence guard, foreign-notice witness, real-Obsidian runner, CI and devkit cache keys) name 1.14.4 and the example ownership hashes match the changed example-owned files
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
// Tooling files are read as text: root tests never import tooling/.
const text = path => readFile(resolve(root, path), 'utf8');
const pins = {
  'tooling/testing/obsidian-host.mjs': ["const DEFAULT_APP_VERSION = '1.14.4';"],
  'tooling/testing/check-native.mjs': ["targetApp: '1.14.4'", "launcher.resolveVersion('1.14.4', 'latest')"],
  'templates/examples/scripts__testing__check-native.mjs.txt': ["targetApp: '1.14.4'", "launcher.resolveVersion('1.14.4', 'latest')"],
  'tooling/testing/evidence-adapters.mjs': ["raw.targetApp !== '1.14.4'"],
  'tooling/testing/native-foreign-notice.mjs': ["minAppVersion: '1.14.4'"],
  'tooling/testing/run-obsidian-tests.mjs': ['OBSIDIAN_VERSION selects the host (default 1.14.4)'],
  '.github/workflows/ci.yml': ['obsidian-host-${{ runner.os }}-app-1.14.4-launcher-3.2.1'],
  'templates/companion/devkit/workflow-obsidian.yml.tmpl': ['obsidian-host-${{ runner.os }}-app-1.14.4-launcher-3.2.1'],
  'templates/companion/devkit/azure-pipelines.yml.tmpl': ['app-1.14.4-launcher-3.2.1'],
};

test('[AC-3] every tested-host pin names Obsidian 1.14.4 and none keeps 1.13.7', async () => {
  for (const [path, expected] of Object.entries(pins)) {
    const source = await text(path);
    for (const pin of expected) assert.ok(source.includes(pin), `${path} pins ${pin}`);
    assert.doesNotMatch(source, /1\.13\.7/, `${path} keeps no 1.13.7 host pin`);
  }
});

test('[AC-3] the example ownership hashes match the changed example-owned files', async () => {
  const ownership = JSON.parse(await text('tooling/examples/ownership.json'));
  const entries = Object.values(ownership).filter(Array.isArray).flat();
  for (const path of ['README.md', 'tooling/testing/check-native.mjs', 'tooling/testing/native-foreign-notice.mjs']) {
    const entry = entries.find(item => item?.path === path);
    assert.ok(entry, `${path} is example-owned`);
    assert.equal(entry.sha256, createHash('sha256').update(await readFile(resolve(root, path))).digest('hex'), `${path} hash is current`);
  }
});
