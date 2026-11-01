import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { classifyAudit } from '../security/audit-result.mjs';
import { parseExceptions } from '../security/audit-exceptions.mjs';
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

// Owner-approved advisory exceptions: a fixture shaped like the npm audit report that blocked 0.6.0, including the
// eslint <-> @eslint-community/eslint-utils cycle, so every refusal below is proven against real report structure.
const MINIMATCH = 'GHSA-g3hv-75wg-m249', GLOB = 'GHSA-3g3m-2fjr-6pw4';
const advisory = (name, id, severity = 'moderate') => ({ source: 1, name, url: `https://github.com/advisories/${id}`, severity, range: '<99' });
function audit(vulnerabilities) {
  const total = Object.keys(vulnerabilities).length;
  return { stdout: JSON.stringify({ vulnerabilities, metadata: { vulnerabilities: { info: 0, low: 0, moderate: total, high: 0, critical: 0, total } } }), status: total ? 1 : 0 };
}
const blocking = () => ({
  minimatch: { name: 'minimatch', via: [advisory('minimatch', MINIMATCH)] },
  glob: { name: 'glob', via: [advisory('glob', GLOB), 'minimatch'] },
  eslint: { name: 'eslint', via: ['@eslint-community/eslint-utils', 'minimatch'] },
  '@eslint-community/eslint-utils': { name: '@eslint-community/eslint-utils', via: ['eslint'] },
  'js-beautify': { name: 'js-beautify', via: ['glob'] },
});
const record = (overrides = {}) => ({ schemaVersion: 1, exceptions: [MINIMATCH, GLOB].map((id, index) => ({ advisory: id, package: index ? 'glob' : 'minimatch', severity: 'moderate',
  scope: 'development', approvedBy: 'Owner', approvedOn: '2026-11-01', expires: '2027-02-01', reason: 'dev-only', ...overrides })) });
const run = (vulnerabilities, { exceptions = parseExceptions(record()), production = audit({}), today = '2026-11-02' } = {}) =>
  classifyAudit(audit(vulnerabilities), { status: Object.keys(vulnerabilities).length ? 1 : 0 }, { exceptions, production, today });

test('[SEC-03-01] findings that trace only to excepted development advisories pass with exceptions, cycles included', () => {
  const result = run(blocking());
  assert.equal(result.status, 'passed-with-exceptions');
  assert.deepEqual(result.exceptions.map(entry => entry.advisory), [MINIMATCH, GLOB]);
  assert.equal(classifyAudit(audit(blocking()), { status: 1 }).status, 'vulnerabilities', 'no record, no exception');
});
test('[SEC-03-02] any other advisory, a higher severity or the advisory in production dependencies still fails', () => {
  const other = { ...blocking(), vite: { name: 'vite', via: [advisory('vite', 'GHSA-2222-3333-4444')] }, 'plugin-x': { name: 'plugin-x', via: ['vite', 'minimatch'] } };
  assert.deepEqual(run(other).uncovered, ['plugin-x', 'vite']);
  const severe = { ...blocking(), minimatch: { name: 'minimatch', via: [advisory('minimatch', MINIMATCH, 'high')] } };
  assert.deepEqual([run(severe).status, run(severe).reason], ['vulnerabilities', 'severity-above-approval']);
  const shipped = run(blocking(), { production: audit({ minimatch: blocking().minimatch }) });
  assert.deepEqual([shipped.status, shipped.reason], ['vulnerabilities', 'excepted-advisory-in-production-dependencies']);
  assert.equal(run(blocking(), { production: { stdout: '', status: null } }).status, 'infrastructure-error', 'an unfinished production audit is never a pass');
});
test('[SEC-03-03] an expired or unused exception fails, so no exception outlives its advisory or its date', () => {
  assert.deepEqual(run(blocking(), { today: '2027-02-02' }).expired, [MINIMATCH, GLOB]);
  assert.equal(run(blocking(), { today: '2027-02-01' }).status, 'passed-with-exceptions', 'valid through the expiry day');
  const { glob, 'js-beautify': _unused, ...withoutGlob } = blocking();
  assert.deepEqual(run(withoutGlob).stale, [GLOB]);
  const clean = classifyAudit(audit({}), { status: 0 }, { exceptions: parseExceptions(record()), production: audit({}), today: '2026-11-02' });
  assert.deepEqual([clean.status, clean.stale], ['exception-stale', [MINIMATCH, GLOB]]);
});
test('[SEC-03-04] a malformed exception record is refused before any audit verdict', () => {
  for (const value of [null, {}, { schemaVersion: 2, exceptions: [] }, record({ scope: 'production' }), record({ expires: '2026-10-01' }), record({ advisory: 'CVE-2026-1' }),
    record({ reason: ' ' }), record({ severity: 'severe' }), { schemaVersion: 1, exceptions: [record().exceptions[0], record().exceptions[0]] }, record({ extra: true })])
    assert.equal(parseExceptions(value).status, 'exception-invalid', JSON.stringify(value)?.slice(0, 80));
  assert.equal(parseExceptions({ schemaVersion: 1, exceptions: [] }).length, 0);
});
test('[SEC-03-05] the committed record is valid, owner-approved and bounded to at most 100 days', async t => {
  // Only the framework checkout carries its owner's record; kits and generated projects start without exceptions.
  const text = await readFile(new URL('../security/audit-exceptions.json', import.meta.url), 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (text === null) { t.skip('no audit exception record in this project'); return; }
  const committed = parseExceptions(JSON.parse(text));
  assert.ok(Array.isArray(committed), JSON.stringify(committed));
  for (const entry of committed) {
    const days = (Date.parse(entry.expires) - Date.parse(entry.approvedOn)) / 86_400_000;
    assert.ok(days > 0 && days <= 100, `${entry.advisory}: ${days} days`);
  }
});
