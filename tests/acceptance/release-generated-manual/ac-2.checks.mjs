// Increment: [[docs/increments/release-generated-manual]]
// AC-2: The release-branch gate fails with `RELEASE_GENERATED_STALE` when the generated manual is not current for the release version.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');

// The same release-cut test restores main's 0.3.0 manual on release/0.4.0: verifyReleaseBranch reports the cli-manual check
// failed with RELEASE_GENERATED_STALE and manual.mjs --check fails with MANUAL_STALE.
test('[AC-2] the release-branch gate fails with RELEASE_GENERATED_STALE when the manual is not current for the release version', { timeout: 120_000 }, () => {
  const env = { ...process.env, NODE_OPTIONS: '' };
  delete env.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern=CLI manual regenerated for the bumped version', 'tooling/tests/release-cut.checks.mjs'],
    { cwd: root, env, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
  const output = run.stdout + run.stderr;
  assert.equal(run.error, undefined, String(run.error));
  assert.equal(run.status, 0, output);
  assert.match(run.stdout, /^ok \d+ - the release commit carries the CLI manual regenerated for the bumped version/m);
  assert.match(run.stdout, /^# pass 1$/m);
  assert.match(run.stdout, /^# fail 0$/m);
});
