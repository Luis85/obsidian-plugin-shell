import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validatePlan, acceptanceEvidence, releaseDecision } from '../../scripts/testing/test-plan.mjs';
const fresh = async () => JSON.parse(await readFile(new URL('../../docs/testing/test-plan.json', import.meta.url), 'utf8'));
test('[POL-01] inventory covers every acceptance ID exactly once', async () => {
  const plan = validatePlan(await fresh());
  assert.equal(plan.acceptance.length, 90);
  assert.equal(plan.acceptance.at(-1).id, 'AC-90');
});
test('[POL-02] missing and duplicate acceptance cannot disappear', async () => {
  const plan = await fresh(); plan.acceptance.pop(); assert.throws(() => validatePlan(plan), /COUNT/);
  const duplicate = await fresh(); duplicate.acceptance[1] = duplicate.acceptance[0];
  assert.throws(() => validatePlan(duplicate), /ACCEPTANCE/);
});
test('[POL-03] unknown flags and unsafe configurable paths fail closed', async () => {
  const plan = await fresh(); plan.suites[0].file = '../../bad.test.mjs';
  assert.throws(() => validatePlan(plan), /PATH/);
  const unknown = await fresh(); unknown.shell = 'run anything';
  assert.throws(() => validatePlan(unknown), /UNKNOWN_FIELD/);
});
test('[POL-04] empty inventories and retries cannot turn checks green', async () => {
  const plan = await fresh(); plan.suites[0].testIds = [];
  assert.throws(() => validatePlan(plan), /EMPTY_TESTS/);
  const retries = await fresh(); retries.retries = 1;
  assert.throws(() => validatePlan(retries), /POLICY/);
});
test('[POL-05] unknown evidence and fabricated executable state are rejected', async () => {
  const plan = await fresh(); plan.acceptance[0].evidence = [{ testId: 'FAKE-99', extent: 'whole' }];
  assert.throws(() => validatePlan(plan), /EVIDENCE/);
  const planned = await fresh(); planned.suites.find((s) => s.state === 'planned').file = 'tests/fake.test.mjs';
  assert.throws(() => validatePlan(planned), /FAKE_IMPLEMENTATION/);
});
test('[POL-06] specimen evidence cannot satisfy native requirements', async () => {
  const plan = await fresh();
  const fixture = { mode: 'browser-inline-diagnostic', status: 'passed',
    cases: [{ name: '[BRW-01] specimen styles', status: 'passed' }] };
  const item = plan.acceptance.find((row) => row.id === 'AC-76');
  item.evidence = [{ testId: 'BRW-01', extent: 'whole' }]; item.requiredModes = ['native'];
  assert.equal(acceptanceEvidence(plan, [fixture]).find((r) => r.id === item.id).state, 'partial');
  assert.equal(releaseDecision(plan, [fixture]).status, 'blocked');
});
test('[POL-07] one passing link cannot satisfy a multi-test acceptance claim', async () => {
  const plan = await fresh(); const item = plan.acceptance.find((r) => r.id === 'AC-85');
  const result = { status: 'passed', mode: 'node-baseline', cases: [{ name: '[ERR-01] one only', status: 'passed' }] };
  assert.equal(acceptanceEvidence(plan, [result]).find((r) => r.id === item.id).state, 'partial');
});
