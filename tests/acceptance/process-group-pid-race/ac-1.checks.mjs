// Increment: [[docs/increments/process-group-pid-race]]
// AC-1: PROCESS-GROUP-04 waits for a complete positive pid, and PROCESS-GROUP-08 proves an empty pid file is not read as pid 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const skip = process.platform === 'win32' ? 'PROCESS-GROUP-04 exercises POSIX process groups' : false;

test('[AC-1] the termination test waits for a whole pid and its empty-file regression passes', { skip, timeout: 120_000 }, () => {
  const env = { ...process.env, NODE_OPTIONS: '' };
  delete env.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern=PROCESS-GROUP-0[48]', 'tooling/tests/agent-process-group.checks.mjs'],
    { cwd: root, env, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
  const output = run.stdout + run.stderr;
  assert.equal(run.error, undefined, String(run.error));
  assert.equal(run.status, 0, output);
  assert.match(run.stdout, /^ok \d+ - \[PROCESS-GROUP-04\] a terminated hook takes its group down with it/m);
  assert.match(run.stdout, /^ok \d+ - \[PROCESS-GROUP-08\] a pid file that exists but is still empty is not read as pid 0/m);
  assert.match(run.stdout, /^# pass 2$/m);
  assert.match(run.stdout, /^# fail 0$/m);
});
