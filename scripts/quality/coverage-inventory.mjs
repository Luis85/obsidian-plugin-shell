import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export function assertCoverageInventory(summary, files) {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) throw new Error('INVALID_COVERAGE_REPORT');
  const recorded = new Set(Object.keys(summary).filter(key => key !== 'total').map(key => resolve(key)));
  const missing = files.map(file => resolve(file)).filter(file => !recorded.has(file));
  if (missing.length) throw new Error(`INCOMPLETE_PRODUCTION_COVERAGE: ${missing.join(', ')}`);
  if (!summary.total) throw new Error('MISSING_COVERAGE_TOTAL');
  return { status: 'passed', productionInputs: files.length, totals: summary.total };
}
const metrics = ['lines', 'statements', 'functions', 'branches'];
function aggregate(entries) {
  return Object.fromEntries(metrics.map(metric => {
    let total = 0; let covered = 0;
    for (const entry of entries) {
      const value = entry?.[metric];
      if (!Number.isSafeInteger(value?.total) || !Number.isSafeInteger(value?.covered) || value.total < 0 || value.covered < 0 || value.covered > value.total) throw new Error(`INVALID_COVERAGE_METRIC: ${metric}`);
      total += value.total; covered += value.covered;
      if (!Number.isSafeInteger(total) || !Number.isSafeInteger(covered)) throw new Error(`INVALID_COVERAGE_SUM: ${metric}`);
    }
    return [metric, { total, covered, pct: total === 0 ? 100 : 100 * covered / total }];
  }));
}
export function assertCoverageGates(summary, files) {
  const inventory = assertCoverageInventory(summary, files);
  const inputs = new Set(files.map(file => resolve(file)));
  const records = Object.entries(summary).filter(([file]) => file !== 'total' && inputs.has(resolve(file)));
  const domainRoot = `${resolve('src/domain')}/`.replaceAll('\\', '/');
  const applicationRoot = `${resolve('src/application')}/`.replaceAll('\\', '/');
  const featuresRoot = `${resolve('src/features')}/`.replaceAll('\\', '/');
  const core = records.filter(([file]) => { const path = resolve(file).replaceAll('\\', '/'); return path.startsWith(domainRoot) || path.startsWith(applicationRoot) || path.startsWith(featuresRoot); });
  if (!records.length || !core.length) throw new Error('EMPTY_COVERAGE_SCOPE');
  const scopes = { production: aggregate(records.map(([, entry]) => entry)), domainApplicationFeatures: aggregate(core.map(([, entry]) => entry)) };
  const reported = aggregate([summary.total]);
  for (const [name, totals] of Object.entries(scopes)) {
    const floor = name === 'production' ? { lines: 90, statements: 90, functions: 90, branches: 85 } : { lines: 95, statements: 95, functions: 95, branches: 90 };
    for (const metric of metrics) {
      if (totals[metric].total === 0) throw new Error(`EMPTY_COVERAGE_SCOPE: ${name}.${metric}`);
      if (totals[metric].pct < floor[metric]) throw new Error(`COVERAGE_BELOW_THRESHOLD: ${name}.${metric} ${totals[metric].pct} < ${floor[metric]}`);
    }
  }
  for (const metric of metrics) if (reported[metric].total !== scopes.production[metric].total || reported[metric].covered !== scopes.production[metric].covered) throw new Error(`INCONSISTENT_COVERAGE_TOTAL: ${metric}`);
  return { ...inventory, scopes };
}
function sources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sources(path) : /\.(ts|vue)$/.test(entry.name) ? [path] : [];
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = JSON.parse(readFileSync('reports/production-coverage/coverage-summary.json', 'utf8'));
  console.log(JSON.stringify(assertCoverageGates(report, sources('src')), null, 2));
}
