// Increment: [[docs/increments/main-reconciliation]] — real lifecycle and CI policy regressions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 4_000_000 });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
}
test('[AC-2] closed settings views cannot persist, and dependency/workflow guards reject stale or failed evidence', { timeout: 180000 }, async t => {
  const folder = await mkdtemp(join(tmpdir(), 'reconciliation-runtime-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const report = join(folder, 'runtime.json');
  run(['node_modules/vitest/vitest.mjs', 'run', '--reporter=json', '--outputFile', report, '--config', 'configs/testing/vitest.config.mjs', 'src/plugin/tests/unit/presentation-composables.test.ts']);
  const runtime = JSON.parse(await readFile(report, 'utf8'));
  assert.equal(runtime.success, true);
  assert.ok(runtime.numTotalTests > 0, 'the lifecycle suite must execute tests');
  assert.equal(runtime.numPassedTests, runtime.numTotalTests, 'every lifecycle test must pass without skips');
  run(['--test', 'tooling/tests/framework-manual.checks.mjs', 'tooling/tests/projects-boundary.checks.mjs']);
});
