import { result, requireThat, stringOption, type Context, type Request, type Result } from './contracts.ts';
import { applyOperation, loadPlan, planOperation, saveOperationPlan } from '../../../scripts/framework/planning.ts';

export async function fileOperation(request: Request, context: Context): Promise<Result> {
  const stored = request.command.startsWith('plan ');
  if (stored) requireThat(request.args[0], 'PLAN_REQUIRED', 'Supply the saved plan filename.');
  const planned = stored ? await loadPlan(context, request.args[0]!) : await planOperation(request, context);
  const output = stringOption(request.options, 'plan-out');
  const diagnostics = (planned.review as {compiler?: {diagnostics?: Result['diagnostics']}}).compiler?.diagnostics ?? [];
  if (planned.request.command.startsWith('docs ') && planned.conflicts.length) return {
    ...result(request.command, planned.review, 'blocked'),
    diagnostics: planned.conflicts.slice(0, 50).map(message => ({
      code: 'DOCS_CONFLICT',
      message,
      next: 'Inspect --json for conflict keys; resolve fields with docs import --resolutions <file>.',
    })),
  };
  const saved = output ? await saveOperationPlan(context, planned, output) : null;
  const apply = request.command !== 'plan inspect' && !request.options['dry-run']
    && (request.options.apply !== undefined || request.options.yes === true);
  if (!apply) return {
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
