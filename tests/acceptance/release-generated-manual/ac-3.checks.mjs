// Increment: [[docs/increments/release-generated-manual]]
// AC-3: Release preparation plans generated outputs without writes and refuses a broken output contract or a generated file changed while preparing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');

// The preparation test plans a generated stamp file without writing it, refuses missing, extra, non-string and colliding
// paths with RELEASE_GENERATED_CONTRACT and a stamp edited mid-preparation with RELEASE_STALE_INPUT, then applies it.
test('[AC-3] release preparation plans generated outputs without writes and refuses a broken contract or a changed generated file', { timeout: 120_000 }, () => {
  const env = { ...process.env, NODE_OPTIONS: '' };
  delete env.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern=prepare plans generated outputs', 'tooling/tests/release.checks.mjs'],
    { cwd: root, env, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
  const output = run.stdout + run.stderr;
  assert.equal(run.error, undefined, String(run.error));
  assert.equal(run.status, 0, output);
  assert.match(run.stdout, /^ok \d+ - prepare plans generated outputs for the new version without writes/m);
  assert.match(run.stdout, /^# pass 1$/m);
  assert.match(run.stdout, /^# fail 0$/m);
});
