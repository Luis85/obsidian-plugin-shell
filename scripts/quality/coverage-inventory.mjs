import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export function assertCoverageInventory(summary, files) {
  const recorded = new Set(Object.keys(summary).filter(key => key !== 'total').map(key => resolve(key)));
  const missing = files.map(file => resolve(file)).filter(file => !recorded.has(file));
  if (missing.length) throw new Error(`INCOMPLETE_PRODUCTION_COVERAGE: ${missing.join(', ')}`);
  if (!summary.total) throw new Error('MISSING_COVERAGE_TOTAL');
  return { status: 'passed', productionInputs: files.length, totals: summary.total };
}
function sources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sources(path) : /\.(ts|vue)$/.test(entry.name) ? [path] : [];
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = JSON.parse(readFileSync('reports/production-coverage/coverage-summary.json', 'utf8'));
  console.log(JSON.stringify(assertCoverageInventory(report, sources('src')), null, 2));
}
