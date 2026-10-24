// Increment: [[docs/increments/reusable-workflow-permissions]]
// AC-1: The workflow model checks fail when a job calling a local reusable workflow grants less than the callee or one of its jobs requests, and pass for the repository's workflows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');

// The guard test checks every real call and, in memory, that release.yml granting only contents: read reports
// ci.yml's ci-result checks: read (the 0.5.0 startup failure) and that a job-level grant replaces the workflow's.
test('[AC-1] every local reusable-workflow call grants what its callee requests, and an under-granting caller is reported', { timeout: 120_000 }, () => {
  const env = { ...process.env, NODE_OPTIONS: '' };
  delete env.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern=local reusable workflow', 'tooling/tests/interactive-maker-ci-workflow-model.checks.mjs'],
    { cwd: root, env, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
  const output = run.stdout + run.stderr;
  assert.equal(run.error, undefined, String(run.error));
  assert.equal(run.status, 0, output);
  assert.match(run.stdout, /^ok \d+ - every job that calls a local reusable workflow grants each permission the callee or its jobs request/m);
  assert.match(run.stdout, /^# pass 1$/m);
  assert.match(run.stdout, /^# fail 0$/m);
});
