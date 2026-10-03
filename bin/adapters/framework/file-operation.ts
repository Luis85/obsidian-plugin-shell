import { result, requireThat, stringOption, type Context, type Request, type Result } from './contracts.ts';
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
  const applied = await applyOperation(planned, context, expected);
  return {
    ...result(request.command, { ...planned.review, applied }, applied.written.length ? 'applied' : 'unchanged'),
    diagnostics,
  };
}
