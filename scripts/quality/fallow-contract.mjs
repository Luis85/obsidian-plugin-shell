import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

// The one reviewed Fallow CLI identity. An update changes these values only after
// inspecting the installed types/output-contract.d.ts, schema.json and real runs.
export const fallowVersion = '3.31.0';
export const fallowSchemas = Object.freeze({ 'dead-code': 9, health: 11, dupes: 10, 'suppression-inventory': '1' });

// Fallow 3.31 always emits the default exit rule of dead-code/health and, with
// failOnParseError, a parse-error gate. An absent, unenforced or unknown verdict
// is a contract failure, never an implicit pass.
export function gateStatus(report, name, fail) {
  const gate = report?.gate_outcomes?.[name];
  if (!gate || gate.enforced !== true || !['pass', 'fail'].includes(gate.status)) fail(`GATE_${name}`);
  return gate.status;
}
export function assertReportIdentity(report, kind, fail) {
  if (!report || report.kind !== kind || report.schema_version !== fallowSchemas[kind] || report.version !== fallowVersion) fail('SCHEMA');
}
// Each enforced verdict must agree with the process status the CI never sees.
export function assertExitVerdict(report, exit, fail) {
  const failed = Object.values(report.gate_outcomes ?? {}).some(gate => gate.enforced === true && gate.status === 'fail');
  if (exit !== (failed ? 1 : 0)) fail('EXIT_VERDICT');
}
// dupes arms no parse-error gate in 3.31; its callers rely on workspace diagnostics.
export function assertParsedCompletely(report, exit, fail) {
  if (gateStatus(report, 'parse-error', fail) !== 'pass') fail('PARSE_ERROR');
  assertExitVerdict(report, exit, fail);
}
// Repository gates read the relocated analyzer config; fixtures mirror it at the same project-relative path.
const fallowConfig = 'configs/quality/fallow.json';
export function runDeadCode(prefix, args = [], limits = {}) {
  const fail = code => { throw new Error(`${prefix}_${code}`); };
  const run = spawnSync(process.execPath, ['node_modules/fallow/bin/fallow', '--format', 'json', 'dead-code', '--config', fallowConfig, ...args],
    { encoding: 'utf8', maxBuffer: limits.maxBuffer ?? 12 * 1024 * 1024, timeout: limits.timeout ?? 60000 });
  if (limits.output) {
    mkdirSync(limits.output, { recursive: true });
    writeFileSync(`${limits.output}/fallow.json`, run.stdout ?? ''); writeFileSync(`${limits.output}/stderr.txt`, run.stderr ?? '');
  }
  if (run.error) throw run.error;
  let report; try { report = JSON.parse(run.stdout); } catch { fail(`REPORT_INVALID: ${run.stderr}`); }
  assertReportIdentity(report, 'dead-code', code => fail(`REPORT_${code}`));
  gateStatus(report, 'error-severity-findings', code => fail(`REPORT_${code}`));
  assertParsedCompletely(report, run.status, fail);
  return { run, report };
}
