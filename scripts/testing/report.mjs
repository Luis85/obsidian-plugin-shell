import { sha256 } from './source-inputs.mjs';
export function outcomeDigest(results) {
  return sha256(JSON.stringify(results.map((r) => ({ id: r.id, status: r.status,
    cases: r.cases.map((c) => ({ name: c.name, status: c.status })).sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  })).sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
}
export function assertRepeatable(runs) {
  if (runs.length < 2 || runs.some((run) => run.some((r) => r.status !== 'passed')))
    throw new Error('REPEAT_RUN_NOT_PASSING');
  if (new Set(runs.map(outcomeDigest)).size !== 1) throw new Error('REPEAT_OUTCOME_DRIFT');
}
export function assertEvidenceFresh(report, sourceDigest) {
  if (report.schemaVersion !== 1 || report.inputDigest !== sourceDigest)
    throw new Error('STALE_OR_INVALID_EVIDENCE');
}
export function xmlReport(results) {
  const escape = (s) => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<testsuites>\n' + results.map((r) => {
    const cases = r.cases.length ? r.cases : [{ name: r.reason ?? 'No test evidence', status: 'failed' }];
    return `<testsuite name="${escape(r.id)}" tests="${cases.length}" failures="${cases.filter((c) => c.status !== 'passed').length}">` +
      cases.map((c) => `<testcase name="${escape(c.name)}">${c.status === 'passed' ? '' : `<failure message="${escape(c.error ?? c.status)}"/>`}</testcase>`).join('') + '</testsuite>';
  }).join('\n') + '\n</testsuites>\n';
}
