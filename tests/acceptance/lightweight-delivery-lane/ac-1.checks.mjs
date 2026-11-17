// Increment: [[docs/increments/lightweight-delivery-lane]]
// AC-1: With the shipped configuration, a change set of only lane files (a docs page, `CHANGELOG.md`, a lockfile or `.github/dependabot.yml`) is exempt from the Definition of Ready and Done with a notice naming the lane.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { loadConfig } from '../../../src/cli/tooling/delivery/config.mjs';
import { exemption } from '../../../src/cli/tooling/delivery/run.mjs';
import { readyRules } from '../../../src/cli/tooling/delivery/rules-ready.mjs';
import { doneRules } from '../../../src/cli/tooling/delivery/rules-done.mjs';

const root = resolve(import.meta.dirname, '../../..');

test('[AC-1] lane-only change sets are exempt from both gates with a lane notice', async () => {
  for (const [gate, rules] of [['ready', readyRules], ['done', doneRules]]) {
    const { delivery } = await loadConfig(root, gate, rules);
    for (const changed of [['docs/development/GUIDE.md'], ['CHANGELOG.md'], ['package-lock.json'], ['projects/companion/package-lock.json'], ['.github/dependabot.yml'],
      ['README.md', 'docs/a/b.md', 'package-lock.json']]) {
      const notice = exemption(delivery, { headRef: 'claude/topic', actor: 'person', changed });
      assert.match(notice ?? '', /^Only lightweight-lane files changed \(\d+, all under docs, \*\.md, /, `${gate}: ${changed.join(', ')}`);
    }
  }
});
