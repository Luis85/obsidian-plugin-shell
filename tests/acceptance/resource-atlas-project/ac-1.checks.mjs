// Increment: [[docs/increments/resource-atlas-project]]
// AC-1: `checkProjects` passes and lists `resource-atlas`, linking `docs/concepts/resource-atlas` and `docs/concepts/product-family`, with its CI workflow synced and an npm Dependabot entry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../../..');

test('[AC-1] resource-atlas passes the standalone project contract', () => {
  // The real gate, run as `npm run check:projects` runs it; tests never import tooling (that would close a package cycle).
  const run = spawnSync(process.execPath, [resolve(root, 'tooling/projects/projects.mjs'), 'check', '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const result = JSON.parse(run.stdout);
  assert.deepEqual(result.failures, []);
  const project = result.projects.find(entry => entry.name === 'resource-atlas');
  assert.ok(project, 'resource-atlas is listed');
  assert.deepEqual(project.prototypes, ['docs/concepts/resource-atlas', 'docs/concepts/product-family']);
  assert.deepEqual(project.workflows, ['ci.yml']);
  assert.ok(result.syncedWorkflows.includes('projects--resource-atlas--ci.yml'));
});

test('[AC-1] Dependabot updates the project\'s npm dependencies and workflow actions', async () => {
  const { updates } = parse(await readFile(resolve(root, '.github/dependabot.yml'), 'utf8'));
  assert.ok(updates.some(update => update['package-ecosystem'] === 'npm' && update.directory === '/projects/resource-atlas'));
  assert.ok(updates.find(update => update['package-ecosystem'] === 'github-actions').directories.includes('/projects/resource-atlas'));
});
