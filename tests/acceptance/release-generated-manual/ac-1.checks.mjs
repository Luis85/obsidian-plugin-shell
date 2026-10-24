// Increment: [[docs/increments/release-generated-manual]]
// AC-1: A release cut for a bumped version commits the CLI manual regenerated for that version, and `manual.mjs --check` passes on the release head.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');

// The release-cut test cuts 0.4.0 in a git fixture that carries the real manual generator and command catalog, then runs
// `manual.mjs --check` on the release head; release:prepare plans the same manual and writes nothing on a dry run.
test('[AC-1] a release cut commits the CLI manual for the bumped version and manual.mjs --check passes on the release head', { timeout: 120_000 }, () => {
  const env = { ...process.env, NODE_OPTIONS: '' };
  delete env.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern=CLI manual regenerated for the bumped version|release:prepare plans the manual', 'tooling/tests/release-cut.checks.mjs'],
    { cwd: root, env, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
  const output = run.stdout + run.stderr;
  assert.equal(run.error, undefined, String(run.error));
  assert.equal(run.status, 0, output);
  assert.match(run.stdout, /^ok \d+ - the release commit carries the CLI manual regenerated for the bumped version, so manual\.mjs --check passes on the release head/m);
  assert.match(run.stdout, /^ok \d+ - release:prepare plans the manual without writes/m);
  assert.match(run.stdout, /^# pass 2$/m);
  assert.match(run.stdout, /^# fail 0$/m);
});
