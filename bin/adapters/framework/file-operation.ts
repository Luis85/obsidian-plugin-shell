import { result, requireThat, stringOption, type Context, type Request, type Result } from './contracts.ts';
import { makerApplied } from './maker-checks.ts';
import { applyOperation, loadPlan, planOperation, saveOperationPlan } from './planning.ts';

type Planned = Awaited<ReturnType<typeof planOperation>>;
async function plannedFor(request: Request, context: Context): Promise<Planned> {
  if (!request.command.startsWith('plan ')) return planOperation(request, context);
  requireThat(request.args[0], 'PLAN_REQUIRED', 'Supply the saved plan filename.');
  return loadPlan(context, request.args[0]);
}
/** Documentation conflicts block before any plan is saved; each carries its resolution path. */
function docsConflicts(request: Request, planned: Planned): Result | null {
  if (!planned.request.command.startsWith('docs ') || !planned.conflicts.length) return null;
  return {
    ...result(request.command, planned.review, 'blocked'),
    diagnostics: planned.conflicts.slice(0, 50).map(message => ({
      code: 'DOCS_CONFLICT',
      message,
      next: 'Inspect --json for conflict keys; resolve fields with docs import --resolutions <file>.',
    })),
  };
}
function applyRequested(request: Request): boolean {
  if (request.command === 'plan inspect' || request.options['dry-run']) return false;
  return request.options.apply !== undefined || request.options.yes === true;
}
export async function fileOperation(request: Request, context: Context): Promise<Result> {
  const planned = await plannedFor(request, context);
  const output = stringOption(request.options, 'plan-out');
  const diagnostics = (planned.review as {compiler?: {diagnostics?: Result['diagnostics']}}).compiler?.diagnostics ?? [];
  const blocked = docsConflicts(request, planned);
  if (blocked) return blocked;
  const saved = output ? await saveOperationPlan(context, planned, output) : null;
  if (!applyRequested(request)) return {
    ...result(request.command, { ...planned.review, ...(saved ? { saved } : {}) },
      planned.conflicts.length ? 'blocked' : 'planned'),
    diagnostics,
  };
  const expected = stringOption(request.options, 'apply') ?? planned.planHash;
  return appliedResult(request.command, planned, await applyOperation(planned, context, expected), context, diagnostics);
}
/** A maker plan runs its planned project checks after the write; every other plan reports the write alone. */
function appliedResult(command: string, planned: Planned, applied: Awaited<ReturnType<typeof applyOperation>>, context: Context, diagnostics: Result['diagnostics']): Promise<Result> | Result {
  if (planned.checks) return makerApplied(command, planned.review, applied, planned.checks, context);
  return { ...result(command, { ...planned.review, applied }, applied.written.length ? 'applied' : 'unchanged'), diagnostics };
}
