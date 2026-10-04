/**
 * Planned maker checks run after a successful apply through the same step runner `check` uses: argument arrays,
 * no shell, every step even after a failure. Written source is kept for inspection when a check fails.
 */
import { runCheckSteps, type StepOutcome } from './check.ts';
import { runNode } from './process.ts';
import { result, type Context, type Diagnostic, type Result } from './contracts.ts';
import type { MakerCheck } from '../makers/plan.ts';

type Runner = typeof runNode;
type Applied = { written: readonly unknown[] };
const commandLine = (check: MakerCheck): string => [check.command, ...check.args].join(' ');

/** The reviewed (dry-run) view: every planned check is listed as not run. */
export function pendingChecks(checks: readonly MakerCheck[]) {
  return checks.map(check => ({ id: check.id, command: commandLine(check), status: 'not-run' as const }));
}
function skippedChecks(checks: readonly MakerCheck[]): StepOutcome[] {
  return checks.map(check => ({ id: check.id, command: commandLine(check), status: 'skipped', durationMs: 0, exitCode: null, reason: 'no source changed' }));
}
function failureNext(failed: readonly StepOutcome[]): string {
  if (failed.every(step => step.code === 'TOOL_MISSING')) return 'npm ci';
  return `Fix the reported failures, then rerun: ${failed[0]!.command}`;
}
function checkDiagnostic(outcomes: readonly StepOutcome[], cancelled: boolean): Diagnostic[] {
  const failed = outcomes.filter(step => step.status === 'failed');
  if (cancelled) return [{ code: 'CANCELLED', message: 'Maker checks were cancelled; the written source is kept and the remaining checks did not run.' }];
  if (!failed.length) return [];
  return [{ code: 'MAKER_CHECKS_FAILED', message: `The source was written and kept for inspection, but ${failed.length} of ${outcomes.length} planned checks failed: ${failed.map(step => step.id).join(', ')}.`, next: failureNext(failed) }];
}
interface Reviewed { summary: unknown; [key: string]: unknown }
/** Runs the planned checks after an apply and reports their actual outcomes; nothing is reported as passed without running. */
export async function makerApplied(command: string, review: Reviewed, applied: Applied, checks: readonly MakerCheck[], context: Context, run: Runner = runNode): Promise<Result> {
  const written = applied.written.length > 0;
  const steps = checks.map(check => ({ id: check.id, display: commandLine(check), entry: check.args[0]!, args: check.args.slice(1) }));
  const outcomes = written ? await runCheckSteps(steps, context, 600_000, run) : skippedChecks(checks);
  const cancelled = Boolean(context.signal?.aborted) || outcomes.some(step => step.code === 'CANCELLED');
  const diagnostics = checkDiagnostic(outcomes, cancelled);
  const summary = { ...(typeof review.summary === 'object' && review.summary !== null ? review.summary : {}), checks: outcomes };
  const status = cancelled ? 'cancelled' : diagnostics.length ? 'failed' : written ? 'applied' : 'unchanged';
  return { ...result(command, { ...review, summary, applied }, status), diagnostics };
}
