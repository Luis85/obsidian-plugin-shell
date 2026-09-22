import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const output = 'reports/analyzer'; mkdirSync(output, { recursive: true });
const run = spawnSync(process.execPath, ['node_modules/fallow/bin/fallow', '--format', 'json', 'dead-code'], { encoding: 'utf8', maxBuffer: 12 * 1024 * 1024, timeout: 60000 });
writeFileSync(`${output}/fallow.json`, run.stdout ?? ''); writeFileSync(`${output}/stderr.txt`, run.stderr ?? '');
if (run.error) throw run.error;
let report; try { report = JSON.parse(run.stdout); } catch { throw new Error('ANALYZER_REPORT_INVALID'); }
if (report.schema_version !== 9 || report.kind !== 'dead-code' || !Number.isInteger(report.summary?.total_issues)) throw new Error('ANALYZER_REPORT_SCHEMA');
if (run.status !== 0 || report.summary.total_issues !== 0 || report.workspace_diagnostics?.length) {
  console.error(run.stdout); throw new Error(`ANALYZER_FAILED: ${report.summary.total_issues}`);
}
console.log('Full fallow dead-code, dependency, cycle, suppression and boundary analysis passed (zero findings).');
