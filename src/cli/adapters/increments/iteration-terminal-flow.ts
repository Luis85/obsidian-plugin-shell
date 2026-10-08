/** Offer hosted draft publication only after an approved iteration branch/record commit. */
import type { Context, Request, Result } from '../framework/contracts.ts';
import { classifyRemote } from '#shared/companion/schema/hosting.mjs';
import { interactiveRun, type InteractiveRunDependencies } from '../../presentation/terminal/cli-interactive.ts';
import { readTargetSources } from './hosting-target.ts';
import { Session } from './session.ts';

export async function continueIteration(request: Request, outcome: Result, context: Context, ui: InteractiveRunDependencies): Promise<Result> {
  if (!committedBranch(request, outcome)) return outcome;
  const sources = await readTargetSources(context.root);
  const platform = sources.hosting?.platform ?? classifyRemote(sources.origin);
  if (!platform || platform === 'none') return outcome;
  ui.render?.(outcome);
  if (!await ui.confirm?.(`Create a draft pull request on ${platform === 'github' ? 'GitHub' : 'Azure DevOps'} for this iteration?`, context.signal)) return outcome;
  return publishKickoff(request, outcome, context, ui);
}

async function publishKickoff(request: Request, outcome: Result, context: Context, ui: InteractiveRunDependencies): Promise<Result> {
  const session = await Session.open(context, false);
  const kickoff = (await session.all('pullRequest')).find(pull => pull.model.increment === request.args[0] && pull.model.kind === 'kickoff');
  if (!kickoff || kickoff.model.binding) return outcome;
  return interactiveRun({ command: 'pr publish', args: [kickoff.id], options: {} }, context, ui);
}

function committedBranch(request: Request, outcome: Result): boolean {
  return request.command === 'increment commit' && request.options.branch === true && outcome.status === 'applied';
}
