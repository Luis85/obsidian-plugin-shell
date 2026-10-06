/**
 * Version control behind the increment commands: whether a work tree is available, which refs exist and the
 * three writes a reviewed plan may contain (create a branch, switch to it, push a head). Branch creation is
 * planned from read-only facts and bound to the start commit, so a plan hash changes when the start moves.
 * The adapter (`src/cli/adapters/increments/git.ts`) runs git with argument arrays, bounded output and timeouts.
 */
export interface GitPort {
  /** git is installed and the project root is inside a work tree. */
  available(): Promise<boolean>;
  /** The commit a ref names, or null. */
  resolve(ref: string): Promise<string | null>;
  /** A local branch `refs/heads/<name>` exists. */
  branchExists(name: string): Promise<boolean>;
  createBranch(name: string, start: string): Promise<void>;
  switchBranch(name: string): Promise<void>;
  fetch(remote: string, branch: string): Promise<void>;
  /** `push -u <remote> <branch>`; never forced. */
  push(remote: string, branch: string): Promise<void>;
  /** Tracked and untracked, not ignored files; null without git. */
  listFiles(): Promise<string[] | null>;
}

export interface BranchRequest {
  name: string;
  /** Start candidates in order of preference, for example `origin/main` then `main`. */
  starts: readonly string[];
  /** false with --no-branch. */
  create: boolean;
  switch: boolean;
  fetch: boolean;
}
export type BranchPlan =
  | { status: 'planned'; name: string; start: string; commit: string; switch: boolean; fetch: { remote: string; branch: string } | null }
  | { status: 'exists' | 'skipped' | 'unavailable' | 'no-start'; name: string; reason: string };

const fetchTarget = (start: string): { remote: string; branch: string } | null => {
  const match = /^([^/]+)\/(.+)$/.exec(start);
  return match && match[1] === 'origin' ? { remote: 'origin', branch: match[2]! } : null;
};
async function firstStart(git: GitPort, starts: readonly string[]): Promise<{ start: string; commit: string } | null> {
  for (const start of starts) {
    const commit = await git.resolve(start);
    if (commit) return { start, commit };
  }
  return null;
}
/** The reviewed branch step, or why there is none; reads refs only. */
export async function planBranch(git: GitPort, request: BranchRequest): Promise<BranchPlan> {
  const name = request.name;
  if (!request.create) return { status: 'skipped', name, reason: 'Skipped with --no-branch.' };
  if (!await git.available()) return { status: 'unavailable', name, reason: 'git is not available or the project is not a work tree.' };
  if (await git.branchExists(name)) return { status: 'exists', name, reason: `${name} already exists; it is left as it is.` };
  const found = await firstStart(git, request.starts);
  if (!found) return { status: 'no-start', name, reason: `None of ${request.starts.join(', ')} exists to start ${name} from.` };
  return { status: 'planned', name, start: found.start, commit: found.commit, switch: request.switch, fetch: request.fetch ? fetchTarget(found.start) : null };
}
/** Runs a planned branch step: optional fetch, create from the start ref (the fetched tip with --fetch, else the reviewed commit), optional switch. */
export async function runBranch(git: GitPort, plan: BranchPlan): Promise<{ name: string; status: string; start?: string }> {
  if (plan.status !== 'planned') return { name: plan.name, status: plan.status };
  if (plan.fetch) await git.fetch(plan.fetch.remote, plan.fetch.branch);
  await git.createBranch(plan.name, plan.fetch ? plan.start : plan.commit);
  if (plan.switch) await git.switchBranch(plan.name);
  return { name: plan.name, status: plan.switch ? 'created-and-switched' : 'created', start: plan.start };
}
