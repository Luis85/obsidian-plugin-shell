// Increment: [[docs/increments/dor-09-gate-prefixes]]
// AC-2: DOR-09 still rejects an unknown node script, a mistyped npm script and a command outside the configured prefixes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { baseContext, configs, readyHandoff, results } from '../../../src/cli/tests/support/delivery-fixture.mjs';

const config = await configs();
const outcome = gate => results('ready', config, baseContext(config, readyHandoff().replace('Gate `node scripts/tool.mjs --flag`', `Gate \`${gate}\``)))['DOR-09'];

test('[AC-2] unknown gates fail DOR-09 and name the offending line', () => {
  for (const gate of ['node scripts/missing.mjs', 'node bin/appx', 'node --flag', 'npm run chekc', 'rm -rf build']) {
    const result = outcome(gate);
    assert.equal(result.status, 'fail', gate);
    assert.match(result.details.join('\n'), /unknown gate/, gate);
  }
});
