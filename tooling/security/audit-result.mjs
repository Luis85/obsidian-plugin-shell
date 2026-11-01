import { applyExceptions, productionReport } from './audit-exceptions.mjs';
/**
 * A registry/network failure is neither a clean audit nor a vulnerability result. `options.exceptions` are the parsed
 * owner-approved advisory exceptions, `options.production` the `npm audit --omit=dev --json` run and `options.today`
 * the date (YYYY-MM-DD) that expiry is judged against.
 */
export function classifyAudit(jsonRun, ordinaryRun, options = {}) {
  let report;
  try { report = JSON.parse(jsonRun.stdout); } catch { return { status: 'infrastructure-error', reason: 'invalid-or-missing-audit-json' }; }
  const counts = report?.metadata?.vulnerabilities;
  if (jsonRun.error || ordinaryRun.error || report.error || !counts || !['info', 'low', 'moderate', 'high', 'critical', 'total'].every(key => Number.isInteger(counts[key]) && counts[key] >= 0))
    return { status: 'infrastructure-error', reason: 'audit-not-completed' };
  const exceptions = options.exceptions ?? [];
  if (counts.total > 0 && jsonRun.status === 1 && ordinaryRun.status === 1) {
    if (!exceptions.length) return { status: 'vulnerabilities', counts };
    const production = options.production && productionReport(options.production);
    if (!production || !/^\d{4}-\d{2}-\d{2}$/.test(options.today ?? '')) return { status: 'infrastructure-error', reason: 'production-audit-not-completed', counts };
    return applyExceptions({ report, production, exceptions, today: options.today, counts });
  }
  if (counts.total !== 0 || jsonRun.status !== 0 || ordinaryRun.status !== 0) return { status: 'infrastructure-error', reason: 'inconsistent-audit-results', counts };
  // A clean audit with a remaining exception means the advisory was fixed upstream: remove the exception.
  if (exceptions.length) return { status: 'exception-stale', counts, stale: exceptions.map(entry => entry.advisory) };
  return { status: 'passed', counts };
}
