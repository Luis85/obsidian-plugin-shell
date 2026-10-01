import { stdin, stderr } from 'node:process';
import { ask } from './input.ts';
import { descriptor } from './catalog.ts';
import { executeOperation } from './operations.ts';
import type { Context, Request, Result } from './contracts.ts';
import { parseConfirmation } from '../shared/confirmation.ts';
import { renderCliResult } from '../../bin/presentation/terminal/cli-output.ts';

async function confirm(message: string, signal?: AbortSignal): Promise<boolean> {
  return parseConfirmation(await ask(stdin, stderr, message + ' [y/N] ', signal)) === true;
}

export async function interactiveRun(request: Request, context: Context): Promise<Result> {
  let outcome = await executeOperation(request, context);
  if (outcome.status === 'planned' && descriptor(request.command).effect === 'plan' && !request.options['dry-run']) {
    renderCliResult(outcome, false);
    if (!await confirm('Apply this reviewed plan?', context.signal)) return { ...outcome, status: 'cancelled' };
    const planHash = (outcome.data as { planHash?: string }).planHash;
    outcome = await executeOperation({
      ...request,
      options: { ...request.options, ...(planHash ? { apply: planHash } : {}), yes: true },
    }, context);
  }
  return outcome;
}
