/**
 * Owner-approved, dated exceptions for named advisories that reach only development dependencies. An exception never
 * hides anything else: every finding must trace back to an excepted advisory, the advisory must be absent from the
 * production-only audit, its severity must not exceed the approved one, and an expired or unused exception fails.
 */
const severities = ['info', 'low', 'moderate', 'high', 'critical'];
const fields = ['advisory', 'package', 'severity', 'scope', 'approvedBy', 'approvedOn', 'expires', 'reason'];
const day = /^\d{4}-\d{2}-\d{2}$/;
const invalid = reason => ({ status: 'exception-invalid', reason });

/** Validates the committed record; returns the exceptions or an `exception-invalid` result. */
export function parseExceptions(value) {
  if (value?.schemaVersion !== 1 || !Array.isArray(value.exceptions) || Object.keys(value).length !== 2) return invalid('the record must be { schemaVersion: 1, exceptions: [...] }');
  const seen = new Set();
  for (const entry of value.exceptions) {
    if (typeof entry !== 'object' || entry === null || Object.keys(entry).sort().join() !== [...fields].sort().join()) return invalid(`each exception has exactly ${fields.join(', ')}`);
    if (!/^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/.test(entry.advisory) || seen.has(entry.advisory)) return invalid(`${entry.advisory} is not a unique GHSA id`);
    if (!severities.includes(entry.severity) || entry.scope !== 'development') return invalid(`${entry.advisory} needs a known severity and scope "development"`);
    if (!day.test(entry.approvedOn) || !day.test(entry.expires) || entry.expires <= entry.approvedOn) return invalid(`${entry.advisory} needs approvedOn before expires (YYYY-MM-DD)`);
    if (![entry.package, entry.approvedBy, entry.reason].every(text => typeof text === 'string' && text.trim())) return invalid(`${entry.advisory} needs a package, an approver and a reason`);
    seen.add(entry.advisory);
  }
  return value.exceptions;
}

const advisoryId = via => /\/advisories\/(GHSA-[\w-]+)$/.exec(via.url ?? '')?.[1];
/** Every advisory object a report names, by GHSA id. */
function advisories(report) {
  return Object.values(report.vulnerabilities ?? {}).flatMap(entry => (entry.via ?? []).filter(via => typeof via === 'object' && via));
}

/**
 * Packages from which a non-excepted advisory is reachable through the `via` package chain. Dependency cycles (ESLint
 * and its utilities name each other) are fine: badness spreads from real findings, it is never assumed away.
 */
function uncovered(report, excepted) {
  const entries = Object.entries(report.vulnerabilities ?? {});
  const bad = new Set(entries.filter(([, entry]) => !(entry.via ?? []).length
    || entry.via.some(via => typeof via === 'object' && !excepted.has(advisoryId(via)))).map(([name]) => name));
  for (let changed = true; changed;) {
    changed = false;
    for (const [name, entry] of entries) {
      if (bad.has(name)) continue;
      if (entry.via.some(via => typeof via === 'string' && (bad.has(via) || !report.vulnerabilities[via]))) { bad.add(name); changed = true; }
    }
  }
  return [...bad].sort();
}

/**
 * Applies the exceptions to a full audit report that found vulnerabilities. `production` is the report of
 * `npm audit --omit=dev --json`; `today` is YYYY-MM-DD.
 */
export function applyExceptions({ report, production, exceptions, today, counts }) {
  const expired = exceptions.filter(entry => entry.expires < today).map(entry => entry.advisory);
  if (expired.length) return { status: 'exception-expired', counts, expired };
  const excepted = new Map(exceptions.map(entry => [entry.advisory, entry]));
  const found = advisories(report);
  const stale = exceptions.filter(entry => !found.some(via => advisoryId(via) === entry.advisory)).map(entry => entry.advisory);
  if (stale.length) return { status: 'exception-stale', counts, stale };
  const remaining = uncovered(report, new Set(excepted.keys()));
  if (remaining.length) return { status: 'vulnerabilities', counts, uncovered: remaining };
  const tooSevere = found.filter(via => severities.indexOf(via.severity) > severities.indexOf(excepted.get(advisoryId(via)).severity)).map(advisoryId);
  if (tooSevere.length) return { status: 'vulnerabilities', counts, reason: 'severity-above-approval', advisories: [...new Set(tooSevere)] };
  const shipped = advisories(production).map(advisoryId).filter(id => excepted.has(id));
  if (shipped.length) return { status: 'vulnerabilities', counts, reason: 'excepted-advisory-in-production-dependencies', advisories: [...new Set(shipped)] };
  return { status: 'passed-with-exceptions', counts, exceptions: exceptions.map(({ advisory, package: name, expires }) => ({ advisory, package: name, expires })) };
}

/** True when a production-only audit run completed; its findings are judged by applyExceptions. */
export function productionReport(run) {
  try { const report = JSON.parse(run.stdout); return run.error || report.error || !report.metadata ? null : report; } catch { return null; }
}
