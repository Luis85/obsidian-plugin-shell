/** Reviewed hosted PR lifecycle. No remote operation is retried after an uncertain write. */
import { requireThat, result, type Context, type Request, type Result } from '../framework/contracts.ts';
import { setPullRequestBinding } from '../../domain/increments/pull-request-document.ts';
import { setFrontmatterValue } from '../../domain/increments/frontmatter.ts';
import { localStatus } from '../../domain/increments/remote-state.ts';
import { remoteMarker } from '../../domain/increments/remote-body.ts';
import type { PullRequestAction } from '../../application/increments/remote-port.ts';
import { blocking, requireGate } from './delivery-gates.ts';
import { applying, load, localBefore, planHash, recordLocally, requireFresh, uncertain, type Loaded } from './remote-support.ts';
import { withRemoteLock } from './remote-lock.ts';
import { writeStatus } from './remote-view.ts';

const actions: Record<string, PullRequestAction> = { 'pr review': 'review', 'pr close': 'close', 'pr merge': 'merge' };
const states = { review: 'open', close: 'closed', merge: 'merged' } as const;
async function done(loaded: Loaded, headCommit: string): Promise<void> {
  const git = loaded.session.ws.git;
  requireThat(await git.currentBranch() === loaded.view.head && await git.resolve('HEAD') === headCommit && await git.clean(),
    'PR_REVIEW_CHECKOUT_REQUIRED', `Check out ${loaded.view.head} at the published source commit with a clean work tree before review or merge.`);
  const report = await requireGate(loaded.session.ws, loaded.increment.path, 'done', loaded.view.base);
  const failures = blocking(report);
  requireThat(!failures.length, 'INCREMENT_NOT_DONE', failures.map(rule => `${rule.id}: ${rule.message}`).join('\n'));
  if (loaded.pull.model.kind === 'kickoff') requireThat(loaded.increment.model.sections.some(section => section.name === 'Iteration review'),
    'ITERATION_PRESENTATION_REQUIRED', 'Save and commit the work presentation with increment present before requesting review.');
}
async function plan(request: Request, context: Context) {
  const action = actions[request.command];
  requireThat(action, 'INVALID_COMMAND', 'Unknown pull-request lifecycle action.');
  const loaded = await load(request, context), binding = loaded.pull.model.binding;
  requireThat(binding, 'PR_NOT_PUBLISHED', 'Publish the kick-off as a draft before changing its hosted state.');
  const pull = await loaded.remote.get(binding.number);
  requireThat(pull.head === loaded.view.head && pull.base === loaded.view.base && pull.body.includes(remoteMarker(loaded.pull.id)),
    'PR_REMOTE_MISMATCH', 'The remote pull request no longer matches its document and marker.');
  requireThat(pull.headCommit && /^[0-9a-f]{40,64}$/.test(pull.headCommit), 'PR_REMOTE_RESPONSE_INVALID', 'The platform did not supply a source commit.');
  const completed = pull.state === states[action];
  if (!completed) {
    const allowed = action === 'review' ? pull.state === 'draft' : action === 'merge' ? pull.state === 'open' : ['draft', 'open'].includes(pull.state);
    requireThat(allowed, 'PR_STATUS_TRANSITION', `Cannot ${action} a pull request in state ${pull.state}.`);
    if (action !== 'close') await done(loaded, pull.headCommit);
  }
  if (action === 'close' && loaded.pull.model.kind === 'kickoff') {
    const children = (await loaded.session.all('pullRequest')).filter(item => item.model.increment === loaded.increment.id && item.id !== loaded.pull.id);
    requireThat(!children.some(item => ['Draft', 'Ready'].includes(item.model.status)), 'INCREMENT_OPEN_PULL_REQUESTS', 'Close or merge and sync the iteration’s open change pull requests first.');
  }
  const before = await localBefore(loaded);
  const data = { planHash: planHash(context, request, { before, action, revision: pull.revision, headCommit: pull.headCommit }),
    action, completed, remote: { platform: loaded.target.platform, repository: loaded.target.repository, head: pull.head, base: pull.base, number: pull.number, url: pull.url, before: pull.state, after: states[action], headCommit: pull.headCommit },
    changes: [loaded.pull.path, loaded.increment.path].map(path => ({ path, status: 'update', beforeHash: before[path] })), next: action === 'close' ? `node bin/app increment carry-over ${loaded.increment.id} <next> --dry-run` : `node bin/app pr sync ${loaded.pull.id} --dry-run` };
  return { loaded, pull, before, data, action };
}
export async function lifecycle(request: Request, context: Context): Promise<Result> {
  if (!applying(request)) return result(request.command, (await plan(request, context)).data, 'planned');
  return withRemoteLock(context.root, request.args[0] ?? '', async () => {
    const { loaded, pull, before, data, action } = await plan(request, context);
    requireFresh(request, data.planHash);
    if (!data.completed) {
      const latest = await loaded.remote.get(pull.number);
      requireThat(latest.revision === pull.revision && latest.headCommit === pull.headCommit, 'PLAN_STALE', 'The pull request changed before the write; inspect a fresh preview.');
      await loaded.remote.transition(pull.number, action, data.remote.headCommit);
    }
    let verified;
    try { verified = await loaded.remote.get(pull.number); }
    catch { throw uncertain('readback', 'The pull-request state could not be verified after the operation. Inspect it before proceeding.'); }
    if (verified.state !== states[action] || verified.head !== pull.head || verified.base !== pull.base || verified.headCommit !== pull.headCommit) {
      throw uncertain('readback', 'The platform has not confirmed the reviewed pull-request state and source commit.');
    }
    const status = localStatus(verified.state), now = loaded.session.ws.now().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const written = await recordLocally(loaded, before, async session => {
      session.write(loaded.pull.path, setPullRequestBinding(writeStatus(loaded.pull.text, loaded.pull.model.status, status), { ...loaded.pull.model.binding!, lastSyncedAt: now }));
      if (action === 'close' && loaded.pull.model.kind === 'kickoff') session.write(loaded.increment.path, setFrontmatterValue(loaded.increment.text, 'status', 'Cancelled'));
      session.touch(loaded.increment.id);
      // Keep the previous sync baseline: lifecycle actions must not acknowledge unsynced body edits.
    });
    return result(request.command, { ...data, mode: 'applied', applied: written }, 'applied');
  }, context.increments?.lockDirectory);
}
