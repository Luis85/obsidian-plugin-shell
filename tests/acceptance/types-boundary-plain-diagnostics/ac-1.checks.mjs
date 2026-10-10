// Increment: [[docs/increments/types-boundary-plain-diagnostics]]
// AC-1: `[TYPES-01]` passes with `FORCE_COLOR` set to `0`, set to `1` and unset, still asserting the exact TS6307 diagnostic and a non-zero exit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const typesBoundary = 'tooling/tests/types-boundary.checks.mjs';

// The evidence and suite runners set FORCE_COLOR=0, which TypeScript reads as "force pretty output".
for (const forceColor of ['0', '1', undefined]) {
  test(`[AC-1] TYPES-01 passes with FORCE_COLOR ${forceColor ?? 'unset'}`, { timeout: 900_000 }, () => {
    const env = { ...process.env, NODE_OPTIONS: '' };
    delete env.FORCE_COLOR; delete env.NO_COLOR; delete env.NODE_TEST_CONTEXT;
    if (forceColor !== undefined) env.FORCE_COLOR = forceColor;
    const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', typesBoundary],
      { cwd: root, env, encoding: 'utf8', timeout: 900_000, maxBuffer: 64 * 1024 * 1024 });
    const output = run.stdout + run.stderr;
    assert.equal(run.error, undefined, String(run.error));
    assert.equal(run.status, 0, output);
    assert.match(run.stdout, /^ok 1 - \[TYPES-01\] importing a source project that is not referenced fails the TypeScript build with TS6307/m);
    assert.match(run.stdout, /^# pass 1$/m);
    assert.match(run.stdout, /^# fail 0$/m);
  });
}
