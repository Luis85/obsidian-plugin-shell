// Increment: [[docs/increments/e2e-source-paths]]
// AC-1: The planned example removal keeps the foundation browser test on the URL the harness preview serves, and its harness imports resolve.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');

test('[AC-1] the planned foundation browser test opens the served harness URL', { timeout: 120_000 }, () => {
  const env = { ...process.env, NODE_OPTIONS: '' };
  delete env.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern=EXAMPLES-SERVED-HARNESS', 'tooling/tests/example-removal.checks.mjs'],
    { cwd: root, env, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
  const output = run.stdout + run.stderr;
  assert.equal(run.error, undefined, String(run.error));
  assert.equal(run.status, 0, output);
  assert.match(run.stdout, /^ok \d+ - \[EXAMPLES-SERVED-HARNESS\] the planned foundation browser test opens the URL the harness preview serves/m);
  assert.match(run.stdout, /^# pass 1$/m);
  assert.match(run.stdout, /^# fail 0$/m);
});
