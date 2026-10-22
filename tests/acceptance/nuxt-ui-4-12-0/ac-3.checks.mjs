// Increment: [[docs/increments/nuxt-ui-4-12-0]]
// AC-3: The shipped stylesheet budget is 168 KiB in the artifacts check, the performance thresholds and their tests, recorded as an owner approval, and the committed Companion concept matches its generator.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { thresholdFloors } from '../../../tooling/quality/thresholds.mjs';

const root = resolve(import.meta.dirname, '../../..');
const text = path => readFile(resolve(root, path), 'utf8');
const BUDGET = 168 * 1024;

test('[AC-3] the artifacts check, the threshold floors and the configured threshold agree on 168 KiB', async () => {
  assert.equal(thresholdFloors.performance.stylesCssBytes, BUDGET);
  assert.equal(JSON.parse(await text('configs/quality/thresholds.json')).performance.stylesCssBytes, BUDGET);
  const artifacts = await text('tooling/quality/check-artifacts.mjs');
  assert.match(artifacts, /Buffer\.byteLength\(css\) > 168 \* 1024\) throw new Error\('ARTIFACT_SIZE_BUDGET'\)/);
  assert.doesNotMatch(artifacts, /160 \* 1024/);
});

test('[AC-3] the budget raise is recorded as an owner approval for both threshold files', async () => {
  const { approvals } = JSON.parse(await text('configs/quality/self-review-approvals.json'));
  for (const file of ['configs/quality/thresholds.json', 'tooling/quality/thresholds.mjs']) {
    const record = approvals.find(entry => entry.file === file && entry.pullRequest === 205);
    assert.ok(record, `${file} has an approval for this pull request`);
    assert.equal(record.approvedBy, '@Luis85');
    assert.equal(record.rule, 'SR-QUALITY-CONFIG');
    assert.match(record.reason, /160 KiB to 168 KiB/);
  }
});

test('[AC-3] the committed Companion concept was regenerated for the pinned Nuxt UI version', async () => {
  const concept = await text('docs/concepts/companion/index.html');
  assert.ok(concept.includes("const VISUAL_NUXT_UI_VERSION = '4.12.0';"));
  assert.ok(!concept.includes("const VISUAL_NUXT_UI_VERSION = '4.11.3';"));
});
