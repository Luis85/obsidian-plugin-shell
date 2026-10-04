import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertRepeatable, outcomeDigest, assertEvidenceFresh, xmlReport } from '../../scripts/testing/report.mjs';
const run = () => [{ id: 'one', status: 'passed', duration: 200, cases: [{ name: '[X-01] a', status: 'passed' }] }];
test('[RPT-01] execution duration is not a semantic determinism failure', () => {
  const a = run(); const b = run(); b[0].duration = 999;
  assert.equal(outcomeDigest(a), outcomeDigest(b)); assertRepeatable([a,b]);
});
test('[RPT-02] a failed first run or changed outcome cannot be hidden by repeat success', () => {
  const a = run(); const b = run(); b[0].status = 'failed';
  assert.throws(() => assertRepeatable([a,b,a]), /NOT_PASSING/);
  const changed = run(); changed[0].cases[0].name = '[X-02] changed';
  assert.throws(() => assertRepeatable([a, changed]), /DRIFT/);
});
test('[RPT-03] source change invalidates previously passing evidence', () => {
  const report = { schemaVersion: 1, inputDigest: 'old-source' };
  assertEvidenceFresh(report, 'old-source');
  assert.throws(() => assertEvidenceFresh(report, 'new-source'), /STALE/);
});
test('[RPT-04] XML reports execution only and preserves failures with escaped text', () => {
  const xml = xmlReport([{ id: 'scope', status: 'failed', cases: [{ name: 'A<&', status: 'failed', error: 'bad "input"' }] }]);
  assert.match(xml, /failures="1"/); assert.match(xml, /A&lt;&amp;/);
  assert.match(xml, /&quot;input&quot;/); assert.doesNotMatch(xml, /coverage|releaseReady/);
});
