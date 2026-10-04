/** A registry/network failure is neither a clean audit nor a vulnerability result. */
export function classifyAudit(jsonRun, ordinaryRun) {
  let report;
  try { report = JSON.parse(jsonRun.stdout); } catch { return { status: 'infrastructure-error', reason: 'invalid-or-missing-audit-json' }; }
  const counts = report?.metadata?.vulnerabilities;
  if (jsonRun.error || ordinaryRun.error || report.error || !counts || !['info', 'low', 'moderate', 'high', 'critical', 'total'].every(key => Number.isInteger(counts[key]) && counts[key] >= 0))
    return { status: 'infrastructure-error', reason: 'audit-not-completed' };
  if (counts.total > 0 && jsonRun.status === 1 && ordinaryRun.status === 1) return { status: 'vulnerabilities', counts };
  if (counts.total !== 0 || jsonRun.status !== 0 || ordinaryRun.status !== 0) return { status: 'infrastructure-error', reason: 'inconsistent-audit-results', counts };
  return { status: 'passed', counts };
}
