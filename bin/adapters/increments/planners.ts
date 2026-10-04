/**
 * Every reviewed file planner of the increment, pr and issue commands, registered in the framework `planners`
 * map. `increment complete` plans the Definition of Done outputs; the gate's own write mode stays in the scripts.
 */
import type { Context, Request } from '../framework/contracts.ts';
import { checkIncrementTransition } from '../../domain/increments/transitions.ts';
import { setFrontmatterValue } from '../../domain/increments/frontmatter.ts';
import { Session, type SessionPlan } from './session.ts';
import { blocking, requireGate } from './delivery-gates.ts';
import { incrementDocumentPlanners } from './increment-planner.ts';
import { pullRequestPlanners } from './pull-request-planner.ts';
import { issuePlanners } from './issue-planner.ts';
import { option } from './inputs.ts';

/** Rules the planned outputs satisfy: changelog entries, docs index rows, status Done and the Completion record. */
const generatedByPlan = ['DOD-04', 'DOD-06', 'DOD-09', 'DOD-11'];
async function completePlan(request: Request, context: Context): Promise<SessionPlan> {
  const session = await Session.open(context), doc = await session.get('increment', request.args[0]);
  const report = await requireGate(session.ws, doc.path, 'done', option(request, 'base'));
  const pulls = (await session.all('pullRequest')).filter(pull => pull.model.increment === doc.id).map(pull => pull.model.status);
  const to = checkIncrementTransition(doc.model.status, 'Done', { pullRequests: pulls });
  const files = report.generated.files ?? {};
  for (const [path, text] of Object.entries(files)) session.write(path, text);
  session.write(doc.path, setFrontmatterValue(files[doc.path] ?? doc.text, 'status', to, { after: session.ws.schema.handoff.requiredKeys }));
  const blockers = blocking(report, generatedByPlan);
  const planned = await session.plan({ document: { kind: 'increment', id: doc.id, path: doc.path }, statusBefore: doc.model.status, statusAfter: to,
    edits: [{ section: 'Completion record', action: 'replace' }], gate: { status: report.status, base: report.base, blocking: blockers.map(rule => rule.id) } });
  return { ...planned, conflicts: blockers.map(rule => `${rule.id} ${rule.title}: ${rule.message}${rule.hint ? ` Fix: ${rule.hint}` : ''}`) };
}

export const incrementPlanners: Record<string, (request: Request, context: Context) => Promise<SessionPlan>> = {
  ...incrementDocumentPlanners,
  'increment complete': completePlan,
  ...pullRequestPlanners,
  ...issuePlanners,
};
