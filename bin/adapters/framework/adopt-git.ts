import { execFile } from 'node:child_process';
import { lstat, open } from 'node:fs/promises';
import { join } from 'node:path';
import type { GitFacts } from '../../domain/adoption/contracts.ts';

/** Repository settings under which `git status` could run configured commands (clean filters, fsmonitor hooks, includes). */
const executableConfig = /^\s*\[\s*(?:filter|include|includeif)\b|fsmonitor/im;
const hostPattern = /^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/;

async function readConfig(root: string): Promise<string | null> {
  try {
    const handle = await open(join(root, '.git', 'config'), 'r');
    try {
      const { bytesRead, buffer } = await handle.read(Buffer.alloc(262144), 0, 262144, 0);
      return buffer.subarray(0, bytesRead).toString('utf8');
    } finally { await handle.close(); }
  } catch { return null; }
}
/** The configured origin URL, verbatim; callers must not print it, since it may embed credentials. */
function originUrl(config: string | null): string | null {
  return /\[\s*remote\s+"origin"\s*\][^[]*?\burl\s*=\s*(\S+)/i.exec(config ?? '')?.[1] ?? null;
}
/** The origin URL of a plain repository at root, read without running git; null when absent or unreadable. */
export async function readOriginUrl(root: string): Promise<string | null> {
  return originUrl(await readConfig(root));
}
/** Host name of the origin remote; user names, passwords, tokens, ports and paths are dropped. */
export function remoteHost(config: string | null): string | null {
  const url = originUrl(config);
  if (!url) return null;
  const host = url.includes('://') ? /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]*@)?([^:/]+)/i.exec(url)?.[1] : /^(?:[^@/\s]+@)?([^:/\s]+):/.exec(url)?.[1];
  return host && hostPattern.test(host) ? host.toLowerCase() : null;
}
function statusEnvironment(): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined && !key.startsWith('GIT_')) environment[key] = value;
  return { ...environment, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat' };
}
function porcelain(root: string, signal?: AbortSignal): Promise<{ dirty: boolean | null; note: string | null }> {
  return new Promise(accept => {
    execFile('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', 'status', '--porcelain=v1', '--untracked-files=normal'],
      { cwd: root, env: statusEnvironment(), timeout: 15000, maxBuffer: 1048576, windowsHide: true, ...(signal ? { signal } : {}) }, (error, stdout) => {
        if (error) accept({ dirty: null, note: 'git status could not be run safely (git missing, refused or timed out); run git status before starting.' });
        else accept({ dirty: stdout.trim().length > 0, note: null });
      });
  });
}
/** Presence, cleanliness and remote host only. Git is run only when the repository configuration declares nothing executable. */
export async function readGit(root: string, signal?: AbortSignal): Promise<GitFacts> {
  let entry;
  try { entry = await lstat(join(root, '.git')); } catch { return { present: false, dirty: null, remoteHost: null, dirtyNote: null }; }
  if (!entry.isDirectory()) return { present: true, dirty: null, remoteHost: null, dirtyNote: 'A linked worktree or submodule: its status and remote were not read; run git status before starting.' };
  const config = await readConfig(root);
  const host = remoteHost(config);
  if (config === null) return { present: true, dirty: null, remoteHost: null, dirtyNote: 'The repository configuration could not be read, so git was not run; run git status before starting.' };
  if (executableConfig.test(config)) {
    return { present: true, dirty: null, remoteHost: host, dirtyNote: 'The repository configuration declares filters, includes or fsmonitor settings, so git was not run; run git status before starting.' };
  }
  const state = await porcelain(root, signal);
  return { present: true, dirty: state.dirty, remoteHost: host, dirtyNote: state.note };
}
