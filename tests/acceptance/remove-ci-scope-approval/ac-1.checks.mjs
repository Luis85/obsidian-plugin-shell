// Increment: [[docs/increments/remove-ci-scope-approval]]
// AC-1: `configs/quality/self-review-approvals.json` has schemaVersion 1, no approval for `configs/quality/ci-scope.json`, and every remaining entry is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');

test('[AC-1] the merged ci-scope approval is removed and the other approvals stay', async () => {
  const record = JSON.parse(await readFile(resolve(root, 'configs/quality/self-review-approvals.json'), 'utf8'));
  assert.equal(record.schemaVersion, 1);
  assert.deepEqual(record.approvals.filter(entry => entry.file === 'configs/quality/ci-scope.json'), []);
  assert.equal(record.approvals.length, 41, 'only the ci-scope entry is removed');
  const last = record.approvals.at(-1);
  assert.deepEqual([last.rule, last.file, last.pullRequest], ['SR-QUALITY-CONFIG', 'configs/quality/fallow.json', 249], 'the previous last entry is untouched');
});
