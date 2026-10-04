/**
 * Changed-set computation shared by `check --fast` and `check --plan`: everything that differs between
 * merge-base(<base>, HEAD) and the working tree (committed, staged, unstaged and untracked files).
 */
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { exists } from './files.ts';
import { codeRoots, isWithinRoot } from '../../../scripts/shared/project-roots.mjs';
import { OperationError } from './contracts.ts';

export type Git = (root: string, args: string[]) => Promise<string | null>;
/** Which commit the diff starts from and why. `commit` is null only when no merge-base was resolved. */
export interface BaseInfo { source: 'option' | 'origin-main' | 'head'; ref: string; requested: string | null; commit: string | null; note?: string }
export interface Changes {
  source: 'git' | 'unavailable'; files: string[]; paths: string[]; configuration: string[];
  untraceable?: string[]; reason?: string; base: BaseInfo | null;
}
const code = /\.(?:[cm]?[jt]sx?|vue)$/;
const sha = /^[0-9a-f]{40,64}$/;
const defaultBase = 'origin/main';
/** Changes vitest related cannot trace: build/test configuration next to the code. */
const configuration = /^(?:package(?:-lock)?\.json|tsconfig[^/]*\.json|configs\/.+|vite[^/]*\.config\.[cm]?[jt]s|vitest[^/]*\.config\.[cm]?[jt]s|tests\/suites\.json)$/;
export const runGit: Git = (root, args) => new Promise(accept => {
  execFile('git', args, { cwd: root, shell: false, windowsHide: true, timeout: 10_000, maxBuffer: 16_777_216, encoding: 'utf8' },
    (error, stdout) => accept(error ? null : stdout));
});
/** NUL-separated git output keeps non-ASCII and special paths verbatim (no core.quotePath quoting). */
const fields = (text: string) => text.split('\0').filter(Boolean);
async function commitOf(root: string, git: Git, args: string[]): Promise<string | null> {
  const output = (await git(root, args))?.trim();
  return output && sha.test(output) ? output : null;
}
const headBase = (commit: string | null, note?: string): BaseInfo => ({ source: 'head', ref: 'HEAD', requested: null, commit, ...(note ? { note } : {}) });
/** An explicit --base must resolve; the implicit origin/main default quietly falls back to HEAD. */
async function mergeBaseOf(root: string, git: Git, ref: string, requested: boolean, head: string | null): Promise<BaseInfo> {
  const target = await commitOf(root, git, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  if (!target) {
    if (requested) throw new OperationError('BASE_NOT_FOUND', `--base ${ref} is not a commit in this repository.`, 'node bin/app check --fast --base <branch-or-commit>');
    return headBase(head, `${ref} does not exist; the diff starts at HEAD`);
  }
  const commit = await commitOf(root, git, ['merge-base', ref, 'HEAD']);
  if (commit) return { source: requested ? 'option' : 'origin-main', ref, requested: requested ? ref : null, commit };
  if (requested) throw new OperationError('BASE_NO_MERGE_BASE', `--base ${ref} shares no history with HEAD.`);
  return headBase(head, `${ref} shares no history with HEAD; the diff starts at HEAD`);
}
/** Null when git or a HEAD commit is unavailable. */
async function resolveBase(root: string, git: Git, requested?: string): Promise<BaseInfo | null> {
  if (requested !== undefined && (!requested || requested.startsWith('-'))) throw new OperationError('INVALID_OPTION', '--base requires a branch, tag or commit name.');
  if (await git(root, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}']) === null) return null;
  const head = await commitOf(root, git, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}']);
  return mergeBaseOf(root, git, requested ?? defaultBase, requested !== undefined, head);
}
/** Pairs NUL-separated `--name-status` output into [status, path] entries, then adds untracked files. */
function changeEntries(tracked: string, untracked: string): Array<[string, string]> {
  const parts = fields(tracked), entries: Array<[string, string]> = [];
  for (let index = 0; index + 1 < parts.length; index += 2) entries.push([parts[index]!, parts[index + 1]!]);
  for (const path of fields(untracked)) entries.push(['?', path]);
  return entries;
}
/** A deleted code/root file, a configuration file or a non-code file inside a code root cannot be traced. */
function untraceableChange(status: string, path: string, inRoot: boolean): boolean {
  if (status.startsWith('D')) return code.test(path) || inRoot;
  return configuration.test(path) || (inRoot && !code.test(path));
}
function untraceableReason(listed: string[]): string {
  const sample = listed.slice(0, 5).join(', ') + (listed.length > 5 ? ', …' : '');
  return `deleted, configuration or non-code files changed (${sample}); running the full suite`;
}
const unavailable = (): Changes => ({ source: 'unavailable', files: [], paths: [], configuration: [], base: null,
  reason: 'git is unavailable or the repository has no commit, so the changed set cannot be computed; running every step unscoped (full suite)' });
interface Tally { files: Set<string>; untraceable: Set<string>; paths: Set<string>; configuration: Set<string> }
async function tally(root: string, entries: Array<[string, string]>): Promise<Tally> {
  const roots = [...codeRoots(root), 'bin'];
  const sets: Tally = { files: new Set(), untraceable: new Set(), paths: new Set(), configuration: new Set() };
  for (const [status, path] of entries) {
    if (path.split('/').includes('node_modules')) continue;
    sets.paths.add(path);
    if (configuration.test(path)) sets.configuration.add(path);
    if (untraceableChange(status, path, roots.some(item => isWithinRoot(path, item)))) sets.untraceable.add(path);
    else if (code.test(path) && await exists(join(root, path))) sets.files.add(path);
  }
  return sets;
}
/** Tracked changes since the base plus untracked files, relative to the project root. */
export async function changedFiles(root: string, git: Git = runGit, requestedBase?: string): Promise<Changes> {
  const base = await resolveBase(root, git, requestedBase);
  if (!base) return unavailable();
  const tracked = await git(root, ['diff', '--name-status', '--no-renames', '-z', '--relative', base.commit ?? 'HEAD']);
  const untracked = tracked === null ? null : await git(root, ['ls-files', '--others', '--exclude-standard', '-z']);
  if (tracked === null || untracked === null) return unavailable();
  const sets = await tally(root, changeEntries(tracked, untracked));
  const sorted = (set: Set<string>) => [...set].sort();
  const common = { source: 'git' as const, files: sorted(sets.files), paths: sorted(sets.paths), configuration: sorted(sets.configuration), base };
  const listed = sorted(sets.untraceable);
  return listed.length ? { ...common, untraceable: listed, reason: untraceableReason(listed) } : common;
}
