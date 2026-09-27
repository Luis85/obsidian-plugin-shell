/** Local filesystem/process adapters. Secrets and subprocess output are never reflected in errors. */
import { existsSync, lstatSync, mkdirSync, openSync, closeSync, readFileSync, realpathSync,
  renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { identity, MemoryError, object, requireThat, type Identity, type JsonObject } from './policy.ts';

export interface Paths { home: string; state: string; config: string; venv: string; python: string; runtime: string; installer: string }
export function paths(home = homedir()): Paths {
  const state = join(home, '.hindsight', 'obsidian-shell');
  const venv = join(state, 'venv');
  const runtime = join(state, 'runtime');
  return { home, state, config: join(home, '.hindsight', 'coding-agent.json'), venv,
    python: join(venv, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'),
    runtime, installer: join(runtime, 'node_modules/@vectorize-io/hindsight-coding-agents/dist/installer.js') };
}
export function run(command: string, args: string[], options: { cwd?: string; input?: string; timeout?: number; env?: NodeJS.ProcessEnv } = {}): string {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: false, timeout: options.timeout ?? 30000,
    maxBuffer: 4 * 1024 * 1024, windowsHide: true, ...options });
  requireThat(!result.error && result.status === 0, 'PROCESS_FAILED',
    'A required subprocess failed or timed out. Check prerequisites and rerun its documented command locally; raw output is withheld to protect credentials.');
  return result.stdout;
}
export function git(root: string, args: string[]): string {
  // Disable optional locks, pagers and external diff drivers. No checkout, hooks, push, or fetch.
  return run('git', ['--no-pager', '-c', 'core.fsmonitor=false', '-C', root, ...args],
    { env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' } }).trim();
}
export function repository(cwd: string): Identity {
  const root = realpathSync(git(cwd, ['rev-parse', '--show-toplevel']));
  const common = realpathSync(resolve(root, git(root, ['rev-parse', '--git-common-dir'])));
  let remote = '';
  try { remote = git(root, ['remote', 'get-url', 'origin']); } catch { /* local repository */ }
  const list = run('git', ['-C', root, 'worktree', 'list', '--porcelain', '-z']);
  const main = list.split('\0')[0]?.replace(/^worktree /, '');
  return { ...identity(root, common, remote), mainRoot: main ? realpathSync(main) : root };
}
export function noSymlink(path: string): void {
  let current = resolve(path);
  while (true) {
    try { requireThat(!lstatSync(current).isSymbolicLink(), 'UNSAFE_PATH', 'Refusing a symlink in a managed configuration path.'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}
export function readConfig(path: string): { data: JsonObject; original: string | null } {
  noSymlink(path);
  if (!existsSync(path)) return { data: {}, original: null };
  requireThat(lstatSync(path).size <= 1024 * 1024, 'CONFIG_INVALID', 'Configuration exceeds the 1 MiB safety limit.');
  const original = readFileSync(path, 'utf8');
  try { return { data: object(JSON.parse(original)), original }; }
  catch (error) { if (error instanceof MemoryError) throw error; throw new MemoryError('CONFIG_INVALID', 'Existing JSON is invalid and was preserved.'); }
}
export function saveConfig(path: string, data: JsonObject, expected: string | null): void {
  noSymlink(path);
  requireThat(readConfig(path).original === expected, 'CONFIG_CHANGED', 'Configuration changed while planning; re-plan.');
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.shell-tmp-${process.pid}`;
  const fd = openSync(temporary, 'wx', 0o600);
  try {
    writeFileSync(fd, `${JSON.stringify(data, null, 2)}\n`);
    if (expected !== null) {
      const backup = `${path}.shell-backup-${randomUUID()}`;
      writeFileSync(backup, expected, { flag: 'wx', mode: 0o600 });
    }
    closeSync(fd);
    requireThat(readConfig(path).original === expected, 'CONFIG_CHANGED', 'Concurrent edit detected; existing config was preserved.');
    renameSync(temporary, path);
  } catch (error) {
    try { closeSync(fd); } catch { /* already closed */ }
    if (existsSync(temporary)) unlinkSync(temporary);
    throw error;
  }
}
export function locked<T>(state: string, operation: () => T): T {
  noSymlink(state);
  mkdirSync(state, { recursive: true, mode: 0o700 });
  const path = join(state, 'operation.lock');
  let fd: number;
  try { fd = openSync(path, 'wx', 0o600); }
  catch { throw new MemoryError('BUSY', 'Another memory operation is running. After a crash, verify no operation is active before removing operation.lock.'); }
  try { writeFileSync(fd, String(process.pid)); return operation(); }
  finally { closeSync(fd); unlinkSync(path); }
}
export function backend(p: Paths, command: string, payload: JsonObject = {}): JsonObject {
  requireThat(existsSync(p.python), 'NOT_INSTALLED', 'Install the optional Python environment first.');
  const script = fileURLToPath(new URL('./embedded.py', import.meta.url));
  const output = run(p.python, [script, command], { input: JSON.stringify(payload), timeout: 600000 });
  try { return object(JSON.parse(output)); }
  catch { throw new MemoryError('BACKEND_PROTOCOL', 'The Python adapter did not return valid JSON.'); }
}
export function npmCommand(args: string[]): { command: string; args: string[] } {
  if (process.env.npm_execpath?.endsWith('npm-cli.js')) return { command: process.execPath, args: [process.env.npm_execpath, ...args] };
  if (process.platform !== 'win32') return { command: 'npm', args };
  const cli = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  requireThat(existsSync(cli), 'NPM_NOT_FOUND', 'Use npm run memory on Windows so the Node-based npm launcher is available.');
  return { command: process.execPath, args: [cli, ...args] };
}
