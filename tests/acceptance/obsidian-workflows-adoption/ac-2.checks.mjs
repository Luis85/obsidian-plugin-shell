// Increment: [[docs/increments/obsidian-workflows-adoption]]
// AC-2: A project generated with `github` hosting has `.github/workflows/obsidian-release.yml`, triggered only by `workflow_dispatch`, whose job is skipped unless `github.ref` starts with `refs/tags/`, grants only `contents`, `id-token` and `attestations` write behind `environment: release`, copies `dist/main.js` and `dist/styles.css` to the root before running the pinned action with `mode: release` and `build: 'false'`, and passes `inspectWorkflow`.
// The policy check of this file under its name (inspectWorkflow) runs in tooling/tests/project-generator-devkit.checks.mjs
// and, through the real checker CLI, in ac-3; root tests never import tooling/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { compileProject, loadTemplateSnapshot } from '../../../src/cli/compiler/index.ts';
import { starterDocument } from '../../../src/shared/testing/starter-documents.mjs';

const root = new URL('../../../', import.meta.url).pathname;
const action = 'obsidianmd/obsidian-workflows@8167caed39664214d82c86fdfa32e06d8d55f61d';
const result = await compileProject({ source: JSON.stringify(starterDocument('quick-capture')), template: await loadTemplateSnapshot(root) });
assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
const file = result.artifacts.find(artifact => artifact.path === '.github/workflows/obsidian-release.yml');

test('[AC-2] a GitHub project gets a dispatch-only release workflow that runs only on a tag, behind the release environment', () => {
  assert.ok(file, 'the project has .github/workflows/obsidian-release.yml');
  const workflow = parse(file.content);
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(Object.keys(workflow.jobs), ['release']);
  const job = workflow.jobs.release;
  assert.equal(job.if, "startsWith(github.ref, 'refs/tags/')");
  assert.equal(job.environment, 'release');
  assert.deepEqual(job.permissions, { contents: 'write', 'id-token': 'write', attestations: 'write' });
  assert.equal(job.uses, undefined, 'no reusable workflow call');
});

test('[AC-2] the job builds, places main.js and styles.css at the root, then runs the pinned action in release mode', () => {
  const steps = parse(file.content).jobs.release.steps;
  const at = predicate => { const index = steps.findIndex(predicate); assert.ok(index >= 0); return index; };
  const checkout = at(step => step.uses?.startsWith('actions/checkout@'));
  assert.equal(steps[checkout].with['persist-credentials'], false);
  const install = at(step => /PINNED_NPM" ci /.test(step.run ?? ''));
  const build = at(step => /PINNED_NPM" run build$/.test(step.run ?? ''));
  const place = at(step => step.run === 'cp dist/main.js dist/styles.css .');
  const release = at(step => step.uses === action);
  assert.ok(checkout < install && install < build && build < place && place < release, [checkout, install, build, place, release].join());
  assert.deepEqual(steps[release].with, { type: 'plugin', mode: 'release', build: 'false' });
  assert.deepEqual(steps[release].env, { GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}' });
  assert.equal(steps[release]['continue-on-error'], undefined, 'a failed release validation fails the run');
  assert.ok(steps.every(step => !step.uses || /@[a-f0-9]{40}$/.test(step.uses)), 'every action is pinned by SHA');
});
