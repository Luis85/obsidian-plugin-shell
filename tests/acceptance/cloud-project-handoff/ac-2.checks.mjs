// Increment: [[docs/increments/cloud-project-handoff]]
// AC-2: The documented project-JSON recipe derives a project from the blank starter that `project validate` accepts and `new --from --dry-run` plans without conflicts or writes, and it refuses a project-kind starter.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');

test('[AC-2] the documented recipe runs against the real CLI and refuses a project starter', { timeout: 300_000 }, () => {
  const env = { ...process.env, NODE_OPTIONS: '' };
  delete env.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern=the documented recipe derives a valid project|negative: the recipe refuses a project starter',
    'tooling/tests/agent-cloud-project-handoff-skill.checks.mjs'], { cwd: root, env, encoding: 'utf8', timeout: 300_000, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(run.error, undefined, String(run.error));
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /^ok \d+ - the documented recipe derives a valid project/m);
  assert.match(run.stdout, /^ok \d+ - negative: the recipe refuses a project starter/m);
  assert.match(run.stdout, /^# pass 2$/m);
  assert.match(run.stdout, /^# fail 0$/m);
});
