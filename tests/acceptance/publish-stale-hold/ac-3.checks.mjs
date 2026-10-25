// Increment: [[docs/increments/publish-stale-hold]]
// AC-3: `publish.yml` grants its publish job `actions: write` while staying dispatch-only behind the `release` environment, `npm run check:repository` passes, and the publish guide and workflow reference describe the `requalify` step and the permission.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../../..');
const text = path => readFile(resolve(root, path), 'utf8');

test('[AC-3] the publish job may re-run workflows and stays dispatch-only behind the release environment', async () => {
  const workflow = parse(await text('.github/workflows/publish.yml'));
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.equal(workflow.jobs.publish.environment, 'release');
  assert.deepEqual(workflow.jobs.publish.permissions, { contents: 'write', 'pull-requests': 'write', actions: 'write', checks: 'read' });
});

test('[AC-3] the repository workflow policy passes with the new permission', () => {
  const run = spawnSync(process.execPath, ['tooling/quality/check-repository.mjs'], { cwd: root, encoding: 'utf8', timeout: 300000 });
  assert.equal(run.status, 0, run.stderr + run.stdout);
});

test('[AC-3] the publish guide and the workflow reference describe the requalify step and the permission', async () => {
  const guide = await text('docs/development/CUT-AND-PUBLISH-A-RELEASE.md');
  for (const word of ['requalify', 'actions: write', 'PUBLISH_HOLD_WAIT_SECONDS', 'HOLD_RERUN_FAILED', 'HOLD_RERUN_TIMEOUT']) assert.ok(guide.includes(word), word);
  assert.match(await text('docs/development/WORKFLOWS.md'), /`publish\.yml` › `publish` \| `contents: write`, `pull-requests: write`, `actions: write`, `checks: read`/);
});
