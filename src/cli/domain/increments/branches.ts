/**
 * Branch names of an increment: one increment branch from the base, the kick-off pull request merging it back,
 * and change pull requests stacked on the increment branch. Pure naming and checks; Git itself is an adapter.
 */
import { hasControls } from '#shared/contracts/sketch-errors.ts';
import { insistDelivery, type DeliveryErrorCode } from './errors.ts';
import { defaultDeliverySchema, type BranchConfig, type Problem, type PullRequestKind } from './model.ts';

/** `git check-ref-format --branch` rules, without consulting Git. */
export function isBranchName(value: string): boolean {
  if (!value || value.length > 200 || hasControls(value) || /[\s~^:?*[\\]/u.test(value)) return false;
  if (/^[-/]|\/$|\.$|\.lock$|\.\.|\/\/|@\{/u.test(value) || value === '@') return false;
  return value.split('/').every(part => part.length > 0 && !part.startsWith('.') && !part.endsWith('.lock'));
}
export function requireBranchName(value: string, code: DeliveryErrorCode = 'BRANCH_NAME_INVALID'): string {
  const name = value.trim();
  insistDelivery(isBranchName(name), code, `"${value}" is not a valid branch name.`);
  return name;
}
function fill(pattern: string, values: Record<string, string>, name: string): string {
  const unknown = [...pattern.matchAll(/\{([^}]*)\}/g)].map(match => match[1]!).filter(key => !Object.hasOwn(values, key));
  insistDelivery(!unknown.length, 'BRANCH_NAME_INVALID', `branches.${name} uses unknown placeholders ${unknown.join(', ')}.`);
  return requireBranchName(pattern.replace(/\{([^}]*)\}/g, (_, key: string) => values[key]!));
}
export interface BranchNames { base: string; increment: string; pullRequest: string | null }
/** The base branch, the increment branch and (with a pull-request id) the change branch the patterns produce. */
export function branchNames(config: BranchConfig = defaultDeliverySchema.branches, incrementId: string, pullRequestId?: string): BranchNames {
  insistDelivery(config.increment.includes('{id}'), 'BRANCH_NAME_INVALID', 'branches.increment must contain {id}.');
  insistDelivery(config.pullRequest.includes('{pr}'), 'BRANCH_NAME_INVALID', 'branches.pullRequest must contain {pr}.');
  const increment = fill(config.increment, { id: incrementId }, 'increment');
  const pullRequest = pullRequestId === undefined ? null : fill(config.pullRequest, { increment: incrementId, pr: pullRequestId }, 'pullRequest');
  const names = [requireBranchName(config.base), increment, ...(pullRequest ? [pullRequest] : [])];
  const nested = names.some(name => names.some(other => other.startsWith(`${name}/`)));
  insistDelivery(!nested, 'BRANCH_NAME_INVALID', 'Branch patterns must not nest one branch inside another (refs a/b and a/b/c cannot coexist); use for example pr/{increment}/{pr}.', { names });
  return { base: names[0]!, increment, pullRequest };
}
/** What an Increment records about its own branch; absent keys fall back to the configured patterns. */
export interface IncrementBranch { id: string; branch?: string | null; base?: string | null }
/**
 * Default base and head of a new pull request: the kick-off merges the increment branch into the base;
 * a change pull request branches from the increment branch and merges back into it.
 */
export function pullRequestBranches(kind: PullRequestKind, increment: IncrementBranch, pullRequestId: string, config: BranchConfig = defaultDeliverySchema.branches): { base: string; head: string } {
  const names = branchNames(config, increment.id, pullRequestId), incrementBranch = increment.branch || names.increment;
  return kind === 'kickoff' ? { base: increment.base || names.base, head: incrementBranch } : { base: incrementBranch, head: names.pullRequest! };
}
/**
 * A base other than the expected one refuses unless the caller passed it explicitly, in which case it is a
 * warning: change pull requests stack on the increment branch, the kick-off merges into the base.
 */
export function checkPullRequestBase(kind: PullRequestKind, base: string, increment: IncrementBranch, explicit: boolean, config: BranchConfig = defaultDeliverySchema.branches): Problem[] {
  const expected = pullRequestBranches(kind, increment, 'pr', config).base;
  if (base === expected) return [];
  const message = `A ${kind} pull request of ${increment.id} normally targets ${expected}, not ${base}.`;
  insistDelivery(explicit, 'PR_BASE_MISMATCH', `${message} Pass --base explicitly to override.`, { expected, base });
  return [{ code: 'PR_BASE_MISMATCH', message }];
}
