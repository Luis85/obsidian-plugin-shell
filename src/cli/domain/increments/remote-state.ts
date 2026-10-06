/**
 * Hosted pull-request state to local PullRequest status. The remote is authoritative: the CLI never marks a draft
 * ready, merges or closes. GitHub: open+draft → Draft, open → Ready, closed with merged_at → Merged, closed → Closed.
 * Azure Repos: active+isDraft → Draft, active → Ready, completed → Merged, abandoned → Closed. Also plans the
 * publish steps from read-only remote facts.
 */
import { insistRemote } from './remote-model.ts';
import type { RemoteState } from './remote-model.ts';
import type { PullRequestStatus } from './model.ts';

const statusOf: Readonly<Record<RemoteState, PullRequestStatus>> = Object.freeze({ draft: 'Draft', open: 'Ready', merged: 'Merged', closed: 'Closed' });

/** GitHub REST pull fields; null when the combination is not one GitHub reports. */
export function githubRemoteState(pull: { state: unknown; draft: unknown; merged: boolean }): RemoteState | null {
  if (pull.state === 'closed') return pull.merged ? 'merged' : 'closed';
  if (pull.state !== 'open' || pull.merged) return null;
  return pull.draft === true ? 'draft' : 'open';
}
/** Azure Repos pull-request `status` and `isDraft`; `notSet`/`all` or unknown values are rejected. */
export function azureRemoteState(pull: { status: unknown; isDraft: unknown }): RemoteState | null {
  if (pull.status === 'completed') return 'merged';
  if (pull.status === 'abandoned') return 'closed';
  if (pull.status !== 'active') return null;
  return pull.isDraft === true ? 'draft' : 'open';
}
export const localStatus = (state: RemoteState): PullRequestStatus => statusOf[state];
/** Merged and closed pull requests are synced pull-only: no remote write is ever planned for them. */
export const isTerminalState = (state: RemoteState): boolean => state === 'merged' || state === 'closed';

export interface StatusChange { before: PullRequestStatus; after: PullRequestStatus; reopened: boolean; warning: string | null }
/**
 * The local status after a sync. A remote reopen (Closed → Draft/Ready) is accepted; leaving Merged is reported,
 * because a merged pull request cannot reopen and the binding probably points at the wrong number.
 */
export function statusFromRemote(before: PullRequestStatus, state: RemoteState, recorded: PullRequestStatus | null): StatusChange {
  const after = localStatus(state);
  const reopened = before === 'Closed' && (after === 'Draft' || after === 'Ready');
  let warning: string | null = null;
  if (before === 'Merged' && after !== 'Merged') warning = 'PR_REMOTE_STATE_REGRESSED';
  else if (recorded !== null && before !== recorded && before !== after) warning = 'PR_LOCAL_STATUS_OVERWRITTEN';
  return { before, after, reopened, warning };
}

export type PublishStep = 'push-head' | 'create' | 'adopt' | 'readback' | 'record';
/** Read-only facts a publish preview gathers: HostingRemote.headExists for head and base, and findMarked. */
export interface PublishFacts {
  status: PullRequestStatus;
  head: string;
  base: string;
  headExists: boolean;
  baseExists: boolean;
  marked: ReadonlyArray<{ number: number; state: RemoteState }>;
  unmarkedOpen: number;
  /** False with `--no-push`: a missing head is then refused instead of planned. */
  push: boolean;
}
export interface PublishPlan { action: 'create' | 'adopt'; adopt: number | null; needsPush: boolean; steps: PublishStep[] }
/**
 * The ordered steps of `pr publish`. A missing head becomes a separate `push-head` step, run by the caller's
 * version-control port and only on --apply/--yes; a pull request already carrying this document's marker is adopted,
 * never created twice; an unmarked open pull request for the same branches is a duplicate. A change pull request
 * needs its base, the increment branch, on the remote first (the kick-off publish pushes it).
 */
export function planPublish(facts: PublishFacts): PublishPlan {
  insistRemote(facts.status === 'New', 'PR_ALREADY_PUBLISHED', `The pull request is ${facts.status}; run pr sync instead of publishing it again.`);
  insistRemote(facts.marked.length <= 1, 'PR_REMOTE_DUPLICATE', `${facts.marked.length} remote pull requests carry this document's marker; close the extra ones first.`);
  insistRemote(facts.marked.length === 1 || facts.unmarkedOpen === 0, 'PR_REMOTE_DUPLICATE', `An open pull request from ${facts.head} into ${facts.base} already exists without this document's marker.`);
  insistRemote(facts.baseExists, 'PR_BASE_NOT_ON_REMOTE', `The base branch ${facts.base} is not on the remote; publish the increment's kick-off pull request first, which pushes it.`);
  insistRemote(facts.headExists || facts.push, 'PR_HEAD_NOT_PUSHED', `The head branch ${facts.head} is not on the remote and --no-push was given; push it first (push -u origin ${facts.head}).`);
  const adopt = facts.marked[0]?.number ?? null;
  const steps: PublishStep[] = facts.headExists ? [] : ['push-head'];
  steps.push(adopt === null ? 'create' : 'adopt', 'readback', 'record');
  return { action: adopt === null ? 'create' : 'adopt', adopt, needsPush: !facts.headExists, steps };
}
