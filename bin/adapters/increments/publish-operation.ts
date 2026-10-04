/** `pr publish`: preview the remote, then push a missing head, create or adopt the draft and record it locally. */
import { hash } from '../framework/files.ts';
import { OperationError, result, type Context, type Request, type Result } from '../framework/contracts.ts';
import { setPullRequestBinding, validatePullRequest } from '../../domain/increments/pull-request-document.ts';
import { checkIncrementTransition } from '../../domain/increments/transitions.ts';
import { setFrontmatterValue } from '../../domain/increments/frontmatter.ts';
import { syncRecordPath } from '../../domain/increments/sync-record.ts';
import { applyPublish, previewPublish, type PublishPreview } from '../../application/increments/publish.ts';
import { withRemoteLock } from './remote-lock.ts';
import { linkResolver, knownStatus, writeStatus } from './remote-view.ts';
import { flag } from './inputs.ts';
import { applying, load, localBefore, planHash, recordLocally, requireFresh, syncRecord, uncertain, type Loaded } from './remote-support.ts';

/** Unresolved or ambiguous wikilinks would publish as dead links. */
function requireLinks(loaded: Loaded): void {
  const problem = validatePullRequest(loaded.pull.text, { path: loaded.pull.path, files: loaded.files }).find(item => item.code.startsWith('WIKILINK_'));
  if (problem) throw new OperationError(problem.code, `${loaded.pull.path}${problem.line ? `:${problem.line}` : ''}: ${problem.message}`, 'Fix the link, or add the missing document, then preview again.');
}
function publishData(loaded: Loaded, preview: PublishPreview, hashValue: string, before: Record<string, string | null>) {
  const statusAfter = loaded.increment.model.status === 'Ready' ? 'In progress' : loaded.increment.model.status;
  return { planHash: hashValue, mode: 'preview', pullRequest: { id: loaded.pull.id, path: loaded.pull.path, increment: loaded.increment.id },
    remote: { platform: loaded.target.platform, repository: loaded.target.repository, head: loaded.view.head, base: loaded.view.base, action: preview.plan.action,
      existing: preview.existing ? { number: preview.existing.number, url: preview.existing.url, state: preview.existing.state } : null,
      headExists: preview.headExists, needsPush: preview.plan.needsPush, steps: preview.plan.steps, readiness: preview.readiness },
    rendered: { title: preview.title, bodyChars: preview.size.size, bodySha256: hash(preview.body), limit: preview.size.limit },
    changes: Object.entries(before).map(([path, beforeHash]) => ({ path, status: beforeHash === null ? 'create' : 'update', beforeHash })),
    increment: { statusBefore: loaded.increment.model.status, statusAfter }, warnings: loaded.target.warnings,
    ...(preview.plan.needsPush ? { push: `git push -u origin ${loaded.view.head}` } : {}) };
}
async function publishPlan(request: Request, context: Context) {
  const loaded = await load(request, context);
  requireLinks(loaded);
  const preview = await previewPublish(loaded.remote, { view: loaded.view, status: knownStatus(loaded.pull.model.status), push: !flag(request, 'no-push'), resolve: linkResolver(loaded.files) });
  const before = await localBefore(loaded);
  const hashValue = planHash(context, request, { localBefore: before, remote: { platform: loaded.target.platform, repository: loaded.target.repository,
    adopt: preview.existing?.number ?? null, revision: preview.existing?.revision ?? null, headExists: preview.headExists }, rendered: { title: preview.title, body: hash(preview.body) } });
  return { loaded, preview, before, data: publishData(loaded, preview, hashValue, before) };
}
export async function publish(request: Request, context: Context): Promise<Result> {
  if (!applying(request)) return result(request.command, (await publishPlan(request, context)).data, 'planned');
  return withRemoteLock(context.root, request.args[0] ?? '', async () => {
    const { loaded, preview, before, data } = await publishPlan(request, context);
    requireFresh(request, data.planHash);
    const applied = await applyPublish(loaded.remote, loaded.session.ws.git, preview, loaded.view);
    if (applied.status === 'uncertain') throw uncertain(applied.step, applied.message, applied.code);
    const now = loaded.session.ws.now().toISOString().replace(/\.\d{3}Z$/, 'Z'), pull = applied.pull;
    const written = await recordLocally(loaded, before, async session => {
      const repository = loaded.target.github?.repository ?? loaded.target.azure!.repository;
      session.write(loaded.pull.path, setPullRequestBinding(writeStatus(loaded.pull.text, loaded.pull.model.status, 'Draft'),
        { platform: loaded.target.platform, repository, number: pull.number, url: pull.url, publishedAt: now, lastSyncedAt: now }));
      if (data.increment.statusAfter !== data.increment.statusBefore) session.write(loaded.increment.path, setFrontmatterValue(loaded.increment.text, 'status',
        checkIncrementTransition(loaded.increment.model.status, 'In progress', { pullRequests: [] }), { after: session.ws.schema.handoff.requiredKeys }));
      session.touch(loaded.increment.id);
      session.write(syncRecordPath(loaded.pull.id), syncRecord(loaded, loaded.view, 'Draft', pull, now));
    });
    return result(request.command, { ...data, mode: 'applied', remote: { ...data.remote, number: pull.number, url: pull.url, state: 'Draft' }, pushed: applied.pushed, applied: written }, 'applied');
  }, context.increments?.lockDirectory);
}
