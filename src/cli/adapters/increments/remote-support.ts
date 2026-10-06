/**
 * Shared steps of the `remote` effect (`pr publish` and `pr sync`). The preview reads the hosting platform and plans the local
 * records; --apply <planHash> or --yes re-plans under a cross-process lock, refuses a changed plan (PLAN_STALE),
 * writes the remote first, reads it back, then writes the local documents and the sync record in one file plan.
 * A remote write with an unknown outcome, or a local record that fails after a remote write, is PR_REMOTE_UNCERTAIN
 * with `data.uncertain: true` (exit 2); nothing is retried. Never portable through --plan-out or plan apply.
 */
import { applyFilePlan } from '#shared/platform/file-plan.ts';
import { serializeJson as json } from '#shared/contracts/serialization.ts';
import { canonicalRequest } from '../framework/catalog.ts';
import { hash } from '../framework/files.ts';
import { OperationError, requireThat, type Context, type Request } from '../framework/contracts.ts';
import { createSyncRecord, serializeSyncRecord, syncRecordPath } from '../../domain/increments/sync-record.ts';
import type { RemotePullRequestView } from '../../domain/increments/remote-model.ts';
import type { PullRequestStatus } from '../../domain/increments/model.ts';
import { recordHashing } from '../../application/increments/sync.ts';
import type { HostingRemote, RemotePullRequest } from '../../application/increments/remote-port.ts';
import { readTargetSources, resolveHostingTarget, type HostingTarget } from './hosting-target.ts';
import { createGitHubRemote } from './github-remote.ts';
import { createAzureRemote } from './azure-remote.ts';
import { Session } from './session.ts';
import { linkResolver, pullRequestView } from './remote-view.ts';
import { option } from './inputs.ts';
import type { StoredDocument } from './repository.ts';
import type { IncrementModel, PullRequestModel } from '../../domain/increments/model.ts';

const recovery = 'Inspect the pull request, then rerun the same command; it rediscovers the pull request by its marker and resumes without repeating finished steps.';
export function uncertain(step: string, message: string, code = 'PR_REMOTE_UNCERTAIN'): OperationError {
  const error = new OperationError(code, message, recovery);
  error.details = { uncertain: true, step, recovery };
  return error;
}
function remoteFor(session: Session, target: HostingTarget): HostingRemote {
  const custom = session.ws.services.remote;
  if (custom) return custom(target);
  return target.github ? createGitHubRemote({ repository: target.github.repository }) : createAzureRemote({ ...target.azure! });
}
export interface Loaded { session: Session; pull: StoredDocument<PullRequestModel>; increment: StoredDocument<IncrementModel>; view: RemotePullRequestView; target: HostingTarget; remote: HostingRemote; files: string[] }
export async function load(request: Request, context: Context): Promise<Loaded> {
  const session: Session = await Session.open(context), pull = await session.get('pullRequest', request.args[0]);
  const increment = await session.get('increment', pull.model.increment), files = await session.ws.files();
  const binding = pull.model.binding ? { binding: { platform: pull.model.binding.platform, repository: pull.model.binding.repository } } : {};
  const platform = option(request, 'platform');
  const target = resolveHostingTarget({ ...(platform ? { platform } : {}), ...binding }, await readTargetSources(context.root));
  return { session, pull, increment, view: pullRequestView(pull, increment), target, remote: remoteFor(session, target), files };
}
/** Local documents the plan reads: their current hashes bind the plan and are re-checked before the record write. */
export async function localBefore(loaded: Loaded): Promise<Record<string, string | null>> {
  const paths = [loaded.pull.path, loaded.increment.path, syncRecordPath(loaded.pull.id)];
  return Object.fromEntries(await Promise.all(paths.map(async path => { const text = await loaded.session.ws.read(path); return [path, text === null ? null : hash(text)] as const; })));
}
export const planHash = (context: Context, request: Request, fields: Record<string, unknown>) => hash(json({ protocolVersion: 1, root: context.root, request: canonicalRequest(request), ...fields }));
export const applying = (request: Request) => !request.options['dry-run'] && (request.options.apply !== undefined || request.options.yes === true);
export function requireFresh(request: Request, actual: string): void {
  const expected = option(request, 'apply');
  requireThat(expected === undefined || expected === actual, 'PLAN_STALE', 'The pull request or its documents changed since the reviewed preview; inspect a new plan.');
}
/** Writes the local documents after a remote write; any failure here leaves the remote ahead and is uncertain. */
export async function recordLocally(loaded: Loaded, before: Record<string, string | null>, write: (session: Session) => Promise<void>): Promise<unknown> {
  try {
    await write(loaded.session);
    const planned = await loaded.session.plan({ document: { kind: 'pullRequest', id: loaded.pull.id, path: loaded.pull.path }, statusBefore: null, statusAfter: null, edits: [] });
    const changed = planned.plan.changes.filter(change => Object.hasOwn(before, change.path) && change.beforeHash !== before[change.path]);
    if (changed.length) throw new Error('local documents changed during the remote write');
    return await applyFilePlan(planned.plan);
  } catch (error) {
    if (error instanceof OperationError && error.code === 'INCREMENT_UNCHANGED') return null;
    throw uncertain('local-record', `The hosting platform was updated but the local record could not be written (${error instanceof Error ? error.message.slice(0, 200) : 'unknown error'}).`);
  }
}
export function syncRecord(loaded: Loaded, view: RemotePullRequestView, state: PullRequestStatus, pull: RemotePullRequest, now: string): string {
  const repository = loaded.target.github?.repository ?? loaded.target.azure!.repository;
  return serializeSyncRecord(createSyncRecord({ view, state, platform: loaded.target.platform, repository, number: pull.number, remoteRevision: pull.revision,
    body: pull.body, links: loaded.remote.linkTarget(view.head), syncedAt: now }, recordHashing(hash, linkResolver(loaded.files))));
}

