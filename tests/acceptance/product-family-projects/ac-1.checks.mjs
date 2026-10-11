// Increment: [[docs/increments/product-family-projects]]
// AC-1: `checkProjects` passes and lists `component-atlas`, `storyloom`, `sitemap-atlas` and `dissect-canvas`, each linking `docs/concepts/<name>` and `docs/concepts/product-family`, with its CI workflow synced and an npm Dependabot entry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../../..');
const FAMILY = ['component-atlas', 'storyloom', 'sitemap-atlas', 'dissect-canvas'];

test('[AC-1] the four product family projects pass the standalone project contract', () => {
  // The real gate, run as `npm run check:projects` runs it; tests never import tooling (that would close a package cycle).
  const run = spawnSync(process.execPath, [resolve(root, 'tooling/projects/projects.mjs'), 'check', '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const result = JSON.parse(run.stdout);
  assert.deepEqual(result.failures, []);
  assert.equal(result.status, 'passed');
  for (const name of FAMILY) {
    const project = result.projects.find(entry => entry.name === name);
    assert.ok(project, `${name} is listed`);
    assert.deepEqual(project.prototypes, [`docs/concepts/${name}`, 'docs/concepts/product-family']);
    assert.deepEqual(project.workflows, ['ci.yml']);
    assert.ok(result.syncedWorkflows.includes(`projects--${name}--ci.yml`), `${name} CI is synced`);
  }
});

test('[AC-1] Dependabot updates each project\'s npm dependencies and workflow actions', async () => {
  const { updates } = parse(await readFile(resolve(root, '.github/dependabot.yml'), 'utf8'));
  const actions = updates.find(update => update['package-ecosystem'] === 'github-actions');
  for (const name of FAMILY) {
    assert.ok(updates.some(update => update['package-ecosystem'] === 'npm' && update.directory === `/projects/${name}`), `${name} npm entry`);
    assert.ok(actions.directories.includes(`/projects/${name}`), `${name} workflow actions`);
  }
});
