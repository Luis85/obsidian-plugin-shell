import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['node_modules/fallow/bin/fallow', '--format', 'json', 'dead-code', '--boundary-violations'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 30000 });
if (result.error) throw result.error;
let report; try { report = JSON.parse(result.stdout); } catch { throw new Error(`FALLOW_REPORT_INVALID: ${result.stderr}`); }
if (report.schema_version !== 9 || report.kind !== 'dead-code' || !Number.isInteger(report.summary?.boundary_violations)) throw new Error('FALLOW_REPORT_SCHEMA');
const count = report.summary.boundary_violations + report.summary.boundary_coverage_violations + report.summary.boundary_call_violations;
if (result.status !== 0 || count !== 0) { console.error(result.stdout); throw new Error(`ARCHITECTURE_FAILED: ${count}`); }
console.log('Resolved fallow boundaries and complete source-zone coverage passed.');
