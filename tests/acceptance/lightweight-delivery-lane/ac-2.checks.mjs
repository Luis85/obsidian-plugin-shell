// Increment: [[docs/increments/lightweight-delivery-lane]]
// AC-2: A change set with any file outside the lane, an Increment, PullRequest or Issue document, or no files at all is not exempt and keeps the full check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { loadConfig } from '../../../src/cli/tooling/delivery/config.mjs';
import { exemption } from '../../../src/cli/tooling/delivery/run.mjs';
import { readyRules } from '../../../src/cli/tooling/delivery/rules-ready.mjs';

const root = resolve(import.meta.dirname, '../../..');

test('[AC-2] outside files, delivery documents and empty change sets keep the full check', async () => {
  const { delivery } = await loadConfig(root, 'ready', readyRules);
  const cases = [['CHANGELOG.md', 'src/cli/index.ts'], ['package.json'], ['projects/companion/package.json'], ['.github/workflows/ci.yml'],
    ['src/plugin/README.md'], ['docs/increments/some-increment.md'], ['docs/guide.md', 'docs/pull-requests/some-increment-kickoff.md'],
    ['docs/issues/some-issue.md'], []];
  for (const changed of cases) assert.equal(exemption(delivery, { headRef: 'claude/topic', actor: 'person', changed }), null, changed.join(', ') || '(empty)');
});
