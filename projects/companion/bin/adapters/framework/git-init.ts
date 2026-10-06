/** Version control for a freshly generated project: `git init` plus one initial commit, so an agent or
 * developer starts from a clean, diffable baseline. It never touches an existing repository, never
 * sets global configuration and never fails the creation; the report says what happened and why. */
import { execFile } from 'node:child_process';

export interface GitOutput { code: number | null; stdout: string }
export type GitRunner = (cwd: string, args: readonly string[]) => Promise<GitOutput>;
export interface GitReport { status: 'initialized' | 'skipped' | 'failed'; reason?: string; committer?: 'configured' | 'neutral'; message?: string }

/** Local to the initial commit only (`-c`), and only when no identity is configured. */
const neutralIdentity = ['-c', 'user.name=Plugin Shell', '-c', 'user.email=noreply@plugin-shell.invalid'] as const;

const runGit: GitRunner = (cwd, args) => new Promise(accept => {
  execFile('git', args, { cwd, shell: false, windowsHide: true, timeout: 60_000, maxBuffer: 4_194_304, encoding: 'utf8' },
    (error, stdout) => accept({ code: error ? (typeof error.code === 'number' ? error.code : null) : 0, stdout }));
});

async function configured(run: GitRunner, directory: string, key: string): Promise<boolean> {
  const value = await run(directory, ['config', '--get', key]);
  return value.code === 0 && value.stdout.trim() !== '';
}
async function committer(run: GitRunner, directory: string): Promise<'configured' | 'neutral'> {
  return await configured(run, directory, 'user.name') && await configured(run, directory, 'user.email') ? 'configured' : 'neutral';
}
/** Returns why git must not be initialized here, or null when it may be. */
async function skipReason(run: GitRunner, directory: string): Promise<string | null> {
  if ((await run(directory, ['--version'])).code !== 0) return 'git is not available';
  const inside = await run(directory, ['rev-parse', '--is-inside-work-tree']);
  return inside.code === 0 && inside.stdout.trim() === 'true' ? 'the folder is already inside a git work tree' : null;
}
export async function initializeRepository(directory: string, source: string, run: GitRunner = runGit): Promise<GitReport> {
  const skipped = await skipReason(run, directory);
  if (skipped) return { status: 'skipped', reason: skipped };
  if ((await run(directory, ['init'])).code !== 0) return { status: 'failed', reason: 'git init failed' };
  const author = await committer(run, directory), message = `chore: generate project from ${source}`;
  const identity = author === 'neutral' ? neutralIdentity : [];
  if ((await run(directory, ['add', '--all'])).code !== 0) return { status: 'failed', reason: 'git add failed; the repository is initialized without a commit' };
  const commit = await run(directory, [...identity, 'commit', '--quiet', '--message', message]);
  return commit.code === 0 ? { status: 'initialized', committer: author, message }
    : { status: 'failed', reason: 'the initial commit failed (for example a signing or hook setting); the repository is initialized with staged files' };
}
