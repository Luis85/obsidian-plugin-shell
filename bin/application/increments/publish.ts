/**
 * `pr publish` over the HostingRemote and Git ports. The preview only reads: readiness, whether head and base are
 * on the remote, and pull requests already carrying this document's marker (adopted, never created twice). Apply
 * pushes a missing head (the only push the CLI makes), creates or adopts the draft and reads it back; a write whose
 * outcome is unknown is reported as uncertain and never retried. Local records are the caller's next step.
 */
import { insistRemote, normalizeText } from '../../domain/increments/remote-model.ts';
import type { LinkResolver, PullRequestStatus, RemotePullRequestView } from '../../domain/increments/remote-model.ts';
import { bodySize, composeRemoteBody, parseRemoteBody, remoteMarker, renderManagedBlock, requireBodyFits } from '../../domain/increments/remote-body.ts';
import { planPublish, type PublishPlan } from '../../domain/increments/remote-state.ts';
import type { HostingRemote, RemotePullRequest, RemoteReadiness } from './remote-port.ts';
import type { GitPort } from './git-port.ts';

export interface PublishRequest { view: RemotePullRequestView; status: PullRequestStatus; push: boolean; resolve: LinkResolver }
export interface PublishPreview {
  readiness: RemoteReadiness; plan: PublishPlan; existing: RemotePullRequest | null;
  headExists: boolean; title: string; body: string; size: { limit: number; size: number; fits: boolean };
}
/** A write outcome the caller must report as uncertain (exit 2) instead of a failure or success. */
export interface UncertainOutcome { status: 'uncertain'; step: 'readback'; code: string; message: string; number: number }
export type Applied = { status: 'applied'; pull: RemotePullRequest; pushed: boolean } | UncertainOutcome;

/** Refuses an unready platform with its first diagnostic (CLI missing, sign-in required, repository unreachable). */
export function requireReady(readiness: RemoteReadiness): void {
  const first = readiness.diagnostics[0];
  insistRemote(readiness.configured, first?.code ?? 'PR_HOSTING_UNCONFIGURED', first?.message ?? 'The hosting platform is not ready.');
}
export async function previewPublish(remote: HostingRemote, request: PublishRequest): Promise<PublishPreview> {
  const readiness = await remote.readiness();
  requireReady(readiness);
  const { view } = request;
  const headExists = await remote.headExists(view.head), baseExists = await remote.headExists(view.base);
  const found = await remote.findMarked(view.head, view.base, remoteMarker(view.id));
  const plan = planPublish({ status: request.status, head: view.head, base: view.base, headExists, baseExists, marked: found.marked, unmarkedOpen: found.unmarkedOpen, push: request.push });
  const existing = plan.adopt === null ? null : found.marked[0]!;
  const links = remote.linkTarget(view.head), block = renderManagedBlock(view, { links, resolve: request.resolve });
  const body = existing ? composeRemoteBody(existing.body, parseRemoteBody(existing.body, links), block) : block;
  requireBodyFits(body, remote.platform);
  return { readiness, plan, existing, headExists, title: view.title, body, size: bodySize(body, remote.platform) };
}
/** True when the platform holds exactly the rendered title and body (line endings and trailing blanks ignored). */
export const matches = (pull: RemotePullRequest, title: string, body: string): boolean => pull.title === title && normalizeText(pull.body) === normalizeText(body);
/** Reads a written pull request back; a failed or different read is uncertain, never retried. */
export async function readBack(remote: HostingRemote, number: number, title: string, body: string): Promise<{ status: 'ok'; pull: RemotePullRequest } | UncertainOutcome> {
  let pull: RemotePullRequest;
  try { pull = await remote.get(number); } catch {
    return { status: 'uncertain', step: 'readback', code: 'PR_REMOTE_UNCERTAIN', message: `Pull request #${number} was written but could not be read back.`, number };
  }
  if (!matches(pull, title, body)) return { status: 'uncertain', step: 'readback', code: 'PR_READBACK_MISMATCH', message: `Pull request #${number} does not hold the written title and body.`, number };
  return { status: 'ok', pull };
}
export async function applyPublish(remote: HostingRemote, git: GitPort, preview: PublishPreview, view: RemotePullRequestView): Promise<Applied> {
  if (preview.plan.needsPush) await git.push('origin', view.head);
  const existing = preview.existing;
  let written: RemotePullRequest;
  if (!existing) written = await remote.create({ title: preview.title, body: preview.body, head: view.head, base: view.base });
  else written = matches(existing, preview.title, preview.body) ? existing : await remote.update(existing.number, { title: preview.title, body: preview.body });
  const back = await readBack(remote, written.number, preview.title, preview.body);
  return back.status === 'ok' ? { status: 'applied', pull: back.pull, pushed: preview.plan.needsPush } : back;
}
