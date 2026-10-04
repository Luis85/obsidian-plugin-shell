/**
 * Status machines and edit locks. An Increment moves New → Refining → Ready → In progress → Done (or Cancelled);
 * a PullRequest is New until it is published, after which the hosting platform decides its status through sync.
 */
import { insistDelivery } from './errors.ts';
import { incrementStatuses, issueStatuses, pullRequestStatuses, type IncrementStatus, type IssueStatus, type PullRequestStatus, type Problem } from './model.ts';

export const incrementTransitions: Readonly<Record<IncrementStatus, readonly IncrementStatus[]>> = Object.freeze({
  New: ['Refining', 'Ready', 'Cancelled'],
  Refining: ['Ready', 'Cancelled'],
  Ready: ['Refining', 'In progress', 'Cancelled'],
  'In progress': ['Refining', 'Done', 'Cancelled'],
  Done: [],
  Cancelled: ['Refining'],
});
const slugOf = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '-');
function named<T extends string>(values: readonly T[], input: string): T | null {
  return values.find(value => value === input || slugOf(value) === slugOf(input)) ?? null;
}
/** The exact status name or its slug alias (`in-progress`, `ready`); null for anything else. */
export const incrementStatus = (input: string): IncrementStatus | null => named(incrementStatuses, input);
export const pullRequestStatus = (input: string): PullRequestStatus | null => named(pullRequestStatuses, input);
export function requireIncrementStatus(input: string): IncrementStatus {
  const status = incrementStatus(input);
  insistDelivery(status, 'INCREMENT_STATUS_TRANSITION', `Unknown status "${input}"; use ${incrementStatuses.join(', ')}.`);
  return status;
}
export const allowedIncrementTransitions = (from: IncrementStatus): readonly IncrementStatus[] => incrementTransitions[from];

/** What a transition guard needs to know besides the two statuses. */
export interface IncrementTransitionContext {
  /** Statuses of the pull requests the increment lists. */
  pullRequests: readonly string[];
  /** Readiness problems (DoR report or structural validation); only consulted for Ready. */
  readiness?: readonly Problem[];
}
const open = (statuses: readonly string[], names: readonly string[]) => statuses.filter(status => names.includes(status));
/** Refuses a transition the table does not allow or a guard rejects; returns the status to write. */
export function checkIncrementTransition(fromInput: string, toInput: string, context: IncrementTransitionContext): IncrementStatus {
  const from = requireIncrementStatus(fromInput), to = requireIncrementStatus(toInput);
  insistDelivery(incrementTransitions[from].includes(to), 'INCREMENT_STATUS_TRANSITION',
    `${from} cannot move to ${to}; allowed: ${incrementTransitions[from].join(', ') || 'none (terminal)'}.`, { from, to, allowed: [...incrementTransitions[from]] });
  if (to === 'Ready') insistDelivery(!context.readiness?.length, 'INCREMENT_NOT_READY', `The increment is not ready: ${context.readiness?.map(problem => problem.message).slice(0, 3).join(' ')}`, { problems: context.readiness });
  if (to === 'Cancelled') {
    const active = open(context.pullRequests, ['Draft', 'Ready']);
    insistDelivery(!active.length, 'INCREMENT_OPEN_PULL_REQUESTS', `${active.length} pull request(s) are still open on the hosting platform; close them first.`);
  }
  if (to === 'Done') {
    const unfinished = open(context.pullRequests, ['New', 'Draft', 'Ready']);
    insistDelivery(!unfinished.length && context.pullRequests.includes('Merged'), 'INCREMENT_OPEN_PULL_REQUESTS',
      'Done needs every pull request merged or closed and at least one merged.', { unfinished: unfinished.length });
  }
  return to;
}
/** Content edits are allowed until the increment is Done or Cancelled. */
export const incrementEditable = (status: string): boolean => !['Done', 'Cancelled'].includes(status);
export function requireIncrementEditable(status: string): void {
  insistDelivery(incrementEditable(status), 'INCREMENT_LOCKED', `The increment is ${status}; reopen it (Cancelled → Refining) before editing.`);
}

/** Edits a PullRequest document accepts; status changes have their own table. */
export const pullRequestEdits = ['title', 'head', 'base', 'section', 'scope', 'document', 'notes', 'task-add', 'task-set', 'amend', 'attach', 'link'] as const;
export type PullRequestEdit = typeof pullRequestEdits[number];
/** New: a local plan. Open: published and Draft/Ready. Terminal: published and Merged/Closed. Closed: never published. */
export type PullRequestPhase = 'new' | 'open' | 'terminal' | 'closed';
export const pullRequestLocks: Readonly<Record<PullRequestPhase, readonly PullRequestEdit[]>> = Object.freeze({
  new: ['title', 'head', 'base', 'section', 'scope', 'document', 'notes', 'task-add', 'task-set', 'attach', 'link'],
  open: ['task-add', 'task-set', 'amend'],
  terminal: [],
  closed: [],
});
export function pullRequestPhase(status: string, published: boolean): PullRequestPhase {
  if (!published) return status === 'Closed' ? 'closed' : 'new';
  return ['Merged', 'Closed'].includes(status) ? 'terminal' : 'open';
}
/** Refuses an edit the phase locks: amend before publication, plan edits after it, anything once terminal. */
export function requirePullRequestEdit(status: string, published: boolean, edit: PullRequestEdit): void {
  const phase = pullRequestPhase(status, published);
  if (pullRequestLocks[phase].includes(edit)) return;
  insistDelivery(!(edit === 'amend' && phase === 'new'), 'PR_NOT_PUBLISHED', 'Amendments record changes after publication; use pr notes while the pull request is New.');
  insistDelivery(phase !== 'terminal' && phase !== 'closed', 'PR_TERMINAL', `The pull request is ${status}; it can no longer be edited${phase === 'closed' ? ' until it is reopened with status New' : ''}.`);
  insistDelivery(false, 'PR_LOCKED', `A published pull request only accepts new or updated tasks and amendments (${edit} is locked).`, { edit, phase });
}
/** Local status changes: an unpublished pull request can be closed and reopened; everything else comes from sync. */
export function checkPullRequestTransition(fromInput: string, toInput: string, published: boolean): PullRequestStatus {
  const to = pullRequestStatus(toInput);
  insistDelivery(to === 'New' || to === 'Closed', 'PR_STATUS_TRANSITION', 'Only New and Closed are set locally; Draft, Ready and Merged come from pr publish and pr sync.');
  insistDelivery(!published, 'PR_ALREADY_PUBLISHED', 'A published pull request takes its status from the hosting platform; run pr sync.');
  const from = pullRequestStatus(fromInput);
  insistDelivery(from !== to && (from === 'New' || from === 'Closed'), 'PR_STATUS_TRANSITION', `${fromInput} cannot move to ${to}.`);
  return to;
}

export const issueTransitions: Readonly<Record<IssueStatus, readonly IssueStatus[]>> = Object.freeze({
  New: ['Ready', 'In progress', 'Cancelled'],
  Ready: ['New', 'In progress', 'Cancelled'],
  'In progress': ['Ready', 'Done', 'Cancelled'],
  Done: ['In progress'],
  Cancelled: ['New'],
});
export const issueStatus = (input: string): IssueStatus | null => named(issueStatuses, input);
/** Refuses a transition outside the issue table; Done needs every acceptance criterion of the issue checked. */
export function checkIssueTransition(fromInput: string, toInput: string, criteria: readonly { id: string; checked: boolean }[]): IssueStatus {
  const from = issueStatus(fromInput), to = issueStatus(toInput);
  insistDelivery(from && to, 'ISSUE_STATUS_TRANSITION', `Unknown status "${from ? toInput : fromInput}"; use ${issueStatuses.join(', ')}.`);
  insistDelivery(issueTransitions[from].includes(to), 'ISSUE_STATUS_TRANSITION', `${from} cannot move to ${to}; allowed: ${issueTransitions[from].join(', ')}.`, { from, to, allowed: [...issueTransitions[from]] });
  const open = criteria.filter(item => !item.checked).map(item => item.id);
  insistDelivery(to !== 'Done' || !open.length, 'ISSUE_STATUS_TRANSITION', `Done needs every acceptance criterion checked; open: ${open.join(', ')}.`, { open });
  return to;
}
/** Content edits are allowed until the issue is Done or Cancelled; reopening goes through its status. */
export function requireIssueEditable(status: string): void {
  insistDelivery(!['Done', 'Cancelled'].includes(status), 'ISSUE_LOCKED', `The issue is ${status}; reopen it (Done → In progress, Cancelled → New) before editing.`);
}
