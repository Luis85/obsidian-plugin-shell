// Increment: [[docs/increments/cloud-project-handoff]]
// AC-1: The cloud-project-handoff skill and its Codex adapter pass the shared skill structure checks: frontmatter, cited commands and files, safety rules and a final AskUserQuestion close naming increment-handoff.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');

test('[AC-1] the skill structure, citations, safety rules and adapter pass in a fresh process', { timeout: 300_000 }, () => {
  const env = { ...process.env, NODE_OPTIONS: '' };
  delete env.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern=the skill has matching frontmatter|every cited references file|the skill keeps its authorization and safety rules|the skill has a thin Codex adapter',
    'tooling/tests/agent-cloud-project-handoff-skill.checks.mjs'], { cwd: root, env, encoding: 'utf8', timeout: 300_000, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(run.error, undefined, String(run.error));
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /^ok \d+ - the skill has matching frontmatter/m);
  assert.match(run.stdout, /^ok \d+ - every cited references file/m);
  assert.match(run.stdout, /^ok \d+ - the skill keeps its authorization and safety rules/m);
  assert.match(run.stdout, /^ok \d+ - the skill has a thin Codex adapter/m);
  assert.match(run.stdout, /^# pass 4$/m);
  assert.match(run.stdout, /^# fail 0$/m);
});
