/**
 * `pr sync` over the HostingRemote port: one read of the published pull request, the pure three-way merge against
 * the sync record, then (on apply) at most one update and its read-back. Conflicts block before any write; a
 * merged or closed pull request is synced pull-only.
 */
import { canonicalWikilinks } from '../../domain/increments/remote-links.ts';
import { syncPullRequest, type Side, type SyncOutcome } from '../../domain/increments/sync-merge.ts';
import type { Hashing, SyncRecord } from '../../domain/increments/sync-record.ts';
import type { LinkResolver, LinkTarget, PullRequestStatus, RemotePullRequestView, TextHash } from '../../domain/increments/remote-model.ts';
import type { HostingRemote, RemotePullRequest } from './remote-port.ts';
import { readBack, requireReady, type UncertainOutcome } from './publish.ts';

export interface SyncRequest {
  view: RemotePullRequestView; localStatus: PullRequestStatus; record: SyncRecord; number: number;
  resolve: LinkResolver; hash: TextHash; today: string; prefer?: Side; resolutions?: Record<string, Side>;
}
export interface SyncPreview { pull: RemotePullRequest; outcome: SyncOutcome; links: LinkTarget }
/** The hashing every publish and sync record uses: wikilinks compared in their resolved form. */
export const recordHashing = (hash: TextHash, resolve: LinkResolver): Hashing => ({ hash, canonical: markdown => canonicalWikilinks(markdown, resolve) });

export async function previewSync(remote: HostingRemote, request: SyncRequest): Promise<SyncPreview> {
  requireReady(await remote.readiness());
  const pull = await remote.get(request.number), links = remote.linkTarget(request.view.head);
  const outcome = syncPullRequest({ local: request.view, localStatus: request.localStatus, record: request.record,
    remote: { title: pull.title, body: pull.body, state: pull.state, head: pull.head, base: pull.base }, platform: remote.platform,
    body: { links, resolve: request.resolve }, hashing: recordHashing(request.hash, request.resolve), today: request.today,
    ...(request.prefer ? { prefer: request.prefer } : {}), ...(request.resolutions ? { resolutions: request.resolutions } : {}) });
  return { pull, outcome, links };
}
/** Writes the remote patch (if any) and reads it back; the pull request as it now is on the platform. */
export async function applySync(remote: HostingRemote, preview: SyncPreview): Promise<{ status: 'applied'; pull: RemotePullRequest } | UncertainOutcome> {
  const patch = preview.outcome.remotePatch;
  if (!patch) return { status: 'applied', pull: preview.pull };
  const written = await remote.update(preview.pull.number, patch);
  const back = await readBack(remote, written.number, patch.title ?? preview.pull.title, patch.body ?? preview.pull.body);
  return back.status === 'ok' ? { status: 'applied', pull: back.pull } : back;
}
