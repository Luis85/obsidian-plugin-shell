// Increment: [[docs/increments/dor-09-gate-prefixes]]
// AC-1: A Test plan gate that starts with a configured prefix, such as the handoff template's own `node bin/app check` example, satisfies DOR-09.
import test from 'node:test';
import assert from 'node:assert/strict';
import { baseContext, configs, readyHandoff, results } from '../../../src/cli/tests/support/delivery-fixture.mjs';

const config = await configs();
const outcome = gate => results('ready', config, baseContext(config, readyHandoff().replace('Gate `node scripts/tool.mjs --flag`', `Gate \`${gate}\``)))['DOR-09'];

test('[AC-1] the template example and every other configured prefix pass DOR-09', () => {
  for (const gate of ['node bin/app check --fast --base origin/main', 'node bin/app check', 'actionlint', 'shellcheck tooling/x.sh'])
    assert.equal(outcome(gate).status, 'pass', gate);
});
