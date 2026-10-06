// Increment: [[docs/increments/main-reconciliation]] — real lifecycle and CI policy regressions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 4_000_000 });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
}
test('closed settings views cannot persist, and dependency/workflow guards reject stale or failed evidence', { timeout: 180000 }, () => {
  assert.match(run(['node_modules/vitest/vitest.mjs', 'run', '--config', 'configs/testing/vitest.config.mjs', 'tests/runtime/presentation-composables.test.ts']), /Tests\s+\d+ passed/);
  run(['--test', 'tests/tooling/framework-manual.checks.mjs', 'tests/tooling/projects-boundary.checks.mjs']);
});
