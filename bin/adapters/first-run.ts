import { join } from 'node:path';
import { createFilePlan, applyFilePlan } from '../../scripts/shared/file-plan.mjs';
import { runNode } from '../../scripts/framework/process.ts';
import { OperationError, type Context } from '../../scripts/framework/contracts.ts';
import { requireSketch } from '../domain/errors.ts';
import { claimFirstRun } from './first-run-lock.ts';
import { firstRunPlan, firstRunReport, validateFirstRunInputs, type FirstRunPlan, type FirstRunStep } from './first-run-plan.ts';
import { showcase, type PreviewResult } from './first-run-preview.ts';
import { guardedText, jsonText } from './user-settings.ts';
interface FirstRunStage { id: string; status: 'not-run' | 'running' | 'passed' | 'failed' | 'cancelled'; durationMs?: number; diagnostic?: string }
interface FirstRunResult {
  schemaVersion: 1; producer: 'shell-first-run'; planHash: string; app: string;
  status: 'running' | 'passed' | 'failed' | 'cancelled'; startedAt: string; finishedAt: string | null;
  stages: FirstRunStage[]; preview: PreviewResult | null;
  installed: boolean; built: boolean; lockAfter: string | null;
  manualAcceptance: 'not-verified'; externalEffects: 'preserved-not-rolled-back'; automaticRetry: false;
}
interface FirstRunRuntime {
  run(plan: FirstRunPlan, step: FirstRunStep, context: Context): Promise<unknown>;
  preview(plan: FirstRunPlan, context: Context, ready: (preview: PreviewResult) => Promise<void>): Promise<PreviewResult>;
}
const runtime: FirstRunRuntime = {
  run: (plan, step, context) => runNode({ ...context, root: join(plan.root, plan.app) }, plan.tool.entry, step.args, plan.options.stepTimeoutMs, { CI: 'true', npm_config_update_notifier: 'false' }),
  preview: (plan, context, ready) => showcase(join(plan.root, plan.app, 'dist', plan.target), plan.options, { ...context, ready }),
};
function cancelled(error: unknown) { return error instanceof Error && 'code' in error && error.code === 'CANCELLED'; }
function code(error: unknown): string {
  if (error instanceof Error && 'code' in error && typeof error.code === 'string' && /^[A-Z][A-Z0-9_]+$/.test(error.code)) return error.code;
  return 'FIRST_RUN_FAILED';
}
async function saveFailureReport(started: boolean, save: () => Promise<void>): Promise<boolean> {
  if (!started) return true;
  try { await save(); return true; } catch { return false; }
}
/** Default is a proposal. Approved external processes are sequential, bounded, fail-fast and never replayed automatically. */
export async function executeFirstRun(value: FirstRunPlan, approval?: string, context: Context = { root: value.root, frameworkRoot: value.root }, driver = runtime): Promise<Record<string, unknown>> {
  const plan = structuredClone(value);
  if (approval === undefined) return { ...plan, status: 'planned', executed: false };
  requireSketch(approval === plan.planHash, 'MAKER_APPROVAL', 'First-run plan changed. Review the current execution planHash.');
  requireSketch(!context.signal?.aborted, 'CANCELLED', 'First run cancelled before execution.');
  requireSketch(!plan.blockers.length, 'FIRST_RUN_TOOLCHAIN', plan.blockers.join(' '));
  const refreshed = await firstRunPlan(plan.root, plan.options, plan.tool);
  requireSketch(jsonText(refreshed) === jsonText(plan), 'FIRST_RUN_STALE', 'Execution proposal changed. Review a new first-run plan.');
  const release = await claimFirstRun(plan.root);
  let beforeHash = plan.reportBeforeHash;
  const report: FirstRunResult = {
    schemaVersion: 1, producer: 'shell-first-run', planHash: plan.planHash, app: plan.app, status: 'running',
    startedAt: new Date().toISOString(), finishedAt: null, stages: plan.steps.map(step => ({ id: step.id, status: 'not-run' })),
    preview: null, installed: false, built: false, lockAfter: null,
    manualAcceptance: 'not-verified', externalEffects: 'preserved-not-rolled-back', automaticRetry: false,
  };
  if (plan.options.mode === 'showcase') report.stages.push({ id: 'showcase', status: 'not-run' });
  let started = false;
  async function save() {
    const write = await createFilePlan(plan.root, [{ path: plan.reportPath, content: jsonText(report) }]);
    requireSketch(write.changes[0]!.beforeHash === beforeHash, 'FIRST_RUN_REPORT_STALE', 'First-run report changed; do not overwrite another writer.');
    await applyFilePlan(write); beforeHash = write.changes[0]!.afterHash;
  }
  async function stage(id: string, work: () => Promise<void>) {
    requireSketch(!context.signal?.aborted, 'CANCELLED', 'First run cancelled before ' + id + '.');
    const item = report.stages.find(step => step.id === id)!;
    item.status = 'running'; const start = Date.now();
    try {
      await save();
      context.progress?.(`FIRST_RUN_STAGE ${id}\n`); await work(); item.status = 'passed';
    } catch (error) { item.status = cancelled(error) ? 'cancelled' : 'failed'; item.diagnostic = code(error); throw error; }
    finally { item.durationMs = Date.now() - start; }
    await save();
  }
  try {
    await validateFirstRunInputs(plan);
    requireSketch((await firstRunReport(plan.root, plan.reportPath)).beforeHash === beforeHash, 'FIRST_RUN_REPORT_STALE', 'Report changed after execution review.');
    started = true; await save();
    for (const step of plan.steps) {
      await stage(step.id, async () => {
        await validateFirstRunInputs(plan, report.installed);
        if (report.installed) requireSketch((await guardedText(plan.root, plan.app + '/package-lock.json')).beforeHash === report.lockAfter, 'FIRST_RUN_STALE', 'Resolved lockfile changed after installation.');
        await driver.run(plan, step, context);
        if (step.id === 'install') {
          report.installed = true;
          report.lockAfter = (await guardedText(plan.root, plan.app + '/package-lock.json')).beforeHash;
        }
        if (step.id === 'build') report.built = true;
        await validateFirstRunInputs(plan, report.installed);
        requireSketch((await guardedText(plan.root, plan.app + '/package-lock.json')).beforeHash === report.lockAfter, 'FIRST_RUN_STALE', 'Resolved lockfile changed during a project script.');
      });
    }
    if (plan.options.mode === 'showcase') await stage('showcase', async () => {
      report.preview = await driver.preview(plan, context, async preview => { report.preview = preview; await save(); });
      requireSketch(report.preview.ready && report.preview.httpStatus === 200 && report.preview.stopped, 'FIRST_RUN_PREVIEW', 'The owned showcase did not complete its startup and shutdown checks.');
    });
    report.status = 'passed'; report.finishedAt = new Date().toISOString(); await save();
    return { status: 'ok', executed: true, report, reportPath: plan.reportPath, next: 'Edit with shell.mjs sketch. Review and commit the resolved lockfile. Manual browser acceptance remains separate.' };
  } catch (error) {
    report.status = cancelled(error) ? 'cancelled' : 'failed'; report.finishedAt = new Date().toISOString();
    const reportSaved = await saveFailureReport(started, save);
    const failure = new OperationError(code(error), error instanceof Error ? error.message : 'First run failed.', 'Generated source and completed external effects are preserved. Inspect stderr/report; retry only with a newly reviewed first-run plan.');
    failure.details = { report: started ? report : null, reportPath: plan.reportPath, reportSaved, automaticRetry: false };
    throw failure;
  } finally { await release(); }
}
