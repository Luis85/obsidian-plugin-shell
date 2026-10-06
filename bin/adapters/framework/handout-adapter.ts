import { createFilePlan } from '../../../scripts/shared/file-plan.ts';
import { stringOption, requireThat, result, type Request, type Context } from './contracts.ts';
import { prepareHandout, prepareHandoutRefresh, inspectHandout } from './handout-workspace.ts';

/** Use the existing shared plan/apply protocol; this adapter never runs project processes. */
export async function handoutPlan(request: Request, context: Context) {
  requireThat(!context.signal?.aborted, 'CANCELLED', 'Operation cancelled.');
  const options = { prds: stringOption(request.options, 'prds') };
  const prepared = request.command === 'handout refresh'
    ? await prepareHandoutRefresh(context.root, options)
    : await prepareHandout(context.root, options);
  const plan = await createFilePlan(context.root, prepared.entries);
  if (request.command === 'handout generate') requireThat(!plan.changes.some(change => change.status === 'update'), 'HANDOUT_EXISTS', 'Preserve the existing handout; use an explicit reviewed refresh for source changes.');
  requireThat(!context.signal?.aborted, 'CANCELLED', 'Operation cancelled before returning the plan.');
  return { plan, summary: prepared.summary, conflicts: [] as string[] };
}
export async function handoutRead(request: Request, context: Context) {
  requireThat(!context.signal?.aborted, 'CANCELLED', 'Operation cancelled.');
  const report = await inspectHandout(context.root, { prds: stringOption(request.options, 'prds') });
  // `handout status` omits the answer bodies that `handout inspect` returns.
  const data = request.command === 'handout inspect' ? report : Object.fromEntries(Object.entries(report).filter(([key]) => key !== 'answers'));
  return { ...result(request.command, data, report.ready ? 'ok' : 'blocked'), diagnostics: report.diagnostics.map(({ code, message, id }) => ({ code, message: id ? `[${id}] ${message}` : message })) };
}
