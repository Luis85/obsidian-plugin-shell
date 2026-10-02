import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { sha256 } from '../../scripts/testing/source-inputs.mjs';

const cli = resolve('scripts/quality/check-maintainability.mjs');
const composition = 'export function present(values: readonly number[]) {\n  return values.map(value => value * 2);\n}\n';
async function fixture(action) {
  const root = await mkdtemp(join(tmpdir(), 'maintainability-fixture-'));
  try {
    for (const directory of ['src', 'scripts', 'tests', 'harness']) await mkdir(join(root, directory));
    for (const file of ['package.json', 'package-lock.json', '.fallowrc.json']) await writeFile(join(root, file), await readFile(resolve(file)));
    await symlink(resolve('node_modules'), join(root, 'node_modules'), 'junction');
    await writeFile(join(root, 'src/main.ts'), composition);
    await action(root);
  } finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + '\\') || resolve(root).startsWith(resolve(tmpdir()) + '/'));
    await rm(root, { recursive: true, force: true });
  }
}
function run(root, args = []) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
  assert.ifError(result.error);
  return result;
}
function packet(result) { return JSON.parse(result.stdout); }


test('maintainability inventories every concept Python source without diluting production metrics', async () => {
  await fixture(async root => {
    const before = run(root); assert.equal(before.status, 0, before.stderr);
    const baseline = JSON.parse(await readFile(join(packet(before).output, 'report.json'), 'utf8'));
    const sources = [];
    for (const directory of ['scripts/concepts', 'tests/concepts']) {
      await mkdir(join(root, directory), { recursive: true });
      for (const name of (await readdir(resolve(directory))).filter(name => name.endsWith('.py')).sort()) {
        const path = `${directory}/${name}`;
        const bytes = await readFile(resolve(path));
        await writeFile(join(root, path), bytes);
        sources.push({ path, bytes });
      }
    }
    assert.ok(sources.some(file => file.path === 'scripts/concepts/build-companion.py'));
    assert.ok(sources.some(file => file.path === 'tests/concepts/companion-storage.browser.py'));
    const result = run(root); assert.equal(result.status, 0, result.stderr);
    const output = packet(result).output;
    const reportPath = join(output, 'report.json');
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    const inventoried = report.inventory.files.filter(file => file.extension === 'py');
    assert.equal(inventoried.length, sources.length);
    for (const source of sources) {
      const entry = inventoried.find(file => file.path === source.path);
      assert.ok(entry, source.path);
      assert.equal(entry.sha256, sha256(source.bytes));
      assert.equal(entry.bytes, source.bytes.length);
      assert.equal(entry.view, 'unsupported');
      assert.equal(entry.measurement, 'not-measured');
      assert.match(entry.reason, /Python concept tooling/);
      for (const view of Object.values(report.views)) assert.ok(!view.inputs.some(input => input.path === source.path));
    }
    assert.deepEqual(report.views.production.inputs, baseline.views.production.inputs);
    assert.deepEqual(report.views.production.health, baseline.views.production.health);
    assert.deepEqual(report.views.production.duplication, baseline.views.production.duplication);
    assert.equal(run(root, ['--check', output]).status, 0);
    // Unsupported by Fallow does not mean absent from stale/tampered evidence checks.
    const original = await readFile(reportPath, 'utf8');
    report.inventory.files = report.inventory.files.filter(file => file.path !== sources[0].path);
    await writeFile(reportPath, JSON.stringify(report));
    assert.match(run(root, ['--check', output]).stderr, /METRIC_STALE_INVENTORY/);
    await writeFile(reportPath, original);
    await writeFile(join(root, sources[0].path), Buffer.concat([sources[0].bytes, Buffer.from('\n# changed Python source\n')]));
    assert.match(run(root, ['--check', output]).stderr, /METRIC_STALE_INVENTORY/);
  });
});

