/** `npm run verify` orchestration: parse, plan, run, report. All process effects are injected. */
import { resultEnvelope } from '../../src/shared/contracts/result-runtime.mjs';
import { parseVerifyArgs, planSteps, UsageError, usage } from './verify-plan.mjs';
import { runPlan } from './verify-run.mjs';
import { buildResult, outputTail, writeReports } from './verify-report.mjs';

const passedMessage = 'Static/service/production-coverage/artifact/analyzer/baseline verification passed. Run test:e2e for served-browser evidence and test:mutation for targeted guard qualification. Native/device/release qualification is NOT implied.';
const mark = { passed: 'ok', failed: 'FAIL', skipped: 'skip', 'not-run': '--' };
const line = text => text + '\n';

function usageFailure(error, json, io) {
  const diagnostic = { code: 'INVALID_ARGUMENT', message: error.message, severity: 'error', ...(error.next ? { next: error.next } : {}) };
  if (json) io.stdout.write(line(JSON.stringify(resultEnvelope('verify', null, 'failed', [diagnostic]))));
  else io.stderr.write(line(`${error.message}${error.next ? `\nnext: ${error.next}` : ''}`));
  return 2;
}
function listPlan(plan, json, io) {
  const steps = plan.filter(item => item.action === 'run').map(({ step, added }) => ({ id: step.id, command: step.display, needs: step.needs, ...(added ? { addedAsDependency: true } : {}) }));
  if (json) io.stdout.write(line(JSON.stringify(resultEnvelope('verify', { gate: 'verify', execution: 'not-run', steps }, 'planned'))));
  else for (const step of steps) io.stdout.write(line(`${step.id.padEnd(24)} ${step.command}${step.needs.length ? `  (needs: ${step.needs.join(', ')})` : ''}`));
  return 0;
}
function printText(result, io) {
  const { summary } = result.data;
  io.stdout.write(line(`\nVerify summary: ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped, ${summary.notRun} not-run in ${(summary.durationMs / 1000).toFixed(1)} s`));
  const notRun = result.data.steps.filter(item => item.status === 'not-run').map(item => item.id);
  for (const step of result.data.steps.filter(item => item.status === 'skipped')) io.stdout.write(line(`  [${mark[step.status]}] ${step.id}: ${step.reason}`));
  for (const step of result.data.steps.filter(item => item.status === 'failed')) io.stderr.write(line(`  [${mark.failed}] ${step.id}: ${step.reason}`));
  if (notRun.length) io.stdout.write(line(`  [${mark['not-run']}] not run (${notRun.length}): ${notRun.join(', ')}`));
  for (const item of result.diagnostics) io.stderr.write(line(`${item.message}${item.next ? `\nnext: ${item.next}` : ''}`));
  if (result.status === 'ok' && result.data.complete) io.stdout.write(line(passedMessage));
}
function describeSelection(options, plan) {
  const ids = action => plan.filter(item => item.action === action).map(item => item.step.id);
  return { only: options.only, skip: options.skip, addedDependencies: plan.filter(item => item.added).map(item => item.step.id), unselected: ids('unselected') };
}
async function execute(options, plan, run, io) {
  const progress = options.json ? io.stderr : io.stdout, started = run.clock();
  const outcomes = await runPlan(plan, { execute: run.execute, keepGoing: options.keepGoing, clock: run.clock, tail: outputTail, isCancelled: run.isCancelled,
    forward: chunk => progress.write(chunk), onStart: step => progress.write(line(`\n▶ ${step.display}`)) });
  const complete = plan.every(item => item.action === 'run');
  return buildResult({ outcomes, keepGoing: options.keepGoing, durationMs: run.clock() - started, complete, selection: describeSelection(options, plan), cancelled: run.isCancelled() });
}
/** Runs verify and returns the process exit code (0 verified, 1 failed or cancelled, 2 invalid usage). */
export async function runVerifyCli({ argv, steps, execute: executor, env = process.env, root = process.cwd(), stdout = process.stdout, stderr = process.stderr, clock = () => performance.now(), isCancelled = () => false }) {
  const io = { stdout, stderr };
  let options, plan;
  try { options = parseVerifyArgs(argv); if (!options.help) plan = planSteps(steps, options); }
  catch (error) { if (error instanceof UsageError) return usageFailure(error, argv.includes('--json'), io); throw error; }
  if (options.help) { stdout.write(line(usage)); return 0; }
  if (options.list) return listPlan(plan, options.json, io);
  const result = await execute(options, plan, { execute: executor, clock, isCancelled }, io);
  const warnings = await writeReports({ result, root, reportDir: options.reportDir, env });
  for (const warning of warnings) stderr.write(line(`warning: ${warning}`));
  if (options.json) stdout.write(line(JSON.stringify(result)));
  else printText(result, io);
  return result.status === 'ok' ? 0 : 1;
}
