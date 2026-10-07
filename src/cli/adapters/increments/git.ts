/**
 * GitPort over the git CLI: argument arrays (no shell), a timeout and bounded output per call, prompts and optional
 * locks off. Read calls never fail the command (a missing git reads as unavailable); the writes a reviewed plan
 * contains raise coded errors without echoing git's output, which can name remote URLs.
 */
import { execFile } from 'node:child_process';
import { OperationError } from '../framework/contracts.ts';
import type { GitPort } from '../../application/increments/git-port.ts';

export interface GitResult { code: number | null; stdout: string }
export type GitRunner = (cwd: string, args: readonly string[], timeoutMs: number) => Promise<GitResult>;
const scrubbed = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_CEILING_DIRECTORIES'];
function environment(): NodeJS.ProcessEnv {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !scrubbed.includes(key)));
  return { ...env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_PAGER: 'cat' };
}
const gitRunner: GitRunner = (cwd, args, timeoutMs) => new Promise(accept => {
  execFile('git', [...args], { cwd, env: environment(), shell: false, windowsHide: true, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' },
    (error, stdout) => accept({ code: error ? (typeof error.code === 'number' ? error.code : null) : 0, stdout: String(stdout) }));
});
const readTimeout = 30_000, writeTimeout = 120_000;
/** Refs and branch names reach git only after this check, so no value can be read as an option. */
function safeRef(value: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(value) || /\.\.|\/\/|@\{|\.lock$|\/$/.test(value)) throw new OperationError('BRANCH_NAME_INVALID', `"${value}" is not a safe branch or ref name.`);
  return value;
}
function failed(code: string, action: string, next: string): OperationError {
  return new OperationError(code, `git could not ${action}; nothing else was changed by this step.`, next);
}

export function createGitPort(root: string, run: GitRunner = gitRunner): GitPort {
  const git = (args: readonly string[], timeout = readTimeout) => run(root, ['-c', 'core.quotepath=false', ...args], timeout);
  const write = async (args: string[], code: string, action: string, next: string) => {
    if ((await git(args, writeTimeout)).code !== 0) throw failed(code, action, next);
  };
  let availability: Promise<boolean> | null = null;
  return {
    available() {
      availability ??= git(['rev-parse', '--is-inside-work-tree']).then(result => result.code === 0 && result.stdout.trim() === 'true');
      return availability;
    },
    async contains(ancestor, descendant) { return (await git(['merge-base', '--is-ancestor', safeRef(ancestor), safeRef(descendant)])).code === 0; },
    async currentBranch() {
      const result = await git(['symbolic-ref', '--quiet', '--short', 'HEAD']);
      return result.code === 0 ? result.stdout.trim() : null;
    },
    async indexClean() { return (await git(['diff', '--cached', '--quiet'])).code === 0; },
    async commitPaths(paths, message) {
      if (!await this.indexClean()) throw new OperationError('GIT_INDEX_NOT_CLEAN', 'Unrelated staged changes must be committed or unstaged before committing the iteration records.');
      await write(['--literal-pathspecs', 'add', '--', ...paths], 'ITERATION_COMMIT_FAILED', 'stage the reviewed iteration records', 'Inspect the index and iteration records before retrying.');
      if ((await git(['--literal-pathspecs', 'commit', '--only', '-m', message, '--', ...paths], writeTimeout)).code !== 0) throw new OperationError('ITERATION_COMMIT_FAILED', 'The iteration records were saved but their Git commit failed; the branch and index may already have changed.', 'Inspect git status and commit the saved iteration records before publishing.');
    },
    async clean() {
      const result = await git(['status', '--porcelain']);
      return result.code === 0 && !result.stdout.trim();
    },
    async resolve(ref) {
      const result = await git(['rev-parse', '--verify', '--quiet', `${safeRef(ref)}^{commit}`]);
      return result.code === 0 && /^[0-9a-f]{40,64}$/.test(result.stdout.trim()) ? result.stdout.trim() : null;
    },
    async branchExists(name) { return (await git(['show-ref', '--verify', '--quiet', `refs/heads/${safeRef(name)}`])).code === 0; },
    createBranch: (name, start) => write(['branch', '--no-track', '--', safeRef(name), safeRef(start)], 'GIT_BRANCH_FAILED', `create branch ${name}`, `git branch ${name} ${start}`),
    switchBranch: name => write(['switch', safeRef(name)], 'GIT_SWITCH_FAILED', `switch to ${name} (local changes may conflict)`, `git switch ${name}`),
    fetch: (remote, branch) => write(['fetch', '--no-tags', safeRef(remote), safeRef(branch)], 'GIT_FETCH_FAILED', `fetch ${branch} from ${remote}`, `git fetch ${remote} ${branch}`),
    push: (remote, branch) => write(['push', '--set-upstream', safeRef(remote), `${safeRef(branch)}:refs/heads/${branch}`], 'PR_HEAD_PUSH_FAILED', `push ${branch}`, `git push -u ${remote} ${branch}`),
    async listFiles() {
      if (!await this.available()) return null;
      const result = await git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
      return result.code === 0 ? [...new Set(result.stdout.split('\0').filter(Boolean))].sort() : null;
    },
  };
}
