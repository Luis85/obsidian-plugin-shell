import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyAudit } from '../../scripts/security/audit-result.mjs';
function output(total = 0, status = 0) { return { stdout: JSON.stringify({ metadata: { vulnerabilities: { info: 0, low: total, moderate: 0, high: 0, critical: 0, total } } }), status }; }
test('[SEC-02-01] clean audit requires both real commands to succeed, without filtering low severity', () => {
  assert.equal(classifyAudit(output(), { status: 0 }).status, 'passed');
  assert.equal(classifyAudit(output(1, 1), { status: 1 }).status, 'vulnerabilities');
  assert.equal(classifyAudit(output(), { status: 1 }).status, 'infrastructure-error');
});
test('[SEC-02-02] network/unavailable/invalid audit is not reported as clean', () => {
  for (const result of [{ stdout: '', status: null }, { stdout: '{"error":{"code":"ENOTFOUND"}}', status: 1 }, { stdout: '{}', status: 0 }, { ...output(), error: new Error('network') }])
    assert.equal(classifyAudit(result, { status: 1 }).status, 'infrastructure-error');
});
