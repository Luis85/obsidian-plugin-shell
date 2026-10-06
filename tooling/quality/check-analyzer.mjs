import { runDeadCode } from './fallow-contract.mjs';
const { run, report } = runDeadCode('ANALYZER', [], { output: 'reports/analyzer' });
if (run.status !== 0 || report.summary.total_issues !== 0 || report.workspace_diagnostics?.length) {
  console.error(run.stdout); throw new Error(`ANALYZER_FAILED: ${report.summary.total_issues}`);
}
console.log('Full fallow dead-code, dependency, cycle, suppression, deprecation and boundary analysis passed (zero findings, every file parsed).');
