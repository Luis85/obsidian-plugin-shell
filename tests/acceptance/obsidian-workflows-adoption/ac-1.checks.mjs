// Increment: [[docs/increments/obsidian-workflows-adoption]]
// AC-1: A project generated with `github` hosting has, in the `check` job of `.github/workflows/ci.yml`, a step using `obsidianmd/obsidian-workflows@8167caed39664214d82c86fdfa32e06d8d55f61d` with `mode: pr`, `strict: 'false'`, `build: 'false'` and `continue-on-error: true`, placed after `verify:artifacts`; the workflow passes `inspectWorkflow` and keeps top-level `contents: read`.
// The portable workflow policy (inspectWorkflow) runs over every generated workflow in
// tooling/tests/project-generator-devkit.checks.mjs; root tests never import tooling/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { compileProject, loadTemplateSnapshot } from '../../../src/cli/compiler/index.ts';
import { starterDocument } from '../../../src/shared/testing/starter-documents.mjs';
import { withHostingOption } from '../../../src/shared/companion/tooling-options.ts';

const root = new URL('../../../', import.meta.url).pathname;
const action = 'obsidianmd/obsidian-workflows@8167caed39664214d82c86fdfa32e06d8d55f61d';
const template = await loadTemplateSnapshot(root);
async function ciWorkflow(document) {
  const result = await compileProject({ source: JSON.stringify(document), template });
  assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
  const file = result.artifacts.find(artifact => artifact.path === '.github/workflows/ci.yml');
  assert.ok(file, 'the project has .github/workflows/ci.yml');
  return parse(file.content);
}

for (const [label, document] of [['default', starterDocument('quick-capture')], ['explicit github', withHostingOption(starterDocument('quick-capture'), { hosting: 'github' })]]) {
  test(`[AC-1] a ${label} hosting project validates against the Obsidian community directory, advisory, after the release build`, async () => {
    const workflow = await ciWorkflow(document);
    assert.deepEqual(workflow.permissions, { contents: 'read' });
    const steps = workflow.jobs.check.steps;
    const index = steps.findIndex(step => step.uses === action);
    assert.ok(index >= 0, 'the check job uses the pinned obsidianmd/obsidian-workflows action');
    const step = steps[index];
    assert.equal(step['continue-on-error'], true);
    assert.deepEqual(step.with, { type: 'plugin', mode: 'pr', build: 'false', 'scanner-lint': 'true', strict: 'false' });
    const build = steps.findIndex(item => /run verify:artifacts$/.test(item.run ?? ''));
    assert.ok(build >= 0 && build < index, 'verify:artifacts builds dist/ before the validation step');
    assert.equal(workflow.jobs.check.permissions, undefined, 'the job grants no extra scope');
    assert.equal(steps.filter(item => item.uses?.startsWith('obsidianmd/')).length, 1);
  });
}
