import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFaultLedger } from '../../scripts/testing/fault-ledger.mjs';
test('[ERR-01] normal scenarios permit zero unexpected contained faults', () => {
  const ledger = createFaultLedger(); ledger.assertExpected();
  ledger.record('RENDER_FAILURE', 'view-1');
  assert.throws(() => ledger.assertExpected(), /MISMATCH/);
});
test('[ERR-02] fault expectations require exact code scope and count', () => {
  const ledger = createFaultLedger(); ledger.record('WRITE_FAILED', 'request-1');
  ledger.assertExpected([{ code: 'WRITE_FAILED', scope: 'request-1', count: 1 }]);
  assert.throws(() => ledger.assertExpected([{ code: 'WRITE_FAILED', scope: 'request-2', count: 1 }]), /MISMATCH/);
  ledger.record('WRITE_FAILED', 'request-1');
  assert.throws(() => ledger.assertExpected([{ code: 'WRITE_FAILED', scope: 'request-1', count: 1 }]), /MISMATCH/);
});
test('[ERR-03] a fault that never occurred cannot pass a negative scenario', () => {
  const ledger = createFaultLedger();
  assert.throws(() => ledger.assertExpected([{ code: 'WRITE_FAILED', scope: 'request-1', count: 1 }]), /MISMATCH/);
});
test('[ERR-04] overflow remains a failure despite bounded retained records', () => {
  const ledger = createFaultLedger(1); ledger.record('ERROR', 'one'); ledger.record('ERROR', 'two');
  assert.equal(ledger.snapshot().entries.length, 1);
  assert.equal(ledger.snapshot().observed, 2);
  assert.throws(() => ledger.assertExpected([{ code: 'ERROR', scope: 'one', count: 1 }]), /OVERFLOW/);
});
test('[ERR-05] observer instances isolate state and snapshots cannot clear evidence', () => {
  const first = createFaultLedger(); const second = createFaultLedger(); first.record('ERROR', 'one');
  first.snapshot().entries.length = 0; second.assertExpected();
  assert.throws(() => first.assertExpected(), /MISMATCH/);
});
test('[ERR-06] unsafe diagnostic IDs and duplicate expectations are rejected', () => {
  const ledger = createFaultLedger();
  assert.throws(() => ledger.record('file content\nsecret', 'one'), /INVALID/);
  assert.throws(() => ledger.record('ERROR', '/personal/path'), /INVALID/);
  assert.throws(() => ledger.assertExpected([{ code: 'ERROR', scope: 'x', count: 1 },
    { code: 'ERROR', scope: 'x', count: 1 }]), /INVALID/);
});
