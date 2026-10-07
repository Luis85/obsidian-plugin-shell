import { checkCompilerArchitecture } from '../compiler/check-architecture.mjs';
await checkCompilerArchitecture(process.cwd());
import { runDeadCode } from './fallow-contract.mjs';
import { scanProjectBoundaries } from './check-project-boundaries.mjs';
const { run, report } = runDeadCode('FALLOW', ['--boundary-violations'], { maxBuffer: 8 * 1024 * 1024, timeout: 30000 });
if (!Number.isInteger(report.summary?.boundary_violations)) throw new Error('FALLOW_REPORT_SCHEMA');
const count = report.summary.boundary_violations + report.summary.boundary_coverage_violations + report.summary.boundary_call_violations;
if (run.status !== 0 || count !== 0) { console.error(run.stdout); throw new Error(`ARCHITECTURE_FAILED: ${count}`); }
console.log('Resolved fallow boundaries and complete source-zone coverage passed.');
// Fallow ignores the companion concept sources, so the project dependency graph is checked on every src project directly.
const projects = await scanProjectBoundaries();
if (projects.violations.length) {
  console.error(projects.violations.map(item => `${item.path}:${item.line}: ${item.code}: ${item.detail}`).join('\n'));
  throw new Error(`PROJECT_BOUNDARIES_FAILED: ${projects.violations.length}`);
}
console.log(`Source project dependency graph passed (${projects.files} files in ${projects.projects.join(', ')}).`);
