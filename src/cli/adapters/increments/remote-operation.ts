/**
 * The `remote` effect route. A remote write cannot be replayed from a saved plan: its preview depends on the
 * platform's state at review time, so --plan-out is refused and `plan apply` only replays `plan` effects.
 */
import { requireThat, type Context, type Request, type Result } from '../framework/contracts.ts';
import { publish } from './publish-operation.ts';
import { sync } from './sync-operation.ts';
import { lifecycle } from './lifecycle-operation.ts';

export async function remoteOperation(request: Request, context: Context): Promise<Result> {
  requireThat(request.options['plan-out'] === undefined, 'REMOTE_PLAN_NOT_PORTABLE', `${request.command} reads and writes the hosting platform; preview it again instead of saving a plan.`);
  if (request.command === 'pr publish') return publish(request, context);
  if (request.command === 'pr sync') return sync(request, context);
  return lifecycle(request, context);
}
