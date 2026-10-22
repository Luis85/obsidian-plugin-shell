// Increment: [[docs/increments/cloud-project-handoff]]
// AC-3: The takeover prompt template documents every placeholder it uses and keeps the local limits: no `npm install`, no remote or push, no personal vault and no feature work.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');

test('[AC-3] the takeover prompt documents every placeholder and keeps the local limits', { timeout: 300_000 }, () => {
  const env = { ...process.env, NODE_OPTIONS: '' };
  delete env.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern=every takeover placeholder is documented|the skill keeps its authorization and safety rules',
    'tooling/tests/agent-cloud-project-handoff-skill.checks.mjs'], { cwd: root, env, encoding: 'utf8', timeout: 300_000, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(run.error, undefined, String(run.error));
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /^ok \d+ - every takeover placeholder is documented/m);
  assert.match(run.stdout, /^ok \d+ - the skill keeps its authorization and safety rules/m);
  assert.match(run.stdout, /^# pass 2$/m);
  assert.match(run.stdout, /^# fail 0$/m);
});
