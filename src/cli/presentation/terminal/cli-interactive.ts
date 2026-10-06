import { stdin, stderr } from 'node:process';
import { ask } from '#shared/platform/input.ts';
import { parseConfirmation } from '#shared/platform/confirmation.ts';
import { descriptor } from '../../adapters/framework/catalog.ts';
import { executeOperation } from '../../adapters/framework/operations.ts';
import type { Context, Request } from '../../adapters/framework/contracts.ts';
import type { Result } from '#shared/contracts/result.ts';
import { renderCliResult } from './cli-output.ts';

type Execute = (request: Request, context: Context) => Promise<Result>;
type Effect = ReturnType<typeof descriptor>['effect'];

export interface InteractiveRunDependencies {
  execute?: Execute;
  commandEffect?: (command: string) => Effect;
  confirm?: (message: string, signal?: AbortSignal) => Promise<boolean>;
  render?: (value: Result) => void;
}

async function defaultConfirm(message: string, signal?: AbortSignal): Promise<boolean> {
  return parseConfirmation(await ask(stdin, stderr, message + ' [y/N] ', signal)) === true;
}

export async function interactiveRun(
  request: Request,
  context: Context,
  dependencies: InteractiveRunDependencies = {},
): Promise<Result> {
  const execute = dependencies.execute ?? executeOperation;
  const commandEffect = dependencies.commandEffect ?? (command => descriptor(command).effect);
  const confirm = dependencies.confirm ?? defaultConfirm;
  const render = dependencies.render ?? (value => renderCliResult(value, false));

  let outcome = await execute(request, context);
  if (outcome.status === 'planned' && ['plan', 'remote'].includes(commandEffect(request.command)) && !request.options['dry-run']) {
    render(outcome);
    if (!await confirm('Apply this reviewed plan?', context.signal)) return { ...outcome, status: 'cancelled' };
    const planHash = (outcome.data as { planHash?: string }).planHash;
    outcome = await execute({
      ...request,
      options: { ...request.options, ...(planHash ? { apply: planHash } : {}), yes: true },
    }, context);
  }
  return outcome;
}
