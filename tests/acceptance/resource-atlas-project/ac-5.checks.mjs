// Increment: [[docs/increments/resource-atlas-project]]
// AC-5: `projects/resource-atlas` defines `check` (build and tests) and `test:e2e`, and its CI runs `check` on every pull request and `test:e2e` behind the `e2e` opt-in, keeping the `.qa/` results.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../../..');
const folder = resolve(root, 'projects/resource-atlas');
const runs = job => job.steps.map(step => step.run ?? '').join('\n');

test('[AC-5] resource-atlas wires its gate and browser verification into scripts and CI', async () => {
  const { scripts } = JSON.parse(await readFile(resolve(folder, 'package.json'), 'utf8'));
  assert.equal(scripts.check, 'npm run build && npm test');
  assert.equal(scripts.build, 'vite build && node scripts/package.mjs');
  assert.equal(scripts.test, 'node --test tests/domain.test.mjs tests/io.test.mjs');
  assert.equal(scripts['test:e2e'], 'node tests/browser.mjs');
  const workflow = parse(await readFile(resolve(folder, '.github/workflows/ci.yml'), 'utf8'));
  assert.ok(workflow.on.pull_request, 'CI runs on pull requests');
  assert.equal(workflow.jobs.check.if, undefined, 'check always runs');
  assert.match(runs(workflow.jobs.check), /run check$/m);
  assert.match(workflow.jobs.browser.if, /'e2e'/);
  assert.match(runs(workflow.jobs.browser), /run test:e2e$/m);
  const upload = workflow.jobs.browser.steps.find(step => String(step.uses).startsWith('actions/upload-artifact@'));
  assert.equal(upload.with.path, '.qa/');
});
