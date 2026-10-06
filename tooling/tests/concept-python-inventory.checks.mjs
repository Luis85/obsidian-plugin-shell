import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { maintainabilityInventory } from '../quality/maintainability-inventory.mjs';
import { sha256 } from '../../src/shared/platform/hash.ts';

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'python-inventory-'));
  try {
    for (const name of ['src', 'scripts/hindsight', 'tests/hindsight', 'harness']) await mkdir(join(root, name), { recursive: true });
    for (const name of ['package.json', 'package-lock.json', '.fallowrc.json']) await writeFile(join(root, name), '{}\n');
    await writeFile(join(root, 'src/main.ts'), 'export const value = 1;\n');
    await run(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('optional memory Python is fingerprinted, but never dilutes measured production', async () => {
  await fixture(async root => {
    const baseline = await maintainabilityInventory(root);
    const paths = ['scripts/hindsight/embedded.py', 'tests/hindsight/test_embedded.py', 'tests/hindsight/test_providers.py'];
    const bytes = 'value = "synthetic"\n';
    for (const path of paths) await writeFile(join(root, path), bytes);
    const inventory = await maintainabilityInventory(root);
    const python = inventory.files.filter(file => file.extension === 'py');
    assert.deepEqual(python.map(file => file.path), paths);
    for (const entry of python) {
      assert.equal(entry.sha256, sha256(bytes));
      assert.equal(entry.bytes, Buffer.byteLength(bytes));
      assert.equal(entry.view, 'unsupported');
      assert.equal(entry.measurement, 'not-measured');
      assert.match(entry.reason, /optional memory tooling/);
    }
    assert.deepEqual(inventory.files.filter(file => file.view === 'production'), baseline.files.filter(file => file.view === 'production'));
    assert.notEqual(inventory.digest, baseline.digest);
    await writeFile(join(root, paths[0]), bytes + '# changed\n');
    assert.notEqual((await maintainabilityInventory(root)).digest, inventory.digest);
    await rm(join(root, paths[0]));
    assert.notEqual((await maintainabilityInventory(root)).digest, inventory.digest);
  });
});

for (const path of ['src/embedded.py', 'scripts/hindsight/unreviewed.py', 'tests/hindsight/unreviewed.py', 'scripts/hindsight/embedded.rb']) {
  test(`unreviewed language input is still rejected: ${path}`, async () => {
    await fixture(async root => {
      await writeFile(join(root, path), '# must not be exempted\n');
      await assert.rejects(maintainabilityInventory(root), error => error.message === `METRIC_UNCLASSIFIED_INPUT: ${path}`);
    });
  });
}
