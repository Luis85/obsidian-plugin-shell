/** Option and input parsing shared by the increment, pr and issue planners. */
import { isAbsolute, join, normalize } from 'node:path';
import { readBounded } from '../framework/files.ts';
import { OperationError, stringOption, type Context, type Request } from '../framework/contracts.ts';
import { parseInputFragment, type InputFragment } from '../../domain/increments/input-fragment.ts';
import { limits } from '../../domain/increments/model.ts';
import type { DeliveryErrorCode } from '../../domain/increments/errors.ts';
import type { BranchPlan } from '../../application/increments/git-port.ts';

export const option = (request: Request, name: string): string | undefined => stringOption(request.options, name);
export const flag = (request: Request, name: string): boolean => request.options[name] === true;
/** `a, b,c` → [a, b, c]; empty parts are dropped. */
export const commaList = (value: string | undefined): string[] => (value ?? '').split(',').map(item => item.trim()).filter(Boolean);
/** `--status done|open` of a criterion or task. */
export function checkedOption(request: Request): boolean | undefined {
  const value = option(request, 'status');
  if (value === undefined) return undefined;
  if (value !== 'done' && value !== 'open') throw new OperationError('INVALID_OPTION', '--status takes done or open.');
  return value === 'done';
}
/** Raw `--input` text: a project file or `-` for stdin (or the guided interview's fragment). */
export async function inputRaw(request: Request, context: Context): Promise<string | null> {
  const input = option(request, 'input');
  if (input === undefined) return null;
  if (input === '-') {
    if (context.inputText === undefined) throw new OperationError('INPUT_REQUIRED', 'Pipe the Markdown fragment on stdin with --input -.');
    return context.inputText;
  }
  const relative = normalize(input);
  if (isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) throw new OperationError('INPUT_OUTSIDE_PROJECT', '--input names a file inside the project.');
  return new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(join(context.root, relative), limits.fragment));
}
/** `--input` parsed as a Markdown fragment of the document's sections. */
export async function fragmentInput(request: Request, context: Context, allowed: readonly string[], code: DeliveryErrorCode): Promise<InputFragment | null> {
  const raw = await inputRaw(request, context);
  return raw === null ? null : parseInputFragment(raw, allowed, code);
}
/** The branch flags: --no-branch skips, otherwise a branch is planned when git can create it. */
export function branchRequest(request: Request, name: string, starts: string[]) {
  if (flag(request, 'branch') && flag(request, 'no-branch')) throw new OperationError('INVALID_OPTION', 'Use either --branch or --no-branch.');
  if (flag(request, 'switch') && flag(request, 'no-branch')) throw new OperationError('INVALID_OPTION', '--switch needs the branch; drop --no-branch.');
  return { name, starts, create: !flag(request, 'no-branch'), switch: flag(request, 'switch'), fetch: flag(request, 'fetch') };
}
/** Plan extras of a branch step: bound into the plan hash and run right before the files are written. */
export function branchStep(plan: BranchPlan, run: (plan: BranchPlan) => Promise<unknown>): { steps?: unknown[]; prepare?: () => Promise<unknown> } {
  if (plan.status !== 'planned') return {};
  const step = { kind: 'git-branch', name: plan.name, start: plan.start, commit: plan.commit, switch: plan.switch, fetch: plan.fetch };
  return { steps: [step], prepare: () => run(plan) };
}
